# FEAT: Organizational Scope Access Control — Unified Masterplan

> **Created:** 2026-03-13
> **Version:** 0.4.0 (Draft — Verifizierter Review)
> **Status:** DRAFT — Phase 0 (Planung)
> **Branch:** `feat/org-scope-access`
> **ADR:** ADR-036 (zu erstellen in Phase 8)
> **Author:** SCS-Technik Team
> **Estimated Sessions:** 9
> **Actual Sessions:** 0 / 9
> **Supersedes:** `FEAT_LEAD_ACCESS_MASTERPLAN.md` + `FEAT_USER_SCOPE_FILTERING_MASTERPLAN.md`

---

## Changelog

| Version | Datum      | Änderung                                                                                                                                                                            |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-03-13 | Initial Draft — Zusammenführung beider Einzelpläne                                                                                                                                  |
| 0.2.0   | 2026-03-13 | Decisions finalisiert: D1=NEIN, D2=A (extend HierarchyPermissionService), D3=A (CLS)                                                                                                |
| 0.3.0   | 2026-03-13 | Review-Fixes: CTE-Syntax (Subquery statt FULL OUTER JOIN), Migration für manage_hierarchy ergänzt                                                                                   |
| 0.4.0   | 2026-03-13 | Verifizierter Review: ScopeGuard→ScopeGuard (Timing-Bug), users.department_id entfernt (existiert nicht), isEntityInScope Signatur gefixt, HierarchyPermissionModule Import ergänzt |

---

## Warum ein unified Plan?

Die beiden Einzelpläne (Lead-Access + User-Scope-Filtering) lösen **zwei Hälften desselben Problems**: "Wer sieht was auf den Manage-Seiten?" Beide berühren dieselben Services, Routen und Navigation. Getrennte Implementierung führt zu:

1. **Doppelte CTE-Logik** — Zwei parallele Scope-Auflösungen die divergieren können
2. **Doppelte Filter-Pfade** — Jede List-Methode bräuchte separate if/else für Admin vs Employee-Lead
3. **Route-Konflikte** — manage-employees soll laut Plan 1 nach (shared), laut Plan 2 in (admin) bleiben
4. **ADR-Kollision** — Beide planten "ADR-035", das bereits existiert

**Dieser Plan eliminiert all das durch eine einzige Scope-Resolution, einen Filter-Pfad und eine konsistente Route-Strategie.**

---

## Konzept

### Das Problem (zwei Lücken)

| #   | Lücke                                         | Betrifft                    | Aktuell                          | Soll                                    |
| --- | --------------------------------------------- | --------------------------- | -------------------------------- | --------------------------------------- |
| 1   | Employee-Leads sehen Manage-Seiten nicht      | Employees mit lead_id       | Kein Zugang zu manage-\*         | Zugang, scope-gefiltert, Read+Edit only |
| 2   | Admins sehen ALLE User, nicht nur ihren Scope | Admins ohne has_full_access | Kein Scope-Filter in listUsers() | Nur User in eigenem Scope               |

### Die Lösung: HierarchyPermissionService erweitern

**Ein bestehender Service, neue Methode `getScope()`, ein CTE, ein Filter-Pfad** — für ALLE Rollen.
Kein neuer Service — die bestehenden Methoden (`getAccessibleAreaIds()` etc.) werden durch `getScope()` ersetzt, das Lead-Positionen inkludiert.

```
┌──────────────────────────────────────────────────────────────────────┐
│                HierarchyPermissionService.getScope()                 │
│                                                                      │
│  Root / has_full_access:                                             │
│    → type: 'full' (kein Filter)                                     │
│                                                                      │
│  Admin (scoped):                                                     │
│    → type: 'limited'                                                 │
│    → areaIds:  [admin_area_permissions + area_lead_id]              │
│    → deptIds:  [admin_dept_permissions + dept_lead_id + inherited]  │
│    → teamIds:  [team_lead_id + deputy_lead_id + inherited]          │
│                                                                      │
│  Employee Team-Lead:                                                 │
│    → type: 'limited'                                                 │
│    → areaIds:  [] (Employees können NICHT Area-Lead sein)           │
│    → deptIds:  [] (Employees können NICHT Dept-Lead sein)           │
│    → teamIds:  [team_lead_id + deputy_lead_id]                      │
│                                                                      │
│  Employee (kein Lead) / Dummy:                                       │
│    → type: 'none'                                                    │
│                                                                      │
│  Scope wird EINMAL pro Request aufgelöst (ScopeGuard → CLS).       │
│  Services lesen aus CLS — keine redundanten Queries.                │
└──────────────────────────────────────────────────────────────────────┘
```

**Jeder Service nutzt denselben Filter-Pfad:**

```typescript
const scope = this.cls.get<OrganizationalScope>('orgScope'); // aus CLS, bereits aufgelöst
if (scope.type === 'full') return allEntities;
if (scope.type === 'none' || scope.teamIds.length === 0) return [];
return filterByIds(scope.teamIds); // Works for Admin AND Employee-Lead
```

### Regeln

1. **Root / has_full_access**: Sieht alles, kein Filter (unverändert)
2. **Scoped Admin**: Sieht Entities in seinem Permission-Scope + Lead-Scope
3. **Employee-Lead**: Sieht Entities in seinem Lead-Scope (Read+Edit, KEIN Create/Delete)
4. **Kaskade**: Area-Scope vererbt sich auf Departments + Teams darunter
5. **Deputy = Lead**: `deputy_lead_id` hat identische Rechte wie `team_lead_id`
6. **ADR-020 Override**: Admin kann einem Lead den Zugriff via Permission-Seite entziehen
7. **Kein Hall-Lead**: Hall = physischer Ort, kein Lead-Konzept
8. **manage-admins = Root-only**: Nur Root verwaltet Admins

### Seiten-Matrix

| Manage-Seite       | Root | Admin (full) | Admin (scoped) | Employee Team-Lead | Employee |
| ------------------ | ---- | ------------ | -------------- | ------------------ | -------- |
| manage-areas       | alle | alle         | sein Scope     | ---                | ---      |
| manage-departments | alle | alle         | sein Scope     | ---                | ---      |
| manage-teams       | alle | alle         | sein Scope     | sein Team(s)       | ---      |
| manage-employees   | alle | alle         | sein Scope     | seine Team-Members | ---      |
| manage-admins      | alle | ---          | ---            | ---                | ---      |
| manage-halls       | alle | alle         | alle           | ---                | ---      |

> **D1 = NEIN:** Employees können NICHT Area/Department-Lead sein (validateLeader() bleibt admin/root only, ADR-035 konform). Employee-Leads sind ausschließlich team_lead_id oder deputy_lead_id.

### CRUD-Matrix für Employee-Leads

