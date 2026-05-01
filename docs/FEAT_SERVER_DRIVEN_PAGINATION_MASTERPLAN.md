# FEAT: Server-Driven Pagination — Execution Masterplan

> **Plan type:** FEATURE (refactor-as-feature: existing pages migrate to a canonical server-driven pagination pattern)
> **Created:** 2026-05-01
> **Version:** 0.1.0 (Draft — awaiting sign-off)
> **Status:** DRAFT — Phase 0
> **Branch:** `feat/server-driven-pagination`
> **Spec:** [HOW-TO-FIX-MANAGE-PAGINATION.md §"Phase 2 — Server-Driven Pagination"](./how-to/HOW-TO-FIX-MANAGE-PAGINATION.md)
> **Reference impl:** `frontend/src/routes/(app)/(root)/manage-dummies/` (already server-paginated per HOW-TO triage table, row 91)
> **Author:** SCS Technik
> **Estimated sessions:** 13
> **Actual sessions:** 0 / 13
> **Beta-Ready Criterion:** Every list page in the app correctly displays >100 records of its type without silent truncation, and every filter/search operation spans all pages, not just the loaded subset.

---

## Why now

Beta launch imminent. The current Phase-1 fix (`?limit=100`) is a hard ceiling: any tenant with 101 records of any type silently loses data. This is a correctness bug, not a performance optimization. Greenfield status (CLAUDE.md) gives us the freedom to make a breaking change to the URL/state model without backwards-compat shims — that window closes the moment the first paying tenant signs up.

---

## Changelog

| Version | Date       | Change                                             |
| ------- | ---------- | -------------------------------------------------- |
| 0.1.0   | 2026-05-01 | Initial draft — phases outlined, awaiting sign-off |

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must be true before starting

- [ ] Docker stack running, all containers healthy
- [ ] DB backup taken (no schema changes planned, but standard hygiene)
- [ ] Branch `feat/server-driven-pagination` checked out
- [ ] `manage-dummies` implementation reviewed by author — confirms it actually uses `?page=N` server-side
- [ ] Beta-launch date confirmed — drives session pace
- [ ] Sign-off from user on this masterplan (sets `Status: APPROVED`)

### 0.2 Risk Register

| #   | Risk                                                                                                                        | Impact | Probability | Mitigation                                                                                                                                                     | Verification                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| R1  | Removing client-side filter breaks search-across-pages UX — user types in search and only sees filtered subset of page 1    | High   | High        | Backend MUST accept `?search=` on every list endpoint; FE shows loading spinner during request                                                                 | API integration test: search query returns matches from records beyond page 1     |
| R2  | Backend endpoint does not yet support a filter the FE currently does client-side (e.g. `manage-employees` team/dept filter) | High   | Medium      | Phase 1 audits every endpoint and closes gaps BEFORE FE migration                                                                                              | Backend test per endpoint asserts every filter combination produces correct count |
| R3  | Mutations (create/delete) do not refresh paginated view → user sees stale data                                              | Medium | Medium      | Use `invalidateAll()` after mutation (existing pattern). URL retains `?page=N` so refresh keeps position                                                       | Manual smoke per page: create entry → list updates within current page            |
| R4  | Race condition: user changes page while previous request still in-flight → wrong data renders                               | Medium | Medium      | Use SvelteKit's built-in load-function semantics — last navigation wins                                                                                        | Manual: rapid page-button clicking shows latest page only                         |
| R5  | URL state pollution (`?page=1&search=&status=active&team=&dept=`)                                                           | Low    | High        | Only emit query params with non-default values. Bookmarkability is a feature.                                                                                  | URL inspection on default state shows clean `/manage-X` (no params)               |
| R6  | Backend doesn't paginate at all (manage-halls, manage-areas, manage-departments, manage-teams)                              | Medium | Low         | Out of scope for V1 — see Known Limitations. These pages stay client-side; add UI pagination only if list grows past 50 in real tenant.                        | Triage audit confirms no current/expected Beta tenant has >50 of any of these     |
| R7  | `apiFetchPaginated` introduces breaking change in `apiFetch` consumers                                                      | Medium | Low         | New helper is additive (`apiFetchPaginated` next to existing `apiFetch`). Old helper untouched.                                                                | All ~46 existing `apiFetch` call sites still compile after Phase 2                |
| R8  | Migrated page loses an existing UX detail (e.g. SearchResults dropdown spans all pages)                                     | Medium | Medium      | Keep `SearchResults` dropdown calling a separate endpoint that bypasses pagination (search-only view), OR use server-side `?search=` and accept narrower scope | Per-page manual smoke verifies search dropdown still finds entries on page 5      |

