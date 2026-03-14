# FEAT: User Scope Filtering — Execution Masterplan

> **Created:** 2026-03-13
> **Version:** 0.1.0 (Draft)
> **Status:** DRAFT — Phase 0 (Planung)
> **Branch:** `feat/user-scope-filtering` (empfohlen)
> **Author:** SCS Technik (Senior Engineer)
> **Estimated Sessions:** 5
> **Actual Sessions:** 0 / 5

---

## Changelog

| Version | Datum      | Änderung                           |
| ------- | ---------- | ---------------------------------- |
| 0.1.0   | 2026-03-13 | Initial Draft — Phasen 1-5 geplant |

---

## Problem Statement

Die Manage-Seiten (`manage-employees`, `manage-admins`) laden **ALLE User** des Tenants — unabhängig davon, welchen hierarchischen Scope der anfragende Admin hat.

| Szenario                                       | Ist-Zustand                    | Soll-Zustand                                        |
| ---------------------------------------------- | ------------------------------ | --------------------------------------------------- |
| Admin ist `area_lead_id` für Area 2            | Sieht ALLE Employees im Tenant | Sieht nur Employees in Area 2 (Departments + Teams) |
| Admin hat `admin_dept_permissions` für Dept 11 | Sieht ALLE Employees           | Sieht nur Employees in Dept 11 + dessen Teams       |
| Admin hat `has_full_access=true`               | Sieht alles                    | Sieht alles (keine Änderung)                        |
| Root-User                                      | Sieht alles                    | Sieht alles (keine Änderung)                        |
| Admin öffnet manage-admins                     | Sieht alle Admins              | **Kein Zugang mehr** (root-only)                    |

### Architektur-Lücke

`HierarchyPermissionService` existiert und hat die richtigen Methoden (`getAccessibleAreaIds`, `getAccessibleDepartmentIds`, `getAccessibleTeamIds`). **Aber:** `UsersService.listUsers()` nutzt sie nicht. Die User-Liste wird ausschließlich per `tenant_id` gefiltert.

Bestehende Services (Blackboard, Survey, Calendar) wenden Scope-Filtering bereits an — dieses Feature schließt die Lücke für User-Listen.

---

## Lösung: Backend Scope Filtering (KISS)

**Kein Cascade-Filter. Kein RLS-Umbau. Kein neues Frontend-Component für Filter.**

```
┌──────────────────────────────────────────────────────────────┐
│ GET /users?role=employee                                     │
│                                                              │
│  1. Root / has_full_access?  → JA: Kein Filter               │
│                              → NEIN: ↓                       │
│                                                              │
│  2. getVisibleUserIds(requestingUserId, tenantId)            │
│     → CTE: accessible_depts + accessible_teams               │
│     → SELECT u.id WHERE user in scope                        │
│     → [42, 87, 103, 155, ...]                                │
│                                                              │
│  3. WHERE ... AND u.id = ANY($visibleUserIds)                │
│     → Tabelle zeigt nur User im Scope. Sofort. Ohne Filter.  │
└──────────────────────────────────────────────────────────────┘
```

**Frontend-Änderungen: Minimal.** Backend liefert die richtigen Daten → Tabelle rendert sie.

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (alle Container healthy)
- [ ] Keine pending Migrations
- [ ] Bestehende Tests grün: `pnpm run test:api` + `pnpm run test:unit`
- [ ] `HierarchyPermissionService` funktioniert korrekt (getAccessibleAreaIds, etc.)

### 0.2 Risk Register

| #   | Risiko                                             | Impact  | Wahrscheinlichkeit | Mitigation                                                                 | Verifikation                                                           |
| --- | -------------------------------------------------- | ------- | ------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| R1  | Scope-Filter bricht Root/has_full_access           | Hoch    | Niedrig            | Early return `'all'` vor jedem Filter                                      | API-Test: Root sieht ALLE User                                         |
| R2  | `getAccessibleAreaIds()` ignoriert Lead-Positionen | Hoch    | Hoch               | Eigene CTE die ALLE Pfade abdeckt (permissions + lead_id)                  | Unit-Test: area_lead sieht User in seiner Area                         |
| R3  | Move manage-admins → (root) bricht Admin-Workflows | Mittel  | Niedrig            | Verify: Admins nutzen manage-admins nur lesend, CRUD ist bereits root-only | Manueller Test: Admin-Navigation enthält kein manage-admins            |
| R4  | Dropdown-Scoping bricht andere Module              | Hoch    | Mittel             | Scope nur wenn requesting user NICHT root/has_full_access ist              | Test: Root sieht alle Areas/Departments/Teams in Dropdowns             |
| R5  | Admin ohne Scope sieht leere Tabelle (verwirrend)  | Niedrig | Mittel             | Scope-Info-Banner erklärt was der User sieht                               | Manueller Test: Banner zeigt "Kein Zugriff auf Organisationseinheiten" |
| R6  | Performance: Extra Query pro Request               | Niedrig | Niedrig            | Tenant-Größe 50-500 Employees; CTE-Query < 10ms                            | Response-Time-Check vorher/nachher                                     |

