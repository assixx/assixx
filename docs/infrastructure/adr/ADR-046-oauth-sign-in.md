# ADR-046: Microsoft OAuth Sign-In for Tenant-Owner (`root`)

| Metadata                | Value                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Status**              | Amended                                                                                                                         |
| **Date**                | 2026-04-16 (amended same-day — post-merge smoke test findings)                                                                  |
| **Decision Makers**     | Simon Öztürk (SCS-Technik)                                                                                                      |
| **Affected Components** | `auth/oauth/` module, `signup/` service, `users`, `tenants`, `user_oauth_accounts`, `root_logs`, Redis, frontend login + signup |
| **Related ADRs**        | ADR-005 (Auth), ADR-006 (CLS), ADR-009 (Audit), ADR-014 (Migrations), ADR-019 (RLS), ADR-044 (SEO/CSP)                          |
| **Masterplan**          | [FEAT_MICROSOFT_OAUTH_MASTERPLAN.md](../../FEAT_MICROSOFT_OAUTH_MASTERPLAN.md) — execution plan, spec deviations D1–D17         |

---

## Context

Assixx supported only email + password authentication for the tenant owner
registration flow. The target segment (German industrial Mittelstand, 50–500
employees) uses Microsoft 365 almost universally — every Geschäftsführer,
IT-Leiter, HR-Leiter already has a corporate Microsoft account for Outlook,
Teams, and SharePoint. Forcing them to create (and remember) a separate
password for Assixx added sign-up friction and a permanent operational cost
(forgotten passwords, password-reset support tickets).

### Problem

1. The initial sign-up flow requires inventing a new password — friction at
   the worst possible moment (before the user has seen value).
2. German B2B buyers expect SSO with their existing identity provider. Missing
   it reads as "this product isn't for serious companies."
3. Every password we store is a liability. OAuth sign-in moves the authentication
   surface off our infrastructure onto Microsoft's — fewer credentials to
   protect, phish, or leak.

### Requirements

- **Scope V1 is root-only**: The tenant owner (role = `root`) can sign up and
  log in with Microsoft. `admin` and `employee` roles stay on password — they
  are created internally by the root.
- **Work/school accounts only**: Personal `@outlook.com` / `@hotmail.com` /
  `@live.com` must be rejected (Azure AD `/organizations/` endpoint).
- **Email verification mandatory**: id_token `email_verified` must be true.
- **Defense in depth**: PKCE + state nonce + id_token signature verification.
- **Atomic signup**: Tenant + root user + OAuth link inserted in one
  transaction (R8 — no half-created tenants).
- **Single source of truth for redirect URIs**: Dev + prod derive the callback
  URL from one env var.

### Non-requirements (V2+)

- Google, Apple, GitHub providers.
- OAuth login for `admin`/`employee` roles.
- A settings-page "link / unlink Microsoft" UI for existing password admins.
- Storing Microsoft access/refresh tokens (no Microsoft Graph integration in V1).
- Automatic tenant provisioning from the Azure tenant profile (V3, needs
  domain-verified claims).

---

## Decision

Microsoft OAuth sign-in ships as an **authentication infrastructure feature**
(not a tenant-buyable addon). It is wired as a sub-module under `auth/oauth/`
and composes with the existing JWT+refresh session machinery.

### 1. Provider & endpoint

**Only Microsoft. Only `/organizations/`.**

```
https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize
https://login.microsoftonline.com/organizations/oauth2/v2.0/token
```

`/organizations/` is Azure AD's work/school-only endpoint — personal Microsoft
accounts are rejected by Azure before we ever see them. One provider, one
flow, one secret pair, one failure mode.

### 2. 3-Layer security stack

```
Browser → Frontend button              (Step 5.1 MicrosoftSignInButton)
        ↓ window.location.href
Backend GET /authorize                 (Step 2.6)
        │
        ├─ OAuthService.startAuthorization                  ← Step 2.5
        │    ├─ generatePkce()  → verifier (server-side) + challenge (to MS)
        │    └─ OAuthStateService.create(mode, verifier)    ← Step 2.2
        │         └─ Redis SET oauth:state:{uuidv7} EX 600  (10 min)
        │
        ↓ 302
Microsoft consent screen (outside our trust boundary)
        ↓ 302
Backend GET /callback                  (Step 2.6)
        │
        ├─ OAuthStateService.consume(state)
        │    └─ Redis GETDEL oauth:state:{uuidv7}           ← R2 replay defence
        │
        ├─ MicrosoftProvider.exchangeCodeForTokens           ← Step 2.3
        │    └─ POST /token (code + client_secret + code_verifier)
        │
        ├─ MicrosoftProvider.verifyIdToken                   ← Step 2.3
        │    ├─ jose.jwtVerify against createRemoteJWKSet (24h cache)
        │    ├─ audience = MICROSOFT_OAUTH_CLIENT_ID (fixed)
        │    ├─ issuer regex ^https://login.microsoftonline.com/{guid}/v2\.0$
        │    └─ reject email_verified=false                  ← R1 defence
        │
        └─ branch on stored.mode
             ├─ 'login'  → resolveLogin()  → { userId, tenantId } or not-linked
             └─ 'signup' → resolveSignupContinue()
                            └─ Redis SET oauth:signup-ticket:{uuidv7} EX 900
                               (15 min — gives user time to fill the form)
```

The three layers of defence:

| Layer                             | Attacker model                                                     | Defence                                                                                           |
| --------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| L1 — PKCE code_verifier           | Attacker intercepts `code` from Microsoft redirect                 | Verifier stays server-side; without it `/token` rejects the exchange (RFC 7636)                   |
| L2 — State nonce (Redis GETDEL)   | CSRF: attacker forces victim through an OAuth flow to link account | Single-use state — second GETDEL returns nil, callback throws `UnauthorizedException` (401)       |
| L3 — id_token JWT signature + aud | Compromised code endpoint or downgraded token                      | Microsoft's RS256 signature verified against JWKS; audience pinned to our client_id; issuer regex |

### 3. Triple-user model for pre-auth vs post-auth DB access

OAuth callbacks are **pre-auth** — no JWT, no CLS `tenantId`. The
`user_oauth_accounts` lookup must work across tenants because we don't know
which tenant the Microsoft `sub` belongs to until we've found the match.