### 0.2.1 Audit findings — Existing Truncation Bugs (verified 2026-05-01)

Backend `/users` query, when called WITHOUT `isActive` param, returns `is_active != 4` (i.e. active + inactive + archived) — NOT only active. Default `limit` per `PaginationSchema` = 10. Status filter on FE main pages is **client-side** today. Combined effect:

| Bug                                                                                                                                                                                                                                                                                         | Symptom                                                                                        | Fix in this plan                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **B1: Main-page client-side status filter inside server-capped result.** Tenant with N inactive + M active employees: backend returns first 100 of (N+M) mixed; FE filters to "active". If many inactive sit before active in sort order, active records past index 100 vanish from the UI. | User toggles filter to "active", sees fewer entries than really exist.                         | Phase 4: status filter migrates to BACKEND query param (`?isActive=1`) — server returns only matching rows, client filter removed. |
| **B2: Lead-picker dropdowns ship NO `&limit=100`** (5 endpoints in `manage-areas` / `manage-departments` / `manage-teams`). Backend default 10 applies. Only first 10 lead candidates render in the modal.                                                                                  | Adding lead 11+ to a new area is structurally impossible from the UI.                          | Phase 1.3 (NEW): one-liner `&limit=100` per endpoint, before the FE migration. Then Phase 4.x for any page that consumes them.     |
| **B3: Employee-picker (`manage-teams` team-member assignment) ships NEITHER `isActive=1` NOR `&limit=100`.** Backend default 10 returns mixed status (active + inactive + archived).                                                                                                        | Only first 10 candidates render, may include inactive employees that should not be assignable. | Phase 4.12: typeahead refactor + `isActive=1` filter at the new endpoint contract.                                                 |

**B1 is the user's exact "99 inactive + 2 active → 1 active hidden" scenario.** It is THE motivation for moving the status filter server-side, not just client-side trimming.

### 0.3 Ecosystem Integration Points

| Existing system                                                                            | Integration                                                          | Phase | Verified on |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ----- | ----------- |
| `ResponseInterceptor` (ADR-007)                                                            | Already wraps `meta.pagination` — no change                          | —     | existing    |
| `extractResponseData` in `frontend/src/lib/server/api-fetch.ts`                            | NEW: `apiFetchPaginated<T>` variant that preserves `meta.pagination` | 2     |             |
| `PaginationSchema` (`backend/src/schemas/common.schema.ts`)                                | Already enforces `page`/`limit`/`offset` defaults — no change        | —     | existing    |
| SvelteKit `+page.server.ts` `url.searchParams`                                             | Read `?page`, `?search`, page-specific filters                       | 2, 4  |             |
| Pagination CSS (`frontend/src/design-system/primitives/navigation/pagination.css`)         | Reused as-is for visual consistency                                  | 4     | existing    |
| `manage-dummies`                                                                           | Pattern source for all migrations                                    | 2, 3  |             |
| `manage-employees`, `manage-admins` Phase-1 helpers (`getVisiblePages`, `<NAME>_PER_PAGE`) | Will be DELETED after their pages migrate (Phase 5 cleanup)          | 5     |             |

---

## Phase 1: Backend Endpoint Audit + Filter Extension

> **Dependency:** Phase 0 sign-off complete.
> **Goal:** Every list endpoint in scope supports server-side `?search=` AND every filter the FE currently performs client-side.

### Step 1.1: Per-endpoint audit [PENDING]

For each endpoint in the migration scope (Phase 4 list):

- [ ] Inspect query DTO — does it extend `PaginationSchema`?
- [ ] Inspect service — does it accept `search`, status, role, team_id, etc. as filter params?
- [ ] Inspect controller — does it pass query params to the service?
- [ ] Document gap → Step 1.2 backlog row

