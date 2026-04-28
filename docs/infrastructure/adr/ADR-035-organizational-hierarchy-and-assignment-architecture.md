# ADR-035: Organizational Hierarchy & Assignment Architecture

| Metadata                | Value                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                  |
| **Date**                | 2026-03-13                                                                                |
| **Decision Makers**     | SCS Technik                                                                               |
| **Affected Components** | Database, backend (NestJS), frontend (SvelteKit), guards, org chart, all management pages |

---

## Context

Assixx is a multi-tenant SaaS platform for industrial companies. The central challenge: **who is allowed to see and manage what?** The answer lies in a hierarchical organizational structure that connects physical locations, organizational units, and personnel assignments in a coherent system.

This ADR documents the **complete architecture** of the assignment and hierarchy system — from the database layer through the backend permission services to the frontend visualization.

### Requirements

1. **Multi-tenant isolation:** tenant A must NEVER see data of tenant B (RLS-enforced)
2. **Hierarchical structure:** area → department → team with automatic inheritance
3. **Role-based access:** root, admin, employee, dummy with different privileges
4. **Lead positions:** area lead, department lead, team lead with special rights
5. **Explicit assignment:** no implicit access — everything must be explicitly assigned
6. **Inheritance:** permissions flow top-down through the hierarchy
7. **Cleanup:** assignment changes must clean up inconsistent memberships

### Problem

How do you implement a permission system that is at the same time:

- **Secure** (no accidental access)
- **Flexible** (multiple assignment paths)
- **Performant** (no N+1 queries)
- **Maintainable** (clear rules, no special cases)
- **Understandable** (developers can follow the inheritance logic)

---

## Decision

### 1. Organizational Hierarchy — The four entities

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                              TENANT (company / mandator)                         ║
║                          tenant_id = tenant ID (RLS)                             ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║   ┌─────────────────────────────────────────────────────────────────────────┐     ║
║   │                           AREA                                          │     ║
║   │                                                                         │     ║
║   │  • Physical location (building, hall, warehouse, office)                │     ║
║   │  • area_lead_id → user (area lead)                                      │     ║
║   │  • Highest level of the operational hierarchy                           │     ║
║   │                                                                         │     ║
║   │   ┌─────────────────────────────────────────────────────────────┐       │     ║
║   │   │                    DEPARTMENT                                │       │     ║
║   │   │                                                              │       │     ║
║   │   │  • Organizational unit (IT, production, QA)                  │       │     ║
║   │   │  • department_lead_id → user (department lead)               │       │     ║
║   │   │  • area_id → area (physical assignment, nullable)            │       │     ║
║   │   │                                                              │       │     ║
║   │   │   ┌─────────────────────────────────────────────────┐       │       │     ║
║   │   │   │                    TEAM                          │       │       │     ║
║   │   │   │                                                  │       │       │     ║
║   │   │   │  • Working group inside a department             │       │       │     ║
║   │   │   │  • team_lead_id → user (team lead)               │       │       │     ║
║   │   │   │  • deputy_lead_id → user (deputy)                │       │       │     ║
║   │   │   │  • department_id → department (nullable)         │       │       │     ║
║   │   │   │                                                  │       │       │     ║
║   │   │   │        ┌──────────────────────┐                 │       │       │     ║
║   │   │   │        │   EMPLOYEES (N:M)    │                 │       │       │     ║
║   │   │   │        │   via user_teams     │                 │       │       │     ║
║   │   │   │        └──────────────────────┘                 │       │       │     ║
║   │   │   └─────────────────────────────────────────────────┘       │       │     ║
║   │   └─────────────────────────────────────────────────────────────┘       │     ║
║   └─────────────────────────────────────────────────────────────────────────┘     ║
║                                                                                   ║
║   ┌─────────────────────────────────────────────────────────────────────────┐     ║
║   │                        ASSET (machine/equipment)                        │     ║
║   │                                                                         │     ║
║   │  • Dual assignment: area_id + department_id (both nullable)             │     ║
║   │  • Team assignment via asset_teams (N:M)                                │     ║
║   │  • No own lead — responsibility through department/team                 │     ║
║   └─────────────────────────────────────────────────────────────────────────┘     ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

### 2. Database schema — tables and relationships

#### 2.1 Hierarchy tables (entities)

```sql
-- AREA: highest operational level
areas (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL → tenants(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  area_lead_id           INT NULL → users(id) ON DELETE SET NULL,     -- area lead
  area_deputy_lead_id    INT NULL → users(id) ON DELETE SET NULL,     -- deputy (DEPUTY_EQUALS_LEAD)
  type            areas_type NOT NULL DEFAULT 'other',          -- building, production, warehouse, office, outdoor, other
  is_active       SMALLINT NOT NULL DEFAULT 1,                  -- 0=inactive, 1=active, 3=archived, 4=deleted
  created_by      INT NOT NULL → users(id) ON DELETE RESTRICT,
  uuid            CHAR(36) NOT NULL UNIQUE,
  -- RLS: tenant_isolation policy
)

-- DEPARTMENT: middle level, belongs to an area
departments (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL → tenants(id),
  name                VARCHAR(100) NOT NULL,                        -- UNIQUE per tenant
  department_lead_id          INT NULL → users(id) ON DELETE SET NULL,     -- department lead
  department_deputy_lead_id   INT NULL → users(id) ON DELETE SET NULL,     -- deputy (DEPUTY_EQUALS_LEAD)
  area_id             INT NULL → areas(id) ON DELETE SET NULL,     -- physical assignment
  is_active           SMALLINT NOT NULL DEFAULT 1,
  created_by          INT NULL → users(id) ON DELETE SET NULL,
  uuid                CHAR(36) NOT NULL UNIQUE,
  UNIQUE (tenant_id, name),
  -- RLS: tenant_isolation policy
)

-- TEAM: lowest level, belongs to a department
teams (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL → tenants(id) ON DELETE CASCADE,
  department_id    INT NULL → departments(id) ON DELETE CASCADE,   -- ⚠️ CASCADE: deleting a dept deletes its teams!
  name             VARCHAR(100) NOT NULL,                           -- UNIQUE per department
  team_lead_id          INT NULL → users(id) ON DELETE SET NULL,        -- team lead
  team_deputy_lead_id   INT NULL → users(id) ON DELETE SET NULL,        -- deputy (DEPUTY_EQUALS_LEAD)
  is_active        SMALLINT NULL DEFAULT 1,
  created_by       INT NULL → users(id) ON DELETE SET NULL,
  uuid             CHAR(36) NOT NULL UNIQUE,
  UNIQUE (department_id, name),
  -- RLS: tenant_isolation policy
)

-- ASSET: cross-linked to area + department + teams
assets (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL → tenants(id),
  name             VARCHAR(100) NOT NULL,
  department_id    INT NULL → departments(id) ON DELETE SET NULL,  -- organizational responsibility
  area_id          INT NULL → areas(id) ON DELETE SET NULL,        -- physical location
  status           assets_status DEFAULT 'operational',
  asset_type       assets_asset_type DEFAULT 'production',
  is_active        SMALLINT DEFAULT 1,
  uuid             CHAR(36) NOT NULL UNIQUE,
  -- RLS: tenant_isolation policy
)
```

