# FEAT: Server-Driven Pagination — Execution Masterplan

> **Plan type:** FEATURE (refactor-as-feature: existing pages migrate to a canonical server-driven pagination pattern)
> **Created:** 2026-05-01
> **Version:** 1.0.0 (APPROVED — Phase 0 sign-off 2026-05-01)
> **Status:** APPROVED — ready for Phase 1
> **Branch:** `feat/server-driven-pagination`
> **Spec:** [HOW-TO-FIX-MANAGE-PAGINATION.md §"Phase 2 — Server-Driven Pagination"](./how-to/HOW-TO-FIX-MANAGE-PAGINATION.md)
> **Reference impl:** `frontend/src/routes/(app)/(root)/manage-dummies/` — currently NOT truly server-paginated (page=1 hardcoded, non-envelope response shape). Phase 3 makes it canonical first; only THEN is it the reference for Phase 4.
> **Author:** SCS Technik
> **Estimated sessions:** 17
> **Actual sessions:** 1 / 17 (Session 1 + Session 2a closed 2026-05-01)
> **Beta-Ready Criterion:** Every list page in the app correctly displays >100 records of its type without silent truncation, and every filter/search operation spans all pages, not just the loaded subset.

---

## Why now

Beta launch imminent. The current Phase-1 fix (`?limit=100`) is a hard ceiling: any tenant with 101 records of any type silently loses data. This is a correctness bug, not a performance optimization. Greenfield status (CLAUDE.md) gives us the freedom to make a breaking change to the URL/state model without backwards-compat shims — that window closes the moment the first paying tenant signs up.

---

## Changelog

