# ADR-016: Tenant-Customizable Seed Data (Overlay-Pattern)

| Metadata                | Value                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                                   |
| **Date**                | 2026-02-02                                                                                                 |
| **Decision Makers**     | SCS Technik                                                                                                |
| **Affected Components** | `database/migrations/`, `backend/src/nest/kvp/`, `frontend/src/routes/(app)/(admin)/`, `navigation-config` |

---

## Context

### Starting Point

Assixx uses global lookup tables for predefined categories (seeds):

- `kvp_categories` - 6 default categories (Safety, Efficiency, Quality, ...)
- `machine_categories` - 11 default categories (future)
- Additional global lookups (Features, Status Enums, etc.)

These tables have **no `tenant_id`** and **no RLS** - all tenants share the same data.

### Problem: Rigid Defaults

Industrial customers have different technical terms and organizational structures:

| Tenant           | Seed Name "Safety" | Custom Categories                    |
| ---------------- | ------------------ | ------------------------------------ |
| Mechanical Eng A | "Workplace Safety" | "Digitalization", "Logistics"        |
| Chemical Co B    | "HSE"              | "Hazardous Materials", "Environment" |
| Logistics C      | (keep default)     | "Fleet", "Warehouse Optimization"    |

**Requirements:**

1. **Renaming** - Adapt seed names per tenant (e.g. "Safety" -> "Workplace Safety")
2. **Custom Entries** - Add tenant-specific categories
3. **Limit** - Max total count in dropdown (usability)
4. **Global Seeds Unchanged** - No tenant may modify the original seeds for other tenants
5. **Reusable** - Pattern must be applicable to any global lookup table

### Security Requirement

Not every admin should be allowed to manage categories. Only:

- **Root** - Always has access
- **Admin with `has_full_access = true`** - Full-access admins

Regular admins (without `has_full_access`) and employees are excluded.

---

## Decision Drivers

1. **Zero Breaking Changes** - Global seed tables MUST NOT be modified
2. **Multi-Tenant Isolation** - Tenant A never sees the customizations of Tenant B
3. **KISS** - Minimal complexity, no custom microservice pattern
4. **Reusable** - Same pattern for `kvp_categories`, `machine_categories`, etc.
5. **COALESCE Merge** - Existing queries must work with minimal changes
6. **Permission Granularity** - `has_full_access` as protection against unauthorized modifications

---

## Options Considered

### Option A: Make Seed Table Directly Editable (add tenant_id)

**Pros:**

- Simplest implementation
- No additional JOIN

**Cons:**

- **Breaking Change** - All existing queries must be adapted
- **Data Loss Risk** - Tenant can accidentally delete global seeds
- **RLS Rebuild** - Global table would need to become tenant-aware
- **Seed Updates Impossible** - When we add a new default, it collides with tenant data
- **Migration Nightmare** - Existing foreign keys point to `kvp_categories.id`

**Verdict:** REJECTED - Fundamental architecture break, too risky

### Option B: Tenant Copy at Onboarding (Copy-on-Create)

**Pros:**

- Each tenant has its own complete table
- Full control per tenant

**Cons:**

- **Data Inconsistency** - When we add a new default, it's missing for existing tenants
- **Storage Overhead** - 6 rows x N tenants instead of 6 rows globally
- **Sync Problem** - How to propagate new defaults to existing tenants?
- **Migration Complexity** - Onboarding process must copy seeds

**Verdict:** REJECTED - Synchronization problem with new defaults

### Option C: JSON Field per Tenant (Settings Table)

**Pros:**

- Flexible, no new schema
- One query per tenant

**Cons:**

- **No SQL JOIN** - Category name not directly available in suggestion queries
- **No Referential Integrity** - JSON has no foreign keys
- **No Indexes** - Search by category name not performant
- **Schema Drift** - JSON structure can diverge between tenants

**Verdict:** REJECTED - Loss of SQL advantages (JOINs, FKs, indexes)

### Option D: Overlay Pattern with Separate Custom Table (RECOMMENDED)

**Pros:**

- **Zero Breaking Changes** - Global seed table is NOT modified
- **COALESCE Merge** - `COALESCE(custom_name, default_name)` in a single query
- **Two Modes in One Table** - Override (rename) OR new entries
- **Tenant-Isolated** - RLS on custom table, global seeds remain public
- **New Defaults Propagate Automatically** - New seed in `kvp_categories` appears immediately for all tenants
- **Cleanly Deletable** - DELETE custom entry = reset to default
- **Reusable** - Same schema pattern for every lookup table

**Cons:**

- Additional LEFT JOIN in every category query
- New table per lookup (but minimal: ~5 columns)
- Application-level limit check needed (no DB constraint for "max 20 total")

**Verdict:** ACCEPTED - Best compromise of simplicity, safety, and reusability