### 0.3 Ecosystem Integration Points

| Bestehendes System                                            | Art der Integration                        | Phase |
| ------------------------------------------------------------- | ------------------------------------------ | ----- |
| `HierarchyPermissionService`                                  | Neue Methode `getVisibleUserIds()`         | 1     |
| `UsersService.listUsers()`                                    | Scope-Filter in WHERE-Clause               | 1     |
| `UsersController`                                             | Role-Check für `role=admin/root` Listing   | 1     |
| `AreasController`, `DepartmentsController`, `TeamsController` | Scope-Filter auf GET-Endpoints             | 2     |
| `UsersController` (PUT, DELETE)                               | Scope-Check vor Mutation                   | 2     |
| `(admin)/manage-admins/` Route                                | Move zu `(root)/`                          | 3     |
| `navigation-config.ts`                                        | manage-admins aus Admin-Menü entfernen     | 3     |
| `Breadcrumb.svelte`                                           | Keine Änderung nötig (URLs bleiben gleich) | —     |

---

## Phase 1: Backend — Core Scope Filtering

> **Abhängigkeit:** Keine
> **Dateien:** 3 geändert

### Step 1.1: `getVisibleUserIds()` in HierarchyPermissionService [TODO]

**Datei:** `backend/src/nest/hierarchy-permission/hierarchy-permission.service.ts`

**Neue Methode:**

```typescript
async getVisibleUserIds(
  requestingUserId: number,
  tenantId: number,
): Promise<number[] | 'all'>
```

**Warum eine neue Methode statt bestehende zu nutzen?**

Die bestehenden `getAccessibleAreaIds()` / `getAccessibleDepartmentIds()` prüfen NUR `admin_area_permissions` / `admin_department_permissions`. Sie ignorieren **Lead-Positionen** (`area_lead_id`, `department_lead_id`, `team_lead_id`). Für User-Sichtbarkeit müssen ALLE Zugriffspfade berücksichtigt werden.

**SQL-Logik (Single CTE Query):**

```sql
-- Step 1: Alle Departments im Scope des anfragenden Admins
WITH accessible_depts AS (
  -- Pfad 1: admin_area_permissions → alle Departments in diesen Areas
  SELECT d.id FROM departments d
  JOIN admin_area_permissions aap ON aap.area_id = d.area_id
  WHERE aap.admin_user_id = $1 AND aap.tenant_id = $2
  UNION
  -- Pfad 2: area_lead_id → alle Departments in geführten Areas
  SELECT d.id FROM departments d
  JOIN areas a ON a.id = d.area_id
  WHERE a.area_lead_id = $1 AND a.tenant_id = $2
  UNION
  -- Pfad 3: admin_department_permissions → direkt
  SELECT adp.department_id FROM admin_department_permissions adp
  WHERE adp.admin_user_id = $1 AND adp.tenant_id = $2
  UNION
  -- Pfad 4: department_lead_id → direkt
  SELECT d.id FROM departments d
  WHERE d.department_lead_id = $1 AND d.tenant_id = $2
),
accessible_teams AS (
  -- Teams in zugänglichen Departments
  SELECT t.id FROM teams t
  WHERE t.department_id IN (SELECT id FROM accessible_depts) AND t.tenant_id = $2
  UNION
  -- Team-Lead
  SELECT t.id FROM teams t
  WHERE t.team_lead_id = $1 AND t.tenant_id = $2
)

-- Step 2: Alle User im Scope
SELECT u.id FROM users u
WHERE u.tenant_id = $2 AND u.is_active != 4 AND (
  -- Direkte Department-Zuordnung
  u.department_id IN (SELECT id FROM accessible_depts)
  -- Department-Membership (N:M)
  OR EXISTS (SELECT 1 FROM user_departments ud
             WHERE ud.user_id = u.id AND ud.department_id IN (SELECT id FROM accessible_depts))
  -- Team-Membership
  OR EXISTS (SELECT 1 FROM user_teams ut
             WHERE ut.user_id = u.id AND ut.team_id IN (SELECT id FROM accessible_teams))
)
```

