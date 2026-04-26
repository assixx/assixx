# FEAT: Root Account Protection — Execution Masterplan

> **Plan type:** FEATURE
> **Created:** 2026-04-26
> **Version:** 1.0.1 (Phase 2 in progress — Session 3 done)
> **Status:** Phase 1 COMPLETE 2026-04-26 — Phase 2 Session 3/4 done, Sessions 4-6 pending
> **Branch:** `feat/root-account-protection`
> **Spec:** Inline — see §Goal below
> **Author:** Simon Öztürk
> **Estimated sessions:** 10
> **Actual sessions:** 3 / 10 (Phase 0 audit + Phase 1 migrations + Phase 2 RootProtectionService done)

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

| Version | Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-04-26 | Initial draft — phases outlined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 0.2.0   | 2026-04-26 | Post-audit revision: Trigger logic fixed (Option 1+ Hybrid — DB-row existence check), module placement → `root/` flat (matches existing pattern), Layer-2 wiring expanded to 5 services + 2 PUT routes, 24h re-request cooldown, naming consolidated, eventBus → event-bus, §0.5 audit table filled                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 1.0.0   | 2026-04-26 | Phase 1 COMPLETE -- migrations applied (table + RLS + 5 indexes; trigger + 4 smokes pass; customer fresh-install synced; backend tsc clean)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 1.0.1   | 2026-04-26 | Session 3 done -- `RootProtectionService` implemented (5 methods per §2.2), registered + exported in `RootModule`, §0.5 spot-check rows for `root-deletion.service.ts` and audit infra resolved, lint+type-check clean, tests deferred to Session 7 per Phase 3 schedule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 1.0.2   | 2026-04-26 | Session 4 done -- Step 2.3 wiring across 4 termination sites + 1 defensive role-block: `root.service.ts:deleteRootUser` (full chain replaces inline self-delete + last-root SQL), `root-admin.service.ts:deleteAdmin` (defensive), `users.service.ts:deleteUser` (full chain), `users.service.ts:archiveUser` (defensive role-block — root accounts cannot be archived via the generic users path), `dummy-users.service.ts:delete` (defensive). `unarchiveUser` NOT wired (verified: sets is_active=1, not 0). PUT-route role-demote wiring on `updateRootUser`/`updateAdmin` deferred — Layer 4 trigger backstop. RootModule exported into UsersModule + DummyUsersModule. 4 paired test suites updated; 105 unit tests green. Lint 0 errors, tsc 0 errors. |
| 1.1.0   | TBD        | Phase 2 COMPLETE — backend done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 1.2.0   | TBD        | Phase 3 COMPLETE — unit tests green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 1.3.0   | TBD        | Phase 4 COMPLETE — API integration tests green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 1.4.0   | TBD        | Phase 5 COMPLETE — frontend done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2.0.0   | TBD        | All phases COMPLETE — shipped + ADR-053 accepted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

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

### Step 2.1: Module skeleton + types + DTOs [PARTIAL — `RootProtectionService` registered 2026-04-26]

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
- [ ] `RootSelfTerminationService` added to providers + exports
- [ ] `RootSelfTerminationController` added to controllers
- [ ] `RootSelfTerminationCron` added to providers (with `ScheduleModule` import)

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

### Step 2.4: `RootSelfTerminationService` [PENDING]

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

### Step 2.5: Controller [PENDING]

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

### Step 2.6: Cron job for expiry [PENDING]

**File:** `backend/src/nest/root/root-self-termination.cron.ts`

```typescript
@Cron('0 3 * * *')  // daily 03:00
async expirePendingRequests(): Promise<void> {
    const expired = await this.service.expireOldRequests();
    this.logger.info(`Expired ${expired} root self-termination requests`);
}
```

Uses `systemQuery()` (sys_user, BYPASSRLS) — cross-tenant cleanup.

### Step 2.7: Notifications + EventBus integration [PENDING]

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

- [ ] `RootProtectionService` + `RootSelfTerminationService` registered in `RootModule`
- [ ] All 5 user-mutating services + 2 PUT routes wired with `assertCrossRootTerminationForbidden` + `assertNotLastRoot`
- [ ] All 6 endpoints exposed under `/api/v2/users/...`
- [ ] Cron job registered and tested manually
- [ ] EventBus emits 3 typed events; notifications fan out
- [ ] Audit-trail entries written for every state transition + every denied attempt
- [ ] 24h rejection cooldown enforced in `requestSelfTermination`
- [ ] All DTOs use Zod + `createZodDto()`
- [ ] `db.tenantTransaction()` for all queries; `systemQuery()` only in cron
- [ ] No `||` for defaults, no `any`, explicit boolean checks (CODE-OF-CONDUCT)
- [ ] ESLint 0 errors: `docker exec assixx-backend pnpm exec eslint backend/src/nest/root/`
- [ ] Type-check passes: `docker exec assixx-backend pnpm run type-check`

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

