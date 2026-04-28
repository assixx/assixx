# FEAT: 2FA Email-Only Mandatory Authentication — Execution Masterplan

> **Plan type:** FEATURE
> **Created:** 2026-04-26
> **Version:** 0.3.1 (ACCEPTED — alphanumeric Crockford-Base32 code format adopted)
> **Status:** ACCEPTED — Implementation Ready (Phase 0.5 + Phase 1 may begin)
> **Branch:** `feat/2fa-email`
> **Spec:** This document
> **Author:** Claude (proposed) · Simon Öztürk (decides)
> **Estimated sessions:** 14
> **Actual sessions:** 0 / 14
> **External dependencies added:** **ZERO** — every primitive (crypto, JWT, Redis via `ioredis`, legacy `email-service`, `CustomThrottlerGuard`, Zod, `audit_trail`) already exists.

---

## Goal

Mandatory **email-based 2FA** at every password authentication entry point. Same code path for every password user, every login, every signup. No opt-out, no "trust this device", no SMS, no TOTP, no authenticator app.

**Three covered scenarios** (per user requirement):

1. **Signup (password path)** — new user submits credentials → user row created with `is_active = 0` (pending) → 6-digit code emailed → user enters code → `is_active = 1`, `tfa_enrolled_at = NOW()`, tokens issued.
2. **Login (password path, every user, every session)** — credentials accepted → 6-digit code emailed → user enters code → access + refresh tokens issued. No skip, no remember-device.
3. **Mandatory** — server-enforced. `FEATURE_2FA_EMAIL_ENFORCED` env flag exists only for emergency rollback (DD-10).

**OAuth (Microsoft/Google) is exempt** — DD-7 decision: OAuth providers already enforce MFA upstream. `loginWithVerifiedUser()` (`auth.service.ts:247`) bypasses the 2FA layer with an explicit DD-7 comment.

---

## Changelog

| Version | Date       | Change                                                                                                                                                                                                                                                                                                              |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-04-26 | Initial draft — full plan outlined, awaiting design-decision sign-off                                                                                                                                                                                                                                               |
| 0.2.0   | 2026-04-26 | Codebase audit corrections: ADR number, file paths, throttler pattern, audit format, Redis pattern, OAuth exempt, no-recovery policy, signup form-action, drop legacy 2FA columns, drop partial index                                                                                                               |
| 0.3.0   | 2026-04-26 | All 17 pending DDs APPROVED. DD-14 extended: cleanup deletes tenant + user (anti subdomain-squatting). New Phase 0.5 "Operational Prerequisites" (single-root detection, SMTP domain auth, external-API audit, subdomain-handoff verification). New Phase 2 step 2.11: stale-pending reaper cron. Status: ACCEPTED. |
| 0.3.1   | 2026-04-28 | DD-1 / DD-12 / DD-17 patched: code format changed from 6-digit numeric → 6-char alphanumeric uppercase, Crockford-Base32 subset (`A-HJKMNP-Z2-9`, 31 chars, ~887M permutations). R2 keyspace ~887× larger → probability lowered Medium → Low. DTO regex, generator, frontend `pattern`/`inputmode` updated. Phase 3+4 tests gain alphabet-conformance + lowercase-normalisation bullets. Status: ACCEPTED. |

> **Versioning rule:** 0.x.0 = planning · 1.x.0 = implementation in progress · 2.0.0 = shipped · x.x.1 = patch within phase.

---

## Out of scope (V1)

| Feature                                    | Why excluded                                                                                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TOTP / authenticator app                   | User requirement: email only                                                                                                                               |
| Backup recovery codes (printable)          | **No in-app recovery in V1.** Business model = corporate-email-only customers; lost mailbox is a company-IT issue, not Assixx. See "Known Limitations" §1. |
| "Trust this device for N days"             | User requirement: every login = 2FA                                                                                                                        |
| SMS / phone codes                          | Email only                                                                                                                                                 |
| WebAuthn / FIDO2 / hardware tokens         | Out of scope                                                                                                                                               |
| Per-user "skip 2FA" toggle                 | Mandatory by definition                                                                                                                                    |
| Per-tenant pilot rollout                   | Single global env flag for V1; per-tenant flag is V2 if needed                                                                                             |
| Self-service email change protected by 2FA | Existing email-change flow stays as-is                                                                                                                     |
| OAuth (Microsoft/Google) email 2FA         | Exempt per DD-7. OAuth providers already enforce MFA upstream.                                                                                             |
| Forgot-password 2FA interaction            | ADR-051 reset flow does NOT auto-login — user goes through `/login` afterwards, where 2FA naturally kicks in. No new wiring needed.                        |
| In-app 2FA bypass / recovery               | **Lockout-clear endpoint exists but is NOT a 2FA bypass** — see DD-8.                                                                                      |

---

## Scope-creep notice (transparent to reviewer)

This plan introduces **two distinct features** under one umbrella:

1. **First-ever email-ownership verification at password signup.** No existing flow proves the email belongs to the signer for password signups (only OAuth providers asserted `email_verified` until now — confirmed by codebase audit).
2. **Per-login email re-verification.** This is the "2FA" part proper.

Both are wanted per the user requirement "all three scenarios". They share the same code path (challenge issue → email → verify), so the umbrella is correct. Just calling it out so reviewers know what they're approving.

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must be true before starting

- [ ] Docker stack running, all containers healthy
- [ ] DB backup taken: `database/backups/pre-2fa-{timestamp}.dump`
- [ ] Branch `feat/2fa-email` checked out from `main`
- [ ] No pending migrations
- [ ] Redis reachable (already required for sessions / rate limit)
- [ ] `email-service.ts` (`backend/src/utils/email-service.ts`) confirmed working in current env (Doppler `SMTP_*` secrets present, including new `SMTP_FROM` per §2.9)
- [ ] §0.4 Critical Design Decisions approved by user
- [ ] Pre-deploy email drafted to all tenants (operational rollout)

### 0.2 Risk register

| #   | Risk                                                                                  | Impact | Probability | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Verification                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------- | ------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | User loses access to email → cannot log in                                            | High   | Medium      | **No in-app recovery (per business model)**. Documented runbook tells the user's company IT to restore mailbox access first. Lockout-clear endpoint (DD-8) only resets the 5-wrong-codes lockout, not the 2FA requirement.                                                                                                                                                                                                                                                                                                                                            | Manual: trigger lockout, root clears it, user retries with code                                                                                                                                                                                                        |
| R2  | Brute-force on 6-char alphanumeric code (~887 M combinations, Crockford-Base32 subset, v0.3.1) | High   | Low         | Max 5 attempts per challenge → ForbiddenException + 15-min user lockout. Code TTL 10 min. Throttler tiers `2fa-verify` (5 req / 10 min) per challenge token. Keyspace is ~887× larger than v0.3.0 numeric — brute-force probability of success across one challenge × 5 attempts ≈ 5.6 × 10⁻⁹.                                                                                                                                                                                                                                                                                                          | Unit test: 6 wrong codes → ForbiddenException + lockout flag. Generator output stays in alphabet over 10 000 samples.                                                                                                                                              |
| R3  | Email delivery failure / latency > 60 s                                               | High   | High        | **Send awaited (synchronous)**, on failure return 503 (DD-14). UI shows spam-folder hint + Resend (60 s cooldown). Sentry alert on SMTP failure rate.                                                                                                                                                                                                                                                                                                                                                                                                                 | Manual: kill SMTP → graceful 503, no 500                                                                                                                                                                                                                               |
| R4  | (Resolved by DD-7 = exempt OAuth)                                                     | —      | —           | OAuth users skip the 2FA layer; uniform email-2FA only on password paths.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Code path audit: `loginWithVerifiedUser()` → no challenge issued                                                                                                                                                                                                       |
| R5  | Existing-user impact: every active user forced into 2FA on next login                 | Medium | Certain     | One-pager email to all tenants 7 days before flag flip. Soft-rollout flag (`FEATURE_2FA_EMAIL_ENFORCED`) — flip to disable instantly without code revert.                                                                                                                                                                                                                                                                                                                                                                                                             | Manual: deploy with flag OFF → no 2FA prompt                                                                                                                                                                                                                           |
| R6  | Code interception via email TLS / mail-server archives                                | Medium | Low         | 10-min TTL · single-use · hashed at rest in Redis (`sha256(userId:code:purpose)`) · email body warns "do not share" · subject is generic (DD-13)                                                                                                                                                                                                                                                                                                                                                                                                                      | Read Redis → only hashes visible                                                                                                                                                                                                                                       |
| R7  | Race: user requests two codes in parallel — both valid                                | Medium | Medium      | Single Redis key per challenge — `SET` overwrites previous code. Resend updates same record + extends TTL.                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Unit test: two consecutive `requestCode()` → only second works                                                                                                                                                                                                         |
| R8  | Challenge-token theft (XSS / network) → attacker bypasses password gate               | High   | Low         | Challenge token = opaque `crypto.randomBytes(32).toString('base64url')`, single-use (DEL on consume), 10-min Redis TTL, transmitted via httpOnly+Secure+SameSite=Lax cookie.                                                                                                                                                                                                                                                                                                                                                                                          | Unit test: reuse consumed challenge → 401                                                                                                                                                                                                                              |
| R9  | Sensitive data in logs (codes, tokens)                                                | High   | Medium      | Pino redaction extended in `logger.constants.ts` (`code`, `challengeToken`). Generic error messages (no "expected vs got").                                                                                                                                                                                                                                                                                                                                                                                                                                           | Grep production-shape logs for known test code → no match                                                                                                                                                                                                              |
| R10 | User enumeration via timing on `/verify` (different response time for valid user)     | Low    | Low         | If user not found, run dummy `crypto.timingSafeEqual` against random hash. Same response shape success/fail. Same code path duration.                                                                                                                                                                                                                                                                                                                                                                                                                                 | Time 1 000 requests valid vs invalid → no statistical signal                                                                                                                                                                                                           |
| R11 | Doppler secrets missing in production (SMTP_HOST etc.)                                | High   | Low         | `AppConfigService` Zod env schema fails fast at startup if `SMTP_HOST/USER/PASS/FROM` missing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Deploy with secret missing → fast crash, not silent 500                                                                                                                                                                                                                |
| R12 | Initial root user (very first install) cannot complete 2FA — no email yet             | High   | Low         | First root signup uses 2FA flow against the email entered during install. Documented in DOCKER-SETUP.md.                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Fresh-install smoke test                                                                                                                                                                                                                                               |
| R13 | Mobile / external API client breaks because login response shape changed              | High   | Medium      | Discriminated-union response — old shape only when feature flag OFF. Phase 0 audits external consumers. Versioned client SDK (if any).                                                                                                                                                                                                                                                                                                                                                                                                                                | Audit task in Phase 0                                                                                                                                                                                                                                                  |
| R14 | Cross-subdomain cookie scope mismatch (apex vs tenant subdomain) for challenge cookie | Medium | Medium      | **Login** lives on tenant subdomain (`<tenant>.assixx.com/login` per ADR-050). Challenge cookie set + verified on same origin → no cross-domain traversal. **Signup** lives on apex (`www.assixx.com/signup`). Challenge cookie set + verified on apex; **after** 2FA success, mint a connection-ticket (existing `connection-ticket.service.ts` pattern from ADR-050 / oauth-handoff) and redirect to `<tenant>.assixx.com/handoff?ticket=…` so the access-token cookie lands on the tenant subdomain. Reuses the proven apex→subdomain bridge — zero new mechanism. | Manual login: `<tenant>.assixx.com/login` → verify on `<tenant>.assixx.com/login/verify` → tokens on tenant. Manual signup: `www.assixx.com/signup` → verify on `www.assixx.com/signup/verify` → handoff to `<tenant>.assixx.com/handoff?ticket=…` → tokens on tenant. |

> **Rule:** every risk has a concrete mitigation AND a verification. "Be careful" is not a mitigation. "Should be fine" is not a verification.

### 0.3 Ecosystem integration points

