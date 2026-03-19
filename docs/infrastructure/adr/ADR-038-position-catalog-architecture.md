# ADR-038: Position Catalog Architecture

| Metadata                | Value                                                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**              | Proposed                                                                                                                                                                                                          |
| **Date**                | 2026-03-17                                                                                                                                                                                                        |
| **Decision Makers**     | SCS Technik                                                                                                                                                                                                       |
| **Affected Components** | `database/migrations/`, `backend/src/nest/organigram/`, `backend/src/nest/approvals/`, `frontend/src/routes/(app)/(root)/settings/organigram/positions/`, `frontend/src/routes/(app)/(admin)/settings/approvals/` |

---

## Context

### Current State

Positions in Assixx are **free-text strings** stored in `tenants.settings` JSONB under the `positionOptions` key. The structure is:

```json
{
  "positionOptions": {
    "employee": ["Produktionsmitarbeiter", "team_lead", "Qualitätsprüfer", ...],
    "admin": ["area_lead", "department_lead", "Personalleiter", ...],
    "root": ["CEO", "CTO", ...]
  }
}
```

Users have a single `users.position VARCHAR(100)` field that stores one of these strings.

System positions (`team_lead`, `area_lead`, `department_lead`) are auto-injected by the frontend and marked as locked, but they have no special treatment in the database.

### Problems

| Problem                            | Impact                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------- |
| No UUID/FK for positions           | Cannot reference positions from other tables (e.g. approval_configs)    |
| Text-based matching                | Typos or renames silently break any position-based logic                |
| Single position per user           | A user cannot be both `team_lead` AND `Qualitätsmanager`                |
| No referential integrity           | A position can be deleted while still assigned to users                 |
| JSONB storage                      | No indexes, no constraints, no JOIN capability                          |
| No position-based approval masters | The approval system (ADR-037) cannot assign approval rights by position |

### Requirements

1. Positions must be **first-class DB entities** with UUIDs
2. Users must support **multiple positions** (N:M relationship)
3. The **approval system** must support `approver_type: 'position'`
4. **System positions** (leads) must be protected from editing/deletion
5. **`users.position` VARCHAR** must remain functional (backward compatibility)
6. The **organigram positions page** must work with real CRUD instead of JSONB arrays

---

## Decision Drivers

1. **Referential Integrity** — FK constraints prevent orphaned references
2. **Rename Safety** — UUID-based references survive position renames
3. **N:M Flexibility** — Industrial workforce often has overlapping roles
4. **Minimal Disruption** — Existing `users.position` code must not break
5. **Approval Integration** — Direct requirement from ADR-037 V2 roadmap

---

## Options Considered

### Option A: Text-Based Approval Config (Quick Fix)

Add `approver_position_text VARCHAR` to `approval_configs`. Match against `users.position` at approval time.

**Pros:**

- Fast to implement (~1 session)
- No schema changes beyond one column

**Cons:**

- **Fragile** — typos, renames, case differences break matching silently
- **No FK constraint** — position text can be anything
- **Single position only** — cannot check N:M assignments
- **Anti-pattern** — storing semantically meaningful data as free text

**Verdict:** REJECTED — violates data integrity principles, creates long-term maintenance burden

### Option B: Position Catalog as DB Entity (RECOMMENDED)

New `position_catalog` table with UUID primary keys. New `user_positions` N:M table. `approval_configs` gets `approver_position_id UUID REFERENCES position_catalog(id)`.

**Pros:**

- **FK constraints** — referential integrity enforced by DB
- **Rename-safe** — UUID persists across renames
- **N:M capable** — `user_positions` allows multiple positions per user
- **Queryable** — JOINs, indexes, aggregations
- **Foundation** — future features (skill matrix, shift qualification) can reuse the catalog
- **System position protection** — `is_system = true` prevents editing lead positions

**Cons:**

- **More work** — 2 new tables, services, endpoints, frontend rewrite (~6 sessions)
- **Migration complexity** — existing JSONB data needs migration (mitigated: DB will be reset)
- **Dual system temporarily** — `users.position` VARCHAR coexists with `user_positions` N:M

**Verdict:** ACCEPTED — correct long-term architecture, justified by multiple use cases

### Option C: Extend Users Table with Position Array

Add `users.positions UUID[]` (PostgreSQL array) referencing `position_catalog`.

**Pros:**

- No N:M table needed
- Simpler queries (no JOIN)

**Cons:**

