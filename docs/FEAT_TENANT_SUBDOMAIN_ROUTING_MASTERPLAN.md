# FEAT: Tenant Subdomain Routing — Execution Masterplan

> **Plan type:** FEATURE
> **Created:** 2026-04-19
> **Version:** 0.1.0 (Draft)
> **Status:** DRAFT — Phase 0 (planning)
> **Branch:** `feat/tenant-subdomain-routing` (to be created from `main` after `test/ui-ux` merges)
> **Spec:** [ADR-050 Tenant Subdomain Routing](./infrastructure/adr/ADR-050-tenant-subdomain-routing.md)
> **Author:** Simon Öztürk (Staff-Engineer assist)
> **Estimated sessions:** 12
> **Actual sessions:** 0 / 12

---

## Changelog

| Version | Date       | Change                                                                         |
| ------- | ---------- | ------------------------------------------------------------------------------ |
| 0.1.0   | 2026-04-19 | Initial draft — phases outlined, R-table seeded, D-table seeded                |
| 0.2.0   | TBD        | Pre-execution audit complete (D1–Dn resolved, R-table verified)                |
| 1.0.0   | TBD        | Phase 1 (Infra) COMPLETE — wildcard DNS + cert + Nginx live in staging         |
| 1.1.0   | TBD        | Phase 2 (Backend) COMPLETE — middleware + cross-check + CORS + handoff merged  |
| 1.2.0   | TBD        | Phase 3 (Unit) COMPLETE — ≥25 unit tests + 3 architectural tests green         |
| 1.3.0   | TBD        | Phase 4 (API) COMPLETE — ≥15 integration tests green                           |
| 1.4.0   | TBD        | Phase 5 (Frontend) COMPLETE — hooks + branding + OAuth handoff in place        |
| 2.0.0   | TBD        | Phase 6 (Cutover) COMPLETE — production live, ADR-050 backfilled to "Accepted" |

> **Versioning rule (per HOW-TO-PLAN-SAMPLE):** `0.x.0` = planning, `1.x.0` =
> implementation in progress (minor bump per phase), `2.0.0` = fully complete.

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must be true before starting

- [ ] Docker stack running (all containers healthy — verify via
      `docker-compose ps` from `docker/`)
- [ ] Branch `feat/tenant-subdomain-routing` checked out (after `test/ui-ux`
      merges to `main`)
- [ ] No pending migrations blocking
- [ ] Dependent features shipped: ADR-049 (tenant-domain verification — DONE
      per smoke-test in this conversation)
- [ ] ADR-050 reviewed and status flipped to "Accepted" by user
- [ ] Doppler access verified for new secret `CLOUDFLARE_DNS_API_TOKEN`
- [ ] Cloudflare account access verified (DNS zone `assixx.com` reachable)
- [ ] Production deployment context confirmed: who owns `assixx.com` zone,
      what's the load-balancer IP, is there an existing Nginx in prod or only the
      docker `assixx-nginx` from `docker-compose --profile production`
- [ ] DB backup taken (although no schema change, infra cutover impacts
      prod-paying customers): `database/backups/pre-subdomain-routing.dump`

### 0.2 Risk register

| #   | Risk                                                                                                          | Impact   | Probability | Mitigation                                                                                                                                                                                                   | Verification                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Forgotten `cookies.set({ domain: '.assixx.com' })` re-introduces cross-tenant cookie leak                     | High     | Medium      | Architectural test (`shared/src/architectural.test.ts`) regex-bans `domain:` literal in any `cookies.set` call. CI fails on regression.                                                                      | Sanity-check: intentionally introduce `domain: '.assixx.com'` in a fixture file → CI red. Then revert.                                                                           |
| R2  | Forgotten host-cross-check in a future custom auth flow lets JWT bypass subdomain                             | High     | Low         | Architectural test asserts every controller decorated with `@UseGuards(JwtAuthGuard)` is reachable only via the middleware-mounted route (`HostResolverMiddleware` consumer chain).                          | Architectural test enumerates `@UseGuards(JwtAuthGuard)` AST nodes, asserts each lives under a module that imports `TenantHostResolverMiddleware`.                               |
| R3  | Wildcard cert renewal silent-fail → 100 % outage in 90 days                                                   | Critical | Medium      | Prometheus exporter for cert-expiry-days. Grafana alert at < 14 d (paste into `docker/grafana/alerts/_*.json` provisioning set per ADR-002 Phase 5g).                                                        | Manually advance cert clock in staging (or create a 7-day cert) → alert fires within 5 min.                                                                                      |
| R4  | Subdomain typo (`scs-tehcnik.assixx.com`) → 444 confuses user                                                 | Low      | High        | Catch-all `default_server` returns SvelteKit 404 page for browser User-Agents (UA-sniff regex), 444 for non-browsers (scanners, curl).                                                                       | curl with browser UA → 404 HTML, curl without UA → connection-reset.                                                                                                             |
| R5  | Internal services (cron, deletion-worker) call backend with no Host                                           | Medium   | Medium      | `extractSlug()` returns `null` for missing/non-matching Host. Internal callers continue using `systemQuery()` (BYPASSRLS, no tenant context required).                                                       | Unit test for `extractSlug(undefined)` → null. Integration test: deletion-worker's HTTP call to backend → 200 (no `CROSS_TENANT_HOST_MISMATCH` because `hostTenantId === null`). |
| R6  | Microsoft OAuth `state` cookie set on apex doesn't reach the subdomain                                        | High     | High        | `state` cookie deliberately stays apex-scoped. The signed handoff-token mechanism is what crosses the origin boundary — `state` only validates the apex-side CSRF round-trip.                                | Tier 4 OAuth E2E: full flow on subdomain → Microsoft mock → apex callback → handoff swap → subdomain dashboard. Cookies inspected at every hop.                                  |
| R7  | Cloudflare API token compromise → wildcard DNS hijack                                                         | Critical | Low         | Token scoped to `assixx.com` zone only, `Zone:DNS:Edit` permission only (no `Zone:Zone:Edit`). Stored in Doppler with strict access-control. Rotated monthly via runbook (HOW-TO-CLOUDFLARE-TOKEN-ROTATION). | Doppler audit log review monthly. Token scope verified at boot-time check (certbot pre-hook fails if token has any extra permission).                                            |
| R8  | Existing test fixtures don't have `tenants.subdomain` populated                                               | Medium   | Medium      | Phase 0 grep scan: `SELECT id, subdomain FROM tenants WHERE subdomain IS NULL OR subdomain = '';` — must return zero rows. If non-zero, add backfill to Phase 1.                                             | Pre-Phase-1 query against staging DB. Must be 0 rows.                                                                                                                            |
| R9  | Local dev breaks during transition (HMR, OAuth flow, etc.)                                                    | Medium   | Medium      | `extractSlug('localhost')` returns `null` → skip cross-check entirely on `localhost:5173`. OAuth dev-mode uses apex-only flow (no handoff). Documented in README.                                            | Dev smoke: `pnpm run dev:svelte`, login as `admin@apitest.de`, navigate to `/manage-admins`, all green.                                                                          |
| R10 | SvelteKit `hooks.server.ts` change breaks existing routing                                                    | High     | Low         | Additive change only — current `hooks.server.ts` remains the base, new logic appends `event.locals.hostSlug` without modifying existing flow.                                                                | Existing E2E suite (smoke.spec.ts) green after Phase 5.                                                                                                                          |
| R11 | Nginx regex `server_name ~^(?<slug>[a-z0-9-]+)\.assixx\.com$` matches deeper subdomains (`a.b.assixx.com`)    | Medium   | Low         | Anchored regex with character class `[a-z0-9-]+` (no dots). `nginx -t` config-test verifies, plus negative-test in Tier 2: `curl -H 'Host: a.b.assixx.com' …` → 444 (catch-all).                             | `nginx -t` passes. `curl --resolve a.b.assixx.com:443:127.0.0.1 https://a.b.assixx.com/` → connection-reset.                                                                     |
| R12 | OAuth `return_to_slug` parameter tampering → redirect to attacker subdomain                                   | High     | Medium      | `return_to_slug` is part of the signed `state` cookie (HMAC over `nonce                                                                                                                                      |                                                                                                                                                                                  | return_to_slug`). Backend verifies signature before redirect, rejects mismatched slug. | Unit test: tampered `return_to_slug` → `BadRequestException('OAUTH_STATE_TAMPERED')`. Integration test: full flow with manually-tampered query param → 400. |
| R13 | Redis cache poisoning: attacker sets `tenant:slug:firma-a → 999` → all firma-a traffic resolves to tenant 999 | Critical | Low         | Redis is internal-only (no exposed port, network-isolated to backend). Only `TenantHostResolverMiddleware` writes the cache. Cache key TTL 60 s — bounded blast radius even on compromise.                   | `docker exec assixx-redis redis-cli CONFIG GET bind` → only `127.0.0.1` and internal docker network. Verified via Trivy scan + Redis ACL audit.                                  |

