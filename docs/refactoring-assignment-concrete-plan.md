# Assignment System - Konkreter Refactoring Plan

---

# 🔴🔴🔴 WICHTIGSTE REGEL 🔴🔴🔴

## IMMER NUR EINE ÄNDERUNG AUF EINMAL!

```
1. EINE Mission auswählen
2. SOFORT im Code umsetzen (cleanen, updaten)
3. SOFORT testen/verifizieren
4. ERST DANN nächste Mission

NIEMALS mehrere Änderungen gleichzeitig!
NIEMALS "ich mach das später"!
NIEMALS vergessen was geändert wurde!
```

---

**Erstellt:** 2025-11-27
**Aktualisiert:** 2025-11-27
**Prinzip:** KISS - Keep It Simple, Stupid + ONE CHANGE AT A TIME
**Status:** FINAL - Bereit zur Implementierung

---

## 1. Entscheidungen (FINAL)

### Entscheidung 1: Team-Permissions

**Gewählt: Option A** - `user_teams` reicht

- Team-Mitgliedschaft = Team-Sichtbarkeit
- KEINE neue `user_team_permissions` Tabelle

### Entscheidung 2: Department Groups

**Gewählt: Option B** - Aus Permission-System ENTFERNEN

- Area-Vererbung ersetzt Department Groups für Permissions
- `admin_group_permissions` Tabelle wird NICHT MEHR GENUTZT
- Department Groups bleiben für andere Zwecke (Reporting, etc.)

### Entscheidung 3: NULL-Handling

**Gewählt:** Direkte Zuweisung nötig

- Department ohne `area_id` → Braucht direkte Zuweisung
- Team ohne `department_id` → Braucht Team-Mitgliedschaft

### Entscheidung 4: "Access All" Option

**Gewählt:** `has_full_access` Flag in users Tabelle

- Checkbox im UI: "Zugriff auf alles"
- Wenn TRUE → User hat Vollzugriff wie Root (aber andere Rolle)
- Keine einzelnen Zuweisungen nötig

### Entscheidung 5: Content Visibility

**Gewählt:** `visibility_type` + `visibility_id` Pattern

- Wiederverwendbar für alle Features (Blackboard, Docs, Surveys, etc.)
- Levels: tenant, area, department, team

---

## 2. Datenbank-Änderungen

### 2.1 NEUE Spalte: `users.has_full_access`

```sql
-- Migration: database/migrations/YYYYMMDD_add_has_full_access.sql

ALTER TABLE users ADD COLUMN has_full_access TINYINT(1) DEFAULT 0
  AFTER role;

CREATE INDEX idx_users_full_access ON users(tenant_id, has_full_access);
```

### 2.2 NEUE Tabelle: `user_area_permissions`

```sql
-- Migration: database/migrations/YYYYMMDD_add_user_area_permissions.sql

CREATE TABLE user_area_permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  area_id INT NOT NULL,
  can_read TINYINT(1) DEFAULT 1,
  can_write TINYINT(1) DEFAULT 0,
  can_delete TINYINT(1) DEFAULT 0,
  assigned_by INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_uap_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_uap_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_uap_area FOREIGN KEY (area_id)
    REFERENCES areas(id) ON DELETE CASCADE,
  CONSTRAINT fk_uap_assigned_by FOREIGN KEY (assigned_by)
    REFERENCES users(id),

  UNIQUE KEY uq_user_area_tenant (user_id, area_id, tenant_id),
  INDEX idx_uap_tenant_user (tenant_id, user_id),
  INDEX idx_uap_tenant_area (tenant_id, area_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.3 BESTEHENDE Tabellen

```sql
-- BEHALTEN (unverändert):
-- admin_department_permissions (wird für Admin + Employee genutzt)
-- user_teams (Team-Mitgliedschaft = Team-Sichtbarkeit)

-- DEPRECATED (nicht mehr für Permissions nutzen):
-- admin_group_permissions → Area-Vererbung ersetzt diese Logik
```

### 2.4 Content Visibility Spalten (für Feature-Tabellen)

```sql
-- Für Tabellen die Visibility brauchen (blackboard, documents, surveys, etc.)
-- Diese Spalten hinzufügen:

visibility_type ENUM('tenant', 'area', 'department', 'team') DEFAULT 'tenant'
visibility_id INT NULL  -- NULL bei 'tenant', sonst area_id/dept_id/team_id

-- Beispiel für blackboard_entries:
ALTER TABLE blackboard_entries
  ADD COLUMN visibility_type ENUM('tenant', 'area', 'department', 'team') DEFAULT 'tenant',
  ADD COLUMN visibility_id INT NULL;
```

### 2.5 Übersicht: Finale Tabellen

| Tabelle                        | Zweck                              | Status                         |
| ------------------------------ | ---------------------------------- | ------------------------------ |
| `users.has_full_access`        | Vollzugriff-Flag                   | **NEUE SPALTE**                |
| `user_area_permissions`        | User → Area Sichtbarkeit           | **NEUE TABELLE**               |
| `admin_department_permissions` | User → Department Sichtbarkeit     | Behalten                       |
| `admin_group_permissions`      | ~~Dept Group Permissions~~         | **DEPRECATED**                 |
| `user_teams`                   | Team-Mitgliedschaft = Sichtbarkeit | Behalten                       |
| `*.visibility_type/id`         | Content Sichtbarkeit               | **NEUE SPALTEN** (pro Feature) |

---

## 3. Backend-Änderungen

### 3.1 Betroffene Dateien (Backend)

#### KRITISCH - Muss geändert werden:

| Datei                                       | Änderung                                          |
| ------------------------------------------- | ------------------------------------------------- |
| `middleware/departmentAccess.ts`            | Employee-Bypass ENTFERNEN + has_full_access Check |
| `services/adminPermission.service.ts`       | Hierarchie-Vererbung + has_full_access hinzufügen |
| `routes/v2/admin-permissions/service.ts`    | Area-Permissions hinzufügen                       |
| `routes/v2/admin-permissions/types.ts`      | Area-Types + has_full_access hinzufügen           |
| `routes/v2/admin-permissions/controller.ts` | Area-Endpoints hinzufügen                         |
| `routes/v2/admin-permissions/index.ts`      | Area-Routes hinzufügen                            |
| `routes/v2/users/users.service.ts`          | has_full_access bei User-Update                   |
| `routes/v2/users/users.types.ts`            | has_full_access Type hinzufügen                   |

#### NEU ERSTELLEN:

| Datei                                           | Zweck                                   |
| ----------------------------------------------- | --------------------------------------- |
| `services/hierarchyPermission.service.ts`       | Zentrale Permission-Logik mit Vererbung |
| `services/contentVisibility.service.ts`         | Content-Sichtbarkeit prüfen             |
| `routes/v2/admin-permissions/validation.zod.ts` | Zod Schemas für Area-Permissions        |

#### ANPASSEN - Filter-Logik:

| Datei                                          | Änderung          |
| ---------------------------------------------- | ----------------- |
| `routes/v2/departments/departments.service.ts` | Permission-Filter |
| `routes/v2/teams/teams.service.ts`             | Permission-Filter |
| `routes/v2/users/users.service.ts`             | Permission-Filter |
| `routes/v2/areas/areas.service.ts`             | Permission-Filter |

#### NEU ERSTELLEN:

| Datei                                           | Zweck                                   |
| ----------------------------------------------- | --------------------------------------- |
| `services/hierarchyPermission.service.ts`       | Zentrale Permission-Logik mit Vererbung |
| `routes/v2/admin-permissions/validation.zod.ts` | Zod Schemas für Area-Permissions        |

### 3.2 Konkrete Code-Änderungen

#### 3.2.1 `middleware/departmentAccess.ts`

```typescript
// VORHER (Zeile 128-132):
if (user.role === 'root' || user.role === 'employee') {
  next();
  return;
}

// NACHHER:
if (user.role === 'root') {
  next(); // NUR root bypassed
  return;
}
// Admin UND Employee durchlaufen Permission-Check
```

#### 3.2.2 Neuer Service: `services/hierarchyPermission.service.ts`

```typescript
/**
 * Hierarchy Permission Service
 * Zentrale Logik für Permission-Checks mit Vererbung
 */
