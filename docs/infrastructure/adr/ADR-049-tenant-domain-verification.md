# ADR-049: Tenant Domain Verification

| Metadata                | Value                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                                                                                                                                                                                                                                                                                      |
| **Date**                | 2026-04-19                                                                                                                                                                                                                                                                                                                                                    |
| **Decision Makers**     | Simon Öztürk (Staff-Engineer assist)                                                                                                                                                                                                                                                                                                                          |
| **Affected Components** | Backend: `domains/`, `signup/`, `users/`, `auth/`, `root/`, `dummy-users/` modules + `tenant_domains` table (Phase 1 migration). Frontend: `(app)/+layout.server.ts`, `(app)/+layout.svelte`, signup `/_lib/api.ts` + `/_lib/constants.ts`, new `/settings/company-profile/domains/` route, 3 user-creation pages, banner component, breadcrumb + nav config. |
| **Supersedes**          | —                                                                                                                                                                                                                                                                                                                                                             |
| **Related ADRs**        | ADR-005 (Auth), ADR-010 (Roles), ADR-012 (Route Security Groups), ADR-018 (Testing Strategy), ADR-019 (RLS), ADR-033 (Addons), ADR-046 (OAuth Sign-In)                                                                                                                                                                                                        |
| **Masterplan**          | `docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md`                                                                                                                                                                                                                                                                                                          |

---

## Context

### The Problem: Fake Tenants Have Unbounded Blast Radius

Before this ADR, anyone could sign up to Assixx with a free-mail address (`gmail.com`, `gmx.de`, `outlook.com`), receive a fully-functional tenant, and then create unlimited admin / employee accounts. The signup flow had **zero proof of organisational legitimacy** — the only gates were a working email field and a Cloudflare Turnstile bot challenge.

The blast radius of one fake tenant was effectively unbounded:

| Misuse vector             | Pre-ADR cost to attacker     | Pre-ADR damage potential                             |
| ------------------------- | ---------------------------- | ---------------------------------------------------- |
| Phishing platform abuse   | One free-mail signup (~30 s) | Unlimited account creation, brand-as-trust hijack    |
| Bulk-spam relay           | Same                         | Each tenant is N users with their own login surfaces |
| Resource scraping / DoS   | Same                         | Each tenant gets the full feature surface            |
| Credential stuffing wedge | Same                         | Tenant creation = legitimate-looking entry vector    |

There was no architectural mechanism to differentiate a real industrial company's IT admin from an attacker who just hit the signup page.

### Requirements

1. **Proof-of-domain-ownership** as a precondition for user creation — must be unforgeable from outside the customer's DNS zone.
2. **Defence-in-depth at signup** — reject obviously-illegitimate emails (free providers, disposable services, malformed) BEFORE the tenant is even created, to keep the noise out of the audit trail.
3. **No degraded UX for legitimate customers** — the verification step must be a one-time DNS-TXT challenge, not an SMS / phone-call / KYC flow.
4. **Architecturally bypass-proof** — even if a future developer adds a new user-creation endpoint, it must impossible to skip the verification gate without explicit allowlist consent in the same PR.
5. **Clean separation from rate-limiting / Cloudflare Turnstile** — those are anti-bot, this is anti-fake-tenant; they're orthogonal concerns.
6. **First-class OAuth (Microsoft Entra)** — the OAuth-signup path already proves domain ownership via Azure AD's signature on the id_token, so it must NOT require a redundant DNS-TXT dance.

---

## Decision

### Two-Layer Defence: Signup Hardening + Domain-Verification Gate

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              ATTACK SURFACE                               │
└──────────────────────────────────────────────────────────────────────────┘

     Attacker hits POST /signup
              │
              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Layer 1 — Signup Hardening (synchronous, ~1 ms, zero DNS)                │
│                                                                           │
│   validateBusinessEmail(email):                                           │
│     1. RFC 5322 shape (single @, valid local + domain)                   │
│     2. mailchecker.isValid(email)  → disposable list (mailinator, …)    │
│     3. FREEMAIL_DOMAINS Set lookup → committed JSON (gmail, gmx, …)     │
│                                                                           │
│   Failure → 400 with code INVALID_FORMAT / DISPOSABLE_EMAIL /            │
│              FREE_EMAIL_PROVIDER (mapped to German UI strings)            │
│                                                                           │
│   Success → tenant + root user CREATED with status='unverified',         │
│             tenant_domains row seeded as status='pending'                 │
└──────────────────────────────────────────────────────────────────────────┘
              │
              ▼
     Tenant exists but is UNVERIFIED
              │
              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Layer 2 — Domain-Verification Gate (KISS, single helper)                 │
