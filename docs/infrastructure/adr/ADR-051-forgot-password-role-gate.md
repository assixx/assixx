# ADR-051: Forgot-Password Role-Gate + Root-Initiated Reset

| Metadata                | Value                                                                                                                                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                                                                                                                                                                                  |
| **Date**                | 2026-04-21                                                                                                                                                                                                                                                |
| **Decision Makers**     | SCS-Technik Team (Simon Öztürk + Staff-Engineer assist)                                                                                                                                                                                                   |
| **Affected Components** | Backend (`auth/`, `users/`, `common/audit/`, `common/services/mailer.service.ts`, `app.module.ts`), CLS context, `password_reset_tokens` table + migration 140, two email templates, Frontend (`/forgot-password`, `/manage-admins`, `/manage-employees`) |
| **Supersedes**          | —                                                                                                                                                                                                                                                         |
| **Related ADRs**        | ADR-005 (JWT), ADR-006 (CLS Tenant-Context), ADR-010 (Roles & Hierarchy), ADR-019 (Multi-Tenant RLS), ADR-045 (Permission & Visibility Design), ADR-046 (Microsoft OAuth), ADR-049 (Tenant Domain Verification)                                           |

---

## Context

Before this ADR, `/auth/forgot-password` issued a reset link for any account whose `is_active = 1`. All three roles (root / admin / employee) were treated identically. Three problems emerged from a ground-truth review of the multi-tenant SaaS threat surface:

1. **Blast-radius of admin compromise.** An attacker who gained read access to an admin's mailbox could trigger a reset, redeem the link, and overwrite the password. Admins control management surfaces (users, departments, feature permissions, addon activations). A single compromised admin could escalate to tenant-root scope in minutes because "reset the password" is the shortest path from "reads one email" to "writes one new credential".

2. **Employee self-service is the wrong recovery path.** Employees in industrial tenants frequently share kiosks, factory-line tablets, or shift-handover devices — the mailbox that would receive a reset link is often not the employee's personal mailbox. The HR-mandated recovery path in the target market is "talk to the Root admin", but the code did not enforce it.

3. **Admins need a delegated recovery lane.** A Root still wants to be able to issue a reset link to an admin or employee in their tenant on request — but with strict separation of duties: the Root issues the vehicle, the target user sets the password. The Root never sees the new credential.

### Requirements

1. Only `root` may self-reset via `/auth/forgot-password`.
2. Admin/employee reset tokens must not be redeemable even if the attacker already holds a valid token (DB leak, pre-plan-era issuance, offline copy, backup restore).
3. Root can issue a reset link for an admin or employee in the same tenant; the target user sets the password.
4. Preserve the existing no-leak contract: non-existent and inactive users silently drop — no active/inactive oracle, no role-oracle via differentiated error codes on the common paths.
5. Must compose with the existing authentication surface (JWT + CLS + RLS + OAuth) without introducing new attack paths.
6. Must not require new rate-limit infrastructure — no new Redis tier, no new throttler module.

### Threat Model

| Actor                                                                    | Capability                                     | Mitigation in this ADR                                                                                                                           |
| ------------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| External attacker with admin's email address                             | Can POST `/auth/forgot-password`               | **Request gate** blocks at role-check; blocked email is delivered as paper trail naming IP + timestamp.                                          |
| External attacker holding a valid admin token (DB leak, historical copy) | Can POST `/auth/reset-password`                | **Redemption gate** re-checks role; token is burned on block. Single-use, irreversible.                                                          |
| Compromised Root triggers reset chain against other Roots in tenant      | Could serially seize every Root                | Root-on-Root admin-initiated reset rejected at issuance (`INVALID_TARGET_ROLE`). A second Root uses `/forgot-password` self-service instead.     |
| Ex-Root (demoted/deleted) issues token, target redeems later             | Could exfiltrate via stale link                | Redemption gate re-verifies initiator lifecycle: must still be `role='root'`, `is_active=1`, same tenant. Failure → burn + 401 generic.          |
| Role-enumeration via differential response                               | Probe response delta to distinguish admin/root | Root-happy-path and silent-drop return byte-identical bodies. Blocked path reveals role only to an attacker who already knows the target exists. |
| Email flood to notify or saturate a target's mailbox                     | SMTP abuse / notification spam                 | Existing `@AuthThrottle()` (10 req / 5 min per IP) + SMTP-provider sender-level rate-limits. Per-email tier deferred to v2.                      |

