# FEAT: Microsoft OAuth Sign-In — Execution Masterplan

> **Plan type:** FEATURE
> **Created:** 2026-04-15
> **Version:** 0.1.0 (Draft)
> **Status:** DRAFT — Phase 0 (planning)
> **Branch:** `feat/microsoft-oauth-signin`
> **Spec:** this document + [ADR-046](./infrastructure/adr/ADR-046-oauth-sign-in.md) (to be written in Phase 6)
> **Author:** Simon Öztürk (SCS-Technik)
> **Estimated sessions:** 8
> **Actual sessions:** 0 / 8

---

## Changelog

| Version | Date       | Change                                                 |
| ------- | ---------- | ------------------------------------------------------ |
| 0.1.0   | 2026-04-15 | Initial draft — phases outlined                        |
| 1.0.0   | TBD        | Phase 1 COMPLETE — `user_oauth_accounts` migration run |
| 1.1.0   | TBD        | Phase 2 COMPLETE — backend OAuth module shipped        |
| 1.2.0   | TBD        | Phase 3 COMPLETE — unit tests green                    |
| 1.3.0   | TBD        | Phase 4 COMPLETE — API integration tests green         |
| 1.4.0   | TBD        | Phase 5 COMPLETE — frontend signin + signup flow live  |
| 2.0.0   | TBD        | Phase 6 COMPLETE — ADR-046 accepted, feature shipped   |

---

## Problem Statement & Scope

### Problem

Assixx currently supports **only email + password** authentication for the tenant admin who registers a new company. German industrial customers (target: M365-using Mittelstand) expect to sign in with their corporate Microsoft account, the same one they use for Outlook, Teams, and SharePoint. Without OAuth the initial signup friction is higher than necessary and the admin must remember another password.

### Scope V1

| In scope                                                                         | Out of scope (V2+)                                               |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Microsoft OAuth (Azure AD v2.0 / OIDC)                                           | Google, Apple, GitHub providers                                  |
| Tenant-admin SIGNUP via Microsoft                                                | Employee login via OAuth                                         |
| Tenant-admin LOGIN via Microsoft (once linked)                                   | Admin-linked settings page ("link/unlink Microsoft")             |
| Azure AD **Organizations endpoint** (work/school accounts — blocks personal MSA) | Azure AD **Common endpoint** (personal accounts)                 |
| Pre-fill signup form with OAuth data (email, name)                               | Fully automatic tenant provisioning without company-details step |
| Link one Microsoft account to one Assixx user                                    | Multiple OAuth providers per user                                |
| Redis-backed state+PKCE cache                                                    | Persistent OAuth state audit trail                               |

### Why Microsoft only

Target customers (German industrial SMEs, 50–500 employees) run Microsoft 365 almost universally. Admin buyers (Geschäftsführer, IT-Leiter, HR-Leiter) already have a work Microsoft account. Google Workspace is rare in this segment, Apple is consumer-focused, GitHub is irrelevant to the buyer persona. One provider = one backend flow, one secret pair, one failure mode.

### Why Organizations endpoint (not Common)

`login.microsoftonline.com/organizations/` accepts only Azure AD work/school accounts and rejects personal `@outlook.com` / `@hotmail.com` / `@live.com` accounts. B2B-appropriate — filters out the "Google is private" concern for Microsoft too.

### Not an addon — what the Addon-Integration checklist does NOT apply to

Microsoft OAuth is **authentication infrastructure**, not a tenant-buyable addon. The relevant ADRs for addon features ([ADR-020](./infrastructure/adr/ADR-020-per-user-feature-permissions.md) per-user permissions, [ADR-024](./infrastructure/adr/ADR-024-frontend-feature-guards.md) frontend addon guards, [ADR-033](./infrastructure/adr/ADR-033-addon-based-saas-model.md) addon SaaS model) and the [HOW-TO-INTEGRATE-FEATURE.md](./how-to/HOW-TO-INTEGRATE-FEATURE.md) checklist are **deliberately skipped** for this feature:

| Checklist item                                                | Skipped because                                                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `INSERT INTO addons (code, ...)`                              | OAuth is not a purchasable module. No addon row.                                                                    |
| `FeatureCheckService.checkTenantAccess(tenantId, ADDON_CODE)` | No addon → no addon gate. Endpoints are `@Public()` (pre-auth) or JWT-guarded (post-auth).                          |
| `@RequirePermission(FEAT, MODULE, 'canWrite')`                | No fine-grained permissions. Login/signup flow has only 2 states: linked or not-linked.                             |
| `FeaturePermissionRegistrar implements OnModuleInit`          | No `PermissionCategoryDef` — no module/action matrix.                                                               |
| Sidebar navigation entry in `navigation-config.ts`            | OAuth is not a page a user navigates to — it is invoked from login/signup cards.                                    |
| Breadcrumb `urlMappings` entry                                | Only the `/signup/oauth-complete` page needs one breadcrumb entry (minor).                                          |
| `(root)` / `(admin)` / `(shared)` route group                 | Login and signup are at `/login` and `/signup` (outside `(app)` group); callback is public until tokens are issued. |

