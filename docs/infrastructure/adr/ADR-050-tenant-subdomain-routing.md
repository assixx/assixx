# ADR-050: Tenant Subdomain Routing (`<tenant>.assixx.com`)

| Metadata                | Value                                                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**              | Proposed (code-complete 2026-04-21 — infra hold until prod-VPS-test; flip to "Accepted" happens at Session 13 cutover per masterplan)                                                   |
| **Date**                | 2026-04-19                                                                                                                                                                              |
| **Decision Makers**     | Simon Öztürk (Staff-Engineer assist)                                                                                                                                                    |
| **Affected Components** | Infra (DNS, Nginx, TLS), Backend (`auth/`, new host-resolver middleware, `oauth/`), Frontend (`hooks.server.ts`, `(public)` layout group, OAuth-callback handoff)                       |
| **Supersedes**          | —                                                                                                                                                                                       |
| **Related ADRs**        | ADR-005 (Auth/JWT), ADR-006 (CLS Tenant-Context), ADR-012 (Frontend Route Security Groups), ADR-019 (RLS), ADR-044 (Security Headers), ADR-046 (OAuth Sign-In), ADR-049 (Domain Verify) |

---

## Context

### The Problem: Generic URL kills tenant identity

After ADR-049 every tenant proves DNS-ownership of its corporate domain
(`scs-technik.de`), but the application URL stays generic
(`https://www.assixx.com/login`). Multi-tenant SaaS platforms in the same
target market — Grafana Cloud (`<org>.grafana.net`), Slack
(`<workspace>.slack.com`), Linear (`<org>.linear.app`), GitHub Enterprise
Cloud, Vercel — all converged on **per-tenant subdomain under a
vendor-controlled apex**. The pattern solves four orthogonal problems at once:

1. **Identity & branding** — the URL itself signals which workspace the user is in.
2. **Cookie isolation by browser default** — `accessToken` cookie on
   `tenant-a.assixx.com` is automatically not sent to `tenant-b.assixx.com`
   (RFC 6265 §5.3 step 6). An entire class of cross-tenant cookie-leak bugs
   becomes architecturally impossible.
3. **OAuth/SSO scoping** — IdPs can restrict which tenant a user can sign
   into based on the request origin.
4. **Marketing/app split** — `www.assixx.com` (public, indexable, signup) is
   cleanly separated from the application surface (`<tenant>.assixx.com`).

### Requirements

1. Every tenant gets a stable subdomain: `<slug>.assixx.com`.
2. Routing-key is **`tenants.subdomain`** (already UNIQUE, already populated
   by signup), NOT `tenant_domains.domain` (ADR-049's customer corporate
   domain — different semantic).
3. **Bypass-proof at the auth layer:** a JWT minted for tenant A, replayed
   against `tenant-b.assixx.com`, must produce 403 — not silent success.
4. **Cookie isolation must be browser-native**, not application-coded.
5. **Marketing & signup stay on the apex.** No tenant context required.
6. **OAuth (ADR-046) keeps working** with a single registered redirect-URI
   in Azure AD.
7. **Local dev unchanged** — `localhost:5173` continues to work without
   `/etc/hosts` edits. Subdomain testing is opt-in.

### Deployment Context: Greenfield Launch (no live tenants)

As of ADR-050 acceptance, Assixx has **no production tenants in live use** —
all current usage is local dev + staging. This is the single most important
constraint shaping the cutover strategy:

- **No forced re-login event to communicate** (no live sessions exist).
- **No URL-bookmark migration** needed (no tenant has built workflows around
  `www.assixx.com/dashboard` yet).
- **No dual-cookie-scope transition** (which would defeat the cookie-isolation
  property — see §Decision "Cookies: Browser-Native Isolation" below).
- **Prod topology is a greenfield decision** in the scope of this ADR, not a
  backwards-compat problem.

This flips the risk calculus: instead of "migrate live system carefully," the
problem is "design the launch topology correctly the first time." All of §6
(Cutover) in the masterplan is therefore simpler than it would be for a live
system.

### DNS & TLS Provider Decision

- **Registrar:** IONOS (domain `assixx.com` registered there).
- **DNS authoritative:** Cloudflare (nameserver delegation from IONOS) —
  Free tier, **DNS-only mode (grey cloud)**, NOT proxied.
- **Rationale for "DNS-only, not proxied":** TLS termination stays at our
  origin Nginx, not at Cloudflare edge. Single cert chain, no origin-mode
  decision (Full-strict vs Flexible), no WebSocket-idle-timeout limits from
  CF Free tier, no dependency on CF's proxy availability. We only use
  Cloudflare for two things: authoritative DNS resolution and ACME DNS-01
  API-token challenge.
- **Upgrade path:** If we later want edge caching or DDoS mitigation, flip
  records to orange-cloud (proxied) — separate decision, not blocked by this
  ADR.

### Why NOT custom-domain hosting (`app.scs-technik.de` via CNAME)

Modus B (Customer-Custom-Domain) was considered and rejected for V1. Three
converging reasons:

1. **TLS-cert lifecycle becomes an operational sub-system** — on-demand
   certs per customer-controlled hostname require either Caddy +
   `on_demand_tls` (new reverse-proxy stack) or `cert-manager` /
   `acme-companion` containers, plus an `ask`-endpoint guarding ACME against
   rate-limit abuse, plus a re-verification daemon to cap subdomain-hijacking
   blast-radius. None of that buys customer-visible value over Modus A until
   a customer has it as a contractual blocker.
2. **OAuth-redirect explosion** — Microsoft Entra requires every callback
   URL pre-registered. Per-customer-domain means either one Entra-app per
   tenant (admin nightmare) or a centralized callback on the apex with
   post-callback redirect.
3. **80/20 economics** — Modus A delivers ~80 % of the branding value for
   ~20 % of the engineering cost. Modus B is V2+ work, gated by a concrete
   customer ask. Tracked as Followup #1.