| Operation                    | Erlaubt? | Begründung           |
| ---------------------------- | -------- | -------------------- |
| **Read** (Liste sehen)       | Ja       | Lead-Scope-gefiltert |
| **Read** (Detail sehen)      | Ja       | Nur in eigenem Scope |
| **Edit** (bestehende Entity) | Ja       | Nur in eigenem Scope |
| **Create** (neue Entity)     | Nein     | Bleibt Root/Admin    |
| **Delete** (Entity löschen)  | Nein     | Bleibt Root/Admin    |

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (alle Container healthy)
- [ ] DB Backup erstellt
- [ ] Branch `feat/org-scope-access` checked out
- [ ] Keine pending Migrations
- [ ] Bestehende Tests grün: `pnpm run test:api` + `pnpm run test:unit`
- [ ] ADR-034 (Hierarchy Labels) vollständig propagiert
- [ ] ADR-020 (Per-User Permissions) stabil
- [ ] `HierarchyPermissionService` funktioniert korrekt

### 0.2 Risk Register

| #   | Risiko                                                   | Impact  | Wahrscheinlichkeit | Mitigation                                                      | Verifikation                                    |
| --- | -------------------------------------------------------- | ------- | ------------------ | --------------------------------------------------------------- | ----------------------------------------------- |
| R1  | Route Group Migration bricht Root/Admin-Zugriffe         | Hoch    | Mittel             | +page.server.ts behält explizite Role-Checks                    | E2E: Root/Admin auf alle Manage-Seiten          |
| R2  | Scope-CTE-Query ist langsam                              | Mittel  | Niedrig            | Single CTE, alle Pfade in einer Query                           | EXPLAIN ANALYZE < 10ms bei 500 Usern            |
| R3  | ADR-020 Default-Deny vs Lead-Default-Grant Konflikt      | Hoch    | Mittel             | Kein ADR-020 Eintrag + ist Lead = GRANT                         | Unit Test: Lead ohne Permission-Row hat Zugriff |
| R4  | Scope-Filter bricht Root/has_full_access                 | Hoch    | Niedrig            | Early return `type: 'full'` vor jedem Filter                    | API-Test: Root sieht ALLES                      |
| R5  | Employee sieht Manage-Seite aber Backend blockt Mutation | Mittel  | Hoch               | Frontend conditional: Lead sieht Read+Edit, NICHT Create/Delete | Smoke Test                                      |
| R6  | Dropdown-Scoping bricht andere Module                    | Hoch    | Mittel             | Scope nur wenn NOT root/has_full_access                         | Test: Root sieht alle Areas in Dropdowns        |
| R7  | Admin ohne Scope sieht leere Tabelle                     | Niedrig | Mittel             | ScopeInfoBanner erklärt Situation                               | Manueller Test                                  |

### 0.3 Decisions (FINALISIERT)

| #   | Frage                                        | Entscheidung                                | Begründung                                                                                                                               |
| --- | -------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Dürfen Employees Area/Department-Leads sein? | **NEIN**                                    | ADR-035 bleibt: area/dept leads = admin/root only. Employee-Leads nur team_lead/deputy_lead                                              |
| D2  | Wo lebt die Scope-Logik?                     | **A: HierarchyPermissionService erweitern** | Ein Service für alle Hierarchy-Permissions. Keine bestehenden Consumer, alles dev. Bestehende Methoden werden durch `getScope()` ersetzt |
| D3  | Scope-Auflösung wann?                        | **A: Einmal pro Request → CLS**             | ScopeGuard löst Scope auf, speichert in CLS. Services lesen nur. Eine Query pro Request statt N                                          |

### 0.4 Ecosystem Integration Points

| Bestehendes System          | Art der Integration                                                                                          | Phase |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | ----- |
| HierarchyPermissionService  | Erweitern: neue Methode `getScope()` + Unified CTE                                                           | 1     |
| ScopeGuard (NEU)            | Scope einmal pro Request auflösen → CLS speichern (APP_GUARD, zwischen TenantAddonGuard und PermissionGuard) | 1     |
| PermissionGuard             | Erweitern um Lead-Check (manage_hierarchy)                                                                   | 3     |
| Permission Registry         | Neue Kategorie `manage_hierarchy` registrieren                                                               | 3     |
| DB Migration                | `addons`-Eintrag + `user_addon_permissions` für bestehende Admins                                            | 3     |
| Navigation Config           | `filterMenuByScope()` + Scope-basierte Items                                                                 | 6     |
| (app)/+layout.server.ts     | `fetchOrgScope()` parallel laden                                                                             | 5     |
| KVP EXTENDED_ORG_INFO_QUERY | Refactoring → nutzt `HierarchyPermissionService.getScope()`                                                  | 1     |
| Route Groups (admin)/(root) | manage-\* Seiten nach (shared) migrieren                                                                     | 5     |

---

## Ist-Zustand (verifiziert)

### Route Groups

| Seite              | Aktuell | Ziel     |
| ------------------ | ------- | -------- |
| manage-areas       | (admin) | (shared) |
| manage-departments | (admin) | (shared) |
| manage-teams       | (root)  | (shared) |
| manage-employees   | (admin) | (shared) |
| manage-admins      | (admin) | (root)   |
| manage-halls       | (admin) | bleibt   |

### Backend Services (kein Scope-Filter)

- `AreasService.listAreas()`: Filter nur `tenant_id` + `is_active`
- `DepartmentsService.listDepartments()`: Filter nur `tenant_id`
- `TeamsService.listTeams()`: Filter nur `tenant_id` + `is_active`
- `UsersService.listUsers()`: Filter nur `tenant_id` (+ role/status aus Query)
- `HierarchyPermissionService.getAccessibleAreaIds()`: Nur `admin_area_permissions`, **ignoriert Lead-Positionen**

### Lead-ID Spalten (DB) + Validation

| Tabelle     | Spalte             | validateLeader() erlaubt |
| ----------- | ------------------ | ------------------------ |
| teams       | team_lead_id       | position='Teamleiter'    |
| teams       | deputy_lead_id     | position='Teamleiter'    |
| departments | department_lead_id | admin/root only          |
| areas       | area_lead_id       | admin/root only          |
| halls       | ---                | Kein Lead-Feld           |

### KVP Lead-Logik

`EXTENDED_ORG_INFO_QUERY` in `kvp.constants.ts` löst teamLeadOf[], departmentLeadOf[], areaLeadOf[] auf. Wird durch `HierarchyPermissionService.getScope()` ersetzt.

---

## Phase 1: Backend — HierarchyPermissionService erweitern

> **Abhängigkeit:** Keine
> **Ziel:** Bestehenden Service um `getScope()` + Unified CTE erweitern, ScopeGuard für CLS

### Step 1.1: Types definieren [PENDING]

**Neue Datei:** `backend/src/nest/hierarchy-permission/organizational-scope.types.ts`

