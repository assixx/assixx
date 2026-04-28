# ADR-034: Hierarchy Labels Propagation

| Metadata                | Value                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                                       |
| **Date**                | 2026-03-11                                                                                                     |
| **Decision Makers**     | SCS-Technik Team                                                                                               |
| **Affected Components** | Backend (1 endpoint update), frontend (50+ files: layout, navigation, breadcrumb, 22+ page modules)            |
| **Supersedes**          | ---                                                                                                            |
| **Related ADRs**        | ADR-012 (route security groups), ADR-020 (per-user permissions), ADR-024 (feature guards), ADR-026 (TPM arch.) |

---

## Context

Since the org-chart feature (V1) Assixx supports tenant-specific hierarchy labels — every tenant can rename its organizational levels (e.g. "Bereiche" → "Hallen", "Abteilungen" → "Segmente"). **Problem:** V1 only displayed these labels on the org-chart page. All other ~40 pages still used hardcoded German strings.

| Problem                      | Impact                                                            |
| ---------------------------- | ----------------------------------------------------------------- |
| Inconsistent terminology     | User sees "Halls" in the org chart but "Areas" everywhere else    |
| No central label source      | Every module has its own `constants.ts` with static strings       |
| Label changes have no effect | Tenant changes labels but 90% of the UI ignores the change        |
| Scalability for new modules  | Every new module copies hardcoded strings instead of using labels |

### Scope

5 hierarchy levels, plural form only:

| Level        | Default (DE)  | Example (custom) |
| ------------ | ------------- | ---------------- |
| `hall`       | "Hallen"      | "Gebäude"        |
| `area`       | "Bereiche"    | "Hallen"         |
| `department` | "Abteilungen" | "Segmente"       |
| `team`       | "Teams"       | "Teilbereiche"   |
| `asset`      | "Anlagen"     | "Maschinen"      |

---

## Decision

### 1. Data Model: Plural-Only Labels

**Decision:** one string per level, always plural. No singular/plural split.

**Why?**

- KISS: one field instead of two per level (5 strings instead of 10)
- German compounds ("Bereichsleiter") cannot be derived generically from singular + plural
- Places that need a singular use neutral phrasing ("Add" instead of "New area")

```typescript
export interface HierarchyLabels {
  hall: string; // e.g. "Gebäude"
  area: string; // e.g. "Hallen"
  department: string; // e.g. "Segmente"
  team: string; // e.g. "Teilbereiche"
  asset: string; // e.g. "Maschinen"
}
```

### 2. Transport: SSR Layout Data Inheritance

**Decision:** labels are loaded once in the app layout and propagated to all child pages via SvelteKit data inheritance.

```
Backend                    Frontend
┌──────────────────┐      ┌─────────────────────────────┐
│ GET /organigram/ │      │ (app)/+layout.server.ts     │
│ hierarchy-labels │ ←──── │   Promise.all([             │
│ (public, cached) │      │     fetchCounts(),          │
└──────────────────┘      │     fetchTheme(),           │
                          │     fetchHierarchyLabels(), │ ← parallel, no waterfall
                          │   ])                        │
                          │   return { hierarchyLabels }│
                          └────────────┬────────────────┘
                                       │ data inheritance (automatic)
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
              +page.svelte      +page.svelte       +page.svelte
              data.hierarchyLabels (available everywhere)
```

**Why data inheritance instead of Svelte context?**

- Context does not work in plain `.ts` files (`constants.ts`, `utils.ts`, `navigation-config.ts`)
- Data inheritance is the SvelteKit standard for the layout → page data flow
- No `await parent()` needed — labels are automatically available in `data`
- No additional API call per page — layout loads once

**Why not `$page.data` in components?**

- Hidden dependency: component implicitly depends on layout data
- Not testable: `$page` has to be mocked in tests
- Explicit props are clearer and type safe

### 3. Constants Pattern: Factory + Backward-Compatible Export

**Decision:** every module with hierarchy strings gets a factory function. A static export is preserved for unchanged consumers.

