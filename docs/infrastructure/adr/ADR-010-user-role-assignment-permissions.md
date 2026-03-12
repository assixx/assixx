# ADR-009: User Role Assignment & Permission System

| Metadata                | Value                                                            |
| ----------------------- | ---------------------------------------------------------------- |
| **Status**              | Accepted                                                         |
| **Date**                | 2026-01-22                                                       |
| **Decision Makers**     | SCS Technik                                                      |
| **Affected Components** | All Services, All Features, Database, Guards, Content Visibility |

---

## Context

Assixx is a Multi-Tenant SaaS application for industrial companies. The permission system is the **heart of the application** and defines:

1. **Who can see what?** (Content Visibility)
2. **Who can manage what?** (Management Permissions)
3. **How are permissions inherited?** (Hierarchical Inheritance)

### Requirements

- **Multi-Tenant Isolation**: Tenant A must NEVER see data from Tenant B
- **Hierarchical Structure**: Area → Department → Team
- **Role-Based Access**: Root, Admin, Employee with different privileges
- **Inheritance**: Permissions flow from top to bottom through the hierarchy
- **Explicit Assignment**: No implicit access - everything must be explicitly assigned
- **Lead Positions**: Special privileges for Area/Department/Team Leaders

### Problem

How to implement a permission system that is:

1. Secure (no accidental access)
2. Flexible (multiple assignment paths)
3. Performant (no N+1 queries)
4. Maintainable (clear rules, no special cases)

---

## Decision

### 1. Organization Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TENANT (Company)                                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         AREA                               │   │
│  │                         areas.area_lead_id → User                    │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │                    DEPARTMENT                    │    │   │
│  │  │                    departments.area_id → Area                │    │   │
│  │  │                    departments.department_lead_id → User     │    │   │
│  │  │                                                              │    │   │
│  │  │  ┌─────────────────────────────────────────────────────┐    │    │   │
│  │  │  │                      TEAM                            │    │    │   │
│  │  │  │                      teams.department_id → Dept      │    │    │   │
│  │  │  │                      teams.team_lead_id → User       │    │    │   │
│  │  │  │                                                      │    │    │   │
│  │  │  │              ┌─────────────────────┐                │    │    │   │
│  │  │  │              │     EMPLOYEES       │                │    │    │   │
│  │  │  │              │   (user_teams)      │                │    │    │   │
│  │  │  │              └─────────────────────┘                │    │    │   │
│  │  │  └─────────────────────────────────────────────────────┘    │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Roles and Access Paths

| Role         | has_full_access | Assignment Tables                                    | Sees                                  |
| ------------ | --------------- | ---------------------------------------------------- | ------------------------------------- |
| **Root**     | true            | None required                                        | EVERYTHING in the tenant              |
| **Admin**    | false (default) | admin_area_permissions, admin_department_permissions | Only explicitly assigned levels       |
| **Admin**    | true            | None required                                        | EVERYTHING in the tenant (wie Root)   |
| **Employee** | -               | user_teams, user_departments                         | Only assigned team + inherited access |

### 3. Database Tables

#### 3.1 Membership (Employees)

```sql
-- Employee belongs to Department
user_departments (
  user_id        → users.id,
  department_id  → departments.id,
  is_primary     BOOLEAN,           -- Primary department
  tenant_id      → tenants.id
)

-- Employee belongs to Team
user_teams (
  user_id   → users.id,
  team_id   → teams.id,
  role      ENUM('member'),         -- Only member for Employees
  tenant_id → tenants.id
)
```

#### 3.2 Permissions (Admins)

```sql
-- Admin has Area Permission
admin_area_permissions (
  admin_user_id → users.id,
  area_id       → areas.id,
  can_read      BOOLEAN,
  can_write     BOOLEAN,
  can_delete    BOOLEAN,
  tenant_id     → tenants.id
)

-- Admin has Department Permission
admin_department_permissions (
  admin_user_id → users.id,
  department_id → departments.id,
  can_read      BOOLEAN,
  can_write     BOOLEAN,
  can_delete    BOOLEAN,
  tenant_id     → tenants.id
)
```

