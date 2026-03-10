# FEAT: Organigramm — Execution Masterplan

> **Created:** 2026-03-09
> **Version:** 1.0.0 (Feature Complete — V1)
> **Status:** DONE — Alle 6 Phasen abgeschlossen
> **Branch:** `feat/organigram`
> **Author:** SCS Technik (Senior Engineer)
> **Estimated Sessions:** 8
> **Actual Sessions:** 8 / 8

---

## Changelog

| Version | Datum      | Änderung                                                 |
| ------- | ---------- | -------------------------------------------------------- |
| 0.1.0   | 2026-03-09 | Initial Draft — Phasen 1-6 geplant                       |
| 0.2.0   | 2026-03-10 | Review: 11 Fehler behoben (Hierarchie, Auth etc.)        |
| 0.3.0   | 2026-03-10 | Sessions 1-4 abgeschlossen (Migration, Backend, Tests)   |
| 0.4.0   | 2026-03-10 | Session 5: Frontend Grundstruktur + SSR + SVG Canvas     |
| 0.5.0   | 2026-03-10 | Session 6: OrgNode Drag&Drop + Auto-Follow + Hover       |
| 0.6.0   | 2026-03-10 | Session 7: Toolbar + HierarchyLabelsModal + Save         |
| 1.0.0   | 2026-03-10 | Session 8: Audit Logging + Breadcrumb + Polish → V1 Done |

---

## Was wird gebaut?

Ein visueller Organigramm-Builder unter `/settings/organigram` (Root only), der:

1. **Firmenname + Standort** oben anzeigt (aus `tenants` Tabelle)
2. **Große Canvas-Fläche** bietet, auf der Blöcke (Rechtecke) erstellt werden können
3. **Blöcke** repräsentieren Areas, Departments, Teams, Assets — visuell als verschiebbare Rechtecke
4. **Linien** verbinden Parent-Child-Beziehungen (Area→Dept, Area→Asset, Dept→Team, Dept→Asset)
5. **Auto-Follow:** Kinder-Blöcke bewegen sich mit, wenn der Parent verschoben wird
6. **Anpassbare Hierarchie-Labels** pro Tenant — Root kann die Ebenen-Namen umbenennen

### Hierarchie-Label-Customization (Kern-Feature)

| DB-Tabelle    | Default-Label | Beispiel Firma A | Beispiel Firma B |
| ------------- | ------------- | ---------------- | ---------------- |
| `areas`       | Bereich       | Halle            | Abteilung        |
| `departments` | Abteilung     | Abteilung        | Segment          |
| `teams`       | Team          | Team             | Teilbereich      |
| `assets`      | Anlage        | Anlage           | Maschine         |

**Die DB-Struktur bleibt identisch** — nur die Anzeige-Labels ändern sich pro Tenant.

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [x] Docker Stack running (alle Container healthy)
- [x] DB Backup erstellt
- [x] Branch `feat/organigram` checked out
- [x] Keine pending Migrations
- [x] Bestehende Tests grün

### 0.2 Risk Register

| #   | Risiko                                         | Impact  | Wahrscheinlichkeit | Mitigation                                                          | Verifikation                                    |
| --- | ---------------------------------------------- | ------- | ------------------ | ------------------------------------------------------------------- | ----------------------------------------------- |
| R1  | SVG Drag&Drop Performance bei vielen Knoten    | Mittel  | Niedrig            | Virtualisierung ab >200 Nodes, aber typisch <50                     | Performance-Test mit 100 Nodes                  |
| R2  | `tenants.settings` JSONB Kollision mit anderem | Hoch    | Niedrig            | Dedicated Key `orgHierarchy`, JSONB Merge (nicht Overwrite)         | Unit Test: Settings-Update preserved other keys |
| R3  | Positions-Tabelle wächst bei vielen Entities   | Niedrig | Niedrig            | UNIQUE constraint, max ~500 Rows pro Tenant                         | DB Query Performance Test                       |
| R4  | Browser-Kompatibilität SVG pointer events      | Mittel  | Niedrig            | Standard SVG + pointer events (IE nicht unterstützt, kein Problem)  | Test in Chrome, Firefox, Safari                 |
| R5  | Concurrent Edits (zwei Roots gleichzeitig)     | Mittel  | Niedrig            | Last-write-wins mit `updated_at` Check, kein Real-Time-Collab nötig | Unit Test: Concurrent Update                    |

