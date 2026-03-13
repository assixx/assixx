# FEAT: Lead-Based Access Control — Execution Masterplan

> **Created:** 2026-03-13
> **Version:** 0.1.0 (Draft)
> **Status:** DRAFT — Phase 0 (Planung)
> **Branch:** `feat/lead-access`
> **ADR:** ADR-035 (zu erstellen in Phase 7)
> **Author:** SCS-Technik Team
> **Estimated Sessions:** 9
> **Actual Sessions:** 0 / 9

---

## Changelog

| Version | Datum      | Änderung                           |
| ------- | ---------- | ---------------------------------- |
| 0.1.0   | 2026-03-13 | Initial Draft — Phasen 1-7 geplant |

---

## Konzept

Mitarbeiter mit einer `lead_id` (team_lead_id, deputy_lead_id, department_lead_id, area_lead_id) bekommen automatisch Zugriff auf die entsprechenden Manage-Seiten — gefiltert auf ihren Scope.

### Regeln

1. **Lead = Voraussetzung**: Nur Leads sehen Manage-Seiten in der Sidebar
2. **Kaskade**: Area-Lead sieht auch Departments + Teams unterhalb. Dept-Lead sieht auch Teams unterhalb
3. **Deputy = Lead**: `deputy_lead_id` hat identische Rechte wie `team_lead_id`
4. **ADR-020 Override**: Die Permission-Seite (`/manage-x/permission/:uuid`) gewinnt IMMER — Admin kann einem Lead den Zugriff entziehen
5. **Kein Hall-Lead**: Hall = physischer Ort, kein Lead-Konzept
6. **Root/Admin unchanged**: Bestehendes Verhalten für Root und Admin bleibt unverändert

### Seiten-Matrix

| Manage-Seite       | Root     | Admin    | Employee-Lead              | Lead-Scope                           |
| ------------------ | -------- | -------- | -------------------------- | ------------------------------------ |
| manage-areas       | ✓ (alle) | ✗        | ✓ wenn area_lead           | Nur seine Area(s)                    |
| manage-departments | ✓ (alle) | ✗        | ✓ wenn area/dept_lead      | Nur sein Scope (direkt + kaskadiert) |
| manage-teams       | ✓ (alle) | ✗        | ✓ wenn area/dept/team_lead | Nur sein Scope (direkt + kaskadiert) |
| manage-employees   | ✓ (alle) | ✓ (alle) | ✓ wenn irgendein Lead      | Nur Mitarbeiter in seinem Scope      |
| manage-admins      | ✓        | ✗        | ✗                          | —                                    |
| manage-halls       | ✓        | ✓        | ✗                          | —                                    |

### Zugriffslogik (Pseudocode)

```
canAccess(user, page):
  if role === 'root': return GRANT
  if role === 'admin' AND page === 'manage-employees': return GRANT
  if role !== 'employee': return DENY

  leadScope = resolveLeadScope(user.id)
  if not isLeadForPage(leadScope, page): return DENY

  adr020 = getExplicitPermission(user.id, 'manage_hierarchy', moduleCode)
  if adr020 exists AND adr020.canRead === false: return DENY

  return GRANT (Lead-Default = Grant)
```

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (alle Container healthy)
- [ ] DB Backup erstellt
- [ ] Branch `feat/lead-access` checked out
- [ ] Keine pending Migrations
- [ ] ADR-034 (Hierarchy Labels) vollständig propagiert
- [ ] ADR-020 (Per-User Permissions) stabil

### 0.2 Risk Register

| #   | Risiko                                                      | Impact  | Wahrscheinlichkeit | Mitigation                                                                | Verifikation                                             |
| --- | ----------------------------------------------------------- | ------- | ------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------- |
| R1  | Route Group Migration bricht bestehende Root/Admin-Zugriffe | Hoch    | Mittel             | +page.server.ts behält explizite Role-Checks                              | E2E: Root/Admin Zugriff auf alle Manage-Seiten nach Move |
| R2  | Lead-Scope Query ist langsam (multiple JOINs + Kaskade)     | Mittel  | Niedrig            | Single CTE-Query wie KVP's EXTENDED_ORG_INFO_QUERY                        | EXPLAIN ANALYZE < 5ms bei 500 Usern                      |
| R3  | ADR-020 Default-Deny vs Lead-Default-Grant Konflikt         | Hoch    | Mittel             | Klare Priorität: kein ADR-020 Eintrag + ist Lead = GRANT                  | Unit Test: Lead ohne Permission-Row hat Zugriff          |
| R4  | Employee sieht Manage-Seite aber Backend blockt Mutation    | Mittel  | Hoch               | Frontend conditional: Lead sieht Read+Edit, NICHT Create/Delete           | Smoke Test: Lead kann Team editieren, nicht löschen      |
| R5  | Kaskade zeigt zu viele Entities (Area-Lead sieht alles)     | Niedrig | Niedrig            | Kaskade ist gewollt (User-Entscheidung 2026-03-13)                        | Manual Test mit Jürgen (Area-Lead Fertigung)             |
| R6  | Areas/Departments validieren Lead nur als admin/root        | Hoch    | Sicher             | validateLeader() erweitern um employee-Rolle ODER separaten Lead-Endpoint | Test: Employee als area_lead setzen → kein Fehler        |