```typescript
interface OrganizationalScope {
  /** 'full' = Root/has_full_access, 'limited' = scoped, 'none' = kein Zugang */
  type: 'full' | 'limited' | 'none';

  /** IDs der zugänglichen Entities (leer bei 'full' und 'none') */
  areaIds: number[];
  departmentIds: number[];
  teamIds: number[];

  /** Lead-Booleans für Sidebar-Logik und Frontend-Entscheidungen */
  isAreaLead: boolean;
  isDepartmentLead: boolean;
  isTeamLead: boolean;
  isAnyLead: boolean;

  /** Scope-Info für ScopeInfoBanner (optional, nur bei 'limited') */
  areaNames?: string[];
  departmentNames?: string[];
}
```

### Step 1.2: HierarchyPermissionService erweitern [PENDING]

**Geänderte Datei:** `backend/src/nest/hierarchy-permission/hierarchy-permission.service.ts`

Neue Methoden `getScope()`, `getVisibleUserIds()`, `isEntityInScope()` hinzufügen. Bestehende `getAccessibleAreaIds()`, `getAccessibleDepartmentIds()`, `getAccessibleTeamIds()` werden durch `getScope()` ersetzt (gleiche Daten, aber inkl. Lead-Positionen).

**Unified CTE-Query (alle Zugriffspfade in einer Query):**

```sql
WITH
-- Pfad 1: Admin area permissions (direkt)
perm_areas AS (
  SELECT area_id AS id FROM admin_area_permissions
  WHERE admin_user_id = $1 AND tenant_id = $2
),
-- Pfad 2: Area-Lead Position
lead_areas AS (
  SELECT id FROM areas
  WHERE area_lead_id = $1 AND tenant_id = $2 AND is_active = 1
),
-- Alle zugänglichen Areas
all_areas AS (
  SELECT id FROM perm_areas UNION SELECT id FROM lead_areas
),
-- Pfad 3: Admin department permissions (direkt)
perm_depts AS (
  SELECT department_id AS id FROM admin_department_permissions
  WHERE admin_user_id = $1 AND tenant_id = $2
),
-- Pfad 4: Department-Lead Position
lead_depts AS (
  SELECT id FROM departments
  WHERE department_lead_id = $1 AND tenant_id = $2 AND is_active = 1
),
-- Departments vererbt von Areas
inherited_depts AS (
  SELECT d.id FROM departments d
  INNER JOIN all_areas aa ON d.area_id = aa.id
  WHERE d.is_active = 1 AND d.tenant_id = $2
),
-- Alle zugänglichen Departments
all_depts AS (
  SELECT id FROM perm_depts
  UNION SELECT id FROM lead_depts
  UNION SELECT id FROM inherited_depts
),
-- Pfad 5: Team-Lead / Deputy-Lead Position
lead_teams AS (
  SELECT id FROM teams
  WHERE (team_lead_id = $1 OR deputy_lead_id = $1)
    AND tenant_id = $2 AND is_active = 1
),
-- Teams vererbt von Departments
inherited_teams AS (
  SELECT t.id FROM teams t
  INNER JOIN all_depts ad ON t.department_id = ad.id
  WHERE t.is_active = 1 AND t.tenant_id = $2
),
-- Alle zugänglichen Teams
all_teams AS (
  SELECT id FROM lead_teams UNION SELECT id FROM inherited_teams
)
SELECT
  (SELECT COALESCE(array_agg(DISTINCT id), '{}') FROM all_areas) AS area_ids,
  (SELECT COALESCE(array_agg(DISTINCT id), '{}') FROM all_depts) AS department_ids,
  (SELECT COALESCE(array_agg(DISTINCT id), '{}') FROM all_teams) AS team_ids,
  EXISTS(SELECT 1 FROM lead_areas) AS is_area_lead,
  EXISTS(SELECT 1 FROM lead_depts) AS is_department_lead,
  EXISTS(SELECT 1 FROM lead_teams) AS is_team_lead;
```

**Methoden:**

```typescript
async getScope(userId: number, tenantId: number): Promise<OrganizationalScope>
async getVisibleUserIds(scope: OrganizationalScope, tenantId: number): Promise<number[] | 'all'>
static isEntityInScope(scope: OrganizationalScope, entityType: 'area' | 'department' | 'team', entityId: number): boolean
```

**getVisibleUserIds SQL:**

```sql
SELECT DISTINCT u.id FROM users u
WHERE u.tenant_id = $1 AND u.is_active != 4 AND (
  -- Department-Membership N:M (user_departments Junction-Table)
  EXISTS (SELECT 1 FROM user_departments ud
          WHERE ud.user_id = u.id AND ud.department_id = ANY($2::int[]))
  -- Team-Membership N:M (user_teams Junction-Table)
  OR EXISTS (SELECT 1 FROM user_teams ut
             WHERE ut.user_id = u.id AND ut.team_id = ANY($3::int[]))
)
```

> **Hinweis (v0.4.0):** `users.department_id` existiert NICHT in der DB. User-zu-Department-Zuweisung läuft ausschließlich über `user_departments` Junction-Table.

### Step 1.3: KVP Refactoring [PENDING]

**Geänderte Datei:** `backend/src/nest/kvp/kvp.service.ts`

- `EXTENDED_ORG_INFO_QUERY` durch `HierarchyPermissionService.getScope()` ersetzen
- KVP-Module importiert `HierarchyPermissionService` (bereits via CommonModule verfügbar)
- Bestehende KVP-Tests müssen weiterhin grün sein

### Step 1.4: ScopeGuard — Scope einmal pro Request in CLS [PENDING]

**Neue Datei:** `backend/src/nest/common/guards/scope.guard.ts`

> **Warum Guard statt Interceptor? (v0.4.0 Fix)**
> NestJS Execution Order: Middleware → **Guards** → Interceptors → Pipes → Handler.
> `PermissionGuard` (Step 3.2) braucht `orgScope` aus CLS um Lead-Default-Grant zu prüfen.
> Als Interceptor würde die Scope-Resolution NACH dem PermissionGuard laufen → CLS leer → Bug.
> Deshalb: **Guard**, registriert zwischen `TenantAddonGuard` und `PermissionGuard`.

```typescript
@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(
    private readonly hierarchyPermission: HierarchyPermissionService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: NestAuthUser }>();
    const user = request.user;

    if (user) {
      const tenantId = this.cls.get<number>('tenantId');
      const scope = await this.hierarchyPermission.getScope(user.id, tenantId);
      this.cls.set('orgScope', scope);
    }

    return true; // Guard lässt immer durch — Scope ist informational, kein Gate
  }
}
```

**Registrierung:** Global in AppModule als `APP_GUARD`, **nach TenantAddonGuard, VOR PermissionGuard:**

```typescript
// Guard-Reihenfolge in app.module.ts providers:
{ provide: APP_GUARD, useClass: JwtAuthGuard },        // 1. Auth
{ provide: APP_GUARD, useClass: RolesGuard },           // 2. Role Check
{ provide: APP_GUARD, useClass: TenantAddonGuard },     // 3. Addon Check
{ provide: APP_GUARD, useClass: ScopeGuard },           // 4. NEU: Scope → CLS
{ provide: APP_GUARD, useClass: PermissionGuard },      // 5. Permission Check (liest orgScope aus CLS)
```