| Existing system                                                        | Integration                                                                                                                   | Phase | Verified on |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----- | ----------- |
| `audit_trail` (ADR-009)                                                | New `(action, resource_type)` tuples — see §A8 audit-format table below                                                       | 2     |             |
| Legacy `email-service.ts` (`backend/src/utils/email-service.ts`)       | Add `send2faCode(to, code, purpose, ttlMin)` exported function + new German template                                          | 2     |             |
| Redis (via `ioredis`, DI provider per existing pattern)                | New key prefixes: `2fa:challenge:{token}`, `2fa:lock:{userId}`, `2fa:fail-streak:{userId}`, `2fa:resend:{token}`              | 2     |             |
| `AppThrottlerModule` (`throttler.module.ts`)                           | Two new tiers `2fa-verify` (5/10min) and `2fa-resend` (1/60s); custom decorators added to `throttle.decorators.ts`            | 2     |             |
| `AuthService.login()` (`auth.service.ts:184`)                          | Modified — returns discriminated union (`stage: 'challenge_required' \| 'authenticated'`)                                     | 2     |             |
| `AuthService.loginWithVerifiedUser()` (`auth.service.ts:247`)          | **Unchanged** per DD-7 (OAuth exempt). Add explanatory comment referencing DD-7.                                              | 2     |             |
| `SignupService.signup()` (`backend/src/nest/signup/signup.service.ts`) | Modified — creates user with `is_active = IS_ACTIVE.INACTIVE`, issues challenge instead of tokens                             | 2     |             |
| OAuth flow (`auth/oauth/`, ADR-046)                                    | **No change** — DD-7 exempt                                                                                                   | —     |             |
| `users` table                                                          | (a) **DROP** legacy `two_factor_secret`, `two_factor_enabled` columns. (b) **ADD** `tfa_enrolled_at`, `last_2fa_verified_at`. | 1     |             |
| `JwtAuthGuard` (ADR-005)                                               | **No changes** — challenge token is separate from access JWT, runs before guard chain                                         | —     |             |
| Frontend `(public)/login/+page.server.ts`                              | Modified — handle `stage` discriminator, set httpOnly challenge cookie, redirect to `/login/verify`                           | 5     |             |
| Frontend `(public)/signup/` (NEW `+page.server.ts`)                    | Add form action (does not exist today). Same discriminator handling as login.                                                 | 5     |             |
| Sentry / Grafana (ADR-002)                                             | New alert: SMTP failure rate > 5 % over 5 min · panel: 2FA verify success/fail rate                                           | 6     |             |
| Pino logger config                                                     | Redaction list in `logger.constants.ts` adds `code`, `challengeToken`                                                         | 2     |             |
| `AppConfigService` (`config/config.service.ts`)                        | Zod `EnvSchema` extended: `FEATURE_2FA_EMAIL_ENFORCED: z.coerce.boolean().default(false)`, `SMTP_FROM: z.string().min(1)`     | 2     |             |
| `docs/ARCHITECTURE.md` §1.2                                            | Add 2FA row to Auth & Permissions table                                                                                       | 6     |             |

#### A8: Audit `(action, resource_type)` tuples

`audit_trail.action VARCHAR(50)` is a flat verb (`create`, `delete`, `login`, etc.) per existing convention — dotted strings like `2fa.code.issued` violate the schema. Encoded as tuples:

| Event                                                        | action   | resource_type   | status    | changes (JSONB)                             |
| ------------------------------------------------------------ | -------- | --------------- | --------- | ------------------------------------------- |
| code issued (login/signup)                                   | `create` | `2fa-challenge` | `success` | `{ purpose: 'login' \| 'signup' }`          |
| code resent                                                  | `create` | `2fa-challenge` | `success` | `{ purpose, kind: 'resend' }`               |
| verify success                                               | `login`  | `auth`          | `success` | `{ method: '2fa-email' }`                   |
| verify fail (wrong code)                                     | `login`  | `auth`          | `failure` | `{ reason: 'wrong-code', attempt: N }`      |
| verify fail (expired)                                        | `login`  | `auth`          | `failure` | `{ reason: 'expired-challenge' }`           |
| lockout triggered                                            | `update` | `2fa-lockout`   | `success` | `{ reason: 'max-attempts' }`                |
| lockout cleared (root)                                       | `delete` | `2fa-lockout`   | `success` | `{ clearedBy: rootUserId, target: userId }` |
| (no separate "reset" event — the lockout-clear IS the reset) | —        | —               | —         | —                                           |

### 0.4 Critical Design Decisions

> **All 21 DDs APPROVED on 2026-04-26.** Sign-off complete; implementation may begin after Phase 0.5 (Operational Prerequisites) is satisfied.

| #     | Decision                                            | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Rationale                                                                                                                                                                                                   | Status       |
| ----- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| DD-1  | Code format                                         | **6 characters, uppercase alphanumeric, Crockford-Base32 subset.** Alphabet `A-HJKMNP-Z2-9` = `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (31 chars; excludes confusables `0/1/I/L/O`). Code regex `/^[A-HJKMNP-Z2-9]{6}$/`. Lowercase input is auto-normalised to uppercase server-side. (v0.3.1, was 6-digit numeric `100000–999999`.) | ~887 M permutations (vs. 1 M numeric) — brute-force essentially impossible with rate limit + 10-min TTL. NIST 800-63B AAL1+. Mobile-typeable, no `0`-vs-`O` / `1`-vs-`I/L` support tickets in factory environments with dirty/glare-prone screens. | **APPROVED** (v0.3.1) |
| DD-2  | Code TTL                                            | 10 minutes                                                                                                                                                                                                                                                                                                                                                                                                                                                          | NIST recommends ≤10 min. Balance of user leeway and attack window.                                                                                                                                          | **APPROVED** |
| DD-3  | Storage of code                                     | Redis only. Stored as `sha256(userId + ':' + code + ':' + purpose)` embedded in challenge record (single Redis read on verify).                                                                                                                                                                                                                                                                                                                                     | Auto-expiry · defense-in-depth at rest · zero DB bloat · single round-trip                                                                                                                                  | **APPROVED** |
| DD-4  | Challenge token format                              | Opaque `crypto.randomBytes(32).toString('base64url')` (not JWT). Looked up via Redis.                                                                                                                                                                                                                                                                                                                                                                               | Single source of truth. Trivial to revoke (DEL). No JWT-secret coupling. Smaller payload than JWT.                                                                                                          | **APPROVED** |
| DD-5  | Max verification attempts per challenge             | 5                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | After 5 wrong codes → 15-min user lockout + audit + suspicious-activity email                                                                                                                               | **APPROVED** |
| DD-6  | Lockout duration                                    | 15 minutes (per user, not per challenge)                                                                                                                                                                                                                                                                                                                                                                                                                            | Long enough to deter automation, short enough to avoid total denial-of-service                                                                                                                              | **APPROVED** |
| DD-7  | OAuth users (Microsoft/Google) — enforce email 2FA? | **Exempt.** `loginWithVerifiedUser()` skips the challenge step.                                                                                                                                                                                                                                                                                                                                                                                                     | OAuth providers already enforce MFA. Uniform UX cost outweighs marginal security gain. Decided 2026-04-26.                                                                                                  | **APPROVED** |
| DD-8  | Recovery for users who lost email access            | **No in-app recovery.** Lost-mailbox = company-IT problem (corporate email assumption). The `POST /users/:id/2fa/clear-lockout` endpoint clears ONLY the 15-min lockout from 5 wrong attempts — it does NOT bypass 2FA. Two-root rule applies. Audit-logged.                                                                                                                                                                                                        | Customers are companies with managed corporate email. If a user loses mailbox access, IT restores it; we don't ship recovery codes. Decided 2026-04-26.                                                     | **APPROVED** |
| DD-9  | Resend cooldown + TTL behavior                      | 60 seconds between resends (per challenge token). Resend **extends** challenge TTL back to 10 min (PEXPIRE) and resets per-challenge attempt count to 0. Per-user fail-streak (24 h) is NOT reset by resend.                                                                                                                                                                                                                                                        | Friendlier UX (don't punish the legitimate user whose first email was slow). Per-user fail-streak still catches genuine brute-force.                                                                        | **APPROVED** |
| DD-10 | Soft-rollout feature flag                           | `FEATURE_2FA_EMAIL_ENFORCED=true` (default `false` until cut-over date). Flip via env var, no code change. Wired through `AppConfigService` Zod env schema.                                                                                                                                                                                                                                                                                                         | Allows production deploy without forcing 2FA immediately. Emergency-disable possible.                                                                                                                       | **APPROVED** |
| DD-11 | Existing users — first 2FA on next login            | Transparent enrollment. Any user without `tfa_enrolled_at` who logs in post-flip goes through the same flow → on first success, set `tfa_enrolled_at = NOW()`.                                                                                                                                                                                                                                                                                                      | No bulk migration. Existing email is implicitly trusted (verified at signup once we ship this).                                                                                                             | **APPROVED** |
| DD-12 | Code generator                                      | **Loop 6× over `crypto.randomInt(0, 31)` indexing into 31-char alphabet** `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (Node `crypto` module). v0.3.1: was `crypto.randomInt(100000, 1000000)`.                                                                                                                                                                                                                                                                                                                                                                                                          | Cryptographically secure (Node `crypto`). Never `Math.random`. `crypto.randomInt(0, 31)` is rejection-sampled internally — uniform over alphabet, no modulo bias.                                                                                                                                                              | **APPROVED** |
| DD-13 | Email subject + sender                              | **Generic subject only.** Subject: "Ihr Bestätigungscode für Assixx". Code in body only. Sender: `noreply@<tenant-domain>` with fallback `noreply@assixx.de` (from `SMTP_FROM`).                                                                                                                                                                                                                                                                                    | Code never visible in mail-list previews, lock-screen banners, or screenshots. Marginal UX cost (one click to read code) accepted. Decided 2026-04-26.                                                      | **APPROVED** |
| DD-14 | Behavior on email send failure                      | Login: 503 with retryable error. Signup: 503 + cleanup deletes **both `users` AND `tenants` row** in the same transaction (anti subdomain-squatting — without tenant cleanup, an attacker could squat any premium subdomain by signup + tab-close). Tenant cleanup conditional: only if no other users exist for that tenant (defensive — should always be true at this stage). UI: "Der Code konnte nicht gesendet werden — bitte erneut versuchen." Sentry alert. | Fail-loud. Don't silently degrade. Tenant-cleanup added 2026-04-26 to prevent subdomain-squatting attack vector identified during plan review.                                                              | **APPROVED** |
| DD-15 | New columns on `users` (vs new table)               | (a) DROP legacy `two_factor_secret`, `two_factor_enabled`. (b) ADD `tfa_enrolled_at TIMESTAMPTZ NULL`, `last_2fa_verified_at TIMESTAMPTZ NULL`. No new table.                                                                                                                                                                                                                                                                                                       | KISS. Legacy columns are dead schema (zero references in code, confirmed by audit). V2 (backup codes / trusted devices) gets a separate table when needed.                                                  | **APPROVED** |
| DD-16 | Audit-log destination                               | Existing partitioned `audit_trail` table (ADR-009). Tuples per §A8 (NOT dotted strings).                                                                                                                                                                                                                                                                                                                                                                            | Consistent with all other security events. Schema-correct.                                                                                                                                                  | **APPROVED** |
| DD-17 | Frontend code-input UX                              | Single `<input type="text" inputmode="text" autocapitalize="characters" autocomplete="one-time-code" maxlength="6" pattern="[A-HJKMNP-Z2-9]{6}">`. Auto-submit on 6th character ON by default (no feature flag). Lowercase input is auto-uppercased server-side via `z.string().trim().toUpperCase().regex(...)`. v0.3.1: changed `inputmode="numeric"`→`text` + added `autocapitalize`/`pattern`.                                                                                                                                                                                                                                                                                                              | iOS Safari + Android Chrome auto-suggest from email — `one-time-code` works for alphanumeric per WHATWG HTML spec. `autocapitalize="characters"` reduces typing friction on mobile. Trade-off: auto-fill heuristic ~5–10 % less reliable than pure-digit codes.                                                                         | **APPROVED** |
| DD-18 | Pino redaction additions                            | Add `req.body.code`, `req.body.challengeToken`, `*.code`, `*.challengeToken` to `LOGGER_REDACT_PATHS` in `logger.constants.ts`.                                                                                                                                                                                                                                                                                                                                     | Defense-in-depth — codes never in logs even on error                                                                                                                                                        | **APPROVED** |
| DD-19 | Frontend signup form pattern                        | **Add `+page.server.ts` form action** (currently signup posts client-side via `_lib/api.ts`). Server-side `cookies.set(challengeToken, …)` + `redirect(303, '/signup/verify')`. Match login pattern.                                                                                                                                                                                                                                                                | Cleanest separation of secrets from JS. Aligned with ADR-012 fail-closed pattern + CODE-OF-CONDUCT-SVELTE Form Actions. Heavier refactor accepted: "no quick ship, must be ordentlich". Decided 2026-04-26. | **APPROVED** |
| DD-20 | Suspicious-activity email recipients                | **User only** (the locked-out account). No tenant-admin notification in V1 — would create a side channel for user-enumeration ("did the admin get an email about user X?").                                                                                                                                                                                                                                                                                         | Minimize side channels. V2 may add opt-in tenant-admin notification.                                                                                                                                        | **APPROVED** |
| DD-21 | Per-challenge resend cap                            | `MAX_RESENDS_PER_CHALLENGE = 3`. After 3 resends on the same challenge token → 429 ConflictException, user must restart from `/login` (new challenge).                                                                                                                                                                                                                                                                                                              | Prevents SMTP spam-trap impact. 3 resends within a 10-min window is enough for genuine retry.                                                                                                               | **APPROVED** |

