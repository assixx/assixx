# ADR-035: Organizational Hierarchy & Assignment Architecture

| Metadata                | Value                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| **Status**              | Accepted                                                                                   |
| **Date**                | 2026-03-13                                                                                 |
| **Decision Makers**     | SCS Technik                                                                                |
| **Affected Components** | Database, Backend (NestJS), Frontend (SvelteKit), Guards, Organigram, All Management Pages |

---

## Context

Assixx ist eine Multi-Tenant SaaS-Plattform für Industrieunternehmen. Die zentrale Herausforderung: **Wer darf was sehen und verwalten?** Die Antwort liegt in einer hierarchischen Organisationsstruktur, die physische Standorte, organisatorische Einheiten und Personalzuweisungen in einem kohärenten System verbindet.

Dieses ADR dokumentiert die **vollständige Architektur** des Zuweisungs- und Hierarchiesystems — von der Datenbankebene über die Backend-Permission-Services bis zur Frontend-Visualisierung.

### Anforderungen

1. **Multi-Tenant-Isolation**: Tenant A darf NIEMALS Daten von Tenant B sehen (RLS-enforced)
2. **Hierarchische Struktur**: Area → Department → Team mit automatischer Vererbung
3. **Rollenbasierter Zugriff**: Root, Admin, Employee, Dummy mit unterschiedlichen Privilegien
4. **Leitungspositionen**: Area-Leiter, Abteilungsleiter, Teamleiter mit besonderen Rechten
5. **Explizite Zuweisung**: Kein impliziter Zugriff — alles muss explizit zugewiesen werden
6. **Vererbung**: Berechtigungen fließen von oben nach unten durch die Hierarchie
7. **Aufräumen**: Zuweisungsänderungen müssen inkonsistente Mitgliedschaften bereinigen

### Problem

Wie implementiert man ein Berechtigungssystem, das gleichzeitig:

- **Sicher** ist (kein versehentlicher Zugriff)
- **Flexibel** ist (mehrere Zuweisungspfade)
- **Performant** ist (keine N+1 Queries)
- **Wartbar** ist (klare Regeln, keine Sonderfälle)
- **Verständlich** ist (Entwickler können die Vererbungslogik nachvollziehen)

---

## Decision

### 1. Organisationshierarchie — Die vier Entitäten

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                              TENANT (Firma / Mandant)                            ║
║                          tenant_id = Mandanten-ID (RLS)                          ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║   ┌─────────────────────────────────────────────────────────────────────────┐     ║
║   │                           AREA (Bereich)                                │     ║
║   │                                                                         │     ║
║   │  • Physischer Standort (Gebäude, Halle, Lager, Büro)                   │     ║
║   │  • area_lead_id → User (Bereichsleiter)                                │     ║
║   │  • Höchste Ebene der operativen Hierarchie                             │     ║
║   │                                                                         │     ║
║   │   ┌─────────────────────────────────────────────────────────────┐       │     ║
║   │   │                    DEPARTMENT (Abteilung)                    │       │     ║
║   │   │                                                              │       │     ║
║   │   │  • Organisatorische Einheit (IT, Produktion, QS)            │       │     ║
║   │   │  • department_lead_id → User (Abteilungsleiter)             │       │     ║
║   │   │  • area_id → Area (physische Zuordnung, nullable)           │       │     ║
║   │   │                                                              │       │     ║
║   │   │   ┌─────────────────────────────────────────────────┐       │       │     ║
║   │   │   │                    TEAM                          │       │       │     ║
║   │   │   │                                                  │       │       │     ║
║   │   │   │  • Arbeitsgruppe innerhalb einer Abteilung      │       │       │     ║
║   │   │   │  • team_lead_id → User (Teamleiter)             │       │       │     ║
║   │   │   │  • deputy_lead_id → User (Stellvertreter)       │       │       │     ║
║   │   │   │  • department_id → Department (nullable)        │       │       │     ║
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
║   │                        ASSET (Anlage/Maschine)                          │     ║
║   │                                                                         │     ║
║   │  • Doppelte Zuordnung: area_id + department_id (beide nullable)        │     ║
║   │  • Team-Zuordnung über asset_teams (N:M)                               │     ║
║   │  • Kein eigener Lead — Zuständigkeit über Department/Team              │     ║
║   └─────────────────────────────────────────────────────────────────────────┘     ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

### 2. Datenbank-Schema — Tabellen und Beziehungen

#### 2.1 Hierarchie-Tabellen (Entitäten)

```sql
-- AREA: Höchste operative Ebene
areas (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL → tenants(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  area_lead_id    INT NULL → users(id) ON DELETE SET NULL,     -- Bereichsleiter
  type            areas_type NOT NULL DEFAULT 'other',          -- building, production, warehouse, office, outdoor, other
  is_active       SMALLINT NOT NULL DEFAULT 1,                  -- 0=inaktiv, 1=aktiv, 3=archiviert, 4=gelöscht
  created_by      INT NOT NULL → users(id) ON DELETE RESTRICT,
  uuid            CHAR(36) NOT NULL UNIQUE,
  -- RLS: tenant_isolation Policy
)

-- DEPARTMENT: Mittlere Ebene, gehört zu Area
departments (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL → tenants(id),
  name                VARCHAR(100) NOT NULL,                        -- UNIQUE per tenant
  department_lead_id  INT NULL → users(id) ON DELETE SET NULL,     -- Abteilungsleiter
  area_id             INT NULL → areas(id) ON DELETE SET NULL,     -- Physische Zuordnung
  is_active           SMALLINT NOT NULL DEFAULT 1,
  created_by          INT NULL → users(id) ON DELETE SET NULL,
  uuid                CHAR(36) NOT NULL UNIQUE,
  UNIQUE (tenant_id, name),
  -- RLS: tenant_isolation Policy
)

-- TEAM: Unterste Ebene, gehört zu Department
teams (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL → tenants(id) ON DELETE CASCADE,
  department_id    INT NULL → departments(id) ON DELETE CASCADE,   -- ⚠️ CASCADE: Dept löschen → Teams werden gelöscht!
  name             VARCHAR(100) NOT NULL,                           -- UNIQUE per department
  team_lead_id     INT NULL → users(id) ON DELETE SET NULL,        -- Teamleiter
  deputy_lead_id   INT NULL → users(id) ON DELETE SET NULL,        -- Stellvertreter
  is_active        SMALLINT NULL DEFAULT 1,
  created_by       INT NULL → users(id) ON DELETE SET NULL,
  uuid             CHAR(36) NOT NULL UNIQUE,
  UNIQUE (department_id, name),
  -- RLS: tenant_isolation Policy
)

-- ASSET: Querverknüpft zu Area + Department + Teams
assets (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL → tenants(id),
  name             VARCHAR(100) NOT NULL,
  department_id    INT NULL → departments(id) ON DELETE SET NULL,  -- Organisatorische Zuständigkeit
  area_id          INT NULL → areas(id) ON DELETE SET NULL,        -- Physischer Standort
  status           assets_status DEFAULT 'operational',
  asset_type       assets_asset_type DEFAULT 'production',
  is_active        SMALLINT DEFAULT 1,
  uuid             CHAR(36) NOT NULL UNIQUE,
  -- RLS: tenant_isolation Policy
)
```

