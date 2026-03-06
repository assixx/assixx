# ADR-023: Vacation Request System Architecture

| Metadata                | Value                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                                                                                         |
| **Date**                | 2026-02-13                                                                                                                                                       |
| **Decision Makers**     | SCS-Technik Team                                                                                                                                                 |
| **Affected Components** | PostgreSQL (7 tables, 6 migrations), Backend (NestJS vacation module), Frontend (SvelteKit)                                                                      |
| **Supersedes**          | —                                                                                                                                                                |
| **Related ADRs**        | ADR-003 (SSE), ADR-004 (Feature Notifications), ADR-005 (Auth), ADR-006 (CLS), ADR-007 (Response), ADR-009 (Audit Logging), ADR-019 (RLS), ADR-020 (Permissions) |

---

## Context

Assixx is a Multi-Tenant SaaS for industrial companies. Industrial vacation planning is fundamentally different from office environments:

- **Machine staffing requirements** — production lines cannot operate below minimum headcount
- **Blackout periods** — peak seasons, inventory counts, mandatory production windows
- **Approver chains** — team lead → area lead → admin, with self-approval prevention
- **Half-day granularity** — morning/afternoon splits for doctor visits, appointments
- **Special leave types** — bereavement, birth, wedding, move (legally mandated in Germany)
- **Cross-team visibility** — managers need calendar views of all approved absences

### The Problem

Before this feature, Assixx had no vacation management. Industrial companies used external tools (Excel, paper forms, SAP) with these pain points:

| Problem                     | Impact                                             |
| --------------------------- | -------------------------------------------------- |
| No capacity pre-check       | Approved vacations violate asset staffing rules    |
| No blackout enforcement     | Employees book during mandatory production windows |
| No cross-team calendar      | Managers discover conflicts after approval         |
| Manual entitlement tracking | Carry-over errors, incorrect remaining day counts  |
| No audit trail              | Disputes about who approved/denied and why         |

### Requirements

- Pre-approval capacity analysis: team headcount + asset staffing + blackout conflict + entitlement check
- Multi-level approval chain with self-approval prevention
- Paginated request lists with year/status/type filtering
- Admin CRUD for blackouts, staffing rules, holidays, entitlements, settings
- Team calendar view (approved vacations per member per day)
- Half-day support (morning/afternoon at start/end of range)
- Status asset: `pending → approved | denied`, `pending → withdrawn`, `approved → cancelled`
- Real-time notifications via SSE (ADR-003 EventBus pattern)
- Full RLS isolation (ADR-019) — no cross-tenant data leaks
- Per-user permissions (ADR-020) — vacation-requests, vacation-rules, vacation-entitlements, vacation-holidays, vacation-overview

---

## Decision

### 1. Database: 6 Incremental Migrations + 7 Core Tables

**Why 6 migrations instead of 1?**

Each migration is independently reversible. If migration 30 (availability rebuild) fails, migrations 27-29 remain intact. This was critical because migration 30 renamed a live table (`employee_availability` → `user_availability`) that affected running backend code.

| Migration | Purpose                                                 | Risk Mitigation                                     |
| --------- | ------------------------------------------------------- | --------------------------------------------------- |
| 027       | Feature flag (`tenant_features` row for "vacation")     | Idempotent INSERT, no schema change                 |
| 028       | Teams extension (`deputy_lead_id`, `UNIQUE user_teams`) | Pre-check query, RAISE EXCEPTION if duplicate data  |
| 029       | 7 core tables + RLS policies + indexes + status log     | All in single transaction, full RLS from day one    |
| 030       | Rename `employee_availability` → `user_availability`    | Deployed atomically with backend code changes       |
| 031       | Legacy cleanup (`absences` table removal)               | Checks for data, RAISE NOTICE for manual review     |
| 032       | Blackout multi-scope (`is_global` + junction table)     | Data migration from scope_type/scope_id, reversible |

**7 Core Tables:**

```
vacation_requests          — the main request entity (UUID PK, status asset)
vacation_request_status_log — append-only audit trail (who changed what, when)
vacation_entitlements      — per-user, per-year day allocation
vacation_blackouts         — company/department/team blackout periods
vacation_blackout_scopes   — junction table for multi-scope blackouts
vacation_staffing_rules    — per-asset minimum headcount
vacation_settings          — tenant-wide defaults (annual days, carry-over, notice period)
vacation_holidays          — tenant holidays (excluded from workday count)
```

