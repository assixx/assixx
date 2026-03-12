# ADR-034: Hierarchy Labels Propagation

| Metadata                | Value                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                                       |
| **Date**                | 2026-03-11                                                                                                     |
| **Decision Makers**     | SCS-Technik Team                                                                                               |
| **Affected Components** | Backend (1 endpoint update), Frontend (50+ files: layout, navigation, breadcrumb, 22+ page modules)            |
| **Supersedes**          | ---                                                                                                            |
| **Related ADRs**        | ADR-012 (Route Security Groups), ADR-020 (Per-User Permissions), ADR-024 (Feature Guards), ADR-026 (TPM Arch.) |

---

## Context

Assixx unterstützt seit dem Organigramm-Feature (V1) tenant-spezifische Hierarchy Labels — jeder Tenant kann seine Organisationsebenen umbenennen (z.B. "Bereiche" → "Hallen", "Abteilungen" → "Segmente"). **Problem:** V1 zeigte diese Labels ausschließlich auf der Organigramm-Seite. Alle anderen ~40 Seiten verwendeten weiterhin hardcoded deutsche Strings.

| Problem                          | Impact                                                            |
| -------------------------------- | ----------------------------------------------------------------- |
| Inkonsistente Terminologie       | User sieht "Hallen" im Organigramm, aber "Bereiche" überall sonst |
| Keine zentrale Label-Quelle      | Jedes Modul hat eigene `constants.ts` mit statischen Strings      |
| Label-Änderung ohne Wirkung      | Tenant ändert Labels, aber 90% der UI ignoriert die Änderung      |
| Skalierbarkeit bei neuen Modulen | Jedes neue Modul kopiert hardcoded Strings statt Labels zu nutzen |

### Scope

5 Hierarchie-Ebenen, nur Plural-Form:

| Ebene        | Default (DE)  | Beispiel (Custom) |
| ------------ | ------------- | ----------------- |
| `hall`       | "Hallen"      | "Gebäude"         |
| `area`       | "Bereiche"    | "Hallen"          |
| `department` | "Abteilungen" | "Segmente"        |
| `team`       | "Teams"       | "Teilbereiche"    |
| `asset`      | "Anlagen"     | "Maschinen"       |

---

## Decision

### 1. Datenmodell: Plural-Only Labels

**Entscheidung:** Ein String pro Ebene, immer Plural. Kein Singular/Plural-Split.

**Warum?**

- KISS: Ein Feld statt zwei pro Ebene (5 statt 10 Strings)
- Deutsche Komposita ("Bereichsleiter") lassen sich nicht generisch aus Singular+Plural ableiten
- Stellen die Singular brauchen nutzen neutrale Formulierungen ("Hinzufügen" statt "Neuer Bereich")

```typescript
export interface HierarchyLabels {
  hall: string; // z.B. "Gebäude"
  area: string; // z.B. "Hallen"
  department: string; // z.B. "Segmente"
  team: string; // z.B. "Teilbereiche"
  asset: string; // z.B. "Maschinen"
}
```

### 2. Transport: SSR Layout Data Inheritance

**Entscheidung:** Labels werden einmalig im App-Layout geladen und per SvelteKit Data Inheritance an alle Child-Pages propagiert.

```
Backend                    Frontend
┌──────────────────┐      ┌─────────────────────────────┐
│ GET /organigram/ │      │ (app)/+layout.server.ts     │
│ hierarchy-labels │ ←──── │   Promise.all([             │
│ (public, cached) │      │     fetchCounts(),          │
└──────────────────┘      │     fetchTheme(),           │
                          │     fetchHierarchyLabels(), │ ← parallel, kein Waterfall
                          │   ])                        │
                          │   return { hierarchyLabels }│
                          └────────────┬────────────────┘
                                       │ Data Inheritance (automatisch)
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
              +page.svelte      +page.svelte       +page.svelte
              data.hierarchyLabels (überall verfügbar)
```

**Warum Data Inheritance statt Svelte Context?**

- Context funktioniert nicht in plain `.ts` Dateien (`constants.ts`, `utils.ts`, `navigation-config.ts`)
- Data Inheritance ist der SvelteKit-Standard für Layout → Page Datenfluss
- Kein `await parent()` nötig — Labels sind automatisch in `data` verfügbar
- Kein zusätzlicher API-Call pro Page — Layout lädt einmalig

**Warum nicht `$page.data` in Components?**

- Versteckte Abhängigkeit: Component hängt implizit von Layout-Daten ab
- Nicht testbar: `$page` muss in Tests gemockt werden
- Explizite Props sind klarer und typsicher

### 3. Constants-Pattern: Factory + Backward-Compatible Export