> **Sign-off complete (2026-04-26):** all 21 DDs APPROVED.
> **v0.3.1 patch (2026-04-28):** DD-1 / DD-12 / DD-17 modified to adopt 6-char alphanumeric Crockford-Base32 subset (`A-HJKMNP-Z2-9`, 31 chars, ~887 M permutations). R2 risk lowered Medium → Low. Plan stays ACCEPTED. Phase 1 may begin after Phase 0.5 (Operational Prerequisites) is satisfied.

---

## Phase 0: Audit & Sign-off

### Step 0.1: External-API consumer audit [DONE — 2026-04-28]

**Goal:** identify any non-browser client (mobile, CLI, partner integration) that calls `/api/v2/auth/login` and currently expects the old response shape (`{ accessToken, refreshToken, user }`).

**Procedure:**

1. `git log --all --diff-filter=A -- '**/api*'` — find external consumer code in this repo.
2. Check `backend/src/nest/auth/auth.controller.ts:296` (`@Post('login')`) for `@ApiTags`/Swagger annotations that hint at external clients.
3. Document findings in §Spec Deviations. If external clients exist, plan a versioned response or feature-flag default-OFF in production.

**Deliverable:** one-paragraph audit note added to this masterplan under "Spec Deviations" before Phase 2.

### Step 0.2: All DDs approved [DONE — 2026-04-26]

All 21 DDs APPROVED on 2026-04-26 — see §0.4 table.

### Step 0.3: Pre-deploy email drafted [PENDING]

7-day-warning email to all tenants explaining the change.

### Phase 0 — Definition of Done

- [x] External-consumer audit completed and findings recorded (2026-04-28 — see §Spec Deviations)
- [x] All 21 DDs APPROVED (2026-04-26)
- [ ] Pre-deploy email drafted, queued
- [ ] User confirms readiness to start Phase 0.5 → Phase 1

---

## Phase 0.5: Operational Prerequisites

> Operational concerns that block production cut-over but **do not block code-level Phase 1/2/3 work**. Each item has an owner, a verification, and a deadline relative to cut-over (T-Day = flag-flip day).

### Step 0.5.1: Single-Root-Tenant Detection + Mitigation [PENDING]

**Why:** DD-8 (no in-app recovery) + DD-5 (5 wrong codes → lockout) + Two-Root-Rule (lockout-clear caller ≠ target) means a tenant with exactly **one** root user who self-locks-out has **zero recovery path** without engineering intervention.

**Procedure:**

1. **Detection query** (run T-14 days, repeat T-7 + T-1):

   ```sql
   -- Tenants with only ONE active root user (run as sys_user, BYPASSRLS)
   SELECT t.id, t.subdomain, t.company_name, COUNT(u.id) AS root_count
   FROM tenants t
   JOIN users u ON u.tenant_id = t.id
   WHERE u.role = 'root'
     AND u.is_active = 1
   GROUP BY t.id, t.subdomain, t.company_name
   HAVING COUNT(u.id) = 1
   ORDER BY t.id;
   ```

2. **Outreach:** every single-root tenant gets a personalized email at T-14 explaining: "Sie haben nur einen Root-Benutzer. Vor dem 2FA-Cutover am [DATUM] muss ein zweiter Root-Benutzer eingerichtet werden, sonst ist im Falle einer Aussperrung kein Self-Recovery moeglich." Link: HOW-TO-2FA-RECOVERY.md.

3. **Hard-block at T-1:** if list is non-empty at T-1, choose:
   - (a) Delay cut-over by 7 days, escalate via support call, or
   - (b) Per-tenant exclusion (`FEATURE_2FA_EMAIL_ENFORCED` becomes per-tenant in V2 — for V1 this means "delay tenant onboarding to 2FA").

**Owner:** Product/Support. **Verification:** SQL query returns 0 rows at T-1.

### Step 0.5.2: SMTP Domain Auth (SPF/DKIM/DMARC) [PENDING]

**Why:** `SMTP_FROM=noreply@assixx.de` (DD-13). If `assixx.de` lacks proper email auth, codes land in Junk/Spam → users believe "no email arrived" → support flood at cut-over.

**Procedure:**

1. Verify DNS at apex (`assixx.de`):
   - SPF: `v=spf1 include:<provider> -all`
   - DKIM: provider-specific selector (e.g. `default._domainkey.assixx.de`)
   - DMARC: `v=DMARC1; p=quarantine; rua=mailto:postmaster@assixx.de`

2. Send a test 2FA code to a `mail-tester.com` address: target score **≥ 9/10**.

3. If tenant uses custom email domain (`SMTP_FROM=noreply@<tenant-domain>`): verify per-tenant email-auth setup is documented in tenant onboarding (out of scope for V1 if no tenant uses custom domain — confirm via DB query).

**Owner:** DevOps. **Verification:** mail-tester score ≥ 9/10 captured + linked to this masterplan.

### Step 0.5.3: External-API Consumer Audit [DONE — 2026-04-28, formerly Step 0.1]

**Why:** `AuthService.login()` return shape changes from `LoginResponse` to discriminated union `LoginResult`. Mobile/CLI/partner integrations that hard-code the old shape will break at flag-flip.

**Procedure:**

1. `gh search code --owner=assixx '"/api/v2/auth/login"'` (cross-repo search if applicable).
2. Check `backend/src/nest/auth/auth.controller.ts` for `@ApiTags`/Swagger annotations hinting at external clients.
3. Inspect Doppler secrets for any non-browser API tokens with login scope.
4. Document findings under §Spec Deviations.

**Decision criteria:**

- **0 external clients found** → proceed; no mitigation needed.
- **≥ 1 external client found** → choose: (a) version the endpoint (`/api/v3/auth/login` returns new shape, `/v2/` keeps old until clients migrate), or (b) per-client header opt-in (`X-Accept-2FA-Stage: 1`), or (c) coordinate client update before cut-over.

**Owner:** Backend. **Verification:** audit note in §Spec Deviations + decision documented.

### Step 0.5.4: Apex→Subdomain Handoff Verification (Fresh-Tenant Signup) [PENDING]

**Why:** Signup form lives on `www.assixx.com/signup`. After 2FA verify, redirect goes to `<neu-tenant>.assixx.com/handoff?ticket=…`. The new subdomain must be **DNS-resolvable + cert-served** between the moment `tenants` row commits and the 303 redirect fires (typically < 1 second).

**Procedure:**

1. Confirm DNS model:
   - **Wildcard A/AAAA** (`*.assixx.com → <ip>`): trivial, works immediately.
   - **Per-tenant DNS provisioning** (e.g., dynamic API call to DNS provider): introduces latency + failure mode → must be addressed before V1 ship.

2. Confirm cert model:
   - **Wildcard cert** (`*.assixx.com`): trivial.
   - **Per-tenant ACME cert**: provisioning latency → handoff page must show "Subdomain wird vorbereitet, bitte 30 Sekunden warten" UX OR signup must block until cert ready.

3. Test fresh-tenant signup end-to-end on staging with a never-before-used subdomain.

**Owner:** DevOps + Backend. **Verification:** end-to-end signup with new subdomain `e2e-test-{timestamp}` completes within 5 seconds, no DNS/cert errors.

### Step 0.5.5: Dev-SMTP Smoke Test [PENDING]

**Why:** Before any backend code is written, verify Doppler dev secrets actually deliver mail (Mailpit/Maildev container? Real provider?). Without working SMTP, Phase 2 dev cycle is blocked.

**Procedure:**

1. `doppler run -- docker exec assixx-backend node -e "import('./dist/utils/email-service.js').then(m => m.sendTestEmail('test@scs-technik.de', 'smoke', 'Hello'))"`.
2. Receive in expected inbox (Maildev UI, real mailbox, etc.).
3. Document the dev-SMTP setup in HOW-TO-2FA-RECOVERY.md or new HOW-TO-DEV-SMTP.md so future devs are not blocked.

**Owner:** Backend. **Verification:** test email received within 30 seconds.

### Phase 0.5 — Definition of Done

- [ ] Single-root-tenant detection query run + outreach started (Step 0.5.1)
- [ ] mail-tester score ≥ 9/10 for `noreply@assixx.de` (Step 0.5.2)
- [x] External-API audit complete + Spec Deviations updated (Step 0.5.3) — 2026-04-28
- [ ] Subdomain DNS + cert model documented + e2e signup smoke green (Step 0.5.4)
- [ ] Dev-SMTP smoke green + setup documented (Step 0.5.5)

> **Hard rule:** Steps 0.5.3 and 0.5.5 must be DONE before Phase 2 starts (they block code work). Steps 0.5.1, 0.5.2, 0.5.4 must be DONE before T-Day (they block production cut-over only).

---

## Phase 1: Database Migration

> Single migration. Drops legacy 2FA cruft, adds new columns. No new tables. **No partial index** — V0.1 had one with no clear consumer; dropped per KISS.

### Step 1.1: Drop legacy 2FA columns + add new columns [PENDING]

**New file:** `database/migrations/20260427NNNNNNNNN_replace-2fa-state-on-users.ts`
(generated via `doppler run -- pnpm run db:migrate:create replace-2fa-state-on-users`. Generator produces 17-digit UTC timestamp per ADR-014 / DATABASE-MIGRATION-GUIDE — never hand-craft the prefix.)

**`up()` operations:**

```sql
-- (a) Drop dead-schema legacy 2FA columns (zero references in code, confirmed by audit)
ALTER TABLE users DROP COLUMN two_factor_secret;
ALTER TABLE users DROP COLUMN two_factor_enabled;

-- (b) Add new columns for email-based 2FA (this masterplan)
ALTER TABLE users ADD COLUMN tfa_enrolled_at TIMESTAMPTZ NULL;
ALTER TABLE users ADD COLUMN last_2fa_verified_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN users.tfa_enrolled_at IS
    '2FA enrollment timestamp. NULL = never completed 2FA. Set on first successful verify (transparent enrollment, ADR-054 / DD-11).';
COMMENT ON COLUMN users.last_2fa_verified_at IS
    'Most recent successful 2FA verification (ADR-054). Audit / compliance.';
```

**`down()` operations:**

```sql
ALTER TABLE users DROP COLUMN IF EXISTS last_2fa_verified_at;
ALTER TABLE users DROP COLUMN IF EXISTS tfa_enrolled_at;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
```

**Mandatory checklist (per DATABASE-MIGRATION-GUIDE.md):**

- [ ] No `IF NOT EXISTS` in `up()` (fail-loud on partial apply)
- [ ] `IF EXISTS` / `IF NOT EXISTS` allowed in `down()` (defensive rollback)
- [ ] Both new columns nullable — existing rows get NULL → triggers DD-11 transparent enrollment
- [ ] No data backfill (NULL is correct semantic)
- [ ] No new RLS policy needed (`users` already RLS-enabled — verified `relrowsecurity = t`)
- [ ] No new GRANT needed (column-level GRANTs inherit from table per PG default)
- [ ] File generated via `db:migrate:create` — **NEVER** hand-write 17-digit timestamp
- [ ] Confirm legacy columns truly unused: `grep -rn "two_factor_secret\|two_factor_enabled" backend/ shared/` returns 0 hits in source (only test-mocks/freemail-domains-data are allowed false positives)

**Verification:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "\d users" | grep -E "tfa_enrolled_at|last_2fa_verified_at|two_factor"
# Expected: 2 new columns present, 0 legacy columns
```

### Phase 1 — Definition of Done

- [ ] 1 migration file with both `up()` and `down()`, generated via `db:migrate:create`
- [ ] Dry run passes: `doppler run -- ./scripts/run-migrations.sh up --dry-run`
- [ ] Backup taken before applying
- [ ] Migration applied successfully
- [ ] 2 new columns present, 2 legacy columns gone
- [ ] No data backfill performed
- [ ] Backend compiles after pull
- [ ] Existing tests still pass

---

## Phase 2: Backend Module

> Reference module for shape: `backend/src/nest/auth/`. New module is `two-factor-auth/`.

### Step 2.1: Module skeleton + types + DTOs + constants [PENDING]

**New directory:** `backend/src/nest/two-factor-auth/`

**File structure:**

```
backend/src/nest/two-factor-auth/
    two-factor-auth.module.ts
    two-factor-auth.controller.ts
    two-factor-auth.service.ts          # orchestration
    two-factor-code.service.ts          # crypto + Redis primitives
    two-factor-auth.types.ts
    two-factor-auth.constants.ts        # CODE_TTL_SEC=600, MAX_ATTEMPTS=5, LOCKOUT_SEC=900, RESEND_COOLDOWN_SEC=60, MAX_RESENDS_PER_CHALLENGE=3, CODE_ALPHABET='ABCDEFGHJKMNPQRSTUVWXYZ23456789' (31-char Crockford subset, v0.3.1), CODE_LENGTH=6
    dto/
        verify-code.dto.ts
        resend-code.dto.ts
        clear-lockout-param.dto.ts      # param: { id }
        index.ts