---

## Decision

### Two-Gate Role Check (Defense in Depth)

Every password-reset attempt passes two independent role checks:

**Gate 1 — Request gate** at `/auth/forgot-password`:

- Silent drop for non-existent or inactive (`user?.is_active !== 1` covers `is_active ∈ {0, 3, 4}` and missing rows) — preserves no-leak.
- Role must be the literal string `'root'`. Any other value (including `'admin'`, `'employee'`, `null`, unexpected strings) is **blocked** → send "blocked" email → return `{ message, blocked: true, reason: 'ROLE_NOT_ALLOWED' }`.
- Root-happy-path: invalidate prior unused tokens for the user, issue a fresh 60-min token, send the existing `password-reset.html` email, return `{ message }`.

**Gate 2 — Redemption gate** at `/auth/reset-password`:

- Look up the token by its hash; if missing / expired / used → 401 generic (no token-existence oracle).
- Re-load the target user; if vanished / inactive → burn token + 401 generic.
- Branch on `password_reset_tokens.initiated_by_user_id`:
  - **NULL (self-service token):** role must still be `'root'`. Non-root → burn token + 403 `ROLE_NOT_ALLOWED`.
  - **NOT NULL (Root-initiated token):** verify the initiator is still `role='root'`, `is_active=1`, and in the same `tenant_id` as the target. Failure → burn + 401 generic (no initiator-lifecycle leak). Success → **skip** the self-service role-gate, fall through to the happy-path (hash new password, UPDATE users, mark token used, revoke all refresh-tokens).