**Design choices:**

- All tables have `tenant_id` + RLS policy (ADR-019) — zero cross-tenant access
- `is_active INTEGER` convention: 0=inactive, 1=active, 3=archive, 4=deleted (soft delete)
- `NUMERIC(5,1)` for day counts — supports half-day precision (e.g., 12.5 days)
- `vacation_request_status_log` is append-only — immutable audit trail
- UUIDv7 primary keys on all vacation tables — consistent with project-wide convention

### 2. Backend: 12 Service Files + 1 Controller (Responsibility Split)

**Why 12 services instead of 1 monolith?**

The vacation module has 26 API endpoints across 8 resource groups. A single service would exceed 2000 lines and violate the Single Responsibility Principle. The split follows **bounded context** within the module:

```
vacation.module.ts                    — NestJS module wiring
vacation.controller.ts                — 26 REST endpoints, feature check, permission guards
vacation.types.ts                     — all interfaces (DB rows + application types + capacity)
vacation.permissions.ts               — decentralized permission definitions (ADR-020)
vacation-permission.registrar.ts      — OnModuleInit registration (ADR-020)
├── vacation.service.ts               — mutations (create, edit, respond, withdraw, cancel)
├── vacation-approver.service.ts     — approver determination (role-based chain, self-approval prevention R5)
├── vacation-validation.service.ts    — business-rule validation (date checks, status transitions)
├── vacation-queries.service.ts       — read-only queries (paginated lists, team calendar)
├── vacation-capacity.service.ts      — pre-approval capacity analysis (THE HEART)
├── vacation-entitlements.service.ts  — balance calculation (getBalance, createOrUpdate, addDays)
├── vacation-holidays.service.ts      — CRUD + countWorkdays() (excludes weekends + holidays)
├── vacation-blackouts.service.ts     — CRUD + conflict check
├── vacation-staffing-rules.service.ts — CRUD for asset staffing minimums
├── vacation-settings.service.ts      — tenant-wide settings (get + update)
└── vacation-notification.service.ts  — SSE + persistent DB notifications (ADR-004) + email stub
```

**Key architectural pattern: `tenantTransaction()` everywhere**

Every DB access goes through `db.tenantTransaction()` (ADR-019). This:

1. Acquires a PoolClient from the tenant connection pool
2. Sets `SET LOCAL app.tenant_id = $1` for RLS
3. Executes the callback within a transaction
4. Auto-commits or rolls back

No service ever calls `client.query()` outside `tenantTransaction()`.

### 3. Capacity Analysis — The Heart of the System

The capacity service (`vacation-capacity.service.ts`) runs a **pre-approval analysis** that evaluates 4 dimensions in parallel:

```
analyzeCapacity(tenantId, startDate, endDate, requesterId)
  │
  ├── Team Analysis
  │   → For each team the requester belongs to:
  │     - Count total members
  │     - Count absent members (approved vacations overlapping the date range)
  │     - Calculate available-after-approval
  │     - Status: ok | warning | critical
  │
  ├── Machine Analysis
  │   → For each asset with a staffing rule:
  │     - Get minStaffRequired
  │     - Count currently available operators
  │     - Check if approval would violate minimum
  │     - List absent members with dates
  │     - Status: ok | warning | critical
  │
  ├── Blackout Conflicts
  │   → Check date range against active blackouts
  │   → Resolve multi-scope blackouts (department/team/area)
  │   → Return conflicting periods
  │
  └── Entitlement Check
      → Get user's balance for the year
      → Calculate requested days (countWorkdays)
      → Check sufficient / remaining-after-approval
      → Return projections

  → Overall Status: ok | warning | blocked
```

**Why not just approve/deny?**

The frontend shows capacity analysis **live** (300ms debounce) as the user fills in the vacation request form. This prevents wasted approvals and gives immediate feedback:

- "Team Montage has only 2 of 5 members available" → warning
- "Machine CNC-01 would fall below minimum staffing" → blocked
- "Blackout period 'Inventur' overlaps" → blocked

### 4. Approver Chain: Team Lead → Area Lead → Admin

