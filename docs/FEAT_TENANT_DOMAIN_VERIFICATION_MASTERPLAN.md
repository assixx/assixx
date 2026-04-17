# FEAT: Tenant Domain Verification — Execution Masterplan

> **Plan type:** FEATURE
> **Created:** 2026-04-16
> **Version:** 0.3.5 (Phase 0 Step 0.1 execution + re-verification pass — `signup.service.ts` anchors ground-truthed against live code on 2026-04-17. Two structural deviations surfaced: **D28** — `SignupDto` (`signup.dto.ts:142-161`) has TWO `EmailSchema` fields (`email` company-contact + `adminEmail` root-login); §2.8 Step 1+3 conflated them into one "the signup email". Fix decision: validate BOTH, seed `tenant_domains(pending)` from `extractDomain(dto.adminEmail)` — root-login domain is the ownership claim per §0.2.5 #3. **D29** — §2.11 arch-test uses AST-based enclosing-method resolution; the `INSERT INTO users` literal at `:289` is physically enclosed by the PRIVATE helper `createRootUser` (starts :279), NOT by the public bootstrap `registerTenant` the allowlist listed. Same for `:529` → `createOAuthRootUser` (starts :517). Allowlist-as-written would FAIL to match, arch-test would go red on first Phase-2 merge. Fix: §2.11 allowlist + §0.2.5 #14 re-anchored on `createRootUser` / `createOAuthRootUser`; §2.11 Landscape table rows annotated with call-chain context. Withdrawn claim: suspected off-by-one on line refs (`:288`/`:528` vs plan's `:289`/`:529`) — re-greped, plan is correct; I had confused the `client.query(` call line with the backtick-literal line.)
> **Status:** DRAFT — Phase 0 in progress (Step 0.1 complete 2026-04-17; Steps 0.2–0.8 pending)
> **Branch:** `feat/tenant-domain-verification`
> **Author:** Simon Öztürk (with Staff-Engineer assist)
> **Estimated sessions:** 8
> **Actual sessions:** 0 / 8
> **ADR:** ADR-048 (Tenant Domain Verification).
> **Sequencing:** Ships **FIRST** — before `FEAT_FORGOT_PASSWORD_ROLE_GATE_MASTERPLAN.md` (ADR-047). Plan 1 depends on Plan 2's Phase 1 TRUNCATE + pre-verified test-tenant seed.

---

## Goal in Plain Words

**One sentence:**
Every Assixx tenant must prove it controls a real company domain (via a DNS TXT record) before it can create additional users; signup is locked to company email addresses (no Gmail, Outlook, Web.de, GMX, Yahoo, …) and rejects disposable / non-existent mail domains.

**Two-layer defence:**

1. **Signup hardening** — at account creation, the root user's email must:
   - pass RFC 5322 format
   - have valid MX records on its domain (domain actually accepts mail)
   - not be disposable (mailinator, 10minutemail, …)
   - not be on a free-email-provider list (gmail.com, outlook.com, yahoo.com, web.de, gmx.de, t-online.de, …)
2. **Domain-verification gate** — after signup the tenant is flagged `UNVERIFIED` and **cannot create further users** (admin / employee / additional root) until at least one `tenant_domains` row reaches status `verified` via DNS TXT challenge.

**What stays unlocked in the UNVERIFIED state** (user's KISS decision):

- Root can log in, browse, configure Settings, manage own profile, Addons, data uploads, Forgot-Password — **everything except creating more users**. No global blocking overlay, no endpoint whitelist — a **single** helper call `assertTenantVerified(tenantId)` inside user-creation services is the only gate.

**Why this design works (security argument):**

- Fake-tenant cost rises sharply: an attacker can still sign up, but they cannot spam-create employee/admin accounts to use the platform for phishing or abuse. The blast radius of a fake tenant is permanently limited to one user (the attacker themselves).
- With a verified company domain, **Break-Glass becomes the customer's problem, not Assixx's**: if the root user loses mailbox access, the company's own IT admin (who controls the DNS-verified domain) recreates the mailbox. No SRE runbook, no Multi-Root mandate.

**Multi-domain support (user decision: yes, from day 1):**

- DB schema is 1 : N `tenant → domains` from day one (`tenant_domains` as a proper relation, not a column on `tenants`).
- V1 UI already allows adding multiple domains per tenant; one is marked `is_primary`.
- V2+ can add fine-grained per-domain policies (SSO, email-sending, user-invite allowlist) without schema change.

**Clean-slate migration:**

- User confirmed: current DB contains only test data. All existing tenants are test-tenants and will be deleted as part of this plan (documented in Phase 1). No grandfathering, no legacy-tenant bypass.

**What this plan explicitly does NOT do** (separate future work):

- **Per-domain email-sending** (send outbound email from `noreply@firma.de` instead of an Assixx-owned sender). Requires SPF / DKIM / DMARC setup. Separate plan.
- **SSO via verified domain** (SAML / OIDC). Separate plan.
- **Domain allowlist for user invites** (e.g., `@firma.de` users can self-join tenant). Separate plan.
- **Automatic periodic re-verification** (monthly DNS re-check in background). V1 is one-time; if a customer removes the TXT record, verification stays valid until explicitly removed by a root user or until V2 adds re-verification.

---

## Changelog

| Version | Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0.1.0   | 2026-04-16 | Initial draft — phases outlined, dependencies decided                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 0.1.1   | 2026-04-16 | Simplification: dropped `node-email-verifier`. Signup email validation is now synchronous list-lookup only (`company-email-validator` + `mailchecker`). Eliminates SMTP-blacklist risk (former R3) + DNS dependency on signup path. Added commercial-API evaluation to Known Limitations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 0.1.2   | 2026-04-16 | Dropped `company-email-validator` too. Reasons: `Unlicense` (unusual for B2B legal review), GitHub release from 2021, only silent npm-publishes for list bumps → half-maintained wrapper around a community list. Replaced with a **committed JSON** (`backend/src/nest/domains/data/freemail-domains.json`) sourced directly from [`Kikobeats/free-email-domains`](https://github.com/Kikobeats/free-email-domains) (MIT, HubSpot-based). Wrapper = `Set`-lookup + `mailchecker`. Monthly sync via `scripts/sync-freemail-list.ts`. Net effect: one runtime dep instead of two, MIT-clean, diffs reviewable in Git. Updated §0.1 / §0.2 R1 / §0.2.5 #5 + new #12 / §0.3 / §0.4 / Phase 0 DoD / §2.3 / §2.10 / Phase 2 DoD / Quick Reference / Known Limitations #6 + renumbered duplicate #8 / Phase 6 ADR deliverable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 0.2.0   | 2026-04-16 | **Validation-review integrated:** (1) Migration `uuid_generate_v7()` → `uuidv7()` — PG 18.3 native function, verified via `pg_proc` + migration `20260416135731342_uuidv7-defaults-cleanup.ts`. (2) Signup method name `signup()` → `registerTenant(dto, ipAddress?, userAgent?)` (actual signature at `signup.service.ts:75`). (3) §2.3 adds `validateBusinessDomain(domain: string)` helper — replaces the `root@<domain>` synthesize trick (Q7). (4) NEW endpoint `GET /api/v2/domains/verification-status` → `{ verified: boolean }` for banner + user-creation guards (Q8). (5) Phase 2 DoD: architectural test MANDATORY — every `INSERT INTO users` path must live in a service that `assertVerified()` gated (Q4). (6) §1.0 wipe: `TRUNCATE tenants RESTART IDENTITY CASCADE` inside transaction + mandatory `pg_dump` beforehand (Q11). (7) §5.2 removes `DOMAIN_NO_MX` from messagesByCode + DoD "3 codes" (was 4). (8) §0.1 prerequisites cleaned — Phase-0/2 tasks removed. (9) R7 probability Medium → Low (arch-test enforcement). (10) Known Limitation #10 added: single-root-mailbox-loss deadlock for unverified tenants (Q6, accepted, blast-radius = 1 tenant-slot). (11) ADR number fixed: **ADR-048**. (12) Sequencing clarified: ships FIRST, before Plan 1 (ADR-047).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 0.3.4   | 2026-04-17 | **Sixth-pass — test-coverage audit.** Staff-Engineer review found six gaps in the Phase 3/4/5 test plan: (1) **CRITICAL — no unit test locked `TenantVerificationService.isVerified()` to `db.queryAsTenant()`.** Exactly the v0.3.2 RLS-strict regression (`db.query` → 0 rows → permanent 403) could silently return; the existing Phase 3 test only checks the return value, not the method being called. Added spy-based assertion. (2) **CRITICAL — Phase 5 planned ZERO frontend tests** despite 9 new files: `state-data.svelte.ts`, `state-ui.svelte.ts`, `AddDomainModal.svelte`, `DomainRow.svelte`, `VerifyInstructionsPanel.svelte` + the cross-cutting `invalidateAll()` race between banner + user-create-button unlock (v0.3.0 S4). New Phase 5 Step 5.4 mandates one state-facade unit test + one Playwright happy-path E2E. (3) **CRITICAL — signup transaction atomicity only claimed in prose**, never asserted. Added Phase 3 test: mock `tenant_domains` INSERT → throw, assert zero orphan `tenants` rows. (4) **IMPORTANT — OAuth concurrent-race not explicitly covered.** v0.3.3 added the 23505-mapping unit test but no real concurrent integration test. Added Phase 4 scenario with two parallel OAuth callbacks on the same Microsoft domain. (5) **IMPORTANT — arch-test false-positive immunity.** The `/INSERT\s+INTO\s+users\b/gis` regex could match comments, test fixtures, migration strings, or the arch-test's own source. New Phase 0 Step 0.8 enumerates and Phase 3 asserts immunity. (6) **IMPORTANT — graceful degradation** on last-verified-domain-remove: existing users must stay functional, only new creates block. Added Phase 4 scenario. Nice-to-have additions: token persistence across repeated `/verify` calls (§0.2.5 #10 assertion), IDN/Punycode domain normalization, single audit-trail smoke, domain-verify-tier-specific rate-limit test (10 req / 10 min, v0.3.2 M3 was only covered by general-tier sanity test). Counters bumped: Phase 3 ≥ 30 → ≥ 35, Phase 4 ≥ 25 → ≥ 30. Spec Deviations D22–D27 added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 0.3.3   | 2026-04-17 | **Fifth-pass hardening — consequence of v0.3.2's UNIQUE-index promotion, caught in post-review:** §2.8b OAuth seeder did a bare `client.query` INSERT. With the partial UNIQUE INDEX now enforcing verified-domain uniqueness, a legitimate-but-unlucky Microsoft OAuth signup on a domain already claimed by another Assixx tenant would have surfaced as a raw Postgres `23505` → 500 Internal Server Error. Updated §2.8b to wrap the INSERT in a `try/catch` that maps `err.code === '23505'` to `ConflictException({ code: 'DOMAIN_ALREADY_CLAIMED' })`. The enclosing `systemTransaction` rolls back automatically, so no orphan tenant/user rows survive the conflict. Phase 3 + Phase 4 test mandates added (mock 23505 unit test + API test with pre-seeded conflict). Spec Deviation D21 added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 0.3.2   | 2026-04-17 | **Fourth-pass validation — bugs caught by ground-truth re-verification against `database.service.ts` + live DB RLS probe:** (1) **CRITICAL — §2.6 `TenantVerificationService.isVerified()` used `db.query()` which (per `database.service.ts:36` docstring "Does NOT set RLS context" and live probe: `app_user` without `app.tenant_id` set → 0 users returned) would have ALWAYS returned false under RLS-strict (ADR-019), deadlocking every user-creation path behind a permanent 403.** Fixed by switching to `db.queryAsTenant(sql, params, tenantId)` which injects the tenantId into `set_config('app.tenant_id', ...)` inside a transaction and works across contexts (HTTP + WebSocket + worker). (2) **MAJOR — §1.1 `idx_tenant_domains_domain_verified` was `CREATE INDEX` (non-unique)**; §2.5 claimed it "enforced" global uniqueness but the index only sped up lookups. A concurrent OAuth-seed-verified + password-add-then-verify race could produce two tenants owning the same verified domain. Promoted to `CREATE UNIQUE INDEX`; §2.5 rewritten so DB is the arbiter and the service catches 23505 for a clean `ConflictException('DOMAIN_ALREADY_CLAIMED')`. (3) **MEDIUM — §2.7 "`@Throttle()` default" was ambiguous** — `throttle.decorators.ts:12` has `AuthThrottle` / `UserThrottle` / `AdminThrottle` / `ExportThrottle` but no generic default; domains endpoints mix cheap reads with a DNS-triggering action. Specified per-endpoint: `UserThrottle` for reads/writes, NEW `domain-verify` tier at 10 req / 10 min for `/verify` to bound outbound DNS (R11). (4) **MINOR — §2.11 regex `INSERT INTO users\b`** only matched single-line SQL; extended to `/INSERT\s+INTO\s+users\b/gis` to survive multi-line reformatting. (5) **MINOR — §2.8 Step 5 + Phase 2 DoD stale "exactly TWO allowed bypasses"** contradicted v0.3.1 §2.11's "Phase 0 enumeration drives the final list"; both wording spots aligned to "Phase-0-enumerated, minimum two (password + OAuth bootstrap)." (6) Spec Deviations D16–D20 added. |
| 0.3.1   | 2026-04-17 | **Third-pass validation — verified against live `main` + current DB:** (1) **F1 — Signup frontend is NOT Form Actions:** `frontend/src/routes/signup/+page.svelte:128-192` uses `handleSubmit` → `registerUser(payload)` → `apiClient.post('/signup')` → `catch (err) → showErrorAlert(message)`. No `use:enhance`, no `+page.server.ts` for the root signup route. §5.2 rewritten around client-side fetch + inline error mapping inside `_lib/api.ts`. (2) **A1 — Arch-test allowlist too narrow:** independent `grep 'INSERT INTO users'` in `backend/src/nest/**` returns **7 hits across 6 files**: `users.service.ts:257`, `auth.service.ts:642`, `root.service.ts:241`, `root-admin.service.ts:156`, `dummy-users.service.ts:123`, `signup.service.ts:289` + `:529`. `auth.service.ts:631` is a private `createUser(data)` helper called at line 269 from what looks like an ADR-005-era authenticated register path. §2.11 allowlist framing loosened from "exactly TWO entries" to "Phase 0 enumeration drives the final list". (3) **T1 — Live tenant count:** DB currently has **5 tenants** (`apitest`, `testfirma`, `foreigninv`, `scs`, `oauth-happy-1776372986050`), not 3. OAuth testing added 2. §1.0 description updated — `TRUNCATE CASCADE` semantics unchanged. (4) **E1 — ESLint flat-config clarification:** the rule snippet in §2.10 is syntactically valid in both legacy `.eslintrc` and flat config; only the WRAPPER differs. Note added that the block must be placed inside an existing backend-scoped `files: [...]` group of `eslint.config.mjs`. (5) Spec Deviations D13–D15 added.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 0.3.0   | 2026-04-17 | **Second-pass validation integrated** (independent Ground-Truth verification against post-OAuth `main`): (1) **G1 — OAuth bootstrap:** `signup.service.ts:405` `registerTenantWithOAuth()` is a SECOND bootstrap path (OAuth ADR-046) that also does `INSERT INTO users` at line 529. Arch-test allowlist (§0.2.5 #14, §2.11) would fail CI. Fix: new §0.2.5 #17 — OAuth signup AUTO-VERIFIES the tenant domain (Azure AD controls the domain by definition), so `registerTenantWithOAuth` seeds `tenant_domains` with `status='verified'` directly — no allowlist entry needed, no weakening of the gate. §2.8 extended with OAuth-specific seeding step. (2) **G6 — validateBusinessDomain honesty:** §0.2.5 #15 + §2.3 claimed "no synthetic-email trickery" but impl uses `MailChecker.isValid('x@' + domain)` internally. Reworded to truthfully describe the wrapper encapsulation (mailchecker has no domain-only API — we synthesize internally, caller sees a clean domain-only signature). (3) **S1 — DNS timeout:** §2.4 `DomainVerificationService.verify()` had no timeout, R2's "3 s" was only in prose. Added `AbortController` + `Promise.race(..., timeout(3000))` to actually enforce the bound. (4) **G4 — `.test` TLD probe:** Phase 0 Step 0.4 adds a 30-second smoke that `mailchecker.isValid('x@firma-a.test')` does not reject reserved TLDs, otherwise seed scripts break. (5) **S4 — Layout invalidate:** §5.1 explicit `invalidateAll()` after verify-success so `data.tenantVerified` in `(app)/+layout.server.ts` refreshes (tab-A-verifies-then-tab-B-reload scenario). (6) **W3 — TRUNCATE RESTART IDENTITY semantics:** §1.0 notes that sequence-reset is sensitive to transaction rollback (sequences are non-transactional in PostgreSQL).                                                                                                                                                                                                                                                                          |
| 1.0.0   | YYYY-MM-DD | Phase 1 complete — migration applied, clean-slate done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 1.1.0   | YYYY-MM-DD | Phase 2 complete — backend done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 1.2.0   | YYYY-MM-DD | Phase 3 complete — unit tests green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 1.3.0   | YYYY-MM-DD | Phase 4 complete — API integration tests green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 1.4.0   | YYYY-MM-DD | Phase 5 complete — frontend done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2.0.0   | YYYY-MM-DD | Phase 6 complete — ADR written, shipped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must be true before starting

Clean separation of **pre-start invariants** vs **Phase tasks**. Everything that's work (dep install, JSON commit, script drafting, DNS verification) moved into the respective Phase section.

- [ ] Docker stack healthy (backend, postgres, redis, deletion-worker) — verify via `doppler run -- docker-compose ps` + `curl -s http://localhost:3000/health | jq`.
- [ ] Branch `feat/tenant-domain-verification` checked out from current `main`.
- [ ] OAuth-related changes (ADR-046) merged into `main` — Plan 2 touches `signup.service.ts` which OAuth work also modified.
- [ ] No pending migrations blocking: `docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT name FROM pgmigrations ORDER BY run_on DESC LIMIT 5;"` returns current head (including `20260416135731342_uuidv7-defaults-cleanup.ts` + `20260416140340498_create-user-oauth-accounts.ts`).
- [ ] Plan v0.3.0 reviewed + signed off.
- [ ] Phase 0 discovery complete and plan bumped to 0.3.1 (anchors inserted — including v0.3.0 additions: `registerTenantWithOAuth` line anchor, `.test` TLD probe result, `trustProxy` decision if touched).

### 0.2 Risk Register

| #   | Risk                                                                                                                                  | Impact | Probability | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                        | Verification                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| R1  | Committed `freemail-domains.json` (sourced Kikobeats/free-email-domains) goes stale; a new freemail provider slips through            | Low    | Medium      | **Proactive:** monthly `pnpm run sync:freemail` re-pulls upstream, prints diff, human reviews + commits. **Reactive:** single-file Edit + unit-test when a real leak is reported — and upstream PR back to Kikobeats. **No external lib to fork, we ARE the source of truth.**                                                                                                                                                    | Ops dashboard / support signal; Phase 3 unit test covers German-market providers (R8); sync-script dry-run in CI |
| R2  | DNS timeouts / failures at the verification-check step (not signup) → user cannot complete domain proof                               | Medium | Low         | Fail-closed with clear error `DOMAIN_DNS_UNAVAILABLE`, 3 s timeout, user can retry. Separate UI message from generic errors. **Note:** signup itself no longer does DNS, so this only hits the "verify now" button flow.                                                                                                                                                                                                          | Phase 3 unit test (`DomainVerificationService`) + Phase 5 UX review                                              |
| R4  | User sets TXT record with typo or wrong host → verification fails silently / confusingly                                              | Medium | Medium      | Clear "Verify" response: exact TXT hostname + expected value + what was actually found in DNS; copy-to-clipboard snippet in UI; `ENOTFOUND` → user-friendly "Die Domain `fima.de` scheint nicht zu existieren. Vertippt?"                                                                                                                                                                                                         | Phase 5 UX review; Phase 4 API test covers `verified_text_mismatch` + `ENOTFOUND` cases                          |
| R5  | Attacker or typo-user claims a domain they don't control → wasted DB row ("ghost tenant")                                             | Low    | Medium      | Tenant stays `UNVERIFIED` forever (TXT verification will never succeed). Cannot create users → zero blast radius. Accepted side effect: one wasted DB row per fake/typo attempt. V2 may add 30-day soft-delete of zero-verified tenants                                                                                                                                                                                           | Monitored via support signal; tenant auto-cleanup out of scope for V1                                            |
| R7  | `assertTenantVerified` accidentally missed on one user-creation endpoint → unverified tenant creates users                            | High   | Low         | **Arch-test MANDATORY (Q4, Phase 2 DoD)**: `shared/src/architectural.test.ts` adds a rule that fails CI if a production `INSERT INTO users` is not preceded by an `assertVerified()` call in the same method (or an explicit allowlist: only `signup.service.ts#registerTenant` is allowed without, as that call MAKES the first tenant). Phase 0 produces the full grep list; Phase 4 API test covers every endpoint end-to-end. | Phase 0 grep output; Phase 2 arch-test (CI); Phase 4 API tests                                                   |
| R8  | Committed freemail list does not cover German market comprehensively (web.de, gmx.de, t-online.de, freenet.de, posteo, mailbox.org …) | High   | Low         | Phase 0 Step 0.4 asserts German-market coverage manually against the downloaded JSON. Phase 3 unit test asserts blocking for: gmail.com, outlook.com, hotmail.com, yahoo.com, yahoo.de, web.de, gmx.de, gmx.net, t-online.de, freenet.de, mail.de, posteo.de, mailbox.org, aol.com, icloud.com, mail.ru, protonmail.com, proton.me, tutanota.com. Missing domains → add directly to JSON + upstream PR.                           | Phase 0 Step 0.4 + Phase 3 unit test                                                                             |
| R9  | Signup form blocks a legitimate solo-founder using a personal Gmail for their one-person company                                      | Low    | Low         | Accepted as a design constraint. Assixx target audience is 50–500 employees (per README) — all have a company domain. Documented as a Known Limitation                                                                                                                                                                                                                                                                            | Documented, not mitigated                                                                                        |
| R10 | Existing test tenants get deleted in Phase 1 clean-slate → developer workflows break                                                  | Medium | High        | Phase 1 is explicit, backup is mandatory, test-tenant seed script is regenerated + documented before Phase 1 runs                                                                                                                                                                                                                                                                                                                 | Phase 1 step 1.0 seed script validated                                                                           |
| R11 | Outbound DNS blocked in production Docker network (only affects "Verify now" button, not signup)                                      | Medium | Low         | Phase 0 explicit check: `docker exec assixx-backend node -e "require('dns').promises.resolveTxt('google.com').then(console.log)"`. If blocked: infra fix required before Phase 2 ships                                                                                                                                                                                                                                            | Phase 0 step 0.6                                                                                                 |

### 0.2.5 Explicit Design Decisions

1. **KISS gate — single helper, not a global guard.**
   No `TenantVerificationGuard` decorator, no endpoint whitelist. Instead: a single method `assertTenantVerified(tenantId: number): Promise<void>` is called at the entry of each user-creation service method. Throws `ForbiddenException('TENANT_NOT_VERIFIED')` if not verified.

2. **Root user-creation is ALSO gated.**
   After signup, the root cannot add a second root user until the first domain is verified. (Admin + employee + additional-root creation are equally blocked.)

3. **Signup-email domain must equal the claimed company domain.**
   When the signup form collects `{ email, companyName, … }`, the domain part of the email (`email.split('@')[1]`) is automatically seeded as the first `tenant_domains` row with `status = 'pending'`. No separate "company domain" field — it's implicit. Rationale: prevents the split-claim attack (`attacker@gmail.com` claiming `opfer.de`); the root's own email is the claim.

4. **Freemail check happens at signup AND at any later "add domain" action.**
   A tenant that is already verified cannot add `gmail.com` as a second domain. Freemail is a hard constraint at all entry points, not just signup.

5. **Disposable check layered separately.**
   `mailchecker`'s disposable list and our committed freemail-list are independent — both must pass. Disposable ≠ freemail: `burner.email` is disposable-not-freemail; `gmail.com` is freemail-not-disposable.

6. **No MX / SMTP check at signup — only list-based validation.**
   Signup email validation is synchronous, offline, ~1 ms: format + disposable (`mailchecker`) + freemail (`Set`-lookup on committed JSON). The DNS heavy lifting happens later at the TXT-verify step, which is the actual proof-of-ownership — MX at signup is a redundant weaker check. This eliminates DNS dependency on the hot path, removes SMTP-blacklist risk entirely (no probing library installed), and halves signup latency. Trade-off accepted: a user with a typo in their domain (e.g., `fima.de`) creates a ghost tenant that will fail at verification — documented in R5, cleaned up by V2 soft-delete.

7. **One-time verification in V1.**
   Once `verified_at` is set, we do not periodically re-check DNS. If a customer accidentally deletes the TXT record, verification stays valid. Rationale: simpler, fewer false downgrades, no scheduled background job in V1. Tradeoff: a maliciously-expired domain (e.g., customer lost ownership) keeps its tenant alive until manually cleaned up. Accepted for V1.

8. **Root-only CRUD on domains.**
   `/settings/company-profile/domains` is Root-only (`@Roles('root')` + route group `(root)` on frontend). Admins and employees have zero visibility or action on domains.

9. **TXT record pattern: subdomain, not root.**
   `_assixx-verify.{domain} TXT "assixx-verify={32-byte-hex-token}"`. Follows AWS SES / Resend idiom. No collision with existing SPF / DMARC / DKIM records at the root domain.

10. **Verification token is persistent.**
    The token is generated at "add domain" time and stored in `tenant_domains.verification_token`. It does not expire in V1. User can re-trigger DNS-check any number of times; when the TXT record appears matching the stored token, status flips to `verified`. No 24 h grace / regen rigamarole.

11. **Clean-slate migration (user-confirmed).**
    Phase 1 deletes all existing tenants. No grandfathering. A fresh test-tenant seed script is regenerated after migration.

12. **Freemail list is a committed JSON, not a runtime dependency.**
    `company-email-validator` was evaluated and rejected for three reasons: (a) `Unlicense` — unusual for B2B legal review compared to MIT; (b) last GitHub release in 2021, npm-publishes since then are silent list-bumps without tags — effectively an unreviewed community mirror; (c) wrapper adds a supply-chain surface for a value that's just a JSON array.
    Decision: pull `Kikobeats/free-email-domains/domains.json` (MIT, HubSpot-based) once, commit to `backend/src/nest/domains/data/freemail-domains.json`, do a `Set`-lookup in the wrapper. Benefits: single source of truth, diffs visible in Git, MIT-clean, zero runtime supply-chain surface (only `mailchecker` remains — MIT, 0 deps). Trade-off: we own the sync cadence — accepted (monthly, scripted; see R1 + ADR in Phase 6).

13. **UUID function: `uuidv7()` (native PG 18.3), NOT `uuid_generate_v7()`.**
    v0.1.2 incorrectly referenced `uuid_generate_v7()`. PostgreSQL 18.3 ships `uuidv7()` natively (no extension). Verified via `SELECT proname FROM pg_proc WHERE proname LIKE '%uuid%v7%'` → only `uuidv7` exists (twice — one text, one overload). Migration `20260416135731342_uuidv7-defaults-cleanup.ts` standardized the codebase on `uuidv7()`. All CREATE TABLE statements in §1.1 use `DEFAULT uuidv7()`.

14. **Arch-test enforcement for R7 (Q4).**
    `shared/src/architectural.test.ts` adds a rule:
    - Scan every file under `backend/src/nest/**/*.service.ts` for the regex `INSERT INTO users\b` (case-insensitive).
    - For each match, the enclosing method body MUST contain `assertVerified(` OR the file must be on an explicit allowlist.
    - **Allowlist (v0.3.1 A1 correction — Phase 0 enumeration drives the final content, not "exactly N"):** at minimum the two signup bootstraps (`signup.service.ts#registerTenant`, `signup.service.ts#registerTenantWithOAuth`) — both create the first-ever user BEFORE any `tenant_domains` row could exist. A **third** private helper exists at `auth.service.ts:631` (`AuthService.createUser`, called from `auth.service.ts:269`); Phase 0 decides whether to (a) inject `TenantVerificationService` into `AuthService` and call `assertVerified(data.tenantId)` inside the helper (recommended — cheapest, no allowlist growth), (b) gate at the controller-level entry point, or (c) allowlist IF and only if it turns out to also be a bootstrap path. See §2.11 for the full `INSERT INTO users` landscape (7 hits / 6 files as of 2026-04-17 grep). Any future bootstrap path must be reviewed + added to the allowlist in the SAME PR that introduces it.
    - Test fails with a direct file-path pointer so the drift is immediately visible in CI output.

15. **Dedicated `validateBusinessDomain(domain: string)` helper (Q7).**
    The email-validator module exports a parallel function for the add-domain flow so callers pass a bare domain instead of synthesizing `root@<domain>` themselves. Shares the same `FREEMAIL_DOMAINS` Set + strict RFC-1035 label regex. **Honest framing (v0.3.0 G6 correction):** `mailchecker` has no domain-only public API, so the disposable check is still performed via an internal `MailChecker.isValid('x@' + domain)` call — that synthesis is encapsulated inside the wrapper and never surfaces to the caller. Benefit over the previous "caller synthesizes" approach: the synthesis is a single implementation detail under test, not repeated in every call site. Benefit is API-surface hygiene, NOT elimination of synthesis.

16. **`GET /api/v2/domains/verification-status` is a dedicated endpoint (Q8).**
    Frontend banner + user-creation-form guards read `tenantVerified: boolean` from this endpoint. `@Roles('root', 'admin')` — employees don't manage users and don't need the flag. Cached at SvelteKit `+layout.server.ts` load boundary; re-fetched on every navigation. Chosen over piggybacking on `/auth/me` or `/addons` because it's a semantically distinct concern and stays independently cacheable/rate-limitable.

17. **OAuth signup auto-verifies the tenant domain (v0.3.0, G1 fix).**
    `signup.service.ts:405` `registerTenantWithOAuth()` is the OAuth-sign-up bootstrap path introduced by ADR-046 (Microsoft OAuth). The email coming from the Microsoft identity provider is by definition controlled by the Azure AD tenant — the customer's IT admin is the one configuring the Azure AD app registration and the allowed domain. Claiming that domain via a DNS TXT challenge AFTER Microsoft has already asserted ownership would be theatre.
    **Decision:** In `registerTenantWithOAuth`, immediately after the root-user `INSERT INTO users`, seed `tenant_domains` with:
    ```
    status            = 'verified'
    verified_at       = NOW()
    is_primary        = true
    verification_token = crypto.randomBytes(32).toString('hex')   -- never redeemed, kept for audit
    ```
    The `verification_token` is still generated (for column-NOT-NULL and audit-trail integrity) but never checked — the `status = 'verified'` row is what unlocks user creation. Consequence: OAuth-onboarded tenants are fully functional immediately, password-onboarded tenants go through the DNS-TXT dance. Both paths converge on the same `assertVerified()` gate — the only difference is how the first `tenant_domains(verified)` row gets written.
    **Arch-test interaction:** `registerTenantWithOAuth` does not call `assertVerified()` and does not need to — it's the method that CREATES the first verified row. Allowlist entry (see #14) is the explicit sanction.
    **Threat-model note:** An attacker cannot abuse this path because OAuth callback already validated Microsoft's signature on the identity token; Microsoft only issues tokens for domains the tenant controls. The trust boundary is Azure AD, not Assixx DNS.

### 0.3 Ecosystem Integration Points

| Existing system                                                 | Integration                                                                                                                                                                                                                                                                                                                                                             | Phase |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `tenants` table                                                 | Status derived from `tenant_domains`; may add computed view or `verification_status` column (Phase 1 decides)                                                                                                                                                                                                                                                           | 1     |
| Signup flow (`backend/src/nest/signup/signup.service.ts`)       | Add synchronous email validation (format + disposable via `mailchecker` + freemail via `Set`-lookup on committed `freemail-domains.json`) before tenant creation in `registerTenant`; seed `tenant_domains(pending)` row for signup-email domain. No DNS/MX at signup.                                                                                                  | 2     |
| OAuth signup (`registerTenantWithOAuth` at line 405, v0.3.0 G1) | Skip freemail/disposable checks (Azure AD is the trust boundary); seed `tenant_domains(verified, is_primary=true, verified_at=NOW())` directly — no DNS dance. Allowlisted in the §2.11 arch-test.                                                                                                                                                                      | 2     |
| User-creation services (Phase 0 enumerates)                     | `assertTenantVerified()` called at the entry of each                                                                                                                                                                                                                                                                                                                    | 2     |
| `audit_trail` auto-interceptor                                  | Captures domain CRUD + verification attempts automatically                                                                                                                                                                                                                                                                                                              | 2     |
| ADR-010 (roles)                                                 | Root-only for domain CRUD — uses `@Roles('root')`                                                                                                                                                                                                                                                                                                                       | 2     |
| ADR-019 (RLS)                                                   | `tenant_domains` inherits the standard tenant_isolation RLS policy                                                                                                                                                                                                                                                                                                      | 1     |
| ADR-045 (permission stack)                                      | Domain CRUD is a Layer-0 concern (system setup), Layer-1 `canManage` does not apply — root-only check suffices                                                                                                                                                                                                                                                          | 2     |
| Frontend `(root)` layout                                        | New page `/settings/company-profile/domains` lives under the root-group layout (auto-gated by ADR-012)                                                                                                                                                                                                                                                                  | 5     |
| Frontend signup form                                            | New validation error messages per failure code. **v0.3.1 F1 correction:** current signup is CLIENT-SIDE (`_lib/api.ts` + `apiClient.post`), NOT Form Actions. Integration lives in `_lib/api.ts` catch-block (mapping code → German message) + `_lib/constants.ts` (`EMAIL_VALIDATION_MESSAGES`). Toast via existing `showErrorAlert`. No `+page.server.ts` introduced. | 5     |
| Existing test-tenant seed script                                | Regenerated post-migration so developer workflow is not broken                                                                                                                                                                                                                                                                                                          | 1     |

---

## Phase 0: Current-State Analysis (Session 1, read-only)

> **No code changes.** Output: concrete anchors + dependency compatibility confirmation; version bumps 0.1.0 → 0.2.0.

### Step 0.1 — Signup flow discovery [STATUS]

Locate and read:

- `backend/src/nest/signup/signup.service.ts` — Document the real method: `registerTenant(dto: SignupDto, ipAddress?: string, userAgent?: string): Promise<SignupResponseData>` at line 75 (v0.2.0-verified). Capture the sequence of operations (tenant-create → root-user-create → addon-setup → …) and the exact point inside the transaction where `tenant_id` is known so the `tenant_domains` seed can be inserted atomically in the same `client` transaction.
- `backend/src/nest/signup/signup.controller.ts` — endpoint path + DTO shape (expected email field + any company-name field).
- `backend/src/nest/signup/dto/*` — current signup DTO to extend with validation.

### Step 0.2 — User-creation endpoint enumeration [STATUS]

Grep across `backend/src/nest/**/*.controller.ts` for every route that **creates a user**. Expected candidates (Phase 0 produces the definitive list):

- `POST /api/v2/users` (admin/employee creation by root/admin)
- `POST /api/v2/employees` (if it exists)
- `POST /api/v2/admins` (if it exists)
- Invite endpoints (`POST /api/v2/invites` or similar)
- Root-promote endpoints (if they exist — adding a second root)
- Any signup-continuation endpoint that provisions users post-onboarding

Deliverable: a bulleted list of `{ path, controller file, service method }` tuples, recorded in this plan for Phase 2 integration.

### Step 0.3 — `tenants` table schema review [STATUS]

Query DB schema:

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d tenants"
```

Decide:

- Add a `verification_status` column to `tenants` (simpler reads, needs maintenance), **OR**
- Keep derived (`SELECT 1 FROM tenant_domains WHERE tenant_id = $1 AND status = 'verified' LIMIT 1`) — no denormalization, one extra read per check. Cached inside `assertTenantVerified()`.
- **Default recommendation: derived.** Avoids drift between the two sources of truth. Measure latency in Phase 6; switch to denormalized column only if needed.

### Step 0.4 — Dependency + committed-list check [STATUS]

- [ ] `pnpm info mailchecker` — confirm ≥ v6.0.20, MIT, 0 deps, published < 2 months ago.
- [ ] Verify no transitive `typescript` peer conflict with our TypeScript 6.0.2 (ADR-041 Phase 3).
- [ ] Download `Kikobeats/free-email-domains/domains.json` → `backend/src/nest/domains/data/freemail-domains.json` (MIT-license header preserved in a `LICENSE.freemail-domains.md` next to the JSON).
- [ ] **German-market coverage check** — the committed JSON MUST contain all of:
      `gmail.com`, `googlemail.com`, `outlook.com`, `outlook.de`, `hotmail.com`, `hotmail.de`, `live.com`, `live.de`, `msn.com`,
      `yahoo.com`, `yahoo.de`, `yahoo.co.uk`,
      `gmx.de`, `gmx.net`, `gmx.com`, `web.de`, `t-online.de`, `freenet.de`, `mail.de`, `posteo.de`, `posteo.net`, `mailbox.org`,
      `tutanota.com`, `tutanota.de`, `proton.me`, `protonmail.com`, `pm.me`,
      `aol.com`, `icloud.com`, `me.com`, `mac.com`, `mail.ru`, `yandex.com`, `yandex.ru`.
      Missing → add directly to the JSON + open upstream PR to `Kikobeats/free-email-domains`. Document in Spec Deviations.
- [ ] Draft `scripts/sync-freemail-list.ts` — `fetch` upstream, write to a temp file, `diff` against committed, print added/removed domains, exit 0 (never auto-commit). Invoked manually via `pnpm run sync:freemail`.
- [ ] **`.test` TLD probe (v0.3.0 G4):** run a 30-second smoke in the backend container to confirm `mailchecker.isValid('x@firma-a.test')` does NOT reject the RFC-2606 reserved TLD. If it does → seed script (`firma-a.test`, `firma-b.test`) breaks on first run; decide between (a) bypass validator in seed (set `status='verified'` directly, no validator call), (b) use a different fake TLD like `firma.example`. Record chosen workaround in Phase 1 Step 1.3.
  ```bash
  docker exec assixx-backend node -e \
    "const m = require('mailchecker'); console.log('firma-a.test:', m.isValid('x@firma-a.test'))"
  ```
- [ ] **OAuth bootstrap discovery (v0.3.0 G1):** confirm `registerTenantWithOAuth` is still present at `signup.service.ts:405` (ADR-046 merged `5cd293ae8` on `main`). Record signature + exact line so the arch-test allowlist in §2.11 and the §2.8b seeding step match current code.

### Step 0.5 — Frontend signup route discovery [STATUS]

Locate:

- `frontend/src/routes/signup/+page.svelte` (or similar — may be under `/auth/signup/` or `/register/`).
- `frontend/src/routes/signup/+page.server.ts` (form action pattern — same as forgot-password per KIS code-of-conduct).
- Design-system form-error component usage elsewhere to mirror (inline field error message).

### Step 0.6 — DNS capability check [STATUS]

Must confirm outbound DNS works from the backend container:

```bash
docker exec assixx-backend node -e \
  "require('dns').promises.resolveTxt('google.com').then(r=>console.log('OK',r.length)).catch(e=>console.error('FAIL',e.message))"
```

- Expected: `OK <number>`
- If FAIL: Docker network or firewall blocks outbound DNS → Phase 2 cannot ship. Infrastructure fix needed before plan proceeds.

### Step 0.7 — Test-tenant seed review [STATUS]

- [ ] Locate existing test-tenant creation (probably `database/seeds/` or a dedicated script).
- [ ] Document which tenants and test users exist today.
- [ ] Draft a new seed script that creates pre-verified test tenants (so developers can log in without going through the DNS dance). Seed inserts into `tenant_domains` with `status = 'verified'`, `verified_at = NOW()`, fake but well-formed `verification_token`.
- [ ] Confirm clean-slate wipe is acceptable with user (already done: user confirmed test data only).

### Step 0.8 — Arch-test false-positive enumeration (v0.3.4 D23) [STATUS]

**Goal:** Before the `/INSERT\s+INTO\s+users\b/gis` arch-test (§2.11) goes live, enumerate every existing textual match in the scanned scope so we know whether the first post-merge PR turns CI red for non-production reasons.

- [ ] Run the exact regex the arch-test will use over the exact scope (`backend/src/nest/**/*.service.ts`), case-insensitive, multiline. Record every hit: file, line, context.
- [ ] Categorize each hit:
      (a) **Real user-creation** — must be either gated by `assertVerified()` or explicitly allowlisted.
      (b) **Inline SQL comment** (`-- INSERT INTO users …` inside a larger `pgm.sql()` or `db.query()` string) — potential false positive.
      (c) **Documentation inside the service file** (JSDoc, block comment containing example SQL) — false positive.
      (d) **The arch-test's own source file** — it contains the regex as a literal string; if the scanned scope ever widens to include it, self-match.
- [ ] For each (b)/(c)/(d) hit, decide: (i) ignore the file via a scoped allowlist pattern in the arch-test, (ii) rewrite the comment to not contain the literal `INSERT INTO users`, or (iii) tighten the regex to require it NOT sit inside a JS comment (requires a comment-stripping pre-pass).
- [ ] Output a final table: file + line + category + resolution; paste into §2.11 as the baseline.
- [ ] Smoke-run: after the arch-test is in place, a fresh `pnpm exec vitest run --project unit shared/src/architectural.test.ts` MUST be green on `main` with zero violations and zero allowlist-escape warnings. Any surprise hit blocks the Phase 2 merge.

### Phase 0 — Definition of Done

- [ ] Signup flow anchored (file + line refs for `signup()` and DTO).
- [ ] User-creation endpoint list finalized and filed in plan.
- [ ] Decision on `tenants.verification_status` column vs. derived read.
- [ ] `mailchecker` confirmed latest + MIT + no dep conflict.
- [ ] `freemail-domains.json` committed + German-market coverage verified + `sync-freemail-list.ts` drafted.
- [ ] Signup frontend route anchored.
- [ ] Outbound DNS from backend container confirmed working.
- [ ] Test-tenant seed strategy finalized (+ pre-verified status).
- [ ] Arch-test false-positive enumeration complete (Step 0.8) — zero unresolved hits before Phase 2.
- [ ] Plan version bumped: 0.1.0 → 0.2.0.

---

## Phase 1: Database Migration (Session 2)

> **Dependency:** Phase 0 complete. Mandatory backup before running.
> **Disciplines:** `DATABASE-MIGRATION-GUIDE.md` hard rules — generator-only, backup, dry-run, no manual file creation.

### Step 1.0 — Backup + clean-slate data wipe [STATUS]

> **Decision (Q11):** TRUNCATE with `RESTART IDENTITY CASCADE` (not DELETE). Resets sequence IDs to 1 for clean fixture data. Wrapped in transaction for atomicity. Backup is MANDATORY — user confirmed test-data-only, but the dump gives a single-command revert if anything Phase 1 does fails silently.

- [ ] **Backup first** (mandatory — recorded in Phase 1 DoD):

  ```bash
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
      --format=custom --compress=9 \
      > database/backups/pre-domain-verification-${TIMESTAMP}.dump
  ls -lh database/backups/pre-domain-verification-*.dump   # confirm size > 0
  ```

- [ ] **Wipe** — TRUNCATE inside a transaction so a partial failure rolls back:

  ```sql
  BEGIN;
  TRUNCATE TABLE tenants RESTART IDENTITY CASCADE;
  -- RESTART IDENTITY: tenant.id sequence resets to 1 (clean fixture IDs)
  -- CASCADE: follows FK ON DELETE CASCADE chains → users, areas, departments, teams,
  --          user_oauth_accounts (ADR-046), addon_* etc.
  -- Transaction: if any downstream trigger or FK without CASCADE fires, rollback is atomic
  --              for ROW DATA. CAVEAT (v0.3.0 W3): PostgreSQL sequences are NOT
  --              transactional — a `RESTART IDENTITY` that reaches the executor runs
  --              immediately and is NOT undone by a later ROLLBACK. If the transaction
  --              aborts AFTER the TRUNCATE line, the sequences stay reset to 1 even though
  --              the data is rolled back. For a clean-slate wipe this is benign (we
  --              WANT the sequences at 1 regardless), but documented so nobody is
  --              surprised on a partial failure.
  COMMIT;
  ```

- [ ] **Verify:** `SELECT COUNT(*) FROM tenants;` = 0; `SELECT COUNT(*) FROM users;` = 0; `SELECT last_value FROM tenants_id_seq;` = 1.
- [ ] User-confirmed clean-slate (DB contains test data only — **5 test tenants pre-wipe as of 2026-04-17 verification**: `apitest`, `testfirma`, `foreigninv`, `scs`, `oauth-happy-1776372986050`; OAuth-testing added the last two after v0.2.0 was drafted — v0.3.1 T1 correction). `TRUNCATE tenants RESTART IDENTITY CASCADE` wipes all regardless of count. Separate from the migration step below to keep the migration itself idempotent. Re-verify tenant count the day Phase 1 runs: `docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT id, subdomain FROM tenants ORDER BY id;"` — list will evolve as further OAuth / feature tests run.

### Step 1.1 — Create `tenant_domains` table + ENUM [STATUS]

**Generate via:**

```bash
doppler run -- pnpm run db:migrate:create create-tenant-domains
```

**Migration content (generator stub → filled via Edit, never Write):**

```typescript
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ENUM for domain status.
    CREATE TYPE tenant_domain_status AS ENUM ('pending', 'verified', 'failed', 'expired');

    CREATE TABLE tenant_domains (
      id UUID PRIMARY KEY DEFAULT uuidv7(), -- PG 18.3 native; see §0.2.5 #13
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      domain VARCHAR(253) NOT NULL,
      status tenant_domain_status NOT NULL DEFAULT 'pending',
      verification_token VARCHAR(64) NOT NULL,
      verified_at TIMESTAMPTZ NULL,
      is_primary BOOLEAN NOT NULL DEFAULT false,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT tenant_domains_tenant_domain_unique UNIQUE (tenant_id, domain)
    );

    -- Only one primary domain per tenant (partial unique index).
    CREATE UNIQUE INDEX tenant_domains_one_primary_per_tenant
      ON tenant_domains (tenant_id)
      WHERE is_primary = true AND is_active = 1;

    -- Standard tenant-lookup index.
    CREATE INDEX idx_tenant_domains_tenant
      ON tenant_domains (tenant_id)
      WHERE is_active = 1;

    -- Global uniqueness on verified domains — DB-enforced (a verified domain belongs to
    -- exactly ONE tenant). Partial UNIQUE INDEX: only active verified rows count; pending /
    -- failed / expired / soft-deleted rows are intentionally excluded from the uniqueness
    -- constraint so (a) two tenants can concurrently add the same domain as `pending` and
    -- only the one who proves DNS ownership flips to `verified`, and (b) soft-deleted
    -- (is_active = 4) rows don't block re-adding. See §2.5 for the ConflictException mapping.
    CREATE UNIQUE INDEX idx_tenant_domains_domain_verified
      ON tenant_domains (domain)
      WHERE status = 'verified' AND is_active = 1;

    -- RLS — standard Assixx strict policy (ADR-019).
    ALTER TABLE tenant_domains ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tenant_domains FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON tenant_domains
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- Triple-user-model GRANTs.
    GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_domains TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_domains TO sys_user;
    -- UUID PK → no sequence grant needed.
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS tenant_domains CASCADE;
    DROP TYPE IF EXISTS tenant_domain_status;
  `);
}
```

### Step 1.2 — Verify post-migration [STATUS]

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d tenant_domains"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT * FROM pg_policies WHERE tablename = 'tenant_domains';"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT unnest(enum_range(NULL::tenant_domain_status));"
```

### Step 1.3 — Regenerate test-tenant seed [STATUS]

- [ ] Seed creates at least 2 pre-verified test tenants (`firma-a.test`, `firma-b.test`) each with one pre-verified `tenant_domains` row.
- [ ] Seed creates test-root users (`test@scs-technik.de` pattern preserved — used by existing dev workflows).
- [ ] Document where the seed is triggered (Docker entrypoint / `pnpm run db:seed` / manual).

### Step 1.4 — Sync customer fresh-install [STATUS]

```bash
./scripts/sync-customer-migrations.sh
```

### Phase 1 — Definition of Done

- [ ] Backup created + filename recorded
- [ ] All existing tenants deleted (`SELECT COUNT(*) FROM tenants` = 0)
- [ ] Migration generated via `db:migrate:create` (never manually)
- [ ] Dry-run passes
- [ ] Migration applied
- [ ] Verification queries pass
- [ ] RLS policy verified
- [ ] Triple-user GRANTs verified
- [ ] Test-tenant seed regenerated + runnable
- [ ] Customer fresh-install synced
- [ ] Backend + deletion-worker restarted

---

## Phase 2: Backend (Sessions 3 + 4)

> **Dependency:** Phase 1 complete.
> **Reference modules:** `backend/src/nest/halls/` or `backend/src/nest/teams/` (simple CRUD pattern).

### Step 2.1 — Module skeleton [STATUS]

**New directory:** `backend/src/nest/domains/`

```
backend/src/nest/domains/
  domains.module.ts
  domains.controller.ts
  domains.service.ts
  domain-verification.service.ts
  tenant-verification.service.ts
  email-validator.ts                   # central wrapper: committed-list Set + mailchecker
  data/
    freemail-domains.json              # committed Kikobeats/free-email-domains (MIT)
    LICENSE.freemail-domains.md        # MIT attribution
  domains.types.ts
  dto/
    add-domain.dto.ts
    verify-domain.dto.ts
    index.ts
```

**Register in `app.module.ts`** (alphabetical order):

```typescript
imports: [
  // …
  DomainsModule,
  // …
],
```

### Step 2.2 — `domains.types.ts` [STATUS]

```typescript
export type TenantDomainStatus = 'pending' | 'verified' | 'failed' | 'expired';

export interface TenantDomainRow {
  id: string; // uuidv7
  tenant_id: number;
  domain: string;
  status: TenantDomainStatus;
  verification_token: string;
  verified_at: Date | null;
  is_primary: boolean;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

export interface TenantDomain {
  id: string;
  tenantId: number;
  domain: string;
  status: TenantDomainStatus;
  isPrimary: boolean;
  verifiedAt: string | null; // ISO
  createdAt: string;
  updatedAt: string;
  /** only surfaced to root during "add" response to show TXT instructions */
  verificationInstructions?: {
    txtHost: string; // "_assixx-verify.firma.de"
    txtValue: string; // "assixx-verify=<token>"
  };
}
```

### Step 2.3 — Central email-validator wrapper [STATUS]

**File:** `backend/src/nest/domains/email-validator.ts`
**Data:** `backend/src/nest/domains/data/freemail-domains.json` (committed; sourced from Kikobeats/free-email-domains — see §0.2.5 #12)

Fully synchronous, offline, list-based. ~1 ms per call. No network, no DNS, no SMTP — deliberately. The DNS heavy-lifting happens only at the TXT-verify step in `DomainVerificationService`. See §0.2.5 #6 for rationale.

```typescript
import MailChecker from 'mailchecker';

// WHY: Committed upstream-pinned freemail list (Kikobeats/free-email-domains,
// HubSpot-based) — see ADR-XX + §0.2.5 #12. No npm wrapper, diffs reviewable
// in Git, MIT-clean, sync via scripts/sync-freemail-list.ts (monthly).
import freemailRaw from './data/freemail-domains.json' with { type: 'json' };

export type EmailValidationFailure = 'INVALID_FORMAT' | 'DISPOSABLE_EMAIL' | 'FREE_EMAIL_PROVIDER';

export interface EmailValidationResult {
  readonly valid: boolean;
  readonly failure?: EmailValidationFailure;
}

// Frozen Set — O(1) lookup, no runtime mutation (static build-time data).
const FREEMAIL_DOMAINS: ReadonlySet<string> = new Set((freemailRaw as readonly string[]).map((d) => d.toLowerCase()));

/**
 * Strict business-email validation for signup + add-domain flows.
 *
 * Three layers, evaluated in order:
 *   1. Basic format gate: must contain exactly one '@' with non-empty local + domain parts.
 *   2. `mailchecker` — blocks disposable / burner providers (incl. custom-domain burners
 *      like burner.email, mail-temp.io that aren't on freemail lists).
 *   3. Committed freemail Set-lookup — blocks free/personal email providers (Gmail, Outlook,
 *      GMX, Web.de, T-Online, Freenet, Yahoo, iCloud, AOL, Mail.ru, Proton, Tutanota,
 *      ~6000 more based on Kikobeats/free-email-domains).
 *
 * No MX / SMTP / DNS at signup time — DNS TXT verification later is the actual
 * proof-of-ownership and a stronger check. MX at signup adds latency + fail-risk
 * for no real security gain (see §0.2.5 #6).
 */
export function validateBusinessEmail(email: string): EmailValidationResult {
  // Layer 1 — basic shape (no regex-theater, just the essentials).
  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@') || at === email.length - 1) {
    return { valid: false, failure: 'INVALID_FORMAT' };
  }

  // Layer 2 — disposable / burner providers (covers list entries with custom-looking
  // domain names that wouldn't appear in the freemail list).
  if (!MailChecker.isValid(email)) {
    return { valid: false, failure: 'DISPOSABLE_EMAIL' };
  }

  // Layer 3 — freemail providers (Gmail, Outlook, GMX, Web.de, T-Online, …).
  const domain = email.slice(at + 1).toLowerCase();
  if (FREEMAIL_DOMAINS.has(domain)) {
    return { valid: false, failure: 'FREE_EMAIL_PROVIDER' };
  }

  return { valid: true };
}

export function extractDomain(email: string): string {
  const parts = email.toLowerCase().split('@');
  if (parts.length !== 2 || parts[1] === undefined || parts[1] === '') {
    throw new Error('Cannot extract domain from malformed email');
  }
  return parts[1];
}

/**
 * Exposed for the add-domain flow: given a bare domain (not an email),
 * reject if it's a known freemail provider. A verified tenant cannot add
 * `gmail.com` as a second domain (§0.2.5 #4).
 */
export function isFreemailDomain(domain: string): boolean {
  return FREEMAIL_DOMAINS.has(domain.toLowerCase());
}

/**
 * Business-domain validator for the add-domain flow (§0.2.5 #15, Q7, v0.3.0 G6).
 *
 * Wraps the same primitives as `validateBusinessEmail()` behind a bare-domain
 * signature. The caller passes a domain, not an email — that is the only
 * API-surface benefit over reusing `validateBusinessEmail()` directly.
 *
 * Implementation detail (hidden from callers): `mailchecker` has no domain-only
 * public API, so the disposable check is performed via `MailChecker.isValid(
 * 'x@' + domain)`. The `x@` synthesis is encapsulated here under a single
 * point of test — not repeated in every call site.
 *
 * Returns the same failure-shape as `validateBusinessEmail` so controllers can
 * map both paths through a single error-code table.
 *
 *   - `INVALID_FORMAT` for malformed domains (empty, multiple dots only, leading `.`, …).
 *     Uses a strict RFC-1035 label regex.
 *   - `DISPOSABLE_EMAIL` if `mailchecker.isValid('x@' + domain)` rejects it.
 *   - `FREE_EMAIL_PROVIDER` if the domain is on the committed freemail Set.
 */
export function validateBusinessDomain(domain: string): EmailValidationResult {
  const normalized = domain.trim().toLowerCase();

  // RFC-1035-ish label validation: 1+ labels, each 1-63 chars, LDH only, no leading/trailing hyphen.
  const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  if (normalized === '' || normalized.length > 253) {
    return { valid: false, failure: 'INVALID_FORMAT' };
  }
  const labels = normalized.split('.');
  if (labels.length < 2 || !labels.every((label) => LABEL.test(label))) {
    return { valid: false, failure: 'INVALID_FORMAT' };
  }

  // Disposable / burner check — probe via a throwaway local-part (mailchecker is email-only).
  if (!MailChecker.isValid(`x@${normalized}`)) {
    return { valid: false, failure: 'DISPOSABLE_EMAIL' };
  }

  // Freemail check — same Set as the email validator.
  if (FREEMAIL_DOMAINS.has(normalized)) {
    return { valid: false, failure: 'FREE_EMAIL_PROVIDER' };
  }

  return { valid: true };
}
```

**Sync script signature** (`scripts/sync-freemail-list.ts`):

```typescript
// Pulls Kikobeats/free-email-domains/domains.json upstream, diffs against the
// committed version, prints added / removed domains. NEVER auto-commits.
// Run monthly: `pnpm run sync:freemail`. ADR-XX documents the rationale.
const UPSTREAM = 'https://raw.githubusercontent.com/Kikobeats/free-email-domains/master/domains.json';
```

**Consumer-facing German error messages** (Phase 5 maps the failure codes to these):

| `EmailValidationFailure` | German UI message                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| `INVALID_FORMAT`         | Bitte gib eine gültige E-Mail-Adresse ein.                                                                |
| `DISPOSABLE_EMAIL`       | Wegwerf-E-Mail-Adressen sind nicht erlaubt. Bitte nutze Deine Firmen-E-Mail-Adresse.                      |
| `FREE_EMAIL_PROVIDER`    | Bitte nutze Deine Firmen-E-Mail-Adresse mit eigener Domain. Gmail, Outlook, GMX & Co. sind nicht erlaubt. |

### Step 2.4 — `DomainVerificationService` [STATUS]

**File:** `backend/src/nest/domains/domain-verification.service.ts`

Responsibilities:

- Generate verification tokens (32-byte random hex).
- Perform DNS TXT lookup for `_assixx-verify.<domain>`.
- Match resolved TXT content against stored token.

```typescript
import { Injectable, Logger } from '@nestjs/common';
import crypto from 'node:crypto';
import { Resolver } from 'node:dns/promises';

import { getErrorMessage } from '../common/index.js';
import type { TenantDomainRow } from './domains.types.js';

/**
 * Hard DNS timeout in milliseconds. Matches R2 mitigation (§0.2 risk register).
 * Node's default per-nameserver timeout is 10 s × up to 4 retries — unacceptable
 * for a user-facing "Verify now" button. v0.3.0 S1: enforce via Promise.race.
 */
const DNS_TIMEOUT_MS = 3000;

@Injectable()
export class DomainVerificationService {
  private readonly logger = new Logger(DomainVerificationService.name);

  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  txtHostFor(domain: string): string {
    return `_assixx-verify.${domain}`;
  }

  txtValueFor(token: string): string {
    return `assixx-verify=${token}`;
  }

  /**
   * Returns true if the domain has a TXT record matching the expected value.
   * Fails closed on DNS errors AND on timeout.
   *
   * Timeout implementation (v0.3.0 S1): per-call `Resolver` with its own
   * `setTimeout(ms)` plus a `Promise.race` wrapper. `Resolver.setTimeout` alone
   * doesn't fully bound NXDOMAIN edge cases on some libresolv variants, so the
   * race is the authoritative clock.
   */
  async verify(row: TenantDomainRow): Promise<boolean> {
    const host = this.txtHostFor(row.domain);
    const expected = this.txtValueFor(row.verification_token);

    const resolver = new Resolver({ timeout: DNS_TIMEOUT_MS, tries: 1 });
    const query = resolver.resolveTxt(host); // [[string,…], …]
    const timeout = new Promise<never>((_resolve, reject) =>
      setTimeout(() => reject(new Error(`DNS_TIMEOUT after ${DNS_TIMEOUT_MS}ms`)), DNS_TIMEOUT_MS),
    );

    try {
      const records = await Promise.race([query, timeout]);
      const flat = records.map((rec) => rec.join(''));
      const match = flat.some((value) => value.trim() === expected);

      if (!match) {
        this.logger.warn(
          `Domain-verify MISMATCH for tenant=${row.tenant_id} domain=${row.domain}: expected="${expected}", found=${JSON.stringify(flat)}`,
        );
      }
      return match;
    } catch (error: unknown) {
      this.logger.warn(
        `Domain-verify DNS error for tenant=${row.tenant_id} domain=${row.domain}: ${getErrorMessage(error)}`,
      );
      return false;
    } finally {
      resolver.cancel();
    }
  }
}
```

### Step 2.5 — `DomainsService` (CRUD) [STATUS]

**File:** `backend/src/nest/domains/domains.service.ts`

Methods:

- `listForTenant(tenantId): Promise<TenantDomain[]>`
- `addDomain(tenantId, domain): Promise<TenantDomain>` — generates token, inserts row, returns with verificationInstructions
- `triggerVerify(tenantId, domainId): Promise<TenantDomain>` — calls `DomainVerificationService.verify()`, updates status on match, sets verified_at
- `removeDomain(tenantId, domainId): Promise<void>` — soft-delete (is_active = 4)
- `setPrimary(tenantId, domainId): Promise<void>` — toggle is_primary, enforce partial-unique-index constraint

All operations via `db.tenantTransaction()` (ADR-019).

Add-domain invariants:

- Domain must be unique per tenant (DB constraint).
- Domain must be globally unique among `status = 'verified'` rows. **DB-enforced** via the partial `UNIQUE INDEX idx_tenant_domains_domain_verified` (§1.1) — the final arbiter, race-proof. The service catches PostgreSQL error code `23505` (unique_violation) from the verify-flip UPDATE and maps it to `ConflictException({ code: 'DOMAIN_ALREADY_CLAIMED' })` for a clean user-facing message. A lightweight service-level pre-check BEFORE the DB write is permitted for a faster error path, but is race-susceptible and not authoritative — the `23505` catch is the real guard.
- Domain must pass the dedicated `validateBusinessDomain(domain)` helper (§2.3, §0.2.5 #15). Three failure codes mapped:
  - `INVALID_FORMAT` → `BadRequestException('INVALID_DOMAIN_FORMAT')`
  - `DISPOSABLE_EMAIL` → `BadRequestException('DISPOSABLE_DOMAIN')`
  - `FREE_EMAIL_PROVIDER` → `BadRequestException('FREE_EMAIL_PROVIDER')`

### Step 2.6 — `TenantVerificationService` — the KISS gate [STATUS]

**File:** `backend/src/nest/domains/tenant-verification.service.ts`

```typescript
import { ForbiddenException, Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class TenantVerificationService {
  constructor(private readonly db: DatabaseService) {}

  async isVerified(tenantId: number): Promise<boolean> {
    // WHY queryAsTenant, not query (ADR-019 §6b + database.service.ts:36):
    //   - `db.query()` uses `app_user` pool WITHOUT calling `set_config('app.tenant_id', ...)`.
    //     Under RLS-strict mode every `tenant_domains` SELECT without that GUC returns 0 rows
    //     (`NULLIF('', '')::integer` → NULL, `tenant_id = NULL` never matches).
    //     → `isVerified()` would ALWAYS return false → `assertVerified()` would 403 EVERY
    //       user-creation attempt, deadlocking the whole feature.
    //   - `db.queryAsTenant(sql, params, tenantId)` runs the SELECT inside a transaction
    //     that injects the passed-in tenantId into the RLS context. Works both inside
    //     authenticated HTTP requests (where CLS also carries tenantId) AND from WebSocket
    //     / worker / background-job paths where CLS may be empty — the helper takes the
    //     tenantId as an explicit parameter, so the call site is the single source of truth.
    //   - The explicit `WHERE tenant_id = $1` is defence-in-depth with the same value RLS
    //     uses, so a typo or a mismatched parameter would surface as 0 rows (fail-closed)
    //     rather than leak cross-tenant data.
    const rows = await this.db.queryAsTenant<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM tenant_domains
         WHERE tenant_id = $1 AND status = 'verified' AND is_active = 1
       ) AS exists`,
      [tenantId],
      tenantId,
    );
    return rows[0]?.exists === true;
  }

  /**
   * Throws ForbiddenException('TENANT_NOT_VERIFIED') if no verified domain exists.
   * Call at the top of every user-creation service method.
   */
  async assertVerified(tenantId: number): Promise<void> {
    if (!(await this.isVerified(tenantId))) {
      throw new ForbiddenException({
        code: 'TENANT_NOT_VERIFIED',
        message:
          'Dein Tenant hat noch keine verifizierte Domain. ' +
          'Bitte verifiziere zuerst Deine Firmen-Domain unter /settings/company-profile/domains.',
      });
    }
  }
}
```

### Step 2.7 — Controller [STATUS]

**File:** `backend/src/nest/domains/domains.controller.ts`

Endpoints:

| Method | Route                                 | Auth                      | Description                                                                            |
| ------ | ------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------- |
| GET    | `/api/v2/domains`                     | `@Roles('root')`          | List tenant's domains                                                                  |
| POST   | `/api/v2/domains`                     | `@Roles('root')`          | Add a new domain                                                                       |
| POST   | `/api/v2/domains/:id/verify`          | `@Roles('root')`          | Trigger DNS verification                                                               |
| PATCH  | `/api/v2/domains/:id/primary`         | `@Roles('root')`          | Mark as primary                                                                        |
| DELETE | `/api/v2/domains/:id`                 | `@Roles('root')`          | Remove (soft-delete)                                                                   |
| GET    | `/api/v2/domains/verification-status` | `@Roles('root', 'admin')` | Lightweight `{ verified: boolean }` for banner + user-creation guards (§0.2.5 #16, Q8) |

Class-level: `@UseGuards(JwtAuthGuard, RolesGuard)`; per-endpoint `@Roles(...)`. Throttling is endpoint-specific — no `@Throttle()` "default" because the existing decorator catalogue (`throttle.decorators.ts`) has no generic default and the domains endpoints mix cheap reads with a DNS-triggering action:

| Endpoint                           | Throttle                                                                                                                                           | Rationale                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `GET /domains`                     | `@UserThrottle()` (1000 / 15 min)                                                                                                                  | Cheap DB read, no external effects                                                          |
| `GET /domains/verification-status` | `@UserThrottle()` (1000 / 15 min)                                                                                                                  | Called on every `(app)/+layout.server.ts` load — has to be generous                         |
| `POST /domains`                    | `@UserThrottle()` (1000 / 15 min)                                                                                                                  | Validator is offline; bounded by `validateBusinessDomain()` + DB unique constraint          |
| `POST /domains/:id/verify`         | NEW `@Throttle({ 'domain-verify': { limit: 10, ttl: 10 * MS_MINUTE } })` (or a new `DomainVerifyThrottle()` decorator in `throttle.decorators.ts`) | Only endpoint that emits outbound DNS — tight cap protects upstream resolvers + defends R11 |
| `PATCH /domains/:id/primary`       | `@UserThrottle()` (1000 / 15 min)                                                                                                                  | Single UPDATE, cheap                                                                        |
| `DELETE /domains/:id`              | `@UserThrottle()` (1000 / 15 min)                                                                                                                  | Soft-delete only                                                                            |

Registering the `domain-verify` named tier requires adding it to `AppThrottlerModule` alongside the existing `auth` / `user` / `admin` / `public` / `upload` / `export` tiers — same mechanic Plan 1 uses for its `auth-ip` / `auth-email` tiers. If the team prefers the named-decorator pattern, extract into `DomainVerifyThrottle()` colocated with `AuthThrottle()` et al. so the rule is grep-visible at the use site.

**Crucially: NONE of these endpoints call `assertTenantVerified()`.** Domain management is exactly the action that unlocks verification — gating it would deadlock the tenant. `verification-status` is purely informational (admin / root need it to show correct UI state before the first verification lands).

### Step 2.8 — Signup flow hardening [STATUS]

**File:** `backend/src/nest/signup/signup.service.ts` (already modified per OAuth work — verified method signature: `registerTenant(dto: SignupDto, ipAddress?: string, userAgent?: string): Promise<SignupResponseData>` at `signup.service.ts:75`).

Integration sequence:

1. At the top of `registerTenant()` (before the existing validation block): call `validateBusinessEmail(dto.email)` (synchronous, ~1 ms, imported from `backend/src/nest/domains/email-validator.ts`; Phase 0 decides whether to extract `EmailValidatorModule` or keep in `DomainsModule`).
2. On validation failure: throw `BadRequestException` with specific `code` (three failure modes — no `DOMAIN_NO_MX` since we don't DNS-check at signup):
   - `INVALID_FORMAT` → "Bitte gib eine gültige E-Mail-Adresse ein."
   - `DISPOSABLE_EMAIL` → "Wegwerf-E-Mail-Adressen sind nicht erlaubt. Bitte nutze Deine Firmen-E-Mail-Adresse."
   - `FREE_EMAIL_PROVIDER` → "Bitte nutze Deine Firmen-E-Mail-Adresse mit eigener Domain. Gmail, Outlook, GMX & Co. sind nicht erlaubt."
3. After tenant + root user are created inside the existing transaction, insert `tenant_domains` row:

```typescript
const domain = extractDomain(dto.email);
const token = this.domainVerification.generateToken();
await client.query(
  `INSERT INTO tenant_domains
     (tenant_id, domain, status, verification_token, is_primary)
   VALUES ($1, $2, 'pending', $3, true)`,
  [tenantId, domain, token],
);
```

4. Signup response (`SignupResponseData`): include `tenantVerificationRequired: true` and a prompt to redirect the new root to `/settings/company-profile/domains`.

5. The initial root-user `INSERT INTO users` inside `registerTenant` is one of the bootstrap paths allowlisted under the §0.2.5 #14 arch-test rule. The allowlist is **Phase-0 enumeration-driven** (v0.3.1 A1 — not "exactly N" hard-coded): at minimum `registerTenant` + `registerTenantWithOAuth` (§2.8b). Any further bootstrap-path additions must be reviewed and added in the SAME PR that introduces them. See §2.11 for the full `INSERT INTO users` landscape and the decision matrix for `auth.service.ts::createUser`.

### Step 2.8b — OAuth signup hardening (v0.3.0 G1) [STATUS]

**File:** `backend/src/nest/signup/signup.service.ts:405` `registerTenantWithOAuth(...)`

This is the second bootstrap path, introduced by ADR-046 (Microsoft OAuth). It is already called from `oauth.service.ts:142`. Per §0.2.5 #17, OAuth signup AUTO-VERIFIES the tenant domain — no DNS-TXT dance, no `pending` seed, no freemail check (Azure AD already rejects freemail at the identity-provider level for organizational tenants).

Integration sequence:

1. Skip `validateBusinessEmail()` — email comes from a Microsoft identity token signed by Azure AD. The trust boundary is Azure AD, not our list lookup. (Rationale: Microsoft enforces organizational-tenant domain ownership; duplicating our freemail check here would add zero signal and reject legitimate `outlook.com` tenants that happen to own their own Azure AD tenant. If Microsoft returns an email on a domain we recognize as freemail, the OAuth provider layer decides — not this layer.)
2. Extract domain from the Microsoft-provided email (same `extractDomain()` helper as §2.3).
3. After the root-user `INSERT INTO users` inside the existing transaction, seed `tenant_domains` with the verified-from-day-1 row. **Wrap the INSERT in a try/catch for PG error `23505` (unique_violation)** — the partial UNIQUE INDEX `idx_tenant_domains_domain_verified` (§1.1) rejects the INSERT if another tenant has already claimed the domain as verified (e.g. a password-signed-up tenant A verified `firma.de` via DNS-TXT, now an OAuth-signup attempts the same domain). Without the catch, Postgres's raw error bubbles up as a 500 Internal Server Error to the OAuth callback — terrible UX for what is actually a "domain already taken" conflict:

```typescript
import { DatabaseError } from 'pg';

// ...
const domain = extractDomain(dto.email);
const token = this.domainVerification.generateToken(); // audit-only, never redeemed
try {
  await client.query(
    `INSERT INTO tenant_domains
       (tenant_id, domain, status, verification_token, verified_at, is_primary)
     VALUES ($1, $2, 'verified', $3, NOW(), true)`,
    [tenantId, domain, token],
  );
} catch (err: unknown) {
  // 23505 = unique_violation against idx_tenant_domains_domain_verified (§1.1).
  // Throwing here rolls back the enclosing systemTransaction → no orphan tenant
  // or user row survives. Returns a clean 409 instead of a 500.
  if (err instanceof DatabaseError && err.code === '23505') {
    throw new ConflictException({
      code: 'DOMAIN_ALREADY_CLAIMED',
      message:
        'Diese Domain gehört bereits einem anderen Assixx-Tenant. ' + 'Bitte wende Dich an Deinen Assixx-Kontakt.',
    });
  }
  throw err;
}
```

Phase 3 unit test MUST cover this branch: mock `client.query` (the `tenant_domains` INSERT) to reject with `{ code: '23505' }` → assert the seeder throws `ConflictException({ code: 'DOMAIN_ALREADY_CLAIMED' })` AND the outer signup transaction rolls back (no orphan tenant row in `tenants`, no orphan user row in `users`). Phase 4 API test: pre-seed `tenant_domains(verified, domain='firma.de')` for tenant 1, trigger OAuth signup for a Microsoft identity on `firma.de` → expect `409 DOMAIN_ALREADY_CLAIMED`, `SELECT COUNT(*) FROM tenants` unchanged.

4. OAuth signup response: include `tenantVerificationRequired: false` (opposite of password signup) so the frontend does NOT surface the verification banner.

5. Arch-test allowlist (§2.11): `registerTenantWithOAuth` is listed alongside `registerTenant`. Both create the first-ever user BEFORE any `tenant_domains` row could exist — they are the literal definition of "bootstrap" for this feature.

6. **Audit-trail:** record domain-auto-verify at this step (Option A auto-interceptor suffices — the signup-audit row already captures the fact that a user was created; a separate `audit_trail` entry specifically for the auto-verify decision is OPTIONAL V2 enhancement and not blocked on for V1).

### Step 2.9 — User-creation services wiring [STATUS]

From Phase 0's endpoint enumeration (expected: `users.service.ts`, `root-admin.service.ts`, `root.service.ts`, `dummy-users.service.ts`, `auth.service.ts#register`, plus any OAuth-signup-driven user-create path), for each user-creation service method:

1. Inject `TenantVerificationService` via constructor.
2. At the top of the create-method (before any DB writes):

```typescript
await this.tenantVerification.assertVerified(tenantId);
```

3. No controller-level guard or decorator — the service method is the single source of truth (R7 mitigation).
4. Covered by the Phase-2 arch-test (§2.11). If the call is missing, CI fails before review.

### Step 2.11 — Architectural test (MANDATORY, Q4) [STATUS]

**File:** `shared/src/architectural.test.ts` (extend existing)

**Rule:** For every `*.service.ts` under `backend/src/nest/**`, scan for `/INSERT\s+INTO\s+users\b/gis` (case-insensitive, dotall, `\s+` so multi-line SQL like `INSERT INTO\n  users (...)` is caught too — prevents future drift where a developer reformats a long INSERT onto multiple lines and accidentally slips past the arch-test). For each match:

- Resolve the enclosing method via AST (reuse the existing is_active/idField architectural-test infrastructure — same `ts.createSourceFile` + `ts.forEachChild` visitor pattern).
- Assert the method body (anywhere before the `INSERT INTO users`) contains `assertVerified(` — identifier match, not a string-grep, so comments / strings don't trip it.
- If the method is on the allowlist, skip.

**Allowlist (Phase 0 enumeration drives the final content — v0.3.1 A1 correction, no longer "exactly two"):**

```typescript
const USER_INSERT_ALLOWLIST = new Set<string>([
  // ─── Signup bootstrap: first user inserted BEFORE tenant_domains(*) seed. ───────
  // Password signup — seeds tenant_domains(status='pending').
  'backend/src/nest/signup/signup.service.ts::registerTenant',
  // OAuth signup — seeds tenant_domains(status='verified') directly (ADR-046 trust boundary).
  // See §0.2.5 #17 + §2.8b.
  'backend/src/nest/signup/signup.service.ts::registerTenantWithOAuth',

  // ─── v0.3.1 A1 — potential third allowlist candidate (pending Phase 0 decision) ─
  // `backend/src/nest/auth/auth.service.ts::createUser` is a PRIVATE helper at
  // auth.service.ts:631 that does `INSERT INTO users`. Its sole call site is
  // auth.service.ts:269 — an authenticated-register path. Phase 0 MUST decide one of:
  //   (a) Inject `TenantVerificationService` into `AuthService` and call
  //       `assertVerified(data.tenantId)` at the top of `createUser()` — the caller is
  //       inside an authenticated context where CLS tenantId is already set.
  //   (b) Trace the call graph, identify the controller entry, and gate THERE rather
  //       than in the helper.
  //   (c) If, and only if, Phase 0 confirms this helper is ALSO part of a bootstrap
  //       flow (creating a first-user BEFORE any tenant_domains row exists),
  //       allowlist it with a one-sentence justification:
  //       'backend/src/nest/auth/auth.service.ts::createUser',
  //   Default recommendation: (a) — helper-level assertion is the cheapest fix,
  //   zero-cost when tenant is already verified, and the arch-test passes without
  //   expanding the allowlist.
  //
  // Any future bootstrap-path addition must be reviewed + added here in the SAME PR
  // that introduces it, accompanied by an ADR-level justification of why no gate applies.
]);
```

**Full `INSERT INTO users` production landscape (v0.3.1 A1 — grep confirmed 2026-04-17):**

| File:Line                                                 | Method (enclosing)                                               | Gate needed?                                                              |
| --------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `backend/src/nest/users/users.service.ts:257`             | `UsersService.create*()` (admin/employee creation by root/admin) | **Yes — `assertVerified()` at entry**                                     |
| `backend/src/nest/auth/auth.service.ts:642`               | `AuthService.createUser(data)` (private, called from :269)       | **Phase 0 decision — default: assertVerified in helper (option a above)** |
| `backend/src/nest/root/root.service.ts:241`               | `RootService.createRootUser()` (second root)                     | **Yes — `assertVerified()` at entry**                                     |
| `backend/src/nest/root/root-admin.service.ts:156`         | `RootAdminService.createAdmin()`                                 | **Yes — `assertVerified()` at entry**                                     |
| `backend/src/nest/dummy-users/dummy-users.service.ts:123` | `DummyUsersService.create()`                                     | **Yes — `assertVerified()` at entry**                                     |
| `backend/src/nest/signup/signup.service.ts:289`           | `SignupService.registerTenant()`                                 | Allowlisted (bootstrap — seeds `tenant_domains(pending)`)                 |
| `backend/src/nest/signup/signup.service.ts:529`           | `SignupService.registerTenantWithOAuth()`                        | Allowlisted (bootstrap — seeds `tenant_domains(verified)`, ADR-046)       |

Phase 0 deliverable: confirm this table reflects HEAD on the day Plan 2 Phase 2 starts (codebase moves fast — new user-creation services may appear). For each non-allowlisted row, Phase 2 adds a constructor injection of `TenantVerificationService` + an `assertVerified(tenantId)` call.

**Failure output:**

```
architectural: tenant-verification gate
  ✗ backend/src/nest/users/users.service.ts::createUser inserts into `users`
    but never calls `assertVerified(...)` in its body.
    Fix: inject TenantVerificationService and call
    `await this.tenantVerification.assertVerified(tenantId)`
    before any DB write. See ADR-048 §2.9.
```

**Test runs under the `unit` project** alongside `shared/src/architectural.test.ts` existing rules (is_active magic numbers, inline idField, session-expired re-implementation). Zero new infra; same `vitest run --project unit` invocation.

> **R7 drops from Medium to Low** as a direct consequence of this test.

### Step 2.10 — ESLint discipline (lightweight)

Original plan (v0.1.0) had a `no-restricted-imports` rule for `node-email-verifier`. Obsolete — `node-email-verifier` + `company-email-validator` are both uninstalled. The remaining runtime dep (`mailchecker`) has no dangerous default mode.

Keep a single ESLint rule to prevent accidental direct imports of the raw JSON from elsewhere in the codebase — all access must go through the wrapper so the sync strategy stays enforceable:

```jsonc
// eslint.config.mjs (backend section)
"no-restricted-imports": ["error", {
  "patterns": [{
    "group": ["**/domains/data/freemail-domains.json"],
    "message": "Import from `backend/src/nest/domains/email-validator.ts` instead — the wrapper encapsulates the freemail Set + normalization."
  }]
}]
```

Cheap, zero-maintenance, makes the sync contract explicit.

**v0.3.1 E1 — flat-config placement:** `eslint.config.mjs` uses ESLint's **flat** config format (array-of-objects, not a top-level `rules:` block). The snippet above is valid rule-object syntax in both legacy `.eslintrc` and flat config, but must be placed inside an existing backend-scoped `files: [...]` entry — NOT as a standalone `.eslintrc`-style block:

```js
// eslint.config.mjs — backend section
{
  files: ['backend/**/*.ts'],
  rules: {
    // ... existing backend rules ...
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['**/domains/data/freemail-domains.json'],
        message: 'Import from backend/src/nest/domains/email-validator.ts instead.',
      }],
    }],
  },
}
```

### Phase 2 — Definition of Done

- [ ] `DomainsModule` registered in `app.module.ts`
- [ ] All 6 endpoints implemented + Root / Root+Admin guards per §2.7
- [ ] NEW `GET /api/v2/domains/verification-status` → `{ verified: boolean }` (Root + Admin readable)
- [ ] `DomainsService` CRUD uses `db.tenantTransaction()`
- [ ] `DomainVerificationService` correctly resolves TXT + fail-closed on DNS errors **AND** hard-bounded by `DNS_TIMEOUT_MS = 3000` via `Promise.race` + per-call `Resolver` with `timeout/tries=1` (v0.3.0 S1)
- [ ] `TenantVerificationService.assertVerified()` implemented
- [ ] `validateBusinessEmail()` + `validateBusinessDomain()` (§2.3) both implemented and exported from `email-validator.ts`
- [ ] `freemail-domains.json` committed + typed import (`with { type: 'json' }`) + `LICENSE.freemail-domains.md` next to it
- [ ] `sync-freemail-list.ts` + `pnpm run sync:freemail` script registered
- [ ] Signup hardening wired into `signup.service.ts#registerTenant` (NOT `signup()`)
- [ ] **OAuth signup hardening (v0.3.0 G1):** `signup.service.ts#registerTenantWithOAuth` at line 405 seeds `tenant_domains(status='verified', verified_at=NOW(), is_primary=true)` within the existing transaction, immediately after the root-user INSERT. Response sets `tenantVerificationRequired: false`.
- [ ] Every user-creation service method calls `assertVerified()` at entry (Phase 0 endpoint list → every row ticked)
- [ ] **Arch-test (§2.11) green** — `shared/src/architectural.test.ts` passes; allowlist contains the Phase-0-enumerated bootstrap entries (minimum: `signup.service.ts::registerTenant` password bootstrap + `signup.service.ts::registerTenantWithOAuth` OAuth bootstrap, v0.3.0 G1). Any additional allowlist entry MUST be justified in §2.11 and reviewed alongside the code change that requires it (v0.3.1 A1).
- [ ] ESLint rule blocks direct imports of `freemail-domains.json` (see §2.10)
- [ ] Migration SQL uses **`uuidv7()`** (PG 18.3 native), NOT `uuid_generate_v7()`
- [ ] No `any`, `??` not `||`, explicit null checks, `import type`, `getErrorMessage()`
- [ ] ESLint: 0 errors on `backend/src/nest/domains/` and `backend/src/nest/signup/`
- [ ] Type-check: 0 errors

---

## Phase 3: Unit Tests (Session 5, Part A)

Test files (one per service):

- `backend/src/nest/domains/domains.service.test.ts`
- `backend/src/nest/domains/domain-verification.service.test.ts`
- `backend/src/nest/domains/tenant-verification.service.test.ts`
- `backend/src/nest/domains/email-validator.test.ts`
- `backend/src/nest/signup/signup.service.test.ts` (extend existing)

### Mandatory scenarios (≥ 30 tests)

**`validateBusinessDomain`** (synchronous, §2.3):

- [ ] `validateBusinessDomain('firma.de')` → `{ valid: true }`.
- [ ] Freemail domains (`gmail.com`, `web.de`, `gmx.de`, `outlook.com`, …) → `FREE_EMAIL_PROVIDER`.
- [ ] Disposable (`mailinator.com`, `10minutemail.com`) → `DISPOSABLE_EMAIL`.
- [ ] Malformed (`''`, `'firma'` no dot, `'firma..de'`, `'-firma.de'`, `'firma.de-'`, label > 63 chars, overall > 253 chars) → `INVALID_FORMAT`.
- [ ] Case-insensitive + trim (`'  Firma.DE  '` → `{ valid: true }`).

**`validateBusinessEmail`** (synchronous — no DNS mocking needed):

- [ ] Valid business email (e.g., `root@firma.de`) → `{ valid: true }`.
- [ ] `gmail.com`, `googlemail.com` → `FREE_EMAIL_PROVIDER`.
- [ ] `outlook.com`, `hotmail.com`, `live.com`, `msn.com` → `FREE_EMAIL_PROVIDER`.
- [ ] `yahoo.com`, `yahoo.de`, `yahoo.co.uk` → `FREE_EMAIL_PROVIDER` (R8, covers country variants).
- [ ] `web.de`, `gmx.de`, `gmx.net`, `t-online.de`, `freenet.de` → `FREE_EMAIL_PROVIDER` (R8, German providers).
- [ ] `aol.com`, `icloud.com`, `me.com`, `mail.ru`, `yandex.com`, `protonmail.com`, `tutanota.com` → `FREE_EMAIL_PROVIDER`.
- [ ] `mailinator.com`, `10minutemail.com`, `guerrillamail.com`, `temp-mail.io` → `DISPOSABLE_EMAIL`.
- [ ] Custom-domain burner (e.g., `burner.email`, `mail-temp.io` if present in mailchecker list) → `DISPOSABLE_EMAIL`.
- [ ] Malformed emails: `''`, `'foo'`, `'foo@'`, `'@bar.com'`, `'foo@@bar.com'` → `INVALID_FORMAT`.

**`DomainVerificationService`:**

- [ ] Token generation produces 64 hex chars.
- [ ] `txtHostFor('firma.de')` === `_assixx-verify.firma.de`.
- [ ] `verify()` returns true on matching TXT record.
- [ ] `verify()` returns false on mismatching value.
- [ ] `verify()` returns false when TXT record is missing (mock NXDOMAIN).
- [ ] `verify()` returns false on DNS error (SERVFAIL) — fail-closed.
- [ ] `verify()` returns false when DNS lookup exceeds `DNS_TIMEOUT_MS` (v0.3.0 S1) — mock a hanging resolver, assert the returned-value arrives within `3000ms + small jitter` and is `false`.
- [ ] `verify()` cancels the per-call `Resolver` after resolution/timeout (no leaked socket handles — assert via `resolver.cancel()` spy).

**`DomainsService`:**

- [ ] Add domain → row inserted, token generated, `is_primary = true` for first.
- [ ] Add second domain → `is_primary = false`.
- [ ] Add duplicate domain for same tenant → `ConflictException`.
- [ ] Add domain that's already `verified` for another tenant → `ConflictException(DOMAIN_ALREADY_CLAIMED)`.
- [ ] Add freemail domain → `BadRequestException(FREE_EMAIL_PROVIDER)`.
- [ ] Trigger verify with matching TXT → status flips to `verified`, `verified_at` set.
- [ ] Trigger verify with non-matching TXT → status stays `pending`.
- [ ] **Token persistence (v0.3.4 D22, §0.2.5 #10):** Trigger `verify()` three times in sequence on the same `tenant_domains` row — `verification_token` column is read once before and once after; MUST be byte-identical. Guards against an accidental `UPDATE … SET verification_token = $newToken` slipping into the verify path during future refactors.
- [ ] Set primary → old primary's `is_primary = false`, new row's is `true`.
- [ ] Remove domain → `is_active = 4`, row hidden from list.
- [ ] Remove last verified domain → tenant falls back to unverified; user-creation blocks again.
- [ ] **Soft-delete + re-add round-trip:** add `firma.de` → verify → remove (`is_active = 4`) → add `firma.de` again → succeeds, fresh token, fresh `status = 'pending'`. Guards against the partial UNIQUE INDEX (§1.1, v0.3.2) accidentally rejecting legitimate re-claims after a soft-delete.
- [ ] **IDN / Punycode normalization (v0.3.4 D24):** `POST` with `müller.de` → stored as either consistently Unicode OR consistently Punycode (`xn--mller-kva-…`) — assertion: the `FREEMAIL_DOMAINS` Set-lookup operates on the SAME form as the stored column, verified by a round-trip: add `müller.de` then query `SELECT domain FROM tenant_domains WHERE domain = $1` with the original input → exactly one row. Mixed-case + whitespace input (`'  Müller.DE  '`) normalizes identically.

**`TenantVerificationService`:**

- [ ] `isVerified` returns true when at least one domain has `status = 'verified'`.
- [ ] `isVerified` returns false when all domains are pending/failed.
- [ ] `assertVerified` throws `ForbiddenException` with `TENANT_NOT_VERIFIED` code when unverified.
- [ ] **`isVerified` uses `db.queryAsTenant()`, NOT `db.query()` (v0.3.4 D22 — regression test for v0.3.2 CRITICAL).** Spy on both methods on the injected `DatabaseService`; call `isVerified(tenantId)`; assert `queryAsTenant` was called with `tenantId` in the positional args AND `query` was NOT called. This lock-down prevents the v0.3.2 bug (RLS-strict + `db.query()` → always 0 rows → permanent 403 deadlock) from silently resurfacing under a future refactor. Failure message must name the regression for future readers: `"isVerified must use queryAsTenant under ADR-019 strict RLS — see v0.3.2 changelog"`.

**`GET /domains/verification-status` controller** (§2.7, §0.2.5 #16):

- [ ] Returns `{ verified: true }` when a verified row exists.
- [ ] Returns `{ verified: false }` for brand-new unverified tenant.
- [ ] Returns `{ verified: false }` after the only verified row is soft-deleted (re-locks).
- [ ] Reachable for `@Roles('root')` and `@Roles('admin')`; 403 for employees; 401 unauthenticated.

**Signup hardening:**

- [ ] Signup with `gmail.com` email → 400 `FREE_EMAIL_PROVIDER`; no tenant created.
- [ ] Signup with disposable → 400 `DISPOSABLE_EMAIL`; no tenant.
- [ ] Signup with `INVALID_FORMAT` → 400; no tenant.
- [ ] Signup with valid company email → tenant + root + `tenant_domains(pending)` all created atomically (transaction rollback if any fails).
- [ ] **Signup transaction atomicity — failure injection (v0.3.4 D25).** Mock the third statement (the `INSERT INTO tenant_domains`) to throw a synthetic `DatabaseError`; call `registerTenant(dto)`; assert (a) the call rejects with the injected error, (b) `SELECT COUNT(*) FROM tenants WHERE company_name = $1` with the DTO's name returns 0, (c) `SELECT COUNT(*) FROM users WHERE email = $1` with the DTO's email returns 0, (d) no orphan `tenant_addons` row. This locks in the "all or nothing" claim currently only stated in prose. Repeat for the `INSERT INTO users` statement failing (second statement) and the `INSERT INTO tenants` failing (first statement — trivially nothing to roll back, but assertion (a) still holds).
- [ ] **OAuth signup hardening (v0.3.0 G1):** `registerTenantWithOAuth(dto, msftProfile)` → tenant + root + `tenant_domains(status='verified', is_primary=true, verified_at ≠ null)` all created atomically. Freemail/disposable checks are NOT invoked on this path (Azure AD trust boundary). Response payload carries `tenantVerificationRequired: false`.
- [ ] **OAuth signup with a freemail Microsoft account** (rare but possible when a user has a personal `outlook.com` but uses it as their Azure AD tenant owner): tenant created anyway, `tenant_domains(verified)` seeded on `outlook.com`. Accepted — the trust boundary is Microsoft, not our freemail list. Documented in ADR-048.

**Arch-test self-tests (v0.3.4 D23):**

- [ ] `shared/src/architectural.test.ts` is green on the current `main` (Phase 0 Step 0.8 output is the baseline — zero unresolved hits).
- [ ] **False-positive immunity — comment form:** add a fixture file under a dedicated test-scope directory that contains the literal string `"INSERT INTO users (id) VALUES (42)"` inside a `/* … */` block comment and is NOT itself a `.service.ts`. Run the arch-test — MUST stay green. Asserts the scope filter (`backend/src/nest/**/*.service.ts`) is honored.
- [ ] **False-positive immunity — self-reference:** if the arch-test's own source contains the regex as a literal (`const RE = /INSERT\s+INTO\s+users\b/gis`), confirm the arch-test explicitly excludes its own file from the scanned scope, or that the regex-string is structured so it cannot self-match (e.g., split across template-literal boundaries).
- [ ] **Positive regression trigger:** synthesize a throwaway `backend/src/nest/__arch_test_fixtures__/offender.service.ts` with `await db.query('INSERT INTO users (...) VALUES (...)')` and NO `assertVerified()` call → arch-test MUST fail with the fixture's path. Delete the fixture before commit — this step is a manual verification, not a committed test.

### Phase 3 — Definition of Done

- [ ] ≥ 35 unit tests total (bumped from ≥ 30 in v0.3.4 to cover the 5 new mandatory scenarios: queryAsTenant spy, transaction-atomicity failure injection ×3, token persistence, IDN normalization, soft-delete re-add, arch-test self-tests).
- [ ] `docker exec assixx-backend pnpm exec vitest run --project unit backend/src/nest/domains/ backend/src/nest/signup/` → green
- [ ] `pnpm exec vitest run --project unit shared/src/architectural.test.ts` → green (arch-test + its self-tests)
- [ ] Every branch has ≥ 1 test
- [ ] DNS + SMTP fully mocked — no real network in tests
- [ ] Transaction rollback tests inject failure at each of the three INSERTs — all three must green
- [ ] `TenantVerificationService.isVerified` spy test explicitly asserts `queryAsTenant` is called and `query` is NOT (v0.3.4 D22)

---

## Phase 4: API Integration Tests (Session 5, Part B)

**New file:** `backend/test/tenant-domains.api.test.ts`
**Extend:** `backend/test/signup.api.test.ts` (existing, add freemail-block scenarios)

### Scenarios (≥ 30 assertions — v0.3.4 bumped from 25)

**Signup API:**

- [ ] POST `/api/v2/auth/signup` with `root@gmail.com` → 400 `FREE_EMAIL_PROVIDER`.
- [ ] POST with `root@mailinator.com` → 400 `DISPOSABLE_EMAIL`.
- [ ] POST with malformed email → 400 `INVALID_FORMAT`.
- [ ] POST with `root@firma-a.test` (valid) → 201; tenant created; `tenant_domains` row exists with `status = 'pending'`, `is_primary = true`, correct token.
- [ ] **OAuth signup (v0.3.0 G1):** POST `/api/v2/auth/oauth/microsoft/callback` with a mocked Microsoft profile for `root@firma-c.test` → 201; tenant created; `tenant_domains` row exists with `status = 'verified'`, `verified_at` set, `is_primary = true`. Subsequent POST `/api/v2/users` as this root → 201 **immediately** (no DNS dance needed, unblocking is instant).

**User-creation lock:**

- [ ] Authenticated as unverified root → POST `/api/v2/users` → 403 `TENANT_NOT_VERIFIED`.
- [ ] Same → POST to every other user-creation endpoint (from Phase 0 list) → 403 each.
- [ ] After verification completes → POST same → 201.

**Domains API:**

- [ ] GET `/api/v2/domains` authenticated as root → 200 with the seeded pending row.
- [ ] POST `/api/v2/domains` with `firma.de` → 201; `verificationInstructions` contains `txtHost = _assixx-verify.firma.de` and `txtValue = assixx-verify=<64hex>`.
- [ ] POST same domain again → 409 `DUPLICATE_DOMAIN`.
- [ ] POST `gmail.com` → 400 `FREE_EMAIL_PROVIDER`.
- [ ] POST `/api/v2/domains/:id/verify` with TXT record NOT set (mock DNS to return empty) → 200, row stays pending.
- [ ] POST same with correct TXT (mock DNS to return matching value) → 200, row becomes verified; from now on user-creation unlocks.
- [ ] PATCH `/api/v2/domains/:id/primary` with a second verified row → old primary loses flag, new one gets it.
- [ ] DELETE `/api/v2/domains/:id` on the only verified row → 200; subsequent user-creation → 403 (re-locks).
- [ ] Unauthenticated → 401 for all.
- [ ] Authenticated as non-root → 403 for all.
- [ ] Cross-tenant access attempt (tenant A tries to GET tenant B's domain) → blocked by RLS (empty result / 404).

**Verification-status endpoint (§2.7):**

- [ ] GET `/api/v2/domains/verification-status` as unverified root → `{ verified: false }`.
- [ ] GET same as admin → `{ verified: false }` (admin can read).
- [ ] GET same as employee → 403.
- [ ] After verification succeeds → GET returns `{ verified: true }` within a single request round-trip.
- [ ] After DELETE of the only verified domain → GET returns `{ verified: false }` again (re-lock).

**Arch-test (§2.11) — runs under unit project, mentioned here for traceability:**

- [ ] `pnpm exec vitest run --project unit shared/src/architectural.test.ts` → green.
- [ ] Intentional regression: temporarily remove `assertVerified()` from one user-creation service → arch-test fails with the exact path pointer. Revert.
- [ ] **Allowlist integrity (v0.3.0 G1):** temporarily remove `registerTenantWithOAuth` from the allowlist → arch-test fails pointing at `signup.service.ts:529`. Restore.
- [ ] **Allowlist narrowness:** adding a fake third allowlist entry (`"backend/src/nest/fake/fake.service.ts::createFakeUser"`) without a corresponding real file is allowed by the test (the allowlist is a set of strings, not a file-existence check). Documented as a trade-off; the review process is the gate on allowlist additions.

**OAuth concurrent-race (v0.3.4 D26 — real race, not just 23505-mock):**

- [ ] **Two parallel OAuth callbacks, same Microsoft domain.** Seed an empty DB. Fire `POST /api/v2/auth/oauth/microsoft/callback` twice concurrently via `Promise.all`, both with a mocked Microsoft profile for `root@contested.test`. Assertions: (a) exactly ONE call returns 201 with a new tenant + verified `tenant_domains` row; (b) the other returns 409 `DOMAIN_ALREADY_CLAIMED`; (c) `SELECT COUNT(*) FROM tenants WHERE company_name LIKE 'contested%'` returns 1 (not 2, not 0); (d) `SELECT COUNT(*) FROM tenant_domains WHERE domain = 'contested.test' AND status = 'verified'` returns 1; (e) zero orphan `users` rows linked to a non-existent tenant_id. Guards the partial UNIQUE INDEX + 23505-catch contract against a true concurrent burst, which the mock-only unit test cannot detect (mock bypasses PG's transaction serialization).
- [ ] **Password-signup + OAuth-seed race on same domain.** Start a password signup for `root@contested2.test` → seeds `tenant_domains(pending)`. Before root verifies DNS, a different user attempts OAuth signup with Microsoft claiming `contested2.test`. Expected: OAuth 409 `DOMAIN_ALREADY_CLAIMED` (partial UNIQUE INDEX only indexes `status = 'verified'`, so a `pending` row does NOT block, BUT the OAuth seed is `verified` — check the exact index predicate decision in §1.1 and adapt this test to match the final spec). Key outcome to lock in: whichever behavior §1.1 defines, Phase 4 has a test that pins it.

**Graceful degradation on last-verified-domain removal (v0.3.4 D27):**

- [ ] Seed verified tenant. Create 3 admin users + 5 employee users while verified (all succeed). DELETE the only verified `tenant_domains` row. Assertions: (a) the 8 existing users can still authenticate (`POST /api/v2/auth/login` returns 200); (b) the 8 existing users can still call read endpoints appropriate to their role (e.g., `GET /api/v2/users/me` → 200); (c) the 8 existing users can still call WRITE endpoints that are NOT user-creation (e.g., updating their own profile, uploading a document) → 200; (d) ONLY new user-creation returns 403 `TENANT_NOT_VERIFIED`. Locks in the "degradation is narrow, existing users are not kicked out" contract.

**Rate-limit tier verification (v0.3.4 D28, §2.7 per v0.3.2 M3):**

- [ ] `/api/v2/domains/verification-status` + `GET /api/v2/domains` + `POST /api/v2/domains` sit under `UserThrottle` (≈ 100 req/min): fire 200 requests in 60 seconds → at least some 429s appear after the tier limit. Sanity check only — this is the existing coverage from v0.3.3 DoD.
- [ ] **`POST /api/v2/domains/:id/verify` sits under the dedicated `domain-verify` tier (10 req / 10 min):** fire 15 `/verify` calls in quick succession → the 11th call (or earlier, depending on pre-existing token-bucket state) returns 429 with the tier-specific limit header. Asserts the narrower bound specifically on the DNS-triggering endpoint, which the general `UserThrottle` test does NOT cover.
- [ ] **Rate-limit tiers are independent:** after hitting the `domain-verify` limit, other domains endpoints (`GET`, `POST`, `verification-status`) MUST still work (not collateral-429). Asserts tier isolation.

**Audit-trail smoke (v0.3.4 D29):**

- [ ] After each of: `POST /api/v2/domains` (add), `POST /api/v2/domains/:id/verify` (verify attempt, both success and failure), `DELETE /api/v2/domains/:id`, query `SELECT event_type, entity_id FROM audit_trail WHERE tenant_id = $1 ORDER BY occurred_at DESC LIMIT 5`. Expected: each action produced at least one row with a recognizable `event_type` (e.g., `domain.added`, `domain.verification_attempt`, `domain.removed`). This is a single smoke that the auto-interceptor actually wired through for the new endpoints; V1 does NOT need exhaustive audit schema-level tests.

### Phase 4 — Definition of Done

- [ ] ≥ 30 integration tests total (bumped from ≥ 25 in v0.3.4 to cover concurrent-race, graceful degradation, rate-limit tier isolation, audit-trail smoke).
- [ ] All scenarios green: `pnpm exec vitest run --project api backend/test/tenant-domains.api.test.ts backend/test/signup.api.test.ts` → 0 failures
- [ ] Arch-test green: `pnpm exec vitest run --project unit shared/src/architectural.test.ts` → 0 failures
- [ ] RLS cross-tenant isolation verified
- [ ] Rate-limit present on domains endpoints — BOTH tiers verified (general `UserThrottle` 100/min + narrow `domain-verify` 10/10min, independently)
- [ ] OAuth concurrent-race test green (true `Promise.all`, not mock — DB-level 23505 path exercised)
- [ ] Graceful-degradation test green (existing users functional after last-verified-domain removal)
- [ ] Audit-trail smoke green (at least one `audit_trail` row per domain CRUD + verify attempt)

---

## Phase 5: Frontend (Sessions 6 + 7)

> **Dependency:** Phase 2 complete (backend endpoints live).
> **Route-group rule:** Domain management is Root-only → lives under `(app)/(root)/` (ADR-012).

### Step 5.1 — `/settings/company-profile/domains` page [STATUS]

**New files:**

```
frontend/src/routes/(app)/(root)/settings/company-profile/domains/
  +page.svelte
  +page.server.ts
  _lib/
    api.ts                 # typed client for /api/v2/domains
    types.ts               # TenantDomain + response types
    state.svelte.ts        # $state facade
    state-data.svelte.ts   # domains[]
    state-ui.svelte.ts     # modal-open, pending-verify-id, etc.
    AddDomainModal.svelte
    DomainRow.svelte
    VerifyInstructionsPanel.svelte
```

**+page.server.ts** — SSR load of `GET /api/v2/domains` via `apiFetch`.

**UI flow:**

1. Table of domains: columns = domain, status badge (pending / verified / failed), is_primary, created_at, actions (Verify now / Copy TXT / Make primary / Remove).
2. "Add domain" button → modal with a single input (domain). Submit → POST.
3. Response includes `verificationInstructions` → a dedicated `VerifyInstructionsPanel` shows:

```
Add this TXT record to your DNS zone:

  Host:   _assixx-verify.firma.de
  Type:   TXT
  Value:  assixx-verify=<token>

Once set (DNS propagation can take a few minutes), click "Verify now".
```

- copy-to-clipboard button next to each value
- "Verify now" button → POST `/api/v2/domains/:id/verify` → refresh row status

4. On verify success:
   - toast "Domain verified. Your tenant is now fully active.";
   - **call `await invalidateAll()` from `$app/navigation`** (v0.3.0 S4) so `(app)/+layout.server.ts` re-fetches `GET /api/v2/domains/verification-status` and `data.tenantVerified` flips to `true` everywhere. Without this, the banner (§5.3) and the user-creation-form disabled state would stay stale until the user navigates manually.
   - user-creation routes auto-unlock (next `apiClient` call to `/users` returns 201 instead of 403).

### Step 5.2 — Signup form hardening [STATUS]

**File:** `frontend/src/routes/signup/+page.svelte` (verified 2026-04-17)
**File:** `frontend/src/routes/signup/_lib/api.ts` — `registerUser(payload)` wrapping `apiClient.post('/signup', payload)`
**File:** `frontend/src/routes/signup/_lib/constants.ts` — where `ERROR_MESSAGES` already lives

**v0.3.1 F1 — CLIENT-SIDE pattern, NOT form action.** The current signup page submits via `onsubmit={handleSubmit}` → `await registerUser(payload)` → `try/catch` with `showErrorAlert(message)` (toast-based). There is **no `+page.server.ts`** for the root signup route, and no `use:enhance`. The earlier v0.2.0/v0.3.0 "server action catches backend's 400" framing is wrong and must not be implemented — it would silently introduce a Form-Actions layer under a page that doesn't use them.

**Correct integration (three changes, all in `_lib/api.ts` + `constants.ts` + optional UI polish):**

1. **`_lib/constants.ts`** — add the code-to-German-message table next to the existing `ERROR_MESSAGES`:

```typescript
// Email-validation error codes emitted by backend signup validation
// (validateBusinessEmail, §2.3). Three codes — no DOMAIN_NO_MX, §0.2.5 #6.
export const EMAIL_VALIDATION_MESSAGES: Record<string, string> = {
  INVALID_FORMAT: 'Bitte gib eine gültige E-Mail-Adresse ein.',
  DISPOSABLE_EMAIL: 'Wegwerf-E-Mail-Adressen sind nicht erlaubt. Bitte nutze Deine Firmen-E-Mail.',
  FREE_EMAIL_PROVIDER: 'Bitte nutze Deine Firmen-E-Mail-Adresse. Gmail, Outlook, GMX & Co. sind nicht erlaubt.',
};
```

2. **`_lib/api.ts`** — in the existing `catch` block, inspect the error for a `code` field (whatever shape `apiClient.post` surfaces — Phase 0 Step 0.5 records the real field name; likely `err.code` OR `err.response?.data?.error?.code` depending on wrapper):

```typescript
// Pseudocode — the exact property path comes from Phase 0 Step 0.5 verification.
export async function registerUser(payload: RegisterPayload): Promise<RegisterResponse> {
  try {
    return await apiClient.post<RegisterResponse>('/signup', payload, { useAuth: false });
  } catch (err: unknown) {
    const code = extractValidationCode(err); // returns 'INVALID_FORMAT' | ... | undefined
    if (code !== undefined && code in EMAIL_VALIDATION_MESSAGES) {
      throw new Error(EMAIL_VALIDATION_MESSAGES[code], { cause: err });
    }
    const message = err instanceof Error && err.message !== '' ? err.message : ERROR_MESSAGES.registrationFailed;
    throw new Error(message, { cause: err });
  }
}
```

3. **`+page.svelte`** — NO change needed. The existing `handleSubmit` catch-handler already calls `showErrorAlert(message)` with the thrown message. The German email-validation message rides through untouched.

**If Phase 0 decides an INLINE field error (below the email input) is better UX than the toast** — that is a scope-extension and must be called out explicitly. Default: toast matches the page's existing conventions (no new components, no new CSS, no Svelte-state plumbing).

**Out of scope for v0.3.1:** introducing `+page.server.ts` + Form Actions to refactor the signup page to server-driven submission. That would be a separate architectural decision, not a requirement of this masterplan.

### Step 5.3 — Unverified-tenant banner + user-creation guards [STATUS]

Two UI points:

1. **Global banner** on any page for a root of an unverified tenant:

```
Deine Firmen-Domain ist noch nicht verifiziert.
Benutzer können erst angelegt werden, nachdem Du Deine Domain bestätigt hast.
[Jetzt verifizieren] (link to /settings/company-profile/domains)
```

- Banner dismissable per-session but not permanent; re-appears on next login until verified.
- `(app)/+layout.server.ts` fetches `GET /api/v2/domains/verification-status` (§2.7, Q8 decision) once per navigation and returns `tenantVerified: boolean` in the layout's `data`. Root-layout component reads `data.tenantVerified` and renders the banner when `false`.
- Endpoint is Root+Admin readable. Employees never see the banner (no user-creation UI anyway).

2. **User-creation forms** (admin-create, employee-invite etc.) when tenant is unverified:

- Submit button disabled.
- Tooltip: "Verifiziere zuerst Deine Firmen-Domain unter /settings/company-profile/domains."
- Even if the frontend misses this guard, the backend returns 403 `TENANT_NOT_VERIFIED` — frontend catches and shows the message.

### Step 5.4 — Frontend tests (v0.3.4 D30 — MANDATORY) [STATUS]

> **Why this step exists:** v0.3.3 and earlier versions of this plan contained ZERO frontend tests for a feature that adds 9 files including three reactive Svelte-5 state facades and a cross-page `invalidateAll()` race. The v0.3.4 audit flagged this as a **critical gap**. Frontend tests are not a nice-to-have for this feature — the UX contract (banner disappears after verify, user-create button unlocks in the same tab without manual reload) lives entirely in the frontend and cannot be covered by Phase 3/4 backend tests.

**Scope (minimal but load-bearing):** 1 state-facade unit test + 1 signup client-side-validation unit test + 1 Playwright happy-path E2E. Not exhaustive component testing — the goal is to pin the contracts that would silently break without coverage.

#### 5.4.1 — State-facade unit test (`frontend-unit` project)

**File:** `frontend/src/routes/(app)/(root)/settings/company-profile/domains/_lib/state.test.ts`

- [ ] **`state-data.svelte.ts` — addDomain() happy path:** initial state has 1 pending domain from signup. Call `addDomain({ domain: 'firma.de' })` with mocked `api.ts` that resolves with the freshly-created row + `verificationInstructions`. Assert: (a) `domains` array grows from 1 → 2, (b) the new row has `status === 'pending'`, `is_primary === false`, (c) `pendingInstructionsFor` UI state (if present in `state-ui.svelte.ts`) points at the new row.
- [ ] **`state-data.svelte.ts` — verify() success flips status:** seed the store with one pending row. Call `verify(rowId)` with mocked `api.ts` that resolves `{ verified: true }`. Assert: (a) the row's `status` flips to `'verified'`, (b) `verified_at` is set, (c) `tenantVerified` derived-getter (if on the facade) returns `true`.
- [ ] **`state-ui.svelte.ts` — modal open/close isolation:** open `AddDomainModal`, close it, assert `$state` resets (no leaked form fields). Svelte 5 `$state` is NOT automatically reset on unmount — this pins the "reset on close" contract.
- [ ] **`state-data.svelte.ts` — removeDomain() last-verified side-effect:** seed with one verified row. Call `removeDomain(rowId)` with mocked api. Assert `tenantVerified` derived-getter flips `true` → `false`. This is the frontend-side assertion for the backend-side Phase 4 graceful-degradation contract.

#### 5.4.2 — Signup client-side error-mapping unit test (`frontend-unit` project)

**File:** `frontend/src/routes/signup/_lib/api.test.ts`

- [ ] **Error-code → German-message mapping (§5.2, v0.3.1 F1):** mock `apiClient.post` to reject with each of the three codes (`INVALID_FORMAT`, `DISPOSABLE_EMAIL`, `FREE_EMAIL_PROVIDER`). Call `registerUser(payload)`. Assert the rejection's `message` equals `EMAIL_VALIDATION_MESSAGES[code]` from `constants.ts` — byte-identical German string. Guards against a code-drift between backend DTO error codes and frontend message table (e.g., a backend rename from `FREE_EMAIL_PROVIDER` → `FREEMAIL_PROVIDER` would silently fall through to a generic error today).
- [ ] **Unknown code fallback:** reject with code `TOTALLY_NEW_CODE_2027` → rejection message falls back to a generic "Unerwarteter Fehler, bitte Support kontaktieren" (or whatever the existing generic fallback is). Asserts we don't crash on unknown codes.

#### 5.4.3 — Playwright happy-path E2E (single test, covers the `invalidateAll()` contract)

**File:** `e2e/tenant-domain-verification.spec.ts`

> **Dependency:** uses the pre-verified test-tenant seed from Phase 1 Step 1.3 — but this E2E needs an **unverified** tenant specifically, so Phase 1 must also seed one unverified test tenant (`unverified-e2e.test` root user).

- [ ] Happy-path walk-through:
      (1) Log in as the root of the unverified test tenant → Dashboard.
      (2) **Assert banner is visible** on Dashboard: locator with text matching "Firmen-Domain ist noch nicht verifiziert".
      (3) Navigate to a user-management page (e.g., `/admins` or wherever admin-create lives).
      (4) **Assert the "Create user" submit button is disabled** + tooltip visible on hover contains "Verifiziere zuerst Deine Firmen-Domain".
      (5) Navigate to `/settings/company-profile/domains`.
      (6) Click the "Verify now" button on the seeded pending row. **Mock DNS resolution** via a Playwright `route()` handler on `POST /api/v2/domains/:id/verify` that returns `{ verified: true }` (full backend DNS stack is mocked at the API layer for determinism — this is NOT an integration test).
      (7) **Assert the success toast** appears with text "Domain verified. Your tenant is now fully active." (or the actual German equivalent).
      (8) **Assert `invalidateAll()` fired** — the banner disappears from the CURRENT tab WITHOUT a manual reload. This is the single most important assertion of the whole E2E — it locks in the v0.3.0 S4 fix.
      (9) Navigate back to the user-management page.
      (10) **Assert the "Create user" submit button is now enabled** + tooltip gone.
      (11) Actually create a user (fill the form, submit) → 201 response, user appears in the list.
- [ ] Run in both Chromium and WebKit (Firefox optional) to catch Safari-specific layout-invalidation bugs in Svelte-5 state propagation.

#### 5.4 — Definition of Done

- [ ] `pnpm exec vitest run --project frontend-unit frontend/src/routes/(app)/(root)/settings/company-profile/domains/_lib/state.test.ts` → green
- [ ] `pnpm exec vitest run --project frontend-unit frontend/src/routes/signup/_lib/api.test.ts` → green
- [ ] `pnpm exec playwright test e2e/tenant-domain-verification.spec.ts` → green in Chromium + WebKit
- [ ] E2E specifically asserts `invalidateAll()` is effective (banner disappears in-tab)
- [ ] E2E does NOT hit real DNS — all mocked at the API route level

### Phase 5 — Definition of Done

- [ ] `/settings/company-profile/domains` fully functional end-to-end (add / verify / primary / remove).
- [ ] Signup error-handler wired in `_lib/api.ts` (v0.3.1 F1 — client-side, NOT form action) with 3 failure codes (`INVALID_FORMAT`, `DISPOSABLE_EMAIL`, `FREE_EMAIL_PROVIDER` — `DOMAIN_NO_MX` removed, see §0.2.5 #6). Manual smoke: submit with `x@gmail.com` → toast shows German `FREE_EMAIL_PROVIDER` message, no browser console errors, no `+page.server.ts` introduced.
- [ ] Unverified-banner visible on every root-facing page (until dismissed for session).
- [ ] User-creation forms disabled + tooltip.
- [ ] **Step 5.4 frontend tests all green** (v0.3.4 D30): state-facade unit + signup-api unit + Playwright happy-path E2E.
- [ ] svelte-check: 0 errors, 0 warnings.
- [ ] ESLint: 0 errors.
- [ ] German UI text with `ä / ö / ü / ß`.
- [ ] Design-system components only (no custom CSS).
- [ ] Works on dev (`:5173`) AND production (`:80`).

---

## Phase 6: Integration, ADR, Docs (Session 8)

### Integrations

- [ ] End-to-end smoke in dev + production:
  - Sign up as new root with `root@firma-a.test` → lands on verify page.
  - Add real DNS TXT record (via `unbound` / local resolver override or via a controlled test domain) → click verify → becomes verified.
  - User-creation now unlocks; create admin + employee successfully.
  - Attempt signup with `gmail.com` → inline error.
  - Attempt signup with `mailinator.com` → inline error.
  - Attempt DELETE of only verified domain → user-creation re-locks.
- [ ] Rate-limit smoke on domains endpoint.

### Documentation

- [ ] **ADR-048** written: "Tenant Domain Verification". Sections: threat model, single-gate KISS design + mandatory arch-test (§0.2.5 #14), layered email validation (committed freemail list + disposable via `mailchecker`, NO MX/SMTP at signup), SMTP-probe explicitly disabled, **freemail-list sourcing rationale** (no wrapper lib — direct JSON-commit from `Kikobeats/free-email-domains` upstream; see §0.2.5 #12), monthly sync script, clean-slate migration, sequencing-precedence before ADR-047 (Forgot-PW), single-root-mailbox-loss limitation (Known Limitation #10), **OAuth auto-verify decision** (§0.2.5 #17, v0.3.0 G1 — Azure AD is the trust boundary on the `registerTenantWithOAuth` bootstrap path; `tenant_domains(verified)` is seeded directly, no DNS-TXT dance).
- [ ] `FEATURES.md` updated: add "Tenant Domain Verification" entry in security section.
- [ ] `docs/how-to/HOW-TO-INTEGRATE-FEATURE.md` updated with a one-line note: "New user-creation endpoints MUST call `tenantVerification.assertVerified(tenantId)`."
- [ ] Docstring on `validateBusinessEmail()` + `DomainVerificationService` references the ADR.
- [ ] Customer-facing onboarding doc: how to set a DNS TXT record (agnostic: AWS Route53, Cloudflare, GoDaddy; one screenshot per provider).

### Phase 6 — Definition of Done

- [ ] All E2E smoke paths verified in dev + production.
- [ ] **ADR-048** status "Accepted".
- [ ] `FEATURES.md` + HOW-TO updated.
- [ ] Customer-facing DNS guide drafted.
- [ ] Masterplan version → 2.0.0.
- [ ] Signal to Plan 1 (ADR-047) team: "Domain Verification merged; Plan 1 unblocked" — Plan 1's §0.1 prerequisite depends on this.

---

## Session Tracking

| Session | Phase | Description                                                                                | Status | Date |
| ------- | ----- | ------------------------------------------------------------------------------------------ | ------ | ---- |
| 1       | 0     | Current-state analysis: signup flow, user-creation endpoints, dep check, DNS capability    |        |      |
| 2       | 1     | Backup, clean-slate wipe, migration, seed regeneration                                     |        |      |
| 3       | 2     | Module skeleton, types, validator wrapper, DomainVerificationService, DomainsService       |        |      |
| 4       | 2     | TenantVerificationService, Controller, signup hardening, user-creation wiring, ESLint rule |        |      |
| 5       | 3 + 4 | Unit tests (≥ 30) + API integration tests (≥ 25)                                           |        |      |
| 6       | 5     | Frontend: settings page + signup-form hardening                                            |        |      |
| 7       | 5     | Frontend: unverified banner + user-creation-guard messages                                 |        |      |
| 8       | 6     | E2E smoke + ADR + docs + customer-facing DNS guide                                         |        |      |

### Session log template

```markdown
### Session N — YYYY-MM-DD

**Goal:** …
**Result:** …
**New files:** …
**Changed files:** …
**Verification:**

- ESLint: 0 errors
- Type-check: 0 errors
- Tests: N / N passed
  **Deviations:** …
  **Next session:** …
```

---

## Quick Reference: File Paths

### Database

| File                                                 | Purpose                              |
| ---------------------------------------------------- | ------------------------------------ |
| `database/migrations/{utc}_create-tenant-domains.ts` | Create `tenant_domains` + ENUM + RLS |
| `database/seeds/*` (regenerate)                      | Pre-verified test tenants            |

### Backend (new)

| File                                                        | Purpose                                                                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `backend/src/nest/domains/domains.module.ts`                | Module registration                                                                                |
| `backend/src/nest/domains/domains.controller.ts`            | CRUD endpoints, Root-only                                                                          |
| `backend/src/nest/domains/domains.service.ts`               | Domain CRUD (tenant-scoped)                                                                        |
| `backend/src/nest/domains/domain-verification.service.ts`   | TXT-token gen + DNS lookup                                                                         |
| `backend/src/nest/domains/tenant-verification.service.ts`   | `assertVerified()` helper                                                                          |
| `backend/src/nest/domains/email-validator.ts`               | Central `validateBusinessEmail()` + `validateBusinessDomain()` wrappers (Set-lookup + mailchecker) |
| `backend/src/nest/domains/data/freemail-domains.json`       | Committed freemail list (Kikobeats upstream, MIT, ~6000 entries)                                   |
| `backend/src/nest/domains/data/LICENSE.freemail-domains.md` | MIT-license attribution for the committed JSON                                                     |
| `scripts/sync-freemail-list.ts`                             | Pulls upstream JSON, prints diff, never auto-commits (manual `pnpm run sync:freemail`)             |
| `backend/src/nest/domains/domains.types.ts`                 | Row + API types                                                                                    |
| `backend/src/nest/domains/dto/add-domain.dto.ts`            | Zod DTO                                                                                            |
| `backend/src/nest/domains/dto/verify-domain.dto.ts`         | Zod DTO                                                                                            |
| `backend/src/nest/domains/dto/index.ts`                     | Barrel                                                                                             |
| `backend/src/nest/domains/*.test.ts`                        | Unit tests                                                                                         |
| `backend/test/tenant-domains.api.test.ts`                   | API integration                                                                                    |

### Backend (modified)

| File                                             | Change                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/nest/app.module.ts`                 | Import `DomainsModule`                                                                                                    |
| `backend/src/nest/signup/signup.service.ts`      | `registerTenant()` (NOT `signup()`): call `validateBusinessEmail()`, seed `tenant_domains` row                            |
| `backend/src/nest/signup/signup.service.test.ts` | New test cases for blocked signups                                                                                        |
| Every user-creation service (Phase 0 list)       | Call `tenantVerification.assertVerified(tenantId)` at entry — enforced by arch-test §2.11                                 |
| `shared/src/architectural.test.ts`               | NEW rule: every `INSERT INTO users` in service files must be preceded by `assertVerified(` unless allowlisted — see §2.11 |
| `backend/package.json`                           | Add `mailchecker` (only runtime dep)                                                                                      |
| `package.json` (root)                            | Add `"sync:freemail": "tsx scripts/sync-freemail-list.ts"` script                                                         |
| `eslint.config.mjs` (backend section)            | `no-restricted-imports` for `freemail-domains.json` — all access must go through the wrapper (see §2.10)                  |

### Frontend (new)

| File                                                                                | Purpose                         |
| ----------------------------------------------------------------------------------- | ------------------------------- |
| `frontend/src/routes/(app)/(root)/settings/company-profile/domains/+page.svelte`    | Main page                       |
| `frontend/src/routes/(app)/(root)/settings/company-profile/domains/+page.server.ts` | SSR load                        |
| `frontend/src/routes/(app)/(root)/settings/company-profile/domains/_lib/*`          | api / types / state / sub-comps |

### Frontend (modified)

| File                                                           | Change                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/routes/signup/_lib/api.ts` + `_lib/constants.ts` | **v0.3.1 F1 correction** — inline error mapping for 3 validation failure codes in client-side `catch` block. No `+page.server.ts` introduced (signup page does NOT use Form Actions — verified `handleSubmit` → `apiClient.post` pattern). `+page.svelte` stays untouched; existing `showErrorAlert(message)` in its catch-handler displays the mapped German message via toast. |
| `frontend/src/routes/(app)/+layout.server.ts`                  | Load `tenantVerified` flag for banner                                                                                                                                                                                                                                                                                                                                            |
| `frontend/src/routes/(app)/+layout.svelte`                     | Render "domain not verified" banner                                                                                                                                                                                                                                                                                                                                              |
| Every user-creation form component                             | Disable submit + tooltip when tenant unverified                                                                                                                                                                                                                                                                                                                                  |

---

## Spec Deviations (from assumptions during drafting)

Phase 0 may surface additional deviations. Populate as they appear:

| #   | v0.1.x assumption                                                                                                              | Reality                                                                                                                                                                                                                                                                                                                                                                      | Decision                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Migration uses `uuid_generate_v7()`                                                                                            | PG 18.3 native function is `uuidv7()` (verified via `pg_proc`; see migration `20260416135731342_uuidv7-defaults-cleanup.ts`). `uuid_generate_v7` does NOT exist.                                                                                                                                                                                                             | **v0.2.0: fixed** — `DEFAULT uuidv7()` in §1.1.                                                                                                                                                                                                                                                                                                |
| D2  | Signup service method is `signup(dto)`                                                                                         | Actual signature: `registerTenant(dto: SignupDto, ipAddress?: string, userAgent?: string): Promise<SignupResponseData>` at `signup.service.ts:75`.                                                                                                                                                                                                                           | **v0.2.0: fixed** — §2.8 anchors real name + full signature.                                                                                                                                                                                                                                                                                   |
| D3  | Add-domain reuses `validateBusinessEmail()` via `root@<domain>` synthesis                                                      | Code smell; mailchecker exposes a domain-friendly path via `MailChecker.isValid('x@<dom>')`; dedicated helper is KISS.                                                                                                                                                                                                                                                       | **v0.2.0 (Q7):** dedicated `validateBusinessDomain(domain)` helper in §2.3.                                                                                                                                                                                                                                                                    |
| D4  | Frontend banner flag derived from `/auth/me` piggyback                                                                         | Mixing auth concerns with addon/verification state is less clean; dedicated endpoint is independently cacheable.                                                                                                                                                                                                                                                             | **v0.2.0 (Q8):** NEW `GET /api/v2/domains/verification-status` endpoint.                                                                                                                                                                                                                                                                       |
| D5  | R7 mitigation "Arch-test can be added later"                                                                                   | Missing-gate is the highest-impact bug class in this plan; deferring is not best-practice.                                                                                                                                                                                                                                                                                   | **v0.2.0 (Q4):** arch-test MANDATORY in Phase 2 DoD; R7 probability Medium → Low.                                                                                                                                                                                                                                                              |
| D6  | Clean-slate via `DELETE FROM tenants`                                                                                          | `TRUNCATE RESTART IDENTITY CASCADE` in a transaction is faster, resets sequences, fits user's "truncate OK" directive.                                                                                                                                                                                                                                                       | **v0.2.0 (Q11):** §1.0 wipe method rewritten; backup still mandatory.                                                                                                                                                                                                                                                                          |
| D7  | Frontend §5.2 `messagesByCode` contains `DOMAIN_NO_MX`                                                                         | v0.1.1 removed MX check at signup; stale reference survived in Phase 5.                                                                                                                                                                                                                                                                                                      | **v0.2.0:** `DOMAIN_NO_MX` removed; DoD clarifies 3 codes.                                                                                                                                                                                                                                                                                     |
| D8  | §0.1 prerequisites list Phase-0/2 tasks (JSON commit, dep install, sync script)                                                | Conflates "must be true before starting" with "Phase work".                                                                                                                                                                                                                                                                                                                  | **v0.2.0:** §0.1 cleaned to true invariants only; tasks stay in Phase 0.4 and Phase 2.                                                                                                                                                                                                                                                         |
| D9  | v0.2.0 arch-test allowlist lists only `registerTenant`                                                                         | `signup.service.ts:405` `registerTenantWithOAuth` is a SECOND bootstrap path (ADR-046 merged on `main` via commit `5cd293ae8`) that also does `INSERT INTO users` at line 529.                                                                                                                                                                                               | **v0.3.0 G1:** Allowlist expanded to BOTH methods; OAuth signup seeds `tenant_domains(verified)` directly (§0.2.5 #17, §2.8b).                                                                                                                                                                                                                 |
| D10 | v0.2.0 §0.2.5 #15 "dedicated helper eliminates synthetic-email trickery"                                                       | Impl at §2.3 uses `MailChecker.isValid('x@' + domain)` internally — same synthesis, now encapsulated.                                                                                                                                                                                                                                                                        | **v0.3.0 G6:** Reworded to honest framing — wrapper encapsulates the synthesis, caller sees a bare-domain signature. Benefit is API hygiene, not synthesis elimination.                                                                                                                                                                        |
| D11 | v0.2.0 R2 "3 s DNS timeout" was prose-only                                                                                     | §2.4 impl used naked `dns.resolveTxt` — Node default is 10 s × up-to-4 tries.                                                                                                                                                                                                                                                                                                | **v0.3.0 S1:** Per-call `Resolver({timeout, tries:1})` + `Promise.race(query, timeout(3000))` enforce the bound.                                                                                                                                                                                                                               |
| D12 | v0.2.0 §5.1 "toast on verify success, user-creation auto-unlocks"                                                              | Frontend `data.tenantVerified` is cached per navigation — no auto-refresh without explicit invalidation.                                                                                                                                                                                                                                                                     | **v0.3.0 S4:** Explicit `await invalidateAll()` after verify-success; banner and form guards both refresh.                                                                                                                                                                                                                                     |
| D13 | v0.2.0/v0.3.0 §5.2 "Server action catches backend's 400 response with `code` field"                                            | `frontend/src/routes/signup/+page.svelte:128-192` is CLIENT-SIDE: `handleSubmit` → `registerUser(payload)` → `apiClient.post('/signup')` → `catch { showErrorAlert(message) }`. No `+page.server.ts`, no `use:enhance`. The "server action" framing would silently introduce a Form-Actions layer under a page that doesn't use them.                                        | **v0.3.1 F1:** §5.2 rewritten. Integration goes into `_lib/api.ts` catch-block + `_lib/constants.ts` `EMAIL_VALIDATION_MESSAGES` table. `+page.svelte` unchanged.                                                                                                                                                                              |
| D14 | v0.3.0 §2.11 allowlist hard-coded to "exactly TWO entries" (`registerTenant`, `registerTenantWithOAuth`)                       | `grep 'INSERT INTO users' backend/src/nest` returns 7 hits across 6 files. A third private helper — `auth.service.ts:631` `AuthService.createUser(data)` called from `:269` — sits outside the signup module and was not acknowledged. Arch-test as drafted would either pass (if helper is allowlisted) or fail (if not) without clear guidance.                            | **v0.3.1 A1:** §2.11 reframed — allowlist content is Phase-0 enumeration-driven, not a compile-time constant. Added the full 7-hit landscape table. Default remediation for `AuthService.createUser`: inject `TenantVerificationService` + `assertVerified` in the helper itself (cheapest, no allowlist growth). §0.2.5 #14 updated to match. |
| D15 | v0.2.0 Step 1.0 "3 test tenants pre-wipe: apitest, testfirma, foreigninv"                                                      | DB as of 2026-04-17 has **5 tenants**: the original 3 plus `scs` and `oauth-happy-1776372986050` added by OAuth testing after v0.2.0 was drafted.                                                                                                                                                                                                                            | **v0.3.1 T1:** §1.0 description updated — `TRUNCATE CASCADE` wipes all regardless of count, but the plan must re-verify the tenant list the day Phase 1 runs. Added verification command.                                                                                                                                                      |
| D16 | v0.3.1 §2.6 `isVerified()` used `db.query(...)` and claimed "CLS auto-filters via RLS"                                         | `database.service.ts:36` docstring: `query()` "Does NOT set RLS context — use transaction() for tenant-isolated queries". Live probe: `app_user` SELECT without `SET app.tenant_id` returned 0 users. Plan-as-drafted would have deadlocked every user-creation behind a permanent 403.                                                                                      | **v0.3.2:** §2.6 rewritten around `db.queryAsTenant(sql, params, tenantId)`; misleading CLS-auto-filter note replaced with a WHY comment citing ADR-019 §6b + database.service.ts:36.                                                                                                                                                          |
| D17 | v0.3.1 §1.1 `idx_tenant_domains_domain_verified` was `CREATE INDEX` (non-unique); §2.5 claimed it "enforced" global uniqueness | Non-unique partial index provides lookup speed, not a uniqueness constraint. A concurrent OAuth-seed-verified + password-DNS-verified race could produce two tenants owning the same verified domain (most acute scenario: Company X has both OAuth-signed-up tenant A and password-signed-up tenant B on the same domain; B's root proves DNS while A is already verified). | **v0.3.2:** §1.1 promoted to `CREATE UNIQUE INDEX`; §2.5 rewritten so DB is the final arbiter and the service catches PG error `23505` → `ConflictException({ code: 'DOMAIN_ALREADY_CLAIMED' })`.                                                                                                                                              |
| D18 | v0.3.1 §2.7 "rate-limited via `@Throttle()` default"                                                                           | `throttle.decorators.ts:12` enumerates `AuthThrottle` / `UserThrottle` / `AdminThrottle` / `ExportThrottle` — no generic "default". Domains endpoints mix cheap reads with a DNS-triggering `/verify` action; one-size-fits-all is wrong.                                                                                                                                    | **v0.3.2:** §2.7 endpoint table specifies per-endpoint tier: `UserThrottle` for reads / writes / primary-toggle / delete; NEW `domain-verify` named tier (10 req / 10 min) on `POST /:id/verify` to bound outbound DNS (R11 mitigation teeth).                                                                                                 |
| D19 | v0.3.1 §2.11 arch-test regex `INSERT INTO users\b`                                                                             | Matches only single-line SQL. Current grep shows all 7 hits single-line, but a reformat of a long INSERT onto multiple lines (`INSERT INTO\n  users (...)`) would silently bypass the gate.                                                                                                                                                                                  | **v0.3.2:** regex changed to `/INSERT\s+INTO\s+users\b/gis` (dotall + `\s+`) so multi-line SQL is caught.                                                                                                                                                                                                                                      |
| D20 | v0.3.1 §2.8 Step 5 + Phase 2 DoD said "exactly TWO allowed bypasses" / "allowlist contains exactly TWO entries"                | v0.3.1 A1 §2.11 already walked back to "Phase 0 enumeration drives the final content", but two other wording spots weren't aligned. Internal contradiction that would confuse the Phase 2 implementer.                                                                                                                                                                       | **v0.3.2:** §2.8 Step 5 + Phase 2 DoD re-worded to "Phase-0-enumerated, minimum two (password + OAuth bootstrap); any further addition reviewed in the same PR that introduces it."                                                                                                                                                            |
| D21 | v0.3.2 §2.8b OAuth seeder did a bare `client.query` INSERT without a uniqueness-conflict catch                                 | Direct consequence of v0.3.2's UNIQUE-index promotion: a Microsoft OAuth signup onto a domain already verified by another Assixx tenant would crash the signup with a raw PG `23505` surfacing as 500. The normal add-domain flow (§2.5) had the `23505 → ConflictException` mapping; the OAuth-bootstrap path silently lacked it.                                           | **v0.3.3:** §2.8b seeder wrapped in try/catch that maps `DatabaseError` with `code === '23505'` to `ConflictException({ code: 'DOMAIN_ALREADY_CLAIMED' })` with a German user-facing message. Phase 3 unit test + Phase 4 API test mandates added so the conflict path is actually exercised.                                                  |
| D22 | v0.3.3 Phase 3 `TenantVerificationService.isVerified` tests only asserted the return value                                     | Exactly the v0.3.2-caught regression (`db.query` → RLS-strict → 0 rows → permanent 403) could silently return after a future refactor. The return-value test would still pass when the wrong DB method is called and the test's mock happens to return the right tuple shape.                                                                                               | **v0.3.4:** Added Phase 3 spy-based test that asserts `db.queryAsTenant` was called and `db.query` was NOT. Failure message explicitly references the v0.3.2 regression so future readers see the context.                                                                                                                                    |
| D23 | v0.3.2 §2.11 regex was extended to `/INSERT\s+INTO\s+users\b/gis` (multi-line), but no plan to enumerate existing false-positive matches | A blanket regex over `backend/src/nest/**/*.service.ts` can match inline SQL comments, JSDoc-style examples, the arch-test's own source file (which contains the regex as a string), and test fixtures. If any such match exists on merge, the first post-merge PR goes red and everyone's confused.                                                                         | **v0.3.4:** New Phase 0 Step 0.8 enumerates every textual match before the arch-test ships. Each hit categorized (real / comment / docstring / self-reference) and resolved via scope-filter, comment-rewrite, or regex tightening. Arch-test on `main` MUST be green with zero unresolved hits before Phase 2 merges.                          |
| D24 | v0.3.3 Phase 3 had no test for IDN / Unicode-to-Punycode domain normalization                                                  | `müller.de` vs `xn--mller-kva.de` — if the `FREEMAIL_DOMAINS` Set-lookup operates on one form and `tenant_domains.domain` is stored in the other, the consistency breaks silently: a freemail domain might slip past, or a legitimate lookup finds no row.                                                                                                                  | **v0.3.4:** Added Phase 3 test that asserts stored form === lookup form via round-trip, including mixed-case + whitespace input. Final normalization strategy (Unicode vs Punycode) is an implementation decision in Phase 2; the test pins whichever choice is made.                                                                         |
| D25 | v0.3.3 Phase 3 "created atomically (transaction rollback if any fails)" stated but untested                                    | The most valuable property of the signup flow — "fail halfway → no orphan rows" — was only described in prose. A future refactor that, e.g., moves the `tenant_domains` INSERT outside the transaction would silently produce orphan tenants on failure.                                                                                                                    | **v0.3.4:** Added Phase 3 failure-injection test. Mocks each INSERT statement to throw a synthetic `DatabaseError`; asserts zero `tenants`, zero `users`, zero `tenant_addons` rows survive. Repeated for each of the three INSERTs in the chain.                                                                                              |
| D26 | v0.3.3 OAuth-conflict coverage was unit-test-only (mocked `23505`)                                                             | A mocked `23505` proves the catch-block does what it says, but not that PG actually throws `23505` under concurrent load. True race (two OAuth callbacks hitting the same domain via `Promise.all`) exercises the partial UNIQUE INDEX + MVCC path that the mock bypasses.                                                                                                   | **v0.3.4:** Added Phase 4 concurrent-race integration test. Two parallel `POST /oauth/microsoft/callback` → exactly one 201, one 409; zero orphan tenants / users. Plus a second test covering password-seed-pending + OAuth-seed-verified race, pinning whichever behavior §1.1 defines for the partial-index predicate.                      |
| D27 | v0.3.3 Phase 4 "Remove last verified domain → user-creation blocks again" did not cover existing users                         | Only blocking new creates was tested. The graceful-degradation contract — existing admin/employee users stay functional — was implicit and untested. A refactor that accidentally revoked existing users' sessions on domain removal would not fail CI.                                                                                                                     | **v0.3.4:** Added Phase 4 graceful-degradation test. Seed verified tenant, create 3 admins + 5 employees, remove last verified domain, assert those 8 users can still log in, read, and write (non-user-creation endpoints); only new `POST /users` returns 403.                                                                               |
| D28 | v0.3.2 `domain-verify` rate-limit tier (10 req / 10 min) added but only covered by the general-tier `UserThrottle` sanity test | The tier was explicitly narrower than `UserThrottle` to bound DNS cost, but the Phase 4 rate-limit assertion only tested the general tier. The narrower bound could silently regress (e.g., someone forgetting `@DomainVerifyThrottle` on `/verify`) without CI catching it.                                                                                                | **v0.3.4:** Added Phase 4 tier-specific test: 15 rapid calls to `POST /:id/verify` → 429 appears at or before the 11th call. Also added tier-isolation test: hitting `domain-verify` limit doesn't collateral-429 other domains endpoints.                                                                                                     |
| D29 | v0.3.3 §0.3 "audit_trail auto-interceptor captures domain CRUD + verification attempts automatically" was untested              | Auto-interceptor contract is easy to break by adding a new endpoint without the right decorator. No Phase 4 test asserted that `audit_trail` rows actually appear for the new domain endpoints.                                                                                                                                                                             | **v0.3.4:** Added Phase 4 audit-trail smoke test. After each of add / verify-success / verify-failure / delete, queries `audit_trail` and asserts at least one matching row exists. Single smoke, not exhaustive schema test.                                                                                                                  |
| D30 | v0.3.3 Phase 5 planned ZERO frontend tests despite 9 new files including three reactive state facades and an `invalidateAll()` race | The UX contract — "banner disappears after verify, user-create button unlocks in same tab without manual reload" — lives entirely in the frontend and cannot be covered by backend tests. v0.3.0 S4 explicitly added `invalidateAll()` to fix this, but no test locks it in. A refactor that drops the `invalidateAll()` call would silently regress the UX without CI firing. | **v0.3.4:** Added Phase 5 Step 5.4 mandating three frontend tests: (1) `state-data.svelte.ts` + `state-ui.svelte.ts` unit tests for add/verify/remove, modal state isolation, and the `tenantVerified` derived flip on last-verified removal; (2) signup `_lib/api.ts` error-code → German-message mapping unit test; (3) Playwright happy-path E2E that explicitly asserts the banner disappears in-tab after verify (the `invalidateAll()` contract). Runs in Chromium + WebKit.                              |

---

## Known Limitations (V1 — deliberately excluded)

1. **No automatic periodic re-verification.** Once verified, stays verified. A customer who deletes the TXT record keeps their verified status. V2 may add a monthly re-check background job.
2. **No auto-deletion of long-unverified tenants.** A tenant that never verifies sits idle in the DB forever. Can only create zero additional users, so abuse potential is minimal. V2 may add 30-day grace + soft-delete.
3. **Solo founders with personal Gmail are blocked** at signup. Accepted design trade-off (Assixx target is 50–500 employees).
4. **No domain allowlist for user invites.** Admins creating users are not restricted to `@firma.de`. The only gate is "tenant is verified at all". Fine-grained per-domain allowlist is V2+.
5. **No SPF/DKIM/DMARC orchestration.** Outbound email still goes through Assixx's sender domain. V2+.
6. **Committed freemail list is only as fresh as our last sync.** Accepted — `pnpm run sync:freemail` runs monthly, diff is reviewed by a human and committed. Any missed provider is a single-file Edit + unit-test away; no external wrapper to fork, no npm-dep to vendor. Upstream PR back to `Kikobeats/free-email-domains` is recommended whenever we add a provider that's also missing upstream.
7. **No MX / SMTP verification at signup.** Signup validation is synchronous list-lookup only (format + disposable + freemail). A typo-domain or an owned-but-undeliverable domain passes signup and creates a ghost tenant — caught at the TXT-verify step, cleaned up per R5. V2+ could add MX-check at signup for faster UX feedback, but would re-introduce DNS dependency + SMTP-blacklist risk (see §0.2.5 #6).
8. **Commercial email-verification APIs (Kickbox, ZeroBounce, Hunter, NeverBounce, Abstract, Mailgun Validate) are deliberately NOT used.** Evaluated but deferred to V2+:
   - **Pros:** daily-updated lists, proper SMTP verification without blacklist risk (on their IPs, not ours), scoring, B2B data enrichment.
   - **Cons:** $0.0008–0.008 per check, API dependency, outage risk, vendor lock-in.
   - **V1 uses a committed freemail list (Kikobeats upstream) + `mailchecker`** — free, instant, no outage concern, and sufficient for the freemail + disposable scope. Upgrade path is isolated to the `validateBusinessEmail()` wrapper — swapping to Kickbox later is a single-file change.
9. **Customer-facing DNS guide is minimal.** One screenshot per major provider. Comprehensive support docs are V2+.
10. **Single-root-mailbox-loss deadlock for unverified tenants (Q6).** If a freshly signed-up root loses mailbox access BEFORE completing DNS verification, the tenant is permanently locked: forgot-password mail goes to an unreachable mailbox, and without a verified domain the company's IT admin has no control over the root mailbox either. **Blast-radius: exactly 1 wasted tenant slot.** The tenant has zero users beyond the locked-out root (the whole point of the unverified gate), so the product impact is cosmetic — one DB row that cannot be accessed and cannot abuse the platform. V2 may close this via 30-day auto-soft-delete of zero-verified-tenants + optional support-runbook. V1 accepts.

---

## Post-Mortem (fill after completion)

### What went well

- (tbd)

### What went badly

- (tbd)

### Metrics

| Metric                    | Planned     | Actual |
| ------------------------- | ----------- | ------ |
| Sessions                  | 8           |        |
| Migration files           | 1           |        |
| New backend files         | ~12         |        |
| New frontend files        | ~8          |        |
| Changed files             | ~11         |        |
| Unit tests                | 35          |        |
| API tests                 | 30          |        |
| Architectural tests added | 1           |        |
| ESLint errors at release  | 0           |        |
| Spec deviations           | 21 (listed) |        |

---

**This document is the execution plan. Every session starts here, takes the next unchecked item, and marks it done. No coding starts before Phase 0 is green.**