#### 2.2 Zuweisungs-Tabellen (N:M Junctions)

```sql
-- EMPLOYEE → DEPARTMENT Mitgliedschaft (N:M)
user_departments (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL → tenants(id),
  user_id         INT NOT NULL → users(id) ON DELETE CASCADE,
  department_id   INT NOT NULL → departments(id) ON DELETE CASCADE,
  is_primary      BOOLEAN NOT NULL DEFAULT true,        -- Hauptabteilung
  assigned_by     INT NULL → users(id) ON DELETE SET NULL,
  assigned_at     TIMESTAMPTZ,
  UNIQUE (user_id, department_id, tenant_id),
  -- RLS: tenant_isolation Policy
)

-- EMPLOYEE → TEAM Mitgliedschaft (N:M)
user_teams (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL → tenants(id),
  user_id     INT NOT NULL → users(id) ON DELETE CASCADE,
  team_id     INT NOT NULL → teams(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ,
  role        user_teams_role DEFAULT 'member',        -- Nur 'member' für Employees
  UNIQUE (user_id, team_id),
  -- RLS: tenant_isolation Policy
)

-- ASSET → TEAM Zuordnung (N:M)
asset_teams (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL → tenants(id),
  asset_id    INT NOT NULL → assets(id) ON DELETE CASCADE,
  team_id     INT NOT NULL → teams(id) ON DELETE CASCADE,
  is_primary  BOOLEAN DEFAULT false,
  assigned_by INT NULL → users(id) ON DELETE SET NULL,
  UNIQUE (tenant_id, asset_id, team_id),
  -- RLS: tenant_isolation Policy
)
```

#### 2.3 Admin-Permission-Tabellen (Granulare RBAC)