#### 3.3 Lead-Positionen

```sql
-- In their respective tables (backend-validated)
areas.area_lead_id             → users.id (admin/root role, validated)
departments.department_lead_id → users.id (admin/root role, validated)
teams.team_lead_id             → users.id (position = 'Teamleiter', validated)
```

> **Note (2026-03):** Team leaders use position-based validation (any role with
> position "Teamleiter") to separate system role from organizational function.
> Area/Department leaders use role-based validation (admin/root only).

### 4. Inheritance Rules (CRITICAL)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                        PERMISSION INHERITANCE FLOW                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  ADMIN WITH AREA PERMISSION:                                                   ║
║  ─────────────────────────                                                    ║
║  admin_area_permissions(area_id=1)                                            ║
║      │                                                                        ║
║      ├──▶ Sees Area 1                                                        ║
║      ├──▶ Sees ALL Departments WHERE area_id = 1                            ║
║      └──▶ Sees ALL Teams WHERE department.area_id = 1                       ║
║                                                                               ║
║  ADMIN WITH DEPARTMENT PERMISSION:                                             ║
║  ────────────────────────────────                                             ║
║  admin_department_permissions(department_id=11)                               ║
║      │                                                                        ║
║      ├──▶ Sees Department 11                                                 ║
║      ├──▶ Sees ALL Teams WHERE department_id = 11                           ║
║      └──▶ Sees Area of Department 11 (READ-ONLY context)                    ║
║                                                                               ║
║  ADMIN AS LEAD:                                                              ║
║  ───────────────                                                              ║
║  areas.area_lead_id = admin.id                                                ║
║      └──▶ Same rights as Area Permission                                  ║
║                                                                               ║
║  departments.department_lead_id = admin.id                                    ║
║      └──▶ Same rights as Department Permission                            ║
║                                                                               ║
║  teams.team_lead_id = admin.id                                                ║
║      └──▶ Sees Team                                                          ║
║                                                                               ║
║  EMPLOYEE IN TEAM:                                                            ║
║  ─────────────────                                                            ║
║  user_teams(team_id=7)                                                        ║
║      │                                                                        ║
║      ├──▶ Sees Team 7                                                        ║
║      ├──▶ Inherits Department membership (teams.department_id)                 ║
║      └──▶ Inherits Area membership (departments.area_id)                       ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 5. Content Visibility (org_level)

For features like Calendar, Blackboard, Documents etc., `org_level` defines visibility:

| org_level    | Visible to                                                               |
| ------------ | ------------------------------------------------------------------------ |
| `company`    | Everyone in the tenant                                                   |
| `area`       | Everyone with Area access (Permission OR Lead OR Dept in Area)           |
| `department` | Everyone with Department access (Permission OR Lead OR user_departments) |
| `team`       | Everyone with Team access (user_teams OR Lead)                           |
| `personal`   | Only the creator                                                         |

### 6. SQL Query Pattern for Visibility

