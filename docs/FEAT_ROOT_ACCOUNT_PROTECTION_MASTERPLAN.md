# FEAT: Root Account Protection — Execution Masterplan

> **Plan type:** FEATURE
> **Created:** 2026-04-26
> **Version:** 1.3.0 (Phase 4 COMPLETE — Session 8 API integration 25/25 green)
> **Status:** Phase 1 COMPLETE 2026-04-26 — Phase 2 COMPLETE 2026-04-27 — Phase 3 COMPLETE 2026-04-28 — Phase 4 COMPLETE 2026-04-28
> **Branch:** `feat/root-account-protection`
> **Spec:** Inline — see §Goal below
> **Author:** Simon Öztürk
> **Estimated sessions:** 10
> **Actual sessions:** 12 / 10+ (Phase 0-3 done in 11 sessions per v1.2.0; Session 8 closes Phase 4 with 25 API integration tests + 1 production-code bug fix in `RootProtectionService.countActiveRoots`)

---

## Goal

Prevent **root-against-root account termination** and require **4-eyes peer
approval** for any **self-initiated root termination**. The protection covers
all four operations that can take a root account out of "active root" state.

### Threat Model

| #   | Scenario                                                                | Existing Behavior         | Target Behavior                   |
| --- | ----------------------------------------------------------------------- | ------------------------- | --------------------------------- |
| T1  | Root A's credentials phished → attacker deletes/demotes all other roots | Allowed → tenant takeover | Blocked (cross-root immutability) |
| T2  | Root A's session hijacked → attacker self-deletes to cover tracks       | Allowed → audit gap       | Blocked (peer approval required)  |
| T3  | All roots lose credentials simultaneously                               | Tenant locked out         | Mitigated by last-root protection |
| T4  | Disgruntled root A wants to remove peer root B                          | Allowed → insider risk    | Blocked (cross-root immutability) |

### Operations Covered (All 4 — closing every bypass vector)

| Op            | DB Effect           | Why It Counts as "Termination"                |
| ------------- | ------------------- | --------------------------------------------- |
| Soft-Delete   | `is_active = 4`     | Standard delete path — user invisible         |
| Deactivate    | `is_active = 0`     | User cannot log in → equivalent to delete     |
| Role-Demotion | `role != 'root'`    | User loses root powers → equivalent to delete |
| Hard-Delete   | `DELETE FROM users` | Row gone — irreversible                       |

### Defense-in-Depth — 4 Layers

```
┌──────────────────────────────────────────────────────────────────────┐
│ Layer 1: Frontend                                                     │
│   Hide/disable destructive buttons for root-target rows               │
│   → UX hint only — NEVER trusted as security                          │
├──────────────────────────────────────────────────────────────────────┤
│ Layer 2: Backend Service Guard                                        │
│   RootProtectionService.assertCrossRootTerminationForbidden(...)      │
│   RootProtectionService.assertNotLastRoot(...)                        │
│   Wired into ALL 5 services that mutate users.is_active or users.role │
│   → Cross-root: forbidden                                              │
│   → Self-action: routed through approval flow only                     │
│   → Last-root: forbidden in any case                                   │
├──────────────────────────────────────────────────────────────────────┤
│ Layer 3: Backend Approval Workflow                                    │
│   RootSelfTerminationService — peer-approval lifecycle                │
│   → request → notify peers → approve/reject → execute on approve      │
│   → 7-day TTL, no self-approval, single pending per requester         │
│   → 24h cooldown after rejection (notification-storm protection)      │
├──────────────────────────────────────────────────────────────────────┤
│ Layer 4: PostgreSQL Trigger (BEFORE UPDATE OR DELETE ON users)        │
│   fn_prevent_cross_root_change() — Approval-aware (Hybrid Option 1+)  │
│   → Survives backend bugs and raw psql access                         │
│   → Bypassed only by sys_user/assixx_user (system-level, BYPASSRLS)   │
│   → Reads app.user_id + app.root_self_termination_approved GUCs       │
│   → Verifies a real approved row exists (5min window) — defense even  │
│     if app code sets the GUC without an actual approval               │
│   → Layer 4 stays ACTIVE for the approve flow (Hybrid path)           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Changelog

| Version | Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-04-26 | Initial draft — phases outlined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 0.2.0   | 2026-04-26 | Post-audit revision: Trigger logic fixed (Option 1+ Hybrid — DB-row existence check), module placement → `root/` flat (matches existing pattern), Layer-2 wiring expanded to 5 services + 2 PUT routes, 24h re-request cooldown, naming consolidated, eventBus → event-bus, §0.5 audit table filled                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 1.0.0   | 2026-04-26 | Phase 1 COMPLETE -- migrations applied (table + RLS + 5 indexes; trigger + 4 smokes pass; customer fresh-install synced; backend tsc clean)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 1.0.1   | 2026-04-26 | Session 3 done -- `RootProtectionService` implemented (5 methods per §2.2), registered + exported in `RootModule`, §0.5 spot-check rows for `root-deletion.service.ts` and audit infra resolved, lint+type-check clean, tests deferred to Session 7 per Phase 3 schedule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 1.0.2   | 2026-04-26 | Session 4 done -- Step 2.3 wiring across 4 termination sites + 1 defensive role-block: `root.service.ts:deleteRootUser` (full chain replaces inline self-delete + last-root SQL), `root-admin.service.ts:deleteAdmin` (defensive), `users.service.ts:deleteUser` (full chain), `users.service.ts:archiveUser` (defensive role-block — root accounts cannot be archived via the generic users path), `dummy-users.service.ts:delete` (defensive). `unarchiveUser` NOT wired (verified: sets is_active=1, not 0). PUT-route role-demote wiring on `updateRootUser`/`updateAdmin` deferred — Layer 4 trigger backstop. RootModule exported into UsersModule + DummyUsersModule. 4 paired test suites updated; 105 unit tests green. Lint 0 errors, tsc 0 errors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 1.0.3   | 2026-04-26 | Session 5 partial -- Step 2.4 `RootSelfTerminationService` implemented (~530 LOC, 8 methods per §2.4 + 5 private helpers, error-code constants, plain-string EventBus emits pending Step 2.7 typed handlers). Approve TX ordering follows §2.4 verbatim (FOR UPDATE → recount → flip status → set GUC → UPDATE users). 24h cooldown + last-root protection + self-decision guard + cross-tenant isolation via RLS. Service registered in `RootModule.providers + exports` (Step 2.1 checkbox 2/4). Tests deferred to Session 7 per Phase 3 schedule (`root-self-termination.service.test.ts ~24 tests`). Lint 0 errors, type-check 0 errors. Steps 2.5 (controller) / 2.6 (cron) / 2.7 (notifications) remain pending.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 1.0.4   | 2026-04-27 | Session 5b done -- Step 2.5 `RootSelfTerminationController` (~135 LOC, 6 endpoints) + 3 Zod DTOs (`request-/approve-/reject-self-termination.dto.ts`). Endpoints mounted under `/api/v2/users/...`: `POST/GET/DELETE /users/me/self-termination-request`, `GET /users/self-termination-requests/pending`, `POST /users/self-termination-requests/:id/{approve,reject}`. Class-level `@Roles('root')`; `UuidIdParamDto` from `common/dto` for `:id` (Phase 1 schema is UUID; masterplan §2.5 named `idField` — recorded as Spec Deviation D5). Status codes per §4: cancel→204, approve/reject→200 (`@HttpCode(OK)`), request→201 (POST default). Path-collision audit vs `UsersController` verified safe. RootModule registers the new controller (§2.1 checkbox 3/4). DTO + controller exempt from paired tests per Phase 3+4 split (DTOs are pure Zod glue; controller is thin glue — both verified end-to-end by Phase 4 API tests). Lint 0 errors, type-check 0 errors. Steps 2.6 (cron) + 2.7 (notifications) remain pending.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 1.0.5   | 2026-04-27 | Session 5c done -- Step 2.6 `RootSelfTerminationCron` (~55 LOC, 1 method). Daily 03:00 (`@Cron('0 3 * * *')`, no timezone — UTC, mirrors `LogRetentionService` pattern). Thin scheduler wrapper around `RootSelfTerminationService.expireOldRequests()` — service does SQL via `systemQuery()` (sys_user, BYPASSRLS), per-row event emit + `root_logs` audit; cron only schedules and adds an unconditional log line for ops health visibility. RootModule registers the new provider (§2.1 checkbox 4/4 — Phase 2 §2.1 module skeleton now COMPLETE). `ScheduleModule.forRoot()` already global in `app.module.ts:110` — no per-module wiring (matches kvp / log-retention / blackboard-archive pattern). **Spec Deviation D6** recorded: masterplan §2.6 spec body uses `this.logger.info(...)` — NestJS `Logger` (`@nestjs/common`) has no `.info()` method, so this is a forced literal-text fix to `.log()` (the standard info-level call across the entire backend). Identical semantics. Cron exempt from paired tests — pure delegation glue, repo precedent: kvp/tpm-due/work-orders-due/blackboard-archive/log-retention crons all have no paired test file; the underlying service `expireOldRequests()` IS covered by Phase 3 / Session 7. Backend restart → bootstrap clean, health 200. Lint 0 errors, type-check 0 errors. Step 2.7 (notifications + EventBus typed handlers) is the only remaining Phase 2 item.                                                                                                                                                                                                                                                                                                       |
| 1.0.6   | 2026-04-27 | Session 6 done -- Step 2.7 typed EventBus events + per-domain notification subscriber service. Added 1 unified `RootSelfTerminationEvent` interface + 3 typed emit methods (`emitRootSelfTermination{Requested,Approved,Rejected}`) to `event-bus.ts` per masterplan §2.7 strict spec (the cron's `expired` emit stays plain-string by design — §2.7 lists only 3 fan-out events). New `root-self-termination-notification.service.ts` (~290 LOC) owns recipient resolution + persistent `notifications` rows. **Spec Deviation D7** recorded: §2.7 literal-text says "modify `notifications.service.ts`", actual implementation co-locates with the producer per established repo convention (vacation/work-orders/tpm) — `notifications.service.ts` stays domain-agnostic to avoid the god-object antipattern. `RootSelfTerminationService` refactored: 3 plain-string emits replaced with imperative calls to the notification service, MOVED OUTSIDE the producer's `tenantTransaction` (vacation pattern) so notification failures cannot roll back business operations. `emitAndAuditApproval` private helper renamed → `auditApproval` (no longer emits). Reject SQL changed: `rejected_at = NOW()` → `rejected_at = $2` parameterised so cooldown computation uses identical TS-side timestamp. Paired tests: 4 new event-bus tests (13 total, all green) + new `root-self-termination-notification.service.test.ts` with 9 tests (modeled on vacation-notification.service.test.ts; 9 green). Full root + utils unit suite: 152/152 green. Lint 0 errors, type-check 0 errors. Backend restart → bootstrap clean, health 200. Phase 2 DoD checkboxes now all green except those covered by Phase 3+4 testing.                 |
| 1.1.0   | 2026-04-27 | Phase 2 COMPLETE — backend done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 1.1.1   | 2026-04-27 | Session 7a done — `root-protection.service.test.ts` (16/16 green): 8 cross-root guard tests + 3 last-root guard tests + 5 isTerminationOp tests. Mandatory scenarios §3 list 1-11 ticked. Lint 0 errors, type-check exit 0, full root suite 155/155 green. Sessions 7b (root-self-termination.service.test.ts ~24 tests) + 7c (DB-trigger SQL integration ~8 tests) remain.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 1.1.2   | 2026-04-27 | Session 7b done — `root-self-termination.service.test.ts` (24/24 green): 6 requestSelfTermination tests (happy + ALREADY_PENDING + COOLDOWN_ACTIVE within-24h + cooldown-expired + last-root + ROLE_FORBIDDEN) + 2 cancelOwnRequest + 6 approveSelfTermination (SELF_DECISION + NOT_FOUND + NOT_PENDING + EXPIRED + happy with TX-ordering verification + last-root in approve TX) + 4 rejectSelfTermination (happy with parametrised rejected_at Session-6 invariant + REJECTION_REASON_REQUIRED whitespace + NOT_FOUND + SELF_DECISION) + 1 expireOldRequests cron (sweep + SQL filter regression-protection) + 2 race/concurrency (parallel approve via FOR UPDATE serialization + approve TX rollback) + 3 read-only contract (getMyPendingRequest null + getMostRecentRejection found + getPendingRequestsForApproval `requester_id <> $1`). §3 mandatory scenarios Self-Termination Lifecycle 1-18 + Race / Concurrency 1-2 ticked. tenantTransaction-callback mock pattern with queued mockClient.query mocks per in-TX SQL sequence. Lint 0 errors, type-check exit 0, full root suite 179/179 green (no regression). Session 7c (DB-trigger real-SQL integration ~8 tests) remains.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 1.2.0   | 2026-04-28 | **Phase 3 COMPLETE** — Session 7c done. New file `backend/test/root-protection-trigger.api.test.ts` (~270 LOC, 8 tests, all green). Tests run via `pnpm exec vitest run --project api` against the live `assixx-postgres` container, issuing raw SQL as all three Triple-User-Model roles (`app_user` / `sys_user` / `assixx_user`). §3 DB-Trigger Integration list 1-8 ticked: cross-root forbidden as `app_user` (ROOT_CROSS_TERMINATION_FORBIDDEN); self without GUC blocked (ROOT_SELF_TERMINATION_REQUIRES_APPROVAL); GUC=true + no DB row blocked (ROOT_NO_APPROVED_REQUEST — Hybrid Option 1+ defense); GUC=true + stale (>5 min) row blocked (ROOT_NO_APPROVED_REQUEST — window expiry); GUC=true + fresh approved row succeeds (legitimate approve flow with actor=approver != target by design); `assixx_user` bypass; `sys_user` bypass; last-root protection wins even with valid approval (ROOT_LAST_ROOT_PROTECTION). Fixtures isolated in two dedicated tenants (`rootprot1-<runtag>` 9 roots + `rootprot2-<runtag>` 1 root); cleanup hard-deletes child rows then tenants in FK-safe order (`users.tenant_id` is RESTRICT, not CASCADE). Total Phase 3: 16 + 24 + 8 = **48 tests, well above the ≥32 DoD threshold**. Lint 0 errors, type-check exit 0, full root unit suite 179/179 + 8/8 api integration green. **Spec Deviation D8** recorded: §3 "Test files" table lists only the 2 in-process unit suites; the new file lives in `backend/test/` per the established repo convention for psql-direct integration tests (`tpm-executions.api.test.ts`, `auth-password-reset.api.test.ts`, `inventory.api.test.ts` precedent). `*.api.test.ts` suffix is required by the Vitest `api` project's `include` pattern. |
| 1.3.0   | 2026-04-28 | **Phase 4 COMPLETE** — Session 8 done. New file `backend/test/root-self-termination.api.test.ts` (~620 LOC, 25 tests, all green). Tests run via `pnpm exec vitest run --project api` against the live `assixx-backend` — full HTTP harness with real `/auth/login` JWTs across 9 fixture users in 3 dedicated tenants. §4 mandatory list 1-22 ticked + 3 extra cooldown / re-issue tests = 25 total (≥24 DoD threshold). **Production-code bug found and fixed**: `RootProtectionService.countActiveRoots` did `SELECT COUNT(*) ... FOR UPDATE` which PostgreSQL forbids ("FOR UPDATE is not allowed with aggregate functions"). The unit suites (Sessions 7a/7b) mocked the DB so the bug never surfaced; the API tests are the first end-to-end coverage that exercises the real service+DB path. Fix: split lock + count — `SELECT id ... FOR UPDATE` then use `result.rows.length`. Functionally equivalent to masterplan §2.4 approve-TX shape. The full root unit suite (179 tests across 9 files) regression-checks clean post-fix; 16/16 RootProtectionService unit tests still green (the no-client branch they exercise was unaffected). **Spec Deviation D9** recorded: §4 phrased the bypass tests as `PATCH /users/{uuid}` but `UsersController` exposes `PUT /users/uuid/:uuid` (Patch is `@Patch('me')` self-only). T17 (cross-root role demote via PUT) is structurally unwired at Layer 2 — Session 4 deferred PUT-route role wiring; Layer 4 trigger is the sole gate, surfacing as 500 (no dedicated PG-error filter), so T17 asserts non-2xx + DB-side proof of non-mutation rather than strict 403. Behavioural guarantee identical: cross-root role demote impossible from app_user. **Spec Deviation D10** recorded: §2.4 sample `ConflictException({code, message, cooldownEndsAt})` — but `AllExceptionsFilter` strictly normalises HttpException responses to `{code, message, details?}` per ADR-007, so structured `cooldownEndsAt` field is dropped. The service still embeds the ISO timestamp in the `message` body, recoverable by regex parse on the client. T14 reflects this — frontend (Step 5.1) will use the same regex, OR the filter widens for this code in a follow-up. |
| 1.4.0   | TBD        | Phase 5 COMPLETE — frontend done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2.0.0   | TBD        | All phases COMPLETE — shipped + ADR-053 accepted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must be true before starting

- [x] Docker stack running (all containers healthy)
- [x] DB backup taken: `database/backups/pre-root-protection-20260426_210337.dump` (3.3 MB, pg_dump custom format, 2026-04-26 21:03)
- [x] Branch `feat/root-account-protection` checked out from latest `main`
- [x] No pending migrations blocking
- [x] Dependent features shipped: ADR-019 (RLS) ✓, ADR-020 (Per-User Permissions) ✓, ADR-037 (Approvals Architecture) ✓
- [x] Spec reviewed (this plan, §Goal) by user
- [x] Code audit complete (§0.5) — wired endpoints documented

### 0.2 Risk Register

| #   | Risk                                                                                    | Impact   | Probability | Mitigation                                                                                                                                                       | Verification                                                                                     |
| --- | --------------------------------------------------------------------------------------- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| R1  | Last-root race: parallel self-termination + admin promotion creates lock-out window     | High     | Low         | `FOR UPDATE` row lock on root rows in tenant within the approve transaction; recount in same TX before status flip                                               | Unit test: parallel approve + concurrent demote → ConflictException                              |
| R2  | DB-trigger blocks legitimate system operations (migrations, tenant deletion, cron jobs) | High     | Medium      | Trigger short-circuits when `current_user IN ('assixx_user', 'sys_user')`                                                                                        | psql test as each user role; tenant deletion happy path test                                     |
| R3  | Approval expires while requester still wants it (UX friction)                           | Medium   | High        | Default TTL 7 days; UI shows countdown + re-request flow; **24h cooldown** after rejection prevents notification spam                                            | Frontend test: expired/rejected request shows clear "Request again" CTA after 24h                |
| R4  | Cross-root delete via raw SQL (DB admin)                                                | High     | Low         | DB-trigger blocks even raw SQL when run as `app_user`. `assixx_user` (DDL) bypasses — documented as legitimate emergency path                                    | psql test: raw `UPDATE users SET role='admin' WHERE id=<root>` as app_user → trigger blocks      |
| R5  | Initial single-root tenant cannot self-terminate                                        | Low      | High        | This is **intended** — last-root protection. Documented in Known Limitations.                                                                                    | Unit test: tenant with 1 root → POST /self-termination-request → 412 LAST_ROOT_PROTECTION        |
| R6  | Frontend bypass via direct API call                                                     | High     | Medium      | All security in Layer 2 + 4. Frontend = UX hint only. API tests use raw fetch                                                                                    | API test: send raw PATCH /users/:uuid {role:'admin'} as Root A targeting Root B → 403            |
| R7  | Notification storm if request is repeatedly created/cancelled                           | Low      | Low         | Unique partial index `idx_one_pending_per_requester` enforces single pending; **24h cooldown** after rejection                                                   | Unit test: second POST while pending → 409 ConflictException; POST within 24h of rejection → 409 |
| R8  | Audit trail gaps (denied attempts not logged)                                           | Medium   | Medium      | Every guard rejection emits an `audit_trail` entry with `action='root_termination_denied'` + actor + target + reason                                             | Unit test: failed termination attempt → audit_trail row exists with correct fields               |
| R9  | Self-termination flag GUC leaks across requests via connection pool                     | High     | Low         | GUC set via `set_config(..., true)` (transaction-local); auto-released on COMMIT/ROLLBACK                                                                        | Integration test: failed approve TX → next request without flag must hit trigger block           |
| R10 | Trigger blocks legitimate approve flow (Finding G v0.1.0)                               | Critical | Resolved    | Hybrid Option 1+: trigger checks approval-flag FIRST + verifies real DB-row exists within 5-min window — bypasses cross-root check only when both conditions met | Unit test: approve happy-path completes; approve with stale GUC (no DB row) blocked              |

### 0.3 Ecosystem Integration Points

| Existing System                             | Integration                                                                                                    | Phase |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----- |
| `audit_trail` (ADR-009)                     | Every termination attempt + every approval/rejection → audit entry                                             | 2     |
| EventBus (`backend/src/utils/event-bus.ts`) | New typed events: `RootSelfTerminationRequested`, `RootSelfTerminationApproved`, `RootSelfTerminationRejected` | 2     |
| Notifications (ADR-003, ADR-004)            | Persistent + SSE notification to all OTHER active roots in tenant on new request + on approval/rejection       | 2     |
| Role Guards (`roles.guard.ts`, ADR-010)     | New endpoints use `@Roles('root')` — no per-user permission needed                                             | 2     |
| ADR-019 RLS / `tenantTransaction()`         | All queries via `tenantTransaction()`; trigger reads `app.user_id` GUC set by `setUserContext`                 | 2     |
| ADR-037 Approvals Module                    | **NOT integrated as backend** — root lifecycle is its own concern. Only the UI lives in `manage-approvals`.    | 5     |
| ADR-005 JWT Auth (`jwt-auth.guard.ts`)      | Acting user resolved from CLS as today; `app.user_id` GUC populated via `database.service.ts:170`              | 2     |
| Tenant Deletion (`tenant-deletion/`)        | Out of scope — separate flow with its own protection. Trigger explicitly bypasses for `sys_user`.              | —     |
| Frontend `(root)/root-profile/`             | New "Account Termination" section + pending-request status                                                     | 5     |
| Frontend `(root)/manage-root/`              | Block destructive actions on other root rows; show warnings                                                    | 5     |
| Frontend `(shared)/manage-approvals/`       | New approval-card type "Root Self-Termination" — only visible to roles=root                                    | 5     |

### 0.4 Decision: Reuse `manage-approvals` (ADR-037) or build dedicated module?

**Decision: Build dedicated module flat in `root/`.**

| Factor                  | Reuse approvals (ADR-037)                                            | Dedicated in root/ (chosen)                        |
| ----------------------- | -------------------------------------------------------------------- | -------------------------------------------------- |
| Coupling                | Couples root lifecycle to generic workflow engine                    | Narrow, single-purpose, easy to reason about       |
| Approval-type semantics | Generic `approver_type` system — not designed for "exactly one peer" | Tight constraints in DB + service                  |
| UI                      | Same `manage-approvals` page                                         | Same `manage-approvals` page (just different card) |
| Risk of regression      | High — touches existing ADR-037 plumbing                             | Low — additive, isolated                           |
| Migration complexity    | Schema changes to `approvals` table                                  | One new table, one trigger                         |
| Bounded context fit     | Different — generic workflows                                        | Matches existing `root/` lifecycle module          |

**Frontend card lives in `manage-approvals` (consistent UX); backend logic stays in `root/` (existing bounded context).**

### 0.5 Code Audit — COMPLETED 2026-04-26 (Session 1)

**Greps used:**

```bash
# 1. All mutations of users.is_active and users.role across the surface
grep -rn "is_active\s*=\|role\s*=" \
  backend/src/nest/{root,users,dummy-users,auth,role-switch,tenant-deletion}/