### 0.3 Ecosystem Integration Points

| Bestehendes System | Art der Integration                        | Phase |
| ------------------ | ------------------------------------------ | ----- |
| `tenants.settings` | JSONB Merge für Hierarchie-Labels          | 2     |
| Areas CRUD         | Nur Lesen (READ-ONLY in V1)                | 2     |
| Departments CRUD   | Nur Lesen (READ-ONLY in V1)                | 2     |
| Teams CRUD         | Nur Lesen (READ-ONLY in V1)                | 2     |
| Assets CRUD        | Lesen (nur Anzeige im Organigramm)         | 2     |
| Navigation Config  | Neuer Menüpunkt unter "System" (Root only) | 5     |
| Audit Logging      | Hierarchie-Label-Änderungen loggen         | 6     |

---

## Architektur-Entscheidungen

### A1: Hierarchie-Labels in `tenants.settings` JSONB

**Warum:** `tenants` hat bereits `settings JSONB` (aktuell NULL). Kein neues Schema, kein neuer Table.

```jsonc
// tenants.settings nach Setup:
{
  "orgHierarchy": {
    "levels": {
      "area": { "singular": "Bereich", "plural": "Bereiche" },
      "department": { "singular": "Abteilung", "plural": "Abteilungen" },
      "team": { "singular": "Team", "plural": "Teams" },
      "asset": { "singular": "Anlage", "plural": "Anlagen" },
    },
  },
}
```

**Fallback:** Wenn `settings.orgHierarchy` nicht gesetzt → Default-Labels verwenden (hardcoded Constants).

### A2: Separate Positions-Tabelle statt Spalten auf bestehenden Tabellen

**Warum:** Trennung von Business-Daten und UI-Layout. Kein Schema-Change an 4 existierenden Tabellen.

```sql
-- ENUM für Typ-Sicherheit (statt VARCHAR)
CREATE TYPE org_entity_type AS ENUM ('area', 'department', 'team', 'asset');

org_chart_positions (
  uuid            UUID PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type     org_entity_type NOT NULL,
  entity_uuid     CHARACTER(36) NOT NULL,
  position_x      NUMERIC(10,2) NOT NULL DEFAULT 0,
  position_y      NUMERIC(10,2) NOT NULL DEFAULT 0,
  width           NUMERIC(10,2) NOT NULL DEFAULT 200,
  height          NUMERIC(10,2) NOT NULL DEFAULT 80,
  is_active       SMALLINT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  uuid_created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(tenant_id, entity_type, entity_uuid)
)
```

**Hinweis:** `entity_uuid` referenziert die `uuid CHAR(36)` Spalte der jeweiligen Entity-Tabelle (areas, departments, teams, assets). Kein FK-Constraint, da polymorphe Referenz. Verwaiste Positionen (Entity gelöscht) sind harmlos — die Aggregation-Query JOINt gegen die echten Tabellen, verwaiste Rows werden ignoriert.

### A3: SVG-basierter Canvas (keine externe Library)

**Warum:** KISS. Kein npm-Dependency. Volle Kontrolle über Styling (Design System). SVG hat native DOM-Events.

**Technologie:**

- `<svg>` als Canvas
- `<rect>` für Blöcke
- `<path>` mit Bézier-Kurven für Verbindungslinien
- `<text>` / `<foreignObject>` für Labels
- Svelte 5 `$state` für Positionen
- `pointerdown/pointermove/pointerup` für Drag & Drop
- `viewBox` + Wheel-Zoom für Pan/Zoom

### A4: Auto-Layout-Algorithmus

**Für neue Entities** die noch keine gespeicherte Position haben:

- Tree-basierter Layout (Top-Down)
- Parent zentriert über Kindern
- Horizontaler Abstand: 40px
- Vertikaler Abstand: 80px zwischen Ebenen
- Manuelle Repositionierung überschreibt Auto-Layout dauerhaft

---

## Phase 1: Database Migration

> **Abhängigkeit:** Keine
> **Dateien:** 1 Migrationsdatei

### Step 1.1: Tabelle `org_chart_positions` + RLS [DONE]

**Neue Datei:** `database/migrations/{timestamp}_create-org-chart-positions.ts`