**Wichtig:** Root / `has_full_access` → sofort `'all'` returnen (kein Query).

### Step 1.2: Integration in `UsersService.listUsers()` [TODO]

**Datei:** `backend/src/nest/users/users.service.ts`

**Was passiert:**

1. `HierarchyPermissionService` als Dependency injizieren
2. In `listUsers()`: Requesting User aus CLS lesen
3. `getVisibleUserIds()` aufrufen
4. Wenn nicht `'all'`: `AND u.id = ANY($N)` an WHERE-Clause anhängen

**Änderung (~10 Zeilen):**

```typescript
// Nach buildUserListWhereClause():
const visibleIds = await this.hierarchyPermission.getVisibleUserIds(requestingUser.id, tenantId);

if (visibleIds !== 'all') {
  if (visibleIds.length === 0) {
    return { data: [], total: 0, page, limit }; // Kein Scope = leere Liste
  }
  whereClause += ` AND u.id = ANY($${paramIndex})`;
  params.push(visibleIds);
  paramIndex++;
}
```

### Step 1.3: Restrict `role=admin/root` Listing to Root Only [TODO]

**Datei:** `backend/src/nest/users/users.service.ts` (oder `users.controller.ts`)

**Was passiert:**

Wenn `query.role` = `'admin'` oder `'root'`, muss der anfragende User Root sein. Sonst → `ForbiddenException`.

```typescript
if ((query.role === 'admin' || query.role === 'root') && requestingUser.role !== 'root') {
  throw new ForbiddenException('Only root users can list admins/root users');
}
```

**Warum im Service statt Controller?** Der Controller hat `@Roles('admin', 'root')` — das erlaubt Admins den Endpoint zu nutzen (für Employees). Die Einschränkung auf `role=admin/root` ist eine Business Rule, gehört in den Service.

### Phase 1 — Definition of Done

- [ ] `getVisibleUserIds()` implementiert mit CTE-Query (alle 4 Pfade + Team-Lead)
- [ ] Root / `has_full_access` → `'all'` (kein Filter)
- [ ] `listUsers()` nutzt Scope-Filter
- [ ] `role=admin/root` Listing nur für Root-User
- [ ] Leerer Scope → leere Liste (nicht Exception)
- [ ] ESLint 0 Errors: `docker exec assixx-backend pnpm exec eslint backend/src/nest/hierarchy-permission/ backend/src/nest/users/`
- [ ] Type-Check passed: `docker exec assixx-backend pnpm run type-check`
- [ ] Bestehende API-Tests grün

---

## Phase 2: Backend — Mutation & Dropdown Scoping

> **Abhängigkeit:** Phase 1 complete
> **Dateien:** 4-5 geändert

### Step 2.1: Scope-Check für User Mutations [TODO]

**Dateien:** `backend/src/nest/users/users.service.ts`

**Was passiert:**

Vor `updateUser()` und `deleteUser()`: Prüfen ob der Ziel-User im Scope des anfragenden Users liegt.

```typescript
private async ensureUserInScope(
  requestingUser: NestAuthUser,
  targetUserId: number,
  tenantId: number,
): Promise<void> {
  if (requestingUser.role === 'root' || requestingUser.hasFullAccess) return;

  const visibleIds = await this.hierarchyPermission.getVisibleUserIds(
    requestingUser.id, tenantId,
  );
  if (visibleIds !== 'all' && !visibleIds.includes(targetUserId)) {
    throw new ForbiddenException('User is not in your scope');
  }
}
```

**Betroffene Methoden:**

| Methode                            | Prüfung                          |
| ---------------------------------- | -------------------------------- |
| `updateUser()`                     | `ensureUserInScope()` vor Update |
| `deleteUser()`                     | `ensureUserInScope()` vor Delete |
| `getUserByUuid()` (einzelner User) | `ensureUserInScope()` vor Return |