### 0.3 Ecosystem Integration Points

| Bestehendes System           | Art der Integration                                 | Phase |
| ---------------------------- | --------------------------------------------------- | ----- |
| PermissionGuard              | Erweitern um Lead-Check (invertierte Default-Logik) | 2     |
| Permission Registry          | Neue Kategorie `manage_hierarchy` registrieren      | 2     |
| Navigation Config            | `filterMenuByLeadRoles()` + Employee-Lead Items     | 5     |
| (app)/+layout.server.ts      | `fetchLeadScope()` parallel laden                   | 4     |
| KVP EXTENDED_ORG_INFO_QUERY  | Extrahieren in shared LeadScopeService              | 1     |
| Route Groups (admin)/(root)  | manage-\* Seiten nach (shared) migrieren            | 4     |
| Areas/Departments Validation | `validateLeader()` für Employee-Leads öffnen        | 2     |

---

## Ist-Zustand (Research-Ergebnis)

### Route Groups

| Seite              | Aktuell | Ziel     |
| ------------------ | ------- | -------- |
| manage-areas       | (admin) | (shared) |
| manage-departments | (admin) | (shared) |
| manage-teams       | (root)  | (shared) |
| manage-employees   | (admin) | (shared) |
| manage-admins      | (admin) | bleibt   |
| manage-halls       | (admin) | bleibt   |

### Backend Guards (aktuell)

| Controller  | @Roles (Mutation) | @RequirePermission addon | @RequirePermission module |
| ----------- | ----------------- | ------------------------ | ------------------------- |
| Areas       | admin, root       | `departments`            | `areas-manage`            |
| Departments | admin, root       | `departments`            | `departments-manage`      |
| Teams       | admin, root       | `teams`                  | `teams-manage`            |
| Users       | admin, root       | `employees`              | `employees-manage`        |

### Lead-ID Spalten (DB)

| Tabelle     | Spalte             | Rolle-Einschränkung (Validation) |
| ----------- | ------------------ | -------------------------------- |
| teams       | team_lead_id       | Keine (jede Rolle)               |
| teams       | deputy_lead_id     | Keine (jede Rolle)               |
| departments | department_lead_id | admin/root only                  |
| areas       | area_lead_id       | admin/root only                  |
| halls       | —                  | Kein Lead-Feld                   |

### Bestehende Lead-Logik (KVP)

`backend/src/nest/kvp/kvp.constants.ts` hat `EXTENDED_ORG_INFO_QUERY` — ein CTE das `teamLeadOf[]`, `departmentLeadOf[]`, `areaLeadOf[]` für einen User resolved. Das ist die Basis für den neuen LeadScopeService.

---

## Phase 1: Backend — LeadScopeService

> **Abhängigkeit:** Keine
> **Ziel:** Shared Service der Lead-Scope (direkt + kaskadiert + deputy) für einen User auflöst

### Step 1.1: LeadScopeService + Types [PENDING]

**Neues Verzeichnis:** `backend/src/nest/common/services/`

**Neue Dateien:**

- `backend/src/nest/common/services/lead-scope.service.ts`
- `backend/src/nest/common/types/lead-scope.types.ts`

**Types:**

```typescript
interface LeadScope {
  // Direkte Lead-Zuweisungen
  directAreaIds: number[];
  directDepartmentIds: number[];
  directTeamIds: number[]; // inkl. deputy_lead_id

  // Kaskadiert (Dept-IDs unter geführten Areas, Team-IDs unter geführten Areas/Depts)
  cascadedDepartmentIds: number[];
  cascadedTeamIds: number[];

  // Kombiniert für Queries
  allAreaIds: number[]; // direct
  allDepartmentIds: number[]; // direct + cascaded
  allTeamIds: number[]; // direct + cascaded

  // Booleans für Sidebar
  isAreaLead: boolean;
  isDepartmentLead: boolean;
  isTeamLead: boolean;
  isAnyLead: boolean;
}
```

**SQL-Query (Single CTE, basierend auf KVP-Pattern):**