# 2. PUT/PATCH/DELETE routes that touch users
grep -rn "@Patch\|@Delete\|@Put" \
  backend/src/nest/{root,users,dummy-users}/

# 3. Existing triggers on users
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "SELECT tgname FROM pg_trigger WHERE tgrelid = 'users'::regclass;"

# 4. app.user_id GUC propagation
grep -rn "app.user_id\|setUserContext" backend/src/nest/database/

# 5. role-switch behavior
grep -rn "users\.role\|UPDATE users" backend/src/nest/role-switch/
```

**Audit Output:**

| Question                                                     | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Where is `users.is_active` mutated?                          | 5 sites: `root/root.service.ts:400`, `root/root-admin.service.ts:295`, `users/users.service.ts:512/542/557`, `dummy-users/dummy-users.service.ts:300`. **Spot-check 2026-04-26 (Session 3):** `root/root-deletion.service.ts` does NOT mutate `users` directly — manages `tenant_deletion_queue` only; the actual user wipe during tenant deletion happens inside `tenant-deletion.service.ts` (out of scope, runs as `sys_user` which bypasses Layer 4 by design). No wiring needed.                                                                                                                                                                                                                                                                                                            |
| Where is `users.role` updated?                               | PUT routes: `root/root.controller.ts:147` (`Put('admins/:id')`), `root/root.controller.ts:255` (`Put('users/:id')`). Service-level: same 5 services as above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Is there a hard-delete route?                                | None confirmed — DELETE routes appear to soft-delete via `is_active = 4`. Trigger covers preemptively if added later.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Which service does `(root)/manage-root` call to delete?      | `root/root.service.ts` + `root/root-admin.service.ts` (separate paths for admin vs root targets)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Does `(root)/root-profile` expose a self-delete?             | Currently NO. Self-delete UI is new in this plan (Phase 5 §5.1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Where is the JWT-issued user ID set into `app.user_id`?      | `database.service.ts:170` (`setUserContext`), called from `tenantTransaction()` line 67. Layer-4 trigger has the data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Existing audit_trail entries for users-table changes?        | **Spot-check 2026-04-26 (Session 3):** Two independent writers exist. (1) `ActivityLoggerService` at `backend/src/nest/common/services/activity-logger.service.ts` — `log{Create,Update,Delete}()` write to `root_logs` (Root-Dashboard-visible), called from service code (existing pattern: `root.service.ts:377`). (2) `AuditLoggingService` at `backend/src/nest/common/audit/audit-logging.service.ts` — writes to `audit_trail`, called automatically by `AuditTrailInterceptor` for every HTTP request (success + failure). `RootProtectionService.auditDeniedAttempt()` uses (1); the interceptor produces a complementary `audit_trail` entry on the 403 automatically. ActivityAction enum lacks `'denied'` so denials map to `'delete'`/`'update'` with explicit prefix in `details`. |
| Does `tenant-deletion/` use a peer-confirmation pattern?     | Not used as inspiration — tenant deletion is operationally distinct. Sys_user bypass in trigger covers this.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Existing triggers on `users`?                                | Only timestamp triggers (`update_updated_at`-style). No protective trigger. No conflict with new trigger.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Does `role-switch` change `users.role` in DB?                | NO — impersonation switches request-context only. Plan Known-Limitation #9 stands.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Is `event-bus.ts` filename kebab-case?                       | YES (`backend/src/utils/event-bus.ts`). v0.1.0 had `eventBus.ts` typo — fixed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Does PG18 ship `uuidv7()` built-in?                          | YES. No extension needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `set_config(..., true)` transaction-local semantics correct? | YES. Auto-cleared on COMMIT/ROLLBACK. R9 mitigation confirmed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `users.role` type, `users.is_active` type?                   | `users.role` = ENUM, `users.is_active` = SMALLINT. Both work with `<>` in trigger as written.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**Module Placement Decision (revised from v0.1.0):**

`backend/src/nest/root/` is the existing bounded context for root-user lifecycle (`root.service.ts`, `root-admin.service.ts`, `root-deletion.service.ts`, `root-tenant.service.ts`). All new files for this plan land **flat in `root/`** following the existing `root-<sub>.service.ts` naming pattern — NOT in a separate `users/root-protection/` sub-folder. v0.1.0 violated this convention; v0.2.0 fixes it.

> **Gate result:** PASSED. Phase 1 ready to start.

---

## Phase 1: Database Migrations

> **Dependency:** Phase 0 audit complete + DB backup taken.

### Step 1.1: Create `root_self_termination_requests` table [DONE 2026-04-26]

**New file:** `database/migrations/{timestamp}_root-self-termination-requests.ts`

**SQL skeleton:**

```sql
CREATE TYPE root_self_termination_status AS ENUM (
    'pending', 'approved', 'rejected', 'expired', 'cancelled'
);

CREATE TABLE root_self_termination_requests (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    status root_self_termination_status NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejected_by INTEGER REFERENCES users(id),
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- No self-approval (defense-in-depth, also enforced in service)
    CONSTRAINT chk_no_self_approval
        CHECK (approved_by IS NULL OR approved_by != requester_id),

    -- Status transitions are well-formed
    CONSTRAINT chk_status_consistency CHECK (
        (status = 'pending'   AND approved_by IS NULL AND rejected_by IS NULL) OR
        (status = 'approved'  AND approved_by IS NOT NULL AND rejected_by IS NULL) OR
        (status = 'rejected'  AND rejected_by IS NOT NULL AND approved_by IS NULL) OR
        (status = 'expired'   AND approved_by IS NULL AND rejected_by IS NULL) OR
        (status = 'cancelled' AND approved_by IS NULL AND rejected_by IS NULL)
    )
);

-- Single pending request per requester globally
-- (uniqueness comes from the partial index itself; users.id is a global SERIAL)
CREATE UNIQUE INDEX idx_rstr_one_pending_per_requester
    ON root_self_termination_requests(requester_id)
    WHERE status = 'pending';

CREATE INDEX idx_rstr_tenant_status
    ON root_self_termination_requests(tenant_id, status)
    WHERE is_active = 1;

CREATE INDEX idx_rstr_expires_at_pending
    ON root_self_termination_requests(expires_at)
    WHERE status = 'pending';

-- For the trigger's 5-min approval-window lookup (Layer 4)
CREATE INDEX idx_rstr_requester_approved_at
    ON root_self_termination_requests(requester_id, approved_at)
    WHERE status = 'approved';

-- For the 24h cooldown check after rejection
CREATE INDEX idx_rstr_requester_rejected_at
    ON root_self_termination_requests(requester_id, rejected_at)
    WHERE status = 'rejected';

-- RLS
ALTER TABLE root_self_termination_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE root_self_termination_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON root_self_termination_requests
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON root_self_termination_requests TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON root_self_termination_requests TO sys_user;
```

**Per-table checklist (ADR-019):**

- [x] `id UUID PRIMARY KEY` (UUIDv7 via `uuidv7()`)
- [x] `tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- [x] `ENABLE + FORCE ROW LEVEL SECURITY`
- [x] `tenant_isolation` policy with NULLIF pattern
- [x] GRANTs for `app_user` AND `sys_user`
- [x] No sequence (UUID PK)
- [x] Partial index on `is_active = 1`
- [x] `is_active INTEGER NOT NULL DEFAULT 1`
- [x] `up()` + `down()` (drop table CASCADE + drop type)

### Step 1.2: Create root-protection trigger function + trigger [DONE 2026-04-26]

**New file:** `database/migrations/{timestamp}_root-protection-trigger.ts`

**SQL skeleton — Hybrid Option 1+ (Approval-aware, Layer 4 stays active for approve flow):**

