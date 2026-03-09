# FEAT: Organigramm — Execution Masterplan

> **Created:** 2026-03-09
> **Version:** 0.1.0 (Draft)
> **Status:** DRAFT — Phase 0 (Planung)
> **Branch:** `feat/organigram`
> **Author:** SCS Technik (Senior Engineer)
> **Estimated Sessions:** 12
> **Actual Sessions:** 0 / 12

---

## Changelog

| Version | Datum      | Änderung                           |
| ------- | ---------- | ---------------------------------- |
| 0.1.0   | 2026-03-09 | Initial Draft — Phasen 1-6 geplant |

---

## Was wird gebaut?

Ein visueller Organigramm-Builder unter `/settings/organigram` (Root only), der:

1. **Firmenname + Standort** oben anzeigt (aus `tenants` Tabelle)
2. **Große Canvas-Fläche** bietet, auf der Blöcke (Rechtecke) erstellt werden können
3. **Blöcke** repräsentieren Areas, Departments, Teams, Assets — visuell als verschiebbare Rechtecke
4. **Linien** verbinden Parent-Child-Beziehungen (Area→Dept, Dept→Team)
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

- [ ] Docker Stack running (alle Container healthy)
- [ ] DB Backup erstellt
- [ ] Branch `feat/organigram` checked out
- [ ] Keine pending Migrations
- [ ] Bestehende Tests grün

### 0.2 Risk Register

| #   | Risiko                                         | Impact  | Wahrscheinlichkeit | Mitigation                                                          | Verifikation                                    |
| --- | ---------------------------------------------- | ------- | ------------------ | ------------------------------------------------------------------- | ----------------------------------------------- |
| R1  | SVG Drag&Drop Performance bei vielen Knoten    | Mittel  | Niedrig            | Virtualisierung ab >200 Nodes, aber typisch <50                     | Performance-Test mit 100 Nodes                  |
| R2  | `tenants.settings` JSONB Kollision mit anderem | Hoch    | Niedrig            | Dedicated Key `orgHierarchy`, JSONB Merge (nicht Overwrite)         | Unit Test: Settings-Update preserved other keys |
| R3  | Positions-Tabelle wächst bei vielen Entities   | Niedrig | Niedrig            | UNIQUE constraint, max ~500 Rows pro Tenant                         | DB Query Performance Test                       |
| R4  | Browser-Kompatibilität SVG pointer events      | Mittel  | Niedrig            | Standard SVG + pointer events (IE nicht unterstützt, kein Problem)  | Test in Chrome, Firefox, Safari                 |
| R5  | Concurrent Edits (zwei Roots gleichzeitig)     | Mittel  | Niedrig            | Last-write-wins mit `updated_at` Check, kein Real-Time-Collab nötig | Unit Test: Concurrent Update                    |

### 0.3 Ecosystem Integration Points