The two-gate structure is not redundant. Gate 1 stops the common case (attacker triggers a reset via the victim's mailbox). Gate 2 stops the rare-but-real case (attacker already has a valid token from a DB leak, pre-plan-era issuance, backup copy, or offline export). Either gate alone would be insufficient; together they shut both paths.

### Additive Response Shape (NOT Clean-Break)

`ForgotPasswordResponse` DTO gains two optional fields: `blocked?: true`, `reason?: 'ROLE_NOT_ALLOWED'`. The old shape (`{ message: string }`) remains valid on root and silent-drop paths. Old clients reading only `message` degrade gracefully to a generic-success display on blocked paths (an accepted brief deploy-window inconsistency). No DTO migration, no byte-identity test-bloat, no frontend-sync pressure.

| Case                                        | HTTP | Body                                                                                                          |
| ------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------- |
| Root happy-path                             | 200  | `{ message }`                                                                                                 |
| Silent drop (non-existent or inactive)      | 200  | `{ message }` — **byte-identical** to Root happy-path                                                         |
| Blocked active admin/employee               | 200  | `{ message, blocked: true, reason: 'ROLE_NOT_ALLOWED' }`                                                      |
| Redemption: valid Root token + new password | 200  | `{ message }`                                                                                                 |
| Redemption: token bad / vanished / ghost    | 401  | generic NestJS exception shape                                                                                |
| Redemption: valid self-service, non-root    | 403  | `{ statusCode: 403, code: 'ROLE_NOT_ALLOWED', message, error: 'Forbidden' }` — token burned via `used = true` |

`ResetPasswordResponse` is unchanged — the 403 body is the NestJS-standard exception shape, not this DTO.

### Root-Initiated Reset (Delegated Recovery Lane)

New endpoint: `POST /api/v2/users/:id/send-password-reset-link` — controller in `users.controller.ts`, service method in `auth.service.ts` (credential-issuance is an auth-domain action, not a user-CRUD action).

Guard: `@Roles('root')` — **strict Root-only, deliberately narrower than ADR-045 Layer-1 `canManage`**.

**Why narrower than Layer-1?** Layer-1 (`role === 'root' || (role === 'admin' && hasFullAccess) || isAnyLead`) grants management to admins-with-full-access and any lead. Credential issuance is not a management action — it is an auth-boundary action. A team-lead (`isAnyLead = true`) must not be able to issue reset-links to employees in their team; an admin-with-`has_full_access = true` must not be able to mint tokens for other admins. Keeping the credential-boundary at `role === 'root'` prevents horizontal privilege escalation that would otherwise follow from mixing business-management with credential-management. Consistent with the self-service request gate's role-only predicate.

Target rules, enforced in `AuthService.sendAdminInitiatedResetLink(targetId, initiator)`:

| Condition                                                                               | Response                                                                    |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Target not found (including cross-tenant via tenant-scoped RLS lookup)                  | 404 `{ message: 'Benutzer nicht gefunden.' }`                               |
| Target is `role='root'`                                                                 | 400 `{ code: 'INVALID_TARGET_ROLE' }` — Root-on-Root rejected (see below)   |
| Target role not in `{admin, employee}`                                                  | 400 `{ code: 'INVALID_TARGET_ROLE' }`                                       |
| Target `is_active != 1`                                                                 | 400 `{ code: 'INACTIVE_TARGET' }`                                           |
| `MAX(created_at) WHERE user_id=target AND initiated_by_user_id=root` within last 15 min | 429 `{ code: 'RATE_LIMIT' }`                                                |
| All checks pass                                                                         | 200 `{ message }` — token issued with `initiated_by_user_id = initiator.id` |

**Why Root-on-Root rejected?** A second Root in the tenant who has lost their password uses `/forgot-password` self-service — the Root path is always open. There is no legitimate business case where Root-A needs to reset Root-B's credential. Rejecting this shuts a Root-takeover chain: a compromised Root cannot grind through the other Roots and seize them one by one. A compromised Root can already do significant damage, but this specific lateral-move path is closed off.

**Why per-(initiator, target) DB rate-limit instead of a Throttler tier?** The rate-limit reads `SELECT MAX(created_at)` from the token table directly — one row-read per attempt, negligible cost. A Throttler tier would require Redis infrastructure changes and a new named tier with a closure-based key; the DB-check path is simpler, more accurate (per-pair, not per-initiator-global), and reuses the column we already have.

Token lifetime: 60 min (identical to self-service — KISS). Target receives `password-reset-admin-initiated.html` (new template), which names the initiator explicitly: "{initiatorName} hat für Dich einen Passwort-Reset-Link angefordert."

### Schema Change

Single migration — live production id `140`:

```sql
ALTER TABLE password_reset_tokens
  ADD COLUMN initiated_by_user_id INTEGER NULL
  REFERENCES users(id) ON DELETE SET NULL;
```

**Why `ON DELETE SET NULL` (not CASCADE)?** A deleted Root must not cascade-nuke in-flight admin-initiated tokens. Instead, the token becomes "ghost" (`initiated_by_user_id → NULL`). At redemption time, a ghost token looks like a self-service token and falls through to Gate 2's self-service role-gate — which blocks admin/employee targets anyway. Defense-in-depth holds without a dedicated ghost-handling path.

`password_reset_tokens` is a global table per ADR-019 §7 — no `tenant_id`, no RLS, base grant covers the new column. No index on `initiated_by_user_id` (redemption locates tokens by their unique hash; the new column is only read in the already-narrow redemption path).

### Architecture Overview

```
HTTP POST /auth/forgot-password
    │
    ▼
AuthController.forgotPassword
    │
    ▼
AuthService.forgotPassword(dto) ─── reads CLS {ip, userAgent}
    │
    ├─ findUserByEmail → null or is_active ≠ 1 ──→ silent drop (delivered=false)
    │
    ├─ role ≠ 'root' ──→ sendPasswordResetBlocked()       [Gate 1 — BLOCK]
    │                    logger.warn + auto-audit-trail
    │                    return {blocked:true, delivered:true}
    │
    └─ role === 'root' ──→ invalidate prior tokens         [Gate 1 — ALLOW]
                           issue 60-min token
                           sendPasswordReset()

HTTP POST /users/:id/send-password-reset-link   (Root only)
    │
    ▼
UsersController.sendPasswordResetLink
    │
    ▼
AuthService.sendAdminInitiatedResetLink(targetId, initiator)
    │
    ├─ findUserById(targetId, initiator.tenantId)   (tenant-scoped, RLS)
    │    null → 404
    ├─ target.role === 'root'                       → 400 INVALID_TARGET_ROLE
    ├─ target.role ∉ {admin, employee}              → 400 INVALID_TARGET_ROLE
    ├─ target.is_active ≠ 1                         → 400 INACTIVE_TARGET
    ├─ MAX(created_at) same pair < 15 min ago       → 429 RATE_LIMIT
    │
    └─ issue token (initiated_by_user_id = initiator.id)
       sendPasswordResetAdminInitiated()
       return {message}

HTTP POST /auth/reset-password
    │
    ▼
AuthService.resetPassword(dto)
    │
    ├─ SELECT id, user_id, initiated_by_user_id
    │    missing / expired / used → 401 generic
    │
    ├─ findUserById(user_id)
    │    null or is_active ≠ 1 → burn + 401 generic
    │
    ├─ enforceRedemptionOriginGate(tokenRow, target):
    │    ├─ initiated_by_user_id NOT NULL  (Root-initiated)  [Gate 2 — origin branch]
    │    │    initiator invalid (deleted, demoted, inactive, cross-tenant)
    │    │                                 → burn + 401 generic (no initiator-leak)
    │    │    initiator still valid       → fall through, SKIP role-gate
    │    │
    │    └─ initiated_by_user_id NULL       (self-service)    [Gate 2 — role-gate]
    │         target.role ≠ 'root'         → burn + 403 ROLE_NOT_ALLOWED
    │         target.role === 'root'       → fall through
    │
    └─ hash new password, UPDATE users, UPDATE token SET used = true,
       revoke all refresh-tokens
```

### Rate-Limit (Unchanged from Baseline)

`@AuthThrottle()` (10 requests / 5 minutes per IP) — the same decorator used on `/auth/login` and `/auth/refresh` — is applied unchanged to both `/auth/forgot-password` and `/auth/reset-password`. No new Throttler tier, no `CustomThrottlerGuard` modification, no `AppThrottlerModule` change.

A per-email tier was drafted in plan iterations v0.3.0 / v0.4.1 / v0.4.2 and deferred to v2 in v0.4.3 after two shipping bugs (v0.4.1: guard-override with a `throttlerName` arg that doesn't exist in `@nestjs/throttler@6.5.0`; v0.4.2: `authEmailTracker` included an IP prefix that defeated the very cross-IP scope the tier was supposed to provide). The feature was sprouting bugs faster than it shipped value. v1 accepts the residual R6 risk (distributed-IP email-flood bypasses single-IP throttle and stresses only the SMTP-provider cap); v2 reintroduces the tier if real incidents surface.

**v2 reference** — the correct NestJS Throttler per-tier API:

```typescript
@Throttle({
  'auth-email': {
    limit: 1,
    ttl: 300_000, // 5 min
    getTracker: (req) => `email:${sha256(req.body.email.toLowerCase().trim())}`,
  },
})
```

This is **decorator metadata**, stored as `THROTTLER_TRACKER + name` keys on the route. The base guard resolves per-tier closures in this order: route/class metadata → named-throttler option → common → class default. A `CustomThrottlerGuard.getTracker(req, context)` override cannot discriminate by tier name because the base invocation never passes one (the 2nd arg is `ExecutionContext`, verified against compiled `throttler.guard.js` in v0.4.1's third-pass validation).

### CLS Extension

`ClsModule.forRoot({ middleware: { setup } })` in `app.module.ts` is extended with two new keys (`ip`, `userAgent`). Populated unconditionally for every request. The auth service reads them via `cls.get<string | undefined>('ip') ?? 'unknown'` inside `forgotPassword()` for the blocked email's meta fields and for the warn log.

Fastify is configured with `trustProxy: true` at `main.ts:284`, so `req.ip` resolves to the `X-Forwarded-For` client IP (not the Nginx container's 172.x address) when the request traverses the reverse proxy.

### Audit Trail

`audit.helpers.ts → isAuthEndpoint()` is extended with two new paths (`/auth/forgot-password`, `/auth/reset-password`). This is the minimum required to let the existing global audit-request-filter (which normally skips anonymous non-auth requests at `audit-request-filter.service.ts:59-62`) capture standard HTTP metadata rows (path, method, status, duration, IP, UA, requestId) for all three paths (root / blocked / silent-drop).

Block-semantic context (target role, tenant, decision-reason) stays in `logger.warn()` → Loki → Grafana.

**Option A+ was chosen over Option B** (extending the `ActivityAction` union with `'block'` + calling `ActivityLoggerService.log()` manually). Option A+ is a 2-line helper extension that follows the existing login/logout/refresh pattern exactly; Option B would duplicate HTTP info that the auto-interceptor already captures for a net-zero information gain.

---

## Alternatives Considered

### Alt 1 — Request-gate only, no redemption-gate

Check role at `/auth/forgot-password`. Skip the redemption-gate.

**Rejected.** Leaves a concrete attack path open: an attacker holding a pre-plan-era admin token (from a DB leak, backup, offline copy, or issuance that predates the gate) can still redeem it and overwrite the password. The request-gate only bounds the common case; the redemption-gate is the belt to the request-gate's suspenders. Defense-in-depth requires both.

### Alt 2 — Clean-break response (retire the old shape)

Replace `ForgotPasswordResponse` with a discriminated union (`success | blocked | silent`) and update all consumers atomically.

**Rejected (v0.4.3 scope-re-cut).** The earlier clean-break framing misread the project rule "no backward-compat in dev" — that rule prohibits keeping legacy code paths alive, not adding optional response fields. An additive response is a pure API superset; old clients reading only `message` degrade gracefully on the blocked path (an accepted brief deploy-window inconsistency). Clean-break demanded a DTO migration + byte-identity test-bloat + frontend-sync pressure for zero security benefit.

### Alt 3 — Per-email throttle tier in v1

Introduce a named `'auth-email'` throttle tier with a closure-based `getTracker` that returns `email:${sha256(email)}` (IP-agnostic), complementing the existing IP tier.

**Rejected for v1, deferred to v2.** The underlying threat (cross-IP email-flood to saturate SMTP on a specific target) has not been observed operationally. Two iterations carried shipping bugs. SMTP providers (SendGrid / Mailgun) already apply sender-level outbound rate-limits at the infrastructure layer — an additional cap that bounds the blast-radius. The blocked email itself notifies the admin that someone is attempting to reset, making the attack self-defeating once the admin pays attention. Residual risk R6 is accepted; v2 reintroduces the tier if real incidents surface.

### Alt 4 — Deploy-time `TRUNCATE password_reset_tokens`

Wipe all in-flight tokens at release, forcing everyone to re-request from scratch.

**Rejected (v0.4.3).** With the additive response (Alt 2 rejected), pre-existing tokens remain structurally compatible. Root-owned tokens redeem normally — no customer friction. Admin/employee tokens hit Gate 2 and are burned on first redemption attempt — exactly the R9 defense we wanted. TRUNCATE was suspenders for a risk the redemption-gate already handles, and removing it also removes an `assixx_user` DDL coordination step from deploy.

### Alt 5 — Root-initiated reset uses ADR-045 Layer-1 `canManage`

Allow any admin-with-`hasFullAccess` or any lead (area / department / team) to issue reset-links.

**Rejected (see Decision section above).** Layer-1 is deliberately wide because business-management is a wide responsibility. Credential-issuance is an auth-boundary action — narrower. A team-lead must not mint tokens for employees in their team; an admin-with-`hasFullAccess` must not mint tokens for other admins. The credential boundary stays strictly at `role === 'root'`.

### Alt 6 — Root-on-Root admin-initiated reset allowed

Allow a Root to issue a reset link for another Root in the same tenant.

**Rejected.** A second Root whose mailbox is intact uses `/forgot-password` self-service — the Root path is always open. No legitimate business case requires Root-A to reset Root-B's credential. Rejecting this shuts a Root-takeover chain.

### Alt 7 — MFA / TOTP on Root as the primary recovery gate

Require a second factor on root login and reset.

**Out of scope for this ADR.** Tracked as a separate plan (`FEAT_ROOT_MFA_MASTERPLAN.md`). The role-gate and MFA are orthogonal hardening levers — both should eventually land, neither blocks the other.

### Alt 8 — Tenant domain verification as the primary Break-Glass

Prove DNS ownership of the tenant's corporate domain; the customer's IT can then recreate the mailbox and recover Root out-of-band.

**Out of scope for this ADR; covered by ADR-049.** This ADR sequences **after** ADR-049. Once ADR-049 is live, the "single-Root mailbox-loss deadlock" on verified tenants becomes a customer-IT problem, not a vendor problem. Unverified tenants retain the deadlock — accepted residual (see Consequences).

---

## Relationship to ADR-046 (Microsoft OAuth)

ADR-046 merged Microsoft OAuth sign-in as a first-class authentication route. Admin or employee users whose tenant has OAuth enabled can sign in via Azure AD **without** ever touching `/auth/forgot-password`. This ADR does not interfere with that path.

**Correct mental model:**

- **Root users:** `/auth/forgot-password` is the self-service recovery path.
- **Admin / employee:** either (a) contact a Root user in their tenant for a Root-initiated reset link, or (b) sign in via Microsoft OAuth if the tenant has it configured. OAuth-only accounts (no local password hash, or `password = 'OAUTH'` placeholder per ADR-046) don't need the password-reset flow at all.

**Orthogonality (grep-verified, Phase 0 session 1a, 2026-04-19):** `grep -rE 'forgotPassword|password_reset|resetPassword' backend/src/nest/auth/oauth/` returns **0 matches**. No shared functions, no call graph overlap. The two auth surfaces are independent code paths.

**Threat-model orthogonality:** OAuth does not reduce this ADR's attack surface. Microsoft only issues tokens for identities the Azure AD tenant owns — an attacker cannot abuse the OAuth path to bypass the role-gate. Conversely, if an attacker compromises an admin's Microsoft account, they already have full account access and no password-reset would be needed.

**V1 limitation (Known Limitation #8):** An OAuth-only admin who clicks "Forgot password" receives the generic blocked email whose text says "Bitte wende Dich an einen Root-Benutzer in Deinem Unternehmen." — correct for password-only accounts, misleading for OAuth-only accounts. Acceptable for v1 because the blocked email is a rare out-of-flow communication, and even the suboptimal copy nudges the user toward root-contact rather than silently ignoring them. V2 could branch template wording on a `users.auth_method` or `password = 'OAUTH'` marker.

---

## Sequencing after ADR-049 (Tenant Domain Verification)

ADR-049 ships **first** and provides the structural Break-Glass path: a DNS-verified tenant domain means the customer's IT admin owns the mailbox and can recreate it if a Root loses access. This ADR builds on ADR-049's pre-verified test-tenant seed (the Phase 1 TRUNCATE + fresh seed from Plan 2). Plan 1's Phase 4 API tests run against pre-verified tenants so Gate 2 is exercised realistically end-to-end.

**This ADR does NOT hard-require ADR-049 to function.** The two-gate role check + Root-initiated reset work independently of domain verification. But the Break-Glass philosophy — "if a Root loses their mailbox, IT can recover them" — only holds end-to-end once ADR-049 is live on the tenant. For unverified tenants, a single-Root tenant whose sole Root loses the mailbox has no in-product recovery lane; recovery is manual out-of-band via SCS-Technik support. This is an accepted residual (Plan 2 Known Limitation #10, blast-radius = 1 tenant-slot).

---

## Consequences

### Positive

1. **Two independent gates** close the common attack (mailbox-triggered reset) **and** the rare-but-real attack (pre-existing stolen token). Either gate alone would leave one class of attacker mobile.
2. **Root-initiated delegation lane** means admins and employees who legitimately need a reset are not locked out — they contact a Root who clicks one button in the manage-admin or manage-employee modal. Separation of duties holds: Root issues the vehicle, target sets the password.
3. **No new infrastructure.** No Redis tier, no DDL-at-deploy, no new throttler module. One 3-line migration adding one nullable FK column.
4. **Response stays additive.** Old clients (including any external API consumers) keep functioning on the root and silent-drop paths; new frontend renders the blocked branch.
5. **Role-enumeration uplift bounded.** Root-happy-path and silent-drop are byte-identical. The `blocked: true` field reveals role only to an attacker who already knows the target email belongs to an existing admin/employee — not a new oracle on admin-vs-root for unknown emails.
6. **Observability** via three auto-audit-trail rows per request + structured `logger.warn()` entries in Loki — no custom telemetry plumbing.
7. **Token burning on redemption block is single-use + irreversible** — `used = true` cannot be un-set; no retry path even if the attacker holds the raw token.

### Negative

1. **Residual R1 role-enumeration.** An attacker can distinguish "blocked (admin/employee)" from "allow-or-drop (root or non-existent or inactive)" by the presence of `blocked: true` on the response body. Product-accepted trade-off: UX clarity on the blocked screen > enumeration opacity. The `@AuthThrottle()` IP-throttle is the primary defense against automation.
2. **Single-Root tenant mailbox-loss deadlock** on unverified tenants. If the sole Root loses mailbox access and the tenant has not completed ADR-049 domain verification, no in-product recovery exists. Accepted residual — blast-radius is 1 tenant-slot, recoverable out-of-band.
3. **OAuth-only admin gets a suboptimal blocked email.** Template text is correct for password-only accounts, misleading for OAuth-only. Known Limitation #8.
4. **Distributed-IP email-flood** bypasses the single-IP throttle and stresses only the SMTP-provider cap. Accepted for v1; v2 reintroduces per-email tier if observed.
5. **Root-initiated rate-limit is a DB-query, not Redis.** One row-read per reset-link attempt. Negligible at current scale; not a measurement-grade regression.

### Risks & Mitigations

| Risk                                                                                | Mitigation                                                                                                                             |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Developer forgets Gate 2 when modifying `resetPassword()`                           | Unit tests cover every gate branch (97/97 tests); regression is immediately visible.                                                   |
| New column `initiated_by_user_id` not populated on new endpoint                     | Integration test asserts `initiated_by_user_id = initiator.id` after a successful admin-initiated call.                                |
| Initiator demotion / deletion creates stale ghost-tokens                            | `ON DELETE SET NULL` + Gate 2 initiator-lifecycle check: ghost tokens fall through to the self-service role-gate, which blocks anyway. |
| Role-enumeration exposure via `blocked: true`                                       | Accepted; primary defense is `@AuthThrottle()`.                                                                                        |
| SMTP flakiness prevents a blocked-email from arriving                               | Mailer method logs the failure and resolves (does not throw) — preserves no-leak contract; admin still sees the UI blocked branch.     |
| Frontend regression drops the blocked branch                                        | svelte-check + ESLint run in CI; browser smoke in Phase 6 covers all three UI paths (root, blocked, silent-drop).                      |
| `@Roles('root')` on the admin-initiated endpoint is accidentally widened to Layer-1 | Integration test: admin-caller (even with `hasFullAccess`) gets 403; employee-caller gets 403; unauthenticated gets 401.               |

---

## Verification

All shipped and green as of 2026-04-21 on branch `feat/forgot-password-role-gate`:

- **Unit tests — 97/97 green** in `backend/src/nest/auth/auth.service.test.ts`:
  - `forgotPassword()`: root / admin / employee / null-role / non-existent / inactive variants / CLS IP+UA propagation / OAuth-only admin (Known Limitation #8 coverage).
  - `resetPassword()` self-service: admin-target burn + 403, employee-target burn + 403, vanished-target 401, expired/invalid 401.
  - `sendAdminInitiatedResetLink()`: Root→admin success + Root→employee success, Root-on-Root rejection, inactive variants (`is_active ∈ {0, 3, 4}` via `.each`), cross-tenant 404, per-pair rate-limit inside 15 min, success at 16 min.
  - `resetPassword()` origin-check branch: admin-initiated happy-path bypasses Gate 2 role-gate, ghost-initiator (FK → NULL) falls through to Gate 2, initiator-demoted / initiator-inactive / initiator-tenant-drift all burn + 401.

- **API integration tests — 15/15 green** in `backend/test/auth-forgot-password.api.test.ts` (new file; complements the existing `backend/test/auth-password-reset.api.test.ts` which stays at 16/16 regression-clean):
  - Gate 1: admin→blocked, employee→blocked, root-happy byte-identical to silent-drop (R1 enumeration assertion).
  - Gate 2 self-service: admin-token burn + 403, employee-token burn + 403, inactive-target burn + 401.
  - Root-initiated endpoint: Root→admin success + DB assertion on `initiated_by_user_id`, Root→employee success, Root→Root 400 `INVALID_TARGET_ROLE`, admin-caller 403, employee-caller 403, unauthenticated 401, per-pair rate-limit 429.
  - Root-initiated redemption: admin-initiated happy-path (password-actually-changed verification + login-with-new-password), ghost-initiator fallthrough to Gate 2 → 403.

- **Lint + type-check + svelte-check — 0 errors / 0 warnings** across `backend/src/nest/auth/`, `backend/src/nest/users/users.controller.ts`, `backend/src/nest/common/` (mailer + audit), and the three modified frontend routes (`/forgot-password`, `/manage-admins`, `/manage-employees`).

- **Full unit suite — 6789/6789 green** across 260 test files after the Phase 4 service-fix (`ForbiddenException(string)` → `ForbiddenException({message, code: 'ROLE_NOT_ALLOWED'})` object-form; the global exception filter would otherwise normalize bare-string exceptions and strip the `code` marker required by the §2.2 contract).

- **Migration 140** (`20260420220236221_add-password-reset-initiated-by.ts`) applied; `\d password_reset_tokens` shows the new column with `FOREIGN KEY ... ON DELETE SET NULL`; customer fresh-install synced; backup retained at `database/backups/pre-initiated-by-20260421_000342.dump` (2.9 MiB).

---

## Historical Note — ADR Number Drift

This ADR was drafted as "ADR-050" during plan iterations v0.5.0 (2026-04-20). Between the plan's v0.5.0 changelog entry and the Phase 6 writeup on 2026-04-21, the ADR-050 slot was taken by `ADR-050-tenant-subdomain-routing.md` (unrelated work, status Proposed, 2026-04-19). This document therefore landed at **ADR-051** instead.

**Known drift:** the live migration file `database/migrations/20260420220236221_add-password-reset-initiated-by.ts` contains the string `'ADR-050.'` inside its `COMMENT ON COLUMN` SQL and in its JSDoc header's `@see` line. The column comment is also present in the live database (verified via `pg_catalog.col_description` on 2026-04-21). Both are historical artifacts of the pre-renumbering plan text and will NOT be rewritten — rewriting an applied migration file or adding a housekeeping migration purely to correct a comment string is disproportionate scope. Future readers who grep for "ADR-050" in this codebase will find both the correct subdomain ADR and this historical note.

---

## v2 Backlog

1. **Per-email throttle tier.** Single-day sprint; NestJS Throttler per-tier `getTracker` pattern documented above. Trigger: first real incident of cross-IP email-flood or SMTP-provider rate-limit breach on a single-target attack.
2. **OAuth-only template branch.** Detect `users.password === 'OAUTH'` (or the ADR-046 canonical placeholder) and branch the blocked email wording toward Microsoft sign-in. One template + one service-level check; closes Known Limitation #8.
3. **MFA / TOTP on Root.** Separate plan (`FEAT_ROOT_MFA_MASTERPLAN.md`). Reduces residual risk of mailbox-based Root takeover.
4. **Proactive notification to active Roots on admin-reset-attempts.** Today only the blocked admin sees the notification email; the Roots in the tenant do not. A "someone tried to reset the admin's password" notification to all active Roots would shorten incident-response time. Not required for v1.

---

## References

- **Execution plan:** `docs/FEAT_FORGOT_PASSWORD_ROLE_GATE_MASTERPLAN.md` — phase-by-phase implementation record (Phase 0 Session 1a → Phase 6 Session 3).
- **Plan 2 (prerequisite):** `docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md` — the pre-verified test-tenant seed that Plan 1 reuses.
- [ADR-005](./ADR-005-authentication-strategy.md) — Authentication Strategy (JWT + per-request DB lookup; sets the CLS context this ADR reads from).
- [ADR-006](./ADR-006-multi-tenant-context-isolation.md) — Multi-Tenant Context Isolation (CLS; extended in this ADR with `ip` + `userAgent` keys).
- [ADR-010](./ADR-010-user-role-assignment-permissions.md) — User Role Assignment & Permissions (`has_full_access`, lead positions — deliberately ignored at both gates).
- [ADR-019](./ADR-019-multi-tenant-rls-isolation.md) — Multi-Tenant RLS Isolation (`password_reset_tokens` is a global table per §7; `findUserById` uses the tenant-scoped RLS path).
- [ADR-045](./ADR-045-permission-visibility-design.md) — Permission & Visibility Design (Layer-1 `canManage` — deliberately narrower here for credential issuance).
- [ADR-046](./ADR-046-oauth-sign-in.md) — Microsoft OAuth Sign-In (orthogonal alternate-auth path; see §Relationship to ADR-046 above).
- [ADR-049](./ADR-049-tenant-domain-verification.md) — Tenant Domain Verification (Break-Glass structural path; see §Sequencing above).