```typescript
// constants.ts — factory creates an object with dynamic + static properties
const BASE_MESSAGES = {
  // ~20 static strings (no label reference)
  PAGE_TITLE: 'Manage assets',
  BTN_SAVE: 'Save',
  // ...
} as const;

export function createMessages(labels: HierarchyLabels) {
  return {
    ...BASE_MESSAGES,
    // Only dynamic overrides
    HEADING: `${labels.asset} — Overview`,
    COL_AREA: labels.area,
    COL_DEPARTMENT: labels.department,
  } as const;
}

// Backward-compat: unchanged consumers continue to import MESSAGES
export const MESSAGES = createMessages(DEFAULT_HIERARCHY_LABELS);

// Type alias for child components
export type ModuleMessages = ReturnType<typeof createMessages>;
```

**Why factory + backward-compat instead of a breaking change?**

- Incremental rollout: pages are wired one by one, the rest still works
- No big-bang refactor: only pages that use dynamic properties have to be changed
- Type safety: `ReturnType<typeof createMessages>` produces the exact type without a separate interface definition

### 4. Page Wiring: Prop Threading

**Decision:** `+page.svelte` builds messages from labels, child components receive messages as a prop.

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

**Why prop threading instead of context/store?**

- Explicit: every dependency is visible in the component signature
- Testable: messages can be injected directly as a prop
- Consistent: follows the established SvelteKit pattern for data flow
- No boilerplate: 3 lines in the page script, 1 line in the child

### 5. Backend: Public Endpoint with Role-Level Guards

**Decision:** `/organigram/hierarchy-labels` is accessible to all authenticated roles (root, admin, employee), since labels are needed throughout the entire UI.

```typescript
@Get('hierarchy-labels')
@Roles(UserRole.ROOT, UserRole.ADMIN, UserRole.EMPLOYEE)
async getHierarchyLabels(@Req() req): Promise<HierarchyLabelsResponse> {
  // Reads from organigram_trees WHERE tenant_id = req.tenantId
  // Falls back to DEFAULT_HIERARCHY_LABELS when no tree exists
}
```

**Why no separate endpoint?**

- Labels are already stored in the org-chart tree (`custom_labels` JSONB field)
- An additional endpoint would have meant DB schema duplication
- Existing RLS policies protect the data automatically

---

## Alternatives Considered

### A. Svelte Context API (Rejected)

**Pros:** no prop drilling, set labels once → available everywhere
**Cons:** does not work in plain `.ts` files (constants, utils, navigation-config). These files have no component lifecycle and cannot call `getContext()`. Since ~50% of label uses live in `.ts` files, a hybrid would have been required (context for components, parameter for `.ts`) — inconsistent.

### B. Svelte store ($state in .svelte.ts) (Rejected)

**Pros:** reactive, globally available, also usable in `.ts` files
**Cons:** global state for tenant-specific data contradicts the SSR pattern. Labels could leak between requests/tenants. SvelteKit's data inheritance is the idiomatic solution for layout → page data flow.

### C. Inline Label Resolution (Rejected)

**Pros:** every spot resolves labels itself: `data.hierarchyLabels.area`
**Cons:** no central mapping from property → label. If the label structure changes, all ~250 spots have to be updated individually. The factory pattern centralizes the mapping.

### D. Backend-Side String Rendering (Rejected)

**Pros:** backend ships fully rendered strings, frontend only displays
**Cons:** backend would have to know and render all ~250 UI strings. Mixes presentation logic into the API. Multiplies API payload. Frontend localization becomes impossible.

### E. i18n Library (Rejected)

**Pros:** professional solution for string management, plural handling
**Cons:** massive overkill — Assixx is a German-language app. The 5 hierarchy labels are the only dynamic strings. Introducing an i18n library for 5 variables would be over-engineering. Can be introduced in V3 if multilingual support is required.

---

## Consequences

### Positive

- **Consistent UX**: tenant-specific labels visible everywhere — sidebar, breadcrumb, table headers, forms, tooltips
- **No performance impact**: labels are loaded in parallel with the existing layout fetches (one additional lightweight API call)
- **Incremental rollout**: backward-compatible exports allow stepwise wiring without a big bang
- **Type safe**: `ReturnType<typeof createMessages>` produces the exact type, no `any` or `Record<string, string>`
- **SSR-compatible**: labels are correct at first paint (no flash of default labels)
- **Testable**: factory functions are pure, props are directly injectable
- **~360 string replacements** across ~50+ files — fully covered by the factory pattern (V2: ~250, V2.1: ~110)