```sql
-- ADMIN → AREA Berechtigung (Granular: read/write/delete)
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

-- ADMIN → DEPARTMENT Berechtigung (Granular: read/write/delete)
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

#### 2.4 Users-Tabelle (Relevante Spalten)

```sql
users (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL → tenants(id),
  role             users_role NOT NULL DEFAULT 'employee',   -- root, admin, employee, dummy
  has_full_access  BOOLEAN NOT NULL DEFAULT false,

  -- CHECK Constraints (DB-Level Enforcement):
  CONSTRAINT chk_root_full_access       CHECK (role != 'root'     OR has_full_access = true),
  CONSTRAINT chk_employee_no_full_access CHECK (role != 'employee' OR has_full_access = false),
  CONSTRAINT chk_dummy_no_full_access   CHECK (role != 'dummy'    OR has_full_access = false),
  CONSTRAINT chk_dummy_display_name     CHECK (role != 'dummy'    OR display_name IS NOT NULL),
)
```

**Bedeutung der CHECK Constraints:**

| Constraint                    | Regel                                       | Warum                                                                    |
| ----------------------------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| `chk_root_full_access`        | Root MUSS `has_full_access = true` haben    | Root hat per Definition Vollzugriff — DB verhindert inkonsistenten State |
| `chk_employee_no_full_access` | Employee DARF NICHT `has_full_access` haben | Employees sehen nur zugewiesene Bereiche — nie alles                     |
| `chk_dummy_no_full_access`    | Dummy DARF NICHT `has_full_access` haben    | Dummy-User sind Platzhalter ohne echte Rechte                            |

### 3. Rollen und ihre Zugriffspfade

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                              ROLLENMODELL                                        ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║  ROOT (role = 'root', has_full_access = true ERZWUNGEN)                          ║
║  ─────────────────────────────────────────────────                                ║
║  • Prüfung: role === 'root' im Code                                             ║
║  • DB-Einträge in Permission-Tabellen: NICHT NÖTIG                               ║
║  • Zugriff: ALLES im Tenant (automatisch, CHECK Constraint erzwingt)             ║
║  • Neue Entitäten: Sofort sichtbar ohne Zuweisung                                ║
║                                                                                   ║
║  ADMIN MIT has_full_access = true                                                ║
║  ───────────────────────────────                                                  ║
║  • Prüfung: has_full_access Flag in users-Tabelle                                ║
║  • DB-Einträge: NICHT NÖTIG (Flag übersteuert alles)                             ║
║  • Zugriff: ALLES im Tenant (wie Root, aber Rolle bleibt 'admin')               ║
║  • Use Case: Admin der alles sehen/verwalten darf, ohne Root-Rechte              ║
║                                                                                   ║
║  ADMIN MIT has_full_access = false (Standard)                                    ║
║  ─────────────────────────────────────────────                                    ║
║  • Prüfung: DB-Lookup in admin_area_permissions + admin_department_permissions   ║
║  • Zuweisungen: Explizit auf Areas und/oder Departments                          ║
║  • Vererbung: Area-Zuweisung → ALLE Departments in dieser Area automatisch      ║
║  • Lead-Position: area_lead_id / department_lead_id = implizite Berechtigung     ║
║                                                                                   ║
║  EMPLOYEE (has_full_access = false ERZWUNGEN)                                    ║
║  ─────────────────────────────────────────────                                    ║
║  • Prüfung: user_teams + user_departments                                        ║
║  • Zuweisungen: Teams (N:M) und Departments (N:M)                                ║
║  • Vererbung: Team → Department → Area (für Sichtbarkeit/Context)               ║
║  • KEIN Schreibzugriff auf organisatorische Verwaltung                           ║
║                                                                                   ║
║  DUMMY (has_full_access = false ERZWUNGEN)                                       ║
║  ──────────────────────────────────────────                                        ║
║  • Platzhalter-User (z.B. für Schichtplanung ohne echten Account)                ║
║  • Keine eigenen Berechtigungen, keine Login-Möglichkeit                         ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

### 4. Leitungspositionen (Lead Assignments)

Jede Hierarchie-Ebene hat einen dedizierten Leiter, der direkt als Foreign Key auf der Entität gespeichert wird:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        LEAD-POSITIONEN                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  areas.area_lead_id → users.id                                                 │
│  ────────────────────────────────                                               │
│  • Wer: Admin oder Root (Backend-validiert: role IN ('admin', 'root'))         │
│  • Rechte: Äquivalent zu admin_area_permissions mit can_read=true              │
│  • Vererbung: Sieht automatisch ALLE Departments + Teams in dieser Area       │
│  • UI-Label: Dynamisch via HierarchyLabels (z.B. "Hallen-Leiter")             │
│                                                                                 │
│  departments.department_lead_id → users.id                                     │
│  ──────────────────────────────────────────                                      │
│  • Wer: Admin oder Root (Backend-validiert: role IN ('admin', 'root'))         │
│  • Rechte: Äquivalent zu admin_department_permissions mit can_read=true        │
│  • Vererbung: Sieht automatisch ALLE Teams in dieser Abteilung                │
│  • UI-Label: Dynamisch via HierarchyLabels (z.B. "Segment-Leiter")            │
│                                                                                 │
│  teams.team_lead_id → users.id                                                 │
│  ──────────────────────────────                                                  │
│  • Wer: Jede Rolle mit Position "Teamleiter" (positions-basiert, nicht role)   │
│  • Rechte: Sieht das Team                                                      │
│  • Vererbung: KEINE nach oben — nur Team-Sicht                                │
│  • Besonderheit: Trennung von System-Rolle und organisatorischer Funktion      │
│                                                                                 │
│  teams.deputy_lead_id → users.id                                               │
│  ────────────────────────────────                                                │
│  • Stellvertretender Teamleiter                                                │
│  • Gleiche Rechte wie team_lead_id                                             │
│                                                                                 │
│  VALIDIERUNG (Backend, nicht DB-Constraint):                                   │
│  • Area/Department Lead: role IN ('admin', 'root') — Backend prüft            │
│  • Team Lead: position = 'Teamleiter' — Positions-basiert, rollenunabhängig   │
│                                                                                 │
│  ON DELETE SET NULL:                                                            │
│  • Wenn der Lead-User gelöscht wird → Lead-Position wird NULL                  │
│  • Die Entität bleibt bestehen, nur ohne Leiter                                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 5. Vererbungsregeln (KRITISCH)

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                     PERMISSION INHERITANCE FLOW                                  ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║  ADMIN MIT AREA-BERECHTIGUNG:                                                    ║
║  ────────────────────────────                                                     ║
║  admin_area_permissions(area_id=1)                                               ║
║      │                                                                            ║
║      ├──▶ Sieht Area 1                              (DIREKT)                    ║
║      ├──▶ Sieht ALLE Departments WHERE area_id = 1  (VERERBT ↓)                ║
║      └──▶ Sieht ALLE Teams in diesen Departments    (VERERBT ↓↓)               ║
║                                                                                   ║
║  ADMIN MIT DEPARTMENT-BERECHTIGUNG:                                              ║
║  ──────────────────────────────────                                                ║
║  admin_department_permissions(department_id=11)                                   ║
║      │                                                                            ║
║      ├──▶ Sieht Department 11                        (DIREKT)                    ║
║      ├──▶ Sieht ALLE Teams WHERE department_id = 11  (VERERBT ↓)               ║
║      └──▶ Sieht Area von Department 11               (READ-ONLY Kontext ↑)      ║
║                                                                                   ║
║  ADMIN ALS LEAD:                                                                 ║
║  ────────────────                                                                 ║
║  areas.area_lead_id = admin.id                                                   ║
║      └──▶ Gleiche Rechte wie Area-Permission         (IMPLIZIT)                  ║
║                                                                                   ║
║  departments.department_lead_id = admin.id                                       ║
║      └──▶ Gleiche Rechte wie Department-Permission   (IMPLIZIT)                  ║
║                                                                                   ║
║  teams.team_lead_id = admin.id                                                   ║
║      └──▶ Sieht Team                                 (NUR TEAM)                 ║
║                                                                                   ║
║  EMPLOYEE IN TEAM:                                                               ║
║  ─────────────────                                                                ║
║  user_teams(team_id=7)                                                           ║
║      │                                                                            ║
║      ├──▶ Sieht Team 7                               (DIREKT)                   ║
║      ├──▶ Erbt Department-Zugehörigkeit              (teams.department_id ↑)     ║
║      └──▶ Erbt Area-Zugehörigkeit                    (departments.area_id ↑↑)    ║
║                                                                                   ║
║  EMPLOYEE IN DEPARTMENT:                                                         ║
║  ────────────────────────                                                         ║
║  user_departments(department_id=11)                                              ║
║      │                                                                            ║
║      ├──▶ Sieht Department 11                        (DIREKT)                    ║
║      └──▶ Erbt Area-Zugehörigkeit                    (departments.area_id ↑)     ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

#### 5.1 Vererbungs-Beispiel (Konkret)

```
AREA "Produktionshalle Nord" (id=1)
│   area_lead_id = Admin.Alpha
│
├── DEPARTMENT "Stufenfertigung" (id=11, area_id=1)
│   │   department_lead_id = Admin.Beta
│   │
│   ├── TEAM "Schicht A" (id=101, department_id=11)
│   │   │   team_lead_id = Employee.Charlie
│   │   │
│   │   └── Members (user_teams):
│   │       ├── Employee.Dave
│   │       └── Employee.Eve
│   │
│   └── TEAM "Schicht B" (id=102, department_id=11)
│       │   team_lead_id = Employee.Frank
│       │
│       └── Members (user_teams):
│           └── Employee.Grace
│
└── DEPARTMENT "Endmontage" (id=12, area_id=1)
    │   department_lead_id = NULL (vakant)
    │
    └── TEAM "Montage" (id=103, department_id=12)
        └── Members: Employee.Heidi


