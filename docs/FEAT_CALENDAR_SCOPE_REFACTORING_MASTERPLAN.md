# REFACTOR: Calendar Visibility → ScopeService — Execution Masterplan

> **Created:** 2026-03-14
> **Version:** 2.0.0 (Complete)
> **Status:** COMPLETE — Alle Phasen abgeschlossen
> **Branch:** `core/permission-and-more`
> **Context:** Performance-Analyse der Calendar Visibility-Queries ergab architektonisches Design-Problem
> **Author:** SCS (Senior Engineer)
> **Estimated Sessions:** 4
> **Actual Sessions:** 3 / 4 (Phase 1+2 merged into Session 1)

---

## Changelog

| Version | Datum      | Änderung                                                                     |
| ------- | ---------- | ---------------------------------------------------------------------------- |
| 0.1.0   | 2026-03-14 | Initial Draft — Analyse + 4 Phasen geplant                                   |
| 0.2.0   | 2026-03-14 | Double-Check: 5 Lücken gefixt, R6 hinzugefügt                                |
| 0.3.0   | 2026-03-14 | SHOWSTOPPER gefixt: Employee-Membership-Resolution, F1-F3 + L1-L5 adressiert |

---

## Motivation

Calendar verwendet 11 EXISTS-Subqueries in `buildVisibilityClause()` für Permission-Checks.
KVP verwendet pre-resolved Arrays mit `ANY()`. ScopeService (ADR-036) cached den Scope pro Request im CLS.

**Problem:** Calendar hat ein eigenes, veraltetes Permission-Pattern — duplikater Code, höhere Planning Time (6ms vs 0.3ms Execution), inkonsistent mit KVP/Blackboard.

**Ziel:** Calendar auf ScopeService umstellen — nicht wegen Performance, sondern wegen **Konsistenz und Wartbarkeit**.

### Architektur-Entscheidung: Zwei-Schichten-Visibility

**SHOWSTOPPER erkannt und gelöst:** `ScopeService.getScope()` gibt für Employees ohne Lead-Rolle
`NO_SCOPE` (type: 'none') zurück — weil OrganizationalScope für **Manage-Page-Zugriff** designed ist,
nicht für **Content-Visibility**. Die UNIFIED_SCOPE_CTE enthält NICHT `user_departments`/`user_teams`.

**Konsequenz ohne Fix:** ~80% der Employees (alle ohne Lead-Rolle) verlieren Sichtbarkeit auf
Department/Team/Area-Events → nur noch personal + attendee Events sichtbar.

**Lösung — Hybrid-Ansatz:** Calendar-Visibility = UNION aus:

1. **Management-Scope** (von ScopeService) — admin_area_permissions + Lead-Positionen + Kaskade
2. **Membership-Scope** (von CalendarPermissionService) — user_departments + user_teams

```
┌─────────────────────────────────────────────────────────────────┐
│  Calendar Visibility = Management-Scope ∪ Membership-Scope     │
│                                                                 │
│  scope.type = 'full'    → alles sichtbar (kein Filter)         │
│  scope.type = 'limited' → scope.areaIds ∪ scope.deptIds ∪      │
│                           scope.teamIds ∪ memberDeptIds ∪      │
│                           memberTeamIds + personal + attendee   │
│  scope.type = 'none'    → NUR memberDeptIds ∪ memberTeamIds    │
│                           + personal + attendee                │
└─────────────────────────────────────────────────────────────────┘
```

`getUserRole()` wird NICHT gelöscht, sondern zu `getUserMemberships()` umbenannt — schlanker,
ohne role/has_full_access (das kommt aus dem Scope).

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [x] Docker Stack running (7 Container healthy — 2026-03-14)
- [x] Keine pending Migrations (rein Backend-Refactoring, keine DB-Änderungen)
- [x] Bestehende Calendar-Tests grün: **165 Tests in 8 Dateien** (2026-03-14)
- [x] API-Tests grün: `calendar.api.test.ts` — **8 Tests** (2026-03-14)
- [x] Branch `core/permission-and-more` aktuell

### 0.2 Risk Register