**Entscheidung:** Jedes Modul mit Hierarchy-Strings bekommt eine Factory-Funktion. Ein statischer Export bleibt für ungeänderte Consumer erhalten.

```typescript
// constants.ts — Factory erzeugt Objekt mit dynamischen + statischen Properties
const BASE_MESSAGES = {
  // ~20 statische Strings (kein Label-Bezug)
  PAGE_TITLE: 'Anlagen verwalten',
  BTN_SAVE: 'Speichern',
  // ...
} as const;

export function createMessages(labels: HierarchyLabels) {
  return {
    ...BASE_MESSAGES,
    // Nur dynamische Overrides
    HEADING: `${labels.asset} — Übersicht`,
    COL_AREA: labels.area,
    COL_DEPARTMENT: labels.department,
  } as const;
}

// Backward-compat: Ungeänderte Consumer importieren weiterhin MESSAGES
export const MESSAGES = createMessages(DEFAULT_HIERARCHY_LABELS);

// Type-Alias für Child-Components
export type ModuleMessages = ReturnType<typeof createMessages>;
```

**Warum Factory + Backward-Compat statt Breaking Change?**

- Inkrementelles Rollout: Pages werden einzeln gewired, Rest funktioniert weiterhin
- Kein Big-Bang-Refactoring: Nur Pages die dynamische Properties nutzen müssen geändert werden
- Type-Safety: `ReturnType<typeof createMessages>` gibt exakten Typ ohne separate Interface-Definition

### 4. Page Wiring: Prop Threading

**Entscheidung:** `+page.svelte` erzeugt Messages aus Labels, Child-Components empfangen Messages als Prop.

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { createMessages } from './_lib/constants';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();
  const labels = $derived(data.hierarchyLabels);
  const messages = $derived(createMessages(labels));
</script>

<ChildComponent {messages} />
```

```svelte
<!-- ChildComponent.svelte -->
<script lang="ts">
  import type { ModuleMessages } from './constants';

  interface Props { messages: ModuleMessages; }
  const { messages }: Props = $props();
</script>