**Output:** `Phase-1-audit.md` (working file, deleted after Phase 1 close) listing one row per endpoint with status `OK | NEEDS-SEARCH | NEEDS-FILTER:<name>`.

### Step 1.2: Close audit gaps [PENDING]

Per gap from 1.1:

- [ ] Extend Zod query DTO with the missing field (e.g. `search: z.string().trim().min(1).optional()`)
- [ ] Add WHERE clause in service (`ILIKE '%' || $N || '%'` for search; standard `=` for filters)
- [ ] Update unit test
- [ ] Update API integration test

### Step 1.3: Fix B2 — lead-picker `&limit=100` one-liners [PENDING]

> **Why in Phase 1, not Phase 4:** independent FE one-liner that closes a current Beta-blocker (only 10 lead candidates render) without waiting for the full pagination refactor. Decoupled from §0.2.1 B1/B3.

Add `&limit=100` to these 5 frontend calls:

- [ ] `frontend/src/routes/(app)/(shared)/manage-areas/+page.server.ts:45` (`?role=admin&isActive=1&position=area_lead`)
- [ ] `frontend/src/routes/(app)/(shared)/manage-areas/+page.server.ts:46` (`?role=root&isActive=1&position=area_lead`)
- [ ] `frontend/src/routes/(app)/(shared)/manage-departments/+page.server.ts:49` (`?role=admin&isActive=1&position=department_lead`)
- [ ] `frontend/src/routes/(app)/(shared)/manage-departments/+page.server.ts:50` (`?role=root&isActive=1&position=department_lead`)
- [ ] `frontend/src/routes/(app)/(shared)/manage-teams/+page.server.ts:49` (`?isActive=1&position=team_lead`)
- [ ] Mirror the constants in `_lib/constants.ts` of each page (3 files)
- [ ] Manual smoke: seed 12 area_leads → all visible in modal dropdown

### Phase 1 — Definition of Done

- [ ] Audit complete for all 10 in-scope endpoints
- [ ] All identified gaps closed
- [ ] `docker exec assixx-backend pnpm run lint` → 0 errors
- [ ] `docker exec assixx-backend pnpm run type-check` → 0 errors
- [ ] All affected unit + API tests green
- [ ] No regression in untouched endpoints (`pnpm run test:api`)

---

## Phase 2: Frontend Infrastructure

> **Dependency:** Phase 1 complete (backend supports the queries we will fire).

### Step 2.1: `apiFetchPaginated<T>()` helper [PENDING]

**File:** `frontend/src/lib/server/api-fetch.ts` (extend existing)

```typescript
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export async function apiFetchPaginated<T>(
  endpoint: string,
  token: string,
  fetchFn: typeof fetch,
): Promise<PaginatedResult<T>>;
```

Preserves `meta.pagination` from the response envelope (which `extractResponseData` strips). Returns `data: []` + `pagination: { total: 0, ... }` on error (consistent with existing `apiFetch` failure mode).

### Step 2.2: URL-pagination helper [PENDING]

**File:** `frontend/src/lib/utils/url-pagination.ts` (new)

```typescript
export function readPageFromUrl(url: URL): number; // default 1
export function readSearchFromUrl(url: URL): string; // default ''
export function readFilterFromUrl<T extends string>(url: URL, key: string, allowed: readonly T[], defaultValue: T): T;
export function buildPaginatedHref(
  base: string,
  params: { page?: number; search?: string; [k: string]: unknown },
): string;
```

Single source of truth for URL ↔ state mapping. Only emits non-default values into the URL.

### Step 2.3: Unit tests [PENDING]

- [ ] `api-fetch.test.ts`: `apiFetchPaginated` preserves all `meta.pagination` fields, returns empty result on 4xx/5xx, supports the `apiFetchWithPermission` 403 detection pattern
- [ ] `url-pagination.test.ts`: only emits non-default params, parses defaults correctly, validates filter against allowlist

### Phase 2 — Definition of Done

- [ ] Both helpers exist with full TypeScript types (no `any`)
- [ ] Unit-test coverage ≥ 90 % on both helpers
- [ ] `cd frontend && pnpm run check` → 0 errors, 0 warnings
- [ ] `cd frontend && pnpm run lint` → 0 errors
- [ ] No `apiFetch` consumer breaks (additive change only)

