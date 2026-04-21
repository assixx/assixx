# FEAT: Forgot-Password Role-Gate — Execution Masterplan

> **Plan type:** FEATURE
> **Created:** 2026-04-16
> **Version:** 2.0.0 (Session 3 complete — Phase 6 docs shipped. ADR-051 written + accepted at `docs/infrastructure/adr/ADR-051-forgot-password-role-gate.md` covering threat model, two-gate design, additive response, retained `@AuthThrottle()`, accepted R1 enumeration residual, v2 Per-Email-Throttle backlog with NestJS-Throttler per-tier `getTracker` reference, §Relationship to ADR-046, §Sequencing after ADR-049, Root-initiated reset architecture, verification log, and §Historical Note documenting the ADR-050 → ADR-051 renumber drift. Plan-text renumbering applied: 26 ADR-050 → ADR-051 occurrences rewritten via replace_all, with the Phase 1 embedded migration code-block preserved as-is (literal bytes of the shipped migration file at `database/migrations/20260420220236221_add-password-reset-initiated-by.ts` + live DB `COMMENT ON COLUMN` still reference ADR-050 — historical artefact, not rewritten). Cross-plan fixes: 4 stale ADR-050 references in `FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md` updated to "ADR-051 (renumbered from ADR-050 on 2026-04-21)". `FEATURES.md` security section gained a "Forgot-Password Role-Gate + Root-Initiated Reset" bullet referencing ADR-051 with all key design pillars (two gates, Root-initiated delegation, Root-on-Root rejection, per-pair DB rate-limit). Remaining Session 3 items deferred: (a) docstring `@see ADR-051` on `forgotPassword` / `resetPassword` / `sendAdminInitiatedResetLink` — source files live on `feat/forgot-password-role-gate`, require branch switch; (b) End-to-end smoke in dev + production profile — production container spin-up + live SMTP sends for 6 flows, requires user sign-off before execution. Both tracked for follow-up session.)
> **Status:** PHASE 6 DOCS + DOCSTRINGS DONE — ADR-051 accepted, FEATURES.md updated, cross-plan refs fixed, all source docstrings + inline ADR-references in backend (`auth/`, `users/`, `common/audit/`, `common/services/mailer.service.ts`, `app.module.ts`, `backend/test/auth-forgot-password.api.test.ts`) + frontend (`/forgot-password`, `/manage-admins`, `/manage-employees`) renumbered ADR-050 → ADR-051. ESLint + `tsc -p backend` + `tsc -p backend/test` all 0 errors post-renumber. Only the Phase 1 embedded migration-code text + the shipped migration file + live DB `COMMENT ON COLUMN` preserve "ADR-050" (historical, immutable per Migration Discipline). **Deferred (1 item):** E2E smoke dev + production profile (6 flows × 2 profiles) — requires user sign-off for `docker-compose --profile production up -d` + live SMTP sends.
> **Branch:** `feat/forgot-password-role-gate`
> **Author:** Simon Öztürk (with Staff-Engineer assist)
> **Estimated sessions:** 4 (v0.5.0 Scope-Extension — up from 3)
> **Actual sessions:** 4 / 4 (Phase 0 A-scope 2026-04-19; Session 1b 2026-04-20; Session 1c 2026-04-21; Session 2 2026-04-21)
> **Sequencing:** Ships AFTER `FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md` (Plan 2, ADR-049). Plan 2's Phase 1 TRUNCATE + fresh seed is the clean substrate; Plan 1 runs against pre-verified test tenants so §2.6's redemption gate is tested realistically. See §0.1 prerequisites.
> **ADR:** ADR-051 (Forgot-Password Role-Gate).

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

**Plus: Root-Initiated Reset (v0.5.0 Scope-Extension)**

Root can trigger a password-reset-link for an **admin** or **employee** user in their tenant via a button inside the Manage-Admin / Manage-Employee edit modal. The target user receives an email with a link to `/reset-password`, clicks it, and sets their own new password — Root never sees the new credential (separation of duties). This complements the self-service block: admin/employee cannot reset themselves, but Root can delegate the reset flow to them on request.

- **Initiator:** Strict Root-only (not admin-with-hasFullAccess — credentials stay Root-territory).
- **Target:** admin or employee, same tenant, `is_active = 1`. **Root-on-Root reset is rejected** (a second Root uses `/forgot-password` self-service; this prevents Root-takeover chains).
- **Rate-limit:** 1 request / 15 min per (initiator Root, target user) — enforced via DB-check (`SELECT MAX(created_at) FROM password_reset_tokens WHERE user_id = $target AND initiated_by_user_id = $root`), not via Throttler. Prevents notification spam without Redis infrastructure.
- **Token lifetime:** 60 min (identical to self-service — KISS).
- **Bypasses §2.6 Redemption-Gate:** admin-initiated tokens carry `initiated_by_user_id IS NOT NULL` in the DB; the redemption-gate switches from role-check to origin-check. See §2.8.
- **Initiator lifecycle:** at redemption time, if the initiator Root is no longer active (`is_active != 1` OR `role != 'root'` OR deleted), the token is burned and the redemption rejected (401). Prevents ex-Root from issuing tokens that persist after their removal.
- **UI:** button "Passwort-Reset-Link senden" in the Account-Section of the Edit-Modal in `/manage-admins` and `/manage-employees`. Confirm-dialog before call. Success-toast "E-Mail gesendet an {email}".

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

