# SvelteKit Migration Plan

additional context: docs/LONG-FILES-RANKING.md and frontend-svelte/docs/SSR-MIGRATION-STRATEGY.md read this before reading this

> **Phase 3 des OPTIMAL-SETUP.md Roadmap**
> Erstellt: 2025-12-18 | Aktualisiert: 2026-01-11 | Branch: feature/nestjs-migration
>
> **STATUS: ABGESCHLOSSEN** (2026-01-11)
> ALLE 34 SEITEN MIGRIERT! Manuelles Testing + Bruno API Tests bestanden.
> Frontend-Migration Phase 3 COMPLETE! Unit Tests werden separat getrackt.

---

## Aktueller Stand (2026-01-11) - ABGESCHLOSSEN

```
Phase 3.1 Projekt-Setup:              ████████████████████ 100%  ✅
Phase 3.5 Index-Seite:                ████████████████████ 100%  ✅
Phase 3.5 Login-Seite:                ████████████████████ 100%  ✅
Phase 3.5 Signup-Seite:               ████████████████████ 100%  ✅
Phase 3.5 Dashboard-Root:             ████████████████████ 100%  ✅
Phase 3.5 Dashboard-Admin:            ████████████████████ 100%  ✅
Phase 3.5 Blackboard:                 ████████████████████ 100%  ✅
Phase 3.5 Blackboard-Detail:          ████████████████████ 100%  ✅
Phase 3.5 Manage-Root:                ████████████████████ 100%  ✅
Phase 3.5 Manage-Admins:              ████████████████████ 100%  ✅
Phase 3.5 Manage-Areas:               ████████████████████ 100%  ✅
Phase 3.5 Manage-Departments:         ████████████████████ 100%  ✅
Phase 3.5 Manage-Employees:           ████████████████████ 100%  ✅
Phase 3.5 Manage-Teams:               ████████████████████ 100%  ✅
Phase 3.5 Manage-Machines:            ████████████████████ 100%  ✅
Phase 3.5 Chat:                       ████████████████████ 100%  ✅
Phase 3.5 Features:                   ████████████████████ 100%  ✅
Phase 3.5 Logs:                       ████████████████████ 100%  ✅
Phase 3.5 Root-Profile:               ████████████████████ 100%  ✅
Phase 3.5 Account-Settings:           ████████████████████ 100%  ✅
Phase 3.5 Tenant-Deletion-Status:     ████████████████████ 100%  ✅
Phase 3.5 Tenant-Deletion-Approve:    ████████████████████ 100%  ✅
Phase 3.5 Documents-Explorer:         ████████████████████ 100%  ✅
Phase 3.5 Calendar:                   ████████████████████ 100%  ✅
Phase 3.5 KVP:                        ████████████████████ 100%  ✅
Phase 3.5 KVP-Detail:                 ████████████████████ 100%  ✅
Phase 3.5 Survey-Admin:               ████████████████████ 100%  ✅
Phase 3.5 Survey-Employee:            ████████████████████ 100%  ✅
Phase 3.5 Survey-Results:             ████████████████████ 100%  ✅
Phase 3.5 Shifts:                     ████████████████████ 100%  ✅
Phase 3.5 Admin-Profile:              ████████████████████ 100%  ✅
Phase 3.5 Employee-Dashboard:         ████████████████████ 100%  ✅
Phase 3.5 Rate-Limit:                 ████████████████████ 100%  ✅
Phase 3.5 Storage-Upgrade:            ████████████████████ 100%  ✅
Gesamtfortschritt:                    ████████████████████ 100%  🎉
```

**Letzter Meilenstein:** PHASE 3 COMPLETE - Manuelles Testing + Bruno API Tests (2026-01-11)
**Status:** ✅ ABGESCHLOSSEN! 34/34 Seiten migriert. Frontend-Migration Phase 3 COMPLETE!

### Fertige Seiten:

| Seite                   | Route                                | Status  | Notes                                                 |
| ----------------------- | ------------------------------------ | ------- | ----------------------------------------------------- |
| Landing Page            | `/`                                  | ✅ 100% |                                                       |
| Login                   | `/login`                             | ✅ 100% | Standalone                                            |
| Signup                  | `/signup`                            | ✅ 100% | Standalone                                            |
| Dashboard Root          | `/root-dashboard`                    | ✅ 100% | (app) layout                                          |
| Dashboard Admin         | `/admin-dashboard`                   | ✅ 100% | (app) layout, Blackboard Widget, RoleSwitch fixes     |
| Blackboard              | `/blackboard`                        | ✅ 100% | (app) layout                                          |
| Blackboard Detail       | `/blackboard/[uuid]`                 | ✅ 100% | (app) layout                                          |
| Manage Root             | `/manage-root`                       | ✅ 100% | (app) layout                                          |
| Manage Admins           | `/manage-admins`                     | ✅ 100% | (app) layout                                          |
| Manage Areas            | `/manage-areas`                      | ✅ 100% | (app) layout                                          |
| Manage Departments      | `/manage-departments`                | ✅ 100% | (app) layout                                          |
| Chat                    | `/chat`                              | ✅ 100% | (app) layout                                          |
| Features                | `/features`                          | ✅ 100% | (app) layout                                          |
| Logs                    | `/logs`                              | ✅ 100% | (app) layout                                          |
| Root Profile            | `/root-profile`                      | ✅ 100% | (app) layout                                          |
| Account Settings        | `/account-settings`                  | ✅ 100% | (app) layout                                          |
| Tenant Deletion Status  | `/tenant-deletion-status`            | ✅ 100% | (app) layout                                          |
| Tenant Deletion Approve | `/tenant-deletion-approve?queueId=X` | ✅ 100% | **Standalone** (kein Header/Sidebar)                  |
| Documents Explorer      | `/documents-explorer`                | ✅ 100% | (app) layout                                          |
| Calendar                | `/calendar`                          | ✅ 100% | (app) layout, @event-calendar/core v5.x               |
| KVP                     | `/kvp`                               | ✅ 100% | (app) layout, \_lib/ Pattern                          |
| KVP-Detail              | `/kvp-detail`                        | ✅ 100% | (app) layout, \_lib/ Pattern                          |
| Survey-Admin            | `/survey-admin`                      | ✅ 100% | (app) layout, Survey Management                       |
| Survey-Employee         | `/survey-employee`                   | ✅ 100% | (app) layout, \_lib/ Pattern                          |
| Shifts                  | `/shifts`                            | ✅ 100% | (app) layout, \_lib/ Pattern                          |
| Admin Profile           | `/admin-profile`                     | ✅ 100% | (app) layout, readonly fields, tenant companyName     |
| Employee Dashboard      | `/employee-dashboard`                | ✅ 100% | (app) layout, Welcome Hero, Sakura Petals, SSR        |
| Employee Profile        | `/employee-profile`                  | ✅ 100% | (app) layout, readonly fields, departmentName         |
| Rate Limit              | `/rate-limit`                        | ✅ 100% | **Standalone** (kein Header/Sidebar), Countdown Timer |
| Storage Upgrade         | `/storage-upgrade`                   | ✅ 100% | (app) layout, Plan-Übersicht, SSR                     |

---

## Executive Summary

Migration des Assixx Frontends von **Vanilla TypeScript + Vite Multi-Page** zu **SvelteKit 5** mit vollständiger Integration des bestehenden Design Systems und Tailwind v4.

### Aktuelle Architektur

| Komponente         | Aktuell                      | Ziel                         |
| ------------------ | ---------------------------- | ---------------------------- |
| Frontend Framework | Vanilla TS + Vite MPA        | SvelteKit 5                  |
| Styling            | Tailwind v4 + CSS Variables  | Tailwind v4 + Svelte Scoped  |
| API Client         | fetch + api-client.ts        | api-client.ts (REST)         |
| Routing            | HTML Files (34 Seiten)       | SvelteKit File-based Routing |
| Components         | Storybook JS (25 Stories)    | Svelte Components            |
| Backend            | NestJS + Fastify (Port 3000) | Unverändert                  |

---

## 0. Migration-Philosophie

### 0.1 Legacy Frontend = Goldstandard (PERFEKT!)

> **WICHTIG:** Das bestehende `frontend/` Verzeichnis ist **PERFEKT** und die **EINZIGE Referenz** für das neue SvelteKit Frontend.

| Aspekt                    | Regel                                                       |
| ------------------------- | ----------------------------------------------------------- |
| **Design**                | 1:1 identisch zum Legacy Frontend - **KEINE Abweichungen!** |
| **CSS**                   | Alle Styles aus `frontend/src/styles/` übernehmen           |
| **HTML Struktur**         | Exakt die gleichen Klassen und Elemente                     |
| **Variablen**             | **ALLE Variablen müssen exakt übereinstimmen**              |
| **Design System**         | **ALLE Design System Komponenten nutzen**                   |
| **Funktionalität**        | Gleiche Features, gleiche UX                                |
| **Keine Eigenkreationen** | Keine "Verbesserungen" ohne explizite Anfrage               |

**Workflow für jede neue Seite:**

1. Legacy HTML lesen (`frontend/src/pages/*.html`)
2. Legacy CSS lesen (`frontend/src/styles/*.css`)
3. Legacy JS/TS lesen (`frontend/src/scripts/**/*.ts`)
4. **ALLE Variablen, States und Handler identifizieren**
5. 1:1 in SvelteKit umsetzen mit Runes
6. **Modal/Dropdown Active States nicht vergessen! (siehe 0.3)**

### 0.2 TypeScript in Svelte 5 - Regeln

> **Quelle:** https://svelte.dev/docs/svelte/typescript (Dezember 2025)
>
> **UPDATE (2025-12-21):** TypeScript funktioniert in `.svelte` Dateien MIT `vitePreprocess()`.
> Frühere esrap-Probleme wurden durch korrekte Konfiguration behoben.

#### TypeScript Support nach Dateiendung