#### 2.2 Assignment tables (N:M junctions)

```sql
-- EMPLOYEE → DEPARTMENT membership (N:M)
user_departments (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL → tenants(id),
  user_id         INT NOT NULL → users(id) ON DELETE CASCADE,
  department_id   INT NOT NULL → departments(id) ON DELETE CASCADE,
  is_primary      BOOLEAN NOT NULL DEFAULT true,        -- primary department
  assigned_by     INT NULL → users(id) ON DELETE SET NULL,
  assigned_at     TIMESTAMPTZ,
  UNIQUE (user_id, department_id, tenant_id),
  -- RLS: tenant_isolation policy
)

-- EMPLOYEE → TEAM membership (N:M)
user_teams (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL → tenants(id),
  user_id     INT NOT NULL → users(id) ON DELETE CASCADE,
  team_id     INT NOT NULL → teams(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ,
  role        user_teams_role DEFAULT 'member',        -- only 'member' for employees
  UNIQUE (user_id, team_id),
  -- RLS: tenant_isolation policy
)

-- ASSET → TEAM assignment (N:M)
asset_teams (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL → tenants(id),
  asset_id    INT NOT NULL → assets(id) ON DELETE CASCADE,
  team_id     INT NOT NULL → teams(id) ON DELETE CASCADE,
  is_primary  BOOLEAN DEFAULT false,
  assigned_by INT NULL → users(id) ON DELETE SET NULL,
  UNIQUE (tenant_id, asset_id, team_id),
  -- RLS: tenant_isolation policy
)
```

#### 2.3 Admin permission tables (granular RBAC)

```sql
-- ADMIN → AREA permission (granular: read/write/delete)
admin_area_permissions (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL → tenants(id),
  admin_user_id   INT NOT NULL → users(id) ON DELETE CASCADE,
  area_id         INT NOT NULL → areas(id) ON DELETE CASCADE,
  can_read        BOOLEAN NOT NULL DEFAULT true,
  can_write       BOOLEAN NOT NULL DEFAULT false,
  can_delete      BOOLEAN NOT NULL DEFAULT false,
  assigned_by     INT NOT NULL → users(id) ON DELETE RESTRICT,
  assigned_at     TIMESTAMPTZ,
  UNIQUE (admin_user_id, area_id, tenant_id),
)

-- ADMIN → DEPARTMENT permission (granular: read/write/delete)
admin_department_permissions (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL → tenants(id),
  admin_user_id   INT NOT NULL → users(id) ON DELETE CASCADE,
  department_id   INT NOT NULL → departments(id) ON DELETE CASCADE,
  can_read        BOOLEAN DEFAULT true,
  can_write       BOOLEAN DEFAULT false,
  can_delete      BOOLEAN DEFAULT false,
  assigned_by     INT NOT NULL → users(id) ON DELETE RESTRICT,
  assigned_at     TIMESTAMPTZ,
  UNIQUE (tenant_id, admin_user_id, department_id),
)
```

#### 2.4 Users table (relevant columns)

```sql
users (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL → tenants(id),
  role             users_role NOT NULL DEFAULT 'employee',   -- root, admin, employee, dummy
  has_full_access  BOOLEAN NOT NULL DEFAULT false,

  -- CHECK constraints (DB-level enforcement):
  CONSTRAINT chk_root_full_access       CHECK (role != 'root'     OR has_full_access = true),
  CONSTRAINT chk_employee_no_full_access CHECK (role != 'employee' OR has_full_access = false),
  CONSTRAINT chk_dummy_no_full_access   CHECK (role != 'dummy'    OR has_full_access = false),
  CONSTRAINT chk_dummy_display_name     CHECK (role != 'dummy'    OR display_name IS NOT NULL),
)
```

**Meaning of the CHECK constraints:**

| Constraint                    | Rule                                     | Why                                                                 |
| ----------------------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| `chk_root_full_access`        | Root MUST have `has_full_access = true`  | Root has full access by definition — DB prevents inconsistent state |
| `chk_employee_no_full_access` | Employee MUST NOT have `has_full_access` | Employees only see assigned scopes — never everything               |
| `chk_dummy_no_full_access`    | Dummy MUST NOT have `has_full_access`    | Dummy users are placeholders without real rights                    |