│                                                                           │
│   TenantVerificationService.assertVerified(tenantId):                    │
│     queryAsTenant(SELECT EXISTS(... WHERE status='verified' AND …))      │
│       → true  → noop                                                      │
│       → false → throw ForbiddenException(TENANT_NOT_VERIFIED)            │
│                                                                           │
│   Called at the entry of EVERY user-creation helper:                     │
│     - users.service.ts::insertUserRecord                                  │
│     - auth.service.ts::createUser                                         │
│     - root.service.ts::insertRootUserRecord                               │
│     - root-admin.service.ts::insertAdminRecord                           │
│     - dummy-users.service.ts::create                                     │
│                                                                           │
│   Allowlisted bootstraps (the ONLY paths that may INSERT INTO users      │
│   without a prior assertVerified call — they ARE the path that creates   │
│   the FIRST user, before any tenant_domains row could exist):            │
│     - signup.service.ts::createRootUser           (password signup)      │
│     - signup.service.ts::createOAuthRootUser      (Microsoft OAuth)      │
│                                                                           │
│   Architectural test (shared/src/architectural.test.ts) FAILS CI         │
│   if any service-level INSERT INTO users is found in a method body that  │
│   neither calls assertVerified() nor is on the 2-entry allowlist.        │
└──────────────────────────────────────────────────────────────────────────┘
              │
              ▼
     User can verify via DNS-TXT, then user-creation unlocks.