| Dateiendung                       | TypeScript            | Runes   | Einschränkungen                     |
| --------------------------------- | --------------------- | ------- | ----------------------------------- |
| `*.ts`                            | ✅ Voll               | ❌ Nein | Keine                               |
| `*.svelte.ts`                     | ✅ Voll               | ✅ Ja   | `$state` Export nur als Objekt      |
| `*.svelte` + `<script lang="ts">` | ✅ mit vitePreprocess | ✅ Ja   | Keine Enums, keine Access Modifiers |

#### Was in `.svelte` Dateien funktioniert (MIT vitePreprocess):

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  // ✅ Interfaces
  interface Props {
    name: string;
    children: Snippet;
  }

  // ✅ Type Annotations
  let { name, children }: Props = $props();

  // ✅ Function Types
  function handleSubmit(e: Event): void {
    console.log(e);
  }

  // ✅ Runes mit Types
  let count: number = $state(0);
  const doubled = $derived(count * 2);
</script>
```

#### Was NICHT funktioniert (auch mit vitePreprocess):

```svelte
<script lang="ts">
  // ❌ Enums (verwende stattdessen const objects)
  enum Status { Active, Inactive }

  // ❌ Parameter Properties (Access Modifiers)
  class User {
    constructor(private name: string) {}  // ❌
  }

  // ❌ $props<T>() Generic Syntax (Bug in manchen Versionen)
  let props = $props<{ name: string }>();  // ❌ Kann problematisch sein
</script>
```

**Workarounds für bekannte Probleme:**

```svelte
<script lang="ts">
  // Statt Enum → const object
  const Status = { Active: 1, Inactive: 0 } as const;
  type StatusType = typeof Status[keyof typeof Status];

  // Statt $props<T>() → Interface + Destructuring
  interface Props { name: string; }
  let { name }: Props = $props();  // ✅ Funktioniert
</script>
```

#### Best Practice: TypeScript auslagern

Für maximale Typsicherheit: Logik in `.ts` Dateien auslagern (siehe Sektion 0.6):

```
_lib/
├── types.ts              # Alle Interfaces/Types
├── api.ts                # API Calls mit vollen Type Annotations
├── state.svelte.ts       # Runes mit TypeScript
└── utils.ts              # Helper Functions
```

Dann in `+page.svelte` nur importieren:

```svelte
<script lang="ts">
  import type { User } from './_lib/types';
  import { loadUsers } from './_lib/api';
  import { userState } from './_lib/state.svelte';
</script>
```

### 0.3 Modal & Dropdown Active States (KRITISCH!)

> **⚠️ WICHTIG:** Diese Pattern werden oft vergessen und führen zu nicht-funktionierenden UI-Komponenten!

**Modal Active State:**

```svelte
<!-- Modal wird nur angezeigt wenn showModal = true -->
<div class="modal-overlay" class:modal-overlay--active={showModal}>
  <div class="ds-modal">
    <!-- Modal content -->
  </div>
</div>

<!-- Event Listener: Overlay-Klick schließt Modal -->
<script>
  let showModal = $state(false);

  /** @param {MouseEvent} e */
  function handleOverlayClick(e) {
    // Nur schließen wenn direkt auf Overlay geklickt wird
    if (e.target === e.currentTarget) {
      showModal = false;
    }
  }