What **does** apply from the addon checklist and is already covered in this plan: RLS + GRANTs for `user_oauth_accounts` (§1.1), Zod DTOs (§2.x), ActivityLoggerService + audit_trail (§2), Vitest patterns (§3, §4), ADR documentation (§6). Those are not addon-specific — they are platform-wide standards.

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must be true before starting

- [ ] Docker stack running (all containers healthy)
- [ ] Branch `feat/microsoft-oauth-signin` checked out from `main`
- [ ] No pending migrations blocking
- [ ] Azure AD App Registration created by user (Tenant Owner), Client ID + Secret issued
- [ ] Doppler secrets added: `MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET`, `MICROSOFT_OAUTH_REDIRECT_URI` (for dev: `http://localhost:3000/api/v2/auth/oauth/microsoft/callback`; for prod: `https://www.assixx.com/api/v2/auth/oauth/microsoft/callback`)
- [ ] DB backup taken (before Phase 1 migration): `database/backups/full_backup_pre_oauth_{TIMESTAMP}.dump`
- [ ] Spec reviewed by product owner (this document)

### 0.2 Risk register

| #   | Risk                                                                                                                                                                                               | Impact   | Probability | Mitigation                                                                                                                                                               | Verification                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| R1  | **Azure tenant spoofing** — attacker registers their own Azure tenant, creates a user `admin@realcompany.de`, signs up at Assixx claiming to be the real admin.                                    | Critical | Low         | Require **email_verified** claim true AND reject sign-ups whose email domain does not match a manual review list for first-ever tenant of that domain (flag for review). | API test: callback with `email_verified=false` returns 403. Manual: first signup per domain is reviewed by op. |
| R2  | **OAuth state replay / CSRF** — attacker forces victim to complete an OAuth flow that links victim's Microsoft to attacker's Assixx account.                                                       | High     | Medium      | Redis-stored state token with single-use semantic + PKCE code_verifier + 10-min TTL.                                                                                     | Unit test: reused state returns 403. API test: missing PKCE verifier returns 403.                              |
| R3  | **Duplicate sign-up via OAuth** — same Microsoft `sub` claim tries to register a second Assixx tenant.                                                                                             | Medium   | Medium      | `UNIQUE (provider, provider_user_id)` DB constraint. Controller returns 409 with message "Dieses Microsoft-Konto ist bereits mit einem Assixx-Tenant verknüpft."         | API test: second signup with same `sub` returns 409.                                                           |
| R4  | **Redirect URI mismatch** — dev/prod config drift causes production callback to fail silently.                                                                                                     | High     | Medium      | Redirect URI derived from `PUBLIC_APP_URL` env var, not hardcoded. Azure AD app registration lists BOTH dev + prod URIs.                                                 | Boot-time assertion logs the resolved redirect URI. Manual smoke test in prod profile.                         |
| R5  | **RLS bypass** — `oauth.service` forgets to set tenant context when looking up `user_oauth_accounts` during login (pre-auth — no CLS tenant yet).                                                  | High     | Medium      | Use `db.systemQuery()` for pre-auth lookups (account match by `provider_user_id`) since tenant is unknown until after match; switch to `tenantQuery()` post-match.       | Unit test: `OAuthService.findLinkedUser()` uses system pool. Code review checklist.                            |
| R6  | **Token exchange 401 on clock drift** — Azure AD rejects code exchange if container clock drifts beyond 5 min.                                                                                     | Low      | Low         | Docker compose syncs clock from host; log Azure error body for diagnosis.                                                                                                | Manual test: local clock skew of +10 min reproduces + logs diagnostic.                                         |
| R7  | **Secret leak in logs** — client_secret or access_token printed via default logger during error path.                                                                                              | Critical | Medium      | Explicit allow-list in HTTP interceptor: redact `client_secret`, `code`, `access_token`, `refresh_token`, `id_token` in logs.                                            | Unit test: logger receives payload with secrets → output redacted.                                             |
| R8  | **Signup race** — two parallel OAuth signups with same `provider_user_id` both pass the "no existing link" check, then second insert crashes with unique violation, leaving a half-created tenant. | High     | Low         | Wrap "insert user_oauth_accounts" in same transaction as tenant+user creation; serializable isolation is not needed because the UNIQUE constraint is the final arbiter.  | Unit test: simulate concurrent transactions → one commits, one rolls back cleanly.                             |
| R9  | **PKCE downgrade** — if Microsoft's token endpoint does not require PKCE for confidential clients, an implementation bug that drops `code_verifier` could silently succeed and weaken defense.     | Medium   | Low         | Always send `code_verifier`; unit-test the token-exchange request builder to assert the parameter is present.                                                            | Unit test: `buildTokenExchangeBody()` always contains `code_verifier`.                                         |
| R10 | **User double-identity** — admin A signs up with their personal Microsoft account (somehow passing the org-endpoint filter), then later cannot be linked to a corporate account with same email.   | Medium   | Low         | Block personal accounts at `/organizations/` endpoint (Azure enforces). Document recovery path in HOW-TO (manual DB unlink → re-signup).                                 | API test: `/common/` endpoint would pass personal account; `/organizations/` rejects it.                       |

### 0.3 Ecosystem integration points