```

### Verification Mechanism: DNS-TXT Subdomain Challenge

When a domain is added (either at signup or later via `POST /api/v2/domains`), the backend generates a 32-byte cryptographic token via `crypto.randomBytes(32).toString('hex')` and stores it in `tenant_domains.verification_token`. The customer is instructed to add a TXT record at:

```
Host:  _assixx-verify.<their-domain>
Type:  TXT
Value: assixx-verify=<64-hex-token>
```

When the customer clicks "Jetzt verifizieren", the backend resolves the TXT record via `node:dns/promises.Resolver` with a 3 s `Promise.race` timeout (the resolver's own timeout is libresolv-variant-dependent and not reliable for NXDOMAIN), reassembles RFC 7208 chunks (`string[][] → string[]` via `.join('')`), and matches `.some(v => v.trim() === expected)`. On match the row flips to `status='verified'`, `verified_at=NOW()`. On miss, the row stays `pending` and the user can retry.

**Pattern rationale (subdomain, not apex):** Following the AWS SES / Resend / Google Search Console idiom, the TXT record lives at `_assixx-verify.<domain>` rather than the apex. This avoids collision with existing SPF / DMARC / DKIM records that customers commonly have at the apex.

**Token persistence:** The token is generated once at "add domain" time and never expires in V1. A user who deletes the TXT record AFTER successful verification keeps their `verified` status (V1 has no periodic re-verification). Tradeoff: a maliciously-expired domain lives until manually removed; accepted for V1, candidate for V2 background re-verification.

### OAuth Auto-Verify (Azure AD Trust Boundary)

The Microsoft OAuth signup path (`registerTenantWithOAuth`, ADR-046) already validates Microsoft's signature on the id_token and Microsoft only issues tokens for domains the tenant administratively controls. Re-running a DNS-TXT challenge AFTER Azure AD has already asserted ownership would be theatre.

**Decision:** OAuth signup seeds `tenant_domains` with `status='verified'`, `verified_at=NOW()`, `is_primary=true` directly inside the `executeOAuthRegistrationTransaction`. The verification token is still generated and stored (NOT NULL column, audit-trail integrity) but never redeemed. Race protection: a partial UNIQUE INDEX `idx_tenant_domains_domain_verified` guarantees at most one tenant per verified domain globally; concurrent OAuth callbacks for the same Microsoft domain produce one 201 + one 409 `DOMAIN_ALREADY_CLAIMED` (verified by Phase 4 unit test via `vi.mock` on the partial UNIQUE INDEX → ConflictException path).

The arch-test allowlist explicitly sanctions `createOAuthRootUser` as the second bootstrap (alongside the password-signup `createRootUser`). Both bootstraps are private helpers — the AST visitor that powers the arch-test resolves the enclosing function of each `INSERT INTO users` literal, and the allowlist matches against helper names, not against the public bootstrap method names that delegate into them (this distinction was uncovered by Phase 0 D32 + D33 during pre-execution audit).

---

## Consequences

### Positive

- **Fake-tenant cost rises sharply:** an attacker can still sign up with a real corporate-looking domain they don't own, but they cannot create employee/admin accounts (no DNS-TXT proof). The blast radius of a fake tenant is permanently capped at one user (the attacker themselves).
- **Break-Glass becomes the customer's problem:** if the root user loses mailbox access, the customer's IT admin (who controls the DNS-verified domain) recreates the mailbox via their own DNS authority. No SRE runbook, no Multi-Root mandate.
- **Architecturally bypass-proof:** the §2.11 architectural test (`shared/src/architectural.test.ts`, AST-based) blocks any future PR that adds a service-level `INSERT INTO users` without an `assertVerified()` gate or explicit allowlist amendment in the same PR. CI signal is direct (`<file>::<method> inserts into users but never calls assertVerified(...)` with a file-path pointer).
- **Multi-domain support from day 1:** schema is `1 : N tenant → tenant_domains` from day one. V1 UI already allows multiple domains per tenant with one `is_primary`. V2+ can add per-domain SSO, email-sending, user-invite allowlists without schema change.
- **Defence-in-depth at signup:** the three-layer email gate (format + disposable + freemail) keeps obviously-illegitimate signups out of the audit trail entirely, reducing operator noise.
- **No SMTP / MX probing in the hot path:** signup latency is bounded at ~1 ms (synchronous list-lookups only), eliminating an entire class of false-negatives caused by SMTP greylisting / blocklisting / MX-record propagation lag.

### Negative

- **One-person companies using personal Gmail are blocked at signup.** Accepted by design — Assixx target audience is 50–500 employees per README, all of whom have a company domain. Documented as Known Limitation #9 in the masterplan.
- **Single-root-mailbox-loss deadlock for unverified tenants** (Known Limitation #10, accepted: blast radius = 1 tenant slot). If the root loses mailbox access BEFORE verifying the domain, they cannot recover via Forgot-Password (the BE 403s on user-creation) and cannot prove ownership via DNS-TXT (they don't have access to the company DNS zone). The tenant becomes orphan-state. V1 accepts this; V2 may add a 30-day soft-delete sweep of zero-verified tenants.
- **Customers must access their DNS zone** — non-trivial for customers whose IT is outsourced. Mitigated by the customer-facing DNS guide (Phase 6 deliverable, AWS Route53 / Cloudflare / GoDaddy walk-throughs).
- **DNS propagation delay (typically < 5 min, occasionally hours)** — verification can fail for a propagation reason that looks identical to a typo. Mitigated by clear UX copy ("DNS-Propagation kann ein paar Minuten dauern") and unlimited retry.

### Neutral

- **Verification is one-time in V1.** A maliciously-expired domain keeps its tenant alive until manually removed. Acceptable trade-off vs. complexity of background re-verification.
- **Tenant verification status is derived, not stored on `tenants`.** `TenantVerificationService.isVerified()` queries `tenant_domains` per call (sub-ms via `idx_tenant_domains_tenant`), avoiding a denormalized `tenants.verification_status` column that would need PL/pgSQL trigger maintenance and could drift. Same precedent as ADR-033's removal of `tenants.current_plan*` columns.

---

## Why NOT MX / SMTP at Signup

Earlier drafts (v0.1.0) of the masterplan included an MX-record check via the `node-email-verifier` library. This was REMOVED in v0.1.1 for four converging reasons:

1. **MX is a weaker check than the eventual TXT-verify step.** A working MX record proves "email-deliverable", not "controlled by the customer". The DNS-TXT step is the actual proof-of-ownership.
2. **DNS dependency on the signup hot path** is a reliability hazard. A regional resolver outage during peak signup hours would degrade the signup conversion rate without improving the security guarantee.
3. **SMTP probing surfaces a blacklist risk.** Repeated `RCPT TO` probes from Assixx infrastructure could land the platform on Spamhaus / Barracuda lists. The signup-side reward (catching some typos) is not worth the operational risk.
4. **Library supply-chain surface.** `node-email-verifier` and adjacent libraries pull in transitive dependencies for SMTP / DNS / TLS handling — each is a potential supply-chain attack vector for a pure "is this domain real?" check that adds little.

The accepted V1 design is intentionally NOT-defence-in-depth on the email-deliverability axis. A typo'd domain (`fima.de` instead of `firma.de`) creates a ghost tenant that fails at the TXT-verification step and is documented as accepted noise (Risk R5 in the masterplan).

---

## Why a Committed Freemail JSON, Not a Library

The freemail-domain check is implemented as a `Set` lookup on a 4782-entry committed JSON file at `backend/src/nest/domains/data/freemail-domains.json`, sourced from [`Kikobeats/free-email-domains`](https://github.com/Kikobeats/free-email-domains) (MIT, 4779 entries) plus 3 Assixx-local additions for the German market (`mailbox.org`, `tutanota.com`, `tutanota.de`).

Earlier drafts (v0.1.1) wrapped the upstream list via `company-email-validator`. Rejected for three reasons:

1. **`Unlicense`** — unusual for B2B legal review compared to the upstream list's MIT.
2. **Half-maintained wrapper.** Last GitHub release in 2021; npm publishes since then are silent list-bumps without tags — effectively an unreviewed community mirror.
3. **Wrapper supply-chain surface** for a value that is, fundamentally, just a JSON array.

The committed-JSON approach gives:

- Single source of truth (Git is the audit log; upstream changes are diffable and review-gated).
- MIT-clean (matches the rest of the project's permissive-license policy).
- Zero runtime supply-chain surface beyond the runtime dep `mailchecker` (MIT, 0 deps, used for the disposable layer).
- An ESLint `no-restricted-imports` rule (`backend-scope, **/domains/data/freemail-domains.json`) keeps any future code from bypassing the `validateBusinessEmail` wrapper.
- Monthly sync via `scripts/sync-freemail-list.ts` — fetches upstream, prints Set-diff, never auto-commits, exits non-zero if Assixx-local entries are missing from upstream (prevents accidental rollback).

---

## Sequencing: Ships Before ADR-Forgot-Password

Plan 1 (Forgot-Password Role Gate) and Plan 2 (this ADR) were drafted in parallel. The masterplan explicitly sequences Plan 2 to ship FIRST because:

1. Plan 1's Phase 1 depends on the **TRUNCATE-cascade clean-slate** that Plan 2's Phase 1 performs — without it, Plan 1 would have to build on test-tenants that don't have a `tenant_domains` row.
2. The **pre-verified test-tenant seed** (`firma-a` / `firma-b` / `scs` / `apitest` per Phase 1 Step 1.3) that Plan 2 creates is what Plan 1's Forgot-Password tests use as their tenant fixture.
3. The single-root-mailbox-loss risk that Plan 2's Known Limitation #10 surfaces is what motivates Plan 1 in the first place — Plan 1 is the long-term resolution, Plan 2 establishes the constraint that makes the resolution useful (the customer's IT admin who recovers the mailbox is the same person who controls the verified DNS zone).

The signal handoff to Plan 1 lives in this ADR's Phase 6 DoD: "Plan 1 (ADR-Forgot-PW) team unblocked once ADR-049 ships."

---

## Architectural Test Mandate (R7 Mitigation)

The single most-load-bearing mechanism in this design is the architectural test at `shared/src/architectural.test.ts` — without it, the KISS-gate design degrades into "we'll remember to add `assertVerified()` everywhere" which is exactly the accident-waiting-to-happen pattern that motivated this ADR.

Implementation specifics (committed in Phase 2 Step 2.11, v1.1.0):

```typescript
// AST-based visitor — NOT a regex grep.
// Resolves the enclosing function of each `INSERT INTO users` literal via
// ts.createSourceFile + ts.forEachChild, then asserts the body either
// contains a `assertVerified(` call OR the method name is on the 2-entry
// USER_INSERT_ALLOWLIST.