### Step 2.2: Scope-Check für Permission Page [TODO]

**Datei:** `backend/src/nest/user-permissions/user-permissions.controller.ts` (oder Service)

**Was passiert:**

`GET /user-permissions/:uuid` — Prüfen ob der Ziel-User im Scope liegt. Sonst → 403.

### Step 2.3: Scope-Filter für Dropdown-Endpoints [TODO]

**Dateien:**

- `backend/src/nest/areas/areas.service.ts`
- `backend/src/nest/departments/departments.service.ts`
- `backend/src/nest/teams/teams.service.ts`

**Was passiert:**

Requesting User aus CLS lesen. Root / `has_full_access` → alle zurückgeben. Sonst → nur zugängliche.

**Pattern (gleich für alle drei):**

```typescript
// areas.service.ts
async listAreas(tenantId: number): Promise<AreaResponse[]> {
  const user = this.cls.get('userId');
  const role = this.cls.get('userRole');

  // Root / full access: alle
  if (role === 'root') {
    return this.getAllAreas(tenantId);
  }

  // Scoped: nur zugängliche Areas
  const accessibleAreaIds = await this.hierarchyPermission
    .getAccessibleAreaIds(user, tenantId);
  // + area_lead_id Check (fehlt in getAccessibleAreaIds!)
  return this.getAreasByIds(tenantId, accessibleAreaIds);
}
```

**Kritisch (R4):** Dropdown-Scoping darf andere Module NICHT brechen. Die Endpoints `GET /areas`, `GET /departments`, `GET /teams` werden von vielen Pages genutzt (manage-halls, organigram, survey, etc.). Scope-Filtering ist nur korrekt wenn diese Pages auch den anfragenden User per CLS kennen — was der Fall ist (JwtAuthGuard setzt CLS immer).

**Verifikation:** Alle Pages die diese Endpoints nutzen müssen nach der Änderung getestet werden.

### Step 2.4: Scope-Info als Response-Metadata [TODO]

**Datei:** `backend/src/nest/users/users.service.ts`

**Was passiert:**

Bei scoped Responses: Zusätzlich die Scope-Info zurückgeben (welche Areas/Departments sind zugänglich). Das Frontend kann daraus ein Info-Banner bauen.

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

- [ ] Mutations (update, delete) prüfen Scope vor Ausführung
- [ ] Permission-Page prüft Scope vor Daten-Return
- [ ] `GET /areas` gibt nur zugängliche Areas zurück (scoped admin)
- [ ] `GET /departments` gibt nur zugängliche Departments zurück
- [ ] `GET /teams` gibt nur zugängliche Teams zurück
- [ ] Root / `has_full_access` sieht weiterhin ALLES in Dropdowns
- [ ] Scope-Info in User-List-Response enthalten
- [ ] ESLint 0 Errors
- [ ] Type-Check passed
- [ ] Bestehende API-Tests grün (keine Regression in areas/departments/teams)

---

## Phase 3: Tests

> **Abhängigkeit:** Phase 2 complete
> **Dateien:** 2 neue Test-Dateien, 1 geändert

### Step 3.1: Unit Tests für `getVisibleUserIds()` [TODO]

**Datei:** `backend/src/nest/hierarchy-permission/hierarchy-permission.service.test.ts` (neu oder erweitern)

**Test-Szenarien (mind. 12 Tests):**

| #   | Szenario                                                          | Erwartung                         |
| --- | ----------------------------------------------------------------- | --------------------------------- |
| 1   | Root-User                                                         | `'all'`                           |
| 2   | Admin mit `has_full_access=true`                                  | `'all'`                           |
| 3   | Admin mit `admin_area_permissions` für Area 2                     | Nur User in Area-2-Departments    |
| 4   | Admin als `area_lead_id` für Area 2 (OHNE admin_area_permissions) | Nur User in Area-2-Departments    |
| 5   | Admin mit `admin_department_permissions` für Dept 11              | Nur User in Dept 11 + Teams       |
| 6   | Admin als `department_lead_id` für Dept 11                        | Nur User in Dept 11 + Teams       |
| 7   | Admin als `team_lead_id` für Team 7                               | Nur User in Team 7                |
| 8   | Admin ohne jegliche Permissions/Lead                              | `[]` (leeres Array)               |
| 9   | Admin mit Area 2 + Dept 15 (verschiedene Areas)                   | Union beider Scopes               |
| 10  | User in Team aber NICHT in user_departments                       | Trotzdem sichtbar (via Team-Pfad) |
| 11  | Employee ohne Department/Team-Zuordnung                           | NICHT sichtbar (kein Scope-Match) |
| 12  | Tenant-Isolation: User aus Tenant B                               | NICHT sichtbar                    |