| Existing system                                                                           | Integration                                                                                                                 | Phase | Verified on |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----- | ----------- |
| `auth` module ([ADR-005](./infrastructure/adr/ADR-005-authentication-strategy.md))        | OAuth login issues same JWT access + refresh tokens as password login. Sub-module under `auth/oauth/`.                      | 2     |             |
| `signup` module                                                                           | OAuth signup calls existing `SignupService.registerTenant()` after enriching DTO with OAuth email + display_name.           | 2     |             |
| `DatabaseService` ([ADR-019](./infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md)) | `systemQuery()` for pre-auth OAuth lookups; `tenantTransaction()` for post-auth link/unlink; new table follows RLS pattern. | 1, 2  |             |
| `ClsService` ([ADR-006](./infrastructure/adr/ADR-006-multi-tenant-context-isolation.md))  | `tenantId`+`userId` set in CLS after successful OAuth login exactly as the JWT guard does.                                  | 2     |             |
| Redis (already provisioned)                                                               | New key namespace `oauth:state:{uuid}` — single-use, 10-min TTL.                                                            | 2     |             |
| Doppler                                                                                   | 3 new secrets (see §0.1).                                                                                                   | 0     |             |
| `audit_trail` ([ADR-009](./infrastructure/adr/ADR-009-central-audit-logging.md))          | Log `oauth.signup`, `oauth.login`, `oauth.link`, `oauth.unlink` events with provider + provider_user_id.                    | 2     |             |
| Cloudflare Turnstile                                                                      | Turnstile is NOT required on the OAuth button (Microsoft already provides bot protection); verify with security review.     | 5     |             |
| `throttler.guard`                                                                         | OAuth callback endpoint rate-limited (20/min/IP) to prevent code-replay storms.                                             | 2     |             |
| SEO & CSP ([ADR-044](./infrastructure/adr/ADR-044-seo-and-security-headers.md))           | Add `login.microsoftonline.com` and `graph.microsoft.com` to `connect-src`; no inline scripts required on callback page.    | 5     |             |
| Landing + Login + Signup pages                                                            | New "Mit Microsoft anmelden/registrieren" button above e-mail form + divider.                                               | 5     |             |

---

## Phase 1: Database Migrations

> **Dependency:** Phase 0 complete (Azure app + Doppler + backup).

### Step 1.1: Create `oauth_provider` ENUM and `user_oauth_accounts` table [PENDING]

**New files:**

- `database/migrations/{utc-timestamp}_create-user-oauth-accounts.ts`

**What happens:**

1. Create ENUM `oauth_provider AS ENUM ('microsoft')` — V1 single value; future providers added via `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.
2. Create table `user_oauth_accounts` with tenant_id, user_id, provider, provider_user_id (Microsoft `sub` claim), email, email_verified, display_name, microsoft_tenant_id (Microsoft `tid` claim, for audit), linked_at, last_login_at, is_active, timestamps.
3. Enable + force RLS with the standard strict-mode policy (ADR-019).
4. Grant SELECT/INSERT/UPDATE/DELETE to `app_user` AND `sys_user` (triple-user model; pre-auth matches run as `sys_user`).
5. Unique constraints: `(provider, provider_user_id)` (one MS account → one Assixx user), `(user_id, provider)` (one Assixx user → at most one MS link).
6. Partial index `(tenant_id, user_id) WHERE is_active = 1`.

**Mandatory per-table checklist (multi-tenant!):**

- [ ] `id UUID PRIMARY KEY DEFAULT uuid_generate_v7()`
- [ ] `tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- [ ] `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- [ ] `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- [ ] RLS policy using `NULLIF(current_setting('app.tenant_id', true), '')` pattern
- [ ] `GRANT SELECT, INSERT, UPDATE, DELETE ON user_oauth_accounts TO app_user`
- [ ] `GRANT SELECT, INSERT, UPDATE, DELETE ON user_oauth_accounts TO sys_user`
- [ ] UUID PK → no sequence GRANT needed
- [ ] `is_active INTEGER NOT NULL DEFAULT 1`
- [ ] Both `up()` AND `down()` implemented (`down` drops table + ENUM)

**Verification:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d user_oauth_accounts"
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT tablename, policyname FROM pg_policies WHERE tablename = 'user_oauth_accounts';"
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT unnest(enum_range(NULL::oauth_provider));"
```

### Phase 1 — Definition of Done

- [ ] 1 migration file with both `up()` AND `down()`
- [ ] Dry run passes: `doppler run -- ./scripts/run-migrations.sh up --dry-run`
- [ ] Migration applied successfully
- [ ] Table exists with RLS policy (strict-mode, app_user+sys_user grants verified)
- [ ] ENUM `oauth_provider` exists with value `microsoft`
- [ ] Backend compiles and boots
- [ ] Existing tests still green
- [ ] Backup taken before migration
- [ ] `scripts/sync-customer-migrations.sh` run to update fresh-install

---

## Phase 2: Backend OAuth Module

> **Dependency:** Phase 1 complete.
> **Reference module:** `backend/src/nest/auth/` (sibling, same patterns — JWT issuance, cookie setting, Zod DTOs).

### Step 2.1: Module skeleton + types + DTOs [PENDING]

**New directory:** `backend/src/nest/auth/oauth/`

**File structure:**

```
backend/src/nest/auth/oauth/
    oauth.module.ts
    oauth.controller.ts
    oauth.service.ts                     # provider-agnostic orchestration
    oauth-state.service.ts               # Redis state+PKCE cache
    oauth-account.repository.ts          # user_oauth_accounts CRUD
    providers/
        microsoft.provider.ts            # Azure AD v2.0 OIDC client
        oauth-provider.interface.ts      # Provider abstraction (future-proof)
    oauth.types.ts                       # OAuthState, OAuthTokens, OAuthUserInfo
    dto/
        authorize-query.dto.ts           # mode=login|signup
        callback-query.dto.ts            # code, state
        complete-signup.dto.ts           # company details + OAuth state reference
        index.ts