| #   | Risiko                                                              | Impact   | Wahrscheinlichkeit | Mitigation                                                                                                                                                  | Verifikation                                                                    |
| --- | ------------------------------------------------------------------- | -------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| R1  | Visibility-Regression: User sieht Events, die er nicht sehen sollte | Hoch     | Mittel             | Vorher/Nachher EXPLAIN ANALYZE + manuelle Query-Vergleiche                                                                                                  | Unit Tests für alle org_levels + API Test multi-user                            |
| R2  | Visibility-Regression: User sieht Events NICHT, die er sehen sollte | Hoch     | Mittel             | Tests für jeden Zugriffspfad (member, lead, admin_permission, attendee)                                                                                     | Bestehende 18 Permission-Tests + neue Scope-Tests                               |
| R3  | Calendar-Attendees-Check fällt raus                                 | Hoch     | Niedrig            | Attendee-EXISTS bleibt erhalten (nicht in OrganizationalScope)                                                                                              | Expliziter Test: attendee sieht private/team Events                             |
| R4  | Parameter-Index-Fehler nach Umbau                                   | Mittel   | Hoch               | buildVisibilityClause() gibt `{ clause, params }` zurück statt nur String                                                                                   | Type-Safe return + Unit Tests für Parameter-Indizes                             |
| R5  | ScopeService nicht im CLS verfügbar                                 | Mittel   | Niedrig            | ScopeService wirft Error ohne CLS Context (bestehende Absicherung)                                                                                          | Test: ScopeService ohne CLS → Error                                             |
| R6  | Behavioral Change: Scoped Admins verlieren Vollzugriff auf Events   | Hoch     | Sicher (gewollt)   | ADR-036 definiert: scoped Admins sehen NUR ihren Scope. Vorher: ALLE Admins sahen ALLES. Das ist die gewollte Änderung, muss aber bewusst getestet werden.  | Test: Admin mit scope.type='limited' sieht NUR scope-Events + eigene + attendee |
| R7  | Employee-Visibility bricht bei scope.type='none'                    | KRITISCH | Sicher (ohne Fix)  | Hybrid-Ansatz: buildVisibilityClause() akzeptiert Scope + Membership-IDs. Employees bekommen Sichtbarkeit über memberDeptIds/memberTeamIds statt über Scope | Test: Employee ohne Lead sieht Department/Team-Events seiner Zugehörigkeit      |

### 0.3 Ecosystem Integration Points

| Bestehendes System        | Art der Integration                   | Phase | Verifiziert am |
| ------------------------- | ------------------------------------- | ----- | -------------- |
| ScopeService (ADR-036)    | Inject + getScope() Aufruf            | 2     |                |
| HierarchyPermissionModule | Import in calendar.module.ts          | 2     |                |
| CLS (nestjs-cls)          | Scope-Caching pro Request             | 2     |                |
| calendar.helpers.ts       | Neue buildVisibilityClause() Signatur | 1     |                |
| CalendarPermissionService | getUserRole() → getUserMemberships()  | 2     |                |

---

## Bestandsaufnahme: Was sich ändert

### Dateien mit Änderungen

| Datei                                 | Änderungsart | Was                                                                                                                   |
| ------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| `calendar.helpers.ts`                 | **Rewrite**  | `buildVisibilityClause()` → Scope-basiert + `PERMISSION_BASED_COUNT_QUERY` löschen                                    |
| `calendar-permission.service.ts`      | **Refactor** | `getUserRole()` → `getUserMemberships()`, `checkEventAccess()` + `buildPermissionBasedFilter()` auf Scope+Memberships |
| `calendar-overview.service.ts`        | **Refactor** | ScopeService inject, 3 Methoden auf Scope umstellen                                                                   |
| `calendar.service.ts`                 | **Refactor** | ScopeService inject, `listEvents()` vereinfachen                                                                      |
| `calendar.module.ts`                  | **Edit**     | `ScopeModule` importieren                                                                                             |
| `calendar.types.ts`                   | **Edit**     | `UserRoleInfo` → `CalendarMemberships` umbenennen (schlanker)                                                         |
| `calendar.helpers.test.ts`            | **Rewrite**  | Tests für neue Signatur                                                                                               |
| `calendar-permission.service.test.ts` | **Update**   | getUserRole→getUserMemberships, Scope+Membership-Tests                                                                |
| `calendar-overview.service.test.ts`   | **Update**   | ScopeService-Mocking                                                                                                  |
| `calendar.service.test.ts`            | **Update**   | ScopeService-Mocking                                                                                                  |

### Dateien OHNE Änderung

| Datei                          | Warum nicht                                               |
| ------------------------------ | --------------------------------------------------------- |
| `calendar-creation.service.ts` | Erstellt Events — keine Visibility-Logik                  |
| `calendar.api.test.ts`         | Smoke Tests — validieren weiterhin korrekte API-Responses |
| Database/Migrations            | Rein Backend-Refactoring, keine Schema-Änderungen         |
| Frontend                       | Keine API-Änderungen, nur interne Optimierung             |

---

## Phase 1: Refactor `calendar.helpers.ts`

> **Abhängigkeit:** Keine (reine Funktion, keine DI)
> **Risiko:** R4 (Parameter-Indizes)