---

## Decision

**Wildcard-Subdomain Routing (Grafana-Cloud Pattern).** Five architectural
choices:

```
DNS   *.assixx.com  A → load-balancer-IP    (one wildcard record)
TLS   wildcard cert: CN=assixx.com, SAN=assixx.com,*.assixx.com
      via Let's Encrypt DNS-01 (Cloudflare API), 90-day rotation
Proxy Nginx — two server-blocks:
        apex (assixx.com, www.assixx.com) → marketing + signup + OAuth callback
        regex ~^(?<slug>[a-z0-9-]+)\.assixx\.com$ → app surface
      catch-all `default_server { return 444; }` preserved
BE    new pre-auth middleware: Host → tenants.subdomain lookup → req.hostTenantId
      JwtAuthGuard ASSERTs jwt.tenantId === req.hostTenantId else 403
FE    SvelteKit cookies stay scoped to current host (no `domain:` option)
      OAuth callback lands on apex, hands off to subdomain via short-lived token
```

### Routing-Key: `tenants.subdomain`, NOT `tenant_domains.domain`

These two columns answer different questions, and conflating them in V1
would make the future Modus B work harder, not easier.

| Column                  | Question it answers                             | Used by  |
| ----------------------- | ----------------------------------------------- | -------- |
| `tenants.subdomain`     | "What slug routes to this tenant in our app?"   | this ADR |
| `tenant_domains.domain` | "Does this tenant own a real corporate domain?" | ADR-049  |

The slug rules already enforced at signup (UNIQUE, RFC-1035 conformant
`[a-z0-9-]+`) are exactly what Nginx's regex matches. **No DB schema change.**

### Reserved Slug List

The Nginx subdomain regex `[a-z0-9-]+` would otherwise happily match any
slug — including ones that collide with the apex (`www`), map to future
infra subdomains (`api`, `cdn`, `static`, `mail`, `status`), or confuse
observability tooling (`admin`, `app`, `docs`, `blog`, `grafana`, `health`,
`auth`, `assets`). These must be **hard-blocked at signup**, both at the
application layer (Zod enum in the signup DTO) and at the database layer
(PostgreSQL CHECK constraint on `tenants.subdomain`).

Reserved set (V1):

```
www, api, admin, app, assets, auth, cdn, docs, blog, grafana, health,
localhost, mail, static, status, support, tempo, test
```

Rationale: any slug we might plausibly want to use for our own infra in the
next 24 months. The list is conservative — it's cheaper to un-reserve later
than to reclaim a slug from a paying customer.

**Enforcement is a hard prerequisite for Phase 1 Nginx rollout.** Without it,
a future tenant could sign up as `www` and break the apex routing entirely.

### TLS: Single Wildcard Cert, Let's Encrypt DNS-01

Wildcards are mandatory because HTTP-01 cannot validate `*.assixx.com`.
DNS-01 via Cloudflare API token (Doppler-managed
`CLOUDFLARE_DNS_API_TOKEN`). Certbot sidecar handles 90-day rotation; on
renewal Nginx reloads (`nginx -s reload`, zero-downtime).

The wildcard `*.assixx.com` covers `<slug>.assixx.com` per RFC 6125 §6.4.3
(one label deep, no nested wildcards). Apex (`assixx.com`) and
`www.assixx.com` are explicit SANs.

### Backend: Pre-Auth Host Resolver + Post-Auth Cross-Check

Two small additions to existing flow:

- **Pre-Auth middleware** reads `X-Forwarded-Host`, extracts slug via a
  pure utility (`extractSlug()`), looks up `tenants WHERE subdomain = $1`
  via `systemQuery()` (ADR-019 — bypasses RLS, this is pre-auth context).
  Caches in Redis 60 s. Result attached as `req.hostTenantId: number | null`.
  Apex requests have `hostTenantId = null` (intentional — public endpoints
  must accept this).
- **Post-Auth assertion** in `JwtAuthGuard`, after JWT decode + DB user
  lookup: if `req.hostTenantId !== null && req.hostTenantId !== user.tenantId`
  throw `ForbiddenException({ code: 'CROSS_TENANT_HOST_MISMATCH' })`. This
  is the **single load-bearing line of code in the whole design** —
  without it, a JWT becomes a cross-tenant skeleton key.

CLS context (ADR-006) source remains the JWT, unchanged. Host is a
_cross-check_, not a _source_.

**Fastify `trustProxy` prerequisite:** already satisfied as of 2026-04-19 —
`backend/src/nest/main.ts:284` configures the Fastify adapter with
`trustProxy: true`. Without this, `req.hostname` / `req.hostname` would be
derived from the raw socket peer instead of `X-Forwarded-Host`, and the
middleware's Nginx-forwarded-host lookup would silently read wrong values.
No change required, but any future refactor of the Fastify adapter must
preserve this flag.

**Object-identity note — middleware writes to `.raw`, guards read via `.raw`
(D17, Session 10 runtime discovery, 2026-04-21):** NestJS class-middleware
mounted via `MiddlewareConsumer.apply().forRoutes(...)` runs under
`@fastify/middie`, which passes the **raw `IncomingMessage`** (not the
Fastify-wrapped `FastifyRequest`) as the first argument of
`use(req, res, next)`. The middleware therefore writes `hostTenantId` to
the `IncomingMessage`. Fastify later exposes that same object on the
wrapper as `FastifyRequest.raw`. Guards and controllers — which DO receive
the `FastifyRequest` wrapper — MUST read the field via
`(request as HostAwareRequest).raw.hostTenantId`. Reading bare
`request.hostTenantId` in a guard/controller silently returns `undefined`
because the field lives on `.raw`, not on the wrapper itself. The initial
implementation did exactly that, turning the cross-tenant replay defence —
"the single load-bearing line of the whole design" (§Decision above) —
into a silent no-op in production. The Phase 4 API integration tests
caught it on their first run (masterplan Changelog 0.9.0): a valid JWT
for tenant A against `firma-b.assixx.com` returned 200 instead of 403.
The fix ships: an explicit `HostAwareRequest` type
(`FastifyRequest & { raw: IncomingMessage & HostAwareRaw }`), guard and
handoff-controller reads via `.raw.hostTenantId`, and unit-test mocks that
write into `mockRequest.raw` so regressions can't silently pass.
**Regression guard:** `shared/src/architectural.test.ts` now contains a D17
AST assertion that rejects any bare `req.hostTenantId` /
`request.hostTenantId` PropertyAccess outside the middleware writer
(Session 12b, 2026-04-21). Any future refactor attempting to reinstate
the bare-access pattern fails CI.

