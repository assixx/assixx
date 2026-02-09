# ADR-011: Shift Data Architecture & Dual-Source Synchronization

| Metadata                | Value                                                                   |
| ----------------------- | ----------------------------------------------------------------------- |
| **Status**              | Accepted                                                                |
| **Date**                | 2026-01-25                                                              |
| **Decision Makers**     | SCS Technik                                                             |
| **Affected Components** | shifts.service.ts, rotation.service.ts, Frontend State, Database Tables |

---

## Context and Problem Statement

The shift management system stores shift data in **two separate tables**:

1. **`shifts`** - Manual shift assignments and shift plan entries
2. **`shift_rotation_history`** - Automatically generated rotation shifts

The frontend **merges both sources** when loading, which leads to a critical problem:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    THE SYNCHRONIZATION PROBLEM                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User loads shift plan                                                     │
│     └─▶ Frontend fetches: shifts + rotation_history                          │
│     └─▶ processRotationHistory() MERGES both into weeklyShifts               │
│                                                                              │
│  2. User removes employee from shift                                   │
│     └─▶ Frontend State: weeklyShifts is updated ✅                   │
│     └─▶ PUT /shifts/plan/:id sends correct data ✅                       │
│                                                                              │
│  3. Backend processes update                                               │
│     └─▶ shifts table: Entry is deleted ✅                            │
│     └─▶ shift_rotation_history: UNCHANGED ❌                              │
│                                                                              │
│  4. User reloads page                                                      │
│     └─▶ rotation_history returns deleted shift                   │
│     └─▶ Shift reappears! ❌                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why two tables?

| Table                    | Purpose                                      | Created by            |
| ------------------------ | -------------------------------------------- | --------------------- |
| `shifts`                 | Concrete shift instances with plan reference | Manual or plan update |
| `shift_rotation_history` | Generated rotation (algorithm output)        | Rotation generator    |

The separation makes sense because:

- Rotation patterns can be regenerated without losing manual changes
- History of generated shifts is preserved
- Different metadata (pattern_id, assignment_id vs plan_id)

---

## Decision Drivers

1. **Data Consistency** - A deleted shift must not reappear
2. **Debuggability** - Data flow must be traceable
3. **Separation of Concerns** - Rotation generation vs manual editing
4. **Performance** - No N+1 queries when loading
5. **Backward Compatibility** - Existing rotation patterns must not break

---

## Decision

### 1. Dual-Source Synchronization Rule

**When a shift plan is updated, BOTH tables must be synchronized.**

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                     SHIFT UPDATE SYNCHRONIZATION FLOW                          ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║  updateShiftPlan(planId, dto)                                                  ║
║      │                                                                         ║
║      ├─▶ 1. Update shift_plans metadata (name, notes)                          ║
║      │                                                                         ║
║      ├─▶ 2. Upsert shifts from dto.shifts                                      ║
║      │       └─▶ ON CONFLICT (tenant, plan, user, date) DO UPDATE              ║
║      │       └─▶ Returns: keepShiftIds[]                                       ║
║      │                                                                         ║
║      ├─▶ 3. Delete orphaned shifts                                             ║
║      │       └─▶ DELETE FROM shifts WHERE id NOT IN (keepShiftIds)             ║
║      │                                                                         ║
║      └─▶ 4. Cleanup orphaned rotation_history  ← NEW                           ║
║              └─▶ DELETE FROM shift_rotation_history                            ║
║                  WHERE (user_id, shift_date) NOT IN (kept combinations)        ║
║                  AND shift_date IN (affected date range)                       ║
║                                                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 2. Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SHIFT DATA FLOW                                      │
└─────────────────────────────────────────────────────────────────────────────┘

                            ┌──────────────────┐
                            │   User Action    │
                            └────────┬─────────┘
                                     │
              ┌──────────────────────┴──────────────────────┐
              │                                              │
              ▼                                              ▼
    ┌─────────────────┐                           ┌─────────────────┐
    │  Load Schedule  │                           │  Edit Schedule  │
    └────────┬────────┘                           └────────┬────────┘
             │                                              │
             ▼                                              ▼
    ┌─────────────────────────────────┐          ┌─────────────────────────┐
    │ GET /shifts/plan                │          │ Frontend State          │
    │ GET /rotation-history           │          │ shiftsState.weeklyShifts│
    └────────┬────────────────────────┘          └────────┬────────────────┘
             │                                              │
             ▼                                              │
    ┌─────────────────────────────────┐                     │
    │ processShiftPlanResponse()      │                     │
    │ processRotationHistory()        │◀────── MERGE ───────┘
    │     └─▶ MERGES both sources     │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │ shiftsState.setWeeklyShifts()   │
    │     └─▶ Single Map<date, Map>   │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │ ShiftScheduleGrid.svelte        │
    │     └─▶ Renders from state      │
    └─────────────────────────────────┘

                    SAVE FLOW
                    ─────────
    ┌─────────────────────────────────┐
    │ handleSaveSchedule()            │
    │     └─▶ saveSchedule(params)    │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │ buildShiftSaveData()            │
    │     └─▶ weeklyShifts → shifts[] │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │ PUT /shifts/plan/:id            │
    │     └─▶ { shifts: [...] }       │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │ ShiftsService.updateShiftPlan() │
    │   ├─▶ upsertPlanShifts()        │
    │   ├─▶ deleteOrphanedPlanShifts()│
    │   └─▶ cleanupOrphanedRotation   │ ← CRITICAL
    │       History()                  │
    └─────────────────────────────────┘