**Cross-Root Guard:**

- [ ] Root A → terminate Root B (Soft-Delete) → ForbiddenException + audit entry
- [ ] Root A → terminate Root B (Deactivate is_active=0) → Forbidden
- [ ] Root A → terminate Root B (Demote role='admin') → Forbidden
- [ ] Root A → terminate Root B (Hard-Delete, if route exists) → Forbidden
- [ ] Root A → terminate Admin → allowed
- [ ] Root A → terminate Employee → allowed
- [ ] Admin (full-access) → terminate Root → Forbidden (admin cannot touch roots)
- [ ] Employee → terminate Root → Forbidden (already blocked by `@Roles`, but defense-in-depth test)

**Last-Root Guard:**

- [ ] Tenant with 1 active root → assertNotLastRoot(tenantId, that-root.id) → PreconditionFailedException
- [ ] Tenant with 2 active roots → assertNotLastRoot(tenantId, root-A.id) → ok (B remains)
- [ ] Tenant with 1 active + 1 archived root (is_active=3) → only the active counts → fail

**Self-Termination Lifecycle:**

- [ ] Request happy-path: status='pending', expires in 7d, notification fan-out
- [ ] Request when already pending → ConflictException (DB unique index + service check)
- [ ] **Request within 24h after rejection → ConflictException (cooldown)**
- [ ] Request 24h+1min after rejection → succeeds
- [ ] Request as last root (only 1 in tenant) → PreconditionFailedException
- [ ] Request as admin → ForbiddenException (controller guards already block, but service double-checks)
- [ ] Cancel own pending → status='cancelled', no users-table touch
- [ ] Cancel non-existent / not-pending → NotFoundException
- [ ] Approve own request → ForbiddenException (DB chk_no_self_approval + service check)
- [ ] Approve non-existent → NotFoundException
- [ ] Approve already-approved/rejected/expired/cancelled → ConflictException
- [ ] Approve when expired (NOW > expires_at) → ConflictException
- [ ] Approve happy-path: requester.is_active=4, request.status='approved', GUC clean after TX
- [ ] Reject happy-path: status='rejected', rejected_by=actor, requester still is_active=1
- [ ] Reject without reason → ValidationException
- [ ] Reject non-existent → NotFoundException
- [ ] Reject own request → ForbiddenException
- [ ] expireOldRequests cron sets status='expired' for pending past expires_at; leaves non-pending alone

**Race / Concurrency:**

- [ ] Parallel approve from 2 roots → exactly one succeeds, other gets ConflictException (FOR UPDATE)
- [ ] Approve TX rollback (simulate by throwing inside TX) → requester remains active, GUC not leaked, request status reverts

**DB-Trigger Integration (run actual SQL in test container):**

- [ ] Direct UPDATE users SET is_active=4 WHERE root as app_user → ROOT_CROSS_TERMINATION_FORBIDDEN
- [ ] Direct UPDATE as app_user with self-target without GUC → ROOT_SELF_TERMINATION_REQUIRES_APPROVAL
- [ ] Direct UPDATE as app_user with self-target + GUC=true but NO approved DB row → ROOT_NO_APPROVED_REQUEST
- [ ] Direct UPDATE as app_user with self-target + GUC=true + valid approved row → succeeds
- [ ] Approved row older than 5min + GUC=true → ROOT_NO_APPROVED_REQUEST (window expired)
- [ ] Direct UPDATE as assixx_user → bypasses trigger
- [ ] Direct UPDATE as sys_user → bypasses trigger
- [ ] Last-root: tenant with 1 root, GUC=true, valid approved row, attempt self-termination → ROOT_LAST_ROOT_PROTECTION

### Phase 3 — Definition of Done

- [ ] ≥ 32 unit tests total (was 30 in v0.1.0; +2 for cooldown + +2 for new trigger paths)
- [ ] All tests green: `docker exec assixx-backend pnpm exec vitest run backend/src/nest/root/`
- [ ] All exception codes covered by ≥ 1 test
- [ ] Race / FOR UPDATE test covered
- [ ] DB-trigger tests covered (real SQL inside vitest)
- [ ] Audit-trail row written for every guarded denial — verified
- [ ] Coverage: every public method has ≥ 1 happy-path + ≥ 1 failure-path test

---

## Phase 4: API Integration Tests

> **Dependency:** Phase 3 complete.
> **Pattern:** `backend/test/*.api.test.ts` ([HOW-TO-TEST.md](./how-to/HOW-TO-TEST.md))