WIRKUNG DER ZUWEISUNGEN:

Admin.Alpha (area_lead_id von Area 1):
  → Sieht: Area 1, Dept 11, Dept 12, Team 101, Team 102, Team 103
  → Grund: Lead-Position = implizite Area-Permission → vererbt auf alles darunter

Admin.Beta (department_lead_id von Dept 11):
  → Sieht: Dept 11, Team 101, Team 102
  → Sieht NICHT: Dept 12, Team 103 (anderes Department)
  → Sieht: Area 1 (READ-ONLY Kontext, weil Dept 11 zu Area 1 gehört)

Employee.Charlie (team_lead_id von Team 101, Mitglied via user_teams):
  → Sieht: Team 101
  → Erbt: Dept 11 (Kontext), Area 1 (Kontext)
  → Sieht NICHT: Team 102 (anderes Team), Dept 12

Employee.Dave (Mitglied in Team 101 via user_teams):
  → Sieht: Team 101
  → Erbt: Dept 11 (Kontext), Area 1 (Kontext)

Admin mit admin_area_permissions(area_id=1):
  → Sieht: Area 1, Dept 11, Dept 12, Team 101, 102, 103
  → Identisch mit area_lead — aber ohne Lead-Titel
```

#### 5.2 NULL-Handling bei Vererbung

```
Department.area_id = NULL:
→ KEINE Vererbung von Area möglich
→ User braucht DIREKTE admin_department_permissions
→ Oder: has_full_access = true

Team.department_id = NULL:
→ KEINE Vererbung von Department möglich
→ User braucht DIREKTE user_teams Mitgliedschaft
→ Oder: has_full_access = true
```

### 6. Permission Check Flow (Backend)

**Service:** `HierarchyPermissionService` (`backend/src/nest/hierarchy-permission/hierarchy-permission.service.ts`)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         ACCESS CHECK FLOW                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

User Request → hasAccess(userId, tenantId, resourceType, resourceId, permission)
     │
     ▼
┌─────────────────────────────────────┐
│ 1. Ist user.role = 'root'?          │──── JA ──▶ ✅ VOLLZUGRIFF
└─────────────────────────────────────┘
     │ NEIN
     ▼
┌─────────────────────────────────────┐
│ 2. Ist user.has_full_access = true? │──── JA ──▶ ✅ VOLLZUGRIFF
└─────────────────────────────────────┘
     │ NEIN
     ▼
┌─────────────────────────────────────┐
│ 3. Prüfe basierend auf             │
│    resourceType:                    │
└─────────────────────────────────────┘
     │
     ├── resourceType = 'area'
     │       │
     │       └── Direkte admin_area_permissions? ────────────▶ ✅/❌
     │
     ├── resourceType = 'department'
     │       │
     │       ├── 1. Direkte admin_department_permissions? ───▶ ✅ ZUGRIFF
     │       │
     │       └── 2. Department hat area_id?
     │               │
     │               ├── JA → admin_area_permissions für area_id? ▶ ✅ VERERBT
     │               │
     │               └── NEIN (NULL) ───────────────────────────▶ ❌ KEIN ZUGRIFF
     │
     └── resourceType = 'team'
             │
             ├── 1. user_teams Mitgliedschaft? ──────────────▶ ✅ ZUGRIFF
             │
             └── 2. Team hat department_id?
                     │
                     ├── JA → checkDepartmentAccess() rekursiv ▶ ✅ VERERBT
                     │         (prüft direkte Dept-Perm ODER Area-Vererbung)
                     │
                     └── NEIN (NULL) ───────────────────────────▶ ❌ KEIN ZUGRIFF
```

#### 6.1 Batch-Access-Methoden (für Listen-Filtering)

```typescript
// Alle zugänglichen Area-IDs (für UI-Filter)
getAccessibleAreaIds(userId, tenantId): number[]
  → SELECT area_id FROM admin_area_permissions WHERE admin_user_id = $1

// Alle zugänglichen Department-IDs (direkt + vererbt)
getAccessibleDepartmentIds(userId, tenantId): number[]
  → Direkt: SELECT department_id FROM admin_department_permissions WHERE admin_user_id = $1
  → Vererbt: SELECT id FROM departments WHERE area_id IN (accessible_area_ids)
  → Merge beider Sets

// Alle zugänglichen Team-IDs (Mitgliedschaft + vererbt)
getAccessibleTeamIds(userId, tenantId): number[]
  → Mitglied: SELECT team_id FROM user_teams WHERE user_id = $1
  → Vererbt: SELECT id FROM teams WHERE department_id IN (accessible_department_ids)
  → Merge beider Sets
```

### 7. Content Visibility (org_level Pattern)

Für Features wie Kalender, Schwarzes Brett, Dokumente definiert `org_level` die Sichtbarkeit:

| org_level    | Sichtbar für                                                                    |
| ------------ | ------------------------------------------------------------------------------- |
| `company`    | Jeder im Tenant                                                                 |
| `area`       | Jeder mit Area-Zugriff (Permission ODER Lead ODER Dept-Mitglied in dieser Area) |
| `department` | Jeder mit Department-Zugriff (Permission ODER Lead ODER user_departments)       |
| `team`       | Jeder mit Team-Zugriff (user_teams ODER Lead)                                   |
| `personal`   | Nur der Ersteller                                                               |

**SQL-Pattern für Visibility-Queries:**