---

## Phase 3: Reference Implementation Polish

> **Dependency:** Phase 2 complete.
> **Goal:** Lift `manage-dummies` to use the new helpers (currently uses inline pattern). It then becomes the canonical reference every other migration copies.

### Step 3.1: Migrate `manage-dummies` to new helpers [PENDING]

- [ ] Replace inline pagination logic in `+page.server.ts` with `apiFetchPaginated` + `readPageFromUrl`
- [ ] Replace inline pagination markup in `+page.svelte` with the canonical pattern (URL-driven `<a href>` links, NOT button click handlers)
- [ ] Manual smoke: create dummies past page boundary, verify all visible, verify search works across pages

### Step 3.2: Document the pattern in HOW-TO [PENDING]

- [ ] Update `docs/how-to/HOW-TO-FIX-MANAGE-PAGINATION.md` §"Phase 2 — Server-Driven Pagination" with a copy-paste-ready snippet of the migrated `manage-dummies` (replaces the current 3-step abstract description with a concrete reference)

### Phase 3 — Definition of Done

- [ ] `manage-dummies` works identically to before (smoke-tested manually with >25 dummies)
- [ ] Doc updated with copy-paste reference
- [ ] svelte-check + lint clean for `manage-dummies`

---

## Phase 4: Page Migrations (parallelizable across sessions)

> **Dependency:** Phase 3 complete.
> **Pattern per page:** 1 session = `+page.server.ts` + `+page.svelte` + filter wiring + manual smoke.

### Migration order (priority by Beta blast radius)

| #    | Page                  | Endpoint                                                          | Notes                                                                                                                                                                                                              | Status  |
| ---- | --------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| 4.1  | `manage-employees`    | `/users?role=employee`                                            | Largest typical tenant volume — start here                                                                                                                                                                         | PENDING |
| 4.2  | `manage-admins`       | `/users?role=admin`                                               | Critical role, low data — fast win after 4.1 sets pattern                                                                                                                                                          | PENDING |
| 4.3  | `manage-approvals`    | `/approvals`                                                      | Already server-paginated — verify alignment with new pattern                                                                                                                                                       | PENDING |
| 4.4  | `manage-assets`       | `/assets`                                                         | Currently `&limit=100` Phase-1 hack                                                                                                                                                                                | PENDING |
| 4.5  | KVP suggestions       | `/kvp-suggestions` (or equivalent)                                | Could grow large per tenant                                                                                                                                                                                        | PENDING |
| 4.6  | blackboard entries    | `/blackboard/entries`                                             | Could grow large                                                                                                                                                                                                   | PENDING |
| 4.7  | work-orders           | `/work-orders`                                                    | Could grow large                                                                                                                                                                                                   | PENDING |
| 4.8  | inventory items       | `/inventory/items`                                                | Designed for huge inventories — biggest scaling risk                                                                                                                                                               | PENDING |
| 4.9  | documents-explorer    | `/documents`                                                      | File lists per folder                                                                                                                                                                                              | PENDING |
| 4.10 | `manage-surveys`      | `/surveys`                                                        | THREE card sections — apply per-section pagination per HOW-TO note                                                                                                                                                 | PENDING |
| 4.11 | TPM plans + cards     | `/tpm/plans`, `/tpm/cards`                                        | Two endpoints, can do in one session                                                                                                                                                                               | PENDING |
| 4.12 | Employee-picker modal | `/users?role=employee` (team-member assignment in `manage-teams`) | Currently `&limit=100` — HARD BUG: tenant with >100 employees can only assign first 100 to teams. Refactor dropdown → typeahead (search-as-you-type, debounced `?search=` request, no client-side full-list cache) | PENDING |

### Per-Page Definition of Done

For each row in the migration table:

- [ ] `+page.server.ts` reads `?page`, `?search`, and any page-specific filters from `url.searchParams`
- [ ] Backend call uses `apiFetchPaginated`
- [ ] `+page.svelte` removes client-side filtering — search field now triggers URL update (`goto` with new `?search=`)
- [ ] Pagination UI uses URL-update navigation: `<a href={resolve(buildPaginatedHref(...))}>` instead of `onclick={() => currentPage = N}`
- [ ] `invalidateAll()` after mutations triggers re-fetch on the current page
- [ ] Manual smoke test (record in session log):
  - [ ] Tenant with >25 records sees ALL pages
  - [ ] Search returns matches from a record on page 3 (verify cross-page search)
  - [ ] Filter (status / role / etc.) re-fetches and resets to page 1
  - [ ] Browser back-button restores previous page state
- [ ] svelte-check 0 errors for the migrated page
- [ ] ESLint 0 errors for the migrated page
- [ ] Old client-side helpers (`<NAME>_PER_PAGE`, `getVisiblePages` if local-only) deleted

---

## Phase 5: Tests + ADR + Cleanup

> **Dependency:** All Phase 4 migrations complete.

### Step 5.1: API integration tests [PENDING]

For each migrated endpoint, add to `backend/test/<feature>.api.test.ts`:

- [ ] `?page=2&limit=25` returns correct slice + correct `meta.pagination.totalPages`
- [ ] `?search=<term>` returns matches that exist beyond page 1
- [ ] Combined `?page=2&search=<term>` returns correct slice of search hits
- [ ] Tenant isolation still holds (sanity check — RLS unchanged but verify)

### Step 5.2: Remove `?limit=100` Phase-1 hacks [PENDING]

- [ ] `grep -rn '?limit=100\|&limit=100' frontend/src/routes/`
- [ ] Replace each occurrence with the new pattern OR delete if the page was migrated
- [ ] Confirm zero occurrences remain in production code (test files may keep them for fixture setup)

### Step 5.3: ADR [PENDING]

- [ ] Write `docs/infrastructure/adr/ADR-{NEXT}-server-driven-pagination.md`
  - **Decision:** server-driven pagination as the canonical list-rendering pattern across all `manage-*` and addon list pages
  - **Rationale:** greenfield-Beta requirement; scaling beyond 100 records per tenant per type
  - **Alternatives considered:**
    - Client-side `?limit=100` (status quo before this plan) — REJECTED, hard ceiling at 100
    - Cursor / keyset pagination — REJECTED for V1, KISS, page+offset acceptable up to 10 k
    - GraphQL relay-style connections — REJECTED, no GraphQL in stack
  - **Consequences:** every new list page MUST use `apiFetchPaginated` + URL-driven state from day one — enforced by code review
- [ ] Add ADR row to `docs/ARCHITECTURE.md` §1.5 "Frontend (SvelteKit)"

### Step 5.4: Update HOW-TO doc [PENDING]

- [ ] Mark Phase 2 as DONE in `docs/how-to/HOW-TO-FIX-MANAGE-PAGINATION.md`
- [ ] Triage tables — every page migrated marked ✅
- [ ] Add cross-link to the new ADR

### Phase 5 — Definition of Done

- [ ] All migrated pages covered by API integration tests
- [ ] Zero `?limit=100` remnants in `frontend/src/routes/` (production code)
- [ ] ADR written, accepted, linked from `docs/ARCHITECTURE.md` §1.5
- [ ] HOW-TO doc updated, Phase 2 marked DONE
- [ ] Final smoke: every migrated page tested in dev with synthetic >100 records seed

---

## Session Tracking

| Session | Phase | Description                                                | Status | Date |
| ------- | ----- | ---------------------------------------------------------- | ------ | ---- |
| 1       | 0+1   | Audit endpoints, document gaps in `Phase-1-audit.md`       |        |      |
| 2       | 1     | Close backend gaps (search/filter params) + tests          |        |      |
| 3       | 2     | `apiFetchPaginated` + `url-pagination` helpers + tests     |        |      |
| 4       | 3     | Migrate `manage-dummies` to canonical pattern + doc update |        |      |
| 5       | 4     | `manage-employees` (sets pattern reference)                |        |      |
| 6       | 4     | `manage-admins` + `manage-approvals` + `manage-assets`     |        |      |
| 7       | 4     | KVP + blackboard                                           |        |      |
| 8       | 4     | work-orders + inventory                                    |        |      |
| 9       | 4     | documents-explorer + `manage-surveys`                      |        |      |
| 10      | 4     | TPM plans + cards                                          |        |      |
| 11      | 4     | Employee-picker typeahead refactor (4.12)                  |        |      |
| 12      | 5     | API integration tests                                      |        |      |
| 13      | 5     | ADR + HOW-TO update + Phase-1 hack cleanup                 |        |      |