### Step 1.1: Neue `buildVisibilityClause()` Signatur [DONE ✅ 2026-03-14]

**Datei:** `backend/src/nest/calendar/calendar.helpers.ts`

**Vorher (11 EXISTS, 2 Parameter):**

```typescript
export function buildVisibilityClause(userIdx: number, tenantIdx: number): string;
```

**Nachher (Scope + Memberships, return { clause, params }):**

```typescript
/** Membership-IDs eines Users (aus user_departments + user_teams) */
export interface CalendarMemberships {
  departmentIds: number[];
  teamIds: number[];
}

export function buildVisibilityClause(
  scope: OrganizationalScope,
  memberships: CalendarMemberships,
  userId: number,
  startIdx: number,
): { clause: string; params: unknown[] };
```

**Warum Memberships als separater Parameter (R7-Fix)?**

- `OrganizationalScope` enthält NUR Management-Zugriff (admin_area_permissions + Leads + Kaskade)
- `CalendarMemberships` enthält NUR Zugehörigkeit (user_departments + user_teams)
- Calendar-Visibility = UNION beider

**Logik:**

1. `scope.type === 'full'` → return `{ clause: '', params: [] }` (Caller behandelt full separat)
2. `scope.type === 'limited'` → `ANY()` mit UNION aus:
   - scope.areaIds (Management-Scope)
   - scope.departmentIds ∪ memberships.departmentIds (dedupliziert)
   - scope.teamIds ∪ memberships.teamIds (dedupliziert)
   - personal + attendee + creator
3. `scope.type === 'none'` → `ANY()` mit NUR:
   - memberships.departmentIds + memberships.teamIds
   - personal + attendee + creator

**Array-Merge im Code (kein SQL, kein Overhead):**

```typescript
const deptIds = [...new Set([...scope.departmentIds, ...memberships.departmentIds])];
const teamIds = [...new Set([...scope.teamIds, ...memberships.teamIds])];
```

**Beibehalten (NICHT in OrganizationalScope oder Memberships):**

- `calendar_attendees` EXISTS-Check — bleibt als einziges EXISTS (event-spezifisch)
- `personal` org_level Check (e.user_id = $N)
- Creator-Eigencheck (e.user_id = $N) für eigene Events

**Verifikation:**

- Unit Tests mit allen 3 scope.type Varianten
- Parameter-Index Korrektheit

### Step 1.2: `PERMISSION_BASED_COUNT_QUERY` löschen [DONE ✅ 2026-03-14]

**Datei:** `backend/src/nest/calendar/calendar.helpers.ts` (Zeilen 35-84)

Die hardcoded Konstante wird durch dynamischen Aufruf von `buildVisibilityClause()` ersetzt.
Jeder Aufrufer baut seine Query selbst mit dem Scope.

### Phase 1 — Definition of Done

- [ ] `buildVisibilityClause()` akzeptiert `OrganizationalScope` statt userIdx/tenantIdx
- [ ] Return-Typ ist `{ clause: string; params: unknown[] }` (nicht nur String)
- [ ] `PERMISSION_BASED_COUNT_QUERY` Konstante gelöscht
- [ ] Attendee-Check und Personal-Check bleiben erhalten
- [ ] 0 EXISTS in Visibility-Clause (außer Attendee)
- [ ] `ANY()` Pattern für area/department/team Checks
- [ ] Unit Tests für `scope.type = 'full' | 'limited' | 'none'`
- [ ] ESLint 0 Errors auf helpers.ts
- [ ] Type-Check passed

---

## Phase 2: ScopeService Integration in Services

> **Abhängigkeit:** Phase 1 complete
> **Risiko:** R1, R2, R5

### Step 2.1: `calendar.module.ts` — ScopeModule importieren [DONE ✅ 2026-03-14]

**Datei:** `backend/src/nest/calendar/calendar.module.ts`

**Änderung:** `ScopeModule` zu imports hinzufügen.
ScopeService wird dann in CalendarService + CalendarOverviewService injizierbar.

### Step 2.2: `CalendarPermissionService` umbauen [DONE ✅ 2026-03-14]

**Datei:** `backend/src/nest/calendar/calendar-permission.service.ts`

**Umbenennen (NICHT löschen — R7-Fix):**

- `getUserRole()` → `getUserMemberships()` — schlanker, ohne role/has_full_access
- `UserRoleInfo` → `CalendarMemberships` (in calendar.types.ts)

**Vorher: `getUserRole()` (Zeilen 25-61)**

```typescript
async getUserRole(userId: number, tenantId: number): Promise<UserRoleInfo> {
  // Returns: role, has_full_access, department_ids, team_ids
}
```