const USER_INSERT_ALLOWLIST = new Set([
  'backend/src/nest/signup/signup.service.ts::createRootUser',
  'backend/src/nest/signup/signup.service.ts::createOAuthRootUser',
]);

// On regression (e.g., a future dev adds POST /api/v2/external-users without
// the gate), the test failure message is direct + actionable:
//   backend/src/nest/external-users/external-users.service.ts::createExternal
//     inserts into `users` but never calls `assertVerified(...)` in its body.
```

A pre-existing bug in the file's `ROOT` resolution (`new URL('../../../', import.meta.url).pathname.replace(/\/$/, '')` resolved to empty string from the test file's location, plus `rg` not being installed inside the backend container) was discovered during the v1.1.0 sanity-check pass and fixed inline; the fix uses `process.cwd()` + Node's `readdirSync({ recursive: true })` so the test is container-agnostic and shell-dependency-free.

---

## Implementation Notes

### Database Schema (Phase 1, migration `20260417223358319_create-tenant-domains`)

```sql
CREATE TYPE tenant_domain_status AS ENUM ('pending', 'verified', 'failed', 'expired');

CREATE TABLE tenant_domains (
    id                 UUID PRIMARY KEY DEFAULT uuidv7(),  -- PG 18.3 native
    tenant_id          INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain             VARCHAR(253) NOT NULL,            -- RFC 1035 max
    status             tenant_domain_status NOT NULL DEFAULT 'pending',
    verification_token VARCHAR(64) NOT NULL,             -- 32 bytes hex
    verified_at        TIMESTAMPTZ,
    is_primary         BOOLEAN NOT NULL DEFAULT false,
    is_active          INTEGER NOT NULL DEFAULT 1,       -- IS_ACTIVE constants
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT tenant_domains_tenant_domain_unique UNIQUE (tenant_id, domain)
);