| Bestehendes System | Art der Integration                                  | Phase |
| ------------------ | ---------------------------------------------------- | ----- |
| `tenants.settings` | JSONB Merge für Hierarchie-Labels                    | 2     |
| Areas CRUD         | Lesen + Erstellen von Areas über bestehende Services | 2     |
| Departments CRUD   | Lesen + Erstellen über bestehende Services           | 2     |
| Teams CRUD         | Lesen + Erstellen über bestehende Services           | 2     |
| Assets CRUD        | Lesen (nur Anzeige im Organigramm)                   | 2     |
| Navigation Config  | Neuer Menüpunkt unter "System" (Root only)           | 5     |
| Audit Logging      | Hierarchie-Label-Änderungen loggen                   | 6     |

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
org_chart_positions (
  uuid            UUID PRIMARY KEY,
  tenant_id       INT NOT NULL,
  entity_type     VARCHAR(20) NOT NULL,  -- 'area' | 'department' | 'team' | 'asset'
  entity_uuid     CHAR(36) NOT NULL,
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

### Step 1.1: Tabelle `org_chart_positions` + RLS [PENDING]

**Neue Datei:** `database/migrations/{timestamp}_create-org-chart-positions.ts`

**Was passiert:**

1. `CREATE TABLE org_chart_positions` mit allen Spalten (siehe A2)
2. `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
3. RLS Policy mit `NULLIF(current_setting('app.tenant_id', true), '')` Pattern
4. `GRANT SELECT, INSERT, UPDATE, DELETE ON org_chart_positions TO app_user`
5. Indexes: `tenant_id`, `(tenant_id, entity_type)`, `UNIQUE(tenant_id, entity_type, entity_uuid)`
6. `up()` UND `down()` implementiert

**Mandatory Checklist:**

- [ ] `uuid UUID PRIMARY KEY` (UUIDv7)
- [ ] `tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- [ ] `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- [ ] RLS Policy mit `NULLIF` Pattern
- [ ] `GRANT` für `app_user`
- [ ] `is_active INTEGER NOT NULL DEFAULT 1`
- [ ] `up()` UND `down()` implementiert

**Kein Seed-Data nötig:** Positionen werden dynamisch beim ersten Öffnen per Auto-Layout berechnet.

**Kein Schema-Change an `tenants`:** `settings` JSONB existiert bereits.

### Phase 1 — Definition of Done

- [ ] 1 Migrationsdatei mit `up()` AND `down()`
- [ ] Dry-Run bestanden
- [ ] Migration erfolgreich angewendet
- [ ] `org_chart_positions` existiert mit RLS Policy
- [ ] Backend kompiliert fehlerfrei
- [ ] Bestehende Tests laufen weiterhin

---

## Phase 2: Backend Module

> **Abhängigkeit:** Phase 1 complete
> **Neues Verzeichnis:** `backend/src/nest/organigram/`

### Step 2.1: Module Skeleton + Types + DTOs [PENDING]

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
  children: OrgChartNode[];
  leadName?: string; // Area/Dept/Team Lead Name
  memberCount?: number; // Anzahl Mitglieder
}

interface OrgChartTree {
  companyName: string;
  address: string | null;
  hierarchyLabels: HierarchyLabels;
  nodes: OrgChartNode[]; // Top-Level = Areas
}
```

### Step 2.2: OrganigramSettingsService [PENDING]

**Datei:** `backend/src/nest/organigram/organigram-settings.service.ts`

**Methoden:**

- `getHierarchyLabels(tenantId): HierarchyLabels` — Liest aus `tenants.settings`, Fallback auf Defaults
- `updateHierarchyLabels(tenantId, labels): HierarchyLabels` — JSONB Merge Update (nicht Overwrite!)

**Kritisch:** JSONB Merge via `jsonb_set()` oder `||` Operator — bestehende Settings dürfen NICHT überschrieben werden.

```sql
UPDATE tenants
SET settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb
WHERE id = $1
RETURNING settings;
```

### Step 2.3: OrganigramLayoutService [PENDING]

**Datei:** `backend/src/nest/organigram/organigram-layout.service.ts`

**Methoden:**

- `getPositions(tenantId): OrgChartPosition[]` — Alle Positionen für Tenant
- `upsertPositions(tenantId, positions[]): void` — Batch-UPSERT via `ON CONFLICT DO UPDATE`
- `deletePosition(tenantId, entityType, entityUuid): void` — Position entfernen

**Pattern:** `db.tenantTransaction()` für alle Queries.

### Step 2.4: OrganigramService (Aggregation) [PENDING]

**Datei:** `backend/src/nest/organigram/organigram.service.ts`

**Methoden:**

- `getOrgChartTree(tenantId): OrgChartTree` — Aggregiert alles:
  1. Tenant-Daten (company_name, address)
  2. Hierarchy Labels (aus Settings)
  3. Areas mit Lead-Namen + Department-Count
  4. Departments mit Lead-Namen + Team-Count + area_id
  5. Teams mit Lead-Namen + Member-Count + department_id
  6. Assets mit department_id + area_id
  7. Positions für alle Entities
  8. Baut Tree-Struktur auf (Areas → Departments → Teams → Assets)

**Abhängigkeiten:** `OrganigramSettingsService`, `OrganigramLayoutService`, `DatabaseService`

### Step 2.5: OrganigramController [PENDING]

**Datei:** `backend/src/nest/organigram/organigram.controller.ts`

**Endpoints (4 total):**

| Method | Route                        | Guard     | Beschreibung              |
| ------ | ---------------------------- | --------- | ------------------------- |
| GET    | /organigram/tree             | Root only | Kompletter Org-Chart-Tree |
| GET    | /organigram/hierarchy-labels | Root only | Aktuelle Hierarchy-Labels |
| PATCH  | /organigram/hierarchy-labels | Root only | Labels aktualisieren      |
| PUT    | /organigram/positions        | Root only | Batch-UPSERT Positionen   |

**Jeder Endpoint:**

- [ ] Root-Rolle via Guard prüfen (`role === 'root'`)
- [ ] `tenantId` aus CLS Context
- [ ] Raw Data returnen (ResponseInterceptor wrapped automatisch)
- [ ] Kein Feature-Gate nötig (Settings-Page, kein Feature-Toggle)

### Step 2.6: Registrierung in app.module.ts [PENDING]

- [ ] `OrganigramModule` zu imports Array (alphabetisch sortiert)

### Phase 2 — Definition of Done

- [ ] `OrganigramModule` registriert in `app.module.ts`
- [ ] 3 Services implementiert und injiziert
- [ ] Controller mit 4 Endpoints
- [ ] `db.tenantTransaction()` für alle tenant-scoped Queries
- [ ] JSONB Merge (nicht Overwrite) für Settings
- [ ] `??` nicht `||`, kein `any`, explizite Boolean-Checks
- [ ] ESLint 0 Errors: `docker exec assixx-backend pnpm exec eslint backend/src/nest/organigram/`
- [ ] Type-Check passed: `docker exec assixx-backend pnpm run type-check`
- [ ] Alle DTOs nutzen Zod + `createZodDto()` Pattern

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

- [ ] Default-Labels wenn `settings` NULL
- [ ] Default-Labels wenn `settings.orgHierarchy` fehlt
- [ ] Partial Update preserved bestehende Settings
- [ ] Validierung: leere Strings nicht erlaubt
- [ ] Validierung: Label max 50 Zeichen

**Layout:**

- [ ] UPSERT: Insert neuer Position
- [ ] UPSERT: Update bestehender Position
- [ ] Batch-UPSERT: mehrere Positionen gleichzeitig
- [ ] Delete Position
- [ ] Tenant-Isolation: Tenant A sieht nicht Tenant B

**Aggregation:**

- [ ] Leerer Tenant (keine Areas/Depts/Teams)
- [ ] Tree-Aufbau: Area → Department → Team Verschachtelung korrekt
- [ ] Assets korrekt zugeordnet
- [ ] Lead-Namen aufgelöst
- [ ] Member-Count korrekt
- [ ] Positions merged mit Entity-Daten

### Phase 3 — Definition of Done

- [ ] > = 55 Unit Tests total
- [ ] Alle Tests grün
- [ ] Tenant-Isolation verifiziert
- [ ] Edge Cases für leeren Tenant getestet
- [ ] Coverage: Alle public Methoden haben mindestens 1 Test

---

## Phase 4: API Integration Tests

> **Abhängigkeit:** Phase 3 complete
> **Datei:** `backend/test/organigram.api.test.ts`

### Szenarien (>= 15 Assertions)

**Auth:**

- [ ] Unauthenticated → 401
- [ ] Employee → 403 (Root only)
- [ ] Admin → 403 (Root only)
- [ ] Root → 200

**GET /organigram/tree:**

- [ ] 200 mit korrekter Tree-Struktur
- [ ] companyName + address aus Tenant
- [ ] Default hierarchyLabels wenn keine gesetzt

**PATCH /organigram/hierarchy-labels:**

- [ ] 200 mit neuen Labels
- [ ] 400 bei leerem String
- [ ] Partial Update (nur area.singular ändern)
- [ ] Settings-Merge preserved andere Keys

**PUT /organigram/positions:**

- [ ] 200 bei Batch-UPSERT
- [ ] 400 bei ungültigem entityType
- [ ] Positionen persistent nach Neuladen

### Phase 4 — Definition of Done

- [ ] > = 15 API Integration Tests
- [ ] Alle Tests grün
- [ ] Root-Only-Access verifiziert
- [ ] Tenant-Isolation verifiziert

---

## Phase 5: Frontend

> **Abhängigkeit:** Phase 2 complete (Backend-Endpoints verfügbar)

### Route-Struktur

```
frontend/src/routes/(app)/(root)/settings/organigram/
    +page.svelte              # Hauptseite
    +page.server.ts           # Auth (Root only) + SSR Data Loading
    _lib/
        api.ts                # apiClient Wrapper
        types.ts              # TypeScript Interfaces (Mirror von Backend)
        constants.ts          # Default-Labels, Farben pro Ebene
        state.svelte.ts       # Svelte 5 State ($state)
        OrgCanvas.svelte      # SVG Canvas Container (Pan/Zoom)
        OrgNode.svelte        # Einzelner Block (Rect + Text)
        OrgConnection.svelte  # Verbindungslinie (Bézier Path)
        OrgToolbar.svelte     # Toolbar: Zoom, Auto-Layout, Speichern
        HierarchyLabelsModal.svelte  # Modal für Label-Customization
```

### Step 5.1: Grundstruktur + SSR [PENDING]

**+page.server.ts:**

```typescript
export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (!token) redirect(302, '/login');
  const { user } = await parent();
  if (user.role !== 'root') redirect(302, '/permission-denied');
  // Fetch org chart tree
};
```

### Step 5.2: SVG Canvas Component [PENDING]

**OrgCanvas.svelte — Kernkomponente:**

- SVG mit `viewBox` für Pan/Zoom
- Mausrad → Zoom (0.5x bis 3x)
- Mittelklick-Drag → Pan
- Touch-Support (pinch zoom)
- Grid-Hintergrund (optional, subtile Punkte)

### Step 5.3: OrgNode.svelte — Verschiebbare Blöcke [PENDING]

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
- Klick: Detail-Panel oder Inline-Edit für Name
- Resize-Handles an Ecken (optional V2)

### Step 5.4: OrgConnection.svelte — Verbindungslinien [PENDING]

- SVG `<path>` mit kubischer Bézier-Kurve
- Von Parent-Block-Unterseite → Kind-Block-Oberseite
- Automatische Neuberechnung bei Drag
- Pfeil am Ende (optional)
- Farbe: Grau, bei Hover des Parents hervorgehoben

### Step 5.5: Auto-Follow-Logik [PENDING]

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

### Step 5.6: Toolbar + Hierarchie-Labels-Modal [PENDING]

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

### Step 5.7: Navigation Config Update [PENDING]

**navigation-config.ts — `rootMenuItems` System-Submenu erweitern:**

```typescript
{
  id: 'system',
  icon: ICONS.settings,
  label: 'System',
  submenu: [
    { id: 'design', label: 'Design', url: '/settings/design' },
    { id: 'organigram', label: 'Organigramm', url: '/settings/organigram' },  // NEU
    { id: 'account-settings', label: 'Kontoeinstellungen', url: '/account-settings' },
  ],
}
```

### Step 5.8: Top-Bereich: Firma + Standort [PENDING]

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

- [ ] Seite rendert für Root-User
- [ ] Root-only Access (Redirect für Admin/Employee)
- [ ] Firmenname + Standort korrekt angezeigt
- [ ] Blöcke für alle Areas/Departments/Teams/Assets
- [ ] Drag & Drop funktioniert
- [ ] Verbindungslinien korrekt gezeichnet
- [ ] Auto-Follow bei Parent-Verschiebung
- [ ] Hierarchie-Labels anpassbar via Modal
- [ ] Positionen werden gespeichert (persistent nach Reload)
- [ ] Auto-Layout für Entities ohne gespeicherte Position
- [ ] Navigation Config aktualisiert
- [ ] svelte-check 0 Errors, 0 Warnings
- [ ] ESLint 0 Errors
- [ ] Responsive (mindestens Desktop 1024px+, Tablet sinnvoll)
- [ ] Deutsche Labels überall

---

## Phase 6: Integration + Polish

> **Abhängigkeit:** Phase 5 complete

### Integrationen

- [ ] Audit Logging: Hierarchie-Label-Änderungen via ActivityLoggerService
- [ ] Breadcrumb: "System > Organigramm"
- [ ] Info-Tooltip: Erklärung was Hierarchie-Labels bewirken

### Labels-Propagation (WICHTIG)

Wenn Hierarchie-Labels geändert werden, müssen sie überall im System wirken:

- [ ] Sidebar-Labels (z.B. "Bereiche verwalten" → "Hallen verwalten")
- [ ] Formulare (z.B. "Abteilung auswählen" → "Segment auswählen")
- [ ] Breadcrumbs, Page-Titles, Tooltips

**Implementierung:** Frontend lädt Labels einmalig im Root-Layout und stellt sie via Svelte Context bereit. Alle Komponenten die "Bereich"/"Abteilung"/"Team" anzeigen, lesen aus dem Context statt Hardcoded.

### Phase 6 — Definition of Done

- [ ] Audit Logging für Label-Änderungen
- [ ] Labels wirken systemweit (mindestens auf Organigramm-Seite)
- [ ] Keine offenen TODOs im Code

---

## Session Tracking

| Session | Phase | Beschreibung                                  | Status  | Datum |
| ------- | ----- | --------------------------------------------- | ------- | ----- |
| 1       | 1     | Migration: org_chart_positions                | PENDING |       |
| 2       | 2     | Module Skeleton + Types + DTOs                | PENDING |       |
| 3       | 2     | Settings + Layout Services                    | PENDING |       |
| 4       | 2     | Aggregation Service + Controller              | PENDING |       |
| 5       | 3     | Unit Tests (55+ Tests)                        | PENDING |       |
| 6       | 4     | API Integration Tests (15+ Tests)             | PENDING |       |
| 7       | 5     | Frontend: Grundstruktur + SSR + Types         | PENDING |       |
| 8       | 5     | Frontend: SVG Canvas + OrgNode + Drag&Drop    | PENDING |       |
| 9       | 5     | Frontend: Connections + Auto-Follow           | PENDING |       |
| 10      | 5     | Frontend: Toolbar + Labels-Modal + Navigation | PENDING |       |
| 11      | 5     | Frontend: Firma/Standort Header + Auto-Layout | PENDING |       |
| 12      | 6     | Integration + Audit + Labels-Propagation      | PENDING |       |

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

1. **Kein Real-Time-Collaboration** — Nur ein Root gleichzeitig editiert. Kein WebSocket/SSE für Live-Sync.
2. **Kein Resize von Blöcken in V1** — Nur Verschieben. Alle Blöcke haben fixe Default-Größe. Resize kommt in V2.
3. **Keine neuen Entities aus dem Organigramm erstellen** — V1 zeigt nur bestehende Areas/Depts/Teams. Erstellen über bestehende Management-Seiten. V2 kann "Block erstellen" → direkt Area/Dept anlegen.
4. **Labels-Propagation nur auf Organigramm-Seite** — Systemweite Propagation (Sidebar, alle Seiten) ist V2. V1 zeigt die angepassten Labels nur im Organigramm.
5. **Kein Export (PDF/PNG)** — V2.
6. **Kein Minimap** — V2 bei Bedarf.
7. **Keine Touch-Gesten** — Desktop-first. Touch-Support in V2.

---

## Spec Deviations

| #   | Spec sagt                          | Tatsächlicher Code       | Entscheidung                                    |
| --- | ---------------------------------- | ------------------------ | ----------------------------------------------- |
| D1  | areas hat parent_id (HIERARCHY.md) | areas hat KEIN parent_id | Kein parent_id nötig für V1, Hierarchy ist flat |

---

**Dieses Dokument ist der Execution Plan. Jede Session startet hier,
nimmt das nächste unchecked Item, und markiert es als done.**