**Was passiert:**

1. `CREATE TABLE org_chart_positions` mit allen Spalten (siehe A2)
2. `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
3. RLS Policy mit `NULLIF(current_setting('app.tenant_id', true), '')` Pattern
4. `GRANT SELECT, INSERT, UPDATE, DELETE ON org_chart_positions TO app_user`
5. Indexes: `tenant_id`, `(tenant_id, entity_type)`, `UNIQUE(tenant_id, entity_type, entity_uuid)`
6. `up()` UND `down()` implementiert

**Mandatory Checklist:**

- [x] `uuid UUID PRIMARY KEY` (UUIDv7)
- [x] `tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- [x] `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- [x] RLS Policy mit `NULLIF` Pattern
- [x] `GRANT` für `app_user`
- [x] `is_active SMALLINT NOT NULL DEFAULT 1`
- [x] `up()` UND `down()` implementiert

**Kein Seed-Data nötig:** Positionen werden dynamisch beim ersten Öffnen per Auto-Layout berechnet.

**Kein Schema-Change an `tenants`:** `settings` JSONB existiert bereits.

### Phase 1 — Definition of Done

- [x] 1 Migrationsdatei mit `up()` AND `down()` → `20260310600085_create-org-chart-positions.ts`
- [x] Dry-Run bestanden
- [x] Migration erfolgreich angewendet
- [x] `org_chart_positions` existiert mit RLS Policy
- [x] Backend kompiliert fehlerfrei
- [x] Bestehende Tests laufen weiterhin

---

## Phase 2: Backend Module

> **Abhängigkeit:** Phase 1 complete
> **Neues Verzeichnis:** `backend/src/nest/organigram/`

### Step 2.1: Module Skeleton + Types + DTOs [DONE]

**Dateistruktur:**

```
backend/src/nest/organigram/
    organigram.module.ts
    organigram.types.ts
    dto/
        index.ts
        update-hierarchy-labels.dto.ts
        upsert-positions.dto.ts
```

**Types (organigram.types.ts):**

```typescript
// Die 4 festen Entity-Ebenen
type OrgEntityType = 'area' | 'department' | 'team' | 'asset';

interface HierarchyLabel {
  singular: string; // "Bereich"
  plural: string; // "Bereiche"
}

interface HierarchyLabels {
  area: HierarchyLabel;
  department: HierarchyLabel;
  team: HierarchyLabel;
  asset: HierarchyLabel;
}

interface OrgChartPosition {
  uuid: string;
  entityType: OrgEntityType;
  entityUuid: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
}

// Aggregierter Node für Frontend
interface OrgChartNode {
  entityType: OrgEntityType;
  entityUuid: string;
  name: string;
  position: OrgChartPosition | null; // null = Auto-Layout
  children: OrgChartNode[]; // Departments/Teams (hierarchisch)
  assets: OrgChartNode[]; // Assets separat (können an Area ODER Department hängen)
  leadName?: string; // Area/Dept/Team Lead Name
  memberCount?: number; // Anzahl Mitglieder
}

// Tatsächliche DB-Hierarchie (verifiziert):
// Area → Departments (area_id), Assets (area_id)
// Department → Teams (department_id), Assets (department_id)
// Team → (keine Kinder, hat member_count)
// Asset → (Blattknoten, KEIN team_id in DB!)

