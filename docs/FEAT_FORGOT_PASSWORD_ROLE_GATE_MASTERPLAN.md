# FEAT: Forgot-Password Role-Gate — Execution Masterplan

> **Plan type:** FEATURE
> **Created:** 2026-04-16
> **Version:** 0.4.4 (Phase 0 complete — all anchors confirmed via code reading. Key findings: Option A+ audit mechanism chosen (2-line `isAuthEndpoint()` extension instead of strict Option A which was not viable — anonymous forgot/reset are skipped by the auto-interceptor). `trustProxy: true` already at `main.ts:284`. OAuth orthogonality grep = 0 hits. CLS `ip`/`userAgent` keys are greenfield (0 repo consumers). No Phase 2 work on `CustomThrottlerGuard` or `ActivityAction` union. Docker not started for Phase 0 — not needed, all decisions resolved via Read. 8-row concrete edit list locked in Phase 0 Deliverable Summary.)
> **Status:** PHASE 0 DONE — ready for Phase 2 (Session 2).
> **Branch:** `feat/forgot-password-role-gate`
> **Author:** Simon Öztürk (with Staff-Engineer assist)
> **Estimated sessions:** 3 (v0.4.3 Scope-Re-Cut — down from 4+0.3)
> **Actual sessions:** 1 / 3 (Phase 0 completed 2026-04-19)
> **Sequencing:** Ships AFTER `FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md` (Plan 2, ADR-048). Plan 2's Phase 1 TRUNCATE + fresh seed is the clean substrate; Plan 1 runs against pre-verified test tenants so §2.6's redemption gate is tested realistically. See §0.1 prerequisites.
> **ADR:** ADR-047 (Forgot-Password Role-Gate).

---

## Goal in Plain Words

**One sentence:**
Only `root` users may reset their own password via the public forgot-password page **and** may redeem a reset token. `admin` and `employee` users are blocked at BOTH gates (request time AND token-redemption time) — they must contact a `root` user in their company.

**Two gates, not one** (defense-in-depth, review-finding M4):

1. **Request gate (§2.1):** `/auth/forgot-password` — role-checked **before** a token is generated or a link email is sent.
2. **Redemption gate (§2.6):** `/auth/reset-password` — role-checked **again** when a token is redeemed, so a stolen / pre-existing / leaked token for an admin or employee can never be used to actually set a new password.