backend/src/utils/
    email-templates/
        2fa-code.template.ts            # German HTML + text fallback (legacy email-service path)
```

**Types** (`two-factor-auth.types.ts`):

```typescript
// WHY: discriminated union forces frontend to handle both branches at compile time.
// Reference: ADR-005 (Auth Strategy), ADR-007 (Response shape), ADR-054 (this feature).
import type { LoginResponse } from '../auth/dto/login.dto.js';

export type LoginResult =
  | { stage: 'challenge_required'; challenge: TwoFactorChallenge }
  | ({ stage: 'authenticated' } & LoginResponse);

export interface TwoFactorChallenge {
  challengeToken: string; // opaque base64url, set as httpOnly cookie by controller
  expiresAt: string; // ISO 8601
  resendAvailableAt: string; // ISO 8601
  resendsRemaining: number; // DD-21
}

export type ChallengePurpose = 'login' | 'signup';

// Stored in Redis at 2fa:challenge:{token}
export interface ChallengeRecord {
  userId: number;
  tenantId: number; // NEVER null — tenant is created BEFORE user in signup flow (verified in signup.service.ts)
  email: string;
  purpose: ChallengePurpose;
  codeHash: string; // sha256(userId + ':' + code + ':' + purpose)
  attemptCount: number;
  resendCount: number; // DD-21
  createdAt: string; // ISO
}
```

**DTOs** (Zod via `nestjs-zod`, follows ADR-030):

```typescript
// dto/verify-code.dto.ts
export const VerifyCodeSchema = z.object({
  // v0.3.1: alphanumeric Crockford-Base32 subset (A-HJKMNP-Z2-9). `.trim()` drops
  // copy-paste whitespace; `.toUpperCase()` normalises lowercase input from mobile
  // keyboards (autocapitalize is best-effort, so we fail-safe on the server).
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-HJKMNP-Z2-9]{6}$/, 'Code muss aus 6 Zeichen (A-Z ohne O/I/L, Ziffern 2-9) bestehen'),
  // challengeToken read from httpOnly cookie, NOT body — single source of truth
});
export class VerifyCodeDto extends createZodDto(VerifyCodeSchema) {}

// dto/resend-code.dto.ts — empty body, challengeToken from cookie
export const ResendCodeSchema = z.object({});
export class ResendCodeDto extends createZodDto(ResendCodeSchema) {}

// dto/clear-lockout-param.dto.ts — uses central factory per TYPESCRIPT-STANDARDS §7.5
export { IdParamDto as ClearLockoutParamDto } from '../../common/dto/index.js';
```

**Register in `app.module.ts`:** alphabetically sorted import next to other feature modules.

### Step 2.2: `TwoFactorCodeService` (crypto + Redis primitives) [PENDING]

**File:** `backend/src/nest/two-factor-auth/two-factor-code.service.ts`

**Pattern reference:** `backend/src/nest/auth/oauth/oauth-state.service.ts` — same Redis-via-DI-token style. The project does **NOT** have a `RedisService` wrapper; it injects `Redis` (ioredis) directly via per-module providers.

**Module wiring** (`two-factor-auth.module.ts`):

```typescript
import { Redis } from 'ioredis';
// Provide a dedicated Redis client (mirrors throttler.module.ts:28 + oauth.module.ts:63).
// Separate from the throttler client; uses a different keyPrefix.
const TWO_FA_REDIS = Symbol('TWO_FA_REDIS');
{
  provide: TWO_FA_REDIS,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService) => new Redis({
    host: config.redisHost,
    port: config.redisPort,
    ...(config.redisPassword ? { password: config.redisPassword } : {}),
    keyPrefix: '2fa:',
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
  }),
}
```

**Methods:**

| Method                                                   | Behavior                                                                                                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createChallenge(record): Promise<token>`                | `crypto.randomBytes(32).toString('base64url')` → SET `challenge:{token}` JSON-serialized record, TTL = `CODE_TTL_SEC`                              |
| `loadChallenge(token): Promise<ChallengeRecord \| null>` | GET + JSON.parse. Returns null if missing/expired.                                                                                                 |
| `consumeChallenge(token)`                                | DEL `challenge:{token}` — single-use enforcement                                                                                                   |
| `updateChallenge(token, record, extendTtl: boolean)`     | SET (overwrite). When `extendTtl=true` (resend path per DD-9) → PEXPIRE back to `CODE_TTL_SEC * 1000`.                                             |
| `hashCode(userId, code, purpose): string`                | `crypto.createHash('sha256').update(userId + ':' + code + ':' + purpose).digest('hex')`                                                            |
| `verifyCode(record, code): boolean`                      | Recompute hash from user input + `crypto.timingSafeEqual(Buffer.from(record.codeHash, 'hex'), Buffer.from(computedHash, 'hex'))`                   |
| `incrementFailStreak(userId): Promise<count>`            | INCR `fail-streak:{userId}` + EXPIRE 24h on first hit. Returns new count. **Per-user, not per-challenge — survives resends. NOT reset by resend.** |
| `getFailStreak(userId): Promise<number>`                 | GET `fail-streak:{userId}` (or 0)                                                                                                                  |
| `clearFailStreak(userId)`                                | DEL — called on successful verify and on root lockout-clear                                                                                        |
| `setLockout(userId)`                                     | SETEX `lock:{userId}` `LOCKOUT_SEC` ""                                                                                                             |
| `isLocked(userId): Promise<boolean>`                     | EXISTS `lock:{userId}`                                                                                                                             |
| `clearLockout(userId)`                                   | DEL — called by root lockout-clear endpoint                                                                                                        |
| `setResendCooldown(token)`                               | SETEX `resend:{token}` `RESEND_COOLDOWN_SEC` ""                                                                                                    |
| `isResendOnCooldown(token): Promise<boolean>`            | EXISTS `resend:{token}`                                                                                                                            |

**Critical patterns (every method):**

- Redis injected via the `TWO_FA_REDIS` token (constructor: `@Inject(TWO_FA_REDIS) private readonly redis: Redis`)
- Constant-time compare via `crypto.timingSafeEqual()` — never `===` on hash strings
- Generate code via 6× `crypto.randomInt(0, 31)` indexing into `CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'` (31-char Crockford subset, v0.3.1) — caller passes the plain code in. `crypto.randomInt` rejection-samples internally → uniform over alphabet, no modulo bias.
- All methods return promises (no sync Redis access)
- All errors wrapped via `getErrorMessage()` per TYPESCRIPT-STANDARDS §7.3

### Step 2.3: `TwoFactorAuthService` (orchestration) [PENDING]

**File:** `backend/src/nest/two-factor-auth/two-factor-auth.service.ts`

**Methods:**

| Method                                                                          | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `issueChallenge(userId, tenantId, email, purpose): Promise<TwoFactorChallenge>` | (1) `isLocked()` → throw ForbiddenException if true. (2) Generate plain code via 6× `crypto.randomInt(0, 31)` over the 31-char Crockford alphabet (v0.3.1). (3) `createChallenge()`. (4) `await send2faCode(email, code, purpose, ttlMin=10)` — send is awaited per DD-14; SMTP error → ServiceUnavailableException + signup cleanup. (5) Audit `(create, 2fa-challenge)`. (6) Return `TwoFactorChallenge`.                                                                                                                                          |
| `verifyChallenge(token, code): Promise<{ userId, tenantId, email, purpose }>`   | (1) `loadChallenge()` — null → 401 generic. (2) `isLocked(record.userId)` — true → 403. (3) `verifyCode(record, code)` — false → `incrementFailStreak()`, if ≥ MAX_ATTEMPTS_TOTAL set lockout + send suspicious-activity email (DD-20: user only) + audit `(update, 2fa-lockout)`. Update record.attemptCount via `updateChallenge(token, record, false)`. Throw 401 generic. (4) Success → `consumeChallenge()`, `clearFailStreak()`, `(login, auth, success, {method:'2fa-email'})` audit. Return user info. |
| `resendChallenge(token): Promise<TwoFactorChallenge>`                           | (1) `loadChallenge()` — null → 401. (2) Check `record.resendCount >= MAX_RESENDS_PER_CHALLENGE` (DD-21) → 429. (3) `isResendOnCooldown(token)` — true → 429. (4) Generate new plain code. (5) `updateChallenge()` with new codeHash + reset `attemptCount=0` + `resendCount++` + `extendTtl=true` (DD-9). (6) `setResendCooldown(token)`. (7) Email + audit `(create, 2fa-challenge, {kind:'resend'})`. (8) Return updated challenge.                                                                          |
| `clearLockoutForUser(userId, byUserId): Promise<void>`                          | (1) Verify caller is root + ≠ target (two-root rule). (2) `clearLockout()`, `clearFailStreak()`. (3) Audit `(delete, 2fa-lockout, {clearedBy: byUserId, target: userId})`. **Note: this does NOT issue a new code or bypass 2FA — the user must still pass 2FA on next login attempt.**                                                                                                                                                                                                                        |

**Caller responsibilities (in `AuthService` / `SignupService` after `verifyChallenge` succeeds):**

- Update `users` row via `db.queryAsTenant(sql, params, tenantId)` (RLS pattern, ADR-019): `last_2fa_verified_at = NOW()`. If `tfa_enrolled_at IS NULL` → set it too (transparent enrollment, DD-11).
- For signup purpose: also set `is_active = ${IS_ACTIVE.ACTIVE}` (use `IS_ACTIVE` import from `@assixx/shared/constants` per TYPESCRIPT-STANDARDS §7.4 — no magic numbers).

**Critical patterns:**

- Email send awaited (we want to know if it failed). Catch SMTP error → throw ServiceUnavailableException → frontend shows retry UX. **For signup**: also DELETE the just-created pending user row to prevent dangling `is_active=0` rows.
- Audit emitted on EVERY path (success + fail). Never silent.
- Generic error messages (no "wrong code, expected X"). Same response time on user-found vs user-not-found (R10).
- All caught errors → `getErrorMessage()` per TYPESCRIPT-STANDARDS §7.3.
- All DB writes via `tenantTransaction()` or `queryAsTenant()` — NEVER `query()` for tenant-scoped tables (ADR-019).

### Step 2.4: Modify `AuthService.login()` [PENDING]

**File modified:** `backend/src/nest/auth/auth.service.ts:184` (`async login(dto, ipAddress?, userAgent?)`)

**New return type:** `Promise<LoginResult>` (discriminated union from `two-factor-auth.types.ts`).

**Behavior change** (pseudo-diff):

```typescript
async login(dto: LoginDto, ipAddress?, userAgent?): Promise<LoginResult> {
  // 1. Existing credential validation (unchanged)
  // 2. NEW: feature flag short-circuit (DD-10) via AppConfigService
  if (!this.config.is2faEnforced) {
    const tokens = await this.issueTokens(/* … */);
    return { stage: 'authenticated', ...existingLoginResponse };
  }
  // 3. NEW: issue 2FA challenge instead of tokens
  const challenge = await this.twoFactorAuth.issueChallenge(
    user.id, user.tenant_id, user.email, 'login',
  );
  return { stage: 'challenge_required', challenge };
}
```

**Type-safe handover:** controller maps `LoginResult` to HTTP response. If `challenge_required`, set `challengeToken` as httpOnly cookie + return `{ stage, challenge: { expiresAt, resendAvailableAt, resendsRemaining } }` in body (NOT the token itself — token is cookie-only).

**`loginWithVerifiedUser()` (auth.service.ts:247) is UNCHANGED per DD-7.** Add a comment block above it referencing DD-7 + ADR-054.

### Step 2.5: Modify signup flow [PENDING]

**File modified:** `backend/src/nest/signup/signup.service.ts` (NOT in `auth/` — its own module).

**Behavior change:**

1. Existing validation (Zod, duplicate-email, subdomain check) — unchanged
2. Tenant + user inserted via existing `tenantTransaction()` flow, BUT user with `is_active = IS_ACTIVE.INACTIVE` (pending) instead of `IS_ACTIVE.ACTIVE`
3. Issue signup challenge: `twoFactorAuth.issueChallenge(user.id, tenant.id, user.email, 'signup')`
4. Return `{ stage: 'challenge_required', challenge }` — NO tokens yet

