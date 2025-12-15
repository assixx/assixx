# Refactoring Assignment Plan

**Erstellt:** 2025-11-27
**Basiert auf:** Industry Best Practices (Microsoft Entra ID, AWS, Auth0)
**Prinzip:** KISS + Security First + Langfristig Skalierbar

---

## Inhaltsverzeichnis

1. [Executive Summary](#1-executive-summary)
2. [Research Zusammenfassung](#2-research-zusammenfassung)
3. [Ist-Zustand Bewertung](#3-ist-zustand-bewertung)
4. [Empfohlene Lösung](#4-empfohlene-lösung)
5. [Datenbank Änderungen](#5-datenbank-änderungen)
6. [Code Änderungen](#6-code-änderungen)
7. [Migration](#7-migration)
8. [Quellen](#8-quellen)

---

## 1. Executive Summary

### Problem
Das aktuelle Assignment-System unterstützt nur Department- und Department-Group-Zuweisungen für Admins. Es fehlen Area-Zuweisungen, Team-Zuweisungen, und ein Employee-Permission-System.

### Lösung
**Hybrid Hierarchical RBAC (H-RBAC)** mit:
- Hierarchie-Vererbung (Area → Departments → Teams)
- Explizite Ausnahmen für Sonderfälle
- Code-basierte Root-Prüfung (kein DB-Eintrag nötig)
- **"Access All" Flag** für schnelle Vollzugriff-Vergabe
- **Content Visibility Pattern** für Feature-Sichtbarkeit (Blackboard, etc.)
- Normalisierte N:M Tabellen (keine JSON Arrays)

### Aufwand
- **DB Migration:** 1 neue Tabelle, 1 neue Spalte in users
- **Backend Code:** Neue Permission-Service Logik + Visibility-Service
- **Keine Breaking Changes:** Bestehende Tabellen bleiben kompatibel

### Zwei Konzepte verstehen

| Konzept | Frage | Beispiel |
|---------|-------|----------|
| **User Permissions** | Was kann User X zugreifen? | User X hat Area 1 Zugriff |
| **Content Visibility** | Wer kann Content Y sehen? | Blackboard Y ist sichtbar für Area 1 |

---

## 2. Research Zusammenfassung

### Microsoft Entra ID Best Practices

| Prinzip | Bedeutung für Assixx |
|---------|---------------------|
| **Least Privilege** | Nur nötige Berechtigungen vergeben |
| **Group-Based Access** | Zuweisungen über Gruppen, nicht einzelne User |
| **Built-in + Custom Roles** | Vordefinierte Rollen + Anpassungen |
| **JIT Access** | Zeitlich begrenzte Berechtigungen (später) |

### Multi-Tenant SaaS Patterns

| Pattern | Anwendung |
|---------|-----------|
| **H-RBAC** | Hierarchische Rollen mit Vererbung |
| **Per-Tenant Scoping** | Alle Permissions sind tenant_id-isoliert |
| **Policy Inheritance** | Parent-Berechtigung vererbt an Children |

### RBAC vs. ABAC Entscheidung

**Empfehlung: Hybrid RBAC-A**
- RBAC für grobe Zugriffskontrolle (Area, Department, Team)
- Attribute für Feinsteuerung (can_read, can_write, can_delete)

### Datenbank Design

**Empfehlung: Normalisierte N:M Tabellen**
- ✅ Referentielle Integrität
- ✅ Effiziente Queries
- ✅ Standard SQL Joins
- ❌ JSON Arrays vermeiden (schlechte Query-Performance, keine FK)

---

## 3. Ist-Zustand Bewertung

### Was funktioniert GUT ✅

| Komponente | Bewertung |
|------------|-----------|
| `tenant_id` Isolation | ✅ Perfekt - überall vorhanden |
| `admin_department_permissions` | ✅ Gut - N:M mit Permissions |
| `admin_group_permissions` | ✅ Gut - N:M mit Permissions |
| `user_teams` | ✅ Gut - N:M für Team-Mitgliedschaft |
| Role Enum | ✅ Gut - root/admin/employee |
| Department Groups | ✅ Gut - Logische Gruppierung |

### Was FEHLT ❌

| Komponente | Problem |
|------------|---------|
| `admin_area_permissions` | Keine Area-Zuweisung möglich |
| Employee Permissions | Employees bypassen ALLE Checks |
| Hierarchie-Vererbung | Nicht implementiert |
| Team-Level Admin Access | Nur über Department möglich |

### Was GEÄNDERT werden muss ⚠️

| Komponente | Änderung |
|------------|----------|
| `departmentAccess.ts` | Employee Bypass entfernen |
| Permission Logic | Hierarchie-Vererbung hinzufügen |

---

## 4. Empfohlene Lösung

### 4.1 Rollen-Verhalten

```
ROOT (role = 'root')
├── Prüfung: NUR im Code (role === 'root')
├── DB Einträge: KEINE nötig
├── Zugriff: ALLES im Tenant (automatisch)
└── Neue Entities: Automatisch Zugriff

ADMIN/EMPLOYEE mit has_full_access = TRUE
├── Prüfung: Flag in users Tabelle
├── DB Einträge: KEINE Permission-Einträge nötig
├── Zugriff: ALLES im Tenant (wie Root, aber andere Rolle)
└── Use Case: Admin der alles sehen/verwalten darf

ADMIN (role = 'admin', has_full_access = FALSE)
├── Prüfung: DB Lookup in Permission-Tabellen
├── Zuweisungen: Areas, Departments, Teams
├── Hierarchie: Area-Zuweisung → alle Departments in Area
└── Ausnahmen: Explizite Department/Team Zuweisungen außerhalb

EMPLOYEE (role = 'employee', has_full_access = FALSE)
├── Prüfung: DB Lookup (GLEICHE Tabellen wie Admin)
├── Zuweisungen: Wie Admin, aber weniger Rechte
├── Default: can_read=1, can_write=0, can_delete=0
└── Sichtbarkeit: Nur zugewiesene Bereiche
```

### 4.2 "Access All" Option

```sql
-- Neue Spalte in users Tabelle
ALTER TABLE users ADD COLUMN has_full_access TINYINT(1) DEFAULT 0;
```

**Verwendung:**
- Checkbox im Admin-UI: "Zugriff auf alles"
- Wenn aktiviert → User sieht/verwaltet ALLES im Tenant
- Keine einzelnen Area/Department Zuweisungen nötig
- Neue Entities automatisch sichtbar

### 4.3 Hierarchie-Vererbungs-Logik

```
AREA-Zuweisung
│
├── Erbt: ALLE Departments mit area_id = diese Area
│
└── PLUS: Explizite Ausnahmen möglich
    └── Department außerhalb der Area

TEAM-Zugriff
└── NUR über user_teams Mitgliedschaft (KEINE Vererbung!)
```

### 4.4 Content Visibility Pattern

**Problem:** Wenn User Content erstellt (Blackboard, Dokument, etc.), wer soll es sehen können?

**Lösung:** Jede Content-Tabelle bekommt Visibility-Felder:

```sql
-- Beispiel: blackboard_entries Tabelle
visibility_type ENUM('tenant', 'area', 'department', 'team') DEFAULT 'tenant'
visibility_id INT NULL  -- NULL bei 'tenant', sonst die spezifische ID
```

**Visibility-Levels:**

| Level | visibility_type | visibility_id | Wer sieht es? |
|-------|-----------------|---------------|---------------|
| Ganze Firma | 'tenant' | NULL | Alle im Tenant |
| Ganze Area | 'area' | area_id | Alle mit Area-Zugriff |
| Ganzes Dept | 'department' | dept_id | Alle mit Dept-Zugriff |
| Ganzes Team | 'team' | team_id | Alle Team-Mitglieder |

**Visibility Check Algorithmus:**

```typescript
function canUserSeeContent(userId: number, content: Content): boolean {
  const user = getUser(userId);

  // Root und has_full_access sehen alles
  if (user.role === 'root' || user.has_full_access) {
    return true;
  }

  switch (content.visibility_type) {
    case 'tenant':
      return true;  // Alle im Tenant sehen es

    case 'area':
      return hasAreaAccess(userId, content.visibility_id);

    case 'department':
      return hasDepartmentAccess(userId, content.visibility_id);

    case 'team':
      return isTeamMember(userId, content.visibility_id);
  }
}
```

**Betroffene Feature-Tabellen:**

| Feature | Tabelle | Visibility hinzufügen? |
|---------|---------|------------------------|
| Blackboard | blackboard_entries | JA |
| Dokumente | documents | JA (hat schon teilweise) |
| Surveys | surveys | JA |
| KVP | kvp_entries | JA |
| Calendar | calendar_events | JA |

### 4.5 Permission Check Algorithmus

```typescript
function hasAccess(userId, targetType, targetId, permission) {
  const user = getUser(userId);

  // 1. Root Check (Code-basiert)
  if (user.role === 'root') return true;

  // 2. "Access All" Flag Check (NEU!)
  if (user.has_full_access === true) return true;

  // 3. Direkte Zuweisung prüfen
  if (hasDirectPermission(userId, targetType, targetId, permission)) {
    return true;
  }

  // 4. Hierarchie-Vererbung prüfen (NUR für Departments!)
  if (targetType === 'department') {
    const dept = getDepartment(targetId);
    // Hat User Zugriff auf die Area des Departments?
    if (dept.area_id !== null) {
      if (hasDirectPermission(userId, 'area', dept.area_id, permission)) {
        return true;
      }
    }
  }

  // 5. Team = NUR Mitgliedschaft (keine Vererbung!)
  if (targetType === 'team') {
    return isTeamMember(userId, targetId);
  }

  return false;
}
```

---

## 5. Datenbank Änderungen

### 5.1 Neue Spalte: `users.has_full_access`

```sql
-- Migration: users Tabelle erweitern
ALTER TABLE users ADD COLUMN has_full_access TINYINT(1) DEFAULT 0
  AFTER role;

-- Index für schnelle Abfragen
CREATE INDEX idx_users_full_access ON users(tenant_id, has_full_access);
```

**Bedeutung:**
- `has_full_access = 0` → Normale Permission-Logik
- `has_full_access = 1` → Vollzugriff auf alles im Tenant

### 5.2 Neue Tabelle: `user_area_permissions`

```sql
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

  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id),

  UNIQUE KEY unique_user_area (user_id, area_id, tenant_id),
  INDEX idx_tenant_user (tenant_id, user_id),
  INDEX idx_tenant_area (tenant_id, area_id)
);
```

### 5.3 Bestehende Tabellen (KEINE Umbenennung!)

```sql
-- BEHALTEN wie sie sind:
-- admin_department_permissions → Wird für Admin + Employee genutzt
-- user_teams → Team-Mitgliedschaft = Team-Sichtbarkeit

-- DEPRECATED (nicht mehr für Permissions nutzen):
-- admin_group_permissions → Area-Vererbung ersetzt diese Logik
```

### 5.4 Übersicht: Finale Tabellen-Struktur

| Tabelle | Zweck | Status |
|---------|-------|--------|
| `users.has_full_access` | Vollzugriff Flag | **NEUE SPALTE** |
| `user_area_permissions` | User → Area | **NEUE TABELLE** |
| `admin_department_permissions` | User → Department | Behalten (für alle Rollen) |
| `admin_group_permissions` | ~~Dept Group Perms~~ | **DEPRECATED** |
| `user_teams` | Team-Mitgliedschaft = Sichtbarkeit | Behalten |

### 5.5 Warum KEINE JSON Arrays?

| JSON Arrays | N:M Tabellen |
|-------------|--------------|
| ❌ Keine Foreign Keys | ✅ Referentielle Integrität |
| ❌ Schlechte Query-Performance | ✅ Index-optimiert |
| ❌ Komplexe Updates | ✅ Standard SQL |
| ❌ Keine JOINs möglich | ✅ Effiziente JOINs |

---

## 6. Code Änderungen

### 6.1 Neuer Service: `userPermissions.service.ts`

```typescript
/**
 * Unified Permission Service
 * Handles all permission checks with hierarchy inheritance
 */
class UserPermissionsService {

  /**
   * Check if user has access to a resource
   */
  async hasAccess(
    userId: number,
    tenantId: number,
    resourceType: 'area' | 'department' | 'team' | 'machine',
    resourceId: number,
    permission: 'read' | 'write' | 'delete'
  ): Promise<boolean> {

    // 1. Get user role
    const user = await this.getUser(userId, tenantId);

    // 2. Root bypasses all checks
    if (user.role === 'root') {
      return true;
    }

    // 3. Check based on resource type with inheritance
    switch (resourceType) {
      case 'area':
        return this.checkAreaAccess(userId, resourceId, permission, tenantId);
      case 'department':
        return this.checkDepartmentAccess(userId, resourceId, permission, tenantId);
      case 'team':
        return this.checkTeamAccess(userId, resourceId, permission, tenantId);
      case 'machine':
        return this.checkMachineAccess(userId, resourceId, permission, tenantId);
    }
  }

  /**
   * Check department access with area inheritance
   */
  private async checkDepartmentAccess(
    userId: number,
    departmentId: number,
    permission: string,
    tenantId: number
  ): Promise<boolean> {

    // Direct department permission
    const directPerm = await this.getDirectDepartmentPermission(userId, departmentId, tenantId);
    if (directPerm && this.hasPermissionLevel(directPerm, permission)) {
      return true;
    }

    // Group permission (existing logic)
    const groupPerm = await this.getGroupPermission(userId, departmentId, tenantId);
    if (groupPerm && this.hasPermissionLevel(groupPerm, permission)) {
      return true;
    }

    // Inherited from Area
    const department = await this.getDepartment(departmentId, tenantId);
    if (department.area_id) {
      const areaPerm = await this.getDirectAreaPermission(userId, department.area_id, tenantId);
      if (areaPerm && this.hasPermissionLevel(areaPerm, permission)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all accessible resource IDs for a user
   */
  async getAccessibleResources(
    userId: number,
    tenantId: number,
    resourceType: 'area' | 'department' | 'team'
  ): Promise<number[]> {
    // Used for filtering lists in UI
  }
}
```

### 6.2 Änderung: `departmentAccess.ts`

```typescript
// VORHER (FALSCH):
if (user.role === 'root' || user.role === 'employee') {
  next();  // Employee bypasses all!
  return;
}

// NACHHER (RICHTIG):
if (user.role === 'root') {
  next();  // Only root bypasses
  return;
}

// Admin AND Employee go through permission check
const hasAccess = await userPermissionsService.hasAccess(
  user.id,
  user.tenant_id,
  'department',
  departmentId,
  requiredPermission
);
```

### 6.3 API Endpoints für Assignment

```typescript
// POST /api/v2/users/:userId/permissions/areas
// Body: { areaIds: [1, 2], permissions: { canRead: true, canWrite: false, canDelete: false } }

// POST /api/v2/users/:userId/permissions/departments
// Body: { departmentIds: [1, 2, 3], permissions: { canRead: true, canWrite: true, canDelete: false } }

// POST /api/v2/users/:userId/permissions/teams
// Body: { teamIds: [1], permissions: { canRead: true, canWrite: false, canDelete: false } }

// GET /api/v2/users/:userId/permissions
// Returns: { areas: [...], departments: [...], teams: [...], hasFullAccess: boolean }
```

---

## 7. Migration

### Phase 1: Datenbank (Non-Breaking)

```sql
-- 1. Neue Tabellen erstellen
CREATE TABLE user_area_permissions (...);
CREATE TABLE user_team_permissions (...);

-- 2. Bestehende Tabellen umbenennen (optional)
RENAME TABLE admin_department_permissions TO user_department_permissions;
RENAME TABLE admin_group_permissions TO user_group_permissions;

-- 3. Bestehende Daten bleiben erhalten
```

### Phase 2: Backend Code

1. Neuen `UserPermissionsService` erstellen
2. `departmentAccess.ts` Middleware updaten
3. Neue API Endpoints hinzufügen
4. Bestehende Endpoints anpassen (Filter-Logik)

### Phase 3: Frontend

1. User-Management UI erweitern (Area/Team Assignment)
2. Permission-Anzeige in User-Detail
3. Filter-Logik für Listen basierend auf Permissions

### Phase 4: Testing

1. Unit Tests für Permission-Logik
2. Integration Tests für Hierarchie-Vererbung
3. E2E Tests für komplette Flows

---

## 8. Quellen

### Microsoft Official Documentation
- [Best practices for Microsoft Entra roles](https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/best-practices)
- [Best practices for Azure RBAC](https://learn.microsoft.com/en-us/azure/role-based-access-control/best-practices)
- [Azure identity & access security best practices](https://learn.microsoft.com/en-us/azure/security/fundamentals/identity-management-best-practices)

### Multi-Tenant SaaS Patterns
- [Auth0: How to Choose Authorization Model for Multi-Tenant SaaS](https://auth0.com/blog/how-to-choose-the-right-authorization-model-for-your-multi-tenant-saas-application/)
- [AWS: Multi-tenant SaaS authorization best practices](https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-api-access-authorization/introduction.html)
- [Cerbos: Multi-Tenant SaaS Authorization](https://www.cerbos.dev/blog/multi-tenant-saas-authorization-role-policies-and-scoped-resource-policies)

### RBAC vs ABAC
- [Okta: RBAC vs ABAC](https://www.okta.com/identity-101/role-based-access-control-vs-attribute-based-access-control/)
- [Splunk: RBAC vs ABAC Compared](https://www.splunk.com/en_us/blog/learn/rbac-vs-abac.html)
- [Frontegg: RBAC vs ABAC Use Cases](https://frontegg.com/guides/rbac-vs-abac)

### Database Design
- [Stack Overflow: JSON vs Many-to-Many](https://stackoverflow.com/questions/15367696/storing-json-in-database-vs-having-a-new-column-for-each-key)
- [DEV.to: When to Use JSON in Relational DB](https://dev.to/writech/when-to-use-json-data-in-a-relational-database-4i0b)
- [Bytebase: Top 10 Database Schema Design Best Practices](https://www.bytebase.com/blog/top-database-schema-design-best-practices/)

### Hierarchical RBAC
- [Satori: Comprehensive Guide to RBAC Design](https://satoricyber.com/data-access-control/a-comprehensive-guide-to-role-based-access-control-design/)
- [H-RBAC: Hierarchical Access Control Model for SaaS](https://www.mecs-press.org/ijmecs/ijmecs-v3-n5/IJMECS-V3-N5-7.pdf)
- [Hasura: Google Drive Style Hierarchical ACL](https://hasura.io/blog/implementing-a-google-drive-style-hierarchical-role-based-acl-system)

---

## Zusammenfassung

### Kernentscheidungen

| Entscheidung | Wahl | Begründung |
|--------------|------|------------|
| Root Handling | Code-Check | Keine DB-Einträge nötig, automatisch alles |
| **Access All** | `has_full_access` Flag | KISS - ein Checkbox für Vollzugriff |
| Datenstruktur | N:M Tabellen | Performance, Integrität, Standard |
| Vererbung | Area → Dept | Nur eine Ebene Vererbung |
| Team-Zugriff | user_teams Mitgliedschaft | KEINE separate Permission-Tabelle |
| Dept Groups | DEPRECATED | Area-Vererbung ersetzt es |
| **Content Visibility** | visibility_type + visibility_id | Wiederverwendbar für alle Features |

### DB-Änderungen

| Was | Typ | Status |
|-----|-----|--------|
| `users.has_full_access` | Neue Spalte | NEU |
| `user_area_permissions` | Neue Tabelle | NEU |
| `admin_department_permissions` | Bestehend | Behalten |
| `admin_group_permissions` | Bestehend | DEPRECATED |

### Zwei Konzepte

```
1. USER PERMISSIONS (wer darf was zugreifen?)
   └── Prüft: role, has_full_access, area_perms, dept_perms, team_membership

2. CONTENT VISIBILITY (wer sieht diesen Content?)
   └── Prüft: visibility_type + visibility_id gegen User Permissions
```

### Hauptänderungen im Code

```typescript
// 1. has_full_access Check hinzufügen
if (user.role === 'root' || user.has_full_access) return true;

// 2. Employee Bypass ENTFERNEN
// Gleiche Permission-Logik für Admin UND Employee

// 3. Content Visibility Service NEU
// Für Blackboard, Dokumente, Surveys, etc.
```

---

**Status:** FINAL - Bereit zur Implementierung
**Nächster Schritt:** Deine Bestätigung, dann Migration beginnen