-- Per-tenant lookup index (RLS-aware queries)
CREATE INDEX idx_tenant_domains_tenant ON tenant_domains (tenant_id);

-- Global one-verified-tenant-per-domain guarantee (race protection)
CREATE UNIQUE INDEX idx_tenant_domains_domain_verified
    ON tenant_domains (domain) WHERE status = 'verified' AND is_active = 1;

-- One-primary-per-tenant guarantee (PATCH /domains/:id/primary contract)
CREATE UNIQUE INDEX tenant_domains_one_primary_per_tenant
    ON tenant_domains (tenant_id) WHERE is_primary = true AND is_active = 1;

-- RLS — strict NULLIF pattern per ADR-019
ALTER TABLE tenant_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_domains FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_domains
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

-- Triple-user GRANTs (app_user / sys_user / assixx_user per project standard)
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_domains TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_domains TO sys_user;
```

The two partial UNIQUE indexes are the entire race-protection mechanism — application code catches `pg.DatabaseError.code === '23505'` and discriminates via `err.constraint` to map either index to the correct user-facing 409 (`DOMAIN_ALREADY_ADDED` for the per-tenant one, `DOMAIN_ALREADY_CLAIMED` for the global verified one).

### Throttle Tier (`domain-verify`)

`POST /api/v2/domains/:id/verify` is the only endpoint that emits outbound DNS. It sits under a dedicated throttle tier `{ name: 'domain-verify', ttl: 10 * MS_MINUTE, limit: 10 }` defined in `throttler/throttler.module.ts` and applied via the `@DomainVerifyThrottle()` decorator. Rationale: protects upstream resolvers from being weaponised against any third-party domain (R11). Other domain endpoints sit under the standard `@UserThrottle()` tier.

A mid-Phase-4 production fix: `domains.controller.ts` needed `@UseGuards(CustomThrottlerGuard)` at class level for the throttle decorators to actually apply (the throttler guard is NOT global per `app.module.ts` §196-200, applied selectively via decorators). Discovered when a 15-call burst against `/verify` failed to trip the cap; pattern now matches the 6 other selectively-throttled controllers (`AuthController`, `OAuthController`, `LogsController`, `SignupController`, `E2eKeysController`, `E2eEscrowController`).

### Frontend Architecture

- New page `/settings/company-profile/domains/` lives under the `(root)` layout group (auto-gated by ADR-012).
- State facade is split into `state-data.svelte.ts` (domains[] + mutations) + `state-ui.svelte.ts` (modal/in-flight state) + `state.svelte.ts` (barrel) per the v0.3.4 D24 split — keeps the modal-isolation contract testable in isolation.
- After verify-success the page calls `await invalidateAll()` from `$app/navigation` (v0.3.0 S4) so `(app)/+layout.server.ts` re-fetches `verification-status` and the global `UnverifiedDomainBanner` disappears + user-creation buttons unlock in the SAME tab without a manual reload.
- Banner mirrors `SingleRootWarningBanner` pattern: sessionStorage dismiss, shared `--banner-warning-*` CSS vars, role-gated to root + admin (employees never see).
- Signup error mapping is purely client-side per v0.3.1 F1 — `EMAIL_VALIDATION_MESSAGES` Record in `_lib/constants.ts`, `Object.hasOwn` lookup in `_lib/api.ts`, no `+page.server.ts` introduced. Zod-DTO 400 → ApiError → German UI message (matches the byte-for-byte drift-guard test in `signup/_lib/api.test.ts`).

---

## Test Coverage

Per ADR-018's test pyramid:

| Tier                   | Coverage                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tier 1 Unit            | 103 backend unit tests (Phase 3 Part A): `email-validator.test.ts` 51, `domain-verification.service.test.ts` 12 (DNS mocked via `vi.mock('node:dns/promises')` + fake-timers for timeout branch), `domains.service.test.ts` 21, `tenant-verification.service.test.ts` 7 (ADR-019 regression-guard locking `queryAsTenant`), `signup.service.test.ts` +12 (freemail/disposable/format gates ×4 + tx-atomicity ×3 + OAuth hardening ×3 incl. freemail-Microsoft acceptance). |
| Tier 1a Permission     | Architectural test (`shared/src/architectural.test.ts`) 19/19 — AST-based, container-agnostic, includes intentional-regression sanity-check.                                                                                                                                                                                                                                                                                                                               |
| Tier 1b Frontend Unit  | 8 signup-error-mapping tests (`signup/_lib/api.test.ts`). State-facade tests deferred to `it.todo` (no Svelte rune support in `frontend-unit` Vitest project — see masterplan §5.4.1 follow-up).                                                                                                                                                                                                                                                                           |
| Tier 2 API Integration | 46 API tests (Phase 4): `tenant-domains.api.test.ts` 40 + `signup.api.test.ts` extension +6. 4 deferred with rationale: DNS-positive verify (HTTP-layer mocking infeasible), OAuth concurrent-race ×2 (Microsoft endpoint mocking infeasible), general `UserThrottle` 1000/15min (suite-runtime budget).                                                                                                                                                                   |
| Tier 3 E2E             | 2 working page-mount Playwright smokes. Full unverified-banner happy-path deferred — needs Phase 1 unverified-tenant seed addition (SSR-side `verification-status` fetch can't be Playwright-routed).                                                                                                                                                                                                                                                                      |

**Live HTTP A→B→C cycle verified end-to-end during Phase 2** (apitest tenant, 2026-04-18): unverified → 403 `TENANT_NOT_VERIFIED` → manually-verified → 201 → re-locked-via-DELETE → 403 again. The `assertVerified` gate behaves correctly on both open and close transitions.

---

## Followups

1. **V2 background re-verification** — periodic monthly DNS-TXT re-check with downgrade-on-miss after a grace period; today's V1 is one-time only.
2. **V2 30-day soft-delete sweep** of zero-verified tenants — addresses the ghost-tenant accumulation from typo'd signups (R5 + Known Limitation #10).
3. **Per-domain SSO / email-sending / invite-allowlist** — schema is ready (1:N), V2+ feature work.
4. **Frontend rune-test infra** — add `@sveltejs/vite-plugin-svelte` to the `frontend-unit` Vitest project, OR refactor the state facades into pure-fn + thin runed adapter; either unblocks the masterplan §5.4.1 deferred tests.
5. **Unverified test-tenant seed** — add to Phase 1's seed for the deferred Playwright E2E (masterplan §5.4.3).
6. **Plan 1 (Forgot-Password Role Gate) signal handoff** — Plan 1 is unblocked by this ADR's Phase 6 completion. Plan 1's Phase 1 reuses the test-tenant seed established here.

---

## References

- Masterplan: `docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md` (v1.4.0 at time of writing — Phase 5 complete, Phase 6 in progress)
- ADR-005 — Authentication Strategy (JWT, sole caller of `createUser` is `register(dto, NestAuthUser)`)
- ADR-018 — Testing Strategy (Vitest tier model, `pnpm exec vitest run --project ...`)
- ADR-019 — Multi-Tenant RLS Isolation (queryAsTenant, RLS-strict, app_user / sys_user split)
- ADR-033 — Addon-based SaaS Model (precedent for derived-state-not-denormalized-column)
- ADR-046 — Microsoft OAuth Sign-In (the trust boundary for OAuth auto-verify)
- HOW-TO: `docs/how-to/HOW-TO-INTEGRATE-FEATURE.md` (Section 3.5 sidebar nav + 3.6 breadcrumb integration)
- Upstream freemail list: <https://github.com/Kikobeats/free-email-domains> (MIT)
- DNS chunk reassembly: RFC 7208 §3.3 (TXT record `string[][]` → joined string)