### Production Topology Requirement: Backend Port Isolation

The entire host-cross-check security model assumes every request reaches the
backend **only through Nginx**. If the backend port (3000) or the frontend
port (3001) is publicly reachable on the prod host, an attacker can bypass
Nginx entirely and send `Host: anything` — the middleware sees it,
`extractSlug()` returns `null` (apex case), the cross-check skips, and a
valid JWT gives cross-tenant access.

**Binding requirement:** prod deployment MUST have backend and frontend
containers on an internal Docker network only, with only `nginx:443` bound
to the public host. Achieved via a `docker-compose.prod.yml` override that
removes the `ports:` publish for `backend` and `frontend` services (the
current `docker/docker-compose.yml` publishes them as `3000:3000` /
`3001:3001` for dev convenience, documented in `docs/DOCKER-SETUP.md` —
that dev-convenience must not leak into prod).

**Verification command** (part of Phase 1 DoD):

```bash
# On prod host, from the internet:
nmap -p 3000,3001 <prod-public-ip>   # → both filtered/closed
curl -I https://<prod-public-ip>:3000/health  # → connection timeout
```

This is not a "new" security measure — it is a prerequisite that existing
architecture silently relied on without the cross-check. ADR-050 makes it
an explicit, enforced invariant.

### Cookies: Browser-Native Isolation, Zero Code Change

Today every `cookies.set()` call in `frontend/src/routes/login/+page.server.ts`
and `frontend/src/routes/signup/oauth-complete/+page.server.ts` omits the
`domain` option. SvelteKit's default scopes the cookie to the request-origin
host. That means cookie isolation is browser-policy, not application-coded —
the strongest guarantee available.

**No frontend cookie code changes required.** An architectural test bans any
future `domain: '.assixx.com'` literal — that single line would defeat the
entire isolation model.

### SSR Host Propagation: Nginx + adapter-node Chain (Amendment 2026-04-27)

The R15 `CROSS_TENANT_HOST_MISMATCH` cross-check (above) is only as reliable
as the host the backend sees. In production-profile Docker the host travels
through three hops: **Browser → Nginx → SvelteKit (adapter-node) → Backend**.
Each hop must propagate the original Host or the chain collapses to the
internal docker hostname (`frontend:3001` / `backend:3000`), `extractSlug()`
returns `null`, and every authenticated handoff 403s with
`HANDOFF_HOST_MISMATCH`.

**Required wiring (all three must hold):**

| Hop                             | Configuration                                                                                                                                                         | File                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Nginx → SvelteKit / Backend     | `proxy_set_header X-Forwarded-Host $host;` on every `proxy_pass` block (SSE, `/api/`, `/uploads/`, `/chat-ws`, `/`)                                                   | `docker/nginx/nginx.conf`                                                           |
| SvelteKit adapter-node          | `PROTOCOL_HEADER=x-forwarded-proto` + `HOST_HEADER=x-forwarded-host` (kit docs §"environment-variables") — populates `event.url` per request from the proxy's headers | `docker/docker-compose.yml` frontend env, `docker/Dockerfile.frontend` ENV defaults |
| SvelteKit → Backend (SSR fetch) | `'X-Forwarded-Host': new URL(request.url).hostname` — only correct because adapter-node is configured per the previous row                                            | `frontend/src/routes/(public)/signup/oauth-complete/+page.server.ts::handleHandoff` |

**Anti-pattern (pre-2026-04-27):** static `ORIGIN=http://localhost` env on
adapter-node forced `event.url.origin` to a single host regardless of the
inbound `Host` header, silently defeating subdomain awareness in SSR. Any
adapter-node deployment behind a reverse proxy must use the header-driven
configuration; static `ORIGIN` is incompatible with multi-tenant subdomain
routing.

**Cookie security follows the same chain:** `secure` is derived from
`event.url.protocol` (which is now transport-accurate) inside
`frontend/src/lib/server/auth-cookies.ts`, never from `process.env.NODE_ENV`.
HTTP local prod-test → `secure: false` → browser keeps cookies; HTTPS prod
→ `secure: true` → browser enforces transport guarantee. RFC 6265bis §4.1.2.5
("user agent MUST ignore Set-Cookie if Secure is set on a non-secure
connection") otherwise silently drops every Set-Cookie on local prod-test.

### CORS: Origin-Allowlist via subdomain regex

Today's backend has no explicit CORS block (Fastify default = same-origin
only). Multi-subdomain future requires explicit Fastify CORS plugin with an
origin-callback that allows: apex (`assixx.com`, `www.assixx.com`), any
subdomain (`<slug>.assixx.com`), `localhost:5173|5174` for Vite dev / E2E,
and bare `http://localhost` (no port = port 80) for production-profile
local testing per [PRODUCTION-AND-DEVELOPMENT-TESTING.md](../../PRODUCTION-AND-DEVELOPMENT-TESTING.md).
Static regex, not DB-driven — the regex shape IS the contract. The bare
`localhost` branch is required because SvelteKit SSR forwards the browser's
`Origin: http://localhost` header on its server-to-server fetch to the
backend; without it every auth POST 500s with `CORS origin not allowed:
http://localhost` in production-profile local mode.