```

**Register in `auth.module.ts`:**

- [ ] `OAuthModule` imported; `OAuthController` exported for global router.
- [ ] `auth.module.ts` imports `CacheModule` (Redis) and `SignupModule` (to reuse `SignupService`).

### Step 2.2: OAuthStateService [PENDING]

**File:** `backend/src/nest/auth/oauth/oauth-state.service.ts`

**Why now:** Dependency-free, needed by both controller (store) and service (consume).

**Methods:**

- `create(mode: 'login' | 'signup', codeVerifier: string): Promise<string>` — generates UUIDv7 `state`, stores `{mode, codeVerifier, createdAt}` in Redis at `oauth:state:{uuid}` with 600 s TTL, returns `state`.
- `consume(state: string): Promise<StoredState>` — GET + DEL in a single pipeline (single-use). Returns the stored record or throws `UnauthorizedException`.

**Critical patterns:**

- Single-use via Redis `GETDEL` command (atomic).
- `code_verifier` is ≥43-char random URL-safe base64 string (RFC 7636).
- TTL enforced in Redis, not application code.

### Step 2.3: MicrosoftProvider [PENDING]

**File:** `backend/src/nest/auth/oauth/providers/microsoft.provider.ts`

**Why now:** Encapsulates Azure AD specifics so `oauth.service.ts` stays provider-agnostic.

**Methods:**

- `buildAuthorizationUrl(state: string, codeChallenge: string, mode: 'login' | 'signup'): string` — builds `https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?...` with scopes `openid profile email offline_access`.
- `exchangeCodeForTokens(code: string, codeVerifier: string): Promise<OAuthTokens>` — POSTs to `/organizations/oauth2/v2.0/token` with `grant_type=authorization_code`, `code`, `code_verifier`, `client_id`, `client_secret`, `redirect_uri`.
- `verifyIdToken(idToken: string): Promise<OAuthUserInfo>` — validates JWT signature against Microsoft JWKS (cached 24 h), checks `iss`, `aud`, `exp`, extracts `sub`, `email`, `email_verified`, `name`, `tid`.

**Dependencies:** Nest `HttpService`, cache service for JWKS.

**Critical patterns:**

- JWKS cache with Microsoft's `jwks_uri` (`https://login.microsoftonline.com/organizations/discovery/v2.0/keys`).
- Reject if `email_verified !== true`.
- Reject if `iss` does not start with `https://login.microsoftonline.com/`.
- Use `undici` (Node 24 native fetch) — no extra dep.
- Centralised redaction of `code`, `client_secret`, `id_token` in error-path logs.

### Step 2.4: OAuthAccountRepository [PENDING]

**File:** `backend/src/nest/auth/oauth/oauth-account.repository.ts`

**Why now:** DB access layer for `user_oauth_accounts`, isolated from HTTP concerns.

**Methods:**

- `findLinkedByProviderSub(provider, sub): Promise<LinkedAccount | null>` — uses `db.systemQuery()` (pre-auth, no tenant).
- `createLink(client: PoolClient, tenantId, userId, providerData): Promise<void>` — called inside signup transaction.
- `updateLastLogin(tenantId, userId, provider): Promise<void>` — uses `db.queryAsTenant()` (explicit tenantId).

**Critical patterns:**

- Never store access/refresh tokens from Microsoft (we do not need Graph API in V1 — add later in separate ADR if a Graph sync feature appears).
- Always include `WHERE is_active = ${IS_ACTIVE.ACTIVE}` on reads.

### Step 2.5: OAuthService (orchestration) [PENDING]

**File:** `backend/src/nest/auth/oauth/oauth.service.ts`

**Why now:** Depends on all previous services.

**Methods:**

- `startAuthorization(mode): Promise<{ url: string }>` — generates PKCE pair, state, stores in Redis, returns provider URL.
- `handleCallback(code, state): Promise<CallbackResult>` — consumes state, exchanges code, verifies id_token, then:
  - If `mode === 'login'`: look up link → if found, return `{ mode: 'login-success', userId, tenantId }`; if not, return `{ mode: 'login-not-linked', email }` (frontend shows "no linked Assixx account" message).
  - If `mode === 'signup'`: store resolved OAuth profile in Redis under a second short-lived ticket (`oauth:signup-ticket:{uuid}`, 15 min TTL) and return `{ mode: 'signup-continue', ticket }`.
- `completeSignup(ticket, companyDetails): Promise<SignupResponseData>` — consumes ticket, calls `SignupService.registerTenant()` with OAuth-sourced email + name + ADMIN role, then inserts `user_oauth_accounts` row in the SAME transaction (new `SignupService` hook needed — see Step 2.7).

### Step 2.6: OAuthController [PENDING]

**File:** `backend/src/nest/auth/oauth/oauth.controller.ts`