> **Rule (per HOW-TO-PLAN-SAMPLE §0.2):** every risk has concrete mitigation
> AND verification. "Be careful" is NOT a mitigation. "Should be fine" is NOT
> a verification.

### 0.3 Ecosystem integration points

| Existing system                                             | Integration                                                                              | Phase | Verified on |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----- | ----------- |
| `docker/nginx/nginx.conf`                                   | Two new server-blocks (apex + regex-subdomain) replace single `server_name localhost`    | 1     |             |
| `docker-compose.yml` (production profile)                   | New `certbot` sidecar service + shared volume for cert files                             | 1     |             |
| Doppler                                                     | New secret `CLOUDFLARE_DNS_API_TOKEN`                                                    | 1     |             |
| `backend/src/nest/auth/jwt-auth.guard.ts`                   | New post-decode assertion for `req.hostTenantId === user.tenantId`                       | 2     |             |
| `backend/src/nest/app.module.ts`                            | New `TenantHostResolverMiddleware` mounted globally before guards                        | 2     |             |
| `backend/src/nest/auth/oauth/`                              | New endpoint `POST /api/v2/auth/oauth/handoff` + state-cookie HMAC over `return_to_slug` | 2     |             |
| `backend/src/nest/main.ts`                                  | New Fastify CORS plugin registration with origin-allowlist callback                      | 2     |             |
| `frontend/src/hooks.server.ts`                              | Read `X-Forwarded-Host`, expose `event.locals.hostSlug`                                  | 5     |             |
| `frontend/src/routes/(public)/`                             | NEW route group (login, signup, forgot-password — work on apex AND subdomain)            | 5     |             |
| `frontend/src/routes/signup/oauth-complete/+page.server.ts` | Replace direct cookie-set with handoff-token swap call                                   | 5     |             |
| `docker/grafana/alerts/_*.json`                             | New alert: `cert-expiry-days < 14`                                                       | 6     |             |
| Loki labels (per ADR-048 OTel)                              | Add `host` label dimension to log scrape config                                          | 6     |             |
| `shared/src/architectural.test.ts`                          | Two new architectural assertions (R1, R2 mitigations)                                    | 2     |             |

> **Why this table?** Forces identification of every touchpoint BEFORE coding.
> Per HOW-TO-PLAN-SAMPLE §0.3.

### 0.4 / 0.5 — N/A (FEATURE plan, not OPTIMIZATION)

This is a FEATURE plan (new user-visible URL topology + new backend layer).
There is no quantitative hypothesis to prove. Per HOW-TO-PLAN-SAMPLE §"Detect
First": FEATURE plans skip §0.4 (Baseline) and §0.5 (Hypothesis), and skip
Phase H entirely.

---

## Phase H — N/A (FEATURE plan)

Skipped per the rule above.

---

## Phase 1: Infra (DNS + TLS + Nginx)

> **Spec deviation D1:** the HOW-TO-PLAN-SAMPLE template names Phase 1 "Database
> Migrations". This plan repurposes Phase 1 as "Infra" because there is no DB
> schema change — the routing-key column `tenants.subdomain` already exists
> (UNIQUE since signup-V1). Infra IS the foundation of this feature in the same
> way migrations are the foundation of a typical FEATURE plan. Documented in
> §Spec Deviations below.
>
> **Dependency:** Phase 0 complete (R-table sanity-checked, D-table audited).

### Step 1.1: Cloudflare wildcard DNS record [PENDING]