</script>
```

**Dropdown Active State:**

```svelte
<!-- Dropdown öffnet/schließt mit active class -->
<div class="dropdown" id="my-dropdown">
  <div
    class="dropdown__trigger"
    class:active={dropdownOpen}
    onclick={toggleDropdown}
  >
    <span>{selectedValue}</span>
    <i class="fas fa-chevron-down"></i>
  </div>
  <div class="dropdown__menu" class:active={dropdownOpen}>
    {#each options as option}
      <div
        class="dropdown__option"
        onclick={() => selectOption(option)}
      >
        {option.label}
      </div>
    {/each}
  </div>
</div>

<!-- WICHTIG: Outside-Click Handler -->
<script>
  let dropdownOpen = $state(false);

  // Close on outside click
  $effect(() => {
    if (dropdownOpen) {
      /** @param {MouseEvent} e */
      const handleOutsideClick = (e) => {
        const dropdown = document.getElementById('my-dropdown');
        if (dropdown && !dropdown.contains(/** @type {Node} */ (e.target))) {
          dropdownOpen = false;
        }
      };
      document.addEventListener('click', handleOutsideClick);
      return () => document.removeEventListener('click', handleOutsideClick);
    }
  });
</script>
```

**Checkliste für jede neue Seite:**

- [ ] Modal hat `class:modal-overlay--active={showModal}`
- [ ] Modal Overlay hat `onclick` für Close
- [ ] Modal Content hat `onclick|stopPropagation`
- [ ] Dropdown Trigger hat `class:active={dropdownOpen}`
- [ ] Dropdown Menu hat `class:active={dropdownOpen}`
- [ ] Outside-Click Handler für Dropdown vorhanden
- [ ] Escape-Key Handler für Modal vorhanden

### 0.4 Bugfixes im Legacy erlaubt

> **AUSNAHME:** Wenn das Legacy Frontend einen offensichtlichen **UX-Bug** hat, darf dieser gefixt werden.

| Situation                   | Aktion                              |
| --------------------------- | ----------------------------------- |
| **UX-Bug im Legacy**        | Bug fixen, dann 1:1 übernehmen      |
| **Fehlende Styles/Klassen** | Im Legacy ergänzen, dann übernehmen |
| **Sicherheitslücke**        | Sofort fixen in beiden Frontends    |

**Beispiel gefunden (2025-12-19):**

```html
<!-- Legacy Bug: Fehlermeldungen ohne u-hidden -->
<p id="phoneError" class="form-field__message">...</p>
<!-- ❌ War sichtbar -->
<p id="passwordError" class="form-field__message">...</p>
<!-- ❌ War sichtbar -->

<!-- Fix: Konsistent wie emailMatchError -->
<p id="phoneError" class="form-field__message form-field__message--error u-hidden">...</p>
<!-- ✅ -->
<p id="passwordError" class="form-field__message form-field__message--error u-hidden">...</p>
<!-- ✅ -->
```

**Workflow bei Legacy-Bug:**

1. Bug im Legacy identifizieren
2. Bug im Legacy fixen
3. Svelte-Version an gefixtes Legacy anpassen

### 0.5 One-Shot Migration Strategy (PROVEN!)

> **Erfolgreich getestet:** manage-root, manage-admins, manage-areas - alle One-Shot ohne Nacharbeit!

#### Schritt-für-Schritt Vorgehensweise:

| Schritt                   | Aktion                                        | Warum                                                          |
| ------------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| **1. HTML lesen**         | `frontend/src/pages/*.html` vollständig lesen | Struktur, IDs, Klassen verstehen                               |
| **2. CSS lesen**          | `frontend/src/styles/*.css` lesen             | Spezielle Styles identifizieren (meist: Design System = keine) |
| **3. TS-Dateien lesen**   | `frontend/src/scripts/**/*.ts` lesen          | Types, API-Calls, Event Handler, State                         |
| **4. Types extrahieren**  | JSDoc `@typedef` für alle Interfaces          | Svelte 5 kann kein `interface` in `.svelte`                    |
| **5. State definieren**   | `$state()` für alle Variablen                 | Genau gleiche Namen wie Legacy                                 |
| **6. Derived definieren** | `$derived()` für gefilterte Listen            | Ersetzt computed/filter Funktionen                             |
| **7. API-Funktionen**     | fetch-Calls 1:1 übernehmen                    | Gleiche Endpoints, gleiche Response-Handling                   |
| **8. HTML Template**      | Legacy HTML → Svelte Template                 | class:active für Toggling                                      |
| **9. Modals**             | Alle Modals mit svelte-ignore                 | Modal-Pattern ist Standard                                     |
| **10. Dropdowns**         | Custom Dropdowns mit $effect                  | Outside-Click Handler                                          |

#### Worauf achten:

```
✅ IMMER MACHEN:
- Alle Legacy-Variablen 1:1 übernehmen (gleiche Namen!)
- Alle Design System Klassen verwenden (badge--, btn--, action-icon--)
- Modal active state: class:modal-overlay--active={showModal}
- Dropdown active state: class:active={dropdownOpen}
- svelte-ignore Kommentare MIT Begründung
- JSDoc statt TypeScript Annotations

❌ NIEMALS MACHEN:
- TypeScript in <script lang="ts"> verwenden (esrap Parser!)
- Variablen umbenennen oder "verbessern"
- Features hinzufügen die nicht im Legacy sind
- Styles ändern oder "optimieren"
```

#### Template für Modals (Copy-Paste Ready):

```svelte
<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events (Modal overlay - click outside to close pattern) -->
<div
  class="modal-overlay"
  class:modal-overlay--active={showModal}
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  tabindex="-1"
  onclick={handleOverlayClick}
  onkeydown={(e) => e.key === 'Escape' && closeModal()}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events, a11y_no_static_element_interactions (stopPropagation for modal content) -->
  <div class="ds-modal" onclick={(e) => e.stopPropagation()}>
    <!-- Modal content -->
  </div>
</div>
```

#### Erfolgsquote:

| Seite         | One-Shot? | Nacharbeit                          |
| ------------- | --------- | ----------------------------------- |
| manage-root   | ✅ Ja     | Nur: unused vars entfernt           |
| manage-admins | ✅ Ja     | Nur: positionMap type, a11y-ignores |
| manage-areas  | ✅ Ja     | Nur: unused functions, a11y-ignores |

**Fazit:** Mit dieser Strategie funktioniert jede Seite beim ersten Versuch!

### 0.6 Code-Organisation & Dateiaufteilung (KRITISCH!)

> **⚠️ PROBLEM ERKANNT (2025-12-21):** Aktuelle SvelteKit-Seiten haben ALLES in einer Datei!
> Das widerspricht dem Legacy-Pattern und macht Code unwartbar.
>
> **UPDATE (2025-12-21):** TypeScript/JavaScript Regeln präzisiert basierend auf offizieller Svelte 5 Dokumentation.

#### TypeScript vs JavaScript - Wann was verwenden?

> **Quelle:** https://svelte.dev/docs/svelte/typescript + https://svelte.dev/docs/svelte/$state

| Dateiendung                       | TypeScript            | Runes ($state, $derived) | Wann verwenden                        |
| --------------------------------- | --------------------- | ------------------------ | ------------------------------------- |
| `*.ts`                            | ✅ Voll               | ❌ Nein                  | Types, API, Utils, Filters, Constants |
| `*.svelte.ts`                     | ✅ Voll               | ✅ Ja                    | Reaktiver State der exportiert wird   |
| `*.svelte` + `<script lang="ts">` | ✅ mit vitePreprocess | ✅ Ja                    | Components (mit Einschränkungen)      |

**Runes Export-Regel (aus Svelte Docs):**

> "You can only export `$state` if it's not directly reassigned."

**Was bedeutet das?**

```typescript
// ❌ VERBOTEN - direktes Reassignment
export let count = $state(0);
count = 5; // Reassignment!

// ✅ ERLAUBT - Objekt mutieren statt reassignen
export const state = $state({ count: 0 });
state.count = 5; // Mutation, kein Reassignment

// ✅ ERLAUBT - Getter/Setter Pattern
let _count = $state(0);
export const count = {
  get value() { return _count; },
  set value(v) { _count = v; }
};
```

#### Das Legacy-Pattern (GOLDSTANDARD)

Das Legacy Frontend hat eine **saubere Trennung** nach Verantwortlichkeiten:

```
frontend/src/scripts/manage/teams/
├── types.ts      # 91 Zeilen   → TypeScript Interfaces
├── data.ts       # 126 Zeilen  → API Calls (loadTeams, saveTeam, deleteTeam)
├── forms.ts      # 240 Zeilen  → Form Logic (validation, submit handlers)
├── ui.ts         # 780 Zeilen  → UI/DOM Manipulation (render, update)
└── index.ts      # 687 Zeilen  → Main Orchestration (init, event binding)
                    ─────────────
                    ~1924 Zeilen über 5 Dateien
```

**Vorteile:**

- Jede Datei hat EINE Verantwortung (Single Responsibility)
- Einfach zu testen (API separat von UI)
- Einfach zu debuggen (Fehler lokalisierbar)
- Wiederverwendbare Funktionen (helpers in utils)

#### Das FALSCHE SvelteKit-Pattern (WAS WIR GEMACHT HABEN)

```
frontend-svelte/src/routes/(app)/manage-teams/
└── +page.svelte  # 1393 Zeilen → ALLES in einer Datei! ❌
```

**Probleme:**

- ESLint max-lines (300) wird 4.6x überschritten
- Cognitive Complexity explodiert
- Nicht unit-testbar
- Schwer zu debuggen
- Keine Wiederverwendbarkeit

#### Das RICHTIGE SvelteKit-Pattern (AB JETZT!)

```
frontend-svelte/src/routes/(app)/manage-teams/
├── +page.svelte              # Max ~300 Zeilen: Template + Svelte Bindings
└── _lib/                     # Underscore = nicht routebar
    ├── types.ts              # TypeScript Interfaces ✅
    ├── api.ts                # API Calls (async functions) ✅
    ├── state.svelte.ts       # Svelte 5 Runes exports ($state, $derived) ✅
    ├── filters.ts            # Filter/Sort Logik ✅
    ├── handlers.ts           # Event Handlers (modal, dropdown, form) ✅
    └── utils.ts              # Helper Functions (formatDate, etc.) ✅
```

**Oder für größere Features in `$lib/features/`:**

```
frontend-svelte/src/lib/features/manage-teams/
├── index.ts                  # Re-exports alles
├── types.ts                  # TypeScript Interfaces
├── api.ts                    # API functions
├── state.svelte.ts           # Reactive state mit $state()
├── filters.ts                # Filter logic
├── constants.ts              # STATUS_LABELS, BADGE_CLASSES, etc.
└── ManageTeamsTable.svelte   # Extracted sub-component
```

#### Konkrete Beispiele

**types.ts (Volles TypeScript):**

```typescript
// frontend-svelte/src/routes/(app)/manage-teams/_lib/types.ts

export interface Team {
  id: number;
  name: string;
  description?: string;
  departmentId?: number;
  departmentName?: string;
  leaderId?: number;
  leaderName?: string;
  memberCount?: number;
  isActive: 0 | 1 | 3 | 4;
  createdAt: string;
}

export interface Department {
  id: number;
  name: string;
}

export type StatusFilter = 'active' | 'inactive' | 'archived' | 'all';

export interface TeamFormData {
  name: string;
  description: string;
  departmentId: number | null;
  leaderId: number | null;
}
```

**api.ts (Volles TypeScript):**

```typescript
// frontend-svelte/src/routes/(app)/manage-teams/_lib/api.ts
import { getApiClient } from '$lib/utils/api-client';

import type { Team, TeamFormData } from './types';

const apiClient = getApiClient();

export async function loadTeams(): Promise<Team[]> {
  const result = await apiClient.get('/teams');
  return Array.isArray(result) ? result : (result.data ?? []);
}

export async function createTeam(teamData: TeamFormData): Promise<{ id: number }> {
  return apiClient.post('/teams', teamData);
}

export async function updateTeam(teamId: number, teamData: Partial<TeamFormData>): Promise<void> {
  return apiClient.put(`/teams/${teamId}`, teamData);
}

export async function deleteTeam(teamId: number, force = false): Promise<void> {
  const url = force ? `/teams/${teamId}?force=true` : `/teams/${teamId}`;
  return apiClient.delete(url);
}
```

**state.svelte.ts (Svelte 5 Runes mit TypeScript):**

```typescript
// frontend-svelte/src/routes/(app)/manage-teams/_lib/state.svelte.ts
import type { StatusFilter, Team } from './types';

// WICHTIG: Objekt-Pattern für exportierbaren $state (keine direkte Reassignment!)
// Quelle: https://svelte.dev/docs/svelte/$state

export const teamsState = $state({
  all: [] as Team[],
  filtered: [] as Team[],
  loading: true,
  error: null as string | null,
});

export const filterState = $state({
  status: 'active' as StatusFilter,
  search: '',
});

export const modalState = $state({
  showTeam: false,
  showDelete: false,
  editId: null as number | null,
});

// Derived values (können normal exportiert werden)
export const isEditMode = $derived(modalState.editId !== null);
export const modalTitle = $derived(isEditMode ? 'Team bearbeiten' : 'Neues Team');
export const hasTeams = $derived(teamsState.filtered.length > 0);
```

**filters.ts (Pure Functions, volles TypeScript):**

```typescript
// frontend-svelte/src/routes/(app)/manage-teams/_lib/filters.ts
import type { StatusFilter, Team } from './types';

export function filterByStatus(teams: Team[], status: StatusFilter): Team[] {
  switch (status) {
    case 'active':
      return teams.filter((t) => t.isActive === 1);
    case 'inactive':
      return teams.filter((t) => t.isActive === 0);
    case 'archived':
      return teams.filter((t) => t.isActive === 3);
    case 'all':
    default:
      return teams.filter((t) => t.isActive !== 4);
  }
}

export function filterBySearch(teams: Team[], query: string): Team[] {
  const term = query.toLowerCase().trim();
  if (!term) return teams;

  return teams.filter((t) => {
    const name = t.name.toLowerCase();
    const department = (t.departmentName ?? '').toLowerCase();
    return name.includes(term) || department.includes(term);
  });
}

export function applyFilters(teams: Team[], status: StatusFilter, search: string): Team[] {
  let result = filterByStatus(teams, status);
  result = filterBySearch(result, search);
  return result;
}
```

**utils.ts (Wiederverwendbare Helpers, volles TypeScript):**

```typescript
// frontend-svelte/src/routes/(app)/manage-teams/_lib/utils.ts

const STATUS_BADGE_CLASSES: Record<0 | 1 | 3 | 4, string> = {
  1: 'badge--success',
  0: 'badge--warning',
  3: 'badge--secondary',
  4: 'badge--error',
};

const STATUS_LABELS: Record<0 | 1 | 3 | 4, string> = {
  1: 'Aktiv',
  0: 'Inaktiv',
  3: 'Archiviert',
  4: 'Gelöscht',
};

export function getStatusBadgeClass(isActive: 0 | 1 | 3 | 4): string {
  return STATUS_BADGE_CLASSES[isActive] ?? 'badge--secondary';
}

export function getStatusLabel(isActive: 0 | 1 | 3 | 4): string {
  return STATUS_LABELS[isActive] ?? 'Unbekannt';
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('de-DE');
  } catch {
    return '-';
  }
}

export function highlightMatch(text: string, query: string): string {
  if (!query?.trim()) return text;
  const escaped = query.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<strong>$1</strong>');
}
```

**+page.svelte (Template mit TypeScript):**

```svelte
<!-- frontend-svelte/src/routes/(app)/manage-teams/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  // Lokale TypeScript Module
  import { loadTeams, createTeam, updateTeam, deleteTeam } from './_lib/api';
  import { applyFilters } from './_lib/filters';
  import { getStatusBadgeClass, getStatusLabel, formatDate, highlightMatch } from './_lib/utils';
  import { teamsState, filterState, modalState, isEditMode, modalTitle } from './_lib/state.svelte';
  import type { Team, TeamFormData } from './_lib/types';

  // CSS
  import '../../../styles/manage-teams.css';

  // Event Handlers
  async function handleLoadTeams(): Promise<void> {
    teamsState.loading = true;
    try {
      teamsState.all = await loadTeams();
      teamsState.filtered = applyFilters(teamsState.all, filterState.status, filterState.search);
    } catch (err) {
      teamsState.error = err instanceof Error ? err.message : 'Unbekannter Fehler';
    } finally {
      teamsState.loading = false;
    }
  }

  function handleFilterChange(): void {
    teamsState.filtered = applyFilters(teamsState.all, filterState.status, filterState.search);
  }

  onMount(() => {
    handleLoadTeams();
  });