| Step                               | Pool / context                                       | Rationale                                                                |
| ---------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| Login lookup by (provider, sub)    | `sys_user` BYPASSRLS (pre-auth, no CLS tenant yet)   | Cross-tenant search via `OAuthAccountRepository.findLinkedByProviderSub` |
| Update last_login_at               | `queryAsTenant(..., tenantId)` (post-match, pre-JWT) | Explicit tenant id from the matched row, no CLS needed                   |
| Tenant+user+link creation (signup) | `systemTransaction` (cross-tenant atomicity)         | `SignupService.registerTenantWithOAuth` (R8 — one txn or nothing)        |

Per ADR-019, the `app_user` pool (strict RLS) is never used for OAuth paths
because every OAuth interaction needs cross-tenant reach.

### 4. Redis keyspace

Dedicated ioredis client with `keyPrefix: 'oauth:'` — not shared with the
throttler's Redis instance (separation of concerns; throttler churn must not
evict auth state).

| Key pattern                    | TTL   | Created by                           | Consumed by                                 | Semantics                                                                                                           |
| ------------------------------ | ----- | ------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `oauth:state:{uuidv7}`         | 600 s | `OAuthStateService.create`           | `OAuthStateService.consume` (GETDEL)        | Single-use CSRF + PKCE-verifier bundle — replay attempt returns 401                                                 |
| `oauth:signup-ticket:{uuidv7}` | 900 s | `OAuthService.resolveSignupContinue` | `OAuthService.consumeSignupTicket` (GETDEL) | Bridges callback → company-details form submission; `peekSignupTicket` reads it non-destructively for form pre-fill |

Both use UUIDv7 (PostgreSQL 18 native `uuidv7()` — see Spec Deviation D1).
Length + entropy: 128-bit random → unguessable within the TTL window.

### 5. `PUBLIC_APP_URL` as single source of truth for redirect URI

Three Doppler secrets, not four:

- `MICROSOFT_OAUTH_CLIENT_ID` — Azure AD Application ID
- `MICROSOFT_OAUTH_CLIENT_SECRET` — Azure AD client secret
- `PUBLIC_APP_URL` — base URL of the deployment

The backend derives `${PUBLIC_APP_URL}/api/v2/auth/oauth/microsoft/callback` at
boot. Azure AD app registration lists both dev (`http://localhost:3000`) and
prod (`https://www.assixx.com`) callback URIs. No per-env redirect-URI secret,
no drift risk (R4 mitigation). A boot-time assertion logs the resolved URI
every startup — config drift is immediately visible in the logs.

### 6. Signup = atomic transaction via SignupService

`OAuthService.completeSignup(ticketId, dto)` consumes the ticket (GETDEL) and
delegates to `SignupService.registerTenantWithOAuth`. That method opens ONE
`systemTransaction` containing:

1. INSERT tenant
2. INSERT root user (with an unusable bcrypt hash — password-login path
   effectively locked for OAuth-only users; V2 "set password" would overwrite)
3. INSERT default addon trials (core addons always active per ADR-033)
4. INSERT `user_oauth_accounts` row

On any failure the whole transaction rolls back — no half-created tenant.
On `23505` unique_violation (R3 duplicate Microsoft account) the repository
translates it to `ConflictException('Dieses Microsoft-Konto ist bereits mit
einem Assixx-Tenant verknüpft.')` → HTTP 409 → frontend shows the German
banner on the login page.

### 7. Session issuance shared with password login

OAuth callbacks (login-success) and complete-signup both call
`AuthService.loginWithVerifiedUser(userId, tenantId, 'oauth-microsoft', ip, ua)`
— a new public method that wraps the existing private token-rotation +
audit-log + last-login-bump helpers. Cookie shape is imported from
`AuthController` (`COOKIE_OPTIONS`, `REFRESH_COOKIE_OPTIONS`): single source
of truth for cookie flags, max-age, and httpOnly/sameSite semantics.

The `login_method` field in `root_logs.new_values` distinguishes
`'password'` vs `'oauth-microsoft'` — forensic trail for compromised-credential
investigations.

### 8. Frontend surface

| File                                           | Role                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| `components/MicrosoftSignInButton.svelte`      | Pixel-perfect Microsoft Brand-Guidelines button (41 px, Segoe UI, 4-colour square)  |
| `components/OAuthDivider.svelte`               | "oder mit E-Mail" separator between OAuth button and the password form              |
| `routes/login/+page.svelte`                    | Hosts `<MicrosoftSignInButton mode="login" />` above email form; handles `?oauth=…` |
| `routes/signup/+page.svelte`                   | Hosts `<MicrosoftSignInButton mode="signup" />` above company form                  |
| `routes/signup/oauth-complete/+page.server.ts` | SSR peek + form action; re-sets httpOnly cookies from backend's 201 response        |
| `routes/signup/oauth-complete/+page.svelte`    | Company-details form with pre-filled email (read-only) + name (editable)            |

CSP: `https://login.microsoftonline.com` whitelisted in `connect-src`
defensively (V1 flow is fully server-side; entry preempts V2+ Graph calls).

---

## Alternatives Considered

### A1 — Google or generic SAML as the V1 provider

**Rejected.** The target customer base runs Microsoft 365. Google Workspace
is rare in German industrial Mittelstand. SAML would add XML parsing, key
rotation, and per-tenant IdP metadata uploads — over-engineered for one
provider's flow.

### A2 — Common endpoint (accepts personal + work accounts)

**Rejected.** Personal `@outlook.com` accounts are appropriate for consumer
apps. Assixx is B2B — a personal Microsoft account that happens to have
access to an email is not proof of belonging to an industrial company. The
`/organizations/` endpoint is the right fit.

### A3 — OAuth for `admin` and `employee` roles

**Rejected for V1.** The tenant owner creates all admins and employees
internally — those users don't register, they are provisioned. Letting them
self-register via OAuth would invert the onboarding model without a business
reason. V2+ can add link/unlink per-user.

### A4 — Store Microsoft access/refresh tokens

**Rejected for V1.** We do not call Microsoft Graph. Storing tokens requires
a data-protection ADR (encrypted at rest, rotation policy, incident-response
plan for token theft). Not worth it without a concrete feature that needs
them. V2+ Teams/calendar sync would re-introduce token storage under a
dedicated ADR.

### A5 — Skip PKCE (confidential client — we have a secret)