```sql
WITH direct_areas AS (
  SELECT id FROM areas
  WHERE area_lead_id = $1 AND tenant_id = $2 AND is_active = 1
),
direct_departments AS (
  SELECT id FROM departments
  WHERE department_lead_id = $1 AND tenant_id = $2 AND is_active = 1
),
direct_teams AS (
  SELECT id FROM teams
  WHERE (team_lead_id = $1 OR deputy_lead_id = $1) AND tenant_id = $2 AND is_active = 1
),
cascaded_departments AS (
  SELECT d.id FROM departments d
  INNER JOIN direct_areas da ON d.area_id = da.id
  WHERE d.is_active = 1
),
cascaded_teams_from_areas AS (
  SELECT t.id FROM teams t
  INNER JOIN departments d ON t.department_id = d.id
  INNER JOIN direct_areas da ON d.area_id = da.id
  WHERE t.is_active = 1
),
cascaded_teams_from_depts AS (
  SELECT t.id FROM teams t
  INNER JOIN direct_departments dd ON t.department_id = dd.id
  WHERE t.is_active = 1
)
SELECT
  COALESCE(array_agg(DISTINCT da.id) FILTER (WHERE da.id IS NOT NULL), '{}') AS direct_area_ids,
  COALESCE(array_agg(DISTINCT dd.id) FILTER (WHERE dd.id IS NOT NULL), '{}') AS direct_department_ids,
  COALESCE(array_agg(DISTINCT dt.id) FILTER (WHERE dt.id IS NOT NULL), '{}') AS direct_team_ids,
  COALESCE(array_agg(DISTINCT cd.id) FILTER (WHERE cd.id IS NOT NULL), '{}') AS cascaded_department_ids,
  COALESCE(array_agg(DISTINCT ct.id) FILTER (WHERE ct.id IS NOT NULL), '{}') AS cascaded_team_ids
FROM direct_areas da
FULL OUTER JOIN direct_departments dd ON false
FULL OUTER JOIN direct_teams dt ON false
FULL OUTER JOIN cascaded_departments cd ON false
FULL OUTER JOIN (
  SELECT id FROM cascaded_teams_from_areas
  UNION
  SELECT id FROM cascaded_teams_from_depts
) ct ON false;
```

**Methoden:**

- `getLeadScope(userId: number, tenantId: number): Promise<LeadScope>`
- `isLeadForEntity(userId: number, tenantId: number, entityType: 'area' | 'department' | 'team', entityId: number): Promise<boolean>`

**Abhängigkeiten:** `DatabaseService` (DI)

### Step 1.2: KVP Refactoring — EXTENDED_ORG_INFO_QUERY ersetzen [PENDING]

**Geänderte Datei:** `backend/src/nest/kvp/kvp.service.ts`

- KVP's `EXTENDED_ORG_INFO_QUERY` durch `LeadScopeService.getLeadScope()` ersetzen
- Gleiche Ergebnisse, keine duplizierte Logik
- KVP-Module importiert `LeadScopeService` aus CommonModule

### Step 1.3: Neuer Endpoint — GET /users/me/lead-scope [PENDING]

**Geänderte Datei:** `backend/src/nest/users/users.controller.ts`

**Neuer Endpoint:**

| Method | Route                  | Guard        | Beschreibung                   |
| ------ | ---------------------- | ------------ | ------------------------------ |
| GET    | `/users/me/lead-scope` | JwtAuthGuard | Lead-Scope des aktuellen Users |

Kein @Roles — jeder authentifizierte User kann seinen eigenen Lead-Scope abfragen.

### Phase 1 — Definition of Done

- [ ] `LeadScope` Types definiert in shared types
- [ ] `LeadScopeService` mit Single-CTE-Query implementiert
- [ ] Endpoint `GET /users/me/lead-scope` liefert korrekten Scope
- [ ] KVP refactored: nutzt `LeadScopeService` statt eigener Query
- [ ] EXPLAIN ANALYZE der CTE-Query < 10ms
- [ ] ESLint 0 Errors
- [ ] Type-Check passed
- [ ] Bestehende KVP-Tests laufen weiterhin

---

## Phase 2: Backend — Permission Guard Extension

> **Abhängigkeit:** Phase 1 complete
> **Ziel:** PermissionGuard versteht Lead-basierte Zugriffe

### Step 2.1: Permission Registry — `manage_hierarchy` Kategorie [PENDING]

**Neue Dateien:**

- `backend/src/nest/common/permissions/manage-hierarchy.permissions.ts`
- `backend/src/nest/common/permissions/manage-hierarchy-permission.registrar.ts`

**Permission Definition:**

