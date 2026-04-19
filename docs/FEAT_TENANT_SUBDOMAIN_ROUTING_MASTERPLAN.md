# FEAT: Tenant Subdomain Routing — Execution Masterplan

> **Plan type:** FEATURE
> **Created:** 2026-04-19
> **Version:** 0.2.0 (Pre-execution audit integrated — staff-engineer review 2026-04-19)
> **Status:** DRAFT — Phase 0 (planning)
> **Branch:** `feat/tenant-subdomain-routing` (to be created from `main` after `test/ui-ux` merges)
> **Spec:** [ADR-050 Tenant Subdomain Routing](./infrastructure/adr/ADR-050-tenant-subdomain-routing.md)
> **Author:** Simon Öztürk (Staff-Engineer assist)
> **Deployment context:** Greenfield (no live prod tenants as of 2026-04-19) —
> see ADR-050 §"Deployment Context: Greenfield Launch" for impact on cutover.
> **Infra decisions (user, 2026-04-19):** Registrar IONOS, DNS Cloudflare Free
> tier in **DNS-only mode (grey cloud)** — NOT proxied, TLS terminates at our
> origin Nginx.
> **Estimated sessions:** 13 (Session 9b added for test-infra migration)
> **Actual sessions:** 0 / 13

---

## Changelog

| Version | Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0.1.0   | 2026-04-19 | Initial draft — phases outlined, R-table seeded, D-table seeded                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 0.2.0   | 2026-04-19 | **Staff-engineer pre-execution audit integrated.** User decisions: greenfield (no live tenants), DNS-only CF Free, IONOS registrar. R14 (backend port exposure) + R15 (handoff host mismatch) added. Step 1.0 (reserved-slug) + Step 1.6 (prod port isolation) added. Session 9b (test-infra migration) added. `trustProxy: true` verified already active in `main.ts:284`. D-table: 7 entries resolved, 2 new (D15, D16). Cutover simplified (no customer comms, no transitional redirect). Nginx Phase 1 reclassified from "modify" to "full HTTPS rewrite" (current nginx.conf is HTTP-only). |
| 1.0.0   | TBD        | Phase 1 (Infra) COMPLETE — wildcard DNS + cert + Nginx live in staging                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 1.1.0   | TBD        | Phase 2 (Backend) COMPLETE — middleware + cross-check + CORS + handoff merged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 1.2.0   | TBD        | Phase 3 (Unit) COMPLETE — ≥25 unit tests + 3 architectural tests green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 1.2.5   | TBD        | Session 9b COMPLETE — test-infra `X-Forwarded-Host` helper + all ~38 API-test files migrated                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 1.3.0   | TBD        | Phase 4 (API) COMPLETE — ≥15 integration tests green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 1.4.0   | TBD        | Phase 5 (Frontend) COMPLETE — hooks + branding + OAuth handoff in place                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2.0.0   | TBD        | Phase 6 (Cutover) COMPLETE — production live, ADR-050 backfilled to "Accepted"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

> **Versioning rule (per HOW-TO-PLAN-SAMPLE):** `0.x.0` = planning, `1.x.0` =
> implementation in progress (minor bump per phase), `2.0.0` = fully complete.

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must be true before starting

**Greenfield advantage (user confirmation 2026-04-19):** no live prod tenants.
This removes several concerns (no forced re-login event, no data-at-rest
migration risk, no bookmark-transition).

- [ ] Docker stack running (all containers healthy — verify via
      `docker-compose ps` from `docker/`)
- [ ] Branch `feat/tenant-subdomain-routing` checked out (after `test/ui-ux`
      merges to `main`)
- [ ] No pending migrations blocking
- [ ] Dependent features shipped: ADR-049 (tenant-domain verification — DONE
      per smoke-test fixes commit `8d2920171`)
- [ ] ADR-050 reviewed and status flipped to "Accepted" by user
- [ ] **IONOS → Cloudflare nameserver delegation configured** (IONOS UI:
      set NS records for `assixx.com` to Cloudflare-assigned nameservers)
- [ ] Doppler secrets configured: `CLOUDFLARE_DNS_API_TOKEN` (scoped to
      `Zone:DNS:Edit` on `assixx.com` only) and new `OAUTH_STATE_SECRET`
      (dedicated, NOT derived from `JWT_SECRET` — see ADR-050 §OAuth
      handoff).
