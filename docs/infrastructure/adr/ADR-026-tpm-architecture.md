# ADR-026: TPM (Total Productive Maintenance) Architecture

| Metadata                | Value                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                                                        |
| **Date**                | 2026-02-19                                                                                                                      |
| **Decision Makers**     | SCS-Technik Team                                                                                                                |
| **Affected Components** | PostgreSQL (4 migrations, 9 tables), Backend (NestJS TPM module, 30 files), Frontend (SvelteKit, 15+ files)                     |
| **Supersedes**          | ---                                                                                                                             |
| **Related ADRs**        | ADR-003 (SSE), ADR-004 (Notifications), ADR-009 (Audit Logging), ADR-019 (RLS), ADR-020 (Permissions), ADR-024 (Feature Guards) |

---

## Context

Assixx serves industrial companies where **preventive maintenance** is critical for production uptime. Before TPM, maintenance was tracked via paper Kamishibai boards:

| Problem                            | Impact                                                  |
| ---------------------------------- | ------------------------------------------------------- |
| Paper cards get lost/damaged       | Missed maintenance windows, unplanned downtime          |
| No escalation mechanism            | Overdue maintenance not visible to management           |
| Manual status tracking             | Team leads can't see completion status across machines  |
| No approval workflow               | Critical maintenance executed without verification      |
| No integration with shift planning | Shift planners unaware of scheduled maintenance windows |

### Requirements

- **Interval Cascade**: Generate recurring maintenance cards from plan definitions (daily to annual + custom)
- **Kamishibai Board**: Visual card board (green/yellow/red/overdue) per machine per interval
- **Execution + Approval Workflow**: Employee executes card → optional team lead approval → card resets
- **Slot Availability Assistant**: Suggest optimal maintenance time slots based on shift data + machine availability + user availability
- **Real-time Notifications**: SSE events for due cards, overdue escalation, approval results
- **Shift Grid Integration**: Show TPM maintenance dates as overlay in the shift planning grid
- **Machine History Bridge**: Approved executions create entries in `machine_maintenance_history`
- **Multi-tenant isolation**: Full RLS, tenant_id on all tables, per-user permissions (ADR-020)

---

## Decision

### 1. Interval Cascade Design

**Problem:** Plans define intervals (weekly, monthly, quarterly, etc.), but the system needs individual cards with specific due dates.

**Solution:** Calendar-based interval calculation using `baseWeekday` + `baseRepeatEvery` + `createdAt` reference point.

```
Plan (interval_type = 'weekly', baseWeekday = 1, baseRepeatEvery = 2)
  → Card due every 2nd Monday
  → isMaintenanceDate(date) = date.getDay() === jsWeekday && weeksDiff % repeatEvery === 0
```

**Why not database-scheduled jobs?**

- Simpler: Pure calculation from plan properties, no additional state to manage
- Deterministic: Same input always produces same output (testable)
- No drift: Calendar-based, not timer-based (no accumulated scheduling errors)
- Frontend can independently calculate dates (shift grid overlay)

**Interval Types:** `daily | weekly | monthly | quarterly | semi_annual | annual | long_runner | custom`

### 2. Card Status Machine

Four-state machine with clear transition rules:

```
  [green] ──due date passed──→ [red]
     ↑                           │
     │                      employee executes
  approved                       │
     │                           ↓
  [green] ←── approved ── [yellow] ←── requires_approval=true
     ↑                           │
     │                       rejected
     │                           │
     └────── no approval ────────┘    (requires_approval=false → direct green)

  [red] ──escalation_after_hours──→ [overdue]
```

| Status    | Meaning                                | Trigger                      |
| --------- | -------------------------------------- | ---------------------------- |
| `green`   | Completed within interval              | Approved or no-approval card |
| `red`     | Due date passed, not yet executed      | Cron or cascade creates card |
| `yellow`  | Executed, awaiting team lead approval  | Employee marks card as done  |
| `overdue` | Red card exceeded escalation threshold | Cron (every 5 min)           |

**Why 4 states instead of 3?**

- `overdue` separates "due but not critical" from "escalation required"
- Enables escalation notifications to team leads without alerting for every red card
- Configurable threshold per tenant (`tpm_escalation_config.escalation_after_hours`)

### 3. Slot Availability Assistant

**Problem:** Finding optimal maintenance windows requires cross-referencing 4 data sources.

**Solution:** Self-contained service with direct DB queries (no cross-module imports):

```
SlotAssistant(machineId, startDate, endDate)
  ├── Query 1: Shift plan data (who's working when?)
  ├── Query 2: Machine availability (when is machine free?)
  ├── Query 3: User availability (who's available?)
  └── Query 4: Existing TPM cards (what's already scheduled?)
  → Merge & score → Return ranked available slots
```

**Why direct DB queries instead of service imports?**

- TpmModule stays self-contained (no dependency on Shifts/Machines/Users modules)
- Avoids circular dependency risk
- Single transaction context for consistent point-in-time data
- Documented as Deviation D11 in the masterplan

### 4. Module Architecture

The TPM module follows NestJS module boundaries with 30 files:

```
backend/src/nest/tpm/
├── tpm.module.ts                    # Module definition
├── tpm.types.ts                     # All types (Row + API + constants)
├── tpm.permissions.ts               # Permission definitions (4 modules)
├── tpm-permission.registrar.ts      # OnModuleInit registration
├── Controllers (4):
│   ├── tpm-plans.controller.ts      # 11 endpoints
│   ├── tpm-cards.controller.ts      # 6 endpoints
│   ├── tpm-executions.controller.ts # 6 endpoints
│   └── tpm-config.controller.ts     # 9 endpoints
├── Core Services (4):
│   ├── tpm-plans.service.ts         # Plan CRUD + interval management
│   ├── tpm-cards.service.ts         # Card CRUD + pagination
│   ├── tpm-executions.service.ts    # Execution lifecycle + photos
│   └── tpm-approval.service.ts      # Approve/reject + history bridge
├── Support Services (6):
│   ├── tpm-plans-interval.service.ts # Interval calculation
│   ├── tpm-card-status.service.ts    # Status transitions
│   ├── tpm-card-cascade.service.ts   # Generate cards from plans
│   ├── tpm-card-duplicate.service.ts # Duplicate detection
│   ├── tpm-slot-assistant.service.ts # Slot availability
│   └── tpm-escalation.service.ts     # Cron-based escalation
├── Integration Services (2):
│   ├── tpm-notification.service.ts   # SSE + persistent notifications
│   └── tpm-dashboard.service.ts      # Unread count for badge
├── Config Services (3):
│   ├── tpm-time-estimates.service.ts
│   ├── tpm-templates.service.ts
│   └── tpm-color-config.service.ts
├── DTOs (13 files)
├── Helpers (3 files)
└── Tests (6 files, 364 tests)
```

### 5. Integration Points

| Integration                      | Pattern                                  | Status   |
| -------------------------------- | ---------------------------------------- | -------- |
| SSE Notifications                | EventBus (ADR-003) + persistent DB       | Active   |
| Dashboard Badge                  | `/dashboard/counts` includes TPM count   | Active   |
| Audit Logging                    | ActivityLoggerService on all mutations   | Active   |
| Machine History Bridge           | Direct DB insert on approved execution   | Active   |
| Shift Grid TPM Overlay           | Frontend calculates dates from plan data | Active   |
| Permission System                | ADR-020 per-user feature permissions     | Active   |
| Feature Gating                   | ADR-024 tenant-level feature flag        | Active   |
| Machine Availability Auto-Status | Infrastructure ready (V2 wiring)         | Deferred |

### 6. Database Schema

4 migrations, 9 core tables:

```
tpm_plans                  — maintenance plan definitions
tpm_cards                  — individual maintenance cards (generated from plans)
tpm_card_executions        — execution records (employee marks card as done)
tpm_card_execution_photos  — photo attachments per execution (max 5)
tpm_card_templates         — reusable card templates (JSONB custom fields)
tpm_time_estimates         — estimated duration per interval type per plan
tpm_color_config           — per-tenant color customization
tpm_escalation_config      — per-tenant escalation threshold
tpm_notification_config    — notification preferences (reserved for V2)
```

All tables have: `tenant_id` (RLS), `is_active` (soft delete: 0/1/3/4), `created_at`, `updated_at`.

---

## Alternatives Considered

### A. External Scheduling Service (Rejected)

**Pros:** Battle-tested scheduling, no custom interval logic
**Cons:** Additional infrastructure, cross-service communication overhead, harder to test, overkill for calendar-based intervals

### B. Cross-Module Service Imports (Rejected)

**Pros:** Reuse existing machine/user/shift services
**Cons:** Circular dependency risk, tight coupling, harder to test in isolation, breaks module encapsulation

### C. CQRS/Event Sourcing for Card Status (Rejected)

**Pros:** Full audit trail of state transitions
**Cons:** Massive overengineering for 4-state machine. Activity logging provides sufficient audit trail. V2 consideration if state machine grows.

---

## Consequences

### Positive

- **Self-contained module**: 30 files, 0 cross-module service imports (only DatabaseService + ActivityLoggerService)
- **Comprehensive testing**: 364 tests (278 unit + 86 API) covering all services
- **Real-time updates**: SSE notifications for all lifecycle events
- **Configurable**: Per-tenant escalation threshold, colors, templates, time estimates
- **Shift planning integration**: TPM dates visible in shift grid via frontend calculation

### Negative

- **Frontend date calculation**: Duplicates backend interval logic (trade-off for no additional API calls)
- **No machine_availability auto-status in V1**: Infrastructure exists but wiring deferred to V2 (complex trigger timing)
- **Employee list filtering**: V1 shows all plans/cards to all TPM users within a tenant (no team-scoped filtering)

---

## References

- [TPM Masterplan](../../FEAT_TPM_MASTERPLAN.md) — Full execution plan with 29 sessions
- [ADR-003](./ADR-003-notification-system.md) — SSE notification pattern
- [ADR-004](./ADR-004-persistent-notification-counts.md) — Persistent notification counts
- [ADR-009](./ADR-009-central-audit-logging.md) — Central audit logging
- [ADR-019](./ADR-019-multi-tenant-rls-isolation.md) — Multi-tenant RLS isolation
- [ADR-020](./ADR-020-per-user-feature-permissions.md) — Per-user feature permissions
- [ADR-024](./ADR-024-frontend-feature-guards.md) — Frontend feature guards