```typescript
export const MANAGE_HIERARCHY_PERMISSIONS: PermissionCategoryDef = {
  code: 'manage_hierarchy',
  label: 'Organisationsstruktur',
  icon: 'fa-sitemap',
  modules: [
    { code: 'manage-areas', label: 'Bereiche verwalten', allowedPermissions: ['canRead', 'canWrite'] },
    { code: 'manage-departments', label: 'Abteilungen verwalten', allowedPermissions: ['canRead', 'canWrite'] },
    { code: 'manage-teams', label: 'Teams verwalten', allowedPermissions: ['canRead', 'canWrite'] },
    { code: 'manage-employees', label: 'Mitarbeiter verwalten', allowedPermissions: ['canRead', 'canWrite'] },
  ],
};
```

**Kein canDelete**: Leads dürfen Entities lesen und bearbeiten, aber nicht löschen (Create/Delete bleibt Root/Admin).

### Step 2.2: PermissionGuard erweitern [PENDING]

**Geänderte Datei:** `backend/src/nest/common/guards/permission.guard.ts`

**Neue Logik für Employees mit Lead-Status:**

```
Aktuelle Logik:
  1. Kein @RequirePermission → pass
  2. hasFullAccess → pass
  3. DB-Lookup → grant/deny

Neue Logik (Ergänzung nach Schritt 2):
  1. Kein @RequirePermission → pass
  2. hasFullAccess → pass
  3. Ist manage_hierarchy Kategorie UND User ist Lead?
     → Ja: Check ADR-020 für expliziten DENY (invertierte Logik!)
       → Kein Eintrag = GRANT (Lead-Default)
       → Eintrag mit canRead=false = DENY
     → Nein: Standard DB-Lookup (fail-closed)
  4. Standard DB-Lookup → grant/deny
```

**Kritisch:** Die invertierte Default-Logik gilt NUR für `manage_hierarchy` + Lead-User. Alle anderen Permission-Checks bleiben fail-closed.

### Step 2.3: Controller @Roles erweitern [PENDING]

**Geänderte Dateien:**

- `backend/src/nest/areas/areas.controller.ts`
- `backend/src/nest/departments/departments.controller.ts`
- `backend/src/nest/teams/teams.controller.ts`
- `backend/src/nest/users/users.controller.ts`

**Änderungen:**

GET-Endpoints: `@Roles('admin', 'root', 'employee')` + `@RequirePermission('manage_hierarchy', 'manage-X', 'canRead')`

Mutation-Endpoints (POST/PUT): `@Roles('admin', 'root', 'employee')` + `@RequirePermission('manage_hierarchy', 'manage-X', 'canWrite')`

DELETE-Endpoints: Bleiben `@Roles('admin', 'root')` — Leads dürfen nicht löschen.

CREATE-Endpoints (POST neue Entity): Bleiben `@Roles('admin', 'root')` — Leads dürfen keine neuen Entities anlegen.

### Step 2.4: Data Scope Filtering in Services [PENDING]

**Geänderte Dateien:**

- `backend/src/nest/areas/areas.service.ts` → `listAreas()`: wenn Employee, filtern nach `allAreaIds`
- `backend/src/nest/departments/departments.service.ts` → `listDepartments()`: wenn Employee, filtern nach `allDepartmentIds`
- `backend/src/nest/teams/teams.service.ts` → `listTeams()`: wenn Employee, filtern nach `allTeamIds`
- `backend/src/nest/users/users.service.ts` → `listUsers()`: wenn Employee, filtern nach Team/Dept/Area-Membership

**Pattern für Scope-Filterung:**

```typescript
// In Service:
async listTeams(tenantId: number, filters: TeamFilters, actingUser?: UserContext): Promise<TeamRow[]> {
  let query = BASE_QUERY;
  const params = [tenantId];

  if (actingUser?.role === 'employee') {
    const scope = await this.leadScope.getLeadScope(actingUser.id, tenantId);
    if (scope.allTeamIds.length === 0) return [];
    params.push(scope.allTeamIds);
    query += ` AND t.id = ANY($${params.length})`;
  }

  return this.db.query<TeamRow>(query, params);
}
```

### Step 2.5: Leader Validation öffnen [PENDING]

**Geänderte Dateien:**

- `backend/src/nest/areas/areas.service.ts` → `validateLeader()`: Employee-Rolle erlauben
- `backend/src/nest/departments/departments.service.ts` → `validateLeader()`: Employee-Rolle erlauben

**Warum:** Aktuell können nur Admin/Root als Area/Department-Lead gesetzt werden. Für zukünftige Flexibilität (und Konsistenz mit Teams, wo Employees bereits Leads sein können) öffnen.

### Phase 2 — Definition of Done

