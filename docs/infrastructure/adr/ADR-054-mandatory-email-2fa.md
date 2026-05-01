# ADR-054: Mandatory Email-Based Two-Factor Authentication

| Metadata                | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Date**                | 2026-05-01                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Decision Makers**     | Simon Öztürk                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Affected Components** | PostgreSQL (`users.tfa_enrolled_at`, `users.last_2fa_verified_at`, `audit_trail`), Backend (`backend/src/nest/two-factor-auth/`, `backend/src/nest/auth/`, `backend/src/nest/signup/`, `backend/src/nest/users/email-change.{controller,service}.ts`, `backend/src/utils/email-service.ts`, throttler tiers, Pino redaction), Frontend (`(public)/login/`, `(public)/signup/`, `(public)/_lib/2fa-shared.ts`), Redis (`2fa:*` keyspace), SMTP, Doppler `SMTP_FROM`. |
| **Supersedes**          | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Related ADRs**        | ADR-005 (JWT Auth), ADR-006 (CLS Context), ADR-007 (API Response Envelope), ADR-009 (Audit Trail), ADR-010 (Roles & Hierarchy), ADR-014 (Migrations), ADR-019 (RLS Isolation), ADR-020 (Per-User Permissions), ADR-027 (Dockerfile Hardening — Mailpit pin), ADR-030 (Zod Validation), ADR-041 (TS Strict-Everywhere), ADR-045 (Permission Stack — 2FA gates `Layer 0`), ADR-046 (OAuth Sign-in — exempt path), ADR-050 (Tenant Subdomain Routing).                 |

---

## Context

Until now, every Assixx login and signup terminated in a single password check. A leaked credential was a tenant takeover: there was no second factor, no email verification on the password path, no recovery story for "the password is in a public paste" beyond rotation. The same applied to signup — a typo'd or hostile email on a fresh tenant left a rogue subdomain reserved with no proof the address was reachable.

The two `users.two_factor_*` columns from a prior, never-shipped TOTP attempt were dead schema (zero references in code, confirmed by `grep` 2026-04-28).

### Threat Model

| #   | Scenario                                                                                             | Pre-2FA Behaviour                                                                                | Target Behaviour                                                                  |
| --- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| T1  | Phished/leaked password                                                                              | Tenant takeover                                                                                  | Blocked — attacker also needs the inbox                                           |
| T2  | Hostile signup with someone else's email or a typo                                                   | Subdomain squatted, dummy `users` row, no proof of reachable inbox                               | Blocked — `is_active=0` until 2FA verifies; failed delivery deletes user + tenant |
| T3  | Session hijack (XSS, stolen cookie, open laptop) → attacker swaps `users.email` to their own address | Email-change quietly accepted, all future codes routed to attacker, account permanently captured | Blocked — email-change requires **two** 2FA verifies (old + new mailbox), DD-32   |
| T4  | Code interception via mail-server archive / TLS-strip                                                | N/A                                                                                              | 10-min TTL · single-use · code only in body (DD-13 generic subject)               |
| T5  | Brute-force on the verification code                                                                 | N/A                                                                                              | 887 M-keyspace alphabet, 5 attempts → 15-min lockout, throttler tier              |
| T6  | User enumeration via `/login` or `/2fa/verify` timing                                                | Timing oracle on bad-password vs unknown-user                                                    | Constant-time `crypto.timingSafeEqual` against zero-buffer on user-not-found      |

### Constraints

1. **Greenfield deployment.** No live paying tenants on 2026-04-19+ ([CLAUDE.md L15](../../../CLAUDE.md), [ADR-050 §"Deployment Context: Greenfield Launch"](./ADR-050-tenant-subdomain-routing.md)). No cut-over choreography, no per-tenant flag, no transparent-enrollment dance for existing users.
2. **OAuth providers (Microsoft / Google) already enforce MFA upstream** ([ADR-046](./ADR-046-oauth-sign-in.md)). Layering Assixx-side email 2FA on top would punish users who already passed Azure AD / Google Workspace MFA without raising the security bar.
3. **Industrial-customer ergonomics.** Target tenants are 50–500-employee German manufacturers, often on shop-floor terminals with screen glare. The code must be typeable on a phone in dirty lighting and must never depend on confusable glyphs like `0/O` or `1/I/L`.
4. **No new external dependencies.** Every primitive needed (crypto, JWT, Redis via `ioredis`, the legacy `email-service.ts`, `CustomThrottlerGuard`, Zod, partitioned `audit_trail`) already exists in the codebase.
5. **The 2FA layer must be "before everything"** in the request lifecycle — before `JwtAuthGuard`, before any addon gate, before any management or action permission ([ADR-045](./ADR-045-permission-visibility-design.md) Layer 0).

### Requirements

1. Mandatory at every password authentication entry point — login and signup.
2. **No opt-out, no per-tenant flag, no "trust this device", no SMS, no TOTP, no authenticator app** in V1. Hardcoded in the request path.
3. Same code path for every password user, every login, every signup.
4. OAuth users (Microsoft / Google) bypass the 2FA layer — provider-side MFA is sufficient (DD-7).
5. Email-change endpoints must themselves be 2FA-protected with a _two-code_ verify (old + new mailbox), or the model is bypassable via session hijack (DD-32 / R15).
6. Failed SMTP delivery on signup must roll back **both** the `users` and `tenants` rows in the same transaction (anti subdomain-squatting, DD-14).
7. Rollback is by code revert + redeploy only; out-of-band recovery via SSH + Doppler-CLI must work without app login.
8. All state transitions audited. Cross-purpose token reuse (a code minted for `email-change-old` redeemed at `/auth/2fa/verify`) must be impossible.

---

## Decision

**Email-based 2FA is mandatory and hardcoded for every password login and signup, gated server-side by a discriminated-union response from `AuthService.login()` and `SignupService.signup()`. OAuth (`loginWithVerifiedUser()`) bypasses the layer per DD-7. Every primitive used already exists in the codebase — zero new external dependencies.**