- [ ] Cloudflare account access verified, **DNS-only mode selected** (grey
      cloud, NOT proxied). TLS terminates at our origin Nginx.
- [ ] Reserved-slug enforcement shipped (Zod enum in signup DTO + DB CHECK
      constraint on `tenants.subdomain`). See ADR-050 §"Reserved Slug List".
- [ ] Pre-prod tenants (staging test fixtures) have `tenants.subdomain`
      populated and conformant to `^[a-z0-9-]+$` AND not in reserved list:
      `SELECT id, subdomain FROM tenants WHERE subdomain IS NULL OR subdomain = '' OR subdomain !~ '^[a-z0-9-]+$' OR subdomain IN ('www','api','admin','app','assets','auth','cdn','docs','blog','grafana','health','localhost','mail','static','status','support','tempo','test');`
      → must return zero rows.
- [ ] **Production topology designed as greenfield** (ADR-050 §"Production
      Topology Requirement"): `docker-compose.prod.yml` override exists that
      drops `ports:` publish for `backend` + `frontend` services. Only
      `nginx:443` is host-bound. This file is a Phase-0 deliverable — it
      does not exist yet in the repo.
- [ ] Prod host identified (VPS provider + public IP — greenfield decision
      taken with ADR-050 rollout).

### 0.2 Risk register

| #   | Risk                                                                                                                                                                                                | Impact   | Probability                                                                                                                                                    | Mitigation                                                                                                                                                                                                                                                                                           | Verification                                                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Forgotten `cookies.set({ domain: '.assixx.com' })` re-introduces cross-tenant cookie leak                                                                                                           | High     | Medium                                                                                                                                                         | Architectural test (`shared/src/architectural.test.ts`) regex-bans `domain:` literal in any `cookies.set` call. CI fails on regression.                                                                                                                                                              | Sanity-check: intentionally introduce `domain: '.assixx.com'` in a fixture file → CI red. Then revert.                                                                                     |
| R2  | Forgotten host-cross-check in a future custom auth flow lets JWT bypass subdomain                                                                                                                   | High     | Low                                                                                                                                                            | Architectural test asserts every controller decorated with `@UseGuards(JwtAuthGuard)` is reachable only via the middleware-mounted route (`HostResolverMiddleware` consumer chain).                                                                                                                  | Architectural test enumerates `@UseGuards(JwtAuthGuard)` AST nodes, asserts each lives under a module that imports `TenantHostResolverMiddleware`.                                         |
| R3  | Wildcard cert renewal silent-fail → 100 % outage in 90 days                                                                                                                                         | Critical | Medium                                                                                                                                                         | Prometheus exporter for cert-expiry-days. Grafana alert at < 14 d (paste into `docker/grafana/alerts/_*.json` provisioning set per ADR-002 Phase 5g).                                                                                                                                                | Manually advance cert clock in staging (or create a 7-day cert) → alert fires within 5 min.                                                                                                |
| R4  | Subdomain typo (`scs-tehcnik.assixx.com`) → 444 confuses user                                                                                                                                       | Low      | High                                                                                                                                                           | Catch-all `default_server` returns SvelteKit 404 page for browser User-Agents (UA-sniff regex), 444 for non-browsers (scanners, curl).                                                                                                                                                               | curl with browser UA → 404 HTML, curl without UA → connection-reset.                                                                                                                       |
| R5  | Internal services (cron, deletion-worker) call backend with no Host                                                                                                                                 | Medium   | Medium                                                                                                                                                         | `extractSlug()` returns `null` for missing/non-matching Host. Internal callers continue using `systemQuery()` (BYPASSRLS, no tenant context required).                                                                                                                                               | Unit test for `extractSlug(undefined)` → null. Integration test: deletion-worker's HTTP call to backend → 200 (no `CROSS_TENANT_HOST_MISMATCH` because `hostTenantId === null`).           |
| R6  | Microsoft OAuth `state` cookie set on apex doesn't reach the subdomain                                                                                                                              | High     | High                                                                                                                                                           | `state` cookie deliberately stays apex-scoped. The signed handoff-token mechanism is what crosses the origin boundary — `state` only validates the apex-side CSRF round-trip.                                                                                                                        | Tier 4 OAuth E2E: full flow on subdomain → Microsoft mock → apex callback → handoff swap → subdomain dashboard. Cookies inspected at every hop.                                            |
| R7  | Cloudflare API token compromise → wildcard DNS hijack                                                                                                                                               | Critical | Low                                                                                                                                                            | Token scoped to `assixx.com` zone only, `Zone:DNS:Edit` permission only (no `Zone:Zone:Edit`). Stored in Doppler with strict access-control. Rotated monthly via runbook (HOW-TO-CLOUDFLARE-TOKEN-ROTATION).                                                                                         | Doppler audit log review monthly. Token scope verified at boot-time check (certbot pre-hook fails if token has any extra permission).                                                      |
| R8  | Existing test fixtures don't have `tenants.subdomain` populated                                                                                                                                     | Medium   | Medium                                                                                                                                                         | Phase 0 grep scan: `SELECT id, subdomain FROM tenants WHERE subdomain IS NULL OR subdomain = '';` — must return zero rows. If non-zero, add backfill to Phase 1.                                                                                                                                     | Pre-Phase-1 query against staging DB. Must be 0 rows.                                                                                                                                      |
| R9  | Local dev breaks during transition (HMR, OAuth flow, etc.)                                                                                                                                          | Medium   | Medium                                                                                                                                                         | `extractSlug('localhost')` returns `null` → skip cross-check entirely on `localhost:5173`. OAuth dev-mode uses apex-only flow (no handoff). Documented in README.                                                                                                                                    | Dev smoke: `pnpm run dev:svelte`, login as `admin@apitest.de`, navigate to `/manage-admins`, all green.                                                                                    |
| R10 | SvelteKit `hooks.server.ts` change breaks existing routing                                                                                                                                          | High     | Low                                                                                                                                                            | Additive change only — current `hooks.server.ts` remains the base, new logic appends `event.locals.hostSlug` without modifying existing flow.                                                                                                                                                        | Existing E2E suite (smoke.spec.ts) green after Phase 5.                                                                                                                                    |
| R11 | Nginx regex `server_name ~^(?<slug>[a-z0-9-]+)\.assixx\.com$` matches deeper subdomains (`a.b.assixx.com`)                                                                                          | Medium   | Low                                                                                                                                                            | Anchored regex with character class `[a-z0-9-]+` (no dots). `nginx -t` config-test verifies, plus negative-test in Tier 2: `curl -H 'Host: a.b.assixx.com' …` → 444 (catch-all).                                                                                                                     | `nginx -t` passes. `curl --resolve a.b.assixx.com:443:127.0.0.1 https://a.b.assixx.com/` → connection-reset.                                                                               |
| R12 | OAuth `return_to_slug` parameter tampering → redirect to attacker subdomain                                                                                                                         | High     | Medium                                                                                                                                                         | `return_to_slug` is part of the signed `state` cookie (HMAC over `nonce                                                                                                                                                                                                                              |                                                                                                                                                                                            | return_to_slug`). Backend verifies signature before redirect, rejects mismatched slug. | Unit test: tampered `return_to_slug` → `BadRequestException('OAUTH_STATE_TAMPERED')`. Integration test: full flow with manually-tampered query param → 400. |
| R13 | Redis cache poisoning: attacker sets `tenant:slug:firma-a → 999` → all firma-a traffic resolves to tenant 999                                                                                       | Critical | Low                                                                                                                                                            | Redis is internal-only (no exposed port, network-isolated to backend). Only `TenantHostResolverMiddleware` writes the cache. Cache key TTL 60 s — bounded blast radius even on compromise.                                                                                                           | `docker exec assixx-redis redis-cli CONFIG GET bind` → only `127.0.0.1` and internal docker network. Verified via Trivy scan + Redis ACL audit.                                            |
| R14 | Backend `:3000` / frontend `:3001` reachable from public internet bypasses Nginx-enforced host-cross-check — valid JWT becomes cross-tenant skeleton key                                            | Critical | **High** (default `docker-compose.yml` publishes both ports for dev convenience, documented as feature in `docs/DOCKER-SETUP.md`; no prod-override exists yet) | `docker-compose.prod.yml` override drops `ports:` publish for `backend` + `frontend` services. Only `nginx` is host-bound (`:443`, and `:80` for HTTP→HTTPS redirect). Add architectural test asserting `docker-compose.prod.yml` overrides both services with `ports: !reset []`.                   | On prod host, from external network: `nmap -p 3000,3001 <prod-ip>` → both filtered/closed. `curl --max-time 5 -I https://<prod-ip>:3000/health` → connection timeout. Part of Phase 1 DoD. |
| R15 | Tampered OAuth redirect lands handoff-token on wrong subdomain → subdomain sets cookies of tenant A on tenant B's origin (self-heals on next request via `JwtAuthGuard`, but surfaces confusing UX) | High     | Low                                                                                                                                                            | Handoff endpoint `POST /api/v2/auth/oauth/handoff` asserts `req.hostTenantId === decodedPayload.tenantId` before returning the auth payload. Throws `HANDOFF_HOST_MISMATCH` (distinct error code from `CROSS_TENANT_HOST_MISMATCH` to allow specific Loki/Grafana alerting on OAuth-flow anomalies). | Integration test: mint handoff token for tenant A, submit via subdomain-B host → 403 `HANDOFF_HOST_MISMATCH`. Token is NOT consumed (Redis GETDEL only happens after host-match passes).   |

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

### Step 1.0: Reserved-slug enforcement (DB + DTO) [PENDING]

> **ADR-050 §"Reserved Slug List" realization.** Must exist BEFORE any Nginx
> config goes live — otherwise a future signup as slug `www` breaks apex
> routing. Also required by Phase 0.1 pre-flight query.

**Database migration** (generated via `doppler run -- pnpm run db:migrate:create add-subdomain-reserved-check`):

```typescript
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_subdomain_reserved_check
      CHECK (subdomain NOT IN (
        'www','api','admin','app','assets','auth','cdn','docs','blog',
        'grafana','health','localhost','mail','static','status','support',
        'tempo','test'
      ));
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_subdomain_reserved_check;`);
}
```

**Backend DTO** (`backend/src/nest/signup/dto/signup.dto.ts` or wherever
`subdomain` field lives):

```typescript
export const RESERVED_SUBDOMAINS = [
  'www','api','admin','app','assets','auth','cdn','docs','blog',
  'grafana','health','localhost','mail','static','status','support',
  'tempo','test',
] as const;