- [ ] `manage_hierarchy` Permission-Kategorie registriert
- [ ] PermissionGuard Lead-Logik implementiert (invertierte Default für Leads)
- [ ] GET-Endpoints erlauben Employee-Rolle
- [ ] Mutation-Endpoints (Edit) erlauben Employee-Rolle
- [ ] Create/Delete-Endpoints bleiben Admin/Root only
- [ ] Data Scope Filtering in allen 4 Services implementiert
- [ ] validateLeader() akzeptiert Employees
- [ ] Bestehende Root/Admin-Zugriffe unverändert (Regression-Test)
- [ ] ESLint 0 Errors
- [ ] Type-Check passed

---

## Phase 3: Backend — Unit Tests

> **Abhängigkeit:** Phase 2 complete

### Step 3.1: LeadScopeService Tests [PENDING]

**Neue Datei:** `backend/src/nest/common/services/lead-scope.service.test.ts`

**Szenarien:**

- [ ] User ist team_lead → directTeamIds korrekt
- [ ] User ist deputy_lead → directTeamIds enthält das Team
- [ ] User ist department_lead → directDepartmentIds korrekt + cascadedTeamIds
- [ ] User ist area_lead → directAreaIds korrekt + cascadedDepartmentIds + cascadedTeamIds
- [ ] User ist kein Lead → alle Arrays leer, isAnyLead = false
- [ ] User ist Lead auf mehreren Ebenen → korrekte Aggregation
- [ ] Nur is_active=1 Entities werden berücksichtigt
- [ ] Tenant-Isolation: Lead aus anderem Tenant → leer

### Step 3.2: PermissionGuard Lead-Logik Tests [PENDING]

**Geänderte Datei:** `backend/src/nest/common/guards/permission.guard.test.ts`

**Neue Szenarien:**

- [ ] Employee + Lead + kein ADR-020 Eintrag → GRANT (Lead-Default)
- [ ] Employee + Lead + ADR-020 canRead=true → GRANT
- [ ] Employee + Lead + ADR-020 canRead=false → DENY (Admin Override)
- [ ] Employee + kein Lead → DENY
- [ ] Root → GRANT (unverändert)
- [ ] Admin + hasFullAccess → GRANT (unverändert)
- [ ] Non-manage_hierarchy Permission → Standard fail-closed (unverändert)

### Step 3.3: Service Scope-Filterung Tests [PENDING]

**Geänderte Dateien:** Tests für Areas/Departments/Teams/Users Services

**Szenarien pro Service:**

- [ ] Root-User → alle Entities zurückgegeben
- [ ] Admin-User → alle Entities zurückgegeben (wo applicable)
- [ ] Employee-Lead → nur Scope-Entities zurückgegeben
- [ ] Employee-Lead mit leerem Scope → leeres Array

### Phase 3 — Definition of Done

- [ ] > = 25 Unit Tests für Lead-Access
- [ ] Alle Tests grün
- [ ] Tenant-Isolation verifiziert
- [ ] Kaskade-Logik verifiziert
- [ ] Deputy-Lead verifiziert
- [ ] ADR-020 Override verifiziert

---

## Phase 4: Frontend — Route Migration + Layout Data

> **Abhängigkeit:** Phase 1 complete (Endpoint verfügbar)

### Step 4.1: Route Groups migrieren [PENDING]

**Verschiebungen:**

| Von                           | Nach                           |
| ----------------------------- | ------------------------------ |
| `(admin)/manage-areas/`       | `(shared)/manage-areas/`       |
| `(admin)/manage-departments/` | `(shared)/manage-departments/` |
| `(root)/manage-teams/`        | `(shared)/manage-teams/`       |
| `(admin)/manage-employees/`   | `(shared)/manage-employees/`   |

**Kritisch:** Jede verschobene `+page.server.ts` behält ihren eigenen Access-Check:

```typescript
// +page.server.ts (nach Migration zu shared)
const { user } = await parent();

// Root/Admin: Zugriff wie bisher
if (user.role === 'root' || user.role === 'admin') {
  // Für manage-employees: admin OK
  // Für manage-areas/departments/teams: nur root (admin hatte vorher auch keinen Zugriff!)
}

// Employee: Lead-Check
if (user.role === 'employee') {
  const leadScope = parentData.leadScope;
  if (!leadScope.isTeamLead /* etc. */) {
    redirect(302, '/permission-denied');
  }
}
```

**Warum (shared)?** Route Groups mit Klammern beeinflussen NICHT die URL. `/manage-teams` bleibt `/manage-teams`. Nur der Layout-Guard ändert sich: (shared) prüft nur Authentifizierung, der spezifische Access-Check liegt in der +page.server.ts.

### Step 4.2: Layout Data erweitern [PENDING]

**Geänderte Datei:** `frontend/src/routes/(app)/+layout.server.ts`

**Neuer Fetch (parallel zu bestehenden):**