```sql
SELECT e.* FROM calendar_events e
WHERE e.tenant_id = $1
  AND (
    -- 1. Company: Jeder sieht es
    e.org_level = 'company'

    -- 2. Area: Permission + Lead + Dept-Mitgliedschaft
    OR (e.org_level = 'area' AND (
      EXISTS (SELECT 1 FROM admin_area_permissions aap
              WHERE aap.admin_user_id = $2 AND aap.area_id = e.area_id)
      OR EXISTS (SELECT 1 FROM areas a
                 WHERE a.id = e.area_id AND a.area_lead_id = $2)
      OR EXISTS (SELECT 1 FROM user_departments ud
                 JOIN departments d ON ud.department_id = d.id
                 WHERE ud.user_id = $2 AND d.area_id = e.area_id)
    ))

    -- 3. Department: Permission + Lead + Mitgliedschaft + Area-Vererbung
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

    -- 4. Team: Mitgliedschaft + Lead + Dept-Vererbung + Area-Vererbung
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

### 8. Synchronisation bei Berechtigungsänderungen (Cleanup)

**Service:** `AdminPermissionsService.cleanupEmployeeMemberships()`

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║           ADMIN PERMISSION SYNCHRONISATION (setAreaPermissions)                   ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║  WENN: Admin erhält Area-Permissions für Area X                                  ║
║  DANN:                                                                            ║
║    1. admin_area_permissions werden gesetzt (normal)                              ║
║    2. user_departments AUSSERHALB Area X werden GELÖSCHT                         ║
║    3. user_teams für Teams in Departments AUSSERHALB Area X werden GELÖSCHT      ║
║                                                                                   ║
║  BEISPIEL:                                                                       ║
║  ──────────                                                                       ║
║  Admin.Zwei hat:                                                                 ║
║    • admin_area_permissions: area_id=2                                           ║
║    • user_departments: dept_id=11 (area_id=1 — ANDERE Area!)                    ║
║    • user_teams: team in dept mit area_id=1                                      ║
║                                                                                   ║
║  Nach setAreaPermissions(areaIds=[2]):                                           ║
║    • admin_area_permissions: ✅ area_id=2 bleibt                                  ║
║    • user_departments: ❌ dept_id=11 wird GELÖSCHT (area_id=1 ≠ 2)              ║
║    • user_teams: ❌ Teams in Depts außerhalb Area 2 werden GELÖSCHT              ║
║                                                                                   ║
║  WARUM:                                                                          ║
║  ──────                                                                           ║
║  Verhindert, dass ein Admin über alte Employee-Zuweisungen Content               ║
║  außerhalb seines Zuständigkeitsbereichs sieht.                                  ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

**Implementierung (SQL-Logik):**

```sql
-- Schritt 1: Teams in Departments außerhalb der erlaubten Areas löschen
DELETE FROM user_teams
WHERE user_id = $1
  AND team_id IN (
    SELECT t.id FROM teams t
    JOIN departments d ON t.department_id = d.id
    WHERE d.area_id IS NOT NULL
      AND d.area_id NOT IN ($2, $3, ...)  -- erlaubte Area-IDs
  );

-- Schritt 2: Departments außerhalb der erlaubten Areas löschen
DELETE FROM user_departments
WHERE user_id = $1
  AND department_id IN (
    SELECT d.id FROM departments d
    WHERE d.area_id IS NOT NULL
      AND d.area_id NOT IN ($2, $3, ...)  -- erlaubte Area-IDs
  );
```

### 9. Zwei separate Berechtigungssysteme

Das Assixx-System hat **zwei orthogonale Berechtigungsebenen**, die unabhängig voneinander funktionieren:

```
╔════════════════════════════════════════════════════════════════════════════╗
║                    SYSTEM 1: ORGANISATIONSHIERARCHIE                      ║
║                    "Wer sieht welche Bereiche/Abteilungen/Teams?"        ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  Tabellen:                                                                ║
║  • admin_area_permissions      (Admin → Area)                             ║
║  • admin_department_permissions (Admin → Department)                      ║
║  • user_teams                  (Employee → Team)                          ║
║  • user_departments            (Employee → Department)                    ║
║  • areas.area_lead_id          (Lead → Area)                              ║
║  • departments.department_lead_id (Lead → Department)                    ║
║  • teams.team_lead_id          (Lead → Team)                              ║
║  • users.has_full_access       (Vollzugriff-Flag)                         ║
║                                                                            ║
║  Service: HierarchyPermissionService                                      ║
║  Frage: "Kann User X die Daten von Area/Dept/Team Y sehen?"             ║
║                                                                            ║
╠════════════════════════════════════════════════════════════════════════════╣
║                    SYSTEM 2: ADDON-BERECHTIGUNGEN                        ║
║                    "Welche Features darf der User nutzen?"               ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  Tabelle: user_addon_permissions                                          ║
║  • tenant_id, user_id, addon_code, module_code                           ║
║  • can_read, can_write, can_delete                                       ║
║                                                                            ║
║  Service: UserPermissionsService                                          ║
║  Guard: PermissionGuard + @RequirePermission() Decorator                 ║
║  Frage: "Darf User X das Feature 'Schwarzes Brett' lesen/schreiben?"    ║
║                                                                            ║
║  Registry-Pattern: Jedes Addon registriert seine Permission-Kategorien   ║
║  bei OnModuleInit über den PermissionRegistryService.                    ║
║                                                                            ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  ZUSAMMENSPIEL:                                                           ║
║  System 1 bestimmt: "User sieht Abteilung Produktion"                    ║
║  System 2 bestimmt: "User darf Schwarzes Brett lesen"                    ║
║  → User sieht Schwarzes-Brett-Einträge der Abteilung Produktion          ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
```

### 10. Frontend-Visualisierung (Badge-System)

Die Zuweisungen werden in den Management-Tabellen durch ein einheitliches Badge-System visualisiert:

| Badge-Typ       | CSS-Klasse         | Icon         | Verwendung                             |
| --------------- | ------------------ | ------------ | -------------------------------------- |
| **Vollzugriff** | `badge--primary`   | `fa-globe`   | `has_full_access = true`               |
| **Anzahl**      | `badge--info`      | —            | N direkte Zuweisungen, Tooltip = Namen |
| **Vererbt**     | `badge--info`      | `fa-sitemap` | Zugriff via Parent-Hierarchie          |
| **Keine**       | `badge--secondary` | —            | Keine Zuweisungen                      |

**Badge-Logik für Admins:**

```
getAreasBadge(admin):
  has_full_access → "Alle" (globe)
  areas.length > 0 → "N Bereiche" (info)
  else → "Keine" (secondary)

getDepartmentsBadge(admin):
  has_full_access → "Alle" (globe)
  direct_depts + area_inheritance → "N + Vererbt"
  only direct → "N Abteilungen"
  only inherited → "Vererbt" (sitemap)
  else → "Keine"