**Nachher: `getUserMemberships()`**

```typescript
async getUserMemberships(userId: number, tenantId: number): Promise<CalendarMemberships> {
  const rows = await this.databaseService.query<{
    department_ids: number[] | null;
    team_ids: number[] | null;
  }>(
    `SELECT
       (SELECT ARRAY_AGG(DISTINCT ud.department_id)
        FROM user_departments ud
        WHERE ud.user_id = u.id AND ud.tenant_id = u.tenant_id) AS department_ids,
       (SELECT ARRAY_AGG(DISTINCT ut.team_id)
        FROM user_teams ut
        WHERE ut.user_id = u.id AND ut.tenant_id = u.tenant_id) AS team_ids
     FROM users u
     WHERE u.id = $1 AND u.tenant_id = $2`,
    [userId, tenantId],
  );
  const row = rows[0];
  return {
    departmentIds: row?.department_ids ?? [],
    teamIds: row?.team_ids ?? [],
  };
}
```

**Umbauen:**

- `buildPermissionBasedFilter()` → akzeptiert `OrganizationalScope` + `CalendarMemberships` + `userId`
- `buildAdminOrgLevelFilter()` → bleibt unverändert (reine UI-Filter-Logik)
- `checkEventAccess()` → akzeptiert `OrganizationalScope` + `CalendarMemberships` statt UserRoleInfo
- `getEventAttendees()` → bleibt unverändert

**checkEventAccess() — Scope + Membership basiert:**

```typescript
async checkEventAccess(
  event: DbCalendarEvent,
  userId: number,
  scope: OrganizationalScope,
  memberships: CalendarMemberships,
): Promise<boolean> {
  if (scope.type === 'full') return true;
  if (event.user_id === userId) return true;
  if (event.org_level === 'company') return true;

  // Merge scope + memberships für Visibility
  const deptIds = [...new Set([...scope.departmentIds, ...memberships.departmentIds])];
  const teamIds = [...new Set([...scope.teamIds, ...memberships.teamIds])];

  if (event.org_level === 'area' && event.area_id !== null && scope.areaIds.includes(event.area_id)) return true;
  if (event.org_level === 'department' && event.department_id !== null && deptIds.includes(event.department_id)) return true;
  if (event.org_level === 'team' && event.team_id !== null && teamIds.includes(event.team_id)) return true;

  // Attendee-Check (DB-Query, wie bisher)
  const attendees = await this.databaseService.query<{ user_id: number }>(
    `SELECT user_id FROM calendar_attendees WHERE event_id = $1 AND user_id = $2`,
    [event.id, userId],
  );
  return attendees.length > 0;
}
```

**Behavioral Changes (R6 + F2):**

- **R6:** Admins mit scope.type='limited' sehen NUR Scope+Membership Events (vorher: ALLES). Gewollt per ADR-036.
- **F2 (Bug-Fix):** Area-Events werden jetzt via `scope.areaIds` geprüft. Vorher: kein Area-Check in `checkEventAccess()` — Area-Events waren für non-Admin unsichtbar im Einzelzugriff.

### Step 2.3: `CalendarService.listEvents()` + `getEventById()` umbauen [DONE ✅ 2026-03-14]

**Datei:** `backend/src/nest/calendar/calendar.service.ts`

**LÜCKE #3 (gefixt):** Nicht nur `listEvents()` (Zeile 87), auch `getEventById()` (Zeile 170) ruft `getUserRole()` auf.
Beide müssen auf ScopeService umgestellt werden.

**listEvents() — Vorher:**

```typescript
const userRole = await this.permissionService.getUserRole(userId, tenantId);
const hasUnrestrictedAccess = userRole.has_full_access || userRole.role === 'root';
```

**listEvents() — Nachher:**

```typescript
const scope = await this.scopeService.getScope();
const memberships = await this.permissionService.getUserMemberships(userId, tenantId);

if (scope.type === 'full') {
  /* admin org-level filter only (buildAdminOrgLevelFilter) */
} else {
  /* 'limited' oder 'none': scope + memberships → buildVisibilityClause() */
  const { clause, params: visParams } = buildVisibilityClause(scope, memberships, userId, paramIndex);
  query += ` AND ${clause}`;
  params.push(...visParams);
}
```

**getEventById() — Nachher:**

```typescript
const scope = await this.scopeService.getScope();
const memberships = await this.permissionService.getUserMemberships(userId, tenantId);
const hasAccess = await this.permissionService.checkEventAccess(event, userId, scope, memberships);
```