interface OrgChartTree {
  companyName: string;
  address: string | null;
  hierarchyLabels: HierarchyLabels;
  nodes: OrgChartNode[]; // Top-Level = Areas
}
```

### Step 2.2: OrganigramSettingsService [DONE]

**Datei:** `backend/src/nest/organigram/organigram-settings.service.ts`

**Methoden:**

- `getHierarchyLabels(tenantId): HierarchyLabels` — Liest aus `tenants.settings`, Fallback auf Defaults
- `updateHierarchyLabels(tenantId, labels): HierarchyLabels` — JSONB Merge Update (nicht Overwrite!)

**Kritisch:** Bestehende Settings dürfen NICHT überschrieben werden.

**Strategie: Read-Merge-Write im Application Code** (nicht im SQL):

1. `SELECT settings FROM tenants WHERE id = $1` — bestehende Settings lesen
2. Application-Code: Deep-Merge der neuen Labels in bestehende `orgHierarchy.levels`
3. `UPDATE tenants SET settings = $2 WHERE id = $1 RETURNING settings` — komplettes Objekt schreiben

**Warum nicht `||`?** Der `||` Operator macht Shallow Merge — bei `{"orgHierarchy": {"levels": {"area": {...}}}}` würde er den gesamten `orgHierarchy`-Key überschreiben und department/team/asset Labels verlieren. Read-Merge-Write ist sicher für Partial Updates.

```typescript
// Pseudo-Code im Service:
const current = await this.getSettings(tenantId); // SELECT settings
const merged = {
  ...current,
  orgHierarchy: {
    ...current?.orgHierarchy,
    levels: { ...DEFAULT_LABELS, ...current?.orgHierarchy?.levels, ...dto.levels },
  },
};
await this.db.tenantTransaction((client) =>
  client.query('UPDATE tenants SET settings = $1 WHERE id = $2', [JSON.stringify(merged), tenantId]),
);
```

### Step 2.3: OrganigramLayoutService [DONE]

**Datei:** `backend/src/nest/organigram/organigram-layout.service.ts`

**Methoden:**

- `getPositions(tenantId): OrgChartPosition[]` — Alle Positionen für Tenant
- `upsertPositions(tenantId, positions[]): void` — Batch-UPSERT via `ON CONFLICT DO UPDATE`
- `deletePosition(tenantId, entityType, entityUuid): void` — Position entfernen

**Pattern:** `db.tenantTransaction()` für alle Queries.

### Step 2.4: OrganigramService (Aggregation) [DONE]

**Datei:** `backend/src/nest/organigram/organigram.service.ts`

**Methoden:**

- `getOrgChartTree(tenantId): OrgChartTree` — Aggregiert alles:
  1. Tenant-Daten (company_name, address)
  2. Hierarchy Labels (aus Settings)
  3. Areas mit Lead-Namen
  4. Departments mit Lead-Namen + area_id
  5. Teams mit Lead-Namen + Member-Count + department_id
  6. Assets mit area_id + department_id (KEIN team_id!)
  7. Positions für alle Entities
  8. Baut Tree-Struktur: Area → (Departments + Assets), Department → (Teams + Assets)

**Korrekte Hierarchie (verifiziert gegen DB):**

```
Area
├── Department (area_id → areas.id)
│   ├── Team (department_id → departments.id)
│   └── Asset (department_id → departments.id)
└── Asset (area_id → areas.id, department_id IS NULL)
```

**WICHTIG:** `assets` hat `area_id` UND `department_id` (beide nullable), aber KEIN `team_id`. Assets sind Geschwister von Teams, nicht deren Kinder.

**Read-Only:** Alle Queries sind SELECT-only. Keine Mutation von Entity-Daten. `tenant_id` MUSS explizit im WHERE stehen (plain `query()` setzt keinen RLS-Context).

**Abhängigkeiten:** `OrganigramSettingsService`, `OrganigramLayoutService`, `DatabaseService`

### Step 2.5: OrganigramController [DONE]

**Datei:** `backend/src/nest/organigram/organigram.controller.ts`

**Endpoints (4 total):**

| Method | Route                        | Guard     | Beschreibung              |
| ------ | ---------------------------- | --------- | ------------------------- |
| GET    | /organigram/tree             | Root only | Kompletter Org-Chart-Tree |
| GET    | /organigram/hierarchy-labels | Root only | Aktuelle Hierarchy-Labels |
| PATCH  | /organigram/hierarchy-labels | Root only | Labels aktualisieren      |
| PUT    | /organigram/positions        | Root only | Batch-UPSERT Positionen   |

**Jeder Endpoint:**

- [x] `@Roles('root')` Decorator auf Controller-Ebene (nicht pro Endpoint)
- [x] `tenantId` aus CLS Context via `@TenantId()` Decorator
- [x] Raw Data returnen (ResponseInterceptor wrapped automatisch)
- [x] Kein Feature-Gate nötig (Settings-Page, kein Feature-Toggle)
- [x] V1 = READ-ONLY für Entity-Daten (nur Positions + Labels sind schreibbar)

### Step 2.6: Registrierung in app.module.ts [DONE]

- [x] `OrganigramModule` zu imports Array (alphabetisch sortiert)

### Phase 2 — Definition of Done

- [x] `OrganigramModule` registriert in `app.module.ts`
- [x] 3 Services implementiert und injiziert
- [x] Controller mit 4 Endpoints
- [x] `db.tenantTransaction()` für alle Mutations (Positions, Settings)
- [x] Reads: `db.query()` mit explizitem `tenant_id` im WHERE (kein RLS-Context bei plain query!)
- [x] JSONB Merge (nicht Overwrite) für Settings
- [x] `??` nicht `||`, kein `any`, explizite Boolean-Checks
- [x] ESLint 0 Errors
- [x] Type-Check passed
- [x] Alle DTOs nutzen Zod + `createZodDto()` Pattern

---

## Phase 3: Unit Tests

> **Abhängigkeit:** Phase 2 complete

### Test-Dateien

```
backend/src/nest/organigram/
    organigram-settings.service.test.ts    # ~20 Tests
    organigram-layout.service.test.ts      # ~15 Tests
    organigram.service.test.ts             # ~20 Tests