export class HierarchyPermissionService {
  /**
   * Prüft ob User Zugriff auf Resource hat
   * Berücksichtigt Hierarchie-Vererbung
   */
  async hasAccess(
    userId: number,
    tenantId: number,
    resourceType: 'area' | 'department' | 'team',
    resourceId: number,
    permission: 'read' | 'write' | 'delete' = 'read',
  ): Promise<boolean> {
    // 1. User-Rolle holen
    const user = await this.getUser(userId, tenantId);

    // 2. Root = alles erlaubt
    if (user.role === 'root') {
      return true;
    }

    // 3. Je nach Resource-Type prüfen
    switch (resourceType) {
      case 'area':
        return this.checkAreaAccess(userId, resourceId, permission, tenantId);

      case 'department':
        return this.checkDepartmentAccess(userId, resourceId, permission, tenantId);

      case 'team':
        return this.checkTeamAccess(userId, resourceId, permission, tenantId);
    }
  }

  /**
   * Department-Zugriff mit Area-Vererbung
   * KEINE Department Groups mehr! (deprecated)
   */
  private async checkDepartmentAccess(
    userId: number,
    departmentId: number,
    permission: string,
    tenantId: number,
  ): Promise<boolean> {
    // 1. Direkte Department-Permission?
    const directPerm = await this.getDirectDepartmentPerm(userId, departmentId, tenantId);
    if (directPerm && this.hasPermLevel(directPerm, permission)) {
      return true;
    }

    // 2. Vererbt von Area? (NUR wenn Department area_id hat!)
    const dept = await this.getDepartment(departmentId, tenantId);
    if (dept.area_id !== null) {
      const areaPerm = await this.getAreaPerm(userId, dept.area_id, tenantId);
      if (areaPerm && this.hasPermLevel(areaPerm, permission)) {
        return true;
      }
    }

    // 3. area_id ist NULL → Keine Vererbung möglich
    // User braucht direkte Department-Zuweisung
    return false;
  }

  /**
   * Team-Zugriff mit Department-Vererbung
   */
  private async checkTeamAccess(
    userId: number,
    teamId: number,
    permission: string,
    tenantId: number,
  ): Promise<boolean> {
    // 1. Team-Mitgliedschaft?
    const isMember = await this.isTeamMember(userId, teamId, tenantId);
    if (isMember) {
      return true; // Mitglieder haben immer read-Zugriff
    }

    // 2. Vererbt von Department? (NUR wenn Team department_id hat!)
    const team = await this.getTeam(teamId, tenantId);
    if (team.department_id !== null) {
      return this.checkDepartmentAccess(userId, team.department_id, permission, tenantId);
    }

    return false;
  }

  /**
   * Holt alle zugänglichen IDs für Filter
   */
  async getAccessibleIds(
    userId: number,
    tenantId: number,
    resourceType: 'area' | 'department' | 'team',
  ): Promise<number[]> {
    // Für Listen-Filter in UI
    // Implementierung je nach resourceType
  }
}

export const hierarchyPermissionService = new HierarchyPermissionService();
```

### 3.3 API-Endpoints

#### Neue Endpoints für Area-Permissions:

```
POST   /api/v2/admin-permissions/:userId/areas
       Body: { areaIds: number[], permissions: PermissionSet }

DELETE /api/v2/admin-permissions/:userId/areas/:areaId

GET    /api/v2/admin-permissions/:userId
       Response: { areas: [], departments: [], groups: [], hasFullAccess: boolean }