### OAuth (ADR-046): Centralized Callback, Post-Callback Handoff

> **Amendment 2026-04-22 (Session 12c — OAuth login-success redirect bugfix):**
> The `login-success` branch of the callback does NOT use `returnToSlug` any
> more. It resolves the user's tenant subdomain from the DB via
> `authService.getSubdomainForTenant(tenantId)` — the user's own slug is the
> single source of truth, NOT the Startseiten-slug the user happened to
> authenticate from. Rationale: OAuth users typically don't know their own
> tenant slug; a Microsoft sign-in from `testfirma.localhost` for an account
> belonging to `scs-technik` must land on `scs-technik.localhost`, not on
> `testfirma.localhost` (where R15 `CROSS_TENANT_HOST_MISMATCH` would 403
> every subsequent authenticated request). This mirrors Slack/Linear/Grafana
> patterns and aligns the OAuth flow 1:1 with the password-login flow's
> `buildHandoffRedirect()` (Session 12c, `(public)/login/+page.server.ts`).
>
> `returnToSlug` in the OAuth-State payload is preserved — it still governs
> redirect targets for `login-not-linked`, `signup-continue`, and
> `provider-error` variants, where Startseiten-context is the correct UX
> anchor (error pages / new-tenant signup). Only `login-success` is
> DB-authoritative.
>
> `buildSubdomainUrl(slug, path)` was also extracted to its own file
> (`build-subdomain-url.ts`, 10 unit tests) and now derives apex+scheme+port
> from `PUBLIC_APP_URL` — the same env var that drives the Azure
> `redirect_uri`. Prior hardcoded `https://${slug}.assixx.com` silently
> broke every dev subdomain handoff. Matches the frontend twin
> `buildSubdomainHandoffUrl()` in the password-login flow.

> **Correction 2026-04-20 (masterplan Session 1, D6 audit):** this section
> was rewritten after an audit of the actual OAuth implementation showed
> that `state` is not a cookie but a Redis-stored UUIDv7 token. The original
> ADR text assumed a cookie-HMAC design that never existed in the codebase.
> The functional behaviour described below is unchanged in shape —
> `return_to_slug` still gates subdomain redirection for
> `login-not-linked` / `signup-continue` / `provider-error` branches (see
> 2026-04-22 Amendment above for the `login-success` DB-authoritative path).
> No new cryptographic secret (`OAUTH_STATE_SECRET`) is required; the
> existing Redis-backed state payload is extended with one additional field.

`PUBLIC_APP_URL` stays `https://www.assixx.com` in production. The Microsoft
Entra registered redirect-URI continues to be a single value:
`https://www.assixx.com/api/v2/auth/oauth/microsoft/callback`. No
re-registration, no per-tenant Entra app sprawl.

When a user clicks "Sign in with Microsoft" on `tenant-a.assixx.com/login`,
Nginx 307-redirects the INITIATE call to the apex. The subdomain frontend
passes `?return_to_slug=tenant-a` on the `/initiate` URL — the slug travels
with the 307. The apex backend stores `return_to_slug` as a new field on
the existing Redis-backed `OAuthState` payload (ADR-046 §4 Redis keyspace —
`oauth:state:{uuidv7}`, TTL 600 s, GETDEL atomic single-use). The state
UUID travels in the URL query through the Microsoft round-trip; the
payload itself never leaves our Redis.

On callback, `OAuthStateService.consume(state)` performs the atomic GETDEL
and returns the server-stored payload including `returnToSlug`. Because
the slug read at this step comes from Redis — not from the attacker-
reachable URL — it cannot have been tampered with post-storage. Write-time
tampering (attacker manipulates `?return_to_slug=` on `/initiate`) is
neutralised structurally by the handoff endpoint's host cross-check below;
see R12 and R15.

If `returnToSlug` is undefined (user started on the apex), the callback
behaves as pre-ADR-050: apex session, 302 to `/login` per ADR-046
Amendment Bug A.

If `returnToSlug` is set, the backend mints a 60-second single-use
`oauth_handoff_token` (32-byte random, opaque to the client, `oauth:handoff:`
Redis key namespace mirroring the existing `oauth:state:` / `oauth:signup-
ticket:` pattern — see ADR-046 §4), redirects to
`https://${returnToSlug}.assixx.com/signup/oauth-complete?token=…`. The
subdomain page swaps the handoff-token for the real auth cookies (now
scoped to the subdomain) via a new endpoint `POST /api/v2/auth/oauth/handoff`.

The handoff-token is the only new piece of crypto surface: 32-byte random,
single-use, server-side TTL, Redis-backed. No HMAC, no signature — the
unguessability (128-bit entropy) plus atomic GETDEL-on-consume gives the
same security properties as a signed token at a fraction of the complexity.
Pattern mirrors cross-domain SSO flows used by every major B2B SaaS.

**Handoff Cross-Check (Defense-in-Depth):** the handoff endpoint
(`POST /api/v2/auth/oauth/handoff`) is unauthenticated by design (no JWT
yet — that's what it's minting), so `JwtAuthGuard`'s cross-check does not
protect it. The endpoint itself MUST assert
`req.hostTenantId === decodedHandoffPayload.tenantId` BEFORE the Redis
GETDEL. Order matters: failing the check without consuming lets an attacker
target a valid token via the wrong subdomain without burning it (i.e.,
does not create a DoS primitive against OAuth-in-flight users). Without
this assertion, a tampered redirect (attacker rewrites `Location:` from
`firma-a.assixx.com` to `firma-b.assixx.com`) would cause the subdomain
page to set firma-a cookies on firma-b's origin — immediately self-healing
at the next authenticated request (403 `CROSS_TENANT_HOST_MISMATCH`), but
surfacing a confusing UX. The endpoint-level assertion closes the loop and
produces a clean, actionable error code (`HANDOFF_HOST_MISMATCH`) instead.

### Local Dev: Subdomain Routing First-Class (Session 12c-fix, 2026-04-21)