```sql
-- Permission-based visibility (for Admins without has_full_access)
SELECT e.* FROM calendar_events e
WHERE e.tenant_id = $1
  AND (
    -- 1. Company: Everyone sees
    e.org_level = 'company'

    -- 2. Area: Check Permissions + Lead + Dept membership
    OR (e.org_level = 'area' AND (
      EXISTS (SELECT 1 FROM admin_area_permissions aap
              WHERE aap.admin_user_id = $2 AND aap.area_id = e.area_id)
      OR EXISTS (SELECT 1 FROM areas a
                 WHERE a.id = e.area_id AND a.area_lead_id = $2)
      OR EXISTS (SELECT 1 FROM user_departments ud
                 JOIN departments d ON ud.department_id = d.id
                 WHERE ud.user_id = $2 AND d.area_id = e.area_id)
    ))

    -- 3. Department: Check Permissions + Lead + Membership + Area inheritance
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

    -- 4. Team: Check Membership + Lead + Dept inheritance + Area inheritance
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

### 7. Access Check Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ACCESS CHECK FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

User Request
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
│ 3. Check explicit permissions       │
│    based on resource org_level      │
└─────────────────────────────────────┘
     │
     ├── org_level = 'company' ──────────────────▶ ✅ ACCESS
     │
     ├── org_level = 'area'
     │       │
     │       ├── admin_area_permissions? ────────▶ ✅ ACCESS
     │       ├── areas.area_lead_id? ────────────▶ ✅ ACCESS
     │       └── user in dept with area_id? ─────▶ ✅ ACCESS
     │
     ├── org_level = 'department'
     │       │
     │       ├── admin_department_permissions? ──▶ ✅ ACCESS
     │       ├── departments.department_lead_id? ▶ ✅ ACCESS
     │       ├── user_departments? ──────────────▶ ✅ ACCESS
     │       └── area permission for parent? ────▶ ✅ ACCESS (inheritance)
     │
     ├── org_level = 'team'
     │       │
     │       ├── user_teams? ────────────────────▶ ✅ ACCESS
     │       ├── teams.team_lead_id? ────────────▶ ✅ ACCESS
     │       ├── dept permission for parent? ────▶ ✅ ACCESS (inheritance)
     │       └── area permission for grandparent?▶ ✅ ACCESS (inheritance)
     │
     └── org_level = 'personal'
             │
             └── user_id = creator_id? ──────────▶ ✅ ACCESS
                     │
                     └── else ───────────────────▶ ❌ NO ACCESS
```

### 8. Admin Permission Synchronization (Auto-Cleanup)

When setting Area Permissions for an Admin, employee assignments are automatically cleaned up:

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║           ADMIN PERMISSION SYNCHRONIZATION (setAreaPermissions)               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  WHEN: Admin receives Area Permissions for Area X                              ║
║  THEN:                                                                        ║
║    1. admin_area_permissions are set (as expected)                    ║
║    2. user_departments outside Area X are DELETED                       ║
║    3. user_teams for Teams in Departments outside Area X are DELETED    ║
║                                                                               ║
║  EXAMPLE:                                                                    ║
║  ──────────                                                                   ║
║  Admin.two has:                                                              ║
║    - admin_area_permissions: area_id=2 ("nobody")                            ║
║    - user_departments: dept_id=11 ("Step Grates", area_id=1 "Prod Hall")     ║
║                                                                               ║
║  Nach setAreaPermissions(areaIds=[2]):                                        ║
║    - admin_area_permissions: ✅ area_id=2 remains                              ║
║    - user_departments: ❌ dept_id=11 is DELETED (area_id=1 ≠ 2)            ║
║                                                                               ║
║  WHY:                                                                       ║
║  ──────                                                                       ║
║  Prevents an Admin from seeing events/content outside their Area         ║
║  through old employee assignments.                                             ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

**Implementierung:** `AdminPermissionsService.cleanupEmployeeMemberships()`

```typescript
// When setting Area Permissions:
async setAreaPermissions(userId, areaIds, ...) {
  // 1. Set admin permissions
  await this.insertAreaPermissions(userId, areaIds);

  // 2. Clean up employee assignments outside the areas
  await this.cleanupEmployeeMemberships(userId, areaIds, tenantId);
}
```

---

## Alternatives Considered

### 1. Flat Permission System (Rejected)

```
Each user has explicit permissions for every resource.
+ Easy to understand
- Data volume explosion
- No inheritance
- Maintenance nightmare during restructuring
```

**Decision:** Rejected - Not scalable.

### 2. RBAC (Role-Based Access Control) without Hierarchy (Rejected)

```
Roles like "Area Manager", "Department Manager" with fixed privileges.
+ Industry standard
- No flexible inheritance
- Rigid during organizational changes
```

**Decision:** Rejected - Too inflexible for different company structures.

### 3. PostgreSQL Row-Level Security (Partially Used)

```sql
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id')::int);
```

**Decision:** Partially used for tenant isolation, but not for the hierarchy.