**What happens:**

1. Log into Cloudflare → assixx.com zone → DNS records.
2. Add record: `*` `A` `<load-balancer-IP>` Proxied=YES (orange cloud).
3. Verify propagation: `dig +short firma-test.assixx.com @1.1.1.1`.

**Why proxied:** Cloudflare's proxy gives DDoS protection + edge caching for
free; doesn't interfere with our origin TLS because Cloudflare terminates
edge-TLS and re-establishes origin-TLS to our Nginx using the same wildcard
cert.

**Verification:**

```bash
# From any external host:
dig +short '*.assixx.com' @1.1.1.1   # should resolve to Cloudflare IPs
dig +short firma-test.assixx.com @1.1.1.1  # should resolve to Cloudflare IPs (proxied)
curl -I https://firma-test.assixx.com/  # should connect (404 expected before Nginx config)
```

### Step 1.2: Doppler secret `CLOUDFLARE_DNS_API_TOKEN` [PENDING]

**What happens:**

1. Cloudflare → My Profile → API Tokens → Create Token.
2. Custom Token. Permissions: `Zone:DNS:Edit` only. Resources: `Zone:assixx.com` only.
3. Doppler: `doppler secrets set CLOUDFLARE_DNS_API_TOKEN=<token>` in `prd` config.

**Verification:**

```bash
doppler secrets get CLOUDFLARE_DNS_API_TOKEN --plain --config prd | head -c 20
# Should print first 20 chars of the token (no error, no empty)
```

### Step 1.3: certbot sidecar in `docker-compose.yml` [PENDING]

**New file:** `docker/Dockerfile.certbot` (or use upstream `certbot/dns-cloudflare`
image directly).

**Modified file:** `docker/docker-compose.yml` — add service:

```yaml
certbot:
  profiles: [production]
  image: certbot/dns-cloudflare:latest
  volumes:
    - certs:/etc/letsencrypt
    - ./certbot/cloudflare.ini:/cloudflare.ini:ro
  command: renew --quiet --post-hook "nginx -s reload"
  restart: unless-stopped
  depends_on: [nginx]

volumes:
  certs:
```

`./certbot/cloudflare.ini` (NOT in git, generated at deploy-time from Doppler):

```ini
dns_cloudflare_api_token = ${CLOUDFLARE_DNS_API_TOKEN}
```

**Verification:** `doppler run -- docker-compose --profile production config |
yq .services.certbot` shows the service with the env-substituted token.

### Step 1.4: Initial wildcard cert provision [PENDING]

**One-time bootstrap command:**

```bash
doppler run -- docker-compose --profile production run --rm certbot \
  certonly --dns-cloudflare \
  --dns-cloudflare-credentials /cloudflare.ini \
  --dns-cloudflare-propagation-seconds 60 \
  -d 'assixx.com,*.assixx.com' \
  --agree-tos --email ops@assixx.com \
  --non-interactive
```

**Verification:**

```bash
docker run --rm -v <docker-compose-cert-volume>:/etc/letsencrypt certbot/certbot \
  certificates
# Output should list: assixx.com (issuer Let's Encrypt, expiry > 80 days, SAN includes *.assixx.com)
```

### Step 1.5: Nginx config split [PENDING]

**Modified file:** `docker/nginx/nginx.conf` — replace single `server { server_name
localhost; … }` with three blocks.

Reference structure from current `nginx.conf` (already has `default_server { return 444; }` — preserve verbatim):

```nginx
# Catch-all (existing, preserved per current §35-39)
server { listen 443 ssl http2 default_server; server_name _; return 444; }

# Apex — marketing + signup + OAuth callback
server {
  listen 443 ssl http2;
  server_name assixx.com www.assixx.com;
  ssl_certificate     /etc/letsencrypt/live/assixx.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/assixx.com/privkey.pem;

  # … all existing security headers from current nginx.conf §52-62 (HSTS, X-Frame, etc.)
  # … all existing gzip + client_max_body_size rules
  # … all existing /api/v2/notifications/stream (SSE) location

  location /api/v2/auth/oauth/ { proxy_pass http://backend; … }
  location /api/                 { proxy_pass http://backend; … }
  location /uploads/             { proxy_pass http://backend; … }
  location = /health             { proxy_pass http://backend; … }
  location /chat-ws              { proxy_pass http://backend; …; proxy_set_header Upgrade $allowed_upgrade; }
  location /                     { proxy_pass http://frontend; … }   # marketing pages
}

# App surface — per-tenant subdomain
server {
  listen 443 ssl http2;
  server_name ~^(?<slug>[a-z0-9-]+)\.assixx\.com$;
  ssl_certificate     /etc/letsencrypt/live/assixx.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/assixx.com/privkey.pem;

  # … same security headers, same gzip, same client_max_body_size

  proxy_set_header X-Tenant-Slug    $slug;
  proxy_set_header X-Forwarded-Host $host;

  # OAuth INITIATE on subdomain → bounce to apex (single registered redirect_uri)
  location /api/v2/auth/oauth/ { return 307 https://www.assixx.com$request_uri; }

  # SSE, API, uploads, chat-ws, frontend — all proxy_pass as today
  location /api/v2/notifications/stream { … }   # SSE settings as current §80-105
  location /api/   { proxy_pass http://backend; … }
  location /uploads/ { proxy_pass http://backend; … }
  location = /health { proxy_pass http://backend; … }
  location /chat-ws  { proxy_pass http://backend; … }
  location /         { proxy_pass http://frontend; … }
}

# HTTP→HTTPS redirect (entire :80 block) — uncomment lines per current nginx.conf §47-48 comment
server {
  listen 80;
  server_name assixx.com www.assixx.com *.assixx.com;
  return 301 https://$host$request_uri;
}
```

**Verification:**

```bash
docker exec assixx-nginx nginx -t   # config syntax OK
docker exec assixx-nginx nginx -s reload
curl -kI https://www.assixx.com/health | head -1     # → HTTP/2 200
curl -kI https://firma-test.assixx.com/health | head -1  # → HTTP/2 200 (resolves through wildcard)
curl -kI -H 'Host: a.b.assixx.com' https://www.assixx.com/   # → connection reset (444 catch-all)
```