**Endpoints (5 total):**

| Method | Route                                 | Auth   | Description                                                             |
| ------ | ------------------------------------- | ------ | ----------------------------------------------------------------------- |
| GET    | /auth/oauth/microsoft/authorize       | Public | Redirects to Microsoft with `mode=login` or `mode=signup` query param   |
| GET    | /auth/oauth/microsoft/callback        | Public | Code exchange; issues JWT+refresh cookies on login; redirects on signup |
| POST   | /auth/oauth/microsoft/complete-signup | Public | Finalises tenant creation from a signup-ticket + company details        |
| POST   | /auth/oauth/microsoft/link            | Auth   | (V2 out-of-scope; stub returns 501 in V1)                               |
| DELETE | /auth/oauth/microsoft/link            | Auth   | (V2 out-of-scope; stub returns 501 in V1)                               |

**Every mutating endpoint MUST:**

- [ ] Use Zod DTO (`nestjs-zod`, via global `ZodValidationPipe`).
- [ ] Be rate-limited via `CustomThrottlerGuard` + `AuthThrottle` (20 req/min/IP).
- [ ] Audit-log `oauth.*` events.

### Step 2.7: SignupService hook [PENDING]

**File:** `backend/src/nest/signup/signup.service.ts` (modified)

**Why:** V1 signup creates tenant+user in one transaction. OAuth signup must insert the `user_oauth_accounts` link in the SAME transaction (atomicity — R8 mitigation).

**Change:** new method `registerTenantWithOAuth(dto, oauthInfo, ipAddress, userAgent)` that extends the existing transaction with an OAuth-link insert. Existing `registerTenant()` stays untouched — pure addition.

### Phase 2 — Definition of Done

- [ ] `OAuthModule` registered in `auth.module.ts` (or direct in `app.module.ts` — decision in implementation)
- [ ] All 4 services + 1 repository implemented
- [ ] Controller with 3 active endpoints (2 stubs returning 501)
- [ ] State service uses Redis `GETDEL` (single-use semantic verified by unit test)
- [ ] MS provider rejects `email_verified=false` / wrong `iss`
- [ ] `db.systemQuery()` for pre-auth link lookup; `db.tenantTransaction()` for post-auth updates
- [ ] `ActivityLoggerService.logCreate/logUpdate()` called (fire-and-forget with `void`) for `oauth.signup` + `oauth.login` — drives the root dashboard activity feed
- [ ] `audit_trail` entries verified (automatic via global interceptor)
- [ ] Throttler applied to callback + complete-signup
- [ ] Secret redaction in logs verified (unit test)
- [ ] ESLint 0 errors: `docker exec assixx-backend pnpm exec eslint backend/src/nest/auth/oauth/`
- [ ] Type-check passes: `docker exec assixx-backend pnpm run type-check`
- [ ] Boot-time assertion logs the resolved redirect URI
- [ ] No `||` defaults, no `any`, all catches typed `unknown`

---

## Phase 3: Unit Tests

> **Dependency:** Phase 2 complete.
> **Pattern:** `backend/src/nest/auth/auth.service.test.ts` (sibling reference).

### Test files

```
backend/src/nest/auth/oauth/
    oauth-state.service.test.ts                # ~8 tests — state lifecycle, single-use
    oauth.service.test.ts                      # ~15 tests — login/signup flows, error paths
    providers/microsoft.provider.test.ts       # ~10 tests — URL building, token exchange, id_token validation
    oauth-account.repository.test.ts           # ~6 tests — repo CRUD
```

### Mandatory scenarios

**OAuthStateService:**

- [ ] `create()` stores in Redis with correct TTL + returns UUIDv7 state
- [ ] `consume()` returns stored record on first call
- [ ] `consume()` returns null / throws on second call (single-use)
- [ ] `consume()` throws on expired / unknown state

**MicrosoftProvider:**

- [ ] `buildAuthorizationUrl()` uses `/organizations/` endpoint, includes PKCE `code_challenge`, `code_challenge_method=S256`, scopes correct
- [ ] `exchangeCodeForTokens()` sends `code_verifier` (R9 mitigation)
- [ ] `verifyIdToken()` rejects bad signature / expired `exp` / wrong `iss`
- [ ] `verifyIdToken()` rejects `email_verified=false`
- [ ] JWKS cached 24 h (second call does not re-fetch)

**OAuthService:**

- [ ] Happy login — linked account → returns userId+tenantId, updates `last_login_at`
- [ ] Login for unlinked Microsoft account → `login-not-linked` result (not 500)
- [ ] Happy signup-start → stores ticket, returns ticket id
- [ ] `completeSignup()` → tenant+user+oauth-link all in one transaction (use test transaction abort to verify rollback on failure)
- [ ] Duplicate `provider_user_id` on signup → 409 ConflictException
- [ ] Concurrent signup race (R8) → exactly one succeeds

**OAuthAccountRepository:**

- [ ] `findLinkedByProviderSub()` uses system pool (no tenant context needed)
- [ ] `updateLastLogin()` with explicit tenantId works
- [ ] RLS blocks cross-tenant reads via `app_user`

### Phase 3 — Definition of Done