**L1 (geklärt):** Bei `scope.type === 'limited'` oder `'none'` ruft `listEvents()` direkt
`buildVisibilityClause(scope, memberships, userId, startIdx)` auf. `buildPermissionBasedFilter()`
wird zum schlanken Wrapper, der Visibility-Clause + optionalen org-level-UI-Filter kombiniert.

**ScopeService injection:** Via Constructor-DI in CalendarService + CalendarOverviewService.
CalendarPermissionService erhält Scope + Memberships als Parameter (kein eigener ScopeService-Inject).

### Step 2.4: `CalendarOverviewService` umbauen [DONE ✅ 2026-03-14]

**Datei:** `backend/src/nest/calendar/calendar-overview.service.ts`

**3 Methoden betroffen:**

| Methode                          | Vorher                               | Nachher                                                                          |
| -------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------- |
| `getDashboardEvents()`           | `buildVisibilityClause(4, 1)` inline | `scope = await scopeService.getScope()` + neue buildVisibilityClause(scope, idx) |
| `getRecentlyAddedEvents()`       | `buildVisibilityClause(2, 1)` inline | Identisch                                                                        |
| `countUpcomingWithPermissions()` | `PERMISSION_BASED_COUNT_QUERY`       | Dynamische Query mit buildVisibilityClause(scope, userId, idx)                   |

**LÜCKE #4 (gefixt):** `PERMISSION_BASED_COUNT_QUERY` enthält `e.user_id != $5` — dieser Filter
schließt eigene Events vom Badge-Count aus (Badge zeigt nur NEUE Events ANDERER User).
Dieser Filter muss in `countUpcomingWithPermissions()` erhalten bleiben, gehört aber
NICHT in `buildVisibilityClause()` sondern in die aufrufende Methode.

**Zusätzlich:** `getUpcomingCount()` — Dispatch-Logik vereinfachen:

```typescript
// Vorher:
const hasUnrestrictedAccess = userRole.has_full_access || userRole.role === 'root';

// Nachher:
const scope = await this.scopeService.getScope();
if (scope.type === 'full') { ... } // cleaner
```

### Step 2.5: `calendar.types.ts` aufräumen [DONE ✅ 2026-03-14]

**Umbenennen:**

- `UserRoleInfo` → `CalendarMemberships` (nur departmentIds + teamIds, ohne role/has_full_access)

```typescript
// Vorher:
export interface UserRoleInfo {
  role: string | null;
  department_ids: number[];
  team_ids: number[];
  has_full_access: boolean;
}

// Nachher:
export interface CalendarMemberships {
  departmentIds: number[];
  teamIds: number[];
}
```

**`OrgTarget` bleibt** (Zeilen 99-104, genutzt von CalendarCreationService).

### Phase 2 — Definition of Done

- [ ] `ScopeModule` in calendar.module.ts importiert
- [ ] ScopeService in CalendarService + CalendarOverviewService injiziert
- [ ] `getUserRole()` → `getUserMemberships()` umbenannt (5 Call-Sites aktualisiert)
- [ ] `UserRoleInfo` → `CalendarMemberships` umbenannt (ohne role/has_full_access)
- [ ] `listEvents()` + `getEventById()` nutzen `scope.type` + memberships
- [ ] Alle 3 Overview-Methoden nutzen Scope + Memberships
- [ ] `checkEventAccess()` nutzt Scope + Memberships In-Memory-Check
- [ ] `checkEventAccess()` hat Area-Level-Check (Bug-Fix F2)
- [ ] `PERMISSION_BASED_COUNT_QUERY` nicht mehr referenziert
- [ ] `e.user_id != $N` Creator-Ausschluss in `countUpcomingWithPermissions()` erhalten
- [ ] Employee ohne Lead sieht Department/Team-Events (R7 verifiziert)
- [ ] ESLint 0 Errors: `docker exec assixx-backend pnpm exec eslint backend/src/nest/calendar/`
- [ ] Type-Check passed: `docker exec assixx-backend pnpm run type-check`

---

## Phase 3: Tests aktualisieren

> **Abhängigkeit:** Phase 2 complete
> **Risiko:** R1, R2, R3

### Step 3.1: `calendar.helpers.test.ts` — Visibility Tests rewriten [DONE ✅ 2026-03-14]

**Vorher:** 3 Tests prüfen String-Interpolation von `$userIdx` / `$tenantIdx`

**Nachher:** Tests für die neue Signatur:

| Test                                   | Was wird geprüft                                        |
| -------------------------------------- | ------------------------------------------------------- |
| scope.type = 'full' → leerer Clause    | Kein WHERE-Anhang für Root/full_access                  |
| scope.type = 'none' + memberships      | Employee sieht membership-dept/team + personal+attendee |
| scope.type = 'limited' + areaIds       | `ANY($N)` mit korrekten Area-IDs                        |
| scope.type = 'limited' + departmentIds | `ANY($N)` mit korrekten Department-IDs                  |
| scope.type = 'limited' + teamIds       | `ANY($N)` mit korrekten Team-IDs                        |
| scope.type = 'limited' + alle IDs      | Kombinierter Check alle org_levels                      |
| Attendee-Check bleibt als EXISTS       | calendar_attendees-Subquery erhalten                    |
| Personal-Check bleibt                  | `e.org_level = 'personal' AND e.user_id = $N`           |
| params-Array korrekte Länge            | Anzahl Parameter stimmt mit Placeholder-Indizes überein |
| Leere Arrays → `[0]` Fallback          | `ANY(ARRAY[0])` statt `ANY(ARRAY[])` (PostgreSQL-Edge)  |

**Geschätzte Tests:** ~12 (vorher 3)

### Step 3.2: `calendar-permission.service.test.ts` — Scope + Membership [DONE ✅ 2026-03-14]

**Umbauen:** `getUserRole()` Tests → `getUserMemberships()` Tests (Signatur-Änderung).
8 `checkEventAccess()` Tests → neue Parameter: `OrganizationalScope` + `CalendarMemberships`.

**Neue Tests:**

| Test                                                       | Was wird geprüft                   |
| ---------------------------------------------------------- | ---------------------------------- |
| Area-Event + User hat areaId in Scope                      | Zugriff gewährt (Bug-Fix F2)       |
| Area-Event + User hat areaId NICHT in Scope                | Zugriff verweigert                 |
| Dept-Event + Employee hat dept in Memberships (kein Scope) | Zugriff gewährt (R7-Fix)           |
| Team-Event + Employee hat team in Memberships (kein Scope) | Zugriff gewährt (R7-Fix)           |
| scope.type='limited' + memberships.deptIds → UNION         | Sieht Events aus beiden Quellen    |
| Attendee override: User nicht in Scope/Membership          | Zugriff gewährt (attendee > scope) |
| Creator override: eigenes Event außerhalb Scope            | Zugriff gewährt (creator > scope)  |

**Geschätzte Tests:** ~20

### Step 3.3: `calendar-overview.service.test.ts` — ScopeService-Mocking [DONE ✅ 2026-03-14]

**Änderungen:**

- Mock: `getUserRole()` → `scopeService.getScope()`
- Scope-Mocking statt UserRole-Mocking
- Prüfen: `scope.type === 'full'` Pfad und `scope.type === 'limited'` Pfad

**Neuer Test:** Employee mit `scope.type = 'limited'` → erhält nur gefilterte Events.

**Geschätzte Tests:** ~8 (vorher 6)

### Step 3.4: `calendar.service.test.ts` — ScopeService-Mocking [DONE ✅ 2026-03-14]

**Änderungen:**

- Mock: ScopeService hinzufügen
- `listEvents()` Tests: Scope statt UserRole

**Geschätzte Tests:** ~12 (vorher 12)

### Phase 3 — Definition of Done

- [ ] > = bestehende Test-Anzahl (vor Start mit Vitest run ermitteln und hier eintragen: \_\_\_ Tests)
- [ ] Alle Tests grün: `docker exec assixx-backend pnpm exec vitest run backend/src/nest/calendar/`
- [ ] Attendee-Zugriff explizit getestet (R3)
- [ ] Alle 3 scope.type Varianten getestet pro relevanter Methode
- [ ] Parameter-Index-Korrektheit getestet (R4)
- [ ] getUserRole()-Mocks durch getUserMemberships()-Mocks ersetzt
- [ ] R7 verifiziert: Employee ohne Lead sieht Department/Team-Events via Memberships
- [ ] API-Tests weiterhin grün: `doppler run -- pnpm exec vitest run backend/test/calendar.api.test.ts`

---

## Phase 4: Verify & Clean

> **Abhängigkeit:** Phase 3 complete

### Step 4.1: EXPLAIN ANALYZE Vergleich [DONE ✅ 2026-03-14]

**Ergebnis:** Planning Time 6.339ms → 3.775ms (-40%), SubPlans 11 → 1.