`extractSlug()` returns `null` for plain `localhost`, IP literals, and apex
hosts. For **`<slug>.localhost`** (single-label dev subdomain) it returns
the slug — same semantics as `<slug>.assixx.com` in prod. This is
**Session 12c-fix**: the initial implementation rejected all `.localhost`
subdomains (`endsWith('.localhost') → null`), which silently defeated this
ADR's own "opt-in dev subdomain testing" workflow: R14/R15 host-cross-check
never fired in dev because `hostTenantId` stayed null. Apex-login →
subdomain-handoff was untestable locally. The bug was caught during
Session 12c integration testing (login on `localhost` → handoff to
`testfirma.localhost` → 403 `HANDOFF_HOST_MISMATCH`).

Corrected behaviour:

| Host                | `extractSlug()` | Notes                                                        |
| ------------------- | --------------- | ------------------------------------------------------------ |
| `localhost`         | `null`          | plain = apex-equivalent, API-tests unaffected                |
| `localhost:5173`    | `null`          | port stripped before check                                   |
| `firma-a.localhost` | `'firma-a'`     | dev subdomain — DB lookup → `hostTenantId` → full R14/R15    |
| `foo.bar.localhost` | `null`          | nested not allowed (mirrors prod `a.b.assixx.com` rejection) |
| `127.0.0.1`         | `null`          | IPv4 literals — internal docker calls                        |
| `<slug>.assixx.com` | `'<slug>'`      | prod subdomain                                               |

Devs who want to test subdomain routing add to `/etc/hosts`:

```
127.0.0.1 firma-a.localhost firma-b.localhost testfirma.localhost
```

…and use `http://firma-a.localhost:5173/login`. Vite's `allowedHosts:
['.localhost']` (set in `vite.config.ts` Session 12c) accepts all
`*.localhost` origins; the backend's `DEV_ORIGIN_REGEX` in `main.ts`
mirrors the CORS shape. **Dev/prod parity is now real**: the same R14
(backend port exposure), R15 (handoff host-mismatch), and
`CROSS_TENANT_HOST_MISMATCH` cross-check invariants fire identically on
`*.localhost` and `*.assixx.com`. Security footguns surface during dev
instead of at staging rollout.

**Per-dev opt-in preserved:** existing API tests (47 files) hit
`http://localhost:3000` (plain `localhost`) without `X-Forwarded-Host` →
`extractSlug('localhost') = null` → `hostTenantId = null` → cross-check
skips. Zero test migration needed, test-infra stays hermetic.

**Runbook:** [HOW-TO-LOCAL-SUBDOMAINS](../../how-to/HOW-TO-LOCAL-SUBDOMAINS.md)
— step-by-step for adding a new local subdomain, including the
Session 12c-fix-era pitfalls (email-domain vs routing-slug confusion,
cross-origin cookies).

### Amendment 2026-04-22 — Logout Redirect: Always to Apex

Every logout path — normal user-initiated logout, OAuth logout,
session-expired auto-redirect, and the R15 `CROSS_TENANT_HOST_MISMATCH`
403-catcher — MUST land on the apex `/login` page, NOT the current tenant
subdomain's `/login`. The apex origin is derived from `PUBLIC_APP_URL` —
the same single source of truth that drives `buildSubdomainUrl()` (OAuth
handoff target) and the Microsoft OAuth `redirect_uri` (Azure
registration).

**Rationale.** The subdomain post-logout is semantically misleading: the
tenant cookies are gone (cleared by `POST /auth/logout`), but the URL
still signals a tenant context that no longer exists. Staying on
`<slug>.assixx.com` after logout:

1. **Breaks mental model** (Nielsen #1 Visibility of System Status): URL
   says "you are in tenant X", state says "you are nobody" — incoherent.
2. **Blocks tenant switching on shared devices**: User A cannot log User
   B into a different tenant without manually editing the URL.
3. **Wastes the marketing split** defined above (§Decision): apex is the
   public/marketing/signup surface; returning there after logout is the
   natural re-entry point for both direct login and new-tenant signup.

Mirrors the Slack/Linear-style "return to the workspace selector"
convention. Industry split was 50/50 during the 2026-04-22 survey (Slack,
Atlassian, Twitter use apex+query-param; Linear, Notion, GitHub use
apex-no-param) — the query-param variant was chosen for user feedback
visibility.

**Query-Param Namespace Split** (active action vs passive event):

| Query                | Kind                 | Trigger                        | Toast tone |
| -------------------- | -------------------- | ------------------------------ | ---------- |
| _(no param)_         | neutral entry        | direct link / first visit      | —          |
| `?logout=success`    | active user action   | user clicked Logout            | success    |
| `?session=expired`   | passive system event | JWT/refresh token TTL expired  | warning    |
| `?session=forbidden` | passive system event | CROSS_TENANT_HOST_MISMATCH 403 | error      |

Two distinct namespaces (`logout=` for actions, `session=` for passive
system events) because conflating them loses the semantic that the login
page uses to pick the toast tone. Both are discriminable reasons
(`success`/`expired`/`forbidden` are closed-set enums), not free-form
messages — i18n and CI-regex-guardable.

**Cross-Origin Mechanics.** Cookie-based flash messages (the SvelteKit
default) fail across the subdomain → apex redirect: cookies on
`<slug>.assixx.com` are not visible to `www.assixx.com`. Query-param is
the only channel that survives a cross-origin `Location:` redirect
cleanly. The login page reads the query in `checkForMessages()`, fires
the matching toast, and calls `history.replaceState()` to drop the param
(so reload / URL-share doesn't re-trigger the banner).

**Implementation.** `frontend/src/lib/utils/build-apex-url.ts`:

- `buildApexUrl(path, publicAppUrl?)` — 4-layer resolution priority:
  (1) explicit `publicAppUrl` override (tests), (2) `env.PUBLIC_APP_URL`
  from `$env/dynamic/public` (deployment contract), (3) browser-fallback
  via `window.location` subdomain-strip (self-heals when Doppler env is
  missing in local dev), (4) hardcoded `https://www.assixx.com` (SSR last
  resort). Mirrors `buildSubdomainUrl()` structure and parity.
- `buildLoginUrl(reason?, publicAppUrl?)` — `<apex>/login?<map[reason]>`.
  `reason` is a closed-set `LoginRedirectReason` enum. No caller
  constructs the query string directly — the `REASON_TO_QUERY` map is
  the only legal place.

**Browser-fallback rationale (added 2026-04-22 after smoke-test bug).**
Initial implementation hardcoded `DEFAULT_PUBLIC_APP_URL = 'https://www.assixx.com'`
as the only env-absent fallback. Manual smoke-test immediately revealed
the bug: `pnpm run dev:svelte` (without Doppler) leaves
`env.PUBLIC_APP_URL` undefined in the SvelteKit Vite dev server, so a
logout on `http://testfirma.localhost:5173` redirected to the prod
`https://www.assixx.com/login?logout=success` — wrong origin, wrong
scheme. The fix derives apex from the current `window.location`
hostname by stripping the subdomain label via the existing
`extractSlug()` helper (ADR-050 §Decision). Prod convention
(bare-`assixx.com` → `www.assixx.com`) is preserved by an explicit
normalisation step. Dev ergonomics restored without changing the
workflow (no mandatory `doppler run --` prefix).

**Cross-origin navigation MUST use `window.location.href = ...`.**
SvelteKit's `goto()` is client-router-bound and cannot leave the current
origin — a silent no-op that would land the user on the subdomain
`/login` (which is a valid page but wrong per this amendment). The three
call-sites are:

- `frontend/src/routes/(app)/_lib/layout-helpers.ts` → `performLogout()` — after E2E lock + localStorage clear, `window.location.href = buildLoginUrl('logout-success')`. The `navigate` dep was dropped from `LogoutDeps`: the destination is fixed by this amendment, not a caller choice.
- `frontend/src/lib/utils/session-expired.ts` → `handleSessionExpired()` — `window.location.href = buildLoginUrl('session-expired')`. Previously `goto(resolve('/login?session=expired'))` which stayed on the subdomain.
- `frontend/src/lib/utils/api-client.ts` → `handleForbidden()` — new branch: if 403 `data.error.code === 'CROSS_TENANT_HOST_MISMATCH'`, hard-navigate to `buildLoginUrl('session-forbidden')`. Precedence over ADDON_DISABLED + PERMISSION_DENIED branches: the discriminable error code is authoritative, message text is not.

**No backend redirect changes** because `POST /auth/logout` returns
200-JSON (not a 30x) — the frontend owns the post-logout navigation.
OAuth logout reuses the normal logout endpoint; no separate path exists.

**Regression guards.** Architectural tests in `shared/src/architectural.test.ts`
(describe block "Frontend: Apex-Login Redirect Centralization (ADR-050 Amendment)")
reject any hardcoded `/login?logout=success`, `/login?session=expired`,
or `/login?session=forbidden` literal outside `build-apex-url.ts` and
its test file. Any future route that copy-pastes a login redirect URL
fails CI. The pre-existing
`Frontend: Session-Expired Centralization` block's function-definition
checks (no local `isSessionExpiredError` / `handleSessionExpired` /
`handleUnauthorized` re-implementations) remain; the
`goto("/login?session=expired")` literal-check was removed (superseded
by the broader amendment check).

**Files touched** (total surface):

```
frontend/src/lib/utils/build-apex-url.ts          (new)
frontend/src/lib/utils/build-apex-url.test.ts     (new)
frontend/src/lib/utils/session-expired.ts         (goto → window.location.href)
frontend/src/lib/utils/api-client.ts              (handleForbidden gains CROSS_TENANT branch)
frontend/src/routes/(app)/+layout.svelte          (drop `navigate` arg from performLogout)
frontend/src/routes/(app)/_lib/layout-helpers.ts  (performLogout owns hard-nav)
frontend/src/routes/(public)/login/+page.svelte   (checkForMessages handles new reasons)
shared/src/architectural.test.ts                  (new describe block)
```

**What this amendment does NOT change:**

- Backend endpoints, middleware, or guards — all unchanged.
- `POST /auth/logout` contract — still 200-JSON, cookie-clear server-side.
- OAuth login-success handoff flow (the pre-existing 2026-04-22 Amendment
  above, which this amendment sits next to).
- Cookie isolation model — still browser-native, still no `domain:` option
  on `cookies.set`. R1 architectural guard unchanged.

**Followup deferred:** Remember-last-tenant-slug on the apex login page
(localStorage-backed "Recent workspaces" like Slack). Out of scope — the
current amendment is pure redirect + toast. A second PR can layer on the
UX helper once this ships.

---

## Alternatives Considered

### Alt 1: Modus B — Customer Custom Domain (CNAME)

`app.scs-technik.de` resolved via customer-controlled DNS. Rejected for V1
(see "Why NOT custom-domain hosting" above). Re-evaluation trigger: a
contractual customer ask. Tracked as Followup #1.

### Alt 2: Path-prefix Routing (`assixx.com/t/<slug>/...`)

`assixx.com/t/scs-technik/dashboard`. Rejected:

- Loses the cookie-isolation property (every tenant shares the same
  origin → cookies are not browser-isolated).
- Cross-tenant XSS in tenant A could read tenant B's cookies (same-origin
  policy doesn't help).
- No marketing benefit — URL is uglier, not prettier.
- All four wins from §Context disappear.

### Alt 3: Header-based tenant ID (`X-Tenant-ID: 42`)

API-only, no URL change. Rejected: doesn't solve the customer-facing branding
problem, and JWT already carries `tenantId` — nothing to gain.

### Alt 4: Reuse `tenant_domains.domain` as routing-key

Conflate ADR-049's verified-corporate-domain with the routing slug. Rejected
because the two concerns have different trust boundaries, lifecycles, and
failure modes. Conflating them in V1 makes the future Modus B work harder
(Modus B will _be_ the time `tenant_domains.domain` becomes the routing-key —
this ADR's slug then becomes the "fallback default tenant URL").

---

## Consequences

### Positive

- **URL signals identity.** `scs-technik.assixx.com/dashboard` is unambiguous.
  Recognition > recall (Nielsen heuristic #6).
- **Cookie-isolation is browser-native.** Cross-tenant cookie leak becomes a
  browser-bug class to attack, not an application-bug class.
- **Cross-tenant token replay is hard-blocked** with a discriminable error
  code (`CROSS_TENANT_HOST_MISMATCH`) — easy to alert on in Loki.
- **No DB schema change.** Migration risk surface is nginx-config + new
  middleware, both reversible in seconds.
- **Marketing/app split clean.** `www.assixx.com` becomes purely public;
  tenant subdomains are purely application surface. SEO improves.
- **Modus B path stays open.** No premature lock-in.
- **OAuth costs are bounded.** One Entra app, one registered redirect-URI,
  one apex callback. Per-subdomain handoff is a 60-second token swap.

### Negative

- **One new TLS cert lifecycle to operate.** Wildcard cert via Let's Encrypt
  DNS-01 means certbot in a sidecar, Cloudflare API token in Doppler, and a
  reload on rotation. Mature, automated, but new infra surface.
- **Local dev gets one optional new affordance** — `/etc/hosts` edit for
  subdomain testing. Documented, opt-in.
- **OAuth flow gains a handoff-token swap** — adds ~50 ms to a flow that
  already runs in seconds.
- **Backend hot-path adds one Redis GET per request** (60-s TTL keeps DB
  hits at most ~1/min/subdomain). Negligible vs. JWT-decode cost.

### Neutral

- **`tenants.subdomain` becomes a load-bearing public identifier.** Treated
  as immutable from launch. Already implicitly true (UNIQUE column, primary
  signup-form input).
- **Catch-all `default_server { return 444; }`** from today's `nginx.conf`
  §35–39 is preserved unchanged. Unknown Hosts continue to be TCP-RST'd.

---

## Architectural Risks

> Operational risks (cert renewal failure, DNS propagation lag, etc.) are
> tracked in the masterplan's R-table. Only architecture-level risks here.

| Risk                                                                                                                                                                          | Mitigation                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Forgotten `cookies.set({ domain: '.assixx.com' })` re-introduces cross-tenant cookie leak                                                                                     | Architectural test (`shared/src/architectural.test.ts`) regex-bans `domain:` literal in any `cookies.set` call. Mirrors ADR-049 §2.11 architectural test pattern.                                                                                                                                           |
| Forgotten host-cross-check in a future custom auth flow lets JWT bypass subdomain                                                                                             | Architectural test asserts every controller decorated with `@UseGuards(JwtAuthGuard)` is reachable only through the middleware-mounted path.                                                                                                                                                                |
| Subdomain typo (`scs-tehcnik.assixx.com`) returns 444 (no body), confuses user                                                                                                | Catch-all returns a small SvelteKit 404 page for browser User-Agents (UA sniff in Nginx). Preserves 444 for non-browsers (scanners, curl).                                                                                                                                                                  |
| Internal services (cron, deletion-worker) call backend with no Host                                                                                                           | `extractSlug()` returns `null` for missing/non-matching Host. Internal callers continue using `systemQuery()` (BYPASSRLS) — no tenant context needed.                                                                                                                                                       |
| ~~Microsoft OAuth `state` cookie set on apex doesn't reach the subdomain~~ **DELETED 2026-04-20 (D6 audit)**                                                                  | N/A — OAuth `state` is NOT a cookie; it is a Redis-stored UUIDv7 (ADR-046 §4). Cross-origin concern does not apply. `return_to_slug` lives in the Redis payload alongside `codeVerifier`, consumed atomically on callback via GETDEL.                                                                       |
| **R14**: Backend `:3000` / frontend `:3001` reachable from public internet bypasses the Nginx-enforced host-cross-check, turning a valid JWT into a cross-tenant skeleton key | `docker-compose.prod.yml` override that drops `ports:` publish for `backend` + `frontend` services. Only `nginx:443` is host-bound. Phase 1 DoD includes `nmap -p 3000,3001 <prod-ip>` → filtered.                                                                                                          |
| **R15**: Tampered OAuth redirect lands handoff-token on wrong subdomain — subdomain page sets cookies of tenant A on tenant B's origin                                        | Handoff endpoint asserts `req.hostTenantId === decodedPayload.tenantId` before returning cookies. Throws `HANDOFF_HOST_MISMATCH`. Next request's `JwtAuthGuard` would also catch it, but the endpoint-level check produces a clean error code and avoids the confusing "cookies set then instantly 403" UX. |

---

## Why a Single Wildcard, Not Per-Subdomain Certs

1. **Operational:** one cert, one renewal, one alert. Per-subdomain certs
   would mean N renewals, N alerts, N failure modes — each tenant becomes a
   potential outage source.
2. **Rate-limit:** Let's Encrypt's per-domain rate limit is 50 certs/week. A
   sudden signup burst could exhaust the budget in hours and lock new
   tenants out of TLS for a week. Wildcards are immune.

The downside (single cert compromise affects all subdomains) is mitigated by
short-lived certs (90-day rotation) and HSTS preload.

---

## Followups (V2+ work, not in scope)

1. **Modus B — Customer Custom Domain (`app.scs-technik.de` via CNAME).**
   Triggered by a contractual customer ask. Will reuse
   `tenant_domains.domain` as the routing-key.
2. **Vanity-subdomain rename UI.** Customer-self-service rename with
   old-URL 301 redirect for 90 days.
3. **Tenant subdomain sunset on tenant deletion.** 12-month tombstone
   cool-down to prevent accidental traffic to a different tenant's data.
4. **Per-subdomain `robots.txt`** returning `Disallow: /` so tenant
   subdomains don't get indexed (privacy + accidental-data-exposure
   prevention).

---

## References

- ADR-005 — Authentication Strategy (JWT, host-check piggybacks on existing guard)
- ADR-006 — Multi-Tenant CLS Context (CLS source remains JWT; host is cross-check)
- ADR-012 — Frontend Route Security Groups (`(public)` group for apex+subdomain dual-mount)
- ADR-019 — Multi-Tenant RLS (unchanged)
- ADR-027 — Dockerfile Hardening (Stage-1 image pinning MANDATORY for new certbot sidecar + `docker-compose.prod.yml`; CI pin-guard enforces this)
- ADR-044 — SEO and Security Headers (header set replicated into both new server-blocks)
- ADR-046 — OAuth Sign-In (centralized callback + handoff-token swap)
- ADR-049 — Tenant Domain Verification (sibling concern; routing is separate)
- Grafana Cloud subdomain pattern — public reference at scale
- RFC 6125 §6.4.3 — Wildcard certificate semantics
- RFC 6265 §5.3 step 6 — Cookie storage scoping by origin
- RFC 6761 — Special-Use Domain Names (`localhost` and subdomains)
- Nginx wildcard `server_name` regex: <https://nginx.org/en/docs/http/server_names.html#regex_names>
- Let's Encrypt DNS-01 for wildcards: <https://letsencrypt.org/docs/challenge-types/#dns-01-challenge>
- Execution masterplan: `docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md`

---

## Amendment 2026-04-22 — Escrow Unlock Handoff (ADR-022 Reconciliation)

### Context

The cross-origin redirect from apex (`www.assixx.com`) to subdomain
(`<slug>.assixx.com`) kills module-scoped JS memory, which broke
[ADR-022](./ADR-022-e2e-key-escrow.md)'s `login-password-bridge.ts`.
With no password available on the subdomain, `e2e.initialize()` could
not decrypt the escrow blob and fell through to
`generateAndRegisterKey()`, colliding 409 with the pre-existing server
key. The legacy auto-rotation fallback silently rewrote the server key
on each collision — destroying ECDH shared secrets for every past
counterparty, one-way, with no user consent. DB inspection surfaced
users with up to 13 key versions accumulated in four days.

### Decision

Parallel to the OAuth handoff defined in §Decision "OAuth (ADR-046):
Centralized Callback, Post-Callback Handoff", a second single-use Redis
ticket now transports the escrow `wrappingKey` from apex to subdomain.
Full design in
[ADR-022 §Amendment 2026-04-22](./ADR-022-e2e-key-escrow.md#amendment-2026-04-22--cross-origin-unlock-handoff--restorative-rotation);
the integration points with this ADR are:

- **Redis keyspace:** `escrow:unlock:{uuidv7}`, TTL 60 s, `GETDEL`
  atomic. Different prefix from `oauth:state:` / `oauth:handoff:` so
  dev `FLUSHDB` isolates concerns.
- **URL shape:** the apex handoff URL grows an optional `&unlock=<id>`
  query param. `signup/oauth-complete/+page.server.ts` preserves it
  verbatim through the 303 to the role dashboard; the `(app)` layout
  strips it via `history.replaceState()` before `initialize()` runs,
  so it does not leak into history, bookmarks, or the Referer header.
- **Client-side derivation on apex:** the `use:enhance` callback
  derives the wrappingKey via the Web Worker Argon2id path
  (`cryptoBridge.deriveWrappingKey`). The password never crosses the
  origin boundary; the server sees only the derived 32-byte key.
- **Coexistence with OAuth:** OAuth users (no password) skip the ticket
  entirely — apex just omits the `unlock` query param. The subdomain's
  `bootstrapFromUnlockTicket` is a no-op when no param is present.

### Host-cross-check parity

The `consume-unlock` endpoint is authenticated (cookie-bearer after
handoff), so `JwtAuthGuard`'s existing tenant-host cross-check
(§Decision "Backend: Pre-Auth Host Resolver + Post-Auth Cross-Check")
already fires: a ticket minted on apex for tenant A, replayed from
`tenant-b.assixx.com`, gets rejected by the guard before reaching the
service. No endpoint-level re-check is required here (unlike the
unauthenticated OAuth handoff endpoint, which does need its own R15
assertion).

### Restorative rotation (single permitted rotation site)

ADR-022 §Amendment also reintroduces a narrowly-gated
`rotateKeyOnServer` call: after the subdomain unwraps escrow, if the
server's active key disagrees with the escrow-canonical key, the
server is rotated to match. This is authorised by the password proof
implicit in successful escrow decryption and is documented as the
**only** permitted rotation call site. The general automatic rotation
on IndexedDB mismatch remains forbidden per
[ADR-021 §Amendment 2026-04-22](./ADR-021-e2e-encryption.md#amendment-2026-04-22--no-auto-rotation--plaintext-fallback-block).

### Consequences

- Cross-origin login end-to-end for users with an existing escrow: no
  data loss, no admin intervention, no 3-second Argon2id delay on the
  subdomain (derivation happens once on apex).
- ZK guarantee: the derived wrappingKey lives in Redis for up to 60 s.
  Threat-model comparison is in ADR-022's Consequences section —
  summary: equivalent to the server having the password at bcrypt
  time, not a regression against rest-state DB dumps.
- OAuth users remain exposed to the "no-escrow → device-change →
  admin reset" limitation (documented in ADR-021 Consequences →
  Negative #1). A future amendment could add a password step post-OAuth
  to create an escrow; deferred.

### Files Changed

See [ADR-022 §Amendment 2026-04-22 — Files Changed](./ADR-022-e2e-key-escrow.md#files-changed).