### Session log template

```markdown
### Session {N} — {YYYY-MM-DD}

**Goal:** {what should be achieved}
**Result:** {what was actually achieved}
**New files:** {list}
**Changed files:** {list}
**Verification:**

- ESLint: {0 errors / N errors → fixed}
- Type-check: {0 errors}
- Tests: {N / N passed}
- Manual smoke: {pass / fail per per-page DoD}

**Deviations:** {what differed from plan and why}
**Next session:** {what comes next}
```

---

## Spec Deviations

| #          | Spec says | Actual code | Decision |
| ---------- | --------- | ----------- | -------- |
| (none yet) |           |             |          |

---

## Known Limitations (V1 — deliberately excluded)

1. **`manage-halls` / `manage-areas` / `manage-departments` / `manage-teams`** — backend does not paginate these endpoints (no `PaginationSchema` extension). Out of scope for V1. Beta tenants are not expected to have >50 of any of these (typical tenant: ~5–20 areas, ~10–50 departments, ~20–100 teams). Re-evaluate post-Beta if real data shows otherwise. Mitigation if needed: client-side pagination on the rendered list (no backend touch).
2. **Lead-picker modal dropdowns** (5 endpoints — get `&limit=100` in Phase 1.3, then stay at that ceiling):
   - `manage-areas` → `/users?role=admin&isActive=1&position=area_lead`
   - `manage-areas` → `/users?role=root&isActive=1&position=area_lead`
   - `manage-departments` → `/users?role=admin&isActive=1&position=department_lead`
   - `manage-departments` → `/users?role=root&isActive=1&position=department_lead`
   - `manage-teams` → `/users?isActive=1&position=team_lead`

   Realistic tenant volume: 1 root, 5–20 area-leads, 5–20 department-leads, 10–50 team-leads. The 100 ceiling is structurally unreachable for the Beta target audience. All 5 endpoints already filter `isActive=1` server-side, so inactive leads cannot push active ones out of the result. If a tenant ever lands a 101st active lead candidate the dropdown silently truncates — risk accepted. Migration path if needed: same typeahead pattern as Phase 4.12. **Note:** the employee-picker (`/users?role=employee` in the team-member assignment) is NOT a Known Limitation — it IS migrated in Phase 4.12 because (a) tenant volume realistically exceeds 100 employees and (b) it currently lacks `isActive=1` (audit B3 in §0.2.1).

3. **Cursor / keyset pagination** — current backend uses `page` + `limit` (offset). Acceptable up to ~10 k records per tenant per type. If a single tenant grows past that, a dedicated optimization plan is needed (would require backend rewrite of every list endpoint).
4. **Saved searches / persistent filter presets** — out of scope. URL is the only state.
5. **Real-time list updates via SSE** — out of scope. Lists refresh on mutation via `invalidateAll()`.
6. **Bulk actions across pages** — out of scope. Bulk-select stays per-page.
7. **Chat history pagination** — already handled by WebSocket `?before=<msgId>` cursor pattern, not affected.
8. **Calendar / shift views** — date-bound rendering, not list-bound. Not in scope.

---

## Post-Mortem (fill after completion)

### What went well

- (empty)

### What went badly

- (empty)

### Metrics

| Metric                   | Planned | Actual |
| ------------------------ | ------- | ------ |
| Sessions                 | 12      | —      |
| Backend files changed    | ~10     | —      |
| New backend files        | 0       | —      |
| New frontend files       | 2       | —      |
| Frontend files changed   | ~22     | —      |
| Migration files          | 0       | —      |
| Unit tests               | ~10     | —      |
| API tests                | ~30     | —      |
| ESLint errors at release | 0       | —      |
| Spec deviations          | 0       | —      |

---

**This document is the execution plan. Every session starts here, takes the next unchecked item, and marks it done. No coding starts before §0 is signed off.**