**Vorher-Query:** 11 SubPlans (hashed), Planning Time ~6ms
**Nachher-Query:** ~3 SubPlans (nur Attendee), Planning Time erwartete ~2ms

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
EXPLAIN ANALYZE
SELECT COUNT(DISTINCT e.id) FROM calendar_events e
WHERE e.tenant_id = 1
  AND e.start_date >= '2026-03-01'
  AND e.start_date < '2026-03-31'
  AND (
    e.org_level = 'company'
    OR (e.org_level = 'area' AND e.area_id = ANY(ARRAY[1]))
    OR (e.org_level = 'department' AND e.department_id = ANY(ARRAY[1]))
    OR (e.org_level = 'team' AND e.team_id = ANY(ARRAY[1]))
    OR (e.org_level = 'personal' AND e.user_id = 2)
    OR EXISTS (SELECT 1 FROM calendar_attendees ca WHERE ca.event_id = e.id AND ca.user_id = 2)
  )
"
```

**Akzeptanzkriterium:** Planning Time < 4ms (vorher 6.3ms)

### Step 4.2: Dead Code entfernen [DONE ✅ 2026-03-14]

- [ ] `PERMISSION_BASED_COUNT_QUERY` gelöscht (helpers.ts)
- [ ] `UserRoleInfo` → `CalendarMemberships` umbenannt (calendar.types.ts)
- [ ] `getUserRole()` → `getUserMemberships()` umbenannt (calendar-permission.service.ts)
- [ ] Keine Referenzen auf `admin_area_permissions` oder `admin_department_permissions` in Calendar-Dateien
- [ ] Keine ungenutzten Imports
- [ ] `getEventAttendees()` unverändert (L3 bestätigt)

### Step 4.3: Vollständige Verifikation [DONE ✅ 2026-03-14]

```bash
# ESLint
docker exec assixx-backend pnpm exec eslint backend/src/nest/calendar/

# Type-Check
docker exec assixx-backend pnpm run type-check

# Unit Tests
docker exec assixx-backend pnpm exec vitest run backend/src/nest/calendar/

# API Tests
doppler run -- pnpm exec vitest run backend/test/calendar.api.test.ts