> **Hinweis:** `HierarchyPermissionModule` muss in `AppModule.imports` aufgenommen werden, da ScopeGuard global registriert wird und `HierarchyPermissionService` braucht (Modul ist NICHT @Global()).

**Services lesen aus CLS:**

```typescript
const scope = this.cls.get<OrganizationalScope>('orgScope');
```

### Step 1.5: Neuer Endpoint — GET /users/me/org-scope [PENDING]

**Geänderte Datei:** `backend/src/nest/users/users.controller.ts`

| Method | Route                 | Guard        | Beschreibung                           |
| ------ | --------------------- | ------------ | -------------------------------------- |
| GET    | `/users/me/org-scope` | JwtAuthGuard | Organisationsscope des aktuellen Users |

Kein @Roles — jeder authentifizierte User kann seinen Scope abfragen. Liest aus CLS (bereits aufgelöst durch ScopeGuard).

### Phase 1 — Definition of Done

- [ ] `OrganizationalScope` Types definiert
- [ ] `HierarchyPermissionService.getScope()` mit Unified-CTE implementiert
- [ ] Bestehende `getAccessible*Ids()` durch `getScope()` ersetzt
- [ ] `getScope()` liefert korrekten Scope für Root, Admin (full/scoped), Employee-Lead, Employee
- [ ] `getVisibleUserIds()` liefert korrekte User-IDs basierend auf Scope
- [ ] ScopeGuard als APP_GUARD registriert (nach TenantAddonGuard, VOR PermissionGuard)
- [ ] ScopeGuard speichert Scope in CLS (einmal pro Request)
- [ ] HierarchyPermissionModule in AppModule.imports aufgenommen
- [ ] Endpoint `GET /users/me/org-scope` funktioniert
- [ ] KVP refactored: nutzt `HierarchyPermissionService.getScope()`
- [ ] EXPLAIN ANALYZE der CTE-Query < 10ms
- [ ] ESLint 0 Errors, Type-Check passed
- [ ] Bestehende KVP-Tests grün

---

## Phase 2: Backend — Service-Level Scope Filtering

> **Abhängigkeit:** Phase 1 complete
> **Ziel:** Alle List/Detail/Mutation-Endpoints respektieren den Scope

### Step 2.1: Scope-Filter in List-Methods [PENDING]

**Geänderte Dateien + Pattern:**

```typescript
// Einheitliches Pattern für ALLE 4 Services:
async listTeams(tenantId: number, filters: TeamFilters): Promise<TeamResponse[]> {
  const scope = this.cls.get<OrganizationalScope>('orgScope'); // Bereits in CLS (ScopeGuard)

  if (scope.type === 'full') {
    return this.getAllTeams(tenantId, filters);
  }
  if (scope.type === 'none' || scope.teamIds.length === 0) {
    return [];
  }
  // 'limited': Filter nach Scope-IDs — gleich für Admin UND Employee-Lead
  return this.getTeamsByScope(tenantId, filters, scope.teamIds);
}
```

**Betroffene Methoden:**

| Service                  | Methode             | Filter-Feld                   |
| ------------------------ | ------------------- | ----------------------------- |
| `areas.service.ts`       | `listAreas()`       | `scope.areaIds`               |
| `departments.service.ts` | `listDepartments()` | `scope.departmentIds`         |
| `teams.service.ts`       | `listTeams()`       | `scope.teamIds`               |
| `users.service.ts`       | `listUsers()`       | `scope → getVisibleUserIds()` |

### Step 2.2: User-List Zusatz-Regeln [PENDING]

**Datei:** `backend/src/nest/users/users.service.ts`

1. Scope-Filter in `listUsers()` via `getVisibleUserIds()`
2. `role=admin` oder `role=root` Listing: Nur für Root-User erlaubt

```typescript
if ((query.role === 'admin' || query.role === 'root') && user.role !== 'root') {
  throw new ForbiddenException('Only root users can list admins/root users');
}
```

3. Leerer Scope → leere Liste (kein Error)

### Step 2.3: Mutation Scope-Checks [PENDING]

**Datei:** `backend/src/nest/users/users.service.ts`

```typescript
private ensureEntityInScope(
  targetEntityId: number,
  entityType: 'user' | 'area' | 'department' | 'team',
): void {
  const scope = this.cls.get<OrganizationalScope>('orgScope');
  if (scope.type === 'full') return;

  const inScope = HierarchyPermissionService.isEntityInScope(scope, entityType, targetEntityId);
  if (!inScope) {
    throw new ForbiddenException('Entity is not in your organizational scope');
  }
}
```

**Betroffene Methoden:**

| Methode               | Prüfung                              |
| --------------------- | ------------------------------------ |
| `updateUser()`        | ensureEntityInScope vor Update       |
| `deleteUser()`        | ensureEntityInScope vor Delete       |
| `getUserByUuid()`     | ensureEntityInScope vor Return       |
| User-Permissions Page | ensureEntityInScope vor Daten-Return |

### Step 2.4: Scope-Info als Response-Metadata [PENDING]

**Datei:** `backend/src/nest/users/users.service.ts`

Bei scoped Responses: Scope-Info zurückgeben für das Frontend-Banner.

```typescript
interface ScopedPaginatedResult<T> extends PaginatedResult<T> {
  scope?: {
    type: 'full' | 'limited';
    areaNames?: string[];
    departmentNames?: string[];
  };
}
```

### Phase 2 — Definition of Done

- [ ] Alle 4 List-Methods scope-gefiltert (Areas, Departments, Teams, Users)
- [ ] Root / has_full_access sieht ALLES (Regression)
- [ ] Scoped Admin sieht nur seinen Scope
- [ ] Employee-Lead sieht nur seinen Lead-Scope
- [ ] Employee ohne Lead sieht leere Liste
- [ ] Mutations (update/delete) prüfen Scope
- [ ] `role=admin/root` Listing nur für Root
- [ ] Scope-Info in User-List-Response
- [ ] ESLint 0 Errors, Type-Check passed

---

## Phase 3: Backend — Permission Guard + Controller Changes

> **Abhängigkeit:** Phase 1 complete
> **Ziel:** PermissionGuard versteht Lead-Zugriffe, Controller erlauben Employee-Rolle

### Step 3.1: manage_hierarchy Permission-Kategorie [PENDING]

**Neue Dateien:**

- `backend/src/nest/common/permissions/manage-hierarchy.permissions.ts`
- `backend/src/nest/common/permissions/manage-hierarchy-permission.registrar.ts`

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

**Kein canDelete**: Leads dürfen nicht löschen. Create bleibt Root/Admin.

### Step 3.1b: DB Migration — manage_hierarchy Addon + Admin-Permissions [PENDING]

**Neue Datei:** `database/migrations/XXXXXX_manage-hierarchy-permissions.ts`

**Warum:** Ohne diese Migration verlieren scoped Admins (has_full_access=false) den Zugang zu manage-\*, sobald `@RequirePermission('manage_hierarchy', ...)` auf den Controllern sitzt. Fail-closed = kein Row → DENY → Breaking Regression.

