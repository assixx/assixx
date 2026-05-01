# HOW-TO: Fix Pagination for `manage-*` Pages

> **Created:** 2026-05-01 · **Status:** Living Doc · **Reference Impls:** `manage-employees`, `manage-admins`
>
> Step-by-step pattern + triage list for the systematic pagination bug across all `manage-*` pages.

---

## Problem

Backend `PaginationSchema` (in `backend/src/schemas/common.schema.ts`) defaults `limit = 10`. Any list endpoint that extends `PaginationSchema` returns at most 10 items unless the caller sends `?limit=N`. Frontend `manage-*` pages historically called those endpoints **without** `?limit` and **without a pagination UI** — users saw only the first 10 records, with no way to access the rest.

`extractResponseData` in `frontend/src/lib/server/api-fetch.ts` strips the `meta.pagination` envelope produced by `ResponseInterceptor` (ADR-007), so the frontend has no signal that more data exists. Result: silent data truncation.

**Bug confirmed in:** `manage-employees` (10/82 employees) → fixed v0.x.x. Same pattern audited across 11 `manage-*` pages.

---

## Fix Pattern (4 Files)

Reference implementation: `frontend/src/routes/(app)/(shared)/manage-employees/`. Mirror this structure exactly.

### 1. `+page.server.ts` — append `&limit=100` to the list URL

```ts
// BEFORE
apiFetch<Foo[]>('/foos', token, fetch),

// AFTER
// limit=100 = backend cap (PaginationSchema.max). For tenants with > 100
// foos we will need server-driven pagination (Phase 2) — current scope is
// client-side pagination on the loaded set (KISS, mirrors manage-employees).
apiFetch<Foo[]>('/foos?limit=100', token, fetch),
```

### 2. `_lib/types.ts` — add `PaginationPageItem`

```ts
export type PaginationPageItem = { type: 'page'; value: number; active?: boolean } | { type: 'ellipsis' };
```

### 3. `_lib/utils.ts` — `<NAME>_PER_PAGE` constant + `getVisiblePages()`

Copy the helper verbatim from `manage-employees/_lib/utils.ts` (3 lines + 30 lines). Rename only the constant: `EMPLOYEES_PER_PAGE` → `<NAME>_PER_PAGE`. Keep value at `25` for consistency.

### 4. `+page.svelte` — wire it up

- Import `<NAME>_PER_PAGE`, `getVisiblePages` from `./_lib/utils`
- Add state: `let currentPage = $state(1);`
- Add three derived: `totalPages`, `paginatedFoos`, `visiblePages`
- Add `$effect` that resets `currentPage = 1` when filter/search changes (use `void` reads on tracked vars)
- Add three one-line handlers: `goToPage`, `handlePreviousPage`, `handleNextPage`
- In the `{#each}` loop: switch `filteredFoos` → `paginatedFoos` (table only — keep `filteredFoos` for `SearchResults` dropdown so search still spans all pages)
- After `</table>`: insert the `<nav class="pagination">` block (copy verbatim from `manage-employees/+page.svelte`, gate with `{#if totalPages > 1}`)

The exact markup uses `pagination`, `pagination__btn`, `pagination__btn--prev/--next`, `pagination__pages`, `pagination__page`, `pagination__page--active`, `pagination__ellipsis`, `pagination__info` — all defined in `frontend/src/design-system/primitives/navigation/pagination.css`.

### Validation Checklist

```bash
cd frontend
pnpm exec prettier --write src/routes/.../manage-X/
NODE_OPTIONS='--max-old-space-size=8192' pnpm exec eslint src/routes/.../manage-X/
pnpm exec svelte-check --tsconfig ./tsconfig.json 2>&1 | grep manage-X
```

All three must pass with 0 errors. Watch for `svelte/max-lines-per-block` (script cap = 400 lines) — pagination handlers must be one-liners (`{ if (cond) currentPage = N; }`) to fit.

---

## Triage — Outstanding Pages

Sorted by severity (largest data loss first). Backend defaults verified by inspecting each `*.dto.ts`.

### High — silent data loss possible

