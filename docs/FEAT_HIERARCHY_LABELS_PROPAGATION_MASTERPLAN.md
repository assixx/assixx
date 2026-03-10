# FEAT: Hierarchy Labels Propagation — Execution Masterplan

> **Created:** 2026-03-10
> **Version:** 0.7.0
> **Status:** IN PROGRESS — Phase 4 Steps 4.1–4.5 complete, Step 4.6 next
> **Branch:** `feat/organigramm`
> **Spec:** [FEAT_ORGANIGRAM_MASTERPLAN.md](./FEAT_ORGANIGRAM_MASTERPLAN.md) (Known Limitation #5 → V2)
> **Author:** SCS Technik (Senior Engineer)
> **Estimated Sessions:** 8
> **Actual Sessions:** 5 / 8 (Session 5 partial — Steps 4.4+4.5 done, 4.6 pending)

---

## Changelog

| Version | Datum      | Änderung                                                                                |
| ------- | ---------- | --------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-03-10 | Initial Draft — Phasen 1-5 geplant                                                      |
| 0.2.0   | 2026-03-10 | Code-Validierung: Scope korrigiert, fehlende Module ergänzt, A6/A7 hinzu                |
| 0.3.0   | 2026-03-10 | Session 1 done: Phase 1 (Backend) + Phase 2 (Frontend Infrastructure)                   |
| 0.4.0   | 2026-03-10 | Session 2 done: Phase 3 Steps 3.1 + 3.2 (manage-areas + manage-departments)             |
| 0.5.0   | 2026-03-10 | Session 3 done: Phase 3 Steps 3.3 + 3.4 (manage-teams + manage-assets)                  |
| 0.6.0   | 2026-03-10 | Session 4 done: Phase 4 Steps 4.1–4.3 (manage-halls + manage-admins + manage-employees) |
| 0.7.0   | 2026-03-10 | Session 5 partial: Phase 4 Steps 4.4–4.5 (admin-dashboard + survey-admin + survey-employee) |

---

## Was wird gebaut?

**Custom Hierarchy Labels systemweit propagieren.** Aktuell (V1) zeigt nur die Organigramm-Seite die tenant-spezifischen Labels. Ab V2 sieht jeder User überall die angepassten Bezeichnungen:

| Wo                 | Vorher (hardcoded)     | Nachher (custom)        |
| ------------------ | ---------------------- | ----------------------- |
| Sidebar Navigation | "Bereiche"             | "Hallen"                |
| Breadcrumb         | "Bereiche verwalten"   | "Hallen verwalten"      |
| manage-areas Seite | "Bereichsübersicht"    | "Hallen — Übersicht"    |
| manage-departments | "Abteilungsverwaltung" | "Segmente — Verwaltung" |
| manage-teams       | "Teams"                | "Teilbereiche"          |
| manage-assets      | "Anlagen"              | "Maschinen"             |
| Tabellen-Header    | "Bereich", "Abteilung" | Custom Labels           |
| Admin Dashboard    | "Abteilungen", "Teams" | Custom Labels           |

**Datenmodell:** Plural-only (ein String pro Ebene). Kein Singular/Plural-Split.

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (alle Container healthy)
- [ ] Branch `feat/organigram` checked out
- [ ] Organigramm V1 komplett (alle 8 Sessions done)
- [ ] Bestehende Tests grün

### 0.2 Risk Register

| #   | Risiko                                            | Impact  | Wahrscheinlichkeit | Mitigation                                                           | Verifikation                                        |
| --- | ------------------------------------------------- | ------- | ------------------ | -------------------------------------------------------------------- | --------------------------------------------------- |
| R1  | SSR-Performance: Extra API-Call pro Navigation    | Mittel  | Hoch               | Parallel-Fetch mit bestehenden Calls (counts, theme, features)       | Performance-Log: kein spürbarer Anstieg             |
| R2  | Grammatik-Probleme mit Plural-only                | Niedrig | Hoch               | Formulierungen neutral halten ("Hallen — Übersicht" statt Komposita) | Manueller Review aller 30+ Dateien                  |
| R3  | Navigation-Labels nicht reaktiv (plain .ts)       | Mittel  | Mittel             | `getMenuItemsForRole()` wird Funktion mit Labels-Parameter           | Labels im Menü ändern sich nach Reload              |
| R4  | Breadcrumb-Labels stale nach Label-Änderung       | Niedrig | Mittel             | Labels werden bei jeder Navigation neu geladen (SSR)                 | Label ändern → Seite neu laden → Breadcrumb korrekt |
| R5  | 40+ Dateien gleichzeitig ändern → Merge-Konflikte | Hoch    | Niedrig            | Alles auf einem Branch, Session für Session committen                | Type-Check + ESLint nach jeder Session              |

### 0.3 Ecosystem Integration Points

| Bestehendes System           | Art der Integration                                             | Phase |
| ---------------------------- | --------------------------------------------------------------- | ----- |
| `(app)/+layout.server.ts`    | Neuer Parallel-Fetch: `GET /organigram/hierarchy-labels`        | 2     |
| `(app)/+layout.svelte`       | Labels an Sidebar + Breadcrumb weiterreichen                    | 2     |
| `navigation-config.ts`       | `getMenuItemsForRole()` → neuer Parameter `labels`              | 2     |
| `Breadcrumb.svelte`          | URL-Mappings dynamisch mit Labels                               | 2     |
| `manage-areas`               | `constants.ts` → Factory-Funktion                               | 3     |
| `manage-departments`         | `constants.ts` → Factory-Funktion                               | 3     |
| `manage-teams`               | `constants.ts` → Factory-Funktion + `TeamFormModal`             | 3     |
| `manage-assets`              | `constants.ts` → Factory-Funktion                               | 3     |
| `manage-halls`               | `constants.ts`, `utils.ts`, `+page.svelte` → "Bereich"          | 4     |
| `manage-admins`              | `constants.ts`, `utils.ts` → "Bereiche", "Abteilungen", "Teams" | 4     |
| `manage-employees`           | `constants.ts`, `utils.ts` → "Abteilung", "Team", "Bereich"     | 4     |
| `admin-dashboard`            | `constants.ts`, `+page.svelte` → "Abteilungen", "Teams"         | 4     |
| `survey-admin`               | `SurveyFormModal.svelte`, `constants.ts` → "Bereich" (7×)       | 4     |
| `vacation/rules`             | `BlackoutsTab.svelte`, `StaffingRulesTab.svelte` → 17× Matches  | 4     |
| `lean-management/tpm`        | `constants.ts`, `types.ts` → "Bereich" (5×), "Anlage" (10×)     | 4     |
| `manage-dummies`             | `constants.ts` → "Bereich" (1×)                                 | 4     |
| `admin-profile`              | `constants.ts` → "Bereich" (1×)                                 | 4     |
| `logs`, `shifts`, `profiles` | Einzelne String-Referenzen                                      | 4     |
| Organigram-Seite             | Labels-Quelle konsolidieren (Layout statt `/tree`)              | 5     |

---

## Architektur-Entscheidungen

### A1: Labels im Root-Layout laden (SSR)

**Warum:** Labels sind tenant-global und ändern sich selten. Einmal pro Navigation laden (parallel mit `/users/me`, `/dashboard/counts`, etc.) ist performant und stellt die Daten allen Child-Routen zur Verfügung.

**Pattern:** `data.hierarchyLabels` in Layout-Data → Child-Seiten lesen via SvelteKit Data-Inheritance (automatisch in `data` verfügbar, KEIN `await parent()` nötig).

### A2: Factory-Funktionen für .ts-Dateien (kein Store)

**Warum:** `navigation-config.ts` und `constants.ts` sind plain `.ts` Dateien — keine Svelte-Runes möglich. Statt eines Stores machen wir die Funktionen parametrisch.

```typescript
// Vorher (statisch):
export const rootMenuItems: NavItem[] = [
  { label: 'Bereiche', url: '/manage-areas' },
];

// Nachher (parametrisch):
export function getMenuItemsForRole(
  role: 'root' | 'admin' | 'employee' | 'dummy',
  labels: HierarchyLabels,
): NavItem[] { ... }
```

### A3: Breadcrumb via Props (kein Context)

**Warum:** Breadcrumb bekommt Labels als neue Prop. Einfacher als Context, weil nur EINE Komponente die Labels braucht und das Layout sie sowieso hat.

### A4: Keine Compound-Wörter (KISS)

**Warum:** "Bereichsleiter" → `${label}-Leiter` wäre grammatisch fragil. Stattdessen: Neutrale Formulierungen verwenden.

```
Vorher:  "Bereichsübersicht"    → Nachher: "${label} — Übersicht"
Vorher:  "Bereichsleiter"       → Nachher: "Leiter"  (kontextabhängig)
Vorher:  "Abteilungsverwaltung" → Nachher: "${label} — Verwaltung"
```

### A5: Backend — GET Labels für alle Rollen freigeben

**Warum:** Labels sind reine Display-Strings ohne Security-Relevanz. Alle authentifizierten User müssen sie sehen können. PATCH bleibt Root-only.

**Umsetzung:** `@Roles('root')` vom Controller-Level auf die 3 Root-only-Methoden verschieben. GET hierarchy-labels bekommt keine Roles-Einschränkung.

### A6: SvelteKit Data-Inheritance statt `await parent()` (kein Waterfall)

**Warum:** `await parent()` in `+page.server.ts` erzeugt einen Waterfall — die Page-Load wartet, bis das Layout fertig ist. Labels werden aber nur in der Svelte-Komponente gebraucht (UI-Strings), nicht im Server-Load.

**Pattern:** Das Layout returned `hierarchyLabels`. Durch SvelteKit Data-Inheritance hat JEDE Child-Page automatisch `data.hierarchyLabels` im Component verfügbar — ohne `await parent()`, ohne Waterfall, ohne Extra-Code in `+page.server.ts`.

```svelte
<!-- +page.svelte — Labels direkt aus data lesen -->
<script lang="ts">
  const { data }: Props = $props();
  const labels = $derived(data.hierarchyLabels ?? DEFAULT_HIERARCHY_LABELS);
  const messages = $derived(createMessages(labels));
</script>
```

### A7: Single Label Source — Layout ist die einzige Quelle

**Problem:** Organigramm-Seite lädt Labels aktuell über `GET /organigram/tree` (gebündelt). Phase 2 fügt `GET /organigram/hierarchy-labels` im Layout hinzu. Zwei Quellen für dieselben Daten = DRY-Verletzung.

**Entscheidung:**

1. Layout-Data (`data.hierarchyLabels`) ist die **Single Source of Truth** für alle Seiten
2. `/organigram/tree` liefert weiterhin Labels (Backend bleibt abwärtskompatibel)
3. Organigramm-Seite nutzt nach Phase 5 die Layout-Labels statt der Tree-Labels
4. Nach Label-Änderung im Modal: Seite invalidiert (`invalidateAll()`) → Layout lädt neu

---

## Phase 1: Backend — Public Labels Endpoint

> **Abhängigkeit:** Keine
> **Dateien:** 2 geändert, 1 Test geändert

### Step 1.1: Controller umbauen — GET Labels für alle Rollen [DONE]

**Datei:** `backend/src/nest/organigram/organigram.controller.ts`

**Was passiert:**

1. `@Roles('root')` vom Controller-Level entfernen
2. `@Roles('root')` auf die 3 Methoden setzen, die Root-only bleiben:
   - `getOrgChartTree()`
   - `updateHierarchyLabels()`
   - `upsertPositions()`
3. `getHierarchyLabels()` bleibt OHNE `@Roles` → alle authentifizierten User
4. JwtAuthGuard schützt weiterhin (alle Endpoints brauchen gültigen Token)

### Step 1.2: API-Test erweitern [DONE]

**Datei:** `backend/test/organigram.api.test.ts`

- Bestehender Test: Root → 200 (bleibt)
- Prüfen ob unauthenticated → 401 weiterhin gilt

### Phase 1 — Definition of Done

- [x] `GET /organigram/hierarchy-labels` ohne `@Roles` Restriction
- [x] `PATCH`, `GET /tree`, `PUT /positions` weiterhin `@Roles('root')`
- [x] Unauthenticated → 401 (JwtAuthGuard greift weiter)
- [x] Type-Check passed
- [x] Bestehende API-Tests grün

---

## Phase 2: Frontend Infrastructure — Layout + Navigation + Breadcrumb

> **Abhängigkeit:** Phase 1 complete
> **Dateien:** 1 neu, 4 geändert

### Step 2.1: Shared Type erstellen [DONE]

**Neue Datei:** `frontend/src/lib/types/hierarchy-labels.ts`

```typescript
export type OrgEntityType = 'area' | 'department' | 'team' | 'asset';

export interface HierarchyLabels {
  area: string;
  department: string;
  team: string;
  asset: string;
}

export const DEFAULT_HIERARCHY_LABELS: HierarchyLabels = {
  area: 'Bereiche',
  department: 'Abteilungen',
  team: 'Teams',
  asset: 'Anlagen',
};
```

### Step 2.2: Layout Server — Labels parallel laden [DONE]

**Datei:** `frontend/src/routes/(app)/+layout.server.ts`

**Was passiert:**

1. `GET /organigram/hierarchy-labels` in den bestehenden `Promise.all` einhängen
2. Parse-Funktion `parseHierarchyLabels()` mit Fallback auf Defaults
3. Return: `hierarchyLabels: HierarchyLabels` zusätzlich im Layout-Data

**Kritisch:** Fehler beim Fetch darf NICHT die ganze Seite kaputt machen → Graceful Fallback.

### Step 2.3: Layout Client — Labels an Navigation weiterreichen [DONE]

**Datei:** `frontend/src/routes/(app)/+layout.svelte`

**Was passiert:**

1. `data.hierarchyLabels` aus SSR-Data lesen (mit Fallback)
2. An `getMenuItemsForRole()` als zweiten Parameter übergeben
3. An `<Breadcrumb>` als neue Prop übergeben

### Step 2.4: Navigation Config — Labels-Parameter [DONE]

**Datei:** `frontend/src/routes/(app)/_lib/navigation-config.ts`

**Was passiert:**

1. `HierarchyLabels` Type importieren
2. Statische Menu-Arrays → Factory-Funktionen die Labels empfangen
3. `getMenuItemsForRole(role, labels)` baut dynamische Items:
   - Root: "Bereiche" → `labels.area`, "Abteilungen" → `labels.department`
   - Admin: "Teams" → `labels.team`, "Anlagen" → `labels.asset`
4. `filterMenuByAccess()` und `filterMenuByFeatures()` bleiben unverändert

**Betroffene Labels (4 Stellen):**

| Rolle | Item ID     | Vorher        | Nachher             |
| ----- | ----------- | ------------- | ------------------- |
| Root  | areas       | "Bereiche"    | `labels.area`       |
| Root  | departments | "Abteilungen" | `labels.department` |
| Admin | teams       | "Teams"       | `labels.team`       |
| Admin | assets      | "Anlagen"     | `labels.asset`      |

### Step 2.5: Breadcrumb — Labels-Prop [DONE]

**Datei:** `frontend/src/lib/components/Breadcrumb.svelte`

**Was passiert:**

1. Neue Prop: `hierarchyLabels?: HierarchyLabels` (optional mit Default)
2. `urlMappings` dynamisch generieren statt statisch (5 Stellen):
   - `/manage-areas` → `{ label: '${labels.area} verwalten', ... }`
   - `/manage-departments` → `{ label: '${labels.department} verwalten', ... }`
   - `/manage-teams` → `{ label: '${labels.team} verwalten', ... }`
   - `/manage-assets` → `{ label: '${labels.asset} verwalten', ... }`
   - `getAssetNameFromPageData()` Fallback (Zeile ~397) → `labels.asset`
3. Dynamic intermediate breadcrumbs analog anpassen

### Phase 2 — Definition of Done

- [x] `HierarchyLabels` Type in `$lib/types/` erstellt
- [x] Layout Server lädt Labels parallel (kein Performance-Impact)
- [x] Layout Client reicht Labels an Navigation + Breadcrumb
- [x] Sidebar zeigt custom Labels (nach DB-Änderung + Reload)
- [x] Breadcrumb zeigt custom Labels
- [x] svelte-check 0 Errors
- [x] ESLint 0 Errors
- [x] Bestehende Tests grün (33/33 navigation-config tests pass)

---

## Phase 3: Management-Seiten — areas, departments, teams, assets

> **Abhängigkeit:** Phase 2 complete
> **Dateien:** ~20 geändert (4 Module × ~5 Dateien)

### Pattern für jedes Modul

Jedes manage-\* Modul hat `constants.ts` mit 15-30 hardcoded Strings. Das Pattern:

1. **`constants.ts`** → Export wird zu Factory-Funktion `createMessages(labels: HierarchyLabels)` — IMMER das volle Objekt, nie einzelne Strings
2. **`+page.svelte`** → Labels via SvelteKit Data-Inheritance: `data.hierarchyLabels` (automatisch vom Layout), `createMessages()` aufrufen
3. **`+page.server.ts`** → KEINE Änderung nötig (Labels fließen automatisch durch Data-Inheritance)
4. **`utils.ts`** → Funktionen die Labels brauchen bekommen `labels: HierarchyLabels` Parameter
5. **`api.ts`** → Wenn Labels in Error-Messages verwendet → Parameter ergänzen
6. **Modals** → Labels als Prop oder aus Parent-Component durchreichen

### Step 3.1: manage-areas [DONE]

**Dateien (5 betroffen):**

- `manage-areas/_lib/constants.ts` — 27 Strings: "Bereich\*", "Abteilung\*", "Halle\*"
- `manage-areas/+page.svelte` — 6 entity-spezifische Strings (titles, aria-labels)
- `manage-areas/_lib/utils.ts` — 4 Strings
- `manage-areas/_lib/api.ts` — 2 Strings
- `manage-areas/_lib/AreaModal.svelte` — Prüfen auf Label-Referenzen

**Mapping (Auszug):**

```
"Bereichsübersicht"        → "${labels.area} — Übersicht"
"Bereiche und Standorte"   → "${labels.area} verwalten"
"Neuer Bereich"            → "Hinzufügen"
"Bereich bearbeiten"       → "Bearbeiten"
"Bereich löschen"          → "Löschen"
"Bereichsleiter"           → "Leiter"
"Keine Bereiche gefunden"  → "Keine ${labels.area} gefunden"
"Aktive Bereiche"          → "Aktive ${labels.area}"
"Inaktive Bereiche"        → "Inaktive ${labels.area}"
"Abteilungen zuweisen"     → "${labels.department} zuweisen"
"Hallen zuweisen"          → "Hallen zuweisen" (Hall-Label separat, Phase 4.1)
```

**Gesamt: ~33 Ersetzungen**

### Step 3.2: manage-departments [DONE]

**Dateien (4 betroffen):**

- `manage-departments/_lib/constants.ts` — 21 Strings
- `manage-departments/+page.svelte` — 6 Strings
- `manage-departments/_lib/utils.ts` — 3 Strings
- `manage-departments/_lib/api.ts` — Prüfen

**Mapping (Auszug):**

```
"Abteilungsverwaltung"     → "${labels.department} — Verwaltung"
"Neue Abteilung"           → "Hinzufügen"
"Abteilung bearbeiten"     → "Bearbeiten"
"Abteilungsleiter"         → "Leiter"
"Bereich" (FK-Referenz)    → labels.area (Area-Label!)
```

**Kritisch:** Departments referenzieren AUCH Area-Labels ("Bereich" als FK-Spalte). Factory bekommt volles `HierarchyLabels`-Objekt.

**Gesamt: ~30 Ersetzungen**

### Step 3.3: manage-teams [DONE]

**Dateien (4 betroffen):**

- `manage-teams/_lib/constants.ts` — Strings mit "Team", "Abteilung", "Anlage"
- `manage-teams/+page.svelte` — UI-Strings
- `manage-teams/_lib/TeamFormModal.svelte` — FK-Labels
- `manage-teams/_lib/utils.ts` — 1× "Anlage"

**Mapping (Auszug):**

```
"Teams"                    → "${labels.team}"
"Neues Team"               → "Hinzufügen"
"Abteilung" (FK-Referenz)  → labels.department
"Anlagen" (FK-Referenz)    → labels.asset
```

**Kritisch:** Teams referenzieren Department-Labels UND Asset-Labels. Factory bekommt volles `HierarchyLabels`-Objekt.

### Step 3.4: manage-assets [DONE]

**Dateien:** `constants.ts`, `utils.ts`, `+page.svelte`

**Mapping:**

```
"Anlagenübersicht"         → "${label} — Übersicht"
"Neue Anlage"              → "Hinzufügen"
"Bereich" (FK-Referenz)    → labels.area
"Abteilung" (FK-Referenz)  → labels.department
"Teams" (FK-Referenz)      → labels.team
```

### Phase 3 — Definition of Done

- [x] manage-areas: Alle hardcoded Labels durch dynamische ersetzt
- [x] manage-departments: Alle Labels + FK-Referenzen (Area) dynamisch
- [x] manage-teams: Alle Labels + FK-Referenzen (Department, Asset) dynamisch
- [x] manage-assets: Alle Labels + FK-Referenzen (Area, Department, Team) dynamisch
- [x] Jede `constants.ts` < 800 Zeilen
- [x] svelte-check 0 Errors
- [x] ESLint 0 Errors
- [ ] Labels korrekt nach DB-Änderung + Reload

---

## Phase 4: Restliche Admin-Module

> **Abhängigkeit:** Phase 3 complete
> **Dateien:** ~20 geändert

### Step 4.1: manage-halls [DONE ✓]

- `constants.ts` → factory pattern, `LABEL_AREA`, `NO_AREA`, `TH_AREA` dynamic
- `utils.ts` → 3× "Kein Bereich" → "Nicht zugewiesen"
- `+page.svelte` → labels/messages derived, dynamic table header

### Step 4.2: manage-admins [DONE ✓]

- `constants.ts` → factory pattern, 14 dynamic strings (labels, hints, badges, table headers)
- `utils.ts` → labels param to getAreasBadge/getDepartmentsBadge/getTeamsBadge/buildTeamsInheritanceTitle
- `AdminTableRow.svelte` → labels prop, passed to badge functions
- `AdminOrganizationSection.svelte` → messages prop (aliased msg)
- `AdminFormModal.svelte` → messages prop, threads to AdminOrganizationSection
- `+page.svelte` → labels/messages derived, passes to child components

### Step 4.3: manage-employees [DONE ✓]

- `constants.ts` → factory pattern, TEAM_ASSIGNMENT_TITLE + TH_AREAS/TH_DEPARTMENTS/TH_TEAMS dynamic
- `utils.ts` → labels param to getTeamsBadge/getAreasBadge/getDepartmentsBadge/buildDirectAreasBadge/buildDirectDeptsBadge
- `EmployeeTableRow.svelte` → labels prop, passed to badge functions
- `EmployeeFormModal.svelte` → messages prop (aliased msg), dynamic team section heading/label
- `+page.svelte` → labels/messages derived, dynamic table headers, passes labels/messages to children

### Step 4.4: admin-dashboard [DONE ✓]

- `constants.ts` → factory pattern: `createMessages(labels)` mit `STAT_DEPARTMENTS`, `STAT_TEAMS`, `CARD_DEPARTMENTS`, `CARD_TEAMS`, `BTN_MANAGE_DEPARTMENTS`, `BTN_MANAGE_TEAMS`, `orgLevelLabels`, `blackboardOrgLabels`, `EVENT_AREA/DEPARTMENT/TEAM`
- `utils.ts` → `getOrgLevelText()` + `getBlackboardOrgLabel()` nehmen Messages-Sub-Objekte statt statische Imports
- `+page.svelte` → `labels` + `messages` derived, alle Referenzen dynamisch

### Step 4.5: survey-admin + survey-employee [DONE ✓]

- `survey-admin/constants.ts` → `createAssignmentBadgeMap(labels)` + `createSurveyMessages(labels)` Factories
- `survey-admin/handlers.ts` → `getAssignmentBadges()` + `buildBadgeFromAssignment()` nehmen optionalen `badgeMap` Parameter; `resolveAssignmentText()` Helper extrahiert (Complexity ≤10)
- `survey-admin/SurveyFormModal.svelte` → neue `messages: SurveyMessages` Prop, 7 hardcoded Strings ersetzt
- `survey-admin/+page.svelte` → `labels`, `surveyMessages`, `badgeMap` derived, durchgereicht
- `survey-employee/constants.ts` → `createAssignmentBadgeMap(labels)` Factory (Bonus-Fix, selbes Pattern)

### Step 4.6: vacation/rules [PENDING] _(NEU — fehlte im Original)_

- `BlackoutsTab.svelte` (5×) → "Bereich" → `labels.area`
- `StaffingRulesTab.svelte` (3× "Bereich", 9× "Anlage") → `labels.area`, `labels.asset`
- 17 Stellen betroffen

### Step 4.7: lean-management/tpm [PENDING] _(NEU — fehlte im Original)_

- `constants.ts` (5× "Bereich", 10× "Anlage") → `labels.area`, `labels.asset`
- `types.ts` (1× "Bereich") → `labels.area`
- 16 Stellen betroffen

### Step 4.8: Verstreute Referenzen [PENDING]

- `logs/_lib/constants.ts` → "Abteilung", "Anlage", "Team"
- `employee-profile/_lib/constants.ts` → "Bereichsleiter"
- `admin-profile/_lib/constants.ts` (1×) → "Bereich"
- `manage-root/_lib/constants.ts` (2×) → "Bereiche"
- `manage-dummies/_lib/constants.ts` (1×) → "Bereich"
- `api-client.utils.ts` → "Anlagenstatus"
- `shifts/+page.server.ts` → Default-Labels

### Phase 4 — Definition of Done

- [ ] Alle 40+ betroffenen Dateien aktualisiert
- [ ] Keine hardcoded "Bereich/Abteilung/Team/Anlage" mehr (außer Defaults)
- [ ] svelte-check 0 Errors
- [ ] ESLint 0 Errors
- [ ] Type-Check Backend 0 Errors

---

## Phase 5: Tests + Polish + Dokumentation

> **Abhängigkeit:** Phase 4 complete

### Step 5.1: Manueller Smoke Test [PENDING]

1. Labels in DB ändern (via Organigramm-Seite oder direkt)
2. Durch ALLE Seiten navigieren und prüfen:
   - Sidebar korrekt
   - Breadcrumb korrekt
   - Page-Titel korrekt
   - Tabellen-Header korrekt
   - Modal-Titel korrekt
   - Filter-Labels korrekt

### Step 5.2: API-Test aktualisieren [PENDING]

- `organigram.api.test.ts` → Prüfen dass GET Labels für alle Rollen funktioniert

### Step 5.3: Organigramm-Masterplan aktualisieren [PENDING]

- Known Limitation #5 entfernen
- Referenz auf diesen Masterplan setzen

### Step 5.4: Organigram-Seite — Labels-Source konsolidieren [PENDING]

**Problem:** Zwei Quellen für dieselben Labels:

1. `GET /organigram/tree` → `tree.hierarchyLabels` (Organigramm-Seite)
2. `GET /organigram/hierarchy-labels` → `data.hierarchyLabels` (Layout)

**Lösung (gemäß A7):**

1. Organigramm-Seite: Labels aus `data.hierarchyLabels` (Layout) lesen statt aus `tree.hierarchyLabels`
2. `state.svelte.ts`: `updateTreeLabels()` aktualisiert den lokalen State UND ruft `invalidateAll()` auf
3. `/organigram/tree` liefert weiterhin Labels (abwärtskompatibel) — werden im Frontend ignoriert
4. Single Source of Truth = Layout-Data für ALLE Seiten, inklusive Organigram

### Phase 5 — Definition of Done

- [ ] Smoke Test: Alle Seiten zeigen custom Labels korrekt
- [ ] API-Tests: Labels-Endpoint für alle Rollen verifiziert
- [ ] Organigramm-Masterplan aktualisiert
- [ ] KEIN Code mit hardcoded "Bereich/Abteilung/Team/Anlage" (außer Defaults)
- [ ] Keine offenen TODOs im Code

---

## Session Tracking

| Session | Phase | Beschreibung                                               | Status  | Datum      |
| ------- | ----- | ---------------------------------------------------------- | ------- | ---------- |
| 1       | 1+2   | Backend Public Endpoint + Layout + Navigation + Breadcrumb | DONE    | 2026-03-10 |
| 2       | 3     | manage-areas + manage-departments                          | DONE    | 2026-03-10 |
| 3       | 3     | manage-teams + manage-assets                               | DONE    | 2026-03-10 |
| 4       | 4     | manage-halls + manage-admins + manage-employees            | DONE    | 2026-03-10 |
| 5       | 4     | admin-dashboard + survey-admin + survey-employee + vacation/rules | IN PROGRESS | 2026-03-10 |
| 6       | 4     | TPM + manage-dummies + admin-profile + verstreute Refs     | PENDING |            |
| 7       | 4     | logs + shifts + remaining + Vollständigkeits-Check         | PENDING |            |
| 8       | 5     | Tests + Smoke Test + Polish + Docs + Labels konsolidieren  | PENDING |            |

---

## Quick Reference: File Paths

### Backend (geändert)

| Datei                                                  | Änderung                  |
| ------------------------------------------------------ | ------------------------- |
| `backend/src/nest/organigram/organigram.controller.ts` | @Roles auf Methoden-Ebene |
| `backend/test/organigram.api.test.ts`                  | Test für alle Rollen      |

### Frontend (neu)

| Datei                                        | Zweck                  |
| -------------------------------------------- | ---------------------- |
| `frontend/src/lib/types/hierarchy-labels.ts` | Shared Type + Defaults |

### Frontend (geändert — Infrastructure)

| Datei                                                 | Änderung                |
| ----------------------------------------------------- | ----------------------- |
| `frontend/src/routes/(app)/+layout.server.ts`         | Labels parallel fetchen |
| `frontend/src/routes/(app)/+layout.svelte`            | Labels weiterreichen    |
| `frontend/src/routes/(app)/_lib/navigation-config.ts` | Labels-Parameter        |
| `frontend/src/lib/components/Breadcrumb.svelte`       | Labels-Prop + dynamisch |

### Frontend (geändert — Management-Seiten)

| Modul              | Dateien                                             | Stellen |
| ------------------ | --------------------------------------------------- | ------- |
| manage-areas       | constants.ts, +page.svelte, utils.ts, api.ts, Modal | ~33     |
| manage-departments | constants.ts, +page.svelte, utils.ts                | ~30     |
| manage-teams       | constants.ts, +page.svelte, TeamFormModal, utils.ts | ~15     |
| manage-assets      | constants.ts, +page.svelte, utils.ts                | ~30     |
| manage-halls       | constants.ts, +page.svelte, utils.ts                | ~7      |
| manage-admins      | constants.ts, utils.ts                              | ~15     |
| manage-employees   | constants.ts, utils.ts                              | ~3      |
| admin-dashboard    | constants.ts, utils.ts, +page.svelte                | ~12     |
| survey-admin       | constants.ts, handlers.ts, SurveyFormModal, +page   | ~10     |
| survey-employee    | constants.ts                                        | ~3      |
| vacation/rules     | BlackoutsTab.svelte, StaffingRulesTab.svelte        | ~17     |
| lean-mgmt/tpm      | constants.ts, types.ts                              | ~16     |
| manage-dummies     | constants.ts                                        | ~1      |
| admin-profile      | constants.ts                                        | ~1      |
| logs               | constants.ts                                        | ~3      |
| shifts             | +page.server.ts                                     | ~3      |
| employee-profile   | constants.ts                                        | ~1      |
| manage-root        | constants.ts                                        | ~2      |
| api-client.utils   | api-client.utils.ts                                 | ~1      |
| organigram         | state.svelte.ts (Label-Source konsolidieren)        | ~2      |

**Verifiziert: ~250+ String-Ersetzungen in ~40+ Dateien.**

---

## Spec Deviations

| #   | Organigramm-Masterplan sagt                             | Tatsächlicher Code          | Entscheidung                                           |
| --- | ------------------------------------------------------- | --------------------------- | ------------------------------------------------------ |
| D1  | V2 nutzt Svelte Context (Masterplan Known Limitation 5) | Props + Factory-Funktionen  | Context funktioniert nicht in plain .ts Dateien        |
| D2  | HierarchyLabels mit singular + plural (Types)           | Nur Plural-String pro Ebene | KISS — User-Entscheidung, Komposita neutral formuliert |

---

## Known Limitations (V2 — Bewusst ausgeschlossen)

1. **Kein Singular/Plural-Split** — Nur Plural-Strings. Stellen die Singular brauchen nutzen neutrale Formulierungen ("Hinzufügen" statt "Neuer Bereich").
2. **Keine Compound-Wörter** — "Bereichsleiter" wird zu "Leiter" oder "${label}-Leiter", nicht grammatisch perfekt.
3. **Keine Live-Updates** — Labels aktualisieren sich erst nach Navigation/Reload, nicht in Echtzeit.
4. **Keine Label-Propagation in E-Mails/PDFs** — Nur Frontend. Backend-generierte Texte (Notifications, Exports) nutzen weiterhin Default-Labels.
5. **Keine Pluralisierungs-Engine** — Wenn jemand "Halle" als Plural eingibt, wird überall "Halle" stehen. Der User ist verantwortlich für korrekte Plural-Formen.

---

**Dieses Dokument ist der Execution Plan. Jede Session startet hier,
nimmt das nächste unchecked Item, und markiert es als done.**