<h1>{messages.HEADING}</h1>
```

**Warum Prop Threading statt Context/Store?**

- Explizit: Jede Abhängigkeit ist in der Component-Signatur sichtbar
- Testbar: Messages können direkt als Prop injiziert werden
- Konsistent: Folgt dem etablierten SvelteKit-Pattern für Datenfluss
- Kein Boilerplate: 3 Zeilen im Page-Script, 1 Zeile im Child

### 5. Backend: Public Endpoint mit Role-Level Guards

**Entscheidung:** `/organigram/hierarchy-labels` ist für alle authentifizierten Rollen zugänglich (root, admin, employee), da Labels in der gesamten UI benötigt werden.

```typescript
@Get('hierarchy-labels')
@Roles(UserRole.ROOT, UserRole.ADMIN, UserRole.EMPLOYEE)
async getHierarchyLabels(@Req() req): Promise<HierarchyLabelsResponse> {
  // Liest aus organigram_trees WHERE tenant_id = req.tenantId
  // Fallback auf DEFAULT_HIERARCHY_LABELS wenn kein Tree existiert
}
```

**Warum kein separater Endpoint?**

- Labels sind bereits im Organigramm-Tree gespeichert (`custom_labels` JSONB-Feld)
- Ein zusätzlicher Endpoint hätte DB-Schema-Duplizierung bedeutet
- Bestehende RLS-Policies schützen die Daten automatisch

---

## Alternatives Considered

### A. Svelte Context API (Rejected)

**Pros:** Kein Prop Drilling, Labels einmal setzen → überall verfügbar
**Cons:** Funktioniert nicht in plain `.ts` Dateien (constants, utils, navigation-config). Diese Dateien haben keinen Component-Lifecycle und können `getContext()` nicht aufrufen. Da ~50% der Label-Verwendungen in `.ts` Dateien stattfinden, wäre ein Hybrid nötig gewesen (Context für Components, Parameter für .ts) — inkonsistent.

### B. Svelte Store ($state in .svelte.ts) (Rejected)

**Pros:** Reactive, global verfügbar, auch in .ts-Dateien nutzbar
**Cons:** Globaler State für tenant-spezifische Daten widerspricht dem SSR-Pattern. Labels könnten zwischen Requests/Tenants leaken. SvelteKit's Data Inheritance ist die idiomatische Lösung für Layout → Page Datenfluss.

### C. Inline Label Resolution (Rejected)

**Pros:** Jede Stelle löst Labels selbst auf: `data.hierarchyLabels.area`
**Cons:** Kein zentrales Mapping von Property → Label. Wenn sich die Label-Struktur ändert, müssen alle ~250 Stellen einzeln aktualisiert werden. Factory-Pattern zentralisiert die Zuordnung.

### D. Backend-Side String Rendering (Rejected)

**Pros:** Backend liefert fertig gerenderte Strings, Frontend zeigt nur an
**Cons:** Backend müsste alle ~250 UI-Strings kennen und rendern. Mischt Presentation-Logik in die API. Vervielfacht API-Payload. Frontend-Lokalisation wird unmöglich.

### E. i18n Library (Rejected)

**Pros:** Professionelle Lösung für String-Management, Plural-Handling
**Cons:** Massiver Overkill — Assixx ist eine deutschsprachige App. Die 5 Hierarchy Labels sind die einzigen dynamischen Strings. Eine i18n-Library für 5 Variablen einzuführen wäre Over-Engineering. Kann in V3 eingeführt werden falls Mehrsprachigkeit benötigt wird.

---

## Consequences

### Positive

- **Konsistente UX**: Tenant-spezifische Labels überall sichtbar — Sidebar, Breadcrumb, Tabellen-Header, Formulare, Tooltips
- **Kein Performance-Impact**: Labels werden parallel mit bestehenden Layout-Fetches geladen (ein zusätzlicher leichtgewichtiger API-Call)
- **Inkrementelles Rollout**: Backward-compatible Exports erlauben schrittweises Wiring ohne Big-Bang
- **Type-Safe**: `ReturnType<typeof createMessages>` gibt exakten Typ, keine `any` oder `Record<string, string>`
- **SSR-kompatibel**: Labels sind beim First Paint bereits korrekt (kein Flash of Default Labels)
- **Testbar**: Factory-Funktionen sind pure Functions, Props sind direkt injizierbar
- **~360 String-Ersetzungen** in ~50+ Dateien — vollständig per Factory-Pattern abgedeckt (V2: ~250, V2.1: ~110)

### Negative

- **Prop Threading Boilerplate**: Jede Child-Component braucht `messages` Prop + Type-Import (3-5 Zeilen pro Component)
- **Plural-Only Limitation**: "Bereichsleiter" kann nicht dynamisch zu "Hallenleiter" werden — nutzt stattdessen "Leiter" oder wird übersprungen (KL#2)
- **Kein Live-Update**: Label-Änderungen werden erst nach Navigation/Reload sichtbar, nicht in Echtzeit
- **~~7 Module nicht propagiert~~ (V2.1 RESOLVED)**: employee-dashboard, documents-explorer, calendar, shifts, kvp, kvp-detail, blackboard — alle ~110 Stellen in V2.1 nachpropagiert
- **Keine E-Mail/PDF-Propagation**: Backend-generierte Texte (Notifications, Exports) nutzen weiterhin Default-Labels
- **`hall` ist kein OrgEntityType**: Hall hat keine eigene Org-Chart-Farbe in `ENTITY_COLORS`, sondern eine separate `HALL_COLOR`-Konstante im Organigram-Modal

---

## Implementation Summary

| Phase | Scope                                                | Sessions    | Dateien |
| ----- | ---------------------------------------------------- | ----------- | ------- |
| 1     | Backend: Public Endpoint                             | 1           | 2       |
| 2     | Frontend: Layout + Nav + Breadcrumb                  | 1           | 5       |
| 3     | Management-Seiten (areas, depts, teams, assets)      | 2           | ~20     |
| 4     | Remaining Pages (halls, admins, dashboard, TPM, ...) | 4           | ~25     |
| 5     | Smoke Test + Docs + Polish                           | 1 (pending) | ~3      |
| V2.1  | Nachpropagation: 7 zurückgestellte Module            | 1           | ~35     |

**Total:** 9 Sessions, ~360 String-Ersetzungen, 0 Breaking Changes.

---

## References

- [Hierarchy Labels Propagation Masterplan](../../FEAT_HIERARCHY_LABELS_PROPAGATION_MASTERPLAN.md) — Full execution plan (8 Sessions, Phasen 1-5)
- [Organigramm Masterplan](../../FEAT_ORGANIGRAM_MASTERPLAN.md) — V1 Organigramm (Known Limitation #5 → dieses Feature)
- [ADR-012](./ADR-012-frontend-route-security-groups.md) — Frontend Route Security Groups (Layout-Struktur)
- [ADR-020](./ADR-020-per-user-feature-permissions.md) — Per-User Feature Permissions
- [ADR-024](./ADR-024-frontend-feature-guards.md) — Frontend Feature Guards
- [ADR-026](./ADR-026-tpm-architecture.md) — TPM Architecture (eines der propagierten Module)