</script>

<!-- Template hier - nur HTML + Svelte Syntax -->
```

#### Wann auslagern?

| Situation                     | Datei                  | Endung       |
| ----------------------------- | ---------------------- | ------------ |
| Datei > 300 Zeilen            | **Sofort** aufteilen   | -            |
| Gleiche Funktion 2x verwendet | `utils.ts`             | `.ts`        |
| API Call                      | `api.ts`               | `.ts`        |
| Interface/Type Definition     | `types.ts`             | `.ts`        |
| Filter/Sort Logik             | `filters.ts`           | `.ts`        |
| Reaktiver State (exportiert)  | `state.svelte.ts`      | `.svelte.ts` |
| Komplexe Event Handler        | `handlers.ts`          | `.ts`        |
| Constants (Labels, Classes)   | `constants.ts`         | `.ts`        |
| Sub-Component sinnvoll        | `ComponentName.svelte` | `.svelte`    |

#### Checkliste für neue Seiten

- [ ] Template in `+page.svelte` max ~300 Zeilen mit `<script lang="ts">`
- [ ] Types in `_lib/types.ts` (TypeScript Interfaces)
- [ ] API Calls in `_lib/api.ts` isoliert (TypeScript)
- [ ] State in `_lib/state.svelte.ts` wenn viele Variablen (Objekt-Pattern!)
- [ ] Filter/Sort in `_lib/filters.ts` (pure functions, TypeScript)
- [ ] Helpers in `_lib/utils.ts` (wiederverwendbar, TypeScript)
- [ ] Constants in `_lib/constants.ts` (Labels, CSS-Klassen Maps)
- [ ] Keine Business-Logik im Template (nur Aufrufe)
- [ ] Jede Datei hat EINE Verantwortung
- [ ] `$state` Export nur als Objekt (keine direkte Reassignment!)

#### Refactoring-Plan für existierende Seiten (OPTIONAL - Phase 4)

> **Hinweis:** Diese Seiten sind funktionsfähig und migriert. Refactoring ist optional für bessere Wartbarkeit.

| Seite         | Zeilen | Priorität | Status                 |
| ------------- | ------ | --------- | ---------------------- |
| manage-teams  | 1393   | LOW       | ✅ Funktioniert (opt.) |
| manage-admins | ~1200  | LOW       | ✅ Funktioniert (opt.) |
| manage-areas  | ~1100  | LOW       | ✅ Funktioniert (opt.) |
| manage-root   | ~1000  | LOW       | ✅ Funktioniert (opt.) |
| chat          | ~900   | LOW       | ✅ Funktioniert (opt.) |
| blackboard    | ~800   | LOW       | ✅ Funktioniert (opt.) |

**Wichtig:** Logische Trennung ist wichtiger als Zeilenzahl!
Eine 400-Zeilen Datei mit klarer Struktur ist besser als 5 Dateien mit 80 Zeilen Chaos.

---

## 1. Voraussetzungen & Abhängigkeiten

### 1.1 Technologie-Stack

```
SvelteKit:     5.x (Latest)
Svelte:        5.x (Runes API)
Vite:          6.x
Tailwind CSS:  4.x (@tailwindcss/vite)
TypeScript:    5.7+
Node.js:       22.x (LTS)
```

### 1.2 Bestehende Assets (MÜSSEN erhalten bleiben)

```
design-system/
├── tokens/
│   ├── core/           → colors, glass, radii, shadows, spacing, typography
│   ├── semantic/       → colors, components
│   └── themes/         → dark, light, contrast
├── primitives/         → modals, forms, choice-cards
└── build/              → Generated CSS/TS/Tailwind

frontend/
├── src/styles/
│   ├── tailwind.css    → @theme Block mit allen Tokens
│   ├── main.css        → Entry Point mit Layer Order
│   └── design-system/  → variables-dark.css
├── tailwind.config.js  → Glassmorphism Plugin
└── vite.config.js      → Chunk Strategy, Aliases
```

---

## 2. Projekt-Struktur (Ziel)

```
frontend-svelte/                    # Neues SvelteKit Projekt
├── src/
│   ├── app.css                     # Tailwind + Design System Import
│   ├── app.html                    # HTML Template
│   ├── hooks.server.ts             # Server Hooks (Auth, etc.)
│   │
│   ├── lib/                        # Shared Library ($lib)
│   │   ├── components/             # Svelte Components
│   │   │   ├── ui/                 # Design System Primitives
│   │   │   │   ├── Button.svelte
│   │   │   │   ├── Badge.svelte
│   │   │   │   ├── Card.svelte
│   │   │   │   ├── Modal.svelte
│   │   │   │   ├── FormField.svelte
│   │   │   │   └── ...
│   │   │   ├── layout/             # Layout Components
│   │   │   │   ├── Sidebar.svelte
│   │   │   │   ├── Header.svelte
│   │   │   │   └── Navigation.svelte
│   │   │   └── features/           # Feature-specific Components
│   │   │       ├── calendar/
│   │   │       ├── chat/
│   │   │       ├── blackboard/
│   │   │       └── ...
│   │   │
│   │   ├── stores/                 # Svelte Stores (Global State)
│   │   │   ├── auth.ts
│   │   │   ├── theme.ts
│   │   │   └── notifications.ts
│   │   │
│   │   ├── utils/                  # Utility Functions
│   │   │   ├── api-client.ts       # REST API Client (684 LOC)
│   │   │   ├── date-utils.ts
│   │   │   └── validation.ts
│   │   │
│   │   └── types/                  # TypeScript Types
│   │       ├── api.ts
│   │       └── components.ts
│   │
│   ├── routes/                     # SvelteKit Routes
│   │   ├── +layout.svelte          # Root Layout (Sidebar, Header)
│   │   ├── +layout.server.ts       # Auth Check, User Data
│   │   ├── +page.svelte            # Landing/Login
│   │   │
│   │   ├── (auth)/                 # Auth Group (No Layout)
│   │   │   ├── login/
│   │   │   │   └── +page.svelte
│   │   │   └── signup/
│   │   │       └── +page.svelte
│   │   │
│   │   ├── (app)/                  # App Group (With Sidebar)
│   │   │   ├── +layout.svelte      # App Shell
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── +page.svelte
│   │   │   │   └── +page.server.ts
│   │   │   │
│   │   │   ├── calendar/
│   │   │   │   ├── +page.svelte
│   │   │   │   └── +page.server.ts
│   │   │   │
│   │   │   ├── blackboard/
│   │   │   │   ├── +page.svelte
│   │   │   │   ├── [id]/
│   │   │   │   │   └── +page.svelte
│   │   │   │   └── +page.server.ts
│   │   │   │
│   │   │   ├── chat/
│   │   │   ├── documents/
│   │   │   ├── kvp/
│   │   │   ├── shifts/
│   │   │   ├── surveys/
│   │   │   │
│   │   │   ├── manage/             # Admin Management
│   │   │   │   ├── employees/
│   │   │   │   ├── departments/
│   │   │   │   ├── teams/
│   │   │   │   ├── machines/
│   │   │   │   └── admins/
│   │   │   │
│   │   │   ├── settings/
│   │   │   │   └── +page.svelte
│   │   │   │
│   │   │   └── profile/
│   │   │       └── +page.svelte
│   │   │
│   │   └── (root)/                 # Root Admin Group
│   │       ├── +layout.svelte
│   │       ├── dashboard/
│   │       ├── features/
│   │       └── tenants/
│   │
│   └── params/                     # Param Matchers
│       └── id.ts
│
├── static/                         # Static Assets
│   ├── fonts/
│   ├── images/
│   └── favicon.ico
│
├── svelte.config.js
├── vite.config.ts
├── tailwind.config.js              # Kopie von frontend/
├── tsconfig.json
└── package.json
```

---

## 3. Migrations-Phasen

### Phase 3.1: Projekt-Setup (Tag 1-2)

#### 3.1.1 SvelteKit Projekt erstellen

```bash
# Im Assixx Root
cd /home/scs/projects/Assixx

# SvelteKit Projekt erstellen
npx sv create frontend-svelte

# Optionen wählen:
# - SvelteKit minimal
# - TypeScript
# - ESLint + Prettier
# - Vitest (Tests)
```

#### 3.1.2 Dependencies installieren

```bash
cd frontend-svelte

# Tailwind v4 für Vite
pnpm add -D tailwindcss @tailwindcss/vite

# Utilities
pnpm add clsx dompurify marked
pnpm add -D @types/dompurify

# EventCalendar (von Phase 0)
pnpm add @event-calendar/core @event-calendar/day-grid @event-calendar/time-grid @event-calendar/list @event-calendar/interaction
```

#### 3.1.3 Vite Config

```typescript
// frontend-svelte/vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },

  resolve: {
    alias: {
      '@': '/src',
      $styles: '/src/styles',
    },
  },
});
```

#### 3.1.4 Tailwind Setup

```css
/* frontend-svelte/src/app.css */

/* Tailwind v4 Core */
@import 'tailwindcss';

/* Design System Variables (Dark Theme Default) */
@import '../design-system/build/web/css/variables-dark.css';

/* @theme Block - Kopiert von frontend/src/styles/tailwind.css */
@theme {
  /* Colors - Grayscale */
  --color-black: #000;
  --color-white: #fff;
  --color-gray-950: #121212;
  --color-gray-900: #212121;
  /* ... alle anderen Tokens ... */

  /* Spacing, Typography, Radius, Shadows, Breakpoints */
  /* ... wie in frontend/src/styles/tailwind.css ... */
}