**On successful verify** (handled in `TwoFactorAuthController.verify` when `purpose === 'signup'`):

- Set `users.is_active = ${IS_ACTIVE.ACTIVE}` via `queryAsTenant`
- Set `tfa_enrolled_at` + `last_2fa_verified_at` to `NOW()`
- Issue access + refresh tokens (delegate to existing `AuthService.issueTokens()` or equivalent helper)

**Edge case:** if user abandons signup (challenge expires or DD-14 SMTP failure), the user row is DELETEd in the same transaction (not left with `is_active = 0`). Confirms by integration test in Phase 4.

### Step 2.6: OAuth: no-op per DD-7 [PENDING]

OAuth users skip 2FA. **Files NOT modified:**

- `backend/src/nest/auth/oauth/oauth.controller.ts`
- `backend/src/nest/auth/oauth/oauth.service.ts`
- `backend/src/nest/auth/oauth/oauth-handoff.controller.ts`
- `backend/src/nest/auth/oauth/oauth-handoff.service.ts`
- `backend/src/nest/auth/oauth/providers/microsoft.provider.ts`

Add **comment-only** patches at each entry point that issues tokens, e.g. above `loginWithVerifiedUser()` in `auth.service.ts`:

```typescript
// DD-7 (ADR-054): OAuth users are exempt from email-based 2FA.
// Microsoft / Google providers already enforce MFA upstream. Issuing tokens
// directly here keeps a uniform `loginWithVerifiedUser` shape and avoids
// double-prompt UX. Password login (login() above) goes through the 2FA
// challenge layer instead.
```

### Step 2.7: `TwoFactorAuthController` endpoints [PENDING]

**File:** `backend/src/nest/two-factor-auth/two-factor-auth.controller.ts`

| Method | Route                                 | Decorators                                                                  | Description                                                                                                                                                                                 |
| ------ | ------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v2/auth/2fa/verify`             | `@Public()` + `@UseGuards(CustomThrottlerGuard)` + `@TwoFaVerifyThrottle()` | Body: `VerifyCodeDto`. Reads `challengeToken` from `httpOnly` cookie (NOT body). On success: set access+refresh cookies, clear challenge cookie, return `{ stage: 'authenticated', user }`. |
| POST   | `/api/v2/auth/2fa/resend`             | `@Public()` + `@UseGuards(CustomThrottlerGuard)` + `@TwoFaResendThrottle()` | Body: empty. challengeToken from cookie. On success: return updated `TwoFactorChallenge`.                                                                                                   |
| POST   | `/api/v2/users/:id/2fa/clear-lockout` | `@Roles('root')` + `@UseGuards(CustomThrottlerGuard)` + `@AdminThrottle()`  | Param: `ClearLockoutParamDto`. Two-root rule (target ≠ caller). Returns 204. **NOT a 2FA bypass — only clears the lockout state.**                                                          |

**Mandatory per endpoint:**

- [ ] Throttler decorator + guard
- [ ] Zod-validated DTOs
- [ ] No double-wrapping (services return raw data — `ResponseInterceptor` wraps per ADR-007)
- [ ] `@Public()` for verify/resend (run before `JwtAuthGuard` — user not yet authenticated)
- [ ] Audit entry per request (success or fail)

### Step 2.8: New throttler tiers + decorators [PENDING]

**File modified:** `backend/src/nest/throttler/throttler.module.ts`

Add to `throttlers: [...]`:

```typescript
// 2FA verify: 5 attempts per 10 minutes (per IP — limits brute-force across users)
{ name: '2fa-verify', ttl: 10 * MS_MINUTE, limit: 5 },
// 2FA resend: 1 per 60s (per IP — paired with per-token cooldown in service layer)
{ name: '2fa-resend', ttl: MS_MINUTE, limit: 1 },
```

**File modified:** `backend/src/nest/common/decorators/throttle.decorators.ts`

Add two new decorators (mirror existing `AuthThrottle` shape) AND extend every existing decorator's `SkipThrottle` list with `'2fa-verify': true, '2fa-resend': true` per the documented "tier isolation" rule (lines 17-25 of that file).

```typescript
export const TwoFaVerifyThrottle = (): ThrottleDecorator =>
  applyDecorators(
    Throttle({ '2fa-verify': { limit: 5, ttl: 10 * MS_MINUTE } }),
    SkipThrottle({
      auth: true,
      public: true,
      user: true,
      admin: true,
      upload: true,
      export: true,
      'domain-verify': true,
      '2fa-resend': true,
    }),
  );

export const TwoFaResendThrottle = (): ThrottleDecorator =>
  applyDecorators(
    Throttle({ '2fa-resend': { limit: 1, ttl: MS_MINUTE } }),
    SkipThrottle({
      auth: true,
      public: true,
      user: true,
      admin: true,
      upload: true,
      export: true,
      'domain-verify': true,
      '2fa-verify': true,
    }),
  );
```

### Step 2.9: `send2faCode()` + template + `SMTP_FROM` [PENDING]

**Files:**

- modify `backend/src/utils/email-service.ts` — add export `send2faCode(...)` (top-level function, matches the file's existing function-export style — NOT a NestJS service)
- new `backend/src/utils/email-templates/2fa-code.template.ts` — German HTML + plain text
- modify `backend/src/nest/config/config.service.ts` — extend `EnvSchema`:

```typescript
SMTP_FROM: z.string().min(1).default('noreply@assixx.de'),
FEATURE_2FA_EMAIL_ENFORCED: z.coerce.boolean().default(false),
```

Plus add getters:

```typescript
get smtpFrom(): string { return this.config.SMTP_FROM; }
get is2faEnforced(): boolean { return this.config.FEATURE_2FA_EMAIL_ENFORCED; }
```

**Method signature:**

```typescript
export async function send2faCode(
  to: string,
  code: string,
  purpose: 'login' | 'signup',
  ttlMinutes: number,
): Promise<void>;
```

**Template content (German, ä/ö/ü/ß per CLAUDE.local.md):**

- Subject: per DD-13 — generic, NO code
- Body: greeting · purpose-specific intro ("Sie haben sich angemeldet" vs "Willkommen bei Assixx") · 6-character alphanumeric code in large monospace, **no separator** (e.g. `K7PX3M` — preserves iOS auto-fill + simple `maxlength="6"` manual entry; v0.3.1) · TTL warning · "Geben Sie diesen Code niemandem weiter" notice · footer
- Plain-text fallback for clients without HTML
- No tracking pixels, no external assets

**Suspicious-activity template** (separate file): notifies user only (DD-20) when their account hits the 5-wrong-attempts lockout.

### Step 2.10: Pino redaction config [PENDING]

**File modified:** `backend/src/nest/common/logger/logger.constants.ts`

**Add to `LOGGER_REDACT_PATHS`:**

```typescript
'req.body.code',
'req.body.challengeToken',
'res.body.challengeToken',
'res.body.data.challengeToken',
'*.code',
'*.challengeToken',
// req.headers.cookie is already redacted in the existing list — verify before duplicating
```

**Verify:** unit test that exercises a verify-fail path and asserts the log entry contains `[Redacted]` not the actual code.

### Step 2.11: Stale-Pending Reaper Cron [PENDING]

**Why:** DD-14 cleanup deletes `users` + `tenants` row when SMTP fails synchronously. But there is a second leak path: user submits signup → SMTP succeeds → **user closes the browser tab** before entering the code. The `users` row sits at `is_active=0` indefinitely; the `tenants` row keeps the subdomain reserved. Without a reaper, attackers script signup-then-close to squat premium subdomains, and legit users see "Email already in use" when they retry signup an hour later.

**File:** `backend/src/nest/two-factor-auth/two-factor-auth-reaper.service.ts`

**Pattern reference:** existing `assixx-deletion-worker` container (separate process per `docker-compose.yml`). Either (a) extend the deletion-worker with a new periodic task, or (b) add a `@Cron` job inside the main backend (NestJS `@nestjs/schedule`). Decide in Session 7 — DECISION-DEFAULT: **(b) `@Cron` inside main backend** since the work is light (one query per run) and the deletion-worker pattern is for heavier batch jobs. If telemetry shows contention, migrate to deletion-worker in V2.

**Behavior** (runs every 15 minutes, `@Cron('0 */15 * * * *')`):

```sql
-- Run as sys_user (BYPASSRLS). Inside one transaction.
WITH stale_users AS (
    SELECT id, tenant_id
    FROM users
    WHERE is_active = ${IS_ACTIVE.INACTIVE}
      AND tfa_enrolled_at IS NULL
      AND created_at < NOW() - INTERVAL '1 hour'
),
deleted_users AS (
    DELETE FROM users
    WHERE id IN (SELECT id FROM stale_users)
    RETURNING id, tenant_id
),
orphan_tenants AS (
    SELECT du.tenant_id
    FROM deleted_users du
    WHERE NOT EXISTS (
        SELECT 1 FROM users u WHERE u.tenant_id = du.tenant_id
    )
)
DELETE FROM tenants
WHERE id IN (SELECT tenant_id FROM orphan_tenants)
RETURNING id, subdomain;
```

**Audit:** for each deleted (user, tenant) pair, write one `audit_trail` row:

- `(action='delete', resource_type='2fa-stale-signup', changes={userId, tenantId, subdomain, reason:'never-verified'})`

**Critical patterns:**

- Run via `systemTransaction()` — needs BYPASSRLS for cross-tenant cleanup.
- Tenant deletion is **conditional** (only if no other users exist) — defensive against race where another user signed up under the same tenant in the meantime (cannot happen in practice for fresh signups, but cheap insurance).
- Log the count of deleted users + tenants per run — Sentry alert if > 100/hour (signal of either a bug or an attack).
- The 1-hour TTL is intentionally longer than the 10-minute challenge TTL — gives a buffer for users who genuinely want to come back to a half-finished signup.

**Verification (Phase 4 integration test):**

1. Signup → receive code → close browser
2. Wait 1 h (or fast-forward via `INTERVAL` injection in test)
3. Run reaper manually
4. Assert: user row gone, tenant row gone, audit row written, subdomain available for re-signup.

**Edge cases handled:**

- User who DID verify (has `tfa_enrolled_at IS NOT NULL`) is never reaped, even if `is_active=0` for some other reason.
- Tenant with multiple users (e.g., admin invited employees during signup window) is preserved — only the stale user row goes.

### Phase 2 — Definition of Done

- [ ] `TwoFactorAuthModule` registered in `app.module.ts` (alphabetical)
- [ ] All 3 services implemented (Code, Auth, plus `send2faCode` extension to legacy `email-service.ts`)
- [ ] Controller with 3 endpoints, all throttled with new decorators
- [ ] `AuthService.login()` returns discriminated union (`LoginResult`)
- [ ] `SignupService.signup()` issues challenge, no tokens
- [ ] OAuth handlers carry DD-7 comment, no behavior change
- [ ] `email-service.ts` has `send2faCode()` + new German template (text + HTML)
- [ ] All Zod DTOs use `createZodDto()` + central `IdParamDto` factory where applicable
- [ ] Audit emitted using `(action, resource_type)` tuples per §A8 (NOT dotted strings)
- [ ] Pino redaction list includes `code`, `challengeToken` in `logger.constants.ts`
- [ ] `FEATURE_2FA_EMAIL_ENFORCED` + `SMTP_FROM` wired through `AppConfigService` Zod schema (fail-fast on missing in prod)
- [ ] `IS_ACTIVE` constants used (no magic numbers per TYPESCRIPT-STANDARDS §7.4)
- [ ] All errors via `getErrorMessage()` per §7.3
- [ ] All tenant-scoped DB ops via `tenantTransaction()` or `queryAsTenant()` (ADR-019)
- [ ] Stale-pending reaper (`@Cron('0 */15 * * * *')`) deletes user + orphan tenant; audit row written; integration test green
- [ ] ESLint 0 errors: `docker exec assixx-backend pnpm exec eslint backend/src/nest/two-factor-auth/`
- [ ] Type-check 0 errors

---

## Phase 3: Unit Tests

### Test files

```
backend/src/nest/two-factor-auth/
    two-factor-code.service.test.ts        # ≥ 25 tests
    two-factor-auth.service.test.ts        # ≥ 25 tests
backend/src/nest/auth/
    auth.service.test.ts                   # +10 tests for new login branches (existing file)
backend/src/nest/signup/
    signup.service.test.ts                 # +5 tests for new signup branches (existing file)