- [ ] ≥ 39 unit tests total
- [ ] All tests green: `docker exec assixx-backend pnpm exec vitest run backend/src/nest/auth/oauth/`
- [ ] Every ConflictException / UnauthorizedException / BadRequestException path covered
- [ ] State single-use tested
- [ ] PKCE verifier enforcement tested
- [ ] Race condition tested (R8)
- [ ] Coverage: every public method has at least one test

---

## Phase 4: API Integration Tests

> **Dependency:** Phase 3 complete.
> **Pattern:** `backend/test/*.api.test.ts` ([HOW-TO-TEST-WITH-VITEST.md](./how-to/HOW-TO-TEST-WITH-VITEST.md)).

### Test file

`backend/test/oauth.api.test.ts`

### Scenarios (≥ 22 assertions)

**Happy paths:**

- [ ] `GET /auth/oauth/microsoft/authorize?mode=login` → 302 to Microsoft with state + PKCE challenge
- [ ] `GET /auth/oauth/microsoft/authorize?mode=signup` → 302 with mode=signup marker
- [ ] Callback with valid code (Microsoft API mocked) for login-not-linked → 200 with message
- [ ] Callback with valid code for login of linked user → sets cookies + 302 to dashboard
- [ ] Callback with valid code for signup → 200 with signup ticket
- [ ] `POST /auth/oauth/microsoft/complete-signup` with ticket + company details → 201, tenant created, link inserted

**Security rejections:**

- [ ] Callback with unknown `state` → 401
- [ ] Callback with reused `state` → 401
- [ ] Callback where id_token has `email_verified=false` → 403
- [ ] Callback where id_token `iss` is wrong → 403
- [ ] Callback for signup with `provider_user_id` already linked → 409
- [ ] `complete-signup` with expired ticket → 401
- [ ] Missing Doppler secrets at boot → service refuses to start (hard fail — checked in separate startup test or code inspection)

**Rate limiting:**

- [ ] 21st request to `/callback` within 60 s → 429

**Tenant isolation (post-login):**

- [ ] JWT issued after OAuth login has correct `tenantId` claim
- [ ] `/users/me` returns the right user after OAuth login

### Phase 4 — Definition of Done

- [ ] ≥ 22 API integration tests (Microsoft API mocked via `msw` or `undici-mock-agent`)
- [ ] All tests green
- [ ] Rate limiting verified
- [ ] Secret redaction verified end-to-end (request logs inspected)
- [ ] Stubs for `link`/`unlink` return 501 as documented

---

## Phase 5: Frontend

> **Dependency:** Phase 2 complete (endpoints exist).
> **Reference:** `frontend/src/routes/login/+page.svelte` (the card we extend), `frontend/src/routes/signup/+page.svelte`.

### Route structure (additions)

```
frontend/src/routes/
    login/+page.svelte                       # modified — add Microsoft button + divider
    signup/+page.svelte                      # modified — add Microsoft button + divider
    signup/oauth-complete/
        +page.svelte                         # NEW — company-details form for OAuth signup
        +page.server.ts                      # NEW — validates ticket, submits to backend
    (app)/(shared)/oauth-callback/
        +page.svelte                         # NEW — handles client-side redirect dispatch
        +page.server.ts                      # NEW — server-side exchange + cookie set
    _lib/components/
        MicrosoftSignInButton.svelte         # NEW — Brand-Guidelines-compliant button
        OAuthDivider.svelte                  # NEW — "oder mit E-Mail" divider
```

### Step 5.1: MicrosoftSignInButton component [PENDING]

- [ ] Follows [Microsoft Brand Guidelines for Sign-In Buttons](https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-branding-in-apps) — official square logo, label `"Mit Microsoft anmelden"` (login) / `"Mit Microsoft registrieren"` (signup)
- [ ] Height 41 px, Segoe UI font, correct background/border per guidelines (light + dark mode variants)
- [ ] `aria-label` for accessibility
- [ ] On click: `window.location.href = '/api/v2/auth/oauth/microsoft/authorize?mode=login'` — server redirects to Microsoft

### Step 5.2: Login page integration [PENDING]

**File:** `frontend/src/routes/login/+page.svelte`

- [ ] Add `MicrosoftSignInButton` ABOVE the e-mail form
- [ ] Add `OAuthDivider` between social button and e-mail form
- [ ] Keep Turnstile, enhance, etc. untouched for email/password path
- [ ] Display server-returned banner "Kein verknüpftes Assixx-Konto gefunden" if URL has `?oauth=not-linked`

### Step 5.3: Signup page integration [PENDING]

**File:** `frontend/src/routes/signup/+page.svelte`

- [ ] Add `MicrosoftSignInButton` with `mode=signup` ABOVE the manual signup form
- [ ] On Microsoft signup success (redirect from callback), route to `/signup/oauth-complete?ticket={id}`

### Step 5.4: OAuth complete-signup page [PENDING]

**File:** `frontend/src/routes/signup/oauth-complete/+page.svelte`

- [ ] Pre-fills email (read-only, from OAuth) and name (editable) from ticket load
- [ ] User fills company name, subdomain, industry, chosen addons
- [ ] Submit → `POST /api/v2/auth/oauth/microsoft/complete-signup` → on 201 redirects to dashboard with cookies set

### Step 5.5: Callback redirect page [PENDING]

**File:** `frontend/src/routes/(app)/(shared)/oauth-callback/+page.server.ts`