---

## Decision

**Overlay Pattern: Separate `_custom` table per global lookup table.**

### Architecture Schema

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OVERLAY-PATTERN BLUEPRINT                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   GLOBAL (Read-Only, no tenant_id, no RLS)                          │
│   ┌──────────────────────────────────┐                              │
│   │  kvp_categories                  │                              │
│   │  id | name         | color | icon│                              │
│   │  1  | Safety       | #e74  | ... │  ← Seeds, never modified    │
│   │  2  | Efficiency   | #2ec  | ... │                              │
│   │  ...                             │                              │
│   └──────────────┬───────────────────┘                              │
│                  │                                                   │
│   OVERLAY (Per-Tenant, RLS enabled)                                 │
│   ┌──────────────┴───────────────────┐                              │
│   │  kvp_categories_custom           │                              │
│   │                                  │                              │
│   │  Mode 1 - Override:             │                              │
│   │  tenant=3, category_id=1         │                              │
│   │  custom_name="Workplace Safety"  │  ← Renaming                 │
│   │                                  │                              │
│   │  Mode 2 - New Category:         │                              │
│   │  tenant=3, category_id=NULL      │                              │
│   │  custom_name="Digitalization"    │  ← Custom entry              │
│   │  color="#8e44ad", icon="laptop"  │                              │
│   └──────────────────────────────────┘                              │
│                                                                     │
│   MERGE (UNION ALL + COALESCE)                                      │
│   ┌──────────────────────────────────┐                              │
│   │  Dropdown for Tenant 3:          │                              │
│   │  Workplace Safety (Override)     │                              │
│   │  Digitalization    (Custom)      │                              │
│   │  Efficiency        (Default)     │                              │
│   │  Ergonomics        (Default)     │                              │
│   │  ...                             │                              │
│   └──────────────────────────────────┘                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Custom Table Schema (Blueprint)

For each global lookup table `<entity>_categories`, an `<entity>_categories_custom` table is created:

```sql
CREATE TABLE IF NOT EXISTS <entity>_categories_custom (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES <entity>_categories(id) ON DELETE CASCADE,
    custom_name VARCHAR(50) NOT NULL,
    description TEXT,
    color VARCHAR(20),
    icon VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Override: max 1 per (tenant, global_category) combination
    CONSTRAINT uq_override UNIQUE (tenant_id, category_id),

    -- New category: required fields when not an override
    CONSTRAINT chk_custom_has_visuals CHECK (
        category_id IS NOT NULL
        OR (color IS NOT NULL AND icon IS NOT NULL)
    )
);

-- RLS (MANDATORY)
ALTER TABLE <entity>_categories_custom ENABLE ROW LEVEL SECURITY;
ALTER TABLE <entity>_categories_custom FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON <entity>_categories_custom
    FOR ALL
    USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON <entity>_categories_custom TO app_user;
GRANT USAGE, SELECT ON SEQUENCE <entity>_categories_custom_id_seq TO app_user;
```

### Merge Query (Blueprint)

```sql
-- Dropdown data for a tenant
SELECT kc.id, 'global' AS source,
       COALESCE(kcc.custom_name, kc.name) AS name,
       kc.description, kc.color, kc.icon
FROM <entity>_categories kc
LEFT JOIN <entity>_categories_custom kcc
  ON kcc.category_id = kc.id AND kcc.tenant_id = $1

UNION ALL

SELECT kcc.id, 'custom' AS source,
       kcc.custom_name AS name,
       kcc.description, kcc.color, kcc.icon
FROM <entity>_categories_custom kcc
WHERE kcc.tenant_id = $1 AND kcc.category_id IS NULL

ORDER BY name ASC
```

### API Endpoints (Blueprint per Feature)

| Method   | Route                                       | Description                  | Role                         |
| -------- | ------------------------------------------- | ---------------------------- | ---------------------------- |
| `GET`    | `/<entity>/categories/customizable`         | Admin view (defaults+custom) | root, admin(has_full_access) |
| `PUT`    | `/<entity>/categories/override/:categoryId` | Upsert name override         | root, admin(has_full_access) |
| `DELETE` | `/<entity>/categories/override/:categoryId` | Reset to default name        | root, admin(has_full_access) |
| `POST`   | `/<entity>/categories/custom`               | New tenant category          | root, admin(has_full_access) |
| `DELETE` | `/<entity>/categories/custom/:id`           | Delete tenant category       | root, admin(has_full_access) |

### Permission Layer (3 Layers)