The 21 approved design decisions ([masterplan §0.4 v0.6.0](../../FEAT_2FA_EMAIL_MASTERPLAN.md)) are the authoritative configuration. The summary below is the load-bearing subset that defines the architecture.

### Three Covered Scenarios

```
SIGNUP (apex www.assixx.com)              LOGIN (tenant <sub>.assixx.com)         OAUTH (Microsoft / Google, ADR-046)
        │                                            │                                          │
        ▼                                            ▼                                          ▼
  POST /signup                                 POST /auth/login                          POST /auth/oauth/callback
  → SignupService.signup()                     → AuthService.login()                     → AuthService.loginWithVerifiedUser()
  → tenant + user (is_active=0) committed      → credentials validated                   → DD-7 EXEMPT — issues tokens directly,
  → TwoFactorAuthService.issueChallenge        → TwoFactorAuthService.issueChallenge       2FA layer NEVER touched, no challenge
    (purpose='signup')                           (purpose='login')                          token, no Redis state, no audit row
  → SMTP send awaited                          → SMTP send awaited                          for `2fa-challenge`
  → 200 { stage: 'challenge_required',         → 200 { stage: 'challenge_required',
          challenge: { … } } + Set-Cookie              challenge: { … } } + Set-Cookie
          challengeToken=…                             challengeToken=…
        │                                            │
        ▼                                            ▼
  Frontend renders inline-card via             Frontend renders inline-card via
  <TwoFactorVerifyForm /> on /signup           <TwoFactorVerifyForm /> on /login
  POST /auth/2fa/verify { code }               POST /auth/2fa/verify { code }
  (cookie carries challengeToken)              (cookie carries challengeToken)
        │                                            │
        ▼                                            ▼
  TwoFactorAuthService.verifyChallenge         TwoFactorAuthService.verifyChallenge
  → markVerified():                            → markVerified():
      is_active = ACTIVE                           is_active untouched (already ACTIVE)
      tfa_enrolled_at = NOW() (if NULL)            tfa_enrolled_at = NOW() (if NULL)
      last_2fa_verified_at = NOW()                 last_2fa_verified_at = NOW()
  → OAuthHandoffService.mint(ticket)           → AuthService.loginWithVerifiedUser
    (cross-origin apex→subdomain)                (same-origin tenant subdomain)
  → 200 + 303 to                               → 200 + 3-cookie triad on tenant origin
    https://<sub>.assixx.com/signup/              (access · refresh · role, R8)
    oauth-complete?token=<handoff>
```

The `(public)/signup/` flow is on the apex (`www.assixx.com`) and _cannot_ set the access-token cookie on the tenant subdomain in the same response (cross-origin). The verify-success branch therefore mints an apex→subdomain handoff ticket via the existing `OAuthHandoffService` ([ADR-046](./ADR-046-oauth-sign-in.md), [ADR-050](./ADR-050-tenant-subdomain-routing.md)) and 303-redirects to the receiving page that already exists for OAuth (`(public)/signup/oauth-complete/+page.server.ts::handleHandoff`). **Zero new mechanism.**

### Permission-Stack Alignment (ADR-045 Layer 0)

```
Request
  │
  ▼
┌──────────────────────────────────────────────────────────────────┐
│ ADR-054 — Mandatory Email 2FA (this ADR, password paths only)    │  ← gate inserted BEFORE
│   • AuthService.login → discriminated LoginResult                │    everything else in
│   • TwoFactorAuthService.{issue,verify,resend}Challenge          │    the request lifecycle
│   • OAuth EXEMPT (DD-7)                                          │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
        Tokens issued · subsequent requests now run through:
               │
        ┌──────┴────────┬───────────────┬──────────────┐
        ▼               ▼               ▼              ▼
   JwtAuthGuard    Layer 0 Addon   Layer 1 Mgmt   Layer 2 Action
   (ADR-005)      (ADR-033)       Gate (ADR-045)  Permission
                                                   (ADR-020)
```

### Code Format (DD-1, v0.3.1)

| Property              | Value                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Length                | 6 characters                                                                                                                        |
| Alphabet              | `ABCDEFGHJKMNPQRSTUVWXYZ23456789` — 31-char Crockford-Base32 subset, excludes confusables `0/1/I/L/O`                               |
| Generator             | `crypto.randomInt(0, CODE_ALPHABET.length)` looped 6× — rejection-sampled internally, uniform over alphabet, no modulo bias (DD-12) |
| Keyspace              | 31⁶ ≈ 887 M permutations                                                                                                            |
| Storage               | `sha256(userId + ':' + code + ':' + purpose)` embedded in challenge record, **never** plain (DD-3)                                  |
| Compare               | `crypto.timingSafeEqual` over hex buffers (R10)                                                                                     |
| Server-side normalize | `z.string().trim().toUpperCase().regex(/^[A-HJKMNP-Z2-9]{6}$/)`                                                                     |

Brute-force probability per challenge: ≤ 5 attempts × 1/887 M ≈ **5.6 × 10⁻⁹**. `2fa-verify` throttler tier (5 req / 10 min, keyed on the challenge cookie — not IP, so industrial NAT is fair) plus the per-user 24-h fail-streak counter close the resend-evasion path.

### Time Budget (DDs 2 / 6 / 9 / 21)

| Window                              | Value      | Decision  | Stored at                                              |
| ----------------------------------- | ---------- | --------- | ------------------------------------------------------ |
| Code TTL                            | 10 min     | DD-2      | Redis key TTL on `2fa:challenge:{token}`               |
| Lockout duration (5 wrong attempts) | 15 min     | DD-5/DD-6 | `2fa:lock:{userId}` SETEX                              |
| Resend cooldown                     | 60 s       | DD-9      | `2fa:resend:{token}` SETEX                             |
| Resend extends challenge TTL        | yes (DD-9) | DD-9      | `PEXPIRE` on the challenge key                         |
| Max resends per challenge           | 3          | DD-21     | `record.resendCount` inside the JSON                   |
| Per-user fail-streak window         | 24 h       | —         | `2fa:fail-streak:{userId}` (anchored on first failure) |