```typescript
const [counts, theme, addons, labels, leadScope] = await Promise.all([
  fetchDashboardCounts(token, fetch),
  fetchTheme(token, fetch),
  fetchActiveAddons(token, fetch),
  fetchHierarchyLabels(token, fetch),
  fetchLeadScope(token, fetch), // NEU: GET /users/me/lead-scope
]);

return {
  // ... bestehende Daten
  leadScope, // LeadScope Objekt
};
```

**Optimierung:** Für Root/Admin ist leadScope irrelevant — der Fetch ist trotzdem billig (leere Arrays, < 1ms Query). Kein conditional fetch nötig.

### Step 4.3: +page.server.ts Access Checks [PENDING]

Jede migrierte +page.server.ts bekommt einen expliziten Access-Check:

**manage-areas/+page.server.ts:**

- Root: ✓
- Admin: ✗ (war vorher auch nicht direkt erreichbar — nur über (admin) Guard)
- Employee: ✓ wenn `leadScope.isAreaLead`

**manage-departments/+page.server.ts:**

- Root: ✓
- Admin: ✗
- Employee: ✓ wenn `leadScope.isAreaLead || leadScope.isDepartmentLead`

**manage-teams/+page.server.ts:**

- Root: ✓
- Admin: ✗
- Employee: ✓ wenn `leadScope.isAnyLead` (jeder Lead sieht Teams in seinem Scope)

**manage-employees/+page.server.ts:**

- Root: ✓
- Admin: ✓
- Employee: ✓ wenn `leadScope.isAnyLead`

### Phase 4 — Definition of Done

- [ ] 4 Route-Ordner von (admin)/(root) nach (shared) verschoben
- [ ] URLs unverändert (/manage-teams bleibt /manage-teams)
- [ ] leadScope in Layout-Data verfügbar für alle Child-Pages
- [ ] Jede +page.server.ts hat expliziten Role + Lead Check
- [ ] Root-Zugriff auf alle 4 Seiten funktioniert (Regression)
- [ ] Admin-Zugriff auf manage-employees funktioniert (Regression)
- [ ] Employee ohne Lead → redirect zu /permission-denied
- [ ] Employee mit Lead → Seite lädt
- [ ] svelte-check 0 Errors

---

## Phase 5: Frontend — Navigation Config + Seiten-Anpassung

> **Abhängigkeit:** Phase 4 complete

### Step 5.1: navigation-config.ts erweitern [PENDING]

**Geänderte Datei:** `frontend/src/routes/(app)/_lib/navigation-config.ts`

**Neue Funktion:**

```typescript
export function filterMenuByLeadRoles(items: NavItem[], leadScope: LeadScope): NavItem[] {
  // Für Employees: filtert Manage-Items basierend auf Lead-Status
  // Für Root/Admin: no-op (gibt items unverändert zurück)
}
```

**Employee-Menü erweitern:**

```typescript
// Conditional Manage-Items für Employee-Leads
const EMPLOYEE_LEAD_ITEMS: NavItem[] = [
  { id: 'manage-areas', icon: ICONS.sitemap, label: labels.area, url: '/manage-areas' },
  { id: 'manage-departments', icon: ICONS.building, label: labels.department, url: '/manage-departments' },
  { id: 'manage-teams', icon: ICONS.team, label: labels.team, url: '/manage-teams' },
  { id: 'manage-employees', icon: ICONS.users, label: 'Mitarbeiter', url: '/manage-employees' },
];
```

Diese Items werden nur eingeblendet wenn der User Lead auf der entsprechenden Ebene ist.

**Hierarchy Labels:** Die Items nutzen `labels.area`, `labels.department`, `labels.team` — genau wie bei Root (ADR-034 konform).

### Step 5.2: +layout.svelte Filter-Pipeline erweitern [PENDING]

**Geänderte Datei:** `frontend/src/routes/(app)/+layout.svelte`

**Neue Filter-Stufe:**

```svelte
const menuItems = $derived<NavItem[]>(
  filterMenuByAddons(
    filterMenuByLeadRoles(          // NEU: Lead-basierte Filterung
      filterMenuByAccess(
        getMenuItemsForRole(currentRole, hierarchyLabels),
        hasFullAccess,
      ),
      data.leadScope,               // LeadScope aus Layout-Data
      currentRole,                  // Root/Admin bypassen den Filter
    ),
    activeAddonsSet,
  ),
);
```

### Step 5.3: Manage-Seiten Lead-View [PENDING]

**Geänderte Dateien:** Alle 4 migrierten +page.svelte

**Anpassungen für Employee-Leads:**

1. **Kein "Hinzufügen"-Button** (Create bleibt Root/Admin)
2. **Kein "Löschen"-Button** (Delete bleibt Root/Admin)
3. **Edit-Button sichtbar** (Lead darf bearbeiten)
4. **Daten bereits scope-gefiltert** (Backend liefert nur Lead-Scope)
5. **Conditional Rendering:**