```
Layer 1 - Backend Guard:
  @UseGuards(RolesGuard) + @Roles('admin', 'root')
  → Blocks employees

Layer 2 - Backend Service:
  assertHasFullAccess(userId, userRole, tenantId)
  → Root: immediately OK
  → Admin: SELECT has_full_access FROM users WHERE id=$1 AND tenant_id=$2
  → Otherwise: ForbiddenException

Layer 3 - Frontend (Defense-in-Depth):
  a) +page.server.ts: parent().user.hasFullAccess check → redirect
  b) Navigation: filterMenuByAccess() removes link for admins without full access
```

### Frontend Page Blueprint

```
(admin)/<entity>-categories/
├── +page.svelte          # UI (Override table + Custom table + Modals)
├── +page.server.ts       # SSR Load + has_full_access guard
└── _lib/
    ├── api.ts            # API client (5 functions)
    ├── types.ts          # TypeScript interfaces
    └── constants.ts      # Labels, messages, icon options
```

### Design Constraints

| Constraint         | Value                     | Rationale                                            |
| ------------------ | ------------------------- | ---------------------------------------------------- |
| `custom_name`      | VARCHAR(50)               | Technical terms up to 50 characters                  |
| Max per Tenant     | Configurable (default 20) | Application-level check, not a DB constraint         |
| Soft Delete        | NO                        | DELETE = reset/removal, no `is_active` needed        |
| Empty Input + Save | = DELETE                  | Override row is deleted, default name appears        |
| `source` field     | In query                  | Dropdown must know if global/custom for FK reference |

---

## Consequences

### Positive

- **Zero Breaking Changes** - Global seed tables remain unchanged
- **New Defaults Propagate Automatically** - New seed appears immediately for all tenants
- **Reusable** - Copy-paste blueprint for every lookup table
- **Cleanly Separable** - Override (renaming) vs. Custom (new entry) in one table
- **Idempotent Reset** - DELETE custom row = default name comes back
- **3-Layer Permission** - Backend guard + service-level DB check + frontend guard
- **Minimally Invasive** - Existing queries only need an additional LEFT JOIN + COALESCE

### Negative

- **Additional JOIN** - Every category query needs LEFT JOIN on `_custom` table
- **Application-Level Limit** - Max categories check not possible as DB constraint (cross-table count)
- **New Table per Feature** - Every lookup table gets a `_custom` table
- **has_full_access Query** - Extra DB query per request for admin permission (no JWT claim)

### Neutral

- Seeds remain in `database/seeds/` (unchanged)
- Custom data is empty on fresh install (no new seed needed)
- Existing foreign keys on `kvp_categories.id` remain intact

---

## First Implementation: KVP Categories

| File                                                       | Role                                       |
| ---------------------------------------------------------- | ------------------------------------------ |
| `database/migrations/*_kvp-categories-custom.ts`           | Custom table schema                        |
| `database/migrations/*_kvp-suggestions-custom-category.ts` | FK column in suggestions                   |
| `backend/.../kvp-categories.service.ts`                    | 5 service methods + `assertHasFullAccess`  |
| `backend/.../kvp.controller.ts`                            | 5 endpoints with `@CurrentUser` + `@Roles` |
| `backend/.../kvp.service.ts`                               | `getCategories()` UNION ALL query          |
| `frontend/.../(admin)/kvp-categories/`                     | Admin page (Override table + Custom table) |
| `frontend/.../_lib/navigation-config.ts`                   | `filterMenuByAccess()` + menu item         |

## Future Applications

| Lookup Table         | Seeds | Custom Table                 | Status    |
| -------------------- | ----- | ---------------------------- | --------- |
| `kvp_categories`     | 6     | `kvp_categories_custom`      | Done      |
| `machine_categories` | 11    | `machine_categories_custom`  | Planned   |
| Additional           | n     | `<entity>_categories_custom` | Blueprint |

---

## References

- [KVP-CATEGORIES-CUSTOM-PLAN.md](../../plans/KVP-CATEGORIES-CUSTOM-PLAN.md) - Detailed implementation plan (first application)
- [ADR-006: Multi-Tenant Context Isolation](./ADR-006-multi-tenant-context-isolation.md) - RLS Policy Pattern
- [ADR-009: User Role Assignment & Permissions](./ADR-009-user-role-assignment-permissions.md) - `has_full_access` Permission Model
- [ADR-012: Frontend Route Security Groups](./ADR-012-frontend-route-security-groups.md) - `(admin)` Route Group + Fail-Closed RBAC
- [ADR-014: Database & Migration Architecture](./ADR-014-database-migration-architecture.md) - Migration Tooling (`node-pg-migrate`)

## Related ADRs

- **ADR-006** - RLS Policy Pattern (NULLIF) for `_custom` tables
- **ADR-009** - `has_full_access` flag as permission gate
- **ADR-012** - `(admin)` route group for frontend protection
- **ADR-014** - Migration tooling for new `_custom` tables

---

_Last Updated: 2026-02-02 (v1 - Initial Decision)_
