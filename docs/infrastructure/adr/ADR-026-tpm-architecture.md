# ADR-026: TPM (Total Productive Maintenance) Architecture

| Metadata                | Value                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted (Updated 2026-02-24)                                                                                                   |
| **Date**                | 2026-02-19                                                                                                                      |
| **Decision Makers**     | SCS-Technik Team                                                                                                                |
| **Affected Components** | PostgreSQL (5 migrations, 9 tables), Backend (NestJS TPM module, 35+ files), Frontend (SvelteKit, 25+ files)                    |
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
- **Execution History**: Per-card history page showing all past executions (documentation, photos, approval status)
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
  ├── Query 4: Existing TPM cards (what's already scheduled?)
  └── Query 5: Schedule Projection (cross-plan projected maintenance windows)
  → Merge & score → Return ranked available slots
```

**Data Source 5 — Schedule Projection (`tpm_schedule`):**

- Added in Schedule Projection feature (see Section 10)
- `TpmScheduleProjectionService.projectSchedules()` provides projected future maintenance dates for all active plans
- Conflict type `tpm_schedule` shows cross-plan time window conflicts (e.g. "TPM Plan X (Maschine A): 09:00–14:00")
- Distinct from `existing_tpm` (Query 4) which shows only fällige red/overdue cards

**Why direct DB queries instead of service imports?**

- TpmModule stays self-contained (no dependency on Shifts/Machines/Users modules)
- Avoids circular dependency risk
- Single transaction context for consistent point-in-time data
- Documented as Deviation D11 in the masterplan

### 4. Module Architecture

The TPM module follows NestJS module boundaries with 30+ files:

```
backend/src/nest/tpm/
├── tpm.module.ts                    # Module definition
├── tpm.types.ts                     # All types (Row + API + constants)
├── tpm.permissions.ts               # Permission definitions (4 modules)
├── tpm-permission.registrar.ts      # OnModuleInit registration
├── Controllers (4):
│   ├── tpm-plans.controller.ts      # 11 endpoints
│   ├── tpm-cards.controller.ts      # 7 endpoints (incl. execution history)
│   ├── tpm-executions.controller.ts # 6 endpoints
│   └── tpm-config.controller.ts     # 9 endpoints
├── Core Services (4):
│   ├── tpm-plans.service.ts         # Plan CRUD + interval management
│   ├── tpm-cards.service.ts         # Card CRUD + pagination
│   ├── tpm-executions.service.ts    # Execution lifecycle + photos + history
│   └── tpm-approval.service.ts      # Approve/reject + history bridge
├── Support Services (7):
│   ├── tpm-plans-interval.service.ts       # Interval calculation
│   ├── tpm-card-status.service.ts          # Status transitions
│   ├── tpm-card-cascade.service.ts         # Generate cards from plans
│   ├── tpm-card-duplicate.service.ts       # Duplicate detection
│   ├── tpm-slot-assistant.service.ts       # Slot availability (5 data sources)
│   ├── tpm-schedule-projection.service.ts  # Cross-plan schedule projection
│   └── tpm-escalation.service.ts           # Cron-based escalation
├── Integration Services (2):
│   ├── tpm-notification.service.ts   # SSE + persistent notifications
│   └── tpm-dashboard.service.ts      # Unread count for badge
├── Config Services (3):
│   ├── tpm-time-estimates.service.ts
│   ├── tpm-templates.service.ts
│   └── tpm-color-config.service.ts
├── DTOs (14 files)
├── Helpers (3 files)
└── Tests (7 files, 397 tests)
```

### 5. Integration Points

| Integration                      | Pattern                                   | Status   |
| -------------------------------- | ----------------------------------------- | -------- |
| SSE Notifications                | EventBus (ADR-003) + persistent DB        | Active   |
| Dashboard Badge                  | `/dashboard/counts` includes TPM count    | Active   |
| Audit Logging                    | ActivityLoggerService on all mutations    | Active   |
| Machine History Bridge           | Direct DB insert on approved execution    | Active   |
| Shift Grid TPM Overlay           | Frontend calculates dates from plan data  | Active   |
| Permission System                | ADR-020 per-user feature permissions      | Active   |
| Feature Gating                   | ADR-024 tenant-level feature flag         | Active   |
| Execution History                | SSR page per card with lazy photo loading | Active   |
| Photo Upload (Staged)            | Client-side staging → sequential upload   | Active   |
| Schedule Projection              | Cross-plan time window conflict detection | Active   |
| Machine Availability Auto-Status | Infrastructure ready (V2 wiring)          | Deferred |

### 6. Database Schema

5 migrations, 9 core tables:

```
tpm_plans                  — maintenance plan definitions (+buffer_hours NUMERIC(4,1) for time windows)
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

### 7. Employee Frontend (Kamishibai Board)

The employee-facing TPM UI is a SvelteKit 5 application with SSR data loading:

```
frontend/src/routes/(app)/(shared)/lean-management/tpm/
├── overview/+page.svelte            # Machine overview (assigned plans)
├── overview/+page.server.ts         # SSR: fetch plans + stats
├── board/[uuid]/                    # Kamishibai board per plan
│   ├── +page.server.ts              # SSR: cards + colors + plan info
│   ├── +page.svelte                 # Board layout with filter + card grid
│   └── _lib/
│       ├── BoardFilter.svelte       # Status/role/interval filter (client-state)
│       ├── KamishibaiCard.svelte    # 3D flip card (front: status color, back: info)
│       ├── CardDetail.svelte        # Slide-over panel (card info + actions)
│       ├── ExecutionForm.svelte     # Date → no-issues checkbox → duration/staff → docs → photos → submit
│       ├── ApprovalPanel.svelte     # Approve/reject execution
│       └── TimeEstimateForm.svelte  # Time estimate display
├── card/[uuid]/history/             # Per-card execution history
│   ├── +page.server.ts              # SSR: card info + execution list
│   └── +page.svelte                 # History table with expandable rows
└── _lib/
    ├── api.ts                       # API client functions (12 endpoints)
    ├── types.ts                     # Frontend TypeScript types
    └── constants.ts                 # UI labels + messages (German)
```

**Design Patterns:**

- **SSR Data Loading**: `+page.server.ts` fetches data server-side via `apiFetch<T>()` helper, passes to page via `PageData`
- **Client-State Filtering**: Board filter is purely client-side (no API calls on filter change)
- **Slide-Over Panel**: CardDetail renders as fixed overlay from right (`z-index: 2000`, `backdrop-filter: blur(8px)`)
- **3D Flip Cards**: CSS `transform-style: preserve-3d` with `rotateY(180deg)` on hover/tap
- **Runes**: All state management uses Svelte 5 runes (`$state`, `$derived`, `$props`, `$effect`)

### 8. Execution Workflow + History

**Execution Flow (Employee):**

```
CardDetail (red/overdue card)
  └── ExecutionForm
       1. Execution date (default: today, changeable for late documentation)
       2. "Ohne Beanstandung" checkbox (fast path for routine maintenance)
       3. Actual duration + staff count (IST vs SOLL comparison from time estimates)
       4. Documentation textarea (optional; required when issues found on approval cards)
       5. Photo staging (max 5, client-side preview via URL.createObjectURL)
       6. Submit button
          ├── POST /tpm/executions         → creates execution record
          ├── POST /tpm/executions/:uuid/photos  → uploads each staged photo (sequential)
          └── onExecutionCreated() → board refreshes via invalidateAll()
```

**Photo Handling:**

- Photos are collected client-side as `StagedPhoto[]` (File + blob preview URL)
- On submit: execution is created first, then photos uploaded sequentially (avoids server overload)
- Failed photo uploads show warning but don't roll back the execution
- `onDestroy` revokes all blob URLs to prevent memory leaks
- Max 5 photos per execution, max 5 MB per file, accepted types: JPEG, PNG, WebP

**Execution History Page** (`/lean-management/tpm/card/[uuid]/history`):

```
┌──────────────────────────────────────────┐
│ ← Zurück zum Board                       │
├──────────────────────────────────────────┤
│ Wartungsverlauf                          │
│ M-001 — Ölstand prüfen · Täglich        │
│ [Erledigt] 12 Durchführungen             │
├──────────────────────────────────────────┤
│ Datum      │ Person      │ Status │ Fotos│
│ 21.02.2026 │ W. Buffett  │ Keine  │ 2    │
│   ↳ expanded: documentation, photos,    │
│     approval details (lazy-loaded)       │
│ 14.02.2026 │ M. Muster   │ Freig. │ 0    │
└──────────────────────────────────────────┘
```

- **SSR**: Card info + execution list loaded server-side (parallel fetch)
- **Expandable Rows**: Click row → shows documentation, approval details
- **Lazy Photo Loading**: `fetchPhotos(executionUuid)` called on-demand when row expands, cached in `Partial<Record<string, TpmExecutionPhoto[]>>`
- **Photo Count**: Included in execution response via SQL subquery (`photo_count`), avoids extra API call for thumbnail counts
- **Full Name Display**: SQL uses `COALESCE(NULLIF(CONCAT(first_name, ' ', last_name), ' '), username)` pattern for `executed_by_name` and `approved_by_name`
- **Navigation**: Link from CardDetail panel → history page; back button returns to board

### 9. API Endpoints (Cards Controller)

The cards controller (`tpm-cards.controller.ts`) includes the execution history endpoint:

| Method | Path                          | Description                                |
| ------ | ----------------------------- | ------------------------------------------ |
| POST   | `/tpm/cards`                  | Create card                                |
| POST   | `/tpm/cards/check-duplicate`  | Duplicate check (before creation)          |
| GET    | `/tpm/cards`                  | List cards (filter by machine/plan/status) |
| GET    | `/tpm/cards/:uuid`            | Get single card                            |
| GET    | `/tpm/cards/:uuid/executions` | Execution history for card (paginated)     |
| PATCH  | `/tpm/cards/:uuid`            | Update card                                |
| DELETE | `/tpm/cards/:uuid`            | Soft-delete card                           |

**Route Note:** `check-duplicate` and `:uuid/executions` are defined before `:uuid` to prevent NestJS from matching path segments as UUID parameters. The `/executions` sub-resource endpoint reuses `TpmExecutionsService.listExecutionsForCard()` — the service method existed before the controller endpoint was added.

### 10. Schedule Projection (Cross-Plan Conflict Detection)

**Problem:** When creating/editing a TPM plan, admins couldn't see which time windows were already occupied by other plans across all machines. This led to resource conflicts (same team scheduled for overlapping maintenance windows).

**Solution:** `TpmScheduleProjectionService` — a read-only projection engine that calculates future maintenance dates for all active plans within a configurable date range (0–365 days).

**Intervall-Kaskade Prinzip:**

Aus der Plan-Konfiguration (`base_weekday` + `base_repeat_every` + `created_at`) ergeben sich ALLE geplanten Wartungstermine deterministisch. Karten sind irrelevant für die Projektion.

- **Tägliche/wöchentliche** Intervalle sind Bediener-Aufgaben → NICHT projiziert
- Jeder Plan projiziert automatisch **4 Intervalle**: monthly, quarterly, semi_annual, annual

**Beispiel:** Plan mit base_weekday=0 (Mo), base_repeat_every=1 (1. Mo im Monat), erstellt Feb 2026:

```
Seed = 1. Montag ab Erstellungsmonat (z.B. 2. März 2026)

Monatlich:       1. Mo jedes Monats     (Mär 2, Apr 6, Mai 4, Jun 1, ...)
Vierteljährlich: 1. Mo alle 3 Monate    (Mär 2, Jun 1, Sep 7, Dez 7)
Halbjährlich:    1. Mo alle 6 Monate    (Mär 2, Sep 7)
Jährlich:        1. Mo alle 12 Monate   (Mär 2, 2027)

Am Jahrestag treffen ALLE 4 Intervalle aufeinander → Kaskade.
Deduplizierung: Gleicher Plan + gleiches Datum → ein Slot mit merged intervalTypes[]
```

```
GET /tpm/plans/schedule-projection?startDate=2026-03-01&endDate=2026-03-31&excludePlanUuid=...

TpmScheduleProjectionService.projectSchedules(tenantId, startDate, endDate, excludePlanUuid?)
  1. Load all active plans (plan config only, no card JOIN)
  2. Calculate seed date per plan: Nth weekday of creation month (or next month)
  3. For each plan × 4 intervals: generate dates within [start, end]
     └── Delegates to TpmPlansIntervalService.calculateIntervalDate()
  4. Deduplicate same plan+date (merge interval types → Kaskade)
  5. Calculate time windows: base_time + buffer_hours → startTime/endTime
  6. Sort by date → startTime
  → Returns ScheduleProjectionResult { slots[], dateRange, planCount }
```

**Key Design Decisions:**

- **Computation, not storage:** Dates are calculated at request time, not stored in DB. Deterministic: same input → same output.
- **Plan config only:** Single query on `tpm_maintenance_plans` + `machines` (no card JOIN). Interval types derive from plan configuration, not from existing cards. Plans without cards project correctly.
- **Seed calculation:** `getNthWeekdayOfMonth(creationYear, creationMonth, baseWeekday, baseRepeatEvery)`. If seed date < plan creation → use next month's Nth weekday.
- **`excludePlanUuid`:** When editing a plan, excludes that plan from projection to avoid self-conflict.
- **`buffer_hours`:** `NUMERIC(4,1)`, range 0.5–24, step 0.5. Defines time window duration: `base_time + buffer_hours = endTime`. Plans without `base_time` → `isFullDay: true`.
- **Midnight wrap:** `calculateTimeWindow` handles `(22:00 + 4h) % 24 = 02:00` correctly.

**Frontend Integration:**

- `SlotAssistant.svelte`: Calendar grid with day-click → `TimelineDayView.svelte`
- `TimelineDayView.svelte`: Horizontal timeline (06:00–22:00) showing plan blocks + free gaps
- Range selector: 30/60/90/180/365 days (default 90)
- `tpm_schedule` conflict type shown in Slot Assistant tooltips

**Testing:** 17 unit tests (mocked DB) + 13 API integration tests (real HTTP)

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

- **Self-contained module**: 30+ files, 0 cross-module service imports (only DatabaseService + ActivityLoggerService)
- **Comprehensive testing**: 3875+ tests (unit + API) covering all services
- **Real-time updates**: SSE notifications for all lifecycle events
- **Configurable**: Per-tenant escalation threshold, colors, templates, time estimates
- **Shift planning integration**: TPM dates visible in shift grid via frontend calculation
- **Full audit trail**: Every execution permanently stored with documentation, photos, approval status — accessible via per-card history page
- **Staged photo upload**: Photos collected client-side before submission, uploaded sequentially after execution creation (resilient: partial upload failures don't roll back execution)

### Negative

- **Frontend date calculation**: Duplicates backend interval logic (trade-off for no additional API calls)
- **No machine_availability auto-status in V1**: Infrastructure exists but wiring deferred to V2 (complex trigger timing)
- **Employee list filtering**: V1 shows all plans/cards to all TPM users within a tenant (no team-scoped filtering)
- **No client-side pagination on history page**: V1 loads up to 50 executions in SSR; pagination controls deferred to V2 if needed

---

## References

- [TPM Masterplan](../../FEAT_TPM_MASTERPLAN.md) — Full execution plan with 29 sessions
- [Schedule Projection Masterplan](../../FEAT_TPM_SCHEDULE_PROJECTION_MASTERPLAN.md) — Schedule Projection sub-feature (8 sessions)
- [ADR-003](./ADR-003-notification-system.md) — SSE notification pattern
- [ADR-004](./ADR-004-persistent-notification-counts.md) — Persistent notification counts
- [ADR-009](./ADR-009-central-audit-logging.md) — Central audit logging
- [ADR-019](./ADR-019-multi-tenant-rls-isolation.md) — Multi-tenant RLS isolation
- [ADR-020](./ADR-020-per-user-feature-permissions.md) — Per-user feature permissions
- [ADR-024](./ADR-024-frontend-feature-guards.md) — Frontend feature guards