- **No FK enforcement** on array elements (PostgreSQL limitation)
- **Awkward querying** — `ANY()` instead of JOIN
- **No metadata** on assignments (no `created_at`, no audit trail)
- **Against PostgreSQL best practices** — arrays for FK references are an anti-pattern

**Verdict:** REJECTED — loses FK enforcement, PostgreSQL anti-pattern

---

## Decision

**Option B: Position Catalog as first-class DB entity with N:M user assignments.**

### Schema

```
position_catalog                       user_positions
┌──────────────────────────────┐       ┌──────────────────────────┐
│ id UUID (PK)                 │◄──────│ position_id UUID (FK)    │
│ tenant_id INTEGER (FK)       │       │ user_id INTEGER (FK)     │
│ name VARCHAR(100)            │       │ tenant_id INTEGER (FK)   │
│ role_category                │       │ id UUID (PK)             │
│   position_role_category     │       │ created_at TIMESTAMPTZ   │
│   ENUM(employee,admin,root)  │       │ UNIQUE(tenant_id,        │
│ sort_order INTEGER           │       │   user_id, position_id)  │
│ is_system BOOLEAN            │       └──────────────────────────┘
│ is_active INTEGER            │
│ created_at TIMESTAMPTZ       │       approval_configs (extended)
│ updated_at TIMESTAMPTZ       │       ┌──────────────────────────────────────┐
│ PARTIAL UNIQUE INDEX:        │       │ ...existing columns...               │
│   (tenant_id, name,         │       │ approver_type                        │
│    role_category)            │       │   approval_approver_type ENUM        │
│   WHERE is_active = 1       │       │   + 'position' (ALTER TYPE ADD VALUE)│
└──────────────────────────────┘       │ approver_position_id                 │
         ▲                             │   UUID (FK, nullable)               │──► position_catalog.id
         │                             │                                      │
         │                             │ CHECK: mutual exclusivity            │
         │                             │   user → user_id set, pos_id null   │
         │                             │   position → pos_id set, uid null   │
         │                             │   lead types → both null            │
         │                             │                                      │
         │                             │ UNIQUE INDEX rebuilt:                │
         │                             │   (tenant_id, addon_code,           │
         │                             │    approver_type,                    │
         │                             │    COALESCE(approver_user_id, 0),   │
         │                             │    COALESCE(approver_position_id,   │
         └─────────────────────────────│    '0...0'::uuid)) WHERE active=1   │
                                       └──────────────────────────────────────┘
```

**ENUMs:**

- `position_role_category` — new ENUM: `('employee', 'admin', 'root')` — consistent with codebase convention
- `approval_approver_type` — existing ENUM, extended: `ALTER TYPE approval_approver_type ADD VALUE 'position'`
  - **WARNING:** `ALTER TYPE ... ADD VALUE` is irreversible in PostgreSQL. `down()` must use detach-drop-recreate pattern.

**Unique Index Fix:**
The existing `idx_approval_configs_unique` is `UNIQUE (tenant_id, addon_code, approver_type, COALESCE(approver_user_id, 0))`. For `approver_type='position'`, `approver_user_id` is always NULL → `COALESCE=0`, limiting to ONE position-config per addon. The index must be rebuilt with `COALESCE(approver_position_id, '00000000-...'::uuid)` as an additional dimension.

### Approval Resolution Flow

Approval resolution happens in `approvals-config.service.ts` via `resolveApprovers()` — a single UNION ALL query with currently 4 branches (user, team_lead, area_lead, department_lead). A **5th branch** is added for `approver_type = 'position'`:

```sql
-- 5th UNION ALL branch in resolveApprovers()
SELECT DISTINCT u.id AS approver_id
FROM approval_configs ac
INNER JOIN user_positions up ON up.position_id = ac.approver_position_id
INNER JOIN users u ON u.id = up.user_id AND u.is_active = 1
WHERE ac.addon_code = $1
    AND ac.approver_type = 'position'
    AND ac.approver_position_id IS NOT NULL
    AND ac.is_active = 1
```

This resolves ALL users who have a matching position assigned via `user_positions`.

### System Positions

Three positions are auto-seeded per tenant with `is_system = true`:

- `team_lead` (role_category: employee)
- `area_lead` (role_category: admin)
- `department_lead` (role_category: admin)

System positions:

- Cannot be renamed, deleted, or reordered
- Are displayed with a lock icon and "System" badge in the UI
- Exist independently from the organigram lead assignments (`teams.team_lead_id` etc.)

### Backward Compatibility