| Page                  | Endpoint               | Backend Default                 | DB Count (T1) | Status                        |
| --------------------- | ---------------------- | ------------------------------- | ------------- | ----------------------------- |
| ✅ `manage-employees` | `/users?role=employee` | 10                              | 82 active     | **fixed**                     |
| ✅ `manage-admins`    | `/users?role=admin`    | 10                              | 3             | **fixed**                     |
| 🟡 `manage-surveys`   | `/surveys`             | 10 (extends `PaginationSchema`) | —             | **Phase 1 fixed** (see below) |
| ✅ `manage-root`      | `/users?role=root`     | 10                              | 1 per tenant  | **fixed**                     |

> **`manage-surveys` deviates from the canonical 4-step pattern.** The page renders three status sections (Active, Completed, Drafts) as card grids plus a Templates section — there is no single table to swap `filteredFoos` → `paginatedFoos` into. Phase 1 applied only Step 1 (`?limit=100` on `/surveys`) which closes the silent-truncation bug. Phase 2 (per-section pagination UI) is deferred until a tenant report shows the Completed section growing past ~25 entries; Active/Drafts are typically too small to need pagination, and Templates come from a separate endpoint (`/surveys/templates`).

### Medium — already paginated, verify UI presence

| Page                  | Endpoint                       | Backend Default | Notes                                                                |
| --------------------- | ------------------------------ | --------------- | -------------------------------------------------------------------- |
| ✅ `manage-assets`    | `/assets`                      | 20              | **fixed** (`&limit=100` + UI)                                        |
| ✅ `manage-dummies`   | `/dummy-users?page=1&limit=20` | 20 (sent)       | **server-paginated** (Phase 2 pattern: per-page reload + nav UI)     |
| ✅ `manage-approvals` | `/approvals?page=1&limit=20`   | 20 (sent)       | **fixed** (server-paginated, mirrors `manage-dummies`; UI nav added) |

### Low — backend has no pagination (no truncation, but UX consistency open)

| Page                 | Endpoint       | Notes                                                |
| -------------------- | -------------- | ---------------------------------------------------- |
| `manage-halls`       | `/halls`       | No `PaginationSchema` extension — full list returned |
| `manage-areas`       | `/areas`       | Same                                                 |
| `manage-departments` | `/departments` | Same                                                 |
| `manage-teams`       | `/teams`       | Same                                                 |

For the Low tier: pagination is **not required** for correctness. Add only if a tenant has > 50 entries and the table becomes unscrollable.

---

## Secondary Endpoints (Modal Dropdowns)

These calls also hit `PaginationSchema` (default 10) and feed dropdown options inside modals. Default-truncation here means **leads/team-members vanish from selectors**:

| Caller                               | Endpoint                                          | Risk                                       |
| ------------------------------------ | ------------------------------------------------- | ------------------------------------------ |
| `manage-areas`, `manage-departments` | `/users?role=admin&isActive=1&position=area_lead` | Misses lead-eligible admins after the 10th |
| `manage-areas`, `manage-departments` | `/users?role=root&isActive=1&position=area_lead`  | Misses lead-eligible roots after the 10th  |
| `manage-teams`                       | `/users?isActive=1&position=team_lead`            | Misses team-lead candidates                |
| `manage-teams`                       | `/users?role=employee`                            | Misses employees in team-member assignment |

**Fix:** append `&limit=100` to every such call. One-line edit per occurrence.

---

## Phase 2 — Server-Driven Pagination

Client-side pagination (current pattern) is bounded by the backend cap of 100. When any single tenant exceeds 100 records of a given type:

1. Switch the page to URL-driven pagination (`?page=N` query param read in `+page.server.ts`).
2. Replace the `apiFetch<T[]>` helper with a paginated variant that preserves `meta.pagination` (e.g. `apiFetchPaginated<T>` returning `{ data, pagination }`).
3. Move all filters (status, search) to backend query params — client-side filtering can no longer span pages.

Trigger: open a Phase-2 ticket the moment a tenant report shows incomplete results despite the `?limit=100` fix.

---

## References

- `backend/src/schemas/common.schema.ts` — `PaginationSchema` definition
- `backend/src/nest/common/interceptors/response.interceptor.ts` — wraps paginated responses with `meta.pagination`
- `frontend/src/lib/server/api-fetch.ts` — `extractResponseData` (drops `meta.pagination`)
- `frontend/src/design-system/primitives/navigation/pagination.css` — markup reference
- [ADR-007: API Response Standardization](../infrastructure/adr/ADR-007-api-response-standardization.md)
- [ADR-030: Zod Validation Architecture](../infrastructure/adr/ADR-030-zod-validation-architecture.md)