Resend resets the per-challenge attempt counter to 0 (friendlier UX for slow first email) but does **not** reset the per-user 24 h fail-streak — that is the brute-force detector that survives "rapid retry across freshly-issued challenges" (DD-9 explicit).

### Data Model

**`users` columns added** (Phase 1 migration `20260428211706901_replace-2fa-state-on-users.ts`, DD-15):

| Column                   | Type          | Semantics                                                                                                                                                  |
| ------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tfa_enrolled_at`        | `TIMESTAMPTZ` | NULL = never completed 2FA. Set on first successful verify. DD-11 transparent enrollment (greenfield: always NULL on signup → set on first signup verify). |
| `last_2fa_verified_at`   | `TIMESTAMPTZ` | Updated on every successful verify. Audit / compliance read.                                                                                               |
| ~~`two_factor_secret`~~  | dropped       | Dead schema from a never-shipped TOTP attempt.                                                                                                             |
| ~~`two_factor_enabled`~~ | dropped       | Same.                                                                                                                                                      |

**Redis keyspace** (key prefix `2fa:` set on the dedicated `ioredis` client provider in `two-factor-auth.module.ts`):

| Key pattern                | TTL                                           | Purpose                                                                                                              |
| -------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `2fa:challenge:{token}`    | `CODE_TTL_SEC`                                | JSON-serialized `ChallengeRecord` (userId, tenantId, email, purpose, codeHash, attemptCount, resendCount, createdAt) |
| `2fa:lock:{userId}`        | `LOCKOUT_SEC`                                 | EXISTS-only sentinel (15 min user lockout)                                                                           |
| `2fa:fail-streak:{userId}` | `FAIL_STREAK_TTL_SEC` (24 h, anchored on 0→1) | INCR counter, brute-force detector across freshly-issued challenges                                                  |
| `2fa:resend:{token}`       | `RESEND_COOLDOWN_SEC` (60 s)                  | EXISTS-only sentinel for per-token resend cooldown                                                                   |

**Audit tuples** ([ADR-009](./ADR-009-central-audit-logging.md) `audit_trail.action VARCHAR(50)` is a flat verb — dotted strings like `2fa.code.issued` violate the schema, so events encode as `(action, resource_type)`):

| Event                                  | action   | resource_type   | status    | changes (JSONB)                                         |
| -------------------------------------- | -------- | --------------- | --------- | ------------------------------------------------------- |
| Code issued (login / signup)           | `create` | `2fa-challenge` | `success` | `{ purpose }`                                           |
| Code resent                            | `create` | `2fa-challenge` | `success` | `{ purpose, kind: 'resend' }`                           |
| Verify success                         | `login`  | `auth`          | `success` | `{ method: '2fa-email' }`                               |
| Verify fail (wrong code)               | `login`  | `auth`          | `failure` | `{ reason: 'wrong-code', attempt: N }`                  |
| Verify fail (expired)                  | `login`  | `auth`          | `failure` | `{ reason: 'expired-challenge' }`                       |
| Lockout triggered                      | `update` | `2fa-lockout`   | `success` | `{ reason: 'max-attempts' }`                            |
| Lockout cleared (root, two-root rule)  | `delete` | `2fa-lockout`   | `success` | `{ clearedBy, target }`                                 |
| Email-change request (old / new sides) | `create` | `2fa-challenge` | `success` | `{ purpose: 'email-change-old' \| 'email-change-new' }` |
| Email-change verify success            | `update` | `user-email`    | `success` | `{ oldEmail, newEmail }`                                |
| Email-change verify fail               | `update` | `user-email`    | `failure` | `{ reason, side: 'old' \| 'new' \| 'both' }`            |

### Defense-in-Depth Properties

1. **Cross-purpose redemption is impossible.** `ChallengePurpose` is a discriminated string (`'login' | 'signup' | 'email-change-old' | 'email-change-new'`). `verifyChallenge` rejects on purpose mismatch _inside the shared primitive_ before any state mutation; `LoginChallengePurpose` narrows the type so email-change purposes cannot reach `markVerified()`'s state-mutation branch (Step 2.12 / DD-32).
2. **Challenge token never in body.** Set as `httpOnly`+`Secure`+`SameSite=Lax` cookie; `maxAge` derived from `CODE_TTL_SEC` so cookie-vs-Redis-record divergence is structurally impossible (R8).
3. **Constant-time everywhere.** User-not-found path runs a dummy `crypto.timingSafeEqual` against a 32-byte zero buffer (R10).
4. **Pino redaction.** `req.body.code`, `req.body.challengeToken`, `*.code`, `*.challengeToken` added to `LOGGER_REDACT_PATHS` (DD-18).
5. **Throttler keyed on challenge cookie.** `2fa-verify` (5 / 10 min) and `2fa-resend` (1 / 60 s) tiers' `getTracker` reads the cookie — industrial NAT customers don't false-positive (the original IP-keyed draft would have nuked entire factories sharing one egress IP).
6. **DD-14 fail-loud SMTP rollback.** Login: `503 ServiceUnavailable`, no zombie code in Redis (the just-created challenge is consumed before throwing). Signup: same `503` _plus_ the `cleanupFailedSignup()` path deletes the `tenants` row (which cascades to the user) — without tenant cleanup, a hostile actor could squat any premium subdomain by signup + tab-close.
7. **DD-32 two-code email-change.** `users/email-change.{controller,service}.ts` issues two challenges (old + new mailbox) atomically; `verifyChange` accepts both codes in a single body and commits the `UPDATE users SET email = …` only when both verify, in one `tenantTransaction()`. Anti-persistence: a wrong code on either side DEL's _both_ tokens, raises `UnauthorizedException`, and (old-side wrong) sends a DD-20 suspicious-activity mail to the **current** address.
8. **DD-20 silent paper-trail.** Suspicious-activity mail on lockout goes to the user only — never to tenant-admin. A "did the admin get a mail about user X?" side channel would re-enable the user-enumeration we just closed (R10).
9. **No in-app recovery.** Lost mailbox is a corporate-IT problem (DD-8). The `POST /users/:id/2fa/clear-lockout` endpoint clears the _15-min lockout_ — not the 2FA requirement. Two-root rule applies: caller ≠ target, both must be root. ([HOW-TO-2FA-RECOVERY.md](../../how-to/HOW-TO-2FA-RECOVERY.md), to be written.)

### What Greenfield Lets Us Skip

CLAUDE.md L15 + ADR-050 Greenfield-Launch context lets several DDs be retired or sidelined:

| DD                                       | Greenfield Status  | Reason                                                                                                          |
| ---------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| DD-10 (soft-rollout flag)                | **Removed v0.5.0** | "Kein Einstellung auszustellen" (Simon Öztürk 2026-04-28). Hardcoded; rollback only via code revert + redeploy. |
| DD-11 (transparent enrollment)           | N/A                | All users start fresh with 2FA active. No pre-/post-flip state.                                                 |
| DD-22 (cutover strategy + 14-day buffer) | N/A                | T-Day = Public-Launch-Day.                                                                                      |
| DD-23 (per-tenant 2FA flag)              | N/A — stays "no"   | Applied uniformly. KISS.                                                                                        |
| DD-26/27/28 (pre-deploy mail timing)     | N/A                | No recipients exist.                                                                                            |
| DD-31 (post-cutover monitoring window)   | N/A                | Standard alerting from Public-Launch is sufficient.                                                             |
| Step 0.5.1 (single-root detection)       | N/A                | No tenants exist to detect on. Detection query preserved as monitoring tool for Customer Success post-launch.   |
| Step 0.5.7 (sender warm-up)              | N/A                | Organic warm-up via the first real signups (1–10 mails/day matches the warm-up curve naturally).                |

The plan keeps all of these textually for a future re-cut-over — but the implementation does not carry a single line of "if greenfield, skip X" logic. The skips happen at the masterplan level, not at runtime.

---

## Implementation Topology

| Layer                                      | Component                                                                                                                                              | File                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| DB                                         | Schema migration (drop legacy + add 2 columns)                                                                                                         | `database/migrations/20260428211706901_replace-2fa-state-on-users.ts`                                         |
| DI                                         | Dedicated `ioredis` client (`keyPrefix: '2fa:'`)                                                                                                       | `backend/src/nest/two-factor-auth/two-factor-auth.module.ts`                                                  |
| DI token                                   | `TWO_FA_REDIS` symbol leaf file (avoids `import-x/no-cycle`)                                                                                           | `backend/src/nest/two-factor-auth/two-factor-auth.tokens.ts`                                                  |
| Crypto + Redis primitives                  | `TwoFactorCodeService` — 14 methods (createChallenge, verifyCode w/ timingSafeEqual, lockout, fail-streak, resend cooldown)                            | `backend/src/nest/two-factor-auth/two-factor-code.service.ts`                                                 |
| Orchestration                              | `TwoFactorAuthService` — `issueChallenge` / `verifyChallenge` / `resendChallenge` / `clearLockoutForUser` / `markVerified`                             | `backend/src/nest/two-factor-auth/two-factor-auth.service.ts`                                                 |
| Controller (verify + resend)               | 2 endpoints, separate file from lockout controller per `max-classes-per-file: 1`                                                                       | `backend/src/nest/two-factor-auth/two-factor-auth.controller.ts`                                              |
| Controller (lockout-clear)                 | 1 endpoint, separate file per ESLint                                                                                                                   | `backend/src/nest/two-factor-auth/two-factor-lockout.controller.ts`                                           |
| Cron — stale-pending reaper (every 15 min) | `@Cron('0 */15 * * * *')` purge of `is_active=0` users + their orphaned tenants ([§D4 FK migration queued v0.8.4](../../FEAT_2FA_EMAIL_MASTERPLAN.md)) | `backend/src/nest/two-factor-auth/two-factor-auth-reaper.service.ts`                                          |
| Login integration                          | `AuthService.login()` returns `Promise<LoginResult>` (discriminated union)                                                                             | `backend/src/nest/auth/auth.service.ts:222`                                                                   |
| OAuth-exempt                               | `AuthService.loginWithVerifiedUser()` — DD-7 comment block above; logic byte-identical                                                                 | `backend/src/nest/auth/auth.service.ts:278`                                                                   |
| HTTP wiring                                | `setChallengeCookie()` helper + branch on `result.stage`                                                                                               | `backend/src/nest/auth/auth.controller.ts:232`, `:364`                                                        |
| Signup integration                         | `SignupService.signup()` issues challenge instead of tokens, `is_active=INACTIVE`                                                                      | `backend/src/nest/signup/signup.service.ts`                                                                   |
| Email-change two-code (DD-32)              | `request-change` + `verify-change` endpoints                                                                                                           | `backend/src/nest/users/email-change.{controller,service}.ts`                                                 |
| Mail send + template                       | `send2faCode()` + `send2faSuspiciousActivity()` exports + Klarna-DE 6-box template                                                                     | `backend/src/utils/email-service.ts:812,892`, `backend/src/utils/email-templates/2fa-code.template.ts`        |
| Throttler tiers                            | `2fa-verify` (5 / 10 min), `2fa-resend` (1 / 60 s) — both keyed on challenge cookie                                                                    | `backend/src/nest/throttler/throttler.module.ts`, `backend/src/nest/common/decorators/throttle.decorators.ts` |
| Pino redaction                             | DD-18: `req.body.code`, `req.body.challengeToken`, `*.code`, `*.challengeToken`                                                                        | `backend/src/nest/common/logger/logger.constants.ts`                                                          |
| Frontend — login                           | Inline-card UX (v0.8.1): `(public)/login/+page.svelte` swaps body to `<TwoFactorVerifyForm />` when `data.stage === 'verify'`                          | `frontend/src/routes/(public)/login/{+page.server.ts,+page.svelte,_lib/}`                                     |
| Frontend — signup                          | Same inline-card pattern (v0.8.2), cross-origin handoff on verify-success                                                                              | `frontend/src/routes/(public)/signup/{+page.server.ts,+page.svelte,_lib/}`                                    |
| Frontend — i18n                            | Shared `2fa-shared.ts` (v0.8.3): 6 protocol constants + 17 byte-identical `COMMON_MESSAGES` strings                                                    | `frontend/src/routes/(public)/_lib/2fa-shared.ts`                                                             |

### Configuration Constants (single source of truth)

`backend/src/nest/two-factor-auth/two-factor-auth.constants.ts`:

```typescript
export const CODE_TTL_SEC = 600; // DD-2 — 10 min
export const MAX_ATTEMPTS = 5; // DD-5
export const LOCKOUT_SEC = 900; // DD-6 — 15 min
export const RESEND_COOLDOWN_SEC = 60; // DD-9
export const MAX_RESENDS_PER_CHALLENGE = 3; // DD-21
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // DD-1, DD-12
export const CODE_LENGTH = 6; // DD-1
export const FAIL_STREAK_TTL_SEC = 86_400; // 24 h, anchored on 0→1 INCR
```

These are the only knobs. Every service reads from this file — security review can audit every TTL and cap in one place.

---

## Alternatives Considered

### A. TOTP (Authenticator-App) instead of email codes

- **Pro:** No SMTP dependency. Faster verify (no inbox round-trip). Industry-standard.
- **Con:** Requires onboarding ("scan this QR code"). Lost-phone recovery story is non-trivial — backup codes or admin reset, both of which were V2 anyway. Industrial-customer base (50–500-employee German manufacturers) is not uniformly smartphone-equipped on the shop floor.
- **Con:** Doesn't double as proof-of-mailbox at signup. We'd still need email verification for signup, so we'd be running two MFA factors.
- **Rejected.** Email is the universal common factor for B2B SaaS targeting industrial customers; it doubles as signup verification; and the existing `email-service.ts` plus a new template is half a day of work vs. weeks of TOTP UX + recovery.

### B. SMS codes

- **Pro:** Highest reach (every employee has a phone).
- **Con:** SIM-swap attack vector. NIST SP 800-63B classifies SMS as "restricted" (effectively deprecated). Per-message cost. Number-portability friction. International dialling pain.
- **Rejected.** Strictly worse than email on every axis we care about.

### C. "Trust this device" / remember-me cookie

- **Pro:** Friendlier UX after the first login.
- **Con:** Defeats the threat model — the cookie _becomes_ the second factor and is stealable via the same XSS / cookie-theft vectors that the original password was. A "cookie + password" tuple is functionally a single factor.
- **Rejected.** "No remember-device, every session" was a hard requirement.

### D. Per-tenant 2FA on/off flag

- **Pro:** Lets enterprise tenants opt out for SSO-only deployments.
- **Con:** Doubles every code path (with-2FA / without-2FA) at zero short-term gain — there are no live tenants to opt in or out. The opt-out value re-emerges only when a SSO-mandatory tenant exists, at which point a per-tenant flag is the obvious V2 increment.
- **Rejected for V1.** YAGNI per Greenfield-Trim (DD-23, v0.6.0).

### E. Doppler-side feature flag (`FEATURE_2FA_EMAIL_ENFORCED`)

- **Pro:** Soft-rollout; instant kill-switch on incident.
- **Con:** The flag itself becomes an attack vector — a Doppler compromise or a single misclick disables MFA tenant-wide silently. The kill-switch value approaches zero in a greenfield: no traffic to "save" by disabling.
- **Rejected v0.5.0** per Simon Öztürk explicit direction "kein Einstellung auszustellen, period, as simple as that". Rollback path is code revert + redeploy (~10–30 min); out-of-band recovery via SSH + Doppler-CLI for SMTP-provider switch is documented in masterplan §0.1a.

### F. Mandate 2FA also for OAuth users

- **Pro:** Uniform UX. Same code path everywhere.
- **Con:** Microsoft / Google already enforce MFA upstream. Adding Assixx-side email 2FA on top punishes the user without raising the security bar; we'd just be running the user's own MFA twice.
- **Con:** Breaks the OAuth value proposition ("one click sign-in").
- **Rejected.** DD-7 OAuth-exempt is explicit. `loginWithVerifiedUser()` in `auth.service.ts:278` carries the comment block linking back to this ADR.

### G. Bind 2FA into a separate microservice

- **Pro:** Bounded context isolation; could be reused by a future mobile app.
- **Con:** Network hop in the auth path. New deployment surface. New monitoring surface. None of this is needed at current scale.
- **Rejected.** A NestJS module gives us bounded-context isolation without the operational tax.

### H. Issue access tokens immediately on signup (delayed verify)

- **Pro:** Faster signup completion.
- **Con:** Subdomain squatting (R-anti-squat). A typo in the email address gives the attacker an active account on a premium subdomain with no path to recover. Defeats DD-14's anti-squatting guarantee.
- **Rejected.** Signup user starts at `is_active=0` and gets activated only on successful 2FA verify; failed delivery deletes both rows.

---

## Consequences

### Positive

1. **Tenant takeover blocked at the password gate.** Phished/leaked credentials alone are no longer sufficient to log in (T1).
2. **Subdomain squatting blocked.** Hostile-email signups never activate; failed-delivery cleanup deletes both `users` and `tenants` rows in one transaction (T2 / DD-14).
3. **Email-change cannot bypass 2FA.** Two-code verify (old + new) means a session-hijacker without simultaneous control of _both_ mailboxes within 10 minutes cannot redirect future codes to themselves (T3 / DD-32 / R15).
4. **Same code path for every password user, every session.** No flag-driven branching, no "trust this device" exception, no opt-out that needs to be tested separately. Reasoning surface is single.
5. **OAuth users are uncompromised.** Microsoft / Google MFA upstream is sufficient; the OAuth path doesn't lose its one-click value proposition.
6. **Audit-complete.** Every state transition writes one `audit_trail` row with the §A8 tuple — issued, resent, verified, locked-out, lockout-cleared, email-change requested/verified/failed.
7. **Industrial-friendly code format.** Crockford-Base32 subset — typeable on a phone in dirty lighting, no 0/O / 1/I/L confusables, 887 M keyspace.
8. **Fail-loud SMTP.** No silent degradation. A broken SMTP path returns 503 and (signup) deletes the half-created tenant — operators see the real failure, not a slow zombie account.
9. **Defense-in-depth at the data layer.** Codes are stored hashed with `userId + ':' + code + ':' + purpose` — even a Redis snapshot leak doesn't hand the attacker codes redeemable at `/auth/2fa/verify`.
10. **No new dependencies.** Every primitive (`crypto`, JWT, `ioredis`, `email-service.ts`, `CustomThrottlerGuard`, Zod, `audit_trail`) was already in the codebase. Phase 2 added zero `package.json` entries.

### Negative

1. **Every login costs one SMTP send.** A ~250 ms latency hit per login plus ~€-cents-per-thousand at the SMTP-provider tier. Mitigated by: organic-only volume in greenfield; cache-friendly behaviour (verify is cookie-bound).
2. **SMTP outage = all password logins blocked.** Mitigated by Grafana SMTP-fail-rate alert (§Phase 6 Operational, queued), Out-of-Band SSH + Doppler-CLI for provider switch (masterplan §0.1a), and Step 0.5.6 Production-SMTP smoke before first paying tenant.
3. **No in-app recovery story.** Lost mailbox = company-IT problem, not Assixx-support problem. `POST /users/:id/2fa/clear-lockout` only clears the 15-min lockout, not the 2FA requirement (DD-8). HOW-TO-2FA-RECOVERY.md will document the corporate-IT-restores-mailbox path; Two-Root rule means every tenant should have ≥ 2 root users (R12 mitigation).
4. **Frontend complexity grew.** `(public)/login/+page.svelte` and `(public)/signup/+page.svelte` now both render a discriminated-union UI (credentials stage vs verify stage). The shared `2fa-shared.ts` module carries the drift surface for the 23 previously-duplicated strings (v0.8.3).
5. **Reaper FK assumption mismatch (queued §D4).** The stale-pending reaper's `dropTenantCascade` branch was authored on the assumption that `users.tenant_id` has `ON DELETE CASCADE`. Live FK is `RESTRICT`. The soft-delete branch works as documented; the cascade branch fails in production. Tracked as Phase 6 Operational item — single `ALTER CONSTRAINT` migration, no data movement, must land before first paying tenant. Until then, an abandoned signup whose tenant has no other users leaves the subdomain reserved indefinitely.

### Neutral

1. **Throttler tier addition.** Two new tiers (`2fa-verify`, `2fa-resend`) were added; every existing decorator's `SkipThrottle` list was extended with both. Standard pattern; no new abstraction.
2. **`audit_trail` resource_type vocabulary grew.** New types: `2fa-challenge`, `2fa-lockout`, `user-email`. `audit_trail.resource_type VARCHAR(50)` accommodates them without a schema change.
3. **OAuth path is unchanged.** Only a comment block was added above `loginWithVerifiedUser()`. Behaviour byte-identical (verified by Phase 4 OAuth regression sentinel test).
4. **Phase 5 i18n centralization happened opportunistically.** v0.8.3's shared-module extraction was a refactor on top of v0.8.1 + v0.8.2 — not strictly required by the 2FA decision, but worth landing in the same masterplan because the same files were being edited.

### Risks & Mitigations

| Risk                                                    | Mitigation                                                                                                                                                             | Verification                                                                                                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 — User loses email access                            | DD-8 documented runbook (corporate IT restores mailbox) + Two-Root Rule on lockout-clear                                                                               | Manual: trigger lockout, root clears, user retries                                                                                                          |
| R2 — Brute-force on 6-char alphanumeric code            | 887 M keyspace + 5-attempt cap + 15-min lockout + `2fa-verify` throttler                                                                                               | Unit tests: 6 wrong codes → ForbiddenException + lockout; alphabet conformance over 10 000 samples                                                          |
| R3 — Email delivery failure / latency                   | Send awaited; 503 on failure; signup also deletes tenant; Sentry + Grafana SMTP-fail-rate alert                                                                        | Manual: kill SMTP → graceful 503, no 500                                                                                                                    |
| R6 — Code interception via mail-server archive          | 10-min TTL · single-use · hashed at rest · generic subject (DD-13)                                                                                                     | Read Redis → only hashes visible                                                                                                                            |
| R7 — Race: parallel resends                             | Single Redis key per challenge, `SET` overwrites; resend updates same record                                                                                           | Unit test: two consecutive `requestCode()` → only second works                                                                                              |
| R8 — Challenge-token theft                              | 32-byte opaque token, single-use (DEL on consume), `httpOnly`+`Secure`+`SameSite=Lax` cookie, `maxAge` derived from `CODE_TTL_SEC`                                     | Unit test: reuse consumed challenge → 401                                                                                                                   |
| R9 — Sensitive data in logs                             | Pino redact paths in `logger.constants.ts` (DD-18)                                                                                                                     | Grep production-shape logs for known test code → no match                                                                                                   |
| R10 — User enumeration via timing                       | Constant-time `crypto.timingSafeEqual` against zero-buffer on user-not-found                                                                                           | Time 1 000 valid-vs-invalid requests → no statistical signal                                                                                                |
| R11 — Doppler `SMTP_*` missing in production            | `AppConfigService` Zod env schema fails fast at startup                                                                                                                | Deploy with secret missing → fast crash, not silent 500                                                                                                     |
| R12 — Initial root user (very first install)            | First root signup runs through 2FA against the email entered during install                                                                                            | Fresh-install smoke test                                                                                                                                    |
| R13 — External API client breaks (login response shape) | Step 0.5.3 audit confirmed 0 external clients (2026-04-28); load-tests in same repo migrated v0.6.3 to discriminated-union helper                                      | `pnpm exec tsc --noEmit -p load` exit 0 (CI gate)                                                                                                           |
| R14 — Cross-subdomain cookie scope (apex vs subdomain)  | Login is same-origin (tenant subdomain). Signup uses apex→subdomain handoff via `OAuthHandoffService` (existing ADR-046 / ADR-050 mechanism, zero new code)            | Manual: signup verify on `www.assixx.com/signup` → handoff to `<sub>.assixx.com/signup/oauth-complete?token=…` → tokens land on tenant origin               |
| R15 — Email-change bypass via session hijack            | DD-32 two-code verify (old + new mailbox), purpose-narrowed challenge types, both-codes-must-verify-in-one-transaction, anti-persistence DEL on either-side wrong code | Phase 4 integration sims: Hijack-Sim (wrong codeOld) / Tippfehler-Sim (wrong codeNew) / Bombing-Sim (AuthThrottle 429) — all 3 green Session 10b 2026-04-30 |

---

## Verification

### Automated coverage at acceptance time

| Suite                       | Files | Result                                                                                                      | Reference                               |
| --------------------------- | ----- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Backend unit                | 284   | 7277 / 7277 passing                                                                                         | `pnpm exec vitest run --project unit`   |
| Backend API integration     | 55    | 1050 / 1055 (5 documented `it.skip`)                                                                        | `pnpm exec vitest run --project api`    |
| Frontend svelte-check       | 2593  | 0 errors / 0 warnings                                                                                       | `cd frontend && pnpm exec svelte-check` |
| ESLint backend              | —     | exit 0                                                                                                      | `pnpm exec eslint backend/src`          |
| ESLint frontend             | —     | exit 0                                                                                                      | `cd frontend && pnpm exec eslint .`     |
| TypeScript strict           | —     | exit 0 on shared / backend / frontend / backend/test (ADR-041)                                              | `pnpm run type-check`                   |
| Load tests (k6, post-DD-10) | —     | discriminated-union `loginGeneric` helper, fail-loud on `stage='challenge_required'` for non-OAuth fixtures | `pnpm exec tsc --noEmit -p load` exit 0 |

### Manual verification per scenario

```bash
# === SIGNUP — happy path ===
# 1) POST /signup with a fresh subdomain + valid email
# 2) Receive 200 { stage:'challenge_required', challenge:{…} } + Set-Cookie challengeToken=…
# 3) Capture code from Mailpit (dev) / real inbox (prod)
# 4) POST /auth/2fa/verify { code } — 200, 303 to <sub>.assixx.com/signup/oauth-complete?token=…
# 5) DB state: users.is_active = 1, users.tfa_enrolled_at = NOW(), users.last_2fa_verified_at = NOW()
# 6) audit_trail rows: (create, 2fa-challenge, success, {purpose:'signup'})
#                      (login, auth, success, {method:'2fa-email'})