### 3. Roles and their access paths

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                              ROLE MODEL                                          ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║  ROOT (role = 'root', has_full_access = true ENFORCED)                           ║
║  ─────────────────────────────────────────────────                                ║
║  • Check: role === 'root' in code                                                ║
║  • DB entries in permission tables: NOT REQUIRED                                 ║
║  • Access: EVERYTHING in the tenant (automatically, CHECK constraint enforces)   ║
║  • New entities: visible immediately without assignment                          ║
║                                                                                   ║
║  ADMIN WITH has_full_access = true                                               ║
║  ───────────────────────────────                                                  ║
║  • Check: has_full_access flag in the users table                                ║
║  • DB entries: NOT REQUIRED (flag overrides everything)                          ║
║  • Access: EVERYTHING in the tenant (like root, but role stays 'admin')          ║
║  • Use case: admin who may see/manage everything without root rights             ║
║                                                                                   ║
║  ADMIN WITH has_full_access = false (default)                                    ║
║  ─────────────────────────────────────────────                                    ║
║  • Check: DB lookup in admin_area_permissions + admin_department_permissions     ║
║  • Assignments: explicit on areas and/or departments                             ║
║  • Inheritance: area assignment → ALL departments in that area automatically     ║
║  • Lead position: area_lead_id / department_lead_id = implicit permission        ║
║                                                                                   ║
║  EMPLOYEE (has_full_access = false ENFORCED)                                     ║
║  ─────────────────────────────────────────────                                    ║
║  • Check: user_teams + user_departments                                          ║
║  • Assignments: teams (N:M) and departments (N:M)                                ║
║  • Inheritance: team → department → area (for visibility/context)                ║
║  • NO write access to organizational management                                  ║
║                                                                                   ║
║  DUMMY (has_full_access = false ENFORCED)                                        ║
║  ──────────────────────────────────────────                                        ║
║  • Placeholder user (e.g. for shift planning without a real account)             ║
║  • No own permissions, no login capability                                       ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

### 4. Lead positions (lead assignments)

Each hierarchy level has a dedicated lead, stored directly as a foreign key on the entity:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        LEAD POSITIONS                                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  areas.area_lead_id → users.id                                                 │
│  ────────────────────────────────                                               │
│  • Who: admin or root (backend-validated: role IN ('admin', 'root'))           │
│  • Rights: equivalent to admin_area_permissions with can_read=true             │
│  • Inheritance: automatically sees ALL departments + teams in this area        │
│  • UI label: dynamic via HierarchyLabels (e.g. "Hall lead")                    │
│                                                                                 │
│  departments.department_lead_id → users.id                                     │
│  ──────────────────────────────────────────                                      │
│  • Who: admin or root (backend-validated: role IN ('admin', 'root'))           │
│  • Rights: equivalent to admin_department_permissions with can_read=true       │
│  • Inheritance: automatically sees ALL teams in this department                │
│  • UI label: dynamic via HierarchyLabels (e.g. "Segment lead")                 │
│                                                                                 │
│  teams.team_lead_id → users.id                                                 │
│  ──────────────────────────────                                                  │
│  • Who: any role with position "team lead" (position-based, not role-based)    │
│  • Rights: sees the team                                                       │
│  • Inheritance: NONE upwards — team view only                                  │
│  • Note: separation of system role and organizational function                 │
│                                                                                 │
│  teams.deputy_lead_id → users.id                                               │
│  ────────────────────────────────                                                │
│  • Deputy team lead                                                            │
│  • Same rights as team_lead_id                                                 │
│                                                                                 │
│  VALIDATION (backend, not a DB constraint):                                    │
│  • Area/department lead: role IN ('admin', 'root') — backend checks            │
│  • Team lead: position = 'Teamleiter' — position-based, role-agnostic          │
│                                                                                 │
│  ON DELETE SET NULL:                                                            │
│  • If the lead user is deleted → lead position becomes NULL                    │
│  • The entity remains, only without a lead                                     │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 5. Inheritance rules (CRITICAL)

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                     PERMISSION INHERITANCE FLOW                                  ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║  ADMIN WITH AREA PERMISSION:                                                     ║
║  ────────────────────────────                                                     ║
║  admin_area_permissions(area_id=1)                                               ║
║      │                                                                            ║
║      ├──▶ Sees area 1                              (DIRECT)                     ║
║      ├──▶ Sees ALL departments WHERE area_id = 1   (INHERITED ↓)                ║
║      └──▶ Sees ALL teams in those departments      (INHERITED ↓↓)               ║
║                                                                                   ║
║  ADMIN WITH DEPARTMENT PERMISSION:                                               ║
║  ──────────────────────────────────                                                ║
║  admin_department_permissions(department_id=11)                                   ║
║      │                                                                            ║
║      ├──▶ Sees department 11                        (DIRECT)                     ║
║      ├──▶ Sees ALL teams WHERE department_id = 11   (INHERITED ↓)               ║
║      └──▶ Sees the area of department 11            (READ-ONLY context ↑)       ║
║                                                                                   ║
║  ADMIN AS LEAD:                                                                  ║
║  ────────────────                                                                 ║
║  areas.area_lead_id = admin.id                                                   ║
║      └──▶ Same rights as area permission             (IMPLICIT)                  ║
║                                                                                   ║
║  departments.department_lead_id = admin.id                                       ║
║      └──▶ Same rights as department permission       (IMPLICIT)                  ║
║                                                                                   ║
║  teams.team_lead_id = admin.id                                                   ║
║      └──▶ Sees the team                              (TEAM ONLY)                ║
║                                                                                   ║
║  EMPLOYEE IN A TEAM:                                                             ║
║  ─────────────────                                                                ║
║  user_teams(team_id=7)                                                           ║
║      │                                                                            ║
║      ├──▶ Sees team 7                                (DIRECT)                   ║
║      ├──▶ Inherits department membership             (teams.department_id ↑)     ║
║      └──▶ Inherits area membership                   (departments.area_id ↑↑)    ║
║                                                                                   ║
║  EMPLOYEE IN A DEPARTMENT:                                                       ║
║  ────────────────────────                                                         ║
║  user_departments(department_id=11)                                              ║
║      │                                                                            ║
║      ├──▶ Sees department 11                         (DIRECT)                    ║
║      └──▶ Inherits area membership                   (departments.area_id ↑)     ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

#### 5.1 Inheritance example (concrete)