// in the Zod schema:
subdomain: z.string()
  .min(3).max(63)
  .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, digits, and hyphens')
  .refine((s) => !RESERVED_SUBDOMAINS.includes(s as (typeof RESERVED_SUBDOMAINS)[number]),
    { message: 'This subdomain is reserved and cannot be used.' }),
```

**Verification:**

```bash
# Apply migration
doppler run -- ./scripts/run-migrations.sh up

# Test: attempt to insert reserved slug → constraint rejects
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "INSERT INTO tenants (name, subdomain, company_name, is_active) VALUES ('t', 'www', 'T', 1);"
# → ERROR: new row for relation "tenants" violates check constraint "tenants_subdomain_reserved_check"

# Test via API:
curl -sX POST http://localhost:3000/api/v2/signup -H 'Content-Type: application/json' \
  -d '{"subdomain":"www",...}' | jq '.error.details[] | select(.field=="subdomain")'
# → { "field": "subdomain", "message": "This subdomain is reserved..." }
```

### Step 1.1: Cloudflare wildcard DNS record — DNS-only mode [PENDING]

**Prerequisite:** IONOS nameserver delegation to Cloudflare already active
(Phase 0.1 task). `whois assixx.com` must show Cloudflare-assigned
nameservers, e.g. `adam.ns.cloudflare.com`.

**What happens:**

1. Log into Cloudflare → `assixx.com` zone → DNS records.
2. Add apex records:
   - `@` `A` `<prod-public-ip>` **Proxy=DNS-only (grey cloud)**
   - `www` `CNAME` `assixx.com` **Proxy=DNS-only (grey cloud)**
3. Add wildcard record:
   - `*` `A` `<prod-public-ip>` **Proxy=DNS-only (grey cloud)**
4. Verify propagation (allow up to 5 min for CF's global edge):
   `dig +short firma-test.assixx.com @1.1.1.1` → resolves directly to our
   prod IP (NOT to a Cloudflare edge IP — that's how we verify DNS-only).

**Why DNS-only (grey cloud), NOT proxied (orange cloud) — user decision
2026-04-19:**

1. **TLS terminates at our origin Nginx.** No Cloudflare edge cert, no
   origin-mode decision (Full-strict vs Flexible), single cert chain. One
   Let's Encrypt wildcard, one renewal cycle.
2. **No WebSocket/SSE idle-timeout risk.** CF Free tier enforces 100-s idle
   on WebSockets — our `/chat-ws` would reconnect unnecessarily. DNS-only
   bypasses this entirely.
3. **No CF Proxy dependency in the hot path.** Our availability SLA stops at
   our origin. CF proxy outages (rare but real) can't take down Assixx.
4. **Upgrade path stays open.** Flip to orange-cloud later if DDoS or edge
   caching becomes worth the trade-offs. Not blocked by this plan.

**Verification:**

```bash
# From any external host (must resolve to OUR prod IP, not CF's):
dig +short assixx.com @1.1.1.1              # → <prod-public-ip>
dig +short www.assixx.com @1.1.1.1          # → <prod-public-ip>
dig +short firma-test.assixx.com @1.1.1.1   # → <prod-public-ip>
dig +short random.assixx.com @1.1.1.1       # → <prod-public-ip> (wildcard works)
# Sanity check CF proxy is NOT in path:
dig +short firma-test.assixx.com @1.1.1.1 | xargs -I{} whois {} | grep -i cloud
# → should NOT contain "Cloudflare" (means proxy is off)
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