**Why both?** The request gate stops the common case (attacker triggers reset via the victim's mailbox). The redemption gate stops the rare but real case (attacker already has a valid token — from a DB leak, from a pre-plan-era issuance, or from an offline copy). Both gates audit-log the block. Token is burned on redemption-block so it can never be retried.

**Who is affected:**

- **Root users:** no change — same flow as today (email with reset link + token redemption).
- **Admin + Employee users:** cannot self-reset at either gate. UI shows explicit alert; email notifies account holder as paper trail; any stolen token is burned on redemption attempt with an audit entry.
- **Non-existent + inactive users** (`users.is_active !== 1`): silent drop at request gate (no mail, no audit row) — matches current code, preserves the existing no-leak contract.

**What this plan explicitly does NOT do** (tracked as separate plans):

- **Tenant domain verification** — company-owned, DNS-verified domain as the structural Break-Glass path. Tracked in `FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md`. This plan ships independently and does not block on it; the two are orthogonal.
- **MFA / TOTP on Root** — second-factor on root login + reset. Tracked in `FEAT_ROOT_MFA_MASTERPLAN.md`.

---

## Review Changes (v0.1.0 → v0.2.0)

Ground-truth verification against the actual codebase produced 11 corrections. Each was independently confirmed via Read / Glob / Grep / DB query:

| #   | v0.1.0 claim                                            | Verified reality                                                                                                                                                  | Fix in v0.2.0                                                                                     |
| --- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| B1  | Migration adds value to `audit_trail_event_type` enum   | `pg_type` shows only `audit_trail_status`. `audit_trail` uses `VARCHAR(50)` for `action` / `resource_type` — no enum exists                                       | **Phase 1 dropped entirely.** No migration. R4 removed.                                           |
| B2  | Frontend at `routes/(auth)/forgot-password/`            | Actual: `routes/forgot-password/` (no `(auth)` group)                                                                                                             | All paths fixed.                                                                                  |
| B3  | Frontend uses `apiClient.post()` + `alertState`         | Real pattern: **SvelteKit Form Actions** (`actions.default` + `use:enhance` + `ActionData`)                                                                       | Phase 5 completely rewritten.                                                                     |
| B4  | Service `forgotPassword(email, requestMeta)`            | Actual `auth.service.ts:367`: `forgotPassword(dto: ForgotPasswordDto): Promise<void>`; silent-drop is `user?.is_active !== 1`; uses `systemQuery` (sys_user pool) | §2.1 rewritten: keep `dto`, bump return to `ForgotPasswordResult`, read IP/UA from CLS (ADR-006). |
| B5  | Rate-limit test `6/60s → 429`                           | Actual: `@AuthThrottle()` = **10 req / 5 min per IP** (per `throttle.decorators.ts:12`)                                                                           | Phase 4 assertion fixed: `11 req / 5 min → 429`.                                                  |
| B6  | Template path + `.de.html` suffix                       | Real path: `backend/templates/email/`; naming: no `.de` suffix (German implicit); call: `emailService.loadBrandedTemplate('password-reset', vars)`                | §2.3 corrected to `backend/templates/email/password-reset-blocked.html`.                          |
| M1  | Assumed `ActivityAction` supports a new `'block'` value | Actual union: `'create' \| 'update' \| 'delete' \| 'login' \| 'logout' \| 'register' \| 'archive' \| 'restore' \| 'assign' \| 'unassign'` — no `'block'`          | Phase 0 picks Option A (auto-interceptor) or Option B (extend the union with `+1` literal).       |
| M2  | R5 "byte-compatible"                                    | Real shape: `{ message: string }` — no `success` field                                                                                                            | Re-worded: **additive-compatible** (old `message` stays, new fields are optional additions).      |
| M4  | Only `forgotPassword()` hardened                        | `resetPassword()` (`auth.service.ts:411`) only checks token validity — admin/employee token can bypass                                                            | **NEW §2.6**: redemption gate. Burn token + audit on non-root target.                             |
| M5  | Break-Glass debate consumed the plan                    | Domain-Verification plan now owns Break-Glass via company-IT ownership of verified domain                                                                         | §0.2.5 #7 + Known Limitations re-framed. No SRE-runbook, no Multi-Root-Mandate for this plan.     |
| —   | R7 OAuth conflict probability: Medium                   | Grep shows no `forgotPassword` / `resetPassword` references in `backend/src/nest/auth/oauth/`                                                                     | R7 Probability → **Low**.                                                                         |

---

## Changelog

| Version | Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-04-16 | Initial draft — phases outlined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 0.2.0   | 2026-04-16 | Ground-truth review applied (11 corrections above); §2.6 redemption gate added; Phase 1 dropped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 0.3.0   | 2026-04-16 | Validation-review integrated: (1) clean-break response per user rule "No backward-compat in dev" — additive framing removed, §2.2 rewritten, R5 dropped. (2) Tightened throttle: new `ForgotPasswordThrottle()` = 5 req/15 min per IP **AND** 1 req/5 min per hashed email via `CustomThrottlerGuard.getTracker()` extension. (3) CLS `ip`/`userAgent` extension MANDATORY in `ClsModule.forRoot` (verified: current setup only populates requestId/Path/Method). (4) Frontend §5.2 rewritten: merge-into-existing-markup (keep `email=$state`, `loading=$state`, `isEmailValid=$derived`, `toast toast--error` classes — NOT `alert alert--error`). (5) Deploy step: `TRUNCATE password_reset_tokens` at release (breaking response invalidates all pre-existing tokens anyway). (6) ADR number fixed: **ADR-047**. (7) Sequencing: ships AFTER Plan 2 (ADR-048). (8) DTO types `ForgotPasswordResponse` + `ResetPasswordResponse` added to change-list.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 0.4.4   | 2026-04-19 | **Phase 0 complete — Session 1 Part A.** All §0.1–§0.5 anchors confirmed via Read (Docker not needed). Key findings: (1) **Audit-mechanism Option A+ chosen** (original Option A was unviable — `audit-request-filter.service.ts:59-62` skips anonymous non-auth requests, so `/auth/forgot-password` + `/auth/reset-password` produce 0 `audit_trail` rows today). Fix: 2-line extension of `isAuthEndpoint()` in `audit.helpers.ts:240-244` to include both paths, then auto-interceptor captures HTTP metadata; block-semantic context via `logger.warn()` → Loki. No `ActivityAction`-union change, no manual `ActivityLoggerService.log()` call. (2) **`trustProxy: true` already at `main.ts:284`** — D13/v0.4.1 holds, Phase 2 work here reduced to a curl-header verification in Phase 4. (3) **OAuth orthogonality confirmed** (`grep -rE 'forgotPassword                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | password_reset | resetPassword' backend/src/nest/auth/oauth/`→ 0 matches). (4) **CLS`ip`/`userAgent`keys are greenfield** — 0 repo-wide consumers of`cls.get('ip')`/`cls.get('userAgent')`, safe to add. Exact insertion point: after `app.module.ts:138`, inside ClsModule.forRoot `setup:`callback. (5) **DTO anchors locked:**`ForgotPasswordResponse`(line 18-20 in`forgot-password.dto.ts`) gets 2 optional fields in Phase 2; `ResetPasswordResponse`unchanged (403-body is NestJS exception shape). (6) **Frontend anchors locked:**`+page.svelte:14,15,17`state runes + lines 72-85`toast toast--error`; `+page.server.ts`action at lines 17-47, merge target for`blocked`-propagation before existing `{ success: true, email }` return at line 41. 8-row concrete edit list locked in Phase 0 Deliverable Summary. Status: DRAFT → PHASE 0 DONE. Sessions: 0/3 → 1/3. |
| 0.4.3   | 2026-04-17 | **Staff-Engineer Scope-Re-Cut — three scope items dropped following user-directed KISS-pass:** (1) **Per-Email-Throttle (§2.5) DELETED.** Feature was Scope-Creep: not requested by core goal ("nur Root darf self-reset"), addresses an unreported threat (cross-IP email-flood), SMTP providers already bound outbound at infra layer, v0.4.1 had a fundamental API bug (phantom `throttlerName`), v0.4.2 had a logic bug in `authEmailTracker` (IP prefix defeated R6). The feature was sprouting bugs faster than it shipped value. Existing `@AuthThrottle()` (10 req / 5 min per IP) is retained on both `/forgot-password` and `/reset-password`. If distributed-IP email-flood becomes a real operational concern → v2-plan, single-day sprint. (2) **Clean-Break Response (§2.2) REVERTED to additive.** The v0.3.0 "clean-break" pivot misread user rule "No backward-compat in dev" — that rule prohibits keeping legacy code paths alive, not adding optional response fields. Additive shape `{ message: string, blocked?: true, reason?: 'ROLE_NOT_ALLOWED' }` is a pure API superset: old clients (which read only `message`) degrade gracefully to a generic-success display on blocked paths; new frontend reads `blocked` and renders the block-UI. No DTO migration, no test-bloat on byte-identity, no Frontend-Sync-Druck. (3) **TRUNCATE `password_reset_tokens` deploy-step (§0.2.5 #9 + Phase 6) REMOVED.** The TRUNCATE rationale was entirely "clean-break response shape means pre-existing tokens incompatible" — with (2) additive, the rationale collapses. Tokens stay valid, the redemption-gate (§2.6) burns admin/employee tokens on first redemption attempt (exactly what R9 demands), root tokens continue to redeem normally (no customer-friction from a wipe). Defense-in-depth holds without the deploy DDL. (4) **Unit test count: 15 → 10. API test count: 14 → 8.** The removed tests were all per-tier-tracker + byte-identity + per-email-throttle scenarios, which no longer exist. Core role-matrix coverage (root/admin/employee/null × active/inactive/archived/deleted × request-gate/redemption-gate) stays at 10 unit + 8 API — still belt-and-suspenders for an auth-critical path. (5) Risk register R6 / R9 / R10 updated; §0.2.5 #6 / #9 / #10 rewritten or marked superseded; Ecosystem Integration Points §0.3 throttler + token-table rows simplified; Phase 0 / 2 / 3 / 4 DoD cleaned; Quick Reference file list shrunk. (6) Spec Deviations D15–D17 (from parallel v0.4.2 review) preserved; D18 added to document this Scope-Re-Cut. |
| 0.4.2   | 2026-04-17 | **Fourth-pass validation — two ground-truth bugs caught by independent review of v0.4.1 text vs stated intent:** (1) **MAJOR — `authEmailTracker` returned `ip:${ip}:email:${digest}`** which scoped the tier to per-(IP,email), defeating R6 ("stops single-target flood even across IPs"), contradicting §0.2.5 #10's IP-agnostic intent, and making the Phase 4 test "2nd request for same email from different IPs within 5 min → 429" unachievable. Fixed: tracker now returns pure `email:${digest}` when email is present; IP-only fallback (`ip:${req.ip}`) retained for `/reset-password` where body has no email. §0.2.5 #10 description aligned. The separate `auth-ip` tier continues to handle IP-bound throttling; the two tiers are now properly orthogonal. (2) **MINOR — §0.1 claim "Plan 2's TRUNCATE tenants CASCADE will fail on this FK unless tokens are wiped first"** was WRONG — PG's TRUNCATE CASCADE propagates to ALL FK-referencing tables regardless of `ON DELETE` action (`ON DELETE RESTRICT` only affects DELETE). The follow-up claim "Plan 2's deploy runs BEFORE any tokens exist" was also wrong for dev (live DB had 122 reset-token rows as of 2026-04-17 verification). Corrected: Plan 2's clean-slate wipes reset tokens as a side-effect of TRUNCATE CASCADE; works regardless of FK action. (3) **MINOR — Known Limitation #10 added (OAuth-only root can gain local password via reset flow).** ADR-046 OAuth-only roots are not short-circuited; the happy path still issues a reset link → redemption sets a bcrypt password. V1 accepts (arguably a legitimate credential fallback); Phase 0 to confirm placeholder convention and whether ADR-046 prescribes a different path. Spec Deviations D15–D17 added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 0.4.1   | 2026-04-17 | **Third-pass validation — NestJS Throttler API verified against compiled source at `backend/node_modules/@nestjs/throttler@6.5.0`:** (1) **T1 — `CustomThrottlerGuard.getTracker()` cannot receive `throttlerName`:** compiled `throttler.guard.js` calls `getTracker(req, context)` where the 2nd arg is `ExecutionContext`, NOT `throttlerName`. The v0.3.0/v0.4.0 proposal to override with `(req, throttlerName?: string)` would compile but the `throttlerName` branch would never fire — per-email throttle silently dead. (2) **T2 — Correct API is per-tier `getTracker` in decorator options:** `Throttle({ 'auth-email': { limit, ttl, getTracker: fn } })` stores `THROTTLER_TRACKER + name` metadata (verified in compiled `throttler.decorator.js` line `setThrottlerMetadata`), guard lookup order is `route/class metadata → named-throttler option → common → class default`. (3) **§2.5 rewritten** around decorator-side per-tier closures; `CustomThrottlerGuard` stays untouched. (4) **Phase 2 DoD + Phase 3 unit tests + Quick Reference table updated** to match. (5) D14 added to Spec Deviations. (6) **P1 — `auth.service.ts:631` `private createUser()`:** independent grep shows `INSERT INTO users` in a third auth-internal helper (called from `auth.service.ts:269` — ADR-005-style authenticated registration path). NOT in Plan 1's scope (Plan 1 does not touch user creation), but noted here for cross-plan awareness with Plan 2 (ADR-048 §2.11 allowlist may need a third entry).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 0.4.0   | 2026-04-17 | **Second-pass validation integrated** (independent ground-truth on post-OAuth `main`): (1) **G2 — `password_reset_tokens` schema:** §0.1 + anchor list corrected — table has `created_at TIMESTAMPTZ DEFAULT now()` + `on_update_current_timestamp` trigger; prior doc listed only 5 columns. (2) **G3 — OAuth bypass in threat model:** new §0.2.5 #11 acknowledges that Microsoft OAuth (ADR-046, merged `5cd293ae8`) is a structural alternate-auth path for admin/employee — they can sign in via Azure AD without ever hitting forgot-password. Plan 1 remains correct (role-gate on password reset) but ADR-047 writeup must acknowledge OAuth-only accounts exist; blocked-email template gets an OAuth-aware variant (deferred to V2, Known Limitation #8). (3) **S3 — per-email throttle on `/reset-password`:** §2.5 + new note — `/reset-password` body has no `email` field, so the per-email tracker falls back to IP-only on that endpoint. Per-IP 5/15min remains; per-email 1/5min is a REQUEST-GATE-ONLY control. (4) **S5 — Fastify `trustProxy`:** Phase 0 Step 0.1 + §0.3 — must verify `main.ts` configures `trustProxy: true` before §2.1 relies on `req.ip` for logging; otherwise blocked-email logs show Nginx IP (`172.x`). (5) **G7 — TRUNCATE deploy-step:** Phase 6 clarified — runs as `assixx_user` (not `app_user`, lacks DDL). (6) **W1 — R5 cleanup:** Spec-Deviation D7 tidied, no more stale R5 reference. (7) **G11 — existing-token burn on request-gate:** §2.1 clarified — blocked path does NOT invalidate admin/employee's pre-existing unused tokens; the redemption gate in §2.6 catches any attempted redemption AND the Phase 6 TRUNCATE wipes the slate. Defense-in-depth holds.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 1.0.0   | YYYY-MM-DD | Phase 2 complete — backend done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 1.1.0   | YYYY-MM-DD | Phase 3 complete — unit tests green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 1.2.0   | YYYY-MM-DD | Phase 4 complete — API integration tests green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 1.3.0   | YYYY-MM-DD | Phase 5 complete — frontend done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2.0.0   | YYYY-MM-DD | Phase 6 complete — ADR-047 written, shipped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must be true before starting

- [ ] Docker stack healthy (backend, postgres, redis, deletion-worker).
- [ ] Branch `feat/forgot-password-role-gate` checked out from post-Plan-2 `main`.
- [ ] **Plan 2 (Domain Verification) shipped + merged + tagged.** Plan 2's Phase 1 TRUNCATE + pre-verified test-tenant seed is the clean substrate this plan builds on. If Plan 2 is not merged → STOP.
- [ ] Post-Plan-2 DB has at least 2 pre-verified test tenants with root + admin + employee users (seed from Plan 2 Phase 1 Step 1.3).
- [ ] No pending migrations blocking.
- [ ] Plan v0.4.0 reviewed and signed off.
- [ ] Phase 0 complete (Session 1).

### 0.2 Risk Register (post-review)

| #       | Risk                                                                  | Impact     | Probability | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Verification                                                                                                                        |
| ------- | --------------------------------------------------------------------- | ---------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| R1      | Role enumeration via differentiated UI response                       | Medium     | Low         | (a) Existing `@AuthThrottle()` = 10 req / 5 min per IP (v0.4.3 — per-email tier deferred to v2, §0.2.5 #10). (b) Silent-drop for non-existent **and** inactive preserved. (c) Product-accepted tradeoff: UX clarity > enumeration risk. (d) Root happy-path + silent-drop paths return byte-identical bodies (`{ message }` only); blocked path adds `blocked: true` which is visible only to attackers who already know the target is an existing admin/employee — low enumeration uplift.                                                                                                   | Phase 4 tests: 11th req/5min from same IP → 429 (existing `@AuthThrottle()` limit); byte-identity of root vs silent-drop assertion. |
| R2      | Blocked-mail template missing / mis-rendered                          | High       | Low         | API integration test: POST with admin email → assert outbound mail matches template + variables (`firstName`, `ip`, `timestamp`)                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Phase 4 API test + Phase 6 dev-SMTP smoke.                                                                                          |
| R3      | Role field null / unexpected → admin slips through                    | High       | Low         | Secure default: any value **not** the literal `'root'` is blocked. Unit test covers null + unexpected.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Phase 3 unit test.                                                                                                                  |
| R6      | Email flood via repeated abuse                                        | Low        | Low         | **v0.4.3:** per-email throttle deferred to v2 (§0.2.5 #10). v1 coverage: (a) existing `@AuthThrottle()` (10/5min per IP) bounds single-IP flood; (b) outbound SMTP provider (SendGrid/Mailgun) applies sender-level rate-limits — infra-layer cap on outbound message volume; (c) the blocked-email itself notifies the admin that someone is attempting to reset their password → attack is self-defeating once the admin pays attention. Residual risk: distributed-IP flood bypasses (a) and stresses only (b); accepted for v1. v2 reintroduces per-email tier if real incidents surface. | Phase 4 API test: single-IP 10/5min limit. v2 backlog item tracked in ADR-047.                                                      |
| R7      | In-flight OAuth refactor collides with `auth.service.ts` changes      | Low        | None        | ✅ OAuth shipped as ADR-046 before this plan starts. `auth.service.ts:367` / `:411` re-verified as Plan-1 anchors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Re-verified at Phase 0 start.                                                                                                       |
| R8      | Blocked-mail flagged as spam                                          | Low        | Low         | Reuse existing sender / envelope / branded-template style (`password-reset.html` as peer).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Phase 6 smoke to Outlook + Gmail.                                                                                                   |
| R9      | Stolen / pre-existing admin token redeemed via `/auth/reset-password` | High       | Low         | **v0.4.3:** TRUNCATE deploy-step removed (§0.2.5 #9). §2.6 redemption gate alone carries the defense — admin/employee tokens that survived into the post-deploy era get burned on first redemption attempt (403 + `used = true`), root tokens continue to redeem normally. The redemption gate is the belt; TRUNCATE was suspenders for a risk the belt already handles.                                                                                                                                                                                                                      | Phase 3 + Phase 4 tests on redemption gate.                                                                                         |
| ~~R10~~ | ~~Custom throttler-tracker breaks existing auth throttle behaviour~~  | ~~Medium~~ | ~~Low~~     | **v0.4.3: MOOT — risk removed with feature.** Per-Email-Throttle cut entirely (§0.2.5 #10). No new decorator, no new tracker closure, no `CustomThrottlerGuard` change, no `AppThrottlerModule` change. Existing `@AuthThrottle()` (10 req / 5 min per IP) is used as-is on both endpoints. Zero behavioural change to login/refresh paths.                                                                                                                                                                                                                                                   | N/A                                                                                                                                 |

**Removed since v0.2.0:** R5 (response-shape backward-compat — reinstated in v0.4.3 as additive, not clean-break; see §0.2.5 #6).
**De-scoped in v0.4.3:** R10 (Per-Email-Throttle feature cut — see §0.2.5 #10).
**Removed since v0.1.0:** R4 (enum missing — non-issue, no enum exists).

### 0.2.5 Explicit Design Decisions

1. **`has_full_access = true` does NOT unlock self-service reset.** Data-visibility bypass (ADR-010) is separate from auth-self-service. Narrower than ADR-045 Layer-1 by design. Role-only check at both gates.

2. **Lead positions (area / department / team lead) do NOT unlock self-service reset.** Organizational function ≠ auth privilege.

3. **HTTP 200 on `/auth/forgot-password`** for all three paths (root / blocked / silent-drop). Differentiation lives in body. Preserves current API idiom; matches what the UI already reads.

4. **HTTP 403 on `/auth/reset-password`** when the redemption gate blocks. Reason: the endpoint is token-authenticated, and a role-block is an **authorization** failure, not a token-validity failure. 403 gives the frontend a clear error handler; the text is generic and does not leak role info.

5. **Silent drop for non-existent AND inactive users is preserved.** `user?.is_active !== 1` covers is_active ∈ {0, 3, 4}. No differentiated errors — would replace R1's role-enumeration leak with a worse active/inactive oracle.

6. **Additive response shape (v0.4.3 — reverted from v0.3.0's clean-break framing).** User rule "No backward-compat in dev" prohibits keeping legacy code paths alive, NOT adding optional response fields. Additive shape is a pure API superset:
   - Root happy path: `{ message: "E-Mail gesendet" }` — byte-identical to today
   - Silent-drop path: `{ message: "E-Mail gesendet" }` — same (R1 enumeration-safe)
   - Admin/Employee blocked path: `{ message: "E-Mail gesendet", blocked: true, reason: "ROLE_NOT_ALLOWED" }` — superset, old clients that read only `message` still function (degrade to generic success on blocked path — accepted brief deploy-window inconsistency)
   - Redemption 403 body: `{ statusCode: 403, message: "Passwort-Reset nicht erlaubt...", error: "Forbidden", code: "ROLE_NOT_ALLOWED" }` — standard NestJS exception shape
     No DTO migration, no byte-identity test-bloat, no Frontend-sync-pressure. `ForgotPasswordResponse` DTO gets two optional fields (`blocked?`, `reason?`); `ResetPasswordResponse` unchanged (still `{ message: string }` on success).

7. **Break-Glass is outsourced to company IT** via `FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md` (ADR-048, ships first). A DNS-verified tenant domain means the customer's IT admin controls the mailbox and can recreate it if Root loses access. This plan does not need an SRE-runbook or a Multi-Root-Mandate. **Note:** unverified tenants have a single-root-mailbox-loss deadlock (Plan 2 Known Limitation #10, blast-radius = 1 tenant-slot, accepted).

8. **Token burning on redemption block** — `password_reset_tokens.used = true` is set when a non-root target is detected. Prevents retry-with-same-token. Irreversible by design.

9. **~~Deploy-step: `TRUNCATE password_reset_tokens`~~ REMOVED in v0.4.3.** The original rationale ("breaking response shape means pre-existing tokens incompatible") collapses with v0.4.3's additive response (see #6). Tokens stay valid: root-owned tokens redeem normally, admin/employee-owned tokens hit the §2.6 redemption gate and are burned on first attempt (exactly the R9 defense). No DDL step at deploy, no `assixx_user` coordination, no root-user friction from a blanket wipe.

10. **~~Tightened throttle per OWASP / NIST~~ DEFERRED to v2 in v0.4.3.** The per-email tier is Scope-Creep: not needed for the core role-gate goal, addresses an unreported threat (cross-IP email flood), and two earlier iterations each carried a shipping bug (v0.4.1 phantom `throttlerName`, v0.4.2 `authEmailTracker` IP-prefix defeating R6). The feature was sprouting bugs faster than it shipped value. **v1 retains the existing `@AuthThrottle()` decorator** (10 req / 5 min per IP) on both `/forgot-password` and `/reset-password` — same IP-level defense as login and refresh. If a real distributed-IP email-flood incident surfaces → v2 plan, ~1-day sprint, with the ADR-047 follow-up covering the NestJS-Throttler per-tier `getTracker` pattern now documented in this plan's history.

11. **Microsoft OAuth is an acknowledged alternate-auth path (v0.4.0 G3).**
    ADR-046 merged Microsoft OAuth sign-in as a first-class authentication route (commit `5cd293ae8`). Admin or employee users whose tenant has OAuth enabled can sign in via Azure AD WITHOUT ever hitting `/auth/forgot-password`. Plan 1 does NOT try to interfere with that path — role-gate on password-reset is not a security model for "admins can never regain access", only for "password reset is not the vehicle by which they regain access". The correct mental model is:
    - Root users: password-reset is the self-service path.
    - Admin/Employee: EITHER (a) contact a root user in their tenant, OR (b) use Microsoft OAuth if their tenant has configured it. OAuth-only users (no password hash or `password = 'OAUTH'` placeholder) don't need password-reset anyway.
      Implication for §2.1: a blocked admin who only uses OAuth will receive the generic blocked-email (§2.3). Template wording ("Bitte wende Dich an einen Root-Benutzer") is suboptimal for OAuth-only admins ("Du meldest Dich über Dein Firmen-Microsoft-Konto an — ein Passwort-Reset ist nicht nötig") — accepted as a V1 limitation, tracked in Known Limitations #8. ADR-047 MUST include a "Relationship to ADR-046" section that states this explicitly.
      **Threat-model note:** The OAuth path does NOT reduce Plan 1's attack surface — an attacker cannot abuse it to bypass the role-gate because Microsoft only issues tokens for identities the Azure AD tenant owns. If an attacker compromises an admin's Microsoft account, they already have full account access and no password-reset would be needed. The two auth surfaces are orthogonal.

### 0.3 Ecosystem Integration Points

| System                                                 | Integration                                                                                                                                                                                                                                                                                                  | Phase         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| `audit_trail` auto-interceptor                         | Phase 0 decides if auto-row is rich enough (Option A) or a manual `ActivityLoggerService` call is needed (Option B)                                                                                                                                                                                          | 0 → 2         |
| `ActivityLoggerService`                                | **If Option B:** `ActivityAction` union gets a new literal (e.g., `'block'`). Method call added after `sendPasswordResetBlocked(...)`.                                                                                                                                                                       | 0 → 2         |
| Email service (`MailerService`, `loadBrandedTemplate`) | New method `sendPasswordResetBlocked(user, meta)` + new template `password-reset-blocked.html`                                                                                                                                                                                                               | 2             |
| Rate limiter: existing `@AuthThrottle()` retained      | **v0.4.3:** `@AuthThrottle()` (10 req / 5 min per IP) stays on both `/forgot-password` and `/reset-password` — same decorator used by login and refresh. No new decorator, no new tracker, no `CustomThrottlerGuard` change, no `AppThrottlerModule` change. Per-email throttle deferred to v2 (§0.2.5 #10). | — (no change) |
| `users.role`, `users.is_active`                        | Read at both gates                                                                                                                                                                                                                                                                                           | 2             |
| `password_reset_tokens` table                          | Redemption gate marks `used = true` when blocking a non-root target (single-use burn — R9). **v0.4.3:** TRUNCATE deploy-step REMOVED (§0.2.5 #9). Token table is NOT wiped at release. Pre-existing admin/employee tokens handled naturally by redemption gate.                                              | 2             |
| CLS context (`ClsService`, ADR-006)                    | **MANDATORY:** extend `ClsModule.forRoot` `setup:` in `app.module.ts:131-137` by two lines (`cls.set('ip', req.ip)` + `cls.set('userAgent', req.headers['user-agent'])`). Verified: current setup populates only `requestId` / `requestPath` / `requestMethod`.                                              | 2             |
| Fastify `trustProxy` (v0.4.0 S5)                       | `req.ip` must resolve to the true client IP behind the Nginx reverse-proxy (Production: port 80 → :3000). Either `trustProxy: true` on `NestFastifyApplication` OR manual `X-Forwarded-For` read in CLS setup. Phase 0 records the chosen path, Phase 2 implements.                                          | 0 → 2         |
| Microsoft OAuth (ADR-046, v0.4.0 G3)                   | Orthogonal code path — no shared functions with `auth.service.ts` (grep-verified). ADR-047 must include a "Relationship to ADR-046" section stating that OAuth-only admins are a legitimate use case and the role-gate does not attempt to block them at the OAuth layer.                                    | 6             |
| Frontend `/forgot-password` Form Action                | Action parses backend JSON, re-exports `blocked` + `reason` via `ActionData`                                                                                                                                                                                                                                 | 5             |
| Existing `password-reset.html` template + sender       | Untouched — remains the root-happy-path mail                                                                                                                                                                                                                                                                 | N/A           |

---

## Phase 0: Current-State Analysis (Session 1, read-only)

> **No code changes.** Output: concrete decisions + exact line anchors; version bumps 0.2.0 → 0.2.1 (patch).

### Step 0.1 — Backend auth discovery [partially confirmed, finish in Phase 0]

Already confirmed by review:

- `auth.service.ts:367` — `async forgotPassword(dto: ForgotPasswordDto): Promise<void>`
- Silent-drop line 371: `if (user?.is_active !== 1) { return; }`
- `this.databaseService.systemQuery(...)` — sys_user pool (RLS-bypass, correct for pre-tenant auth)
- Token invalidation: `UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false`
- Token generation: `crypto.randomBytes(32).toString('hex')` + `this.hashToken(rawToken)`
- Columns (ground-truth via `\d password_reset_tokens`, v0.4.0 G2 correction):
  - `id INTEGER PK nextval('password_reset_tokens_id_seq')`
  - `user_id INTEGER NOT NULL REFERENCES users(id)` (FK `ON DELETE RESTRICT`). **Interaction with Plan 2's `TRUNCATE tenants CASCADE` (ADR-048 §1.0) — v0.4.2 correction:** PostgreSQL's `TRUNCATE ... CASCADE` propagates explicitly to ALL FK-referencing tables regardless of their `ON DELETE` action — `ON DELETE RESTRICT` only affects DELETE, not TRUNCATE CASCADE. So `TRUNCATE tenants CASCADE` transitively wipes `users` and then `password_reset_tokens` without any preparation; the FK action is irrelevant here. **Side effect:** Plan 2's clean-slate wipes any in-flight reset tokens too (live DB had 122 rows at the 2026-04-17 verification — all dev/test), which conveniently aligns with Plan 1 Phase 6's deploy-step TRUNCATE. Prior drafts (v0.3.0–v0.4.1) described this as "Plan 2 runs before any tokens exist" — accurate for a fresh prod install, misleading for dev.
  - `token VARCHAR(255)` (hash-hex, 64 chars used; column oversized for historical reasons)
  - `expires_at TIMESTAMPTZ`
  - `used BOOLEAN DEFAULT false`
  - `created_at TIMESTAMPTZ DEFAULT now()` (present, not listed in prior drafts)
  - Trigger `on_update_current_timestamp` ON UPDATE (not referenced by Plan 1, but present)
  - Global table per ADR-019 §7 — no `tenant_id`, no RLS. TRUNCATE permission: `assixx_user` only.
- Expiry: 60 minutes
- Mailer: `this.mailer.sendPasswordReset({ email, firstName, lastName }, rawToken, expiresAt)`
- `resetPassword(dto: ResetPasswordDto): Promise<void>` at line 411

Remaining:

- [x] Read `auth.controller.ts` — **DONE 2026-04-19:** forgot-password at lines 434–447 with `@Public()` + `@UseGuards(CustomThrottlerGuard)` + `@AuthThrottle()` (line 437) + `@HttpCode(HttpStatus.OK)`; reset-password at lines 453–464 (same decorator stack, `@AuthThrottle()` line 456). Response DTO imports confirmed (line 42–47).
- [x] Read `dto/forgot-password.dto.ts` + `dto/reset-password.dto.ts` — **DONE 2026-04-19:** `ForgotPasswordDto { email }` → `ForgotPasswordResponse { message: string }`; `ResetPasswordDto { token, password }` → `ResetPasswordResponse { message: string }`. Both use `createZodDto`. Response types exported from `dto/index.ts`.
- [x] Record exact `@AuthThrottle()` decorator line(s) on controller — **DONE 2026-04-19:** `auth.controller.ts:437` (forgot-password) + `auth.controller.ts:456` (reset-password). Existing decorator `AuthThrottle` imported line 28; `CustomThrottlerGuard` line 29.
- [x] Grep `ClsModule.forRoot` in `app.module.ts` — **DONE 2026-04-19:** lines 127–141. `setup:` callback at lines 133–139 sets only `requestId` (line 136), `requestPath` (line 137), `requestMethod` (line 138). **IP + user-agent NOT populated** → CLS extension mandatory. Grep for `cls.get('ip'|'userAgent'` repo-wide: 0 hits → no conflicts.
- [x] Read `MailerService` — **DONE 2026-04-19:** `backend/src/nest/common/services/mailer.service.ts:84`. Existing `sendPasswordReset(recipient: PasswordResetRecipient, rawToken: string, expiresAt: Date): Promise<void>` mirror target. Uses `emailService.loadBrandedTemplate('password-reset', vars)` (auto-attaches `cid:assixx-logo`). Has `buildUserName()` helper + `PASSWORD_RESET_EXPIRY_MINUTES = 60`. New `sendPasswordResetBlocked()` method lives on the same class; reuse `loadBrandedTemplate('password-reset-blocked', vars)` convention.
- [x] **Fastify `trustProxy` verification (v0.4.0 S5)** — **DONE 2026-04-19: `main.ts:284` already has `trustProxy: true`.** Verifies D13 (v0.4.1). Phase 2 DoD becomes a pure verification step; no `main.ts` edit needed. CLS `cls.set('ip', req.ip)` will return the client IP (not Nginx egress).
- [x] **OAuth anchor (v0.4.0 G3)** — **DONE 2026-04-19:** grep for `forgotPassword|password_reset|resetPassword` in `backend/src/nest/auth/oauth/` → **0 matches**. Orthogonality claim for ADR-047 "Relationship to ADR-046" is anchored.

### Step 0.2 — Email discovery [partially confirmed]

Confirmed:

- Dir: `backend/templates/email/`
- Peers: `new-document.html`, `notification.html`, `password-reset.html`, `welcome.html`
- No locale suffix (German implicit)
- Access: `emailService.loadBrandedTemplate('password-reset', vars)` (name without `.html`)

Remaining:

- [x] Read `password-reset.html` for branded layout + variable conventions — **DONE 2026-04-19:** `backend/templates/email/password-reset.html` (425 lines). Dark-mode-only HTML (`color-scheme: dark only`), 600-px container, black background, cid-attached `assixx-logo`. Variables: `{{userName}}`, `{{resetUrl}}`, `{{expiresAt}}`. Button is `<v:roundrect>` (MSO) + `<table><td bgcolor="#2196f3">` (Gmail-proof). Blocked variant mirrors this but replaces the button block with an info block ("Passwort-Reset nicht erlaubt") + meta rows (IP, timestamp, UA).
- [x] Confirm `MailerService` location + method name of the wrapper — **DONE 2026-04-19:** `backend/src/nest/common/services/mailer.service.ts:84` (`@Injectable() class MailerService`). Existing method: `sendPasswordReset(recipient, rawToken, expiresAt): Promise<void>` (line 96). Failure handling: logs + resolves (no throw — preserves enumeration contract). Helpers: `buildUserName()` (218) + `buildPasswordResetText()` (226). New method `sendPasswordResetBlocked(recipient, meta): Promise<void>` follows the same try-catch-log pattern.

### Step 0.3 — Audit mechanism decision [resolve in Phase 0]

Per HOW-TO-INTEGRATE-FEATURE §2.7: `audit_trail` is auto-populated by a global interceptor.

- **Option A (preferred default):** auto-row suffices. Add `this.logger.warn(...)` for ops visibility only.
- **Option B:** extend `ActivityAction` union with e.g. `'block'`; call `ActivityLoggerService.log()`.

Phase 0 action:

- [x] Inspect one sample row in `audit_trail` produced by a real `/auth/forgot-password` hit — **DONE 2026-04-19 via code analysis (Docker not running, not needed):** `audit-request-filter.service.ts:59-62` — `if (!isAuthEndpointFlag && user === undefined) return true;`. `audit.helpers.ts:240-244` — `isAuthEndpoint()` currently matches ONLY `/auth/login|logout|refresh`. **Anonymous `/auth/forgot-password` + `/auth/reset-password` are SKIPPED by the auto-interceptor** — 0 rows in `audit_trail` today. Strict Option A ("auto-row suffices") is therefore not viable as originally written.
- [x] **Decision: Option A+ (modified Option A).** Plan §2.4 Option A stays lightweight _with a 2-line `isAuthEndpoint()` extension_:

```typescript
// backend/src/nest/common/audit/audit.helpers.ts:240-244
export function isAuthEndpoint(path: string): boolean {
  return (
    path.includes('/auth/login') ||
    path.includes('/auth/logout') ||
    path.includes('/auth/refresh') ||
    path.includes('/auth/forgot-password') || // NEW — ADR-047 two-gate coverage
    path.includes('/auth/reset-password') // NEW — ADR-047 two-gate coverage
  );
}
```

Rationale: mirrors the existing login/logout/refresh pattern, minimal diff (2 lines), auto-interceptor then captures standard HTTP metadata (endpoint, method, status, duration, IP via `metadata.ipAddress`, UA via `metadata.userAgent`, requestId) for all three paths (root / blocked / silent-drop). `audit_trail` user_id defaults to 0 for anonymous POSTs — expected. Block-semantic context (user_id, role, blocked-reason) lives in the `this.logger.warn(...)` line → Loki-ingested, queryable via Grafana.

**Skipped:** Option B (extend `ActivityAction` union with `'block'` + manual `ActivityLoggerService.log()` call). Larger diff, duplicates the HTTP info that the auto-interceptor already captures. M1 resolved via Option A+ without touching the Activity union.

### Step 0.4 — Frontend discovery [partially confirmed]

Confirmed:

- `frontend/src/routes/forgot-password/+page.svelte`
- `frontend/src/routes/forgot-password/+page.server.ts`
- Pattern: SvelteKit Form Actions.

Remaining:

- [x] Read both files to anchor exact edit points — **DONE 2026-04-19:**
  - `+page.server.ts` (47 lines): `actions.default` returns `{ success: true, email }` on any non-429 response (line 41); error branches: `fail(400)` empty email (23), `fail(429)` rate-limit (34), `fail(500)` catch (44). Uses `$env.API_URL ?? 'http://localhost:3000/api/v2'` (line 15). Phase 5 edit: insert `data = (await response.json()) as ForgotPasswordApiResponse;` before line 41, branch on `data.blocked === true`.
  - `+page.svelte` (264 lines): `email = $state('')` line 14, `loading = $state(false)` line 15, `isEmailValid = $derived(...)` line 17. Two top-level branches: `{#if form?.success}` (56–67) and `{:else}` (68–120). Phase 5 edit: add `{#if form?.blocked} ... {:else if form?.success} ... {:else} ...`.
- [x] Confirm design-system classes — **DONE 2026-04-19:** `toast toast--error` used at lines 72–85 (NOT `alert alert--*`). Existing primitives confirmed: `.subtitle` (line 70, 228–234), `.success-actions` (line 62, 253–257), `.btn btn-index` (65, 111). Phase 5 blocked block reuses all three.

### Step 0.5 — CLS IP/UA extension (MANDATORY — verified-missing)

**Ground-truth already verified in plan review**: `app.module.ts:131-137` sets only `requestId`, `requestPath`, `requestMethod`. `ip` + `userAgent` are NOT populated. The extension is non-optional.

- [x] Anchor the exact lines to edit in `app.module.ts` — **DONE 2026-04-19:** current `setup:` callback at lines 133–139 (ClsModule.forRoot at 127–141). Insert the two new `cls.set(...)` calls after line 138 (before the closing `},` at 139). Existing set-order: `requestId` (136) → `requestPath` (137) → `requestMethod` (138) → new `ip` + `userAgent`.
- [x] Confirm no other consumer — **DONE 2026-04-19:** grep `cls\.(get|set)\(['"](ip|userAgent)['"]` in `backend/` → **0 matches** repo-wide. No conflicts, no reconciliation needed. The two new keys are greenfield.
- [x] Record the exact two lines to add — **DONE 2026-04-19 (unchanged from plan draft):**

```typescript
// app.module.ts — inside ClsModule.forRoot({ middleware: { setup: ... } })
cls.set('ip', req.ip);
cls.set('userAgent', req.headers['user-agent'] ?? 'unknown');
```

No code change in Phase 0 — the edit lands in Phase 2 together with `auth.service.forgotPassword()`.

### Phase 0 — Definition of Done

- [x] All §0.1–§0.5 checkboxes filled with concrete line numbers / signatures / decisions — **DONE 2026-04-19**
- [x] Audit mechanism chosen (A or B) with one-sentence reasoning — **DONE 2026-04-19: Option A+** (extend `isAuthEndpoint()` 2 lines + `logger.warn()` in service). Strict Option A is not viable (anonymous forgot/reset are auto-skipped by `shouldSkipRequest` at `audit-request-filter.service.ts:59-62`). A+ picks the smallest diff consistent with the existing login/logout/refresh pattern.
- [x] CLS extension lines drafted — **DONE 2026-04-19:** `cls.set('ip', req.ip); cls.set('userAgent', req.headers['user-agent'] ?? 'unknown');` — insert after `app.module.ts:138`, edit deferred to Phase 2. Greenfield keys (0 repo-wide consumers).
- [x] Throttler anchor recorded — **DONE 2026-04-19:** `backend/src/nest/common/guards/throttler.guard.ts` (class `CustomThrottlerGuard`). v0.4.3 uses existing `@AuthThrottle()` (10 req / 5 min per IP) — NO guard modification, NO tracker override. Phase 2 work here: zero.
- [x] Frontend anchor recorded — **DONE 2026-04-19:** `+page.svelte:14` `email`, `:15` `loading`, `:17` `isEmailValid`, `:72-85` `toast toast--error`. Verifies v0.3.0 review.
- [x] DTO anchors recorded — **DONE 2026-04-19:** `dto/forgot-password.dto.ts` — `ForgotPasswordResponse { message: string }` (line 18-20). `dto/reset-password.dto.ts` — `ResetPasswordResponse { message: string }` (line 18-20). Both re-exported from `dto/index.ts:10-21`. Phase 2 Additive-Edit: `ForgotPasswordResponse` gains `blocked?: true` + `reason?: 'ROLE_NOT_ALLOWED'`; `ResetPasswordResponse` unchanged (403 body is NestJS-standard exception shape, not this DTO).
- [x] **Fastify `trustProxy` status recorded (v0.4.0 S5)** — **DONE 2026-04-19: already configured at `main.ts:284` as `trustProxy: true`.** Phase 2 work: pure verification (curl `-H "X-Forwarded-For: ..."` test in Phase 4). D13 resolved (v0.4.1 confirmation holds).
- [x] **OAuth-path grep recorded (v0.4.0 G3)** — **DONE 2026-04-19:** `grep -rE 'forgotPassword|password_reset|resetPassword' backend/src/nest/auth/oauth/` → **0 matches**. Orthogonality anchor for ADR-047 "Relationship to ADR-046" locked in.
- [x] Plan version bumped — **DONE 2026-04-19: 0.4.3 → 0.4.4** (patch — Phase 0 findings integrated). See Changelog entry.

### Phase 0 Deliverable Summary (2026-04-19)

**Concrete Phase-2 edit list** (all anchors confirmed via Read, no Docker needed):

| File                                                  | Lines                     | Change                                                                  |
| ----------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------- | ------------------ |
| `backend/src/nest/app.module.ts`                      | After 138                 | +2 `cls.set('ip'                                                        | 'userAgent', ...)` |
| `backend/src/nest/common/audit/audit.helpers.ts`      | 240-244                   | Extend `isAuthEndpoint()` with forgot-password + reset-password         |
| `backend/src/nest/auth/auth.service.ts`               | 373 (forgotPassword)      | Rewrite: role gate + blocked-mail + `logger.warn`                       |
| `backend/src/nest/auth/auth.service.ts`               | 417 (resetPassword)       | Add redemption gate + `burnToken()` helper                              |
| `backend/src/nest/auth/auth.controller.ts`            | 439-447                   | Additive: return `blocked?: true, reason?: 'ROLE_NOT_ALLOWED'` on block |
| `backend/src/nest/auth/dto/forgot-password.dto.ts`    | 18-20                     | `ForgotPasswordResponse` += 2 optional fields                           |
| `backend/src/nest/common/services/mailer.service.ts`  | After `sendPasswordReset` | New `sendPasswordResetBlocked(recipient, meta)` method                  |
| `backend/templates/email/password-reset-blocked.html` | NEW                       | Mirror `password-reset.html`, replace CTA with info block               |

**Unchanged:** `main.ts` (`trustProxy` already true), `CustomThrottlerGuard` (no override), `ActivityAction` union (no new literal), `AppThrottlerModule` (no new tier), `password_reset_tokens` table (no TRUNCATE).

**Docker:** Not started for Phase 0 (all decisions resolved via code reading). Required for Phase 2 integration smoke, Phase 3 `pnpm exec vitest` runs, Phase 4 API tests.

> **Phase 1 omitted.** No migration needed (v0.1.0's proposed enum-value-add is dropped — enum doesn't exist).

---

## Phase 2: Backend Changes (Session 2)

### Step 2.1 — Rewrite `auth.service.forgotPassword()` [STATUS]

**File:** `backend/src/nest/auth/auth.service.ts:367`

**Also update** the exported DTO response type in `backend/src/nest/auth/dto/index.ts` → `ForgotPasswordResponse`. Old shape `{ message: string }` is **replaced** (clean break — user rule, §0.2.5 #6).

**New service return type (internal):**

```typescript
export interface ForgotPasswordResult {
  /** true → user exists, is active, and was denied due to role. */
  readonly blocked: boolean;
  /** false only when silent-drop fires (non-existent OR inactive user). */
  readonly delivered: boolean;
}
```

**New controller response type (`ForgotPasswordResponse` DTO):**

```typescript
export interface ForgotPasswordResponse {
  readonly message: string;
  /** Omitted for silent-drop and root paths. Present only when the request was blocked due to role. */
  readonly blocked?: true;
  readonly reason?: 'ROLE_NOT_ALLOWED';
}
```

**New logic:**

```typescript
async forgotPassword(dto: ForgotPasswordDto): Promise<ForgotPasswordResult> {
  const user = await this.findUserByEmail(dto.email);

  // Silent drop covers non-existent AND is_active ∈ {0, 3, 4}.
  // §0.2.5 #5 — no active/inactive oracle. R1 no-leak contract preserved.
  if (user?.is_active !== 1) {
    return { blocked: false, delivered: false };
  }

  // §0.2.5 #1/#2 — strict role-only gate. has_full_access + lead-positions
  // intentionally ignored for auth self-service. R3 secure default.
  if (user.role !== 'root') {
    const ip = this.cls.get<string>('ip') ?? 'unknown';
    const userAgent = this.cls.get<string>('userAgent') ?? 'unknown';

    // Option A (auto-interceptor captures request): just warn-log for ops.
    this.logger.warn(
      `Password-reset BLOCKED for user ${user.id} (role=${user.role}, tenant=${user.tenant_id}) from ${ip}`,
    );
    // Option B (if Phase 0 picks it): this.activityLogger.log(...)

    await this.mailer.sendPasswordResetBlocked(
      { email: user.email, firstName: user.first_name, lastName: user.last_name },
      { ip, userAgent, timestamp: new Date() },
    );
    return { blocked: true, delivered: true };
  }

  // Existing root happy path — unchanged below this point.
  await this.databaseService.systemQuery(
    `UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false`,
    [user.id],
  );
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = this.hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await this.databaseService.systemQuery(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at, used) VALUES ($1, $2, $3, false)`,
    [user.id, tokenHash, expiresAt],
  );
  await this.mailer.sendPasswordReset(
    { email: user.email, firstName: user.first_name, lastName: user.last_name },
    rawToken,
    expiresAt,
  );
  this.logger.log(`Password reset requested for user ${user.id}`);
  return { blocked: false, delivered: true };
}
```

### Step 2.2 — Controller response (additive — v0.4.3 scope-re-cut) [STATUS]

**File:** `backend/src/nest/auth/auth.controller.ts`

Additive shape per §0.2.5 #6 (v0.4.3 revert from clean-break). Old shape `{ message: string }` is preserved for the root-success and silent-drop paths; the blocked path adds two optional fields (`blocked?: true`, `reason?: 'ROLE_NOT_ALLOWED'`). No DTO migration, no byte-identity test-bloat, no Frontend-sync-pressure. `ForgotPasswordResponse` DTO grows two optional fields; `ResetPasswordResponse` stays unchanged.

**Mapping table (forgot-password):**

| Case                                  | HTTP | Body                                                               |
| ------------------------------------- | ---- | ------------------------------------------------------------------ |
| Root (success path)                   | 200  | `{ message: '…' }` (no `blocked` / `reason` keys)                  |
| Blocked active admin/employee         | 200  | `{ message: '…', blocked: true, reason: 'ROLE_NOT_ALLOWED' }`      |
| Silent drop (non-existent / inactive) | 200  | `{ message: '…' }` (indistinguishable from root path — R1 no-leak) |

Message string is identical across all three paths. Differentiation lives strictly in the presence/absence of `blocked` + `reason`. `root` and `silent-drop` paths are byte-identical — enumeration-safe.

**Mapping table (reset-password, redemption gate from §2.6):**

| Case                                              | HTTP | Body                                                                                                                                                                                     |
| ------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Valid root token + correct new password           | 200  | `{ message: 'Passwort erfolgreich zurückgesetzt. Sie können sich jetzt anmelden.' }`                                                                                                     |
| Invalid / expired / already-used token            | 401  | `{ statusCode: 401, message: 'Ungültiger oder abgelaufener Link. Bitte fordern Sie einen neuen an.', error: 'Unauthorized' }`                                                            |
| Valid token BUT target is admin/employee/inactive | 403  | `{ statusCode: 403, message: 'Passwort-Reset nicht erlaubt. Wende Dich an einen Root-Benutzer in Deinem Unternehmen.', error: 'Forbidden', code: 'ROLE_NOT_ALLOWED' }` — token is burned |

403 deliberately generic in `message`; `code: 'ROLE_NOT_ALLOWED'` is the machine-readable signal for the frontend. 401 stays the catch-all "token bad" case so we don't leak "this token exists but is rejected".

### Step 2.3 — Email template [STATUS]

**New file:** `backend/templates/email/password-reset-blocked.html`

- No `.de` suffix (house style).
- Access: `emailService.loadBrandedTemplate('password-reset-blocked', vars)`.
- Mirror visual style of `password-reset.html`.
- German text with `ä/ö/ü/ß`.

**New `MailerService` method signature (mirror of `sendPasswordReset`):**

```typescript
async sendPasswordResetBlocked(
  user: { email: string; firstName: string; lastName: string },
  meta: { ip: string; userAgent: string; timestamp: Date },
): Promise<void>
```

**Template draft (final wording finalizable in Phase 2):**

```
Hallo {firstName},

jemand (möglicherweise Du) hat für Dein Konto einen Passwort-Reset
angefordert.

Aus Sicherheitsgründen dürfen in Deinem Unternehmen nur
Root-Benutzer ihr Passwort selbst zurücksetzen. Bitte wende Dich
an einen Root-Benutzer in Deinem Unternehmen, um Dein Passwort
zurücksetzen zu lassen.

Falls Du diesen Reset NICHT angefordert hast, ignoriere diese Mail
oder informiere einen Root-Benutzer über den Vorfall.

Zeitstempel: {timestamp}
IP-Adresse:  {ip}

— Dein Assixx-Team
```

### Step 2.4 — Audit / logging [STATUS — matches Phase-0 Option A or B]

- **Option A:** `this.logger.warn(...)` with structured fields. The auto-interceptor row in `audit_trail` already captures HTTP metadata.
- **Option B:** extend `ActivityAction` union with `'block'`; call `this.activityLogger.log(user.tenant_id, user.id, 'auth', user.id, 'password-reset blocked', { role: user.role, ip })` after `sendPasswordResetBlocked`.

### Step 2.5 — Throttle (v0.4.3 — Scope-Re-Cut: use existing `@AuthThrottle()`) [STATUS]

**v0.4.3 decision:** The Per-Email-Throttle feature is **deferred to v2** (see §0.2.5 #10). Both `/auth/forgot-password` and `/auth/reset-password` keep the existing `@AuthThrottle()` decorator (10 req / 5 min per IP), same as `/auth/login` and `/auth/refresh`.

**Work for Phase 2:** nothing. `@AuthThrottle()` is already applied to both endpoints. No new decorator, no tracker closure, no `CustomThrottlerGuard` change, no `AppThrottlerModule` change.

**Phase 4 test (simplified):** 11th request / 5 min from same IP → 429. That's the only rate-limit assertion in v1.

**Why cut (brief — full rationale in §0.2.5 #10):** Per-email tier addressed an unreported threat (cross-IP email flood); SMTP providers bound outbound at infra layer; two earlier iterations each carried a shipping bug (v0.4.1 phantom `throttlerName`, v0.4.2 `authEmailTracker` IP-prefix defeating R6). Feature cost > feature value. v2 reintroduces if real incidents surface.

**v2 reference material (preserved for the follow-up plan):** the correct `@nestjs/throttler@6.5.0` API for per-tier `getTracker` differentiation is the `Throttle({ 'tier-name': { limit, ttl, getTracker: closure } })` decorator (NOT a `CustomThrottlerGuard.getTracker()` override — the base-class invocation is `getTracker(req, context: ExecutionContext)`, no `throttlerName`). The per-tier closure is stored as `THROTTLER_TRACKER + name` Reflect-metadata (verified in compiled `throttler.decorator.js`). The v0.4.2 fix established that the `auth-email` tracker must return pure `email:<hash>` (IP-agnostic) to stop cross-IP floods; the separate `auth-ip` tier handles per-IP. Keep these notes when v2 lands.

<!-- v0.4.3 HISTORICAL DETAIL REMOVED — the detailed decorator code, test matrix, and module-registration prose for the Per-Email-Throttle feature that filled this section in v0.4.1/v0.4.2 has been cut. Git history preserves it. See §0.2.5 #10 for why. -->

### Step 2.6 — NEW: `resetPassword()` redemption gate (M4) [STATUS]

**File:** `backend/src/nest/auth/auth.service.ts:411`

**Goal:** even with a valid token for an admin or employee (pre-existing, leaked, or pre-plan-era), the attacker **cannot** set a new password.

```typescript
async resetPassword(dto: ResetPasswordDto): Promise<void> {
  const tokenHash = this.hashToken(dto.token);

  const rows = await this.databaseService.systemQuery<{
    id: number;
    user_id: number;
  }>(
    `SELECT id, user_id FROM password_reset_tokens
     WHERE token = $1 AND used = false AND expires_at > NOW()`,
    [tokenHash],
  );
  const tokenRow = rows[0];
  if (tokenRow === undefined) {
    throw new UnauthorizedException(
      'Ungültiger oder abgelaufener Link. Bitte fordern Sie einen neuen an.',
    );
  }

  // NEW — redemption gate. Re-load user, re-check role at redemption time.
  const user = await this.findUserById(tokenRow.user_id);
  if (user === null || user.is_active !== 1) {
    await this.burnToken(tokenRow.id);
    throw new UnauthorizedException(
      'Ungültiger oder abgelaufener Link. Bitte fordern Sie einen neuen an.',
    );
  }
  if (user.role !== 'root') {
    await this.burnToken(tokenRow.id);
    this.logger.warn(
      `Password-reset REDEMPTION BLOCKED for user ${user.id} (role=${user.role}) — token burned.`,
    );
    throw new ForbiddenException(
      'Passwort-Reset nicht erlaubt. Wende Dich an einen Root-Benutzer in Deinem Unternehmen.',
    );
  }

  // Existing root happy path — hash new password, UPDATE users, mark token used.
  // (unchanged below)
}
```

Helper:

```typescript
private async burnToken(tokenRowId: number): Promise<void> {
  await this.databaseService.systemQuery(
    `UPDATE password_reset_tokens SET used = true WHERE id = $1`,
    [tokenRowId],
  );
}
```

### Phase 2 — Definition of Done

- [ ] `forgotPassword()` returns `ForgotPasswordResult`; 3 branches implemented (silent-drop / blocked / root-allow)
- [ ] `resetPassword()` redemption gate implemented; token burned on block
- [ ] Controller maps return to HTTP body per §2.2 (**clean break** — old `{ message }`-only shape replaced)
- [ ] `ForgotPasswordResponse` + `ResetPasswordResponse` DTO types in `auth/dto/index.ts` updated to new shape
- [ ] `MailerService.sendPasswordResetBlocked()` implemented
- [ ] `password-reset-blocked.html` in `backend/templates/email/`
- [ ] Audit path chosen (§2.4 A or B) and wired
- [ ] **~~Per-Email-Throttle~~ DEFERRED to v2 (v0.4.3 §0.2.5 #10).** Existing `@AuthThrottle()` (10 req / 5 min per IP) stays on both `/forgot-password` and `/reset-password`. No new decorator, no tracker closure, no `CustomThrottlerGuard` change, no `AppThrottlerModule` change.
- [ ] `ClsModule.forRoot` `setup:` in `app.module.ts` extended with `cls.set('ip', req.ip)` + `cls.set('userAgent', req.headers['user-agent'] ?? 'unknown')`
- [ ] **`trustProxy` resolved (v0.4.0 S5):** either `NestFastifyApplication` created with `{ trustProxy: true }` OR CLS setup reads `X-Forwarded-For` manually. Verified via a direct `curl -H "X-Forwarded-For: 1.2.3.4" http://localhost/api/v2/auth/forgot-password …` — `req.ip` in the forgot-password path logs `1.2.3.4`, not the Nginx container IP.
- [ ] No `any`; `??` not `||`; explicit null checks; `import type` for type-only imports; `getErrorMessage()` for catches
- [ ] ESLint: `docker exec assixx-backend pnpm exec eslint backend/src/nest/auth/ backend/src/nest/common/` → 0 errors
- [ ] Type-check: `docker exec assixx-backend pnpm run type-check` → 0 errors

---

## Phase 3: Unit Tests (Session 3, Part A)

**Files:**

- `backend/src/nest/auth/auth.service.test.ts` (extend)
- ~~`backend/src/nest/common/decorators/throttle.decorators.test.ts`~~ — **NOT NEEDED (v0.4.3)**: Per-Email-Throttle deferred to v2, no new tracker closures, no new decorator → no new test file.

### Mandatory scenarios (≥ 10 — v0.4.3 reduced from 15 after Per-Email-Throttle cut)

- [ ] `forgotPassword()` with root user → `{ blocked: false, delivered: true }`; `sendPasswordReset` called
- [ ] `forgotPassword()` with admin user → `{ blocked: true, delivered: true }`; `sendPasswordResetBlocked` called; no token row
- [ ] `forgotPassword()` with employee user → same as admin
- [ ] `forgotPassword()` with user whose role is `null` / unknown → `{ blocked: true, delivered: true }` (R3 secure default)
- [ ] `forgotPassword()` with non-existent email → `{ blocked: false, delivered: false }`; no mail, no audit
- [ ] `forgotPassword()` with inactive user (`is_active = 0`) → silent drop
- [ ] `forgotPassword()` with archived user (`is_active = 3`) → silent drop
- [ ] `forgotPassword()` with deleted user (`is_active = 4`) → silent drop
- [ ] `forgotPassword()` reads IP + user-agent from CLS; passes to mailer + logger
- [ ] **`forgotPassword()` with OAuth-only admin** (`password` column = `'OAUTH'` placeholder, `is_active = 1`, `role = 'admin'`, v0.4.0 G3): → `{ blocked: true, delivered: true }`. Template rendering not tested here; template wording limitation tracked in Known Limitations #8.
- [ ] `resetPassword()` with token for root → succeeds; password updated; token marked used
- [ ] `resetPassword()` with token for admin → `ForbiddenException`; token burned (`used = true`); warn-log produced
- [ ] `resetPassword()` with token for employee → same as admin
- [ ] `resetPassword()` with token whose target became inactive after issuance → `UnauthorizedException`; token burned
- [ ] `resetPassword()` with invalid / expired token → `UnauthorizedException` (existing behavior)

**~~Per-tier tracker tests~~ REMOVED (v0.4.3):** Per-Email-Throttle feature cut — no `authIpTracker` / `authEmailTracker` closures exist, nothing to test. Existing `@AuthThrottle()` behavior is covered by the project's existing throttler tests.

### Phase 3 — Definition of Done

- [ ] All scenarios above covered (≥ 10 tests)
- [ ] `docker exec assixx-backend pnpm exec vitest run --project unit backend/src/nest/auth/` → green
- [ ] DB + SMTP mocked; no real side effects
- [ ] Every branch in both methods (`forgotPassword`, `resetPassword`) has ≥ 1 test

---

## Phase 4: API Integration Tests (Session 3, Part B)

**File:** `backend/test/auth-forgot-password.api.test.ts` (new)

### Scenarios (≥ 8 — v0.4.3 reduced from 14 after Per-Email-Throttle cut)

- [ ] POST `/api/v2/auth/forgot-password` with root email → 200 `{ message }`; token row appears in DB
- [ ] Same with admin email → 200 `{ message, blocked: true, reason: 'ROLE_NOT_ALLOWED' }`; outbound mail captured; no token row
- [ ] Same with employee email → identical to admin
- [ ] Same with non-existent email → 200 `{ message }` only (no `blocked`); no side effects
- [ ] Same with inactive user (`is_active ∈ {0, 3, 4}` — one test per value) → 200 `{ message }` only; no side effects
- [ ] Root-path body is byte-identical to silent-drop path — assert keys are EXACTLY `['message']` and value is the canonical string (R1 enumeration-safe)
- [ ] **Per-IP throttle (`@AuthThrottle()` existing):** 11th request from same IP within 5 min → 429. (v0.4.3: simplified from "5/15min" to the actual existing limit of 10 req / 5 min per IP.)
- [ ] ~~Per-email throttle~~ — **REMOVED (v0.4.3):** Per-Email-Throttle deferred to v2 (§0.2.5 #10). No cross-IP test needed.
- [ ] ~~Per-email throttle normalization~~ — **REMOVED (v0.4.3):** Same reason.
- [ ] POST `/api/v2/auth/reset-password` with valid admin token → 403 with body `{ statusCode: 403, code: 'ROLE_NOT_ALLOWED', ... }`; token is `used = true` in DB
- [ ] POST same with valid employee token → identical 403 behaviour
- [ ] POST same with valid root token → 200; password updated in DB (bcrypt comparison succeeds); all refresh-tokens revoked
- [ ] POST same with expired/invalid/already-used token → 401 (generic, no role leak)
- [ ] POST same with token whose target became inactive after issuance → 401 (token burned, no 403 — keeps role private)
- [ ] **`trustProxy` end-to-end (v0.4.0 S5):** POST with header `X-Forwarded-For: 203.0.113.7` — outbound blocked-email body contains `203.0.113.7`, NOT a `172.x` / `127.0.0.1`. Fails if `main.ts` lacks `trustProxy: true` AND CLS setup doesn't manually read the header.

### Phase 4 — Definition of Done

- [ ] `pnpm exec vitest run --project api backend/test/auth-forgot-password.api.test.ts` → green
- [ ] Outbound mail captured + asserted
- [ ] Token-burn verified via direct DB query in test
- [ ] Existing `@AuthThrottle()` limit asserted (1 tier only — v0.4.3); Redis `FLUSHDB` between describe-blocks (see `docs/COMMON-COMMANDS.md §2`)

---

## Phase 5: Frontend (Session 4, Part A)

> **Directive:** MERGE into existing markup, do NOT replace. The current page already has `email = $state('')`, `loading = $state(false)`, `isEmailValid = $derived(...)`, inline spinner, toast-styled error. Keep all of that — only ADD the blocked branch.

### Step 5.1 — `+page.server.ts` action (merge) [STATUS]

**File:** `frontend/src/routes/forgot-password/+page.server.ts`

Current action returns `{ success: true, email }` on any response from the backend. With the clean-break response shape, the action must inspect the JSON body and propagate `blocked` / `reason` explicitly.

**Required changes (not a full rewrite — only diff):**

1. Parse the JSON body: `const data = (await response.json()) as ForgotPasswordApiResponse;`
2. When `data.blocked === true` → return `{ blocked: true, reason: data.reason, email }` (no `success` key — keeps the UI branches mutually exclusive).
3. Root / silent-drop path → return existing `{ success: true, email }` (indistinguishable on the wire; the frontend shows the generic success message).
4. Keep the existing 429 / 5xx branches untouched.

**Declared type (add to `+page.server.ts` or `_lib/types.ts`):**

```typescript
interface ForgotPasswordApiResponse {
  message: string;
  blocked?: true;
  reason?: 'ROLE_NOT_ALLOWED';
}
```

### Step 5.2 — `+page.svelte` UI (merge) [STATUS]

**File:** `frontend/src/routes/forgot-password/+page.svelte`

Current page structure (verified v0.3.0):

- Header + logo + legal footer
- Top branch: `{#if form?.success}` → success panel ("E-Mail gesendet")
- Else branch: form + optional `{#if form?.error}` → **`toast toast--error`** block (NOT `alert alert--error`)
- `use:enhance` with `loading = $state()`, spinner in submit button
- `isEmailValid = $derived(email.includes('@') && email.includes('.'))` gates submit

**Required changes (merge, not replace):**

1. Add a new top-level branch BEFORE `{#if form?.success}`:

```svelte
{#if form?.blocked}
  <h1>Passwort-Reset nicht erlaubt</h1>
  <p class="subtitle">
    Du bist nicht berechtigt, Dein Passwort selbst zurückzusetzen.
    Wende Dich an einen Root-Benutzer in Deinem Unternehmen.
  </p>
  <div class="success-actions">
    <a href={resolve('/login')} class="btn btn-index">Zurück zum Login</a>
  </div>
{:else if form?.success}
  <!-- existing success block, unchanged -->
{:else}
  <!-- existing form + toast-error block, unchanged -->
{/if}
```

2. Do **not** introduce `alert alert--*` classes. Keep the existing `toast toast--error` pattern for inline form errors. (Verified against design-system: both exist, but this page uses `toast`.)

3. Do **not** touch `loading`, `isEmailValid`, `enhance`-handler, or the spinner — they're already correct.

4. Keep the German copy with `ä/ö/ü/ß` (user rule).

### Phase 5 — Definition of Done

- [ ] Blocked path renders correctly (manual browser test, dev and production) — admin/employee email → locked message, no form
- [ ] Success path unchanged (regression-check: root email, non-existent email, inactive-user email all show the same generic success)
- [ ] Toast-error path unchanged (429, 5xx still use existing `toast toast--error` block)
- [ ] Existing state (`email`, `loading`, `isEmailValid`), spinner, and disabled-button behaviour preserved
- [ ] svelte-check: 0 errors, 0 warnings
- [ ] ESLint: 0 errors
- [ ] German UI text uses `ä/ö/ü/ß` correctly
- [ ] NO new CSS classes introduced — existing `toast toast--error` + `btn btn-index` + `subtitle` + `success-actions` reused
- [ ] Works on `:5173` AND `:80` (Nginx / production profile)

---

## Phase 6: Integration, Deploy, Docs, ADR (Session 4, Part B)

### Deploy Checklist (pre-merge)

- [ ] ~~`TRUNCATE password_reset_tokens` at release~~ — **REMOVED (v0.4.3 §0.2.5 #9).** Additive response shape (§2.2) keeps pre-existing tokens valid; redemption gate (§2.6) handles admin/employee tokens naturally (403 + burn). No DDL at deploy. Root-owned in-flight tokens continue to redeem — zero customer friction.
- [ ] Redis throttle-cache: no action needed (no new throttler tiers introduced — v0.4.3). `@AuthThrottle()` keys already in production use.

### Integrations

- [ ] End-to-end smoke, 5 paths × (dev + production):
  - root email → reset link received + redemption works
  - admin email → UI blocked message + blocked mail received; any attempted token redemption → 403 `ROLE_NOT_ALLOWED`, token burned
  - employee email → same as admin
  - inactive user → no UI alert (generic success), no mail
  - unknown email → same as inactive
- [ ] Rate-limit smoke: 11th request in 5 min from same IP → 429 (existing `@AuthThrottle()`, v0.4.3 — no new per-email tier).

### Documentation

- [ ] **ADR-047** written: "Forgot-Password Role-Gate". Sections: threat model, two-gate design (request + redemption), **additive response shape** (v0.4.3 — not clean-break), existing `@AuthThrottle()` used as-is, accepted R1 leak, **"v2 backlog: Per-Email-Throttle"** (v0.4.3 scope-re-cut rationale + NestJS-Throttler per-tier `getTracker` reference notes), decoupling from ADR-048 (Domain Verification), **"Relationship to ADR-046 (Microsoft OAuth)"** — explicit statement that OAuth is an orthogonal alternate-auth path
- [ ] `FEATURES.md` security section updated
- [ ] Docstring on `forgotPassword()` + `resetPassword()` references ADR-047 (v0.4.3: no `ForgotPasswordThrottle()` or `CustomThrottlerGuard` changes to docstring)
- [ ] `docs/how-to/HOW-TO-CURL.md` example for hitting `/forgot-password` — body shape unchanged (additive, v0.4.3), no update likely needed

### Phase 6 — Definition of Done

- [ ] All 5 end-to-end paths verified in dev + production
- [ ] Rate-limit smoke passes (1 tier only — v0.4.3)
- [ ] ~~`TRUNCATE password_reset_tokens`~~ — **NOT PERFORMED (v0.4.3)**: no DDL at deploy; redemption-gate handles pre-existing tokens.
- [ ] ADR-047 status "Accepted"
- [ ] `FEATURES.md` updated
- [ ] Plan version → 2.0.0

---

## Session Tracking

| Session | Phase     | Description                                                                                                                                                                 | Status     | Date       |
| ------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------- |
| 1a      | 0         | Phase 0 current-state analysis (anchors, DTO, frontend, CLS extension, audit decision, OAuth orthogonality, trustProxy verification). No code changes.                      | ✅ DONE    | 2026-04-19 |
| 1b      | 2         | Backend (both gates, email template, audit wiring `isAuthEndpoint()` extension, CLS extension, additive DTO). v0.4.3: no new throttler decorator — `@AuthThrottle()` stays. | ⏳ PENDING |            |
| 2       | 3 + 4 + 5 | Unit tests (≥ 10) + API integration tests (≥ 8) + Frontend (merge-not-replace, toast pattern, additive response).                                                           | ⏳ PENDING |            |
| 3       | 6         | ADR-047 + smoke (dev + production). v0.4.3: no TRUNCATE deploy-step.                                                                                                        | ⏳ PENDING |            |

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

### Session 1a — 2026-04-19

**Goal:** Complete Phase 0 current-state analysis. No code changes — pure anchor + decision recording.

**Result:** All §0.1–§0.5 checkboxes resolved via code reading. Audit mechanism chosen (Option A+: 2-line `isAuthEndpoint()` extension + `logger.warn()`). CLS `ip`/`userAgent` confirmed greenfield (0 repo consumers). `trustProxy: true` already at `main.ts:284`. OAuth orthogonality grep = 0 matches in `auth/oauth/`. 8-row concrete Phase-2 edit list locked in Phase 0 Deliverable Summary.

**New files:** none (Phase 0 is read-only).

**Changed files:** `docs/FEAT_FORGOT_PASSWORD_ROLE_GATE_MASTERPLAN.md` — checkboxes ticked, Phase 0 Deliverable Summary added, Changelog entry for 0.4.4, Session Tracking split into 1a/1b, header version/status/sessions bumped.

**Verification:**

- Docker: NOT started (Phase 0 is read-only, no DB/interceptor runtime inspection needed — `audit-request-filter.service.ts:59-62` behavior resolved by static analysis).
- ESLint / Type-check / Tests: N/A (no code changes).
- ADR cross-reference: ADR-001 (rate-limiting tier `auth` = 10/5min confirms `@AuthThrottle()` retention), ADR-005 (JWT+CLS pattern aligns with IP/UA extension), ADR-006 (CLS propagation contract honored), ADR-009 (`audit_trail` writer = auto-interceptor; Option A+ extends its scope).

**Deviations from v0.4.3:**

- Strict Option A was not viable. Upgraded to Option A+ (2-line helper extension). Plan §2.4 and §0.3-Ecosystem-Integration row "audit_trail auto-interceptor" now reflect this. No scope expansion — the audit-trail row still captures only standard HTTP metadata; block-semantic fields stay in `logger.warn()`.
- Phase 0 DoD item "Plan version bumped: 0.4.0 → 0.4.1 (patch)" was stale from v0.4.0 draft; bumped to 0.4.4 as the actual successor to 0.4.3.

**Next session (1b):** Phase 2 backend implementation. Start with `app.module.ts` CLS extension (smallest diff, unblocks `auth.service` CLS reads), then `audit.helpers.ts` `isAuthEndpoint()` extension, then `auth.service.forgotPassword()` rewrite, then `auth.service.resetPassword()` redemption gate + `burnToken()` helper, then `MailerService.sendPasswordResetBlocked()` + template, then controller additive mapping, then DTO field additions. Run `docker exec assixx-backend pnpm exec eslint backend/src/nest/auth/ backend/src/nest/common/` + `pnpm run type-check` at each save-point.

---

## Quick Reference: File Paths

### Backend (new)

| File                                                  | Purpose                      |
| ----------------------------------------------------- | ---------------------------- |
| `backend/templates/email/password-reset-blocked.html` | Blocked-reset email template |
| `backend/test/auth-forgot-password.api.test.ts`       | API integration tests        |

### Backend (modified)

| File                                                                 | Change                                                                                                                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/nest/auth/auth.service.ts`                              | Both gates (`forgotPassword`, `resetPassword`) + helper `burnToken()`                                                                                               |
| `backend/src/nest/auth/auth.controller.ts`                           | **v0.4.3:** additive response mapping (§2.2) — `{ message, blocked?, reason? }` superset. `@AuthThrottle()` stays (no decorator swap).                              |
| `backend/src/nest/auth/dto/index.ts` + referenced files              | **v0.4.3:** `ForgotPasswordResponse` adds two optional fields (`blocked?: true`, `reason?: 'ROLE_NOT_ALLOWED'`). `ResetPasswordResponse` unchanged. No clean-break. |
| `backend/src/nest/auth/auth.service.test.ts`                         | **v0.4.3:** +6 tests (role-matrix + redemption gate + token-burn). Down from +14 after Per-Email-Throttle cut.                                                      |
| ~~`backend/src/nest/common/decorators/throttle.decorators.ts`~~      | **v0.4.3 REMOVED**: Per-Email-Throttle deferred to v2. Existing `@AuthThrottle()` stays.                                                                            |
| ~~`backend/src/nest/common/decorators/throttle.decorators.test.ts`~~ | **v0.4.3 REMOVED**: no new tracker closures → no new test file.                                                                                                     |
| ~~`backend/src/nest/throttler/throttler.module.ts`~~                 | **v0.4.3 REMOVED**: no new named tiers. Module unchanged.                                                                                                           |
| ~~`backend/src/nest/common/guards/throttler.guard.ts`~~              | **v0.4.1/v0.4.3**: `CustomThrottlerGuard` remains untouched (confirmed).                                                                                            |
| `MailerService` file (path confirmed in Phase 0)                     | New `sendPasswordResetBlocked()` method                                                                                                                             |
| `backend/src/nest/app.module.ts` (lines 131–137 of current file)     | **MANDATORY** extension: `cls.set('ip', req.ip)` + `cls.set('userAgent', req.headers['user-agent'] ?? 'unknown')`                                                   |

### Frontend (modified)

| File                                                  | Change                                                                     |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `frontend/src/routes/forgot-password/+page.server.ts` | Action parses JSON, returns `blocked` / `reason` via `ActionData`          |
| `frontend/src/routes/forgot-password/+page.svelte`    | Render alert depending on `form.blocked` / `form.success` / `form.missing` |

### Database

**None.** (v0.1.0's proposed migration was dropped — audit enum does not exist.)

---

## Spec Deviations (since v0.1.0)

| #   | v0.1.0 / v0.2.0 claim                                                                                                                                                                      | Reality                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Decision                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | `frontend/src/routes/(auth)/forgot-password/`                                                                                                                                              | `frontend/src/routes/forgot-password/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Use real path (no `(auth)` group).                                                                                                                                                                                                                                                                                                                                                                           |
| D2  | Service `(email, requestMeta)`                                                                                                                                                             | `(dto: ForgotPasswordDto)` in current code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Keep `dto`; IP/UA via CLS.                                                                                                                                                                                                                                                                                                                                                                                   |
| D3  | `audit_trail_event_type` enum exists                                                                                                                                                       | Enum does not exist; `audit_trail` uses VARCHAR                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Phase 1 migration dropped.                                                                                                                                                                                                                                                                                                                                                                                   |
| D4  | Rate limit 5/min                                                                                                                                                                           | Actual: 10 req / 5 min per IP                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | v0.2.0 corrected. v0.3.0 replaces with `ForgotPasswordThrottle()` (5/15min IP + 1/5min email).                                                                                                                                                                                                                                                                                                               |
| D5  | `password-reset-blocked.de.html`                                                                                                                                                           | Naming has no locale suffix; dir is `backend/templates/email/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | File renamed + relocated.                                                                                                                                                                                                                                                                                                                                                                                    |
| D6  | `apiClient.post(...)` + `alertState` pattern                                                                                                                                               | Real pattern: SvelteKit Form Actions + `toast toast--error`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Phase 5 rewritten v0.2.0; v0.3.0 corrects to merge-not-replace + toast classes (not alert).                                                                                                                                                                                                                                                                                                                  |
| D7  | v0.2.0 "additive-compatible" response                                                                                                                                                      | User rule "no backward-compat in dev"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | **v0.3.0: clean break.** Old `{ message: string }`-only shape retired. DTO types rewritten. (R5 fully dropped from risk register — referenced only in v0.2.0 docs.)                                                                                                                                                                                                                                          |
| D8  | v0.1.0 `@AuthThrottle()` suffices                                                                                                                                                          | OWASP/NIST recommend per-email throttle for password reset                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **v0.3.0:** per-IP (5/15min) + per-email (1/5min) via `CustomThrottlerGuard.getTracker()` override.                                                                                                                                                                                                                                                                                                          |
| D9  | v0.2.0 "CLS extension only if needed"                                                                                                                                                      | `app.module.ts:131-137` confirmed missing `ip`/`userAgent`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **v0.3.0: MANDATORY** CLS extension in Phase 2.                                                                                                                                                                                                                                                                                                                                                              |
| D10 | v0.3.0 `password_reset_tokens(id, user_id, token, expires_at, used)`                                                                                                                       | Real schema also has `created_at TIMESTAMPTZ DEFAULT now()` + `on_update_current_timestamp` trigger                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | **v0.4.0 G2:** §0.1 schema-listing corrected. Plan does not use these columns; correction is doc hygiene.                                                                                                                                                                                                                                                                                                    |
| D11 | v0.3.0 R7 "OAuth has no code collision"                                                                                                                                                    | Correct for code-level, missed the architectural-bypass angle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | **v0.4.0 G3:** §0.2.5 #11 + ADR-047 "Relationship to ADR-046" acknowledge Microsoft OAuth as an orthogonal alternate-auth path for admin/employee.                                                                                                                                                                                                                                                           |
| D12 | v0.3.0 per-email throttle on `/reset-password`                                                                                                                                             | Body has no `email` field → tracker falls back to IP-only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | **v0.4.0 S3:** §0.2.5 #10 + §2.5 explicitly document request-gate-only scope; token-burn + TRUNCATE are compensating controls on redemption.                                                                                                                                                                                                                                                                 |
| D13 | v0.3.0 `cls.set('ip', req.ip)` assumed to return client IP                                                                                                                                 | Behind Nginx, Fastify returns Nginx IP unless `trustProxy: true` is set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | **v0.4.0 S5:** Phase 0 Step 0.1 adds `trustProxy` verification; Phase 2 configures it OR reads `X-Forwarded-For` manually in CLS setup. **v0.4.1 — verified: `main.ts:211` already has `trustProxy: true`**, Phase 2 DoD becomes a pure verification step.                                                                                                                                                   |
| D14 | v0.3.0/v0.4.0 planned `CustomThrottlerGuard.getTracker(req, throttlerName?)` override to differentiate `auth-email` vs `auth-ip`                                                           | `@nestjs/throttler@6.5.0` invokes `getTracker(req, context: ExecutionContext)` — 2nd arg is NEVER a throttler-name string. Override would compile but the `throttlerName === 'auth-email'` branch is unreachable dead code. Verified against compiled `throttler.guard.js canActivate()` and `throttler.decorator.js setThrottlerMetadata()`.                                                                                                                                                                                                                                              | **v0.4.1 T1/T2:** §2.5 rewritten. Per-tier `getTracker` closures live in `Throttle({ 'auth-email': { getTracker: authEmailTracker } })` decorator metadata, which the base-guard resolution prefers over the class default. `CustomThrottlerGuard` stays untouched.                                                                                                                                          |
| D15 | v0.4.1 `authEmailTracker` returned `ip:${ip}:email:${digest}` (IP prefix included)                                                                                                         | R6 + §0.2.5 #10 + Phase 4 test all require per-email throttle to hold ACROSS different IPs. With IP in the key, each rotated IP gets a fresh counter → cross-IP flood trivially bypasses the cap → Phase 4 "2nd request for same email from different IPs within 5 min → 429" fails. Internal contradiction between code and stated mitigation.                                                                                                                                                                                                                                            | **v0.4.2:** `authEmailTracker` returns pure `email:${digest}` when email is present. IP-only fallback kept for `/reset-password` (no email in body). §0.2.5 #10 description aligned. The `auth-ip` tier continues to enforce per-IP limits independently — the two tiers are now properly orthogonal controls.                                                                                               |
| D16 | v0.4.1 §0.1 claim "`TRUNCATE tenants CASCADE` will fail unless tokens are wiped first; deploy runs BEFORE any tokens exist"                                                                | PG TRUNCATE CASCADE propagates explicitly to ALL FK-referencing tables regardless of FK action (`ON DELETE RESTRICT` only gates DELETE). No preparation needed — the CASCADE transitively wipes `users` → `password_reset_tokens`. "Deploy before tokens exist" was wrong for dev too (live DB had 122 reset-token rows at 2026-04-17).                                                                                                                                                                                                                                                    | **v0.4.2:** §0.1 prose corrected — TRUNCATE CASCADE handles reset-tokens as a side-effect; operational outcome unchanged, doc accuracy restored.                                                                                                                                                                                                                                                             |
| D17 | v0.4.1 didn't address OAuth-only roots hitting `/auth/forgot-password`                                                                                                                     | ADR-046 may leave `users.password` as a placeholder (e.g. `'OAUTH'`) for accounts that never set a local credential. The plan's happy path treats them as regular roots and issues a reset link → redemption creates a real bcrypt hash. Could be either a legitimate local-password fallback (user lost Microsoft access) or a subtle credential-duplication quirk. Prior plan didn't name the behaviour.                                                                                                                                                                                 | **v0.4.2:** Known Limitation #10 added. V1 ships without special-casing; Phase 0 to confirm placeholder convention + whether ADR-046 prescribes a different self-service path. V2 could branch the template wording or short-circuit for OAuth-only users.                                                                                                                                                   |
| D18 | v0.4.1/v0.4.2 carried Per-Email-Throttle, Clean-Break Response, and TRUNCATE deploy-step as mandatory v1 items — items that grew out of iterative security reviews, not core-goal analysis | (1) Per-Email-Throttle addresses an unreported threat (cross-IP email flood) and shipped bugs in both v0.4.1 (phantom `throttlerName` arg) and v0.4.2 (`authEmailTracker` IP-prefix defeated R6). (2) Clean-Break Response was self-inflicted — misreading of user rule "no backward-compat in dev"; additive response achieves the same outcome for blocked users with zero DTO migration. (3) TRUNCATE's sole justification was Clean-Break's claimed token-incompatibility — collapses with additive (tokens stay valid, redemption gate burns admin/employee tokens on first attempt). | **v0.4.3 Staff-Engineer Scope-Re-Cut:** all three items dropped. Plan: 4+0.3 → 3 Sessions. Tests: 15+14 → 10+8. No new throttler/decorator/module files, no DDL deploy-step. Security goal unchanged — redemption gate + role-check intact; IP-throttle (10/5min via existing `@AuthThrottle()`) covers rate-limit. If distributed-IP email-flood becomes a real operational concern → v2 single-day sprint. |

---

## Known Limitations (V1 — deliberately excluded)

1. **Tenant domain verification** — orthogonal Break-Glass structural solution. Tracked in `FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md` (ADR-048). This plan ships AFTER Plan 2.
2. **MFA / TOTP on Root** — second-factor hardening of both login and reset. Tracked separately.
3. **Role-independent generic response** — explicitly rejected: product owner wants immediate UI block message at the request gate. R1 is an accepted trade-off (tightened throttle is the primary defense against enumeration).
4. **I18n of the email template** — German-only in V1, matching house style.
5. **Proactive notification to real root users** ("admin X tried to self-reset") — could be added later; not required for V1.
6. **Retroactive revocation of pre-plan reset tokens** — **v0.4.3:** TRUNCATE deploy-step removed. Pre-existing admin/employee tokens handled naturally by the §2.6 redemption gate (burned on first redemption attempt). Pre-existing root tokens continue to redeem normally — no customer friction.
7. **Per-user-agent throttle** — **v0.4.3:** Per-Email-Throttle deferred to v2 (§0.2.5 #10). Only IP is in the tracker (existing `@AuthThrottle()`). A botnet rotating IPs can saturate SMTP via distributed email-flood, but that's a v2 concern — v1 relies on SMTP-provider sender-rate-limits (SendGrid/Mailgun) at the infra layer.

8. **OAuth-only admin/employee gets a suboptimal blocked-email (v0.4.0 G3).** The template in §2.3 reads "Bitte wende Dich an einen Root-Benutzer in Deinem Unternehmen." — correct for password-only accounts, misleading for OAuth-only accounts where the user simply needs to sign in via Microsoft. V1 ships the generic template. V2 could branch template wording based on a `users.auth_method` or `password = 'OAUTH'` marker. Acceptable: the blocked-email is a rare, out-of-flow communication; an OAuth-only user clicking "Forgot password" is already confused, and even the suboptimal copy nudges them toward root-contact rather than silently ignoring them.

9. ~~**Per-email throttle scope: request-gate only**~~ — **v0.4.3: MOOT.** Per-Email-Throttle deferred to v2 entirely (§0.2.5 #10). This limitation no longer exists in v1 because the feature is out.

10. **OAuth-only root can gain a local password via the reset flow (v0.4.2).** ADR-046 introduced Microsoft OAuth signup which may leave `users.password` as a placeholder (e.g. `'OAUTH'` marker) for accounts that have never set a local credential. If such a root triggers `/auth/forgot-password`, the happy path still issues a reset link (role = `'root'`, is_active = 1 — both gates pass), and redeeming the token overwrites `users.password` with a fresh bcrypt hash. Effect: an OAuth-only root gains a parallel local credential. Two readings are both defensible:
    - **(intended)** A legitimate local-password fallback for roots who've lost access to their Microsoft account — arguably the whole point of "forgot password" for a root.
    - **(suspicious)** If the Microsoft account is compromised, the attacker sits in the mailbox that receives the reset link AND can later log in with the new password even after the victim revokes the Microsoft session. But the attacker already has the mailbox, so they could already trigger and consume any reset flow — not a new surface.
      **V1 decision: no special-casing.** `forgotPassword` / `resetPassword` stay oblivious to the `password = 'OAUTH'` placeholder. Phase 0 should confirm the placeholder convention (if any) and whether ADR-046 prescribes a different self-service path for OAuth-only roots; if so, branch the decision in ADR-047. V2 could short-circuit the happy path for OAuth-only users with a dedicated German template pointing them back to Microsoft sign-in.

---

## Post-Mortem (fill after completion)

### What went well

- (tbd)

### What went badly

- (tbd)

### Metrics

| Metric                   | Planned (v0.4.3)  | Actual |
| ------------------------ | ----------------- | ------ |
| Sessions                 | 3                 |        |
| Migration files          | 0                 |        |
| New backend files        | 1 (template only) |        |
| New frontend files       | 0                 |        |
| Changed files            | 4–5               |        |
| Unit tests               | 10                |        |
| API tests                | 8                 |        |
| ESLint errors at release | 0                 |        |
| Spec deviations          | 18 (listed)       |        |

---

**This document is the execution plan. Every session starts here, takes the next unchecked item, and marks it done. No coding starts before Phase 0 is green.**