| Aspect                                                   | Strategy                                                                                                                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users.position` VARCHAR                                 | Kept as-is. Not modified, not deprecated in V1. Display/legacy use.                                                                                                           |
| `GET /organigram/position-options`                       | `organigram-settings.service.ts` refactored to read from `position_catalog` instead of JSONB. Same response shape: `{ employee: string[], admin: string[], root: string[] }`. |
| `PUT /organigram/position-options`                       | Upserts into `position_catalog` instead of JSONB. Same request shape.                                                                                                         |
| Frontend position dropdowns                              | Continue reading from `position-options` endpoint (transparent migration).                                                                                                    |
| `manage-employees/+page.server.ts`                       | Consumes `position-options` → `.employee`. No code change needed.                                                                                                             |
| `manage-admins/+page.server.ts`                          | Consumes `position-options` → `.admin`. No code change needed.                                                                                                                |
| `manage-root/+page.server.ts`                            | Consumes `position-options` → `.root`. No code change needed.                                                                                                                 |
| `EmployeeFormModal` / `AdminFormModal` / `RootUserModal` | Accept `positionOptions: string[]` prop. No code change needed.                                                                                                               |

### System Position Seed Trigger

System positions (`team_lead`, `area_lead`, `department_lead`) are lazy-seeded on first `GET /organigram/positions` per tenant. Implementation uses `INSERT ... ON CONFLICT (tenant_id, name, role_category) DO NOTHING` — atomic, no race conditions, idempotent.

### Production Migration Path

For existing tenants with position data in `tenants.settings.positionOptions` JSONB:

```sql
-- EXCLUDES system positions — those are handled by ensureSystemPositions() with stable UUIDs.
INSERT INTO position_catalog (id, tenant_id, name, role_category, sort_order, is_system)
SELECT gen_random_uuid(), t.id, pos.value::text, cat.key::position_role_category,
       pos.ordinality - 1, false
FROM tenants t
CROSS JOIN LATERAL jsonb_each(t.settings->'positionOptions') AS cat(key, value)
CROSS JOIN LATERAL jsonb_array_elements_text(cat.value) WITH ORDINALITY AS pos(value, ordinality)
WHERE t.settings->'positionOptions' IS NOT NULL
    AND pos.value::text NOT IN ('team_lead', 'area_lead', 'department_lead')
ON CONFLICT DO NOTHING;
```

### API Routing

Position catalog routes (`/organigram/positions/*`) live in `organigram.controller.ts`.
User-scoped position routes (`/users/:id/positions`) live in `users.controller.ts` — `/users/...` routes belong in the users controller, not organigram.

---

## Consequences

### Positive

- **Referential integrity** — FK constraints prevent orphaned position references
- **Rename safety** — position names can change without breaking approval configs
- **N:M user-position** — users can hold multiple functional positions simultaneously
- **Queryable** — `SELECT users.* FROM users JOIN user_positions ...` for position-based reports
- **Foundation** — position catalog is reusable for future features (skill matrix, qualification tracking, shift planning)
- **Approval V2 feature** — enables "all Qualitätsmanager are KVP approval masters" use case

### Negative

- **Dual system temporarily** — `users.position` (VARCHAR) and `user_positions` (N:M) coexist without sync
- **More tables** — 2 new tables with RLS policies add operational surface
- **Migration effort** — positions page frontend rewrite (~6 sessions total)
- **JSONB to table migration** — existing tenants need data migration (mitigated: DB reset planned)

### Neutral

- `tenants.settings.positionOptions` JSONB key becomes unused after migration (can be cleaned up later)
- No changes to the permission system (ADR-020) — positions are not permissions
- No changes to the organigram tree structure — positions are orthogonal to hierarchy

---

## Implementation

See [FEAT_POSITION_CATALOG_MASTERPLAN.md](../../FEAT_POSITION_CATALOG_MASTERPLAN.md) for the detailed execution plan (6 sessions, 5 phases).

---

## Related ADRs

- **ADR-035** — Organizational Hierarchy & Assignment Architecture (lead positions)
- **ADR-036** — Organizational Scope Access Control (scope resolution uses lead positions)
- **ADR-037** — Approvals Architecture (V1 approval system, V2 adds position-based approvers)
- **ADR-034** — Hierarchy Labels Propagation (position display names may use labels)

---

_Last Updated: 2026-03-18 (v3 — Partial unique index, CHECK constraint for mutual exclusivity, production migration excludes system positions, PUT facade @deprecated)_