```

### Kritische Test-Szenarien

**Settings:**

- [x] Default-Labels wenn `settings` NULL
- [x] Default-Labels wenn `settings.orgHierarchy` fehlt
- [x] Partial Update preserved bestehende Settings
- [x] Validierung: leere Strings nicht erlaubt (via Zod DTO)
- [x] Validierung: Label max 50 Zeichen (via Zod DTO)

**Layout:**

- [x] UPSERT: Insert neuer Position
- [x] UPSERT: Update bestehender Position (ON CONFLICT)
- [x] Batch-UPSERT: mehrere Positionen gleichzeitig
- [x] Delete Position (soft-delete is_active=4)
- [x] Tenant-Isolation: tenant_id im WHERE + RLS

**Aggregation:**

- [x] Leerer Tenant (keine Areas/Depts/Teams)
- [x] Tree-Aufbau: Area → (Departments + Assets), Department → (Teams + Assets)
- [x] Assets unter Area korrekt (area_id gesetzt, department_id NULL)
- [x] Assets unter Department korrekt (department_id gesetzt)
- [x] Lead-Namen aufgelöst (inkl. null/whitespace-Handling)
- [x] Member-Count korrekt (inkl. 0)
- [x] Positions merged mit Entity-Daten

### Phase 3 — Definition of Done

- [x] 40 Unit Tests (Settings: 12, Layout: 13, Aggregation: 15) — alle public Methoden abgedeckt
- [x] Alle Tests grün
- [x] Tenant-Isolation verifiziert (tenant_id in allen Queries)
- [x] Edge Cases für leeren Tenant getestet
- [x] Coverage: Alle public Methoden haben mindestens 1 Test

---

## Phase 4: API Integration Tests

> **Abhängigkeit:** Phase 3 complete
> **Datei:** `backend/test/organigram.api.test.ts`

### Szenarien (>= 15 Assertions)

**Auth:**

- [x] Unauthenticated → 401
- [ ] Employee → 403 (Root only) — kein Employee-User im apitest Tenant, getestet via RolesGuard Unit Tests
- [ ] Admin → 403 (Root only) — kein Admin-User im apitest Tenant, getestet via RolesGuard Unit Tests
- [x] Root → 200

**GET /organigram/tree:**

- [x] 200 mit korrekter Tree-Struktur
- [x] companyName + hierarchyLabels vorhanden
- [x] nodes Array vorhanden

**GET /organigram/hierarchy-labels:**

- [x] 200 mit Label-Struktur (area, department, team, asset)
- [x] Jeder Level hat singular + plural

**PATCH /organigram/hierarchy-labels:**

- [x] 200 mit neuen Labels (partial update)
- [x] Persistenz: Labels bleiben nach Re-Read erhalten

**PUT /organigram/positions:**

- [x] 200 bei UPSERT
- [x] 400 bei leerer Positions-Array
- [x] 400 bei ungültigem entityType

### Phase 4 — Definition of Done

- [x] 11 API Integration Tests — alle grün
- [x] Alle Tests grün
- [x] Root-Only-Access verifiziert (401 ohne Token)
- [x] Validierungs-Tests (400 bei ungültigen Payloads)

---

## Phase 5: Frontend

> **Abhängigkeit:** Phase 2 complete (Backend-Endpoints verfügbar)

### Route-Struktur

```
frontend/src/routes/(app)/(root)/settings/organigram/
    +page.svelte              # Hauptseite
    +page.server.ts           # Auth (Root only) + SSR Data Loading
    _lib/
        api.ts                # apiClient Wrapper [DONE]
        types.ts              # TypeScript Interfaces (Mirror von Backend) [DONE]
        constants.ts          # Default-Labels, Farben pro Ebene [DONE]
        state.svelte.ts       # Svelte 5 State ($state) + Auto-Layout [DONE]
        OrgCanvas.svelte      # SVG Canvas (Pan/Zoom + Connections inline) [DONE]
        OrgNode.svelte        # Einzelner Block (Drag & Drop) [DONE]
        OrgToolbar.svelte     # Toolbar: Zoom, Auto-Layout, Speichern [PENDING]
        HierarchyLabelsModal.svelte  # Modal für Label-Customization [PENDING]