### Phase 1 — Definition of Done

- [ ] Cloudflare wildcard DNS record live, propagated globally (verify from at
      least 3 geographic regions via dnsmap or 1.1.1.1 / 8.8.8.8 / 9.9.9.9)
- [ ] Doppler secret `CLOUDFLARE_DNS_API_TOKEN` set in prd config, verified
      scope = `Zone:DNS:Edit` on `assixx.com` only
- [ ] Certbot sidecar service in `docker-compose.yml`, dry-run `--dry-run`
      succeeds
- [ ] Wildcard cert issued, expiry > 80 days, SAN includes `*.assixx.com`
- [ ] Nginx config has three server-blocks (apex, regex-subdomain, catch-all
      444); `nginx -t` passes
- [ ] `curl https://www.assixx.com/health` → 200
- [ ] `curl https://firma-test.assixx.com/health` → 200 (verifies wildcard
      routing works end-to-end before backend changes)
- [ ] `curl -H 'Host: a.b.assixx.com' …` → 444 (verifies catch-all anchors)
- [ ] HTTP→HTTPS redirect verified with `curl -I http://www.assixx.com` → 301
- [ ] Cert auto-renewal cron tested in staging by manually setting cert clock
      forward (or using a 7-day staging cert)

---

## Phase 2: Backend

> **Dependency:** Phase 1 complete.
> **Reference module:** `backend/src/nest/auth/` (existing JwtAuthGuard pattern)

### Step 2.1: `extractSlug()` pure utility [PENDING]

**New file:** `backend/src/nest/common/utils/extract-slug.ts`

**Function signature:**

```typescript
/**
 * Extract a tenant subdomain slug from a Host header value.
 *
 * Returns null for: undefined, empty, IP literals, localhost (and *.localhost),
 * the apex (assixx.com / www.assixx.com), and any host that doesn't match the
 * exact pattern `<slug>.assixx.com` where slug is RFC-1035-conformant.
 *
 * Returning null is the signal that "no host-based tenant context applies" —
 * downstream guards then skip the host-cross-check.
 *
 * @see ADR-050 §Decision §"Local Dev: Unchanged + Optional Subdomain-Routing"
 */
export function extractSlug(host: string | undefined): string | null;
```

**Reasoning:** centralizing the parser in a single pure function is the
testability win. The architectural test asserts no other file does
slug-parsing.

### Step 2.2: `TenantHostResolverMiddleware` [PENDING]

**New file:** `backend/src/nest/common/middleware/tenant-host-resolver.middleware.ts`

**Wired in:** `app.module.ts` via `MiddlewareConsumer.apply(...).forRoutes('*')`.

**Behavior:**

1. Read `X-Forwarded-Host` (Nginx-set, trusted) — fallback to
   `req.hostname` for cases where the request bypasses the proxy (internal
   docker-network calls).
2. `extractSlug(host)` — if null, set `req.hostTenantId = null` and `next()`.
3. Else: Redis GET `tenant:slug:${slug}`. If hit, set `req.hostTenantId =
Number(cached)` and `next()`.
4. Cache miss: `db.systemQuery('SELECT id FROM tenants WHERE subdomain = $1
AND is_active = 1', [slug])`. If row found, Redis SETEX 60 s, set
   `req.hostTenantId`. If no row, set `req.hostTenantId = null` (the
   404-page logic later catches typos).
5. `next()`.

**Critical patterns:**

- Use `systemQuery()` (BYPASSRLS, ADR-019) — this is pre-auth context, no
  CLS yet.
- Errors swallowed → set `req.hostTenantId = null` + emit warn-log. Subdomain
  routing should not be a hard dependency for general availability.

### Step 2.3: `JwtAuthGuard` cross-check assertion [PENDING]

**Modified file:** `backend/src/nest/auth/jwt-auth.guard.ts`

**Change:** at the end of existing `canActivate` (after JWT decode + DB user
lookup + `is_active = 1` check), before returning true:

```typescript
const hostTenantId = (req as { hostTenantId?: number | null }).hostTenantId;
if (hostTenantId !== undefined && hostTenantId !== null && hostTenantId !== user.tenantId) {
  throw new ForbiddenException({
    code: 'CROSS_TENANT_HOST_MISMATCH',
    message: 'Token tenant does not match request host.',
  });
}
```

**Why three-state check:** `undefined` = middleware didn't run (test fixture);
`null` = apex/localhost (skip check); `number` = subdomain resolved → must
match.

### Step 2.4: Fastify CORS plugin registration [PENDING]

**Modified file:** `backend/src/nest/main.ts`

**Change:** add `app.register('@fastify/cors', { origin: <callback>,
credentials: true })` inside `setupGlobalMiddleware`.

**Origin allowlist regex:**

- `https://assixx.com` ✅
- `https://www.assixx.com` ✅
- `https://<slug>.assixx.com` (where slug matches `[a-z0-9-]+`) ✅
- `http://localhost:5173` ✅
- `http://*.localhost:5173` ✅ (for local subdomain dev — opt-in)
- everything else → `Error('CORS origin not allowed')`

### Step 2.5: OAuth handoff endpoint + state-cookie HMAC [PENDING]

**New endpoint:** `POST /api/v2/auth/oauth/handoff`

**Request body:** `{ token: string }` (the handoff-token from query param).

**Behavior:** Redis GETDEL `oauth:handoff:${token}` → if found, returns
`{ accessToken, refreshToken, user }` and caller (the subdomain
oauth-complete page) sets cookies on its own host. If miss, 404 (consumed or
expired).

**Modified file:** `backend/src/nest/auth/oauth/microsoft.provider.ts` (or
wherever `state` is currently composed). Wrap `state` in HMAC-signed payload
including `return_to_slug`:

```typescript
state = base64url(JSON.stringify({ nonce, return_to_slug })) + '.' + hmacSha256(payload, OAUTH_STATE_SECRET);
```

On callback, verify HMAC before reading `return_to_slug`. Tampered → 400
`OAUTH_STATE_TAMPERED`.

**Modified file:** `backend/src/nest/auth/oauth/oauth.controller.ts` — after
successful Microsoft callback, mint handoff-token (32-byte hex), Redis SETEX
60 s, redirect to `https://${return_to_slug}.assixx.com/signup/oauth-complete?token=…`.