# === LOGIN — happy path ===
# Same 1-4, then loginWithVerifiedUser issues 3-cookie triad on tenant origin (R8 — tokens NEVER in body)

# === LOGIN — wrong code lockout ===
# Submit 5 wrong codes. 6th attempt → 403 ForbiddenException (locked).
# Redis: EXISTS 2fa:lock:{userId} = 1; TTL ≈ 900s.
# audit_trail: (update, 2fa-lockout, success, {reason:'max-attempts'}).
# A new login attempt during the 15-min window also gets 403.

# === LOCKOUT-CLEAR — Two-Root Rule ===
# As Root B (≠ locked Root A): POST /users/:idOfRootA/2fa/clear-lockout → 200.
# Redis: EXISTS 2fa:lock:{userId} = 0; fail-streak DEL'd.
# audit_trail: (delete, 2fa-lockout, success, {clearedBy: rootB.id, target: rootA.id}).
# Note: this clears the lockout, NOT the 2FA requirement — Root A still needs to pass 2FA on next login.

# === EMAIL-CHANGE — DD-32 Hijack-Sim ===
# Stolen session attempts: POST /users/me/email/request-change { newEmail:'attacker@evil.com' }
# → two challenges issued (old + new), two cookies set, two mails sent
# → attacker has codeNew but NOT codeOld → submits guess for codeOld
# → POST /users/me/email/verify-change { codeOld:'WRONG', codeNew:'…' } → 401
# → Redis: BOTH challenge tokens DEL'd (anti-persistence)
# → suspicious-activity mail sent to OLD address (DD-20)
# → users.email unchanged — attack failed safely

