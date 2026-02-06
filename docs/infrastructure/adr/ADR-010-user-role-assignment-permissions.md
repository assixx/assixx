# ADR-009: User Role Assignment & Permission System

| Metadata                | Value                                                            |
| ----------------------- | ---------------------------------------------------------------- |
| **Status**              | Accepted                                                         |
| **Date**                | 2026-01-22                                                       |
| **Decision Makers**     | SCS Technik                                                      |
| **Affected Components** | All Services, All Features, Database, Guards, Content Visibility |

---

## Context

Assixx ist eine Multi-Tenant SaaS-Anwendung für industrielle Unternehmen. Das Permission-System ist das **Herzstück der Anwendung** und definiert:

1. **Wer darf was sehen?** (Content Visibility)
2. **Wer darf was verwalten?** (Management Permissions)
3. **Wie vererben sich Berechtigungen?** (Hierarchical Inheritance)

### Anforderungen

- **Multi-Tenant Isolation**: Tenant A darf NIEMALS Daten von Tenant B sehen
- **Hierarchische Struktur**: Area → Department → Team
- **Rollenbasierter Zugriff**: Root, Admin, Employee mit unterschiedlichen Rechten
- **Vererbung**: Berechtigungen fließen von oben nach unten durch die Hierarchie
- **Explizite Zuweisung**: Kein impliziter Zugriff - alles muss explizit zugewiesen werden
- **Lead-Positionen**: Sonderrechte für Area/Department/Team-Leader

### Problem

Wie implementiert man ein Permission-System das:

1. Sicher ist (keine versehentlichen Zugriffe)
2. Flexibel ist (verschiedene Zuweisungswege)
3. Performant ist (keine N+1 Queries)
4. Wartbar ist (klare Regeln, keine Sonderfälle)

---

## Decision

### 1. Organisationshierarchie

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TENANT (Firma)                                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         AREA (Bereich)                               │   │
│  │                         areas.area_lead_id → User                    │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │                    DEPARTMENT (Abteilung)                    │    │   │
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

### 2. Rollen und Zugriffspfade

| Rolle        | has_full_access | Zuweisungstabellen                                   | Sieht                             |
| ------------ | --------------- | ---------------------------------------------------- | --------------------------------- |
| **Root**     | true            | Keine nötig                                          | ALLES im Tenant                   |
| **Admin**    | false (default) | admin_area_permissions, admin_department_permissions | Nur explizit zugewiesene Ebenen   |
| **Admin**    | true            | Keine nötig                                          | ALLES im Tenant (wie Root)        |
| **Employee** | -               | user_teams, user_departments                         | Nur zugewiesenes Team + Vererbung |

### 3. Datenbank-Tabellen

#### 3.1 Zugehörigkeit (Employees)

```sql
-- Employee gehört zu Department
user_departments (
  user_id        → users.id,
  department_id  → departments.id,
  is_primary     BOOLEAN,           -- Hauptabteilung
  tenant_id      → tenants.id
)

-- Employee gehört zu Team
user_teams (
  user_id   → users.id,
  team_id   → teams.id,
  role      ENUM('member'),         -- Nur member für Employees
  tenant_id → tenants.id
)
```

#### 3.2 Permissions (Admins)

```sql
-- Admin hat Area-Permission
admin_area_permissions (
  admin_user_id → users.id,
  area_id       → areas.id,
  can_read      BOOLEAN,
  can_write     BOOLEAN,
  can_delete    BOOLEAN,
  tenant_id     → tenants.id
)

-- Admin hat Department-Permission
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
-- In den jeweiligen Tabellen
areas.area_lead_id             → users.id (nur root/admin)
departments.department_lead_id → users.id (nur root/admin)
teams.team_lead_id             → users.id (nur root/admin)
```