**Modified file:** `docker/docker-compose.prod.yml` (NOT base `docker-compose.yml` —
certbot is prod-only; base stays dev-focused). Add service:

```yaml
# docker/docker-compose.prod.yml — appended to R14 override from Step 1.6
services:
  certbot:
    # ADR-027 Stage-1 pinning MANDATORY — verify current tag at
    # https://hub.docker.com/r/certbot/dns-cloudflare/tags and pick the latest
    # SemVer-shaped tag (e.g. v5.1.0 or similar). Never `latest`.
    # CI pin-guard (ADR-027 Amendment 2026-04-08) blocks rolling tags.
    image: certbot/dns-cloudflare:v5.1.0 # VERIFY BEFORE COMMIT — hub may have newer
    volumes:
      - certs:/etc/letsencrypt
      - ./certbot/cloudflare.ini:/cloudflare.ini:ro
    # Renewal loop: attempt every 12h. Certbot itself no-ops if cert has
    # > 30 days remaining. Post-hook triggers nginx reload inside the nginx
    # container (not this one) via docker exec.
    entrypoint: /bin/sh -c
    command: |
      "while :; do
         certbot renew --quiet --deploy-hook 'docker exec assixx-nginx nginx -s reload';
         sleep 43200;
       done"
    restart: unless-stopped
    depends_on: [nginx]

volumes:
  certs:
    name: assixx_certs
```