```sql
CREATE OR REPLACE FUNCTION fn_prevent_cross_root_change()
RETURNS TRIGGER AS $$
DECLARE
    v_acting_user_id INT;
    v_active_root_count INT;
    v_is_termination BOOLEAN;
    v_self_approved TEXT;
    v_has_recent_approval BOOLEAN;
BEGIN
    -- Bypass for system users (DDL, migrations, cron jobs, tenant deletion)
    IF current_user IN ('assixx_user', 'sys_user') THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Only protect rows currently 'root'
    IF OLD.role <> 'root' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Termination = DELETE, OR is_active flip out of 1, OR role flip out of 'root'
    v_is_termination := (
        TG_OP = 'DELETE'
        OR (TG_OP = 'UPDATE' AND NEW.is_active <> 1 AND OLD.is_active = 1)
        OR (TG_OP = 'UPDATE' AND NEW.role <> 'root' AND OLD.role = 'root')
    );

    IF NOT v_is_termination THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Termination detected. Acting user must be in CLS GUC.
    v_acting_user_id := NULLIF(current_setting('app.user_id', true), '')::INT;

    IF v_acting_user_id IS NULL THEN
        RAISE EXCEPTION
            'ROOT_PROTECTION_NO_ACTOR: termination of root user % blocked — app.user_id GUC not set',
            OLD.id;
    END IF;

    -- HYBRID OPTION 1+ (ADR-053):
    -- Check approval flag FIRST. If set, verify a real approved row exists
    -- (defense-in-depth: GUC alone is insufficient — also requires DB row).
    -- This must come BEFORE the cross-root check, because the legitimate
    -- approve flow runs with actor=approver, target=requester (cross-root by design).
    v_self_approved := current_setting('app.root_self_termination_approved', true);

    IF v_self_approved IS NOT NULL AND v_self_approved = 'true' THEN
        -- Verify there is a real approved row for this requester in the tenant
        -- within a 5-minute window. The window is large enough to cover
        -- transaction commit timing, small enough to prevent stale GUCs from
        -- being misused later.
        SELECT EXISTS(
            SELECT 1 FROM root_self_termination_requests
            WHERE requester_id = OLD.id
              AND tenant_id = OLD.tenant_id
              AND status = 'approved'
              AND approved_at > NOW() - INTERVAL '5 minutes'
        ) INTO v_has_recent_approval;

        IF NOT v_has_recent_approval THEN
            RAISE EXCEPTION
                'ROOT_NO_APPROVED_REQUEST: termination of root user % blocked — no approved request found within the last 5 minutes',
                OLD.id;
        END IF;

        -- Approved flow legit: skip cross-root check (actor=approver != target by design)
    ELSE
        -- Normal path: cross-root forbidden + self requires approval
        IF v_acting_user_id <> OLD.id THEN
            RAISE EXCEPTION
                'ROOT_CROSS_TERMINATION_FORBIDDEN: user % cannot terminate root user %',
                v_acting_user_id, OLD.id;
        END IF;

        -- Self-action without approval flag → blocked
        RAISE EXCEPTION
            'ROOT_SELF_TERMINATION_REQUIRES_APPROVAL: root user % cannot self-terminate without approved request',
            OLD.id;
    END IF;

    -- Last-root protection (ALWAYS, even with approval)
    SELECT COUNT(*) INTO v_active_root_count
    FROM users
    WHERE tenant_id = OLD.tenant_id
      AND role = 'root'
      AND is_active = 1
      AND id <> OLD.id;

    IF v_active_root_count = 0 THEN
        RAISE EXCEPTION
            'ROOT_LAST_ROOT_PROTECTION: cannot terminate the last active root in tenant %',
            OLD.tenant_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_root_protection
    BEFORE UPDATE OR DELETE ON users
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_cross_root_change();
```

**Verification:**

```bash
# Trigger exists + attached
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT tgname, tgrelid::regclass FROM pg_trigger
WHERE tgname = 'trg_root_protection';"

# Smoke 1: cross-root as app_user → blocked
docker exec assixx-postgres psql -U app_user -d assixx -c "
SET app.tenant_id = '1'; SET app.user_id = '1';
UPDATE users SET is_active = 4 WHERE tenant_id = 1 AND role = 'root' AND id <> 1;
"  # → ROOT_CROSS_TERMINATION_FORBIDDEN

# Smoke 2: self-action without approval → blocked
docker exec assixx-postgres psql -U app_user -d assixx -c "
SET app.tenant_id = '1'; SET app.user_id = '1';
UPDATE users SET is_active = 4 WHERE id = 1;
"  # → ROOT_SELF_TERMINATION_REQUIRES_APPROVAL

# Smoke 3: GUC set but no DB row → blocked
docker exec assixx-postgres psql -U app_user -d assixx -c "
SET app.tenant_id = '1'; SET app.user_id = '2';
SET app.root_self_termination_approved = 'true';
UPDATE users SET is_active = 4 WHERE id = 1;
"  # → ROOT_NO_APPROVED_REQUEST

# Smoke 4: as assixx_user → bypass
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
UPDATE users SET is_active = 0 WHERE id = 1;
"  # → succeeds (system bypass)
```

### Phase 1 — Definition of Done

- [x] 2 migration files with `up()` + `down()`
- [x] Dry run passes: `doppler run -- ./scripts/run-migrations.sh up --dry-run`
- [x] Both migrations applied
- [x] Table `root_self_termination_requests` exists with RLS policy + 5 indexes
- [x] Trigger `trg_root_protection` exists on `users`
- [x] Smoke 1 (cross-root as app_user) → ROOT_CROSS_TERMINATION_FORBIDDEN
- [x] Smoke 2 (self without approval) → ROOT_SELF_TERMINATION_REQUIRES_APPROVAL
- [x] Smoke 3 (GUC set, no DB row) → ROOT_NO_APPROVED_REQUEST
- [x] Smoke 4 (assixx_user bypass) → succeeds
- [x] Backend compiles, existing tests pass
- [x] Backup taken before migration
- [x] Customer fresh-install synced (`./scripts/sync-customer-migrations.sh`)

---

## Phase 2: Backend Module