| Version | Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-05-01 | Initial draft — phases outlined, awaiting sign-off                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 1.0.0   | 2026-05-01 | **Phase-0 Sign-off.** Decisions recorded: (1) Branch = `feat/server-driven-pagination` (already checked out). (2) `manage-dummies` Reference-Impl ist NICHT echt server-paginiert (`page=1` hardcoded in `+page.server.ts:39`, non-envelope response shape `{ items, total, pageSize }`). Phase 3 erweitert sich von "polish" zu "rebuild backend dummy-users to ADR-007 envelope + frontend to URL-state" — +1 Session. (3) Phase 1.3 `&limit=100` Band-aid für Lead-Picker entfällt. Stattdessen Phase 4.12 expandiert zu unifiziertem Typeahead-Component für alle 6 Picker (5 Lead + 1 Employee) — +1 Session. (4) `manage-halls/areas/departments/teams` bleiben Out of scope V1 (Known Limitation #1). Sessions 13 → 15. Zusätzliche Beobachtung aus HOW-TO-FIX-MANAGE-PAGINATION Triage row 92: `manage-approvals` "mirrors manage-dummies" — Phase 4.3 muss verifizieren ob auch broken-by-mirror. PaginationMeta `hasNext`/`hasPrev` sind FE-derived (`page < totalPages` / `page > 1`), NICHT von Backend erwartet — ADR-007 spec ist `{ page, limit, total, totalPages }`. |
| 1.1.0   | 2026-05-01 | **Phase 1.1 + Phase 1.2a Stage A complete.** Phase 1.1 audit liefert `docs/Phase-1-audit.md` (12 Endpoints + 6 Picker). Audit splittet Phase 1.2 in 2 Sessions (1.2a + 1.2b). Phase 1.2a wird intern weiter gesplittet in Stage A (4 simple DTO-Refactors, kein Service-Touch) + Stage B (4 NEEDS-SEARCH Endpoints — DTO + Controller + Service + SQL atomar). **Stage A DONE:** assets/inventory-items/documents/dummy-users DTOs extends PaginationSchema, D3 search-Konvention (`.trim().max(100).optional()`), 224/224 tests pass. Sessions 15 → 17 (Phase 1.2 = 1.2a-A + 1.2a-B + 1.2b = 3 Sessions statt 2). Audit-Befund §6: TPM `PageSchema`/`LimitSchema` lokal in `tpm/dto/common.dto.ts` werden auch von 3 OUT-OF-SCOPE DTOs genutzt (executions, revisions, board) — Stage B refactored nur die 2 in-scope (plans, cards) auf PaginationSchema. TPM-locals-Cleanup als Phase-5.2 Task vermerkt.                                                                                                                                                                           |

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must be true before starting

- [x] Docker stack running, all containers healthy (verified 2026-05-01: backend up 2h, postgres healthy, redis healthy, full observability stack)
- [ ] DB backup taken — **DEFERRED** (no schema changes planned in this plan; backup hygiene only useful if Phase 1 audit surfaces a backend extension that touches DB. Re-evaluate at Phase 1.2 close.)
- [x] Branch `feat/server-driven-pagination` checked out (user-confirmed 2026-05-01)
- [x] `manage-dummies` implementation reviewed — **FINDING:** NOT actually server-paginated (`+page.server.ts:39` hardcodes `?page=1`, response shape `PaginatedDummies { items, total, pageSize }` violates ADR-007 envelope `meta.pagination`). Phase 3 reframed: rebuild backend response + FE URL-state instead of "polish".
- [ ] Beta-launch date confirmed — **DEFERRED** (does not affect correctness, only session pace; user can answer during execution)
- [x] Sign-off from user on this masterplan (Phase 0 Decisions Q1–Q4 answered 2026-05-01, status APPROVED, version 1.0.0)

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

### Step 1.1: Per-endpoint audit ✅ DONE (2026-05-01)

For each endpoint in the migration scope (Phase 4 list):

- [x] Inspect query DTO — does it extend `PaginationSchema`?
- [x] Inspect service — does it accept `search`, status, role, team_id, etc. as filter params?
- [x] Inspect controller — does it pass query params to the service?
- [x] Document gap → Step 1.2 backlog row

**Output:** [`docs/Phase-1-audit.md`](./Phase-1-audit.md) — 12 Endpoints + 6 Picker auditiert. Status pro Endpoint: `OK` (3) | `NEEDS-SEARCH` (5) | `NEEDS-PAGINATION` (7) | `NEEDS-DTO` (1, /approvals). Audit identifiziert: (a) 5 Endpoints brauchen `search`-Feld, (b) 7 Endpoints duplizieren page/limit statt PaginationSchema zu extenden, (c) `/approvals` ist inline TS interface ohne Zod, (d) `/users` (Picker-Backend) ist OK — Phase 4.12 PickerTypeahead kann sofort `?search=` nutzen ohne Backend-Arbeit, (e) `/dummy-users` Shape-Anomalie für Phase 3 bestätigt. **Audit empfiehlt Phase 1.2 → 2 Sessions splitten** (1.2a: search + PaginationSchema-Refactor für 7 Endpoints | 1.2b: `/approvals` DTO-Migration eigenständig). Sessions-Count müsste ggf. 15 → 16 wenn akzeptiert.

### Step 1.2: Close audit gaps — split per audit empfehlung (3 Sub-Steps)

Audit `Phase-1-audit.md` §6 empfahl ursprünglich Phase 1.2 → 2 Sessions (1.2a + 1.2b). Bei tieferer Code-Inspektion wurde 1.2a weiter gesplittet in Stage A (simple DTO-Only) + Stage B (DTO + Service + SQL atomar). Begründung: TPM `listPlans(tenantId, page, pageSize, user)` und work-orders `buildPaginatedList`-Helper sind unterschiedliche Service-Signaturen — atomare per-Endpoint-Edits (DTO + Controller + Service + SQL) verhindern Halb-Zustände.

#### Step 1.2a Stage A — DTO-Refactor (4 simple Endpoints) ✅ DONE 2026-05-01

Endpoints mit `search` BEREITS server-seitig implementiert — nur DTO-Konsolidierung nötig, kein Service-Touch:

- [x] `/assets` — `backend/src/nest/assets/dto/list-assets-query.dto.ts`: extends `PaginationSchema` mit `.extend({ limit: default(20), search: trim().max(100).optional(), ... })`
- [x] `/inventory/items` — `backend/src/nest/inventory/dto/common.dto.ts:43` `ItemsQuerySchema`: extends `PaginationSchema` mit `limit: default(50)`, search tightened 255 → 100
- [x] `/documents` — `backend/src/nest/documents/dto/query-documents.dto.ts`: extends `PaginationSchema`, schema renamed PascalCase + exported (`ListDocumentsQuerySchema`), search tightened 200 → 100
- [x] `/dummy-users` — `backend/src/nest/dummy-users/dto/list-dummy-users-query.dto.ts`: extends `PaginationSchema`, search now `.trim().max(100)`
- [x] D1 angewandt: per-Endpoint limit-Defaults via `.extend()` Override (assets/documents/dummy-users=20, inventory=50)
- [x] D3 angewandt: search-Konvention `.trim().max(100).optional()` einheitlich
- [x] Type-check: 0 errors
- [x] Lint: 0 errors
- [x] Tests: **224/224 pass** (5 test files: assets DTO 46, inventory DTO 112, documents DTO 20, dummy-users service 29, dummy-users helpers 17)

#### Step 1.2a Stage B — search WHERE addition (4 NEEDS-SEARCH Endpoints) [PENDING]

Endpoints brauchen NEU `search` Field PLUS Service-WHERE-Klausel atomar:

| #   | Endpoint       | Files to touch                                                                                                                                                                                      | SQL ILIKE-Targets (proposed) |
| --- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| B-1 | `/surveys`     | `query-survey.dto.ts` (add search) + `surveys.service.ts:61` listSurveys (query type) + `survey-access.service.ts:136` fetchSurveysByAccessLevel (signature + ILIKE WHERE)                          | s.title, s.description       |
| B-2 | `/work-orders` | `list-work-orders-query.dto.ts` (extend PaginationSchema, override limit=20 max=100 [D2: 500→100], add search) + `work-orders.service.ts:625` buildPaginatedList (signature + ILIKE WHERE)          | wo.title, wo.description     |
| B-3 | `/tpm/plans`   | `list-plans-query.dto.ts` (extend PaginationSchema, override limit=20, add search) + `tpm/tpm-plans.service.ts:212` listPlans (signature `(tenantId, page, pageSize, user, search?)` + ILIKE WHERE) | p.title (oder name)          |
| B-4 | `/tpm/cards`   | `list-cards-query.dto.ts` (extend PaginationSchema, override limit=20, add search) + tpm-cards service list method + ILIKE WHERE                                                                    | c.title                      |

- [ ] Pro Endpoint: DTO-Edit + Controller-Edit (forward search arg) + Service-Signature + SQL ILIKE
- [ ] Type-check + Lint + Touched Tests grün pro Endpoint
- [ ] Backwards-compat: query.search undefined ⇒ kein WHERE clause (kein Verhaltens-Wechsel ohne search-Param)

#### Step 1.2b — `/approvals` inline interface → Zod DTO migration [PENDING]

Größter Single-Endpoint-Refactor. Eigene Session weil DTO/Service-Contract sich ändert.

- [ ] `approvals.controller.ts:52` inline `ListApprovalsQuery` interface löschen
- [ ] Neue Zod DTO `backend/src/nest/approvals/dto/list-approvals-query.dto.ts` erstellen, extends `PaginationSchema` + add search (D3) + bestehende Filter (status, addonCode, priority)
- [ ] Controller: `@Query() query: ListApprovalsQueryDto` statt inline-typed param
- [ ] Service `findAll`: Signatur an DTO anpassen, ILIKE WHERE hinzufügen für search
- [ ] Tests aktualisieren

### Step 1.3: ~~Fix B2 — lead-picker `&limit=100` one-liners~~ **REMOVED** (Decision Q3, 2026-05-01)

> **Why removed:** `&limit=100` ist ein Band-aid, das beim 101. aktiven Lead silently truncated. Direkter Widerspruch zur "no quick fix"-Regel. Phase 4.12 expandiert stattdessen zu einem unifizierten debounced typeahead-Component, der ALLE 6 Picker-Endpoints bedient (5 Lead + 1 Employee). Single source of truth, kein structural ceiling, langfristig sauber.

**Backend-Vorbereitung in Phase 1:** verifiziere im Audit (1.1), dass `/users` Endpoint bereits `?search=` unterstützt. Wenn ja → keine Backend-Änderung nötig; alle 6 Picker konsumieren denselben Endpoint via Phase 4.12 Component. Wenn nein → Search-Param via Step 1.2 ergänzen.

**Mitigation während Phase 1–3 läuft (vor Phase 4.12):** die 6 Picker bleiben bei Backend-Default `limit=10`. Tenants mit >10 Lead-Kandidaten sehen nur die ersten 10 — bekanntes Issue, aber strukturell unter Beta-Schwelle (typischerweise 5–20 Area-Leads, 10–50 Dept-Leads, 20–50 Team-Leads). Risiko akzeptiert für ~12 Sessions Übergangszeit. **Wenn ein Beta-Tenant vor Phase 4.12 das Problem trifft:** Phase 4.12 priorisieren statt Band-aid.

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
  // From backend (ADR-007 envelope `meta.pagination`):
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  // FE-derived (NOT from backend — backend ADR-007 spec doesn't include these):
  hasNext: boolean; // = page < totalPages
  hasPrev: boolean; // = page > 1
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

## Phase 3: Reference Implementation — REBUILD (not polish)

> **Dependency:** Phase 2 complete.
> **Goal:** Make `manage-dummies` truly canonical. **Status today (verified 2026-05-01):** `+page.server.ts:39` hardcodes `?page=1`; response shape `PaginatedDummies { items, total, pageSize }` violates ADR-007 envelope `meta.pagination`. This is NOT a "polish" step — both backend AND frontend need real changes. After this phase, `manage-dummies` becomes the binding reference every Phase-4 migration copies verbatim.

### Step 3.1: Backend — `dummy-users` to ADR-007 envelope [PENDING]

> **Why first:** the FE refactor (Step 3.2) depends on `meta.pagination` being present. Backend must ship envelope first.

- [ ] Inspect `backend/src/nest/dummy-users/dummy-users.controller.ts` — verify it returns `{ items, total, pageSize }` shape
- [ ] Refactor controller to return `data: T[]` directly. `ResponseInterceptor` (ADR-007) will wrap it as `{ success, data, meta: { pagination: { page, limit, total, totalPages } }, timestamp }`
- [ ] Service: ensure pagination metadata is computed and attached via the standard interceptor signal (check existing pattern in another paginated endpoint, e.g. `/users` paginated query)
- [ ] Update affected DTOs / response types
- [ ] API integration test: `GET /dummy-users?page=2&limit=10` returns canonical envelope with correct `meta.pagination.totalPages`
- [ ] Backwards-compat consideration: greenfield (CLAUDE.md) — break the shape, no shim needed

### Step 3.2: Frontend — `manage-dummies` to URL-state + new helpers [PENDING]

- [ ] Remove `extractDummies()` helper in `+page.server.ts` (was a workaround for non-canonical shape — no longer needed)
- [ ] Remove `PaginatedDummies` type from `_lib/types.ts` (replace with `PaginatedResult<DummyUser>` from `api-fetch.ts`)
- [ ] Replace `apiFetch<PaginatedDummies>('/dummy-users?page=1&limit=20', token, fetch)` with `apiFetchPaginated<DummyUser>('/dummy-users?' + new URLSearchParams({...}).toString(), token, fetch)`
- [ ] Read `?page` via `readPageFromUrl(url)`, `?search` via `readSearchFromUrl(url)`
- [ ] `+page.svelte`: pagination UI uses URL-driven `<a href={resolve(buildPaginatedHref(...))}>` links, NOT button-onclick state mutation
- [ ] Search input → `goto()` with debounced URL update (not local filter)
- [ ] Verify `invalidateAll()` after create/delete keeps current page
- [ ] Manual smoke: create 30 dummies, navigate page 1→2→3, verify search "abc" finds match on page 3, verify back-button restores

### Step 3.3: Document the pattern in HOW-TO [PENDING]

- [ ] Update `docs/how-to/HOW-TO-FIX-MANAGE-PAGINATION.md` §"Phase 2 — Server-Driven Pagination" with copy-paste-ready snippets of the migrated `manage-dummies` (replaces the 3-step abstract description)
- [ ] Correct triage table row 91 — was claiming `manage-dummies` is server-paginated; document the rebuild
- [ ] Add note to row 92 (`manage-approvals` "mirrors manage-dummies"): re-verify in Phase 4.3

### Phase 3 — Definition of Done

- [ ] `dummy-users` backend ships ADR-007 envelope (verified by API integration test)
- [ ] `manage-dummies` FE reads URL state, page navigation = URL update, search spans all pages
- [ ] Manual smoke with >30 dummies passes all 4 cases (page nav, cross-page search, filter reset, browser back)
- [ ] `cd frontend && pnpm run check` 0 errors for the page
- [ ] `docker exec assixx-backend pnpm run lint && pnpm run type-check` 0 errors for backend changes
- [ ] HOW-TO doc updated with concrete snippets

---

## Phase 4: Page Migrations (parallelizable across sessions)

> **Dependency:** Phase 3 complete.
> **Pattern per page:** 1 session = `+page.server.ts` + `+page.svelte` + filter wiring + manual smoke.

### Migration order (priority by Beta blast radius)

| #    | Page                                          | Endpoint                                                                | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Status  |
| ---- | --------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 4.1  | `manage-employees`                            | `/users?role=employee`                                                  | Largest typical tenant volume — start here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | PENDING |
| 4.2  | `manage-admins`                               | `/users?role=admin`                                                     | Critical role, low data — fast win after 4.1 sets pattern                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | PENDING |
| 4.3  | `manage-approvals`                            | `/approvals`                                                            | HOW-TO triage row 92 claims "server-paginated, mirrors manage-dummies". Da `manage-dummies` nachweislich broken war (page=1 hardcoded), MUSS hier verifiziert werden ob auch broken-by-mirror. Wenn ja: gleicher Rebuild wie Phase 3 statt einfacher Migration                                                                                                                                                                                                                                                                                                         | PENDING |
| 4.4  | `manage-assets`                               | `/assets`                                                               | Currently `&limit=100` Phase-1 hack                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | PENDING |
| 4.5  | KVP suggestions                               | `/kvp-suggestions` (or equivalent)                                      | Could grow large per tenant                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | PENDING |
| 4.6  | blackboard entries                            | `/blackboard/entries`                                                   | Could grow large                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | PENDING |
| 4.7  | work-orders                                   | `/work-orders`                                                          | Could grow large                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | PENDING |
| 4.8  | inventory items                               | `/inventory/items`                                                      | Designed for huge inventories — biggest scaling risk                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | PENDING |
| 4.9  | documents-explorer                            | `/documents`                                                            | File lists per folder                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | PENDING |
| 4.10 | `manage-surveys`                              | `/surveys`                                                              | THREE card sections — apply per-section pagination per HOW-TO note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | PENDING |
| 4.11 | TPM plans + cards                             | `/tpm/plans`, `/tpm/cards`                                              | Two endpoints, can do in one session                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | PENDING |
| 4.12 | **Picker-Typeahead-Component (alle 6 Sites)** | `/users?role=...` mit verschiedenen `position`/`isActive`-Kombinationen | **Decision Q3 (2026-05-01):** EIN unifiziertes debounced typeahead-Component (`PickerTypeahead.svelte`), 6 Konsumenten: 5 Lead-Picker (manage-areas Admin+Root, manage-departments Admin+Root, manage-teams Team-Lead) + 1 Employee-Picker (manage-teams Team-Member-Assignment). Eliminiert `&limit=100` Band-aid komplett. Pattern: `?search=<term>&limit=20` debounced 250ms, ohne client-side full-list-cache. Schätzung: 1 Session Component + 1 Session 6-Site-Wirings = 2 Sessions. Backend: `/users` muss `?search=` unterstützen (Step 1.1 Audit verifiziert) | PENDING |

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

| Session | Phase  | Description                                                                                                                                         | Status  | Date       |
| ------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| 1       | 0+1    | Audit endpoints, document gaps in `Phase-1-audit.md`                                                                                                | ✅ DONE | 2026-05-01 |
| 2a      | 1.2a-A | DTO-Refactor 4 simple Endpoints (assets, inventory/items, documents, dummy-users) — extends `PaginationSchema`, D1+D3 angewandt, 224/224 tests pass | ✅ DONE | 2026-05-01 |
| 2b      | 1.2a-B | search WHERE addition (surveys, work-orders, tpm/plans, tpm/cards) — DTO + Controller + Service + SQL atomar                                        |         |            |
| 2c      | 1.2b   | `/approvals` inline interface → Zod DTO migration                                                                                                   |         |            |
| 3       | 2      | `apiFetchPaginated` + `url-pagination` helpers + tests                                                                                              |         |            |
| 4       | 3.1    | **NEW** Backend `dummy-users` → ADR-007 envelope + API tests                                                                                        |         |            |
| 5       | 3.2-3  | **NEW** Frontend `manage-dummies` URL-state + HOW-TO doc rewrite                                                                                    |         |            |
| 6       | 4.1    | `manage-employees` (sets pattern reference for all subsequent migrations)                                                                           |         |            |
| 7       | 4.2-4  | `manage-admins` + `manage-approvals` (verify nicht broken-by-mirror) + `manage-assets`                                                              |         |            |
| 8       | 4.5-6  | KVP + blackboard                                                                                                                                    |         |            |
| 9       | 4.7-8  | work-orders + inventory                                                                                                                             |         |            |
| 10      | 4.9-10 | documents-explorer + `manage-surveys`                                                                                                               |         |            |
| 11      | 4.11   | TPM plans + cards                                                                                                                                   |         |            |
| 12      | 4.12a  | **EXPANDED** `PickerTypeahead.svelte` component + unit tests                                                                                        |         |            |
| 13      | 4.12b  | **EXPANDED** Wire all 6 picker sites (5 Lead + 1 Employee) to component + smoke tests                                                               |         |            |
| 14      | 5.1    | API integration tests across all migrated endpoints                                                                                                 |         |            |
| 15      | 5.2-4  | ADR + HOW-TO update + `?limit=100` Phase-1 hack cleanup                                                                                             |         |            |

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
| Sessions                 | 17      | 1 + 2a |
| Backend files changed    | ~12     | —      |
| New backend files        | 0       | —      |
| New frontend files       | 3       | —      |
| Frontend files changed   | ~28     | —      |
| Migration files          | 0       | —      |
| Unit tests               | ~12     | —      |
| API tests                | ~32     | —      |
| ESLint errors at release | 0       | —      |
| Spec deviations          | 0       | —      |

---

**This document is the execution plan. Every session starts here, takes the next unchecked item, and marks it done. No coding starts before §0 is signed off.**