**Rejected.** PKCE doubles up with the client_secret at zero implementation
cost. The verifier is a `randomBytes(32).base64url()` call; the challenge is
one SHA256. A bug that drops `code_verifier` would otherwise silently weaken
defence (R9) — the unit test that asserts the verifier is in the token-
exchange body is the guard.

### A6 — Request-scoped Redis connections

**Rejected.** The throttler module proves the ioredis lazyConnect + per-module
keyPrefix pattern. Single long-lived Redis client, no connection churn.

### A7 — Frontend callback route

**Rejected.** Masterplan spec deviation D5. `(app)/(shared)/oauth-callback/`
inside SvelteKit's authenticated route group can't run pre-auth. The backend
handles the callback in one step, then 302s to `/dashboard`, `/login`, or
`/signup/oauth-complete` — browser stays same-origin, cookies forward
automatically.

### A8 — Forego the signup-ticket peek endpoint (Spec Deviation D17)

**Rejected.** Plan §5.4 mandates pre-filled email + name on the complete-signup
form. Redis tickets are single-use (GETDEL on consume). Without a peek
mechanism the form would require the user to re-type their email — worse UX
than the plan demands. The `GET /signup-ticket/:id` endpoint exposes ONLY
email + displayName (never `providerUserId` or `microsoftTenantId`) and is
idempotent — a leaked ticket id reveals only what the user already saw at
the Microsoft consent screen.

---

## Consequences

### Positive

1. **Zero password friction** for the tenant owner — one click to Microsoft,
   one form to fill company details, done.
2. **Fewer stored passwords** — OAuth users get an unusable bcrypt hash;
   no password-reset flows, no credential leaks.
3. **Enterprise-friendly first impression** — German B2B buyers see SSO and
   understand the product is built for their workflow.
4. **Defense in depth** — PKCE + state nonce + id_token verification + RLS +
   atomic transaction. Any single-layer bypass still fails.
5. **V2-ready provider abstraction** — `oauth-provider.interface.ts` +
   provider-agnostic orchestration in `OAuthService`. A Google provider would
   be one new file + one new Doppler secret.
6. **No "addon" noise** — OAuth is not a tenant-buyable feature, so it lives
   outside the addon checklist, ADR-020 permissions, and ADR-024 frontend
   guards. Less surface, less drift.

### Negative

1. **Two sign-up paths** to maintain — password and OAuth. `SignupService`
   has both `registerTenant()` (existing) and `registerTenantWithOAuth()`
   (new). DRY would collapse them, but the branches diverge on password
   hashing + email confirm. Kept separate for clarity.
2. **Azure AD dependency for onboarding** — when Microsoft has an outage,
   new tenant owners cannot sign up via OAuth. Password signup remains
   available as a fallback.
3. **Extra forwardRef** — `AuthModule` ↔ `OAuthModule` circular dep resolved
   via NestJS canonical `forwardRef()` (Spec Deviation D15). Two
   `eslint-disable` comments with explicit ADR references.

### Risks & Mitigations

| Risk                                                                   | Mitigation                                                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| R1 — Azure tenant spoofing (attacker registers their own Azure tenant) | `email_verified` claim required; future: domain-match manual review for first-ever tenant of a domain  |
| R2 — State replay / CSRF                                               | Redis GETDEL single-use state + PKCE verifier + 10-min TTL                                             |
| R3 — Duplicate Microsoft account signs up twice                        | UNIQUE(provider, provider_user_id) + Postgres 23505 → 409 ConflictException                            |
| R4 — Dev/prod redirect URI drift                                       | Single `PUBLIC_APP_URL` secret + boot-time assertion + both URIs registered in Azure AD                |
| R5 — RLS bypass on pre-auth lookup                                     | `OAuthAccountRepository.findLinkedByProviderSub` uses `systemQuery()` (BYPASSRLS) — explicit, reviewed |
| R6 — Clock drift breaks token exchange                                 | Docker compose inherits host clock; Azure error body logged for diagnostics                            |
| R7 — Secrets leak in logs                                              | MicrosoftProvider redacts `client_secret`, `code`, tokens in all error-path logs                       |
| R8 — Signup race (same sub twice)                                      | UNIQUE constraint + atomic transaction — exactly one succeeds, 409 for the other                       |
| R9 — PKCE downgrade                                                    | Unit test asserts `code_verifier` in every token-exchange request builder                              |
| R10 — User double-identity (personal vs corporate)                     | `/organizations/` endpoint rejects personal accounts at Azure; recovery path documented in HOW-TO      |

---

## Verification

### Unit (Phase 3 — 58 → 64 tests)

```
backend/src/nest/auth/oauth/
  oauth-state.service.test.ts            # 11 tests — state lifecycle, single-use, type-guard
  oauth.service.test.ts                  # 22 tests — login/signup flows, R2/R3/R8, peek (+6 in Step 5.4)
  providers/microsoft.provider.test.ts   # 20 tests — URL building, token exchange, id_token verify
  oauth-account.repository.test.ts       # 11 tests — pool selection, is_active filter, SQL shape
```

`docker exec assixx-backend pnpm exec vitest run --project unit backend/src/nest/auth/oauth/` → 64/64 passed in 1.06 s.

### API integration (Phase 4 — 35 tests)

```
backend/test/oauth.api.test.ts
```

`pnpm exec vitest run --project api backend/test/oauth.api.test.ts` → 35/35 passed.

What IS covered end-to-end: Zod validation on all inputs, R2 state replay via
seeded-Redis, `prompt=consent` gating on signup mode, rate limiting
(`AuthThrottle` tier 10/5 min), V2 stub endpoints (401 / 501), `/complete-signup`
happy path via Redis-seeded ticket.

What's covered at the unit level instead (Spec Deviation D16): MS-signed
id_token verification, wrong `iss`, `email_verified=false`. Mocking
`login.microsoftonline.com` from the HTTP-against-Docker test runner would
require an in-process TestingModule — rejected for consistency with the other
33 API modules.

### Live smoke

- Peek endpoint: `GET /signup-ticket/{uuidv7}` → 404 for unknown, 400 for
  malformed id, 200 `{email, displayName}` for valid ticket — verified.
- Authorize endpoint: `GET /authorize?mode=login` → 302 to
  `login.microsoftonline.com/organizations/oauth2/v2.0/authorize?...` with
  real PKCE challenge + UUIDv7 state + fixed client_id — verified.
