# FEAT: Forgot-Password Role-Gate — Execution Masterplan

> **Plan type:** FEATURE
> **Created:** 2026-04-16
> **Version:** 0.4.2 (Fourth-pass validation — Critical `authEmailTracker` bug fixed (IP prefix was defeating R6 cross-IP protection; key is now pure `email:<hash>`); §0.1 TRUNCATE CASCADE prose corrected (FK `ON DELETE RESTRICT` is irrelevant to TRUNCATE CASCADE; live DB had 122 reset-token rows); OAuth-only-root password-reset edge case added as Known Limitation #10)
> **Status:** DRAFT — BLOCKED on Plan 2 Phase 1 (clean-slate + pre-verified test-tenant seed)
> **Branch:** `feat/forgot-password-role-gate`
> **Author:** Simon Öztürk (with Staff-Engineer assist)
> **Estimated sessions:** 4 (includes +0.3 session in Phase 2 for per-email throttle implementation)
> **Actual sessions:** 0 / 4
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

| Version | Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-04-16 | Initial draft — phases outlined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 0.2.0   | 2026-04-16 | Ground-truth review applied (11 corrections above); §2.6 redemption gate added; Phase 1 dropped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 0.3.0   | 2026-04-16 | Validation-review integrated: (1) clean-break response per user rule "No backward-compat in dev" — additive framing removed, §2.2 rewritten, R5 dropped. (2) Tightened throttle: new `ForgotPasswordThrottle()` = 5 req/15 min per IP **AND** 1 req/5 min per hashed email via `CustomThrottlerGuard.getTracker()` extension. (3) CLS `ip`/`userAgent` extension MANDATORY in `ClsModule.forRoot` (verified: current setup only populates requestId/Path/Method). (4) Frontend §5.2 rewritten: merge-into-existing-markup (keep `email=$state`, `loading=$state`, `isEmailValid=$derived`, `toast toast--error` classes — NOT `alert alert--error`). (5) Deploy step: `TRUNCATE password_reset_tokens` at release (breaking response invalidates all pre-existing tokens anyway). (6) ADR number fixed: **ADR-047**. (7) Sequencing: ships AFTER Plan 2 (ADR-048). (8) DTO types `ForgotPasswordResponse` + `ResetPasswordResponse` added to change-list.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 0.4.2   | 2026-04-17 | **Fourth-pass validation — two ground-truth bugs caught by independent review of v0.4.1 text vs stated intent:** (1) **MAJOR — `authEmailTracker` returned `ip:${ip}:email:${digest}`** which scoped the tier to per-(IP,email), defeating R6 ("stops single-target flood even across IPs"), contradicting §0.2.5 #10's IP-agnostic intent, and making the Phase 4 test "2nd request for same email from different IPs within 5 min → 429" unachievable. Fixed: tracker now returns pure `email:${digest}` when email is present; IP-only fallback (`ip:${req.ip}`) retained for `/reset-password` where body has no email. §0.2.5 #10 description aligned. The separate `auth-ip` tier continues to handle IP-bound throttling; the two tiers are now properly orthogonal. (2) **MINOR — §0.1 claim "Plan 2's TRUNCATE tenants CASCADE will fail on this FK unless tokens are wiped first"** was WRONG — PG's TRUNCATE CASCADE propagates to ALL FK-referencing tables regardless of `ON DELETE` action (`ON DELETE RESTRICT` only affects DELETE). The follow-up claim "Plan 2's deploy runs BEFORE any tokens exist" was also wrong for dev (live DB had 122 reset-token rows as of 2026-04-17 verification). Corrected: Plan 2's clean-slate wipes reset tokens as a side-effect of TRUNCATE CASCADE; works regardless of FK action. (3) **MINOR — Known Limitation #10 added (OAuth-only root can gain local password via reset flow).** ADR-046 OAuth-only roots are not short-circuited; the happy path still issues a reset link → redemption sets a bcrypt password. V1 accepts (arguably a legitimate credential fallback); Phase 0 to confirm placeholder convention and whether ADR-046 prescribes a different path. Spec Deviations D15–D17 added. |
| 0.4.1   | 2026-04-17 | **Third-pass validation — NestJS Throttler API verified against compiled source at `backend/node_modules/@nestjs/throttler@6.5.0`:** (1) **T1 — `CustomThrottlerGuard.getTracker()` cannot receive `throttlerName`:** compiled `throttler.guard.js` calls `getTracker(req, context)` where the 2nd arg is `ExecutionContext`, NOT `throttlerName`. The v0.3.0/v0.4.0 proposal to override with `(req, throttlerName?: string)` would compile but the `throttlerName` branch would never fire — per-email throttle silently dead. (2) **T2 — Correct API is per-tier `getTracker` in decorator options:** `Throttle({ 'auth-email': { limit, ttl, getTracker: fn } })` stores `THROTTLER_TRACKER + name` metadata (verified in compiled `throttler.decorator.js` line `setThrottlerMetadata`), guard lookup order is `route/class metadata → named-throttler option → common → class default`. (3) **§2.5 rewritten** around decorator-side per-tier closures; `CustomThrottlerGuard` stays untouched. (4) **Phase 2 DoD + Phase 3 unit tests + Quick Reference table updated** to match. (5) D14 added to Spec Deviations. (6) **P1 — `auth.service.ts:631` `private createUser()`:** independent grep shows `INSERT INTO users` in a third auth-internal helper (called from `auth.service.ts:269` — ADR-005-style authenticated registration path). NOT in Plan 1's scope (Plan 1 does not touch user creation), but noted here for cross-plan awareness with Plan 2 (ADR-048 §2.11 allowlist may need a third entry).                                                                                                                                                                                                                                        |
| 0.4.0   | 2026-04-17 | **Second-pass validation integrated** (independent ground-truth on post-OAuth `main`): (1) **G2 — `password_reset_tokens` schema:** §0.1 + anchor list corrected — table has `created_at TIMESTAMPTZ DEFAULT now()` + `on_update_current_timestamp` trigger; prior doc listed only 5 columns. (2) **G3 — OAuth bypass in threat model:** new §0.2.5 #11 acknowledges that Microsoft OAuth (ADR-046, merged `5cd293ae8`) is a structural alternate-auth path for admin/employee — they can sign in via Azure AD without ever hitting forgot-password. Plan 1 remains correct (role-gate on password reset) but ADR-047 writeup must acknowledge OAuth-only accounts exist; blocked-email template gets an OAuth-aware variant (deferred to V2, Known Limitation #8). (3) **S3 — per-email throttle on `/reset-password`:** §2.5 + new note — `/reset-password` body has no `email` field, so the per-email tracker falls back to IP-only on that endpoint. Per-IP 5/15min remains; per-email 1/5min is a REQUEST-GATE-ONLY control. (4) **S5 — Fastify `trustProxy`:** Phase 0 Step 0.1 + §0.3 — must verify `main.ts` configures `trustProxy: true` before §2.1 relies on `req.ip` for logging; otherwise blocked-email logs show Nginx IP (`172.x`). (5) **G7 — TRUNCATE deploy-step:** Phase 6 clarified — runs as `assixx_user` (not `app_user`, lacks DDL). (6) **W1 — R5 cleanup:** Spec-Deviation D7 tidied, no more stale R5 reference. (7) **G11 — existing-token burn on request-gate:** §2.1 clarified — blocked path does NOT invalidate admin/employee's pre-existing unused tokens; the redemption gate in §2.6 catches any attempted redemption AND the Phase 6 TRUNCATE wipes the slate. Defense-in-depth holds.                                 |
| 1.0.0   | YYYY-MM-DD | Phase 2 complete — backend done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 1.1.0   | YYYY-MM-DD | Phase 3 complete — unit tests green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 1.2.0   | YYYY-MM-DD | Phase 4 complete — API integration tests green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 1.3.0   | YYYY-MM-DD | Phase 5 complete — frontend done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2.0.0   | YYYY-MM-DD | Phase 6 complete — ADR-047 written, shipped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

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

| #   | Risk                                                                                  | Impact | Probability | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                           | Verification                                                                                                           |
| --- | ------------------------------------------------------------------------------------- | ------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| R1  | Role enumeration via differentiated UI response                                       | Medium | Low         | (a) Tightened throttle: `ForgotPasswordThrottle()` = 5 req/15 min per IP **AND** 1 req/5 min per hashed-email (see §2.5, Q5 decision). (b) Silent-drop for non-existent **and** inactive preserved. (c) Product-accepted tradeoff: UX clarity > enumeration risk                                                                                                                                                     | Phase 0 confirms decorator wiring. Phase 4 tests: 6th req/15min from same IP → 429; 2nd req/5min for same email → 429. |
| R2  | Blocked-mail template missing / mis-rendered                                          | High   | Low         | API integration test: POST with admin email → assert outbound mail matches template + variables (`firstName`, `ip`, `timestamp`)                                                                                                                                                                                                                                                                                     | Phase 4 API test + Phase 6 dev-SMTP smoke.                                                                             |
| R3  | Role field null / unexpected → admin slips through                                    | High   | Low         | Secure default: any value **not** the literal `'root'` is blocked. Unit test covers null + unexpected.                                                                                                                                                                                                                                                                                                               | Phase 3 unit test.                                                                                                     |
| R6  | Email flood via repeated abuse                                                        | Low    | Low         | Per-email throttle (1 req/5min per hashed email) stops single-target flood even across IPs. SMTP pressure bounded.                                                                                                                                                                                                                                                                                                   | Phase 4 API test with distinct IPs + same email.                                                                       |
| R7  | In-flight OAuth refactor collides with `auth.service.ts` changes                      | Low    | None        | ✅ OAuth shipped as ADR-046 before this plan starts. `auth.service.ts:367` / `:411` re-verified as Plan-1 anchors.                                                                                                                                                                                                                                                                                                   | Re-verified at Phase 0 start.                                                                                          |
| R8  | Blocked-mail flagged as spam                                                          | Low    | Low         | Reuse existing sender / envelope / branded-template style (`password-reset.html` as peer).                                                                                                                                                                                                                                                                                                                           | Phase 6 smoke to Outlook + Gmail.                                                                                      |
| R9  | Stolen / pre-existing admin token redeemed via `/auth/reset-password`                 | High   | Low         | §2.6 redemption gate: re-check role at redemption, burn token + audit on block. Deploy-step `TRUNCATE password_reset_tokens` (Phase 6) invalidates ALL pre-plan tokens at release.                                                                                                                                                                                                                                   | Phase 3 + Phase 4 tests.                                                                                               |
| R10 | Custom throttler-tracker (§2.5 per-email key) breaks existing auth throttle behaviour | Medium | Low         | **v0.4.1 T1/T2 scope change:** per-tier `getTracker` closures are carried in `Throttle({...})` decorator options, so they affect ONLY endpoints annotated with `@ForgotPasswordThrottle()`. Existing `@AuthThrottle()` endpoints (login, refresh) are untouched — different throttler name (`auth`). `CustomThrottlerGuard` stays unmodified. Phase 3 pure-function tests cover both tracker closures independently. | Phase 3 + Phase 4.                                                                                                     |

**Removed since v0.2.0:** R5 (response-shape backward-compat — dropped per user-rule "no backward-compat in dev"; clean break in §2.2).
**Removed since v0.1.0:** R4 (enum missing — non-issue, no enum exists).

### 0.2.5 Explicit Design Decisions

1. **`has_full_access = true` does NOT unlock self-service reset.** Data-visibility bypass (ADR-010) is separate from auth-self-service. Narrower than ADR-045 Layer-1 by design. Role-only check at both gates.

2. **Lead positions (area / department / team lead) do NOT unlock self-service reset.** Organizational function ≠ auth privilege.

3. **HTTP 200 on `/auth/forgot-password`** for all three paths (root / blocked / silent-drop). Differentiation lives in body. Preserves current API idiom; matches what the UI already reads.

4. **HTTP 403 on `/auth/reset-password`** when the redemption gate blocks. Reason: the endpoint is token-authenticated, and a role-block is an **authorization** failure, not a token-validity failure. 403 gives the frontend a clear error handler; the text is generic and does not leak role info.

5. **Silent drop for non-existent AND inactive users is preserved.** `user?.is_active !== 1` covers is_active ∈ {0, 3, 4}. No differentiated errors — would replace R1's role-enumeration leak with a worse active/inactive oracle.

6. **Clean-break response shape (no backward-compat).** Per user rule "no backward-compat in dev": the response shape is rewritten, not additively extended. `ForgotPasswordResponse` + `ResetPasswordResponse` DTOs get new fields and old consumers must adapt in the same PR. Test data can be truncated; no legacy clients to preserve. Replaces v0.2.0's "additive-compatible" framing.

7. **Break-Glass is outsourced to company IT** via `FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md` (ADR-048, ships first). A DNS-verified tenant domain means the customer's IT admin controls the mailbox and can recreate it if Root loses access. This plan does not need an SRE-runbook or a Multi-Root-Mandate. **Note:** unverified tenants have a single-root-mailbox-loss deadlock (Plan 2 Known Limitation #10, blast-radius = 1 tenant-slot, accepted).

8. **Token burning on redemption block** — `password_reset_tokens.used = true` is set when a non-root target is detected. Prevents retry-with-same-token. Irreversible by design.

9. **Deploy-step: `TRUNCATE password_reset_tokens` at release.** Breaking response shape means in-flight tokens generated against the old API contract are incompatible with the new redemption gate. TRUNCATE clears the slate; legitimate users re-request after deploy. Documented in Phase 6.

10. **Tightened throttle per OWASP / NIST**: per-IP (5/15 min) AND per-target-email (1/5 min). Both enforced. Implementation (v0.4.1 T1/T2 correction): per-tier `getTracker` closures passed through the `Throttle({ 'auth-ip': { ... }, 'auth-email': { limit, ttl, getTracker } })` decorator. The base-class `CustomThrottlerGuard.getTracker()` stays as-is — it only sees `(req, context: ExecutionContext)` in `@nestjs/throttler@6.5.0`, so a "`throttlerName`-aware" override is not possible at that layer. The `auth-email` closure returns pure `email:${sha256(lowercase+trim(email))}` — **IP-agnostic by design (v0.4.2 bug-fix)**, so the per-email cap stops a single-target SMTP flood even when a botnet rotates source IPs (R6). Hashed email keeps PII out of Redis keys; the IP-bound defense lives in the separate `auth-ip` tier so the two controls stay orthogonal.
    **Important scope clarification (v0.4.0 S3, re-verified v0.4.2):** The per-email tier only fires on `/auth/forgot-password` — whose request body contains `email`. `/auth/reset-password` accepts `{ token, password }` with NO `email` field. For that endpoint, the `auth-email` tracker closure detects `email === ''` and falls back to `ip:${req.ip}` (same namespace prefix as the `auth-ip` tier), so the per-email limit effectively does nothing on redemption. Per-IP throttle (5/15 min) stays the only rate control on `/reset-password`. Two defenses still cover the redemption-side threat:
    - §2.6 redemption gate burns the token on any non-root match (single-use, no retry).
    - Phase-6 deploy-step `TRUNCATE password_reset_tokens` wipes all pre-release tokens.
      Resolving symptoms further (e.g., embedding email-hash in the token, or a second DB lookup before throttle) would require either a wire-format change or a layering inversion — both rejected as worse than the accepted gap.

11. **Microsoft OAuth is an acknowledged alternate-auth path (v0.4.0 G3).**
    ADR-046 merged Microsoft OAuth sign-in as a first-class authentication route (commit `5cd293ae8`). Admin or employee users whose tenant has OAuth enabled can sign in via Azure AD WITHOUT ever hitting `/auth/forgot-password`. Plan 1 does NOT try to interfere with that path — role-gate on password-reset is not a security model for "admins can never regain access", only for "password reset is not the vehicle by which they regain access". The correct mental model is:
    - Root users: password-reset is the self-service path.
    - Admin/Employee: EITHER (a) contact a root user in their tenant, OR (b) use Microsoft OAuth if their tenant has configured it. OAuth-only users (no password hash or `password = 'OAUTH'` placeholder) don't need password-reset anyway.
      Implication for §2.1: a blocked admin who only uses OAuth will receive the generic blocked-email (§2.3). Template wording ("Bitte wende Dich an einen Root-Benutzer") is suboptimal for OAuth-only admins ("Du meldest Dich über Dein Firmen-Microsoft-Konto an — ein Passwort-Reset ist nicht nötig") — accepted as a V1 limitation, tracked in Known Limitations #8. ADR-047 MUST include a "Relationship to ADR-046" section that states this explicitly.
      **Threat-model note:** The OAuth path does NOT reduce Plan 1's attack surface — an attacker cannot abuse it to bypass the role-gate because Microsoft only issues tokens for identities the Azure AD tenant owns. If an attacker compromises an admin's Microsoft account, they already have full account access and no password-reset would be needed. The two auth surfaces are orthogonal.

### 0.3 Ecosystem Integration Points

| System                                                                                        | Integration                                                                                                                                                                                                                                                                                                                                                                                                                                          | Phase |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `audit_trail` auto-interceptor                                                                | Phase 0 decides if auto-row is rich enough (Option A) or a manual `ActivityLoggerService` call is needed (Option B)                                                                                                                                                                                                                                                                                                                                  | 0 → 2 |
| `ActivityLoggerService`                                                                       | **If Option B:** `ActivityAction` union gets a new literal (e.g., `'block'`). Method call added after `sendPasswordResetBlocked(...)`.                                                                                                                                                                                                                                                                                                               | 0 → 2 |
| Email service (`MailerService`, `loadBrandedTemplate`)                                        | New method `sendPasswordResetBlocked(user, meta)` + new template `password-reset-blocked.html`                                                                                                                                                                                                                                                                                                                                                       | 2     |
| Rate limiter: NEW `ForgotPasswordThrottle()` (5/15min per IP **AND** 1/5min per hashed-email) | Replaces `@AuthThrottle()` on `/forgot-password` + `/reset-password`. **v0.4.1 T1/T2 correction:** per-tier `getTracker` closures are carried in `Throttle({...})` decorator options (stored as `THROTTLER_TRACKER + name` metadata by `@nestjs/throttler@6.5.0`). `CustomThrottlerGuard.getTracker()` is NOT overridden — the base-guard call site is `getTracker(req, context: ExecutionContext)`, a phantom `throttlerName` arg would never fire. | 2     |
| `users.role`, `users.is_active`                                                               | Read at both gates                                                                                                                                                                                                                                                                                                                                                                                                                                   | 2     |
| `password_reset_tokens` table                                                                 | Redemption gate marks `used = true` when blocking. **Deploy-step TRUNCATE at release** (see Phase 6).                                                                                                                                                                                                                                                                                                                                                | 2 + 6 |
| CLS context (`ClsService`, ADR-006)                                                           | **MANDATORY:** extend `ClsModule.forRoot` `setup:` in `app.module.ts:131-137` by two lines (`cls.set('ip', req.ip)` + `cls.set('userAgent', req.headers['user-agent'])`). Verified: current setup populates only `requestId` / `requestPath` / `requestMethod`.                                                                                                                                                                                      | 2     |
| Fastify `trustProxy` (v0.4.0 S5)                                                              | `req.ip` must resolve to the true client IP behind the Nginx reverse-proxy (Production: port 80 → :3000). Either `trustProxy: true` on `NestFastifyApplication` OR manual `X-Forwarded-For` read in CLS setup. Phase 0 records the chosen path, Phase 2 implements.                                                                                                                                                                                  | 0 → 2 |
| Microsoft OAuth (ADR-046, v0.4.0 G3)                                                          | Orthogonal code path — no shared functions with `auth.service.ts` (grep-verified). ADR-047 must include a "Relationship to ADR-046" section stating that OAuth-only admins are a legitimate use case and the role-gate does not attempt to block them at the OAuth layer.                                                                                                                                                                            | 6     |
| Frontend `/forgot-password` Form Action                                                       | Action parses backend JSON, re-exports `blocked` + `reason` via `ActionData`                                                                                                                                                                                                                                                                                                                                                                         | 5     |
| Existing `password-reset.html` template + sender                                              | Untouched — remains the root-happy-path mail                                                                                                                                                                                                                                                                                                                                                                                                         | N/A   |

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

- [ ] Read `auth.controller.ts` — endpoint paths, decorators (`@AuthThrottle()`, `@Public()`, etc.), current response shape
- [ ] Read `dto/forgot-password.dto.ts` + `dto/reset-password.dto.ts`
- [ ] Record exact `@AuthThrottle()` decorator line(s) on controller
- [ ] Grep `ClsModule.forRoot` in `app.module.ts` — does `setup:` callback populate IP and user-agent into CLS?
- [ ] Read `MailerService` — confirm exact class, sender config, `sendPasswordReset()` signature to mirror for blocked variant
- [ ] **Fastify `trustProxy` verification (v0.4.0 S5):** `grep -n trustProxy backend/src/nest/main.ts` (and anywhere `NestFactory.create` is called). For `req.ip` to return the client IP behind Nginx (not the Nginx container IP `172.x`), Fastify must be configured with `trustProxy: true` — either globally via `NestFastifyApplication(… { trustProxy: true })` or at the adapter-options level. If NOT set → the blocked-email template shows the Nginx egress address, which is useless for the user. Two acceptable outcomes:
  - (a) Flag `trustProxy` as a Phase-2 follow-up edit in `main.ts` and confirm the production Nginx adds the `X-Forwarded-For` header (it should — standard reverse-proxy setup).
  - (b) Fall back to reading `X-Forwarded-For` header directly in the CLS `setup:` callback: `cls.set('ip', req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.ip)`.
    Decide in Phase 0, implement in Phase 2. Phase 0 DoD must record the chosen approach.
- [ ] **OAuth anchor (v0.4.0 G3):** read `oauth.service.ts` for `forgotPassword` / `password_reset` references → grep confirmed none exist; OAuth and password-reset are orthogonal code paths. Record this in the Phase-0 deliverable so the ADR-047 "Relationship to ADR-046" section has a concrete code anchor.

### Step 0.2 — Email discovery [partially confirmed]

Confirmed:

- Dir: `backend/templates/email/`
- Peers: `new-document.html`, `notification.html`, `password-reset.html`, `welcome.html`
- No locale suffix (German implicit)
- Access: `emailService.loadBrandedTemplate('password-reset', vars)` (name without `.html`)

Remaining:

- [ ] Read `password-reset.html` for branded layout + variable conventions
- [ ] Confirm `MailerService` location + method name of the wrapper

### Step 0.3 — Audit mechanism decision [resolve in Phase 0]

Per HOW-TO-INTEGRATE-FEATURE §2.7: `audit_trail` is auto-populated by a global interceptor.

- **Option A (preferred default):** auto-row suffices. Add `this.logger.warn(...)` for ops visibility only.
- **Option B:** extend `ActivityAction` union with e.g. `'block'`; call `ActivityLoggerService.log()`.

Phase 0 action:

- [ ] Inspect one sample row in `audit_trail` produced by a real `/auth/forgot-password` hit (curl locally, query DB). Does it carry target `user_id`, `tenant_id`, path, status, and (ideally) a snippet of response body?
- [ ] **If yes → pick Option A.** Plan §2.4 stays lightweight.
- [ ] **If no → pick Option B.** Plan §2.4 adds the `+1` literal + service call. M1 resolved.

### Step 0.4 — Frontend discovery [partially confirmed]

Confirmed:

- `frontend/src/routes/forgot-password/+page.svelte`
- `frontend/src/routes/forgot-password/+page.server.ts`
- Pattern: SvelteKit Form Actions.

Remaining:

- [ ] Read both files to anchor exact edit points (current `actions.default` body + current markup)
- [ ] Confirm design-system **toast** classes (`toast toast--error` — what the current page uses) and the existing layout primitives (`.subtitle`, `.success-actions`, `.btn btn-index`). `alert alert--*` classes also exist in the design-system but are **not** used on this page; stick with the existing `toast` pattern for Phase 5 merges.

### Step 0.5 — CLS IP/UA extension (MANDATORY — verified-missing)

**Ground-truth already verified in plan review**: `app.module.ts:131-137` sets only `requestId`, `requestPath`, `requestMethod`. `ip` + `userAgent` are NOT populated. The extension is non-optional.

- [ ] Anchor the exact lines to edit in `app.module.ts` (currently 131–137).
- [ ] Confirm no other consumer of the CLS `setup:` would be disturbed by two additional `cls.set(...)` calls (grep `cls.get('ip'` / `cls.get('userAgent'` repo-wide — if other code already reads these under a different source, reconcile).
- [ ] Record the exact two lines to add:

```typescript
// app.module.ts — inside ClsModule.forRoot({ middleware: { setup: ... } })
cls.set('ip', req.ip);
cls.set('userAgent', req.headers['user-agent'] ?? 'unknown');
```

No code change in Phase 0 — the edit lands in Phase 2 together with `auth.service.forgotPassword()`.

### Phase 0 — Definition of Done

- [ ] All §0.1–§0.5 checkboxes filled with concrete line numbers / signatures / decisions
- [ ] Audit mechanism chosen (A or B) with one-sentence reasoning
- [ ] CLS extension lines drafted (two `cls.set(...)` calls for `ip` + `userAgent`) — edit deferred to Phase 2
- [ ] Throttler anchor recorded: exact file + class of `CustomThrottlerGuard` (`backend/src/nest/common/guards/throttler.guard.ts`), method `getTracker()` signature, current default behavior
- [ ] Frontend anchor recorded: current `email=$state`, `loading=$state`, `isEmailValid=$derived`, `toast toast--error` classes in `forgot-password/+page.svelte` (confirmed in v0.3.0 review)
- [ ] DTO anchors recorded: current shape of `ForgotPasswordResponse` + `ResetPasswordResponse` in `dto/index.ts`
- [ ] **Fastify `trustProxy` status recorded (v0.4.0 S5):** either "already configured in `main.ts:NN`" or "NOT configured — Phase 2 will add it OR fall back to `X-Forwarded-For` header read in CLS setup"
- [ ] **OAuth-path grep recorded (v0.4.0 G3):** confirmed zero references to `forgotPassword` / `password_reset` in `backend/src/nest/auth/oauth/**` → anchors the orthogonality claim for ADR-047 "Relationship to ADR-046"
- [ ] Plan version bumped: 0.4.0 → 0.4.1 (patch)

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

### Step 2.2 — Controller response (clean break) [STATUS]

**File:** `backend/src/nest/auth/auth.controller.ts`

Clean-break shape per §0.2.5 #6. No additive / legacy compatibility. Frontend in Phase 5 is updated in the same PR; no SPA client outside this repo consumes these endpoints.

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

### Step 2.5 — Tightened throttle: per-IP AND per-email [STATUS]

**Decision (Q5):** per-IP (5/15 min) AND per-email (1/5 min), both enforced. Replaces the generic `@AuthThrottle()` (10/5min) on the two password-reset endpoints. Login + refresh stay on `@AuthThrottle()`.

**Implementation (v0.4.1 T1/T2 — verified against `@nestjs/throttler@6.5.0` compiled source):**

`@nestjs/throttler` allows **per-named-throttler `getTracker` closures** at the decorator layer. The `Throttle({ name: { limit, ttl, getTracker } })` signature is typed by `ThrottlerMethodOrControllerOptions` (see `@nestjs/throttler/dist/throttler.decorator.d.ts`), and the compiled `setThrottlerMetadata` stores the closure as `THROTTLER_TRACKER + name` Reflect-metadata. The guard base class then resolves `const getTracker = routeOrClassGetTracker || namedThrottler.getTracker || this.commonOptions.getTracker` per request (see `throttler.guard.js` `canActivate`). `CustomThrottlerGuard.getTracker()` is NOT overridden — doing so cannot receive the throttler name, because the base-class invocation is `await getTracker(req, context)` where the 2nd arg is `ExecutionContext`, not a string. A `(req, throttlerName?: string)` override would compile but the `throttlerName === 'auth-email'` branch would never fire (silently dead code).

**New decorator** (`backend/src/nest/common/decorators/throttle.decorators.ts`):

```typescript
import { applyDecorators } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';

/** SHA-256 of lowercased + trimmed email. Empty/malformed → '' sentinel for caller. */
function hashEmail(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const normalized = raw.toLowerCase().trim();
  if (normalized === '') return '';
  return createHash('sha256').update(normalized).digest('hex');
}

/** Resolve client IP behind Nginx. Requires Fastify `trustProxy: true` (already set in main.ts:211). */
function trackerIp(req: FastifyRequest): string {
  return req.ip;
}

/**
 * Per-tier `getTracker` for the `auth-email` named throttler.
 *
 * Body: `{ email: string, ... }` on /auth/forgot-password → key is `email:<sha256>`.
 * On /auth/reset-password the body has NO `email` field — `hashEmail` returns ''
 * and this tier collapses into IP-only (documented in §0.2.5 #10, S3).
 *
 * WHY no IP prefix when email is present (v0.4.2 bug-fix):
 *   The `auth-email` tier's purpose (R6, §0.2.5 #10) is to stop a single-target SMTP
 *   flood EVEN ACROSS IPs — a botnet targeting one victim's mailbox must not sidestep
 *   the per-email limit by rotating source IPs. If the key included the IP
 *   (`ip:<ip>:email:<hash>`), every rotation would hit a fresh counter and the
 *   mitigation would be trivially bypassed; Phase 4's test case
 *   "2nd request for same email from different IPs within 5 min → 429" would also
 *   fail. The per-IP defense is already handled independently by the `auth-ip` tier.
 *   Therefore the key is pure `email:<hash>` — IP-agnostic.
 */
function authEmailTracker(req: FastifyRequest, _ctx: ExecutionContext): string {
  const body = req.body as { email?: unknown } | undefined;
  const digest = hashEmail(body?.email);
  if (digest === '') return `ip:${trackerIp(req)}`; // /reset-password: fall back to IP-only
  return `email:${digest}`; // /forgot-password: IP-agnostic per-email cap
}

/** Per-tier `getTracker` for the `auth-ip` named throttler (prefixed for consistency with CustomThrottlerGuard key convention). */
function authIpTracker(req: FastifyRequest, _ctx: ExecutionContext): string {
  return `ip:${trackerIp(req)}`;
}

/**
 * Password-reset endpoints: 5 req / 15 min per IP AND 1 req / 5 min per hashed target email.
 * Defense against IP-bound enumeration + single-target email flooding.
 *
 * The per-tier `getTracker` closures are carried inside the `Throttle({...})` options —
 * the decorator stores them as `THROTTLER_TRACKER + name` Reflect-metadata, which the
 * base `ThrottlerGuard.canActivate` pulls in preference to the common/class default.
 * This is the correct API for per-tier differentiation in `@nestjs/throttler@6.x` —
 * overriding `CustomThrottlerGuard.getTracker()` cannot receive the throttler name.
 *
 * See ADR-047 §2.5 for rationale + OWASP/NIST alignment.
 */
export const ForgotPasswordThrottle = (): ThrottleDecorator =>
  applyDecorators(
    Throttle({
      'auth-ip': { limit: 5, ttl: 15 * MS_MINUTE, getTracker: authIpTracker },
      'auth-email': { limit: 1, ttl: 5 * MS_MINUTE, getTracker: authEmailTracker },
    }),
    SkipThrottle({ auth: true, public: true, user: true, admin: true, upload: true, export: true }),
  ) as ThrottleDecorator;
```

**Why this design, not a guard-class override:**

| Approach                                                                                   | Receives throttlerName?                                                         | Works in @nestjs/throttler 6.5.0?                                                   |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Override `CustomThrottlerGuard.getTracker(req, throttlerName?)`                            | **No** — base calls `getTracker(req, context)` with ExecutionContext as 2nd arg | Compiles, silently broken                                                           |
| Per-tier `getTracker` in `Throttle({...})` decorator options                               | **Not needed** — each named tier has its OWN closure                            | **Correct** ✅                                                                      |
| Per-tier `getTracker` in `ThrottlerModule.forRoot({ throttlers: [{ name, getTracker }] })` | Same as above, module-level                                                     | Also correct; we use the decorator layer so the rule is co-located with the feature |

**Module registration (unchanged scope):** `AppThrottlerModule` (in `backend/src/nest/throttler/throttler.module.ts`) must register the two named tiers (`auth-ip`, `auth-email`) so `THROTTLER_SKIP` / `THROTTLER_TTL` resolution resolves correctly when no decorator is present. The `getTracker` closures live in the decorator — NOT in the module registration — so they're grep-visible at the use site.

**Redemption endpoint (`/reset-password`) uses the same decorator** for consistency, BUT:

**v0.4.0 S3 — scope clarification:** `/reset-password` body is `{ token, password }` — NO `email` field. The custom tracker's `email === ''` fallback returns `req.ip`, so on this endpoint the `auth-email` tier collapses into the same key space as `auth-ip`. Effective rate control on `/reset-password` is therefore ONLY the per-IP `5/15 min` limit. The per-email `1/5 min` tier is REQUEST-GATE-ONLY.

Why we accept this:

- §2.6 redemption gate burns the token on any non-root match → stolen-token attacker gets one attempt per token, not many.
- Phase-6 deploy-step `TRUNCATE password_reset_tokens` wipes ALL pre-release tokens at release → no burn-through-many-old-tokens vector survives the deploy.
- Adding email to the redemption body would be a wire-format change (DTO break, existing front-end impact). Doing a DB lookup of `user_id → email` before the throttle would invert layering (throttle runs before service logic). Both cures worse than the disease.

Decorator kept uniform on both endpoints so the reader sees one control, with the scope-caveat documented here and in §0.2.5 #10.

- [ ] `@ForgotPasswordThrottle()` wired on `/auth/forgot-password` AND `/auth/reset-password`
- [ ] Redis keys under `auth-ip:*` and `auth-email:*` verifiable via `docker exec assixx-redis redis-cli -a ... KEYS 'throttle:auth-*'`
- [ ] Old `@AuthThrottle()` removed from these two endpoints (still used by `/auth/login`, `/auth/refresh`)

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
- [ ] NEW `ForgotPasswordThrottle()` decorator in `throttle.decorators.ts` carries per-tier `getTracker` closures (`authIpTracker`, `authEmailTracker`) directly inside `Throttle({...})` options (v0.4.1 T1/T2 — correct `@nestjs/throttler@6.5.0` API). `CustomThrottlerGuard` is **untouched**. Replaces `@AuthThrottle()` on `/forgot-password` + `/reset-password`.
- [ ] `AppThrottlerModule` registers the two named tiers (`auth-ip`, `auth-email`) with their `limit`/`ttl` defaults (decorator may still override per-endpoint)
- [ ] `ClsModule.forRoot` `setup:` in `app.module.ts` extended with `cls.set('ip', req.ip)` + `cls.set('userAgent', req.headers['user-agent'] ?? 'unknown')`
- [ ] **`trustProxy` resolved (v0.4.0 S5):** either `NestFastifyApplication` created with `{ trustProxy: true }` OR CLS setup reads `X-Forwarded-For` manually. Verified via a direct `curl -H "X-Forwarded-For: 1.2.3.4" http://localhost/api/v2/auth/forgot-password …` — `req.ip` in the forgot-password path logs `1.2.3.4`, not the Nginx container IP.
- [ ] No `any`; `??` not `||`; explicit null checks; `import type` for type-only imports; `getErrorMessage()` for catches
- [ ] ESLint: `docker exec assixx-backend pnpm exec eslint backend/src/nest/auth/ backend/src/nest/common/` → 0 errors
- [ ] Type-check: `docker exec assixx-backend pnpm run type-check` → 0 errors

---

## Phase 3: Unit Tests (Session 3, Part A)

**Files:**

- `backend/src/nest/auth/auth.service.test.ts` (extend)
- `backend/src/nest/common/decorators/throttle.decorators.test.ts` (new — covers per-tier `getTracker` closures `authIpTracker` + `authEmailTracker`; the `CustomThrottlerGuard` class itself stays untested by Plan 1 because we do NOT touch it — v0.4.1 T1/T2)

### Mandatory scenarios (≥ 15)

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

**New — Per-tier tracker closures (`throttle.decorators.test.ts`, v0.4.1 T1/T2):**

Tests target the pure functions `authIpTracker(req, ctx)` and `authEmailTracker(req, ctx)` exported/exposed for test from `throttle.decorators.ts`. No `@nestjs/throttler` runtime involvement — trackers are pure over `(FastifyRequest, ExecutionContext)`.

- [ ] `authEmailTracker(req_with_email)` returns pure `email:<sha256(lowercased-email)>` — **no IP in the key** (v0.4.2 fix; R6 cross-IP defense)
- [ ] `authEmailTracker(req_with_email_from_IP_A)` and `authEmailTracker(req_with_same_email_from_IP_B)` produce an **identical** key — proves cross-IP coalescing
- [ ] `authEmailTracker(req_without_email)` (body missing `email` field — matches `/reset-password` contract) returns `ip:<ip>` fallback — documents the request-gate-only scope of the per-email tier (§0.2.5 #10, S3)
- [ ] `authEmailTracker(req_malformed_email)` (email is non-string / `null` / undefined) returns `ip:<ip>` fallback
- [ ] `authEmailTracker` normalizes email case + trim before hashing: `'Root@Firma.DE  '` and `'root@firma.de'` produce the same key
- [ ] `authIpTracker(req)` returns `ip:<ip>` (prefix is cosmetic — `@nestjs/throttler` segregates tiers by throttler name in Redis already; the prefix just makes the key grep-friendly)
- [ ] `authEmailTracker` reads `req.ip` only on the fallback path (no email in body); `authIpTracker` always reads `req.ip` — both require Fastify `trustProxy: true` (verified configured at `main.ts:211`, v0.4.0 S5)

### Phase 3 — Definition of Done

- [ ] All scenarios above covered
- [ ] `docker exec assixx-backend pnpm exec vitest run --project unit backend/src/nest/auth/ backend/src/nest/common/decorators/` → green
- [ ] DB + SMTP mocked; no real side effects
- [ ] Every branch in both methods has ≥ 1 test
- [ ] Per-tier tracker closures tested as pure functions (no Redis, no ThrottlerGuard, no Reflect-metadata plumbing in scope)

---

## Phase 4: API Integration Tests (Session 3, Part B)

**File:** `backend/test/auth-forgot-password.api.test.ts` (new)

### Scenarios (≥ 14)

- [ ] POST `/api/v2/auth/forgot-password` with root email → 200 `{ message }`; token row appears in DB
- [ ] Same with admin email → 200 `{ message, blocked: true, reason: 'ROLE_NOT_ALLOWED' }`; outbound mail captured; no token row
- [ ] Same with employee email → identical to admin
- [ ] Same with non-existent email → 200 `{ message }` only (no `blocked`); no side effects
- [ ] Same with inactive user (`is_active ∈ {0, 3, 4}` — one test per value) → 200 `{ message }` only; no side effects
- [ ] Root-path body is byte-identical to silent-drop path — assert keys are EXACTLY `['message']` and value is the canonical string (R1 enumeration-safe)
- [ ] Per-IP throttle: 6th request from same IP within 15 min → 6th → 429, regardless of email variation
- [ ] Per-email throttle: 2nd request for same email from **different IPs** within 5 min → 2nd → 429 (proves tracker is pure `email:<hash>` without an IP component — v0.4.2; this is the defining test for R6 cross-IP defense)
- [ ] Per-email throttle normalization: `'root@firma.de'` and `'ROOT@Firma.DE  '` share the same tracker key — 2nd call → 429
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
- [ ] Both throttle tiers asserted independently; Redis `FLUSHDB` between describe-blocks (see `docs/COMMON-COMMANDS.md §2`)

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

- [ ] **`TRUNCATE password_reset_tokens` at release** (§0.2.5 #9). Reason: clean-break response shape means any in-flight token generated against the old controller contract is now meaningless on redemption. Dropping the slate is safer than migrating partial-state rows.
      **v0.4.0 G7 note:** Must run as `assixx_user` (BYPASSRLS + DDL). `app_user` lacks TRUNCATE permission on `password_reset_tokens`. Per ADR-019 §7, this table is global (no `tenant_id`, no RLS policy), so no session-variable setup is required. Exact command:
  ```bash
  docker exec assixx-postgres psql -U assixx_user -d assixx -c "TRUNCATE TABLE password_reset_tokens RESTART IDENTITY;"
  ```
  Sequence `password_reset_tokens_id_seq` resets to 1 per v0.3.0 precedent. Production idempotency: running this twice in a row is a no-op (second TRUNCATE on an empty table costs microseconds).
- [ ] Redis throttle-cache fresh: `docker exec assixx-redis redis-cli -a "$REDIS_PASSWORD" --no-auth-warning FLUSHDB` (optional — only if keys from the old throttler tier need to be cleared; new tiers use different key prefixes so a co-existence is harmless)

### Integrations

- [ ] End-to-end smoke, 5 paths × (dev + production):
  - root email → reset link received + redemption works
  - admin email → UI blocked message + blocked mail received; any attempted token redemption → 403 `ROLE_NOT_ALLOWED`, token burned
  - employee email → same as admin
  - inactive user → no UI alert (generic success), no mail
  - unknown email → same as inactive
- [ ] Rate-limit smoke (per-IP): 6th request in 15 min from same IP → 429
- [ ] Rate-limit smoke (per-email): 2nd request for same email within 5 min across distinct IPs → 429

### Documentation

- [ ] **ADR-047** written: "Forgot-Password Role-Gate". Sections: threat model, two-gate design, clean-break response decision, tightened throttle (per-IP + per-email) rationale + OWASP/NIST alignment, accepted R1 leak, decoupling from ADR-048 (Domain Verification), **"Relationship to ADR-046 (Microsoft OAuth)"** (v0.4.0 G3) — explicit statement that OAuth is an orthogonal alternate-auth path, admin/employee regain access EITHER via root-contact OR via Azure AD, role-gate does not attempt to enforce at the OAuth layer; **"Scope of per-email throttle"** (v0.4.0 S3) — request-gate-only, redemption-gate protected by token-burn + TRUNCATE deploy-step instead
- [ ] `FEATURES.md` security section updated
- [ ] Docstring on `forgotPassword()` + `resetPassword()` + `ForgotPasswordThrottle()` + `CustomThrottlerGuard.getTracker()` references ADR-047
- [ ] `docs/how-to/HOW-TO-CURL.md` example for hitting `/forgot-password` updated if body shape differs from existing

### Phase 6 — Definition of Done

- [ ] All 5 end-to-end paths verified in dev + production
- [ ] Both rate-limit smokes pass
- [ ] `TRUNCATE password_reset_tokens` executed on the target environment (recorded in deploy log)
- [ ] ADR-047 status "Accepted"
- [ ] `FEATURES.md` updated
- [ ] Plan version → 2.0.0

---

## Session Tracking

| Session | Phase | Description                                                                                                    | Status | Date |
| ------- | ----- | -------------------------------------------------------------------------------------------------------------- | ------ | ---- |
| 1       | 0     | Current-state analysis: throttle anchor, DTO shapes, frontend anchor, CLS extension lines drafted              |        |      |
| 2       | 2     | Backend: both gates, email template, audit wiring, **CLS extension, new throttle decorator, tracker override** |        |      |
| 3       | 3 + 4 | Unit tests (≥ 15) + API integration tests (≥ 14, both throttle tiers covered)                                  |        |      |
| 4       | 5 + 6 | Frontend (merge-not-replace, toast pattern) + TRUNCATE deploy + ADR-047 + smoke (dev + production)             |        |      |

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

### Backend (new)

| File                                                  | Purpose                      |
| ----------------------------------------------------- | ---------------------------- |
| `backend/templates/email/password-reset-blocked.html` | Blocked-reset email template |
| `backend/test/auth-forgot-password.api.test.ts`       | API integration tests        |

### Backend (modified)

| File                                                             | Change                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/nest/auth/auth.service.ts`                          | Both gates (`forgotPassword`, `resetPassword`) + helper `burnToken()`                                                                                                                                                                           |
| `backend/src/nest/auth/auth.controller.ts`                       | Clean-break response mapping (§2.2); replace `@AuthThrottle()` with `@ForgotPasswordThrottle()` on both endpoints                                                                                                                               |
| `backend/src/nest/auth/dto/index.ts` + referenced files          | Update `ForgotPasswordResponse` + `ResetPasswordResponse` types (clean break)                                                                                                                                                                   |
| `backend/src/nest/auth/auth.service.test.ts`                     | +14 tests (redemption gate + per-email throttle)                                                                                                                                                                                                |
| `backend/src/nest/common/decorators/throttle.decorators.ts`      | NEW `ForgotPasswordThrottle()` decorator (5/15min IP + 1/5min hashed-email); carries per-tier `getTracker` closures `authIpTracker` + `authEmailTracker` inside `Throttle({...})` options (v0.4.1 T1/T2)                                        |
| `backend/src/nest/common/decorators/throttle.decorators.test.ts` | NEW — per-tier tracker unit tests (pure functions, no guard / no Redis)                                                                                                                                                                         |
| `backend/src/nest/throttler/throttler.module.ts`                 | Register `auth-ip` + `auth-email` named throttlers (defaults for `limit`/`ttl` only — `getTracker` lives at decorator layer so the rule is co-located with the feature)                                                                         |
| ~~`backend/src/nest/common/guards/throttler.guard.ts`~~          | ~~Extend `getTracker()` with `auth-email` tier~~ — **REMOVED v0.4.1 T1/T2**: base-class `getTracker(req, context)` cannot receive `throttlerName`; per-tier differentiation moved to decorator options. `CustomThrottlerGuard` stays untouched. |
| `MailerService` file (path confirmed in Phase 0)                 | New `sendPasswordResetBlocked()` method                                                                                                                                                                                                         |
| `backend/src/nest/app.module.ts` (lines 131–137 of current file) | **MANDATORY** extension: `cls.set('ip', req.ip)` + `cls.set('userAgent', req.headers['user-agent'] ?? 'unknown')`                                                                                                                               |

### Frontend (modified)

| File                                                  | Change                                                                     |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `frontend/src/routes/forgot-password/+page.server.ts` | Action parses JSON, returns `blocked` / `reason` via `ActionData`          |
| `frontend/src/routes/forgot-password/+page.svelte`    | Render alert depending on `form.blocked` / `form.success` / `form.missing` |

### Database

**None.** (v0.1.0's proposed migration was dropped — audit enum does not exist.)

---

## Spec Deviations (since v0.1.0)

| #   | v0.1.0 / v0.2.0 claim                                                                                                            | Reality                                                                                                                                                                                                                                                                                                                                                                                                    | Decision                                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `frontend/src/routes/(auth)/forgot-password/`                                                                                    | `frontend/src/routes/forgot-password/`                                                                                                                                                                                                                                                                                                                                                                     | Use real path (no `(auth)` group).                                                                                                                                                                                                                                                                             |
| D2  | Service `(email, requestMeta)`                                                                                                   | `(dto: ForgotPasswordDto)` in current code                                                                                                                                                                                                                                                                                                                                                                 | Keep `dto`; IP/UA via CLS.                                                                                                                                                                                                                                                                                     |
| D3  | `audit_trail_event_type` enum exists                                                                                             | Enum does not exist; `audit_trail` uses VARCHAR                                                                                                                                                                                                                                                                                                                                                            | Phase 1 migration dropped.                                                                                                                                                                                                                                                                                     |
| D4  | Rate limit 5/min                                                                                                                 | Actual: 10 req / 5 min per IP                                                                                                                                                                                                                                                                                                                                                                              | v0.2.0 corrected. v0.3.0 replaces with `ForgotPasswordThrottle()` (5/15min IP + 1/5min email).                                                                                                                                                                                                                 |
| D5  | `password-reset-blocked.de.html`                                                                                                 | Naming has no locale suffix; dir is `backend/templates/email/`                                                                                                                                                                                                                                                                                                                                             | File renamed + relocated.                                                                                                                                                                                                                                                                                      |
| D6  | `apiClient.post(...)` + `alertState` pattern                                                                                     | Real pattern: SvelteKit Form Actions + `toast toast--error`                                                                                                                                                                                                                                                                                                                                                | Phase 5 rewritten v0.2.0; v0.3.0 corrects to merge-not-replace + toast classes (not alert).                                                                                                                                                                                                                    |
| D7  | v0.2.0 "additive-compatible" response                                                                                            | User rule "no backward-compat in dev"                                                                                                                                                                                                                                                                                                                                                                      | **v0.3.0: clean break.** Old `{ message: string }`-only shape retired. DTO types rewritten. (R5 fully dropped from risk register — referenced only in v0.2.0 docs.)                                                                                                                                            |
| D8  | v0.1.0 `@AuthThrottle()` suffices                                                                                                | OWASP/NIST recommend per-email throttle for password reset                                                                                                                                                                                                                                                                                                                                                 | **v0.3.0:** per-IP (5/15min) + per-email (1/5min) via `CustomThrottlerGuard.getTracker()` override.                                                                                                                                                                                                            |
| D9  | v0.2.0 "CLS extension only if needed"                                                                                            | `app.module.ts:131-137` confirmed missing `ip`/`userAgent`                                                                                                                                                                                                                                                                                                                                                 | **v0.3.0: MANDATORY** CLS extension in Phase 2.                                                                                                                                                                                                                                                                |
| D10 | v0.3.0 `password_reset_tokens(id, user_id, token, expires_at, used)`                                                             | Real schema also has `created_at TIMESTAMPTZ DEFAULT now()` + `on_update_current_timestamp` trigger                                                                                                                                                                                                                                                                                                        | **v0.4.0 G2:** §0.1 schema-listing corrected. Plan does not use these columns; correction is doc hygiene.                                                                                                                                                                                                      |
| D11 | v0.3.0 R7 "OAuth has no code collision"                                                                                          | Correct for code-level, missed the architectural-bypass angle                                                                                                                                                                                                                                                                                                                                              | **v0.4.0 G3:** §0.2.5 #11 + ADR-047 "Relationship to ADR-046" acknowledge Microsoft OAuth as an orthogonal alternate-auth path for admin/employee.                                                                                                                                                             |
| D12 | v0.3.0 per-email throttle on `/reset-password`                                                                                   | Body has no `email` field → tracker falls back to IP-only                                                                                                                                                                                                                                                                                                                                                  | **v0.4.0 S3:** §0.2.5 #10 + §2.5 explicitly document request-gate-only scope; token-burn + TRUNCATE are compensating controls on redemption.                                                                                                                                                                   |
| D13 | v0.3.0 `cls.set('ip', req.ip)` assumed to return client IP                                                                       | Behind Nginx, Fastify returns Nginx IP unless `trustProxy: true` is set                                                                                                                                                                                                                                                                                                                                    | **v0.4.0 S5:** Phase 0 Step 0.1 adds `trustProxy` verification; Phase 2 configures it OR reads `X-Forwarded-For` manually in CLS setup. **v0.4.1 — verified: `main.ts:211` already has `trustProxy: true`**, Phase 2 DoD becomes a pure verification step.                                                     |
| D14 | v0.3.0/v0.4.0 planned `CustomThrottlerGuard.getTracker(req, throttlerName?)` override to differentiate `auth-email` vs `auth-ip` | `@nestjs/throttler@6.5.0` invokes `getTracker(req, context: ExecutionContext)` — 2nd arg is NEVER a throttler-name string. Override would compile but the `throttlerName === 'auth-email'` branch is unreachable dead code. Verified against compiled `throttler.guard.js canActivate()` and `throttler.decorator.js setThrottlerMetadata()`.                                                              | **v0.4.1 T1/T2:** §2.5 rewritten. Per-tier `getTracker` closures live in `Throttle({ 'auth-email': { getTracker: authEmailTracker } })` decorator metadata, which the base-guard resolution prefers over the class default. `CustomThrottlerGuard` stays untouched.                                            |
| D15 | v0.4.1 `authEmailTracker` returned `ip:${ip}:email:${digest}` (IP prefix included)                                               | R6 + §0.2.5 #10 + Phase 4 test all require per-email throttle to hold ACROSS different IPs. With IP in the key, each rotated IP gets a fresh counter → cross-IP flood trivially bypasses the cap → Phase 4 "2nd request for same email from different IPs within 5 min → 429" fails. Internal contradiction between code and stated mitigation.                                                            | **v0.4.2:** `authEmailTracker` returns pure `email:${digest}` when email is present. IP-only fallback kept for `/reset-password` (no email in body). §0.2.5 #10 description aligned. The `auth-ip` tier continues to enforce per-IP limits independently — the two tiers are now properly orthogonal controls. |
| D16 | v0.4.1 §0.1 claim "`TRUNCATE tenants CASCADE` will fail unless tokens are wiped first; deploy runs BEFORE any tokens exist"      | PG TRUNCATE CASCADE propagates explicitly to ALL FK-referencing tables regardless of FK action (`ON DELETE RESTRICT` only gates DELETE). No preparation needed — the CASCADE transitively wipes `users` → `password_reset_tokens`. "Deploy before tokens exist" was wrong for dev too (live DB had 122 reset-token rows at 2026-04-17).                                                                    | **v0.4.2:** §0.1 prose corrected — TRUNCATE CASCADE handles reset-tokens as a side-effect; operational outcome unchanged, doc accuracy restored.                                                                                                                                                               |
| D17 | v0.4.1 didn't address OAuth-only roots hitting `/auth/forgot-password`                                                           | ADR-046 may leave `users.password` as a placeholder (e.g. `'OAUTH'`) for accounts that never set a local credential. The plan's happy path treats them as regular roots and issues a reset link → redemption creates a real bcrypt hash. Could be either a legitimate local-password fallback (user lost Microsoft access) or a subtle credential-duplication quirk. Prior plan didn't name the behaviour. | **v0.4.2:** Known Limitation #10 added. V1 ships without special-casing; Phase 0 to confirm placeholder convention + whether ADR-046 prescribes a different self-service path. V2 could branch the template wording or short-circuit for OAuth-only users.                                                     |

---

## Known Limitations (V1 — deliberately excluded)

1. **Tenant domain verification** — orthogonal Break-Glass structural solution. Tracked in `FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md` (ADR-048). This plan ships AFTER Plan 2.
2. **MFA / TOTP on Root** — second-factor hardening of both login and reset. Tracked separately.
3. **Role-independent generic response** — explicitly rejected: product owner wants immediate UI block message at the request gate. R1 is an accepted trade-off (tightened throttle is the primary defense against enumeration).
4. **I18n of the email template** — German-only in V1, matching house style.
5. **Proactive notification to real root users** ("admin X tried to self-reset") — could be added later; not required for V1.
6. **Retroactive revocation of pre-plan reset tokens** — superseded: deploy-step `TRUNCATE password_reset_tokens` (Phase 6) blanket-invalidates all pre-release tokens. No redemption-gate race left.
7. **Per-user-agent throttle** — only IP + email are in the tracker. A botnet rotating IPs + emails could still saturate SMTP, but that's a broader abuse pattern handled at upstream CDN/WAF level.

8. **OAuth-only admin/employee gets a suboptimal blocked-email (v0.4.0 G3).** The template in §2.3 reads "Bitte wende Dich an einen Root-Benutzer in Deinem Unternehmen." — correct for password-only accounts, misleading for OAuth-only accounts where the user simply needs to sign in via Microsoft. V1 ships the generic template. V2 could branch template wording based on a `users.auth_method` or `password = 'OAUTH'` marker. Acceptable: the blocked-email is a rare, out-of-flow communication; an OAuth-only user clicking "Forgot password" is already confused, and even the suboptimal copy nudges them toward root-contact rather than silently ignoring them.

9. **Per-email throttle scope: request-gate only (v0.4.0 S3).** `/reset-password` has no email in its body; the tracker falls back to IP-only on that endpoint. Token-burn (§2.6) + Phase-6 TRUNCATE are the compensating controls. Not a real gap under the deploy-discipline, but named explicitly so future reviewers don't assume the per-email limit applies there.

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

| Metric                   | Planned     | Actual |
| ------------------------ | ----------- | ------ |
| Sessions                 | 4 (+0.3)    |        |
| Migration files          | 0           |        |
| New backend files        | 3           |        |
| New frontend files       | 0           |        |
| Changed files            | 8–9         |        |
| Unit tests               | 15          |        |
| API tests                | 14          |        |
| ESLint errors at release | 0           |        |
| Spec deviations          | 17 (listed) |        |

---

**This document is the execution plan. Every session starts here, takes the next unchecked item, and marks it done. No coding starts before Phase 0 is green.**