```

---

## 4. Frontend-Änderungen

### 4.1 Betroffene Dateien (Frontend)

#### User-Management (Area-Assignment hinzufügen):

| Datei                               | Änderung                 |
| ----------------------------------- | ------------------------ |
| `scripts/manage/employees/forms.ts` | Area-Dropdown hinzufügen |
| `scripts/manage/employees/ui.ts`    | Area-Anzeige             |
| `scripts/manage/employees/types.ts` | Area-Types               |
| `scripts/manage/admins/forms.ts`    | Area-Assignment UI       |
| `scripts/manage/admins/ui.ts`       | Area-Anzeige             |

#### Filter-Listen (basierend auf Permissions):

| Datei                                 | Änderung               |
| ------------------------------------- | ---------------------- |
| `scripts/manage/departments/index.ts` | Filter nach Permission |
| `scripts/manage/teams/index.ts`       | Filter nach Permission |
| `scripts/manage/areas/index.ts`       | Filter nach Permission |

### 4.2 HTML-Änderungen

| Datei                         | Änderung                |
| ----------------------------- | ----------------------- |
| `pages/manage-employees.html` | Area-Dropdown im Modal  |
| `pages/manage-admins.html`    | Area-Assignment Section |

---

## 5. Migration-Schritte

### Phase 1: Datenbank (Non-Breaking) ✓ DONE

```bash
# ✓ Migration 20251127_add_has_full_access.sql - DONE
# ✓ Migration 20251127_add_user_area_permissions.sql - DONE
# ✓ Beide ausgeführt und verifiziert (2025-11-27)
```

### Phase 2: Backend (Schrittweise) ✓ DONE

```
1. [x] hierarchyPermission.service.ts erstellen ✓ (2025-11-27)
2. [x] departmentAccess.ts - Employee-Bypass entfernen ✓ (2025-11-27)
3. [x] admin-permissions Service erweitern ✓ (2025-11-27)
4. [x] contentVisibility.service.ts erstellen ✓ (2025-11-27)
5. [x] API-Endpoints für Area hinzufügen ✓ (2025-11-27)
   - POST /:userId/areas - Set area permissions
   - DELETE /:userId/areas/:areaId - Remove area permission
   - PATCH /:userId/full-access - Set has_full_access flag
6. [x] Tests → Manuell (2025-11-27)
```

### Phase 3: Frontend ✓ DONE

```
1. [x] Types erweitern ✓ (2025-11-27)
   - admins/types.ts: Area interface, hasFullAccess
   - employees/types.ts: Area interface
2. [x] Admin-Forms Area-Dropdown hinzufügen ✓ (2025-11-27)
   - manage-admins.html: Full Access checkbox, Area select
   - admins/forms.ts: showPermissionsModal, savePermissionsHandler
   - admins/data.ts: loadAreas, updateUserAreaPermissions, setUserFullAccess
3. [x] Employee-Forms → Nicht nötig (department_id reicht für Zugehörigkeit)
4. [ ] Filter-Logik in Listen → In Arbeit
```

### Phase 4: Testing ✓ MANUELL

```
Tests werden manuell durchgeführt (2025-11-27)
```

### Phase 5: Filter-Logik in Listen ✓ DONE

```
Ziel: User sieht nur Daten, auf die er Zugriff hat
1. [x] Mitarbeiter-Liste filtern ✓ (users/index.ts + filterDepartmentResults)
2. [x] Abteilungs-Liste filtern ✓ (departments/index.ts + filterDepartmentsByAccess)
3. [x] Team-Liste filtern ✓ (teams/index.ts + filterTeamsByDepartment)
4. [x] Area-Liste filtern ✓ (areas/index.ts + filterAreasByAccess)

Implementiert via departmentAccess.ts:
- filterDepartmentResults: Filtert nach department_id/departmentId
- createDepartmentFilter(): Factory für custom field filtering
- filterDepartmentsByAccess: Filtert departments by id
- filterTeamsByDepartment: Filtert teams by department_id
- filterAreasByAccess: Filtert areas by id (via getAccessibleAreaIds)
```

---

## 6. Vererbungs-Logik (Diagramm)

```
PERMISSION CHECK FLOW (vereinfacht):
=====================================

hasAccess(userId, 'department', deptId)?
       │
       ▼
┌─────────────────────────────────┐
│ 1. Ist User role='root'?        │
│    JA → return TRUE             │
└─────────────────────────────────┘
       │ NEIN
       ▼
┌─────────────────────────────────┐
│ 2. Hat User direkte Dept-Perm?  │
│    (admin_department_permissions)│
│    JA → return TRUE             │
└─────────────────────────────────┘
       │ NEIN
       ▼
┌─────────────────────────────────┐
│ 3. Hat Department area_id?      │
│    NEIN (NULL) → return FALSE   │
└─────────────────────────────────┘
       │ JA
       ▼
┌─────────────────────────────────┐
│ 4. Hat User Area-Permission?    │
│    (user_area_permissions)      │
│    JA → return TRUE (vererbt!)  │
│    NEIN → return FALSE          │
└─────────────────────────────────┘