```
AREA "Production hall north" (id=1)
│   area_lead_id = Admin.Alpha
│
├── DEPARTMENT "Step manufacturing" (id=11, area_id=1)
│   │   department_lead_id = Admin.Beta
│   │
│   ├── TEAM "Shift A" (id=101, department_id=11)
│   │   │   team_lead_id = Employee.Charlie
│   │   │
│   │   └── Members (user_teams):
│   │       ├── Employee.Dave
│   │       └── Employee.Eve
│   │
│   └── TEAM "Shift B" (id=102, department_id=11)
│       │   team_lead_id = Employee.Frank
│       │
│       └── Members (user_teams):
│           └── Employee.Grace
│
└── DEPARTMENT "Final assembly" (id=12, area_id=1)
    │   department_lead_id = NULL (vacant)
    │
    └── TEAM "Assembly" (id=103, department_id=12)
        └── Members: Employee.Heidi


EFFECT OF THE ASSIGNMENTS:

Admin.Alpha (area_lead_id of area 1):
  → Sees: area 1, dept 11, dept 12, team 101, team 102, team 103
  → Reason: lead position = implicit area permission → inherited everywhere below

Admin.Beta (department_lead_id of dept 11):
  → Sees: dept 11, team 101, team 102
  → Does NOT see: dept 12, team 103 (different department)
  → Sees: area 1 (READ-ONLY context, because dept 11 belongs to area 1)

Employee.Charlie (team_lead_id of team 101, member via user_teams):
  → Sees: team 101
  → Inherits: dept 11 (context), area 1 (context)
  → Does NOT see: team 102 (different team), dept 12

Employee.Dave (member of team 101 via user_teams):
  → Sees: team 101
  → Inherits: dept 11 (context), area 1 (context)

Admin with admin_area_permissions(area_id=1):
  → Sees: area 1, dept 11, dept 12, team 101, 102, 103
  → Identical to area_lead — but without the lead title
```

#### 5.2 NULL handling for inheritance

```
Department.area_id = NULL:
→ NO inheritance from area possible
→ User needs DIRECT admin_department_permissions
→ Or: has_full_access = true

Team.department_id = NULL:
→ NO inheritance from department possible
→ User needs DIRECT user_teams membership
→ Or: has_full_access = true
```

### 6. Permission check flow (backend)

**Service:** `HierarchyPermissionService` (`backend/src/nest/hierarchy-permission/hierarchy-permission.service.ts`)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         ACCESS CHECK FLOW                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

User request → hasAccess(userId, tenantId, resourceType, resourceId, permission)
     │
     ▼
┌─────────────────────────────────────┐
│ 1. Is user.role = 'root'?           │──── YES ──▶ ✅ FULL ACCESS
└─────────────────────────────────────┘
     │ NO
     ▼
┌─────────────────────────────────────┐
│ 2. Is user.has_full_access = true?  │──── YES ──▶ ✅ FULL ACCESS
└─────────────────────────────────────┘
     │ NO
     ▼
┌─────────────────────────────────────┐
│ 3. Check based on                   │
│    resourceType:                    │
└─────────────────────────────────────┘
     │
     ├── resourceType = 'area'
     │       │
     │       └── Direct admin_area_permissions? ────────────▶ ✅/❌
     │
     ├── resourceType = 'department'
     │       │
     │       ├── 1. Direct admin_department_permissions? ────▶ ✅ ACCESS
     │       │
     │       └── 2. Department has area_id?
     │               │
     │               ├── YES → admin_area_permissions for area_id? ▶ ✅ INHERITED
     │               │
     │               └── NO (NULL) ───────────────────────────▶ ❌ NO ACCESS
     │
     └── resourceType = 'team'
             │
             ├── 1. user_teams membership? ──────────────────▶ ✅ ACCESS
             │
             └── 2. Team has department_id?
                     │
                     ├── YES → checkDepartmentAccess() recursive ▶ ✅ INHERITED
                     │         (checks direct dept perm OR area inheritance)
                     │
                     └── NO (NULL) ───────────────────────────▶ ❌ NO ACCESS
```

#### 6.1 Batch access methods (for list filtering)

```typescript
// All accessible area IDs (for UI filters)
getAccessibleAreaIds(userId, tenantId): number[]
  → SELECT area_id FROM admin_area_permissions WHERE admin_user_id = $1

// All accessible department IDs (direct + inherited)
getAccessibleDepartmentIds(userId, tenantId): number[]
  → Direct: SELECT department_id FROM admin_department_permissions WHERE admin_user_id = $1
  → Inherited: SELECT id FROM departments WHERE area_id IN (accessible_area_ids)
  → Merge of both sets

// All accessible team IDs (membership + inherited)
getAccessibleTeamIds(userId, tenantId): number[]
  → Member: SELECT team_id FROM user_teams WHERE user_id = $1
  → Inherited: SELECT id FROM teams WHERE department_id IN (accessible_department_ids)
  → Merge of both sets
```

### 7. Content visibility (org_level pattern)

For features such as calendar, blackboard, documents, `org_level` defines visibility:

| org_level    | Visible to                                                                   |
| ------------ | ---------------------------------------------------------------------------- |
| `company`    | Everyone in the tenant                                                       |
| `area`       | Anyone with area access (permission OR lead OR dept-membership in this area) |
| `department` | Anyone with department access (permission OR lead OR user_departments)       |
| `team`       | Anyone with team access (user_teams OR lead)                                 |
| `personal`   | Only the creator                                                             |

**SQL pattern for visibility queries:**

```sql
SELECT e.* FROM calendar_events e
WHERE e.tenant_id = $1
  AND (
    -- 1. Company: everybody sees it
    e.org_level = 'company'

    -- 2. Area: permission + lead + dept membership
    OR (e.org_level = 'area' AND (
      EXISTS (SELECT 1 FROM admin_area_permissions aap
              WHERE aap.admin_user_id = $2 AND aap.area_id = e.area_id)
      OR EXISTS (SELECT 1 FROM areas a
                 WHERE a.id = e.area_id AND a.area_lead_id = $2)
      OR EXISTS (SELECT 1 FROM user_departments ud
                 JOIN departments d ON ud.department_id = d.id
                 WHERE ud.user_id = $2 AND d.area_id = e.area_id)
    ))

    -- 3. Department: permission + lead + membership + area inheritance
    OR (e.org_level = 'department' AND (
      EXISTS (SELECT 1 FROM admin_department_permissions adp
              WHERE adp.admin_user_id = $2 AND adp.department_id = e.department_id)
      OR EXISTS (SELECT 1 FROM departments d
                 WHERE d.id = e.department_id AND d.department_lead_id = $2)
      OR EXISTS (SELECT 1 FROM user_departments ud
                 WHERE ud.user_id = $2 AND ud.department_id = e.department_id)
      OR EXISTS (SELECT 1 FROM departments d
                 JOIN admin_area_permissions aap ON aap.area_id = d.area_id
                 WHERE d.id = e.department_id AND aap.admin_user_id = $2)
    ))

    -- 4. Team: membership + lead + dept inheritance + area inheritance
    OR (e.org_level = 'team' AND (
      EXISTS (SELECT 1 FROM user_teams ut
              WHERE ut.user_id = $2 AND ut.team_id = e.team_id)
      OR EXISTS (SELECT 1 FROM teams t
                 WHERE t.id = e.team_id AND t.team_lead_id = $2)
      OR EXISTS (SELECT 1 FROM teams t
                 JOIN admin_department_permissions adp ON adp.department_id = t.department_id
                 WHERE t.id = e.team_id AND adp.admin_user_id = $2)
      OR EXISTS (SELECT 1 FROM teams t
                 JOIN departments d ON t.department_id = d.id
                 JOIN admin_area_permissions aap ON aap.area_id = d.area_id
                 WHERE t.id = e.team_id AND aap.admin_user_id = $2)
    ))
  )
