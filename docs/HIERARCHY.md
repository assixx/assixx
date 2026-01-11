# 🏢 Assixx - Organisationsstruktur & Daten-Hierarchie

**Multi-Tenant SaaS Platform - Vollständige Entity-Beziehungen**

_Erstellt: 2025-10-23_
_Basierend auf: Live-Datenbank Analyse (Tenant 5601)_

---

## 📋 Inhaltsverzeichnis

1. [Hierarchie-Übersicht](#hierarchie-übersicht)
2. [Entity-Definitionen](#entity-definitionen)
3. [Beziehungsmodell](#beziehungsmodell)
4. [Wichtige Unterscheidungen](#wichtige-unterscheidungen)
5. [SQL-Beziehungen](#sql-beziehungen)
6. [Beispiel: Live-Datenstruktur](#beispiel-live-datenstruktur)

---

## 🎯 Hierarchie-Übersicht

```
┌────────────────────────────────────────────────────────────────────┐
│                         TENANT (Firma)                              │
│                    tenant_id = Mandant-ID                           │
└────────────────────────────────────────────────────────────────────┘
         │
         ├─────────────────────────────────────────────────────────┐
         │                                                         │
         ▼                                                         ▼
┌─────────────────┐                                    ┌─────────────────────┐
│     AREAS       │                                    │  DEPARTMENT GROUPS  │
│  (Physisch)     │                                    │    (Logisch)        │
│                 │                                    │                     │
│ • Gebäude       │                                    │ • Berechtigungen    │
│ • Produktions-  │                                    │ • Organisatorisch   │
│   bereiche      │                                    │ • Reporting         │
│ • Lager         │                                    │ • Überlappend OK!   │
│ • Büros         │                                    │                     │
└─────────────────┘                                    └─────────────────────┘
    │ parent_id (Hierarchie)                               │ parent_group_id
    │ (Verschachtelbar)                                    │ (Hierarchie möglich)
    ▼                                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DEPARTMENTS                                 │
│                    (Abteilungen)                                 │
│                                                                  │
│  • area_id          → Verknüpfung zu AREA (physische Zuordnung) │
│  • ❌ parent_id (ENTFERNT 2025-10-23 - Redundant)              │
│  • manager_id       → Abteilungsleiter (User)                   │
│                                                                  │
│  ◄────────────┐                                                 │
│               │ N:M Verbindung über                              │
│               │ department_group_members                         │
└───────────────┼─────────────────────────────────────────────────┘
                │
    ┌───────────┴────────────┬──────────────────────┐
    │                        │                      │
    ▼                        ▼                      ▼
┌──────────┐         ┌──────────────┐      ┌─────────────┐
│  TEAMS   │         │   MACHINES   │      │    USERS    │
│          │         │              │      │             │
│ • dept_id│         │ • dept_id    │      │ • dept_id   │
└──────────┘         │ • area_id    │      │ • role      │
    │                └──────────────┘      └─────────────┘
    │                        │                     │
    │                        │                     │
    │ user_teams             │ machine_teams       │ (Direkte Zuordnung)
    │ (N:M Join)             │ (N:M Join)          │
    │                        │                     │
    ▼                        ▼                     │
┌─────────────────────────────────────────────────┼──────┐
│             USERS / EMPLOYEES                   │      │
│                                                 │      │
│ • role: root, admin, employee                   │      │
│ • department_id (Direkte Abteilungszuordnung)   │◄─────┘
│ • Teams über user_teams (N:M - kann mehrere sein)     │
└────────────────────────────────────────────────────────┘
```

---

## 🏗️ Entity-Definitionen

### 1️⃣ **TENANT** - Die Firma (Mandant)

**Tabelle:** `tenants`

**Bedeutung:** Jede Firma ist ein eigener Mandant (Multi-Tenant-Architektur).

**Isolation:** Alle Daten haben `tenant_id` → **KEINE Datenvermischung zwischen Firmen!**

```sql
-- Beispiel
tenant_id = 5601 → "testfirma.de"
tenant_id = 5637 → "andere-firma.de"
```

---

### 2️⃣ **AREAS** - Physische Bereiche

**Tabelle:** `areas`

**Bedeutung:** Physische Orte/Bereiche in der Firma.

**Hierarchie:** `parent_id` → Areas können verschachtelt sein!

**Typen:**

- `building` - Gebäude
- `production` - Produktionsbereich
- `warehouse` - Lager
- `office` - Büro
- `outdoor` - Außenbereich
- `other` - Sonstiges

**Felder:**

```sql
id              INT PRIMARY KEY
tenant_id       INT NOT NULL
name            VARCHAR(255)
type            ENUM(...)
parent_id       INT NULL → Hierarchie! (Area kann Unter-Areas haben)
address         TEXT
capacity        INT
is_active       BOOLEAN
```

**Beispiel:**

```
Area: "Hauptgebäude" (parent_id = NULL)
  └─ Area: "Produktionshalle Nord" (parent_id = Hauptgebäude)
  └─ Area: "Produktionshalle Süd" (parent_id = Hauptgebäude)
```

---

### 3️⃣ **DEPARTMENTS** - Abteilungen

**Tabelle:** `departments`

**Bedeutung:** Organisatorische Einheiten (z.B. IT, Produktion, QS, Logistik).

**Beziehungen:**

1. **`area_id`** → Physische Zuordnung (Wo ist die Abteilung?)
2. ~~**`parent_id`**~~ → ❌ **ENTFERNT 2025-10-23** (Redundant - department_groups bietet bessere N:M Hierarchie)

**Felder:**

```sql
id              INT PRIMARY KEY
tenant_id       INT NOT NULL
name            VARCHAR(100)
area_id         INT NULL → Zuordnung zu physischem Bereich
manager_id      INT NULL → Abteilungsleiter (FK → users)
status          ENUM('active', 'inactive')
visibility      ENUM('public', 'private')
```

**Hierarchie:**

Für Department-Hierarchien nutzen Sie **department_groups** mit `parent_group_id` (N:M Flexibilität statt 1:N Limitation).

**Beispiel:**

```
Department Group: "Produktion"
  ├─ Department: "Stufenfertigung"
  └─ Department: "Endmontage"
```

---

### 4️⃣ **DEPARTMENT GROUPS** - Logische Gruppierungen

**Tabelle:** `department_groups`

**Bedeutung:** **Logische Gruppierung** von Departments (NICHT physisch!).

**Unterschied zu Areas:**

- **Areas** = Physische Orte ("Wo ist es?")
- **Groups** = Logische Zuordnung ("Wer darf was?", "Wer bekommt Reports?")

**Hierarchie:** `parent_group_id` → Gruppen können verschachtelt sein!

**Felder:**

```sql
id                  INT PRIMARY KEY
tenant_id           INT NOT NULL
name                VARCHAR(100)
description         TEXT
parent_group_id     INT NULL → Hierarchie! (Gruppe kann Sub-Gruppen haben)
created_by          INT NOT NULL
```

**Verbindung:** N:M über `department_group_members`

```sql
-- Ein Department kann in MEHREREN Groups sein!
group_id        INT → FK zu department_groups
department_id   INT → FK zu departments
```

**Use Cases:**

1. **Berechtigungen:** "Management-Gruppe" hat Zugriff auf IT + HR + Finanzen
2. **Reporting:** "Produktion-Gesamt" umfasst Nord + Süd + Montage
3. **Workflows:** "Qualitätskontrolle" umfasst QS + Labor + Prüfung

**Beispiel:**

```
Group: "Produktion Gesamt"
  └─ Contains: Stufenfertigung, Endmontage, Verpackung

Group: "Qualitätskontrolle"
  └─ Contains: QS Nord, QS Süd, Labor

Department "QS Nord" kann in BEIDEN Gruppen sein!
```

---

### 5️⃣ **TEAMS** - Arbeitsgruppen

**Tabelle:** `teams`

**Bedeutung:** Arbeitsgruppen innerhalb einer Abteilung.

**Beziehung:**

- **1:N** → Team gehört zu genau EINER Department
- **N:M** → Users können in MEHREREN Teams sein (über `user_teams`)

**Felder:**

```sql
id              INT PRIMARY KEY
tenant_id       INT NOT NULL
name            VARCHAR(100)
department_id   INT NOT NULL → FK zu departments
```

**Beispiel:**

```
Department: "IT"
  ├─ Team: "Frontend Team"
  ├─ Team: "Backend Team"
  └─ Team: "DevOps Team"
```

---

### 6️⃣ **MACHINES** - Maschinen

**Tabelle:** `machines`

**Bedeutung:** Produktionsmaschinen, Geräte, Assets.

**Doppelte Zuordnung:**

1. **`area_id`** → Physischer Standort
2. **`department_id`** → Organisatorische Zuständigkeit

**Beziehung zu Teams:** N:M über `machine_teams`

**Felder:**

```sql
id                  INT PRIMARY KEY
tenant_id           INT NOT NULL
name                VARCHAR(100)
department_id       INT NULL
area_id             INT NULL
machine_type        ENUM('production', 'packaging', ...)
status              ENUM('operational', 'maintenance', ...)
serial_number       VARCHAR(100)
```

**Beispiel:**

```
Machine: "CNC Fräse Alpha"
  • area_id = Produktionshalle Nord (Physischer Standort)
  • department_id = Stufenfertigung (Zuständigkeit)
  • Teams: "Schicht A", "Schicht B" (über machine_teams)
```

---

### 7️⃣ **USERS** - Mitarbeiter & Administratoren

**Tabelle:** `users`

**Bedeutung:** Alle Personen im System (Employees, Admins, Root-Users).

**Rollen:**

- `root` - System-Administratoren (höchste Rechte)
- `admin` - Mandanten-Administratoren
- `employee` - Normale Mitarbeiter

**Beziehungen:**

1. **`department_id`** → Direkte Abteilungszuordnung (1:1)
2. **Teams** → N:M über `user_teams` (User kann in mehreren Teams sein!)

**Felder:**

```sql
id              INT PRIMARY KEY
tenant_id       INT NOT NULL
username        VARCHAR(255)
email           VARCHAR(255)
role            ENUM('root', 'admin', 'employee')
department_id   INT NULL → Direkte Abteilungszuordnung
```

**Beispiel:**

```
User: "Max Mustermann"
  • role = employee
  • department_id = IT-Abteilung
  • Teams: ["Frontend Team", "DevOps Team"] (über user_teams)
```

---

## 🔗 Beziehungsmodell

### Direkte Beziehungen (1:N oder 1:1)

| Von (Parent)   | Zu (Child) | Feld              | Typ | Beschreibung                     |
| -------------- | ---------- | ----------------- | --- | -------------------------------- |
| **TENANT**     | AREA       | `tenant_id`       | 1:N | Ein Tenant hat viele Areas       |
| **TENANT**     | DEPARTMENT | `tenant_id`       | 1:N | Ein Tenant hat viele Departments |
| **TENANT**     | DEPT_GROUP | `tenant_id`       | 1:N | Ein Tenant hat viele Groups      |
| **AREA**       | AREA       | `parent_id`       | 1:N | Area-Hierarchie (verschachtelt)  |
| **AREA**       | DEPARTMENT | `area_id`         | 1:N | Ein Area hat viele Departments   |
| **AREA**       | MACHINE    | `area_id`         | 1:N | Ein Area hat viele Machines      |
| **DEPT_GROUP** | DEPT_GROUP | `parent_group_id` | 1:N | Group-Hierarchie                 |
| **DEPARTMENT** | DEPARTMENT | `parent_id`       | 1:N | Dept-Hierarchie                  |
| **DEPARTMENT** | TEAM       | `department_id`   | 1:N | Ein Dept hat viele Teams         |
| **DEPARTMENT** | MACHINE    | `department_id`   | 1:N | Ein Dept hat viele Machines      |
| **DEPARTMENT** | USER       | `department_id`   | 1:N | Ein Dept hat viele Users         |

---

### N:M Beziehungen (Join-Tables)

| Entity A       | Entity B       | Join-Table                 | Beschreibung                                                            |
| -------------- | -------------- | -------------------------- | ----------------------------------------------------------------------- |
| **DEPT_GROUP** | **DEPARTMENT** | `department_group_members` | Groups können mehrere Depts haben, Depts können in mehreren Groups sein |
| **TEAM**       | **USER**       | `user_teams`               | Users können in mehreren Teams sein                                     |
| **MACHINE**    | **TEAM**       | `machine_teams`            | Machines können mehreren Teams zugeordnet sein                          |

---

## ⚠️ Wichtige Unterscheidungen

### 🔵 AREAS vs DEPARTMENT GROUPS

**AREAS** = **Physisch** ("Wo befindet sich etwas?")

- Gebäude, Hallen, Etagen, Räume
- Hat `parent_id` → Verschachtelbar (Gebäude → Halle → Raum)
- Maschinen und Departments werden physisch zugeordnet
- **Beispiel:** "Produktionshalle Nord, Raum 204"

**DEPARTMENT GROUPS** = **Logisch** ("Wer gehört organisatorisch zusammen?")

- Berechtigungsgruppen, Reporting-Gruppen, Workflows
- Hat `parent_group_id` → Hierarchie möglich
- Departments können in **MEHREREN** Groups sein!
- **Beispiel:** "Management-Gruppe" (IT + HR + Finanzen)

**Warum beides?**

```
Beispiel: IT-Abteilung

• area_id = "Hauptgebäude, 3. Etage" (Physisch)
• department_groups = ["Verwaltung", "Digitalisierung"] (Logisch)

→ Physisch im Hauptgebäude
→ Organisatorisch Teil von Verwaltung UND Digitalisierung
```

---

### 🔵 `parent_id` vs `parent_group_id`

**`parent_id`** (in `areas`):

- Hierarchie **innerhalb Areas**
- Area → Sub-Area (physische Verschachtelung)

**~~`parent_id`~~ (in `departments`):** ❌ **ENTFERNT 2025-10-23**

- Redundant - Department-Hierarchien sollten über `department_groups` abgebildet werden
- Vorteil: N:M Flexibilität statt 1:N Limitation

**`parent_group_id`** (in `department_groups`):

- Hierarchie **von Gruppen**
- Gruppe → Sub-Gruppe (logische Verschachtelung)

**Beispiel:**

```sql
-- Areas Hierarchie (physisch)
Area "Werk 1" (parent_id = NULL)
  └─ Area "Halle A" (parent_id = Werk 1)
      └─ Area "Raum A1" (parent_id = Halle A)

-- Department Groups Hierarchie (logisch)
Group "Gesamtbetrieb" (parent_group_id = NULL)
  └─ Group "Produktion" (parent_group_id = Gesamtbetrieb)
      └─ Group "Produktion Nord" (parent_group_id = Produktion)
          ├─ Department: "Stufenfertigung"
          └─ Department: "Endmontage"
```

---

### 🔵 Department Zuordnung: Direkt vs Team

**Direkte Zuordnung** (`users.department_id`):

- **Primäre Abteilung** des Mitarbeiters
- Wichtig für: Gehalt, Urlaubsanträge, Reporting
- **1:1 Beziehung** - jeder User hat EINE Hauptabteilung

**Team-Zuordnung** (`user_teams`):

- **Projektteams, Arbeitsgruppen**
- User kann in **mehreren Teams** sein
- **N:M Beziehung**

**Beispiel:**

```
User: "Anna Schmidt"
  • department_id = IT-Abteilung (Primär)
  • Teams: ["Frontend Team", "UX Team", "Security Task Force"]
```

---

## 🗂️ SQL-Beziehungen

### Foreign Keys

```sql
-- Areas
ALTER TABLE areas
  ADD FOREIGN KEY (parent_id) REFERENCES areas(id) ON DELETE CASCADE;

-- Departments
ALTER TABLE departments
  ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  ADD FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
  ADD FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE CASCADE,
  ADD FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- Department Groups
ALTER TABLE department_groups
  ADD FOREIGN KEY (parent_group_id) REFERENCES department_groups(id) ON DELETE CASCADE;

-- Department Group Members (N:M Join)
ALTER TABLE department_group_members
  ADD FOREIGN KEY (group_id) REFERENCES department_groups(id) ON DELETE CASCADE,
  ADD FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;

-- Teams
ALTER TABLE teams
  ADD FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;

-- Machines
ALTER TABLE machines
  ADD FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
  ADD FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- Machine Teams (N:M Join)
ALTER TABLE machine_teams
  ADD FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
  ADD FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

-- User Teams (N:M Join)
ALTER TABLE user_teams
  ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

-- Users
ALTER TABLE users
  ADD FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
```

---

## 📊 Beispiel: Live-Datenstruktur (Tenant 5601)

### Komplette Hierarchie aus echter DB

```
TENANT: testfirma.de (tenant_id = 5601)
│
├─ 📁 AREA: "Testarea" (id=46, type=building, parent_id=NULL)
│   │
│   ├─ 🏢 DEPARTMENT: "Testabteilung" (id=2782)
│   │   │
│   │   ├─ 👥 USERS (Direkte Zuordnung via department_id):
│   │   │   ├─ employee@testfirma.de (role=employee)
│   │   │   ├─ employeezwei@testfirma.de (role=employee)
│   │   │   ├─ employeedrei@testfirma.de (role=employee)
│   │   │   ├─ employeevier@testfirma.de (role=employee)
│   │   │   ├─ employeemareike@testfirma.de (role=employee)
│   │   │   └─ rootzwei@testfirma.de (role=root)
│   │   │
│   │   ├─ 👨‍👩‍👦 TEAM: "Testteam" (id=2083)
│   │   │   │
│   │   │   └─ Team Members (via user_teams):
│   │   │       ├─ employee@testfirma.de (role=member)
│   │   │       ├─ employeezwei@testfirma.de (role=member)
│   │   │       ├─ employeedrei@testfirma.de (role=member)
│   │   │       └─ employeevier@testfirma.de (role=member)
│   │   │
│   │   └─ 🏭 MACHINE: "Testmaschine" (id=169, type=production, status=operational)
│   │       │
│   │       └─ Machine Teams (via machine_teams):
│   │           └─ Testteam (id=2083)
│   │
│   ├─ 🏢 DEPARTMENT: "Stufenfertigung" (id=2801)
│   │   └─ (Keine Teams/Machines/Users in diesem Beispiel)
│   │
│   └─ 🏢 DEPARTMENT: "Testgruppezwei" (id=2802)
│       └─ (Keine Teams/Machines/Users in diesem Beispiel)
│
└─ 📋 DEPARTMENT GROUPS (Logische Gruppierung):
    │
    ├─ Group 1: "Testabteilungsgruppe" (id=1, parent_group_id=NULL)
    │   └─ Contains Departments (via department_group_members):
    │       ├─ Testabteilung (2782)
    │       └─ Stufenfertigung (2801)
    │
    └─ Group 2: "Testzweiiiiigruppeee" (id=2, parent_group_id=NULL)
        └─ Contains Departments (via department_group_members):
            ├─ Testabteilung (2782)
            ├─ Stufenfertigung (2801)
            └─ Testgruppezwei (2802)

WICHTIG:
- Department "Testabteilung" ist in BEIDEN Groups!
- Department "Stufenfertigung" ist auch in BEIDEN Groups!
```

---

## 🎯 Zusammenfassung der Hierarchie-Ebenen

```
Ebene 1: TENANT (Firma/Mandant)
  │
  ├─ Ebene 2a: AREAS (Physische Orte)
  │   └─ Ebene 3: DEPARTMENTS (können area_id haben)
  │       ├─ Ebene 4a: TEAMS
  │       ├─ Ebene 4b: MACHINES
  │       └─ Ebene 4c: USERS (direkt)
  │           └─ Ebene 5: USER-TEAM Zuordnung (N:M)
  │               └─ Ebene 6: MACHINE-TEAM Zuordnung (N:M)
  │
  └─ Ebene 2b: DEPARTMENT GROUPS (Logische Gruppierungen)
      └─ Ebene 3: DEPARTMENTS (via N:M Join)
```

---

## 💡 Best Practices

### 1. **Area-Nutzung**

- Verwende Areas für **physische Standorte**
- Nutze `parent_id` für verschachtelte Bereiche
- Beispiel: Gebäude → Etage → Raum

### 2. **Department Groups**

- Verwende Groups für **logische Organisation**
- Ein Department kann in mehreren Groups sein
- Beispiele:
  - Berechtigungen: "Management-Zugriff"
  - Reporting: "Produktion Gesamt"
  - Workflows: "Qualitätskontrolle-Kette"

### 3. **Teams vs Department**

- **Department** = Hauptabteilung (Gehalt, Urlaubsanträge)
- **Teams** = Projektgruppen (flexibel, wechselnd)

### 4. **Maschinen-Zuordnung**

- `area_id` = "Wo steht die Maschine?"
- `department_id` = "Wer ist verantwortlich?"
- Teams über `machine_teams` = "Wer arbeitet damit?"

---

## 🔍 Häufige Queries

### Alle Users einer Department Group

```sql
SELECT DISTINCT u.*
FROM users u
  JOIN departments d ON u.department_id = d.id
  JOIN department_group_members dgm ON d.id = dgm.department_id
WHERE dgm.group_id = 1  -- Gruppe 1
  AND u.tenant_id = 5601;
```

### Alle Machines in einem Area

```sql
SELECT m.*
FROM machines m
WHERE m.area_id = 46  -- Testarea
  AND m.tenant_id = 5601;
```

### Alle Teams eines Users

```sql
SELECT t.*
FROM teams t
  JOIN user_teams ut ON t.id = ut.team_id
WHERE ut.user_id = 35547  -- employee@testfirma.de
  AND t.tenant_id = 5601;
```

### Hierarchie-Abfrage: Area mit Sub-Areas

```sql
WITH RECURSIVE area_tree AS (
  -- Basis: Root Area
  SELECT id, name, parent_id, 0 as level
  FROM areas
  WHERE parent_id IS NULL AND tenant_id = 5601

  UNION ALL

  -- Rekursion: Sub-Areas
  SELECT a.id, a.name, a.parent_id, at.level + 1
  FROM areas a
    JOIN area_tree at ON a.parent_id = at.id
  WHERE a.tenant_id = 5601
)
SELECT * FROM area_tree ORDER BY level, name;
```

---

## ✅ Antwort auf deine Frage

### **Ist `area_id` das gleiche wie `parent_group_id`?**

**NEIN!** Komplett unterschiedliche Konzepte:

| Konzept           | Entity                             | Feld              | Bedeutung                               |
| ----------------- | ---------------------------------- | ----------------- | --------------------------------------- |
| **Areas**         | `areas`, `departments`, `machines` | `area_id`         | **Physischer Standort** (Wo ist etwas?) |
| **Parent Groups** | `department_groups`                | `parent_group_id` | **Logische Hierarchie** von Gruppen     |

**Beispiel:**

```
Department "IT-Abteilung"
  • area_id = 46 (Hauptgebäude, 3. Etage)  → Physisch
  • In Groups: ["Verwaltung", "Digital"]   → Logisch

Department Group "Verwaltung"
  • parent_group_id = NULL (Top-Level)

Department Group "IT-Untergruppe"
  • parent_group_id = Verwaltung (Sub-Group)
```

### **Soll `parent_group_id` durch `area_id` ersetzt werden?**

**NEIN!** Beides hat unterschiedliche Zwecke:

- **`area_id`** = "Produktionshalle Nord" (Physisch)
- **`parent_group_id`** = "Gruppe hat Sub-Gruppen" (Organisatorisch)

**Beide sind wertvoll** für verschiedene Use Cases!

---

## 📚 Siehe auch

- [DATABASE-SETUP-README.md](./DATABASE-SETUP-README.md) - Datenbank-Setup
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System-Architektur
- [TYPESCRIPT-STANDARDS.md](./TYPESCRIPT-STANDARDS.md) - Code-Standards

---

**Letzte Aktualisierung:** 2025-10-23
**Analysiert von:** Claude Code
**Basierend auf:** Live-Datenbank (Tenant 5601 "testfirma.de")