```

### Mandatory scenarios — `TwoFactorCodeService`

- [ ] `createChallenge` produces base64url token of expected length (~43 chars from 32 bytes)
- [ ] Token is unique across calls (no collisions in 1 000 generations)
- [ ] `loadChallenge` returns null for unknown token
- [ ] `loadChallenge` returns null for expired token (mocked `EXPIRE`)
- [ ] `consumeChallenge` deletes the key
- [ ] `hashCode` is deterministic for same inputs
- [ ] `hashCode` differs across purposes (`login` vs `signup` produce different hashes for same userId+code)
- [ ] `verifyCode` true on match
- [ ] `verifyCode` false on mismatch
- [ ] `verifyCode` constant-time (timing test, 1 000 samples, std-dev within bounds)
- [ ] `incrementFailStreak` increases counter
- [ ] `incrementFailStreak` sets 24 h TTL on first hit
- [ ] `getFailStreak` returns 0 if no key
- [ ] `clearFailStreak` deletes counter
- [ ] `setLockout` sets `LOCKOUT_SEC` TTL
- [ ] `isLocked` true during lockout, false after expire
- [ ] `setResendCooldown` + `isResendOnCooldown` 60 s TTL behavior
- [ ] Concurrent `createChallenge` calls produce distinct tokens (no race)
- [ ] `updateChallenge(extendTtl=true)` resets TTL to `CODE_TTL_SEC`
- [ ] Generator output always matches `/^[A-HJKMNP-Z2-9]{6}$/` over 10 000 samples (no forbidden chars `0/1/I/L/O`, v0.3.1)
- [ ] DTO normalises lowercase input via `.toUpperCase()` before regex check (lowercase `abc234` → uppercase `ABC234`, then alphabet check; v0.3.1)

### Mandatory scenarios — `TwoFactorAuthService`

- [ ] `issueChallenge` calls send2faCode with correct args (mock email module)
- [ ] `issueChallenge` rejects if user is locked → ForbiddenException
- [ ] `issueChallenge` audit entry emitted: `(create, 2fa-challenge)`
- [ ] `verifyChallenge` rejects unknown token → UnauthorizedException
- [ ] `verifyChallenge` rejects expired token → UnauthorizedException
- [ ] `verifyChallenge` rejects wrong code → UnauthorizedException + failstreak++ + audit `(login, auth, failure)`
- [ ] After 5 wrong codes total → lockout set + suspicious-activity email + audit `(update, 2fa-lockout)`
- [ ] `verifyChallenge` consumes token on success (second use → 401)
- [ ] `verifyChallenge` clears failstreak on success
- [ ] First successful verify sets `tfa_enrolled_at` AND `last_2fa_verified_at`
- [ ] Subsequent verifies update only `last_2fa_verified_at` (don't overwrite enrolled)
- [ ] Signup verify also sets `is_active = IS_ACTIVE.ACTIVE`
- [ ] `resendChallenge` enforces 60 s cooldown → ConflictException
- [ ] `resendChallenge` enforces `MAX_RESENDS_PER_CHALLENGE` (DD-21)
- [ ] `resendChallenge` extends challenge TTL (DD-9)
- [ ] `resendChallenge` resets per-challenge `attemptCount` to 0 BUT NOT per-user `failStreak`
- [ ] `resendChallenge` issues new code (different hash from previous)
- [ ] `clearLockoutForUser` two-root rule: caller==target → ForbiddenException
- [ ] `clearLockoutForUser` clears lockout + failstreak + audit `(delete, 2fa-lockout)`

### Mandatory scenarios — `AuthService.login` (new branches)

- [ ] Valid credentials + flag ON → returns `stage: 'challenge_required'`
- [ ] Valid credentials + flag OFF → returns `stage: 'authenticated'` with tokens
- [ ] Invalid password → UnauthorizedException (no challenge issued, no email sent)
- [ ] Inactive user → ForbiddenException (no challenge)
- [ ] User in 2FA lockout state → ForbiddenException with retry hint
- [ ] User-enumeration timing: invalid email vs valid-email-wrong-password — response time delta within bounds (< 50 ms)
- [ ] `loginWithVerifiedUser()` (OAuth path) returns tokens directly — no challenge issued (DD-7 regression test)

### Phase 3 — Definition of Done

- [ ] ≥ 65 unit tests, all green
- [ ] Coverage of `TwoFactorCodeService` ≥ 90 %
- [ ] Coverage of `TwoFactorAuthService` ≥ 90 %
- [ ] Constant-time test passes
- [ ] Race-condition test for concurrent challenges passes
- [ ] All ConflictException / ForbiddenException / UnauthorizedException paths covered

---

## Phase 4: API Integration Tests

### Test file

`backend/test/two-factor-auth.api.test.ts` (Vitest, hits running Docker backend)

### Scenarios (≥ 35 assertions)

**Happy paths:**

- [ ] Signup flow: POST /signup → challenge → POST /2fa/verify → user `is_active = 1` + tokens issued
- [ ] Login flow: POST /login → challenge → POST /2fa/verify → tokens issued
- [ ] Resend after 61 s → 200 + new challenge details
- [ ] Resend before 60 s → 429 + retry-after header
- [ ] OAuth login (`loginWithVerifiedUser` path) → no challenge, tokens directly (DD-7)

**Negative paths:**

- [ ] Verify with wrong code → 401, attempts++
- [ ] Verify with expired challenge token (TTL elapsed) → 401
- [ ] Verify with already-consumed token → 401
- [ ] 5 wrong codes → 6th attempt → 403 (lockout active)
- [ ] Subsequent login during lockout → 403
- [ ] Verify with malformed body → 400 (Zod validation)
- [ ] Verify with code containing forbidden char (`O`/`I`/`L`/`0`/`1`) → 400 (Zod alphabet check, v0.3.1)
- [ ] Verify with mismatched purpose (signup token used for login flow) → 401
- [ ] Login with feature flag OFF → tokens returned directly, no challenge
- [ ] 4th resend on same challenge → 429 (DD-21)
- [ ] Signup SMTP failure → 503 + pending user row deleted (no orphan `is_active=0`)

**Tenant isolation:**

- [ ] Tenant A user cannot use tenant B's challenge token (cross-tenant attack via token)
- [ ] Audit entries written under correct `tenant_id` (signup challenge audit row has the freshly-created tenant_id, not 0/NULL)

**Lockout-clear endpoint (root-only):**

- [ ] Root POST /users/:id/2fa/clear-lockout → 204, target user's lockout cleared, audit entry written
- [ ] Non-root → 403
- [ ] Root with id=self → ForbiddenException (two-root rule)
- [ ] After lockout-clear, user must STILL pass 2FA on next login (NOT a bypass)

**Email assertions** (via in-memory transport / Maildev capture):

- [ ] Signup challenge sends 1 email to correct address with correct subject (DD-13 generic)
- [ ] Login challenge sends 1 email
- [ ] Resend sends 1 email (different code than original)
- [ ] Lockout triggers suspicious-activity email to the locked-out user only (DD-20)

### Phase 4 — Definition of Done

- [ ] ≥ 35 API tests, all green
- [ ] Tenant isolation verified
- [ ] Throttler 429 responses observed for both `2fa-verify` and `2fa-resend` tiers
- [ ] Lockout end-to-end verified
- [ ] Lockout-clear verified (both authorized + denied paths)
- [ ] Audit entries verified (correct `(action, resource_type)` tuples) after each scenario
- [ ] Email send verified (in-memory transport or Maildev)
- [ ] OAuth path regression test green (no challenge for OAuth login)

---

## Phase 5: Frontend

> Reference existing pages: `(public)/login/+page.svelte` + `+page.server.ts` (form action exists). New `signup/+page.server.ts` is **net-new** per DD-19. Verify pages mirror their parents.

### Route additions / modifications

```
frontend/src/routes/(public)/
    login/
        +page.svelte               # MODIFIED — handle stage discriminator (server returns to /login/verify on challenge)
        +page.server.ts            # MODIFIED — set challenge cookie if stage=challenge_required
        verify/
            +page.svelte           # NEW — code entry
            +page.server.ts        # NEW — read challenge cookie, POST to /2fa/verify
            _lib/constants.ts      # NEW — German UI strings
    signup/
        +page.svelte               # MODIFIED — switch from client-side _lib/api.ts POST to <form method="POST" use:enhance>
        +page.server.ts            # NEW (per DD-19) — form action, server-side cookie + redirect
        verify/
            +page.svelte           # NEW
            +page.server.ts        # NEW
            _lib/constants.ts      # NEW