```

### Step 5.1: Grundstruktur + SSR [DONE]

**+page.server.ts:**

```typescript
export const load: PageServerLoad = async ({ cookies, fetch, locals }) => {
  const token = cookies.get('accessToken');
  if (token === undefined) redirect(302, '/login');

  // Auth via locals.user (aus RBAC-Hook) — NICHT parent() (Waterfall-Blocker!)
  const user = locals.user as RbacUser | undefined;
  if (user?.role !== 'root') redirect(302, '/permission-denied');

  // Fetch org chart tree via apiFetch (parallel wenn mehrere Requests)
  const tree = await apiFetch<OrgChartTree>('/organigram/tree', token, fetch);
  return { tree };
};
```

### Step 5.2: SVG Canvas Component [DONE]

**OrgCanvas.svelte — Kernkomponente:**

- SVG mit `viewBox` für Pan/Zoom
- Mausrad → Zoom (0.5x bis 3x)
- Mittelklick-Drag → Pan
- Grid-Hintergrund (optional, subtile Punkte)
- Kein Touch-Support in V1 (Desktop-first, siehe Known Limitations)

### Step 5.3: OrgNode.svelte — Verschiebbare Blöcke [DONE]

- SVG `<g>` mit `<rect>` + `<text>`
- `pointerdown` → Start Drag
- `pointermove` → Update Position (mit `$state`)
- `pointerup` → End Drag, Save Position via API
- Farbcodierung pro Ebene:
  - Area: `--color-primary` (Blau)
  - Department: `--color-success` (Grün)
  - Team: `--color-warning` (Orange)
  - Asset: `--color-info` (Cyan)
- Hover: Schatten + Größenanzeige
- Klick: Detail-Panel (READ-ONLY — zeigt Lead, Member-Count, Typ)
- Kein Inline-Edit in V1 (Organigramm darf keine Main-Daten ändern)
- Resize-Handles an Ecken (optional V2)

### Step 5.4: OrgConnection.svelte — Verbindungslinien [DONE — inline in OrgCanvas]

- SVG `<path>` mit kubischer Bézier-Kurve
- Von Parent-Block-Unterseite → Kind-Block-Oberseite
- Automatische Neuberechnung bei Drag
- Pfeil am Ende (optional)
- Farbe: Grau, bei Hover des Parents hervorgehoben

### Step 5.5: Auto-Follow-Logik [DONE]

Wenn ein Parent-Block verschoben wird:

1. Delta (dx, dy) berechnen
2. Alle Kinder rekursiv um dasselbe Delta verschieben
3. Linien werden automatisch neu gezeichnet (reaktiv über `$derived`)

```typescript
function moveNodeWithChildren(nodeUuid: string, dx: number, dy: number): void {
  // Update node position
  // Recursively update all children
}
```

### Step 5.6: Toolbar + Hierarchie-Labels-Modal [DONE]

**OrgToolbar.svelte:**

- Zoom In/Out/Reset Buttons
- "Auto-Layout" Button (berechnet optimale Positionen neu)
- "Speichern" Button (Batch-UPSERT aller Positionen)
- "Hierarchie-Ebenen anpassen" Button → öffnet Modal

**HierarchyLabelsModal.svelte:**

- 4 Zeilen (Area, Department, Team, Asset)
- Jeweils: Singular-Input + Plural-Input
- "Standard wiederherstellen" Button
- Speichern → PATCH /organigram/hierarchy-labels

### Step 5.7: Navigation Config Update [DONE]

**navigation-config.ts — `rootMenuItems` System-Submenu erweitert mit Organigramm-Menüpunkt.**

### Step 5.8: Top-Bereich: Firma + Standort [DONE]

- Company Name groß als Überschrift (aus `tree.companyName`)
- Standort/Adresse darunter (aus `tree.address`)
- Wenn `address` NULL → Hinweis "Kein Standort hinterlegt"
- Visuell: Card-Container über dem Canvas

### Frontend-Patterns (PFLICHT)

- `apiClient.get<T>()` returned Data DIREKT (bereits unwrapped)
- Svelte 5 Runes: `$state`, `$derived`, `$effect`
- `onclick` (nicht `on:click`)
- Design System Komponenten wo möglich (Buttons, Modals, Cards)

### Phase 5 — Definition of Done

- [x] Seite rendert für Root-User
- [x] Root-only Access (Redirect für Admin/Employee) — via `(root)` Layout-Gruppe
- [x] Firmenname + Standort korrekt angezeigt
- [x] Blöcke für alle Areas/Departments/Teams/Assets
- [x] Drag & Drop funktioniert
- [x] Verbindungslinien korrekt gezeichnet (Bézier + Hover-Highlighting)
- [x] Auto-Follow bei Parent-Verschiebung (`moveNodeWithChildren`)
- [x] Hierarchie-Labels anpassbar via Modal
- [x] Positionen werden gespeichert (persistent nach Reload)
- [x] Auto-Layout für Entities ohne gespeicherte Position
- [x] Navigation Config aktualisiert
- [x] svelte-check 0 Errors, 0 Warnings
- [x] ESLint 0 Errors
- [x] Responsive (mindestens Desktop 1024px+, Toolbar responsive mit hidden labels)
- [x] Deutsche Labels überall

---

## Phase 6: Integration + Polish

> **Abhängigkeit:** Phase 5 complete

### Integrationen

- [x] Audit Logging: Hierarchie-Label-Änderungen via ActivityLoggerService
- [x] Breadcrumb: "System > Organigramm"
- [ ] Info-Tooltip: Erklärung was Hierarchie-Labels bewirken (V2 — kein Blocker)

### Labels-Propagation (V1-Scope: nur Organigramm-Seite)

V1 zeigt angepasste Labels **nur auf der Organigramm-Seite selbst**. Systemweite Propagation (Sidebar, Formulare, Breadcrumbs) ist V2 — siehe Known Limitations #4.

**V2-Vorbereitung (nicht implementieren, nur dokumentieren):** Frontend lädt Labels einmalig im Root-Layout und stellt sie via Svelte Context bereit. Alle Komponenten lesen aus dem Context statt Hardcoded.

### Phase 6 — Definition of Done

- [x] Audit Logging für Label-Änderungen
- [x] Labels wirken auf der Organigramm-Seite (Custom-Labels korrekt angezeigt)
- [x] Breadcrumb: "System > Organigramm"
- [x] Keine offenen TODOs im Code

---

## Session Tracking

| Session | Phase | Beschreibung                                              | Status | Datum      |
| ------- | ----- | --------------------------------------------------------- | ------ | ---------- |
| 1       | 1+2   | Migration + Module Skeleton + Types + DTOs                | DONE   | 2026-03-10 |
| 2       | 2     | Settings + Layout + Aggregation Services                  | DONE   | 2026-03-10 |
| 3       | 2     | Controller + Module Registration                          | DONE   | 2026-03-10 |
| 4       | 3+4   | Unit Tests (40) + API Integration Tests (11)              | DONE   | 2026-03-10 |
| 5       | 5     | Frontend: Grundstruktur + SSR + SVG Canvas + Nav + Header | DONE   | 2026-03-10 |
| 6       | 5     | Frontend: OrgNode + Drag&Drop + Connections + Auto-Follow | DONE   | 2026-03-10 |
| 7       | 5     | Frontend: Toolbar + Labels-Modal + Speichern              | DONE   | 2026-03-10 |
| 8       | 6     | Integration + Audit + Breadcrumb + Polish                 | DONE   | 2026-03-10 |

---

## Quick Reference: File Paths

### Backend (neu)

| Datei                                                        | Zweck                  |
| ------------------------------------------------------------ | ---------------------- |
| `backend/src/nest/organigram/organigram.module.ts`           | NestJS Modul           |
| `backend/src/nest/organigram/organigram.controller.ts`       | REST Controller (4 EP) |
| `backend/src/nest/organigram/organigram.service.ts`          | Tree-Aggregation       |
| `backend/src/nest/organigram/organigram-settings.service.ts` | Hierarchy-Labels CRUD  |
| `backend/src/nest/organigram/organigram-layout.service.ts`   | Positions CRUD         |
| `backend/src/nest/organigram/organigram.types.ts`            | Alle Interfaces        |
| `backend/src/nest/organigram/dto/*.ts`                       | DTOs (Zod)             |

### Backend (geändert)

| Datei                            | Änderung            |
| -------------------------------- | ------------------- |
| `backend/src/nest/app.module.ts` | Module Import hinzu |

### Database (neu)

| Datei                                                           | Zweck       |
| --------------------------------------------------------------- | ----------- |
| `database/migrations/{timestamp}_create-org-chart-positions.ts` | Migration 1 |

### Frontend (neu)

| Pfad                                                                   | Zweck         |
| ---------------------------------------------------------------------- | ------------- |
| `frontend/src/routes/(app)/(root)/settings/organigram/+page.svelte`    | Hauptseite    |
| `frontend/src/routes/(app)/(root)/settings/organigram/+page.server.ts` | SSR + Auth    |
| `frontend/src/routes/(app)/(root)/settings/organigram/_lib/*.ts`       | Logik + Types |
| `frontend/src/routes/(app)/(root)/settings/organigram/_lib/*.svelte`   | Komponenten   |

### Frontend (geändert)

| Datei                                                 | Änderung        |
| ----------------------------------------------------- | --------------- |
| `frontend/src/routes/(app)/_lib/navigation-config.ts` | Menüpunkt hinzu |

---

## Known Limitations (V1 — Bewusst ausgeschlossen)

1. **READ-ONLY für Entity-Daten** — V1 liest nur bestehende Areas/Departments/Teams/Assets. Keine Mutation von Main-Daten (Namen, Zuordnungen etc.). Nur Organigramm-eigene Daten (Positionen, Hierarchy-Labels) sind schreibbar. Entity-Mutation kommt schrittweise in V2+.
2. **Kein Real-Time-Collaboration** — Nur ein Root gleichzeitig editiert. Kein WebSocket/SSE für Live-Sync.
3. **Kein Resize von Blöcken in V1** — Nur Verschieben. Alle Blöcke haben fixe Default-Größe. Resize kommt in V2.
4. **Keine neuen Entities aus dem Organigramm erstellen** — V1 zeigt nur bestehende Areas/Depts/Teams. Erstellen über bestehende Management-Seiten. V2 kann "Block erstellen" → direkt Area/Dept anlegen.
5. **Labels-Propagation nur auf Organigramm-Seite** — Systemweite Propagation (Sidebar, alle Seiten) ist V2. V1 zeigt die angepassten Labels nur im Organigramm.
6. **Kein Export (PDF/PNG)** — V2.
7. **Kein Minimap** — V2 bei Bedarf.
8. **Keine Touch-Gesten** — Desktop-first. Touch-Support in V2.

---

## Spec Deviations

| #   | Spec sagt                            | Tatsächlicher Code                               | Entscheidung                                    |
| --- | ------------------------------------ | ------------------------------------------------ | ----------------------------------------------- |
| D1  | areas hat parent_id (HIERARCHY.md)   | areas hat KEIN parent_id                         | Kein parent_id nötig für V1, Hierarchy ist flat |
| D2  | Assets unter Teams (Draft v0.1.0)    | assets hat area_id + department_id, KEIN team_id | Assets sind Geschwister von Teams, nicht Kinder |
| D3  | Inline-Edit für Names (Draft v0.1.0) | V1 ist READ-ONLY für Entity-Daten                | Organigramm darf keine Main-Daten ändern (V1)   |

---

**Dieses Dokument ist der Execution Plan. Jede Session startet hier,
nimmt das nächste unchecked Item, und markiert es als done.**
