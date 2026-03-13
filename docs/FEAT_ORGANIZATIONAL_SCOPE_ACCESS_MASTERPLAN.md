# FEAT: Organizational Scope Access Control — Unified Masterplan

> **Created:** 2026-03-13
> **Version:** 0.6.0 (Draft — Codebase-Verifiziert + Fixes)
> **Status:** DRAFT — Phase 0 (Planung)
> **Branch:** `feat/org-scope-access`
> **ADR:** ADR-036 (zu erstellen in Phase 8)
> **Author:** SCS-Technik Team
> **Estimated Sessions:** 10
> **Actual Sessions:** 0 / 10
> **Supersedes:** `FEAT_LEAD_ACCESS_MASTERPLAN.md` + `FEAT_USER_SCOPE_FILTERING_MASTERPLAN.md`

---

## Changelog

| Version | Datum      | Änderung                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-03-13 | Initial Draft — Zusammenführung beider Einzelpläne                                                                                                                                                                                                                                                                                                                                                                                                          |
| 0.2.0   | 2026-03-13 | Decisions finalisiert: D1=NEIN, D2=A (extend HierarchyPermissionService), D3=A (CLS)                                                                                                                                                                                                                                                                                                                                                                        |
| 0.3.0   | 2026-03-13 | Review-Fixes: CTE-Syntax (Subquery statt FULL OUTER JOIN), Migration für manage_hierarchy ergänzt                                                                                                                                                                                                                                                                                                                                                           |
| 0.4.0   | 2026-03-13 | Verifizierter Review: ScopeGuard→ScopeGuard (Timing-Bug), users.department_id entfernt (existiert nicht), isEntityInScope Signatur gefixt, HierarchyPermissionModule Import ergänzt                                                                                                                                                                                                                                                                         |
| 0.5.0   | 2026-03-13 | Code-Verifizierter Review + Entscheidungen E1-E5: Deputy=Lead+Settings-Toggle (E1), ScopeGuard→ScopeService Lazy (E2), Admins manuell durch Root (E3), Auto-Seed bei Lead-Zuweisung (E4), manage-dummies→root (E5). CTE-Fix: is_active JOIN für perm_areas/perm_depts. BlackboardAccessService als Consumer dokumentiert. ensureEntityInScope 'user'-Typ gefixt. Migration vereinfacht (nur Addon-Eintrag, keine Admin-Rows). IS_ACTIVE-Konstanten-Hinweis. |
| 0.6.0   | 2026-03-13 | Codebase-Verifizierung: (1) Migration down() UPDATE statt DELETE (prevent_addons_delete Trigger). (2) Step 3.5 Prerequisite: deputyLeaderId in DTO/Service/Controller (DB-Spalte existiert, kein Codepfad zum Setzen). (3) ScopeService: Dead-Code userRole entfernt (getUserInfo() löst Rolle intern).                                                                                                                                                     |

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
│  Scope wird LAZY aufgelöst (ScopeService).                          │
│  Erste Abfrage → DB-Query + CLS-Cache. Danach aus CLS.             │
│  ~90% der Requests (Chat, Calendar, etc.) lösen NIE Scope auf.     │
└──────────────────────────────────────────────────────────────────────┘
```

**Jeder Service nutzt denselben Filter-Pfad:**

```typescript
const scope = await this.scopeService.getScope(); // Lazy: erste Abfrage → DB, danach CLS-Cache
if (scope.type === 'full') return allEntities;
if (scope.type === 'none' || scope.teamIds.length === 0) return [];
return filterByIds(scope.teamIds); // Works for Admin AND Employee-Lead
```

### Regeln

1. **Root / has_full_access**: Sieht alles, kein Filter (unverändert)
2. **Scoped Admin**: Sieht Entities in seinem Permission-Scope + Lead-Scope. **Admin braucht explizite `manage_hierarchy` Permission-Row** (Root vergibt manuell)
3. **Employee-Lead**: Sieht Entities in seinem Lead-Scope (Read+Edit, KEIN Create/Delete). **Permission-Rows werden automatisch geseeded** bei Lead-Zuweisung
4. **Kaskade**: Area-Scope vererbt sich auf Departments + Teams darunter
5. **Deputy = Lead**: `deputy_lead_id` hat identische Rechte wie `team_lead_id`. **TODO (V2):** Per-Tenant-Setting ob Deputy volle Lead-Rechte hat (Jede Firma entscheidet selbst). Code vorbereiten mit `DEPUTY_EQUALS_LEAD`-Flag für einfaches Anknüpfen
6. **ADR-020 Override**: Root kann einem Admin/Lead den Zugriff via Permission-Seite entziehen
7. **Kein Hall-Lead**: Hall = physischer Ort, kein Lead-Konzept
8. **manage-admins = Root-only**: Nur Root verwaltet Admins
9. **manage-dummies = Root-only**: Nur Root verwaltet Platzhalter-Benutzer
10. **manage-assets = Bleibt in (admin)**: Bereits über Permission-System steuerbar, kein Scope-Filter nötig
11. **Fail-Closed überall**: PermissionGuard hat EIN Verhalten — kein Row = kein Zugang. Keine Sonderfälle

### Seiten-Matrix

| Manage-Seite       | Root | Admin (full) | Admin (scoped + Schlüssel) | Employee Team-Lead | Employee |
| ------------------ | ---- | ------------ | -------------------------- | ------------------ | -------- |
| manage-areas       | alle | alle         | sein Scope                 | ---                | ---      |
| manage-departments | alle | alle         | sein Scope                 | ---                | ---      |
| manage-teams       | alle | alle         | sein Scope                 | sein Team(s)       | ---      |
| manage-employees   | alle | alle         | sein Scope                 | seine Team-Members | ---      |
| manage-admins      | alle | ---          | ---                        | ---                | ---      |
| manage-halls       | alle | alle         | alle                       | ---                | ---      |
| manage-dummies     | alle | ---          | ---                        | ---                | ---      |
| manage-assets      | alle | alle         | alle (Permission-basiert)  | ---                | ---      |

> **"Schlüssel"** = `manage_hierarchy` Permission-Row in `user_addon_permissions`. Root vergibt an Admins manuell. Employee-Leads bekommen ihn automatisch bei Lead-Zuweisung.
> **Admin ohne Schlüssel** sieht KEINE manage-Seiten (außer manage-halls/manage-assets, die eigene Permissions haben).

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

| #   | Risiko                                                   | Impact  | Wahrscheinlichkeit | Mitigation                                                                                    | Verifikation                                     |
| --- | -------------------------------------------------------- | ------- | ------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| R1  | Route Group Migration bricht Root/Admin-Zugriffe         | Hoch    | Mittel             | +page.server.ts behält explizite Role-Checks                                                  | E2E: Root/Admin auf alle Manage-Seiten           |
| R2  | Scope-CTE-Query ist langsam                              | Mittel  | Niedrig            | Single CTE, alle Pfade in einer Query                                                         | EXPLAIN ANALYZE < 10ms bei 500 Usern             |
| R3  | ADR-020 Override vs Auto-Seed Konflikt                   | Mittel  | Niedrig            | Auto-Seed nutzt ON CONFLICT DO NOTHING → ADR-020 Override bleibt                              | Unit Test: Lead mit entzogener Permission = DENY |
| R4  | Scope-Filter bricht Root/has_full_access                 | Hoch    | Niedrig            | Early return `type: 'full'` vor jedem Filter                                                  | API-Test: Root sieht ALLES                       |
| R5  | Employee sieht Manage-Seite aber Backend blockt Mutation | Mittel  | Hoch               | Frontend conditional: Lead sieht Read+Edit, NICHT Create/Delete                               | Smoke Test                                       |
| R6  | Dropdown-Scoping bricht andere Module                    | Hoch    | Niedrig            | V1: Kein Dropdown-Scope-Filter (Known Limitation #12). Backend fängt ungültige Zuweisungen ab | Bewusst ausgeschlossen für V1                    |
| R7  | Admin ohne Scope sieht leere Tabelle                     | Niedrig | Mittel             | ScopeInfoBanner erklärt Situation                                                             | Manueller Test                                   |
| R8  | Admin ohne manage_hierarchy Permission sieht nichts      | Mittel  | Mittel             | Root muss explizit vergeben (D5). Kein Auto-Grant bei Admin-Erstellung                        | Permission-Seite testen                          |

### 0.3 Decisions (FINALISIERT)

| #   | Frage                                        | Entscheidung                                | Begründung                                                                                                                                                                       |
| --- | -------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Dürfen Employees Area/Department-Leads sein? | **NEIN**                                    | ADR-035 bleibt: area/dept leads = admin/root only. Employee-Leads nur team_lead/deputy_lead                                                                                      |
| D2  | Wo lebt die Scope-Logik?                     | **A: HierarchyPermissionService erweitern** | Ein Service für alle Hierarchy-Permissions. Bestehender Consumer: `BlackboardAccessService` — wird auf `getScope()` migriert. Bestehende `getAccessible*Ids()` werden deprecated |
| D3  | Scope-Auflösung wann?                        | **LAZY via ScopeService**                   | ScopeService löst Scope beim ersten Zugriff auf, cached in CLS. ~90% der Requests (Chat, Calendar etc.) lösen NIE Scope auf → kein DB-Overhead                                   |
| D4  | Deputy = Lead?                               | **JA (V1), Settings-Toggle (V2)**           | `deputy_lead_id` hat identische Rechte wie `team_lead_id`. Code mit `DEPUTY_EQUALS_LEAD`-Flag vorbereiten für Per-Tenant-Setting in V2                                           |
| D5  | Wie bekommen Admins manage_hierarchy Zugang? | **Explizit durch Root**                     | Kein Auto-Seed. Root vergibt `manage_hierarchy` manuell auf Permission-Seite. Maximale Kontrolle. DB = Test-Daten, kein Prod-Migrationsproblem                                   |
| D6  | Wie bekommen Leads manage_hierarchy Zugang?  | **Auto-Seed bei Lead-Zuweisung**            | TeamsService seeded Permission-Rows bei `team_lead_id`/`deputy_lead_id` Änderung. Auto-Cleanup bei Entfernung. Guard bleibt einheitlich fail-closed                              |
| D7  | manage-dummies Zugang?                       | **Root-only**                               | Verschieben von (admin) nach (root)                                                                                                                                              |
| D8  | manage-assets Zugang?                        | **Bleibt in (admin)**                       | Bereits über bestehendes Permission-System steuerbar, kein Scope-Filter nötig                                                                                                    |

### 0.4 Ecosystem Integration Points

| Bestehendes System          | Art der Integration                                                                                      | Phase |
| --------------------------- | -------------------------------------------------------------------------------------------------------- | ----- |
| HierarchyPermissionService  | Erweitern: neue Methode `getScope()` + Unified CTE                                                       | 1     |
| ScopeService (NEU)          | Lazy Scope-Auflösung: erste Abfrage → DB + CLS-Cache. Kein APP_GUARD, normaler Injectable Service        | 1     |
| PermissionGuard             | Keine Änderung — bleibt einheitlich fail-closed. Auto-Seed-Rows machen Sonderlogik überflüssig           | —     |
| Permission Registry         | Neue Kategorie `manage_hierarchy` registrieren                                                           | 3     |
| DB Migration                | Nur `addons`-Eintrag (is_core=true). Keine Admin-Permission-Rows (Root vergibt manuell, DB = Test-Daten) | 3     |
| TeamsService                | Auto-Seed/Cleanup von `manage_hierarchy` Permission-Rows bei Lead-Zuweisung/-Entfernung                  | 3     |
| BlackboardAccessService     | Migrieren von `getAccessible*Ids()` auf `ScopeService.getScope()` (bestehender Consumer!)                | 2     |
| Navigation Config           | `filterMenuByScope()` + Scope-basierte Items                                                             | 6     |
| (app)/+layout.server.ts     | `fetchOrgScope()` parallel laden                                                                         | 5     |
| KVP EXTENDED_ORG_INFO_QUERY | Refactoring → nutzt `HierarchyPermissionService.getScope()`. **Achtung:** deputy_lead_id NEU für KVP     | 1     |
| Route Groups (admin)/(root) | manage-\* Seiten nach (shared) migrieren + manage-dummies nach (root)                                    | 5     |

---

## Ist-Zustand (verifiziert)

### Route Groups

| Seite              | Aktuell | Ziel     | Begründung                           |
| ------------------ | ------- | -------- | ------------------------------------ |
| manage-areas       | (admin) | (shared) | Admin + Employee-Lead (Scope-Filter) |
| manage-departments | (admin) | (shared) | Admin + Employee-Lead (Scope-Filter) |
| manage-teams       | (root)  | (shared) | Admin + Employee-Lead (Scope-Filter) |
| manage-employees   | (admin) | (shared) | Admin + Employee-Lead (Scope-Filter) |
| manage-admins      | (admin) | (root)   | Root-only (D7-konform)               |
| manage-dummies     | (admin) | (root)   | Root-only (D7)                       |
| manage-halls       | (admin) | bleibt   | Kein Scope-Filter nötig              |
| manage-assets      | (admin) | bleibt   | Permission-System reicht (D8)        |

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
> **Ziel:** Bestehenden Service um `getScope()` + Unified CTE erweitern, ScopeService (Lazy) erstellen

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

> **WICHTIG:** Im Code `${IS_ACTIVE.ACTIVE}` statt `1` und `${IS_ACTIVE.DELETED}` statt `4` verwenden (No-Go #16, TYPESCRIPT-STANDARDS.md). Hier als Klartext für Lesbarkeit.

```sql
WITH
-- Pfad 1: Admin area permissions (direkt) — NUR aktive Areas (is_active JOIN!)
perm_areas AS (
  SELECT aap.area_id AS id FROM admin_area_permissions aap
  INNER JOIN areas a ON a.id = aap.area_id AND a.is_active = 1
  WHERE aap.admin_user_id = $1 AND aap.tenant_id = $2
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
-- Pfad 3: Admin department permissions (direkt) — NUR aktive Departments (is_active JOIN!)
perm_depts AS (
  SELECT adp.department_id AS id FROM admin_department_permissions adp
  INNER JOIN departments d ON d.id = adp.department_id AND d.is_active = 1
  WHERE adp.admin_user_id = $1 AND adp.tenant_id = $2
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
-- deputy_lead_id = team_lead_id (D4: Deputy=Lead V1, DEPUTY_EQUALS_LEAD Flag für V2)
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

- `EXTENDED_ORG_INFO_QUERY` (kvp.constants.ts:29-69) durch `ScopeService.getScope()` ersetzen
- KVP-Module importiert `ScopeService` (via ScopeModule)
- Bestehende KVP-Tests müssen weiterhin grün sein

> **⚠ Verhaltensänderung (D4):** Die bestehende `EXTENDED_ORG_INFO_QUERY` prüft NUR `team_lead_id`, NICHT `deputy_lead_id`. Die neue `getScope()` CTE prüft **beides**. Konsequenz: Deputies bekommen KVP-Lead-Rechte (Vorschläge bestätigen etc.), die sie vorher NICHT hatten. Dies ist gewollt (D4: Deputy = Lead). Code mit `DEPUTY_EQUALS_LEAD`-Flag vorbereiten:
>
> ```typescript
> // TODO (V2): Per-Tenant-Setting ob Deputy volle Lead-Rechte hat
> // Wenn DEPUTY_EQUALS_LEAD = false → deputy_lead_id aus CTE-Query entfernen
> const DEPUTY_EQUALS_LEAD = true; // V1: immer true
> ```

### Step 1.4: ScopeService — Lazy Scope-Auflösung mit CLS-Cache [PENDING]

**Neue Datei:** `backend/src/nest/hierarchy-permission/scope.service.ts`

> **Warum Lazy statt APP_GUARD? (v0.5.0, D3)**
> Ein APP_GUARD würde für JEDEN authentifizierten Request eine DB-Query auslösen — auch für Chat, Calendar, Blackboard etc. wo kein Scope gebraucht wird (~90% der Requests).
> **ScopeService** löst den Scope erst auf wenn ein Service ihn tatsächlich braucht (erste Abfrage → DB + CLS-Cache, danach aus CLS). Kein Guard, kein Overhead.

```typescript
@Injectable()
export class ScopeService {
  constructor(
    private readonly hierarchyPermission: HierarchyPermissionService,
    private readonly cls: ClsService,
  ) {}

  /** Lazy: Erste Abfrage → DB-Query + CLS-Cache. Danach aus CLS. */
  async getScope(): Promise<OrganizationalScope> {
    const cached = this.cls.get<OrganizationalScope>('orgScope');
    if (cached !== undefined) return cached;

    const userId = this.cls.get<number>('userId');
    const tenantId = this.cls.get<number>('tenantId');

    // Rolle wird NICHT aus CLS gelesen — HierarchyPermissionService.getScope()
    // bestimmt role + has_full_access intern via getUserInfo() (Single-Row PK-Lookup)
    const scope = await this.hierarchyPermission.getScope(userId, tenantId);
    this.cls.set('orgScope', scope);
    return scope;
  }
}
```

**Neues Modul:** `backend/src/nest/hierarchy-permission/scope.module.ts`

```typescript
@Module({
  imports: [HierarchyPermissionModule],
  providers: [ScopeService],
  exports: [ScopeService],
})
export class ScopeModule {}
```

> **Kein APP_GUARD, keine Änderung an app.module.ts Guard-Reihenfolge.**
> Guard-Reihenfolge bleibt unverändert: JwtAuth → Roles → TenantAddon → Permission.
> PermissionGuard braucht keinen Scope (D6: Auto-Seed macht Sonderlogik überflüssig).

**Services injizieren ScopeService:**

```typescript
constructor(private readonly scopeService: ScopeService) {}

// In Service-Methoden:
const scope = await this.scopeService.getScope();
```

### Step 1.5: Neuer Endpoint — GET /users/me/org-scope [PENDING]

**Geänderte Datei:** `backend/src/nest/users/users.controller.ts`

| Method | Route                 | Guard        | Beschreibung                           |
| ------ | --------------------- | ------------ | -------------------------------------- |
| GET    | `/users/me/org-scope` | JwtAuthGuard | Organisationsscope des aktuellen Users |

Kein @Roles — jeder authentifizierte User kann seinen Scope abfragen. Nutzt `ScopeService.getScope()` (lazy, CLS-cached).

### Phase 1 — Definition of Done

- [ ] `OrganizationalScope` Types definiert (inkl. `DEPUTY_EQUALS_LEAD` Flag)
- [ ] `HierarchyPermissionService.getScope()` mit Unified-CTE implementiert
- [ ] CTE filtert soft-deleted Entities korrekt aus (is_active JOIN auf perm_areas/perm_depts)
- [ ] CTE nutzt `IS_ACTIVE`-Konstanten (keine Magic Numbers)
- [ ] `getScope()` liefert korrekten Scope für Root, Admin (full/scoped), Employee-Lead, Employee
- [ ] `getVisibleUserIds()` liefert korrekte User-IDs basierend auf Scope
- [ ] `ScopeService` implementiert (Lazy: DB bei erstem Zugriff → CLS-Cache)
- [ ] `ScopeModule` exportiert `ScopeService`
- [ ] Endpoint `GET /users/me/org-scope` funktioniert (nutzt ScopeService)
- [ ] KVP refactored: nutzt `ScopeService.getScope()` statt `EXTENDED_ORG_INFO_QUERY`
- [ ] Deputy = Lead Verhaltensänderung in KVP bewusst getestet
- [ ] EXPLAIN ANALYZE der CTE-Query < 10ms
- [ ] ESLint 0 Errors, Type-Check passed
- [ ] Bestehende KVP-Tests grün
- [ ] Bestehende `getAccessible*Ids()` als `@deprecated` markiert (Entfernung nach Blackboard-Migration)

---

## Phase 2: Backend — Service-Level Scope Filtering

> **Abhängigkeit:** Phase 1 complete
> **Ziel:** Alle List/Detail/Mutation-Endpoints respektieren den Scope

### Step 2.1: Scope-Filter in List-Methods [PENDING]

**Geänderte Dateien + Pattern:**

```typescript
// Einheitliches Pattern für ALLE 4 Services:
async listTeams(tenantId: number, filters: TeamFilters): Promise<TeamResponse[]> {
  const scope = await this.scopeService.getScope(); // Lazy: DB nur bei erstem Zugriff

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
/** Prüft ob eine Org-Entity (Area/Dept/Team) im Scope liegt. Synchron, kein DB-Zugriff. */
private ensureOrgEntityInScope(
  scope: OrganizationalScope,
  entityType: 'area' | 'department' | 'team',
  entityId: number,
): void {
  if (scope.type === 'full') return;
  if (!HierarchyPermissionService.isEntityInScope(scope, entityType, entityId)) {
    throw new ForbiddenException('Entity is not in your organizational scope');
  }
}

/** Prüft ob ein User im Scope liegt. Async, braucht DB-Query für User→Team/Dept Zuordnung. */
private async ensureUserInScope(
  scope: OrganizationalScope,
  targetUserId: number,
  tenantId: number,
): Promise<void> {
  if (scope.type === 'full') return;
  const visibleUserIds = await this.hierarchyPermission.getVisibleUserIds(scope, tenantId);
  if (visibleUserIds === 'all') return;
  if (!visibleUserIds.includes(targetUserId)) {
    throw new ForbiddenException('User is not in your organizational scope');
  }
}
```

> **Warum zwei Methoden?** `isEntityInScope()` ist synchron (ID-Lookup in Arrays). Aber User→Scope-Check braucht eine DB-Query (`getVisibleUserIds()`) weil User über Junction-Tables (user_teams, user_departments) zugeordnet sind — die IDs stehen nicht im Scope-Objekt.

**Betroffene Methoden:**

| Methode               | Prüfung                                |
| --------------------- | -------------------------------------- |
| `updateUser()`        | `ensureUserInScope()` vor Update       |
| `deleteUser()`        | `ensureUserInScope()` vor Delete       |
| `getUserByUuid()`     | `ensureUserInScope()` vor Return       |
| User-Permissions Page | `ensureUserInScope()` vor Daten-Return |

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

### Step 2.5: BlackboardAccessService migrieren [PENDING]

**Geänderte Datei:** `backend/src/nest/blackboard/blackboard-access.service.ts`

> **Bestehender Consumer!** `BlackboardAccessService.validateOrgPermissions()` (Line 260-262) ruft alle drei `getAccessible*Ids()` Methoden auf. Muss auf `ScopeService.getScope()` migriert werden.

```typescript
// ALT (3 separate Queries):
const [accessibleAreas, accessibleDepts, accessibleTeams] = await Promise.all([
  this.hierarchyPermission.getAccessibleAreaIds(userId, tenantId),
  this.hierarchyPermission.getAccessibleDepartmentIds(userId, tenantId),
  this.hierarchyPermission.getAccessibleTeamIds(userId, tenantId),
]);

// NEU (1 Query, lazy cached):
const scope = await this.scopeService.getScope();
const accessibleAreas = scope.type === 'full' ? 'all' : scope.areaIds;
const accessibleDepts = scope.type === 'full' ? 'all' : scope.departmentIds;
const accessibleTeams = scope.type === 'full' ? 'all' : scope.teamIds;
```

**BlackboardModule** importiert `ScopeModule` statt `HierarchyPermissionModule`.

### Phase 2 — Definition of Done

- [ ] Alle 4 List-Methods scope-gefiltert (Areas, Departments, Teams, Users)
- [ ] Root / has_full_access sieht ALLES (Regression)
- [ ] Scoped Admin sieht nur seinen Scope
- [ ] Employee-Lead sieht nur seinen Lead-Scope
- [ ] Employee ohne Lead sieht leere Liste
- [ ] Mutations (update/delete) prüfen Scope (`ensureUserInScope` für Users, `ensureOrgEntityInScope` für Org-Entities)
- [ ] `role=admin/root` Listing nur für Root
- [ ] Scope-Info in User-List-Response
- [ ] BlackboardAccessService auf ScopeService migriert
- [ ] Bestehende Blackboard-Tests grün
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

### Step 3.1b: DB Migration — manage_hierarchy Addon [PENDING]

**Neue Datei:** `database/migrations/XXXXXX_manage-hierarchy-addon.ts`

> **Vereinfacht (D5):** Nur Addon-Eintrag. Keine Admin-Permission-Rows seeden. Root vergibt `manage_hierarchy` manuell auf der Permission-Seite. DB = Test-Daten, kein Prod-Migrationsproblem.

**Migration up:**

```sql
-- Addon registrieren (core, immer aktiv)
INSERT INTO addons (code, name, description, is_core, is_active, icon, sort_order)
VALUES ('manage_hierarchy', 'Organisationsstruktur', 'Verwaltung von Bereichen, Abteilungen, Teams und Mitarbeitern', true, 1, 'fa-sitemap', 50)
ON CONFLICT (code) DO NOTHING;
```

**Migration down:**

```sql
DELETE FROM user_addon_permissions WHERE addon_code = 'manage_hierarchy';
-- UPDATE statt DELETE: prevent_addons_delete Trigger blockt DELETE auf addons
UPDATE addons SET is_active = 0 WHERE code = 'manage_hierarchy';
```

**Test-Daten (manuell nach Migration, NICHT in Migration selbst):**

```sql
-- Nur für Dev/Test: Admin-Permissions manuell seeden
INSERT INTO user_addon_permissions (tenant_id, user_id, addon_code, module_code, can_read, can_write, can_delete, assigned_by)
SELECT u.tenant_id, u.id, 'manage_hierarchy', module.code, true, true, false, u.id
FROM users u
CROSS JOIN (VALUES ('manage-areas'), ('manage-departments'), ('manage-teams'), ('manage-employees')) AS module(code)
WHERE u.role = 'admin' AND u.is_active = 1 AND u.tenant_id IS NOT NULL
ON CONFLICT (tenant_id, user_id, addon_code, module_code) DO NOTHING;
```

> **Optional:** Dieses SQL kann als Seed-Datei abgelegt werden für einfaches Re-Seeding nach DB-Truncate.

- `ON CONFLICT DO NOTHING` = idempotent, sicher bei Re-Run

### Step 3.2: PermissionGuard — KEINE Änderung [ENTFÄLLT]

> **v0.5.0 (D6):** PermissionGuard bleibt **unverändert**. Kein invertiertes Default-Verhalten, kein Sonderfall.
>
> **Warum:** Auto-Seed bei Lead-Zuweisung (Step 3.4) erstellt Permission-Rows für Leads. Der Guard findet diese Rows → standard fail-closed → GRANT. Kein Sonder-Code nötig.
>
> ```
> Logik bleibt:
>   1. Kein @RequirePermission → pass
>   2. hasFullAccess → pass
>   3. DB-Lookup → grant/deny (fail-closed, EIN Verhalten für alle)
> ```

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

### Step 3.5: Auto-Seed/Cleanup bei Lead-Zuweisung (D6) [PENDING]

**Geänderte Datei:** `backend/src/nest/teams/teams.service.ts`

> **Prerequisite (v0.6.0):** `deputy_lead_id` existiert als DB-Spalte (Migration 028), aber kein Codepfad zum Setzen. Vor dem Auto-Seed muss in diesem Step:
>
> 1. `UpdateTeamDto` um `deputyLeaderId?: number | null` erweitern
> 2. `buildUpdateFields()` Mapping `deputyLeaderId → deputy_lead_id` hinzufügen
> 3. `validateLeader()` auch für Deputy aufrufen (Position = 'Teamleiter')
> 4. `TeamRow` + `TeamResponse` um `deputy_lead_id` / `deputyLeadId` erweitern
> 5. Controller: PUT /teams/:id akzeptiert `deputyLeaderId`

> **Kernidee:** Wenn ein Employee zum Team-Lead oder Deputy-Lead ernannt wird, erstellt das System automatisch `manage_hierarchy` Permission-Rows. Bei Entfernung als Lead → Cleanup (nur wenn kein anderes Team mehr geführt wird).

**Seed bei Lead-Zuweisung:**

```typescript
/** Wird aufgerufen in updateTeam() wenn team_lead_id oder deputy_lead_id sich ändert */
private async seedLeadPermissions(userId: number, tenantId: number, assignedBy: number): Promise<void> {
  const modules = ['manage-teams', 'manage-employees'];
  for (const moduleCode of modules) {
    await this.db.query(
      `INSERT INTO user_addon_permissions (tenant_id, user_id, addon_code, module_code, can_read, can_write, can_delete, assigned_by)
       VALUES ($1, $2, 'manage_hierarchy', $3, true, true, false, $4)
       ON CONFLICT (tenant_id, user_id, addon_code, module_code) DO NOTHING`,
      [tenantId, userId, moduleCode, assignedBy],
    );
  }
}
```

**Cleanup bei Lead-Entfernung:**

```typescript
/** Wird aufgerufen in updateTeam() wenn team_lead_id oder deputy_lead_id auf NULL/anderen User gesetzt wird */
private async cleanupLeadPermissions(userId: number, tenantId: number): Promise<void> {
  // Prüfen ob User noch Lead eines anderen Teams ist
  const remainingLeadships = await this.db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM teams
     WHERE (team_lead_id = $1 OR deputy_lead_id = $1)
       AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
    [userId, tenantId],
  );

  if (Number(remainingLeadships[0]?.count ?? 0) === 0) {
    // Kein Lead mehr → Permission-Rows löschen
    await this.db.query(
      `DELETE FROM user_addon_permissions
       WHERE user_id = $1 AND tenant_id = $2 AND addon_code = 'manage_hierarchy'`,
      [userId, tenantId],
    );
  }
}
```

**Integration in `updateTeam()`:**

```typescript
// In TeamsService.updateTeam():
const oldTeam = await this.getTeamById(teamId, tenantId);

// ... update query ...

// Lead-Change Detection:
if (oldTeam.teamLeadId !== dto.teamLeadId) {
  if (dto.teamLeadId !== null) await this.seedLeadPermissions(dto.teamLeadId, tenantId, currentUserId);
  if (oldTeam.teamLeadId !== null) await this.cleanupLeadPermissions(oldTeam.teamLeadId, tenantId);
}
if (oldTeam.deputyLeadId !== dto.deputyLeadId) {
  if (dto.deputyLeadId !== null) await this.seedLeadPermissions(dto.deputyLeadId, tenantId, currentUserId);
  if (oldTeam.deputyLeadId !== null) await this.cleanupLeadPermissions(oldTeam.deputyLeadId, tenantId);
}
```

> **ADR-020 Override:** Root kann einem Lead die Permissions auf der Permission-Seite entziehen (`can_read=false`). Der Auto-Seed überschreibt das NICHT (`ON CONFLICT DO NOTHING`). Erst wenn der Lead entfernt und neu zugewiesen wird, werden die Permissions zurückgesetzt.

### Phase 3 — Definition of Done

- [ ] `manage_hierarchy` Permission-Kategorie registriert
- [ ] DB Migration: `manage_hierarchy` in `addons`-Tabelle (is_core=true, NUR Addon-Eintrag)
- [ ] PermissionGuard: KEINE Änderung (bleibt fail-closed, D6)
- [ ] Auto-Seed bei Lead-Zuweisung in TeamsService implementiert
- [ ] Auto-Cleanup bei Lead-Entfernung implementiert (mit Multi-Team-Check)
- [ ] ADR-020 Override funktioniert (Root entzieht Lead Permissions, Auto-Seed überschreibt NICHT)
- [ ] GET/PUT Endpoints erlauben Employee-Rolle (mit Permission-Check)
- [ ] POST/DELETE Endpoints bleiben Admin/Root only
- [ ] Root/Admin Zugriffe unverändert (Regression)
- [ ] Test-SQL für Dev-Admin-Permissions dokumentiert
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

### Step 4.2: Auto-Seed/Cleanup Tests [PENDING]

**Mindestens 8 Szenarien:**

| #   | Szenario                                                      | Erwartung                                    |
| --- | ------------------------------------------------------------- | -------------------------------------------- |
| 1   | Employee wird team_lead → Permission-Rows existieren          | manage-teams + manage-employees canRead=true |
| 2   | Employee wird deputy_lead → Permission-Rows existieren        | manage-teams + manage-employees canRead=true |
| 3   | Lead wird entfernt (kein anderes Team) → Rows gelöscht        | Keine manage_hierarchy Rows mehr             |
| 4   | Lead wird entfernt (führt noch anderes Team) → Rows bleiben   | manage_hierarchy Rows bleiben                |
| 5   | Root setzt canRead=false → Auto-Seed überschreibt NICHT       | ON CONFLICT DO NOTHING, canRead bleibt false |
| 6   | Lead entfernt + neu zugewiesen → Permissions zurückgesetzt    | Neue Rows mit canRead=true                   |
| 7   | Admin mit manage_hierarchy Permission → PermissionGuard GRANT | Standard fail-closed findet Row              |
| 8   | Admin ohne manage_hierarchy Permission → PermissionGuard DENY | Standard fail-closed, kein Row → DENY        |

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
| `(admin)/manage-dummies/`     | `(root)/manage-dummies/`       | Root-only (D7)        |

> **Nicht migriert:** manage-halls (bleibt admin), manage-assets (bleibt admin, D8).
> **URLs bleiben identisch.** Route Groups in SvelteKit beeinflussen nicht die URL.

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

**orgScope wird per SSR geladen.** Für Root/has_full_access ist die Backend-Query billig (< 1ms, early return type:'full').

### Phase 5 — Definition of Done

- [ ] 4 Route-Ordner nach (shared) verschoben
- [ ] manage-admins + manage-dummies nach (root) verschoben
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
- Decision: HierarchyPermissionService.getScope() + Unified CTE + ScopeService (Lazy/CLS) + Auto-Seed bei Lead-Zuweisung (fail-closed)
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

| Session | Phase | Beschreibung                                                                                | Status | Datum |
| ------- | ----- | ------------------------------------------------------------------------------------------- | ------ | ----- |
| 1       | 1     | Types + HierarchyPermissionService.getScope() + Unified CTE + ScopeService (Lazy)           |        |       |
| 2       | 1     | Endpoint /users/me/org-scope + KVP Refactoring (EXTENDED_ORG_INFO_QUERY → ScopeService)     |        |       |
| 3       | 2     | List-Method Scope-Filtering (Areas, Departments, Teams) + BlackboardAccessService Migration |        |       |
| 4       | 2     | User-List Scope + ensureUserInScope/ensureOrgEntityInScope + Scope-Info Response            |        |       |
| 5       | 3     | Permission Registry + Migration + Auto-Seed/Cleanup bei Lead-Zuweisung + Controller @Roles  |        |       |
| 6       | 4     | Unit Tests (Scope, Auto-Seed/Cleanup, Services)                                             |        |       |
| 7       | 5     | Route Migration (4→shared, 2→root) + Layout Data + Access Checks                            |        |       |
| 8       | 6     | Navigation Config + Filter Pipeline + ScopeInfoBanner                                       |        |       |
| 9       | 6+7   | Manage-Seiten Lead-View + API Integration Tests                                             |        |       |
| 10      | 8     | ADR-036 + Docs + Smoke Tests + Polish                                                       |        |       |

---

## Quick Reference: File Paths

### Backend (neu)

| Datei                                                                          | Zweck                                        |
| ------------------------------------------------------------------------------ | -------------------------------------------- |
| `backend/src/nest/hierarchy-permission/organizational-scope.types.ts`          | OrganizationalScope Interface                |
| `backend/src/nest/hierarchy-permission/scope.service.ts`                       | Lazy Scope-Auflösung mit CLS-Cache           |
| `backend/src/nest/hierarchy-permission/scope.module.ts`                        | ScopeModule (exportiert ScopeService)        |
| `backend/src/nest/common/permissions/manage-hierarchy.permissions.ts`          | Permission-Kategorie                         |
| `backend/src/nest/common/permissions/manage-hierarchy-permission.registrar.ts` | Registrar                                    |
| `database/migrations/XXXXXX_manage-hierarchy-addon.ts`                         | Addon-Eintrag (nur is_core, keine User-Rows) |
| `backend/test/org-scope.api.test.ts`                                           | API Integration Tests                        |

### Backend (geändert)

| Datei                                                                   | Änderung                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| `backend/src/nest/hierarchy-permission/hierarchy-permission.service.ts` | `getScope()` + Unified CTE + `getVisibleUserIds()`           |
| `backend/src/nest/blackboard/blackboard-access.service.ts`              | Migration: `getAccessible*Ids()` → `ScopeService.getScope()` |
| `backend/src/nest/blackboard/blackboard.module.ts`                      | Import: `HierarchyPermissionModule` → `ScopeModule`          |
| `backend/src/nest/teams/teams.service.ts`                               | Auto-Seed/Cleanup bei Lead-Zuweisung                         |
| `backend/src/nest/areas/areas.controller.ts`                            | @Roles + @RequirePermission                                  |
| `backend/src/nest/departments/departments.controller.ts`                | @Roles + @RequirePermission                                  |
| `backend/src/nest/teams/teams.controller.ts`                            | @Roles + @RequirePermission                                  |
| `backend/src/nest/users/users.controller.ts`                            | Neuer Endpoint + @Roles                                      |
| `backend/src/nest/areas/areas.service.ts`                               | Scope-Filterung (liest aus CLS)                              |
| `backend/src/nest/departments/departments.service.ts`                   | Scope-Filterung (liest aus CLS)                              |
| `backend/src/nest/teams/teams.service.ts`                               | Scope-Filterung (liest aus CLS)                              |
| `backend/src/nest/users/users.service.ts`                               | Scope-Filterung + Mutation-Checks + Role-Restriction         |
| `backend/src/nest/kvp/kvp.service.ts`                                   | Refactored → nutzt `HierarchyPermissionService.getScope()`   |

### Frontend (verschoben)

| Von                           | Nach                           |
| ----------------------------- | ------------------------------ |
| `(admin)/manage-areas/`       | `(shared)/manage-areas/`       |
| `(admin)/manage-departments/` | `(shared)/manage-departments/` |
| `(root)/manage-teams/`        | `(shared)/manage-teams/`       |
| `(admin)/manage-employees/`   | `(shared)/manage-employees/`   |
| `(admin)/manage-admins/`      | `(root)/manage-admins/`        |
| `(admin)/manage-dummies/`     | `(root)/manage-dummies/`       |

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
10. **Deputy = Lead (hart)**: In V1 hat `deputy_lead_id` immer identische Rechte wie `team_lead_id`. Per-Tenant-Setting geplant für V2 (Flag: `DEPUTY_EQUALS_LEAD`)
11. **Neue Admins brauchen manuelle Permission-Vergabe**: Root muss `manage_hierarchy` Permissions explizit vergeben. Kein Auto-Grant bei Admin-Erstellung
12. **Kein Scope-Filter in Dropdowns (V1)**: Create-Forms (z.B. neuen Employee erstellen) zeigen alle Entities in Dropdowns, nicht nur scoped. Backend-Scope-Filter fängt ungültige Zuweisungen ab

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
- Auto-Seed bei Lead-Zuweisung mit ADR-020 Override (fail-closed)
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
- **Bestehende getAccessible\*Ids() deprecated** — durch unified `getScope()` mit Lead-Support (BlackboardAccessService migriert)
- **Eine CTE statt zwei** — alle Zugriffspfade (Permissions + Leads) in einer Query
- **Ein Filter-Pfad pro Service** statt zwei separate (Admin vs Employee)
- **ScopeService (Lazy)** statt ScopeGuard (APP_GUARD) — kein DB-Overhead für ~90% der Requests
- **Fail-Closed überall** — Auto-Seed bei Lead-Zuweisung statt invertierter Guard-Logik (D6)
- **Admin braucht explizite Permission** — Root vergibt manuell, kein Auto-Grant (D5)
- **manage-employees → (shared)** statt in (admin) zu bleiben (Plan 2 Abweichung)
- **manage-dummies → (root)** (D7)
- **D1=NEIN** — Employee-Leads nur Team-Level (Plan 1 wollte Area/Dept öffnen)
- **D4=Deputy=Lead** — mit DEPUTY_EQUALS_LEAD Flag für V2 Settings-Toggle
- **ADR-036** statt zwei konkurrierende ADR-035s

---

**Dieses Dokument ist der Execution Plan. Jede Session startet hier,
nimmt das nächste unchecked Item, und markiert es als done.**