> **Pin verification step (per ADR-027 memory-note `feedback_docker_image_tag_verification.md`):**
> Docs/examples can be stale. Before committing, verify tag exists via
> `curl -fsSL https://hub.docker.com/v2/repositories/certbot/dns-cloudflare/tags/v5.1.0 > /dev/null`
> (200 = exists, 404 = pick the next patch). CI pin-guard will catch
> rolling tags but can't catch a typo'd version.

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

### Step 1.5: Nginx config — full HTTPS multi-server rewrite [PENDING]

> **Scope clarification (verified 2026-04-19):** current `docker/nginx/nginx.conf`
> is HTTP-only on port 80 (`server_name localhost`). The entire `listen 443 ssl http2`
> block is commented out (lines 207-318). This is NOT a "split existing block"
> — it's a full rewrite from HTTP-only-dev to HTTPS-prod-ready with three
> server blocks. Plan the change in a separate PR if scope becomes unwieldy.
>
> **Strategy:** split into two files:
>
> - `docker/nginx/nginx.dev.conf` — keep existing HTTP-only localhost config
>   for `docker-compose --profile production up -d` on a dev host (internal
>   testing without TLS).
> - `docker/nginx/nginx.prod.conf` — new file with HTTPS + multi-server blocks
>   below. Mounted via `docker-compose.prod.yml` override (Step 1.6).

**New file:** `docker/nginx/nginx.prod.conf` — HTTPS multi-server config.

Reference: preserve the `default_server { return 444; }` idiom from current
`nginx.conf:35-39`, preserve SSE/WebSocket/security-header patterns from
current `nginx.conf` sections §80-105 (SSE) and §159-174 (WebSocket).

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

### Step 1.6: Production port isolation (`docker-compose.prod.yml` override) [PENDING]

> **R14 mitigation, critical security prerequisite.** Without this step, the
> backend host-cross-check (Phase 2 Step 2.3) is trivially bypassable.