```

### 8. Synchronization on permission changes (cleanup)

**Service:** `AdminPermissionsService.cleanupEmployeeMemberships()`

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║           ADMIN PERMISSION SYNCHRONIZATION (setAreaPermissions)                  ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║  WHEN: an admin gets area permissions for area X                                 ║
║  THEN:                                                                            ║
║    1. admin_area_permissions are set (normal)                                    ║
║    2. user_departments OUTSIDE area X are DELETED                                ║
║    3. user_teams for teams in departments OUTSIDE area X are DELETED             ║
║                                                                                   ║
║  EXAMPLE:                                                                        ║
║  ──────────                                                                       ║
║  Admin.Two has:                                                                  ║
║    • admin_area_permissions: area_id=2                                           ║
║    • user_departments: dept_id=11 (area_id=1 — DIFFERENT area!)                  ║
║    • user_teams: team in a dept with area_id=1                                   ║
║                                                                                   ║
║  After setAreaPermissions(areaIds=[2]):                                          ║
║    • admin_area_permissions: ✅ area_id=2 stays                                   ║
║    • user_departments: ❌ dept_id=11 is DELETED (area_id=1 ≠ 2)                  ║
║    • user_teams: ❌ teams in depts outside area 2 are DELETED                    ║
║                                                                                   ║
║  WHY:                                                                            ║
║  ──────                                                                           ║
║  Prevents an admin from seeing content outside their scope through old           ║
║  employee assignments.                                                           ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

**Implementation (SQL logic):**

```sql
-- Step 1: delete teams in departments outside the allowed areas
DELETE FROM user_teams
WHERE user_id = $1
  AND team_id IN (
    SELECT t.id FROM teams t
    JOIN departments d ON t.department_id = d.id
    WHERE d.area_id IS NOT NULL
      AND d.area_id NOT IN ($2, $3, ...)  -- allowed area IDs
  );

-- Step 2: delete departments outside the allowed areas
DELETE FROM user_departments
WHERE user_id = $1
  AND department_id IN (
    SELECT d.id FROM departments d
    WHERE d.area_id IS NOT NULL
      AND d.area_id NOT IN ($2, $3, ...)  -- allowed area IDs
  );
```

### 9. Two separate permission systems

The Assixx system has **two orthogonal permission layers** that work independently of each other:

```
╔════════════════════════════════════════════════════════════════════════════╗
║                    SYSTEM 1: ORGANIZATIONAL HIERARCHY                     ║
║                    "Who sees which areas/departments/teams?"             ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  Tables:                                                                  ║
║  • admin_area_permissions      (admin → area)                             ║
║  • admin_department_permissions (admin → department)                      ║
║  • user_teams                  (employee → team)                          ║
║  • user_departments            (employee → department)                    ║
║  • areas.area_lead_id          (lead → area)                              ║
║  • departments.department_lead_id (lead → department)                    ║
║  • teams.team_lead_id          (lead → team)                              ║
║  • users.has_full_access       (full-access flag)                         ║
║                                                                            ║
║  Service: HierarchyPermissionService                                      ║
║  Question: "Can user X see the data of area/dept/team Y?"               ║
║                                                                            ║
╠════════════════════════════════════════════════════════════════════════════╣
║                    SYSTEM 2: ADDON PERMISSIONS                            ║
║                    "Which features may the user use?"                    ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  Table: user_addon_permissions                                            ║
║  • tenant_id, user_id, addon_code, module_code                           ║
║  • can_read, can_write, can_delete                                       ║
║                                                                            ║
║  Service: UserPermissionsService                                          ║
║  Guard: PermissionGuard + @RequirePermission() decorator                 ║
║  Question: "May user X read/write the 'Blackboard' feature?"             ║
║                                                                            ║
║  Registry pattern: each addon registers its permission categories        ║
║  on OnModuleInit via the PermissionRegistryService.                      ║
║                                                                            ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  INTERPLAY:                                                               ║
║  System 1 decides: "User sees department production"                     ║
║  System 2 decides: "User may read blackboard"                            ║
║  → User sees blackboard entries of department production                 ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
```

### 10. Frontend visualization (badge system)

Assignments are visualized in management tables through a unified badge system:

| Badge type      | CSS class          | Icon         | Use                                       |
| --------------- | ------------------ | ------------ | ----------------------------------------- |
| **Full access** | `badge--primary`   | `fa-globe`   | `has_full_access = true`                  |
| **Count**       | `badge--info`      | —            | N direct assignments, tooltip = names     |
| **Inherited**   | `badge--warning`   | `fa-sitemap` | Access via hierarchy inheritance (orange) |
| **None**        | `badge--secondary` | —            | No assignments                            |

**Badge logic for admins:**

Data sources: `areas[]` + `leadAreas[]` (explicit permissions + lead positions, deduplicated).
Same for: `departments[]` + `leadDepartments[]`. Lead entries get the suffix `(Lead)` in the tooltip.

```
getAreasBadge(admin):
  has_full_access → "All" (globe)
  (areas + leadAreas).length > 0 → "N {label}" (info), tooltip: names
  departments/leadDepartments have areaId → "Inherited" (sitemap, upwards ↑)
  else → "None" (secondary)