/* Design System Components */
@import '../design-system/index.css';
```

#### 3.1.5 SvelteKit Config

```javascript
// frontend-svelte/svelte.config.js
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      out: 'build',
    }),

    alias: {
      $components: 'src/lib/components',
      $stores: 'src/lib/stores',
      $utils: 'src/lib/utils',
    },
  },
};

export default config;
```

---

### Phase 3.2: Design System Components (Tag 3-7)

Konvertierung der 25 Storybook Stories zu Svelte Components.

#### 3.2.1 Button Component

```svelte
<!-- src/lib/components/ui/Button.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { clsx } from 'clsx';

  interface Props {
    variant?: 'primary' | 'cancel' | 'danger' | 'success' | 'warning' | 'info' | 'modal' | 'upload' | 'edit' | 'manage' | 'link';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    fullWidth?: boolean;
    type?: 'button' | 'submit' | 'reset';
    icon?: string;
    children: Snippet;
    onclick?: (e: MouseEvent) => void;
  }

  let {
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    fullWidth = false,
    type = 'button',
    icon,
    children,
    onclick,
  }: Props = $props();

  const classes = $derived(clsx(
    'btn',
    `btn-${variant}`,
    size !== 'md' && `btn-${size}`,
    fullWidth && 'btn-block',
    loading && 'btn-loading',
  ));
</script>

<button
  {type}
  class={classes}
  {disabled}
  data-loading={loading || undefined}
  {onclick}