| Version | Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.0.0   | 2026-04-21 | **Session 3 complete — Phase 6 docs shipped.** ADR-051 written + accepted at `docs/infrastructure/adr/ADR-051-forgot-password-role-gate.md`. Sections: threat model table (6 actor/capability rows), two-gate design (request + redemption), additive response (NOT clean-break), retained `@AuthThrottle()`, accepted R1 enumeration residual, v2 Per-Email-Throttle backlog with NestJS Throttler per-tier `getTracker` reference preserved, §Relationship to ADR-046 (OAuth orthogonality grep-verified 0 matches), §Sequencing after ADR-049, Root-initiated reset architecture (narrower than ADR-045 Layer-1, Root-on-Root rejection, per-pair DB rate-limit), verification log (97/97 unit + 15/15 new API + 16/16 regression + migration 140), §Historical Note documenting the ADR-050 → ADR-051 renumber drift (ADR-050 slot was taken by unrelated `ADR-050-tenant-subdomain-routing.md` between plan v0.5.0 and Phase 6). **Renumbering:** 26 ADR-050 → ADR-051 occurrences rewritten in this plan via `replace_all`, with the Phase 1 embedded migration code-block (lines 370, 386) preserved as `ADR-050` because it mirrors the literal bytes of the shipped migration file + live DB `COMMENT ON COLUMN` (applied migrations = immutable history). Explanatory 7-line JSDoc note added above the restored line. Cross-plan: 4 stale `ADR-050` refs in `FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md` updated to "ADR-051 (renumbered from ADR-050 on 2026-04-21)" preserving the historical marker for grep. `FEATURES.md` security section gained "Forgot-Password Role-Gate + Root-Initiated Reset" bullet naming ADR-051, two gates, delegation, Root-on-Root rejection, per-pair DB rate-limit, dark-mode MSO-compatible templates. **Deferred from Session 3 (tracked, non-blocking):** (a) Docstring `@see ADR-051` on `forgotPassword` / `resetPassword` / `sendAdminInitiatedResetLink` — source files live on branch `feat/forgot-password-role-gate`, current branch is `test/ui-ux`; requires branch switch which the user handles. (b) End-to-end smoke in dev + production profile (6 flows × 2 profiles) — production container spin-up + live SMTP sends; requires user sign-off before execution. **Status:** PHASE 6 DOCS DONE. Plan treated as shipped from a documentation perspective; the two deferred items are process-follow-ups, not scope regressions. |
| 0.1.0   | 2026-04-16 | Initial draft — phases outlined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 0.2.0   | 2026-04-16 | Ground-truth review applied (11 corrections above); §2.6 redemption gate added; Phase 1 dropped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 0.3.0   | 2026-04-16 | Validation-review integrated: (1) clean-break response per user rule "No backward-compat in dev" — additive framing removed, §2.2 rewritten, R5 dropped. (2) Tightened throttle: new `ForgotPasswordThrottle()` = 5 req/15 min per IP **AND** 1 req/5 min per hashed email via `CustomThrottlerGuard.getTracker()` extension. (3) CLS `ip`/`userAgent` extension MANDATORY in `ClsModule.forRoot` (verified: current setup only populates requestId/Path/Method). (4) Frontend §5.2 rewritten: merge-into-existing-markup (keep `email=$state`, `loading=$state`, `isEmailValid=$derived`, `toast toast--error` classes — NOT `alert alert--error`). (5) Deploy step: `TRUNCATE password_reset_tokens` at release (breaking response invalidates all pre-existing tokens anyway). (6) ADR number fixed: **ADR-051**. (7) Sequencing: ships AFTER Plan 2 (ADR-049). (8) DTO types `ForgotPasswordResponse` + `ResetPasswordResponse` added to change-list.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 1.3.0   | 2026-04-21 | **Session 2 complete — tests + frontend landed.** Phase 3: +22 unit tests in `auth.service.test.ts` (6 forgotPassword block-path + CLS + OAuth-only; 2 resetPassword self-service burn; 7 `sendAdminInitiatedResetLink` incl. `.each` 3 inactive states + 429 rate-limit windows; 5 §2.8 origin-check scenarios) → 97/97 green (was 75). Phase 4: new `backend/test/auth-forgot-password.api.test.ts` with 15 integration tests covering §2.1/§2.6/§2.7/§2.8 against live backend — 15/15 green, existing `auth-password-reset.api.test.ts` regressed clean 16/16. Fixture discovery: `admin@apitest.de` is actually `role='root'` (not admin — misleading email); `perm-test-admin@apitest.de` is the admin; `employee@apitest.de` is the employee. Cleanup via `DELETE` not `UPDATE used=true` because per-pair rate-limit reads `MAX(created_at)` ignoring `used`. Phase 5: `/forgot-password` merge-not-replace (server-action parses backend JSON + propagates `blocked/reason` via ActionData, page adds `{#if form?.blocked}` BEFORE `{#if form?.success}` with German "Passwort-Reset nicht erlaubt" copy, existing toast-error + state + spinner untouched); §5.3 `/manage-admins` Edit-Modal Root-only button with confirm-dialog + loading-state + 3-code error-mapping (INVALID_TARGET_ROLE/INACTIVE_TARGET via err.code, RATE_LIMIT via err.status===429 because api-client pre-empts 429 before body-parse); §5.4 `/manage-employees` same pattern BUT route is `(shared)` not `(root)` as plan-text assumed — added explicit `data.user?.role === 'root'` invocation gate to hide button from admin viewers (backend `@Roles('root')` remains the authoritative check). **Service-fix triggered by Phase 4**: §2.6 `ForbiddenException(string)` → `ForbiddenException({message, code: 'ROLE_NOT_ALLOWED'})` because the global filter normalizes bare-string exceptions to `error.code: 'FORBIDDEN'`, dropping the §2.2-contracted marker. 3-line fix in `auth.service.ts:634-656`, matches the existing §2.7 `BadRequestException({message, code})` pattern. Backend `--force-recreate` (WSL2 bind-mount staleness), 6789/6789 full unit-suite green post-fix. **Verification**: full `pnpm run type-check` 0 errors, ESLint + svelte-check on all 3 modified frontend routes 0 errors/warnings, 31/31 password-reset API tests green. **Deviations**: #1 `/manage-employees` route location + extra Root-viewer frontend gate, #2 §2.6 ForbiddenException object-form, #3 new file `auth-forgot-password.api.test.ts` complements (not replaces) the existing `auth-password-reset.api.test.ts`. All three documented in the Session 2 log + Spec Deviations D19-D21 (pending next edit). **Sessions**: 3/4 → 4/4. Ready for Session 3 (ADR-051 writeup + E2E smoke). |
| 0.5.2   | 2026-04-21 | **Session 1c complete — Root-Initiated Reset backend landed.** Phase 0 B-scope anchored (UsersController at :126, UserRole = string-alias from @assixx/shared, `@Roles('root')` syntax, AuthModule already exports AuthService, BaseAuthUser has optional firstName/lastName, findUserById is private on AuthService + accepts optional tenantId for tenant-scoped lookups). **Phase 1 migration** applied with full discipline: generator → backup (2.9M) → fill up()/down() → dry-run → apply → verify (`\d password_reset_tokens` shows `initiated_by_user_id integer` + FK `ON DELETE SET NULL`, pgmigrations row id=140) → backend restart healthy → customer fresh-install synced. **§2.7** new endpoint `POST /api/v2/users/:id/send-password-reset-link` (`@Roles('root')`, `@HttpCode(OK)`, global JwtAuthGuard + RolesGuard) in UsersController — delegates to `AuthService.sendAdminInitiatedResetLink(targetUserId, initiator)`. Service logic: tenant-scoped target lookup (`findUserById(id, initiator.tenantId)` → cross-tenant = 404), target-rule guard (`assertAdminInitiatedTargetAllowed` — Root-on-Root 400 `INVALID_TARGET_ROLE`, non-admin/employee 400, inactive 400 `INACTIVE_TARGET`), per-pair DB rate-limit (`assertAdminInitiatedRateLimit` — 1/15min via `MAX(created_at) WHERE user_id=$1 AND initiated_by_user_id=$2`, 429 `RATE_LIMIT`), token issuance with `initiated_by_user_id = initiator.id`, email dispatch, warn-log. **§2.8** `resetPassword()` SELECT extended to carry `initiated_by_user_id`, origin-check extracted into `enforceRedemptionOriginGate(tokenRow, targetUser)` helper: NOT NULL → initiator-lifecycle check (still Root + active + same tenant → fall-through to happy-path, skipping §2.6 role-gate; fail → burn + 401 generic, no initiator-detail leak); NULL → original §2.6 self-service role-gate (non-root target → burn + 403 `ROLE_NOT_ALLOWED`). **§2.9** `MailerService.sendPasswordResetAdminInitiated(recipient, initiatorName, rawToken, expiresAt)` + new template `password-reset-admin-initiated.html` (mirrors `password-reset.html` style, names initiator explicitly). **Supporting changes:** UsersModule imports AuthModule (AuthModule exports AuthService; no circular dep, auth/\* never references Users), DTO `SendPasswordResetLinkResponse` in new file + exported from auth/dto/index.ts, `BadRequestException`+`HttpException`+`HttpStatus` added to auth.service imports. **Test-regression fix:** resetPassword mocks now include `initiated_by_user_id: null` in 4 token-row mocks (§2.8 SELECT shape change); 1 partial match in Edit required a broader replace_all to catch all occurrences. **Verification:** ESLint auth/ + users.controller + users.module + mailer.service = 0 errors (after extracting 3 helpers to keep both `resetPassword` and `sendAdminInitiatedResetLink` under the 60-line cap). `tsc -p backend` + `-p backend/test` = 0 errors. `vitest --project unit auth.service.test.ts` = 75/75, full `--project unit` = 6767/6767 across 260 files. Backend restart healthy (`curl /health` → `status: ok`). |
| 0.5.1   | 2026-04-20 | **Session 1b complete — Self-Service Role-Gate backend landed.** 8 edits per Phase 0 Deliverable Summary: (1) `app.module.ts` ClsModule.forRoot `setup:` extended with `cls.set('ip', req.ip)` + `cls.set('userAgent', req.headers['user-agent'] ?? 'unknown')`. (2) `audit.helpers.ts` `isAuthEndpoint()` + `/auth/forgot-password` + `/auth/reset-password` (Option A+ — auto-interceptor now picks up both endpoints). (3) `forgot-password.dto.ts` `ForgotPasswordResponse` += `readonly blocked?: true` + `readonly reason?: 'ROLE_NOT_ALLOWED'` (additive, §0.2.5 #6). (4) `mailer.service.ts` new `PasswordResetBlockedMeta` interface + `sendPasswordResetBlocked()` method + `buildPasswordResetBlockedText()` helper. (5) `backend/templates/email/password-reset-blocked.html` NEW (mirrors `password-reset.html` style; replaces CTA with info-block rendering `{{userName}}`, `{{ip}}`, `{{timestamp}}`). (6) `auth.service.ts` — `ClsService` imported + injected, `ForgotPasswordResult` interface exported, `forgotPassword()` rewritten: silent-drop / role-block / root-happy-path returning `ForgotPasswordResult`. (7) `auth.service.ts` — `resetPassword()` redemption gate: re-loads target via `findUserById`, burns token + 401 on deleted/inactive target, burns token + 403 `ROLE_NOT_ALLOWED` on non-root target; private `burnToken(tokenRowId)` helper added. (8) `auth.controller.ts` — additive mapping: `{ message }` on root/silent-drop, `{ message, blocked: true, reason: 'ROLE_NOT_ALLOWED' }` on block. **Verification:** ESLint `backend/src/nest/auth/ backend/src/nest/common/audit/ mailer.service.ts app.module.ts` = 0 errors (after 3 fixes: `cls.get<string \| undefined>` for honest `??`, optional-chain collapse in redemption-gate lifecycle check). `tsc --noEmit -p backend` + `-p shared` + `-p backend/test` = 0 errors. Backend restart healthy (`/health` → `status: ok`). **Unchanged vs plan:** `main.ts` trustProxy already true at :284; `CustomThrottlerGuard` untouched; `ActivityAction` union untouched; no TRUNCATE. **Session-Tracking row 1b:** ⏳ PENDING → ✅ DONE 2026-04-20.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 0.5.0   | 2026-04-20 | **Scope-Extension — Root-Initiated Password-Reset-Link feature added.** User-directed scope-add after v0.4.4 Phase 0 closeout. New capability: Root can trigger a password-reset-link for an admin or employee via a button in the Manage-Admin / Manage-Employee edit modal; target user clicks link and sets their own password on the existing `/reset-password` page. Key design anchors (see §0.2.5 #12–#13 + §2.7–§2.9 + §5.3–§5.4): (1) **Target rule**: admin/employee only — Root-on-Root rejected (a second Root uses `/forgot-password` self-service; prevents Root-takeover chains). (2) **Initiator rule**: strict Root-only — admin-with-hasFullAccess explicitly NOT sufficient (credentials stay Root-territory, narrower than ADR-045 Layer-1). (3) **Token-origin column** `password_reset_tokens.initiated_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL` — reinstates Phase 1 migration (v0.4.4 had Phase 1 omitted). Null = self-service, not-null = Root-initiated. (4) **§2.6 Redemption-Gate extended**: branches on `initiated_by_user_id` before role-check. Self-service tokens keep the strict role-gate (Root-only redemption). Admin-initiated tokens verify the initiator is still `role='root'` + `is_active=1` + same tenant at redemption time, then allow redemption regardless of target role. Token is burned on either the role-gate (self-service path) or the initiator-lifecycle failure (admin-initiated path). (5) **Rate-limit**: 1 request / 15 min per (Root-ID, target-user-ID) — enforced via DB-lookup of `MAX(created_at)` in the token table, not via Throttler (no Redis-infra change, no new decorator). Returns 429 with German message. (6) **Token lifetime**: 60 min (identical to self-service — KISS). (7) **UI**: new button "Passwort-Reset-Link senden" in the Account-Section of the Edit-Modal in `/manage-admins` + `/manage-employees`, Confirm-Dialog before call, success-toast after. (8) **New email template** `password-reset-admin-initiated.html` (German, mirror of `password-reset.html` style) — text explicitly names the initiator Root ("{initiatorName} hat für Dich einen Passwort-Reset-Link angefordert"). (9) **ADR-Korrekturen**: `ADR-047` (Forgot-Password Role-Gate) globally renamed to **ADR-051** because ADR-047 slot was taken by `ADR-047-claude-code-hook-strategy.md`. `ADR-048` (Domain-Verification cross-refs) globally renamed to **ADR-049** because ADR-048 slot was taken by `ADR-048-distributed-tracing-tempo-otel.md`. Plan 2 Domain-Verification plan mirror-corrected. (10) **Sessions**: 3 → 4 (new Session 1c for Root-Initiated backend; Session 2 absorbs added tests + new FE buttons). Test counts: 10 → ~17 unit, 8 → ~13 API. **No existing v0.4.4 scope removed** — additive only; §2.1 self-service gate + §2.6 self-service redemption-gate stay as-is, extended by the origin-check in §2.8.                                                                                                                                                                                           |
| 0.4.4   | 2026-04-19 | **Phase 0 complete — Session 1 Part A.** All §0.1–§0.5 anchors confirmed via Read (Docker not needed). Key findings: (1) **Audit-mechanism Option A+ chosen** (original Option A was unviable — `audit-request-filter.service.ts:59-62` skips anonymous non-auth requests, so `/auth/forgot-password` + `/auth/reset-password` produce 0 `audit_trail` rows today). Fix: 2-line extension of `isAuthEndpoint()` in `audit.helpers.ts:240-244` to include both paths, then auto-interceptor captures HTTP metadata; block-semantic context via `logger.warn()` → Loki. No `ActivityAction`-union change, no manual `ActivityLoggerService.log()` call. (2) **`trustProxy: true` already at `main.ts:284`** — D13/v0.4.1 holds, Phase 2 work here reduced to a curl-header verification in Phase 4. (3) **OAuth orthogonality confirmed** (`grep -rE 'forgotPassword                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | password_reset | resetPassword' backend/src/nest/auth/oauth/`→ 0 matches). (4) **CLS`ip`/`userAgent`keys are greenfield** — 0 repo-wide consumers of`cls.get('ip')`/`cls.get('userAgent')`, safe to add. Exact insertion point: after `app.module.ts:138`, inside ClsModule.forRoot `setup:`callback. (5) **DTO anchors locked:**`ForgotPasswordResponse`(line 18-20 in`forgot-password.dto.ts`) gets 2 optional fields in Phase 2; `ResetPasswordResponse`unchanged (403-body is NestJS exception shape). (6) **Frontend anchors locked:**`+page.svelte:14,15,17`state runes + lines 72-85`toast toast--error`; `+page.server.ts`action at lines 17-47, merge target for`blocked`-propagation before existing `{ success: true, email }` return at line 41. 8-row concrete edit list locked in Phase 0 Deliverable Summary. Status: DRAFT → PHASE 0 DONE. Sessions: 0/3 → 1/3. |
| 0.4.3   | 2026-04-17 | **Staff-Engineer Scope-Re-Cut — three scope items dropped following user-directed KISS-pass:** (1) **Per-Email-Throttle (§2.5) DELETED.** Feature was Scope-Creep: not requested by core goal ("nur Root darf self-reset"), addresses an unreported threat (cross-IP email-flood), SMTP providers already bound outbound at infra layer, v0.4.1 had a fundamental API bug (phantom `throttlerName`), v0.4.2 had a logic bug in `authEmailTracker` (IP prefix defeated R6). The feature was sprouting bugs faster than it shipped value. Existing `@AuthThrottle()` (10 req / 5 min per IP) is retained on both `/forgot-password` and `/reset-password`. If distributed-IP email-flood becomes a real operational concern → v2-plan, single-day sprint. (2) **Clean-Break Response (§2.2) REVERTED to additive.** The v0.3.0 "clean-break" pivot misread user rule "No backward-compat in dev" — that rule prohibits keeping legacy code paths alive, not adding optional response fields. Additive shape `{ message: string, blocked?: true, reason?: 'ROLE_NOT_ALLOWED' }` is a pure API superset: old clients (which read only `message`) degrade gracefully to a generic-success display on blocked paths; new frontend reads `blocked` and renders the block-UI. No DTO migration, no test-bloat on byte-identity, no Frontend-Sync-Druck. (3) **TRUNCATE `password_reset_tokens` deploy-step (§0.2.5 #9 + Phase 6) REMOVED.** The TRUNCATE rationale was entirely "clean-break response shape means pre-existing tokens incompatible" — with (2) additive, the rationale collapses. Tokens stay valid, the redemption-gate (§2.6) burns admin/employee tokens on first redemption attempt (exactly what R9 demands), root tokens continue to redeem normally (no customer-friction from a wipe). Defense-in-depth holds without the deploy DDL. (4) **Unit test count: 15 → 10. API test count: 14 → 8.** The removed tests were all per-tier-tracker + byte-identity + per-email-throttle scenarios, which no longer exist. Core role-matrix coverage (root/admin/employee/null × active/inactive/archived/deleted × request-gate/redemption-gate) stays at 10 unit + 8 API — still belt-and-suspenders for an auth-critical path. (5) Risk register R6 / R9 / R10 updated; §0.2.5 #6 / #9 / #10 rewritten or marked superseded; Ecosystem Integration Points §0.3 throttler + token-table rows simplified; Phase 0 / 2 / 3 / 4 DoD cleaned; Quick Reference file list shrunk. (6) Spec Deviations D15–D17 (from parallel v0.4.2 review) preserved; D18 added to document this Scope-Re-Cut.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 0.4.2   | 2026-04-17 | **Fourth-pass validation — two ground-truth bugs caught by independent review of v0.4.1 text vs stated intent:** (1) **MAJOR — `authEmailTracker` returned `ip:${ip}:email:${digest}`** which scoped the tier to per-(IP,email), defeating R6 ("stops single-target flood even across IPs"), contradicting §0.2.5 #10's IP-agnostic intent, and making the Phase 4 test "2nd request for same email from different IPs within 5 min → 429" unachievable. Fixed: tracker now returns pure `email:${digest}` when email is present; IP-only fallback (`ip:${req.ip}`) retained for `/reset-password` where body has no email. §0.2.5 #10 description aligned. The separate `auth-ip` tier continues to handle IP-bound throttling; the two tiers are now properly orthogonal. (2) **MINOR — §0.1 claim "Plan 2's TRUNCATE tenants CASCADE will fail on this FK unless tokens are wiped first"** was WRONG — PG's TRUNCATE CASCADE propagates to ALL FK-referencing tables regardless of `ON DELETE` action (`ON DELETE RESTRICT` only affects DELETE). The follow-up claim "Plan 2's deploy runs BEFORE any tokens exist" was also wrong for dev (live DB had 122 reset-token rows as of 2026-04-17 verification). Corrected: Plan 2's clean-slate wipes reset tokens as a side-effect of TRUNCATE CASCADE; works regardless of FK action. (3) **MINOR — Known Limitation #10 added (OAuth-only root can gain local password via reset flow).** ADR-046 OAuth-only roots are not short-circuited; the happy path still issues a reset link → redemption sets a bcrypt password. V1 accepts (arguably a legitimate credential fallback); Phase 0 to confirm placeholder convention and whether ADR-046 prescribes a different path. Spec Deviations D15–D17 added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 0.4.1   | 2026-04-17 | **Third-pass validation — NestJS Throttler API verified against compiled source at `backend/node_modules/@nestjs/throttler@6.5.0`:** (1) **T1 — `CustomThrottlerGuard.getTracker()` cannot receive `throttlerName`:** compiled `throttler.guard.js` calls `getTracker(req, context)` where the 2nd arg is `ExecutionContext`, NOT `throttlerName`. The v0.3.0/v0.4.0 proposal to override with `(req, throttlerName?: string)` would compile but the `throttlerName` branch would never fire — per-email throttle silently dead. (2) **T2 — Correct API is per-tier `getTracker` in decorator options:** `Throttle({ 'auth-email': { limit, ttl, getTracker: fn } })` stores `THROTTLER_TRACKER + name` metadata (verified in compiled `throttler.decorator.js` line `setThrottlerMetadata`), guard lookup order is `route/class metadata → named-throttler option → common → class default`. (3) **§2.5 rewritten** around decorator-side per-tier closures; `CustomThrottlerGuard` stays untouched. (4) **Phase 2 DoD + Phase 3 unit tests + Quick Reference table updated** to match. (5) D14 added to Spec Deviations. (6) **P1 — `auth.service.ts:631` `private createUser()`:** independent grep shows `INSERT INTO users` in a third auth-internal helper (called from `auth.service.ts:269` — ADR-005-style authenticated registration path). NOT in Plan 1's scope (Plan 1 does not touch user creation), but noted here for cross-plan awareness with Plan 2 (ADR-049 §2.11 allowlist may need a third entry).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 0.4.0   | 2026-04-17 | **Second-pass validation integrated** (independent ground-truth on post-OAuth `main`): (1) **G2 — `password_reset_tokens` schema:** §0.1 + anchor list corrected — table has `created_at TIMESTAMPTZ DEFAULT now()` + `on_update_current_timestamp` trigger; prior doc listed only 5 columns. (2) **G3 — OAuth bypass in threat model:** new §0.2.5 #11 acknowledges that Microsoft OAuth (ADR-046, merged `5cd293ae8`) is a structural alternate-auth path for admin/employee — they can sign in via Azure AD without ever hitting forgot-password. Plan 1 remains correct (role-gate on password reset) but ADR-051 writeup must acknowledge OAuth-only accounts exist; blocked-email template gets an OAuth-aware variant (deferred to V2, Known Limitation #8). (3) **S3 — per-email throttle on `/reset-password`:** §2.5 + new note — `/reset-password` body has no `email` field, so the per-email tracker falls back to IP-only on that endpoint. Per-IP 5/15min remains; per-email 1/5min is a REQUEST-GATE-ONLY control. (4) **S5 — Fastify `trustProxy`:** Phase 0 Step 0.1 + §0.3 — must verify `main.ts` configures `trustProxy: true` before §2.1 relies on `req.ip` for logging; otherwise blocked-email logs show Nginx IP (`172.x`). (5) **G7 — TRUNCATE deploy-step:** Phase 6 clarified — runs as `assixx_user` (not `app_user`, lacks DDL). (6) **W1 — R5 cleanup:** Spec-Deviation D7 tidied, no more stale R5 reference. (7) **G11 — existing-token burn on request-gate:** §2.1 clarified — blocked path does NOT invalidate admin/employee's pre-existing unused tokens; the redemption gate in §2.6 catches any attempted redemption AND the Phase 6 TRUNCATE wipes the slate. Defense-in-depth holds.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 1.0.0   | YYYY-MM-DD | Phase 2 complete — backend done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 1.1.0   | YYYY-MM-DD | Phase 3 complete — unit tests green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 1.2.0   | YYYY-MM-DD | Phase 4 complete — API integration tests green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 1.3.0   | YYYY-MM-DD | Phase 5 complete — frontend done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2.0.0   | YYYY-MM-DD | Phase 6 complete — ADR-051 written, shipped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

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
| R6      | Email flood via repeated abuse                                        | Low        | Low         | **v0.4.3:** per-email throttle deferred to v2 (§0.2.5 #10). v1 coverage: (a) existing `@AuthThrottle()` (10/5min per IP) bounds single-IP flood; (b) outbound SMTP provider (SendGrid/Mailgun) applies sender-level rate-limits — infra-layer cap on outbound message volume; (c) the blocked-email itself notifies the admin that someone is attempting to reset their password → attack is self-defeating once the admin pays attention. Residual risk: distributed-IP flood bypasses (a) and stresses only (b); accepted for v1. v2 reintroduces per-email tier if real incidents surface. | Phase 4 API test: single-IP 10/5min limit. v2 backlog item tracked in ADR-051.                                                      |
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

7. **Break-Glass is outsourced to company IT** via `FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md` (ADR-049, ships first). A DNS-verified tenant domain means the customer's IT admin controls the mailbox and can recreate it if Root loses access. This plan does not need an SRE-runbook or a Multi-Root-Mandate. **Note:** unverified tenants have a single-root-mailbox-loss deadlock (Plan 2 Known Limitation #10, blast-radius = 1 tenant-slot, accepted).

8. **Token burning on redemption block** — `password_reset_tokens.used = true` is set when a non-root target is detected. Prevents retry-with-same-token. Irreversible by design.

9. **~~Deploy-step: `TRUNCATE password_reset_tokens`~~ REMOVED in v0.4.3.** The original rationale ("breaking response shape means pre-existing tokens incompatible") collapses with v0.4.3's additive response (see #6). Tokens stay valid: root-owned tokens redeem normally, admin/employee-owned tokens hit the §2.6 redemption gate and are burned on first attempt (exactly the R9 defense). No DDL step at deploy, no `assixx_user` coordination, no root-user friction from a blanket wipe.

10. **~~Tightened throttle per OWASP / NIST~~ DEFERRED to v2 in v0.4.3.** The per-email tier is Scope-Creep: not needed for the core role-gate goal, addresses an unreported threat (cross-IP email flood), and two earlier iterations each carried a shipping bug (v0.4.1 phantom `throttlerName`, v0.4.2 `authEmailTracker` IP-prefix defeating R6). The feature was sprouting bugs faster than it shipped value. **v1 retains the existing `@AuthThrottle()` decorator** (10 req / 5 min per IP) on both `/forgot-password` and `/reset-password` — same IP-level defense as login and refresh. If a real distributed-IP email-flood incident surfaces → v2 plan, ~1-day sprint, with the ADR-051 follow-up covering the NestJS-Throttler per-tier `getTracker` pattern now documented in this plan's history.

11. **Microsoft OAuth is an acknowledged alternate-auth path (v0.4.0 G3).**
    ADR-046 merged Microsoft OAuth sign-in as a first-class authentication route (commit `5cd293ae8`). Admin or employee users whose tenant has OAuth enabled can sign in via Azure AD WITHOUT ever hitting `/auth/forgot-password`. Plan 1 does NOT try to interfere with that path — role-gate on password-reset is not a security model for "admins can never regain access", only for "password reset is not the vehicle by which they regain access". The correct mental model is:
    - Root users: password-reset is the self-service path.
    - Admin/Employee: EITHER (a) contact a root user in their tenant, OR (b) use Microsoft OAuth if their tenant has configured it. OAuth-only users (no password hash or `password = 'OAUTH'` placeholder) don't need password-reset anyway.
      Implication for §2.1: a blocked admin who only uses OAuth will receive the generic blocked-email (§2.3). Template wording ("Bitte wende Dich an einen Root-Benutzer") is suboptimal for OAuth-only admins ("Du meldest Dich über Dein Firmen-Microsoft-Konto an — ein Passwort-Reset ist nicht nötig") — accepted as a V1 limitation, tracked in Known Limitations #8. ADR-051 MUST include a "Relationship to ADR-046" section that states this explicitly.
      **Threat-model note:** The OAuth path does NOT reduce Plan 1's attack surface — an attacker cannot abuse it to bypass the role-gate because Microsoft only issues tokens for identities the Azure AD tenant owns. If an attacker compromises an admin's Microsoft account, they already have full account access and no password-reset would be needed. The two auth surfaces are orthogonal.

12. **Root-Initiated Reset — Target-Rule: admin/employee only, Root-on-Root rejected (v0.5.0).** A second Root in the tenant who has lost their password uses `/forgot-password` self-service (Root path is always open); there is no legitimate case where Root-A needs to reset Root-B's credential. **Rejecting Root-on-Root prevents a Root-takeover chain**: a compromised Root cannot grind through the other Roots and seize them one by one. Implementation: `sendAdminInitiatedResetLink()` returns 400 `{ code: 'INVALID_TARGET_ROLE' }` when target `role === 'root'`. Frontend hides the button on `/manage-root`-equivalent pages (only exposed in `/manage-admins` + `/manage-employees`). Inactive users (`is_active != 1`) also rejected (400 `INACTIVE_TARGET`).

13. **Root-Initiated Reset — Initiator-Rule: strict Root-only, NOT Layer-1 `canManage` (v0.5.0).** Deliberately NARROWER than ADR-045 Layer-1. `canManage(role, hasFullAccess, isAnyLead)` grants management-rights to admins-with-hasFullAccess and to any lead — but credential-issuance is NOT a business action, it is an auth-boundary action. Admin-with-hasFullAccess can view all tenant data (ADR-010), but CANNOT issue a password-reset-link. Only `role === 'root'` qualifies. Implementation: `@Roles(UserRole.ROOT)` on the controller — NOT `@RequirePermission(...)`. Consistent with §0.2.5 #1/#2 (same narrowing for self-service).
    **Why not Layer-1?** Because the blast radius is credential-resets for every admin/employee in the tenant. Layer-1 deliberately grants management to hasFullAccess admins + leads so they can do business operations; extending it to credential issuance would let e.g. a team-lead (`isAnyLead = true`) send reset-links to employees in their team — a privilege they demonstrably should not have. Root-only keeps the credential-boundary tight.

### 0.3 Ecosystem Integration Points

| System                                                                                                                   | Integration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Phase         |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `audit_trail` auto-interceptor                                                                                           | Phase 0 decides if auto-row is rich enough (Option A) or a manual `ActivityLoggerService` call is needed (Option B)                                                                                                                                                                                                                                                                                                                                                                                                        | 0 → 2         |
| `ActivityLoggerService`                                                                                                  | **If Option B:** `ActivityAction` union gets a new literal (e.g., `'block'`). Method call added after `sendPasswordResetBlocked(...)`.                                                                                                                                                                                                                                                                                                                                                                                     | 0 → 2         |
| Email service (`MailerService`, `loadBrandedTemplate`)                                                                   | New method `sendPasswordResetBlocked(user, meta)` + new template `password-reset-blocked.html`                                                                                                                                                                                                                                                                                                                                                                                                                             | 2             |
| Rate limiter: existing `@AuthThrottle()` retained                                                                        | **v0.4.3:** `@AuthThrottle()` (10 req / 5 min per IP) stays on both `/forgot-password` and `/reset-password` — same decorator used by login and refresh. No new decorator, no new tracker, no `CustomThrottlerGuard` change, no `AppThrottlerModule` change. Per-email throttle deferred to v2 (§0.2.5 #10).                                                                                                                                                                                                               | — (no change) |
| `users.role`, `users.is_active`                                                                                          | Read at both gates                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 2             |
| `password_reset_tokens` table                                                                                            | Redemption gate marks `used = true` when blocking a non-root target (single-use burn — R9). **v0.4.3:** TRUNCATE deploy-step REMOVED (§0.2.5 #9). Token table is NOT wiped at release. Pre-existing admin/employee tokens handled naturally by redemption gate. **v0.5.0:** new column `initiated_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL` (Phase 1 migration reinstated) distinguishes self-service tokens (NULL) from Root-initiated tokens (NOT NULL → Root-ID).                                | 2             |
| **NEW v0.5.0:** `password_reset_tokens.initiated_by_user_id` column                                                      | Added via Phase 1 migration. Null = self-service path (§2.1 + §2.6 role-gate applies). Not-null = admin-initiated path (§2.7 + §2.8 origin-check applies). `ON DELETE SET NULL` so a Root deletion doesn't cascade-nuke in-flight tokens — instead the initiator becomes "ghost" and the redemption-gate (§2.8) detects it and burns the token.                                                                                                                                                                            | 1             |
| **NEW v0.5.0:** `AuthService.sendAdminInitiatedResetLink()` + endpoint `POST /api/v2/users/:id/send-password-reset-link` | Controller lives in `UsersController` (semantically a user-management action), Service-method lives in `AuthService` (business logic is credential-issuance, not user-CRUD). Strict Root-only guard (`@Roles(UserRole.ROOT)` + `@UseGuards(JwtAuthGuard, RolesGuard)`). Rate-limit via DB-check on `MAX(created_at)` (§0.3 "Rate limiter" row — NO new Throttler tier). Returns 200 `{ message }` on success, 400 on invalid target (role / inactive / cross-tenant), 429 on rate-limit hit, 403 if initiator is not Root. | 2             |
| **NEW v0.5.0:** `MailerService.sendPasswordResetAdminInitiated()` + template `password-reset-admin-initiated.html`       | New method signature: `(recipient, initiatorName, rawToken, expiresAt) → Promise<void>`. Template text explicitly names the initiator Root ("{initiatorName} hat für Dich einen Passwort-Reset-Link angefordert"). Reuses `loadBrandedTemplate()` pattern + dark-mode HTML style from `password-reset.html`.                                                                                                                                                                                                               | 2             |
| **NEW v0.5.0:** Frontend Manage-Admin / Manage-Employee Edit-Modal                                                       | New button "Passwort-Reset-Link senden" in the Account-Section of the edit-modal on `/manage-admins` + `/manage-employees`. Calls new API endpoint. Confirm-dialog before POST. Success-toast "E-Mail gesendet an {email}". Button only rendered for the Root viewer (`user.role === 'root'`) — admin with hasFullAccess does NOT see it (§0.2.5 #13). Button disabled during in-flight request (loading-state).                                                                                                           | 5             |
| CLS context (`ClsService`, ADR-006)                                                                                      | **MANDATORY:** extend `ClsModule.forRoot` `setup:` in `app.module.ts:131-137` by two lines (`cls.set('ip', req.ip)` + `cls.set('userAgent', req.headers['user-agent'])`). Verified: current setup populates only `requestId` / `requestPath` / `requestMethod`.                                                                                                                                                                                                                                                            | 2             |
| Fastify `trustProxy` (v0.4.0 S5)                                                                                         | `req.ip` must resolve to the true client IP behind the Nginx reverse-proxy (Production: port 80 → :3000). Either `trustProxy: true` on `NestFastifyApplication` OR manual `X-Forwarded-For` read in CLS setup. Phase 0 records the chosen path, Phase 2 implements.                                                                                                                                                                                                                                                        | 0 → 2         |
| Microsoft OAuth (ADR-046, v0.4.0 G3)                                                                                     | Orthogonal code path — no shared functions with `auth.service.ts` (grep-verified). ADR-051 must include a "Relationship to ADR-046" section stating that OAuth-only admins are a legitimate use case and the role-gate does not attempt to block them at the OAuth layer.                                                                                                                                                                                                                                                  | 6             |
| Frontend `/forgot-password` Form Action                                                                                  | Action parses backend JSON, re-exports `blocked` + `reason` via `ActionData`                                                                                                                                                                                                                                                                                                                                                                                                                                               | 5             |
| Existing `password-reset.html` template + sender                                                                         | Untouched — remains the root-happy-path mail                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | N/A           |

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
  - `user_id INTEGER NOT NULL REFERENCES users(id)` (FK `ON DELETE RESTRICT`). **Interaction with Plan 2's `TRUNCATE tenants CASCADE` (ADR-049 §1.0) — v0.4.2 correction:** PostgreSQL's `TRUNCATE ... CASCADE` propagates explicitly to ALL FK-referencing tables regardless of their `ON DELETE` action — `ON DELETE RESTRICT` only affects DELETE, not TRUNCATE CASCADE. So `TRUNCATE tenants CASCADE` transitively wipes `users` and then `password_reset_tokens` without any preparation; the FK action is irrelevant here. **Side effect:** Plan 2's clean-slate wipes any in-flight reset tokens too (live DB had 122 rows at the 2026-04-17 verification — all dev/test), which conveniently aligns with Plan 1 Phase 6's deploy-step TRUNCATE. Prior drafts (v0.3.0–v0.4.1) described this as "Plan 2 runs before any tokens exist" — accurate for a fresh prod install, misleading for dev.
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
- [x] **OAuth anchor (v0.4.0 G3)** — **DONE 2026-04-19:** grep for `forgotPassword|password_reset|resetPassword` in `backend/src/nest/auth/oauth/` → **0 matches**. Orthogonality claim for ADR-051 "Relationship to ADR-046" is anchored.

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
    path.includes('/auth/forgot-password') || // NEW — ADR-051 two-gate coverage
    path.includes('/auth/reset-password') // NEW — ADR-051 two-gate coverage
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
- [x] **OAuth-path grep recorded (v0.4.0 G3)** — **DONE 2026-04-19:** `grep -rE 'forgotPassword|password_reset|resetPassword' backend/src/nest/auth/oauth/` → **0 matches**. Orthogonality anchor for ADR-051 "Relationship to ADR-046" locked in.
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

## Phase 1: Migration — `password_reset_tokens.initiated_by_user_id` (Session 1c, Part A)

> **Reinstated in v0.5.0.** Original v0.4.4 had Phase 1 omitted because no schema change was required for the self-service gate. The Root-Initiated Reset feature needs a new column to distinguish self-service tokens from admin-initiated tokens (§0.2.5 #12, §2.8). Follows DATABASE-MIGRATION-GUIDE discipline: Backup → Generator → Dry-Run → Run → Verify → Sync-Customer.

### Step 1.1 — Generate migration file [STATUS]

```bash
doppler run -- pnpm run db:migrate:create add-password-reset-initiated-by
```

Produces `database/migrations/<17-digit-UTC>_add-password-reset-initiated-by.ts`. **Never edit the timestamp, never create the file manually** (DATABASE-MIGRATION-GUIDE hard-block rule).

### Step 1.2 — Implement `up()` / `down()` [STATUS]

```typescript
// database/migrations/<ts>_add-password-reset-initiated-by.ts
import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Add initiated_by_user_id to password_reset_tokens.
 *
 * Purpose: distinguish self-service tokens (NULL) from Root-initiated tokens
 * (Root-ID). §2.6 redemption-gate branches on this; NULL keeps role-gate,
 * NOT-NULL switches to initiator-origin-check.
 *
 * Why ON DELETE SET NULL (not CASCADE): a deleted Root must not cascade-nuke
 * in-flight admin-initiated tokens — instead the initiator becomes "ghost",
 * and the redemption-gate (§2.8) detects `initiated_by_user_id IS NULL` on a
 * token that was never self-service and burns it as invalid.
 *
 * Actually simpler: if `initiated_by_user_id` is NULL after SET NULL from a
 * deleted Root, the token looks like a self-service token at redemption time,
 * and the §2.6 self-service role-gate kicks in — which blocks admin/employee
 * targets anyway. Defence-in-depth holds.
 *
 * No RLS changes: password_reset_tokens is a global table (ADR-019 §7), no
 * tenant_id column, no RLS policy. GRANT-extension to sys_user is already
 * present for the column-less base grant. No index on the new column — it is
 * read only in redemption path after the token is already located by its
 * hash (which has its own unique constraint).
 *
 * @see docs/FEAT_FORGOT_PASSWORD_ROLE_GATE_MASTERPLAN.md §1 + §2.7–§2.8
 * @see ADR-050 (Forgot-Password Role-Gate + Root-Initiated Reset, pending Phase 6)
 *      NOTE: This comment reflects the literal bytes of the shipped migration file
 *      `20260420220236221_add-password-reset-initiated-by.ts`. During Phase 6
 *      (Session 3, 2026-04-21) the ADR was renumbered ADR-050 → ADR-051 because
 *      the ADR-050 slot had been taken by the unrelated `ADR-050-tenant-subdomain-
 *      routing.md`. The shipped file + live DB `COMMENT ON COLUMN` were NOT
 *      rewritten (applied migrations are immutable history). See ADR-051
 *      §Historical Note for the full drift explanation.
 */
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE password_reset_tokens
      ADD COLUMN initiated_by_user_id INTEGER NULL
      REFERENCES users(id) ON DELETE SET NULL;

    COMMENT ON COLUMN password_reset_tokens.initiated_by_user_id IS
      'NULL = self-service (via /auth/forgot-password). NOT NULL = Root-initiated (via admin-reset-link endpoint). Redemption gate branches on this. ADR-050.';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE password_reset_tokens DROP COLUMN IF EXISTS initiated_by_user_id;
  `);
}
```

### Step 1.3 — Backup + Dry-Run + Apply [STATUS]

```bash
# 1. MANDATORY backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
  --format=custom --compress=9 \
  > database/backups/pre-initiated-by-${TIMESTAMP}.dump

# 2. Dry-run — if this errors, STOP. Don't bypass. Don't run raw SQL.
doppler run -- ./scripts/run-migrations.sh up --dry-run

# 3. Apply
doppler run -- ./scripts/run-migrations.sh up
```

### Step 1.4 — Verify [STATUS]

```bash
# Column exists + FK is correct
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d password_reset_tokens"
# Expect: initiated_by_user_id | integer | (nullable, FK users.id ON DELETE SET NULL)

# Migration tracked
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT id, name, run_on FROM pgmigrations ORDER BY run_on DESC LIMIT 3;"
# Expect: <ts>_add-password-reset-initiated-by at the top

# Backend still boots (no code uses the column yet, but schema-drift check)
doppler run -- docker-compose restart backend deletion-worker
curl -s http://localhost:3000/health | jq '.status'
# Expect: "ok"
```

### Step 1.5 — Sync customer fresh-install [STATUS]

```bash
./scripts/sync-customer-migrations.sh
# Regenerates customer/fresh-install/001_schema.sql + 005_pgmigrations.sql
```

### Phase 1 — Definition of Done

- [x] Migration file created via generator (never by hand) — `20260420220236221_add-password-reset-initiated-by.ts`
- [x] `up()` + `down()` implemented
- [x] Backup taken before apply (`database/backups/pre-initiated-by-20260421_000342.dump`, 2.9M)
- [x] Dry-run green
- [x] Migration applied, `pgmigrations` table shows new row (id=140, 2026-04-21 00:04:16)
- [x] `\d password_reset_tokens` shows new column with `ON DELETE SET NULL` (constraint: `password_reset_tokens_initiated_by_user_id_fkey FOREIGN KEY (initiated_by_user_id) REFERENCES users(id) ON DELETE SET NULL`)
- [x] Backend boots healthy post-restart (`curl /health` → `status: ok`)
- [x] Customer fresh-install synced (`./scripts/sync-customer-migrations.sh` → SYNC COMPLETE, 139 migrations)

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

### Step 2.7 — NEW v0.5.0: Admin-Initiated Endpoint [STATUS]

**Goal:** Root clicks "Passwort-Reset-Link senden" in `/manage-admins` or `/manage-employees` edit-modal → backend issues a reset-token tagged with `initiated_by_user_id = <rootId>` → target user receives email with link → clicks link → `/reset-password` page → sets new password (via §2.8 origin-check-branch).

**Route:** `POST /api/v2/users/:id/send-password-reset-link`

**File split:**

- Controller: `backend/src/nest/users/users.controller.ts` (new route handler). REST-shape fits User-Management.
- Service-method: `backend/src/nest/auth/auth.service.ts` (credential-issuance is Auth-domain). Controller calls `authService.sendAdminInitiatedResetLink(...)` — `UsersService` is NOT involved.
- Guards: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.ROOT)` — strict Root-only (§0.2.5 #13). NOT `@RequirePermission(...)` — Layer-1 `canManage` is narrower for credentials.
- Throttle: existing `@UserThrottle()` IP-level (1000/15min — covers accidental burst protection). Per-pair 1/15min rate-limit implemented in service via DB check (§0.3 row).

**Controller signature (draft):**

```typescript
// users.controller.ts
@Post(':id/send-password-reset-link')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ROOT)
@HttpCode(HttpStatus.OK)
async sendPasswordResetLink(
  @Param() params: UserIdParamDto,
  @CurrentUser() currentUser: NestAuthUser,
): Promise<SendPasswordResetLinkResponse> {
  return this.authService.sendAdminInitiatedResetLink(params.id, currentUser);
}
```

**Service logic (draft, `auth.service.ts`):**

```typescript
async sendAdminInitiatedResetLink(
  targetUserId: number,
  initiator: NestAuthUser,
): Promise<SendPasswordResetLinkResponse> {
  // 1. Load target via tenant-scoped query (RLS enforces same-tenant).
  //    Fresh DB lookup — never trust JWT payload for role/is_active (ADR-005).
  const target = await this.findUserById(targetUserId);
  if (target === null) {
    throw new NotFoundException('Benutzer nicht gefunden.');
  }

  // 2. Target-Rule (§0.2.5 #12): admin/employee only, Root-on-Root rejected.
  if (target.role === 'root') {
    throw new BadRequestException({
      message: 'Root-Benutzer können kein Passwort-Reset-Link für andere Roots anfordern. Root-Benutzer nutzen /forgot-password selbst.',
      code: 'INVALID_TARGET_ROLE',
    });
  }
  if (target.role !== 'admin' && target.role !== 'employee') {
    throw new BadRequestException({ message: 'Ungültige Zielrolle.', code: 'INVALID_TARGET_ROLE' });
  }
  if (target.is_active !== 1) {
    throw new BadRequestException({ message: 'Zielbenutzer ist nicht aktiv.', code: 'INACTIVE_TARGET' });
  }

  // 3. Rate-limit: 1 request / 15 min per (initiator, target). DB-check, not Throttler.
  //    WHY DB-check: no Redis-infra change, no new Throttler tier, accurate per-pair scoping.
  const recent = await this.databaseService.systemQueryOne<{ created_at: Date }>(
    `SELECT created_at FROM password_reset_tokens
     WHERE user_id = $1 AND initiated_by_user_id = $2
     ORDER BY created_at DESC LIMIT 1`,
    [targetUserId, initiator.id],
  );
  if (recent !== null && Date.now() - recent.created_at.getTime() < 15 * 60 * 1000) {
    throw new HttpException(
      { message: 'Bitte warte 15 Minuten, bevor Du erneut einen Link anforderst.', code: 'RATE_LIMIT' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  // 4. Issue token — identical to §2.1 root-happy-path, plus initiated_by_user_id.
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = this.hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 min, §0.2.5 #12
  await this.databaseService.systemQuery(
    `INSERT INTO password_reset_tokens
       (user_id, token, expires_at, used, initiated_by_user_id)
     VALUES ($1, $2, $3, false, $4)`,
    [target.id, tokenHash, expiresAt, initiator.id],
  );

  // 5. Send email (§2.9).
  await this.mailer.sendPasswordResetAdminInitiated(
    { email: target.email, firstName: target.first_name, lastName: target.last_name },
    this.buildUserName(initiator), // "{firstName} {lastName}" of the Root
    rawToken,
    expiresAt,
  );

  // 6. Audit-log (same pattern as §2.1 logger.warn, picked up by §2.4 auto-interceptor).
  this.logger.warn(
    `Admin-initiated password-reset-link issued by root ${initiator.id} (tenant=${initiator.tenant_id}) for target ${target.id} (role=${target.role}).`,
  );

  return { message: `E-Mail gesendet an ${target.email}` };
}
```

**DTO types (new, `auth/dto/index.ts` + referenced file):**

```typescript
// dto/send-password-reset-link.dto.ts
export interface SendPasswordResetLinkResponse {
  readonly message: string;
}
```

**User-ID param DTO:** reuse existing `UserIdParamDto` from `users/dto/user-id-param.dto.ts` (factory pattern per TYPESCRIPT-STANDARDS §7.5).

### Step 2.8 — NEW v0.5.0: `resetPassword()` Origin-Check Branch [STATUS]

**Goal:** redemption-gate (§2.6) currently role-gates every token. The origin-check branch routes admin-initiated tokens around the role-gate (they'd be blocked otherwise) and adds an initiator-lifecycle check instead.

**File:** `backend/src/nest/auth/auth.service.ts:411` (the same `resetPassword()` extended by §2.6).

**Logic addition — inserted BEFORE the §2.6 role-gate:**

```typescript
async resetPassword(dto: ResetPasswordDto): Promise<void> {
  const tokenHash = this.hashToken(dto.token);

  // SELECT now also fetches initiated_by_user_id (new column from Phase 1).
  const rows = await this.databaseService.systemQuery<{
    id: number;
    user_id: number;
    initiated_by_user_id: number | null;
  }>(
    `SELECT id, user_id, initiated_by_user_id FROM password_reset_tokens
     WHERE token = $1 AND used = false AND expires_at > NOW()`,
    [tokenHash],
  );
  const tokenRow = rows[0];
  if (tokenRow === undefined) {
    throw new UnauthorizedException('Ungültiger oder abgelaufener Link. Bitte fordern Sie einen neuen an.');
  }

  const user = await this.findUserById(tokenRow.user_id);
  if (user === null || user.is_active !== 1) {
    await this.burnToken(tokenRow.id);
    throw new UnauthorizedException('Ungültiger oder abgelaufener Link. Bitte fordern Sie einen neuen an.');
  }

  // NEW v0.5.0 — branch on token origin.
  if (tokenRow.initiated_by_user_id !== null) {
    // Admin-initiated path — verify initiator is STILL a valid Root in the target's tenant.
    const initiator = await this.findUserById(tokenRow.initiated_by_user_id);
    if (
      initiator === null ||
      initiator.is_active !== 1 ||
      initiator.role !== 'root' ||
      initiator.tenant_id !== user.tenant_id
    ) {
      await this.burnToken(tokenRow.id);
      this.logger.warn(
        `Admin-initiated reset-redemption BLOCKED: initiator ${tokenRow.initiated_by_user_id} is no longer a valid Root (or tenant drift). Target=${user.id}.`,
      );
      // Generic 401 — don't leak initiator-lifecycle details to the token-holder.
      throw new UnauthorizedException('Ungültiger oder abgelaufener Link. Bitte fordern Sie einen neuen an.');
    }
    // Initiator check passed — SKIP the §2.6 role-gate. Fall through to the
    // happy-path below (hash new password, UPDATE users, mark token used).
  } else {
    // Self-service path — §2.6 role-gate applies (Root-only redemption).
    if (user.role !== 'root') {
      await this.burnToken(tokenRow.id);
      this.logger.warn(
        `Self-service password-reset REDEMPTION BLOCKED for user ${user.id} (role=${user.role}) — token burned.`,
      );
      throw new ForbiddenException(
        'Passwort-Reset nicht erlaubt. Wende Dich an einen Root-Benutzer in Deinem Unternehmen.',
      );
    }
  }

  // Existing root happy path — hash new password, UPDATE users, mark token used.
  // (unchanged below)
}
```

**Decision table for redemption (after v0.5.0):**

| `initiated_by_user_id` | Target role      | Initiator still valid?                     | Outcome                                        |
| ---------------------- | ---------------- | ------------------------------------------ | ---------------------------------------------- |
| NULL (self-service)    | root             | —                                          | Allow (original §2.6 root-happy-path)          |
| NULL (self-service)    | admin / employee | —                                          | Block 403 `ROLE_NOT_ALLOWED` + burn (§2.6)     |
| NOT NULL (admin-init.) | root             | —                                          | N/A — §2.7 rejects Root targets at issuance    |
| NOT NULL (admin-init.) | admin / employee | YES                                        | Allow (§2.8 initiator check passed)            |
| NOT NULL (admin-init.) | admin / employee | NO (deleted/inactive/demoted/cross-tenant) | Block 401 + burn (§2.8 initiator check failed) |

### Step 2.9 — NEW v0.5.0: Mailer + Template for Admin-Initiated Reset [STATUS]

**New file:** `backend/templates/email/password-reset-admin-initiated.html`

- Mirror visual style of `password-reset.html` (dark-mode HTML, 600-px container, `cid:assixx-logo`, MSO-compatible button).
- German text with `ä/ö/ü/ß`.
- Variables: `{{userName}}`, `{{initiatorName}}`, `{{resetUrl}}`, `{{expiresAt}}`.

**Template text draft (finalize wording in implementation):**

```
Hallo {{userName}},

{{initiatorName}} (Root-Benutzer in Deinem Unternehmen) hat für
Dich einen Passwort-Reset-Link angefordert. Klicke auf den
folgenden Button, um ein neues Passwort zu setzen:

  [ Neues Passwort setzen ]   → {{resetUrl}}

Der Link ist bis {{expiresAt}} gültig (60 Minuten).

Falls Du oder {{initiatorName}} diesen Link NICHT angefordert
habt, ignoriere diese E-Mail und informiere umgehend Deinen
IT-Support oder einen anderen Root-Benutzer.

— Dein Assixx-Team
```

**New `MailerService` method signature:**

```typescript
async sendPasswordResetAdminInitiated(
  recipient: { email: string; firstName: string; lastName: string },
  initiatorName: string,
  rawToken: string,
  expiresAt: Date,
): Promise<void>
```

Implementation mirrors the existing `sendPasswordReset()` wrapper (§2.3 anchor from Phase 0) — `loadBrandedTemplate('password-reset-admin-initiated', vars)`, same retry + log-on-failure pattern (preserves R8 no-leak on SMTP failure).

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
- [ ] **NEW v0.5.0 §2.7:** `AuthService.sendAdminInitiatedResetLink()` implemented; 4 reject-branches (`INVALID_TARGET_ROLE` for root, `INVALID_TARGET_ROLE` for non-admin-non-employee, `INACTIVE_TARGET`, `RATE_LIMIT`) + happy-path token issuance with `initiated_by_user_id = initiator.id`
- [ ] **NEW v0.5.0 §2.7:** `UsersController.sendPasswordResetLink()` endpoint `POST /api/v2/users/:id/send-password-reset-link` with `@Roles(UserRole.ROOT)` — strict Root-only (NOT `canManage`, NOT `@RequirePermission`)
- [ ] **NEW v0.5.0 §2.7:** `SendPasswordResetLinkResponse` DTO type exported from `auth/dto/index.ts`
- [ ] **NEW v0.5.0 §2.8:** `resetPassword()` origin-check branch implemented; `initiated_by_user_id IS NOT NULL` → initiator-lifecycle check, then fall-through to happy-path; `initiated_by_user_id IS NULL` → existing §2.6 role-gate
- [ ] **NEW v0.5.0 §2.8:** Initiator-lifecycle check burns token + 401 on any of: initiator deleted / `is_active != 1` / `role != 'root'` / `tenant_id != target.tenant_id`
- [ ] **NEW v0.5.0 §2.9:** `MailerService.sendPasswordResetAdminInitiated()` implemented; reuses `loadBrandedTemplate()` + same try-catch-log pattern as `sendPasswordReset()` (R8 no-leak on SMTP failure preserved)
- [ ] **NEW v0.5.0 §2.9:** Template `backend/templates/email/password-reset-admin-initiated.html` created, mirrors `password-reset.html` style, German with ä/ö/ü/ß, variables `{{userName}}`, `{{initiatorName}}`, `{{resetUrl}}`, `{{expiresAt}}`
- [ ] No `any`; `??` not `||`; explicit null checks; `import type` for type-only imports; `getErrorMessage()` for catches
- [ ] ESLint: `docker exec assixx-backend pnpm exec eslint backend/src/nest/auth/ backend/src/nest/common/ backend/src/nest/users/` → 0 errors
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

**NEW v0.5.0 — Root-Initiated Reset scenarios (≥ 7):**

- [ ] `sendAdminInitiatedResetLink()` by Root to Admin (same tenant, active) → success; token row inserted with `initiated_by_user_id = rootId`; `sendPasswordResetAdminInitiated` called
- [ ] `sendAdminInitiatedResetLink()` by Root to Employee (same tenant, active) → same as above
- [ ] `sendAdminInitiatedResetLink()` by Root to another Root → `BadRequestException { code: 'INVALID_TARGET_ROLE' }`; no token; no mail (§0.2.5 #12)
- [ ] `sendAdminInitiatedResetLink()` by Root to inactive user (`is_active ∈ {0, 3, 4}` — one test per value OR a parameterized test) → `BadRequestException { code: 'INACTIVE_TARGET' }`; no token; no mail
- [ ] `sendAdminInitiatedResetLink()` twice within 15 min (same Root, same target) → 2nd call → `HttpException(429) { code: 'RATE_LIMIT' }`; no 2nd token row; no 2nd mail
- [ ] `sendAdminInitiatedResetLink()` 16 min after first → 2nd call succeeds; 2 token rows exist, both with `initiated_by_user_id = rootId`
- [ ] `resetPassword()` with admin-initiated token for Admin target, initiator still active Root → success; password updated; token burned (used=true); bypasses §2.6 role-gate (§2.8 happy-path)
- [ ] `resetPassword()` with admin-initiated token, but initiator has been deleted (FK set to NULL) → origin-check sees `initiated_by_user_id = NULL` → falls through to §2.6 role-gate → blocks + burns token + 403
- [ ] `resetPassword()` with admin-initiated token, but initiator is_active = 0 → §2.8 initiator-lifecycle check fails → 401 + burn
- [ ] `resetPassword()` with admin-initiated token, but initiator role was demoted to `admin` → §2.8 fails → 401 + burn
- [ ] `resetPassword()` with admin-initiated token, but initiator moved to different tenant (edge case — shouldn't happen but defence-in-depth) → §2.8 fails → 401 + burn

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

**NEW v0.5.0 — Root-Initiated Reset API scenarios (≥ 6):**

- [ ] POST `/api/v2/users/:id/send-password-reset-link` as Root with active admin target (same tenant) → 200 `{ message }`; 1 row in `password_reset_tokens` with `initiated_by_user_id = rootId`; outbound mail captured + body contains initiator-name + reset-URL
- [ ] Same as Root with active employee target (same tenant) → identical success path
- [ ] Same as Root with another Root as target → 400 `{ code: 'INVALID_TARGET_ROLE' }`; no token; no mail (§0.2.5 #12)
- [ ] Same as Admin (even with hasFullAccess) → 403 Forbidden (RolesGuard rejects before service logic runs)
- [ ] Same as Employee → 403 Forbidden
- [ ] Same unauthenticated (no JWT) → 401 Unauthorized
- [ ] Rate-limit per (root, target) pair: POST twice within 15 min from same Root to same target → 2nd → 429 `{ code: 'RATE_LIMIT' }`; only 1 token row
- [ ] Rate-limit isolation: same Root to DIFFERENT target within 15 min → 2nd succeeds (per-pair scoping, not per-Root-global)
- [ ] Cross-tenant: Root in tenant A tries to send reset for user in tenant B → 404 (RLS blocks via `findUserById` tenant-scoped query; target not found)
- [ ] **Redemption happy-path:** POST `/api/v2/auth/reset-password` with admin-initiated token + new password → 200; user's bcrypt hash updated in DB; all refresh-tokens for that user revoked; token row has `used = true`
- [ ] **Redemption initiator-lifecycle failure:** issue token, delete initiator Root, then POST `/reset-password` with the token → 401; token burned; auth.service logs the block (observable via Loki or stdout)

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

### Step 5.3 — NEW v0.5.0: Button in `/manage-admins` Edit-Modal [STATUS]

**Files:**

- `frontend/src/routes/(app)/(root)/manage-admins/+page.svelte` — new button in the Edit-Modal's Account-Section
- `frontend/src/routes/(app)/(root)/manage-admins/_lib/api.ts` (or equivalent facade) — new `sendPasswordResetLink(userId)` function wrapping `apiClient.post()`
- `frontend/src/routes/(app)/(root)/manage-admins/_lib/constants.ts` — German UI strings

**Button placement:** Account-Section of the Edit-Modal, below the password-fields (or in a dedicated "Aktionen" subsection). Label: **"Passwort-Reset-Link senden"** (German, umlauts preserved). Icon: `<i class="fas fa-paper-plane"></i>` or `fa-key`.

**UX flow:**

1. User (Root) clicks button → `Confirm-Dialog` opens with text: _"Soll dem Benutzer {email} eine E-Mail mit einem Passwort-Reset-Link gesendet werden? Der Benutzer kann danach ein neues Passwort setzen — Du siehst es nicht."_
2. User bestätigt → Button geht in Loading-State (spinner + disabled)
3. `POST /api/v2/users/:id/send-password-reset-link` via `apiClient`
4. **Success (200):** `showSuccessAlert` via `$lib/stores/toast`: _"E-Mail gesendet an {email}"_; modal bleibt offen
5. **Error 400 (`INVALID_TARGET_ROLE` / `INACTIVE_TARGET`):** `showErrorAlert`: spezifische deutsche Nachricht; modal bleibt offen
6. **Error 429 (`RATE_LIMIT`):** `showErrorAlert`: _"Bitte warte 15 Minuten, bevor Du erneut einen Link anforderst."_
7. **Error 403 / 401 / 500:** generischer `showErrorAlert`

**Svelte 5 pattern (draft):**

```svelte
<script lang="ts">
  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';
  import { sendPasswordResetLink } from './_lib/api';
  import { PASSWORD_RESET_CONFIRM, PASSWORD_RESET_SUCCESS, PASSWORD_RESET_ERRORS } from './_lib/constants';

  interface Props {
    user: { id: number; email: string };
  }
  const { user }: Props = $props();

  let sending = $state(false);

  async function handleSendResetLink(): Promise<void> {
    if (!confirm(PASSWORD_RESET_CONFIRM(user.email))) return;
    sending = true;
    try {
      const result = await sendPasswordResetLink(user.id);
      showSuccessAlert(result.message);
    } catch (err: unknown) {
      const message = err instanceof Error ? (PASSWORD_RESET_ERRORS[err.code] ?? err.message) : PASSWORD_RESET_ERRORS.UNKNOWN;
      showErrorAlert(message);
    } finally {
      sending = false;
    }
  }
</script>

<button type="button" class="btn btn-secondary" onclick={handleSendResetLink} disabled={sending}>
  {#if sending}
    <i class="fas fa-spinner fa-spin mr-2"></i>
  {:else}
    <i class="fas fa-paper-plane mr-2"></i>
  {/if}
  Passwort-Reset-Link senden
</button>
```

**Role-Gate at the UI layer:** button is rendered ONLY when `data.user.role === 'root'` (the currently logged-in user is Root). Admin-with-hasFullAccess does NOT see the button — consistent with §0.2.5 #13. Backend enforces the same via `@Roles(UserRole.ROOT)`.

### Step 5.4 — NEW v0.5.0: Button in `/manage-employees` Edit-Modal [STATUS]

**Files:**

- `frontend/src/routes/(app)/(root)/manage-employees/+page.svelte` (or wherever the edit-modal lives per current route structure — confirm in Phase 0 B-scope prep of Session 1c)
- Equivalent `_lib/api.ts` + `_lib/constants.ts` additions

**Identical pattern to §5.3** — same button, same confirm-dialog copy, same success/error handling. Only difference: the edit-modal lives in a different route. Copy-paste the `handleSendResetLink` pattern + imports; do NOT extract into a shared component unless both modals share the same parent layout (KISS — two instances < premature abstraction).

**Phase 0 B-scope note:** before Phase 5.3/5.4 implementation, the exact file paths + component boundaries for both Edit-Modals must be anchored in Session 1c (extension to v0.4.4 Phase 0). Current plan assumes `/manage-admins` and `/manage-employees` expose an Edit-Modal component that receives the target user as a prop.

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
- [ ] **NEW v0.5.0 §5.3:** "Passwort-Reset-Link senden" button in `/manage-admins` Edit-Modal; confirm-dialog before POST; success-toast on 200; specific German error-mapping for 400/429/403
- [ ] **NEW v0.5.0 §5.3:** Button ONLY visible to Root viewer (`data.user.role === 'root'`) — admin-with-hasFullAccess does NOT see it
- [ ] **NEW v0.5.0 §5.3:** Loading-state during in-flight request (spinner + disabled button)
- [ ] **NEW v0.5.0 §5.4:** Identical button + behaviour in `/manage-employees` Edit-Modal; file paths anchored in Session 1c Phase-0-B-scope prep
- [ ] **NEW v0.5.0 §5.3+5.4:** Manual smoke in browser: Root clicks button on admin target → target receives mail → clicks link → `/reset-password` page → sets new password → redirected to login → logs in with new password successfully
- [ ] **NEW v0.5.0 §5.3+5.4:** Rate-limit smoke: Root clicks button twice within 15 min for same target → 2nd click shows 429 toast

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

- [ ] **ADR-051** written: "Forgot-Password Role-Gate". Sections: threat model, two-gate design (request + redemption), **additive response shape** (v0.4.3 — not clean-break), existing `@AuthThrottle()` used as-is, accepted R1 leak, **"v2 backlog: Per-Email-Throttle"** (v0.4.3 scope-re-cut rationale + NestJS-Throttler per-tier `getTracker` reference notes), decoupling from ADR-049 (Domain Verification), **"Relationship to ADR-046 (Microsoft OAuth)"** — explicit statement that OAuth is an orthogonal alternate-auth path
- [ ] `FEATURES.md` security section updated
- [ ] Docstring on `forgotPassword()` + `resetPassword()` references ADR-051 (v0.4.3: no `ForgotPasswordThrottle()` or `CustomThrottlerGuard` changes to docstring)
- [ ] `docs/how-to/HOW-TO-CURL.md` example for hitting `/forgot-password` — body shape unchanged (additive, v0.4.3), no update likely needed

### Phase 6 — Definition of Done

- [ ] All 5 end-to-end paths verified in dev + production
- [ ] Rate-limit smoke passes (1 tier only — v0.4.3)
- [ ] ~~`TRUNCATE password_reset_tokens`~~ — **NOT PERFORMED (v0.4.3)**: no DDL at deploy; redemption-gate handles pre-existing tokens.
- [ ] ADR-051 status "Accepted"
- [ ] `FEATURES.md` updated
- [ ] Plan version → 2.0.0

---

## Session Tracking

| Session             | Phase                     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Status     | Date       |
| ------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------- |
| 1a                  | 0 (A-scope)               | Phase 0 current-state analysis for self-service gate (anchors, DTO, frontend, CLS extension, audit decision, OAuth orthogonality, trustProxy verification). No code changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | ✅ DONE    | 2026-04-19 |
| 1b                  | 2.1–2.6                   | Backend self-service gate (both gates §2.1 + §2.6, email template §2.3, audit wiring `isAuthEndpoint()` extension §2.4, CLS extension, additive DTO §2.2). v0.4.3: no new throttler decorator — `@AuthThrottle()` stays.                                                                                                                                                                                                                                                                                                                                                                                                                                              | ✅ DONE    | 2026-04-20 |
| **1c** (NEW v0.5.0) | 0 (B-scope) + 1 + 2.7–2.9 | **Root-Initiated Reset backend.** Phase 0 B-scope: anchor `UsersController` + `UserRole` enum + existing RolesGuard + `/manage-admins` + `/manage-employees` route structure (read-only). Phase 1: migration `add-password-reset-initiated-by` with generator + backup + dry-run + apply + verify + customer-sync. Phase 2.7: `AuthService.sendAdminInitiatedResetLink()` + `UsersController.sendPasswordResetLink()` endpoint (Root-only, DB-level rate-limit). Phase 2.8: `resetPassword()` origin-check branch with initiator-lifecycle validation. Phase 2.9: `MailerService.sendPasswordResetAdminInitiated()` + `password-reset-admin-initiated.html` template. | ✅ DONE    | 2026-04-21 |
| 2                   | 3 + 4 + 5                 | Unit tests (≥ 10 self-service + ≥ 7 admin-initiated = ~17) + API integration tests (≥ 8 self-service + ≥ 6 admin-initiated = ~14) + Frontend: §5.1+§5.2 merge-not-replace for `/forgot-password` + §5.3 `/manage-admins` button + §5.4 `/manage-employees` button.                                                                                                                                                                                                                                                                                                                                                                                                    | ✅ DONE    | 2026-04-21 |
| 3                   | 6                         | **ADR-051** (combined: Forgot-Password Role-Gate + Root-Initiated Reset, "Relationship to ADR-046" section, "Sequencing after ADR-049" section, §Historical Note documenting ADR-050 → ADR-051 renumber) written + accepted; `FEATURES.md` security section updated; 26 ADR-050 → ADR-051 renumberings in this plan (Phase 1 embedded migration code preserved as ADR-050 to mirror shipped migration bytes); 4 cross-plan refs in `FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md` updated. **Deferred (non-blocking):** (a) docstring `@see ADR-051` on `forgotPassword` / `resetPassword` / `sendAdminInitiatedResetLink` — files live on `feat/forgot-password-role-gate`, user handles branch switch. (b) E2E smoke dev + production for 6 flows — requires user sign-off for prod spin-up + SMTP sends.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ✅ DONE (docs) / ⏳ DEFERRED (docstrings + smoke) | 2026-04-21 |

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

### Session 1b — 2026-04-20

**Goal:** Implement Phase 2 steps §2.1–§2.6 (self-service request-gate + redemption-gate) backend per Phase 0 Deliverable Summary's 8-row edit list. No tests, no frontend, no migration, no §2.7–§2.9 (Session 1c scope).

**Result:** All 8 edits applied exactly per plan — no deviations, no scope creep. `ForgotPasswordResult` interface exported from `auth.service.ts`, three branches (`{blocked: false, delivered: false}` silent-drop, `{blocked: true, delivered: true}` role-block, `{blocked: false, delivered: true}` root-happy-path). `resetPassword()` redemption-gate burns token on lifecycle-fail (401, generic) OR role-fail (403 `ROLE_NOT_ALLOWED`) — both failure paths log-warn with user-id + role + tenant context. Controller additive-mapping landed: `{ message }` byte-identical across root + silent-drop (R1 enumeration-safe), extended to `{ message, blocked: true, reason: 'ROLE_NOT_ALLOWED' }` on block. Template mirrors `password-reset.html` dark-mode MSO-compatible style (600-px container, cid:assixx-logo), replaces CTA-button block with info-box rendering `{{timestamp}}` + `{{ip}}`.

**New files:**

- `backend/templates/email/password-reset-blocked.html` (281 lines, mirror of `password-reset.html` minus CTA, plus info-box).

**Changed files:**

- `backend/src/nest/app.module.ts` — ClsModule.forRoot `setup:` callback +2 keys (`ip`, `userAgent`).
- `backend/src/nest/common/audit/audit.helpers.ts` — `isAuthEndpoint()` += `/auth/forgot-password` + `/auth/reset-password` (Option A+).
- `backend/src/nest/auth/dto/forgot-password.dto.ts` — `ForgotPasswordResponse` += `readonly blocked?: true` + `readonly reason?: 'ROLE_NOT_ALLOWED'`; existing `message` made `readonly`.
- `backend/src/nest/common/services/mailer.service.ts` — new `PasswordResetBlockedMeta` interface, `sendPasswordResetBlocked()` method, `buildPasswordResetBlockedText()` private helper.
- `backend/src/nest/auth/auth.service.ts` — imports `ClsService` from `nestjs-cls`, exports `ForgotPasswordResult`, constructor += 5th `cls: ClsService` param, `forgotPassword()` rewritten with 3-branch return, `resetPassword()` now wraps old body in redemption-gate (lifecycle + role), private `burnToken(tokenRowId)` helper.
- `backend/src/nest/auth/auth.controller.ts` — `forgotPassword` handler: reads `result.blocked` and branches body.

**Verification:**

- ESLint: `docker exec assixx-backend pnpm exec eslint backend/src/nest/auth/ backend/src/nest/common/audit/ backend/src/nest/common/services/mailer.service.ts backend/src/nest/app.module.ts backend/src/nest/auth/auth.service.test.ts` — 0 errors.
- Type-check: `pnpm exec tsc --noEmit -p backend` / `-p shared` / `-p backend/test` — all 0 errors.
- Backend restart: `doppler run -- docker-compose restart backend` — container healthy post-restart; `curl http://localhost:3000/health` → `status: ok`.
- **Test-regression fix (triggered by Stop-hook test-run):** existing `auth.service.test.ts` was pre-Session-1b and asserted on `resolves.toBeUndefined()` (now `{blocked,delivered}`), used default `role: 'admin'` for happy-path mocks (now triggers block-gate), and mocked `findUserById` AFTER the token-UPDATE (now required BEFORE as redemption-gate). Fixes applied: (a) added `createMockCls()` factory + 5th ClsService constructor arg, (b) extended `createMockMailer()` with `sendPasswordResetBlocked`, (c) silent-drop tests assert `{ blocked: false, delivered: false }`, (d) happy-path tests pass `role: 'root'` to `createMockUserRow`, (e) resetPassword mock order reshuffled to SELECT→findUserById→UPDATE→UPDATE→revoke, (f) "should NOT call revoke when findUserById returns null" test repurposed to "should burn token + throw UnauthorizedException when target user vanished (redemption-gate lifecycle)" — same defensive branch, new semantics match §2.6. Result: `pnpm exec vitest run --project unit backend/src/nest/auth/auth.service.test.ts` → 75/75 passed. `--project permission` → 575/575 passed. `--project unit` (full) → 6767/6767 passed. Zero regressions outside the 4 repurposed tests.
- No NEW unit/API tests yet (Session 2 scope — ≥10 self-service + ≥7 admin-initiated).

**Deviations from v0.5.0 plan text:**

- 3 minor lint-driven refinements during implementation (documented in-code):
  1. `this.cls.get<string>(…)` → `this.cls.get<string | undefined>(…)` so the `?? 'unknown'` fall-back is type-honest (ESLint `no-unnecessary-condition`). No semantic change.
  2. Redemption-gate lifecycle check `targetUser === null || targetUser.is_active !== 1` → `targetUser?.is_active !== 1` (ESLint `prefer-optional-chain`). Identical semantics, one burn + one 401 for both conditions, no leak of which failed.
  3. Happy-path `const user = await this.findUserById(...); if (user !== null) { revoke... }` — the `if (user !== null)` gate was unnecessary: by the time we reach the happy path, the redemption-gate has already narrowed `targetUser` to a confirmed-active root, and `revokeAllUserTokensByUserId` takes `user_id: number` (not a user row). Inlined to a single `await this.revokeAllUserTokensByUserId(tokenRow.user_id)` — removes a dead null-check, no behaviour change.

No divergence from the plan's intent; every change is a lint-driven minor refinement over the plan's draft code, all covered by the plan's general rule "No `any`; `??` not `||`; explicit null checks; `import type` for type-only imports; `getErrorMessage()` for catches".

**Next session (1c):** Root-Initiated Reset backend. Phase 0 B-scope (read-only anchors for `UsersController` + `/manage-admins` + `/manage-employees`). Phase 1 migration `add-password-reset-initiated-by` (generator → backup → dry-run → apply → verify → customer-sync). Phase 2.7 `AuthService.sendAdminInitiatedResetLink()` + `UsersController.sendPasswordResetLink()` endpoint. Phase 2.8 `resetPassword()` origin-check branch with initiator-lifecycle validation. Phase 2.9 `MailerService.sendPasswordResetAdminInitiated()` + `password-reset-admin-initiated.html` template.

### Session 1c — 2026-04-21

**Goal:** Implement Root-Initiated Password-Reset-Link backend end-to-end — Phase 0 B-scope anchors, Phase 1 migration, Phase 2.7 endpoint + service, Phase 2.8 origin-check branch, Phase 2.9 mailer + template. Keep Session 1b self-service tests green.

**Result:** All 6 sub-phases shipped per plan. Migration applied as pgmigrations row #140; schema (`initiated_by_user_id integer` + FK `ON DELETE SET NULL`) verified; backend healthy post-restart. New Root-only endpoint `POST /api/v2/users/:id/send-password-reset-link` live — strict `@Roles('root')`, narrower than ADR-045 Layer-1 per §0.2.5 #13. Service logic split into 4 private helpers (`assertAdminInitiatedTargetAllowed`, `assertAdminInitiatedRateLimit`, `enforceRedemptionOriginGate`, `buildInitiatorName`) to keep both `resetPassword()` and `sendAdminInitiatedResetLink()` under the 60-line backend cap. Session 1b §2.6 self-service redemption-gate preserved — §2.8 wraps it in an origin-branch that only affects admin-initiated tokens.

**New files:**

- `database/migrations/20260420220236221_add-password-reset-initiated-by.ts` — generator-produced; `up()` adds nullable FK + `COMMENT ON COLUMN`, `down()` uses `DROP COLUMN IF EXISTS`.
- `backend/src/nest/auth/dto/send-password-reset-link.dto.ts` — `SendPasswordResetLinkResponse { readonly message: string }`.
- `backend/templates/email/password-reset-admin-initiated.html` — mirror of `password-reset.html` dark-mode MSO-style; CTA "Neues Passwort setzen"; names initiator explicitly.
- `database/backups/pre-initiated-by-20260421_000342.dump` — mandatory pg_dump (compressed, 2.9M).

**Changed files:**

- `backend/src/nest/auth/dto/index.ts` — barrel-exports `SendPasswordResetLinkResponse`.
- `backend/src/nest/auth/auth.service.ts` — imports `BadRequestException` + `HttpException` + `HttpStatus` + `SendPasswordResetLinkResponse`; new `sendAdminInitiatedResetLink()` + 4 helpers; `resetPassword()` SELECT carries `initiated_by_user_id`, origin-gate via `enforceRedemptionOriginGate()`.
- `backend/src/nest/users/users.controller.ts` — imports `AuthService` + `SendPasswordResetLinkResponse`; 6th constructor arg `authService`; new `POST /:id/send-password-reset-link` with `@Roles('root')`.
- `backend/src/nest/users/users.module.ts` — adds `AuthModule` import (no circular dep — auth/\* never references Users).
- `backend/src/nest/common/services/mailer.service.ts` — new public `sendPasswordResetAdminInitiated()` + private text-helper.
- `backend/src/nest/auth/auth.service.test.ts` — 4 resetPassword token-row mocks updated with `initiated_by_user_id: null` (§2.8 SELECT shape). No new test cases — those belong to Session 2.
- `database/seeds/001_global-seed-data.sql` + `customer/fresh-install/*` — regenerated via `./scripts/sync-customer-migrations.sh`.

**Verification:**

- ESLint: `auth/` + `users.controller.ts` + `users.module.ts` + `mailer.service.ts` — 0 errors (after extracting 3 helpers to stay under 60-line cap + collapsing initiator optional-chain).
- Type-check: `tsc --noEmit -p backend` + `-p backend/test` — both 0 errors.
- Unit tests: `vitest --project unit auth.service.test.ts` — 75/75. Full `--project unit` — 6767/6767 across 260 files. Zero regressions.
- Migration discipline: generator-only ✅; backup-first ✅; dry-run green ✅; apply ✅; `\d password_reset_tokens` verified; pgmigrations id=140 tracked; customer-sync COMPLETE.
- Backend boot: `doppler run -- docker-compose restart backend` → healthy; `curl /health` → `status: ok`.

**Deviations from v0.5.0 plan text:**

- Plan §2.7 `@Roles(UserRole.ROOT)` — `UserRole` is a type alias (not enum) from `@assixx/shared`. Used `@Roles('root')` to match existing codebase convention. Same RBAC outcome.
- Plan §2.7 service example used `findUserById(targetUserId)` without tenantId. Used `findUserById(targetUserId, initiator.tenantId)` — matches plan's own §0.1 intent ("RLS enforces same-tenant") and the Phase 4 API test expectation (cross-tenant → 404). Without tenantId the cross-tenant test would return 400, not 404.
- Plan §2.7 had `@UseGuards(JwtAuthGuard, RolesGuard)`. JwtAuthGuard + RolesGuard are registered globally via `APP_GUARD` in `app.module.ts:212` + `:217`. Per-route `@UseGuards(...)` would double-apply. Omitted to match the existing `users.controller.ts` convention (see `:497 @Roles('root')` with no `@UseGuards`). Same security outcome.
- Plan §2.7 had a ~90-line `sendAdminInitiatedResetLink` body. Split into 3 helpers + main method to satisfy ESLint `max-lines-per-function: 60` (ADR-041 / Power-of-Ten Rule 4). Semantics unchanged.
- Plan §2.8 inline origin-check was 28 lines inside `resetPassword()` (total 64 lines). Extracted into `enforceRedemptionOriginGate()` helper. Same semantics, same security properties.
- Plan §2.4 `isAuthEndpoint()` extension covers forgot-password + reset-password; the new admin-initiated route lives under `/users/:id/send-password-reset-link` (outside that filter). Left audit-interceptor alone — authenticated routes follow the standard auto-log path. Block-semantic context stays in `logger.warn()`. No Option B added — scope-consistent with Session 1b.

**Next session (2):** Unit tests (≥ 10 self-service + ≥ 7 admin-initiated = ~17) + API integration tests (≥ 8 self-service + ≥ 6 admin-initiated = ~14) + Frontend §5.1+§5.2 merge-not-replace for `/forgot-password` + §5.3 `/manage-admins` button + §5.4 `/manage-employees` button. Docker must stay up for API tests.

### Session 2 — 2026-04-21

**Goal:** Close Phases 3 + 4 + 5 in one pass. Tests cover the Session 1b + 1c backend end-to-end; frontend adds the blocked-UI branch on `/forgot-password` plus the Root-initiated buttons on `/manage-admins` + `/manage-employees`.

**Result:**

- **Phase 3 (unit tests)** — 22 new test cases added to `auth.service.test.ts`:
  - 6 in `forgotPassword` block (admin-block, employee-block, null-role R3 secure-default, CLS IP/UA propagation, CLS fallback "unknown", OAuth-only admin Known-Limitation-#8)
  - 2 in `resetPassword` self-service block (admin-target burn+403, employee-target burn+403)
  - 7 in NEW `sendAdminInitiatedResetLink` describe block (active-admin success + assertions on `initiated_by_user_id`, active-employee success, Root-on-Root INVALID_TARGET_ROLE, 3× `is_active ∈ {0,3,4}` INACTIVE_TARGET via `.each`, cross-tenant 404, 10-min-ago 429 RATE_LIMIT, 16-min-ago success)
  - 5 in NEW `resetPassword — admin-initiated (§2.8 origin-check)` describe block (happy-path bypasses §2.6 role-gate, FK-NULL ghost-initiator falls back to §2.6 → 403, initiator is_active=0 → 401+burn, initiator-demoted-to-admin → 401+burn, initiator tenant-drift → 401+burn)
  - Final: 97/97 pass (75 pre-session + 22 new).
- **Phase 4 (API integration tests)** — NEW `backend/test/auth-forgot-password.api.test.ts` (complements existing `auth-password-reset.api.test.ts` which covers the generic Root-happy-path):
  - §2.1 Request Gate (3): admin→blocked, employee→blocked, Root↔silent-drop byte-identical (R1)
  - §2.6 Redemption Gate (3): admin-token burn+403, employee-token burn+403, inactive-target burn+401
  - §2.7 Endpoint (7): Root→admin success + DB assertion on `initiated_by_user_id`, Root→employee success, Root→Root 400 INVALID_TARGET_ROLE, admin-caller 403, employee-caller 403, unauthenticated 401, 2nd-in-15-min 429 RATE_LIMIT
  - §2.8 Redemption (2): admin-initiated happy-path with password-actually-changed verification + login-with-new-password, ghost-initiator fallthrough to §2.6 → 403
  - Final: 15/15 pass; existing `auth-password-reset.api.test.ts` regressed green 16/16.
  - Fixture discovery: `admin@apitest.de` (id=1) is actually `role='root'` despite the email, `perm-test-admin@apitest.de` (id=13) is the real admin, `employee@apitest.de` (id=5) is the employee. All three use `APITEST_PASSWORD`. Cleanup uses `DELETE` (not `UPDATE used=true`) because the per-pair rate-limit reads `MAX(created_at)` regardless of `used`.
- **Phase 5 (frontend)** — 7 files changed:
  - `/forgot-password/+page.server.ts`: parses JSON response, returns `{ blocked: true, reason, email }` branch mutually exclusive with `{ success: true, email }`. Failed-parse falls through to success-branch (graceful degrade — no new error surface).
  - `/forgot-password/+page.svelte`: new `{#if form?.blocked}` branch BEFORE `{#if form?.success}`, "Passwort-Reset nicht erlaubt" copy pointing at Root-Benutzer, reuses existing `subtitle` + `success-actions` + `btn btn-index` primitives; existing toast-error + state (`email`/`loading`/`isEmailValid`) + spinner untouched (merge-not-replace per plan §5.2).
  - `/manage-admins/_lib/api.ts`: new `sendPasswordResetLink(userId)` wrapper on the shared `/users/:id/send-password-reset-link` endpoint.
  - `/manage-admins/_lib/constants.ts`: 7 new strings (BTN / CONFIRM / SUCCESS / 3× ERROR codes + GENERIC fallback) in `STATIC_MESSAGES` picked up by the `createMessages()` factory.
  - `/manage-admins/_lib/AdminFormModal.svelte`: new `resetLinkTarget?: { id; email }` prop, local `sendingResetLink` state, `handleSendResetLink()` with native confirm() + 3-code error-mapping (429 via `err.status`, INVALID_TARGET_ROLE / INACTIVE_TARGET via `err.code`). Button markup after `<AdminOrganizationSection>` only when prop is set.
  - `/manage-admins/+page.svelte`: invocation passes `resetLinkTarget = isEditMode && currentEditId !== null ? {id, email} : undefined` — no additional role-gate because `(root)` layout already restricts to Root viewers.
  - `/manage-employees/` — same 4-file pattern as §5.3. One non-trivial deviation: the route lives in `(shared)` (NOT `(root)` as the v0.5.0 plan-text assumed), so the `+page.svelte` invocation gates on `data.user?.role === 'root'` in addition to `isEditMode + currentEditId` to hide the button from admin viewers. Backend `@Roles('root')` is the authoritative check; the UI gate is polish.

**Service-fix triggered by Phase 4:**

The Phase 4 admin-target redemption test expected `body` to contain the string `'ROLE_NOT_ALLOWED'` per plan §2.2. The Session 1b implementation threw `new ForbiddenException('string-message')` which the global AllExceptionsFilter normalized to `{ error: { code: 'FORBIDDEN', message: '...' } }` — dropping the required `code: 'ROLE_NOT_ALLOWED'` marker. Fixed at `auth.service.ts:634-656` by switching to the object form `new ForbiddenException({ message, code: 'ROLE_NOT_ALLOWED' })` — matches the existing §2.7 pattern for `BadRequestException({message, code: 'INVALID_TARGET_ROLE'})`. Backend restarted (`docker-compose up -d --force-recreate backend` — WSL2 bind-mount staleness), tests green, 6789/6789 full unit-suite regression-clean.

**New files:**

- `backend/test/auth-forgot-password.api.test.ts` — 15 API integration tests for §2.1 / §2.6 / §2.7 / §2.8

**Changed files:**

- `backend/src/nest/auth/auth.service.ts` — §2.6 ForbiddenException object form for `code: 'ROLE_NOT_ALLOWED'`
- `backend/src/nest/auth/auth.service.test.ts` — +22 unit tests (97/97 green)
- `frontend/src/routes/forgot-password/+page.server.ts` — parse JSON, propagate blocked/reason via ActionData
- `frontend/src/routes/forgot-password/+page.svelte` — `{#if form?.blocked}` branch
- `frontend/src/routes/(app)/(root)/manage-admins/_lib/api.ts` — new `sendPasswordResetLink()`
- `frontend/src/routes/(app)/(root)/manage-admins/_lib/constants.ts` — 7 new strings
- `frontend/src/routes/(app)/(root)/manage-admins/_lib/AdminFormModal.svelte` — prop + state + handler + button
- `frontend/src/routes/(app)/(root)/manage-admins/+page.svelte` — `resetLinkTarget` invocation
- `frontend/src/routes/(app)/(shared)/manage-employees/_lib/api.ts` — new `sendPasswordResetLink()`
- `frontend/src/routes/(app)/(shared)/manage-employees/_lib/constants.ts` — 7 new strings
- `frontend/src/routes/(app)/(shared)/manage-employees/_lib/EmployeeFormModal.svelte` — prop + state + handler + button
- `frontend/src/routes/(app)/(shared)/manage-employees/+page.svelte` — `resetLinkTarget` invocation gated on `data.user?.role === 'root'`

**Verification:**

- `docker exec assixx-backend pnpm exec vitest run --project unit` → **6789/6789 passed**, 260 test files
- `pnpm exec vitest run --project api backend/test/auth-forgot-password.api.test.ts backend/test/auth-password-reset.api.test.ts` → **31/31 passed**
- `pnpm run type-check` (shared + frontend + backend + backend/test with svelte-kit sync) → **0 errors**
- `pnpm exec eslint` on all 3 modified frontend routes → **0 errors**
- `pnpm exec svelte-check` on all 3 modified frontend routes → **0 errors, 0 warnings**
- Backend restart post-service-fix: `curl /health` → `status: ok`

**Deviations from v0.5.0 plan text:**

1. `/manage-employees` lives in `(shared)`, not `(root)` — plan §5.4 assumed `(root)` based on the §5.3 mirror. The frontend adjusts by adding an explicit `data.user?.role === 'root'` gate at the modal-invocation level to hide the button from admin viewers; backend `@Roles('root')` remains the authoritative enforcement.
2. Service §2.6 `ForbiddenException(string)` → `ForbiddenException({message, code: 'ROLE_NOT_ALLOWED'})` to preserve the machine-readable code marker required by plan §2.2 — the global filter strips the default NestJS code otherwise. Session 1b text had the string-only form; Session 2 corrects it consistent with the §2.7 pattern already in place. 3-line diff, same semantics, now passes the §2.2 contract.
3. `auth-forgot-password.api.test.ts` is a NEW file complementing (not replacing) the existing `auth-password-reset.api.test.ts`. The existing file covered the Root-happy-path which still works unchanged; the new file adds the ADR-051-specific gate coverage (admin/employee block, redemption burn, Root-initiated endpoint). Keeps concerns separated and the existing file untouched.

**Next session (3):** Write ADR-051 (combined: self-service role-gate + Root-initiated reset, "Relationship to ADR-046" section acknowledging Microsoft OAuth as orthogonal path, "Sequencing after ADR-049" section). End-to-end smoke in dev + production profiles for all 6 flows (3 self-service paths × [root happy / admin blocked / silent-drop] + 3 admin-initiated paths × [Root→admin issue / admin clicks link / Root→Root rejected]). Update `FEATURES.md` security section. Plan version → 2.0.0.

---

## Quick Reference: File Paths

### Backend (new)

| File                                                          | Purpose                                                                                  |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `backend/templates/email/password-reset-blocked.html`         | Blocked-reset email template (self-service path, §2.3)                                   |
| `backend/templates/email/password-reset-admin-initiated.html` | **NEW v0.5.0** — Root-initiated reset email template (§2.9)                              |
| `backend/test/auth-forgot-password.api.test.ts`               | API integration tests (self-service + admin-initiated scenarios)                         |
| `backend/src/nest/auth/dto/send-password-reset-link.dto.ts`   | **NEW v0.5.0** — `SendPasswordResetLinkResponse` type (§2.7)                             |
| `database/migrations/<ts>_add-password-reset-initiated-by.ts` | **NEW v0.5.0** — adds `initiated_by_user_id` column to `password_reset_tokens` (Phase 1) |

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

| File                                                                                               | Change                                                                                              |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `frontend/src/routes/forgot-password/+page.server.ts`                                              | Action parses JSON, returns `blocked` / `reason` via `ActionData`                                   |
| `frontend/src/routes/forgot-password/+page.svelte`                                                 | Render alert depending on `form.blocked` / `form.success` / `form.missing`                          |
| `frontend/src/routes/(app)/(root)/manage-admins/+page.svelte`                                      | **NEW v0.5.0 §5.3** — button "Passwort-Reset-Link senden" in Edit-Modal Account-Section (Root-only) |
| `frontend/src/routes/(app)/(root)/manage-admins/_lib/api.ts`                                       | **NEW v0.5.0 §5.3** — `sendPasswordResetLink(userId)` wrapper                                       |
| `frontend/src/routes/(app)/(root)/manage-admins/_lib/constants.ts`                                 | **NEW v0.5.0 §5.3** — German strings for confirm-dialog + toast messages + error mapping            |
| `frontend/src/routes/(app)/(root)/manage-employees/+page.svelte` (path per Session-1c anchor)      | **NEW v0.5.0 §5.4** — identical button pattern as §5.3                                              |
| `frontend/src/routes/(app)/(root)/manage-employees/_lib/api.ts` (path per Session-1c anchor)       | **NEW v0.5.0 §5.4** — same wrapper function                                                         |
| `frontend/src/routes/(app)/(root)/manage-employees/_lib/constants.ts` (path per Session-1c anchor) | **NEW v0.5.0 §5.4** — same German strings                                                           |

### Database

**v0.5.0:** one migration added — `<ts>_add-password-reset-initiated-by.ts` adds `password_reset_tokens.initiated_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL`. No index on the new column (redemption path locates the token by its hash, which has its own unique constraint). No RLS changes (table is global per ADR-019 §7). No GRANT changes (base grant covers the new column). See Phase 1.

(v0.1.0's proposed audit-enum migration remains dropped — audit enum does not exist.)

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
| D11 | v0.3.0 R7 "OAuth has no code collision"                                                                                                                                                    | Correct for code-level, missed the architectural-bypass angle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | **v0.4.0 G3:** §0.2.5 #11 + ADR-051 "Relationship to ADR-046" acknowledge Microsoft OAuth as an orthogonal alternate-auth path for admin/employee.                                                                                                                                                                                                                                                           |
| D12 | v0.3.0 per-email throttle on `/reset-password`                                                                                                                                             | Body has no `email` field → tracker falls back to IP-only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | **v0.4.0 S3:** §0.2.5 #10 + §2.5 explicitly document request-gate-only scope; token-burn + TRUNCATE are compensating controls on redemption.                                                                                                                                                                                                                                                                 |
| D13 | v0.3.0 `cls.set('ip', req.ip)` assumed to return client IP                                                                                                                                 | Behind Nginx, Fastify returns Nginx IP unless `trustProxy: true` is set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | **v0.4.0 S5:** Phase 0 Step 0.1 adds `trustProxy` verification; Phase 2 configures it OR reads `X-Forwarded-For` manually in CLS setup. **v0.4.1 — verified: `main.ts:211` already has `trustProxy: true`**, Phase 2 DoD becomes a pure verification step.                                                                                                                                                   |
| D14 | v0.3.0/v0.4.0 planned `CustomThrottlerGuard.getTracker(req, throttlerName?)` override to differentiate `auth-email` vs `auth-ip`                                                           | `@nestjs/throttler@6.5.0` invokes `getTracker(req, context: ExecutionContext)` — 2nd arg is NEVER a throttler-name string. Override would compile but the `throttlerName === 'auth-email'` branch is unreachable dead code. Verified against compiled `throttler.guard.js canActivate()` and `throttler.decorator.js setThrottlerMetadata()`.                                                                                                                                                                                                                                              | **v0.4.1 T1/T2:** §2.5 rewritten. Per-tier `getTracker` closures live in `Throttle({ 'auth-email': { getTracker: authEmailTracker } })` decorator metadata, which the base-guard resolution prefers over the class default. `CustomThrottlerGuard` stays untouched.                                                                                                                                          |
| D15 | v0.4.1 `authEmailTracker` returned `ip:${ip}:email:${digest}` (IP prefix included)                                                                                                         | R6 + §0.2.5 #10 + Phase 4 test all require per-email throttle to hold ACROSS different IPs. With IP in the key, each rotated IP gets a fresh counter → cross-IP flood trivially bypasses the cap → Phase 4 "2nd request for same email from different IPs within 5 min → 429" fails. Internal contradiction between code and stated mitigation.                                                                                                                                                                                                                                            | **v0.4.2:** `authEmailTracker` returns pure `email:${digest}` when email is present. IP-only fallback kept for `/reset-password` (no email in body). §0.2.5 #10 description aligned. The `auth-ip` tier continues to enforce per-IP limits independently — the two tiers are now properly orthogonal controls.                                                                                               |
| D16 | v0.4.1 §0.1 claim "`TRUNCATE tenants CASCADE` will fail unless tokens are wiped first; deploy runs BEFORE any tokens exist"                                                                | PG TRUNCATE CASCADE propagates explicitly to ALL FK-referencing tables regardless of FK action (`ON DELETE RESTRICT` only gates DELETE). No preparation needed — the CASCADE transitively wipes `users` → `password_reset_tokens`. "Deploy before tokens exist" was wrong for dev too (live DB had 122 reset-token rows at 2026-04-17).                                                                                                                                                                                                                                                    | **v0.4.2:** §0.1 prose corrected — TRUNCATE CASCADE handles reset-tokens as a side-effect; operational outcome unchanged, doc accuracy restored.                                                                                                                                                                                                                                                             |
| D17 | v0.4.1 didn't address OAuth-only roots hitting `/auth/forgot-password`                                                                                                                     | ADR-046 may leave `users.password` as a placeholder (e.g. `'OAUTH'`) for accounts that never set a local credential. The plan's happy path treats them as regular roots and issues a reset link → redemption creates a real bcrypt hash. Could be either a legitimate local-password fallback (user lost Microsoft access) or a subtle credential-duplication quirk. Prior plan didn't name the behaviour.                                                                                                                                                                                 | **v0.4.2:** Known Limitation #10 added. V1 ships without special-casing; Phase 0 to confirm placeholder convention + whether ADR-046 prescribes a different self-service path. V2 could branch the template wording or short-circuit for OAuth-only users.                                                                                                                                                   |
| D18 | v0.4.1/v0.4.2 carried Per-Email-Throttle, Clean-Break Response, and TRUNCATE deploy-step as mandatory v1 items — items that grew out of iterative security reviews, not core-goal analysis | (1) Per-Email-Throttle addresses an unreported threat (cross-IP email flood) and shipped bugs in both v0.4.1 (phantom `throttlerName` arg) and v0.4.2 (`authEmailTracker` IP-prefix defeated R6). (2) Clean-Break Response was self-inflicted — misreading of user rule "no backward-compat in dev"; additive response achieves the same outcome for blocked users with zero DTO migration. (3) TRUNCATE's sole justification was Clean-Break's claimed token-incompatibility — collapses with additive (tokens stay valid, redemption gate burns admin/employee tokens on first attempt). | **v0.4.3 Staff-Engineer Scope-Re-Cut:** all three items dropped. Plan: 4+0.3 → 3 Sessions. Tests: 15+14 → 10+8. No new throttler/decorator/module files, no DDL deploy-step. Security goal unchanged — redemption gate + role-check intact; IP-throttle (10/5min via existing `@AuthThrottle()`) covers rate-limit. If distributed-IP email-flood becomes a real operational concern → v2 single-day sprint. |

---

## Known Limitations (V1 — deliberately excluded)

1. **Tenant domain verification** — orthogonal Break-Glass structural solution. Tracked in `FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md` (ADR-049). This plan ships AFTER Plan 2.
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
      **V1 decision: no special-casing.** `forgotPassword` / `resetPassword` stay oblivious to the `password = 'OAUTH'` placeholder. Phase 0 should confirm the placeholder convention (if any) and whether ADR-046 prescribes a different self-service path for OAuth-only roots; if so, branch the decision in ADR-051. V2 could short-circuit the happy path for OAuth-only users with a dedicated German template pointing them back to Microsoft sign-in.

---

## Post-Mortem (fill after completion)

### What went well

- (tbd)

### What went badly

- (tbd)

### Metrics

| Metric                   | Planned (v0.5.0)                                                                                                                                                                                         | Actual |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Sessions                 | 4 (1a DONE + 1b self-service + 1c admin-initiated + 2 tests+FE + 3 ADR+smoke)                                                                                                                            |        |
| Migration files          | 1 (`add-password-reset-initiated-by`)                                                                                                                                                                    |        |
| New backend files        | 3 (2 templates + 1 DTO file)                                                                                                                                                                             |        |
| New frontend files       | 0 (buttons added to existing manage-admins + manage-employees pages; `_lib/` files may exist already — additive)                                                                                         |        |
| Changed files            | ~10–12 (auth.service.ts, auth.controller.ts, users.controller.ts, mailer.service.ts, app.module.ts, audit.helpers.ts, 2 DTO barrels, forgot-password FE x2, manage-admins FE x3, manage-employees FE x3) |        |
| Unit tests               | ~17 (10 self-service + 7 admin-initiated)                                                                                                                                                                |        |
| API tests                | ~14 (8 self-service + 6 admin-initiated)                                                                                                                                                                 |        |
| ESLint errors at release | 0                                                                                                                                                                                                        |        |
| Spec deviations          | 18 (listed) + future v0.5.0 deviations as they surface                                                                                                                                                   |        |

---

**This document is the execution plan. Every session starts here, takes the next unchecked item, and marks it done. No coding starts before Phase 0 is green.**