**New file:** `docker/docker-compose.prod.yml` — overrides base `docker-compose.yml`
to remove public port publishes from backend + frontend services. Only
`nginx:443` (and `:80` for HTTP→HTTPS redirect) is exposed to the host.

```yaml
# docker/docker-compose.prod.yml
# Usage: doppler run -- docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile production up -d
services:
  backend:
    # R14 mitigation (ADR-050): no public port publish in prod.
    # Backend is reachable only via nginx on the internal docker network.
    ports: !reset []
    environment:
      NODE_ENV: production

  frontend:
    # Same — bypasses-Nginx access was a dev-convenience.
    ports: !reset []

  nginx:
    # Mount the HTTPS prod config, publish 443 (plus :80 for redirect).
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/conf.d/default.conf:ro
      - certs:/etc/letsencrypt:ro
    ports:
      - '80:80'
      - '443:443'
```

**Verification (on prod host, from the public internet):**

```bash
# Both must time out / be filtered:
nmap -p 3000 <prod-public-ip>     # filtered
nmap -p 3001 <prod-public-ip>     # filtered
curl --max-time 5 -I https://<prod-public-ip>:3000/health  # timeout
curl --max-time 5 -I https://<prod-public-ip>:3001/        # timeout

# Only 80 and 443 are reachable:
nmap -p 80,443 <prod-public-ip>   # both open
```

**Architectural test** (`shared/src/architectural.test.ts` — added in Phase 2
Step 2.6): parse `docker-compose.prod.yml`, assert `services.backend.ports`
and `services.frontend.ports` are present AND resolve to empty-list override
(`!reset []`). Prevents regression where a future edit silently re-exposes.

### Phase 1 — Definition of Done

- [ ] IONOS → Cloudflare nameserver delegation active (`whois assixx.com`
      shows CF-assigned NS)
- [ ] Cloudflare DNS records for apex, www, and wildcard `*` in DNS-only mode
      (grey cloud), all A-records point to our prod public IP. Propagation
      verified from 3 resolvers (1.1.1.1, 8.8.8.8, 9.9.9.9).
- [ ] Doppler secrets set in prd config: `CLOUDFLARE_DNS_API_TOKEN`
      (scope `Zone:DNS:Edit` on `assixx.com` only), `OAUTH_STATE_SECRET`
      (32+ random bytes, dedicated — not derived from JWT_SECRET).
- [ ] Certbot sidecar service in `docker-compose.prod.yml`, `--dry-run`
      succeeds.
- [ ] Wildcard cert issued, expiry > 80 days, SAN includes `*.assixx.com`
      AND `assixx.com` (apex covered separately per RFC 6125 §6.4.3).
- [ ] `docker/nginx/nginx.prod.conf` has three server-blocks (apex, regex-
      subdomain, catch-all `return 444`); `nginx -t` passes inside the
      container.
- [ ] `curl https://www.assixx.com/health` → 200
- [ ] `curl https://firma-test.assixx.com/health` → 200 (verifies wildcard
      routing works end-to-end before backend changes)
- [ ] `curl -H 'Host: a.b.assixx.com' https://www.assixx.com/` → connection
      reset (verifies nested-subdomain regex rejection, falls through to
      catch-all 444)