getTeamsBadge(admin):
  has_full_access → "Alle" (globe)
  has areas OR departments → "Vererbt" (sitemap, Tooltip zeigt Vererbungskette)
  else → "Keine"
```

**Badge-Logik für Employees:**

```
getTeamsBadge(employee):
  teamIds.length > 0 → "N Teams" (info)
  else → "Nicht zugewiesen"

getAreasBadge(employee):
  → IMMER vererbt von Team → Department → Area
  → "Vererbt" (sitemap) mit Tooltip der Kette

getDepartmentsBadge(employee):
  → IMMER vererbt von Team → Department
  → "Vererbt" (sitemap) mit Tooltip
```

### 11. Foreign Key Kaskaden und ihre Konsequenzen

| FK-Beziehung                                               | ON DELETE  | Konsequenz                                                       |
| ---------------------------------------------------------- | ---------- | ---------------------------------------------------------------- |
| `departments.area_id → areas`                              | `SET NULL` | Area löschen → Department bleibt, aber ohne Area-Zuordnung       |
| `teams.department_id → departments`                        | `CASCADE`  | **⚠️ Department löschen → ALLE Teams werden gelöscht!**          |
| `areas.area_lead_id → users`                               | `SET NULL` | User löschen → Area bleibt ohne Leiter                           |
| `departments.department_lead_id → users`                   | `SET NULL` | User löschen → Department bleibt ohne Leiter                     |
| `teams.team_lead_id → users`                               | `SET NULL` | User löschen → Team bleibt ohne Leiter                           |
| `user_teams.user_id → users`                               | `CASCADE`  | User löschen → Team-Mitgliedschaften werden gelöscht             |
| `user_teams.team_id → teams`                               | `CASCADE`  | Team löschen → Team-Mitgliedschaften werden gelöscht             |
| `user_departments.user_id → users`                         | `CASCADE`  | User löschen → Department-Mitgliedschaften werden gelöscht       |
| `user_departments.department_id → departments`             | `CASCADE`  | Department löschen → Department-Mitgliedschaften werden gelöscht |
| `admin_area_permissions.admin_user_id → users`             | `CASCADE`  | User löschen → Area-Permissions werden gelöscht                  |
| `admin_area_permissions.area_id → areas`                   | `CASCADE`  | Area löschen → Area-Permissions werden gelöscht                  |
| `admin_department_permissions.admin_user_id → users`       | `CASCADE`  | User löschen → Dept-Permissions werden gelöscht                  |
| `admin_department_permissions.department_id → departments` | `CASCADE`  | Dept löschen → Dept-Permissions werden gelöscht                  |
| `asset_teams.asset_id → assets`                            | `CASCADE`  | Asset löschen → Team-Zuordnungen werden gelöscht                 |
| `asset_teams.team_id → teams`                              | `CASCADE`  | Team löschen → Asset-Zuordnungen werden gelöscht                 |

### 12. Guard-Kette (Request Lifecycle)

```
HTTP Request
     │
     ▼
┌──────────────────────┐
│ 1. JwtAuthGuard      │  → Authentifizierung (Token prüfen)
│    (Global)          │  → user Objekt auf Request setzen
└──────────────────────┘
     │
     ▼
┌──────────────────────┐
│ 2. RolesGuard        │  → @Roles('admin', 'root') Decorator prüfen
│    (Global)          │  → Rollen-basierte Zugriffskontrolle
└──────────────────────┘
     │
     ▼
┌──────────────────────┐
│ 3. PermissionGuard   │  → @RequirePermission('addon', 'module', 'action')
│    (Global)          │  → Addon-basierte Feature-Berechtigung
│                      │  → has_full_access = true → Skip
└──────────────────────┘
     │
     ▼
┌──────────────────────┐
│ 4. Service-Level     │  → HierarchyPermissionService.hasAccess()
│    (Pro Endpunkt)    │  → Organisationshierarchie-Prüfung
│                      │  → Wird im Service aufgerufen, nicht als Guard
└──────────────────────┘
     │
     ▼