- Full Microsoft round-trip: requires Azure AD credentials in Doppler — left
  as user-driven manual smoke per plan Phase 6 DoD.

---

## Implementation Summary

| Area     | Files new                                       | Files modified                      | Tests added            |
| -------- | ----------------------------------------------- | ----------------------------------- | ---------------------- |
| Database | 2 migrations                                    | 0                                   | 0 (schema-only)        |
| Backend  | 9                                               | 4 (auth, signup, module wiring)     | 64 unit + 35 API       |
| Frontend | 4 (button, divider, oauth-complete server+page) | 3 (login, signup, svelte.config)    | 0 (covered by backend) |
| Docs     | 2 (this ADR + HOW-TO-AZURE-AD-SETUP)            | 3 (FEATURES, README, how-to/README) | —                      |

Total: ~15 new source files, ~10 modified files, 99 tests at merge time.

---

## Amendment 2026-04-16: Post-merge smoke test — 3 bugs fixed, architecture corrected

End-to-end browser-driven smoke testing against a live Azure AD tenant
surfaced three defects that the test suite (pre-merge) had not caught,
each pointing at an architectural asymmetry between the OAuth login-success
path and the established password-login / OAuth-signup paths. Fixed in-place
before the feature was used in real customer sign-ups.

### Bug A — OAuth login-success 302 → `/dashboard` (404)

**Observed:** Re-login via OAuth landed on `http://localhost:5173/dashboard`
which is not a SvelteKit route — every re-login flashed a 404 error page
before the app eventually bounced through `/login` to the role-specific
dashboard.

**Root cause:** `oauth.controller.ts` hard-coded `reply.redirect('/dashboard')`
in the `login-success` branch. SvelteKit only has `/root-dashboard`,
`/admin-dashboard`, `/employee-dashboard` (plus `/blackboard` for the
`dummy` role). Password login never hit this because its form action
returns JSON and the client navigates to the role-correct route itself.

**Fix (adopted):** Change the backend redirect target to `/login`. The
existing `/login/+page.server.ts` `load` function detects the just-set
session cookie, calls `/users/me`, and `redirect(302, getRedirectPath(role))`.
SvelteKit becomes the role-routing shepherd for OAuth login-success, exactly
as it already was for OAuth signup (`/signup/oauth-complete`) and password
login. Zero frontend changes needed — the mechanism was already there.

**Rejected alternative:** Hard-code role-based targets in the backend
controller. Would work but couples the backend to frontend route names and
duplicates role-routing logic that already lives in SvelteKit's load
functions.

### Bug B — `POST /api/v2/e2e/keys` 401 after OAuth login

**Observed:** On OAuth re-login for a user without a local IndexedDB E2E
key, the client's E2E bootstrap `POST /api/v2/e2e/keys` returned 401
("No authentication token provided"). Same session, same page; other
endpoints (`/addons/my-addons`, `/auth/connection-ticket`) worked fine.

**Root cause:** `frontend/src/lib/utils/api-client.utils.ts`
`getCredentialsMode()` returned `'include'` only for three paths
(`/auth/login`, `/auth/logout`, `/auth/refresh`) and `'omit'` for everything
else — a perf micro-optimisation premised on the assumption that the
in-memory `TokenManager` always holds a Bearer JWT to attach as
`Authorization` header. After OAuth login-success that assumption breaks:
the flow is a 302 redirect with no JSON body, so `TokenManager` stays
empty and no Bearer is attached. With `credentials: 'omit'` the browser
also doesn't send the session cookie → backend sees no auth at all → 401.

**Fix (adopted):** `getCredentialsMode()` now returns `'include'` for every
endpoint. Cookies are the canonical auth channel (ADR-005 JWT guard accepts
both `Authorization: Bearer` AND cookie); Bearer from TokenManager is a
client-side optimisation on top of it. Same-origin in dev (Vite proxy) and
prod (Nginx), and the backend's CORS already supports credentials, so the
change is safe. A small JWT per request is negligible overhead.

### Bug C — Session-countdown timer stuck at "00:00 / expired"

**Observed:** After a successful OAuth login the header token-timer
rendered `00:00 / --expired` even though the backend had just issued a
30-minute access token (all API calls worked — purely a UI bug).

**Root cause:** `TokenManager.getRemainingTime()` required
`this.accessToken !== null` to return anything ≠ 0, and `this.accessToken`
comes from `localStorage.getItem('accessToken')`. Password login's form
action returned JSON that client code wrote to localStorage → timer worked.
OAuth login-success is a 302 with no JSON body → localStorage never
populated → timer had no expiry to display. The underlying session was
fine; only the UI widget was starved.

**Decision — the long-term-correct fix (adopted):**
Introduce a companion non-httpOnly cookie `accessTokenExp` whose value is
the Unix timestamp (seconds since epoch) of the access token's `exp` claim.
Set atomically with `accessToken` / `refreshToken` by a new shared helper
`setAuthCookies()` in `auth.controller.ts`. Non-sensitive (integer,
no authentication power on its own). Frontend `TokenManager` reads the
cookie as the canonical expiry source — works regardless of whether the
auth flow produced a JSON response body.

**Alternatives considered + rejected:**

- **Hydrate TokenManager from a `+layout.server.ts` data field.** Works
  but bolts an extra hydration path onto an already-asymmetric design. The
  masterplan's `/dashboard` hard-code was exactly this class of workaround;
  repeating the pattern felt wrong.
- **Have SvelteKit own the OAuth callback** (`+page.server.ts` under
  `/auth/oauth/microsoft/callback`, backend becomes a JSON `/exchange`
  endpoint). Architecturally clean and mirrors password login exactly —
  but the net fix is the same (TokenManager hydrated from JSON) while
  requiring: new SvelteKit route, new backend endpoint (or controller
  refactor to dual-response), Azure App Registration URI update, test
  migration, Dockerfile-environment implications. All additional code for
  the same outcome the cookie delivers. Deferred — revisit only if another
  OAuth provider arrives and the asymmetry becomes chronic.
- **Remove `localStorage` JWT storage entirely; cookies-only.** This IS
  the long-term ideal (localStorage is an XSS exfiltration surface). The
  cookie pattern adopted here is a prerequisite step — once every read
  path uses `accessTokenExp` + `credentials: 'include'`, localStorage
  can be deprecated in a follow-up PR.