### Step 2.6: Architectural tests [PENDING]

**Modified file:** `shared/src/architectural.test.ts`

**Add three assertions:**

1. **R1 mitigation:** AST visitor over all `.ts/.svelte` files; for any
   `cookies.set(...)` call, walk options object literal — fail if any
   property `key === 'domain'` exists with a string-literal value.
2. **R2 mitigation:** AST visitor over all controllers. For each class
   decorated with `@UseGuards(JwtAuthGuard)`, resolve enclosing module,
   assert module imports and applies `TenantHostResolverMiddleware` (via
   reaching back to `app.module.ts`'s middleware-consumer chain).
3. **slug-parsing single-source:** grep for `\.assixx\.com|<slug>` regex
   patterns outside `backend/src/nest/common/utils/extract-slug.ts` →
   fail if found in any file other than the canonical `extractSlug`
   utility, the architectural test itself, and ADR/masterplan docs.

### Phase 2 — Definition of Done

- [ ] `TenantHostResolverMiddleware` mounted globally in `app.module.ts`
- [ ] `extractSlug()` utility exported from
      `backend/src/nest/common/utils/extract-slug.ts`
- [ ] `JwtAuthGuard` has the cross-check assertion as the **last** check
      before returning true
- [ ] New error code `CROSS_TENANT_HOST_MISMATCH` added to error-codes
      registry
- [ ] Fastify CORS plugin registered with origin-callback (regex allowlist)
- [ ] `POST /api/v2/auth/oauth/handoff` endpoint implemented + Zod DTO
- [ ] `state` cookie now HMAC-signs `return_to_slug` alongside `nonce`
- [ ] OAuth callback mints handoff-token, redirects to subdomain
- [ ] All 3 new architectural tests passing
- [ ] ESLint 0 errors:
      `docker exec assixx-backend pnpm exec eslint backend/src/nest/common/middleware/ backend/src/nest/auth/`
- [ ] Type-check passes:
      `docker exec assixx-backend pnpm run type-check`

---

## Phase 3: Unit Tests

> **Dependency:** Phase 2 complete.
> **Pattern:** `backend/src/nest/{module}/{file}.test.ts` per HOW-TO-TEST-WITH-VITEST.md

### Test files

```
backend/src/nest/common/utils/extract-slug.test.ts                  # 8 cases
backend/src/nest/common/middleware/tenant-host-resolver.middleware.test.ts  # 5 cases
backend/src/nest/auth/jwt-auth.guard.test.ts                        # +3 cases (cross-check branches)
backend/src/nest/auth/oauth/oauth-handoff.service.test.ts           # 4 cases
shared/src/architectural.test.ts                                    # +3 assertions
```

### `extract-slug.test.ts` — 8 cases

1. `extractSlug(undefined)` → null
2. `extractSlug('')` → null
3. `extractSlug('localhost')` → null
4. `extractSlug('localhost:5173')` → null
5. `extractSlug('127.0.0.1')` → null
6. `extractSlug('assixx.com')` → null (apex)
7. `extractSlug('www.assixx.com')` → null (apex with www)
8. `extractSlug('firma-a.assixx.com')` → 'firma-a' (subdomain)
9. `extractSlug('a.b.assixx.com')` → null (nested — anchored regex rejects)
10. `extractSlug('FIRMA-A.assixx.com')` → 'firma-a' (case-normalized) OR
    null (depends on policy decision; favor: case-normalized accept,
    document)

### `tenant-host-resolver.middleware.test.ts` — 5 cases

1. Cache hit → uses cached value, no DB query (mock Redis returns "42",
   assert `db.systemQuery` never called)
2. Cache miss + DB hit → DB queried, Redis SETEX called with TTL=60
3. Cache miss + DB miss → `req.hostTenantId = null`, no error thrown
4. Malformed Host (e.g., `';drop table--'`) → `extractSlug` returns null →
   middleware no-op
5. Internal call (no Host header) → `req.hostTenantId = null`, `next()` called

### `jwt-auth.guard.test.ts` — +3 cases (cross-check branches)

1. `req.hostTenantId === undefined` → no exception (middleware bypass case)
2. `req.hostTenantId === null` → no exception (apex case)
3. `req.hostTenantId === 999`, `user.tenantId === 42` → ForbiddenException
   with code `CROSS_TENANT_HOST_MISMATCH`

### `oauth-handoff.service.test.ts` — 4 cases

1. Mint handoff-token → Redis SETEX called with 60 s TTL
2. Swap valid token → returns auth payload, Redis GETDEL called (single-use)
3. Swap consumed token → 404
4. Swap expired token → 404

### Architectural tests — 3 new assertions

1. R1 mitigation: introduce `cookies.set('foo', 'bar', { domain: '.assixx.com' })`
   in a fixture file → test fails. Revert. (Sanity-check pattern from
   ADR-049 §2.11.)
2. R2 mitigation: introduce a controller with `@UseGuards(JwtAuthGuard)` in
   a module that doesn't apply the middleware → test fails. Revert.
3. slug-parsing single-source: introduce `host.endsWith('.assixx.com')` in
   a non-allowlisted file → test fails. Revert.

### Phase 3 — Definition of Done

- [ ] ≥ 25 unit tests total (8 + 5 + 3 + 4 + 5 architectural ≈ 25)
- [ ] All tests green:
      `pnpm exec vitest run --project unit backend/src/nest/common/ backend/src/nest/auth/`
- [ ] All 3 architectural tests pass + sanity-check intentional-regression
      pass (intentional fail → fix → re-pass)
- [ ] Coverage: every public method of new code has at least one test

---

## Phase 4: API Integration Tests

> **Dependency:** Phase 3 complete.
> **Pattern:** `backend/test/*.api.test.ts` (HOW-TO-TEST-WITH-VITEST.md)

### Test file

`backend/test/tenant-subdomain-routing.api.test.ts`

### Scenarios (≥ 15 assertions)

**Cross-tenant JWT replay:**

- [ ] Login as `firma-a` admin (gets JWT) → call `/api/v2/users` with
      `X-Forwarded-Host: firma-a.assixx.com` → 200 (control)
- [ ] Same JWT → call `/api/v2/users` with `X-Forwarded-Host:
firma-b.assixx.com` → 403 with code `CROSS_TENANT_HOST_MISMATCH`
- [ ] Same JWT → no `X-Forwarded-Host` → 200 (apex/internal context, no
      cross-check)

**Apex behavior:**

- [ ] `GET /api/v2/auth/oauth/microsoft/initiate` with apex host → 302 to
      Microsoft (control)
- [ ] `POST /api/v2/auth/login` with apex host → 200 (no `hostTenantId`
      required)
- [ ] `GET /api/v2/users` (protected) without JWT, apex host → 401

**Subdomain not found:**

- [ ] `X-Forwarded-Host: nonexistent-tenant.assixx.com` → middleware sets
      `hostTenantId = null` → protected endpoints behave as apex (i.e., 401 if
      no JWT, 403 if JWT present and middleware doesn't find a tenant). This
      edge-case is intentional: we don't want to leak "is this a real subdomain"
      via timing.

**OAuth handoff:**

- [ ] Full E2E (with Microsoft mocked at the HTTP layer): subdomain INITIATE
      → 307 to apex → apex INITIATE → state cookie set with HMAC over
      `return_to_slug` → Microsoft callback → handoff-token minted → redirect
      to subdomain — 302 with `Location: https://firma-a.assixx.com/...`
- [ ] `POST /api/v2/auth/oauth/handoff` with valid token → 200 with auth
      payload, token consumed
- [ ] `POST /api/v2/auth/oauth/handoff` with consumed token → 404
- [ ] State cookie tampering (manually edit HMAC) → 400 with code
      `OAUTH_STATE_TAMPERED`

**CORS preflight:**

- [ ] `OPTIONS /api/v2/users` from `Origin: https://firma-a.assixx.com` →
      200 with `Access-Control-Allow-Origin` echoing the request origin
- [ ] `OPTIONS /api/v2/users` from `Origin: https://evil.com` → no CORS
      headers (browser will block)

### Phase 4 — Definition of Done

- [ ] ≥ 15 API integration tests
- [ ] All tests green:
      `pnpm exec vitest run --project api backend/test/tenant-subdomain-routing.api.test.ts`
- [ ] Cross-tenant JWT replay verified 403
- [ ] OAuth handoff happy-path + tamper-path verified
- [ ] CORS allowlist verified positive + negative

---

## Phase 5: Frontend

> **Dependency:** Phase 2 complete (backend endpoints available).
> **Reference:** `frontend/src/hooks.server.ts` (existing) +
> `frontend/src/routes/(app)/+layout.server.ts` (existing pattern)

### Step 5.1: `hooks.server.ts` host extraction [PENDING]

**Modified file:** `frontend/src/hooks.server.ts`

**Change:** in the existing `handle` hook, before `resolve(event)`:

```typescript
const forwardedHost = event.request.headers.get('x-forwarded-host') ?? event.url.hostname;
const slug = extractSlug(forwardedHost); // shared with backend? or duplicate?
event.locals.hostSlug = slug;
```

**Decision needed (D5 below):** is `extractSlug` shared between BE+FE via
`shared/src/utils/extract-slug.ts` or duplicated? Answer guides Step 2.1's
file location.

### Step 5.2: `(public)` route group introduction [PENDING]

**New directory:** `frontend/src/routes/(public)/`

**Move:** `/login`, `/signup`, `/forgot-password` from current locations into
`(public)`. The `(public)` layout has no auth-required logic, no addon-required
logic — works equally on apex and subdomain.

**Why:** ADR-012's `(app)` layout group requires auth. Apex login page must
work without auth (chicken-and-egg). The `(public)` group is the new home for
"public surface that works on apex AND subdomain".

### Step 5.3: Branding switch [PENDING]

**New file:** `frontend/src/lib/utils/branding.ts`

```typescript
/**
 * Resolve the page brand from the host context.
 *
 * Apex (`hostSlug === null`):  "Sign in to Assixx"
 * Subdomain:                   "Sign in to <Tenant Name>" — tenant name fetched
 *                              from the tenants table by the (public) layout
 *                              load function.
 */
export function resolveBrand(hostSlug: string | null, tenantName: string | null): { title: string; subtitle: string };
```

**Modified file:** `frontend/src/routes/(public)/+layout.server.ts`

If `event.locals.hostSlug !== null`, fetch tenant name (display name, logo
URL) via a new tiny public endpoint `GET /api/v2/tenants/branding/:slug`
(no auth required, only returns public branding fields — name, logo, primary
color). Cached in Redis 5 min.

### Step 5.4: OAuth handoff consumer [PENDING]

**Modified file:** `frontend/src/routes/signup/oauth-complete/+page.server.ts`

**Change:** instead of consuming `accessToken` + `refreshToken` from query
params (current behavior), consume `token` query param, swap via
`POST /api/v2/auth/oauth/handoff`, then `cookies.set(...)` the returned auth
payload. Cookies are now naturally scoped to the subdomain.

### Phase 5 — Definition of Done

- [ ] `hooks.server.ts` reads `X-Forwarded-Host`, exposes `event.locals.hostSlug`
- [ ] `(public)` route group exists with `/login`, `/signup`, `/forgot-password`
- [ ] `(public)/+layout.server.ts` resolves branding via subdomain → tenant lookup
- [ ] OAuth `oauth-complete` page swaps handoff-token, sets cookies on subdomain
- [ ] svelte-check 0 errors, 0 warnings
- [ ] ESLint 0 errors: `cd frontend && pnpm run lint`
- [ ] Existing `(app)/...` routes work unchanged on subdomain
- [ ] Local dev unchanged: `localhost:5173/login` still works
- [ ] Subdomain dev opt-in: `firma-a.localhost:5173/login` shows "Sign in to
      firma-a" branding

---

## Phase 6: Integration + Cutover + ADR Backfill

> **Dependency:** Phase 5 complete, all tests green.

### Integrations

- [ ] Cert-expiry Grafana alert: paste-in to
      `docker/grafana/alerts/_*.json` provisioning set per ADR-002 Phase 5g.
      Alert at `cert-expiry-days < 14`, severity = critical.
- [ ] Loki host-label dimension: update `docker/loki/promtail.yml` (or
      equivalent) to extract `host` from log lines and attach as Loki label.
- [ ] Email/notification URL templates: every outbound URL generation
      (welcome email, password reset, notification SSE) must use the recipient's
      tenant subdomain. New helper:
      `getTenantBaseUrl(tenantId): Promise<string>` → resolves to
      `https://${subdomain}.assixx.com`.
- [ ] WebSocket URL: chat client must use `wss://${current-host}/chat-ws`
      (already does — reads `window.location.host`, verify in code review).
- [ ] Customer-facing email: one-time announcement
      ("Your new URL is `<slug>.assixx.com`") to all existing tenant root
      users. Template + send-script. Manual trigger.
- [ ] 90-day transitional redirect: `www.assixx.com/dashboard` (or any
      protected app route) for an authenticated user → 301 to
      `https://${user.tenant.subdomain}.assixx.com${same-path}`.

### ADR-050 backfill (RETROSPECTIVE)

Per ADR-049 pattern: once Phase 1-5 ships, ADR-050 gets two new sections
appended (matching ADR-049's §Implementation Notes and §Test Coverage):

- **§Implementation Notes** — actual file paths, actual config, actual
  middleware names, actual env-vars
- **§Test Coverage** — tier-by-tier actual numbers
- **Status flip:** `Proposed` → `Accepted`

### Cutover

- [ ] Wildcard DNS active in production
- [ ] Wildcard cert installed
- [ ] Nginx config deployed
- [ ] Backend deployed with middleware + cross-check
- [ ] Frontend deployed with hooks + branding + handoff
- [ ] Smoke test: log in as `scs-technik` admin via `scs-technik.assixx.com`,
      navigate `/manage-admins`, navigate `/dashboard`, log out, log in via
      Microsoft OAuth (full handoff round-trip)
- [ ] Smoke test: cross-tenant JWT replay manually verified 403
- [ ] Smoke test: 90-day transitional redirect verified

### Documentation

- [ ] ADR-050 status flipped to "Accepted" with backfill sections
- [ ] `FEATURES.md` updated (mention subdomain routing as a platform
      capability)
- [ ] `README.md` dev-setup section updated (`/etc/hosts` opt-in for
      subdomain testing)
- [ ] HOW-TO guide: `docs/how-to/HOW-TO-CLOUDFLARE-TOKEN-ROTATION.md` (new) —
      monthly rotation runbook for the DNS API token

### Phase 6 — Definition of Done

- [ ] All integrations work end-to-end
- [ ] ADR-050 backfilled + status = Accepted
- [ ] `FEATURES.md` updated
- [ ] `README.md` dev-setup updated
- [ ] HOW-TO-CLOUDFLARE-TOKEN-ROTATION.md committed
- [ ] Cert-expiry alert provisioned + verified firing on staging
- [ ] No open TODOs in code (implement now, not later)
- [ ] Customer announcement email sent (or scheduled)
- [ ] Plan-2-style smoke test documented in §Post-Mortem below

---

## Session Tracking

> **Rule (per HOW-TO-PLAN-SAMPLE):** one session = one logical work block,
> 1–3 hours focused.

| Session | Phase | Description                                               | Status | Date |
| ------- | ----- | --------------------------------------------------------- | ------ | ---- |
| 1       | 0     | Pre-execution audit: D-table walk-through, R-table sanity |        |      |
| 2       | 1     | Cloudflare DNS wildcard + Doppler API token               |        |      |
| 3       | 1     | Certbot sidecar + initial wildcard cert                   |        |      |
| 4       | 1     | Nginx config split + smoke test (no backend changes yet)  |        |      |
| 5       | 2     | extractSlug() + middleware + JwtAuthGuard cross-check     |        |      |
| 6       | 2     | CORS plugin + OAuth handoff endpoint + state-cookie HMAC  |        |      |
| 7       | 2     | Architectural tests (3 new assertions)                    |        |      |
| 8       | 3     | Unit tests (≥25 tests)                                    |        |      |
| 9       | 4     | API integration tests (≥15 tests)                         |        |      |
| 10      | 5     | hooks.server.ts + (public) route group + branding helper  |        |      |
| 11      | 5     | OAuth handoff consumer page                               |        |      |
| 12      | 6     | Integration + cutover + ADR-050 backfill                  |        |      |

### Session log template

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

### Infra (new / modified)

| File                                         | Purpose                             |
| -------------------------------------------- | ----------------------------------- |
| `docker/nginx/nginx.conf`                    | Replace single server with 3 blocks |
| `docker/docker-compose.yml`                  | Add certbot sidecar service         |
| `docker/certbot/cloudflare.ini` (gitignored) | Cloudflare DNS API token (runtime)  |
| Doppler secret `CLOUDFLARE_DNS_API_TOKEN`    | Token source                        |

### Backend (new)

| File                                                                    | Purpose                   |
| ----------------------------------------------------------------------- | ------------------------- |
| `backend/src/nest/common/utils/extract-slug.ts`                         | Pure host-to-slug parser  |
| `backend/src/nest/common/middleware/tenant-host-resolver.middleware.ts` | Pre-auth host-resolution  |
| `backend/src/nest/auth/oauth/oauth-handoff.service.ts`                  | Handoff-token mint + swap |
| `backend/test/tenant-subdomain-routing.api.test.ts`                     | Tier 2 integration tests  |

### Backend (modified)

| File                                                | Change                                            |
| --------------------------------------------------- | ------------------------------------------------- |
| `backend/src/nest/app.module.ts`                    | Mount middleware globally                         |
| `backend/src/nest/auth/jwt-auth.guard.ts`           | Cross-check assertion                             |
| `backend/src/nest/auth/oauth/microsoft.provider.ts` | HMAC-sign state with `return_to_slug`             |
| `backend/src/nest/auth/oauth/oauth.controller.ts`   | Mint handoff-token, redirect to subdomain         |
| `backend/src/nest/main.ts`                          | Fastify CORS plugin registration                  |
| `shared/src/architectural.test.ts`                  | +3 assertions (R1, R2, slug-parser single-source) |

### Frontend (new)

| Path                                                   | Purpose                                |
| ------------------------------------------------------ | -------------------------------------- |
| `frontend/src/routes/(public)/`                        | New layout group (login/signup/forgot) |
| `frontend/src/routes/(public)/+layout.server.ts`       | Branding resolution                    |
| `frontend/src/lib/utils/branding.ts`                   | Brand resolver                         |
| `frontend/src/lib/utils/extract-slug.ts` _(or shared)_ | Frontend slug parser (decision D5)     |

### Frontend (modified)

| File                                                        | Change                                          |
| ----------------------------------------------------------- | ----------------------------------------------- |
| `frontend/src/hooks.server.ts`                              | Read X-Forwarded-Host → `event.locals.hostSlug` |
| `frontend/src/routes/signup/oauth-complete/+page.server.ts` | Swap handoff-token instead of direct cookies    |
| `frontend/src/routes/login/+page.svelte`                    | Use branding helper for title                   |

---

## Spec Deviations

> Per HOW-TO-PLAN-SAMPLE §"Spec Deviations": if the spec / template
> contradicts the actual reality, document the deviation IMMEDIATELY.

| #   | Spec / template says            | Actual reality                    | Decision                                                                                                                                   |
| --- | ------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Phase 1 = "Database Migrations" | This plan has no DB schema change | Repurpose Phase 1 as "Infra (DNS + TLS + Nginx)". Infra IS the foundation here, mirroring DB's foundational role in typical FEATURE plans. |

---

## Pre-Execution Audit (D-table — to be filled in Session 1)

Per ADR-049 v0.1.0 → v1.0.0 pattern: surface discoveries BEFORE writing
production code. Each D-entry is a question whose answer changes the plan.

| #   | Question / Concern                                                                                                                                                                 | Resolution (filled in Session 1) |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| D2  | What's the actual production load-balancer IP? (Cloudflare proxy means it can be any backend IP.)                                                                                  |                                  |
| D3  | Are all existing tenants in DB populated with `subdomain`? Run: `SELECT COUNT(*) FROM tenants WHERE subdomain IS NULL OR subdomain = '' OR subdomain !~ '^[a-z0-9-]+$';`.          |                                  |
| D4  | What's the regex Signup currently enforces on `subdomain`? Is it identical to `[a-z0-9-]+`? Verify by reading signup DTO.                                                          |                                  |
| D5  | `extractSlug()` shared between BE+FE? If yes, lives in `shared/src/utils/`. If no, duplicate.                                                                                      |                                  |
| D6  | OAuth `state` cookie today: where set, what scope (`Path`, `SameSite`, `Domain`)? Verify it's apex-scoped only.                                                                    |                                  |
| D7  | `frontend/src/hooks.server.ts` current structure: how many handlers? Is `sequence()` used? Where to inject the host-extraction.                                                    |                                  |
| D8  | Test infra: how does Vitest API-tests fake the Host header today? (We need to inject `X-Forwarded-Host` per-test.)                                                                 |                                  |
| D9  | Vite dev-server: does it accept `*.localhost:5173` natively, or do we need a Vite config tweak (`server.allowedHosts`)?                                                            |                                  |
| D10 | docker-compose.yml: is there an existing shared volume for certs, or do we add new volume + bind?                                                                                  |                                  |
| D11 | Production deployment: does the operator currently terminate TLS at Cloudflare (proxied) or at our origin Nginx? Choice impacts whether we need origin-Nginx TLS at all.           |                                  |
| D12 | `PUBLIC_APP_URL` value in production Doppler config: is it `https://www.assixx.com` (matches test) or different?                                                                   |                                  |
| D13 | Existing `tenants.subdomain` collision potential: is there any tenant whose subdomain conflicts with a reserved DNS label (`www`, `api`, `admin`, `mail`, `static`)? Reserve list. |                                  |
| D14 | OAuth handoff token: store in Redis or DB? Redis is faster, DB is more durable. Plan says Redis — verify Redis cluster has persistence enabled.                                    |                                  |

> **Rule:** every D-entry must be resolved BEFORE Phase 1 starts. Resolution
> may modify R-table, file paths, or step content.

---

## Known Limitations (V1 — deliberately excluded)

> Per HOW-TO-PLAN-SAMPLE §"Known Limitations" — explicit anti-scope-creep.

1. **Custom-domain hosting (`app.scs-technik.de` via CNAME).** Modus B is
   V2+ work. Tracked as ADR-050 Followup #1. Trigger: contractual customer
   ask.
2. **Vanity-subdomain rename UI.** `tenants.subdomain` is set at signup and
   immutable in V1. V2 may add customer-self-service rename with old-URL
   301 for 90 days.
3. **Tenant subdomain sunset on tenant deletion.** When a tenant is
   soft-deleted, the subdomain becomes immediately re-claimable in V1. V2
   will add a 12-month tombstone cool-down.
4. **Per-subdomain `robots.txt`.** All subdomains will be indexable until V2
   adds per-subdomain `Disallow: /` (privacy + accidental data exposure
   prevention).
5. **i18n branding.** Subdomain-resolved branding is German-only in V1
   (matches existing app convention). i18n is out of scope.
6. **Custom subdomain TLS-cert per tenant.** All tenants share the wildcard
   cert. Per-tenant certs are V2+ work (and only relevant for Modus B).
7. **No A/B routing.** All requests for `<slug>.assixx.com` go to the same
   backend deployment. Canary deployments per-tenant are not addressed by
   this plan.

---

## Post-Mortem (fill after Session 12)

### What went well

- {tbd}

### What went badly

- {tbd}

### Metrics

| Metric                   | Planned | Actual |
| ------------------------ | ------- | ------ |
| Sessions                 | 12      | {tbd}  |
| Migration files          | 0       | {tbd}  |
| New backend files        | 4       | {tbd}  |
| New frontend files       | 4       | {tbd}  |
| Changed files            | ~10     | {tbd}  |
| Unit tests               | 25      | {tbd}  |
| API tests                | 15      | {tbd}  |
| ESLint errors at release | 0       | {tbd}  |
| Spec deviations          | 1 (D1)  | {tbd}  |

---

**This document is the execution plan. Every session starts here, takes the
next unchecked item, and marks it done. No coding starts before Phase 0 is
green (all D-entries resolved, all R-mitigations sanity-checked).**