**Migration up:**

```sql
-- 1. Addon registrieren (core, immer aktiv)
INSERT INTO addons (code, name, description, is_core, is_active, icon, sort_order)
VALUES ('manage_hierarchy', 'Organisationsstruktur', 'Verwaltung von Bereichen, Abteilungen, Teams und Mitarbeitern', true, 1, 'fa-sitemap', 50)
ON CONFLICT (code) DO NOTHING;

-- 2. Bestehende Admins: manage_hierarchy Permissions seeden
-- Pattern aus 20260309200080_permission-new-categories.ts
INSERT INTO user_addon_permissions (tenant_id, user_id, addon_code, module_code, can_read, can_write, can_delete, assigned_by)
SELECT u.tenant_id, u.id, 'manage_hierarchy', module.code, true, true, false, u.id
FROM users u
CROSS JOIN (VALUES
  ('manage-areas'),
  ('manage-departments'),
  ('manage-teams'),
  ('manage-employees')
) AS module(code)
WHERE u.role = 'admin' AND u.is_active = 1 AND u.tenant_id IS NOT NULL
ON CONFLICT (tenant_id, user_id, addon_code, module_code) DO NOTHING;
```

**Migration down:**

```sql
DELETE FROM user_addon_permissions WHERE addon_code = 'manage_hierarchy';
DELETE FROM addons WHERE code = 'manage_hierarchy';
```

**Wichtig:**

- `can_delete = false` — DELETE-Endpoints behalten `@Roles('admin', 'root')` ohne `@RequirePermission`, brauchen keinen Permission-Eintrag
- Root/has_full_access bypassen den PermissionGuard sowieso (Step 2 im Guard)
- Leads brauchen keine Rows (Lead-Default-Grant, Step 3.2 neue Logik)
- `ON CONFLICT DO NOTHING` = idempotent, sicher bei Re-Run

### Step 3.2: PermissionGuard erweitern [PENDING]

**Geänderte Datei:** `backend/src/nest/common/guards/permission.guard.ts`

**Neue Logik (Ergänzung nach hasFullAccess-Check):**

```
Aktuelle Logik:
  1. Kein @RequirePermission → pass
  2. hasFullAccess → pass
  3. DB-Lookup → grant/deny (fail-closed)

Neue Logik:
  1. Kein @RequirePermission → pass
  2. hasFullAccess → pass
  3. NEU: Ist manage_hierarchy Kategorie UND User ist Lead?
     → Check ADR-020 für expliziten DENY (invertierte Logik!)
       → Kein Eintrag = GRANT (Lead-Default)
       → Eintrag mit canRead=false = DENY (Admin Override)
  4. Standard DB-Lookup → grant/deny (fail-closed)
```

**Kritisch:** Invertierte Default-Logik gilt NUR für `manage_hierarchy` + Lead. Alles andere bleibt fail-closed.

### Step 3.3: Controller @Roles erweitern [PENDING]

**Geänderte Dateien:** Areas, Departments, Teams, Users Controller

| Endpoint-Typ       | Aktuell                   | Neu                                                                                                      |
| ------------------ | ------------------------- | -------------------------------------------------------------------------------------------------------- |
| GET (Liste/Detail) | `@Roles('admin', 'root')` | `@Roles('admin', 'root', 'employee')` + `@RequirePermission('manage_hierarchy', 'manage-X', 'canRead')`  |
| PUT (Edit)         | `@Roles('admin', 'root')` | `@Roles('admin', 'root', 'employee')` + `@RequirePermission('manage_hierarchy', 'manage-X', 'canWrite')` |
| POST (Create)      | `@Roles('admin', 'root')` | **Bleibt** `@Roles('admin', 'root')`                                                                     |
| DELETE             | `@Roles('admin', 'root')` | **Bleibt** `@Roles('admin', 'root')`                                                                     |

### ~~Step 3.4: validateLeader()~~ ENTFÄLLT (D1 = NEIN)

validateLeader() bleibt unverändert — Area/Department-Leads nur admin/root (ADR-035 konform).

### Phase 3 — Definition of Done

- [ ] `manage_hierarchy` Permission-Kategorie registriert
- [ ] DB Migration: `manage_hierarchy` in `addons`-Tabelle + Permissions für bestehende Admins geseeded
- [ ] PermissionGuard Lead-Logik implementiert
- [ ] GET/PUT Endpoints erlauben Employee-Rolle (mit Permission-Check)
- [ ] POST/DELETE Endpoints bleiben Admin/Root only
- [ ] Root/Admin Zugriffe unverändert (Regression)
- [ ] ESLint 0 Errors, Type-Check passed

---

## Phase 4: Backend — Unit Tests

> **Abhängigkeit:** Phase 2 + 3 complete

### Step 4.1: HierarchyPermissionService.getScope() Tests [PENDING]

**Geänderte Datei:** `backend/src/nest/hierarchy-permission/hierarchy-permission.service.test.ts`

**Mindestens 14 Szenarien:**

| #   | Szenario                                  | Erwartung                        |
| --- | ----------------------------------------- | -------------------------------- |
| 1   | Root-User                                 | type: 'full'                     |
| 2   | Admin mit has_full_access=true            | type: 'full'                     |
| 3   | Admin mit admin_area_permissions          | areaIds + cascaded depts/teams   |
| 4   | Admin als area_lead_id (OHNE perm)        | Gleich wie Area-Permission       |
| 5   | Admin mit admin_dept_permissions          | deptIds + cascaded teams         |
| 6   | Admin als department_lead_id              | Gleich wie Dept-Permission       |
| 7   | Admin als team_lead_id                    | nur teamIds                      |
| 8   | Admin ohne Permissions + kein Lead        | type: 'limited', alles leer      |
| 9   | Employee als team_lead                    | isTeamLead=true, teamIds korrekt |
| 10  | Employee als deputy_lead                  | Gleich wie team_lead             |
| 11  | Employee kein Lead                        | type: 'none'                     |
| 12  | Nur is_active=1 Entities                  | Gelöschte/archivierte ignoriert  |
| 13  | Tenant-Isolation                          | Lead aus anderem Tenant → leer   |
| 14  | Kombiniert: Area-Perm + Dept-Lead (Admin) | Union beider Scopes              |

### Step 4.2: PermissionGuard Lead-Logik Tests [PENDING]

**Mindestens 7 Szenarien:**

| #   | Szenario                                 | Erwartung            |
| --- | ---------------------------------------- | -------------------- |
| 1   | Employee + Lead + kein ADR-020 Eintrag   | GRANT                |
| 2   | Employee + Lead + ADR-020 canRead=true   | GRANT                |
| 3   | Employee + Lead + ADR-020 canRead=false  | DENY                 |
| 4   | Employee + kein Lead                     | DENY                 |
| 5   | Root → manage_hierarchy                  | GRANT (unverändert)  |
| 6   | Admin + hasFullAccess → manage_hierarchy | GRANT (unverändert)  |
| 7   | Non-manage_hierarchy Permission          | Standard fail-closed |