# === OAUTH (DD-7) — sentinel ===
# POST /auth/oauth/callback (with valid Microsoft / Google token)
# → 200 + 3-cookie triad immediately, NO challenge cookie, NO 2fa-challenge audit row.
# Verified by Phase 4 OAuth regression sentinel test (Session 10b).
```

### Pre-launch check (Public-Launch L-1, masterplan §Phase 6)

| Step                                                                   | Status                                       |
| ---------------------------------------------------------------------- | -------------------------------------------- |
| 0.5.2 SPF/DKIM/DMARC mail-tester ≥ 9/10                                | PENDING (DevOps, before first tenant)        |
| 0.5.4 Apex→Subdomain wildcard A + cert verify                          | PENDING (DevOps, before first tenant)        |
| 0.5.6 Production-SMTP end-to-end smoke (Outlook / Gmail / GMX)         | PENDING (DevOps, before first tenant)        |
| FK-migration §D4 (`fk_users_tenant` RESTRICT → CASCADE)                | PENDING (Phase 6 Operational, queued v0.8.4) |
| Doppler `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` set on prod | PENDING (DevOps verification)                |

---

## References

### Implementation

- [`backend/src/nest/two-factor-auth/`](../../../backend/src/nest/two-factor-auth/) — module
- [`backend/src/nest/auth/auth.service.ts:222`](../../../backend/src/nest/auth/auth.service.ts) — `login()` discriminated-union return
- [`backend/src/nest/auth/auth.service.ts:278`](../../../backend/src/nest/auth/auth.service.ts) — `loginWithVerifiedUser()` (DD-7 OAuth-exempt; comment block points back to this ADR)
- [`backend/src/nest/auth/auth.controller.ts:232`](../../../backend/src/nest/auth/auth.controller.ts) — `setChallengeCookie()` helper
- [`backend/src/nest/users/email-change.{controller,service}.ts`](../../../backend/src/nest/users/) — DD-32 two-code email-change flow
- [`backend/src/utils/email-service.ts:812,892`](../../../backend/src/utils/email-service.ts) — `send2faCode` / `send2faSuspiciousActivity`
- [`backend/src/utils/email-templates/2fa-code.template.ts`](../../../backend/src/utils/email-templates/2fa-code.template.ts) — Klarna-DE 6-box dark-mode template (Step 2.9b)
- [`backend/src/nest/two-factor-auth/two-factor-auth.constants.ts`](../../../backend/src/nest/two-factor-auth/two-factor-auth.constants.ts) — single source of truth for TTLs / caps
- [`database/migrations/20260428211706901_replace-2fa-state-on-users.ts`](../../../database/migrations/20260428211706901_replace-2fa-state-on-users.ts) — Phase 1 migration
- [`frontend/src/routes/(public)/_lib/2fa-shared.ts`](<../../../frontend/src/routes/(public)/_lib/2fa-shared.ts>) — frontend i18n single source of truth (v0.8.3)
- [`frontend/src/routes/(public)/{login,signup}/_lib/`](<../../../frontend/src/routes/(public)/>) — inline-card UX (v0.8.1 / v0.8.2)

### Plan + Process

- [`docs/FEAT_2FA_EMAIL_MASTERPLAN.md`](../../FEAT_2FA_EMAIL_MASTERPLAN.md) — execution masterplan, version 0.8.4 — authoritative for all 21 DDs, the §0.2 risk register, the §A8 audit-tuple table, and the Public-Launch-Readiness-Checklist
- [`docs/how-to/HOW-TO-2FA-RECOVERY.md`](../../how-to/HOW-TO-2FA-RECOVERY.md) — runbook (Phase 6, NEW; lost-mailbox flow + Two-Root lockout-clear + Two-Root requirement, DD-30)
- [`docs/how-to/HOW-TO-DEV-SMTP.md`](../../how-to/HOW-TO-DEV-SMTP.md) — Mailpit dev-SMTP (Step 0.5.5, DD-25)
- [`docs/how-to/HOW-TO-CREATE-TEST-USER.md`](../../how-to/HOW-TO-CREATE-TEST-USER.md) — bootstrap incl. 2FA verify step

### Related ADRs (cross-cutting)

- [ADR-005](./ADR-005-authentication-strategy.md) — JWT guard runs _after_ the 2FA gate completes
- [ADR-006](./ADR-006-multi-tenant-context-isolation.md) — CLS context populated post-verify in `loginWithVerifiedUser()`
- [ADR-007](./ADR-007-api-response-standardization.md) — Response envelope shape; `LoginResultBody` (R8: tokens never in body)
- [ADR-009](./ADR-009-central-audit-logging.md) — `audit_trail` (`action`, `resource_type`) flat-verb constraint forced the §A8 tuple encoding
- [ADR-010](./ADR-010-user-role-assignment-permissions.md) — Roles & Two-Root Rule for lockout-clear
- [ADR-014](./ADR-014-database-migration-architecture.md) — Migration discipline (backup + dry-run + generator-only)
- [ADR-019](./ADR-019-multi-tenant-rls-isolation.md) — RLS — `markVerified()` writes via `tenantTransaction()`, never `query()`
- [ADR-020](./ADR-020-per-user-feature-permissions.md) — Layer 2 (action permissions) downstream of this ADR
- [ADR-027](./ADR-027-dockerfile-hardening.md) — Mailpit container pinning (DD-25 v0.4.x)
- [ADR-030](./ADR-030-zod-validation-architecture.md) — Verify-code DTO (`z.string().trim().toUpperCase().regex(...)`)
- [ADR-041](./ADR-041-typescript-compiler-configuration.md) — Strict-everywhere lets the discriminated `LoginResult` enforce exhaustiveness at compile time
- [ADR-045](./ADR-045-permission-visibility-design.md) — Permission Stack; this ADR inserts the gate at Layer 0
- [ADR-046](./ADR-046-oauth-sign-in.md) — OAuth providers enforce MFA upstream — DD-7 exempt; cross-origin handoff mechanism reused for signup
- [ADR-050](./ADR-050-tenant-subdomain-routing.md) — Greenfield-Launch deployment context; apex→subdomain bridge for signup verify-success

### External

- [adr.github.io](https://adr.github.io/) — ADR concept, status vocabulary, Y-statement / Nygard / MADR templates
- [NIST SP 800-63B AAL1+](https://pages.nist.gov/800-63-3/sp800-63b.html) — verification-code lifetime + length recommendations (≤ 10 min, ≥ 6 chars high-entropy)
- [Crockford Base32](https://www.crockford.com/base32.html) — alphabet rationale (excludes confusables `0/1/I/L/O`)
- [Mailpit official docs](https://mailpit.axllent.org/docs/) — anonymous-SMTP behaviour clarification (informed v0.7.1 hotfix in `email-service.ts`)