getDepartmentsBadge(admin):
  has_full_access → "All" (globe)
  (depts + leadDepts) + (areas + leadAreas) → "N + Inherited"
  only (depts + leadDepts) → "N {label}"
  only (areas + leadAreas) → "Inherited" (sitemap, downwards ↓)
  else → "None"

getTeamsBadge(admin):
  has_full_access → "All" (globe)
  has (areas + leadAreas) OR (depts + leadDepts) → "Inherited" (sitemap)
  else → "None"
```

**API response (`GET /admin-permissions/:id`):**

```json
{
  "areas": [...],            // Explicit admin_area_permissions
  "departments": [...],      // Explicit admin_department_permissions (incl. areaId/areaName)
  "leadAreas": [...],        // Areas WHERE area_lead_id = userId (deduplicated)
  "leadDepartments": [...],  // Departments WHERE department_lead_id = userId (incl. areaId/areaName)
  "hasFullAccess": false
}
```

**Badge logic for employees:**

```
getTeamsBadge(employee):
  teamIds.length > 0 → "N teams" (info)
  else → "Not assigned"

getAreasBadge(employee):
  → ALWAYS inherited from team → department → area
  → "Inherited" (sitemap) with the chain in the tooltip

getDepartmentsBadge(employee):
  → ALWAYS inherited from team → department
  → "Inherited" (sitemap) with tooltip
```

### 11. Foreign key cascades and their consequences

| FK relation                                                | ON DELETE  | Consequence                                                   |
| ---------------------------------------------------------- | ---------- | ------------------------------------------------------------- |
| `departments.area_id → areas`                              | `SET NULL` | Delete area → department remains, but without area assignment |
| `teams.department_id → departments`                        | `CASCADE`  | **⚠️ Delete department → ALL teams are deleted!**             |
| `areas.area_lead_id → users`                               | `SET NULL` | Delete user → area remains without a lead                     |
| `departments.department_lead_id → users`                   | `SET NULL` | Delete user → department remains without a lead               |
| `teams.team_lead_id → users`                               | `SET NULL` | Delete user → team remains without a lead                     |
| `user_teams.user_id → users`                               | `CASCADE`  | Delete user → team memberships are deleted                    |
| `user_teams.team_id → teams`                               | `CASCADE`  | Delete team → team memberships are deleted                    |
| `user_departments.user_id → users`                         | `CASCADE`  | Delete user → department memberships are deleted              |
| `user_departments.department_id → departments`             | `CASCADE`  | Delete department → department memberships are deleted        |
| `admin_area_permissions.admin_user_id → users`             | `CASCADE`  | Delete user → area permissions are deleted                    |
| `admin_area_permissions.area_id → areas`                   | `CASCADE`  | Delete area → area permissions are deleted                    |
| `admin_department_permissions.admin_user_id → users`       | `CASCADE`  | Delete user → dept permissions are deleted                    |
| `admin_department_permissions.department_id → departments` | `CASCADE`  | Delete dept → dept permissions are deleted                    |
| `asset_teams.asset_id → assets`                            | `CASCADE`  | Delete asset → team assignments are deleted                   |
| `asset_teams.team_id → teams`                              | `CASCADE`  | Delete team → asset assignments are deleted                   |

### 12. Guard chain (request lifecycle)

```
HTTP request
     │
     ▼
┌──────────────────────┐
│ 1. JwtAuthGuard      │  → authentication (verify token)
│    (global)          │  → set user object on the request
└──────────────────────┘
     │
     ▼
┌──────────────────────┐
│ 2. RolesGuard        │  → check @Roles('admin', 'root') decorator
│    (global)          │  → role-based access control
└──────────────────────┘
     │
     ▼
┌──────────────────────┐
│ 3. PermissionGuard   │  → @RequirePermission('addon', 'module', 'action')
│    (global)          │  → addon-based feature permission
│                      │  → has_full_access = true → skip
└──────────────────────┘
     │
     ▼
┌──────────────────────┐
│ 4. Service-level     │  → HierarchyPermissionService.hasAccess()
│    (per endpoint)    │  → organizational hierarchy check
│                      │  → called inside the service, not as a guard
└──────────────────────┘
     │
     ▼