### Step 4.3: Service Scope-Tests [PENDING]

**Pro Service (Areas, Departments, Teams, Users) mindestens 4 Szenarien:**

| #   | Szenario                          | Erwartung               |
| --- | --------------------------------- | ----------------------- |
| 1   | Root-User                         | Alle Entities           |
| 2   | Scoped Admin                      | Nur Scope-Entities      |
| 3   | Employee-Lead                     | Nur Lead-Scope-Entities |
| 4   | Employee ohne Lead / leerer Scope | Leeres Array            |

### Phase 4 — Definition of Done

- [ ] > = 30 Unit Tests
- [ ] Alle Tests grün
- [ ] Tenant-Isolation verifiziert
- [ ] Kaskade-Logik verifiziert
- [ ] Deputy-Lead verifiziert
- [ ] ADR-020 Override verifiziert
- [ ] Root/Admin Regression bestanden

---

## Phase 5: Frontend — Route Migration + Layout Data

> **Abhängigkeit:** Phase 1 complete (Endpoint verfügbar)

### Step 5.1: Route Groups migrieren [PENDING]

| Von                           | Nach                           | Grund                 |
| ----------------------------- | ------------------------------ | --------------------- |
| `(admin)/manage-areas/`       | `(shared)/manage-areas/`       | Admin + Employee-Lead |
| `(admin)/manage-departments/` | `(shared)/manage-departments/` | Admin + Employee-Lead |
| `(root)/manage-teams/`        | `(shared)/manage-teams/`       | Admin + Employee-Lead |
| `(admin)/manage-employees/`   | `(shared)/manage-employees/`   | Admin + Employee-Lead |
| `(admin)/manage-admins/`      | `(root)/manage-admins/`        | Root-only             |

**URLs bleiben identisch.** Route Groups in SvelteKit beeinflussen nicht die URL.

### Step 5.2: +page.server.ts Access-Checks [PENDING]

Jede migrierte +page.server.ts bekommt einen expliziten Access-Check:

```typescript
// Pattern für manage-teams + manage-employees (Employee-Leads erlaubt):
const { user, orgScope } = await parent();

if (user.role === 'root') {
  // Immer OK
} else if (user.role === 'admin') {
  // Admin: Zugang wenn Scope vorhanden (full oder limited)
  if (orgScope.type === 'none') redirect(302, '/permission-denied');
} else if (user.role === 'employee') {
  // Employee: Nur Team-Leads (D1=NEIN: keine Area/Dept-Leads)
  if (!orgScope.isTeamLead) redirect(302, '/permission-denied');
} else {
  redirect(302, '/permission-denied');
}

// Pattern für manage-areas + manage-departments (KEIN Employee-Zugang):
if (user.role !== 'root' && user.role !== 'admin') {
  redirect(302, '/permission-denied');
}
if (user.role === 'admin' && orgScope.type === 'none') {
  redirect(302, '/permission-denied');
}
```

### Step 5.3: Layout Data erweitern [PENDING]

**Geänderte Datei:** `frontend/src/routes/(app)/+layout.server.ts`

```typescript
const [counts, theme, addons, labels, orgScope] = await Promise.all([
  fetchDashboardCounts(token, fetch),
  fetchTheme(token, fetch),
  fetchActiveAddons(token, fetch),
  fetchHierarchyLabels(token, fetch),
  fetchOrgScope(token, fetch), // NEU: GET /users/me/org-scope
]);
```

**Für Root/Admin full: orgScope-Query ist trotzdem billig (< 1ms, returns type:'full').**

### Phase 5 — Definition of Done

- [ ] 4 Route-Ordner nach (shared) verschoben
- [ ] manage-admins nach (root) verschoben
- [ ] URLs unverändert
- [ ] orgScope in Layout-Data verfügbar
- [ ] Jede +page.server.ts hat expliziten Role + Scope Check
- [ ] Root-Zugriff auf alle Seiten funktioniert (Regression)
- [ ] Admin-Zugriff korrekt (full: alle, scoped: sein Scope)
- [ ] Employee Lead → Seite lädt
- [ ] Employee ohne Lead → redirect
- [ ] svelte-check 0 Errors

---

## Phase 6: Frontend — Navigation + Lead-View + ScopeInfoBanner

> **Abhängigkeit:** Phase 5 complete

### Step 6.1: navigation-config.ts erweitern [PENDING]

**Geänderte Datei:** `frontend/src/routes/(app)/_lib/navigation-config.ts`

**Neue Funktion:**

```typescript
export function filterMenuByScope(items: NavItem[], orgScope: OrganizationalScope, role: UserRole): NavItem[] {
  // Root/Admin full: no-op
  // Admin scoped: filter Manage-Items basierend auf Scope
  // Employee-Lead: filter basierend auf Lead-Status
  // Employee ohne Lead: remove all Manage-Items
}
```

**manage-admins aus Admin-Menü entfernen** (jetzt Root-only).

**Employee-Lead Menü-Items (conditional):**

```typescript
// D1=NEIN: Employee-Leads können nur Team-Leads sein → nur 2 Manage-Items
const MANAGE_ITEMS_FOR_TEAM_LEADS: NavItem[] = [
  { id: 'manage-teams', ..., label: labels.team, url: '/manage-teams' },           // wenn isTeamLead
  { id: 'manage-employees', ..., label: 'Mitarbeiter', url: '/manage-employees' }, // wenn isTeamLead
];
```

### Step 6.2: Filter-Pipeline in +layout.svelte [PENDING]

**Geänderte Datei:** `frontend/src/routes/(app)/+layout.svelte`

```svelte
const menuItems = $derived<NavItem[]>(
  filterMenuByAddons(
    filterMenuByScope(              // NEU: Scope-basierte Filterung
      filterMenuByAccess(
        getMenuItemsForRole(currentRole, hierarchyLabels),
        hasFullAccess,
      ),
      data.orgScope,
      currentRole,
    ),
    activeAddonsSet,
  ),
);
```

### Step 6.3: ScopeInfoBanner Component [PENDING]

**Neue Datei:** `frontend/src/lib/components/ScopeInfoBanner.svelte`

Zeigt für scoped Admins auf manage-employees:

```
 Du siehst Mitarbeiter in: Produktionshalle Nord, Lager Süd
 (inkl. alle [Abteilungen] und [Teams])
```

- Labels aus hierarchyLabels (ADR-034)
- Root / has_full_access → kein Banner
- Admin ohne Scope → "Kein Zugriff auf Organisationseinheiten"

### Step 6.4: Manage-Seiten Lead-View [PENDING]

**Geänderte Dateien:** Alle 4 migrierten +page.svelte

**Für Employee-Leads:**

1. Kein "Hinzufügen"-Button (Create bleibt Root/Admin)
2. Kein "Löschen"-Button (Delete bleibt Root/Admin)
3. Edit-Button sichtbar (Lead darf bearbeiten)
4. Daten bereits scope-gefiltert (Backend liefert nur Scope)