### Test file

`backend/test/root-self-termination.api.test.ts`

### Scenarios (≥ 24 assertions — was 22 in v0.1.0, +2 for cooldown)

**Auth:**

- [ ] Unauthenticated POST /users/me/self-termination-request → 401
- [ ] Admin POST → 403 (Roles guard)
- [ ] Employee POST → 403

**CRUD:**

- [ ] Root POST request → 201 + JSON body with requestId, expires_at
- [ ] Root POST while pending → 409
- [ ] **Root POST within 24h of rejection → 409 with cooldownEndsAt**
- [ ] Root GET own pending → 200
- [ ] Root DELETE own pending → 204
- [ ] Root GET pending list (other roots' requests) → 200
- [ ] Root POST approve → 200 + requester.is_active=4 visible afterwards
- [ ] Root POST reject (with reason) → 200
- [ ] Root POST reject (without reason) → 400
- [ ] Root POST approve own request via direct ID → 403 (no self-approval)

**Direct API Bypass tests (raw fetch — Layer 4 trigger should still block):**

- [ ] Root A → PATCH /users/{rootBuuid} {is_active:4} as raw HTTP → 403 (Layer 2)
- [ ] Root A → PATCH /users/{rootBuuid} {role:'admin'} → 403
- [ ] Root A → DELETE /users/{rootBuuid} (if route exists) → 403

**Last-root:**

- [ ] Tenant with 1 root → POST self-termination-request → 412 LAST_ROOT_PROTECTION

**Tenant isolation (RLS):**

- [ ] Root in tenant A → GET pending list → only sees tenant A requests
- [ ] Root in tenant A → POST approve {id of tenant B's request} → 404 (RLS hides it)

**Notifications:**

- [ ] After POST request, all OTHER roots in tenant have a new notification row
- [ ] After POST approve, requester has a notification of "approved"
- [ ] After POST reject, requester has a notification of "rejected" with reason

### Phase 4 — Definition of Done

- [ ] ≥ 24 API integration tests
- [ ] All tests green
- [ ] Tenant isolation verified
- [ ] Direct-API bypass blocked (Layer 2 + Layer 4)
- [ ] Notification fan-out verified
- [ ] Cooldown enforced

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
| 5       | 2     | RootSelfTerminationService + controller + cron + cooldown                                                   |        |            |
| 6       | 2     | Notifications + EventBus integration                                                                        |        |            |
| 7       | 3     | Unit tests (≥32) — service + DB-trigger SQL tests                                                           |        |            |
| 8       | 4     | API integration tests (≥24)                                                                                 |        |            |
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

---

## Quick Reference: File Paths

### Backend (new — all flat in `root/`)

| File                                                          | Purpose                            |
| ------------------------------------------------------------- | ---------------------------------- |
| `backend/src/nest/root/root-protection.service.ts`            | Cross-root + last-root guard logic |
| `backend/src/nest/root/root-self-termination.service.ts`      | Request lifecycle + cooldown       |
| `backend/src/nest/root/root-self-termination.controller.ts`   | 6 REST endpoints                   |
| `backend/src/nest/root/root-self-termination.cron.ts`         | Daily expiry job                   |
| `backend/src/nest/root/dto/request-self-termination.dto.ts`   | Zod DTO                            |
| `backend/src/nest/root/dto/approve-self-termination.dto.ts`   | Zod DTO                            |
| `backend/src/nest/root/dto/reject-self-termination.dto.ts`    | Zod DTO (required reason)          |
| `backend/src/nest/root/root-protection.service.test.ts`       | ~12 tests                          |
| `backend/src/nest/root/root-self-termination.service.test.ts` | ~24 tests                          |

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

| File                                             | Purpose        |
| ------------------------------------------------ | -------------- |
| `backend/test/root-self-termination.api.test.ts` | ≥ 24 API tests |

---

## Spec Deviations

| #   | Spec says (v0.1.0)                        | Actual code (audit)                                         | Decision                                                             |
| --- | ----------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| D1  | Module path `users/root-protection/`      | `root/` is the bounded context                              | v0.2.0: flat in `root/`                                              |
| D2  | Filename `eventBus.ts`                    | Actual: `event-bus.ts` (kebab-case)                         | v0.2.0: corrected                                                    |
| D3  | Wire only `users.service.ts`              | 5 services + 2 PUT routes mutate users.is_active/role       | v0.2.0: expanded wiring                                              |
| D4  | Trigger checks cross-root before approval | Approve flow has actor != target by design — blocked itself | v0.2.0: Hybrid Option 1+ — approval-flag check + DB-row exists first |

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