### 4. Central Permission Table (Rejected)

```sql
permissions (
  user_id, resource_type, resource_id, permission_type
)
```

**Decision:** Rejected - Too generic, inheritance difficult to model.

---

## Consequences

### Positive

1. **Clear Hierarchy** - Area → Department → Team is intuitive
2. **Automatic Inheritance** - Changes propagate automatically
3. **Explicit Assignment** - No accidental access
4. **Flexible** - Multiple assignment paths (Permission, Lead, Membership)
5. **Multi-Tenant secure** - tenant_id in every table
6. **Performant** - EXISTS subqueries with indexes

### Negative

1. **Complex Queries** - Multiple EXISTS checks per query
2. **Learning Curve** - Developers must understand inheritance logic
3. **Refactoring Risk** - Changes can have far-reaching effects

### Mitigations

| Problem         | Mitigation                               |
| --------------- | ---------------------------------------- |
| Complex Queries | SQL as constants, well documented        |
| Learning Curve  | ADR + inline docs + code reviews         |
| Refactoring     | Comprehensive tests, incremental changes |

---

## Implementation Details

### Files

```
backend/src/nest/
├── common/
│   ├── guards/
│   │   └── jwt-auth.guard.ts              # Sets CLS context with user
│   ├── interceptors/
│   │   └── tenant-context.interceptor.ts  # Backup for tenant context
│   └── decorators/
│       └── current-user.decorator.ts      # @CurrentUser() decorator
├── calendar/
│   └── calendar.service.ts                # Example with permission query
└── ...
```

### Key Constants

```typescript
// PERMISSION_BASED_COUNT_QUERY in calendar.service.ts
// Implements the full permission check flow for calendar events
```

### Database Tables

| Table                            | Purpose                                                |
| -------------------------------- | ------------------------------------------------------ |
| `users.has_full_access`          | Full access flag                                       |
| `admin_area_permissions`         | Admin → Area assignments                               |
| `admin_department_permissions`   | Admin → Department assignments                         |
| `user_departments`               | Employee → Department membership                       |
| `user_teams`                     | Employee → Team membership                             |
| `areas.area_lead_id`             | Area leader (admin/root role, backend-validated)       |
| `departments.department_lead_id` | Dept leader (admin/root role, backend-validated)       |
| `teams.team_lead_id`             | Team leader (position "Teamleiter", backend-validated) |

---

## Verification

| Scenario                        | Expected                                | Status |
| ------------------------------- | --------------------------------------- | ------ |
| Root user                       | Sees everything in tenant               | ✅     |
| Admin with has_full_access=true | Sees everything in tenant               | ✅     |
| Admin with area permission      | Sees area + all depts + all teams       | ✅     |
| Admin with dept permission      | Sees dept + all teams in dept           | ✅     |
| Admin as area_lead              | Same as area permission                 | ✅     |
| Admin as department_lead        | Same as dept permission                 | ✅     |
| Admin as team_lead              | Sees team only                          | ✅     |
| Employee in team                | Sees team, inherits dept + area context | ✅     |
| Admin without any permissions   | Sees only company-level content         | ✅     |
| Cross-tenant access attempt     | Blocked by tenant_id filter             | ✅     |
| setAreaPermissions cleanup      | Removes user_departments outside areas  | ✅     |
| setAreaPermissions cleanup      | Removes user_teams outside areas        | ✅     |

---

## References

- [ADR-006: Multi-Tenant Context Isolation](./ADR-006-multi-tenant-context-isolation.md)
- [ADR-005: Authentication Strategy](./ADR-005-authentication-strategy.md)
- [ULTIMATE-PERMISSION-SYSTEM.md](/docs/ULTIMATE-PERMISSION-SYSTEM.md)
- [refactoring-assignment-concrete-plan.md](/docs/refactoring-assignment-concrete-plan.md)
- [ASSIGNED-LEAD_ID-SOLUTION.md](/docs/ASSIGNED-LEAD_ID-SOLUTION.md)