### 4. Vererbungsregeln (KRITISCH)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                        PERMISSION INHERITANCE FLOW                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  ADMIN MIT AREA-PERMISSION:                                                   ║
║  ─────────────────────────                                                    ║
║  admin_area_permissions(area_id=1)                                            ║
║      │                                                                        ║
║      ├──▶ Sieht Area 1                                                        ║
║      ├──▶ Sieht ALLE Departments WHERE area_id = 1                            ║
║      └──▶ Sieht ALLE Teams WHERE department.area_id = 1                       ║
║                                                                               ║
║  ADMIN MIT DEPARTMENT-PERMISSION:                                             ║
║  ────────────────────────────────                                             ║
║  admin_department_permissions(department_id=11)                               ║
║      │                                                                        ║
║      ├──▶ Sieht Department 11                                                 ║
║      ├──▶ Sieht ALLE Teams WHERE department_id = 11                           ║
║      └──▶ Sieht Area von Department 11 (READ-ONLY Kontext)                    ║
║                                                                               ║
║  ADMIN ALS LEAD:                                                              ║
║  ───────────────                                                              ║
║  areas.area_lead_id = admin.id                                                ║
║      └──▶ Gleiche Rechte wie Area-Permission                                  ║
║                                                                               ║
║  departments.department_lead_id = admin.id                                    ║
║      └──▶ Gleiche Rechte wie Department-Permission                            ║
║                                                                               ║
║  teams.team_lead_id = admin.id                                                ║
║      └──▶ Sieht Team                                                          ║
║                                                                               ║
║  EMPLOYEE IN TEAM:                                                            ║
║  ─────────────────                                                            ║
║  user_teams(team_id=7)                                                        ║
║      │                                                                        ║
║      ├──▶ Sieht Team 7                                                        ║
║      ├──▶ Erbt Department-Zugehörigkeit (teams.department_id)                 ║
║      └──▶ Erbt Area-Zugehörigkeit (departments.area_id)                       ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 5. Content Visibility (org_level)

Für Features wie Calendar, Blackboard, Documents etc. definiert `org_level` die Sichtbarkeit:

| org_level    | Sichtbar für                                                             |
| ------------ | ------------------------------------------------------------------------ |
| `company`    | Alle im Tenant                                                           |
| `area`       | Alle mit Area-Zugriff (Permission ODER Lead ODER Dept in Area)           |
| `department` | Alle mit Department-Zugriff (Permission ODER Lead ODER user_departments) |
| `team`       | Alle mit Team-Zugriff (user_teams ODER Lead)                             |
| `personal`   | Nur der Ersteller                                                        |

### 6. SQL Query Pattern für Visibility