VERERBUNGS-BEISPIEL:
====================

USER hat Area 1 zugewiesen (user_area_permissions)
       │
       ▼
┌──────────────────────────────────────────────────┐
│  AREA 1                                          │
│  └── Departments mit area_id = 1                 │
│      ├── Department A  ← VERERBT                 │
│      │   └── Teams                               │
│      │       ├── Team X  ← wenn Mitglied         │
│      │       └── Team Y  ← wenn Mitglied         │
│      └── Department B  ← VERERBT                 │
└──────────────────────────────────────────────────┘

EXPLIZITE AUSNAHMEN (zusätzlich):
=================================
├── Department C (area_id = 2) ← DIREKTE Zuweisung
└── Team W Mitgliedschaft      ← user_teams Eintrag

NULL-HANDLING:
==============
Department.area_id = NULL:
→ KEINE Vererbung
→ Braucht admin_department_permissions Eintrag

Team.department_id = NULL:
→ KEINE Vererbung
→ Braucht user_teams Mitgliedschaft
```

---

## 7. Checkliste vor Start

- [x] Frage 1: user_team_permissions → NEIN (user_teams reicht)
- [x] Frage 2: Department Groups → DEPRECATED für Permissions
- [x] Frage 3: NULL-Handling → Braucht direkte Zuweisung
- [x] Frage 4: "Access All" → has_full_access Flag in users
- [x] Frage 5: Content Visibility → visibility_type + visibility_id Pattern
- [ ] Backup der DB gemacht
- [ ] Branch erstellt

---

## 8. Risiken & Mitigation

| Risiko           | Mitigation                                    |
| ---------------- | --------------------------------------------- |
| Breaking Changes | Schrittweise Migration, Feature-Flag          |
| Performance      | Caching für Permission-Lookups (später)       |
| Komplexität      | Zentrale Service-Klasse, keine doppelte Logik |
| Edge Cases       | NULL-Handling klar definiert, Tests           |

---

## 9. Nicht im Scope (Later)

- [ ] Machine-Permissions (Phase 2)
- [ ] Time-based Permissions (JIT Access)
- [ ] Permission-Caching (Redis)
- [ ] Audit-Trail für Permission-Änderungen
- [ ] Bulk-Assignment UI

---

## 10. Zusammenfassung (TL;DR)

### Was wir machen:

| Aktion                 | Details                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| **1 neue Spalte**      | `users.has_full_access`                                           |
| **1 neue Tabelle**     | `user_area_permissions`                                           |
| **2 neue Services**    | `hierarchyPermission.service.ts` + `contentVisibility.service.ts` |
| **1 Code-Fix**         | Employee-Bypass entfernen                                         |
| **Content Visibility** | `visibility_type` + `visibility_id` für Features                  |
| **Department Groups**  | DEPRECATED für Permissions                                        |

### ZWEI Konzepte:

```
1. USER PERMISSIONS (wer darf was zugreifen?)
   ├── Root → Alles
   ├── has_full_access=true → Alles
   ├── Area-Perm → Alle Departments mit area_id
   ├── Dept-Perm → Explizit
   └── Team → user_teams Mitgliedschaft

2. CONTENT VISIBILITY (wer sieht diesen Content?)
   ├── tenant → Alle im Tenant
   ├── area → Alle mit Area-Zugriff
   ├── department → Alle mit Dept-Zugriff
   └── team → Alle Team-Mitglieder
```

### Betroffene Tabellen:

| Tabelle                        | Aktion                                |
| ------------------------------ | ------------------------------------- |
| `users.has_full_access`        | NEUE SPALTE                           |
| `user_area_permissions`        | NEUE TABELLE                          |
| `admin_department_permissions` | Behalten                              |
| `admin_group_permissions`      | DEPRECATED                            |
| `user_teams`                   | Behalten                              |
| `blackboard_entries` etc.      | visibility_type/id Spalten hinzufügen |

### Permission Check Flow:

```typescript
// In jedem Permission-Check:
if (user.role === 'root') return true;
if (user.has_full_access) return true;
// ... dann normale Permission-Logik
```

---

**Status:** FINAL - Bereit zur Implementierung
**Nächster Schritt:** Dein OK → Implementation starten