```svelte
{#if data.user.role === 'root' || data.user.role === 'admin'}
  <FloatingActionButton onclick={openCreateModal} />
{/if}
```

### Phase 6 — Definition of Done

- [ ] `filterMenuByScope()` implementiert
- [ ] Employee-Lead sieht korrekte Manage-Items in Sidebar
- [ ] Employee ohne Lead sieht KEINE Manage-Items
- [ ] Admin sieht kein manage-admins mehr
- [ ] Root Sidebar unverändert
- [ ] Hierarchy Labels korrekt in Lead-Menüpunkten
- [ ] ScopeInfoBanner erstellt und integriert
- [ ] Manage-Seiten: Lead sieht Read+Edit, NICHT Create/Delete
- [ ] svelte-check + ESLint 0 Errors

---

## Phase 7: API Integration Tests

> **Abhängigkeit:** Phase 2 + 3 + 5 complete

### Step 7.1: Scope-Endpoint Tests [PENDING]

**Neue Datei:** `backend/test/org-scope.api.test.ts`

| #   | Szenario           | Erwartung                         |
| --- | ------------------ | --------------------------------- |
| 1   | Unauthenticated    | 401                               |
| 2   | Root               | type: 'full'                      |
| 3   | Employee ohne Lead | type: 'none'                      |
| 4   | Employee Team-Lead | type: 'limited', korrekte teamIds |

### Step 7.2: Manage-\* Scope Tests [PENDING]

**Neue/erweiterte Test-Dateien für areas, departments, teams, users**

| #   | Szenario                                     | Erwartung            |
| --- | -------------------------------------------- | -------------------- |
| 1   | Root → GET /teams                            | Alle Teams           |
| 2   | Scoped Admin → GET /teams                    | Nur scoped Teams     |
| 3   | Employee-Lead → GET /teams                   | Nur Lead-Scope Teams |
| 4   | Employee ohne Lead → GET /teams              | 403                  |
| 5   | Employee-Lead → PUT /teams/:id (eigenes)     | 200                  |
| 6   | Employee-Lead → PUT /teams/:id (fremdes)     | 403                  |
| 7   | Employee-Lead → DELETE /teams/:id            | 403                  |
| 8   | Employee-Lead → POST /teams                  | 403                  |
| 9   | Scoped Admin → GET /users?role=employee      | Nur scoped Users     |
| 10  | Admin → GET /users?role=admin                | 403                  |
| 11  | Root → GET /users?role=admin                 | 200                  |
| 12  | Scoped Admin → PUT /users/:id (in scope)     | 200                  |
| 13  | Scoped Admin → PUT /users/:id (out of scope) | 403                  |

### Phase 7 — Definition of Done

- [ ] > = 20 API Integration Tests
- [ ] Alle Tests grün
- [ ] Scope-Filterung verifiziert (Admin + Employee-Lead)
- [ ] Create/Delete-Blocking für Leads verifiziert
- [ ] Root/Admin Regression bestanden

---

## Phase 8: ADR-036 + Documentation + Polish

> **Abhängigkeit:** Phase 7 complete

### Step 8.1: ADR-036 erstellen [PENDING]

**Neue Datei:** `docs/infrastructure/adr/ADR-036-organizational-scope-access-control.md`

**Inhalte:**

- Context: Manage-Seiten haben keine Scope-Filterung, Leads können nicht verwalten
- Decision: HierarchyPermissionService.getScope() + Unified CTE + ScopeGuard/CLS + Lead-Default-Grant
- Alternatives: Zwei separate Services (rejected), RLS-Umbau (rejected), Frontend-only Filter (rejected)
- Consequences: Positive + Negative

### Step 8.2: ADR-035 aktualisieren [PENDING]

- Referenz auf ADR-036 hinzufügen
- Keine validateLeader()-Änderung nötig (D1=NEIN, ADR-035 bleibt konform)

### Step 8.3: Smoke Test Checkliste [PENDING]

| Test                                                                                        | Ergebnis |
| ------------------------------------------------------------------------------------------- | -------- |
| Root sieht alle Manage-Seiten (Regression)                                                  |          |
| Admin full sieht alle Manage-Seiten (Regression)                                            |          |
| Scoped Admin sieht nur seinen Scope auf manage-employees                                    |          |
| Scoped Admin sieht ScopeInfoBanner                                                          |          |
| Scoped Admin sieht nur scoped Areas/Departments in Dropdowns                                |          |
| Admin sieht manage-admins NICHT in Sidebar                                                  |          |
| Root sieht manage-admins                                                                    |          |
| Employee Corc (Team-Lead Linie 9) sieht manage-teams                                        |          |
| Corc sieht NUR Linie 9 auf manage-teams                                                     |          |
| Corc sieht manage-employees (Mitglieder Linie 9)                                            |          |
| Corc sieht NICHT manage-areas, manage-departments, manage-admins, manage-halls              |          |
| Corc kann Linie 9 editieren                                                                 |          |
| Corc kann Linie 9 NICHT löschen                                                             |          |
| Corc kann KEIN neues Team anlegen                                                           |          |
| Admin entzieht Corc Permission → Corc sieht nichts mehr                                     |          |
| Scoped Admin (Area-Lead) sieht manage-areas + manage-depts + manage-teams (scope-gefiltert) |          |
| Employee ohne Lead sieht keine Manage-Seiten                                                |          |

### Phase 8 — Definition of Done

- [ ] ADR-036 geschrieben
- [ ] ADR-035 aktualisiert
- [ ] FEATURES.md aktualisiert
- [ ] Smoke Tests alle bestanden
- [ ] Keine offenen TODOs im Code

---

## Session Tracking

| Session | Phase | Beschreibung                                                                           | Status | Datum |
| ------- | ----- | -------------------------------------------------------------------------------------- | ------ | ----- |
| 1       | 1     | HierarchyPermissionService erweitern + Types + CTE + ScopeGuard (APP_GUARD) + Endpoint |        |       |
| 2       | 1+2   | KVP Refactoring + List-Method Scope-Filtering                                          |        |       |
| 3       | 2     | User-List Scope + Mutations + Scope-Info Response                                      |        |       |
| 4       | 3     | Permission Registry + Guard Extension + Controller @Roles                              |        |       |
| 5       | 4     | Unit Tests (Scope, Guard, Services)                                                    |        |       |
| 6       | 5     | Route Migration + Layout Data + Access Checks                                          |        |       |
| 7       | 6     | Navigation Config + Filter Pipeline + ScopeInfoBanner                                  |        |       |
| 8       | 6+7   | Manage-Seiten Lead-View + API Integration Tests                                        |        |       |
| 9       | 8     | ADR-036 + Docs + Smoke Tests + Polish                                                  |        |       |

---

## Quick Reference: File Paths

### Backend (neu)