# Permission Tests (falls Calendar-Subset enthalten)
docker exec assixx-backend pnpm exec vitest run --project permission
```

### Phase 4 — Definition of Done

- [ ] EXPLAIN ANALYZE: Planning Time < 4ms
- [ ] 0 Referenzen auf `admin_area_permissions`/`admin_department_permissions` in Calendar-Modul
- [ ] ESLint 0 Errors
- [ ] Type-Check 0 Errors
- [ ] Alle Unit Tests grün
- [ ] Alle API Tests grün
- [ ] Kein Dead Code (PERMISSION_BASED_COUNT_QUERY gelöscht, UserRoleInfo→CalendarMemberships, getUserRole→getUserMemberships)

---

## Session Tracking

| Session | Phase | Beschreibung                                                    | Status  | Datum      |
| ------- | ----- | --------------------------------------------------------------- | ------- | ---------- |
| 1       | 1+2   | Source-Refactoring: helpers + services (Phase 1+2 gekoppelt)    | DONE ✅ | 2026-03-14 |
| 2       | 3     | Tests aktualisieren (helpers + permission + overview + service) | DONE ✅ | 2026-03-14 |
| 3       | 4     | EXPLAIN ANALYZE + Dead Code + Vollständige Verifikation         | DONE ✅ | 2026-03-14 |

---

## Quick Reference: File Paths

### Backend (geändert)

| Datei                                                           | Änderung                         |
| --------------------------------------------------------------- | -------------------------------- |
| `backend/src/nest/calendar/calendar.helpers.ts`                 | buildVisibilityClause() Rewrite  |
| `backend/src/nest/calendar/calendar-permission.service.ts`      | getUserRole→getUserMemberships   |
| `backend/src/nest/calendar/calendar-overview.service.ts`        | ScopeService inject              |
| `backend/src/nest/calendar/calendar.service.ts`                 | ScopeService inject              |
| `backend/src/nest/calendar/calendar.module.ts`                  | ScopeModule Import               |
| `backend/src/nest/calendar/calendar.types.ts`                   | UserRoleInfo→CalendarMemberships |
| `backend/src/nest/calendar/calendar.helpers.test.ts`            | Visibility Tests rewrite         |
| `backend/src/nest/calendar/calendar-permission.service.test.ts` | Scope+Membership Tests           |
| `backend/src/nest/calendar/calendar-overview.service.test.ts`   | ScopeService Mocking             |
| `backend/src/nest/calendar/calendar.service.test.ts`            | ScopeService Mocking             |

### Backend (referenziert, KEINE Änderung)

| Datei                                                                 | Warum referenziert              |
| --------------------------------------------------------------------- | ------------------------------- |
| `backend/src/nest/hierarchy-permission/scope.service.ts`              | Wird injiziert, nicht geändert  |
| `backend/src/nest/hierarchy-permission/scope.module.ts`               | Wird importiert, nicht geändert |
| `backend/src/nest/hierarchy-permission/organizational-scope.types.ts` | Types werden genutzt            |
| `backend/src/nest/kvp/kvp.helpers.ts`                                 | Referenz-Pattern (ANY())        |

---

## Spec Deviations

| #   | Original-Analyse sagt                          | Tatsächlicher Code                                | Entscheidung                                                        |
| --- | ---------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| D1  | "11 EXISTS-Subqueries"                         | PostgreSQL hasht SubPlans                         | Kein Performance-Problem, aber Design-Problem                       |
| D2  | "Redis-Cache nötig"                            | CLS-Cache im ScopeService                         | ScopeService-Caching reicht aus, kein Redis nötig                   |
| D3  | "Materialized View"                            | Nicht nötig                                       | ANY() mit Pre-resolved Arrays ist ausreichend                       |
| D4  | Plan v0.1: buildVisibility(scope, idx)         | userId nötig für personal + attendee + creator    | Signatur erweitert: buildVisibility(scope, userId, idx)             |
| D5  | Plan v0.1: nur listEvents() betroffen          | Auch getEventById() ruft getUserRole() auf        | Beide Methoden in Step 2.3 zusammengefasst                          |
| D6  | Plan v0.1: checkEventAccess() → Scope          | Behavioral Change: Admins verlieren Vollzugriff   | Gewollt per ADR-036 — R6 dokumentiert, explizite Tests nötig        |
| D7  | Plan v0.1: PERMISSION_BASED einfach löschen    | Enthält `e.user_id != $5` Creator-Ausschluss      | Creator-Filter bleibt in aufrufender Methode, nicht in helper       |
| D8  | Plan v0.2: getUserRole() löschen               | Employee-Memberships nicht in OrganizationalScope | getUserRole() → getUserMemberships() umbenannt, Memberships separat |
| D9  | Plan v0.2: buildVisibility(scope, userId, idx) | Memberships fehlen für Employee-Visibility        | Signatur: buildVisibility(scope, memberships, userId, idx)          |
| D10 | Plan v0.2: 64 Tests                            | Tatsächlich ~165 Tests (Vitest run verifizieren)  | Test-Ziel auf tatsächliche Anzahl korrigiert                        |

---

## Known Limitations (V1 — Bewusst ausgeschlossen)

1. **Calendar-Attendees bleiben als EXISTS** — Attendees sind event-spezifisch, nicht user-scope-basiert. Ein Pre-Resolve aller Attendee-Events wäre N+1 oder ein separater Cache. Für V1 bleibt der EXISTS, da er nur 1x pro Query ausgeführt wird und die Tabelle klein ist.
2. **Kein Prepared Statement Caching** — Planning Time könnte durch PG Prepared Statements weiter reduziert werden. Ist aber ein pg-Pool-Level Feature, nicht Calendar-spezifisch.
3. **Kein Frontend-Refactoring** — Die API-Schnittstelle ändert sich nicht. Frontend-Code bleibt unverändert.
4. **buildAdminOrgLevelFilter() bleibt** — Der UI-Filter (Company/Area/Department/Team Dropdown) ist unabhängig vom Permission-Check. Er filtert die Ansicht, nicht den Zugriff.

---

## Post-Mortem (nach Abschluss ausfüllen)

### Was lief gut

- Validation Report hat SHOWSTOPPER gefunden (Employee-Memberships) BEVOR Code geschrieben wurde
- Hybrid-Ansatz (Scope + Memberships) ist sauberer als beide Alternativen
- Phase 1+2 mussten zusammen ausgeführt werden (breaking signature change) — pragmatisch gelöst

### Was lief schlecht

- Test-Count im Plan war falsch (64 vs 165) — nächstes Mal: Vitest run VOR Plan-Erstellung
- 3 Plan-Iterationen nötig (v0.1 → v0.2 → v0.3) bevor Showstopper gefunden — nächstes Mal: Validation Report als Pflicht-Step vor Implementierung

### Metriken

| Metrik                    | Geplant    | Tatsächlich |
| ------------------------- | ---------- | ----------- |
| Sessions                  | 4          | 3           |
| Geänderte Dateien         | 10         | 10          |
| Gelöschte LOC             | ~100       | ~100        |
| Neue LOC                  | ~90        | ~85         |
| Unit Tests (nachher)      | >= 165     | 178 (+13)   |
| Planning Time Reduction   | 6ms → <4ms | 6.3 → 3.8ms |
| ESLint Errors bei Release | 0          | 0           |

---

**Dieses Dokument ist der Execution Plan. Jede Session startet hier,
nimmt das nächste unchecked Item, und markiert es als done.**