```sql
-- Permission-basierte Sichtbarkeit (für Admins ohne has_full_access)
SELECT e.* FROM calendar_events e
WHERE e.tenant_id = $1
  AND (
    -- 1. Company: Alle sehen
    e.org_level = 'company'

    -- 2. Area: Check Permissions + Lead + Dept-Zugehörigkeit
    OR (e.org_level = 'area' AND (
      EXISTS (SELECT 1 FROM admin_area_permissions aap
              WHERE aap.admin_user_id = $2 AND aap.area_id = e.area_id)
      OR EXISTS (SELECT 1 FROM areas a
                 WHERE a.id = e.area_id AND a.area_lead_id = $2)
      OR EXISTS (SELECT 1 FROM user_departments ud
                 JOIN departments d ON ud.department_id = d.id
                 WHERE ud.user_id = $2 AND d.area_id = e.area_id)
    ))

    -- 3. Department: Check Permissions + Lead + Zugehörigkeit + Area-Vererbung
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

    -- 4. Team: Check Membership + Lead + Dept-Vererbung + Area-Vererbung
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

Beim Setzen von Area-Permissions für einen Admin werden automatisch die Employee-Zuordnungen bereinigt:

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║           ADMIN PERMISSION SYNCHRONIZATION (setAreaPermissions)               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  WENN: Admin bekommt Area-Permissions für Area X                              ║
║  DANN:                                                                        ║
║    1. admin_area_permissions werden gesetzt (wie erwartet)                    ║
║    2. user_departments außerhalb Area X werden GELÖSCHT                       ║
║    3. user_teams für Teams in Departments außerhalb Area X werden GELÖSCHT    ║
║                                                                               ║
║  BEISPIEL:                                                                    ║
║  ──────────                                                                   ║
║  Admin.zwei hat:                                                              ║
║    - admin_area_permissions: area_id=2 ("niemand")                            ║
║    - user_departments: dept_id=11 ("Stufenroste", area_id=1 "Halle Prod")     ║
║                                                                               ║
║  Nach setAreaPermissions(areaIds=[2]):                                        ║
║    - admin_area_permissions: ✅ area_id=2 bleibt                              ║
║    - user_departments: ❌ dept_id=11 wird GELÖSCHT (area_id=1 ≠ 2)            ║
║                                                                               ║
║  WARUM:                                                                       ║
║  ──────                                                                       ║
║  Verhindert dass ein Admin Events/Content außerhalb seiner Area sieht         ║
║  durch alte Employee-Zuordnungen.                                             ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

**Implementierung:** `AdminPermissionsService.cleanupEmployeeMemberships()`

```typescript
// Beim Setzen von Area-Permissions:
async setAreaPermissions(userId, areaIds, ...) {
  // 1. Admin-Permissions setzen
  await this.insertAreaPermissions(userId, areaIds);

  // 2. Employee-Zuordnungen außerhalb der Areas bereinigen
  await this.cleanupEmployeeMemberships(userId, areaIds, tenantId);
}
```

---

## Alternatives Considered

### 1. Flat Permission System (Rejected)

```
Jeder User hat explizite Permissions für jede Ressource.
+ Einfach zu verstehen
- Explosion der Datenmenge
- Keine Vererbung
- Wartungsalptraum bei Umstrukturierungen
```

**Entscheidung:** Abgelehnt - Nicht skalierbar.

### 2. RBAC (Role-Based Access Control) ohne Hierarchie (Rejected)

```
Rollen wie "Area Manager", "Department Manager" mit festen Rechten.
+ Industrie-Standard
- Keine flexible Vererbung
- Starr bei Organisationsänderungen
```

**Entscheidung:** Abgelehnt - Zu unflexibel für verschiedene Firmenstrukturen.

### 3. PostgreSQL Row-Level Security (Partially Used)

```sql
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id')::int);
```

**Entscheidung:** Teilweise verwendet für Tenant-Isolation, aber nicht für die Hierarchie.

### 4. Zentrale Permission-Tabelle (Rejected)

```sql
permissions (
  user_id, resource_type, resource_id, permission_type
)
```

**Entscheidung:** Abgelehnt - Zu generisch, Vererbung schwer abzubilden.

---

## Consequences

### Positive

1. **Klare Hierarchie** - Area → Department → Team ist intuitiv
2. **Automatische Vererbung** - Änderungen propagieren automatisch
3. **Explizite Zuweisung** - Kein versehentlicher Zugriff
4. **Flexibel** - Verschiedene Zuweisungswege (Permission, Lead, Membership)
5. **Multi-Tenant sicher** - tenant_id in jeder Tabelle
6. **Performant** - EXISTS-Subqueries mit Indizes

### Negative

1. **Komplexe Queries** - Mehrere EXISTS-Checks pro Abfrage
2. **Lernkurve** - Entwickler müssen Vererbungslogik verstehen
3. **Refactoring-Risiko** - Änderungen können weitreichende Auswirkungen haben

### Mitigations

| Problem          | Mitigation                                |
| ---------------- | ----------------------------------------- |
| Komplexe Queries | SQL als Konstanten, gut dokumentiert      |
| Lernkurve        | ADR + Inline-Docs + Code-Reviews          |
| Refactoring      | Umfassende Tests, schrittweise Änderungen |

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

| Table                            | Purpose                          |
| -------------------------------- | -------------------------------- |
| `users.has_full_access`          | Full access flag                 |
| `admin_area_permissions`         | Admin → Area assignments         |
| `admin_department_permissions`   | Admin → Department assignments   |
| `user_departments`               | Employee → Department membership |
| `user_teams`                     | Employee → Team membership       |
| `areas.area_lead_id`             | Area leader (root/admin only)    |
| `departments.department_lead_id` | Dept leader (root/admin only)    |
| `teams.team_lead_id`             | Team leader (root/admin only)    |

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