┌──────────────────────┐
│ 5. RLS (PostgreSQL)  │  → SET app.tenant_id = $1 before the query
│    (database level)  │  → tenant isolation as the last line of defence
└──────────────────────┘
```

---

## Alternatives Considered

### 1. Flat permission system (Rejected)

Every user has explicit permissions for every single resource.

- ✅ Easy to understand
- ❌ Data volume explodes for large organizations
- ❌ No inheritance
- ❌ Maintenance hell on restructuring

**Decision:** rejected — not scalable.

### 2. RBAC without hierarchy (Rejected)

Fixed roles like "area manager", "department manager" with predefined rights.

- ✅ Industry standard
- ❌ No flexible inheritance
- ❌ Too rigid for organizational changes

**Decision:** rejected — too inflexible for varying company structures.

### 3. Pure PostgreSQL RLS for the hierarchy (partially used)

```sql
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id')::int);
```

- ✅ Watertight at the DB level
- ❌ Hierarchy inheritance in RLS policies is extremely complex
- ❌ Hard to debug

**Decision:** partially used for tenant isolation, but NOT for the hierarchy.

### 4. Central permission table (Rejected)

```sql
permissions (user_id, resource_type, resource_id, permission_type)
```

- ✅ Generic
- ❌ Inheritance hard to model
- ❌ No FK integrity to the resource tables

**Decision:** rejected — too generic, inheritance hard to model.

### 5. JSON arrays for permissions (Rejected)

```sql
users.area_permissions JSONB DEFAULT '[]'
```

- ✅ Flexible structure
- ❌ No foreign keys (referential integrity)
- ❌ Bad query performance
- ❌ No JOINs possible

**Decision:** rejected — N:M tables are more performant and provide integrity.

---

## Consequences

### Positive

1. **Clear hierarchy** — area → department → team is intuitive and matches real company structures
2. **Automatic inheritance** — area permission inherits automatically to departments and teams
3. **Explicit assignment** — no accidental access through implicit rules
4. **Flexible assignment paths** — permission, lead position, and membership as parallel routes
5. **Multi-tenant safe** — `tenant_id` in every table + RLS at DB level
6. **Performant** — EXISTS subqueries with indexes, no N+1 queries
7. **DB-enforced constraints** — CHECK constraints prevent inconsistent states (e.g. employee with has_full_access)
8. **Cleanup logic** — automatic cleanup on permission changes prevents orphan assignments
9. **Two orthogonal systems** — organizational hierarchy and addon permissions are independent and composable
10. **Dynamic labels** — hierarchy labels (ADR-034) allow tenant-specific naming without DB-schema changes

### Negative

1. **Complex queries** — visibility queries with several EXISTS checks per query
2. **Learning curve** — developers must understand the inheritance logic and both systems
3. **Refactor risk** — changes to the hierarchy can have far-reaching effects
4. **CASCADE risk** — `departments → teams` CASCADE can delete teams unintentionally

### Mitigations

| Problem         | Mitigation                                                                |
| --------------- | ------------------------------------------------------------------------- |
| Complex queries | SQL as constants in services, well documented, centralized in one service |
| Learning curve  | This ADR + inline docs + code reviews                                     |
| Refactor risk   | Comprehensive tests, incremental changes                                  |
| CASCADE risk    | UI shows a warning before department deletion ("N teams will be deleted") |

---

## Implementation Details

### Files

```
backend/src/nest/
├── hierarchy-permission/
│   └── hierarchy-permission.service.ts          # central permission logic with inheritance
├── admin-permissions/
│   ├── admin-permissions.controller.ts          # API endpoints for area/dept permissions
│   ├── admin-permissions.service.ts             # CRUD + cleanup logic
│   └── dto/
│       ├── set-area-permissions.dto.ts          # { areaIds: number[], permissions?: PermissionSet }
│       └── permission-set.schema.ts             # { canRead, canWrite, canDelete }
├── user-permissions/
│   ├── user-permissions.service.ts              # addon permission logic
│   └── user-permissions.controller.ts           # addon permission CRUD
├── common/
│   ├── guards/
│   │   ├── jwt-auth.guard.ts                    # authentication
│   │   ├── roles.guard.ts                       # @Roles() decorator
│   │   └── permission.guard.ts                  # @RequirePermission() decorator
│   ├── decorators/
│   │   ├── current-user.decorator.ts            # @CurrentUser()
│   │   └── require-permission.decorator.ts      # @RequirePermission()
│   └── permission-registry/
│       ├── permission.types.ts                  # PermissionCategoryDef
│       └── permission-registry.service.ts       # registry for addon permissions
├── organigram/
│   ├── organigram.service.ts                    # org-chart tree with leads + member counts
│   ├── organigram.controller.ts                 # GET /tree, GET/PATCH /hierarchy-labels
│   └── organigram.types.ts                      # OrgChartNode, HierarchyLabels
├── areas/areas.service.ts                       # CRUD areas + area_lead_id management
├── departments/departments.service.ts           # CRUD departments + department_lead_id
└── teams/teams.service.ts                       # CRUD teams + team_lead_id + user_teams

frontend/src/
├── routes/(app)/(admin)/
│   ├── manage-admins/
│   │   ├── +page.svelte                         # admin list with badge columns
│   │   ├── +page.server.ts                      # parallel fetch: admins + areas + depts + permissions
│   │   └── _lib/
│   │       ├── AdminFormModal.svelte             # form with AdminOrganizationSection
│   │       ├── AdminOrganizationSection.svelte   # full-access toggle + area/dept multi-select
│   │       ├── AdminTableRow.svelte              # badge display per admin row
│   │       ├── utils.ts                          # getAreasBadge, getDepartmentsBadge, getTeamsBadge
│   │       ├── filters.ts                        # filterAvailableDepartments (removes depts of selected areas)
│   │       └── api.ts                            # saveAdminWithPermissions, setFullAccess
│   └── manage-employees/
│       ├── +page.svelte                         # employee list with inherited badges
│       ├── +page.server.ts                      # fetch: employees + teams
│       └── _lib/
│           ├── EmployeeFormModal.svelte          # team multi-select
│           ├── EmployeeTableRow.svelte           # inherited area/dept badges
│           ├── utils.ts                          # inheritance badge logic
│           └── api.ts                            # syncTeamMemberships (diff-based)
├── lib/
│   ├── types/hierarchy-labels.ts                # HierarchyLabels type + defaults + resolvePositionDisplay
│   └── components/
│       ├── Breadcrumb.svelte                    # dynamic labels in breadcrumbs
│       └── PermissionSettings.svelte            # addon permission matrix (addon × module × R/W/D)
└── routes/(app)/_lib/
    └── navigation-config.ts                     # dynamic sidebar labels via HierarchyLabels