- [ ] HTTP→HTTPS redirect verified with `curl -I http://www.assixx.com/` → 301
- [ ] Cert auto-renewal cron tested in staging by manually advancing the
      cert clock forward (or using a Let's Encrypt 7-day staging cert).
- [ ] **R14 mitigation verified:** `docker-compose.prod.yml` override exists,
      deployed on prod host, `nmap -p 3000,3001 <prod-ip>` returns filtered
      for both. Test rerun from an external network (not the prod host
      itself) — the prod host would see them as open because they bind to
      `0.0.0.0` on the internal docker network interface.

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

**Behavior (R15 mitigation — host-cross-check BEFORE Redis consume):**

1. Read `req.hostTenantId` (set by `TenantHostResolverMiddleware` — Step 2.2).
2. Redis **GET** (not GETDEL yet!) `oauth:handoff:${token}`.
   - Miss → 404 `HANDOFF_TOKEN_INVALID`.
3. Parse payload → `{ userId, tenantId, accessToken, refreshToken, user }`.
4. **Assert `req.hostTenantId === payload.tenantId`.**
   - Mismatch → 403 `HANDOFF_HOST_MISMATCH`. Token NOT consumed (attacker
     cannot burn another user's token by targeting the wrong subdomain).
5. Only now: Redis **DEL** `oauth:handoff:${token}` (single-use).
6. Return auth payload → subdomain page `cookies.set(...)` on own host.

**Rationale:** consuming on failed host-check would let an attacker
denial-of-service a user's OAuth flow by intercepting and replaying to the
wrong subdomain. Check first, consume second.

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
      Enables alerting on `CROSS_TENANT_HOST_MISMATCH` / `HANDOFF_HOST_MISMATCH`
      error codes filtered by host.
- [ ] Email/notification URL templates: every outbound URL generation
      (welcome email, password reset, notification SSE, invite links) must
      use the recipient's tenant subdomain. New helper:
      `getTenantBaseUrl(tenantId): Promise<string>` → resolves to
      `https://${subdomain}.assixx.com`. Audit all template files under
      `backend/src/nest/**/templates/` and `backend/src/nest/**/*-email.ts`.
- [ ] WebSocket URL: chat client must use `wss://${current-host}/chat-ws`
      (already does — reads `window.location.host`, verify in code review).
- [ ] **Greenfield cutover (no customer communication needed):** since there
      are no live prod tenants at cutover time (ADR-050 §"Deployment Context"),
      the "transitional redirect" and "customer announcement email" tasks
      from the original plan draft are NOT NEEDED. The first tenant ever to
      sign up in prod does so directly on the new topology — their signup
      lands on `<slug>.assixx.com` from day one. Login page shows the
      one-liner "Deine neue Adresse: <slug>.assixx.com" only if a future live
      migration happens later (tracked as Followup for V2+).

> **Dropped from original plan draft (reason: greenfield):**
>
> - ~~Customer-facing email announcement~~ — nobody to announce to.
> - ~~90-day transitional `www → subdomain` redirect~~ — no live bookmarks exist.
> - ~~Dual-cookie-scope transition~~ — would defeat the cookie-isolation
>   property; the whole point of Modus A is that cookies never cross
>   origins.

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

| Session | Phase | Description                                                                                    | Status | Date |
| ------- | ----- | ---------------------------------------------------------------------------------------------- | ------ | ---- |
| 1       | 0     | Pre-execution audit: D-table walk-through, R-table sanity (incl. R14/R15)                      |        |      |
| 2       | 1     | Step 1.0 Reserved-slug migration + DTO + Step 1.6 `docker-compose.prod.yml` override           |        |      |
| 3       | 1     | Step 1.1 DNS wildcard + Step 1.2 Doppler secrets (CF API token, OAUTH_STATE_SECRET)            |        |      |
| 4       | 1     | Step 1.3 Certbot sidecar + Step 1.4 initial wildcard cert                                      |        |      |
| 5       | 1     | Step 1.5 `nginx.prod.conf` full HTTPS rewrite + smoke test (no backend changes yet)            |        |      |
| 6       | 2     | extractSlug() + TenantHostResolverMiddleware + JwtAuthGuard cross-check                        |        |      |
| 7       | 2     | CORS plugin + OAuth handoff endpoint (with R15 host-cross-check) + state-cookie HMAC           |        |      |
| 8       | 2     | Architectural tests (R1, R2, slug-parser, R14 compose-override, R15 handoff-check)             |        |      |
| 9       | 3     | Unit tests (≥25 tests)                                                                         |        |      |
| 9b      | 3     | **Test-infra migration:** `X-Forwarded-Host` injection helper, audit existing ~38 API tests    |        |      |
| 10      | 4     | API integration tests (≥15 tests) incl. R14 (bypass via missing host) + R15 (handoff mismatch) |        |      |
| 11      | 5     | hooks.server.ts + (public) route group + branding helper                                       |        |      |
| 12      | 5     | OAuth handoff consumer page                                                                    |        |      |
| 13      | 6     | Integration + cutover + ADR-050 backfill (greenfield — no customer comms needed)               |        |      |

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

| #   | Question / Concern                                                                                                      | Resolution                                                                                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D2  | What's the actual production load-balancer IP?                                                                          | **Open (greenfield).** No prod infra exists yet — IP will be assigned when the VPS is provisioned. Session 2 resolves: pick provider (Hetzner recommended based on DE market target), provision, record IP in Doppler `PROD_PUBLIC_IP`.                                                                                           |
| D3  | Are all existing tenants in DB populated with `subdomain`?                                                              | **N/A in prod.** Greenfield — no live tenants. Staging fixtures are verified in Phase 0.1 query (includes reserved-slug check).                                                                                                                                                                                                   |
| D4  | What's the regex Signup currently enforces on `subdomain`?                                                              | **TO VERIFY Session 1:** Read `backend/src/nest/signup/dto/*.ts` — must match `^[a-z0-9-]+$`. Step 1.0 overrides/adds reserved-slug refinement on top of whatever exists.                                                                                                                                                         |
| D5  | `extractSlug()` shared between BE+FE?                                                                                   | **Decision: duplicate, NOT shared.** Backend lives in `backend/src/nest/common/utils/extract-slug.ts`, frontend in `frontend/src/lib/utils/extract-slug.ts`. Reason: `shared/` imports add build-order friction; logic is ~20 LOC; an architectural test asserts both implementations behave identically on a pinned test vector. |
| D6  | OAuth `state` cookie today: where set, what scope?                                                                      | **TO VERIFY Session 1:** grep `backend/src/nest/auth/oauth/` for `state` cookie set. Must remain apex-scoped post-Phase-2 (the handoff-token, not the state cookie, crosses the origin boundary).                                                                                                                                 |
| D7  | `hooks.server.ts` structure                                                                                             | **RESOLVED 2026-04-19:** Uses `sequence()` with 6 handlers (Sentry → securityHeaders → legacyRedirects → auth → logging → minification). `event.locals.hostSlug` extraction inserts BEFORE `authHandle` (so auth can consume it for future logging).                                                                              |
| D8  | Test-infra: how does Vitest API-tests fake the Host header today?                                                       | **TO AUDIT Session 9b (dedicated session).** ~38 test files under `backend/test/`. Helper to add: `withTenantHost(request, slug)` that injects `X-Forwarded-Host: ${slug}.assixx.com`. Risk: existing tests may hard-fail if middleware finds mismatch — migration is per-file effort.                                            |
| D9  | Vite dev-server: does it accept `*.localhost:5173`?                                                                     | **TO VERIFY Session 10 (Frontend):** probably works out of the box (Vite binds to all interfaces by default on modern versions). If not, add `server.allowedHosts: ['.localhost']` to `vite.config.ts`.                                                                                                                           |
| D10 | docker-compose.yml: existing shared volume for certs?                                                                   | **RESOLVED 2026-04-19:** No existing cert volume. Step 1.3 adds named volume `certs` mounted to `certbot` (rw) and `nginx` (ro).                                                                                                                                                                                                  |
| D11 | Production TLS termination: Cloudflare or origin Nginx?                                                                 | **RESOLVED 2026-04-19 (user decision):** origin Nginx. CF Free tier in DNS-only mode (grey cloud), NOT proxied. See Step 1.1 rationale.                                                                                                                                                                                           |
| D12 | `PUBLIC_APP_URL` value in production Doppler                                                                            | **Default: `https://www.assixx.com`** (matches `microsoft.provider.test.ts:185` expectation). Session 2 verifies Doppler prd config.                                                                                                                                                                                              |
| D13 | Existing tenants colliding with reserved slugs?                                                                         | **N/A (greenfield).** Step 1.0 enforces both CHECK-constraint + DTO-validation for all future signups.                                                                                                                                                                                                                            |
| D14 | OAuth handoff token: Redis or DB?                                                                                       | **RESOLVED: Redis.** TTL=60s, single-use (DEL after host-cross-check passes — see Step 2.5). If Redis is unavailable, the whole OAuth flow fails loudly (circuit-break) — no DB fallback because the 60s TTL is meaningless in durable storage, and losing an in-flight OAuth is a 30s user annoyance, not a data loss.           |
| D15 | **(NEW)** VPS provider choice for greenfield deployment?                                                                | **Session 2 decision.** Recommendation: Hetzner (DE market, EUR billing, matches target demographic) with a CX32 or CAX41. Backup-aware instance type (includes snapshot support).                                                                                                                                                |
| D16 | **(NEW)** `docker-compose.prod.yml` — does it live in `docker/` alongside base, or in a separate `deployment/` subtree? | **Recommendation:** `docker/docker-compose.prod.yml` (same directory as base). Single source of compose files, simplest mental model. Session 2 commits the file.                                                                                                                                                                 |

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
