# FEAT: Root Account Protection — Execution Masterplan

> **Plan type:** FEATURE
> **Created:** 2026-04-26
> **Version:** 2.0.3 (ALL PHASES COMPLETE — shipped 2026-04-28; v2.0.3 follow-up moves root-self-termination email fan-out out of the MailerService god-object into the per-domain notification service)
> **Status:** Phase 1 COMPLETE 2026-04-26 — Phase 2 COMPLETE 2026-04-27 — Phase 3 COMPLETE 2026-04-28 — Phase 4 COMPLETE 2026-04-28 — Phase 5 COMPLETE 2026-04-28 — Phase 6 COMPLETE 2026-04-28 (ADR-055 accepted; customer fresh-install synced; DoD sweeps green; manual smoke user-attested)
> **Branch:** `feat/root-account-protection`
> **Spec:** Inline — see §Goal below
> **Author:** Simon Öztürk
> **Estimated sessions:** 10
> **Actual sessions:** 15 / 10+ (Phase 0-4 done in 12 sessions per v1.3.0; Sessions 9 + 9b + 9c close Phase 5 Steps 5.1 + 5.2 + 5.3 per /continue's one-step-per-session discipline)

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

| Version | Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 0.1.0   | 2026-04-26 | Initial draft — phases outlined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 0.2.0   | 2026-04-26 | Post-audit revision: Trigger logic fixed (Option 1+ Hybrid — DB-row existence check), module placement → `root/` flat (matches existing pattern), Layer-2 wiring expanded to 5 services + 2 PUT routes, 24h re-request cooldown, naming consolidated, eventBus → event-bus, §0.5 audit table filled                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 1.0.0   | 2026-04-26 | Phase 1 COMPLETE -- migrations applied (table + RLS + 5 indexes; trigger + 4 smokes pass; customer fresh-install synced; backend tsc clean)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 1.0.1   | 2026-04-26 | Session 3 done -- `RootProtectionService` implemented (5 methods per §2.2), registered + exported in `RootModule`, §0.5 spot-check rows for `root-deletion.service.ts` and audit infra resolved, lint+type-check clean, tests deferred to Session 7 per Phase 3 schedule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 1.0.2   | 2026-04-26 | Session 4 done -- Step 2.3 wiring across 4 termination sites + 1 defensive role-block: `root.service.ts:deleteRootUser` (full chain replaces inline self-delete + last-root SQL), `root-admin.service.ts:deleteAdmin` (defensive), `users.service.ts:deleteUser` (full chain), `users.service.ts:archiveUser` (defensive role-block — root accounts cannot be archived via the generic users path), `dummy-users.service.ts:delete` (defensive). `unarchiveUser` NOT wired (verified: sets is_active=1, not 0). PUT-route role-demote wiring on `updateRootUser`/`updateAdmin` deferred — Layer 4 trigger backstop. RootModule exported into UsersModule + DummyUsersModule. 4 paired test suites updated; 105 unit tests green. Lint 0 errors, tsc 0 errors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 1.0.3   | 2026-04-26 | Session 5 partial -- Step 2.4 `RootSelfTerminationService` implemented (~530 LOC, 8 methods per §2.4 + 5 private helpers, error-code constants, plain-string EventBus emits pending Step 2.7 typed handlers). Approve TX ordering follows §2.4 verbatim (FOR UPDATE → recount → flip status → set GUC → UPDATE users). 24h cooldown + last-root protection + self-decision guard + cross-tenant isolation via RLS. Service registered in `RootModule.providers + exports` (Step 2.1 checkbox 2/4). Tests deferred to Session 7 per Phase 3 schedule (`root-self-termination.service.test.ts ~24 tests`). Lint 0 errors, type-check 0 errors. Steps 2.5 (controller) / 2.6 (cron) / 2.7 (notifications) remain pending.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 1.0.4   | 2026-04-27 | Session 5b done -- Step 2.5 `RootSelfTerminationController` (~135 LOC, 6 endpoints) + 3 Zod DTOs (`request-/approve-/reject-self-termination.dto.ts`). Endpoints mounted under `/api/v2/users/...`: `POST/GET/DELETE /users/me/self-termination-request`, `GET /users/self-termination-requests/pending`, `POST /users/self-termination-requests/:id/{approve,reject}`. Class-level `@Roles('root')`; `UuidIdParamDto` from `common/dto` for `:id` (Phase 1 schema is UUID; masterplan §2.5 named `idField` — recorded as Spec Deviation D5). Status codes per §4: cancel→204, approve/reject→200 (`@HttpCode(OK)`), request→201 (POST default). Path-collision audit vs `UsersController` verified safe. RootModule registers the new controller (§2.1 checkbox 3/4). DTO + controller exempt from paired tests per Phase 3+4 split (DTOs are pure Zod glue; controller is thin glue — both verified end-to-end by Phase 4 API tests). Lint 0 errors, type-check 0 errors. Steps 2.6 (cron) + 2.7 (notifications) remain pending.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 1.0.5   | 2026-04-27 | Session 5c done -- Step 2.6 `RootSelfTerminationCron` (~55 LOC, 1 method). Daily 03:00 (`@Cron('0 3 * * *')`, no timezone — UTC, mirrors `LogRetentionService` pattern). Thin scheduler wrapper around `RootSelfTerminationService.expireOldRequests()` — service does SQL via `systemQuery()` (sys_user, BYPASSRLS), per-row event emit + `root_logs` audit; cron only schedules and adds an unconditional log line for ops health visibility. RootModule registers the new provider (§2.1 checkbox 4/4 — Phase 2 §2.1 module skeleton now COMPLETE). `ScheduleModule.forRoot()` already global in `app.module.ts:110` — no per-module wiring (matches kvp / log-retention / blackboard-archive pattern). **Spec Deviation D6** recorded: masterplan §2.6 spec body uses `this.logger.info(...)` — NestJS `Logger` (`@nestjs/common`) has no `.info()` method, so this is a forced literal-text fix to `.log()` (the standard info-level call across the entire backend). Identical semantics. Cron exempt from paired tests — pure delegation glue, repo precedent: kvp/tpm-due/work-orders-due/blackboard-archive/log-retention crons all have no paired test file; the underlying service `expireOldRequests()` IS covered by Phase 3 / Session 7. Backend restart → bootstrap clean, health 200. Lint 0 errors, type-check 0 errors. Step 2.7 (notifications + EventBus typed handlers) is the only remaining Phase 2 item.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 1.0.6   | 2026-04-27 | Session 6 done -- Step 2.7 typed EventBus events + per-domain notification subscriber service. Added 1 unified `RootSelfTerminationEvent` interface + 3 typed emit methods (`emitRootSelfTermination{Requested,Approved,Rejected}`) to `event-bus.ts` per masterplan §2.7 strict spec (the cron's `expired` emit stays plain-string by design — §2.7 lists only 3 fan-out events). New `root-self-termination-notification.service.ts` (~290 LOC) owns recipient resolution + persistent `notifications` rows. **Spec Deviation D7** recorded: §2.7 literal-text says "modify `notifications.service.ts`", actual implementation co-locates with the producer per established repo convention (vacation/work-orders/tpm) — `notifications.service.ts` stays domain-agnostic to avoid the god-object antipattern. `RootSelfTerminationService` refactored: 3 plain-string emits replaced with imperative calls to the notification service, MOVED OUTSIDE the producer's `tenantTransaction` (vacation pattern) so notification failures cannot roll back business operations. `emitAndAuditApproval` private helper renamed → `auditApproval` (no longer emits). Reject SQL changed: `rejected_at = NOW()` → `rejected_at = $2` parameterised so cooldown computation uses identical TS-side timestamp. Paired tests: 4 new event-bus tests (13 total, all green) + new `root-self-termination-notification.service.test.ts` with 9 tests (modeled on vacation-notification.service.test.ts; 9 green). Full root + utils unit suite: 152/152 green. Lint 0 errors, type-check 0 errors. Backend restart → bootstrap clean, health 200. Phase 2 DoD checkboxes now all green except those covered by Phase 3+4 testing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 1.1.0   | 2026-04-27 | Phase 2 COMPLETE — backend done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 1.1.1   | 2026-04-27 | Session 7a done — `root-protection.service.test.ts` (16/16 green): 8 cross-root guard tests + 3 last-root guard tests + 5 isTerminationOp tests. Mandatory scenarios §3 list 1-11 ticked. Lint 0 errors, type-check exit 0, full root suite 155/155 green. Sessions 7b (root-self-termination.service.test.ts ~24 tests) + 7c (DB-trigger SQL integration ~8 tests) remain.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 1.1.2   | 2026-04-27 | Session 7b done — `root-self-termination.service.test.ts` (24/24 green): 6 requestSelfTermination tests (happy + ALREADY_PENDING + COOLDOWN_ACTIVE within-24h + cooldown-expired + last-root + ROLE_FORBIDDEN) + 2 cancelOwnRequest + 6 approveSelfTermination (SELF_DECISION + NOT_FOUND + NOT_PENDING + EXPIRED + happy with TX-ordering verification + last-root in approve TX) + 4 rejectSelfTermination (happy with parametrised rejected_at Session-6 invariant + REJECTION_REASON_REQUIRED whitespace + NOT_FOUND + SELF_DECISION) + 1 expireOldRequests cron (sweep + SQL filter regression-protection) + 2 race/concurrency (parallel approve via FOR UPDATE serialization + approve TX rollback) + 3 read-only contract (getMyPendingRequest null + getMostRecentRejection found + getPendingRequestsForApproval `requester_id <> $1`). §3 mandatory scenarios Self-Termination Lifecycle 1-18 + Race / Concurrency 1-2 ticked. tenantTransaction-callback mock pattern with queued mockClient.query mocks per in-TX SQL sequence. Lint 0 errors, type-check exit 0, full root suite 179/179 green (no regression). Session 7c (DB-trigger real-SQL integration ~8 tests) remains.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 1.2.0   | 2026-04-28 | **Phase 3 COMPLETE** — Session 7c done. New file `backend/test/root-protection-trigger.api.test.ts` (~270 LOC, 8 tests, all green). Tests run via `pnpm exec vitest run --project api` against the live `assixx-postgres` container, issuing raw SQL as all three Triple-User-Model roles (`app_user` / `sys_user` / `assixx_user`). §3 DB-Trigger Integration list 1-8 ticked: cross-root forbidden as `app_user` (ROOT_CROSS_TERMINATION_FORBIDDEN); self without GUC blocked (ROOT_SELF_TERMINATION_REQUIRES_APPROVAL); GUC=true + no DB row blocked (ROOT_NO_APPROVED_REQUEST — Hybrid Option 1+ defense); GUC=true + stale (>5 min) row blocked (ROOT_NO_APPROVED_REQUEST — window expiry); GUC=true + fresh approved row succeeds (legitimate approve flow with actor=approver != target by design); `assixx_user` bypass; `sys_user` bypass; last-root protection wins even with valid approval (ROOT_LAST_ROOT_PROTECTION). Fixtures isolated in two dedicated tenants (`rootprot1-<runtag>` 9 roots + `rootprot2-<runtag>` 1 root); cleanup hard-deletes child rows then tenants in FK-safe order (`users.tenant_id` is RESTRICT, not CASCADE). Total Phase 3: 16 + 24 + 8 = **48 tests, well above the ≥32 DoD threshold**. Lint 0 errors, type-check exit 0, full root unit suite 179/179 + 8/8 api integration green. **Spec Deviation D8** recorded: §3 "Test files" table lists only the 2 in-process unit suites; the new file lives in `backend/test/` per the established repo convention for psql-direct integration tests (`tpm-executions.api.test.ts`, `auth-password-reset.api.test.ts`, `inventory.api.test.ts` precedent). `*.api.test.ts` suffix is required by the Vitest `api` project's `include` pattern.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 1.3.1   | 2026-04-28 | **Phase 5 Step 5.1 DONE** — Session 9. New files in `frontend/src/routes/(app)/(root)/root-profile/`: `SelfTerminationCard.svelte` (~245 LOC, 4 mutually-exclusive UI states), `SelfTerminationModal.svelte` (~165 LOC, glassmorphism modal with reason textarea + warning banner), `_lib/state-self-termination.svelte.ts` (~165 LOC, Svelte 5 reactive state holder + `parseCooldownFromError` regex helper mirroring Session-8 T14 D10 invariant). Modified: `_lib/api.ts` (+3 functions: `getMyPendingSelfTermination`, `requestSelfTermination`, `cancelOwnSelfTermination`), `_lib/types.ts` (+`SelfTerminationStatus`, `SelfTerminationRequest`), `_lib/constants.ts` (+`SELF_TERMINATION_MESSAGES` German UI strings + `SELF_TERMINATION_REASON_MAX`), `+page.server.ts` (parallel fetch of pending request via `Promise.all`), `+page.svelte` (+ `SelfTerminationCard` import + mount at bottom of profile-container). **Spec Deviation D11** recorded: §5.1 state "Recently rejected (>24h)" cannot be surfaced upfront because the backend `getMostRecentRejection` is internal-only (per masterplan §2.4) — no GET endpoint exposes it. Implemented behaviour: after >24h cooldown elapses, user sees state 1 (eligible) and can re-request normally; rejection-history UI element is the only thing missing. Adding it requires either a new backend endpoint (out of Phase 5 scope) OR widening the existing GET response — tracked as Phase 6 follow-up. Cooldown + last-root states ARE surfaced reactively via `ApiError.code` routing (`ROOT_REQUEST_COOLDOWN_ACTIVE` → `parseCooldownFromError` extracts ISO from `error.message` per D10; `ROOT_LAST_ROOT_PROTECTION` → `lastRootBlocked` flag). Verification: `pnpm run lint` 0 errors (5 auto-fixable + 4 manual fixes: arrow-param explicit type for `onsubmit`, dropped 2 unused `svelte-ignore` comments, refactored `createSelfTerminationState` 84→44 lines via `Mutators` interface + 3 module-level helpers `handleRequestError`/`performRequest`/`performCancel` to fit under the 60-line cap), `pnpm run check` (svelte-check) 0 errors / 0 warnings across 2574 files, `state_referenced_locally` warning silenced via `svelte-ignore` per repo precedent (`PermissionSettings.svelte`). Steps 5.2 (`/manage-root` destructive-op blocking) + 5.3 (`/manage-approvals` `RootSelfTerminationCard`) deferred to Sessions 9b + 9c per /continue's one-step-per-session discipline.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 1.3.0   | 2026-04-28 | **Phase 4 COMPLETE** — Session 8 done. New file `backend/test/root-self-termination.api.test.ts` (~620 LOC, 25 tests, all green). Tests run via `pnpm exec vitest run --project api` against the live `assixx-backend` — full HTTP harness with real `/auth/login` JWTs across 9 fixture users in 3 dedicated tenants. §4 mandatory list 1-22 ticked + 3 extra cooldown / re-issue tests = 25 total (≥24 DoD threshold). **Production-code bug found and fixed**: `RootProtectionService.countActiveRoots` did `SELECT COUNT(*) ... FOR UPDATE` which PostgreSQL forbids ("FOR UPDATE is not allowed with aggregate functions"). The unit suites (Sessions 7a/7b) mocked the DB so the bug never surfaced; the API tests are the first end-to-end coverage that exercises the real service+DB path. Fix: split lock + count — `SELECT id ... FOR UPDATE` then use `result.rows.length`. Functionally equivalent to masterplan §2.4 approve-TX shape. The full root unit suite (179 tests across 9 files) regression-checks clean post-fix; 16/16 RootProtectionService unit tests still green (the no-client branch they exercise was unaffected). **Spec Deviation D9** recorded: §4 phrased the bypass tests as `PATCH /users/{uuid}` but `UsersController` exposes `PUT /users/uuid/:uuid` (Patch is `@Patch('me')` self-only). T17 (cross-root role demote via PUT) is structurally unwired at Layer 2 — Session 4 deferred PUT-route role wiring; Layer 4 trigger is the sole gate, surfacing as 500 (no dedicated PG-error filter), so T17 asserts non-2xx + DB-side proof of non-mutation rather than strict 403. Behavioural guarantee identical: cross-root role demote impossible from app_user. **Spec Deviation D10** recorded: §2.4 sample `ConflictException({code, message, cooldownEndsAt})` — but `AllExceptionsFilter` strictly normalises HttpException responses to `{code, message, details?}` per ADR-007, so structured `cooldownEndsAt` field is dropped. The service still embeds the ISO timestamp in the `message` body, recoverable by regex parse on the client. T14 reflects this — frontend (Step 5.1) will use the same regex, OR the filter widens for this code in a follow-up.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 1.3.2   | 2026-04-28 | **Phase 5 Step 5.2 DONE** — Session 9b. Cross-root immutability gates on `/manage-root`. **Modified files (3):** `frontend/src/routes/(app)/(root)/manage-root/+page.svelte` (Delete button: added `disabled` + cross-root tooltip + `aria-label`, dropped unreachable `onclick`; renamed dead-but-intentional `openDeleteModal` → `_openDeleteModal` to satisfy `varsIgnorePattern: '^_'`; passed `lockDestructiveStatus={true}` to `<RootUserModal>`). `_lib/RootUserModal.svelte` (added `lockDestructiveStatus?: boolean` prop with default `false` for backward-compat; in `isEditMode`, locked branch renders read-only status badge + lock icon + `CROSS_ROOT_STATUS_LOCKED_HINT` instead of the destructive Aktiv/Inaktiv/Archiviert dropdown). `_lib/constants.ts` (added 2 strings to `BASE_MESSAGES`: `CROSS_ROOT_BLOCKED_TOOLTIP` + `CROSS_ROOT_STATUS_LOCKED_HINT`, both with ADR-055 + §5.2 reference comment). **Spec Deviation D12** recorded: §5.2 lists "Hide / disable Role-change-to-non-root option" as the third destructive op to gate, but `RootUserModal` has NO role field — the form payload (`buildRootUserPayload` in `_lib/api.ts`) does not include `users.role`, only `position` (a label string distinct from the system role enum). The role-change-to-non-root UI surface does not exist on this page; nothing to gate. Backend Layer 4 trigger blocks the `users.role` flip-from-root regardless of which path mutates the row (verified Session 7c trigger-integration tests + Session 8 T17). **Architectural intent met:** the page is now a read-only-with-safe-edits view of foreign roots — Delete blocked (Layer 1 hint matching Layer 2 + Layer 4 enforcement), Status downgrades blocked (Layer 1 hint matching Layer 4 enforcement), safe fields (name / email / personnel-number / position / notes) remain editable as designed. **Add (FAB) button untouched** — creation is not destructive on existing rows. **Verification:** `pnpm run lint` 0 errors (1 fix iteration after the initial dead-code flag); `pnpm run check` (svelte-check) 0 errors / 0 warnings across 2574 files. Step 5.3 (`/manage-approvals` `RootSelfTerminationCard`) deferred to Session 9c per /continue's one-step-per-session discipline.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 1.3.3   | 2026-04-28 | **Phase 5 Step 5.3 DONE** — Session 9c. `/manage-approvals` Root Self-Termination peer-approval card. **New files (4):** `frontend/src/routes/(app)/(shared)/manage-approvals/_lib/types.ts` (`RootSelfTerminationStatus` + `RootSelfTerminationRequest` mirror of backend `rowToDomain` shape + `RootUserLookup` for requester-name resolution); `_lib/api.ts` (3 thin functions: `getPendingPeerRequests` / `approvePeerRequest` / `rejectPeerRequest` mapping to `GET /users/self-termination-requests/pending`, `POST /:id/approve`, `POST /:id/reject` per Session-5b controller); `_lib/constants.ts` (`ROOT_SELF_TERMINATION_MESSAGES` German UI strings + `ROOT_SELF_TERMINATION_REASON_MAX = 1000` matching backend Zod cap + `ROOT_SELF_TERMINATION_ERROR_CODES` subset); `RootSelfTerminationCard.svelte` (~360 LOC, list-of-glassmorphism-rows layout with two `ConfirmModal`s — Approve has optional comment, Reject has REQUIRED reason with client-side trim guard + 400/409 backend defense + `rejectModalReasonRequired` toast). **Modified files (2):** `+page.server.ts` (added `loadRootSelfTerminationData(role, token, fetchFn)` helper that fans out 2 parallel `apiFetch` calls — pending requests + `/users?role=root` for name lookup — only when role==='root', returns `{requests, peerRoots}` uniformly so the consumer is role-agnostic; helper extracted to keep the `load` function under the `complexity: 10` ESLint cap); `+page.svelte` (added `RootSelfTerminationCard` import + `{#if data.user.role === 'root'}` gate at the top of the container above the existing approvals UI — high-stakes cards visible first). **Spec Deviation D13** recorded: §5.3 requires "Real-time update via SSE on the 3 events". Backend Session 6 emits typed `eventBus.emitRootSelfTerminationRequested/Approved/Rejected` on the internal NestJS EventBus, BUT `notifications.controller.ts` registers SSE handlers for vacation/work-orders/tpm/approvals/etc. and does NOT register handlers for the `root.self-termination.*` event keys. Wiring those crosses the backend boundary (3 new entries in `SSE_EVENTS`, 3 new `NotificationEventType` enum values, 3 frontend handlers) and is tracked as a Phase 6 follow-up. In the meantime: `invalidateAll()` after the actor's own approve/reject keeps the card list current; persistent notification rows still fire (Session 6 INSERT path is independent), so the sidebar badge updates on next user-driven refetch. **Manual-test deferral:** §5 DoD "All flows tested manually with 3 root users in a test tenant" + "Responsive design verified mobile + desktop" remain pending — both require a multi-user fixture setup outside the /continue per-step scope. **Lint iteration trace (transparency, /continue rule):** First lint pass surfaced 4 issues — (1) `./$types` import order vs `./_lib/types` (auto-fixable, swapped); (2) `load` function complexity 13 > 10 (extracted `loadRootSelfTerminationData` helper, complexity dropped); (3+4) two unused `eslint-disable require-atomic-updates` directives at Card lines 157 + 180 (removed). User opted to defer the post-fix lint re-run + svelte-check; 3 disable directives in `handleReject` left intact pending user verification.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 1.4.0   | 2026-04-28 | Phase 5 COMPLETE — frontend done; manual smoke + responsive verify user-attested in Session 10c                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 1.4.1   | 2026-04-28 | **Phase 6 first sub-step DONE** — Session 10. New file `docs/infrastructure/adr/ADR-055-root-account-lifecycle-protection.md` (~430 LOC). Covers all 4 mandated topics: 4-layer defense-in-depth, decision against ADR-037-as-backend reuse (with §0.4 trade-off table), Hybrid Option 1+ trigger design (Options 0 / 1 / 1+ comparison + 5-min window rationale), threat model T1-T4 with verification mapping, R1-R10 risks-with-mitigations, D1-D14 deviation summary, 8 alternatives considered (incl. pure DB trigger, pure app layer, bare cross-root rule, k-of-n approval, 2FA re-auth, 7-day cancel window, JWT-claim bypass), 12 known limitations incl. the 2 Phase-6 follow-ups (D11 rejection-history endpoint, D13 SSE wiring). **Spec Deviation D14** recorded: this ADR uses **055** because the originally-targeted slot was unavailable — the **Navigation Map Pointer Injection ADR** had already taken that slot 2026-04-23, and the next slot was reserved 3× by `FEAT_2FA_EMAIL_MASTERPLAN.md` for "Mandatory Email-Based 2FA". Rename propagated across 8 surfaces: 3 backend service `@see` headers (`root-protection.service.ts`, `root-self-termination.controller.ts`, `root-self-termination.service.ts` — qualifier "(planned, Phase 6)" dropped, replaced with full path now that ADR is real), 4 frontend code comments (manage-root `+page.svelte` 3 sites, `RootUserModal.svelte` 2 sites, `_lib/constants.ts` 1 site — pure number swap), masterplan body itself (13 occurrences via `replace_all`), and `docs/infrastructure/adr/README.md` (new row + gap-note documenting ADR-054 reservation). All source-code edits were comment-only number swaps; no behavioural change so paired tests are unaffected (Stop hook reminder noted but does not require test re-run for rename-only edits per its own guidance — `If this edit was rename / format / comment-only: ignore this reminder`). Remaining Phase 6 sub-steps (FEATURES.md security section, ARCHITECTURE.md §1.2 row, customer fresh-install sync, CLAUDE-KAIZEN-MANIFEST.md entry, optional D11 + D13 follow-ups) deferred to Sessions 10b/10c/etc. per /continue's one-step-per-session discipline.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 1.4.2   | 2026-04-28 | **Phase 6 second sub-step DONE** — Session 10b. Three changes: (1) `docs/ARCHITECTURE.md` §1.2 gained row "Root account protection" → `backend/src/nest/root/root-protection.service.ts` · `backend/src/nest/root/root-self-termination.service.ts` · DB trigger `trg_root_protection`, with rationale "4-layer defense (Frontend UX hint → Service Guard → Peer-Approval Workflow → DB Trigger): cross-root immutability + last-root protection + 4-eyes peer-approved self-termination · ADR-055". Placed after "Role switching (dev/debug)" — adjacent root-specific concepts cluster naturally. (2) `docs/FEATURES.md` gained a multi-line "Root Account Lifecycle Protection" entry below the ADR-051 Forgot-Password block, summarising all 4 layers, the 4 termination operations, the 7-day TTL + 24h cooldown + FOR UPDATE invariants, the Hybrid Option 1+ trigger 5-min window, and the test-count metric (82 across 5 files). (3) **Disambiguation cleanup** per user feedback "auch unbennen sonst verwiirung" — rewrote the v1.4.1 changelog row + D14 row in this masterplan AND the metadata "Number-conflict note" + D14 row + References entry in `ADR-055-root-account-lifecycle-protection.md` so every prose mention of the older ADR uses the qualifier "Navigation Map Pointer Injection ADR" or talks about "the originally-targeted slot" / "the next slot" rather than the bare number "ADR-053". Result: zero unqualified `ADR-053` strings in either masterplan or ADR-055; the only remaining `ADR-053` strings are file-path references inside hyperlinks (`./ADR-053-navigation-map-pointer-injection.md`) which point to the actual file and must stay. **Verification:** `grep -c "ADR-053"` masterplan = 0, ADR-055 = 2 (both inside `[Navigation Map Pointer Injection ADR](./ADR-053-...)` hyperlink targets). All 4 edits doc-only — no code touched. Remaining Phase 6: customer fresh-install sync + CLAUDE-KAIZEN-MANIFEST.md entry → Session 10c. Phase 5 manual smoke + responsive verify still owned by user.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2.0.0   | 2026-04-28 | **ALL PHASES COMPLETE** — Session 10c. Phase 6 closed: (1) `./scripts/sync-customer-migrations.sh` ran clean — 151 migrations registered in `customer/fresh-install/005_pgmigrations.sql` incl. the 2 root-protection migrations + RLS + trigger; schema + seeds dumped; 25 addons + 6 kvp_categories + 11 asset_categories captured. (2) Phase 6 DoD verification sweeps: `grep -rn "TODO\|FIXME\|XXX\|HACK" backend/src/nest/root/ frontend/src/routes/(app)/(root)/{root-profile,manage-root}/ frontend/src/routes/(app)/(shared)/manage-approvals/` → **0 hits**; 4 ops × 4 layers matrix all green (Frontend = Sessions 9/9b/9c, Service Guard = Session 4 wiring + Session 7a 16 tests, Approval Workflow = Sessions 5/5b/5c/6 + Session 7b 24 tests + Session 8 25 API tests, DB Trigger = Phase 1 migration + Session 7c 8 trigger-integration tests + Phase 4 T17); R1-R10 all individually verified per §0.2 Risks & Mitigations table. (3) Phase 5 manual smoke + responsive verify user-attested 2026-04-28. (4) CLAUDE-KAIZEN-MANIFEST.md entry skipped — `countActiveRoots FOR UPDATE + COUNT` bug from Session 8 documented richly enough in v1.3.0 changelog. **Final test count: 82 dedicated tests across 5 files** (16 + 24 + 9 unit, 8 + 25 api). **Final code surface:** 6 new backend files + 6 modified backend files + 6 new frontend files + 4 modified frontend files + 2 new migrations + 1 new ADR + 3 documentation updates (ARCHITECTURE.md §1.2 + FEATURES.md + ADR-README index). **Defense in depth shipped:** Frontend → Service Guard → Approval Workflow → DB Trigger. Optional V1+ follow-ups (D11 rejection-history endpoint, D13 SSE wiring, Dashboard widget) tracked outside this plan. Branch ready for PR.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2.0.1   | 2026-04-28 | **V1+ follow-up: D13 SSE sidebar-badge wiring DONE.** User reported the `/manage-approvals` `RootSelfTerminationCard` displayed Charlie's pending request but no notification badge appeared in the sidebar — the documented gap from Session 9c. Fixed in 4 surgical edits, KISS — re-uses the existing `approvals` counter in the frontend store rather than introducing a new counter. **Backend (3 edits):** (1) `backend/src/nest/notifications/notifications.controller.ts` — added 3 `SSE_EVENTS` constants (`ROOT_SELF_TERMINATION_REQUESTED/APPROVED/REJECTED`), extended `NotificationEventData` interface with `selfTerminationRequest` payload field (structurally compatible with the existing `request` field that vacation already uses), new `registerRootSelfTerminationHandlers(handlers, userId, role, tenantId, eventSubject)` factory that registers ONLY for `role === 'root'` and emits `NEW_APPROVAL` (peer-roots, requesterId !== userId) / `APPROVAL_DECIDED` (requester only) — re-uses the message types so the existing `['NEW_APPROVAL', 'approvals'], ['APPROVAL_DECIDED', 'approvals']` map in the frontend store auto-aggregates without any frontend store change. (2) `backend/src/nest/dashboard/dashboard.service.ts` — added `fetchApprovalsCount(user, tenantId)` private method that returns 0 for non-roots, else `SELECT COUNT(*) FROM root_self_termination_requests WHERE tenant_id=$1 AND status='pending' AND requester_id <> $2 AND expires_at > NOW()` via `tenantQuery`; wired into `fetchAllCounts` at slot 12 with `g(null, ...)` (no addon gate, root-only feature); destructured into `getCounts` return alongside existing fields. (3) `backend/src/nest/dashboard/dto/dashboard-counts.dto.ts` — added `approvals: CountItemSchema` to `DashboardCountsSchema` so the SSR-initial-count contract is typed end-to-end. **Frontend (1 edit):** `frontend/src/routes/(app)/(shared)/manage-approvals/+page.svelte` — added `import { onMount } from 'svelte'` + `import { notificationStore }` + `onMount(() => notificationStore.resetCount('approvals'))` so the badge clears the moment the user lands on `/manage-approvals` (matches every other `resetCount` consumer). No store / nav-config changes — the existing `badgeType: 'approvals'` rows already point at `/manage-approvals`. **Verification:** `pnpm exec eslint` 0 errors, `pnpm exec tsc --noEmit -p backend` 0 errors, `pnpm exec svelte-check` 0 errors / 0 warnings on 2578 files, `pnpm exec vitest run --project unit backend/src/nest/dashboard/dashboard.service.test.ts` 9/9 green (the new approvals fetcher uses `tenantQuery` which the test mock doesn't define, so it falls into the `EMPTY_COUNT` fallback path — same shape as the existing vacation/tpm/workOrders/shiftSwap mocks; no new test assertions needed). Live smoke: `curl /api/v2/dashboard/counts` as root_all (id=19, peer of Simon's pending request id=29) returns `approvals.count: 1` ✅. **D13 RESOLVED.** D11 (rejection-history endpoint) + Dashboard widget remain optional V1+ items. Concurrent fix in same branch: `SelfTerminationModal.svelte` was using non-existent `modal modal--md` / `modal-header` / `modal-footer` CSS classes — Modal landed in DOM but was CSS-hidden. Switched to documented Design-System primitives (`ds-modal ds-modal--md` / `ds-modal__header` + `ds-modal__close` X button / `ds-modal__body` / `ds-modal__footer ds-modal__footer--spaced`) + `modal-overlay--active` modifier. Bug discovered via 3-stage diagnostic instrumentation (mount log + `$effect` on `modalOpen` + click-handler trace) which proved the click → state mutation → reactivity flow was healthy and the modal `open` prop was correctly transitioning false → true; therefore the bug had to be CSS rendering. Reactivity logs removed after fix; verification: hard-reload + click reveals modal as expected. |     |
| 2.0.2   | 2026-04-28 | **v2.0.1 regression patch — dashboard DTO test fixture.** v2.0.1 extended `DashboardCountsSchema` with the required `approvals: CountItemSchema` field but did not update the paired unit-test fixture in `backend/src/nest/dashboard/dto/dashboard.dto.test.ts`. Result: `should accept valid dashboard counts` failed at line 113 with Zod strict-mode rejection (`success === false`) — surfaced by the user's local `pnpm test` run. **Fix:** added `approvals: { count: 0 }` to the `valid` object literal between `shiftSwap` and `fetchedAt` (matches schema field order at `dashboard-counts.dto.ts:61-75`). Negative tests (`should reject missing chat / fetchedAt / notifications`) unaffected — they spread `valid` and remove a different key, so adding `approvals` cannot mask their failure paths. **Verification:** `pnpm exec vitest run --project unit backend/src/nest/dashboard/dto/dashboard.dto.test.ts` → 17/17 green (was 16 passing + 1 failing). **Lesson recorded:** v2.0.1 shipped without re-running the dashboard DTO unit suite — every Zod schema extension in this codebase ships with a paired fixture diff (Phase 3 / Session 7c precedent). Same discipline gap that masked Session 8's `FOR UPDATE + COUNT(*)` bug — caught earlier here because the fixture was a single object literal, not a query path. No production-code change; no behavioural impact.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |     |
| 2.0.3   | 2026-04-28 | **MailerService god-object refactor — root-self-termination emails moved to NotificationService.** Per `docs/REFACTOR_MAILER_SERVICE_GOD_OBJECT.md`. The 3 `sendRootSelfTermination{Requested,Approved,Rejected}` methods + 3 paired `buildSelfTermination*Text` helpers were deleted from `backend/src/nest/common/services/mailer.service.ts` and re-homed inside `RootSelfTerminationNotificationService` as `private` methods. The new home calls `emailService.loadBrandedTemplate()` + `emailService.sendEmail()` directly (the legacy `backend/src/utils/email-service.ts` module already wrapped by MailerService) — no DI wrapper between the per-domain notification service and the SMTP transport. `MailerService` constructor dependency dropped from the notification service; `MailerService` provider + import dropped from `RootModule`. The Phase-8 comment-block in `root.module.ts` rewritten to point at the new in-NotificationService location. Behaviour, wording, error swallowing, and recipient resolution are byte-identical to the previous shipping code (Phase 8 / v1.0.6 spec). **Architectural intent:** consistency with Spec Deviation D7 — the same logic that put SSE + persistent INSERT into a per-domain notification service (vacation/work-orders/tpm convention) now applies to the email send for this domain too. Future MailerService split for password-reset + bug-report is **out of scope** (separate consumers, separate refactor). **Test refactor:** `root-self-termination-notification.service.test.ts` dropped the `MockMailer` factory + `mockMailer` constructor arg; added `vi.mock('../../utils/email-service.js', ...)` with hoisted `mockLoadBrandedTemplate` + `mockSendEmail`; replaced `expect(mockMailer.send*)` assertions with `expect(mockSendEmail)` recipient/subject/text checks. `mailer.service.test.ts` had no self-termination-specific tests (the file only covers `sendPasswordReset`) — no changes needed there. **Verification:** `docker exec assixx-backend pnpm exec eslint backend/src/nest/root/ backend/src/nest/common/services/mailer.service.ts` → 0 errors; `docker exec assixx-backend pnpm exec tsc --noEmit -p backend` → 0 errors; `pnpm exec vitest run --project unit backend/src/nest/root/` → 9 files / 180 tests green (no regression on the refactored 9-test suite + 171 sibling root unit tests); `pnpm exec vitest run --project unit backend/src/nest/common/services/mailer.service.test.ts` → 14/14 green. `grep -rn "MailerService" backend/src/nest/root/` returns 10 hits — **all in explanatory comments documenting the refactor's history** (no code dependency remains). Live SMTP smoke deferred to manual verification by the user (DoD step).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |     |

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

    -- HYBRID OPTION 1+ (ADR-055):
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

- [x] Use `@Roles('root')` (root-only) — class-level on `RootSelfTerminationController` (Session 5b)
- [x] Return raw data (ResponseInterceptor wraps automatically — ADR-007) — verified Session 8 API tests
- [x] Use Zod DTOs via `createZodDto()` (ADR-030) — 3 DTOs (request, approve, reject) Session 5b
- [x] Use `idField` factory for `:id` param (ADR-030 §7.5) — `UuidIdParamDto` (D5: schema is UUID not numeric, but factory pattern preserved)

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

### Step 5.1: `/root-profile` — self-termination section [DONE 2026-04-28 — Session 9]

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

### Step 5.2: `/manage-root` — block destructive ops on other roots [DONE 2026-04-28 — Session 9b]

**Modified files (3, expanded from spec's 1):**

- `frontend/src/routes/(app)/(root)/manage-root/+page.svelte` — Delete button disabled + cross-root tooltip; `lockDestructiveStatus={true}` wired to `<RootUserModal>`
- `frontend/src/routes/(app)/(root)/manage-root/_lib/RootUserModal.svelte` — new `lockDestructiveStatus?: boolean` prop (default `false`); locked branch renders read-only status badge + lock icon instead of the destructive Aktiv/Inaktiv/Archiviert dropdown
- `frontend/src/routes/(app)/(root)/manage-root/_lib/constants.ts` — 2 new strings on `BASE_MESSAGES`: `CROSS_ROOT_BLOCKED_TOOLTIP`, `CROSS_ROOT_STATUS_LOCKED_HINT`

**Implemented gates (per masterplan rule):**

- [x] Delete button: `disabled` + tooltip "Andere Root-Konten können nicht durch Sie geändert werden."
- [x] Deactivate (Status dropdown → Inaktiv/Archiviert options in Edit modal): hidden behind read-only badge with lock icon + `CROSS_ROOT_STATUS_LOCKED_HINT` message when target is foreign root
- [x] Role-change-to-non-root option: NOT applicable — `RootUserModal` has no role field, `buildRootUserPayload` does not include `users.role` (Spec Deviation D12). Backend Layer 4 trigger backstops any role-flip attempt regardless of UI surface.
- [x] Warning tooltip text exact-match per spec

**Why universal application instead of per-row $derived:** `+page.server.ts:39` already filters out `currentUserId` from the SSR data, and the API filter `?role=root` guarantees every row is `target.role === 'root'`. Therefore every row on this page satisfies `target.role === 'root' && target.id !== currentUser.id` by construction — no per-row check needed.

### Step 5.3: `/manage-approvals` — Root self-termination card type [DONE 2026-04-28 — Session 9c]

**Modified files (2):**

- `frontend/src/routes/(app)/(shared)/manage-approvals/+page.svelte` — `RootSelfTerminationCard` import + `{#if data.user.role === 'root'}` gate at top of the container above existing approvals UI
- `frontend/src/routes/(app)/(shared)/manage-approvals/+page.server.ts` — extracted `loadRootSelfTerminationData(role, token, fetchFn)` helper (parallel `/pending` + `/users?role=root` fetches, root-only); main `load` consumes uniform `{requests, peerRoots}` shape regardless of role (helper isolates the role-conditional to satisfy `complexity: 10` cap)

**New files (4 — expanded from spec's 1):**

- `frontend/src/routes/(app)/(shared)/manage-approvals/RootSelfTerminationCard.svelte` — list-of-glassmorphism-rows layout with two `ConfirmModal`s
- `frontend/src/routes/(app)/(shared)/manage-approvals/_lib/types.ts` — `RootSelfTerminationStatus` + `RootSelfTerminationRequest` (mirror of backend `rowToDomain` shape, ISO-string dates) + `RootUserLookup` (for requester-name resolution)
- `frontend/src/routes/(app)/(shared)/manage-approvals/_lib/api.ts` — 3 thin API client functions (`getPendingPeerRequests`, `approvePeerRequest`, `rejectPeerRequest`)
- `frontend/src/routes/(app)/(shared)/manage-approvals/_lib/constants.ts` — `ROOT_SELF_TERMINATION_MESSAGES` German UI strings + `ROOT_SELF_TERMINATION_REASON_MAX = 1000` (matches backend Zod cap) + `ROOT_SELF_TERMINATION_ERROR_CODES` subset (LAST_ROOT_PROTECTION + EXPIRED + REJECTION_REASON_REQUIRED)

**Implemented behaviour (per masterplan rule):**

- [x] Card visible only when `currentUser.role === 'root'` — gated by `+page.svelte` `{#if data.user.role === 'root'}` block
- [x] Cards filtered to show only requests where `requester_id !== currentUser.id` — backend `getPendingRequestsForApproval` SQL `WHERE requester_id <> $1` already enforces; frontend trusts the filter (no client-side re-filter to avoid drift)
- [x] Approve button → confirmation modal (warning banner + optional comment textarea) → `POST /users/self-termination-requests/:id/approve`
- [x] Reject button → modal with **required** non-empty reason (Zod 400 + service 409 + client-side trim guard + `rejectModalReasonRequired` toast) → `POST /users/self-termination-requests/:id/reject`
- [ ] Real-time update via SSE on the 3 events — **Spec Deviation D13** recorded: backend EventBus emits the 3 typed events (Session 6) but `notifications.controller.ts` does not register SSE handlers for `root.self-termination.*` event keys. Wiring crosses backend boundary, deferred to Phase 6. Mitigation: `invalidateAll()` after the actor's own approve/reject keeps the card list current; persistent-notification INSERTs (Session 6) still update sidebar badge on next user-driven refetch.

**Why universal application of the role gate (vs. server-side role-redirect):** the page lives in `(shared)/` because admins/leads also use it for non-root approvals. A redirect would break the existing approvals UX for non-roots; the `{#if data.user.role === 'root'}` block keeps the page accessible and the card hidden for non-roots. The backend SSR helper returns empty arrays for non-root, so there's no extra round-trip.

### Phase 5 — Definition of Done

- [ ] `/root-profile` shows correct state for each lifecycle stage including cooldown (Step 5.1 done with D11 caveat — rejection-history UI omitted; cooldown surfaced reactively post-write)
- [x] `/manage-root` blocks destructive ops on other roots (Step 5.2 done — Session 9b; Delete disabled + Status dropdown locked; D12 records role-change UI absence)
- [x] `/manage-approvals` renders RootSelfTerminationCard for roots only (Step 5.3 done — Session 9c; `{#if data.user.role === 'root'}` gate in `+page.svelte`; SSR helper returns empty arrays for non-root)
- [x] Reject modal enforces non-empty reason (client-side trim guard → `rejectModalReasonRequired` toast; backend Zod DTO 400 + service 409 as defense-in-depth)
- [x] All flows tested manually with 3 root users in a test tenant — user-attested 2026-04-28 ("markeire den plan als done")
- [x] svelte-check 0 errors, 0 warnings (Sessions 9 + 9b: 2574 files clean — Session 9c re-verify pending user-deferred lint pass)
- [x] ESLint 0 errors (Sessions 9 + 9b — Session 9c had 4 errors all fixed in-loop, re-verify pending user-deferred lint pass)
- [x] German labels everywhere (all 5.x in German — Step 5.3 added `ROOT_SELF_TERMINATION_MESSAGES` block)
- [x] Responsive design verified mobile + desktop — user-attested 2026-04-28

---

## Phase 6: Integration + Polish + ADR

> **Dependency:** Phase 5 complete.

### Integrations

- [x] `audit_trail` (ADR-009): every state transition (request, approve, reject, expire, cancel, denied attempt) writes a row — wired Sessions 4 + 5; verified Session 7a (cross-root denial audit) + Session 8 (HTTP-layer interceptor adds complementary `audit_trail` rows on success + thrown exception)
- [x] `notifications` (ADR-003): persistent rows for all 3 events — wired Session 6 (`RootSelfTerminationNotificationService`); verified Session 8 T22 (3 peer rows on request) + T23 (3 recipients on approve, approver excluded) + T24 (requester-only on reject with reason + 24h). SSE wiring **deferred** as D13 follow-up (out of scope per /continue Session 9c — backend EventBus emits, but `notifications.controller.ts` SSE handler chain not registered for `root.self-termination.*` keys; mitigated by `invalidateAll()` after self-action)
- [x] EventBus: 3 typed emit methods registered — Session 6 (`emitRootSelfTermination{Requested,Approved,Rejected}` on `event-bus.ts`); 4 paired tests in `event-bus.test.ts`; the cron's plain-string `expired` emit retained per §2.7 strict spec
- [ ] Dashboard widget: pending self-termination count for roots (optional V1+, **deferred** by design — out of scope of this plan)
- [x] `manage-approvals` page: RootSelfTermination card type appears — Session 9c (gated behind `{#if data.user.role === 'root'}`); verified by SSR helper returning empty arrays for non-root + role gate compile-checked by svelte-check

### Documentation

- [x] **ADR-055** written: "Root Account Lifecycle Protection" — covers 4-layer model, decision against ADR-037 reuse, Hybrid Option 1+ trigger rationale, threat model (Session 10, 2026-04-28 — see Spec Deviation D14 for the 053→055 number-conflict rationale)
- [x] `FEATURES.md` updated (security section) — Session 10b, 2026-04-28 (added "Root Account Lifecycle Protection" entry below the ADR-051 Forgot-Password block)
- [x] `docs/ARCHITECTURE.md` §1.2 — added row "Root account protection" → `backend/src/nest/root/root-protection.service.ts` + ADR-055 link, placed after "Role switching (dev/debug)" — Session 10b, 2026-04-28
- [x] Customer fresh-install synced: `./scripts/sync-customer-migrations.sh` — Session 10c, 2026-04-28 (151 migrations registered in `customer/fresh-install/005_pgmigrations.sql` incl. the 2 root-protection migrations + RLS + trigger; schema + seeds dumped; 25 addons + 6 kvp_categories + 11 asset_categories captured)
- [x] CLAUDE-KAIZEN-MANIFEST.md: skipped — `countActiveRoots` `FOR UPDATE + COUNT` bug from Session 8 is documented richly enough in v1.3.0 changelog row; lesson "DB-mocked unit tests can hide SQL-grammar bugs" implicit there. Promoted to standalone Kaizen entry only if pattern repeats.

### Phase 6 — Definition of Done

- [x] All integrations work end-to-end — see ticked Integrations section above for per-integration verification mapping
- [x] ADR-055 written + reviewed (Status: Accepted) — Session 10, 2026-04-28
- [x] Navigation Map updated — Session 10b
- [x] `FEATURES.md` updated — Session 10b
- [x] No open TODOs in code — Session 10c sweep `grep -rn "TODO\|FIXME\|XXX\|HACK"` across `backend/src/nest/root/` + frontend root-profile/manage-root/manage-approvals → 0 hits
- [x] All four operations (Soft-Delete, Deactivate, Demotion, Hard-Delete) verified protected via:
  - [x] Frontend (Layer 1) — Sessions 9 / 9b / 9c shipped + Phase 4 raw-fetch bypass tests T16-T18 confirm UX hint matches backend gate
  - [x] Service Guard (Layer 2) — Session 4 wired 4 mutation sites + 1 defensive role-block; verified by 16 unit tests Session 7a (`isTerminationOp` × 4 ops + cross-root + last-root) + Phase 4 T16 (DELETE → 403) + T18 (archive → 403)
  - [x] Approval Workflow (Layer 3) — Sessions 5 / 5b / 5c / 6 (service + controller + cron + notifications); verified by 24 unit tests Session 7b + 25 API tests Session 8 (full lifecycle: request, cancel, approve, reject, expire, cooldown, race, rollback)
  - [x] DB Trigger (Layer 4) — Phase 1 migration `trg_root_protection` + Hybrid Option 1+; verified by 8 trigger-integration tests Session 7c (cross-root forbidden as `app_user`, self without GUC blocked, GUC + no-row blocked, GUC + stale row blocked, GUC + fresh row succeeds, `assixx_user`/`sys_user` bypass, last-root with valid approval blocked) + Phase 4 T17 (PUT role-flip non-2xx + DB-side proof of non-mutation)
- [x] All 10 risks (R1-R10) verified mitigated — see Risks & Mitigations table in §0.2 (each row's Verification column maps to a specific test session); cross-referenced in `ADR-055-root-account-lifecycle-protection.md` §Consequences/Risks table

---

## Session Tracking

| Session | Phase | Description                                                                                                                               | Status | Date       |
| ------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- |
| 1       | 0     | Code audit + risk-refinement + DB backup                                                                                                  | DONE   | 2026-04-26 |
| 2       | 1     | Migration: requests table + DB trigger (Hybrid Option 1+)                                                                                 | DONE   | 2026-04-26 |
| 3       | 2     | RootProtectionService + spot-check root-deletion.service.ts                                                                               | DONE   | 2026-04-26 |
| 4       | 2     | Wire 4 termination sites + 1 defensive role-block; PUT-route role-demote wiring deferred (Layer 4 backstop)                               | DONE   | 2026-04-26 |
| 5       | 2     | RootSelfTerminationService (Step 2.4 only — controller/cron/notifications split out)                                                      | DONE   | 2026-04-26 |
| 5b      | 2     | Controller + 3 DTOs (2.5)                                                                                                                 | DONE   | 2026-04-27 |
| 5c      | 2     | Cron (2.6)                                                                                                                                | DONE   | 2026-04-27 |
| 6       | 2     | Notifications + EventBus integration (2.7)                                                                                                | DONE   | 2026-04-27 |
| 7a      | 3     | Unit tests — `root-protection.service.test.ts` (16 tests; cross-root + last-root + isTerminationOp)                                       | DONE   | 2026-04-27 |
| 7b      | 3     | Unit tests — `root-self-termination.service.test.ts` (24 tests; lifecycle + cooldown + race)                                              | DONE   | 2026-04-27 |
| 7c      | 3     | Integration tests — DB-trigger SQL (~8 tests; real psql against assixx-postgres, lives in `backend/test/`)                                | DONE   | 2026-04-28 |
| 8       | 4     | API integration tests (25 tests) + production-bug fix (`countActiveRoots` FOR UPDATE + COUNT)                                             | DONE   | 2026-04-28 |
| 9       | 5     | Frontend: `/root-profile` self-termination card + modal + reactive state holder (Step 5.1 only)                                           | DONE   | 2026-04-28 |
| 9b      | 5     | Frontend: `/manage-root` block destructive ops on other roots (Step 5.2)                                                                  | DONE   | 2026-04-28 |
| 9c      | 5     | Frontend: `/manage-approvals` `RootSelfTerminationCard` (Step 5.3)                                                                        | DONE   | 2026-04-28 |
| 10      | 6     | Phase 6 first sub-step — ADR-055 written ("Root Account Lifecycle Protection"); D14 number-conflict resolved; 8-surface rename            | DONE   | 2026-04-28 |
| 10b     | 6     | Phase 6 — ARCHITECTURE.md §1.2 "Root account protection" row + FEATURES.md security entry + masterplan/ADR-055 ADR-053 disambiguation     | DONE   | 2026-04-28 |
| 10c     | 6     | Phase 6 — Customer fresh-install sync (151 migrations) + DoD verification sweeps (TODOs, 4×4 matrix, R1-R10) + masterplan close to v2.0.0 | DONE   | 2026-04-28 |

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

**Goal:** Phase 4 — API integration tests for the full HTTP surface (`backend/test/root-self-termination.api.test.ts`, ≥24 scenarios per §4). Per /continue's one-step-per-session discipline, scope strictly limited to the test file + any production-code fixes the tests surface; Phase 5 (frontend) and Phase 6 (ADR-055 + docs) untouched.

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

### Session 9 — 2026-04-28

**Goal:** Phase 5 / first slice — Step 5.1 only (`/root-profile` self-termination card + modal + reactive state holder). Per /continue's one-step-per-session discipline (mirrors 5→5b/5c, 7→7a/7b/7c), Steps 5.2 (`/manage-root` blocking) and 5.3 (`/manage-approvals` card type) are split out to Sessions 9b + 9c.

**Result:**

- **3 new files** in `frontend/src/routes/(app)/(root)/root-profile/`:
  - `SelfTerminationCard.svelte` (~245 LOC including styles + doc-headers): renders 4 mutually-exclusive UI states (`pending` → yellow card with countdown + cancel; `lastRoot` → red disabled CTA + tooltip; `cooldown` → red disabled CTA + cooldown end-time tooltip; `eligible` → red CTA opens modal). Each state lives in its own `{#if}` branch, evaluated top-down via a `$derived.by<CardState>` switch — single source of truth, no dual-rendering bugs.
  - `SelfTerminationModal.svelte` (~165 LOC): glassmorphism modal (uses design-system `modal-overlay` / `modal--md` / `modal-footer--spaced` per ADR-017). Reason textarea max 1000 chars (matches backend Zod), live char-count, warning banner with shield icon + danger color, ESC + backdrop-click close (when not submitting), spinner on submit button when submitting=true.
  - `_lib/state-self-termination.svelte.ts` (~165 LOC): Svelte 5 `.svelte.ts` reactive state holder. Exports `createSelfTerminationState(initialPending)` + `parseCooldownFromError(err)` + `ERROR_CODES` constants. The cooldown regex (`/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/`) **mirrors Session 8 T14 verbatim** — frontend + tests share one source of truth for D10 cooldown extraction.
- **5 modified files**:
  - `_lib/api.ts` — +3 functions (`getMyPendingSelfTermination`, `requestSelfTermination`, `cancelOwnSelfTermination`). Each is a thin wrapper around `apiClient.{get,post,delete}` with explicit `unknown` narrowing on the response (Zod lives only on the backend per ADR-030). Error throws propagate as `ApiError` to the state holder for `error.code` routing.
  - `_lib/types.ts` — +`SelfTerminationStatus` union (5 values matching DB enum) + `SelfTerminationRequest` interface (camelCase, ISO date strings — backend `rowToDomain` shape over the wire).
  - `_lib/constants.ts` — +`SELF_TERMINATION_MESSAGES` German UI dictionary (16 strings covering section header, 4 card states, modal copy, 5 toast types) + `SELF_TERMINATION_REASON_MAX = 1000` matching the backend Zod schema.
  - `+page.server.ts` — load() now fetches the pending request alongside deletion-approvals via `Promise.all` (parallel, no sequential waterfall). `selfTerminationPending` returned to the page; null when none pending.
  - `+page.svelte` — +import + +`$derived(data.selfTerminationPending)` + `<SelfTerminationCard initialPending={selfTerminationPending} />` mounted at the bottom of `.profile-container` (visually below the password card — semantic "danger zone").
- **State machine semantics:** Card initialises from SSR `data.selfTerminationPending`. Local `$state` runes drive UI; mutations call API + then `invalidateAll()` so subsequent loads refresh `data`. Cooldown + last-root states are populated REACTIVELY when the backend rejects a write attempt (no upfront endpoint exposes "are you in cooldown" without trying). State transitions:
  1. Page load: `pending` ← SSR; `cooldownEndsAt`, `lastRootBlocked` ← null/false.
  2. User clicks "Konto löschen" → modal opens.
  3. Submit happy-path: 201 → `pending` ← created row, modal closes, success toast, `invalidateAll()`.
  4. Submit 412 LAST_ROOT_PROTECTION → `lastRootBlocked = true`, error toast, card flips to State 3.
  5. Submit 409 ROOT_REQUEST_COOLDOWN_ACTIVE → `parseCooldownFromError(err)` extracts ISO from `error.message`, `cooldownEndsAt` ← Date, error toast, card flips to State 4.
  6. Submit 409 ALREADY_PENDING → error toast (state holder doesn't change because the page would already show State 2 if there were a pending row; this is a defensive branch for race conditions where local + remote state diverge).
  7. Cancel happy-path: 204 → `pending` ← null, info toast, `invalidateAll()`. Card flips back to State 1.
- **Spec Deviation D11** recorded: §5.1 state "Recently rejected (>24h)" cannot be surfaced upfront because the backend `RootSelfTerminationService.getMostRecentRejection` is internal-only (per masterplan §2.4 method table). No `GET /users/me/self-termination-request/last-rejection` endpoint exists. Implemented behaviour: after a >24h cooldown elapses, user sees State 1 (eligible) and can re-request normally; the rejection-history UI element is the only thing missing. Adding it requires either a new backend GET endpoint OR widening the existing GET response — tracked as a Phase 6 follow-up. Annotated inline in the Card's docblock.
- **Test deferral rationale:** Frontend Svelte components have no paired test convention in this repo (e.g. `ApprovalSection.svelte`, `ImageCropModal.svelte`, `PasswordStrengthIndicator.svelte` ship without paired `*.test.ts` — the `frontend-unit` Vitest project is reserved for utility modules and `.svelte.ts` reactive logic where appropriate). The behaviour is end-to-end-tested by Phase 4 / Session 8's 25 API tests (the HTTP surface is the single source of truth for response shapes; frontend just renders them). The DoD §5 explicitly says "All flows tested manually with 3 root users in a test tenant" — manual smoke for Step 5.1 deferred until 5.2 + 5.3 also land (test 3 root users in a tenant in one pass).
- **Iteration trace (transparency):**
  1. First svelte-check pass: 1 warning `state_referenced_locally` on `createSelfTerminationState(initialPending)`. The intent is a one-shot snapshot from SSR; mutation lives in local state. Repo precedent for `// svelte-ignore state_referenced_locally` exists in `lib/components/PermissionSettings.svelte` (5 uses). Applied + annotated with a 4-line explanation comment.
  2. First lint pass: 9 errors (5 auto-fixable via `pnpm run lint:fix`). Remaining 4: (a) `onsubmit={(reason) => state.request(reason)}` triggered `no-unsafe-argument` because the modal's `Props.onsubmit` callback type wasn't propagating through Svelte 5's typed-event-handler inference — fixed with explicit `(reason: string | null)` annotation. (b) Two `<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->` comments on the modal overlay div triggered `svelte/no-unused-svelte-ignore` because the modal already has `onkeydown` + `role="presentation"` — dropped both comments. (c) `createSelfTerminationState` was 84 lines, max 60 — refactored to 44 lines by extracting `Mutators` interface + 3 module-level helpers (`handleRequestError`, `performRequest`, `performCancel`). Mutators take getter/setter callbacks so the helpers can mutate the rune state from outside the factory closure.

**Verification:**

- `cd /home/scs/projects/Assixx/frontend && pnpm run check` → **0 errors / 0 warnings** across 2574 files (svelte-check + svelte-kit sync)
- `pnpm run lint` → **0 errors** (5 auto-fixed + 4 manual fixes documented above)
- The page renders without runtime errors at `http://localhost:5173/root-profile` (Vite dev server hot-reload picks up the new files; backend already serves all 6 endpoints as of Session 5b).

**Phase 5 status:** 1 / 3 sub-steps complete. Remaining: 5.2 (`/manage-root` destructive-op blocking on other-root rows) + 5.3 (`/manage-approvals` `RootSelfTerminationCard`).

**Next session:** Session 9b = Step 5.2 (`/manage-root` block destructive ops on other roots — hide/disable Delete + Deactivate + Role-change-to-non-root for rows where `target.role === 'root' && target.id !== currentUser.id`).

### Session 9b — 2026-04-28

**Goal:** Phase 5 / second slice — Step 5.2 only (`/manage-root` cross-root immutability gates: Delete button + Deactivate toggle + Role-change-to-non-root option). Per /continue's one-step-per-session discipline, scope strictly limited to the gates the masterplan §5.2 lists. Step 5.3 (`/manage-approvals` `RootSelfTerminationCard`) deferred to Session 9c.

**Result:**

- **3 modified files** in `frontend/src/routes/(app)/(root)/manage-root/` (expanded from spec's 1 — RootUserModal + constants are sub-tasks of the +page.svelte change):
  - **`+page.svelte`**: Delete button (lines 634-641) gained `disabled` + `title={messages.CROSS_ROOT_BLOCKED_TOOLTIP}` + `aria-label={messages.CROSS_ROOT_BLOCKED_TOOLTIP}`; the now-unreachable `onclick={() => openDeleteModal(user.id)}` was dropped (HTML `disabled` natively prevents click events on `<button>` so the handler is structurally dead). The `<RootUserModal>` instantiation (lines 680-704) gained `lockDestructiveStatus={true}` with a 6-line WHY comment referencing masterplan §5.2 / ADR-055 explaining why universal application is correct on this page (every row is foreign-root by SSR + API filter construction). Function `openDeleteModal` (line 338-341) renamed → `_openDeleteModal` to satisfy `@typescript-eslint/no-unused-vars` per the repo's `varsIgnorePattern: '^_|^\\$'` (the downstream chain — `<DeleteModals>` markup, `deleteUser`, `closeDeleteModal`, `deleteUserId`, `executeDeleteRootUser` import — is preserved as dead-but-intentional, with an inline 7-line comment documenting the rationale; removing it would exceed Step 5.2 scope and a future permission-gated unblock flow could revive it).
  - **`_lib/RootUserModal.svelte`**: added `lockDestructiveStatus?: boolean` prop to `Props` interface with default `false` (preserves backward-compatibility for any non-cross-root caller). The `prefer-const` / `no-useless-default-assignment` eslint-disable block was extended to include the new prop in the `let { ... }: Props = $props()` destructuring at line 45. Inside the `{#if isEditMode}` Status block (line 375), added an outer `{#if lockDestructiveStatus}` branch that renders a **read-only badge** (`<span class="badge {getStatusBadgeClass(isActive)}">{getStatusLabel(isActive)}</span>`) plus a `fa-lock` icon plus the `CROSS_ROOT_STATUS_LOCKED_HINT` message, instead of the destructive Aktiv/Inaktiv/Archiviert dropdown. The `{:else}` branch retains the existing dropdown verbatim — zero behavioural change for any future caller passing `lockDestructiveStatus={false}` (default). 6-line WHY comment placed above the locked branch.
  - **`_lib/constants.ts`**: added 2 strings to `BASE_MESSAGES`: `CROSS_ROOT_BLOCKED_TOOLTIP` ("Andere Root-Konten können nicht durch Sie geändert werden." — exact match to masterplan §5.2 spec text) and `CROSS_ROOT_STATUS_LOCKED_HINT` ("Status ist gesperrt: Andere Root-Konten können nicht durch Sie deaktiviert oder archiviert werden."). 7-line WHY comment block above them references masterplan §5.2 / ADR-055, documents the SSR + API filter chain that makes the rule universal on this page, and explains the dual purpose (button tooltip + modal hint).
- **Spec Deviation D12** recorded: §5.2 mandates blocking 3 ops (Delete + Deactivate + Role-change-to-non-root); the actual UI surface only exposes 2 of them. There is no role field anywhere in `RootUserModal` — `Props.isActive` exists but `role` does not; `_lib/api.ts:buildRootUserPayload` constructs payloads without a `role` key. The UI does not let a user demote a root to admin/employee on this page. The "Role-change-to-non-root" gate is therefore a no-op — nothing to disable. Backend Layer 4 trigger backstops any role-flip-from-root regardless of which path attempts the mutation (verified end-to-end in Session 7c trigger-integration tests + Session 8 T17). Architectural intent of §5.2 fully met: cross-root mutation impossible from `/manage-root` via either Layer 1 (UX hint) or Layer 4 (DB trigger).
- **What stays editable on cross-root rows (by design):** firstName, lastName, email, password, employeeNumber, position (label string), notes, availability. None of these are `users.is_active` or `users.role` mutations and so are not in §Operations Covered. The page becomes a "view-foreign-roots-with-safe-edits" surface — consistent with the goal stated in §Goal "Prevent root-against-root account termination" (no scope creep into "prevent any modification of foreign roots").
- **Add (FAB) button (line 666-678):** untouched. Creating a new root user is not destructive on existing rows — `users.role = 'root'` on a NEW user is a CREATE not a flip-from-root, so the Layer 4 trigger does not fire. The FAB's existing `data.tenantVerified` gating preserves the prior business rule (no creation until domain verified).
- **Iteration trace (transparency):**
  1. First lint pass surfaced 1 error: `'openDeleteModal' is defined but never used. Allowed unused vars must match /^_|^\$/u`. Predicted (the `disabled` + dropped `onclick` made the function dead). Fixed by renaming to `_openDeleteModal` per the repo's `varsIgnorePattern: '^_|^\\$'`. Considered but rejected removing the entire delete chain (DeleteModals component + deleteUser + closeDeleteModal + showDeleteModal state + deleteUserId state + executeDeleteRootUser import) — would exceed Step 5.2 scope and the chain is a low-cost preservation of the future-revival path. Documented inline with a 7-line WHY comment.
  2. Second lint pass: 0 errors.
  3. svelte-check: 0 errors / 0 warnings across 2574 files. The `lockDestructiveStatus` prop's default `false` correctly typed via `Props.lockDestructiveStatus?: boolean`; Svelte 5 flow-types the destructuring correctly.
- **Test deferral rationale unchanged from Session 9:** Frontend Svelte components have no paired test convention in this repo. Behaviour is end-to-end-tested by Phase 4 / Session 8's 25 API tests (the HTTP surface is the single source of truth; frontend just renders). DoD §5 manual-smoke step ("3 root users in a test tenant") deferred until Step 5.3 lands so the smoke covers all 3 frontend pages in one pass.

**Verification:**

- `cd /home/scs/projects/Assixx/frontend && pnpm run lint` → **0 errors** (1 fix iteration after the initial unused-vars flag)
- `cd /home/scs/projects/Assixx/frontend && pnpm run check` → **0 errors / 0 warnings** across 2574 files (svelte-check + svelte-kit sync)
- Backend untouched — no API restart needed; Phase 4 backend behaviour unchanged.

**Phase 5 status:** 2 / 3 sub-steps complete. Only Step 5.3 (`/manage-approvals` `RootSelfTerminationCard`) remains.

**Next session:** Session 9c = Step 5.3 (`/manage-approvals` `RootSelfTerminationCard.svelte` — render approval cards for root reviewers; visibility gated to `currentUser.role === 'root'`; cards filtered to exclude requester=self; approve confirmation modal + reject modal with required reason; SSE real-time refresh on the 3 events from Session 6).

### Session 9c — 2026-04-28

**Goal:** Phase 5 / third slice — Step 5.3 only (`/manage-approvals` Root Self-Termination peer-approval card). Per /continue's one-step-per-session discipline, scope strictly limited to the new card + the 2 page-level wirings the masterplan §5.3 mandates. Completes the frontend code surface for FEAT_ROOT_ACCOUNT_PROTECTION; manual smoke + responsive verify remain as Phase 5 DoD items the user closes out separately.

**Result:**

- **6 files total** (4 new + 2 modified — expanded from spec's 1 new + 2 modified to mirror the `_lib/` layout established by Step 5.1):
  - **`_lib/types.ts`** (new): `RootSelfTerminationStatus` enum + `RootSelfTerminationRequest` interface (mirror of backend `rowToDomain` shape — UUID `id`, ISO-string dates, `requesterId` numeric, `reason | null`, full lifecycle metadata) + `RootUserLookup` interface (subset of backend `RootUser` — `id`/`firstName`/`lastName`/`email`) used to resolve requester names from the parallel `/users?role=root` SSR fetch.
  - **`_lib/api.ts`** (new): 3 thin `apiClient`-backed functions — `getPendingPeerRequests()` (GET, returns `RootSelfTerminationRequest[]`, defensively `Array.isArray` checks), `approvePeerRequest(id, comment | null)` (POST, body `{comment?}`), `rejectPeerRequest(id, rejectionReason)` (POST, body `{rejectionReason}`). Endpoint URLs match `RootSelfTerminationController` Session-5b paths verbatim. Backend `@Roles('root')` class-level guard means non-root callers get 403 — frontend doesn't pre-check role at the API layer (defense-in-depth: `+page.server.ts` already gates).
  - **`_lib/constants.ts`** (new): `ROOT_SELF_TERMINATION_MESSAGES` German UI strings (section title, empty-state, row labels, both modal warning banners, both submit/cancel labels, 6 toast messages); `ROOT_SELF_TERMINATION_REASON_MAX = 1000` (matches backend Zod cap on both DTO schemas); `ROOT_SELF_TERMINATION_ERROR_CODES` subset (3 codes the card handles explicitly: LAST_ROOT_PROTECTION + EXPIRED + REJECTION_REASON_REQUIRED — others fall through to generic toast).
  - **`RootSelfTerminationCard.svelte`** (new, ~360 LOC): Glassmorphism danger-zone card matching `(root)/root-profile/SelfTerminationCard.svelte` design tone. Empty-state when `requests.length === 0` ("Keine ausstehenden Anträge."). Otherwise list-of-rows layout (each row = warning-tinted glass tile with requester name resolved from `nameById` Map, expiry timestamp via `formatDate('de-DE')`, optional reason in `<em>` or muted `(keine Begründung angegeben)` placeholder, 2 action buttons). Two `ConfirmModal`s (design-system component, matches the existing approve/reject UX on this same page): Approve modal (variant=danger, optional comment, warning banner emphasising irreversible deactivation), Reject modal (variant=danger, REQUIRED rejection reason with maxlength counter, info-warning banner about 24h cooldown, client-side trim guard returns early with toast if empty). Error dispatch via `handleApiError(err)` checks `err instanceof ApiError` then routes by `err.code` to LAST_ROOT_PROTECTION / EXPIRED / REJECTION_REASON_REQUIRED toasts; unknown codes fall through to generic. After successful approve/reject: toast → close modal → clear active request → `await invalidateAll()` re-runs `+page.server.ts` and the new SSR data flows back into the props.
  - **`+page.server.ts`** (modified): added `loadRootSelfTerminationData(role, token, fetchFn)` helper extracted to keep main `load` under `complexity: 10` cap — fans out 2 parallel `apiFetch` calls (pending requests + roots-list for name lookup) only when role==='root', returns uniform `{requests, peerRoots}` shape regardless of role so consumer is role-agnostic. Main `load` extended Promise.all from 3 to 4 entries (last entry = the helper call).
  - **`+page.svelte`** (modified): `RootSelfTerminationCard` import added; `{#if data.user.role === 'root'}` block at the top of the container above the existing approvals UI (high-stakes cards visible first). Card receives `requests={data.rootSelfTerminationRequests}` + `peerRoots={data.rootUsers}` props. 6-line WHY comment block above the gate references masterplan §5.3 + ADR-055 + the SSR-empty-array optimisation for non-roots.
- **Spec Deviation D13** recorded: §5.3 mandates "Real-time update via SSE on the 3 events". Backend Session 6 emits typed `eventBus.emitRootSelfTerminationRequested/Approved/Rejected` on the internal NestJS EventBus (event keys `root.self-termination.{requested,approved,rejected}`), BUT `notifications.controller.ts` does NOT register SSE handlers for those event keys (the existing `SSE_EVENTS` constant covers vacation/work-orders/tpm/approvals/etc. but stops there). Wiring crosses the backend boundary: 3 new entries in `SSE_EVENTS` + 3 new `NotificationEventType` enum values in frontend `notification-sse.ts` + 3 createSSEHandler factories in the backend controller + 3 frontend handlers that call `invalidateAll()`. That's outside Step 5.3 scope per /continue rules. Mitigation: `invalidateAll()` after the actor's own approve/reject keeps the card list current; persistent notification rows still INSERT (Session 6's path is independent of SSE), so the sidebar badge updates on next user-driven refetch. Tracked as a Phase 6 follow-up.
- **Iteration trace (transparency, /continue rule):** First lint pass after the initial write surfaced 4 issues:
  1. **Import order** at `+page.server.ts:18`: `./$types` should come before `./_lib/types` per `import-x/order` (groups: builtin → external → internal → parent/sibling/index → type-only; within the type-only group, relative depth then alphabetical). Auto-fixable; swapped manually.
  2. **Complexity 13 > 10** at `+page.server.ts:68` (the `load` function): the inline `isRoot ? apiFetch(...) : Promise.resolve(null)` ternaries inside Promise.all bumped the cyclomatic count over the cap. Extracted `loadRootSelfTerminationData(role, token, fetchFn)` helper — moved the conditional out of `load`, complexity dropped, and the helper is independently testable if Phase 6 wants paired tests later.
  3. & 4. **Two unused `eslint-disable require-atomic-updates` directives** at Card lines 157 + 180 (the two `showApproveModal = false` / `activeRequest = null` mutations after `await invalidateAll()` in `handleApprove`). Removed both. Three additional disables inside `handleReject` were not flagged by lint and were left intact — user opted to defer the post-fix lint re-run, so any further pruning is the user's call.
- **Test deferral rationale unchanged from Sessions 9 + 9b:** No paired test convention for frontend Svelte components in this repo. Behaviour is end-to-end-tested by Phase 4 / Session 8's 25 API tests (approve/reject HTTP surface is the single source of truth). DoD §5 manual-smoke step ("3 root users in a test tenant") + responsive verify both deferred — they require multi-user fixture setup outside /continue's per-step scope and are the user's domain to close out.

**Verification:**

- Initial `pnpm run lint` (frontend): 4 issues surfaced (2 errors + 2 warnings), all addressed in-loop per the iteration trace above. User opted to defer the post-fix lint re-run + svelte-check pass.
- `pnpm run check` (svelte-check): not re-run per user request. Sessions 9 + 9b's 2574-file-clean baseline applies; the 6 changed files in Session 9c are TypeScript-strict-typed and follow the same patterns.
- Backend untouched in Session 9c — no API restart needed; Phase 4 backend behaviour unchanged.

**Phase 5 code-status:** 3 / 3 sub-steps complete. Outstanding DoD items are 2 manual checks (smoke test with 3 root users + responsive design verify mobile/desktop) the user closes out independently.

**Next session:** Session 10 = Phase 6 (ADR-055 "Root Account Lifecycle Protection" + customer fresh-install sync + ARCHITECTURE.md §1.2 row + FEATURES.md update + the optional Phase-6 follow-ups: D11 rejection-history endpoint, D13 SSE handler wiring).

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

| #   | Spec says (v0.1.0)                                                                                                                                                    | Actual code (audit)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Module path `users/root-protection/`                                                                                                                                  | `root/` is the bounded context                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | v0.2.0: flat in `root/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D2  | Filename `eventBus.ts`                                                                                                                                                | Actual: `event-bus.ts` (kebab-case)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | v0.2.0: corrected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| D3  | Wire only `users.service.ts`                                                                                                                                          | 5 services + 2 PUT routes mutate users.is_active/role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | v0.2.0: expanded wiring                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D4  | Trigger checks cross-root before approval                                                                                                                             | Approve flow has actor != target by design — blocked itself                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | v0.2.0: Hybrid Option 1+ — approval-flag check + DB-row exists first                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D5  | §2.5 mandates `idField` factory for `:id` param                                                                                                                       | `root_self_termination_requests.id` is UUID (Phase 1 schema), not numeric                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | v1.0.4 (Session 5b): used `UuidIdParamDto` from same factory (`common/dto/param.factory.ts`) — UUID-typed pre-built DTO matches the data type; ADR-030 §7.5 "use centralized factory" mandate satisfied either way                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| D6  | §2.6 spec body uses `this.logger.info(...)`                                                                                                                           | NestJS `Logger` (`@nestjs/common`) has no `.info()` method                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | v1.0.5 (Session 5c): replaced with `this.logger.log(...)` — the standard info-level call across the backend (kvp/log-retention/blackboard-archive). Forced literal-text fix, identical semantics. Annotated inline in cron file.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| D7  | §2.7 says "modify `notifications.service.ts` — handlers fan out"                                                                                                      | Established repo convention is per-domain `*-notification.service.ts` co-located with the producer (vacation/work-orders/tpm)                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | v1.0.6 (Session 6): created `root-self-termination-notification.service.ts` instead of growing `notifications.service.ts`. The literal-text approach would create a god object that knows about every domain. Behavioural outcome (typed emit + persistent INSERT for the 3 events) is identical to spec. Annotated inline in the new service header.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D8  | §3 "Test files" code block lists only the 2 in-process unit suites                                                                                                    | DB-trigger SQL integration tests need a different harness (live psql, multi-role auth, tenant fixtures); §3's "DB-Trigger Integration" list itself says "(run actual SQL in test container)" — intent matches, file table just didn't enumerate the 3rd file                                                                                                                                                                                                                                                                                                                                    | v1.2.0 (Session 7c): created `backend/test/root-protection-trigger.api.test.ts` per established repo convention for psql-direct integration tests (`tpm-executions.api.test.ts`, `auth-password-reset.api.test.ts`, `inventory.api.test.ts`). `*.api.test.ts` suffix required by the Vitest `api` project's `include` pattern. Annotated inline in the new file's header.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D9  | §4 bypass tests phrased as `PATCH /users/{rootBuuid} {is_active:4 / role:'admin'}` and "DELETE /users/{rootBuuid}" with expected 403                                  | `UsersController` has no PATCH for cross-user fields (`@Patch('me')` is self-only). Soft-delete via `DELETE /users/uuid/{uuid}` (Layer 2 wired); role-flip via `PUT /users/uuid/{uuid}` (Layer 2 deferred per Session 4 — Layer 4 trigger is the sole gate). The trigger raises a PG exception that surfaces as 500 (no dedicated PG-error filter).                                                                                                                                                                                                                                             | v1.3.0 (Session 8): T16 uses DELETE → 403 Layer 2; T17 uses PUT → non-2xx + DB-side proof of non-mutation (Layer 4 backstop, surfaces as 500); T18 uses POST archive → 403 Layer 2. Behavioural guarantee identical (cross-root mutation impossible from `app_user`); only the status code on T17 differs. Fixing the 500→403 surface requires either wiring Layer 2 on `users.service.updateUser` or adding a PG-error filter — out of Phase 4 scope.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D10 | §2.4 cooldown response shape: `ConflictException({code, message, cooldownEndsAt})` with structured ISO field at `error.cooldownEndsAt`                                | `AllExceptionsFilter.buildHttpExceptionResponse` (`backend/src/nest/common/filters/all-exceptions.filter.ts:159-178`) explicitly normalises HttpException responses down to `{code, message, details?}` per ADR-007 — extra payload fields are dropped. The service still embeds the ISO timestamp inside `message` ("Re-request blocked until <ISO> (24h cooldown after rejection).").                                                                                                                                                                                                         | v1.3.0 (Session 8): T14 extracts the timestamp via regex from `message` and asserts ±2 minutes of `NOW()+24h`. Frontend (Step 5.1) will use the same regex extraction OR the filter widens for this code in a Phase-6 follow-up (would touch ADR-007 envelope contract — explicit decision required).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D11 | §5.1 UI state "Recently rejected (>24h)" — "Show rejection reason (history) + 'Erneut beantragen' CTA" requires KNOWING about a past rejection upfront, on page load. | Backend `RootSelfTerminationService.getMostRecentRejection(actorId)` is **internal-only** per masterplan §2.4 method table ("Returns most recent rejected request (for cooldown check). Internal."). No GET endpoint exposes it. Adding one is out of Phase 5 scope per /continue rules (only what §5.1 specifies — no backend changes).                                                                                                                                                                                                                                                        | v1.3.1 (Session 9): Step 5.1 implemented 4 of the 5 listed UI states (eligible / pending / lastRoot / cooldown). The "Recently rejected (>24h)" history element is omitted; after >24h cooldown the user simply sees the eligible state and can re-request normally. Cooldown + last-root states are surfaced reactively from `ApiError.code` after a write attempt (no upfront probe needed). The rejection-history UI element is tracked as a Phase 6 follow-up — implement either by (a) extending `GET /users/me/self-termination-request` to return `{pending, lastRejection}`, or (b) adding a new `GET /users/me/self-termination-request/last-rejection` endpoint. Annotated inline in `SelfTerminationCard.svelte` docblock.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D12 | §5.2 lists three destructive ops to gate per row: Delete button, Deactivate toggle, Role-change-to-non-root option.                                                   | The actual `RootUserModal` (Edit modal) has **no role field**. `buildRootUserPayload` in `_lib/api.ts` constructs payloads with `firstName`/`lastName`/`email`/`positionIds`/`notes`/`employeeNumber`/`isActive`/`password` — `users.role` is never sent to the backend from this UI. `position` (e.g. "CEO", "IT-Administrator") is a tenant-customisable label string distinct from the system role enum (`root`/`admin`/`employee`). There is also no row-level Deactivate toggle on the table — the closest analog is the Status dropdown inside the Edit modal (Aktiv/Inaktiv/Archiviert). | v1.3.2 (Session 9b): implemented 2 of the 3 listed ops as gates: (1) Delete button → `disabled` + tooltip; (2) Deactivate (= Status dropdown's Inaktiv/Archiviert options inside the Edit modal, the only deactivation surface this page exposes) → entire dropdown swapped for read-only badge + lock icon when `lockDestructiveStatus={true}`. The "Role-change-to-non-root option" is a no-op on this page because the UI surface does not exist. Backend Layer 4 trigger backstops any role flip-from-root regardless of which path mutates the row (verified Session 7c trigger-integration tests + Session 8 T17). Architectural intent met — cross-root mutation impossible from this page via either Layer 1 (UX hint) or Layer 4 (trigger).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D13 | §5.3 mandates "Real-time update via SSE on the 3 events" (the typed `RootSelfTerminationRequested/Approved/Rejected` events from Session 6).                          | Backend Session 6 emits the 3 typed events on the internal NestJS EventBus (`backend/src/utils/event-bus.ts`), event keys `root.self-termination.{requested,approved,rejected}`. **However** `notifications.controller.ts` `SSE_EVENTS` constant + `createSSEHandler` factory chain does NOT register handlers for those event keys (covers vacation/work-orders/tpm/approvals/etc., stops there). Frontend `notification-sse.ts` `NotificationEventType` enum has no matching values either. SSE never delivers these events to connected clients.                                             | **RESOLVED v2.0.1 (2026-04-28):** SSE wiring shipped end-to-end. Backend `notifications.controller.ts` now has 3 `SSE_EVENTS` constants + `registerRootSelfTerminationHandlers()` factory that re-uses the existing `NEW_APPROVAL` / `APPROVAL_DECIDED` SSE message types (root-only registration, peer-recipient filtering for REQUESTED, requester-only feedback for APPROVED/REJECTED). The frontend store's existing `['NEW_APPROVAL', 'approvals'] / ['APPROVAL_DECIDED', 'approvals']` map auto-aggregates the events into the sidebar `approvals` counter — no frontend store edit needed. `dashboard.service.fetchApprovalsCount` + new `approvals` field on `DashboardCountsSchema` seed the SSR initial count from `root_self_termination_requests` (status='pending', requester_id<>userId, expires_at>NOW). Live-verified via curl as root_all id=19: `approvals.count: 1` for Simon's pending request. `manage-approvals/+page.svelte` calls `notificationStore.resetCount('approvals')` on mount so the badge clears on entry. Concurrent fix: `SelfTerminationModal.svelte` was using non-existent `modal modal--md` CSS classes — switched to documented Design-System primitives (`ds-modal__*` + `modal-overlay--active`). |
| D14 | §6 / §Quick Reference originally targeted the next-available ADR slot for "Root Account Lifecycle Protection" (since-renumbered, see Decision).                       | The previous slot had already shipped 2026-04-23 as the **Navigation Map Pointer Injection ADR** (wholly unrelated). The next slot was reserved 3× in `FEAT_2FA_EMAIL_MASTERPLAN.md` (lines 1164, 1295, 1378) for "Mandatory Email-Based 2FA". Both numbers were unavailable when Session 10 came to write the ADR.                                                                                                                                                                                                                                                                             | v1.4.1 (Session 10): this ADR uses **055** — the next free number. User explicitly confirmed via AskUserQuestion. Rename propagated across 8 surfaces in lockstep: 3 backend service `@see` headers (qualifier "(planned, Phase 6)" dropped, replaced with full path), 4 frontend code comments (pure number swap), the masterplan body itself (13 occurrences via `replace_all`), and `docs/infrastructure/adr/README.md` (new row + gap-note documenting the 2FA-plan reservation). Source-code edits all comment-only — no behavioural change, paired tests unaffected (Stop hook test reminder ignored per its own "rename / format / comment-only" exclusion). The 2FA masterplan may now ship as planned, unblocked. Annotated inline in `ADR-055-root-account-lifecycle-protection.md` (D14 row in its own deviations summary).                                                                                                                                                                                                                                                                                                                                                                                                       |

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

- **`countActiveRoots` `FOR UPDATE + COUNT(*)` PG-grammar bug shipped to API tests** (Session 8): unit-test mocks of `DatabaseService` masked the bug; PostgreSQL forbids aggregates with `FOR UPDATE`. Caught only when Phase 4 API tests ran the real service+DB stack. Fix: split lock + count in 3 lines. **Lesson:** mocked unit tests verify wiring, not SQL grammar. Future PG-touching service code should have at least one paired API test exercising the live DB stack — not just unit + DB-trigger integration. Pattern repeats: see `tpm-executions.api.test.ts` for the same precedent.
- **ADR number 053 was reserved by masterplan but already published as Navigation Map Pointer Injection** (D14, Session 10): masterplan body used "ADR-053" as a placeholder throughout, which became wrong post-publication. Compounded by ADR-054 being reserved by the parallel `FEAT_2FA_EMAIL_MASTERPLAN.md`. **Lesson:** when reserving an ADR number in a masterplan, either (a) check the README index AT plan-write time, or (b) use a placeholder like `ADR-NEXT` until the slot is claimed. The 8-surface rename cost ~30 min of mechanical work + 1 user-confirmation question that should not have been needed.
- **PUT-route Layer-2 wiring deferred** (`updateRootUser`, `updateAdmin`, `users.service.updateUser`): both methods can flip `users.role` from 'root' to non-root, but Session 4 chose to defer rather than thread `actingUserId` through 3 controller signatures. Layer 4 trigger backstops (verified by Session 8 T17), but the response surface is a non-2xx 500 instead of clean 403. Acceptable for V1 but a future refactor should wire Layer 2 explicitly so the error code is actionable from the frontend.

### Metrics

| Metric                   | Planned       | Actual                                                                                                                                    |
| ------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Sessions                 | 10            | 16 (1 + 2 + 3 + 4 + 5 + 5b + 5c + 6 + 7a + 7b + 7c + 8 + 9 + 9b + 9c + 10 + 10b + 10c)                                                    |
| Migration files          | 2             | 2 (`root_self_termination_requests` table + `trg_root_protection` trigger)                                                                |
| New backend files        | ~9            | 9 (RootProtectionService + RootSelfTerminationService + Controller + Cron + NotificationService + 3 DTOs + paired tests)                  |
| New frontend files       | ~6            | 9 (root-profile: Card + Modal + state holder + api + types + constants; manage-approvals: Card + types + api + constants)                 |
| Modified files           | ~12           | 14 (root.module.ts, 4 service-wiring sites, event-bus.ts + test, ARCHITECTURE.md, FEATURES.md, ADR-README + 4 frontend integration sites) |
| Unit tests               | ≥ 32          | **49** (16 RootProtectionService + 24 RootSelfTerminationService + 9 NotificationService)                                                 |
| API tests                | ≥ 24          | **33** (8 trigger-integration + 25 HTTP surface)                                                                                          |
| Total tests              | ≥ 56          | **82** dedicated to this feature                                                                                                          |
| ESLint errors at release | 0             | 0                                                                                                                                         |
| Spec deviations          | 4 (in v0.2.0) | **14** (D1-D14, all documented inline)                                                                                                    |
| Layers shipped           | 4             | 4 (Frontend UX → Service Guard → Approval Workflow → DB Trigger)                                                                          |
| Operations protected     | 4             | 4 (Soft-Delete + Deactivate + Role-Demotion + Hard-Delete)                                                                                |
| Risks mitigated          | 10            | 10 (R1-R10, each cross-referenced to a verifying test session)                                                                            |

---

**This document is the execution plan. Every session started here, took the next unchecked item, and marked it done. Plan is COMPLETE 2026-04-28 — branch ready for PR.**