┌──────────────────────┐
│ 5. RLS (PostgreSQL)  │  → SET app.tenant_id = $1 vor Query
│    (Datenbank-Level) │  → Tenant-Isolation als letzte Verteidigungslinie
└──────────────────────┘
```

---

## Alternatives Considered

### 1. Flat Permission System (Abgelehnt)

Jeder User hat explizite Berechtigungen für jede einzelne Ressource.

- ✅ Einfach zu verstehen
- ❌ Datenmenge explodiert bei großen Organisationen
- ❌ Keine Vererbung
- ❌ Wartungshölle bei Umstrukturierungen

**Entscheidung:** Abgelehnt — Nicht skalierbar.

### 2. RBAC ohne Hierarchie (Abgelehnt)

Feste Rollen wie "Bereichsmanager", "Abteilungsmanager" mit vordefinierten Rechten.

- ✅ Industriestandard
- ❌ Keine flexible Vererbung
- ❌ Zu rigid bei Organisationsänderungen

**Entscheidung:** Abgelehnt — Zu unflexibel für unterschiedliche Firmenstrukturen.

### 3. Reine PostgreSQL RLS für Hierarchie (Teilweise verwendet)

```sql
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id')::int);
```

- ✅ Wasserdicht auf DB-Ebene
- ❌ Hierarchie-Vererbung in RLS-Policies extrem komplex
- ❌ Schwer debuggbar

**Entscheidung:** Teilweise verwendet für Tenant-Isolation, aber NICHT für die Hierarchie.

### 4. Zentrale Permission-Tabelle (Abgelehnt)

```sql
permissions (user_id, resource_type, resource_id, permission_type)
```

- ✅ Generisch
- ❌ Vererbung schwer abzubilden
- ❌ Keine FK-Integrität zu den Ressourcen-Tabellen

**Entscheidung:** Abgelehnt — Zu generisch, Vererbung schwer modellierbar.

### 5. JSON Arrays für Permissions (Abgelehnt)

```sql
users.area_permissions JSONB DEFAULT '[]'
```

- ✅ Flexible Struktur
- ❌ Keine Foreign Keys (referentielle Integrität)
- ❌ Schlechte Query-Performance
- ❌ Keine JOINs möglich

**Entscheidung:** Abgelehnt — N:M-Tabellen sind performanter und bieten Integrität.

---

## Consequences

### Positive

1. **Klare Hierarchie** — Area → Department → Team ist intuitiv und bildet reale Firmenstrukturen ab
2. **Automatische Vererbung** — Area-Berechtigung vererbt sich automatisch auf Departments und Teams
3. **Explizite Zuweisung** — Kein versehentlicher Zugriff durch implizite Regeln
4. **Flexible Zuweisungspfade** — Permission, Lead-Position und Mitgliedschaft als parallele Wege
5. **Multi-Tenant-sicher** — `tenant_id` in jeder Tabelle + RLS auf DB-Ebene
6. **Performant** — EXISTS-Subqueries mit Indizes, keine N+1-Queries
7. **DB-enforced Constraints** — CHECK Constraints verhindern inkonsistente Zustände (z.B. Employee mit has_full_access)
8. **Cleanup-Logik** — Automatische Bereinigung bei Berechtigungsänderungen verhindert verwaiste Zuweisungen
9. **Zwei orthogonale Systeme** — Organisationshierarchie und Addon-Permissions sind unabhängig und komponierbar
10. **Dynamische Labels** — Hierarchy Labels (ADR-034) ermöglichen tenant-spezifische Bezeichnungen ohne DB-Schema-Änderungen

### Negative

1. **Komplexe Queries** — Visibility-Queries mit mehreren EXISTS-Checks pro Abfrage
2. **Lernkurve** — Entwickler müssen Vererbungslogik und beide Systeme verstehen
3. **Refactoring-Risiko** — Änderungen an der Hierarchie können weitreichende Auswirkungen haben
4. **CASCADE-Gefahr** — `departments → teams` CASCADE kann unbeabsichtigt Teams löschen

### Mitigations

| Problem          | Mitigation                                                                 |
| ---------------- | -------------------------------------------------------------------------- |
| Komplexe Queries | SQL als Konstanten in Services, gut dokumentiert, zentral in einem Service |
| Lernkurve        | Dieses ADR + inline Docs + Code Reviews                                    |
| Refactoring      | Umfassende Tests, inkrementelle Änderungen                                 |
| CASCADE-Gefahr   | UI zeigt Warnung vor Department-Löschung ("N Teams werden mitgelöscht")    |

---

## Implementation Details

### Dateien

```
backend/src/nest/
├── hierarchy-permission/
│   └── hierarchy-permission.service.ts          # Zentrale Permission-Logik mit Vererbung
├── admin-permissions/
│   ├── admin-permissions.controller.ts          # API-Endpoints für Area/Dept Permissions
│   ├── admin-permissions.service.ts             # CRUD + Cleanup-Logik
│   └── dto/
│       ├── set-area-permissions.dto.ts          # { areaIds: number[], permissions?: PermissionSet }
│       └── permission-set.schema.ts             # { canRead, canWrite, canDelete }
├── user-permissions/
│   ├── user-permissions.service.ts              # Addon-Permission-Logik
│   └── user-permissions.controller.ts           # Addon-Permission CRUD
├── common/
│   ├── guards/
│   │   ├── jwt-auth.guard.ts                    # Authentifizierung
│   │   ├── roles.guard.ts                       # @Roles() Decorator
│   │   └── permission.guard.ts                  # @RequirePermission() Decorator
│   ├── decorators/
│   │   ├── current-user.decorator.ts            # @CurrentUser()
│   │   └── require-permission.decorator.ts      # @RequirePermission()
│   └── permission-registry/
│       ├── permission.types.ts                  # PermissionCategoryDef
│       └── permission-registry.service.ts       # Registry für Addon-Permissions
├── organigram/
│   ├── organigram.service.ts                    # Org-Chart Tree mit Leads + Member Counts
│   ├── organigram.controller.ts                 # GET /tree, GET/PATCH /hierarchy-labels
│   └── organigram.types.ts                      # OrgChartNode, HierarchyLabels
├── areas/areas.service.ts                       # CRUD Areas + area_lead_id Management
├── departments/departments.service.ts           # CRUD Departments + department_lead_id
└── teams/teams.service.ts                       # CRUD Teams + team_lead_id + user_teams

frontend/src/
├── routes/(app)/(admin)/
│   ├── manage-admins/
│   │   ├── +page.svelte                         # Admin-Liste mit Badge-Spalten
│   │   ├── +page.server.ts                      # Parallel-Fetch: Admins + Areas + Depts + Permissions
│   │   └── _lib/
│   │       ├── AdminFormModal.svelte             # Formular mit AdminOrganizationSection
│   │       ├── AdminOrganizationSection.svelte   # Full-Access Toggle + Area/Dept Multi-Select
│   │       ├── AdminTableRow.svelte              # Badge-Anzeige pro Admin-Zeile
│   │       ├── utils.ts                          # getAreasBadge, getDepartmentsBadge, getTeamsBadge
│   │       ├── filters.ts                        # filterAvailableDepartments (entfernt Depts von gewählten Areas)
│   │       └── api.ts                            # saveAdminWithPermissions, setFullAccess
│   └── manage-employees/
│       ├── +page.svelte                         # Employee-Liste mit vererbten Badges
│       ├── +page.server.ts                      # Fetch: Employees + Teams
│       └── _lib/
│           ├── EmployeeFormModal.svelte          # Team Multi-Select
│           ├── EmployeeTableRow.svelte           # Vererbte Area/Dept Badges
│           ├── utils.ts                          # Vererbungs-Badge-Logik
│           └── api.ts                            # syncTeamMemberships (Diff-basiert)
├── lib/
│   ├── types/hierarchy-labels.ts                # HierarchyLabels Type + Defaults + resolvePositionDisplay
│   └── components/
│       ├── Breadcrumb.svelte                    # Dynamische Labels in Breadcrumbs
│       └── PermissionSettings.svelte            # Addon-Permission Matrix (Addon × Modul × R/W/D)
└── routes/(app)/_lib/
    └── navigation-config.ts                     # Dynamische Sidebar-Labels via HierarchyLabels