```

### 3. Database Table Relationships

```sql
-- Primary shift storage (manual + plan-based)
shifts (
    id, tenant_id, plan_id,          -- Plan reference
    user_id, date, start_time, end_time, type,
    team_id, department_id, area_id,
    UNIQUE(tenant_id, plan_id, user_id, date)  -- Upsert key
)

-- Generated rotation history
shift_rotation_history (
    id, tenant_id,
    pattern_id, assignment_id,       -- Rotation pattern reference
    user_id, team_id,
    shift_date, shift_type,
    UNIQUE(tenant_id, user_id, shift_date)  -- One shift per user per day
)

-- Shift plans (week containers)
shift_plans (
    id, tenant_id,
    team_id, department_id, area_id,
    start_date, end_date,
    shift_notes
)
```

### 4. Cleanup Logic (cleanupOrphanedRotationHistory)

```typescript
/**
 * Deletes rotation_history entries that no longer have corresponding shifts.
 * Called when a shift plan is updated and employees are removed.
 *
 * @param tenantId - Tenant isolation
 * @param teamId - Team scope
 * @param keptShifts - Array of {userId, date} that should remain
 */
private async cleanupOrphanedRotationHistory(
  tenantId: number,
  teamId: number,
  keptShifts: { userId: number; date: string }[],
): Promise<void> {
  // Only delete within the date range of kept shifts
  // to avoid affecting other weeks/patterns

  DELETE FROM shift_rotation_history
  WHERE tenant_id = $1
    AND team_id = $2
    AND shift_date >= $minDate
    AND shift_date <= $maxDate
    AND (user_id, shift_date) NOT IN (kept combinations)
}
```

### 5. Frontend State Management

```typescript
// State structure (state-shifts.svelte.ts)
let weeklyShifts = $state<Map<string, Map<string, number[]>>>(new Map());
//                        │           │            │
//                        │           │            └─ Employee IDs
//                        │           └─ Shift type (early/late/night)
//                        └─ Date key (YYYY-MM-DD)

// Removal operation (MUST trigger reactivity)
removeShiftAssignment: (date, shiftType, employeeId) => {
  const result = removeAssignment(weeklyShifts, shiftDetails, date, shiftType, employeeId);
  weeklyShifts = result.weeklyShifts; // Assignment triggers Svelte reactivity
  shiftDetails = result.shiftDetails;
};
```

---

## Debugging Guide

### Problem: Shift reappears after save

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DEBUGGING CHECKLIST                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. FRONTEND STATE                                                           │
│     □ Is removeShiftAssignment() being called?                              │
│     □ Does weeklyShifts.size decrease after removal?                        │
│     □ Is the correct data sent in PUT request?                              │
│                                                                              │
│  2. BACKEND PROCESSING                                                       │
│     □ Does dto.shifts contain correct entries?                              │
│     □ Are keepShiftIds populated correctly?                                 │
│     □ Is deleteOrphanedPlanShifts() deleting shifts?                        │
│     □ Is cleanupOrphanedRotationHistory() deleting history?                 │
│                                                                              │
│  3. DATABASE STATE                                                           │
│     □ Check shifts table: SELECT * FROM shifts WHERE date = 'YYYY-MM-DD'    │
│     □ Check rotation_history: SELECT * FROM shift_rotation_history          │
│       WHERE shift_date = 'YYYY-MM-DD'                                       │
│     □ If rotation_history has entry but shifts doesn't → cleanup failed     │
│                                                                              │
│  4. RELOAD BEHAVIOR                                                          │
│     □ Does fetchShiftPlan return correct shifts?                            │
│     □ Does fetchRotationHistory return orphaned entries?                    │
│     □ Is processRotationHistory merging stale data?                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Debug Queries

```sql
-- Check for orphaned rotation_history entries
SELECT 'orphaned' as status, h.*
FROM shift_rotation_history h
WHERE h.team_id = :teamId
  AND h.shift_date BETWEEN :startDate AND :endDate
  AND NOT EXISTS (
    SELECT 1 FROM shifts s
    WHERE s.user_id = h.user_id
      AND s.date = h.shift_date
      AND s.team_id = h.team_id
  );