```

### API endpoints

| Method | Path                                             | Description                         | Roles       |
| ------ | ------------------------------------------------ | ----------------------------------- | ----------- |
| GET    | `/admin-permissions/:userId`                     | All permissions of an admin         | Root, admin |
| POST   | `/admin-permissions/:userId/areas`               | Set area permissions (+ cleanup)    | Root        |
| DELETE | `/admin-permissions/:userId/areas/:areaId`       | Remove a single area permission     | Root        |
| POST   | `/admin-permissions`                             | Set department permissions          | Root        |
| DELETE | `/admin-permissions/:userId/departments/:deptId` | Remove a single dept permission     | Root        |
| PATCH  | `/admin-permissions/:userId/full-access`         | Set/remove the has_full_access flag | Root        |
| GET    | `/user-permissions/:uuid`                        | Addon permissions of a user         | Root, admin |
| PUT    | `/user-permissions/:uuid`                        | Set addon permissions               | Root, admin |
| POST   | `/teams/:teamId/members`                         | Add a user to a team                | Root, admin |
| DELETE | `/teams/:teamId/members/:userId`                 | Remove a user from a team           | Root, admin |

### Database tables

| Table                          | Purpose                                 | Type       |
| ------------------------------ | --------------------------------------- | ---------- |
| `areas`                        | Physical areas (level 1)                | Entity     |
| `departments`                  | Organizational units (level 2)          | Entity     |
| `teams`                        | Working groups (level 3)                | Entity     |
| `assets`                       | Machines/equipment (cross-cutting)      | Entity     |
| `admin_area_permissions`       | Admin → area access                     | Permission |
| `admin_department_permissions` | Admin → department access               | Permission |
| `user_teams`                   | Employee → team membership              | Membership |
| `user_departments`             | Employee → department membership        | Membership |
| `asset_teams`                  | Asset → team assignment                 | Assignment |
| `user_addon_permissions`       | User → addon feature access             | Permission |
| `users.has_full_access`        | Full-access flag                        | Flag       |
| `users.role`                   | System role (root/admin/employee/dummy) | Enum       |

---

## Verification

| Scenario                          | Expected                                           | Status |
| --------------------------------- | -------------------------------------------------- | ------ |
| Root user                         | Sees everything in the tenant                      | ✅     |
| Admin with has_full_access=true   | Sees everything in the tenant                      | ✅     |
| Admin with area permission        | Sees area + all depts + all teams                  | ✅     |
| Admin with dept permission        | Sees dept + all teams in the dept                  | ✅     |
| Admin as area_lead                | Same rights as area permission                     | ✅     |
| Admin as department_lead          | Same rights as dept permission                     | ✅     |
| Admin as team_lead                | Sees only the team                                 | ✅     |
| Employee in a team                | Sees the team, inherits dept + area context        | ✅     |
| Employee in a department          | Sees the department, inherits area context         | ✅     |
| Admin without permissions         | Sees only company-level content                    | ✅     |
| Cross-tenant access               | Blocked through tenant_id filter + RLS             | ✅     |
| setAreaPermissions cleanup        | Removes user_departments outside the areas         | ✅     |
| setAreaPermissions cleanup        | Removes user_teams outside the areas               | ✅     |
| Department.area_id = NULL         | No area inheritance, direct permission required    | ✅     |
| Team.department_id = NULL         | No dept inheritance, direct membership required    | ✅     |
| Root has has_full_access=false    | DB CHECK constraint prevents this                  | ✅     |
| Employee has has_full_access=true | DB CHECK constraint prevents this                  | ✅     |
| Delete department                 | CASCADE: all teams are deleted with it             | ✅     |
| Delete area                       | SET NULL: departments remain, area_id becomes NULL | ✅     |
| Delete a lead user                | SET NULL: entity remains, lead becomes NULL        | ✅     |

---

## Lead positions and permission delegation (2026-03-14)

Lead positions and deputies on all 3 levels (since the deputy-leads feature, 2026-03-21):

| Table         | Lead column          | Deputy column               |
| ------------- | -------------------- | --------------------------- |
| `areas`       | `area_lead_id`       | `area_deputy_lead_id`       |
| `departments` | `department_lead_id` | `department_deputy_lead_id` |
| `teams`       | `team_lead_id`       | `team_deputy_lead_id`       |

Deputies have identical scope rights as their leads (DEPUTY_EQUALS_LEAD):

1. **Scope access:** leads + deputies see/manage entities in their scope (manage pages)
2. **Permission delegation:** leads/deputies with `manage-permissions` can manage the addon permissions of their subordinates
3. **DB trigger:** `trg_enforce_manage_permissions_target_is_lead` — `manage-permissions` can ONLY be granted to users with a lead or deputy position
4. **DB trigger:** `trg_validate_team_lead_position` — `team_lead_id`/`team_deputy_lead_id` must have `position='team_lead'`
5. **DB trigger:** `trg_validate_area_deputy_lead` / `trg_validate_dept_deputy_lead` — deputies must have role admin/root
6. **DB trigger:** `trg_validate_dept_lead` / `trg_validate_area_lead` — dept/area leads must be admin/root

**Consequence:** removing a lead (SET NULL) removes scope access + delegation rights. Auto cleanup in `TeamsService.cleanupLeadPermissions()`.

---

## References

- [ADR-005: Authentication Strategy](./ADR-005-authentication-strategy.md) — JWT guard
- [ADR-006: Multi-Tenant Context Isolation](./ADR-006-multi-tenant-context-isolation.md) — CLS-based tenant isolation
- [ADR-009: User Role Assignment & Permissions](./ADR-009-user-role-assignment-permissions.md) — original permission system (predecessor)
- [ADR-019: Multi-Tenant RLS Data Isolation](./ADR-019-multi-tenant-rls-isolation.md) — PostgreSQL RLS
- [ADR-020: Per-User Feature Permissions](./ADR-020-per-user-feature-permissions.md) — addon-based feature permissions
- [ADR-033: Addon-based SaaS Model](./ADR-033-addon-based-saas-model.md) — core vs. purchasable addons
- [ADR-034: Hierarchy Labels Propagation](./ADR-034-hierarchy-labels-propagation.md) — dynamic UI labels
- [ADR-036: Organizational Scope Access Control](./ADR-036-organizational-scope-access-control.md) — scope-based access control for manage pages (employee leads + scoped admins)
- [HIERARCHY.md](/docs/HIERARCHY.md) — historical organizational structure documentation
- [Refactoring Assignment Plan](/docs/plans/refactoring-assignment-plan.md) — H-RBAC design decisions
- [Refactoring Assignment Concrete Plan](/docs/plans/refactoring-assignment-concrete-plan.md) — implementation details
- [Lead-ID Assignment Fix](/docs/plans/ASSIGNED-LEAD_ID-SOLUTION.md) — chat search lead-path fix