### Step 3.2: API Integration Tests [TODO]

**Datei:** `backend/test/user-scope.api.test.ts` (neu)

**Test-Szenarien (mind. 10 Tests):**

| #   | Szenario                                    | Endpoint                   | Erwartung                 |
| --- | ------------------------------------------- | -------------------------- | ------------------------- |
| 1   | Root listet alle Employees                  | `GET /users?role=employee` | 200, alle Employees       |
| 2   | Scoped Admin listet Employees               | `GET /users?role=employee` | 200, nur scoped Employees |
| 3   | Admin versucht `role=admin` Listing         | `GET /users?role=admin`    | 403                       |
| 4   | Admin versucht `role=root` Listing          | `GET /users?role=root`     | 403                       |
| 5   | Root listet Admins                          | `GET /users?role=admin`    | 200, alle Admins          |
| 6   | Scoped Admin editiert User in Scope         | `PUT /users/:id`           | 200                       |
| 7   | Scoped Admin editiert User AUSSERHALB Scope | `PUT /users/:id`           | 403                       |
| 8   | Scoped Admin sieht nur scoped Areas         | `GET /areas`               | 200, nur zugängliche      |
| 9   | Scoped Admin sieht nur scoped Teams         | `GET /teams`               | 200, nur zugängliche      |
| 10  | Root sieht alle Areas                       | `GET /areas`               | 200, alle                 |

### Step 3.3: Bestehende Tests anpassen [TODO]

**Datei:** `backend/test/users.api.test.ts` (bestehend)

**Was passiert:**

- Tests laufen als `admin@apitest.de` (root-Rolle) → sollten weiterhin alle User sehen
- Prüfen ob bestehende Assertions noch gelten
- Ggf. Test-Setup erweitern wenn apitest-User kein root ist

### Phase 3 — Definition of Done

- [ ] > = 12 Unit Tests für `getVisibleUserIds()`
- [ ] > = 10 API Integration Tests für Scope-Filtering
- [ ] Alle bestehenden Tests grün (keine Regression)
- [ ] Tenant-Isolation verifiziert
- [ ] Lead-Position-Pfade getestet (area_lead, department_lead, team_lead)
- [ ] Edge Case: Admin ohne Scope → leere Liste (kein Error)

---

## Phase 4: Frontend — Route Restructuring + Scope Banner

> **Abhängigkeit:** Phase 1 complete (Backend-Scoping aktiv)
> **Dateien:** ~8 geändert/verschoben

### Step 4.1: manage-admins von `(admin)` nach `(root)` verschieben [TODO]

**Aktuell:** `frontend/src/routes/(app)/(admin)/manage-admins/`
**Neu:** `frontend/src/routes/(app)/(root)/manage-admins/`

**Was wird verschoben:**

```
(admin)/manage-admins/
├── +page.server.ts
├── +page.svelte
├── _lib/ (11 Dateien)
├── availability/[uuid]/ (2 Dateien)
└── permission/[uuid]/ (2 Dateien)
```

**Warum?** manage-admins soll nur Root-Usern zugänglich sein. Die `(root)` Route-Group hat einen Layout-Guard der automatisch non-root User redirected. Kein zusätzlicher Code nötig.

**Kritisch:** URLs bleiben identisch (`/manage-admins/...`). Kein Breaking Change für Bookmarks.

### Step 4.2: Navigation Config anpassen [TODO]

**Datei:** `frontend/src/routes/(app)/_lib/navigation-config.ts`

**Was passiert:**

1. `manage-admins` NavItem aus dem Admin-Menü entfernen
2. `manage-admins` NavItem ins Root-Menü verschieben (falls nicht schon dort)
3. Hierarchy Labels beachten (ADR-034)

### Step 4.3: Scope-Info-Banner Component [TODO]

