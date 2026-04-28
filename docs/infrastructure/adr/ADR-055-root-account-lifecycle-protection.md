# ADR-055: Root Account Lifecycle Protection

| Metadata                 | Value                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**               | Accepted                                                                                                                                                                                                                                                                                                                                                                                    |
| **Date**                 | 2026-04-28                                                                                                                                                                                                                                                                                                                                                                                  |
| **Decision Makers**      | Simon Öztürk                                                                                                                                                                                                                                                                                                                                                                                |
| **Affected Components**  | PostgreSQL (`root_self_termination_requests` table + `trg_root_protection` trigger), Backend (`backend/src/nest/root/`, plus wiring into `users/`, `dummy-users/`), Frontend (`(root)/root-profile/`, `(root)/manage-root/`, `(shared)/manage-approvals/`)                                                                                                                                  |
| **Supersedes**           | —                                                                                                                                                                                                                                                                                                                                                                                           |
| **Related ADRs**         | ADR-005 (JWT), ADR-006 (CLS), ADR-007 (API envelope), ADR-009 (Audit), ADR-010 (Roles), ADR-014 (Migrations), ADR-019 (RLS), ADR-020 (Per-User Permissions), ADR-030 (Zod), ADR-037 (Approvals — reuse rejected, see §Alternatives), ADR-045 (Permission Stack)                                                                                                                             |
| **Number-conflict note** | This ADR uses **055** because the two earlier adjacent slots were unavailable — the **Navigation Map Pointer Injection ADR** (`ADR-053-navigation-map-pointer-injection.md`, accepted 2026-04-23) had taken the slot the masterplan originally targeted, and the next slot is reserved by `FEAT_2FA_EMAIL_MASTERPLAN.md` for "Mandatory Email-Based 2FA" (ADR-054). See Spec Deviation D14. |

---

## Context

A `root` user owns the highest privilege bracket inside a tenant: full access to addons, billing, user management, and all four organizational levels. Loss of every active root in a tenant is a **lock-out event** — the only path back is `assixx_user` (BYPASSRLS, DDL) intervention by an SCS-Technik operator. That makes any code path that can transition a `users` row out of "active root" state a critical security surface.

A pre-implementation audit of `backend/src/nest/{root,users,dummy-users}/` (masterplan §0.5, 2026-04-26) found **5 service-level write paths** and **2 PUT routes** that mutate `users.is_active` or `users.role`. None of them had a guard that distinguished "root targeting another root" from "root targeting an admin/employee", and none enforced "at least one active root must remain in the tenant". The DB had only timestamp triggers — no protective trigger.

### Threat Model

| #   | Scenario                                                                | Existing Behaviour        | Target Behaviour                  |
| --- | ----------------------------------------------------------------------- | ------------------------- | --------------------------------- |
| T1  | Root A's credentials phished → attacker deletes/demotes all other roots | Allowed → tenant takeover | Blocked (cross-root immutability) |
| T2  | Root A's session hijacked → attacker self-deletes to cover tracks       | Allowed → audit gap       | Blocked (peer approval required)  |
| T3  | All roots lose credentials simultaneously                               | Tenant locked out         | Mitigated by last-root protection |
| T4  | Disgruntled root A wants to remove peer root B                          | Allowed → insider risk    | Blocked (cross-root immutability) |

### The 4 Termination Operations

Any of the following transitions takes a row out of "active root" state and must be gated:

| Op            | DB Effect           | Why It Counts as "Termination"                |
| ------------- | ------------------- | --------------------------------------------- |
| Soft-Delete   | `is_active = 4`     | Standard delete path — user invisible         |
| Deactivate    | `is_active = 0`     | User cannot log in → equivalent to delete     |
| Role-Demotion | `role <> 'root'`    | User loses root powers → equivalent to delete |
| Hard-Delete   | `DELETE FROM users` | Row gone — irreversible                       |

### Requirements

1. Cross-root termination is forbidden (T1, T4) — no root can terminate another root by any of the 4 operations.
2. Self-termination is permitted but must require **peer approval** (T2) — no single compromised credential can take a root out of the system.
3. The last active root in a tenant cannot be terminated (T3) — even with valid approval, even by `app_user` flow.
4. Protection must survive backend bugs, raw `psql` access via `app_user`, and forgotten guard wiring.
5. Legitimate emergency operations (`assixx_user` migrations, `sys_user` cron / signup / tenant deletion) must not be blocked.
6. Every denied attempt must produce an audit-trail entry naming actor, target, op, and reason (ADR-009).
7. Repeated request/cancel/reject cycles must not produce a notification storm.

---

## Decision

### Four-Layer Defense in Depth

Every termination of a root user must pass **four independent gates**. The first three live in application space; the fourth lives in the database. A single bug in any layer is contained by the others.