```
getApprover(tenantId, requesterId)
  │
  ├── Find requester's team(s)
  ├── Get team_lead_id
  │   └── If team_lead_id === requesterId → self-approval!
  │       └── Escalate to deputy_lead_id (migration 028)
  │           └── If no deputy → escalate to area_lead
  │               └── If no area_lead → null (admin handles manually)
  │
  ├── autoApproved = false (default)
  │   └── Settings: auto_approve_under_X_days → autoApproved = true
  │
  └── Return { approverId, autoApproved }
```

**Self-approval prevention** was Risk R5 in the masterplan. The `deputy_lead_id` column (migration 028) exists specifically for this — a team lead's vacation goes to the deputy, not back to themselves.

### 5. Frontend: `_lib/` Foundation Pattern (5 Pages)

Each vacation page follows the same internal structure:

```
/vacation/[page]/
├── _lib/
│   ├── types.ts          — frontend interfaces (mirrors backend types)
│   ├── constants.ts      — German labels, badge classes, filter options
│   ├── api.ts            — apiClient wrapper functions
│   └── state.svelte.ts   — Svelte 5 Runes reactive state
├── +page.server.ts       — SSR data loading (auth + initial fetch)
└── +page.svelte          — UI component (receives SSR data via $props)
```

**Why SSR + client-side hybrid?**

- **SSR** (`+page.server.ts`): Loads heavy initial data (employee lists, teams, holidays). Runs server-side with direct API access, no CORS. Token from cookie.
- **Client-side** (`api.ts` via `apiClient`): Dynamic interactions (select employee → load balance, change month → load calendar). Uses browser fetch with JWT from cookie.

**State pattern** (Svelte 5 Runes):

```typescript
// Module-level reactive state using $state and $derived
let data = $state<T[]>([]);
let selectedItem = $state<T | null>(null);
const filteredData = $derived.by(() => {
  /* computed */
});

// Exported as single object with getters/setters
export const pageState = {
  get data() {
    return data;
  },
  setData: (val: T[]) => {
    data = val;
  },
  // ...
};
```

This pattern avoids Svelte stores (deprecated in Svelte 5) and keeps state co-located with its domain logic.

### 6. No Seed Data — UI-Driven Testing

**Decision:** No seed SQL files for vacation data. Testing happens directly through the CRUD UI.

**Rationale:**

- Holidays are tenant-specific (different per Bundesland/company)
- Entitlements are per-employee, per-year — no meaningful default
- The CRUD pages (holidays, entitlements, rules, settings) ARE the test surface
- Production workflow = admin configures via UI → exact same path used for testing

---

## Alternatives Considered

### 1. Monolithic Service (Single `vacation.service.ts`)

All 26 endpoint handlers + business logic + queries in one file.

**Rejected:**