```svelte
{#if data.user.role === 'root' || data.user.role === 'admin'}
  <FloatingActionButton onclick={openCreateModal} />
{/if}
```

### Phase 5 — Definition of Done

- [ ] `filterMenuByLeadRoles()` implementiert
- [ ] Employee-Lead sieht korrekte Manage-Items in Sidebar
- [ ] Employee ohne Lead sieht KEINE Manage-Items
- [ ] Root/Admin Sidebar unverändert
- [ ] Hierarchy Labels korrekt in Lead-Menüpunkten
- [ ] Manage-Seiten: Lead sieht Read+Edit, NICHT Create/Delete
- [ ] svelte-check 0 Errors
- [ ] ESLint 0 Errors
- [ ] Manueller Smoke Test: Corc (Team-Lead) sieht manage-teams mit nur Linie 9

---

## Phase 6: API Integration Tests

> **Abhängigkeit:** Phase 2 + 4 complete

### Step 6.1: Lead-Scope Endpoint Tests [PENDING]

**Neue Datei:** `backend/test/lead-scope.api.test.ts`

**Szenarien:**

- [ ] Unauthenticated → 401
- [ ] Employee ohne Lead → leerer Scope
- [ ] Employee Team-Lead → correcte teamIds
- [ ] Root → leerer Scope (Root braucht keinen Lead-Scope)

### Step 6.2: Manage-\* Endpoint Scope Tests [PENDING]

**Geänderte Dateien:** Bestehende API-Tests für areas, departments, teams, users

**Neue Szenarien pro Endpoint:**

- [ ] Employee ohne Lead → 403
- [ ] Employee Team-Lead → GET /teams liefert nur seine Teams
- [ ] Employee Team-Lead → PUT /teams/:id (eigenes Team) → 200
- [ ] Employee Team-Lead → PUT /teams/:id (fremdes Team) → 403
- [ ] Employee Team-Lead → DELETE /teams/:id → 403 (kein Delete für Leads)
- [ ] Employee Team-Lead → POST /teams → 403 (kein Create für Leads)
- [ ] Root → GET /teams liefert ALLE Teams (Regression)

### Phase 6 — Definition of Done

- [ ] > = 20 API Integration Tests für Lead-Access
- [ ] Alle Tests grün
- [ ] Scope-Filterung verifiziert
- [ ] Create/Delete-Blocking für Leads verifiziert
- [ ] Root/Admin Regression bestanden

---

## Phase 7: ADR + Documentation + Polish

> **Abhängigkeit:** Phase 6 complete

### Step 7.1: ADR-035 erstellen [PENDING]

**Neue Datei:** `docs/infrastructure/adr/ADR-035-lead-based-access-control.md`

**Inhalte:**

- Context: Warum Lead-basierter Zugriff
- Decision: Kaskade, Deputy, ADR-020 Override
- Alternatives: Separate Lead-Rolle, RBAC Extension, etc.
- Consequences: Positive + Negative

### Step 7.2: FEATURES.md aktualisieren [PENDING]

### Step 7.3: Smoke Test Checkliste [PENDING]

| Test                                                                | Ergebnis |
| ------------------------------------------------------------------- | -------- |
| Root sieht alle Manage-Seiten (Regression)                          |          |
| Admin sieht manage-employees (Regression)                           |          |
| Employee Corc (Team-Lead Linie 9) sieht manage-teams                |          |
| Corc sieht NUR Linie 9 auf manage-teams                             |          |
| Corc sieht manage-employees (Mitglieder von Linie 9)                |          |
| Corc sieht NICHT manage-areas, manage-departments                   |          |
| Corc sieht NICHT manage-admins, manage-halls                        |          |
| Corc kann Linie 9 editieren                                         |          |
| Corc kann Linie 9 NICHT löschen                                     |          |
| Corc kann KEIN neues Team anlegen                                   |          |
| Admin entzieht Corc Permission → Corc sieht nichts mehr             |          |
| Jürgen (Area-Lead) sieht manage-areas + manage-depts + manage-teams |          |
| Employee ohne Lead sieht keine Manage-Seiten                        |          |

### Phase 7 — Definition of Done

- [ ] ADR-035 geschrieben
- [ ] FEATURES.md aktualisiert
- [ ] Smoke Tests alle bestanden
- [ ] Keine offenen TODOs im Code

---

## Session Tracking