```
┌──────────────────────────────────────────────────────────────────────┐
│ Layer 1 — Frontend (UX hint, NEVER trusted as security)               │
│   • /manage-root: Delete button disabled + tooltip on cross-root rows │
│   • /manage-root: Edit modal hides Aktiv/Inaktiv/Archiviert dropdown  │
│     behind a read-only badge + lock icon when target is foreign root  │
│   • /root-profile: Self-termination card with 4 mutually-exclusive    │
│     UI states (eligible / pending / lastRoot / cooldown)              │
│   • /manage-approvals: RootSelfTerminationCard for peer review (root  │
│     reviewers only, requester-self filtered server-side)              │
├──────────────────────────────────────────────────────────────────────┤
│ Layer 2 — Backend Service Guard (RootProtectionService)               │
│   • assertCrossRootTerminationForbidden(actor, target, op)            │
│   • assertNotLastRoot(tenantId, excludingUserId)                      │
│   • Wired into 4 termination sites + 1 defensive role-block:          │
│     root.service.ts:deleteRootUser, root-admin.service.ts:deleteAdmin │
│     users.service.ts:deleteUser + archiveUser                         │
│     dummy-users.service.ts:delete                                     │
│   • PUT-route role-demote wiring deferred → Layer 4 trigger backstop  │
├──────────────────────────────────────────────────────────────────────┤
│ Layer 3 — Backend Approval Workflow (RootSelfTerminationService)      │
│   • POST   /users/me/self-termination-request    → 201                │
│   • GET    /users/me/self-termination-request    → 200 | null         │
│   • DELETE /users/me/self-termination-request    → 204                │
│   • GET    /users/self-termination-requests/pending          → 200    │
│   • POST   /users/self-termination-requests/:id/approve      → 200    │
│   • POST   /users/self-termination-requests/:id/reject       → 200    │
│   • 7-day TTL, no self-approval, single pending per requester,        │
│     24h cooldown after rejection, FOR UPDATE row lock in approve TX   │
├──────────────────────────────────────────────────────────────────────┤
│ Layer 4 — PostgreSQL Trigger (fn_prevent_cross_root_change)           │
│   • BEFORE UPDATE OR DELETE ON users, FOR EACH ROW                    │
│   • Bypassed by current_user IN ('assixx_user', 'sys_user')           │
│   • Reads app.user_id GUC + app.root_self_termination_approved GUC    │
│   • HYBRID OPTION 1+: when approval flag = 'true', verifies a real    │
│     root_self_termination_requests row with status='approved' and     │
│     approved_at > NOW() - 5 min exists for this requester+tenant      │
│   • Last-root recount happens inside the trigger AFTER all bypasses   │
└──────────────────────────────────────────────────────────────────────┘
```

### Layer 4 — Why "Hybrid Option 1+"

The naive design "BEFORE UPDATE on users: if `acting_user.id <> target.id AND target.role = 'root'` then RAISE" sounds correct but blocks the legitimate approve flow. In `RootSelfTerminationService.approveSelfTermination`, the actor is the **approver** (peer root) and the target is the **requester** — by definition different users, by definition a "cross-root" termination. The naive rule rejects the only legitimate path.

Three options were considered:

- **Option 0 — drop the trigger entirely** during the approve flow. Requires a way to disable the trigger temporarily, which means `ALTER TABLE` privilege on `app_user`. Unacceptable: the trigger is the backstop for `app_user` bypass via raw `psql` (R4); disabling it on demand defeats the point.
- **Option 1 — set a transaction-local GUC `app.root_self_termination_approved = 'true'` before the `UPDATE users`**. Trigger checks the GUC and skips the cross-root rule. Works, but trusts the GUC: a future bug or attacker that can run `set_config('app.root_self_termination_approved', 'true', true)` in a transaction can bypass the cross-root check on any root row.
- **Option 1+ (chosen) — set the GUC AND verify a real `root_self_termination_requests` row exists with `status='approved'` and `approved_at > NOW() - 5 min` for this requester+tenant**. Defeats GUC forgery: an attacker would also need to write a valid approval row in the same connection, which would itself require RLS-conformant access to that table. Falls open by 5 minutes (acceptable per masterplan §Known Limitations #10).

The 5-minute window covers transaction commit timing and operational latency. It is small enough that a stale GUC from a 6-minute-old approve TX cannot be reused to terminate a different root, large enough that no realistic approve TX exceeds it. The window is enforced by an index on `(requester_id, approved_at) WHERE status = 'approved'` so the `EXISTS` lookup is sub-millisecond.

The approve TX **writes the approval row first**, then sets the GUC, then runs the `UPDATE users`. Layer 4 sees the row already in the table when the `UPDATE` fires. Reverse ordering would have a window where the GUC is set but the row is not yet visible — still safe in practice (the row will be visible before COMMIT) but the chosen ordering is the cleanest invariant.

### Database Schema Decision

A single new table — `root_self_termination_requests` — with full ADR-019 hardening (RLS enabled + forced, `tenant_isolation` policy with NULLIF pattern, GRANTs for both `app_user` and `sys_user`, `is_active SMALLINT` with partial indexes). UUIDv7 primary key (PG18 native `uuidv7()`, ADR-043). Two CHECK constraints encode invariants at the DB level: `chk_no_self_approval` (approver ≠ requester) and `chk_status_consistency` (status transitions are well-formed). A unique partial index on `requester_id WHERE status = 'pending'` enforces "at most one pending request per root globally" without RLS interaction overhead.

### Service Decomposition (Inside `backend/src/nest/root/`)

Three services + one cron + one notification subscriber, all flat in the existing `root/` bounded context (NOT a sub-folder):

- **`RootProtectionService`** — pure guard logic for Layers 1+2. Five methods: `assertCrossRootTerminationForbidden`, `assertNotLastRoot`, `countActiveRoots`, `isTerminationOp`, `auditDeniedAttempt`. No CLS dependency on the assertion paths — actor/target are explicit parameters so the service stays unit-testable in isolation.
- **`RootSelfTerminationService`** — Layer 3 lifecycle. Eight public methods (`requestSelfTermination`, `getMyPendingRequest`, `getMostRecentRejection`, `cancelOwnRequest`, `getPendingRequestsForApproval`, `approveSelfTermination`, `rejectSelfTermination`, `expireOldRequests`) + five private helpers. The approve TX uses `tenantTransaction()` (ADR-019) and orders SQL precisely: lock request row → validate → lock all root rows → recount → flip status → set GUC → execute deletion. Notification fan-out is moved **outside** the TX (vacation pattern) so notification failures cannot roll back business state.
- **`RootSelfTerminationNotificationService`** — domain-specific subscriber that owns recipient resolution + persistent `notifications` row inserts for the 3 user-facing events (Requested, Approved, Rejected). Co-located with the producer, NOT bolted onto `notifications/notifications.service.ts` (which stays domain-agnostic). Top-level try/catch ensures notification failures never throw to the caller.
- **`RootSelfTerminationController`** — six REST endpoints under `/api/v2/users/...`. Class-level `@Roles('root')`. UUID `:id` param via `UuidIdParamDto` from `common/dto/param.factory.ts` (ADR-030 §7.5).
- **`RootSelfTerminationCron`** — daily 03:00 UTC `@Cron('0 3 * * *')` thin wrapper around `expireOldRequests()`. Uses `systemQuery()` (sys_user, BYPASSRLS) for cross-tenant cleanup.

---

## Alternatives Considered

### A. Reuse `manage-approvals` (ADR-037) as the backend for self-termination

ADR-037 ships a generic approval workflow engine: configurable approver types, multi-stage approval, reusable across vacation / KVP / work-orders. The natural question is whether root self-termination should plug into it.

| Factor                  | Reuse ADR-037                                                 | Dedicated module in `root/` (chosen)                         |
| ----------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| Coupling                | Couples root lifecycle to a generic workflow engine           | Narrow, single-purpose, easy to reason about                 |
| Approval-type semantics | Generic `approver_type` — not designed for "exactly one peer" | Tight constraints in DB (`chk_no_self_approval`) and service |
| UI                      | Same `manage-approvals` page                                  | Same `manage-approvals` page (different card)                |
| Risk of regression      | High — touches existing ADR-037 plumbing                      | Low — additive, isolated                                     |
| Migration complexity    | Schema changes to `approvals` table                           | One new table, one trigger                                   |
| Bounded-context fit     | Different — generic workflows                                 | Matches the existing `root/` lifecycle module                |

**Decision:** the **frontend card** lives in `manage-approvals` (consistent UX, ADR-037 page hosts third-party card types via the `(shared)/` route group). The **backend logic stays in `root/`** because the lifecycle has unique invariants — single-pending-per-requester, 24h cooldown, cross-tenant isolation by RLS, and the Hybrid Option 1+ GUC dance — that do not generalize to other approval workflows. Stretching ADR-037 to fit would dilute its abstraction; building flat in `root/` keeps the bounded context pure.

### B. Pure DB Trigger (no application layer)

Push everything into PL/pgSQL: cross-root rule, last-root rule, approval check. The application becomes a thin SQL emitter.

**Rejected** because:

- The approval flow is a stateful workflow (request → notify → wait → approve → execute) that a single `BEFORE UPDATE` trigger cannot orchestrate. The trigger fires only on the final `UPDATE users` — by then the request lifecycle is irrelevant.
- Notification fan-out, EventBus integration, audit-trail rows, and DTO validation belong in NestJS, not in `pg_trigger`.
- Errors raised from PL/pgSQL surface as HTTP 500 (no PG-error filter; see Spec Deviation D9). Clean 4xx codes (403 ROOT_CROSS_TERMINATION_FORBIDDEN, 412 ROOT_LAST_ROOT_PROTECTION, 409 COOLDOWN_ACTIVE) require an application layer.

The trigger is **defense in depth**, not a replacement for the application layer.

### C. Pure Application Layer (no DB trigger)

Drop Layer 4. Trust that `RootProtectionService` is wired into every mutation path.

**Rejected** because:

- The audit (§0.5) found 5 services + 2 PUT routes that mutate `users.is_active` or `users.role`. A future PR that adds a 6th path and forgets the guard creates a silent privilege-escalation hole. Code review can miss this; static analysis cannot reliably detect it (the wiring is structural, not a single API).
- Raw `psql` access as `app_user` (e.g. ad-hoc DB ops, tooling) bypasses the application entirely. Layer 4 catches this (R4).
- The Triple-User Model (ADR-019) documents `app_user` as RLS-strict and DDL-less precisely so it can be used safely from outside the application. The trigger preserves that invariant.

### D. Bare Cross-Root Check in Trigger (no Hybrid)

Trigger rule: `IF acting_user.id <> target.id AND target.role = 'root' THEN RAISE`. Simpler than Option 1+.

**Rejected** because the legitimate approve flow has actor=approver and target=requester by design. The bare rule blocks every approve. See "Layer 4 — Why Hybrid Option 1+" above for the detailed analysis of the three options.

### E. Multi-Stage Approval ("k of n")

Require multiple approvers (e.g. 2-of-3 roots) instead of one peer.

**Deferred** to a future ADR. V1 ships single-peer approval. Compliance regimes that require multi-stage (SOC 2 type II, ISO 27001 with strict separation-of-duties) can drive a future schema migration: add `approvals_required INT` to the request row, replace the single `approved_by` with a join table, change the approve handler to count rather than flip-on-first.

### F. 2FA Re-Auth at Submit Time

Require fresh 2FA confirmation when the requester clicks "Konto löschen" — even within an active session.

**Deferred** until 2FA email (ADR-054) ships. Once email-based 2FA is mandatory at login (per `FEAT_2FA_EMAIL_MASTERPLAN.md`), root self-termination is a natural candidate for an additional re-auth challenge. V1 trusts the JWT session; V2 candidate.

### G. Approval-Free Self-Termination with 7-Day Cancel Window

Self-deletion is allowed immediately, marked as `pending_cancellation`, and physically applied 7 days later unless cancelled. No peer approval needed.

**Rejected** because it solves T2 (session hijack) only weakly: the attacker has 7 days to also lock out the legitimate user (change email, revoke session via password change). Peer approval is a stronger primitive — a hijack would need a second compromised root, which is the threshold T1+T4 already mandate.

### H. Grant Root the `app.root_self_termination_approved` GUC Directly via JWT Claim

Embed an "I am approving root X right now" claim in the JWT, validated by the JWT guard.

**Rejected** because JWTs are bearer tokens — anyone holding the token holds the claim. The Hybrid Option 1+ approach binds the approval to a database row that requires RLS-conformant write access, which is bounded by tenant isolation and active-session lifecycle. JWT claims are too easy to manufacture if the token signing key leaks.

---

## Consequences

### Positive

1. **All four termination operations are blocked end-to-end** — Soft-Delete, Deactivate, Role-Demotion, Hard-Delete — across application code (Layer 2), workflow constraints (Layer 3), and database engine (Layer 4). Frontend (Layer 1) provides the UX hint.
2. **Cross-root takeover (T1, T4) is impossible from `app_user` context** — verified by 8 trigger-integration tests (Phase 3 Session 7c) + 25 API integration tests (Phase 4 Session 8).
3. **Self-termination requires a peer signature** — solves T2 with a primitive an attacker cannot forge from a single compromised credential.
4. **Last-root protection holds even with valid approval** — Layer 4's recount runs after the Hybrid bypass, so the last-root rule is never weakened by the approve flow. T3 mitigated.
5. **Legitimate system operations bypass cleanly** — `assixx_user` (migrations, DDL) and `sys_user` (cron, signup, tenant deletion) skip the trigger via `current_user IN (...)` short-circuit. Documented as the legitimate emergency path for R4.
6. **Audit coverage is comprehensive** — every state transition + every denied attempt writes to `root_logs` (via `ActivityLoggerService`) and `audit_trail` (via `AuditTrailInterceptor`, dual-writer model per §0.5).
7. **Notification storm protection** — single-pending-per-requester partial unique index + 24h post-rejection cooldown + the approval flow's explicit cancel path keep the notification volume bounded.
8. **The 4-layer model is symmetric across the codebase** — same architecture maps to ADR-045's permission-stack metaphor (subscription → management gate → action → creator-bypass), which is already familiar to the team.

### Negative

1. **Five mutation sites + two PUT routes had to be wired manually**. A future 6th site that forgets the wiring is caught only by Layer 4 — surfaces as 500 (no PG-error filter) instead of a clean 403. See Spec Deviation D9.
2. **The PUT-route role-demote wiring (`updateRootUser`, `updateAdmin`) was deferred** because both methods lack an `actingUserId` parameter, requiring controller signature changes. Layer 4 trigger backstops; T17 in Phase 4 confirms the protection holds in practice but the response is non-2xx 500 rather than 403.
3. **Cooldown response shape lost the structured `cooldownEndsAt` field** during HTTP envelope normalization (ADR-007). The ISO timestamp is still recoverable via regex on the `message` body. See Spec Deviation D10.
4. **Single-tenant onboarding has a chicken-and-egg constraint** — a tenant with exactly one root cannot self-terminate (R5). This is intended; documented in Known Limitations.
5. **The 5-minute approve window is a hard timing constraint** — pathological connection-pool starvation could push an approve TX past 5 minutes between the row insert and the `UPDATE users`, triggering `ROOT_NO_APPROVED_REQUEST`. Acceptable trade-off; widening the window erodes Hybrid Option 1+'s defense.
6. **`countActiveRoots` initially used `SELECT COUNT(*) ... FOR UPDATE`** which PostgreSQL forbids ("FOR UPDATE is not allowed with aggregate functions"). The unit suites mocked the DB so the bug never surfaced; Phase 4 API tests caught it. Fix: split lock + count. Documented in masterplan changelog v1.3.0.

### Risks & Mitigations (R1–R10)

| #   | Risk                                                                                | Mitigation                                                                                                                                                       | Verification                                                                                            |
| --- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| R1  | Last-root race: parallel self-termination + admin promotion creates lock-out window | `FOR UPDATE` row lock on root rows in tenant within the approve TX; recount in same TX before status flip                                                        | Session 7b: parallel approve via `Promise.allSettled` with two queued mock clients → exactly 1 succeeds |
| R2  | Trigger blocks legitimate system operations (migrations, tenant deletion, cron)     | Trigger short-circuits when `current_user IN ('assixx_user', 'sys_user')`                                                                                        | Session 7c: 2 dedicated tests verify both bypass paths                                                  |
| R3  | Approval expires while requester still wants it (UX friction)                       | 7-day TTL; UI shows countdown + re-request flow; 24h cooldown after rejection prevents notification spam                                                         | Session 9: UI states cooldown / pending / lastRoot / eligible; backend tests T14 + T15                  |
| R4  | Cross-root delete via raw SQL (DB admin)                                            | Trigger blocks even raw SQL when run as `app_user`. `assixx_user` (DDL) bypasses — documented as legitimate emergency path                                       | Session 7c: cross-root as `app_user` → ROOT_CROSS_TERMINATION_FORBIDDEN; assixx_user → succeeds         |
| R5  | Initial single-root tenant cannot self-terminate                                    | Intended — last-root protection. Documented in Known Limitations                                                                                                 | Session 8 T19: tenant with 1 root → 412 LAST_ROOT_PROTECTION                                            |
| R6  | Frontend bypass via direct API call                                                 | All security in Layer 2 + 4. Frontend = UX hint only. API tests use raw fetch                                                                                    | Session 8 T16-T18: DELETE/PUT/POST archive as Root A → cross-root denied                                |
| R7  | Notification storm if request is repeatedly created/cancelled                       | Unique partial index `idx_rstr_one_pending_per_requester` enforces single pending; 24h cooldown after rejection                                                  | Session 7b: ALREADY_PENDING + COOLDOWN_ACTIVE tests; Session 8 T06 + T14                                |
| R8  | Audit trail gaps (denied attempts not logged)                                       | Every guard rejection emits an `activity_logs`/`root_logs` entry via `ActivityLoggerService`; HTTP layer adds `audit_trail` row via `AuditTrailInterceptor`      | Session 7a: 8 cross-root tests assert `ActivityLoggerService.log` call shape                            |
| R9  | Self-termination flag GUC leaks across requests via connection pool                 | GUC set via `set_config(..., true)` (transaction-local); auto-released on COMMIT/ROLLBACK                                                                        | Session 7c: stale-GUC test (>5 min) → ROOT_NO_APPROVED_REQUEST; Session 7b: TX rollback test            |
| R10 | Trigger blocks legitimate approve flow                                              | Hybrid Option 1+: trigger checks approval-flag FIRST + verifies real DB-row exists within 5-min window — bypasses cross-root check only when both conditions met | Session 7c: GUC + valid approved row → succeeds; GUC + no row / stale row → blocked                     |

---

## Implementation Surface

### Database

| File                                                         | Purpose                                                           |
| ------------------------------------------------------------ | ----------------------------------------------------------------- |
| `database/migrations/{ts}_root-self-termination-requests.ts` | Table + ENUM (`root_self_termination_status`) + RLS + 5 indexes   |
| `database/migrations/{ts}_root-protection-trigger.ts`        | `fn_prevent_cross_root_change()` + `trg_root_protection` on users |

### Backend (new — flat in `root/`)

| File                                                                         | Purpose                                                |
| ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| `backend/src/nest/root/root-protection.service.ts`                           | Cross-root + last-root guard logic (Layer 2)           |
| `backend/src/nest/root/root-self-termination.service.ts`                     | Request lifecycle + cooldown (Layer 3)                 |
| `backend/src/nest/root/root-self-termination.controller.ts`                  | 6 REST endpoints                                       |
| `backend/src/nest/root/root-self-termination.cron.ts`                        | Daily expiry job at 03:00 UTC                          |
| `backend/src/nest/root/root-self-termination-notification.service.ts`        | Typed EventBus emits + persistent notification inserts |
| `backend/src/nest/root/dto/{request,approve,reject}-self-termination.dto.ts` | 3 Zod DTOs (ADR-030)                                   |

### Backend (modified)

| File                                                  | Change                                            |
| ----------------------------------------------------- | ------------------------------------------------- |
| `backend/src/nest/root/root.module.ts`                | Register 4 new providers + 1 new controller       |
| `backend/src/nest/root/root.service.ts`               | Wire `RootProtectionService` in `deleteRootUser`  |
| `backend/src/nest/root/root-admin.service.ts`         | Wire (defensive) in `deleteAdmin`                 |
| `backend/src/nest/users/users.service.ts`             | Wire in `deleteUser` + defensive in `archiveUser` |
| `backend/src/nest/dummy-users/dummy-users.service.ts` | Wire (defensive) in `delete`                      |
| `backend/src/utils/event-bus.ts`                      | Add 3 typed emit methods                          |

### Frontend

| Path                                                                                  | Purpose                                                          |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `frontend/src/routes/(app)/(root)/root-profile/SelfTerminationCard.svelte`            | 4 mutually-exclusive UI states (Layer 1)                         |
| `frontend/src/routes/(app)/(root)/root-profile/SelfTerminationModal.svelte`           | Glassmorphism modal with reason textarea + warning banner        |
| `frontend/src/routes/(app)/(root)/root-profile/_lib/state-self-termination.svelte.ts` | Svelte 5 reactive state holder + cooldown regex helper           |
| `frontend/src/routes/(app)/(root)/manage-root/+page.svelte`                           | Delete button disabled + cross-root tooltip on foreign-root rows |
| `frontend/src/routes/(app)/(root)/manage-root/_lib/RootUserModal.svelte`              | New `lockDestructiveStatus` prop hides Status dropdown           |
| `frontend/src/routes/(app)/(shared)/manage-approvals/RootSelfTerminationCard.svelte`  | Peer-approval card (root reviewers only)                         |

### Tests

| File                                                                       | Tests  | Phase |
| -------------------------------------------------------------------------- | ------ | ----- |
| `backend/src/nest/root/root-protection.service.test.ts`                    | 16     | 3     |
| `backend/src/nest/root/root-self-termination.service.test.ts`              | 24     | 3     |
| `backend/src/nest/root/root-self-termination-notification.service.test.ts` | 9      | 2     |
| `backend/test/root-protection-trigger.api.test.ts`                         | 8      | 3     |
| `backend/test/root-self-termination.api.test.ts`                           | 25     | 4     |
| **Total**                                                                  | **82** | —     |

---

## Verification

The protection holds against the four threat scenarios:

| Threat | Verifying tests                                                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| T1     | Phase 3 Session 7a (8 cross-root unit tests) + Phase 3 Session 7c (1 trigger-integration test as `app_user`) + Phase 4 T16            |
| T2     | Phase 4 T04-T13 (full self-termination lifecycle) + Phase 3 Session 7b SELF_DECISION_FORBIDDEN + DB constraint `chk_no_self_approval` |
| T3     | Phase 3 Session 7a (3 last-root unit tests) + Phase 3 Session 7c (1 trigger-integration last-root test) + Phase 4 T19                 |
| T4     | Same as T1 — cross-root rule covers both phishing and disgruntled-peer scenarios                                                      |

All four termination operations are exercised through both the application path (Layer 2) and the SQL path (Layer 4):

| Op            | Layer 2 test                              | Layer 4 test                                      |
| ------------- | ----------------------------------------- | ------------------------------------------------- |
| Soft-Delete   | Session 7a (`isTerminationOp` 1→4)        | Session 7c (cross-root `UPDATE is_active=4`)      |
| Deactivate    | Session 7a (`isTerminationOp` 1→0)        | Session 7c (covered by same trigger logic)        |
| Role-Demotion | Session 7a (`isTerminationOp` root→admin) | Session 7c (covered by trigger termination check) |
| Hard-Delete   | Session 7a (`isTerminationOp` after=null) | Session 7c (TG_OP='DELETE' branch)                |

---

## Known Limitations (V1 — deliberately excluded)

1. **2FA re-auth on self-termination** — deferred until ADR-054 (Email-Based 2FA) ships. V2 candidate.
2. **Recovery path for full root-credential loss** — if all roots lose Email + 2FA simultaneously, no in-app recovery. Only via SCS-Technik support / tenant-deletion flow.
3. **Cross-tenant approval** — roots can only approve requests in their own tenant. Enforced by RLS.
4. **No bulk approve** — approval is per-request.
5. **No undo after approval execution** — once `is_active=4`, no in-app undo. Manual restore via `assixx_user` only.
6. **No multi-stage approval ("k of n")** — single-peer approval is enough for V1. Future phase if compliance demands.
7. **Hard-delete route may not exist today** — Phase 0 audit found none. Trigger covers preemptively for any future addition.
8. **Tenant-deletion bypass** — when a tenant is deleted, all roots are removed by `sys_user` which bypasses the trigger. Intentional — tenant deletion has its own protection (out of scope).
9. **`role-switch` interaction** — `role-switch/` does NOT change `users.role` in DB; switches request-context only. No conflict.
10. **5-minute approval window in trigger** — if an approve TX takes longer than 5 minutes between row insert and the `UPDATE`, the trigger rejects with `ROOT_NO_APPROVED_REQUEST`. Acceptable trade-off; if observed in practice, widen the window or move ordering inside one TX (already enforced in `RootSelfTerminationService.approveSelfTermination`).
11. **Real-time SSE for the 3 events not wired** — Spec Deviation D13. Backend EventBus emits typed events (Session 6), but `notifications.controller.ts` does not register SSE handlers for `root.self-termination.*`. Mitigation: persistent notifications still fire; `invalidateAll()` after the actor's own approve/reject keeps the card list current. Tracked as Phase 6 follow-up.
12. **Rejection-history UI element on `/root-profile`** — Spec Deviation D11. Backend `getMostRecentRejection` is internal-only; no GET endpoint exposes it. After 24h cooldown the user simply sees the eligible state. Tracked as Phase 6 follow-up.

---

## Spec Deviations from Masterplan (D1–D14)

| #       | Spec said                                                                  | Reality                                                                                                                                                                                                      | Decision                                                                                                                                                                                                                                                                         |
| ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1      | Module path `users/root-protection/`                                       | `root/` is the bounded context                                                                                                                                                                               | v0.2.0: flat in `root/`                                                                                                                                                                                                                                                          |
| D2      | Filename `eventBus.ts`                                                     | Actual: `event-bus.ts` (kebab-case)                                                                                                                                                                          | v0.2.0: corrected                                                                                                                                                                                                                                                                |
| D3      | Wire only `users.service.ts`                                               | 5 services + 2 PUT routes mutate `users.is_active`/`role`                                                                                                                                                    | v0.2.0: expanded wiring                                                                                                                                                                                                                                                          |
| D4      | Trigger checks cross-root before approval                                  | Approve flow has actor ≠ target by design — blocked itself                                                                                                                                                   | v0.2.0: Hybrid Option 1+                                                                                                                                                                                                                                                         |
| D5      | §2.5 mandates `idField` factory for `:id` param                            | `root_self_termination_requests.id` is UUID                                                                                                                                                                  | v1.0.4 (Session 5b): used `UuidIdParamDto` from same factory                                                                                                                                                                                                                     |
| D6      | §2.6 spec body uses `this.logger.info(...)`                                | NestJS `Logger` has no `.info()` method                                                                                                                                                                      | v1.0.5 (Session 5c): replaced with `this.logger.log(...)`                                                                                                                                                                                                                        |
| D7      | "modify `notifications.service.ts` — handlers fan out"                     | Repo convention is per-domain `*-notification.service.ts`                                                                                                                                                    | v1.0.6 (Session 6): `root-self-termination-notification.service.ts`                                                                                                                                                                                                              |
| D8      | §3 "Test files" lists only the 2 in-process unit suites                    | DB-trigger SQL integration tests need a different harness                                                                                                                                                    | v1.2.0 (Session 7c): `backend/test/root-protection-trigger.api.test.ts`                                                                                                                                                                                                          |
| D9      | §4 bypass tests phrased as `PATCH /users/{uuid}`                           | `UsersController` has no PATCH for cross-user fields; PUT trigger-block surfaces as 500                                                                                                                      | v1.3.0 (Session 8): T16 DELETE → 403 Layer 2; T17 PUT → non-2xx + DB-side proof; T18 POST archive → 403                                                                                                                                                                          |
| D10     | Cooldown response shape `{code, message, cooldownEndsAt}`                  | `AllExceptionsFilter` normalises to `{code, message, details?}`                                                                                                                                              | v1.3.0 (Session 8): ISO timestamp embedded in `message`, recoverable by regex                                                                                                                                                                                                    |
| D11     | §5.1 UI state "Recently rejected (>24h)" requires upfront knowledge        | `getMostRecentRejection` is internal-only; no GET endpoint                                                                                                                                                   | v1.3.1 (Session 9): omitted; tracked as Phase 6 follow-up                                                                                                                                                                                                                        |
| D12     | §5.2 lists 3 destructive ops                                               | Role-change-to-non-root UI surface does not exist on `/manage-root`                                                                                                                                          | v1.3.2 (Session 9b): 2 of 3 gated; Layer 4 trigger backstops the third                                                                                                                                                                                                           |
| D13     | §5.3 mandates SSE on the 3 events                                          | Backend SSE handlers not registered for `root.self-termination.*`                                                                                                                                            | v1.3.3 (Session 9c): `invalidateAll()` mitigation; tracked as Phase 6 follow-up                                                                                                                                                                                                  |
| **D14** | Masterplan originally targeted the next-available ADR slot for this design | That slot had already shipped 2026-04-23 as the **Navigation Map Pointer Injection ADR** (wholly unrelated). The next slot was reserved 3× by `FEAT_2FA_EMAIL_MASTERPLAN.md` for "Mandatory Email-Based 2FA" | v1.4.1 (Session 10): this ADR uses **055** — the next free number. All references in source code (3 backend `@see` + 4 frontend comments) and the masterplan body renamed in lockstep. The "(planned, Phase 6)" qualifier on `@see` lines dropped (now real ADR with full path). |

---

## References

- [FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md](../../FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md) — execution plan, all 10 sessions
- [ADR-005: Authentication Strategy](./ADR-005-authentication-strategy.md) — JWT, CLS population
- [ADR-006: Multi-Tenant Context Isolation](./ADR-006-multi-tenant-context-isolation.md) — `app.user_id` GUC propagation
- [ADR-007: API Response Standardization](./ADR-007-api-response-standardization.md) — envelope normalization (D10)
- [ADR-009: Central Audit Logging](./ADR-009-central-audit-logging.md) — `audit_trail` table
- [ADR-010: User Role Assignment & Permission System](./ADR-010-user-role-assignment-permissions.md) — root/admin/employee roles
- [ADR-014: Database & Migration Architecture](./ADR-014-database-migration-architecture.md) — `node-pg-migrate`, Triple-User-Model
- [ADR-019: Multi-Tenant RLS Isolation](./ADR-019-multi-tenant-rls-isolation.md) — `tenantTransaction()`, `set_config(..., true)`
- [ADR-020: Per-User Feature Permissions](./ADR-020-per-user-feature-permissions.md) — permission registry
- [ADR-030: Zod Validation Architecture](./ADR-030-zod-validation-architecture.md) — DTO factory
- [ADR-037: Approvals Architecture](./ADR-037-approvals-architecture.md) — generic approval engine (rejected as backend reuse, accepted as frontend host)
- [ADR-045: Permission & Visibility Design](./ADR-045-permission-visibility-design.md) — 4-layer model parallel
- [Navigation Map Pointer Injection ADR](./ADR-053-navigation-map-pointer-injection.md) — number-conflict reference (D14)
- PostgreSQL — [Row-Level Security](https://www.postgresql.org/docs/18/ddl-rowsecurity.html), [Trigger Procedures](https://www.postgresql.org/docs/18/plpgsql-trigger.html), [`set_config()`](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-ADMIN-SET)

---

## Changelog

| Version | Date       | Change                                                         |
| ------- | ---------- | -------------------------------------------------------------- |
| 1.0.0   | 2026-04-28 | Initial — accepted on completion of Phases 1–5 (Sessions 1–9c) |