**Invariant enforced:** `setAuthCookies()` is the only place that writes
session cookies. All four auth entry points — password login, token
refresh, OAuth login-success, OAuth complete-signup — go through it. The
3-cookie shape (`accessToken` + `refreshToken` + `accessTokenExp`) is
atomic by construction. `clearAuthCookies()` mirrors it on logout.

**Follow-up sub-fix (same day):** Once the initial-value bug was resolved,
manual testing surfaced that the timer widget showed a correct initial
value but **froze** — updated only on page reload. Root cause was two
further instances of the "assume localStorage token == session exists"
smell inside TokenManager: the `startTimer()` and `tick()` guards both
early-returned on `this.accessToken === null`. OAuth login-success lands
without an in-memory token, so `startTimer()` never registered a
`setInterval` and the tick loop never ran. Fix: extract a `hasSessionSignal()`
private predicate that accepts EITHER signal (in-memory JWT or the
`accessTokenExp` cookie), use it in all three places (`startTimer`,
`tick`, `hasValidToken`), make `startTimer` idempotent (check
`timerInterval !== null` before registering a new one), and have
`onTimerUpdate` call `startTimer()` after the first subscription so that
the (app)-layout subscribing is enough to kick the tick loop for a
cookie-only session. `clearTokens()` also now wipes the exp cookie
client-side as belt-and-braces (backend clears it via the logout
response, but the client-side wipe guarantees `hasSessionSignal()` flips
to false immediately even if the server call races).

With this, every post-auth code path in TokenManager uses one predicate
(`hasSessionSignal`) to decide "is there a session?" — no more scattered
`accessToken !== null` assumptions. That single-predicate invariant is
the reason why the next auth method (say a second OAuth provider) will
not hit the same class of bug.

### Bug D — Role-switch fails after OAuth login (split-brain)

**Observed:** OAuth-logged-in root users clicking "Switch to admin view"
were silently bounced back to `/login`. The intended POST to
`/api/v2/role-switch/root-to-admin` never fired.

**Root cause — two stacked architectural smells:**

1. **D1 — Same localStorage-as-session-truth assumption (third occurrence).**
   `RoleSwitch.svelte:223` guarded the call with
   `localStorage.getItem('accessToken') === null → redirect to /login`.
   OAuth users have `null` there, so they hit the early return. Same root
   cause class as Bug B (`/e2e/keys` 401) and Bug C (timer freeze). The
   repetition confirmed that ad-hoc `localStorage` reads scattered across
   the codebase are the design smell; every one of them is a latent bug
   for any auth method that doesn't populate localStorage.

2. **D2 — Cookie-vs-localStorage split-brain on role rotation.**
   `role-switch.controller.ts` minted a new JWT carrying the switched
   `activeRole` claim but returned it in JSON only — the three session
   cookies were never updated. Result after a successful role-switch:
   localStorage had the new-role token (via `updateStorageAfterSwitch`),
   but the HttpOnly cookie still held the OLD-role token. Client-side
   Bearer-based API calls saw the new role; SSR layout loaders
   (`(app)/+layout.server.ts` reads cookie → `/users/me`) saw the old
   role. The split was masked for password-login users because
   `window.location.href = …` triggers a full page reload and re-hydrates
   from localStorage. OAuth users would not have hit the split at all
   once D1 was fixed — but the split is a real bug that would have
   appeared on the next SSR-first render regardless of auth method.

**Fix (architecturally correct, both smells addressed together):**

- **Backend: `rotateAccessCookies(reply, newAccessToken)` helper in
  `auth.controller.ts`.** Sets the `accessToken` + `accessTokenExp`
  cookies with the new JWT. Leaves the refresh cookie untouched — role
  switch does not change session identity, only a UI-state claim. All
  three role-switch endpoints now inject `@Res({ passthrough: true })`
  and call the helper before returning. The 3-cookie invariant
  (`setAuthCookies`) is extended with a 2-cookie "rotate without touching
  refresh" operation — single-sourced in `auth.controller.ts`.

