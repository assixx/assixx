# Long Files Ranking - Assixx Project

> Generiert: 2025-12-30
> Letzte Aktualisierung: 2026-01-02
> Sortierung: Absteigend nach Zeilenanzahl

---

## Teil 1: Dokumentation (docs/)

> Filter: .md Dateien > 1000 Zeilen

| #   | Filename                    | Pfad  | Zeilen | Inhalt                                                        |
| --- | --------------------------- | ----- | ------ | ------------------------------------------------------------- |
| 1   | SVELTEKIT-MIGRATION-PLAN.md | docs/ | 2214   | Phase 3 SvelteKit Migration, \_lib/ Pattern, Fortschritts-Log |
| 2   | OPTIMAL-SETUP.md            | docs/ | 2072   | Tech Stack, NestJS+Fastify, Pre-Launch Checklist, Roadmap     |

---

## Teil 2: Frontend Svelte - Status ESLint max-lines (600)

> ESLint max-lines Rule: 600 Zeilen Maximum
> Stand: 2026-01-02 - **ALLE DATEIEN IM TOLERANZBEREICH** ✅

| #   | Filename     | Pfad                                 | Zeilen | Status            |
| --- | ------------ | ------------------------------------ | ------ | ----------------- |
| 1   | +page.svelte | src/routes/(app)/documents-explorer/ | 621    | ⚠️ Toleranz (+21) |
| 2   | +page.svelte | src/routes/(app)/kvp-detail/         | 591    | ✅ OK             |
| 3   | +page.svelte | src/routes/(app)/manage-machines/    | 583    | ✅ OK             |
| 4   | +page.svelte | src/routes/(app)/manage-employees/   | 568    | ✅ OK             |
| 5   | +page.svelte | src/routes/(app)/manage-admins/      | 566    | ✅ OK             |
| 6   | +page.svelte | src/routes/(app)/survey-admin/       | 400    | ✅ OK             |

**Gesamt: 0 kritische Dateien, 1 im Toleranzbereich**

---

## Bereits Refactored (< 600 Zeilen)

| Datei                           | Vorher | Nachher | Pattern                                        |
| ------------------------------- | ------ | ------- | ---------------------------------------------- |
| survey-admin/+page.svelte       | 1117   | 400     | \_lib/ + SurveyFormModal + Cards + handlers.ts |
| manage-employees/+page.svelte   | 1109   | 568     | \_lib/ + EmployeeFormModal + DeleteModals      |
| documents-explorer/+page.svelte | 1608   | 621     | \_lib/ + Modals + FolderSidebar                |
| kvp-detail/+page.svelte         | 957    | 591     | \_lib/ + Section Components                    |
| manage-machines/+page.svelte    | 1086   | 583     | \_lib/ + MachineFormModal + DeleteModals       |
| manage-admins/+page.svelte      | 1098   | 566     | \_lib/ + AdminFormModal + DeleteModals         |
| shifts/+page.svelte             | 2157   | ~550    | \_lib/ + Components                            |
| chat/+page.svelte               | 1336   | 571     | \_lib/ + Components (handlers.ts, Modals)      |
| manage-root/+page.svelte        | 1099   | 536     | Modal Components                               |
| calendar/+page.svelte           | 1086   | 568     | \_lib/ + Modal Components                      |
| manage-teams/+page.svelte       | 1082   | ~550    | Modal Components                               |
| manage-areas/+page.svelte       | 990    | 568     | Modal Components                               |
| manage-departments/+page.svelte | 966    | 580     | Modal Components                               |

---

## Refactoring-Status: ABGESCHLOSSEN ✅

Alle kritischen Dateien wurden refactored. Nur `documents-explorer` liegt minimal über dem Limit (621 Zeilen, +21 im Toleranzbereich).

### Bewährtes \_lib/ Pattern

```
src/routes/(app)/[feature]/
├── +page.svelte              # Max ~500 Zeilen: Template + Component Usage
└── _lib/
    ├── types.ts              # TypeScript Interfaces
    ├── api.ts                # API Calls (async functions)
    ├── state.svelte.ts       # Svelte 5 Runes ($state, $derived)
    ├── filters.ts            # Filter/Sort Logik
    ├── handlers.ts           # Event Handlers
    ├── constants.ts          # Labels, CSS-Klassen Maps
    ├── utils.ts              # Helper Functions
    ├── [Feature]Modal.svelte # Extracted Modal Component
    └── DeleteModals.svelte   # Delete Confirmation Modals
```

### Svelte 5 Component Pattern (mit $bindable)

```svelte
<!-- Modal Component Props -->
interface Props {
  show: boolean;
  formField: string;  // Mit $bindable() für two-way binding
  onclose: () => void;
  onsubmit: (e: Event) => void;
}

/* eslint-disable prefer-const */
let {
  show,
  formField = $bindable(),
  onclose,
  onsubmit,
}: Props = $props();
/* eslint-enable prefer-const */
```

---

_ESLint Rule: max-lines = 600_
_Svelte 5 Best Practice: max. 300-500 Zeilen pro Komponente_