**Neue Datei:** `frontend/src/lib/components/ScopeInfoBanner.svelte`

**Was es zeigt (für scoped Admins auf manage-employees):**

```
┌──────────────────────────────────────────────────────────┐
│ ℹ Du siehst Mitarbeiter in: Produktionshalle Nord,       │
│   Lager Süd (inkl. alle [Abteilungen] und [Teams])       │
└──────────────────────────────────────────────────────────┘
```

- Labels aus `hierarchyLabels` (ADR-034): "[Abteilungen]" → `labels.department`, "[Teams]" → `labels.team`
- Root / `has_full_access` → Kein Banner (sieht alles)
- Admin ohne Scope → "Du hast keinen Zugriff auf Organisationseinheiten. Kontaktiere deinen Administrator."

**Props:**

```typescript
interface Props {
  scope: { type: 'full' | 'limited'; areaNames?: string[]; departmentNames?: string[] };
  hierarchyLabels: HierarchyLabels;
}
```

### Step 4.4: manage-employees — Banner integrieren [TODO]

**Datei:** `frontend/src/routes/(app)/(admin)/manage-employees/+page.svelte`

**Was passiert:**

1. `scope` aus `data` lesen (kommt vom Backend, Phase 2 Step 2.4)
2. `<ScopeInfoBanner>` über der Tabelle rendern
3. Fertig — die Tabelle zeigt automatisch die richtigen Daten

### Phase 4 — Definition of Done

- [ ] manage-admins liegt in `(root)` Route-Group
- [ ] Admin-User sieht manage-admins NICHT in der Navigation
- [ ] Root-User sieht manage-admins weiterhin
- [ ] URLs unverändert (`/manage-admins/...`)
- [ ] ScopeInfoBanner-Component erstellt
- [ ] manage-employees zeigt Scope-Banner für scoped Admins
- [ ] Kein Banner für Root / `has_full_access`
- [ ] svelte-check 0 Errors
- [ ] ESLint 0 Errors

---

## Phase 5: Documentation + Polish

> **Abhängigkeit:** Phase 4 complete

### Step 5.1: ADR erstellen [TODO]

**Datei:** `docs/infrastructure/adr/ADR-035-user-scope-filtering.md`

**Inhalt:**

- Context: Manage-Seiten laden alle User ohne Scope-Filterung
- Decision: Backend-side Scope-Filtering via `getVisibleUserIds()`
- Alternatives: Cascade-Filter (rejected), RLS-Umbau (rejected), Frontend-only Filter (rejected)
- Consequences: Positive (sicher, KISS), Negative (Extra Query pro Request)

### Step 5.2: ADR-010 aktualisieren [TODO]

**Datei:** `docs/infrastructure/adr/ADR-010-user-role-assignment-permissions.md`

**Was passiert:**

- Referenz auf ADR-035 hinzufügen
- "User Listing Scope Filtering" als implementierten Aspekt dokumentieren
- manage-admins als root-only dokumentieren

### Step 5.3: Smoke Test [TODO — User-Aufgabe]

1. Als scoped Admin einloggen (nur Area 2 Permission)
2. manage-employees öffnen → nur Employees in Area 2 sichtbar
3. Scope-Banner zeigt korrekte Info
4. Dropdowns zeigen nur zugängliche Areas/Departments/Teams
5. Employee editieren → funktioniert (in Scope)
6. Als Root einloggen → alles sichtbar, kein Banner
7. manage-admins → nur als Root erreichbar

### Phase 5 — Definition of Done

- [ ] ADR-035 geschrieben
- [ ] ADR-010 aktualisiert
- [ ] Smoke Test bestanden (User-Aufgabe)
- [ ] Keine offenen TODOs im Code

---

## Session Tracking

| Session | Phase | Beschreibung                                                                   | Status | Datum |
| ------- | ----- | ------------------------------------------------------------------------------ | ------ | ----- |
| 1       | 1     | Backend Core: `getVisibleUserIds()` + listUsers Integration + Role Restriction |        |       |
| 2       | 2     | Backend Scoping: Mutations + Dropdowns + Scope-Info Response                   |        |       |
| 3       | 3     | Tests: Unit (12+) + API Integration (10+)                                      |        |       |
| 4       | 4     | Frontend: Route Move + Nav Config + Scope Banner                               |        |       |
| 5       | 5     | ADR + Docs + Polish                                                            |        |       |