- **Frontend: `RoleSwitch.svelte`** now uses `getApiClient().post()`
  instead of a hand-rolled `fetch`. That automatically inherits
  `credentials: 'include'` (Bug B's fix) and Bearer attachment when
  available. The localStorage gate is replaced with
  `getTokenManager().hasValidToken()` which (per Bug C's fix) accepts
  either session signal. Three code paths that used to diverge for
  password vs OAuth now converge on one path.

**Invariant extended:** "After any auth state mutation — login, refresh,
role switch, signup — cookies and localStorage are in sync and backend
JWT claims match the cookie claims." Role switch was the last code path
that violated this; after D2 every mutation goes through a centralised
cookie writer.

### Files touched by D (in addition to the earlier amendment table)

| File                                                     | Change                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| `backend/src/nest/auth/auth.controller.ts`               | `rotateAccessCookies` helper — 2-cookie rotation that leaves refresh alone |
| `backend/src/nest/role-switch/role-switch.controller.ts` | All 3 POST endpoints inject `@Res` and call `rotateAccessCookies`          |
| `frontend/src/lib/components/RoleSwitch.svelte`          | Custom `fetch` → `apiClient.post`; localStorage gate → `hasValidToken`     |

### Pattern-level takeaway (added to follow-up work)

Three separate bugs (B, C, D) in three separate files all traced to the
same smell: **direct reads of `localStorage.accessToken` as a proxy for
"is the user logged in?"**. That assumption breaks for any auth method
that populates cookies but not localStorage (OAuth today, SAML/SSO
tomorrow). The follow-up work item "deprecate `localStorage` accessToken"
is upgraded in urgency: every remaining call-site must migrate to either
`TokenManager.hasValidToken()` (for session presence) or `apiClient`
(for auth-wearing API calls). A grep of the codebase is the next step.

### Files touched by this amendment

| File                                              | Change                                                                                                                                                                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/nest/auth/auth.controller.ts`        | `EXP_COOKIE_OPTIONS`, `extractJwtExp`, `setAuthCookies`, `clearAuthCookies` + refactor of all 3 call sites                                                                                                 |
| `backend/src/nest/auth/oauth/oauth.controller.ts` | `/dashboard` → `/login` (Bug A); adopt `setAuthCookies` (Bug C)                                                                                                                                            |
| `frontend/src/lib/utils/api-client.utils.ts`      | `getCredentialsMode` always returns `'include'` (Bug B)                                                                                                                                                    |
| `frontend/src/lib/utils/token-manager.ts`         | `readAccessTokenExpCookie`, `hasSessionSignal`, cookie-first `getRemainingTime`, idempotent `startTimer`, `onTimerUpdate` self-kick, `clearTokens` client-side cookie wipe (Bug C + follow-up tick-freeze) |
| `backend/test/oauth.api.test.ts`                  | New assertion for `accessTokenExp` cookie shape + value                                                                                                                                                    |

### Follow-up work (tracked, not in this amendment)

1. **Deprecate `localStorage` accessToken** — all reads can migrate to the
   cookie. Removes the XSS exfiltration surface. Requires an audit of
   every `getAccessToken()` caller. Estimated: 1 dedicated PR.
2. **Remove `Authorization: Bearer` attachment from api-client** — with
   `credentials: 'include'` everywhere, the header is dead weight. Safe to
   drop once #1 is done.
3. **Revisit SvelteKit-owns-OAuth-callback** if a second OAuth provider
   joins — the asymmetry argument strengthens with each added provider.

---

## Amendment 2026-04-17: Bug E — Role-switch resets the session timer

**Observed (manual, post-merge):** Header countdown jumped from e.g. 28:12
back to 30:00 on every role-switch click. A user running low on session time
could indefinitely extend their session by clicking root → admin → root →
admin every ~29 minutes — a silent inactivity-timeout bypass. Confirmed
identical behaviour for both OAuth-logged-in and password-logged-in sessions
once the 3-cookie invariant was consistently enforced.

**Root cause:** `RoleSwitchService.generateToken` called `jwtService.sign()`
without overriding `expiresIn`, so the JwtModule's default (30 min) applied.
Every role-switch minted a fresh 30-minute access token, and
`rotateAccessCookies` dutifully wrote the fresh `accessTokenExp` to the
browser — correct from the plumbing layer, but semantically wrong: role-switch
changes only the `activeRole` claim, it is not a session renewal.

**Why Bug D's fix exposed Bug E:** Before Bug D, the role-switched token was
only visible via localStorage (Bearer path). With the 3-cookie rollout, the
fresh `exp` also landed in the non-httpOnly `accessTokenExp` cookie that
`TokenManager.getRemainingTime()` reads as its canonical source. The timer
now reliably reflected the minted exp — so the "fresh 30 min" behaviour
became visible where it had been hidden before.

**Decision — preserve the caller's session exp on role-switch:**

- `JwtAuthGuard.buildAuthUser` propagates the caller's JWT `exp` into the
  `NestAuthUser` interface (new field `exp: number`, documented in
  `backend/src/nest/common/interfaces/auth.interface.ts`).
- `RoleSwitchController`'s three POST endpoints forward `user.exp` to the
  service layer as an explicit `preserveExp` argument.
- `RoleSwitchService.generateToken` signs the new JWT with
  `expiresIn: max(preserveExp - nowSeconds, 1)` — overriding the module's
  default 30-min. The floor of 1 second keeps jsonwebtoken from rejecting a
  non-positive `expiresIn` in the sub-second race window where a barely-valid
  token passes the guard and reaches the service.
- Refresh-token cookie stays untouched — session identity is unchanged,
  only a UI-state claim rotates.

**Architectural framing:** Role-switch is a **claim change**, not a session
refresh. Only the explicit `AuthService.refresh` flow (via refresh-token
rotation, ADR-005) legitimately extends session lifetime. This matches
industry convention for claims-based auth: `exp` belongs to the session,
not the individual claim-carrying token.

**Tests added (`role-switch.service.test.ts`, `|permission|` suite):**

1. `should sign new token with remainingSeconds derived from preserveExp` —
   asserts the `expiresIn` option is ≈(preserveExp − now) ± 2 s clock drift.
2. `should floor expiresIn at 1s when caller token is already expired` —
   proves the negative-delta race window collapses to a 1-second lease.
3. `should NOT extend session on repeated role-switches (anti-bypass)` —
   two switches in sequence; second `expiresIn` must be strictly less than
   the first, demonstrating that the window only shrinks, never expands.

All 14 role-switch service tests pass; full permission suite 572/572 green.

### Files touched by E

| File                                                        | Change                                                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/nest/common/interfaces/auth.interface.ts`      | `NestAuthUser.exp: number` — carries caller's JWT exp through CLS-free path                                               |
| `backend/src/nest/common/guards/jwt-auth.guard.ts`          | `buildAuthUser` propagates `payload.exp` into `NestAuthUser`                                                              |
| `backend/src/nest/role-switch/role-switch.controller.ts`    | All 3 endpoints forward `user.exp` as `preserveExp` argument                                                              |
| `backend/src/nest/role-switch/role-switch.service.ts`       | `generateToken` accepts `preserveExp`; overrides JwtModule default via `expiresIn`                                        |
| `backend/src/nest/role-switch/role-switch.service.test.ts`  | 3 new tests for preserve-exp semantics + anti-bypass invariant                                                            |
| `frontend/src/routes/login/+page.server.ts`                 | `setAuthCookies` writes `accessTokenExp`; `clearAuthCookies` mirrors — closes the gap that hid Bug E before               |
| `frontend/src/routes/signup/oauth-complete/+page.server.ts` | Same 3-cookie-invariant fix as the login form action                                                                      |
| `frontend/src/lib/server/jwt-exp.ts`                        | Shared server-side `extractJwtExp` helper — mirror of backend counterpart                                                 |
| `backend/src/nest/auth/auth.controller.ts`                  | `COOKIE_OPTIONS`/`REFRESH_COOKIE_OPTIONS`/`EXP_COOKIE_OPTIONS` `maxAge` corrected from milliseconds to seconds (RFC 6265) |

**Collateral fix (Cookie Max-Age unit bug):** While tracing Bug E,
`@fastify/cookie` (wrapping `cookie@1.x`) was confirmed to write the
`maxAge` option 1:1 into the `Max-Age=` header — and RFC 6265 specifies
that value as **seconds**. The backend was writing `30 * 60 * 1000` (ms),
producing `Max-Age=1800000` → ~20.83 days of browser persistence for access
cookies, ~19 years for refresh cookies. The values were corrected to
`30 * 60` and `7 * 24 * 60 * 60`. Not the direct cause of Bug E but an
adjacent latent bug surfaced by the investigation.

---

## References

- [ADR-005: Authentication Strategy](./ADR-005-authentication-strategy.md) — JWT+refresh flow reused
- [ADR-006: Multi-Tenant Context Isolation](./ADR-006-multi-tenant-context-isolation.md) — CLS (pre-auth has none; post-match pool selection)
- [ADR-009: Central Audit Logging](./ADR-009-central-audit-logging.md) — `oauth.login` / `oauth.signup` events in `root_logs`
- [ADR-014: Database & Migration Architecture](./ADR-014-database-migration-architecture.md) — `user_oauth_accounts` migration pattern
- [ADR-019: Multi-Tenant RLS Isolation](./ADR-019-multi-tenant-rls-isolation.md) — `systemQuery` for pre-auth cross-tenant reads
- [ADR-044: SEO & Security Headers](./ADR-044-seo-and-security-headers.md) — CSP directive structure
- [FEAT_MICROSOFT_OAUTH_MASTERPLAN.md](../../FEAT_MICROSOFT_OAUTH_MASTERPLAN.md) — execution plan, 17 spec deviations, session log
- [FEAT_OAUTH_PROFILE_PHOTO_MASTERPLAN.md](../../FEAT_OAUTH_PROFILE_PHOTO_MASTERPLAN.md) — Amendment §A4 execution plan (profile-photo sync, Spec Deviations D1–D7)
- [HOW-TO-AZURE-AD-SETUP.md](../../how-to/HOW-TO-AZURE-AD-SETUP.md) — Azure Portal registration + Doppler secrets
- [RFC 7636 — PKCE for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc7636)
- [Microsoft identity platform and OAuth 2.0 authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
- [Microsoft Brand Guidelines for Sign-In Buttons](https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-branding-in-apps)
- [Microsoft Graph — Get profilePhoto](https://learn.microsoft.com/en-us/graph/api/profilephoto-get?view=graph-rest-1.0)

---

## Amendment 2026-04-17: §A4 partial reversal — Microsoft Graph profile-photo sync

**Observed (product decision, 2026-04-17):** the avatar rendered for OAuth-provisioned tenant owners was a two-letter initial (`SÖ`) over a coloured tile. Competitors in the German B2B Mittelstand segment display the user's Microsoft 365 photo out of the box. Closing this gap lowers the "this product wasn't built for us" perception at first dashboard render — one of the highest-friction moments in the activation funnel.

**Decision:** `§A4 — Store Microsoft access/refresh tokens` is **partially reversed**. Microsoft Graph `/me/photo` is called during the OAuth callback (login) and the `completeSignup` flow (signup) to sync the user's profile picture. The `access_token` is used **in-flight only** and is never written to a persistent store:

- **Login path:** `OAuthService.handleCallback` awaits `ProfilePhotoService.syncIfChanged` inside the same request context. `tokens.accessToken` never leaves the stack frame.
- **Signup path:** the access_token is carried through the existing Redis signup ticket (15-min TTL, single-use GETDEL, `oauth:` keyPrefix) — the same storage already trusted for the PKCE `codeVerifier`, which is strictly more sensitive. The token is consumed once by `OAuthService.completeSignup` (after `registerTenantWithOAuth` returns) and discarded.

The "no token storage at the DB layer" invariant (encrypted at rest, rotation policy, incident-response plan for token theft) remains unchanged. Redis is transient, scoped, and bounded by TTL.

### Scope change

Azure AD authorize-request `scope` expanded from `openid profile email` to **`openid profile email User.Read`**. `User.Read` is a delegated Graph permission required for `/me/photo/$value` and auto-consented per-user (no admin consent gate). `ProfilePhoto.Read.All` was rejected — tenant-wide scope, needs admin consent, over-privileged. `offline_access` stays out (original D10 invariant untouched; we still do not store refresh tokens).

### ETag-cached sync architecture

```
    Login / completeSignup
           │
           ▼
    ProfilePhotoService.syncIfChanged(userId, tenantId, accessToken)
           │
           ├─ Manual-upload guard: skip if users.profile_picture prefix ≠ `oauth_`
           │
           ├─ Graph GET /me/photo                            (~200 B metadata)
           │      │
           │      ├─ 404  /  1x1 GIF placeholder → clear DB + file  → return
           │      └─ 200 → PhotoMetadata { etag, width, height, contentType }
           │
           ├─ ETag compare against user_oauth_accounts.photo_etag
           │      │
           │      └─ match → skip binary, return (≥ 95 % of re-logins)
           │
           ├─ Graph GET /me/photos/240x240/$value            (~50 KB binary)
           │      │
           │      └─ 404 → fallback GET /me/photo/$value (largest available)
           │
           ├─ Write tmp file, RENAME to content-addressed path (Spec Deviation D4)
           │   Path: uploads/profile_pictures/oauth_<uuid>_<etag8>.jpg
           │
           └─ Atomic DB transaction (explicit tenantId — ADR-019 pre-auth pool)
                  UPDATE users SET profile_picture = <newPath>
                  UPDATE user_oauth_accounts SET photo_etag = <newEtag>
              On DB error → unlink newPath (orphan cleanup)
              On success → unlink old oauth_*.jpg (stale cache)
```

Database artifact: `user_oauth_accounts.photo_etag VARCHAR(64)` added via migration `20260417094053371_add-oauth-photo-etag.ts` (nullable — existing OAuth users populate it on first successful sync).

### Spec Deviations D4–D7 (recorded in the masterplan)

| #   | Divergence                                                              | Why                                                                                                                     |
| --- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| D4  | File rename happens BEFORE the DB update (masterplan: after)            | Crash-safety — DB reference to a non-existent file would never self-heal (ETag match on next run would skip)            |
| D5  | `transaction({ tenantId })` used instead of `tenantTransaction`         | Pre-JWT context has no CLS tenantId; explicit option is the ADR-019-sanctioned pattern                                  |
| D6  | `getProfilePicture` / `getUuid` as private helpers, not on UsersService | Trivial single-column reads; no second consumer to justify promoting                                                    |
| D7  | Signup photo sync in `OAuthService.completeSignup`, not `SignupService` | Avoids SignupModule → OAuthModule circular dep; keeps OAuth orchestration inside one module; ticket carries accessToken |

### Failure-mode contract

`ProfilePhotoService.syncIfChanged` has a top-level try/catch and NEVER throws. Every failure (Graph 5xx, network, filesystem, DB) logs a warning and returns. The calling login/signup flow is unaffected. R1 from the masterplan is enforced by the `never-throw contract` unit tests.

### Manual-upload protection

If `users.profile_picture` points at a path whose filename does NOT start with the `oauth_` prefix, the sync is a no-op. The user chose their own picture; OAuth must not overwrite it. Enforced at the very start of `syncIfChanged` — no Graph call, no DB write.

### Test coverage

- 94 OAuth unit tests (30 new) cover ETag cache, metadata null, manual-upload skip, binary null, DB-rename ordering, orphan cleanup, provider throws, db-read throws.
- 48 API tests (2 new) regression-guard the `User.Read` scope.
- 3 existing API tests updated with `accessToken` on Redis-seeded `SignupTicket` fixtures (D7 consequence).

### Azure AD consent impact

Existing OAuth-linked users will see Microsoft's "Read your profile" consent screen on the first login after the deploy. Documented in `HOW-TO-AZURE-AD-SETUP.md`.

### Files touched by this amendment

| File                                                               | Change                                                                                             |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `database/migrations/20260417094053371_add-oauth-photo-etag.ts`    | NEW — adds `user_oauth_accounts.photo_etag VARCHAR(64)`                                            |
| `backend/src/nest/auth/oauth/profile-photo.service.ts`             | NEW — ETag-cached orchestrator                                                                     |
| `backend/src/nest/auth/oauth/profile-photo.service.test.ts`        | NEW — 12 unit tests                                                                                |
| `backend/src/nest/auth/oauth/providers/microsoft.provider.ts`      | `SCOPES` += `User.Read`; `fetchPhotoMetadata` + `fetchPhotoBinary` + helpers                       |
| `backend/src/nest/auth/oauth/providers/microsoft.provider.test.ts` | +8 tests (5 metadata, 3 binary)                                                                    |
| `backend/src/nest/auth/oauth/oauth.types.ts`                       | `PhotoMetadata` type; `SignupTicket.accessToken` field                                             |
| `backend/src/nest/auth/oauth/oauth.service.ts`                     | Inject `ProfilePhotoService`; call from login-success + completeSignup; ticket carries accessToken |
| `backend/src/nest/auth/oauth/oauth.service.test.ts`                | +3 tests (login sync, not-linked no-sync, signup sync); fixtures updated                           |
| `backend/src/nest/auth/oauth/oauth-account.repository.ts`          | `getPhotoEtag` + `updatePhotoEtag`                                                                 |
| `backend/src/nest/auth/oauth/oauth-account.repository.test.ts`     | +7 tests                                                                                           |
| `backend/src/nest/auth/oauth/oauth.module.ts`                      | `ProfilePhotoService` in providers + exports                                                       |
| `backend/test/oauth.api.test.ts`                                   | +2 scope assertions; 3 fixtures updated (accessToken)                                              |
| `docs/how-to/HOW-TO-AZURE-AD-SETUP.md`                             | `User.Read` permission documented                                                                  |
| `docs/FEATURES.md`                                                 | OAuth profile-photo sync mentioned                                                                 |
| `docs/FEAT_OAUTH_PROFILE_PHOTO_MASTERPLAN.md`                      | NEW — execution plan                                                                               |

---

## Amendment 2026-04-25: Bug F — refresh paths still gated by localStorage-only check

**Observed (production logs, 2026-04-25):** On a tenant subdomain (`testfirma.localhost:5173`),
mouse-move on the `/shifts` page produced
`[ERROR] TokenManager: No access token available, cannot refresh` in the browser console
(and Sentry) every time the access token's remaining lifetime fell below 10 minutes — even
though every API call in the same session returned 200. Token never got refreshed; once it
expired, the user would be hard-logged-out instead of seamlessly rotated.

**Root cause — fourth and fifth occurrence of the D1 anti-pattern** in `token-manager.ts`:

1. `canRefresh()` (Z. 318) gated on `this.accessToken === null` and emitted `log.error`.
2. `refreshIfNeeded()` (Z. 264) gated on `this.accessToken === null` and silently no-op'd.

Both predated the cookie-canonical migration in Bugs B/C/D. Cookie-only sessions (OAuth
login-success, ADR-050 cross-origin tenant-subdomain handoff, or any reload that hydrates
the singleton with empty localStorage) had a valid `accessTokenExp` cookie + valid HttpOnly
`refreshToken` cookie, but `getRemainingTime()` (cookie-aware) and these two gates
(localStorage-only) disagreed about whether a session existed. The activity-triggered
refresh path therefore aborted with a logged error; the proactive api-client refresh path
aborted silently — exactly the failure mode pattern §"D1 third occurrence" warned about.

**Decision — same as B/C/D: route both gates through `hasSessionSignal()`.**

- `canRefresh()` now early-returns on `!hasSessionSignal()` instead of `accessToken === null`.
  Log level downgraded from `error` to `warn` because a missing session signal is a
  legitimate logged-out state, not an anomaly worth a Sentry issue.
- `refreshIfNeeded()` now early-returns on `!hasSessionSignal()` instead of
  `accessToken === null`. No log emitted — it is the proactive-refresh hot path, called by
  api-client before every authenticated request; silence is correct when there is no session.

The actual refresh request (`POST /auth/refresh` with `credentials: 'include'`) was already
correct: the HttpOnly `refreshToken` cookie travels regardless of localStorage state, so
removing the gate self-heals — a successful refresh re-populates `localStorage.accessToken`
via `setTokens()`, putting the singleton back in sync on the next tick.

### Pattern-recurrence note

This is the second confirmation of the "every remaining call-site must migrate" follow-up
recorded after Bug D. The pattern is now suppressed inside `TokenManager` itself. The
remaining surface is **callers outside TokenManager** that read
`localStorage.getItem('accessToken')` or `getAccessToken() === null` as a session-existence
check. An architectural test (analogous to the `is_active` magic-number guard in
`shared/src/architectural.test.ts`) is the logical next step to prevent occurrence #6 —
tracked as a separate Open Item, not in this amendment's scope.

### Files touched by this amendment

| File                                      | Change                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `frontend/src/lib/utils/token-manager.ts` | `canRefresh` + `refreshIfNeeded` switched to `hasSessionSignal()`; log level `warn` |