| Session | Phase | Beschreibung                                  | Status | Datum |
| ------- | ----- | --------------------------------------------- | ------ | ----- |
| 1       | 1     | LeadScopeService + Types + Endpoint           |        |       |
| 2       | 1     | KVP Refactoring + LeadScopeService Tests      |        |       |
| 3       | 2     | Permission Registry + Guard Extension         |        |       |
| 4       | 2     | Controller @Roles + Service Scope Filtering   |        |       |
| 5       | 3     | Unit Tests (LeadScope, Guard, Services)       |        |       |
| 6       | 4     | Route Migration + Layout Data + Access Checks |        |       |
| 7       | 5     | Navigation Config + Filter Pipeline           |        |       |
| 8       | 5+6   | Manage-Seiten Lead-View + API Tests           |        |       |
| 9       | 7     | ADR-035 + Docs + Smoke Tests + Polish         |        |       |

---

## Quick Reference: File Paths

### Backend (neu)

| Datei                                                                          | Zweck                |
| ------------------------------------------------------------------------------ | -------------------- |
| `backend/src/nest/common/services/lead-scope.service.ts`                       | Lead-Scope Auflösung |
| `backend/src/nest/common/types/lead-scope.types.ts`                            | LeadScope Interface  |
| `backend/src/nest/common/permissions/manage-hierarchy.permissions.ts`          | Permission-Kategorie |
| `backend/src/nest/common/permissions/manage-hierarchy-permission.registrar.ts` | Registrar            |

### Backend (geändert)

| Datei                                                    | Änderung                              |
| -------------------------------------------------------- | ------------------------------------- |
| `backend/src/nest/common/guards/permission.guard.ts`     | Lead-Default-Grant Logik              |
| `backend/src/nest/areas/areas.controller.ts`             | @Roles + @RequirePermission angepasst |
| `backend/src/nest/departments/departments.controller.ts` | @Roles + @RequirePermission angepasst |
| `backend/src/nest/teams/teams.controller.ts`             | @Roles + @RequirePermission angepasst |
| `backend/src/nest/users/users.controller.ts`             | Neuer Endpoint + @Roles angepasst     |
| `backend/src/nest/areas/areas.service.ts`                | Scope-Filterung + validateLeader()    |
| `backend/src/nest/departments/departments.service.ts`    | Scope-Filterung + validateLeader()    |
| `backend/src/nest/teams/teams.service.ts`                | Scope-Filterung                       |
| `backend/src/nest/users/users.service.ts`                | Scope-Filterung für Employee-Leads    |
| `backend/src/nest/kvp/kvp.service.ts`                    | Refactored → nutzt LeadScopeService   |

### Frontend (geändert)

| Pfad                                                     | Änderung                             |
| -------------------------------------------------------- | ------------------------------------ |
| `frontend/src/routes/(app)/+layout.server.ts`            | fetchLeadScope() hinzugefügt         |
| `frontend/src/routes/(app)/+layout.svelte`               | filterMenuByLeadRoles() in Pipeline  |
| `frontend/src/routes/(app)/_lib/navigation-config.ts`    | Lead-Items + filterMenuByLeadRoles() |
| `frontend/src/routes/(app)/(shared)/manage-areas/`       | Von (admin) migriert                 |
| `frontend/src/routes/(app)/(shared)/manage-departments/` | Von (admin) migriert                 |
| `frontend/src/routes/(app)/(shared)/manage-teams/`       | Von (root) migriert                  |
| `frontend/src/routes/(app)/(shared)/manage-employees/`   | Von (admin) migriert                 |

---

## Known Limitations (V1 — Bewusst ausgeschlossen)

1. **Kein Live-Update**: Wenn ein User als Lead zugewiesen wird, sieht er die Manage-Seiten erst nach erneutem Login/Navigation (kein SSE-Push für Lead-Status)
2. **Keine Lead-Templates**: Admins können keine "Standard-Lead-Permissions" als Template anlegen (ADR-020 Phase 2)
3. **Kein hierarchisches Permission-Erbe**: Area-Lead Permissions erben sich NICHT automatisch auf Dept/Team-Ebene in ADR-020 — jede Ebene hat eigene Permission-Einträge
4. **Leads können keine Entities erstellen/löschen**: Nur Read + Edit — Create/Delete bleibt Root/Admin
5. **Employee-Scope basiert auf Team-Membership**: Ein Lead sieht Mitarbeiter die in seinen Scope-Teams sind (über `team_members` Junction). Mitarbeiter ohne Team-Zuweisung sind für Leads unsichtbar
6. **Hall hat keinen Lead**: Designentscheidung — Hall ist ein physischer Ort, kein organisatorisches Element

---

## Spec Deviations

| #   | Plan sagt    | Tatsächlicher Code | Entscheidung |
| --- | ------------ | ------------------ | ------------ |
| -   | (noch keine) | -                  | -            |

---

**Dieses Dokument ist der Execution Plan. Jede Session startet hier,
nimmt das nächste unchecked Item, und markiert es als done.**