---

## Quick Reference: File Paths

### Backend (geändert)

| Datei                                                                   | Änderung                                        |
| ----------------------------------------------------------------------- | ----------------------------------------------- |
| `backend/src/nest/hierarchy-permission/hierarchy-permission.service.ts` | Neue Methode `getVisibleUserIds()`              |
| `backend/src/nest/users/users.service.ts`                               | Scope-Filter in `listUsers()` + Mutation-Checks |
| `backend/src/nest/users/users.controller.ts`                            | Ggf. CLS-User an Service durchreichen           |
| `backend/src/nest/areas/areas.service.ts`                               | Scope-Filter auf `listAreas()`                  |
| `backend/src/nest/departments/departments.service.ts`                   | Scope-Filter auf `listDepartments()`            |
| `backend/src/nest/teams/teams.service.ts`                               | Scope-Filter auf `listTeams()`                  |

### Backend (neu)

| Datei                                                                        | Zweck                           |
| ---------------------------------------------------------------------------- | ------------------------------- |
| `backend/test/user-scope.api.test.ts`                                        | API Integration Tests           |
| `backend/src/nest/hierarchy-permission/hierarchy-permission.service.test.ts` | Unit Tests (neu oder erweitert) |

### Frontend (verschoben)

| Von                                                | Nach                                              |
| -------------------------------------------------- | ------------------------------------------------- |
| `frontend/src/routes/(app)/(admin)/manage-admins/` | `frontend/src/routes/(app)/(root)/manage-admins/` |

### Frontend (neu)

| Datei                                                | Zweck             |
| ---------------------------------------------------- | ----------------- |
| `frontend/src/lib/components/ScopeInfoBanner.svelte` | Scope-Info-Banner |

### Frontend (geändert)

| Datei                                                             | Änderung                       |
| ----------------------------------------------------------------- | ------------------------------ |
| `frontend/src/routes/(app)/_lib/navigation-config.ts`             | manage-admins nur im Root-Menü |
| `frontend/src/routes/(app)/(admin)/manage-employees/+page.svelte` | ScopeInfoBanner integrieren    |

### Dokumentation (neu)

| Datei                                                     | Zweck                   |
| --------------------------------------------------------- | ----------------------- |
| `docs/infrastructure/adr/ADR-035-user-scope-filtering.md` | Architekturentscheidung |

---

## Spec Deviations

| #   | Ursprüngliche Idee                              | Tatsächliche Entscheidung                                | Begründung                                                         |
| --- | ----------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| D1  | Cascade-Filter (Area → Dept → Team) im Frontend | Backend Scope Filtering, kein Frontend-Filter            | KISS — Backend liefert sofort die richtigen Daten                  |
| D2  | RLS-Umbau für intra-tenant Scoping              | Service-Layer Filtering                                  | Konsistent mit bestehenden Patterns (Blackboard, Survey, Calendar) |
| D3  | Shared Component für alle 3 Manage-Seiten       | manage-admins root-only → Scope nur für manage-employees | Vereinfacht den Scope erheblich                                    |

---

## Known Limitations (V1 — Bewusst ausgeschlossen)

1. **Kein granulares RWX pro User** — Alle sichtbaren User haben gleiche Action-Buttons. Ein scoped Admin kann jeden sichtbaren User editieren/löschen. Feinere Unterscheidung (read-only für Department A, write für Department B) ist V2.
2. **Kein Live-Scope-Update** — Wenn sich Permissions ändern während die Seite offen ist, wird der Scope erst nach Navigation/Reload aktualisiert.
3. **Lead-Positions nicht in `getAccessibleAreaIds()`** — Die bestehende Methode wird NICHT erweitert (Breaking-Risk für andere Consumer). `getVisibleUserIds()` hat eine eigene CTE die alle Pfade abdeckt.
4. **Keine Scope-Filterung in Backend-generierten E-Mails/Exports** — Nur API-Responses werden gefiltert.
5. **`manage-admins` Dropdown-Daten** — Da manage-admins root-only wird, werden die Areas/Departments-Dropdowns dort NICHT scope-gefiltert (Root sieht alles).

---

**Dieses Dokument ist der Execution Plan. Jede Session startet hier,
nimmt das nächste unchecked Item, und markiert es als done.**