>
  {#if icon}
    <i class="fa {icon}"></i>
  {/if}
  {@render children()}
</button>
```

#### 3.2.2 Badge Component

```svelte
<!-- src/lib/components/ui/Badge.svelte -->
<script lang="ts">
  import { clsx } from 'clsx';

  interface Props {
    variant?: 'success' | 'warning' | 'danger' | 'error' | 'info' | 'primary' | 'dark';
    size?: 'sm' | 'default' | 'lg';
    uppercase?: boolean;
    dot?: boolean;
    label: string;
  }

  let {
    variant = 'primary',
    size = 'default',
    uppercase = false,
    dot = false,
    label,
  }: Props = $props();

  const classes = $derived(clsx(
    'badge',
    `badge--${variant}`,
    size !== 'default' && `badge--${size}`,
    uppercase && 'badge--uppercase',
    dot && 'badge--dot',
  ));
</script>

<span class={classes}>{label}</span>
```

#### 3.2.3 Card Component

```svelte
<!-- src/lib/components/ui/Card.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { clsx } from 'clsx';

  interface Props {
    variant?: 'default' | 'stat' | 'accent';
    clickable?: boolean;
    compact?: boolean;
    header?: Snippet;
    footer?: Snippet;
    children: Snippet;
    onclick?: () => void;
  }

  let {
    variant = 'default',
    clickable = false,
    compact = false,
    header,
    footer,
    children,
    onclick,
  }: Props = $props();

  const baseClass = variant === 'stat' ? 'card-stat'
                  : variant === 'accent' ? 'card-accent'
                  : 'card';

  const classes = $derived(clsx(
    baseClass,
    clickable && 'card--clickable',
    compact && 'card--compact',
  ));
</script>

<div class={classes} onclick={clickable ? onclick : undefined} role={clickable ? 'button' : undefined}>
  {#if header}
    <div class="card__header">
      {@render header()}
    </div>
  {/if}

  <div class="card__body">
    {@render children()}
  </div>

  {#if footer}
    <div class="card__footer">
      {@render footer()}
    </div>
  {/if}
</div>
```

#### 3.2.4 FormField Component

```svelte
<!-- src/lib/components/ui/FormField.svelte -->
<script lang="ts">
  import { clsx } from 'clsx';

  interface Props {
    id: string;
    label: string;
    type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    message?: string;
    messageVariant?: 'default' | 'error' | 'success' | 'warning';
    value?: string;
    oninput?: (e: Event) => void;
  }

  let {
    id,
    label,
    type = 'text',
    required = false,
    disabled = false,
    placeholder = '',
    message,
    messageVariant = 'default',
    value = $bindable(''),
    oninput,
  }: Props = $props();

  const labelClasses = $derived(clsx(
    'form-field__label',
    required && 'form-field__label--required',
  ));

  const inputClasses = $derived(clsx(
    'form-field__control',
    messageVariant === 'error' && 'is-error',
    messageVariant === 'success' && 'is-success',
  ));

  const messageClasses = $derived(clsx(
    'form-field__message',
    messageVariant !== 'default' && `form-field__message--${messageVariant}`,
  ));
</script>

<div class="form-field">
  <label class={labelClasses} for={id}>
    {label}
  </label>

  <input
    {id}
    {type}
    class={inputClasses}
    {placeholder}
    {disabled}
    bind:value
    {oninput}
  />

  {#if message}
    <p class={messageClasses}>{message}</p>
  {/if}
</div>
```

#### 3.2.5 Modal Component

```svelte
<!-- src/lib/components/ui/Modal.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { clsx } from 'clsx';
  import { fade, scale } from 'svelte/transition';

  interface Props {
    open: boolean;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    title?: string;
    icon?: string;
    header?: Snippet;
    footer?: Snippet;
    children: Snippet;
    onclose?: () => void;
  }

  let {
    open = $bindable(false),
    size = 'md',
    title,
    icon,
    header,
    footer,
    children,
    onclose,
  }: Props = $props();

  function handleClose() {
    open = false;
    onclose?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') handleClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- Overlay -->
  <div
    class="modal-overlay modal-overlay--active"
    transition:fade={{ duration: 200 }}
    onclick={handleClose}
    role="presentation"
  >
    <!-- Modal -->
    <div
      class={clsx('ds-modal', `ds-modal--${size}`)}
      transition:scale={{ duration: 200, start: 0.95 }}
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <!-- Header -->
      <div class="ds-modal__header">
        {#if header}
          {@render header()}
        {:else if title}
          <h2 class="ds-modal__title">
            {#if icon}
              <i class="fas {icon}"></i>
            {/if}
            {title}
          </h2>
        {/if}
        <button class="ds-modal__close" onclick={handleClose} aria-label="Schließen">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Body -->
      <div class="ds-modal__body">
        {@render children()}
      </div>

      <!-- Footer -->
      {#if footer}
        <div class="ds-modal__footer">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
```

#### 3.2.6 Weitere Components (Prioritätsliste)

| Priorität | Component        | Basiert auf Story           | Komplexität |
| --------- | ---------------- | --------------------------- | ----------- |
| 1         | Button           | Buttons.stories.js          | Niedrig     |
| 2         | Badge            | Badges.stories.js           | Niedrig     |
| 3         | Card             | Cards.stories.js            | Niedrig     |
| 4         | FormField        | FormFields.stories.js       | Mittel      |
| 5         | Modal            | Modals.stories.js           | Mittel      |
| 6         | ConfirmModal     | ConfirmModal.stories.js     | Mittel      |
| 7         | SearchInput      | SearchInput.stories.js      | Niedrig     |
| 8         | Dropdown         | Dropdowns.stories.js        | Mittel      |
| 9         | Toggle           | Toggles.stories.js          | Niedrig     |
| 10        | ToggleSwitch     | ToggleSwitch.stories.js     | Niedrig     |
| 11        | Avatar           | Avatar.stories.js           | Niedrig     |
| 12        | Tooltip          | Tooltip.stories.js          | Mittel      |
| 13        | Collapse         | Collapse.stories.js         | Mittel      |
| 14        | DataDisplay      | DataDisplay.stories.js      | Hoch        |
| 15        | Navigation       | Navigation.stories.js       | Hoch        |
| 16        | FileUpload       | FileUpload.stories.js       | Hoch        |
| 17        | MultiSelect      | MultiSelect.stories.js      | Hoch        |
| 18        | Pickers          | Pickers.stories.js          | Hoch        |
| 19        | ExplorerView     | ExplorerView.stories.js     | Hoch        |
| 20        | EmptyStates      | EmptyStates.stories.js      | Niedrig     |
| 21        | Feedback         | Feedback.stories.js         | Mittel      |
| 22        | Containers       | Containers.stories.js       | Niedrig     |
| 23        | ChoiceCards      | ChoiceCards.stories.js      | Mittel      |
| 24        | AssignmentBadges | AssignmentBadges.stories.js | Niedrig     |
| 25        | DesignTokens     | DesignTokens.stories.js     | Niedrig     |

---

### Phase 3.3: Layout & Navigation (Tag 8-10)

#### 3.3.1 Root Layout

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import '../app.css';

  let { children, data } = $props();

  // Theme aus Store oder Cookie
  let theme = $state('dark');
</script>

<svelte:head>
  <title>{$page.data.title ?? 'Assixx'}</title>
  <meta name="description" content="Assixx - Industrial SaaS Platform" />
</svelte:head>

<div data-theme={theme}>
  {@render children()}
</div>
```

#### 3.3.2 App Layout (mit Sidebar)

```svelte
<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import Sidebar from '$components/layout/Sidebar.svelte';
  import Header from '$components/layout/Header.svelte';

  let { children, data } = $props();

  let sidebarCollapsed = $state(false);
</script>

<div class="app-layout" class:sidebar-collapsed={sidebarCollapsed}>
  <Sidebar
    user={data.user}
    collapsed={sidebarCollapsed}
    oncollapse={() => sidebarCollapsed = !sidebarCollapsed}
  />

  <div class="app-content">
    <Header user={data.user} />

    <main class="main-content">
      {@render children()}
    </main>
  </div>
</div>

<style>
  .app-layout {
    display: grid;
    grid-template-columns: var(--sidebar-width-expanded) 1fr;
    min-height: 100vh;
    transition: grid-template-columns 0.3s ease;
  }

  .app-layout.sidebar-collapsed {
    grid-template-columns: var(--sidebar-width-collapsed) 1fr;
  }

  .app-content {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .main-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-6);
  }
</style>
```

#### 3.3.3 Sidebar Component

```svelte
<!-- src/lib/components/layout/Sidebar.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import type { User } from '$lib/types/api';

  interface Props {
    user: User;
    collapsed: boolean;
    oncollapse: () => void;
  }

  let { user, collapsed, oncollapse }: Props = $props();

  // Menu Items basierend auf User Role
  const menuItems = $derived(getMenuItems(user.role));

  function getMenuItems(role: string) {
    const baseItems = [
      { href: '/dashboard', icon: 'fa-home', label: 'Dashboard' },
      { href: '/calendar', icon: 'fa-calendar', label: 'Kalender' },
      { href: '/blackboard', icon: 'fa-clipboard', label: 'Schwarzes Brett' },
      { href: '/documents', icon: 'fa-folder', label: 'Dokumente' },
      { href: '/chat', icon: 'fa-comments', label: 'Chat' },
    ];

    if (role === 'admin' || role === 'root') {
      baseItems.push(
        { href: '/manage/employees', icon: 'fa-users', label: 'Mitarbeiter' },
        { href: '/manage/departments', icon: 'fa-building', label: 'Abteilungen' },
        { href: '/shifts', icon: 'fa-clock', label: 'Schichtplan' },
      );
    }

    return baseItems;
  }
</script>

<aside class="sidebar glass" class:collapsed>
  <div class="sidebar__header">
    <img src="/images/logo.svg" alt="Assixx" class="sidebar__logo" />
    {#if !collapsed}
      <span class="sidebar__title">Assixx</span>
    {/if}
  </div>

  <nav class="sidebar__nav">
    {#each menuItems as item}
      <a
        href={item.href}
        class="sidebar__link"
        class:active={$page.url.pathname.startsWith(item.href)}
      >
        <i class="fas {item.icon}"></i>
        {#if !collapsed}
          <span>{item.label}</span>
        {/if}
      </a>
    {/each}
  </nav>

  <button class="sidebar__toggle" onclick={oncollapse}>
    <i class="fas" class:fa-chevron-left={!collapsed} class:fa-chevron-right={collapsed}></i>
  </button>
</aside>
```

---

### ~~Phase 3.4: tRPC Integration~~ ❌ REJECTED

> **Status:** REJECTED (2026-01-06)
> **Decision:** See [ARCHITECTURE-DECISION-NO-TRPC.md](./ARCHITECTURE-DECISION-NO-TRPC.md)
>
> **Reason:** REST API with `api-client.ts` (684 LOC) already provides:
>
> - Type safety via Zod + TypeScript
> - Caching, token refresh, error handling
> - Mobile/external client compatibility
>
> tRPC would add complexity without measurable benefit.

---

### Phase 3.5: Seiten-Migration (Tag 15-30)

#### 3.5.1 Seiten-Mapping (34 HTML → SvelteKit Routes)

| HTML Seite                   | SvelteKit Route                  | Priorität |
| ---------------------------- | -------------------------------- | --------- |
| login.html                   | /login                           | 1         |
| signup.html                  | /signup                          | 1         |
| index.html                   | /                                | 1         |
| admin-dashboard.html         | /(app)/dashboard                 | 2         |
| employee-dashboard.html      | /(app)/dashboard                 | 2         |
| root-dashboard.html          | /(root)/dashboard                | 2         |
| calendar.html                | /(app)/calendar                  | 3         |
| blackboard.html              | /(app)/blackboard                | 3         |
| blackboard-detail.html       | /(app)/blackboard/[id]           | 3         |
| chat.html                    | /(app)/chat                      | 3         |
| documents-explorer.html      | /(app)/documents                 | 4         |
| kvp.html                     | /(app)/kvp                       | 4         |
| kvp-detail.html              | /(app)/kvp/[id]                  | 4         |
| shifts.html                  | /(app)/shifts                    | 4         |
| survey-admin.html            | /(app)/surveys                   | 5         |
| survey-employee.html         | /(app)/surveys                   | 5         |
| survey-results.html          | /(app)/surveys/[id]/results      | 5         |
| manage-employees.html        | /(app)/manage/employees          | 5         |
| manage-departments.html      | /(app)/manage/departments        | 5         |
| manage-teams.html            | /(app)/manage/teams              | 5         |
| manage-machines.html         | /(app)/manage/machines           | 5         |
| manage-admins.html           | /(app)/manage/admins             | 5         |
| manage-areas.html            | /(app)/manage/areas              | 5         |
| admin-profile.html           | /(app)/profile                   | 6         |
| employee-profile.html        | /(app)/profile                   | 6         |
| root-profile.html            | /(root)/profile                  | 6         |
| account-settings.html        | /(app)/settings                  | 6         |
| logs.html                    | /(app)/logs                      | 6         |
| features.html                | /(root)/features                 | 7         |
| manage-root.html             | /(root)/manage                   | 7         |
| storage-upgrade.html         | /(app)/storage                   | 7         |
| tenant-deletion-status.html  | /(root)/tenants/deletion         | 7         |
| tenant-deletion-approve.html | /(root)/tenants/deletion/approve | 7         |
| rate-limit.html              | /rate-limit                      | 7         |

#### 3.5.2 Beispiel: Dashboard Seite

```svelte
<!-- src/routes/(app)/dashboard/+page.svelte -->
<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import Badge from '$components/ui/Badge.svelte';
  import { formatDate } from '$utils/date-utils';

  let { data } = $props();
</script>

<div class="dashboard">
  <h1 class="text-2xl font-semibold mb-6">Dashboard</h1>

  <!-- Stats Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
    {#each data.stats as stat}
      <Card variant="stat">
        <div class="card-stat__icon">
          <i class="fas {stat.icon}"></i>
        </div>
        <div class="card-stat__value">{stat.value}</div>
        <div class="card-stat__label">{stat.label}</div>
      </Card>
    {/each}
  </div>

  <!-- Recent Activity -->
  <Card>
    {#snippet header()}
      <h2 class="card__title">
        <i class="fas fa-history"></i>
        Letzte Aktivitäten
      </h2>
    {/snippet}

    <div class="activity-list">
      {#each data.recentActivity as activity}
        <div class="activity-item">
          <Badge variant={activity.type} label={activity.action} />
          <span class="activity-description">{activity.description}</span>
          <span class="activity-time">{formatDate(activity.createdAt)}</span>
        </div>
      {/each}
    </div>
  </Card>
</div>
```

---

### Phase 3.6: Feature-Module Migration (Tag 31-45)

#### 3.6.1 Calendar mit EventCalendar

> **✅ AKTUELL: v5.0.5** mit `createCalendar()` API (Upgrade 2025-12-22)
> Alle Plugins in `@event-calendar/core` enthalten. CSS Grid Layout.

```svelte
<!-- src/routes/(app)/calendar/+page.svelte -->
<!-- @event-calendar/core v5.x - createCalendar() API -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { createCalendar, DayGrid, TimeGrid, Interaction } from '@event-calendar/core';
  import '@event-calendar/core/index.css';
  import type { PageData } from './$types';

  // =============================================================================
  // SVELTE 5 RUNES
  // =============================================================================

  let { data }: { data: PageData } = $props();

  // Calendar DOM reference and instance
  let calendarEl: HTMLElement;
  let calendarInstance: ReturnType<typeof createCalendar> | null = $state(null);

  // Derived state for calendar options
  const calendarOptions = $derived({
    view: 'dayGridMonth',
    events: data.events,
    locale: 'de',
    editable: data.canEdit,
    eventClick: handleEventClick,
    dateClick: handleDateClick,
  });

  // =============================================================================
  // LIFECYCLE - v5 API: createCalendar(target, plugins, options)
  // =============================================================================

  onMount(() => {
    calendarInstance = createCalendar(calendarEl, [DayGrid, TimeGrid, Interaction], calendarOptions);

    // Cleanup on unmount
    return () => calendarInstance?.destroy();
  });

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  interface EventClickInfo {
    event: { id: string; title: string };
    el: HTMLElement;
  }

  interface DateClickInfo {
    date: Date;
    dateStr: string;
    allDay: boolean;
  }

  function handleEventClick(info: EventClickInfo): void {
    // TODO: Open event modal
    console.log('Event clicked:', info.event.id);
  }

  function handleDateClick(info: DateClickInfo): void {
    // TODO: Create new event
    console.log('Date clicked:', info.dateStr);
  }
</script>

<div class="calendar-page">
  <div class="calendar-header">
    <h1>Kalender</h1>
    <!-- Filters, View Switcher -->
  </div>

  <div bind:this={calendarEl} class="calendar-container"></div>
</div>
```

#### 3.6.2 Chat mit WebSocket

```svelte
<!-- src/routes/(app)/chat/+page.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { apiClient } from '$lib/api-client';

  let { data } = $props();

  let messages = $state(data.messages);
  let newMessage = $state('');
  let ws: WebSocket;

  onMount(() => {
    ws = new WebSocket(`ws://localhost:3000/chat?token=${data.token}`);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      messages = [...messages, message];
    };
  });

  onDestroy(() => ws?.close());

  async function sendMessage() {
    if (!newMessage.trim()) return;

    await apiClient.post('/api/v2/chat/messages', {
      conversationId: data.conversationId,
      content: newMessage,
    });

    newMessage = '';
  }
</script>
```

---

### Phase 3.7: Docker Integration (Tag 46-48)

#### 3.7.1 Dockerfile für SvelteKit

```dockerfile
# docker/Dockerfile.frontend
FROM node:22-alpine AS builder

WORKDIR /app/frontend-svelte

# pnpm installieren
RUN corepack enable && corepack prepare pnpm@latest --activate

# Dependencies
COPY frontend-svelte/package.json frontend-svelte/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Source
COPY frontend-svelte/ ./
COPY design-system/ ../design-system/

# Build
RUN pnpm build

# Production
FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /app/frontend-svelte/build ./build
COPY --from=builder /app/frontend-svelte/package.json ./

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "build"]
```

#### 3.7.2 Docker Compose Update

```yaml
# docker/docker-compose.yml - Ergänzung
services:
  # ... bestehende Services ...

  frontend:
    build:
      context: ..
      dockerfile: docker/Dockerfile.frontend
    container_name: assixx-frontend
    restart: unless-stopped
    ports:
      - '3001:3001'
    environment:
      - API_URL=http://backend:3000
    depends_on:
      - backend
    networks:
      - assixx-network
```

---

## 4. Migrations-Checkliste

### 4.1 Pre-Migration

- [x] Backup des aktuellen frontend/ Verzeichnisses (existiert parallel)
- [x] Git Branch: `feature/nestjs-migration` (enthält SvelteKit-Migration)
- [x] SvelteKit Projekt aufsetzen (`frontend-svelte/`)
- [x] Dependencies installieren (pnpm workspace)
- [x] Tailwind v4 konfigurieren (@tailwindcss/vite 4.1.18)
- [x] Design System Tokens importieren (app.css @theme block)

### 4.2 Components

- [ ] Button.svelte
- [ ] Badge.svelte
- [ ] Card.svelte
- [ ] FormField.svelte
- [ ] Modal.svelte
- [ ] SearchInput.svelte
- [ ] Dropdown.svelte
- [ ] Toggle.svelte
- [ ] Avatar.svelte
- [ ] Navigation.svelte
- [ ] Sidebar.svelte
- [ ] Header.svelte
- [ ] ... (alle 25 Stories)

### 4.3 Routes

- [x] Login Route (/login) ✅ 2025-12-19
- [x] Signup Route (/signup) ✅ 2025-12-19
- [x] Landing Page (/) ✅ 2025-12-21
- [x] Dashboard Routes ✅ 2025-12-21
- [x] Calendar Route ✅ 2025-12-23
- [x] Blackboard Routes ✅ 2025-12-21
- [x] Chat Route ✅ 2025-12-21
- [x] Documents Route ✅ 2025-12-22
- [x] KVP Route ✅ 2025-12-23
- [x] KVP-Detail Route ✅ 2025-12-23
- [x] Shifts Route ✅ 2026-01-11 - Manuelles Testing + Bruno API Tests bestanden
- [x] Survey-Admin Route ✅ 2025-12-23, refactored 2026-01-02
- [x] Survey-Employee Route ✅ 2025-12-29
- [x] Survey-Results Route ✅ 2025-12-29
- [x] Manage Routes (Root, Admins, Areas, Departments, Employees, Teams, Machines) ✅ 2025-12-21, refactored 2026-01-02
- [x] Profile Routes (Root) ✅ 2025-12-21
- [x] Settings Routes (Account) ✅ 2025-12-21
- [x] Root Admin Routes (Features, Tenant-Deletion) ✅ 2025-12-21

### 4.4 Integration

- [x] ~~tRPC Client Setup~~ ❌ REJECTED - See [ADR](./ARCHITECTURE-DECISION-NO-TRPC.md)
- [x] Auth Hooks ✅ hooks.server.ts implementiert
- [x] WebSocket Integration ✅ Chat funktioniert
- [x] File Upload Handling ✅ Documents-Explorer funktioniert
- [ ] SSE Notifications (out of scope - Phase 4)
- [ ] Service Worker (out of scope - Phase 4)

### 4.5 Testing & QA

- [x] Manuelles Testing ✅ 2026-01-11 - Alle Seiten getestet
- [x] Bruno API Tests ✅ 2026-01-11 - Backend-Integration verifiziert
- [ ] Unit Tests für Components (Phase 4 - separat getrackt)
- [ ] E2E Tests mit Playwright (Phase 4)
- [ ] Performance Testing (Phase 4)
- [ ] Accessibility Audit (Phase 4)

### 4.6 Deployment

- [x] Docker Image Build ✅ Dockerfile.frontend funktioniert
- [x] Docker Compose Integration ✅ --profile production
- [ ] CI/CD Pipeline Update (Phase 4)
- [ ] Production Deployment (Phase 4)

---

## 5. Risiken & Mitigationen

| Risiko                         | Wahrscheinlichkeit | Auswirkung | Mitigation                                        |
| ------------------------------ | ------------------ | ---------- | ------------------------------------------------- |
| Design System Inkompatibilität | Mittel             | Hoch       | CSS Variables beibehalten, schrittweise Migration |
| Performance Regression         | Niedrig            | Mittel     | Lighthouse CI, Bundle Analyzer                    |
| Feature Parity                 | Mittel             | Hoch       | Feature-by-Feature Testing, Parallel Deployment   |

---

## 6. Zeitplan

| Phase     | Beschreibung             | Dauer       | Status                        |
| --------- | ------------------------ | ----------- | ----------------------------- |
| 3.1       | Projekt-Setup            | 2 Tage      | ✅ DONE (2025-12-18)          |
| 3.2       | Design System Components | 5 Tage      | ✅ DONE                       |
| 3.3       | Layout & Navigation      | 3 Tage      | ✅ DONE                       |
| 3.4       | ~~tRPC Integration~~     | -           | ❌ REJECTED                   |
| 3.5       | Seiten-Migration         | 15 Tage     | ✅ DONE (34/34 Seiten)        |
| 3.6       | Feature-Module           | 15 Tage     | ✅ DONE (Calendar, Chat, etc) |
| 3.7       | Docker Integration       | 3 Tage      | ✅ DONE                       |
| 3.8       | Testing & QA             | 5 Tage      | ✅ DONE (Manuell + Bruno)     |
| **Total** |                          | **52 Tage** | **✅ PHASE 3 COMPLETE**       |

### Fortschritts-Log

#### 2026-01-11: PHASE 3 ABGESCHLOSSEN - MIGRATION COMPLETE! 🎉

**Finale Validierung:**

- ✅ Manuelles Testing aller 34 Seiten bestanden
- ✅ Bruno API Tests bestanden
- ✅ Docker Production Build funktioniert
- ✅ WebSocket (Chat) funktioniert
- ✅ File Upload (Documents) funktioniert
- ✅ Auth Flow (Login/Logout/Refresh) funktioniert

**Nächste Schritte (Phase 4 - separat getrackt):**

- Unit Tests für Components
- E2E Tests mit Playwright
- CI/CD Pipeline
- Production Deployment

---

#### 2026-01-06: Rate-Limit & Storage-Upgrade Migration Complete - 100% DONE!

**FINALE MIGRATION ABGESCHLOSSEN!**

**Migrierte Seiten:**

| Seite           | Route              | Besonderheiten                                                       |
| --------------- | ------------------ | -------------------------------------------------------------------- |
| Rate Limit      | `/rate-limit`      | **Standalone** (kein Header/Sidebar), Countdown Timer, Auto-Redirect |
| Storage Upgrade | `/storage-upgrade` | (app) layout, Plan-Cards, SSR mit +page.server.ts                    |

**Dateien erstellt:**

- `frontend-svelte/src/routes/rate-limit/+page.svelte` - Standalone Countdown-Page
- `frontend-svelte/src/routes/(app)/storage-upgrade/+page.svelte` - Plan-Übersicht
- `frontend-svelte/src/routes/(app)/storage-upgrade/+page.server.ts` - SSR Data Loading
- `frontend-svelte/src/styles/rate-limit.css` - Kopiert von Legacy
- `frontend-svelte/src/styles/storage-upgrade.css` - Kopiert von Legacy

**Endstand:**

- ✅ **34/34 Seiten migriert (100%)**
- ✅ **100% Design System kopiert (102 CSS Dateien)**
- ✅ **100% Types migriert + erweitert**
- ✅ **100% Utils migriert + erweitert**
- ✅ **29 Seiten mit SSR (+page.server.ts)**
- ✅ **29 Seiten mit \_lib/ Pattern**

**Frontend-Migration Status: ABGESCHLOSSEN!**

---

#### 2025-12-23: KVP, KVP-Detail & Survey-Admin Migration Complete

**Migrierte Seiten:**

| Seite           | Route              | Besonderheiten                                           |
| --------------- | ------------------ | -------------------------------------------------------- |
| KVP             | `/kvp`             | KVP-Übersicht, Filter, Status-Management, \_lib/ Pattern |
| KVP-Detail      | `/kvp-detail`      | Detail-Ansicht, Kommentare, Anhänge                      |
| Survey-Admin    | `/survey-admin`    | Survey CRUD, Fragen-Editor, Statistiken                  |
| Survey-Employee | `/survey-employee` | Umfragen beantworten, Antworten ansehen                  |

**Fortschritt:**

- 25 von 34 Seiten migriert (~76%)
- Nächste Priorität: Shifts, Survey-Results, Manage-Employees, Manage-Teams

---

#### 2025-12-23: Calendar Migration Complete

**Calendar Route (`/calendar`) - 100% migriert:**

- ✅ `+page.svelte` mit @event-calendar/core v5.x
- ✅ `_lib/` Ordnerstruktur (api.ts, types.ts, state.svelte.ts, constants.ts, utils.ts)
- ✅ Code-Organisation nach Sektion 0.6 Pattern
- ✅ Svelte 5 Runes ($state, $derived, $effect)
- ✅ TimeGrid, DayGrid, List Views
- ✅ Event CRUD (Create, Read, Update, Delete)
- ✅ Drag & Drop für Events
- ✅ Filter nach orgLevel (personal, team, department, company)
- ✅ CSS identisch zum Legacy Frontend

**Fortschritt:**

- 21 von 34 Seiten migriert (~64%)
- Nächste Priorität: KVP, Shifts, Surveys, Employee-Seiten

---

#### 2025-12-21: Code-Organisation Dokumentation (Sektion 0.6)

**Problem erkannt:** Aktuelle SvelteKit-Seiten haben ALLES in einer Datei!

- `manage-teams/+page.svelte` → 1393 Zeilen (sollte max ~300 sein)
- Legacy Frontend hat saubere Trennung: `types.ts`, `api.ts`, `ui.ts`, etc.

**Dokumentiert:**

- ✅ Legacy-Pattern als Goldstandard erklärt
- ✅ Falsches Pattern (Monolith-Datei) dokumentiert
- ✅ Richtiges Pattern mit `_lib/` Ordner
- ✅ Konkrete Beispiele für `types.js`, `api.js`, `state.svelte.js`, `filters.js`, `utils.js`
- ✅ "Wann auslagern?" Entscheidungstabelle
- ✅ Checkliste für neue Seiten
- ✅ Refactoring-Plan für existierende Seiten

**Wichtige Erkenntnis:** Logische Trennung > Zeilenzahl!
Eine 400-Zeilen Datei mit klarer Struktur ist besser als 5 Dateien mit 80 Zeilen Chaos.

---

#### 2025-12-20: Massive Migration (10 Seiten) + Kritischer Security Fix

**Migrierte Seiten (alle 100% identisch zu Legacy):**

| Seite                   | Route                      | Besonderheiten                    |
| ----------------------- | -------------------------- | --------------------------------- |
| Dashboard Root          | `/dashboard/root`          | Root-User Dashboard mit Stats     |
| Manage Departments      | `/manage-departments`      | CRUD mit Force-Delete Modal       |
| Chat                    | `/chat`                    | WebSocket-ready, Conversations    |
| Features                | `/features`                | Feature-Toggle Grid               |
| Logs                    | `/logs`                    | Audit-Log mit Filtering           |
| Root Profile            | `/root-profile`            | Profil-Bearbeitung                |
| Account Settings        | `/account-settings`        | Tenant-Löschung anfordern         |
| Tenant Deletion Status  | `/tenant-deletion-status`  | Status-Übersicht mit Aktionen     |
| Tenant Deletion Approve | `/tenant-deletion-approve` | **Standalone** (ohne App-Layout!) |

**Kritischer Security Fix (Backend):**

- ❌ **BUG GEFUNDEN:** Passwort wurde bei Tenant-Löschungs-Genehmigung NICHT verifiziert!
- ✅ **FIX:** `deletion-approval-body.dto.ts` - `password` Feld hinzugefügt (required)
- ✅ **FIX:** `root.controller.ts` - Password an Service übergeben
- ✅ **FIX:** `root.service.ts` - bcrypt.compare() für Password-Verifizierung
- 🔒 **Zwei-Personen-Prinzip** jetzt korrekt implementiert

**SvelteKit Layout-Wechsel Pattern:**

- Problem: Client-Side Navigation zwischen (app) und Standalone Layout funktioniert nicht
- Lösung: `data-sveltekit-reload` auf Links die Layout wechseln
- Lösung: `window.location.href` statt `goto()` für programmatische Navigation

**Dateien geändert:**

- `backend/src/nest/root/dto/deletion-approval-body.dto.ts` - Password required
- `backend/src/nest/root/root.controller.ts` - Password Parameter
- `backend/src/nest/root/root.service.ts` - Password Verification mit bcrypt
- `frontend-svelte/src/routes/tenant-deletion-approve/+page.svelte` - Standalone Page
- `frontend-svelte/src/routes/(app)/tenant-deletion-status/+page.svelte` - data-sveltekit-reload

---

#### 2025-12-19: Signup-Seite fertiggestellt

**Signup Route (`/signup`) - 100% identisch zu Legacy:**

- ✅ `+page.svelte` mit Svelte 5 Runes API (`$state()`, `$derived()`)
- ✅ 3-Spalten Form Grid (responsiv auf 2 und 1 Spalte)
- ✅ Company Name, Subdomain mit `.assixx.com` Suffix
- ✅ Email + Email Confirm mit Match-Validierung
- ✅ First Name, Last Name, Phone mit Country Code Selector
- ✅ Password + Password Confirm mit Match-Validierung
- ✅ Password Strength Indicator (vereinfacht)
- ✅ Plan Selector (Enterprise/Professional/Basic)
- ✅ Terms Checkbox + Submit Button
- ✅ Real-time Validation für alle Felder
- ✅ Success Toast mit 5-Sekunden Redirect
- ✅ API Integration (`/api/v2/auth/register`)

**Migration-Philosophie dokumentiert:**

- Legacy Frontend = Goldstandard (1:1 Kopie)
- esrap Parser Limitation dokumentiert (keine TypeScript Annotations)
- JSDoc statt `<script lang="ts">` für Svelte-Dateien

**Dateien erstellt:**

- `frontend-svelte/src/routes/signup/+page.svelte`

**CSS Imports hinzugefügt:**

- `app.css`: signup.css + password-strength.css

---

#### 2025-12-19: Svelte 5 Runes + esrap Limitation

**esrap Parser Problem entdeckt und dokumentiert:**

- ❌ `<script lang="ts">` mit Function Annotations funktioniert NICHT
- ❌ `$props<T>()` Generics funktioniert NICHT
- ✅ Lösung: JSDoc statt TypeScript in `.svelte` Dateien

**Runes werden vollständig genutzt (mit JSDoc):**
| Rune | Verwendet in |
|------|--------------|
| `$state()` | login, signup (alle Form States) |
| `$derived()` | login, signup (isFormValid, buttonText, etc.) |
| `$props()` | +layout.svelte (children Snippet) |
| `{@render}` | +layout.svelte (children rendering) |

**@event-calendar Version:**

- ✅ **Aktuell: v5.0.5** (gepinnt mit `~`) - Upgrade durchgeführt 2025-12-22
- Alle Plugins in `@event-calendar/core` enthalten (keine separaten Packages mehr)
- Neue API: `createCalendar(target, plugins, options)` statt Component Syntax
- CSS Grid Layout (neues Rendering in v5)

---

#### 2025-12-19: Login-Seite fertiggestellt + CSS Cleanup

**Login Route (`/login`) - 100% identisch zu Legacy:**

- ✅ `+page.svelte` mit Svelte 5 Runes API (`$state()`, `$props()`)
- ✅ Form mit Email/Password Binding
- ✅ Loading State und Error Handling
- ✅ Role-based Redirect nach Login (root/admin/employee)
- ✅ Token-Speicherung in localStorage
- ✅ Back-Button, Help-Button, Footer Links

**CSS/Design System Cleanup (Beide Frontends):**

- ✅ Bootstrap Margin-Overrides entfernt aus `style.css`
  - Legacy-Problem: `mt-4 { margin-top: 1.5rem !important; }` (Bootstrap-Scale)
  - Tailwind nutzt: `mt-4 = 1rem`, `mt-6 = 1.5rem`
  - HTML-Klassen aktualisiert: `mt-4` → `mt-6`, `mt-3` → `mt-4`, etc.
- ✅ Duplicate `--color-text-secondary` in `tokens/colors.css` entfernt
  - War: `var(--color-gray-400)` = #bdbdbd
  - Korrekt in `variables-dark.css`: `var(--color-gray-300)` = #e0e0e0
- ✅ Footer-Link Whitespace-Problem behoben
  - Ursache: Mehrzeilige HTML-Tags erzeugen ~4px Inline-Whitespace
  - Lösung: Links auf einer Zeile ohne Whitespace dazwischen
- ✅ `!important`-Missbrauch bei `.text-secondary` behoben
  - `class="text-secondary"` von Links entfernt
  - `.login-footer a { color: var(--primary-color); }` übernimmt

**Dateien geändert:**

- `frontend/src/styles/style.css` - Bootstrap-Overrides entfernt
- `frontend/src/design-system/tokens/colors.css` - Duplicate entfernt
- `frontend/src/pages/login.html` - Klassen aktualisiert
- `frontend-svelte/src/routes/login/+page.svelte` - Neue Login-Seite
- `frontend-svelte/src/styles/login.css` - Kopiert + angepasst
- `frontend-svelte/src/styles/style.css` - Bootstrap-Overrides entfernt
- `frontend-svelte/src/design-system/tokens/colors.css` - Duplicate entfernt
- `frontend-svelte/src/app.css` - style.css Import hinzugefügt

**Lessons Learned:**

1. Bootstrap → Tailwind Migration erfordert Klassennamen-Updates
2. CSS Variable Duplicates führen zu Import-Order-Bugs
3. Whitespace zwischen Inline-Elements ist sichtbar (~4px)
4. `!important` überschreibt spezifischere Selektoren - Anti-Pattern

**Nächster Schritt**: Signup-Seite erstellen

---

#### 2025-12-18: Phase 3.1 abgeschlossen

- ✅ SvelteKit Projekt erstellt (`frontend-svelte/`)
- ✅ Dependencies installiert (Tailwind, EventCalendar, etc.)
- ✅ `vite.config.ts` mit Tailwind + Proxy konfiguriert
- ✅ `svelte.config.js` mit adapter-node erstellt
- ✅ `app.css` mit @theme Block (alle Design Tokens)
- ✅ `app.html` mit Dark Theme default
- ✅ Root `+layout.svelte` mit Font-Imports
- ✅ Test `+page.svelte` für Design-Verifikation
- ✅ CSS + Design-System kopiert
- ✅ **Version-Fix**: @tailwindcss/vite 4.0.0→4.1.18, Vite 6.0.3→7.3.0, SvelteKit 2.10.0→2.49.2
- ✅ Dev-Server läuft auf http://localhost:5173/

**Nächster Schritt**: ~~Login-Seite erstellen~~ ✅ DONE

---

## 7. Referenzen

- [SvelteKit Docs](https://svelte.dev/docs/kit/introduction)
- [Tailwind CSS + SvelteKit](https://tailwindcss.com/docs/installation/framework-guides/sveltekit)
- [EventCalendar Docs](https://github.com/vkurko/calendar)
- [Svelte 5 Runes](https://svelte.dev/docs/svelte/what-are-runes)
- [ADR: No tRPC](./ARCHITECTURE-DECISION-NO-TRPC.md)

---

_Erstellt: 2025-12-18 | Aktualisiert: 2026-01-06 | Autor: Claude Code | Branch: feature/nestjs-migration_