```

### Step 5.1: Modify login page [PENDING]

**`+page.server.ts`** action receives the discriminated-union response from backend. Branches:

- `result.data.stage === 'authenticated'` → existing flow (set access/refresh cookies, redirect to dashboard).
- `result.data.stage === 'challenge_required'` → set `challengeToken` httpOnly cookie:

```typescript
cookies.set('challengeToken', result.data.challenge.challengeToken, {
  httpOnly: true,
  secure: !dev, // true in prod, false in vite dev
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 10, // 10 min — matches challenge TTL
});
throw redirect(303, '/login/verify');
```

**Critical:** `challengeToken` MUST NEVER be written to JavaScript-accessible state (no `localStorage`, no `sessionStorage`, no `$state`, never sent in response body). Same rule as the access-token cookie (ADR-005).

### Step 5.2: New `/login/verify/+page.svelte` [PENDING]

**Layout:** centered card, glassmorphism, design-system primitives (`page-container--narrow`, `card`, `form-field`, `btn`, `alert`).

**Markup (high-level):**

```svelte
<form method="POST" use:enhance>
  <h1>{MESSAGES.HEADING}</h1>
  <p>{MESSAGES.INTRO(maskedEmail)}</p>

  <input
    type="text"
    inputmode="text"
    autocapitalize="characters"
    autocomplete="one-time-code"
    maxlength="6"
    pattern="[A-HJKMNP-Z2-9]{6}"
    name="code"
    bind:value={code}
    required
    class="form-field__control form-field__control--lg"
  />

  <button class="btn btn-primary" type="submit" disabled={code.length !== 6 || submitting}>
    {MESSAGES.BTN_SUBMIT}
  </button>

  {#if errorMessage}
    <div class="alert alert--error">{errorMessage}</div>
  {/if}

  <button class="btn btn-link" disabled={resendCooldown > 0} onclick={resend}>
    {resendCooldown > 0 ? MESSAGES.BTN_RESEND_COOLDOWN(resendCooldown) : MESSAGES.BTN_RESEND}
  </button>

  <a href="/login" class="btn btn-link">{MESSAGES.BTN_BACK}</a>
</form>
```

**Behavior:**

- Auto-submit when 6th character entered (DD-17). No feature flag. (v0.3.1: digit → character.)
- `autocomplete="one-time-code"` triggers iOS/Android auto-fill from email.
- `inputmode="text"` + `autocapitalize="characters"` shows the alphanumeric letter keyboard with caps-lock primed on mobile (v0.3.1).
- Resend button shows live countdown (60 s) using `$state` + `setInterval`. Cleans up via `$effect` cleanup function.
- Error states: wrong code, expired challenge, lockout — distinct German messages from `MESSAGES`.
- On success → server load redirects to dashboard (login) or onboarding (signup).
- On lockout → message "Konto gesperrt. Bitte in 15 Minuten erneut versuchen oder Administrator kontaktieren." + redirect to `/login` after 5 s.

**State management** (Svelte 5 runes — `$state` per CODE-OF-CONDUCT-SVELTE):

```typescript
let code = $state('');
let resendCooldown = $state(60);
let resendsRemaining = $state(3);
let errorMessage = $state<string | null>(null);
let submitting = $state(false);
```

### Step 5.3: New `/signup/verify/+page.svelte` [PENDING]

Same UX as 5.2 with adjusted copy:

- Heading: "E-Mail bestätigen"
- Intro: "Bitte bestätigen Sie Ihre E-Mail-Adresse, um die Registrierung abzuschliessen." (`schliessen` per ß rule)
- **On success — apex→subdomain handoff (per ADR-050)**: signup `/verify` runs on apex (`www.assixx.com`). After backend confirms 2FA, the verify endpoint must:
  1. Issue access + refresh tokens server-side.
  2. **NOT** set token cookies on apex (would scope to `www.assixx.com`, useless for `<tenant>.assixx.com`).
  3. Mint a single-use connection-ticket (existing `connection-ticket.service.ts`, used by ADR-050 / ADR-046 oauth-handoff for the same problem).
  4. Redirect 303 to `https://<tenant>.assixx.com/handoff?ticket=<base64url>`.
  5. The existing handoff endpoint on the tenant subdomain consumes the ticket and sets the token cookies on the correct origin.
  - **No new mechanism** — reuses the proven OAuth handoff path. New work: the password-signup verify-success branch must call into the connection-ticket service.

### Step 5.4: Signup parent page form-action refactor (DD-19) [PENDING]

Currently `signup/+page.svelte` posts client-side via `_lib/api.ts`. Per DD-19, refactor to canonical SvelteKit form action:

1. **NEW** `signup/+page.server.ts`:

```typescript
import { dev } from '$app/environment';

import { fail, redirect } from '@sveltejs/kit';

import type { Actions } from './$types';

export const actions = {
  default: async ({ request, cookies, fetch }) => {
    const form = await request.formData();
    // Build SignupDto, call backend
    const response = await fetch('/api/v2/signup', {
      /* … */
    });
    const result = await response.json();
    if (!response.ok) return fail(response.status, { error: result.error });
    if (result.data.stage === 'challenge_required') {
      cookies.set('challengeToken', result.data.challenge.challengeToken, {
        httpOnly: true,
        secure: !dev,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 10,
      });
      throw redirect(303, '/signup/verify');
    }
    // Authenticated branch (e.g. flag off)
    /* existing post-signup token handling */
  },
};
```

2. `signup/+page.svelte` — replace `<form>` `onsubmit` JS handler with `<form method="POST" use:enhance>`. Keep `_lib/validators.ts` for client-side eager validation.

3. `_lib/api.ts` — keep for `subdomain-check` calls (still used by SubdomainInput.svelte). Remove the signup POST call since the server action replaces it.

### Step 5.5: Error states + i18n centralization [PENDING]

All German strings in `frontend/src/routes/(public)/login/verify/_lib/constants.ts` (and signup-verify equivalent):

```typescript
export const MESSAGES = {
  HEADING: 'Bestätigungscode eingeben',
  INTRO: (email: string) => `Wir haben einen 6-stelligen Code an ${email} gesendet.`,
  BTN_SUBMIT: 'Bestätigen',
  BTN_RESEND: 'Code erneut senden',
  BTN_RESEND_COOLDOWN: (sec: number) => `Code erneut senden in ${sec} s`,
  BTN_BACK: 'Zurück zum Login',
  ERR_WRONG_CODE: (remaining: number) => `Falscher Code. Noch ${remaining} Versuche übrig.`,
  ERR_EXPIRED: 'Der Code ist abgelaufen. Bitte fordern Sie einen neuen an.',
  ERR_LOCKED: 'Konto gesperrt. Bitte in 15 Minuten erneut versuchen oder Administrator kontaktieren.',
  ERR_NETWORK: 'Verbindung verloren. Bitte erneut versuchen.',
  ERR_SEND_FAILED: 'Der Code konnte nicht gesendet werden. Bitte erneut versuchen.',
  ERR_RESEND_LIMIT: 'Maximale Anzahl an Resends erreicht. Bitte starten Sie den Login neu.',
} as const;
```

### Phase 5 — Definition of Done

- [ ] Login flow works end-to-end with 2FA enforced
- [ ] Signup flow works end-to-end with 2FA enforced (form action, NOT client-side POST)
- [ ] iOS Safari + Android Chrome auto-fill code from email tested
- [ ] Resend countdown shows live tick + `resendsRemaining` decrement
- [ ] Lockout message shown after 5 wrong attempts
- [ ] Challenge token never accessible from JS (verify via DevTools: no localStorage, no `$state`, no response body)
- [ ] svelte-check 0 errors, 0 warnings
- [ ] Frontend ESLint 0 errors
- [ ] All user-facing strings German with proper ä/ö/ü/ß
- [ ] Responsive verified at 320 px and 1920 px
- [ ] 0 hardcoded colors / fonts (design-system tokens only)

---

## Phase 6: Integration + Polish + ADR

### Operational

- [ ] **Grafana alert rule** (NOT Sentry — per ADR-002 Phase 5g, alerts are provisioned as code in `docker/grafana/alerts/*.json` via `apply.sh`): SMTP failure rate > 5 % over 5 min. New file `docker/grafana/alerts/08-smtp-failure-rate.json`. Runs through existing `doppler run -- ./docker/grafana/alerts/apply.sh` workflow.
- [ ] Sentry: 5xx errors from 2FA endpoints captured automatically by existing `all-exceptions.filter.ts` (no new wiring).
- [ ] Grafana dashboard panel: 2FA verify success/fail rate per minute (`audit_trail` query)
- [ ] Loki saved query: `{service="backend"} | json | resource_type="2fa-challenge" or resource_type="2fa-lockout"`
- [ ] Audit-trail filter recipe: `WHERE resource_type IN ('2fa-challenge','2fa-lockout') OR (action='login' AND changes->>'method'='2fa-email')`
- [ ] Pre-deploy email drafted + sent to all tenants 7 days before flag flip

### Documentation

- [ ] **ADR-054: Mandatory Email-Based 2FA** written, status "Accepted" (ADR-053 is taken — Navigation Map Pointer Injection, accepted 2026-04-23)
- [ ] `docs/ARCHITECTURE.md` §1.2 — add 2FA row linking ADR-054
- [ ] `docs/FEATURES.md` updated
- [ ] `docs/how-to/HOW-TO-2FA-RECOVERY.md` NEW — runbook: user-lost-mailbox → company IT restores → user re-attempts; root lockout-clear procedure (NOT a 2FA bypass); two-root requirement note
- [ ] `docs/how-to/HOW-TO-CREATE-TEST-USER.md` updated — now includes 2FA verify step
- [ ] `customer/fresh-install/` synced via `./scripts/sync-customer-migrations.sh`

### Cut-over runbook

1. T-7 days: announcement email
2. T-1 day: deploy code with `FEATURE_2FA_EMAIL_ENFORCED=false` → smoke test (no behavior change)
3. T-0: flip flag → monitor SMTP failure rate, lockout count, support tickets
4. T+1 day: review metrics, confirm steady state

### Phase 6 — Definition of Done

- [ ] ADR-054 reviewed + "Accepted"
- [ ] All operational integrations live in staging
- [ ] Lockout-clear runbook tested (lock self → recover via second root)
- [ ] Customer migrations synced
- [ ] No open TODOs in code
- [ ] Cut-over date set + announcement queued
- [ ] Post-cut-over monitoring window scheduled (24 h)

---

## Session Tracking

| Session | Phase | Description                                                                                                                       | Status  | Date       |
| ------- | ----- | --------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| 0       | 0     | DD sign-off (21/21 APPROVED)                                                                                                      | DONE    | 2026-04-26 |
| 1       | 0/0.5 | External-API audit · pre-deploy email draft · single-root detection · SPF/DKIM check · subdomain handoff verify · dev-SMTP smoke  | PENDING |            |
| 2       | 1     | Migration: drop legacy 2FA columns + add 2 new columns                                                                            | PENDING |            |
| 3       | 2     | Module skeleton · types · DTOs · constants · register in app.module                                                               | PENDING |            |
| 4       | 2     | TwoFactorCodeService (crypto + Redis primitives via DI provider)                                                                  | PENDING |            |
| 5       | 2     | TwoFactorAuthService (orchestration) · `send2faCode` + template                                                                   | PENDING |            |
| 6       | 2     | Modify AuthService.login + SignupService (incl. tenant cleanup on SMTP fail per DD-14) · OAuth comment-only · feature flag wiring | PENDING |            |
| 7       | 2     | TwoFactorAuthController · throttler tiers + decorators · Pino redaction · audit hooks · stale-pending reaper cron (Step 2.11)     | PENDING |            |
| 8       | 3     | Unit tests TwoFactorCodeService                                                                                                   | PENDING |            |
| 9       | 3     | Unit tests TwoFactorAuthService + AuthService + SignupService modifications + reaper service                                      | PENDING |            |
| 10      | 4     | API integration tests + email-capture + reaper end-to-end                                                                         | PENDING |            |
| 11      | 5     | Frontend login + login/verify (form action, cookie wiring, Svelte runes)                                                          | PENDING |            |
| 12      | 5     | Frontend signup form-action refactor (DD-19) + signup/verify                                                                      | PENDING |            |
| 13      | 5     | Polish · responsive · lockout state · error i18n                                                                                  | PENDING |            |
| 14      | 6     | ADR-054 · monitoring · lockout-clear runbook · cut-over checklist                                                                 | PENDING |            |

### Session log template

```markdown
### Session N — YYYY-MM-DD

**Goal:** {what should be achieved}
**Result:** {what was actually achieved}
**New files:** {list}
**Changed files:** {list}
**Verification:**

- ESLint: {0 / N → fixed}
- Type-check: {0 errors}
- Tests: {N / N passed}

**Deviations:** {what differed from plan and why}
**Next session:** {what comes next}
```

---

## Quick Reference: File Paths

### Backend (new)

| File                                                                 | Purpose                                   |
| -------------------------------------------------------------------- | ----------------------------------------- |
| `backend/src/nest/two-factor-auth/two-factor-auth.module.ts`         | NestJS module                             |
| `backend/src/nest/two-factor-auth/two-factor-auth.controller.ts`     | 3 endpoints                               |
| `backend/src/nest/two-factor-auth/two-factor-auth.service.ts`        | Orchestration                             |
| `backend/src/nest/two-factor-auth/two-factor-code.service.ts`        | Crypto + Redis primitives                 |
| `backend/src/nest/two-factor-auth/two-factor-auth.types.ts`          | Types                                     |
| `backend/src/nest/two-factor-auth/two-factor-auth.constants.ts`      | TTLs · attempt limits                     |
| `backend/src/nest/two-factor-auth/two-factor-auth-reaper.service.ts` | Stale-pending reaper (`@Cron`, Step 2.11) |
| `backend/src/nest/two-factor-auth/dto/*.ts`                          | Zod DTOs                                  |
| `backend/src/utils/email-templates/2fa-code.template.ts`             | German HTML + text template               |
| `backend/src/utils/email-templates/2fa-suspicious.template.ts`       | Suspicious-activity email (DD-20)         |
| `database/migrations/<17-digit-utc>_replace-2fa-state-on-users.ts`   | Migration                                 |
| `backend/src/nest/two-factor-auth/two-factor-code.service.test.ts`   | Unit tests                                |
| `backend/src/nest/two-factor-auth/two-factor-auth.service.test.ts`   | Unit tests                                |
| `backend/test/two-factor-auth.api.test.ts`                           | API integration tests                     |

### Backend (modified)

| File                                                        | Change                                                                           |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `backend/src/nest/app.module.ts`                            | Import TwoFactorAuthModule                                                       |
| `backend/src/nest/auth/auth.service.ts`                     | `login()` returns `LoginResult`; DD-7 comment above `loginWithVerifiedUser()`    |
| `backend/src/nest/auth/auth.controller.ts`                  | Map `LoginResult` to HTTP response (challenge cookie or token cookies)           |
| `backend/src/nest/auth/dto/login.dto.ts`                    | (Optional) Re-export `LoginResult` type alongside `LoginResponse`                |
| `backend/src/nest/signup/signup.service.ts`                 | Issue challenge instead of tokens; user starts with `IS_ACTIVE.INACTIVE`         |
| `backend/src/nest/signup/signup.controller.ts`              | Map signup result through new discriminated-union controller logic               |
| `backend/src/utils/email-service.ts`                        | New `send2faCode()` + `sendSuspiciousActivity()` exports                         |
| `backend/src/nest/common/logger/logger.constants.ts`        | Pino redact paths added                                                          |
| `backend/src/nest/config/config.service.ts`                 | EnvSchema: `FEATURE_2FA_EMAIL_ENFORCED`, `SMTP_FROM`; getters added              |
| `backend/src/nest/throttler/throttler.module.ts`            | Two new tiers `2fa-verify`, `2fa-resend`                                         |
| `backend/src/nest/common/decorators/throttle.decorators.ts` | Two new decorators + add `2fa-*` to every existing decorator's SkipThrottle list |
| `backend/src/nest/auth/auth.service.test.ts`                | New login-branch tests                                                           |
| `backend/src/nest/signup/signup.service.test.ts`            | New signup-branch tests                                                          |

### Frontend (new)

| Path                                                           | Purpose                              |
| -------------------------------------------------------------- | ------------------------------------ |
| `frontend/src/routes/(public)/login/verify/+page.svelte`       | Code entry                           |
| `frontend/src/routes/(public)/login/verify/+page.server.ts`    | Verify endpoint glue                 |
| `frontend/src/routes/(public)/login/verify/_lib/constants.ts`  | German UI strings                    |
| `frontend/src/routes/(public)/signup/+page.server.ts`          | Signup form action (DD-19) — net-new |
| `frontend/src/routes/(public)/signup/verify/+page.svelte`      | Code entry                           |
| `frontend/src/routes/(public)/signup/verify/+page.server.ts`   | Verify endpoint glue                 |
| `frontend/src/routes/(public)/signup/verify/_lib/constants.ts` | German UI strings                    |

### Frontend (modified)

| File                                                 | Change                                                  |
| ---------------------------------------------------- | ------------------------------------------------------- |
| `frontend/src/routes/(public)/login/+page.svelte`    | Handle stage discriminator                              |
| `frontend/src/routes/(public)/login/+page.server.ts` | Set challenge cookie + redirect on `challenge_required` |
| `frontend/src/routes/(public)/signup/+page.svelte`   | Switch to `<form method="POST" use:enhance>` (DD-19)    |
| `frontend/src/routes/(public)/signup/_lib/api.ts`    | Remove signup-POST call (now in form action)            |

### Documentation (new / updated)

| File                                                     | Action                      |
| -------------------------------------------------------- | --------------------------- |
| `docs/infrastructure/adr/ADR-054-mandatory-email-2fa.md` | NEW (ADR-053 already taken) |
| `docs/how-to/HOW-TO-2FA-RECOVERY.md`                     | NEW                         |
| `docs/how-to/HOW-TO-CREATE-TEST-USER.md`                 | UPDATE                      |
| `docs/ARCHITECTURE.md` §1.2                              | UPDATE                      |
| `docs/FEATURES.md`                                       | UPDATE                      |

---

## Spec Deviations

> Populate during implementation when actual code contradicts this plan.

### Audit findings — Step 0.1 / Step 0.5.3 (External-API Consumer Audit, 2026-04-28)

**Decision:** **0 external clients found → proceed without endpoint versioning or `X-Accept-2FA-Stage` header opt-in.**

**Method (read-only, all four procedure points covered):**

1. **Cross-org code search.**
   - `gh search code --owner=assixx '/api/v2/auth/login'` → 22 hits, **all inside `assixx/assixx`** (this monorepo: docs/curl examples, audit-helper test fixture). No other repo under the assixx org references the endpoint.
   - `gh search code --owner=SCS-Technik '/api/v2/auth/login'` → empty.
   - Tooling: `gh` v2.x, authenticated `SCS-Technik` account, scopes `repo`, `read:org`, `gist`, `workflow`.
2. **Backend OpenAPI/Swagger surface.**
   - Grep across `backend/src` for `@ApiTags`, `SwaggerModule`, `@nestjs/swagger` → **zero** matches in production code (one JSDoc-comment hit in `shift-handover/dto/update-template.dto.ts` mentions "OpenAPI clarity" but is comment-only). Swagger is not wired up. Therefore no published OpenAPI contract → no auto-generated external SDK could exist.
3. **Doppler secret inventory** (`doppler secrets --only-names`).
   - 52 secret names: only DB / Redis / SMTP / Sentry / Grafana Cloud / Microsoft OAuth / Cloudflare Turnstile / JWT / session — no `*_API_KEY`, `*_PARTNER_*`, `*_MOBILE_*`, `*_SDK_*`, `*_WEBHOOK_*` entries. No credential pattern that would suggest a non-browser external client integration.
4. **Repo top-level layout.**
   - Top-level dirs: `backend/`, `frontend/`, `shared/`, `database/`, `docker/`, `docs/`, `e2e/`, `load/`, `scripts/`, `Testing/`, `archive/`, `customer/`, plus build artefacts. **No `mobile/`, `ios/`, `android/`, `electron/`, `cli/`, `sdk/` directory.** This is a pure SvelteKit-frontend + NestJS-backend monorepo; the only non-browser callers are k6 (`load/`) and Playwright (`e2e/`) — both internal infrastructure.

**Internal consumers surfaced by the audit (NOT external — fixable in the same PR/branch as Phase 2/6, no coordination required):**

| # | Path                                                                                                                                                                                                | Behaviour                                                                                                                                                                                                                                                              | Why it is not an external blocker                                                                                                                                                                       |
| - | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | `load/lib/auth.ts:47-58`, `load/tests/baseline.ts:125-133`                                                                                                                                          | k6 load-test rig hard-codes `body.data = { accessToken, refreshToken, user: { id, tenantId } }`. Off-flag (default per DD-10) preserves the legacy shape, so load tests keep working through Phase 2-4 dev cycles. They will break the moment `FEATURE_2FA_EMAIL_ENFORCED` flips ON unless updated. | Same repo, same PR — recommendation for the Phase 2 author: extend the destructure to handle `LoginResult`, fail-loud on `stage === 'challenge_required'` so operators see "load tests need a 2FA-exempt account". Recommendation only — DoD not modified by this audit. |
| 2 | `docs/COMMON-COMMANDS.md:303,374`, `docs/how-to/HOW-TO-CURL.md:44`, `docs/how-to/HOW-TO-TEST.md:740`, `docs/PRODUCTION-AND-DEVELOPMENT-TESTING.md:278,284`, several FEAT_*_MASTERPLAN.md curl blocks | Curl one-liners extract `.data.accessToken` via `python3` / `jq`. Human-facing operator documentation only — not a runtime consumer.                                                                                                                                   | Recommendation for the Phase 6 documentation sweep author: refresh examples to `jq '.data'` (full envelope) plus a "if 2FA enforced, follow with /api/v2/auth/2fa/verify" note. Recommendation only.   |
| 3 | `backend/src/nest/common/audit/audit.helpers.test.ts:309,366,368,466`                                                                                                                               | Uses `/api/v2/auth/login` only as a path-fixture for path-to-action mapping logic. Never POSTs, never reads the response body.                                                                                                                                         | No action needed. Independent of the response shape.                                                                                                                                                    |
| 4 | `e2e/` (Playwright)                                                                                                                                                                                 | Grep across `e2e/**/*.{ts,js}` → no direct `/api/v2/auth/login` POST and no `accessToken` token-shape consumption. Playwright authenticates via the SvelteKit form action.                                                                                             | Already in scope for Phase 5 (frontend `(public)/login/+page.server.ts` modification). No additional action.                                                                                            |

**Risk register update (R13):** R13 ("Mobile / external API client breaks because login response shape changed", probability **Medium**) → audit confirms probability is now **None** within the assixx + SCS-Technik GitHub footprint. R13 mitigation ("Discriminated-union response shape only when feature flag OFF") is still the correct design — it remains the safety net for any future external client that might appear before T-Day cut-over.

**Verification record:**
- Audit run on branch checkout `feat/2fa-email` candidate (HEAD `488baa30`).
- Tooling versions: `gh` (CLI, GitHub auth verified for `SCS-Technik`), `doppler` v3.75.3.
- Owner: Backend.

| #   | Spec says  | Actual code | Decision |
| --- | ---------- | ----------- | -------- |
| —   | (none yet) |             |          |

---

## Known Limitations (V1 — deliberately excluded)

1. **No in-app 2FA recovery.** Lost-mailbox = company-IT problem (corporate-email-only customer base). Lockout-clear endpoint (DD-8) clears the 15-min lockout; user still needs to receive the next code via their (restored) mailbox. **Single-root tenants must register a second root before cutover** — documented in HOW-TO-2FA-RECOVERY.
2. **No TOTP / authenticator app** — email only per requirement. V2 may add TOTP as alternative second factor.
3. **No backup recovery codes** — see #1.
4. **No "trust this device for N days"** — every login = 2FA per requirement.
5. **No SMS / phone fallback** — email only.
6. **No WebAuthn / FIDO2 / hardware tokens** — out of scope.
7. **No bulk migration of existing users** — transparent first-time enrollment on next login post-cutover (DD-11).
8. **No self-service email change protected by 2FA** — handled by existing email-change flow; not duplicated.
9. **No multi-tenant 2FA scoping** — codes are user-scoped (one user = one tenant in current model).
10. **No 2FA bypass for admins** — root lockout-clear is a lockout-clear, not a bypass.
11. **No per-tenant pilot rollout** — single global env flag for V1. Per-tenant flag is V2 if needed.
12. **OAuth users are exempt** (DD-7) — email 2FA only on password paths.
13. **No tenant-admin notification of suspicious activity** (DD-20) — user-only to avoid user-enumeration side channel.
14. **Forgot-password reset (ADR-051) does NOT auto-login** — user proceeds to `/login`, where 2FA naturally kicks in. No special wiring needed.

---

## Post-Mortem (fill after completion)

### What went well

- (TBD)

### What went badly

- (TBD)

### Metrics

| Metric                   | Planned                                                                              | Actual |
| ------------------------ | ------------------------------------------------------------------------------------ | ------ |
| Sessions                 | 14 (+ Session 0 = DD-Sign-off DONE)                                                  |        |
| Migration files          | 1                                                                                    |        |
| New backend files        | ~13 (incl. reaper service)                                                           |        |
| New frontend files       | ~7 (incl. signup +page.server.ts)                                                    |        |
| Changed files            | ~13                                                                                  |        |
| New npm dependencies     | **0** (`@nestjs/schedule` already present per `app.module.ts` — verify in Session 7) |        |
| Unit tests               | ≥ 65                                                                                 |        |
| API tests                | ≥ 35                                                                                 |        |
| ESLint errors at release | 0                                                                                    |        |
| Spec deviations          | 0                                                                                    |        |

---

## Architectural alignment

Every decision in this plan respects existing ADRs:

- **ADR-001 (Rate Limiting)**: two new tiers (`2fa-verify`, `2fa-resend`) registered in `AppThrottlerModule` following the documented multi-tier pattern. Tracking is per-IP at the framework layer (correct for unauthenticated endpoints — JWT not yet issued). Per-token + per-user enforcement happens in service layer (`record.attemptCount`, `2fa:fail-streak:{userId}`). Existing decorators' `SkipThrottle` lists extended for tier isolation per the file-level note in `throttle.decorators.ts`.
- **ADR-002 (Alerting & Monitoring)**: SMTP-failure-rate alert provisioned as code in `docker/grafana/alerts/*.json` (Phase 5g pattern), NOT directly via Sentry. 5xx errors from 2FA endpoints flow through the existing `all-exceptions.filter.ts` Sentry capture. 2FA-related logs land in Loki with structured fields (`resource_type`, `action`) for the saved-query dashboard.
- **ADR-005 (Authentication Strategy)**: 2FA layer is additive — `JwtAuthGuard` contract unchanged. Challenge tokens are a separate, pre-auth artifact transmitted via httpOnly cookie. Fresh-DB-lookup-per-request invariant preserved.
- **ADR-006 (Multi-Tenant CLS Context)**: 2FA flow runs before CLS is populated; `tenantId` stored in challenge record (never null — tenant exists pre-user), propagated to access tokens on success.
- **ADR-007 (API Response Standardization)**: `ResponseInterceptor` wraps everything. Services return raw data.
- **ADR-009 (Central Audit Logging)**: every 2FA event flows through `audit_trail` via `(action, resource_type)` tuples per §A8 — schema-correct.
- **ADR-014 (Migration Architecture)**: single migration, generated via `db:migrate:create`, 17-digit UTC timestamp, RLS-ready (column-level GRANTs inherit from `users`).
- **ADR-019 (RLS Isolation)**: no new RLS policies needed (columns added to existing RLS-enabled `users` table). All DB writes via `tenantTransaction()` / `queryAsTenant()`.
- **ADR-020 (Per-User Permissions)**: 2FA is pre-auth, not addon-gated. No permission registrar needed.
- **ADR-030 (Zod Validation)**: all DTOs via `createZodDto()`, central `IdParamDto` factory used.
- **ADR-041 (TS Strict-Everywhere)**: discriminated union enforces compile-time exhaustiveness.
- **ADR-045 (Permission & Visibility Design)**: 2FA is below Layer 0 (it gates AuthN, not AuthZ). No interaction with the 3-layer stack.
- **ADR-046 (OAuth Sign-in)**: DD-7 = exempt. OAuth bypasses 2FA layer with explicit comment in `loginWithVerifiedUser()`.
- **ADR-050 (Tenant Subdomain Routing)**: challenge cookie set on apex during password login (where the form lives) and consumed on the same origin in `/login/verify`. Final redirect to tenant subdomain happens AFTER successful 2FA via the existing connection-ticket handoff. No cross-origin cookie travel needed.
- **ADR-051 (Forgot-Password Role-Gate)**: reset flow does NOT auto-login → user proceeds to `/login` → naturally hits 2FA. Zero new wiring.
- **ADR-053 (Navigation Map Pointer Injection)**: out of scope — this ADR uses number 054 because 053 is taken (accepted 2026-04-23).

---

**This document is the execution plan. v0.3.1 / ACCEPTED — DD sign-off complete (21/21), code-format DDs (DD-1/12/17) patched 2026-04-28 (alphanumeric Crockford-Base32 subset `A-HJKMNP-Z2-9`). Phase 1 may begin after Phase 0.5 Step 0.5.5 (dev-SMTP smoke) is DONE (Step 0.5.3 audit DONE 2026-04-28); Steps 0.5.1, 0.5.2, 0.5.4 must be DONE before T-Day cut-over.**