- [ ] Receives callback query from Microsoft, forwards to backend
- [ ] Backend sets cookies, response redirects to dashboard or `/signup/oauth-complete`

### Mandatory frontend patterns

- [ ] apiClient not used for OAuth flow (server-side redirects only — keeps cookies same-origin)
- [ ] Svelte 5 runes only (`$state`, `$derived`)
- [ ] No `$:` reactive labels (Svelte 4 legacy)
- [ ] Event handlers use `onclick=` (Svelte 5 syntax), not `on:click`
- [ ] All text German (Umlaute: ä/ö/ü/ß, not ae/oe/ue/ss)
- [ ] `svelte-check` 0 errors

### Step 5.6: CSP update [PENDING]

**File:** `frontend/src/hooks.server.ts` (or equivalent CSP source)

- [ ] Add `login.microsoftonline.com` to `connect-src` and `form-action`
- [ ] Validate CSP report endpoint still fires on violation

### Phase 5 — Definition of Done

- [ ] Login page renders + click → Microsoft OAuth round-trip → dashboard
- [ ] Signup page renders + click → Microsoft → complete-signup form → tenant created
- [ ] "Not linked" message shown when a non-linked account tries login
- [ ] Both button variants (light/dark) render per Microsoft brand guidelines
- [ ] svelte-check 0 errors, 0 warnings
- [ ] ESLint 0 errors
- [ ] CSP updated
- [ ] Responsive on mobile + desktop
- [ ] All German labels use Umlaute

---

## Phase 6: Integration + Polish + ADR

> **Dependency:** Phase 5 complete.

### Integrations

- [ ] Audit-trail entries verified for `oauth.signup`, `oauth.login`, `oauth.link-create`
- [ ] Dashboard login-count widget includes OAuth logins (if such a widget exists)
- [ ] Error-path UX review — 401/403/409 render friendly German messages, never expose Microsoft error strings verbatim
- [ ] Landing page "Sign in" CTA updated to link to new login flow

### Documentation

- [ ] **ADR-046 written**: `docs/infrastructure/adr/ADR-046-oauth-sign-in.md` — covers provider choice (Microsoft only, Organizations endpoint), state+PKCE design, integration with auth/signup, deliberate V1 limitations
- [ ] `FEATURES.md` updated — new capability listed
- [ ] `README.md` quick-start note on Azure AD app registration requirement (dev env)
- [ ] `docs/how-to/HOW-TO-AZURE-AD-SETUP.md` NEW — step-by-step Azure Portal registration (redirect URIs, API permissions, secret rotation)
- [ ] `.env.example` updated with Microsoft placeholders
- [ ] `scripts/sync-customer-migrations.sh` run

### Customer rollout notes

- [ ] Existing customers: documentation on how their admin can "retroactively link" Microsoft (V2 feature; V1 requires admin to log in with password then link via settings — since link-settings is out-of-scope V1, existing customers simply keep using password login until V2)
- [ ] New customers: can use Microsoft from day one

### Phase 6 — Definition of Done

- [ ] All integrations work end-to-end in dev profile
- [ ] Smoke test in production profile (Nginx → backend → callback)
- [ ] ADR-046 written and reviewed, status "Accepted"
- [ ] `FEATURES.md` updated
- [ ] HOW-TO-AZURE-AD-SETUP published
- [ ] No open TODOs in code (forbidden per CLAUDE-KAIZEN-MANIFEST)
- [ ] Post-mortem drafted (below)

---

## Session Tracking

| Session | Phase | Description                                                                   | Status | Date |
| ------- | ----- | ----------------------------------------------------------------------------- | ------ | ---- |
| 1       | 0     | Azure AD app registration + Doppler secrets + branch cut (USER + CLAUDE)      |        | TBD  |
| 2       | 1     | Migration — `user_oauth_accounts` + ENUM + RLS                                |        | TBD  |
| 3       | 2     | Module skeleton, types, DTOs, OAuthStateService                               |        | TBD  |
| 4       | 2     | MicrosoftProvider + OAuthAccountRepository                                    |        | TBD  |
| 5       | 2     | OAuthService + OAuthController + SignupService hook                           |        | TBD  |
| 6       | 3+4   | Unit tests + API integration tests                                            |        | TBD  |
| 7       | 5     | Frontend — button, login + signup integration, complete-signup, callback, CSP |        | TBD  |
| 8       | 6     | ADR-046, HOW-TO-AZURE-AD, FEATURES.md, polish, smoke test                     |        | TBD  |

### Session log (fill per session)

```markdown
### Session {N} — {YYYY-MM-DD}

**Goal:** {what should be achieved}
**Result:** {what was actually achieved}
**New files:** {list}
**Changed files:** {list}
**Verification:**

- ESLint: {0 errors / N errors → fixed}
- Type-check: {0 errors}
- Tests: {N / N passed}
  **Deviations:** {what differed from plan and why}
  **Next session:** {what comes next}
```

---

## Quick Reference: File Paths

### Backend (new)