-- Compare both tables for a specific week
SELECT 'shifts' as source, user_id, date, type
FROM shifts WHERE team_id = :teamId AND date BETWEEN :start AND :end
UNION ALL
SELECT 'rotation', user_id, shift_date, shift_type::text
FROM shift_rotation_history WHERE team_id = :teamId AND shift_date BETWEEN :start AND :end
ORDER BY source, date, user_id;
```

### Logging Points

```typescript
// Backend: shifts.service.ts
updateShiftPlan() {
  this.logger.debug(`dto.shifts: ${dto.shifts?.length ?? 0} entries`);
  this.logger.debug(`keepShiftIds: [${shiftIds.join(', ')}]`);
  this.logger.debug(`Cleaned up ${deletedCount} orphaned rotation_history entries`);
}

// Frontend: Only use console.error for debugging (ESLint rule)
// Remove after debugging is complete
```

---

## Alternatives Considered

### 1. Single Table (shifts only)

```
+ Simpler architecture
+ No sync issues
- Loses rotation pattern metadata
- Can't regenerate patterns without losing manual edits
- Breaking change for existing data
```

**Decision:** Rejected - Would require major migration and lose valuable metadata.

### 2. Soft Delete with is_active flag

```
+ Preserves history
+ Easy to "undo" deletions
- Adds complexity to all queries
- rotation_history already has status field
- Doesn't solve the sync problem
```

**Decision:** Rejected - Adds complexity without solving root cause.

### 3. Event Sourcing

```
+ Complete audit trail
+ Replay capability
- Massive architectural change
- Overkill for this use case
- Performance implications
```

**Decision:** Rejected - Too complex for the problem at hand.

### 4. Foreign Key from rotation_history to shifts (Chosen Enhancement)

```
+ Automatic cascade delete
- Requires schema migration
- rotation_history entries may exist without shifts (generated but not confirmed)
```

**Decision:** Considered for future - Would provide database-level consistency.

---

## Consequences

### Positive

1. **Data Consistency** - Shifts stay deleted after page reload
2. **Clear Ownership** - updateShiftPlan owns synchronization
3. **Debuggable** - Clear data flow with logging points
4. **Non-Breaking** - Works with existing rotation patterns
5. **Documented** - This ADR serves as reference

### Negative

1. **Performance** - Additional DELETE query per update
2. **Complexity** - Two cleanup functions instead of one
3. **Edge Cases** - Multi-user concurrent edits need consideration

### Mitigations

| Risk                    | Mitigation                                      |
| ----------------------- | ----------------------------------------------- |
| Performance             | DELETE is indexed on (tenant_id, team_id, date) |
| Concurrent edits        | Optimistic locking via updated_at (future ADR)  |
| Orphaned data migration | One-time cleanup script for existing data       |

---

## Implementation

### Files Changed

```
backend/src/nest/shifts/shifts.service.ts
├── updateShiftPlan()              # Added cleanup call
└── cleanupOrphanedRotationHistory() # NEW method

frontend/src/routes/(app)/shifts/_lib/
├── state-shifts.svelte.ts         # Verified reactivity
├── shift-operations.ts            # Immutable state updates
└── data-loader.ts                 # Merge logic documented
```

### Migration Script (for existing orphaned data)

```sql
-- Run once to clean up any existing orphaned entries
DELETE FROM shift_rotation_history h
WHERE EXISTS (
  SELECT 1 FROM shift_plans p
  WHERE p.team_id = h.team_id
    AND h.shift_date BETWEEN p.start_date AND p.end_date
)
AND NOT EXISTS (
  SELECT 1 FROM shifts s
  WHERE s.user_id = h.user_id
    AND s.date = h.shift_date
    AND s.team_id = h.team_id
);
```

---

## References

- [ADR-009: User Role Assignment & Permissions](./ADR-009-user-role-assignment-permissions.md)
- [MADR Template](https://adr.github.io/madr/)
- Backend: `/backend/src/nest/shifts/shifts.service.ts`
- Frontend: `/frontend/src/routes/(app)/shifts/_lib/`