```

### API-Endpoints

| Methode | Pfad                                             | Beschreibung                          | Rollen      |
| ------- | ------------------------------------------------ | ------------------------------------- | ----------- |
| GET     | `/admin-permissions/:userId`                     | Alle Permissions eines Admins         | Root, Admin |
| POST    | `/admin-permissions/:userId/areas`               | Area-Permissions setzen (+ Cleanup)   | Root        |
| DELETE  | `/admin-permissions/:userId/areas/:areaId`       | Einzelne Area-Permission entfernen    | Root        |
| POST    | `/admin-permissions`                             | Department-Permissions setzen         | Root        |
| DELETE  | `/admin-permissions/:userId/departments/:deptId` | Einzelne Dept-Permission entfernen    | Root        |
| PATCH   | `/admin-permissions/:userId/full-access`         | has_full_access Flag setzen/entfernen | Root        |
| GET     | `/user-permissions/:uuid`                        | Addon-Permissions eines Users         | Root, Admin |
| PUT     | `/user-permissions/:uuid`                        | Addon-Permissions setzen              | Root, Admin |
| POST    | `/teams/:teamId/members`                         | User zu Team hinzufügen               | Root, Admin |
| DELETE  | `/teams/:teamId/members/:userId`                 | User aus Team entfernen               | Root, Admin |

### Datenbank-Tabellen

| Tabelle                        | Zweck                                   | Typ        |
| ------------------------------ | --------------------------------------- | ---------- |
| `areas`                        | Physische Bereiche (Level 1)            | Entität    |
| `departments`                  | Organisatorische Einheiten (Level 2)    | Entität    |
| `teams`                        | Arbeitsgruppen (Level 3)                | Entität    |
| `assets`                       | Anlagen/Maschinen (Quer)                | Entität    |
| `admin_area_permissions`       | Admin → Area Zugriff                    | Permission |
| `admin_department_permissions` | Admin → Department Zugriff              | Permission |
| `user_teams`                   | Employee → Team Mitgliedschaft          | Membership |
| `user_departments`             | Employee → Department Mitgliedschaft    | Membership |
| `asset_teams`                  | Asset → Team Zuordnung                  | Assignment |
| `user_addon_permissions`       | User → Addon Feature Zugriff            | Permission |
| `users.has_full_access`        | Vollzugriff-Flag                        | Flag       |
| `users.role`                   | Systemrolle (root/admin/employee/dummy) | Enum       |

---

## Verification

| Szenario                          | Erwartet                                           | Status |
| --------------------------------- | -------------------------------------------------- | ------ |
| Root User                         | Sieht alles im Tenant                              | ✅     |
| Admin mit has_full_access=true    | Sieht alles im Tenant                              | ✅     |
| Admin mit Area-Permission         | Sieht Area + alle Depts + alle Teams               | ✅     |
| Admin mit Dept-Permission         | Sieht Dept + alle Teams in Dept                    | ✅     |
| Admin als area_lead               | Gleiche Rechte wie Area-Permission                 | ✅     |
| Admin als department_lead         | Gleiche Rechte wie Dept-Permission                 | ✅     |
| Admin als team_lead               | Sieht nur Team                                     | ✅     |
| Employee in Team                  | Sieht Team, erbt Dept + Area Kontext               | ✅     |
| Employee in Department            | Sieht Department, erbt Area Kontext                | ✅     |
| Admin ohne Permissions            | Sieht nur company-level Content                    | ✅     |
| Cross-Tenant Zugriff              | Blockiert durch tenant_id Filter + RLS             | ✅     |
| setAreaPermissions Cleanup        | Entfernt user_departments außerhalb Areas          | ✅     |
| setAreaPermissions Cleanup        | Entfernt user_teams außerhalb Areas                | ✅     |
| Department.area_id = NULL         | Keine Area-Vererbung, direkte Permission nötig     | ✅     |
| Team.department_id = NULL         | Keine Dept-Vererbung, direkte Mitgliedschaft nötig | ✅     |
| Root hat has_full_access=false    | DB CHECK Constraint verhindert dies                | ✅     |
| Employee hat has_full_access=true | DB CHECK Constraint verhindert dies                | ✅     |
| Department löschen                | CASCADE: Alle Teams werden mitgelöscht             | ✅     |
| Area löschen                      | SET NULL: Departments bleiben, area_id wird NULL   | ✅     |
| Lead-User löschen                 | SET NULL: Entität bleibt, Lead wird NULL           | ✅     |

---

## References

- [ADR-005: Authentication Strategy](./ADR-005-authentication-strategy.md) — JWT Guard
- [ADR-006: Multi-Tenant Context Isolation](./ADR-006-multi-tenant-context-isolation.md) — CLS-basierte Tenant-Isolation
- [ADR-009: User Role Assignment & Permissions](./ADR-009-user-role-assignment-permissions.md) — Ursprüngliches Permission-System (Vorgänger)
- [ADR-019: Multi-Tenant RLS Data Isolation](./ADR-019-multi-tenant-rls-isolation.md) — PostgreSQL RLS
- [ADR-020: Per-User Feature Permissions](./ADR-020-per-user-feature-permissions.md) — Addon-basierte Feature-Permissions
- [ADR-033: Addon-basiertes SaaS-Modell](./ADR-033-addon-based-saas-model.md) — Core vs. Purchasable Addons
- [ADR-034: Hierarchy Labels Propagation](./ADR-034-hierarchy-labels-propagation.md) — Dynamische UI-Labels
- [ADR-036: Organizational Scope Access Control](./ADR-036-organizational-scope-access-control.md) — Scope-basierte Zugriffskontrolle für Manage-Seiten (Employee-Leads + Scoped Admins)
- [HIERARCHY.md](/docs/HIERARCHY.md) — Historische Organisationsstruktur-Dokumentation
- [Refactoring Assignment Plan](/docs/plans/refactoring-assignment-plan.md) — H-RBAC Design-Entscheidungen
- [Refactoring Assignment Concrete Plan](/docs/plans/refactoring-assignment-concrete-plan.md) — Implementierungsdetails
- [Lead-ID Assignment Fix](/docs/plans/ASSIGNED-LEAD_ID-SOLUTION.md) — Chat-Suche Lead-Path Fix