- Would exceed 3000 lines (current split keeps each file under 800 countable lines)
- Violates SRP — mutations, queries, capacity, entitlements are distinct concerns
- Harder to test in isolation (capacity tests shouldn't need mutation setup)
- Merge conflicts when working on multiple features simultaneously

### 2. Separate NestJS Modules per Resource Group

`VacationRequestsModule`, `VacationEntitlementsModule`, `VacationBlackoutsModule`, etc. — each with its own controller.

**Rejected:**

- Over-engineering — all resources share the same `vacation_*` tables and `tenantTransaction()` pattern
- Cross-service dependencies would create circular imports (capacity needs entitlements, holidays, blackouts, staffing rules)
- Single controller with 26 endpoints is still readable (grouped by comment sections)
- The module boundary is "vacation" as a feature — sub-modules add complexity without value

### 3. Event Sourcing for Request Status

Store every status change as an event, derive current status from event stream.

**Rejected:**

- Over-engineering for a simple state asset (5 states, 5 transitions)
- The `vacation_request_status_log` table provides the same audit trail without CQRS complexity
- Status is written directly to `vacation_requests.status` for fast reads
- Status log is append-only and captures `old_status → new_status + changed_by + note`
- YAGNI — no requirement for event replay or temporal queries

### 4. Calendar-Based Day Counting (JS Date Math)

Count vacation days by iterating calendar days in JavaScript, checking weekends inline.

**Rejected:**

- Holidays would require a second pass or in-memory cache
- Different tenants have different holidays — requires DB lookup anyway
- `countWorkdays()` in `vacation-holidays.service.ts` queries the `vacation_holidays` table once and counts correctly
- Single source of truth for "is this a workday?" lives in the database, not in code

### 5. GraphQL Instead of REST

Single `/vacation` GraphQL endpoint with queries and mutations.

**Rejected:**

- Rest of Assixx is REST (ADR-007) — introducing GraphQL for one module creates inconsistency
- 26 endpoints are well-structured with clear HTTP semantics (GET, POST, PUT, PATCH, DELETE)
- No deep nesting requirement that would benefit from GraphQL's query flexibility
- Team familiarity with REST patterns, no GraphQL expertise to maintain

---

## Consequences

### Positive

1. **Pre-approval capacity analysis prevents staffing violations** — the primary business value for industrial companies
2. **12 focused services** — each under 800 countable lines, testable in isolation (115 unit tests + 33 API tests)
3. **RLS isolation on all 7 tables** — cross-tenant data leaks impossible (ADR-019)
4. **Decentralized permissions** (ADR-020) — 5 permission modules (requests, rules, entitlements, holidays, overview) registered automatically
5. **Append-only status log** — complete audit trail for compliance (who approved, when, with what note)
6. **Half-day support** — morning/afternoon splits at range boundaries, `NUMERIC(5,1)` for precise day counts
7. **Frontend consistency** — all 5 vacation pages follow identical `_lib/` pattern, predictable for future developers
8. **SSR + client-side hybrid** — fast initial load, responsive interactions
9. **6 incremental migrations** — each independently reversible, risk-mitigated

### Negative

1. **11 service files add navigation overhead** — developer must know which service handles what (mitigated by clear naming)
2. **No offline support** — capacity analysis requires live DB queries (acceptable for factory environments with stable connectivity)
3. **Capacity analysis is synchronous** — blocks response until all checks complete (mitigated: typically <200ms for realistic team sizes)
4. **No recurring vacation support** — "every Friday off" must be submitted as individual requests (YAGNI — no customer request)
5. **Single-year entitlement model** — balance doesn't auto-calculate across year boundaries (carry-over is explicit via admin UI)

### Risks & Mitigations

| Risk                                                             | Mitigation                                                                        |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| R1: `user_teams` has users in multiple teams → UNIQUE constraint | Pre-check query in migration 028, RAISE EXCEPTION with message                    |
| R2: `employee_availability` rename breaks running backend        | Migration 030 + backend code changes deployed atomically (same session)           |
| R3: `absences` table has data → DROP loses it                    | Migration 031 checks for data, RAISE NOTICE, manual review required               |
| R4: Cross-year day splitting edge cases                          | 5+ cross-year unit test scenarios in vacation-entitlements.service.test.ts        |
| R5: Self-approval loop (team_lead approves own vacation)         | Explicit check + escalation to deputy_lead_id (migration 028) → area_lead → admin |
| R6: Race condition on concurrent approve/deny                    | `SELECT ... FOR UPDATE` lock on vacation_requests row before status change        |

---

## Implementation Summary

| Phase | Content                                                              | Sessions  | Status   |
| ----- | -------------------------------------------------------------------- | --------- | -------- |
| 1     | Database: 6 migrations (feature flag → core → rebuild → multi-scope) | 1-4, 21   | Complete |
| 2     | Backend: 12 services + controller (26 endpoints)                     | 5-12, 22  | Complete |
| 3     | Unit tests: 115 tests across 5 test files                            | 13-14     | Complete |
| 4     | API integration tests: 29 endpoint tests                             | 15        | Complete |
| 5     | Frontend: 5 pages (main, rules, entitlements, holidays, overview)    | 16-19     | Complete |
| 6     | Integration: notifications, audit logging, calendar, documentation   | 20, 23-24 | Active   |

**Total: 24 implementation sessions, 6 migrations, 20+ backend files, 30+ frontend files, 148+ tests (115 unit + 33+ API).**

### Notification Integration (Session 23)

Vacation notifications follow the ADR-004 pattern (hybrid SSE + persistent DB):

- **Persistent DB notifications:** Every lifecycle event (create, respond, withdraw, cancel) creates a row in `notifications` table with `type='vacation'`, `recipient_type='user'`, `metadata={requestId}`
- **Sidebar badge:** Dashboard counts include vacation unread count; navigation shows badge on vacation menu items
- **Mark-as-read:** `POST /notifications/mark-read/vacation` bulk-marks all vacation notifications as read (called on page visit)
- **"Neu" badges:** `GET /vacation/notifications/unread-ids` returns request IDs with unread notifications; frontend shows "Neu" badge on RequestCard + IncomingRequestCard
- **SSE real-time:** 4 event types (VACATION_REQUEST_CREATED/RESPONDED/WITHDRAWN/CANCELLED) increment frontend vacation count in real-time

### Audit Logging Integration (Session 24)

Vacation mutations are now logged via `ActivityLoggerService` (ADR-009 dual-table architecture):

- **`audit_trail` (automatic):** The `AuditTrailInterceptor` captures every HTTP request (controller-level). No changes needed.
- **`root_logs` (manual via ActivityLoggerService):** Every mutation now fires a `void this.activityLogger.log({...})` call after successful transaction commit. This ensures vacation actions appear in the Root Dashboard activity feed.

**6 services instrumented:**

| Service                              | Logged Actions                                         |
| ------------------------------------ | ------------------------------------------------------ |
| `vacation.service.ts`                | create, respond (approve/deny), withdraw, cancel, edit |
| `vacation-blackouts.service.ts`      | create, update, delete                                 |
| `vacation-holidays.service.ts`       | create, update, delete                                 |
| `vacation-staffing-rules.service.ts` | create, update, delete                                 |
| `vacation-entitlements.service.ts`   | createOrUpdate, addDays                                |
| `vacation-settings.service.ts`       | update                                                 |

**Infrastructure changes:**

- `ActivityEntityType` extended with 6 types: `vacation`, `vacation_blackout`, `vacation_holiday`, `vacation_staffing_rule`, `vacation_entitlement`, `vacation_settings`
- `RESOURCE_TABLE_MAP` extended with 5 entries for DELETE/UPDATE pre-fetch: `request`, `blackout`, `holiday`, `staffing-rule`, `entitlement`
- Service method signatures updated: `userId` parameter added to `updateBlackout`, `deleteBlackout`, `updateHoliday`, `deleteHoliday`, `updateStaffingRule`, `deleteStaffingRule`; `addDays` signature changed to `(tenantId, performedBy, targetUserId, year, days)` to distinguish admin from target employee

**Design decisions:**

- **Fire-and-forget:** `void this.activityLogger.log({...})` — never blocks, never throws, never rolls back the main transaction
- **Log after commit:** Activity log calls happen AFTER `tenantTransaction()` completes, preventing phantom log entries on rollback
- **UUID entity IDs:** Vacation entities use UUID strings, but `logCreate/logUpdate/logDelete` require `entityId: number`. Solution: use base `log()` method (entityId optional), include UUID in `details` and `newValues`
- **German log messages:** Consistent with existing activity log entries (e.g. "Urlaubsantrag erstellt", "Urlaubssperre gelöscht")

---

## References

- [FEAT_VACCATION_MASTERPLAN.md](../../FEAT_VACCATION_MASTERPLAN.md) — Full execution plan with session-by-session log
- [prompt_vacation.md](../../prompt_vacation.md) — Original feature specification
- [brainstorming_vacation.md](../../brainstorming_vacation.md) — Requirements brainstorming
- [ADR-005: Authentication Strategy](./ADR-005-authentication-strategy.md) — JWT Guard, `@CurrentUser()`, `@TenantId()`
- [ADR-006: Multi-Tenant Context Isolation](./ADR-006-multi-tenant-context-isolation.md) — ClsService, `tenantTransaction()`
- [ADR-007: API Response Standardization](./ADR-007-api-response-standardization.md) — ResponseInterceptor, raw service returns
- [ADR-019: Multi-Tenant RLS Data Isolation](./ADR-019-multi-tenant-rls-isolation.md) — RLS policies, dual-user model
- [ADR-020: Per-User Feature Permissions](./ADR-020-per-user-feature-permissions.md) — Decentralized registry pattern
- [ADR GitHub](https://adr.github.io/) — ADR best practices