| Datei                                                                          | Zweck                                      |
| ------------------------------------------------------------------------------ | ------------------------------------------ |
| `backend/src/nest/hierarchy-permission/organizational-scope.types.ts`          | OrganizationalScope Interface              |
| `backend/src/nest/common/guards/scope.guard.ts`                                | Scope einmal pro Request → CLS (APP_GUARD) |
| `backend/src/nest/common/permissions/manage-hierarchy.permissions.ts`          | Permission-Kategorie                       |
| `backend/src/nest/common/permissions/manage-hierarchy-permission.registrar.ts` | Registrar                                  |
| `database/migrations/XXXXXX_manage-hierarchy-permissions.ts`                   | Addon + Admin-Permissions Seed             |
| `backend/test/org-scope.api.test.ts`                                           | API Integration Tests                      |

### Backend (geändert)

| Datei                                                                   | Änderung                                                    |
| ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| `backend/src/nest/hierarchy-permission/hierarchy-permission.service.ts` | `getScope()` + Unified CTE + `getVisibleUserIds()`          |
| `backend/src/nest/app.module.ts`                                        | ScopeGuard als APP_GUARD + HierarchyPermissionModule Import |
| `backend/src/nest/common/guards/permission.guard.ts`                    | Lead-Default-Grant Logik                                    |
| `backend/src/nest/areas/areas.controller.ts`                            | @Roles + @RequirePermission                                 |
| `backend/src/nest/departments/departments.controller.ts`                | @Roles + @RequirePermission                                 |
| `backend/src/nest/teams/teams.controller.ts`                            | @Roles + @RequirePermission                                 |
| `backend/src/nest/users/users.controller.ts`                            | Neuer Endpoint + @Roles                                     |
| `backend/src/nest/areas/areas.service.ts`                               | Scope-Filterung (liest aus CLS)                             |
| `backend/src/nest/departments/departments.service.ts`                   | Scope-Filterung (liest aus CLS)                             |
| `backend/src/nest/teams/teams.service.ts`                               | Scope-Filterung (liest aus CLS)                             |
| `backend/src/nest/users/users.service.ts`                               | Scope-Filterung + Mutation-Checks + Role-Restriction        |
| `backend/src/nest/kvp/kvp.service.ts`                                   | Refactored → nutzt `HierarchyPermissionService.getScope()`  |

### Frontend (verschoben)

| Von                           | Nach                           |
| ----------------------------- | ------------------------------ |
| `(admin)/manage-areas/`       | `(shared)/manage-areas/`       |
| `(admin)/manage-departments/` | `(shared)/manage-departments/` |
| `(root)/manage-teams/`        | `(shared)/manage-teams/`       |
| `(admin)/manage-employees/`   | `(shared)/manage-employees/`   |
| `(admin)/manage-admins/`      | `(root)/manage-admins/`        |

### Frontend (neu)

| Datei                                                | Zweck             |
| ---------------------------------------------------- | ----------------- |
| `frontend/src/lib/components/ScopeInfoBanner.svelte` | Scope-Info-Banner |

### Frontend (geändert)

| Datei                                                 | Änderung                                 |
| ----------------------------------------------------- | ---------------------------------------- |
| `frontend/src/routes/(app)/+layout.server.ts`         | fetchOrgScope() hinzugefügt              |
| `frontend/src/routes/(app)/+layout.svelte`            | filterMenuByScope() in Pipeline          |
| `frontend/src/routes/(app)/_lib/navigation-config.ts` | filterMenuByScope() + manage-admins raus |
| Alle 4 migrierten manage-\*/+page.svelte              | Lead-View (kein Create/Delete)           |
| Alle 4 migrierten manage-\*/+page.server.ts           | Scope-basierter Access-Check             |

---

## Known Limitations (V1 — Bewusst ausgeschlossen)

1. **Kein Live-Update**: Lead-Status/Scope erst nach Navigation/Reload aktualisiert (kein SSE-Push)
2. **Keine Lead-Templates**: Admins können keine "Standard-Lead-Permissions" als Template anlegen
3. **Kein hierarchisches Permission-Erbe**: Area-Lead Permissions erben sich NICHT automatisch auf Dept/Team in ADR-020
4. **Leads können nicht erstellen/löschen**: Nur Read + Edit — Create/Delete bleibt Root/Admin
5. **Employee-Scope basiert auf Team-Membership**: Mitarbeiter ohne Team-Zuweisung sind für Leads unsichtbar
6. **Hall hat keinen Lead**: Designentscheidung — physischer Ort, kein org. Element
7. **Kein granulares RWX pro Scope-Segment**: Scoped Admin kann jeden sichtbaren User editieren/löschen (V2)
8. **Keine Scope-Filterung in Exports/E-Mails**: Nur API-Responses werden gefiltert
9. **Employee-Leads nur auf Team-Ebene**: Employees können nur team_lead/deputy_lead sein, NICHT area/department-lead (D1=NEIN, ADR-035 konform)

---

## Spec Deviations

| #   | Plan sagt    | Tatsächlicher Code | Entscheidung |
| --- | ------------ | ------------------ | ------------ |
| -   | (noch keine) | -                  | -            |

---

## Superseded Plans — Differenz-Dokumentation

### Was aus FEAT_LEAD_ACCESS_MASTERPLAN übernommen wurde:

- LeadScopeService → integriert als `getScope()` in HierarchyPermissionService
- Route-Migration nach (shared)
- filterMenuByLeadRoles → integriert in filterMenuByScope
- PermissionGuard manage_hierarchy Extension
- Lead-Default-Grant mit ADR-020 Override
- KVP-Refactoring
- CRUD-Matrix (Read+Edit, kein Create/Delete)

### Was aus FEAT_USER_SCOPE_FILTERING_MASTERPLAN übernommen wurde:

- getVisibleUserIds → Methode auf HierarchyPermissionService
- listUsers() Scope-Filter
- role=admin/root Listing nur für Root
- Mutation Scope-Checks (ensureEntityInScope)
- manage-admins → (root)
- ScopeInfoBanner
- Scope-Info als Response-Metadata

### Was geändert wurde:

- **Kein separater LeadScopeService** — `getScope()` direkt auf HierarchyPermissionService
- **Bestehende getAccessible\*Ids() ersetzt** — durch unified `getScope()` mit Lead-Support
- **Eine CTE statt zwei** — alle Zugriffspfade (Permissions + Leads) in einer Query
- **Ein Filter-Pfad pro Service** statt zwei separate (Admin vs Employee)
- **ScopeGuard (APP_GUARD) + CLS** — Scope einmal pro Request, nicht pro Service-Call. Guard statt Interceptor wegen NestJS Execution Order (Guards vor Interceptors)
- **manage-employees → (shared)** statt in (admin) zu bleiben (Plan 2 Abweichung)
- **D1=NEIN** — Employee-Leads nur Team-Level (Plan 1 wollte Area/Dept öffnen)
- **ADR-036** statt zwei konkurrierende ADR-035s

---

**Dieses Dokument ist der Execution Plan. Jede Session startet hier,
nimmt das nächste unchecked Item, und markiert es als done.**