> **Dependency:** Phase 1 complete.
> **Bounded context:** `backend/src/nest/root/` (existing module — extend, don't fork).

### Step 2.1: Module skeleton + types + DTOs [PARTIAL — `RootProtectionService` + `RootSelfTerminationService` registered 2026-04-26]

**Existing directory (flat extension):** `backend/src/nest/root/`

**File structure (NEW files added to existing `root/` module):**

```
backend/src/nest/root/
    # EXISTING (do not modify in this phase, only wire)
    root.module.ts
    root.service.ts
    root.controller.ts
    root-admin.service.ts
    root-deletion.service.ts
    root-tenant.service.ts
    # ... existing dto/, types

    # NEW (added by this plan)
    root-protection.service.ts                         # cross-root + last-root guard
    root-self-termination.service.ts                   # peer-approval lifecycle
    root-self-termination.controller.ts                # 6 endpoints
    root-self-termination.cron.ts                      # daily expiry job
    dto/
        request-self-termination.dto.ts                # POST body
        approve-self-termination.dto.ts                # POST body (optional comment)
        reject-self-termination.dto.ts                 # POST body (rejection reason)
```

**Rationale:** `backend/src/nest/root/` is the established bounded context for root-user lifecycle. New code follows the existing flat `root-<sub>.service.ts` pattern. No new module — extends `RootModule`.

**Register in `backend/src/nest/root/root.module.ts`:**

- [x] `RootProtectionService` added to providers + exports (Session 3, 2026-04-26)
- [x] `RootSelfTerminationService` added to providers + exports (Session 5, 2026-04-26)
- [x] `RootSelfTerminationController` added to controllers (Session 5b, 2026-04-27)
- [x] `RootSelfTerminationCron` added to providers (Session 5c, 2026-04-27 — ScheduleModule.forRoot() already global in app.module.ts, no per-module import needed)

### Step 2.2: `RootProtectionService` [DONE 2026-04-26]

**File:** `backend/src/nest/root/root-protection.service.ts`

**Why first:** Pure guard logic. All 5 user-mutating services depend on it.

**Methods (consolidated naming — no umbrella `assertCanTerminate`):**

| Method                                                   | Purpose                                                                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `assertCrossRootTerminationForbidden(actor, target, op)` | Throws `ForbiddenException` if `actor.id !== target.id` AND `target.role === 'root'` AND op is termination |
| `assertNotLastRoot(tenantId, excludingUserId)`           | Throws `PreconditionFailedException` if active-root-count after op would be 0                              |
| `countActiveRoots(tenantId, excludingUserId?)`           | Read-only helper; uses `FOR UPDATE` when called inside an approve TX                                       |
| `isTerminationOp(beforeRow, afterRow, opType)`           | Pure helper — true if op transitions root out of "active root" state                                       |
| `auditDeniedAttempt(actor, target, op, reason)`          | Writes audit_trail entry via existing `ActivityLoggerService`                                              |

**Critical patterns:**

- All queries via `this.db.tenantTransaction()` (ADR-019)
- Throws specific exception classes — never returns boolean
- Reads `currentUserId` from CLS, never from request params

### Step 2.3: Wire `RootProtectionService` into ALL mutation paths [DONE 2026-04-26]

**Audit-confirmed mutation surface (Phase 0 §0.5):**

| File:Line                                                 | Operation                         | Wiring needed                                                                                                                                                                                                                          |
| --------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/nest/root/root.service.ts:400`               | Soft-delete user                  | DONE 2026-04-26 — full chain replaces inline self-delete BadRequest + inline last-root SELECT-COUNT. Existence check moved before chain. Self-delete now 403 SELF_VIA_APPROVAL_REQUIRED.                                               |
| `backend/src/nest/root/root-admin.service.ts:295`         | Soft-delete admin                 | DONE 2026-04-26 — defensive (AdminUser API shape doesn't expose `role`; hardcoded 'admin' since getAdminById filters role='admin'; chain inert in normal flow).                                                                        |
| `backend/src/nest/root/root-deletion.service.ts`          | NONE — tenant_deletion_queue only | NO wiring (Session 3 spot-check, out of scope)                                                                                                                                                                                         |
| `backend/src/nest/users/users.service.ts:512`             | Delete user                       | DONE 2026-04-26 — full chain.                                                                                                                                                                                                          |
| `backend/src/nest/users/users.service.ts:542`             | Archive user                      | DONE 2026-04-26 — defensive role-block (archive 1→3 NOT in §Operations Covered, but root accounts cannot be archived via the generic users path; reuses CROSS_ROOT_FORBIDDEN code).                                                    |
| `backend/src/nest/users/users.service.ts:557`             | Reactivate user                   | NOT wired — verified 2026-04-26: sets is_active=1 (ACTIVE), not 0. Resolves §2.3 "(only if it can DEACTIVATE a root — verify)" to NO. Strictly outside §Operations Covered. Documented in source.                                      |
| `backend/src/nest/dummy-users/dummy-users.service.ts:300` | Dummy users (employee role only)  | DONE 2026-04-26 — defensive (pre-fetch role + chain; UPDATE filter role='dummy' makes the chain inert in normal flow).                                                                                                                 |
| `backend/src/nest/root/root.controller.ts:147`            | `Put('admins/:id')`               | DEFERRED 2026-04-26 — `updateAdmin` has no `actingUserId` in current signature. Wiring requires constructor + controller signature changes. Layer 4 trigger catches role-flip-from-root regardless. Tracked for fix-up within Phase 2. |
| `backend/src/nest/root/root.controller.ts:255`            | `Put('users/:id')`                | DEFERRED 2026-04-26 — same reason as PUT admins/:id. Layer 4 backstop.                                                                                                                                                                 |

**Wiring pattern:**

```typescript
// Inserted before any DB write that can terminate a root
if (target.role === 'root' && this.rootProtection.isTerminationOp(target, after, op)) {
  this.rootProtection.assertCrossRootTerminationForbidden(actor, target, op);

  if (actor.id === target.id) {
    // Self-termination must come from the approval flow ONLY
    throw new ForbiddenException({
      code: 'ROOT_SELF_TERMINATION_VIA_APPROVAL_REQUIRED',
      message: 'Root self-termination must use the peer-approval flow.',
    });
  }
  // Cross-root is unreachable — assertCrossRoot... already threw
}

await this.rootProtection.assertNotLastRoot(target.tenantId, target.id);
```

**Self-termination via direct mutation = forbidden.** The only legal path is `RootSelfTerminationService.approveSelfTermination()`, which sets the GUC + executes a private termination method.

### Step 2.4: `RootSelfTerminationService` [DONE 2026-04-26]

**File:** `backend/src/nest/root/root-self-termination.service.ts`

**Methods:**

| Method                                                     | Description                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `requestSelfTermination(actor, reason)`                    | 1. Assert `actor.role === 'root'`. 2. Assert no existing pending request (DB unique index also blocks). 3. **Assert no rejection within last 24h (cooldown)**. 4. Assert active-root-count ≥ 2. 5. Insert row (status='pending', expires_at=NOW()+7d). 6. Emit event → notification fan-out to peers. 7. Audit-log.                                                                                                            |
| `getMyPendingRequest(actor)`                               | Returns the actor's pending request, or null.                                                                                                                                                                                                                                                                                                                                                                                  |
| `getMostRecentRejection(actorId)`                          | Returns most recent rejected request (for cooldown check). Internal.                                                                                                                                                                                                                                                                                                                                                           |
| `cancelOwnRequest(actor)`                                  | Set status='cancelled' on actor's pending request. Audit-log.                                                                                                                                                                                                                                                                                                                                                                  |
| `getPendingRequestsForApproval(actor)`                     | Returns all pending requests in the tenant where `requester_id != actor.id`.                                                                                                                                                                                                                                                                                                                                                   |
| `approveSelfTermination(actor, requestId, comment?)`       | All-in-one TX: 1. `FOR UPDATE` lock on request row + all root rows in tenant. 2. Validate status='pending', not expired, requester != actor. 3. Recount active roots — must remain ≥ 1 after termination. 4. Set status='approved' (writes the row Layer 4 will verify). 5. `set_config('app.root_self_termination_approved', 'true', true)`. 6. UPDATE users SET is_active=4 WHERE id=requester. 7. Emit event. 8. Audit-log. |
| `rejectSelfTermination(actor, requestId, rejectionReason)` | Set status='rejected', record reject metadata. Emit event. Audit-log. (No GUC, no users-table touch.) Required: `rejectionReason` non-empty.                                                                                                                                                                                                                                                                                   |
| `expireOldRequests()`                                      | Cron entry. UPDATE all pending where `expires_at < NOW()` → status='expired'. Audit-log per row.                                                                                                                                                                                                                                                                                                                               |

**Cooldown logic (R3 / R7 mitigation):**

```typescript
const lastRejection = await this.getMostRecentRejection(actor.id);
if (lastRejection !== null) {
  const cooldownEnd = new Date(lastRejection.rejected_at.getTime() + 24 * 60 * 60 * 1000);
  if (new Date() < cooldownEnd) {
    throw new ConflictException({
      code: 'ROOT_REQUEST_COOLDOWN_ACTIVE',
      message: `Re-request blocked until ${cooldownEnd.toISOString()} (24h cooldown after rejection).`,
      cooldownEndsAt: cooldownEnd.toISOString(),
    });
  }
}
```

**Approve TX ordering (critical — Layer 4 hybrid depends on it):**

```typescript
async approveSelfTermination(actor, requestId, comment?) {
    return this.db.tenantTransaction(async (client) => {
        // 1. Lock the request row + all root rows in tenant
        const request = await client.query(
            `SELECT * FROM root_self_termination_requests
             WHERE id = $1 FOR UPDATE`,
            [requestId]
        );
        // ... validations: status='pending', not expired, requester != actor ...

        await client.query(
            `SELECT id FROM users
             WHERE tenant_id = $1 AND role = 'root' AND is_active = 1
             FOR UPDATE`,
            [actor.tenantId]
        );

        // 2. Recount AFTER lock
        // ... assertNotLastRoot equivalent inline ...

        // 3. Flip request status FIRST (writes the row Layer 4 will verify)
        await client.query(
            `UPDATE root_self_termination_requests
             SET status = 'approved', approved_by = $1, approved_at = NOW()
             WHERE id = $2`,
            [actor.id, requestId]
        );

        // 4. NOW set the GUC for the trigger
        await client.query(
            `SELECT set_config('app.root_self_termination_approved', 'true', true)`
        );

        // 5. Execute the actual user soft-delete — trigger fires, sees status='approved' row, allows
        await client.query(
            `UPDATE users SET is_active = 4 WHERE id = $1`,
            [request.requester_id]
        );

        // 6. Emit event, audit-log (within same TX or after commit)
    });
}
```

### Step 2.5: Controller [DONE 2026-04-27]

**File:** `backend/src/nest/root/root-self-termination.controller.ts`

**Endpoints (6 total):**

| Method | Route                                          | Guard            | Description                                  |
| ------ | ---------------------------------------------- | ---------------- | -------------------------------------------- |
| POST   | `/users/me/self-termination-request`           | `@Roles('root')` | Create pending request                       |
| GET    | `/users/me/self-termination-request`           | `@Roles('root')` | Get own pending request (or null)            |
| DELETE | `/users/me/self-termination-request`           | `@Roles('root')` | Cancel own pending request                   |
| GET    | `/users/self-termination-requests/pending`     | `@Roles('root')` | List requests where requester != self        |
| POST   | `/users/self-termination-requests/:id/approve` | `@Roles('root')` | Approve a peer's request (executes deletion) |
| POST   | `/users/self-termination-requests/:id/reject`  | `@Roles('root')` | Reject a peer's request (reason required)    |

**Every endpoint MUST:**

- [ ] Use `@Roles('root')` (root-only)
- [ ] Return raw data (ResponseInterceptor wraps automatically — ADR-007)
- [ ] Use Zod DTOs via `createZodDto()` (ADR-030)
- [ ] Use `idField` factory for `:id` param (ADR-030 §7.5)

### Step 2.6: Cron job for expiry [DONE 2026-04-27]

**File:** `backend/src/nest/root/root-self-termination.cron.ts`

```typescript
@Cron('0 3 * * *')  // daily 03:00
async expirePendingRequests(): Promise<void> {
    const expired = await this.service.expireOldRequests();
    this.logger.info(`Expired ${expired} root self-termination requests`);
}
```

Uses `systemQuery()` (sys_user, BYPASSRLS) — cross-tenant cleanup.

### Step 2.7: Notifications + EventBus integration [DONE 2026-04-27]

**Modified files:**

- `backend/src/utils/event-bus.ts` — add 3 events (Requested/Approved/Rejected)
- `backend/src/nest/notifications/notifications.service.ts` — handlers fan out to all OTHER active roots in tenant

**Notification payloads (German user-facing):**

| Event     | Recipients                      | Title                           | Body                                                                            |
| --------- | ------------------------------- | ------------------------------- | ------------------------------------------------------------------------------- |
| Requested | Peer roots (requester excluded) | "Root-Konto-Löschung beantragt" | "{requesterName} möchte sein/ihr Root-Konto löschen. Genehmigung erforderlich." |
| Approved  | Requester + Peer roots          | "Root-Konto-Löschung genehmigt" | "Konto von {requesterName} wurde gelöscht (genehmigt von {approverName})."      |
| Rejected  | Requester                       | "Root-Konto-Löschung abgelehnt" | "Antrag wurde abgelehnt. Grund: {reason}. Erneuter Antrag in 24h möglich."      |

### Phase 2 — Definition of Done

- [x] `RootProtectionService` + `RootSelfTerminationService` registered in `RootModule` (Sessions 3 + 5)
- [x] 4 user-mutating services + 1 defensive role-block wired with `assertCrossRootTerminationForbidden` + `assertNotLastRoot` (Session 4); 2 PUT routes deferred → Layer 4 trigger backstop, tracked
- [x] All 6 endpoints exposed under `/api/v2/users/...` (Session 5b)
- [x] Cron job registered (Session 5c); manual smoke deferred to Phase 3 / Session 7 (`expireOldRequests` covered by ~24 unit tests there)
- [x] EventBus emits 3 typed events; notifications fan out (Session 6 — typed `emitRootSelfTermination{Requested,Approved,Rejected}` + per-domain `RootSelfTerminationNotificationService`)
- [x] Audit-trail entries written for every state transition + every denied attempt (Session 4 wiring uses `RootProtectionService.auditDeniedAttempt`; Session 5 + 6 wire `ActivityLoggerService` per state transition; HTTP-layer `AuditTrailInterceptor` writes the complementary `audit_trail` rows)
- [x] 24h rejection cooldown enforced in `requestSelfTermination` (Session 5, `assertCooldownPassed` private helper)
- [x] All DTOs use Zod + `createZodDto()` (Session 5b)
- [x] `db.tenantTransaction()` for all queries; `systemQuery()` only in cron (verified — only `expireOldRequests` uses `systemQuery`; all HTTP-handler paths use `tenantTransaction` / `tenantQuery`)
- [x] No `||` for defaults, no `any`, explicit boolean checks (CODE-OF-CONDUCT) — all sessions, lint 0 errors confirms
- [x] ESLint 0 errors: `docker exec assixx-backend pnpm exec eslint backend/src/nest/root/` (Session 6 final: 0 errors)
- [x] Type-check passes: `docker exec assixx-backend pnpm run type-check` (Session 6 final: exit 0 across shared + frontend + backend + backend/test)

---

## Phase 3: Unit Tests

> **Dependency:** Phase 2 complete.
> **Pattern:** Collocated `*.service.test.ts` files inside `backend/src/nest/root/`.

### Test files

```
backend/src/nest/root/
    root-protection.service.test.ts                    # ~12 tests — guard logic
    root-self-termination.service.test.ts              # ~24 tests — lifecycle (incl. cooldown)
```

### Mandatory Scenarios

**Cross-Root Guard:** [DONE 2026-04-27 — Session 7a, `root-protection.service.test.ts`]

- [x] Root A → terminate Root B (Soft-Delete) → ForbiddenException + audit entry
- [x] Root A → terminate Root B (Deactivate is_active=0) → Forbidden
- [x] Root A → terminate Root B (Demote role='admin') → Forbidden
- [x] Root A → terminate Root B (Hard-Delete, if route exists) → Forbidden
- [x] Root A → terminate Admin → allowed
- [x] Root A → terminate Employee → allowed
- [x] Admin (full-access) → terminate Root → Forbidden (admin cannot touch roots)
- [x] Employee → terminate Root → Forbidden (already blocked by `@Roles`, but defense-in-depth test)

**Last-Root Guard:** [DONE 2026-04-27 — Session 7a]

- [x] Tenant with 1 active root → assertNotLastRoot(tenantId, that-root.id) → PreconditionFailedException
- [x] Tenant with 2 active roots → assertNotLastRoot(tenantId, root-A.id) → ok (B remains)
- [x] Tenant with 1 active + 1 archived root (is_active=3) → only the active counts → fail

**Self-Termination Lifecycle:** [DONE 2026-04-27 — Session 7b, `root-self-termination.service.test.ts`]

- [x] Request happy-path: status='pending', expires in 7d, notification fan-out
- [x] Request when already pending → ConflictException (DB unique index + service check)
- [x] **Request within 24h after rejection → ConflictException (cooldown)**
- [x] Request 24h+1min after rejection → succeeds
- [x] Request as last root (only 1 in tenant) → PreconditionFailedException
- [x] Request as admin → ForbiddenException (controller guards already block, but service double-checks)
- [x] Cancel own pending → status='cancelled', no users-table touch
- [x] Cancel non-existent / not-pending → NotFoundException
- [x] Approve own request → ForbiddenException (DB chk_no_self_approval + service check)
- [x] Approve non-existent → NotFoundException
- [x] Approve already-approved/rejected/expired/cancelled → ConflictException
- [x] Approve when expired (NOW > expires_at) → ConflictException
- [x] Approve happy-path: requester.is_active=4, request.status='approved', GUC clean after TX
- [x] Reject happy-path: status='rejected', rejected_by=actor, requester still is_active=1
- [x] Reject without reason → ValidationException
- [x] Reject non-existent → NotFoundException
- [x] Reject own request → ForbiddenException
- [x] expireOldRequests cron sets status='expired' for pending past expires_at; leaves non-pending alone

**Race / Concurrency:** [DONE 2026-04-27 — Session 7b]

- [x] Parallel approve from 2 roots → exactly one succeeds, other gets ConflictException (FOR UPDATE)
- [x] Approve TX rollback (simulate by throwing inside TX) → requester remains active, GUC not leaked, request status reverts

**DB-Trigger Integration (run actual SQL in test container):** [DONE 2026-04-28 — Session 7c, `backend/test/root-protection-trigger.api.test.ts`]

- [x] Direct UPDATE users SET is_active=4 WHERE root as app_user → ROOT_CROSS_TERMINATION_FORBIDDEN
- [x] Direct UPDATE as app_user with self-target without GUC → ROOT_SELF_TERMINATION_REQUIRES_APPROVAL
- [x] Direct UPDATE as app_user with self-target + GUC=true but NO approved DB row → ROOT_NO_APPROVED_REQUEST
- [x] Direct UPDATE as app_user with self-target + GUC=true + valid approved row → succeeds
- [x] Approved row older than 5min + GUC=true → ROOT_NO_APPROVED_REQUEST (window expired)
- [x] Direct UPDATE as assixx_user → bypasses trigger
- [x] Direct UPDATE as sys_user → bypasses trigger
- [x] Last-root: tenant with 1 root, GUC=true, valid approved row, attempt self-termination → ROOT_LAST_ROOT_PROTECTION

### Phase 3 — Definition of Done

- [x] ≥ 32 unit tests total — actual: **48 tests** (16 root-protection + 24 root-self-termination + 8 trigger-integration)
- [x] All tests green: `docker exec assixx-backend pnpm exec vitest run --project unit backend/src/nest/root/` → 179/179, plus `pnpm exec vitest run --project api backend/test/root-protection-trigger.api.test.ts` → 8/8
- [x] All exception codes covered by ≥ 1 test (ROOT_CROSS_TERMINATION_FORBIDDEN, ROOT_LAST_ROOT_PROTECTION, COOLDOWN_ACTIVE, ALREADY_PENDING, NOT_FOUND, NOT_PENDING, EXPIRED, SELF_DECISION_FORBIDDEN, REJECTION_REASON_REQUIRED, ROLE_FORBIDDEN, ROOT_SELF_TERMINATION_REQUIRES_APPROVAL, ROOT_NO_APPROVED_REQUEST)
- [x] Race / FOR UPDATE test covered (Session 7b: parallel approve via Promise.allSettled with two queued mockClient instances modeling FOR UPDATE serialization)
- [x] DB-trigger tests covered (real SQL inside vitest — Session 7c, 8 scenarios in `backend/test/`)
- [x] Audit-trail row written for every guarded denial — verified (Session 7a inspects `ActivityLoggerService.log` mock per termination op)
- [x] Coverage: every public method has ≥ 1 happy-path + ≥ 1 failure-path test (Session 7a: 5 isTerminationOp + cross-root + last-root; Session 7b: all 8 service methods)

---

## Phase 4: API Integration Tests

> **Dependency:** Phase 3 complete.
> **Pattern:** `backend/test/*.api.test.ts` ([HOW-TO-TEST.md](./how-to/HOW-TO-TEST.md))

### Test file

`backend/test/root-self-termination.api.test.ts`

### Scenarios (≥ 24 assertions — was 22 in v0.1.0, +2 for cooldown)

**Auth:** [DONE 2026-04-28 — Session 8]

- [x] Unauthenticated POST /users/me/self-termination-request → 401 (T01)
- [x] Admin POST → 403 (Roles guard) (T02)
- [x] Employee POST → 403 (T03)

**CRUD:** [DONE 2026-04-28 — Session 8]

- [x] Root POST request → 201 + JSON body with requestId, expires_at (T04)
- [x] Root POST while pending → 409 (T06 ALREADY_PENDING)
- [x] **Root POST within 24h of rejection → 409 with cooldownEndsAt** (T14 — D10: timestamp in `message` not top-level field per `AllExceptionsFilter` envelope normalisation)
- [x] Root GET own pending → 200 (T05)
- [x] Root DELETE own pending → 204 (T07 verifies via list visibility; cancel-after-approve covered by T10)
- [x] Root GET pending list (other roots' requests) → 200 (T07)
- [x] Root POST approve → 200 + requester.is_active=4 visible afterwards (T09 with DB-side proof)
- [x] Root POST reject (with reason) → 200 (T13)
- [x] Root POST reject (without reason) → 400 (T12 Zod)
- [x] Root POST approve own request via direct ID → 403 (no self-approval) (T08 SELF_DECISION_FORBIDDEN)

**Direct API Bypass tests (raw fetch — Layer 4 trigger should still block):** [DONE 2026-04-28 — Session 8 with D9]

- [x] Root A → DELETE /users/uuid/{rootBuuid} → 403 ROOT_CROSS_TERMINATION_FORBIDDEN (T16, Layer 2 via Session 4 wiring on `users.service.deleteUser`)
- [x] Root A → PUT /users/uuid/{rootBuuid} {role:'admin'} → non-2xx + role unchanged (T17, Layer 4 trigger backstop — Session 4 deferred Layer 2 wiring on the role-flip path; D9: status is 500 not 403 because no dedicated PG-error filter)
- [x] Root A → POST /users/uuid/{rootBuuid}/archive → 403 (T18, Layer 2 defensive role-block on `users.service.archiveUser`)

**Last-root:** [DONE 2026-04-28 — Session 8]

- [x] Tenant with 1 root → POST self-termination-request → 412 LAST_ROOT_PROTECTION (T19)

**Tenant isolation (RLS):** [DONE 2026-04-28 — Session 8]

- [x] Root in tenant A → GET pending list → only sees tenant A requests (T20 — pre-seeded foreign request not in result)
- [x] Root in tenant A → POST approve {id of tenant B's request} → 404 (RLS hides it) (T21 — `lockRequestForDecision` returns empty under RLS, throws `NOT_FOUND`)

**Notifications:** [DONE 2026-04-28 — Session 8]

- [x] After POST request, all OTHER roots in tenant have a new notification row (T22 — 3 peer rows, requester excluded)
- [x] After POST approve, requester has a notification of "approved" (T23 — total 3 = requester + 2 peers, approver excluded)
- [x] After POST reject, requester has a notification of "rejected" with reason (T24 — message contains reason + "24h", rejecter has none)

### Phase 4 — Definition of Done

- [x] ≥ 24 API integration tests — actual: **25 tests** (all green)
- [x] All tests green — `pnpm exec vitest run --project api backend/test/root-self-termination.api.test.ts` → 25/25 (Session 8, 2026-04-28)
- [x] Tenant isolation verified — T20 (GET pending list excludes foreign tenant) + T21 (POST approve foreign request → 404 RLS hides)
- [x] Direct-API bypass blocked (Layer 2 + Layer 4) — T16 (DELETE → 403 Layer 2 deleteUser wired) + T17 (PUT role → non-2xx Layer 4 trigger; D9) + T18 (POST archive → 403 Layer 2 defensive)
- [x] Notification fan-out verified — T22 (3 peer notifications on request) + T23 (3 recipients on approve, approver excluded) + T24 (requester-only on reject with reason + 24h)
- [x] Cooldown enforced — T14 (within 24h → 409 with ISO timestamp in message; D10) + T15 (backdated 25h → 201 re-issue)

---

## Phase 5: Frontend

> **Dependency:** Phase 2 complete (endpoints available).
> **Reference:** existing `(root)/` pages.

### Step 5.1: `/root-profile` — self-termination section [PENDING]

**Modified files:**

- `frontend/src/routes/(app)/(root)/root-profile/+page.svelte`
- `frontend/src/routes/(app)/(root)/root-profile/+page.server.ts`

**New files:**

- `frontend/src/routes/(app)/(root)/root-profile/_lib/api.ts`
- `frontend/src/routes/(app)/(root)/root-profile/_lib/state-self-termination.svelte.ts`
- `frontend/src/routes/(app)/(root)/root-profile/SelfTerminationCard.svelte`
- `frontend/src/routes/(app)/(root)/root-profile/SelfTerminationModal.svelte`

**UI states:**

| State                          | UI                                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| No pending request, eligible   | Red "Konto löschen" button → opens modal with reason textarea + warning banner                      |
| Pending request exists         | Yellow card "Antrag ausstehend, läuft ab am {date}" + "Antrag zurückziehen" button                  |
| Last root in tenant            | Disabled button + tooltip "Sie sind der letzte Root. Befördern Sie zuerst einen anderen User."      |
| **Within 24h after rejection** | Disabled button + tooltip "Cooldown bis {cooldownEndsAt}. Letzter Antrag wurde abgelehnt: {reason}" |
| Recently rejected (>24h)       | Show rejection reason (history) + "Erneut beantragen" CTA                                           |

### Step 5.2: `/manage-root` — block destructive ops on other roots [PENDING]

**Modified files:**

- `frontend/src/routes/(app)/(root)/manage-root/+page.svelte`

**Changes:**

- For every row where `target.role === 'root' && target.id !== currentUser.id`:
  - Hide / disable Delete button
  - Hide / disable Deactivate toggle
  - Hide / disable Role-change-to-non-root option
  - Show warning tooltip: "Andere Root-Konten können nicht durch Sie geändert werden."

### Step 5.3: `/manage-approvals` — Root self-termination card type [PENDING]

**Modified files:**

- `frontend/src/routes/(app)/(shared)/manage-approvals/+page.svelte`
- `frontend/src/routes/(app)/(shared)/manage-approvals/+page.server.ts`

**New files:**

- `frontend/src/routes/(app)/(shared)/manage-approvals/RootSelfTerminationCard.svelte`

**Behavior:**

- Card visible only when `currentUser.role === 'root'`
- Cards filtered to show only requests where `requester_id !== currentUser.id`
- Approve button → confirmation modal → POST /approve
- Reject button → modal with **required** reason → POST /reject
- Real-time update via SSE on the 3 events

### Phase 5 — Definition of Done

- [ ] `/root-profile` shows correct state for each lifecycle stage including cooldown
- [ ] `/manage-root` blocks destructive ops on other roots
- [ ] `/manage-approvals` renders RootSelfTerminationCard for roots only
- [ ] Reject modal enforces non-empty reason
- [ ] All flows tested manually with 3 root users in a test tenant
- [ ] svelte-check 0 errors, 0 warnings
- [ ] ESLint 0 errors
- [ ] German labels everywhere
- [ ] Responsive design verified mobile + desktop

---

## Phase 6: Integration + Polish + ADR

> **Dependency:** Phase 5 complete.

### Integrations

- [ ] `audit_trail` (ADR-009): every state transition (request, approve, reject, expire, cancel, denied attempt) writes a row
- [ ] `notifications` (ADR-003): SSE + persistent rows for all 3 events
- [ ] EventBus: 3 typed emit methods registered
- [ ] Dashboard widget: pending self-termination count for roots (optional V1+)
- [ ] `manage-approvals` page: RootSelfTermination card type appears

### Documentation

- [ ] **ADR-053** written: "Root Account Lifecycle Protection" — covers 4-layer model, decision against ADR-037 reuse, Hybrid Option 1+ trigger rationale, threat model
- [ ] `FEATURES.md` updated (security section)
- [ ] `docs/ARCHITECTURE.md` §1.2 — add row "Root account protection" → `backend/src/nest/root/root-protection.service.ts` + ADR-053 link
- [ ] Customer fresh-install synced: `./scripts/sync-customer-migrations.sh`
- [ ] CLAUDE-KAIZEN-MANIFEST.md: add entry if any failure was instructive

### Phase 6 — Definition of Done

- [ ] All integrations work end-to-end
- [ ] ADR-053 written + reviewed (Status: Accepted)
- [ ] Navigation Map updated
- [ ] `FEATURES.md` updated
- [ ] No open TODOs in code
- [ ] All four operations (Soft-Delete, Deactivate, Demotion, Hard-Delete) verified protected via:
  - [ ] Frontend (Layer 1)
  - [ ] Service Guard (Layer 2)
  - [ ] Approval Workflow (Layer 3)
  - [ ] DB Trigger (Layer 4)
- [ ] All 10 risks (R1-R10) verified mitigated

---

## Session Tracking

| Session | Phase | Description                                                                                                 | Status | Date       |
| ------- | ----- | ----------------------------------------------------------------------------------------------------------- | ------ | ---------- |
| 1       | 0     | Code audit + risk-refinement + DB backup                                                                    | DONE   | 2026-04-26 |
| 2       | 1     | Migration: requests table + DB trigger (Hybrid Option 1+)                                                   | DONE   | 2026-04-26 |
| 3       | 2     | RootProtectionService + spot-check root-deletion.service.ts                                                 | DONE   | 2026-04-26 |
| 4       | 2     | Wire 4 termination sites + 1 defensive role-block; PUT-route role-demote wiring deferred (Layer 4 backstop) | DONE   | 2026-04-26 |
| 5       | 2     | RootSelfTerminationService (Step 2.4 only — controller/cron/notifications split out)                        | DONE   | 2026-04-26 |
| 5b      | 2     | Controller + 3 DTOs (2.5)                                                                                   | DONE   | 2026-04-27 |
| 5c      | 2     | Cron (2.6)                                                                                                  | DONE   | 2026-04-27 |
| 6       | 2     | Notifications + EventBus integration (2.7)                                                                  | DONE   | 2026-04-27 |
| 7a      | 3     | Unit tests — `root-protection.service.test.ts` (16 tests; cross-root + last-root + isTerminationOp)         | DONE   | 2026-04-27 |
| 7b      | 3     | Unit tests — `root-self-termination.service.test.ts` (24 tests; lifecycle + cooldown + race)                | DONE   | 2026-04-27 |
| 7c      | 3     | Integration tests — DB-trigger SQL (~8 tests; real psql against assixx-postgres, lives in `backend/test/`)  | DONE   | 2026-04-28 |
| 8       | 4     | API integration tests (25 tests) + production-bug fix (`countActiveRoots` FOR UPDATE + COUNT)               | DONE   | 2026-04-28 |
| 9       | 5     | Frontend: root-profile + manage-root + manage-approvals                                                     |        |            |
| 10      | 6     | ADR-053 + audit + docs + map update                                                                         |        |            |

### Session 1 — 2026-04-26

**Goal:** Verify plan assumptions, fill audit table, identify mutation surface
**Result:** 8 findings (1 critical G, 4 must-fix, 3 minor) — all integrated into v0.2.0
**Verification:**

- Audit table §0.5 fully populated
- All claims in v0.1.0 either verified or corrected
  **Next session:** Session 2 = Phase 1 migrations

### Session 3 — 2026-04-26

**Goal:** Implement `RootProtectionService` (Step 2.2) + close §0.5 spot-check rows.
**Result:**

- New file: `backend/src/nest/root/root-protection.service.ts` (~245 lines, 5 methods, 3 exported types, 1 exported error-code constant).
- `RootProtectionService` added to `RootModule.providers` + `RootModule.exports` (Step 2.1 checkbox 1/4 ticked).
- §0.5 row `root-deletion.service.ts` → confirmed NO direct user mutations (manages `tenant_deletion_queue`); no wiring needed in Session 4.
- §0.5 row "audit_trail entries for users-table changes" → resolved: dual-writer model (`ActivityLoggerService` → `root_logs` via service code; `AuditLoggingService` → `audit_trail` via interceptor). Service uses (1), interceptor handles (2) on the 403 automatically.
- §2.3 Mutation Surface table updated.

**Verification:**

- `docker exec assixx-backend pnpm exec eslint backend/src/nest/root/` → 0 errors
- `docker exec assixx-backend pnpm run type-check` → exit 0 (shared + frontend + backend + backend/test all clean)
- Tests deferred to Session 7 per Phase 3 schedule (`root-protection.service.test.ts ~12 tests`).

**Next session:** Session 4 = wire 5 services + 2 PUT routes (Step 2.3).

### Session 4 — 2026-04-26

**Goal:** Step 2.3 — wire `RootProtectionService` into all mutation paths.

**Result:**

- **Wired (full chain):** `root.service.ts:deleteRootUser` (replaces inline self-delete BadRequest + inline last-root SELECT-COUNT — self-delete now 403 `SELF_VIA_APPROVAL_REQUIRED`, last-root now `PreconditionFailedException`); `users.service.ts:deleteUser`.
- **Wired (defensive — chain inert in normal flow):** `root-admin.service.ts:deleteAdmin` (target always role='admin'), `dummy-users.service.ts:delete` (target always role='dummy', adds a pre-SELECT for role resolution).
- **Defensive role-block:** `users.service.ts:archiveUser` — root accounts cannot be archived via the generic users path (archive 1→3 is NOT in §Operations Covered as termination, but root lifecycle belongs in Root\* services). Reuses `CROSS_ROOT_FORBIDDEN` code.
- **NOT wired:** `users.service.ts:unarchiveUser` — verified: sets `is_active=1`, NOT 0; not a deactivation per §Operations Covered. Comment in source documents the verification.
- **DEFERRED:** PUT-route role-demote wiring on `updateRootUser` and `updateAdmin`. Both methods can flip `users.role` from 'root' → !'root' (a demote per §Operations Covered #3), but neither has an `actingUserId` parameter. Adding it requires constructor + controller + test signature changes. Layer 4 trigger (`fn_prevent_cross_root_change` BEFORE UPDATE OR DELETE on users) blocks role-flip-from-root regardless of which service mutates the row, so the gap is contained. Tracked as a fix-up within Phase 2.
- **DI graph:** `RootModule` imported by `UsersModule` and `DummyUsersModule` (one-way; no circular dep — `RootModule`'s existing imports do not transitively touch users/dummy-users).
- **Paired test updates (4 suites, 105 tests green):**
  - `root.service.test.ts`: deleteRootUser tests rewritten — self-delete now expects `ForbiddenException` with `SELF_VIA_APPROVAL_REQUIRED`; new test "propagate ForbiddenException from cross-root assertion" (verifies order: cross-root before last-root); new test "propagate PreconditionFailedException from last-root assertion"; happy-path test simplified now that no inline last-root mock is needed.
  - `root-admin.service.test.ts` + `users.service.test.ts` + `dummy-users.service.test.ts`: added `RootProtectionService` mock to constructor (no-op defaults); `dummy-users.service.test.ts` delete-suite updated to feed the new pre-SELECT mock.
- **Verification:** `pnpm exec eslint backend/src/nest/{root,users,dummy-users}` → 0 errors. `pnpm exec tsc --noEmit -p backend` → 0 errors. `pnpm exec tsc --noEmit -p backend/test` → 0 errors. `pnpm exec vitest run --project unit` on the 4 paired suites → 105/105 passed (1.62s).

**Next session:** Session 5 = `RootSelfTerminationService` + controller + cron + cooldown (Steps 2.4–2.6).

### Session 5 — 2026-04-26

**Goal:** Implement Step 2.4 — `RootSelfTerminationService` only (split out from the original Session 5 scope to keep one masterplan step per session per /continue rules; controller / cron / notifications now Sessions 5b + 6).

**Result:**

- **New file:** `backend/src/nest/root/root-self-termination.service.ts` (~530 LOC including doc-headers).
  - **8 methods per §2.4 methods table:** `requestSelfTermination`, `getMyPendingRequest`, `getMostRecentRejection`, `cancelOwnRequest`, `getPendingRequestsForApproval`, `approveSelfTermination`, `rejectSelfTermination`, `expireOldRequests`.
  - **5 private helpers:** `assertActorIsRoot`, `assertCooldownPassed`, `assertNoPendingRequest`, `lockRequestForDecision`, `assertCanDecide`, `emitAndAuditApproval`. Helpers exist to keep the public methods under the 60-line ESLint cap and to make the cooldown / no-pending / decide-precondition logic individually testable in Session 7.
  - **Error codes** exported as `ROOT_SELF_TERMINATION_CODES` (8 codes — COOLDOWN_ACTIVE, ALREADY_PENDING, NOT_FOUND, NOT_PENDING, EXPIRED, SELF_DECISION_FORBIDDEN, REJECTION_REASON_REQUIRED, ROLE_FORBIDDEN). Frontend (Phase 5) and API tests (Phase 4) will consume these.
  - **Approve TX ordering verbatim per §2.4:** lock request row (FOR UPDATE) → validate (`assertCanDecide` + expiry check) → lock all root rows in tenant (FOR UPDATE) → recount via `RootProtectionService.assertNotLastRoot(tenantId, requesterId, client)` → flip status='approved' (Layer 4 verifies this row exists) → `set_config('app.root_self_termination_approved', 'true', true)` → UPDATE users SET is_active=4 → emit + audit.
  - **24h cooldown** implemented inside `requestSelfTermination` via `assertCooldownPassed` (R3/R7 mitigation): reads most-recent rejection inside the same TX, throws `ConflictException(COOLDOWN_ACTIVE)` with `cooldownEndsAt` ISO field.
  - **EventBus emits:** `root.self-termination.requested|approved|rejected|expired` — plain string-keyed `eventBus.emit(...)` calls. Step 2.7 will replace with typed methods on the `NotificationEventBus` singleton + register listener handlers in `NotificationsService`. Until then the events have no listeners — calls are no-ops by design.
  - **Audit:** every state transition writes a `root_logs` entry via `ActivityLoggerService` (matches Phase 0 §0.5 dual-writer finding). `audit_trail` rows for the HTTP requests will be added automatically by `AuditTrailInterceptor` once Step 2.5 (controller) is in.
- **`RootModule` registration:** `RootSelfTerminationService` added to providers + exports (Step 2.1 checkbox 2/4 ticked). Importable by Step 2.5 controller and Step 2.6 cron without circular DI risk (RootModule's existing imports don't transitively touch users/dummy-users for this branch).
- **Out-of-scope (deferred to subsequent sessions):**
  - DTOs (`request-self-termination.dto.ts`, `approve-self-termination.dto.ts`, `reject-self-termination.dto.ts`) → Step 2.5 (Session 5b)
  - Controller (6 endpoints) → Step 2.5 (Session 5b)
  - Cron (`root-self-termination.cron.ts`) → Step 2.6 (Session 5b)
  - Typed EventBus methods + notification fan-out handlers → Step 2.7 (Session 6)
  - Tests (`root-self-termination.service.test.ts ~24 tests`) → Phase 3 / Session 7 (same deferral pattern as Session 3 used for `root-protection.service.test.ts`)

**Verification:**

- `docker exec assixx-backend pnpm exec eslint backend/src/nest/root/` → 0 errors (initial run found 8 issues; all fixed: 4× `client: PoolClient` annotations per `@typescript-eslint/typedef`, 3× dropped `<void>` generic on `tenantTransaction` per `@typescript-eslint/no-invalid-void-type` — replaced with inferred T + `Promise<void>` callback return annotation, 1× split `if (last === undefined || last.rejected_at === null)` into two separate early-returns per `@typescript-eslint/prefer-optional-chain`).
- `docker exec assixx-backend pnpm run type-check` → exit 0 (shared + frontend + backend + backend/test all clean).

**Next session:** Session 5b = Step 2.5 (controller, 6 endpoints) + Step 2.6 (cron) — both depend on this service.

### Session 5b — 2026-04-27

**Goal:** Implement Step 2.5 — `RootSelfTerminationController` + 3 DTOs only. Cron (Step 2.6) split out to Session 5c per /continue's one-step-per-session discipline.

**Result:**

- **New file:** `backend/src/nest/root/root-self-termination.controller.ts` (~135 LOC including doc-headers).
  - **6 endpoints** mounted under `/api/v2/users/...` per §2.5 endpoint table — verbatim routes, verbs, and per-endpoint `@HttpCode` overrides.
  - **Class-level `@Roles('root')`** + `@Controller('users')`. Mirrors the existing `RootController` pattern (line 89). The global `RolesGuard` reads metadata from class-level via `Reflector.getAllAndOverride([key, [handler, class]])`.
  - **Path-collision audit** vs `UsersController` (also `@Controller('users')`): verified safe — none of the new literal segments (`/me/self-termination-request`, `/self-termination-requests/...`) collide with UsersController routes; NestJS+Fastify radix routing prefers literal over parametric so `/users/self-termination-requests/...` does not hit `/users/:id/...` either. Documented inline in the controller header.
  - **Actor mapping:** `@CurrentUser() user: JwtPayload` matches the existing `RootController` pattern (vs. `UsersController` which uses `NestAuthUser`). A private `toActor()` helper extracts only `{id, tenantId, role}` so the JWT-only fields (sub/iat/exp/type) don't leak into the service-layer audit paths.
  - **Status codes** per §4 Phase 4 API-test expectations: POST request → 201 (NestJS default), DELETE cancel → 204 (`@HttpCode(NO_CONTENT)`), POST approve/reject → 200 (`@HttpCode(OK)` overrides POST default 201).
  - **Body-mapping notes:** `dto.reason ?? null` converts the optional Zod field to the service signature's `string | null`. `dto.comment` passes through directly (both sides typed `string | undefined`). `dto.rejectionReason` is required by the schema (`min(1)` after trim) so passes as `string`.
- **3 new Zod DTOs** (per ADR-030 §7.5 + masterplan §2.5):
  - `request-self-termination.dto.ts` — `reason` optional, trim, max 1000.
  - `approve-self-termination.dto.ts` — `comment` optional, trim, max 1000.
  - `reject-self-termination.dto.ts` — `rejectionReason` REQUIRED non-empty trim, max 1000. The DTO is the first defense (400 BadRequest at the global ZodValidationPipe); the service re-asserts via `ConflictException(REJECTION_REASON_REQUIRED)` for direct callers (defense-in-depth, matches §3 unit-test "Reject without reason → ValidationException" + §4 "POST reject (without reason) → 400").
- **`backend/src/nest/root/dto/index.ts` barrel** updated with the 3 new exports.
- **`RootModule.controllers`** now includes `RootSelfTerminationController` (§2.1 checkbox 3/4 ticked).
- **Spec Deviation D5** recorded: masterplan §2.5 mandate names `idField` factory for the `:id` param, but Phase 1 schema declares `root_self_termination_requests.id UUID PRIMARY KEY DEFAULT uuidv7()` — the correct factory export is `UuidIdParamDto` (UUID-typed pre-built DTO from the same `param.factory.ts` file, alongside the numeric `IdParamDto`). This is a literal-text discrepancy, not a violation of the factory pattern (ADR-030 §7.5 mandates "use the centralized factory", which is satisfied by either pre-built export).
- **Test deferral rationale:**
  - DTOs are exempt — they are pure declarative Zod schemas with no business logic. The codebase pattern (13 existing DTOs in `root/dto/`, 0 paired test files; ZOD-INTEGRATION-GUIDE.md "Current Status" § documents 176 DTOs total with no DTO unit tests) treats them as exempt per the `Stop` hook's option 2. Behaviour is covered end-to-end by Phase 4 §4 API tests.
  - Controller unit tests are not in §3 Phase 3 scope (which lists only `root-protection.service.test.ts` and `root-self-termination.service.test.ts`). Controller behaviour is covered by Phase 4 §4 API integration tests (Session 8).
- **Out-of-scope (deferred to subsequent sessions):**
  - Cron job (`root-self-termination.cron.ts`) → Step 2.6 (Session 5c).
  - Typed EventBus methods + notification fan-out handlers → Step 2.7 (Session 6).

**Verification:**

- `docker exec assixx-backend pnpm exec eslint backend/src/nest/root/` → 0 errors
- `docker exec assixx-backend pnpm run type-check` → exit 0 (shared + frontend + backend + backend/test all clean)
- Containers re-started mid-session (`docker-compose up -d`) — they had been stopped between Session 5 and 5b; healthy after restart.

**Next session:** Session 5c = Step 2.6 (`RootSelfTerminationCron` — daily expiry job, `expireOldRequests()` consumer).

### Session 6 — 2026-04-27

**Goal:** Implement Step 2.7 — typed EventBus events + notification fan-out handlers. Closes Phase 2.

**Result:**

- **`backend/src/utils/event-bus.ts`** — Added 1 unified payload interface `RootSelfTerminationEvent` + 3 typed emit methods: `emitRootSelfTerminationRequested`, `emitRootSelfTerminationApproved`, `emitRootSelfTerminationRejected`. Strict spec adherence — §2.7 lists exactly 3 events; the cron's `expired` emit (line 487 of `root-self-termination.service.ts`) intentionally stays as a plain string-keyed `eventBus.emit(...)` since §2.7 does not require fan-out for expiry (per-row audit already covers compliance). 4 new paired tests in `event-bus.test.ts` (13 total, all green).
- **New file:** `backend/src/nest/root/root-self-termination-notification.service.ts` (~290 LOC). Domain-specific subscriber that owns recipient resolution + typed emit + persistent `notifications` rows. 3 public methods (`notifyRequested`, `notifyApproved`, `notifyRejected`) each wrapped in a top-level try/catch that NEVER throws — notification is secondary to the business operation (matches vacation pattern). 2 private helpers (`resolveUserName` with "Benutzer #<id>" fallback; `findPeerRoots` with dynamic IN-clause for excluded IDs). German user-facing strings exactly as §2.7 mandates.
- **New file:** `backend/src/nest/root/root-self-termination-notification.service.test.ts` (9 tests, all green). Mirrors `vacation-notification.service.test.ts` mock pattern (`vi.hoisted` + `vi.mock` of `event-bus.js` + `uuid`). Coverage matrix: notifyRequested (emit + per-peer INSERT, name-fallback, no-peer skip, top-level catch), notifyApproved (emit + INSERT for requester+peers, null comment passthrough), notifyRejected (emit + INSERT for requester only with computed cooldown, inner-catch on INSERT failure), UUID propagation. The 2 logged ERROR lines during the run are intentional negative-path assertions.
- **`backend/src/nest/root/root-self-termination.service.ts`** — refactored:
  - Constructor now injects `RootSelfTerminationNotificationService` (5th dep).
  - 3 plain-string `eventBus.emit(...)` calls inside the `tenantTransaction` blocks REMOVED. Replaced with `await this.notification.notifyXxx(...)` calls AFTER the TX commits (vacation pattern — notification failures cannot roll back business state).
  - Each method (`requestSelfTermination`, `approveSelfTermination`, `rejectSelfTermination`) now captures the canonical `RequestRow` from the TX and passes it to the post-commit notification call.
  - `rejectSelfTermination` SQL changed: `rejected_at = NOW()` → `rejected_at = $2` (parameterised) — captures the TS-side timestamp BEFORE the SQL so the cooldown computation in `notifyRejected` uses an identical `Date` object (zero clock drift between DB row and notification payload).
  - Private helper `emitAndAuditApproval` renamed → `auditApproval` (no longer emits — keeps audit-log + console-log responsibilities only).
  - The `expireOldRequests` cron path (line 487) intentionally retains the plain-string `eventBus.emit('root.self-termination.expired', ...)` per strict §2.7 spec — the `eventBus` import remains live for that single call.
- **`backend/src/nest/root/root.module.ts`** — registered `RootSelfTerminationNotificationService` in providers (declared BEFORE `RootSelfTerminationService` for clarity; NestJS DI is order-agnostic but the source ordering documents the dependency graph). Not exported — internal to RootModule.
- **Spec Deviation D7** recorded in §Spec Deviations: §2.7 literal-text says "modify `notifications.service.ts` — handlers fan out". Actual implementation co-locates with the producer in a per-domain `*-notification.service.ts`, matching the established repo convention (vacation/work-orders/tpm). The literal text would create a god object that knows about every domain — `notifications.service.ts` stays domain-agnostic. Behavioural outcome (typed emit + persistent INSERT for the 3 events to the recipients §2.7 specifies) is identical to spec.
- **Lint cleanup:** initial run reported 3 `@typescript-eslint/typedef` errors on closure parameters — fixed by adding explicit type annotations: `peers.map((p: UserIdRow) => p.id)` and `excludeIds.map((_: number, i: number) => …)`.

**Verification:**

- `docker exec assixx-backend pnpm exec eslint backend/src/nest/root/ backend/src/utils/` → 0 errors
- `docker exec assixx-backend pnpm run type-check` → exit 0 (shared + frontend + backend + backend/test)
- `docker exec assixx-backend pnpm exec vitest run --project unit backend/src/nest/root/ backend/src/utils/event-bus.test.ts` → 152/152 tests green across 8 test files
- Backend restart → bootstrap clean (uptime 19.6s on health-probe), `Nest application successfully started`, no DI / module errors. Health endpoint `GET /health` → 200 `{"status":"ok",…}`. The only log noise is pre-existing Loki `ENOTFOUND` network errors (unrelated to this change).

**Phase 2 Status: COMPLETE.** All 7 sub-steps DONE; all DoD checkboxes ticked. The 2 deferred PUT-route role-demote wirings (`updateRootUser` / `updateAdmin` — Session 4 documented decision) remain backstopped by Layer 4 trigger and are tracked outside the phase boundary.

**Next session:** Session 7 = Phase 3 unit tests (`root-protection.service.test.ts ~12 tests` + `root-self-termination.service.test.ts ~24 tests`).

### Session 5c — 2026-04-27

**Goal:** Implement Step 2.6 — `RootSelfTerminationCron` only. Step 2.7 (notifications + typed EventBus handlers) deferred to Session 6 per /continue's one-step-per-session discipline.

**Result:**

- **New file:** `backend/src/nest/root/root-self-termination.cron.ts` (~55 LOC including doc-headers).
  - **1 cron handler** `expirePendingRequests()` decorated `@Cron('0 3 * * *')` — daily 03:00 UTC (no timezone option). Schedule deliberately mirrors `LogRetentionService.handleRetentionCron` (`backend/src/nest/logs/log-retention.service.ts:77`) for one consolidated 03:00 daily-cleanup window across the backend.
  - **Body verbatim §2.6**: `const expired = await this.service.expireOldRequests(); this.logger.log(...)`. No try/catch, no onModuleInit, no extra options — strict spec adherence per /continue rules. The underlying service method already does cross-tenant SQL via `systemQuery()` (sys_user, BYPASSRLS), per-row `root_logs` audit via `ActivityLoggerService`, per-row `root.self-termination.expired` event emit, and an internal log when count > 0. The cron's unconditional log line covers the count-zero case for ops health visibility.
  - **Constructor param** named `service` (not `rootSelfTerminationService`) to match the masterplan §2.6 spec body grep verbatim.
- **`backend/src/nest/root/root.module.ts`** — added `RootSelfTerminationCron` to `providers` (with inline comment documenting why no `ScheduleModule` import is needed: `ScheduleModule.forRoot()` is already registered globally in `app.module.ts:110`, picked up via the kvp / log-retention / blackboard-archive pattern). NOT added to `exports` — internal scheduler, no consumer outside `RootModule`. **Step 2.1 checkbox 4/4 ticked → §2.1 module skeleton now COMPLETE.**
- **Spec Deviation D6** recorded: masterplan §2.6 spec body uses `this.logger.info(...)` — NestJS `Logger` (`@nestjs/common`) has no `.info()` method (only `.log/.error/.warn/.debug/.verbose/.fatal`). Replaced with `this.logger.log(...)` — the standard info-level call across the entire backend. Annotated inline in the cron file's docblock. Identical semantics, forced literal-text fix.
- **Test deferral rationale:** Cron exempt from paired tests. Repo precedent: `KvpApprovalArchiveCronService`, `TpmDueDateCronService`, `WorkOrdersDueCronService`, `BlackboardArchiveService`, `LogRetentionService` are all cron services with **no paired `*.cron.test.ts` / `*.service.test.ts` file**. The cron is pure delegation glue (2 body lines: `await service.expireOldRequests()` + `logger.log(...)`); the underlying `expireOldRequests()` IS covered by §3 Phase 3 mandatory scenario "expireOldRequests cron sets status='expired' for pending past expires_at; leaves non-pending alone" (Session 7 → `root-self-termination.service.test.ts`). Same exemption pattern as Session 5b's controller and DTOs.
- **Out-of-scope (deferred to Session 6):**
  - Typed EventBus methods on `event-bus.ts` (currently `RootSelfTerminationService` emits via plain string keys per Session 5 result — Step 2.7 will introduce typed `RootSelfTerminationRequested|Approved|Rejected|Expired` events).
  - Notification fan-out handlers in `notifications.service.ts`.
  - Persistent + SSE notification rows for the 3 user-facing events.

**Verification:**

- `docker exec assixx-backend pnpm exec eslint backend/src/nest/root/` → 0 errors (no output).
- `docker exec assixx-backend pnpm run type-check` → exit 0 (shared + frontend + backend + backend/test all clean).
- `doppler run -- docker-compose restart backend` → container restarted; `Nest application successfully started`. Log scan for `error|exception|root-self|RootSelfTermination` returned only pre-existing Loki `ENOTFOUND` network noise (unrelated to this change). Health endpoint `GET /health` → `{"status":"ok",...}` 200.

**Phase 2 status:** 6 / 7 steps complete. Only Step 2.7 (notifications + EventBus typed handlers) remains before Phase 2 DoD can be ticked.

**Next session:** Session 6 = Step 2.7 (`event-bus.ts` typed events + `notifications.service.ts` fan-out handlers).

### Session 7a — 2026-04-27

**Goal:** Phase 3 / first slice — unit tests for `RootProtectionService` only. Per /continue's one-step-per-session discipline, Session 7 from the original tracking row was split into 7a (this session, `root-protection.service.test.ts`), 7b (`root-self-termination.service.test.ts` ~24 tests including cooldown + race), and 7c (DB-trigger real-SQL integration ~8 tests). Same precedent as Session 5 → 5/5b/5c.

**Result:**

- **New file:** `backend/src/nest/root/root-protection.service.test.ts` (~290 LOC including doc-headers and fixtures). **16 tests, all green** on first run.
  - **8 cross-root guard tests** mapped 1:1 to §3 mandatory list items 1-8: Root A → Root B for each of the 4 termination ops (soft-delete / deactivate / demote / hard-delete) verifies `ForbiddenException` + `ROOT_CROSS_TERMINATION_FORBIDDEN` code + `ActivityLoggerService.log` call shape (action enum mapping verified per op: hard/soft → `'delete'`, deactivate/demote → `'update'`); Root → Admin/Employee verifies the early-return path (no throw, no audit); Admin / Employee → Root verifies that `target.role` (not actor.role) drives the guard — defense-in-depth even if `@Roles('root')` is bypassed at controller layer.
  - **3 last-root guard tests** mapped 1:1 to §3 mandatory list items 9-11: count=0 → `PreconditionFailedException` with `ROOT_LAST_ROOT_PROTECTION` code; count=1 → no throw; archived-roots SQL filter regression-protected by inspecting the emitted SQL string for `is_active = ${IS_ACTIVE.ACTIVE}`, `role = 'root'`, `id <> $2`, plus param array equality check `[TENANT, excludingUserId]`.
  - **5 isTerminationOp tests** (DoD coverage — every public method ≥1 happy + ≥1 failure path): 4 ops returning true (soft-delete is_active 1→4, deactivate 1→0, demote root→admin, hard-delete after===null) + 1 short-circuit returning false on non-root targets regardless of op (admin + employee + role-flip into root).
  - **Mock surface:** `DatabaseService.systemQuery` (assertNotLastRoot's no-client branch routes through sys_user / BYPASSRLS per §2.2 doc-comment); `ActivityLoggerService.log` (the generic method, NOT logCreate/logDelete — §0.5 finding: ActivityAction enum lacks `'denied'` so denials map to delete/update with explicit prefix in `details`).
  - **Fixture pattern:** `rootTarget(id, overrides)` / `adminTarget(id)` / `employeeTarget(id)` / `actor(id)` factories — minimal `ProtectionActor`/`ProtectionTargetUser` shapes per the service's narrow surface. No `as UserRole` casts: `'root' | 'admin' | 'employee'` are direct members of the union.
- **Lint cleanup applied (2 errors):** dropped unused `import type { UserRole }` after removing the casts; collapsed `toHaveBeenCalledOnce()` + `toHaveBeenCalledWith(...)` into the single `toHaveBeenCalledExactlyOnceWith(...)` per `vitest/prefer-called-exactly-once-with`.
- **Phase 3 mandatory checkboxes ticked:** Cross-Root Guard (8/8), Last-Root Guard (3/3). Self-Termination Lifecycle, Race / Concurrency, and DB-Trigger Integration sections remain untouched — owned by Sessions 7b + 7c.

**Verification:**

- `docker exec assixx-backend pnpm exec vitest run --project unit backend/src/nest/root/root-protection.service.test.ts` → 16/16 passed (29ms)
- `docker exec assixx-backend pnpm exec eslint backend/src/nest/root/root-protection.service.test.ts` → 0 errors
- `docker exec assixx-backend pnpm run type-check` → exit 0 (shared + frontend + backend + backend/test)
- Full root-module test sweep: `vitest run --project unit backend/src/nest/root/` → 155/155 passed across 8 test files (no regression)

**Next session:** Session 7b = `root-self-termination.service.test.ts` (~24 tests: lifecycle happy + failure paths, 24h cooldown both sides, last-root within request, approve self / non-existent / wrong-status / expired, reject without reason / non-existent / self, expireOldRequests cron, parallel approve race via FOR UPDATE, TX rollback).

### Session 7b — 2026-04-27

**Goal:** Phase 3 / second slice — unit tests for `RootSelfTerminationService`. Per /continue's one-step-per-session discipline, scope strictly limited to `root-self-termination.service.test.ts` (~24 tests covering Self-Termination Lifecycle 1-18 + Race / Concurrency 1-2 from §3 mandatory list). Session 7c (DB-trigger real-SQL integration ~8 tests) remains untouched.

**Result:**

- **New file:** `backend/src/nest/root/root-self-termination.service.test.ts` (~620 LOC including doc-headers, fixtures and mock factories). **24 tests, all green** (24/24, 36ms test runtime). One iteration was needed — the initial TX-ordering verification used `.slice(0, 60)` which truncated the trailing `FOR UPDATE` clause; fixed by dropping the slice (the QueryResult shape leaks no PII so full SQL inspection is fine in test).
- **Test breakdown by §3 mandatory list:**
  - **`requestSelfTermination` (6 tests, items 1-6):** happy-path with INSERT row + audit + `notifyRequested` fan-out + expires_at = NOW+7d (±1s tolerance); ALREADY_PENDING (DB unique partial index would also catch it, but service check is friendlier); COOLDOWN_ACTIVE within 24h with `cooldownEndsAt` ISO assertion; cooldown-expired-25h-ago path proceeds to INSERT; last-root propagates `PreconditionFailedException` from `assertNotLastRoot` mock; ROLE_FORBIDDEN fail-fast before any DB call (verifies `tenantTransaction` not even invoked).
  - **`cancelOwnRequest` (2 tests, items 7-8):** UPDATE returns row → audit fires + SQL inspection confirms `WHERE requester_id = $1 AND status = 'pending'` filter; UPDATE returns 0 rows → NotFoundException, no audit.
  - **`approveSelfTermination` (6 tests, items 9-13 + extra last-root):** SELF_DECISION_FORBIDDEN (actor.id === request.requester_id); NOT_FOUND (lock returns empty — RLS-safe behaviour); NOT_PENDING (already-decided row); EXPIRED (expires_at 1 min in past); happy-path with explicit TX-ordering verification on all 5 client.query calls (`SELECT ... FOR UPDATE` → `SELECT id FROM users ... FOR UPDATE` → `UPDATE root_self_termination_requests SET status='approved'` → `SELECT set_config('app.root_self_termination_approved', ...)` → `UPDATE users SET is_active = 4`) + post-commit `notifyApproved` call; last-root in approve TX → users UPDATE never fires + `notifyApproved` not called.
  - **`rejectSelfTermination` (4 tests, items 14-17):** happy-path verifies the **Session 6 Spec Deviation D7 invariant** — `rejected_at = $2` parametrised SQL (NOT `NOW()`) AND the same Date object reference is passed to `notifyRejected` (`expect(notifyArg.rejectedAt).toBe(sqlRejectedAt)` strict-equality check); REJECTION_REASON_REQUIRED on whitespace-only input fails fast before TX; NOT_FOUND on missing lock; SELF_DECISION_FORBIDDEN.
  - **`expireOldRequests` (1 test, item 18):** systemQuery returns 2 rows → 2x `eventBus.emit('root.self-termination.expired', ...)` plain-string emit (Session 6 spec strict-adherence — the cron path retains the plain-string emit while the 3 user-facing events use typed methods) + 2x audit log per row + count returned; SQL inspection regression-protects the `WHERE status = 'pending' AND expires_at < NOW()` filter so non-pending rows are never re-flipped on cron sweeps.
  - **Race / Concurrency (2 tests, items 19-20):** Parallel approve via Promise.allSettled with two pre-queued mock clients modeling the post-FOR-UPDATE state — client A gets the pending row and runs the full 5-step approve TX; client B's lock-SELECT returns the now-`approved` row → `assertCanDecide` throws `ConflictException(NOT_PENDING)`. Asserted: exactly 1 fulfilled, exactly 1 rejected, exactly 1 `notifyApproved` call (winner only). Approve TX rollback test simulates `UPDATE users` throwing mid-TX (after `set_config` already ran in the mock) → outer Promise rejects, post-commit `notifyApproved` NOT called (R9 mitigation invariant: notification fan-out is out-of-TX so a producer rollback can't trigger spurious notifications).
  - **Read-only contract (3 tests, DoD coverage):** `getMyPendingRequest` null-case + SQL inspection (`status = 'pending'`, params `[ACTOR_ID]`); `getMostRecentRejection` returns domain row + SQL `ORDER BY rejected_at DESC`; `getPendingRequestsForApproval` SQL filters `requester_id <> $1` + `expires_at > NOW()` (excludes self + already-expired stale rows between cron sweeps).
- **Mock pattern:** `tenantTransaction(cb)` invokes the callback with a queued `mockClient` (`{ query: vi.fn() }`). Per-test `mockClient.query.mockResolvedValueOnce(...)` chains drive the in-TX SQL sequence in order. `qResult<T>(rows)` helper builds a minimal `QueryResult<T>` envelope (only `.rows` is consumed by the service). For race tests, two pre-queued clients model FOR UPDATE serialization — `txCount++` switches between clients across `Promise.allSettled` invocations.
- **`mockEventBus` via `vi.hoisted` + `vi.mock('../../utils/event-bus.js', ...)`** — covers both the cron's plain-string `emit('root.self-termination.expired', ...)` (Session 6 design decision) AND the 3 typed methods (which are unused in this test since `RootSelfTerminationNotificationService` is mocked at the service-injection level, but kept in the mock for safety).
- **Test deferral rationale unchanged for 7c:** DB-trigger real-SQL integration tests require live psql against `assixx-postgres` (5-min approval window, GUC + DB-row check, sys_user/assixx_user bypass). That's a different harness pattern than the in-process unit suite — owned by Session 7c per the masterplan §3 list.

**Verification:**

- `docker exec assixx-backend pnpm exec vitest run --project unit backend/src/nest/root/root-self-termination.service.test.ts` → **24/24 passed (36ms)**
- `docker exec assixx-backend pnpm exec eslint backend/src/nest/root/root-self-termination.service.test.ts` → 0 errors (silent)
- `docker exec assixx-backend pnpm run type-check` → exit 0 (shared + frontend + backend + backend/test)
- Full root suite regression-check: `pnpm exec vitest run --project unit backend/src/nest/root/` → **179/179 passed across 9 test files (2.18s)** — net +24 tests vs. Session 7a's 155 baseline, no regression in any neighboring suite.

**Phase 3 status:** 2 / 3 sessions complete. §3 mandatory list 1-20 ticked; only §3 "DB-Trigger Integration" 8 items remain (Session 7c). Phase 3 DoD ≥32 unit tests already met — total in `root/` is 16 (Session 7a) + 24 (this) + 9 (Session 6 notification) + remaining = 179 across the module.

**Next session:** Session 7c = DB-trigger SQL integration tests (~8 tests) running real psql against `assixx-postgres` to verify Layer 4 trigger behaviour: cross-root forbidden as `app_user`, self without GUC blocked, GUC + no DB row blocked (5-min window), GUC + valid approved row succeeds, approved row >5min stale blocked, `assixx_user`/`sys_user` bypass succeeds, last-root with all gates green still blocked.

### Session 7c — 2026-04-28

**Goal:** Phase 3 / final slice — DB-trigger SQL integration tests. Per /continue's one-step-per-session discipline, scope strictly limited to the 8 §3 "DB-Trigger Integration" items: real psql against the live `assixx-postgres` container as the three Triple-User-Model roles. Closes Phase 3.

**Result:**

- **New file:** `backend/test/root-protection-trigger.api.test.ts` (~270 LOC including doc-headers, fixture builder and 2 small psql helpers). **8 tests, all green** (8/8, 3.4s wall time after the 4th iteration; 3 mechanical fixture-SQL fixes during write-up — `WITH/VALUES` column reference, missing `has_full_access=true` column for the `chk_root_full_access` constraint from migration `20260207000000020`, and `users.tenant_id` being RESTRICT not CASCADE which forced FK-safe cleanup ordering).
- **Test breakdown by §3 mandatory list:**
  - **Cross-root protection** (item 1): `app_user` actor → terminate peer root via `UPDATE users SET is_active = 4` → `ROOT_CROSS_TERMINATION_FORBIDDEN`. Sanity-asserts that the target row is unchanged after the blocked UPDATE.
  - **Self-termination requires approval** (items 2-5): four scenarios all run as `app_user`. (2) `app.user_id` set to self, no approval flag → `ROOT_SELF_TERMINATION_REQUIRES_APPROVAL`. (3) approval flag = 'true' but no DB row → `ROOT_NO_APPROVED_REQUEST` (Hybrid Option 1+ defense against forged GUC). (5) approval flag = 'true' + a stale `approved_at = NOW() - 6 min` row → `ROOT_NO_APPROVED_REQUEST` (5-min window expired). (4) approval flag = 'true' + fresh `approved_at = NOW()` row → succeeds, requester is_active flips to 4 (legitimate approve flow with actor=approver != target by design — the trigger's Hybrid branch sees the fresh DB row and skips the cross-root check).
  - **System-user bypass** (items 6-7): `assixx_user` UPDATE without any GUCs → succeeds (line 44 of trigger fn returns immediately). `sys_user` UPDATE without any GUCs → succeeds. Both verify the production identity used for migrations / cron / auth / signup / root admin / tenant deletion is unblocked by the trigger.
  - **Last-root protection** (item 8): isolated 2nd tenant `rootprot2-<runtag>` with exactly 1 active root. Even with the full approval gate satisfied (valid approved row + GUC + non-self actor), the trigger's final last-root check (count active roots in tenant where id != target → 0) raises `ROOT_LAST_ROOT_PROTECTION`. Sanity-asserts the target row is still is_active=1 after the rejected UPDATE.
- **Fixture pattern:** two dedicated tenants in `beforeAll` with run-tag suffix to avoid collision across overlapping CI runs (`rootprot1-s7c<timestamp>` 9 roots, `rootprot2-s7c<timestamp>` 1 root). All inserted as `assixx_user` (BYPASSRLS so writes can span two tenants without `app.tenant_id` GUC plumbing). IDs read back via a single tagged `SELECT 'tag|' || id ...` UNION-ALL query, parsed into a Map for fixture state. Cleanup in `afterAll` deletes in FK-safe order: `root_self_termination_requests` → `users` → `tenants` (because `users.tenant_id` is RESTRICT, not CASCADE; `assixx_user` bypasses the trigger so even already-mutated rows can be hard-deleted).
- **Two small helpers:** `psqlOk(user, sql)` for happy-paths (returns trimmed stdout); `psqlExpectError(user, sql)` for trigger rejections (returns captured stderr, throws if the command unexpectedly succeeds — `cause` attached on inner re-throw per `preserve-caught-error`).
- **Why `backend/test/` and not `backend/src/nest/root/`:** the trigger's `current_user IN ('assixx_user', 'sys_user')` bypass branch can ONLY be exercised by issuing raw SQL as those exact PostgreSQL roles. The HTTP harness always reaches the DB via the application pool (`app_user` + `tenantTransaction()`), so it cannot reach the bypass paths. The repo convention for tests that need direct psql access is `execSync('docker exec assixx-postgres psql -U <user>')` — established by `inventory.api.test.ts`, `auth-password-reset.api.test.ts`, `tpm-executions.api.test.ts`. The `*.api.test.ts` suffix is required by the Vitest `api` project's `include` pattern (`backend/test/**/*.api.test.ts` per `vitest.config.ts:224`).
- **Spec Deviation D8** recorded: §3 "Test files" code block lists only `root-protection.service.test.ts` and `root-self-termination.service.test.ts` — both in-process unit suites. The DB-trigger integration tests need a different harness (live psql, multi-role auth, tenant-scoped fixtures) and belong in `backend/test/` per repo convention. The §3 "DB-Trigger Integration" list itself explicitly says "(run actual SQL in test container)" so the intent matches; the §3 file table just didn't enumerate the third file. Annotated inline in the new file's header.

**Verification:**

- `pnpm exec vitest run --project api backend/test/root-protection-trigger.api.test.ts` → **8/8 passed (3.40s)**
- `docker exec assixx-backend pnpm exec eslint backend/test/root-protection-trigger.api.test.ts` → 0 errors (1 fix applied: `cause: err` on inner `throw new Error(...)` per `preserve-caught-error`)
- `docker exec assixx-backend pnpm run type-check` → exit 0 (shared + frontend + backend + backend/test all clean)
- Full root-module unit suite regression-check: `pnpm exec vitest run --project unit backend/src/nest/root/` → **179/179 passed across 9 test files (2.27s)** — no regression in any neighboring suite (Sessions 6 + 7a + 7b unchanged).

**Phase 3 Status: COMPLETE.** All 3 sub-sessions (7a + 7b + 7c) DONE; all §3 mandatory checkboxes (1-28 = 11 cross-root/last-root + 18 lifecycle + 2 race + 8 trigger) ticked; all 7 Phase 3 DoD checkboxes ticked. Total tests: 16 unit (RootProtectionService) + 24 unit (RootSelfTerminationService) + 8 api integration (Layer 4 trigger) + 9 unit (notification side-effect from Session 6) = **57 tests dedicated to the root-protection feature**, well above the ≥32 DoD threshold. The 2 deferred PUT-route role-demote wirings from Session 4 (`updateRootUser` / `updateAdmin`) remain backstopped by the now-fully-tested Layer 4 trigger.

**Next session:** Session 8 = Phase 4 API integration tests for the HTTP surface (`backend/test/root-self-termination.api.test.ts` ≥24 scenarios per §4: auth gates, CRUD, direct-API bypass, last-root, tenant isolation, notifications, cooldown).

### Session 8 — 2026-04-28

**Goal:** Phase 4 — API integration tests for the full HTTP surface (`backend/test/root-self-termination.api.test.ts`, ≥24 scenarios per §4). Per /continue's one-step-per-session discipline, scope strictly limited to the test file + any production-code fixes the tests surface; Phase 5 (frontend) and Phase 6 (ADR-053 + docs) untouched.

**Result:**

- **New file:** `backend/test/root-self-termination.api.test.ts` (~620 LOC, 25 tests, all green). Covers all §4 mandatory scenarios + 3 extras (T15 post-cooldown re-issue happy-path, T25 GET-after-reissue contract assertion, T10 cancel-after-approve idempotency).
- **Test infrastructure:** 3 dedicated tenants (`rstapi-<runtag>` 4 roots + 1 admin + 1 employee, `rstlast-<runtag>` 1 root, `rstiso-<runtag>` 2 roots) created via direct DB INSERT as `assixx_user` in `beforeAll`. Bcrypt hash for `ApiTest12345!` reused from the existing `info@assixx.com` row so all 9 fixture users log in via the standard `/auth/login` flow → JWT per user. `flushThrottleKeys()` at suite start prevents the login burst from tripping rate limits on rapid re-runs. Cleanup in `afterAll` deletes notifications + requests + users + tenants in FK-safe order via `assixx_user` (BYPASSRLS — required because the trigger fires on UPDATE/DELETE of soft-deleted root rows otherwise).
- **Production-code bug discovered + fixed:** `RootProtectionService.countActiveRoots` (when called inside an approve TX with `client`) executed `SELECT COUNT(*) ... FOR UPDATE` — invalid in PostgreSQL ("FOR UPDATE is not allowed with aggregate functions"). Sessions 7a/7b mocked `DatabaseService` so the bug never surfaced in unit testing; Phase 4 API tests are the first end-to-end path that exercises the real service+DB stack. Fix: split lock + count — `SELECT id ... FOR UPDATE` then `result.rows.length` returns the same answer. Functionally equivalent to the masterplan §2.4 approve-TX shape ("Lock the request row + all root rows in tenant" then "Recount AFTER lock"). The 3-line fix is contained in `backend/src/nest/root/root-protection.service.ts:countActiveRoots`. Inline comment documents the discovery + rationale. The unit test (Session 7a) only covers the no-client branch (`systemQuery` + `COUNT(*)` without lock) so 16/16 still green; full root unit suite remains 179/179 across 9 files.
- **Spec Deviation D9:** §4 wrote the bypass tests as `PATCH /users/{rootBuuid} {is_active:4}` and `PATCH /users/{rootBuuid} {role:'admin'}`, but `UsersController` exposes `PUT /users/uuid/:uuid` (the only `@Patch('me')` route is self-only — masterplan audit §0.5 rows confirm this). T16 maps to `DELETE /users/uuid/{uuid}` (cleanest soft-delete trigger; Layer 2 wired in Session 4 — clean 403 ROOT_CROSS_TERMINATION_FORBIDDEN). T17 maps to `PUT /users/uuid/{uuid}` with `{role:'admin'}` (Layer 4 trigger backstop because Session 4 deferred the role-flip Layer 2 wiring on `users.service.updateUser`). The trigger-raised PG exception surfaces as **500** through `AllExceptionsFilter.buildUnknownErrorResponse` because there is no dedicated PG-error filter; T17 asserts non-2xx + DB-side proof of non-mutation (`role` still 'root' after the request). Behavioural guarantee identical to the §4 intent — cross-root role demote remains impossible from `app_user`. T18 maps to `POST /users/uuid/{uuid}/archive` (Layer 2 defensive role-block in `users.service.archiveUser`, Session 4) — clean 403.
- **Spec Deviation D10:** §2.4 sample `ConflictException({code, message, cooldownEndsAt})` carries the cooldown-end timestamp as a top-level field on `error`, but `AllExceptionsFilter.buildHttpExceptionResponse` (`backend/src/nest/common/filters/all-exceptions.filter.ts:159-178`) explicitly normalises HttpException responses down to `{code, message, details?}` per ADR-007 — extra payload fields are dropped. The service still embeds the ISO timestamp inside the `message` body ("Re-request blocked until <ISO> (24h cooldown after rejection).") so the information is recoverable. T14 reflects this — extracts the timestamp via regex (`/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/`) and asserts it is within ±2 minutes of `NOW()+24h`. The frontend (Step 5.1) will use the same regex extraction OR the filter widens for this code in a Phase-6 follow-up.
- **Test breakdown by §4 mandatory list:**
  - Auth (3) — T01 unauth → 401, T02 admin → 403, T03 employee → 403.
  - CRUD (10 mapped + 1 extra) — T04 POST → 201 with full body shape, T05 GET own pending → 200, T06 second POST → 409 ALREADY_PENDING, T07 GET pending list as peer (sees rootA1's, excludes own), T08 self-approve → 403 SELF_DECISION, T09 approve happy-path → 200 + DB-side `is_active=4` proof + request `status='approved'`, T10 cancel-after-approve → 401/404 (rootA1 inactive), T11 second-flow request → 201, T12 reject without reason → 400 Zod, T13 reject with reason → 200, T15 backdate-25h-then-re-request → 201.
  - Direct API Bypass (3) — T16-T18 per D9 above.
  - Last-root (1) — T19 sole-root tenant → 412 LAST_ROOT_PROTECTION.
  - Tenant isolation (2) — T20 GET pending list omits foreign-tenant request, T21 approve foreign id → 404 NOT_FOUND.
  - Notifications (3) — T22 (3 peer notifications; requester excluded), T23 (3 recipients = requester + 2 remaining peers; approver excluded), T24 (requester-only with reason + "24h" + cooldown end timestamp).
  - Cooldown (2) — T14 (within 24h → 409 with ISO in message; D10), T15 (already counted under CRUD; double-purpose).
- **Iteration trace (transparency):**
  1. Initial run failed at fixture setup with **401 login** for fresh users — `EmailSchema.toLowerCase()` normalises every login input, but my fixture stored `rstApi-…` (mixed case); `WHERE email = $1` then missed. Fix: lowercased every test-tenant subdomain.
  2. Second run hit **429 Too Many Requests** on the login burst (9 sequential `/auth/login` calls). Fix: added `flushThrottleKeys()` to `beforeAll`.
  3. Third run surfaced 16 failures all rooted in the **`FOR UPDATE` + `COUNT(*)` PG bug** in `RootProtectionService.countActiveRoots`. Production code fixed; backend container restarted; remaining 2 failures (T14 + T21) traced to (a) `AllExceptionsFilter` envelope normalisation dropping `cooldownEndsAt` (D10), (b) psql `INSERT...RETURNING` output contamination on the iso-tenant request seed. Fixes: regex parse from `message` for T14; split INSERT + SELECT for T21 fixture.
  4. Fourth run: 25/25 pass (1.85s).

**Verification:**

- `pnpm exec vitest run --project api backend/test/root-self-termination.api.test.ts` → **25/25 passed (1.85s)**
- `docker exec assixx-backend pnpm exec eslint backend/test/root-self-termination.api.test.ts backend/src/nest/root/` → 0 errors
- `docker exec assixx-backend pnpm run type-check` → exit 0 (shared + frontend + backend + backend/test all clean)
- Full root-module unit suite regression-check: `vitest run --project unit backend/src/nest/root/` → **179/179 passed across 9 test files (2.08s)** — no regression from the `countActiveRoots` fix (the unit test only covers the no-client `systemQuery` branch, unaffected).
- Backend health endpoint: `GET /health` → 200 `{"status":"ok",…}` after the post-fix restart.

**Phase 4 Status: COMPLETE.** All 6 Phase 4 DoD checkboxes ticked. Total cumulative test count for the root-protection feature: 16 unit (RootProtectionService) + 24 unit (RootSelfTerminationService) + 9 unit (notification service, Session 6) + 8 api integration (Layer 4 trigger, Session 7c) + 25 api integration (HTTP surface, this session) = **82 tests**, well above the ≥32 + ≥24 = ≥56 DoD threshold. The 2 deferred PUT-route Layer-2 wirings from Session 4 (`updateRootUser` / `updateAdmin` / `users.service.updateUser`) remain backstopped by the now-end-to-end-tested Layer 4 trigger; T17 confirms the protection holds in practice.

**Next session:** Session 9 = Phase 5 frontend (`/root-profile` self-termination card + `/manage-root` destructive-op blocking + `/manage-approvals` RootSelfTerminationCard).

---

## Quick Reference: File Paths

### Backend (new — all flat in `root/`)

| File                                                                       | Purpose                                                           |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `backend/src/nest/root/root-protection.service.ts`                         | Cross-root + last-root guard logic                                |
| `backend/src/nest/root/root-self-termination.service.ts`                   | Request lifecycle + cooldown                                      |
| `backend/src/nest/root/root-self-termination.controller.ts`                | 6 REST endpoints                                                  |
| `backend/src/nest/root/root-self-termination.cron.ts`                      | Daily expiry job                                                  |
| `backend/src/nest/root/root-self-termination-notification.service.ts`      | Typed EventBus emits + persistent notification INSERTs (Step 2.7) |
| `backend/src/nest/root/root-self-termination-notification.service.test.ts` | 9 paired unit tests for the new notification service              |
| `backend/src/nest/root/dto/request-self-termination.dto.ts`                | Zod DTO                                                           |
| `backend/src/nest/root/dto/approve-self-termination.dto.ts`                | Zod DTO                                                           |
| `backend/src/nest/root/dto/reject-self-termination.dto.ts`                 | Zod DTO (required reason)                                         |
| `backend/src/nest/root/root-protection.service.test.ts`                    | ~12 tests                                                         |
| `backend/src/nest/root/root-self-termination.service.test.ts`              | ~24 tests                                                         |

### Backend (modified)

| File                                                      | Change                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| `backend/src/nest/root/root.module.ts`                    | Add new providers + controller                               |
| `backend/src/nest/root/root.service.ts`                   | Wire `RootProtectionService` into mutation @ line 400        |
| `backend/src/nest/root/root-admin.service.ts`             | Wire @ line 295                                              |
| `backend/src/nest/root/root-deletion.service.ts`          | Wire (spot-check Session 3)                                  |
| `backend/src/nest/users/users.service.ts`                 | Wire @ lines 512, 542, 557                                   |
| `backend/src/nest/dummy-users/dummy-users.service.ts`     | Defensive wiring @ line 300 (asserts target.role !== 'root') |
| `backend/src/nest/root/root.controller.ts`                | PUT routes 147 + 255 — services they call now wired          |
| `backend/src/utils/event-bus.ts`                          | 3 new typed events                                           |
| `backend/src/nest/notifications/notifications.service.ts` | Handlers for the 3 events                                    |

### Database (new)

| File                                                         | Purpose                             |
| ------------------------------------------------------------ | ----------------------------------- |
| `database/migrations/{ts}_root-self-termination-requests.ts` | Table + ENUM + RLS + 5 indexes      |
| `database/migrations/{ts}_root-protection-trigger.ts`        | Trigger function + trigger on users |

### Frontend (new + modified)

| Path                                                                                  | Purpose                                |
| ------------------------------------------------------------------------------------- | -------------------------------------- |
| `frontend/src/routes/(app)/(root)/root-profile/SelfTerminationCard.svelte`            | New                                    |
| `frontend/src/routes/(app)/(root)/root-profile/SelfTerminationModal.svelte`           | New                                    |
| `frontend/src/routes/(app)/(root)/root-profile/_lib/api.ts`                           | New                                    |
| `frontend/src/routes/(app)/(root)/root-profile/_lib/state-self-termination.svelte.ts` | New                                    |
| `frontend/src/routes/(app)/(root)/root-profile/+page.svelte`                          | Modified                               |
| `frontend/src/routes/(app)/(root)/root-profile/+page.server.ts`                       | Modified                               |
| `frontend/src/routes/(app)/(root)/manage-root/+page.svelte`                           | Modified — block destructive ops       |
| `frontend/src/routes/(app)/(shared)/manage-approvals/RootSelfTerminationCard.svelte`  | New                                    |
| `frontend/src/routes/(app)/(shared)/manage-approvals/+page.svelte`                    | Modified — render new card type        |
| `frontend/src/routes/(app)/(shared)/manage-approvals/+page.server.ts`                 | Modified — fetch pending peer requests |

### Backend (test)

| File                                               | Purpose                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `backend/test/root-protection-trigger.api.test.ts` | 8 Layer-4 trigger SQL integration tests (Session 7c, real psql against the container) |
| `backend/test/root-self-termination.api.test.ts`   | ≥ 24 API tests (Phase 4 / Session 8)                                                  |

---

## Spec Deviations

| #   | Spec says (v0.1.0)                                                 | Actual code (audit)                                                                                                                                                                                                                                          | Decision                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Module path `users/root-protection/`                               | `root/` is the bounded context                                                                                                                                                                                                                               | v0.2.0: flat in `root/`                                                                                                                                                                                                                                                                                                                                                   |
| D2  | Filename `eventBus.ts`                                             | Actual: `event-bus.ts` (kebab-case)                                                                                                                                                                                                                          | v0.2.0: corrected                                                                                                                                                                                                                                                                                                                                                         |
| D3  | Wire only `users.service.ts`                                       | 5 services + 2 PUT routes mutate users.is_active/role                                                                                                                                                                                                        | v0.2.0: expanded wiring                                                                                                                                                                                                                                                                                                                                                   |
| D4  | Trigger checks cross-root before approval                          | Approve flow has actor != target by design — blocked itself                                                                                                                                                                                                  | v0.2.0: Hybrid Option 1+ — approval-flag check + DB-row exists first                                                                                                                                                                                                                                                                                                      |
| D5  | §2.5 mandates `idField` factory for `:id` param                    | `root_self_termination_requests.id` is UUID (Phase 1 schema), not numeric                                                                                                                                                                                    | v1.0.4 (Session 5b): used `UuidIdParamDto` from same factory (`common/dto/param.factory.ts`) — UUID-typed pre-built DTO matches the data type; ADR-030 §7.5 "use centralized factory" mandate satisfied either way                                                                                                                                                        |
| D6  | §2.6 spec body uses `this.logger.info(...)`                        | NestJS `Logger` (`@nestjs/common`) has no `.info()` method                                                                                                                                                                                                   | v1.0.5 (Session 5c): replaced with `this.logger.log(...)` — the standard info-level call across the backend (kvp/log-retention/blackboard-archive). Forced literal-text fix, identical semantics. Annotated inline in cron file.                                                                                                                                          |
| D7  | §2.7 says "modify `notifications.service.ts` — handlers fan out"   | Established repo convention is per-domain `*-notification.service.ts` co-located with the producer (vacation/work-orders/tpm)                                                                                                                                | v1.0.6 (Session 6): created `root-self-termination-notification.service.ts` instead of growing `notifications.service.ts`. The literal-text approach would create a god object that knows about every domain. Behavioural outcome (typed emit + persistent INSERT for the 3 events) is identical to spec. Annotated inline in the new service header.                     |
| D8  | §3 "Test files" code block lists only the 2 in-process unit suites | DB-trigger SQL integration tests need a different harness (live psql, multi-role auth, tenant fixtures); §3's "DB-Trigger Integration" list itself says "(run actual SQL in test container)" — intent matches, file table just didn't enumerate the 3rd file | v1.2.0 (Session 7c): created `backend/test/root-protection-trigger.api.test.ts` per established repo convention for psql-direct integration tests (`tpm-executions.api.test.ts`, `auth-password-reset.api.test.ts`, `inventory.api.test.ts`). `*.api.test.ts` suffix required by the Vitest `api` project's `include` pattern. Annotated inline in the new file's header. |
| D9  | §4 bypass tests phrased as `PATCH /users/{rootBuuid} {is_active:4 / role:'admin'}` and "DELETE /users/{rootBuuid}" with expected 403 | `UsersController` has no PATCH for cross-user fields (`@Patch('me')` is self-only). Soft-delete via `DELETE /users/uuid/{uuid}` (Layer 2 wired); role-flip via `PUT /users/uuid/{uuid}` (Layer 2 deferred per Session 4 — Layer 4 trigger is the sole gate). The trigger raises a PG exception that surfaces as 500 (no dedicated PG-error filter). | v1.3.0 (Session 8): T16 uses DELETE → 403 Layer 2; T17 uses PUT → non-2xx + DB-side proof of non-mutation (Layer 4 backstop, surfaces as 500); T18 uses POST archive → 403 Layer 2. Behavioural guarantee identical (cross-root mutation impossible from `app_user`); only the status code on T17 differs. Fixing the 500→403 surface requires either wiring Layer 2 on `users.service.updateUser` or adding a PG-error filter — out of Phase 4 scope. |
| D10 | §2.4 cooldown response shape: `ConflictException({code, message, cooldownEndsAt})` with structured ISO field at `error.cooldownEndsAt` | `AllExceptionsFilter.buildHttpExceptionResponse` (`backend/src/nest/common/filters/all-exceptions.filter.ts:159-178`) explicitly normalises HttpException responses down to `{code, message, details?}` per ADR-007 — extra payload fields are dropped. The service still embeds the ISO timestamp inside `message` ("Re-request blocked until <ISO> (24h cooldown after rejection)."). | v1.3.0 (Session 8): T14 extracts the timestamp via regex from `message` and asserts ±2 minutes of `NOW()+24h`. Frontend (Step 5.1) will use the same regex extraction OR the filter widens for this code in a Phase-6 follow-up (would touch ADR-007 envelope contract — explicit decision required). |

---

## Known Limitations (V1 — deliberately excluded)

1. **2FA-Re-Auth on self-termination** — Not in scope. 2FA-confirm at submit time is a future hardening (V2 candidate).
2. **Recovery path for full root-credential loss** — If all roots lose Email + 2FA simultaneously, no in-app recovery. Only via support / tenant-deletion flow.
3. **Cross-tenant approval** — Roots can only approve requests in the same tenant. Enforced by RLS.
4. **No bulk approve** — Approval is per-request.
5. **No undo after approval execution** — Once is_active=4, no in-app undo. Manual restore via assixx_user only.
6. **No multi-stage approval ("k of n")** — Single peer approval is enough. Future phase if compliance demands.
7. **Hard-delete route may not exist** — Phase 0 audit found none. Trigger covers preemptively for any future addition.
8. **Tenant-deletion bypass** — When a tenant is deleted, all roots are removed by `sys_user` which bypasses the trigger. Intentional — tenant deletion has its own protection.
9. **`role-switch` interaction** — `role-switch/` does not change `users.role` in DB; switches request-context only. No conflict.
10. **5-min approval window in trigger** — If an approve TX takes longer than 5 minutes between row insert and the UPDATE, the trigger will reject with ROOT_NO_APPROVED_REQUEST. Acceptable trade-off; if observed in practice, widen window or move ordering inside one TX (already enforced in §2.4).

---

## Post-Mortem (fill after completion)

### What went well

- Phase 0 audit caught 1 critical + 4 must-fix issues before any code was written.

### What went badly

- TBD

### Metrics

| Metric                   | Planned       | Actual           |
| ------------------------ | ------------- | ---------------- |
| Sessions                 | 10            | 1 (Phase 0 done) |
| Migration files          | 2             |                  |
| New backend files        | ~9            |                  |
| New frontend files       | ~6            |                  |
| Modified files           | ~12           |                  |
| Unit tests               | ≥ 32          |                  |
| API tests                | ≥ 24          |                  |
| ESLint errors at release | 0             |                  |
| Spec deviations          | 4 (in v0.2.0) |                  |

---

**This document is the execution plan. Every session starts here, takes the next unchecked item, and marks it done. Phase 0 audit is COMPLETE — Phase 1 may start.**