| File                                                                | Purpose               |
| ------------------------------------------------------------------- | --------------------- |
| `backend/src/nest/auth/oauth/oauth.module.ts`                       | NestJS module         |
| `backend/src/nest/auth/oauth/oauth.controller.ts`                   | REST controller       |
| `backend/src/nest/auth/oauth/oauth.service.ts`                      | Orchestration         |
| `backend/src/nest/auth/oauth/oauth-state.service.ts`                | Redis state+PKCE      |
| `backend/src/nest/auth/oauth/oauth-account.repository.ts`           | DB access             |
| `backend/src/nest/auth/oauth/providers/microsoft.provider.ts`       | Azure AD v2.0 OIDC    |
| `backend/src/nest/auth/oauth/providers/oauth-provider.interface.ts` | Provider abstraction  |
| `backend/src/nest/auth/oauth/oauth.types.ts`                        | Shared types          |
| `backend/src/nest/auth/oauth/dto/*.ts`                              | Zod DTOs              |
| `backend/test/oauth.api.test.ts`                                    | API integration tests |

### Backend (modified)

| File                                        | Change                                         |
| ------------------------------------------- | ---------------------------------------------- |
| `backend/src/nest/auth/auth.module.ts`      | Import OAuthModule                             |
| `backend/src/nest/signup/signup.service.ts` | Add `registerTenantWithOAuth()` method         |
| `backend/src/nest/signup/signup.module.ts`  | Export SignupService for OAuth module consumer |

### Database (new)

| File                                                                | Purpose   |
| ------------------------------------------------------------------- | --------- |
| `database/migrations/{utc-timestamp}_create-user-oauth-accounts.ts` | Migration |

### Frontend (new)

| Path                                                        | Purpose                |
| ----------------------------------------------------------- | ---------------------- |
| `frontend/src/routes/signup/oauth-complete/+page.svelte`    | Company-details form   |
| `frontend/src/routes/signup/oauth-complete/+page.server.ts` | SSR ticket validation  |
| `frontend/src/routes/(app)/(shared)/oauth-callback/+page.*` | Callback dispatch      |
| `frontend/src/lib/components/MicrosoftSignInButton.svelte`  | Brand-compliant button |
| `frontend/src/lib/components/OAuthDivider.svelte`           | Divider                |

### Frontend (modified)

| File                                      | Change                                       |
| ----------------------------------------- | -------------------------------------------- |
| `frontend/src/routes/login/+page.svelte`  | Microsoft button + divider above email form  |
| `frontend/src/routes/signup/+page.svelte` | Microsoft button + divider above signup form |
| `frontend/src/hooks.server.ts`            | CSP: add `login.microsoftonline.com`         |

### Documentation (new / modified)

| File                                               | Change                 |
| -------------------------------------------------- | ---------------------- |
| `docs/infrastructure/adr/ADR-046-oauth-sign-in.md` | NEW                    |
| `docs/how-to/HOW-TO-AZURE-AD-SETUP.md`             | NEW                    |
| `docs/how-to/README.md`                            | Link the new HOW-TO    |
| `docs/FEATURES.md`                                 | New capability         |
| `.env.example`                                     | Microsoft placeholders |

---

## Spec Deviations

| #   | Spec says | Actual code | Decision |
| --- | --------- | ----------- | -------- |
| —   | —         | —           | —        |

---

## Known Limitations (V1 — deliberately excluded)

1. **Only Microsoft** — Google, Apple, GitHub deferred. Provider abstraction (`oauth-provider.interface.ts`) exists so V2 can add a second provider in a single PR without touching the rest.
2. **No employee OAuth** — only tenant-admin signup + login. Employees are created inside the tenant by the admin and use password auth. Matches the B2B reality of one admin per company.
3. **Only work/school accounts** (Azure `/organizations/`) — personal `@outlook.com` etc. are rejected by Microsoft. Deliberate B2B filter.
4. **No link/unlink settings page** — to simplify V1 surface. Admin either signs up with Microsoft from day one (linked) or never (password forever in V1). V2 adds link/unlink UI in admin settings.
5. **No automatic domain-verified provisioning** — admin still fills out company name + subdomain + industry + addons manually after Microsoft returns email. Auto-provisioning deferred to V3 (requires Azure tenant-verified domain claim).
6. **No access to Microsoft Graph** — we do not store Microsoft access/refresh tokens. V2+ features like Teams calendar sync would re-introduce token storage in a separate ADR.
7. **No backend-to-backend Microsoft Admin Consent flow** — admin consents for the APP not for their tenant's users. Sufficient for V1 (no Graph needed).
8. **No migration for existing admins** — existing password-based admins cannot link Microsoft in V1. Explicit note in release communication.

---

## Post-Mortem (fill after completion)

### What went well

- {TBD}

### What went badly

- {TBD}

### Metrics

| Metric                   | Planned | Actual |
| ------------------------ | ------- | ------ |
| Sessions                 | 8       | {N}    |
| Migration files          | 1       | {N}    |
| New backend files        | 12      | {N}    |
| New frontend files       | 7       | {N}    |
| Changed backend files    | 3       | {N}    |
| Changed frontend files   | 3       | {N}    |
| Unit tests               | 39      | {N}    |
| API tests                | 22      | {N}    |
| ESLint errors at release | 0       | {N}    |
| Spec deviations          | 0       | {N}    |

---

**This document is the execution plan. Every session starts here, takes the next unchecked item, and marks it done. No coding starts before Phase 0 is green (Azure app + Doppler secrets + DB backup).**