### Negative

- **Prop threading boilerplate**: every child component needs a `messages` prop + type import (3–5 lines per component)
- **~~Plural-only limitation~~ (V3 RESOLVED)**: solved by positional prefix fields (`areaLeadPrefix`, `departmentLeadPrefix`, `teamLeadPrefix`) in JSONB. `resolvePositionDisplay()` uses `${prefix}leiter` / `Stellv. ${prefix}leiter`. Form shows a live preview.
- **No live update**: label changes only become visible after navigation/reload, not in real time
- **~~7 modules not propagated~~ (V2.1 RESOLVED)**: employee-dashboard, documents-explorer, calendar, shifts, kvp, kvp-detail, blackboard — all ~110 spots propagated in V2.1
- **~~Sidebar user card not propagated~~ (V2.2 RESOLVED)**: `SidebarUserCard` displayed lead positions (`team_lead`, `area_lead`, `department_lead`) as raw DB values instead of using `resolvePositionDisplay()` — fixed via prop-threading of `hierarchyLabels` through layout → AppSidebar → SidebarUserCard
- **~~Deputy lead not represented as a position~~ (V2.3 RESOLVED via ADR-038, expanded V2.4)**: deputies on all 3 levels as system positions: `area_deputy_lead` → `${labels.area} Stellvertreter`, `department_deputy_lead` → `${labels.department} Stellvertreter`, `team_deputy_lead` → `${labels.team} Stellvertreter`. 6 system positions total, no separate HierarchyLabels field needed — display is derived from the existing labels.
- **No email/PDF propagation**: backend-generated text (notifications, exports) still uses default labels
- **`hall` is not an OrgEntityType**: hall has no own org-chart colour in `ENTITY_COLORS`, but a separate `HALL_COLOR` constant in the org-chart modal

---

## Implementation Summary

| Phase | Scope                                                | Sessions    | Files |
| ----- | ---------------------------------------------------- | ----------- | ----- |
| 1     | Backend: public endpoint                             | 1           | 2     |
| 2     | Frontend: layout + nav + breadcrumb                  | 1           | 5     |
| 3     | Management pages (areas, depts, teams, assets)       | 2           | ~20   |
| 4     | Remaining pages (halls, admins, dashboard, TPM, …)   | 4           | ~25   |
| 5     | Smoke test + docs + polish                           | 1 (pending) | ~3    |
| V2.1  | Repropagation: 7 deferred modules                    | 1           | ~35   |
| V2.2  | Sidebar user card: lead-position display             | 1           | 3     |
| V3    | Position prefix: prefix fields for correct compounds | 1           | ~10   |

**Total:** 11 sessions, ~360 string replacements, 0 breaking changes.

### V3: Position Prefix (2026-03-24)

3 new fields in JSONB (`areaLeadPrefix`, `departmentLeadPrefix`, `teamLeadPrefix`) solve the plural-only limitation. Instead of `${plural}-Leiter` ("Bereiche-Leiter"), `${prefix}leiter` ("Bereichsleiter") is generated. Deputies follow the pattern `Stellv. ${prefix}leiter`. No DB migration — pure JSONB extension. HierarchyLabelsModal shows prefix inputs with a live preview.

---

## References

- [Hierarchy Labels Propagation Masterplan](../../FEAT_HIERARCHY_LABELS_PROPAGATION_MASTERPLAN.md) — full execution plan (8 sessions, phases 1–5)
- [Org Chart Masterplan](../../FEAT_ORGANIGRAM_MASTERPLAN.md) — V1 org chart (Known Limitation #5 → this feature)
- [ADR-012](./ADR-012-frontend-route-security-groups.md) — Frontend Route Security Groups (layout structure)
- [ADR-020](./ADR-020-per-user-feature-permissions.md) — Per-User Feature Permissions
- [ADR-024](./ADR-024-frontend-feature-guards.md) — Frontend Feature Guards
- [ADR-026](./ADR-026-tpm-architecture.md) — TPM Architecture (one of the propagated modules)
