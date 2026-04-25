# HOW TO: Execution Masterplan (Features + Optimizations)

> **Version:** 2.0.0
> **Created:** 2026-02-14 • **Updated:** 2026-04-15 (v2 — optimization path + proof-gate integrated)
> **Source:** Distilled from `FEAT_VACCATION_MASTERPLAN.md` (feature case, 24 sessions) and post-mortem
> `FEAT_LAYOUT_LOAD_CACHE_MASTERPLAN.md` (optimization case — plan fully executed, then fully
> discarded because the hypothesis was never empirically tested before implementation).
> **Purpose:** Senior-engineer-level template for structured planning. Supports **two plan types**:
> FEATURE (new module) and OPTIMIZATION (perf / architectural refactor with measurable target).

---

> **EVERYTHING in this document AND the actual masterplan is written in English.**
> No German, no mix. Applies to: phases, steps, session logs, risk register, DoDs, comments,
> commit messages. The only allowed non-English content is user-facing UI strings in the
> codebase itself (e.g., German labels in Svelte components).

---

## Detect the Plan Type FIRST

| Situation                                                                | Plan type        | Filename prefix             |
| ------------------------------------------------------------------------ | ---------------- | --------------------------- |
| New user-visible feature (CRUD, new module, new addon flow)              | **FEATURE**      | `FEAT_{NAME}_MASTERPLAN.md` |
| New DB table + corresponding UI                                          | **FEATURE**      | `FEAT_{NAME}_MASTERPLAN.md` |
| "Reduce X", "cache Y", "optimize Z", "speed up A"                        | **OPTIMIZATION** | `OPT_{NAME}_MASTERPLAN.md`  |
| Architectural refactor with an expected **measurable** impact            | **OPTIMIZATION** | `OPT_{NAME}_MASTERPLAN.md`  |
| Framework / dependency upgrade with performance or behavior implications | **OPTIMIZATION** | `OPT_{NAME}_MASTERPLAN.md`  |
| Pure cosmetic refactor (rename, file reorg, no semantic change)          | No plan needed   | single PR                   |

**One-line distinction:**

- **FEATURE:** you know WHAT will be built. The spec is truth. Linear: DB → Backend → Frontend → Tests → Ship.
- **OPTIMIZATION:** you HYPOTHESIZE that X will improve Y. The probe is truth. Cyclic: Baseline → Probe → (only if probe confirms) Implementation → Re-measure → Ship.

Both plan types use this template — but OPTIMIZATION plans **MUST** complete §0.4–§0.6
(Baseline + Hypothesis + Probe-Gate) **before** Phase 1 is allowed to start.

---

## Why a Masterplan?

Without a plan you build a house without blueprints: you will finish, but the doors don't
fit, the pipes cross, and on the third remodel you tear it all down. A masterplan is not
overhead. It is insurance against chaos.

For optimizations a second purpose applies: **proof instead of belief**. Without a
proof-gate you invest hours in fixes that do nothing — that is exactly what happened
on 2026-04-15 with the layout-load-cache failure (see `CLAUDE-KAIZEN-MANIFEST.md` if that
entry exists).

---

## Template

Copy the block below and fill it in for your specific plan.

````markdown
# {FEAT | OPT}: {Short Name} — Execution Masterplan

> **Plan type:** {FEATURE | OPTIMIZATION}
> **Created:** {YYYY-MM-DD}
> **Version:** 0.1.0 (Draft)
> **Status:** DRAFT — Phase 0 (planning / baseline)
> **Branch:** `{feat|perf}/{short-name}`
> **Spec (FEATURE):** [{spec-file}](./{spec-file})
> **Hypothesis (OPTIMIZATION):** {ONE sentence — "Changing X will reduce Y from A to B."}
> **Kill criterion (OPTIMIZATION):** {Exact measurement that would disprove the hypothesis.}
> **Author:** {Name}
> **Estimated sessions:** {X}
> **Actual sessions:** 0 / {X}

---

## Changelog

| Version | Date       | Change                                               |
| ------- | ---------- | ---------------------------------------------------- |
| 0.1.0   | YYYY-MM-DD | Initial draft — phases outlined                      |
| 0.2.0   | YYYY-MM-DD | Phase H (Hypothesis Probe) result — CONFIRMED/KILLED |
| 1.0.0   | YYYY-MM-DD | Phase 1 COMPLETE — migrations applied (if any)       |
| 1.1.0   | YYYY-MM-DD | Phase 2 COMPLETE — backend done                      |
| 1.2.0   | YYYY-MM-DD | Phase 3 COMPLETE — unit tests green                  |
| 2.0.0   | YYYY-MM-DD | All phases COMPLETE — shipped                        |

> **Versioning rule:**
>
> - `0.x.0` = planning phase (draft)
> - `1.x.0` = implementation in progress (minor bump per phase)
> - `2.0.0` = fully complete
> - Patch `x.x.1` = hotfix / touch-up within a phase

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must be true before starting (both plan types)

- [ ] Docker stack running (all containers healthy)
- [ ] DB backup taken: `{file}` ({size}) _(OPTIMIZATION: only if schema change planned)_
- [ ] Branch `{branch}` checked out
- [ ] No pending migrations blocking
- [ ] Dependent features shipped: {list or "none"}
- [ ] Spec / hypothesis reviewed by a second pair of eyes

### 0.2 Risk register (both plan types)

| #   | Risk                          | Impact        | Probability       | Mitigation                        | Verification                                    |
| --- | ----------------------------- | ------------- | ----------------- | --------------------------------- | ----------------------------------------------- |
| R1  | {description}                 | {High/Medium} | {High/Medium/Low} | {concrete countermeasure}         | {test / query / check proving the mitigation}   |
| R2  | Race condition in {X}         | High          | Medium            | `FOR UPDATE` row lock             | Unit test: parallel approve → ConflictException |
| R3  | Migration breaks on real data | High          | Low               | Pre-check query + RAISE EXCEPTION | Dry run on production-shape test data           |
| R4  | Cross-module dependency       | Medium        | High              | Atomic deployment (same session)  | Type-check + existing tests after deploy        |

> **Rule:** every risk MUST have a concrete mitigation AND a verification. "Be careful"
> is NOT a mitigation. "Should be fine" is NOT a verification.

### 0.3 Ecosystem integration points (both plan types)

| Existing system             | Integration                             | Phase | Verified on |
| --------------------------- | --------------------------------------- | ----- | ----------- |
| {e.g., `audit_trail`}       | Every status change → audit entry       | 2     |             |
| {e.g., EventBus}            | {N} new typed emit methods              | 2     |             |
| {e.g., SSE / Notifications} | {N} new event handlers                  | 2     |             |
| {e.g., Permission Registry} | New registrar via `OnModuleInit`        | 2     |             |
| {e.g., FeatureCheckService} | Addon gate on every controller endpoint | 2     |             |
| {e.g., Calendar}            | Frontend merge: data shown in calendar  | 5     |             |

> **Why this table?** It forces you to identify every touchpoint BEFORE coding.

---

### 0.4 Baseline measurement (OPTIMIZATION only — N/A for FEATURE)

> **Purpose:** concrete numbers. No prose.

**What is being measured?**

- **Metric 1:** {e.g., backend requests per 5-nav sequence for `/my-addons`}
- **Metric 2:** {e.g., DB query count via `pg_stat_statements`}
- **Metric 3:** {e.g., p95 response time on endpoint}

**How is it measured?** (reproducible procedure, exact commands)

```bash
# Example: backend log pattern count
doppler run -- docker-compose logs backend --since 5m 2>&1 \
  | grep '"url"' | grep -oE 'api/v2/[a-z/-]+' | sort | uniq -c
```

**Baseline numbers** (fill in BEFORE Phase H):

| Metric     | Baseline   |
| ---------- | ---------- |
| {metric 1} | {n + unit} |
| {metric 2} | {n + unit} |
| {metric 3} | {n + unit} |

**§0.4 DoD:**

- [ ] Every metric has a concrete number (no "seems slow", no "often")
- [ ] Procedure is reproducible by another engineer
- [ ] Numbers committed to the plan file

> **Gate:** no Phase H without §0.4 numbers. Without baseline you cannot prove delta.

---

### 0.5 Hypothesis & kill criterion (OPTIMIZATION only)

State, in ≤3 sentences:

- **Hypothesis:** "Changing {X} will reduce {metric} from {baseline} to {target}."
- **Mechanism:** "{Why this change should produce that effect — one sentence.}"
- **Kill criterion:** "If Phase H probe shows {metric} is unchanged or regresses, the plan is killed."

Weak hypotheses ("this should help", "it might be faster") are REJECTED. Either you can
state the expected delta with numbers or you are not ready to plan.

---

## Phase H: Hypothesis Probe (OPTIMIZATION only — THE PROOF-GATE)

> **Purpose:** prove or kill the hypothesis in **≤1 hour** of throwaway work.
> FEATURE plans skip this phase entirely.

### H.1 Probe design

What is the **smallest possible experiment** that would confirm or disprove the hypothesis?

Good probes:

- Add one `console.log` inside a load function + do 5 navigations + count log lines
- Add `Cache-Control: max-age=60` header to one endpoint + re-run baseline measurement
- Write a 20-line prototype that does the fix on ONE code path + measure

**Rule:** the probe must be **throwaway code**. Do not build the real solution here.
Do not refactor. Do not bikeshed. The goal is an up-or-down signal in under an hour.

### H.2 Expected outcome

- If hypothesis TRUE: {metric X} drops from {baseline} to {predicted}.
- If hypothesis FALSE: {metric X} stays at {baseline} (or gets worse).

### H.3 Probe execution

```
{exact commands + code patch, inline}
```

### H.4 Probe result

| Metric | Baseline | Probe | Delta | Verdict              |
| ------ | -------- | ----- | ----- | -------------------- |
| {m1}   | {n}      | {n}   | {Δ}   | {CONFIRMED / KILLED} |

### Phase H — Definition of Done

- [ ] Probe was **throwaway** (not the real fix — no refactoring, no tests)
- [ ] Probe took < 1 hour to build and run
- [ ] Numeric delta recorded in §H.4
- [ ] Verdict is unambiguous: CONFIRMED or KILLED

### Phase H — Hypothesis Gate

- **If KILLED:** STOP. Do NOT proceed to Phase 1. Write a ≤100-word post-mortem
  ("Why the hypothesis failed") and close the plan. The time invested was worth it —
  you saved days of wrong-solution building.
- **If CONFIRMED:** proceed to Phase 1. Delete the probe code (it served its purpose).

> **Never** proceed with a "probably works" verdict. "Looks promising" = KILLED.

---

## Phase 1: Database Migrations

> **Dependency:** Phase 0 (FEATURE) or Phase H CONFIRMED (OPTIMIZATION).
> **Skip entirely** if the plan does not touch DB schema.

### Step 1.1: {Description} [STATUS]

**New files:**

- `database/migrations/{timestamp}_{name}.ts`

**What happens:**

1. {SQL operation 1}
2. {SQL operation 2}
3. {SQL operation 3}

**Mandatory per-table checklist (multi-tenant!):**

- [ ] `id UUID PRIMARY KEY` (UUIDv7)
- [ ] `tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- [ ] `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- [ ] RLS policy using `NULLIF(current_setting('app.tenant_id', true), '')` pattern
- [ ] `GRANT SELECT, INSERT, UPDATE, DELETE ON table TO app_user`
- [ ] (UUID PK → no sequence GRANT needed)
- [ ] Suitable indexes with `WHERE is_active = 1` partial predicates
- [ ] `is_active INTEGER NOT NULL DEFAULT 1` (document exceptions!)
- [ ] Both `up()` AND `down()` implemented

**Verification:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d {tablename}"
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT tablename, policyname FROM pg_policies WHERE tablename LIKE '{prefix}_%';"
```

### Step 1.N: ... [STATUS]

{Additional steps in the same format}

### Phase 1 — Definition of Done

- [ ] {N} migration files with both `up()` AND `down()`
- [ ] Dry run passes: `doppler run -- ./scripts/run-migrations.sh up --dry-run`
- [ ] All migrations applied successfully
- [ ] {N} new tables exist with RLS policies ({N}/{N} verified)
- [ ] Backend compiles after rename / schema changes
- [ ] Existing tests still pass
- [ ] Backup taken before migration

---

## Phase 2: Backend Module

> **Dependency:** Phase 1 complete (or N/A).
> **Reference module:** `backend/src/nest/{existing-module}/` (copy file structure)

### Step 2.1: Module skeleton + types + DTOs [STATUS]

**New directory:** `backend/src/nest/{feature}/`

**File structure:**

```
backend/src/nest/{feature}/
    {feature}.module.ts                    # NestJS module
    {feature}.types.ts                     # interfaces + DB row types
    {feature}.permissions.ts               # PermissionCategoryDef (ADR-020)
    {feature}-permission.registrar.ts      # OnModuleInit registrar
    dto/
        common.dto.ts                      # reusable Zod schemas
        index.ts                           # barrel export
        {operation}.dto.ts                 # one DTO per operation
```

**Register in `app.module.ts`:**

- [ ] `{Feature}Module` added to imports array (alphabetically sorted)

### Step 2.2 – 2.N: Services (dependency order matters!)

Implement services in the order their dependencies allow — each service may only depend on
services already implemented.

**Recommended order:**

| #   | Service                       | Why this order                      |
| --- | ----------------------------- | ----------------------------------- |
| 2.2 | {Base service}                | No dependencies, used by all others |
| 2.3 | {Config / settings service}   | Other services need config values   |
| 2.4 | {Calculation service}         | Needed by validation + core         |
| 2.5 | {CRUD service A}              | Standalone, referenced by core      |
| 2.6 | {CRUD service B}              | Standalone, referenced by core      |
| 2.7 | {Analysis / capacity service} | Needs all CRUD services as input    |
| 2.8 | {Core service (mutations)}    | The heart — needs everything        |
| 2.9 | {Notification service}        | Reacts to core events               |

**Per service document:**

```markdown
### Step 2.X: {ServiceName} [STATUS]

**File:** `backend/src/nest/{feature}/{service-name}.service.ts`

**Why now:** {order rationale}

**Methods:**

- `methodA(tenantId, ...)` — {description}
- `methodB(tenantId, ...)` — {description}

**Dependencies:** {list of injected services}

**Critical patterns:**

- All queries via `db.tenantTransaction()` (ADR-019)
- Return raw data, NO `{ success, data }` wrapping (ADR-007)
- `$1, $2, $3` placeholders (PostgreSQL)
- `?? null` not `|| null` for defaults
```

### Step 2.N+1: Controller [STATUS]

**File:** `backend/src/nest/{feature}/{feature}.controller.ts`

**Endpoints ({N} total):**

| Method | Route          | Guard / permission | Description      |
| ------ | -------------- | ------------------ | ---------------- |
| GET    | /{feature}     | canRead            | List (paginated) |
| POST   | /{feature}     | canWrite           | Create           |
| GET    | /{feature}/:id | canRead            | Fetch one        |
| PATCH  | /{feature}/:id | canWrite           | Update           |
| DELETE | /{feature}/:id | canDelete          | Soft-delete      |

**Every endpoint MUST:**

- [ ] Call `FeatureCheckService.checkTenantAccess(tenantId, '{feature}')`
- [ ] Use `@RequirePermission(...)` decorator
- [ ] Return raw data (ResponseInterceptor wraps automatically)

### Phase 2 — Definition of Done

- [ ] `{Feature}Module` registered in `app.module.ts`
- [ ] All {N} services implemented and injected
- [ ] Controller with all {N} endpoints
- [ ] Permission registrar registered on module init
- [ ] Addon check on every controller endpoint
- [ ] `db.tenantTransaction()` for ALL tenant-scoped queries
- [ ] NO double-wrapping — services return raw data (ADR-007)
- [ ] EventBus methods added (if needed)
- [ ] SSE handlers registered (if needed)
- [ ] `??` not `||`, no `any`, explicit boolean checks
- [ ] ESLint 0 errors: `docker exec assixx-backend pnpm exec eslint backend/src/nest/{feature}/`
- [ ] Type-check passes: `docker exec assixx-backend pnpm run type-check`
- [ ] All DTOs use Zod + `createZodDto()` pattern
- [ ] _(OPTIMIZATION only)_ Quick spot-check confirms metric moved in the expected direction

---

## Phase 3: Unit Tests

> **Dependency:** Phase 2 complete.
> **Pattern:** `backend/src/nest/{existing-module}/{module}.service.test.ts`

### Test files

```
backend/src/nest/{feature}/
    {feature}.service.test.ts              # {N} tests (core mutations)
    {feature}-{sub}.service.test.ts        # {N} tests (sub-service)
    ...
```

### Mandatory scenarios

**Business logic:**

- [ ] Happy path for each mutation
- [ ] Validation error → `BadRequestException`
- [ ] Duplicate / conflict → `ConflictException`
- [ ] Missing permission → `ForbiddenException`
- [ ] Not found → `NotFoundException`

**Edge cases:**

- [ ] Boundary values (0, MAX, negative)
- [ ] Cross-domain scenarios (e.g., across-year)
- [ ] Race conditions (verify `FOR UPDATE` lock)
- [ ] Self-reference loops (e.g., self-approval)

**Data integrity:**

- [ ] Tenant isolation (tenant A cannot see tenant B)
- [ ] Cascade behavior on DELETE
- [ ] Audit-trail entries are written

### Phase 3 — Definition of Done

- [ ] ≥ {N} unit tests total (minimum 75 for a full module)
- [ ] All tests green: `docker exec assixx-backend pnpm exec vitest run backend/src/nest/{feature}/`
- [ ] Every ConflictException / BadRequestException path covered
- [ ] Edge cases for {domain-specific scenarios} tested
- [ ] Race condition tested (if relevant)
- [ ] Coverage: every public method has at least one test

---

## Phase 4: API Integration Tests

> **Dependency:** Phase 3 complete.
> **Pattern:** `backend/test/*.api.test.ts` (`HOW-TO-TEST.md`)

### Test file

`backend/test/{feature}.api.test.ts`

### Scenarios (≥ 20 assertions)

**Auth & addon gate:**

- [ ] Unauthenticated → 401
- [ ] Addon disabled → 403

**CRUD per endpoint:**

- [ ] POST → 201 (happy path)
- [ ] POST → 400 (validation error)
- [ ] POST → 409 (duplicate)
- [ ] GET → 200 (paginated, correct structure)
- [ ] PATCH → 200 (update)
- [ ] DELETE → 200 (soft-delete)

**RLS:**

- [ ] Tenant A cannot see tenant B's data

### Phase 4 — Definition of Done

- [ ] ≥ 20 API integration tests
- [ ] All tests green
- [ ] Tenant isolation verified
- [ ] Addon flag gating verified
- [ ] Pagination verified on list endpoints

---

## Phase 5: Frontend

> **Dependency:** Phase 2 complete (backend endpoints available).
> **Reference:** `frontend/src/routes/(app)/(shared)/{existing-module}/`

### Route structure

```
frontend/src/routes/(app)/
    (shared)/{feature}/
        +page.svelte                # main page (role-dependent)
        +page.server.ts             # auth + SSR data loading
        _lib/
            api.ts                  # apiClient wrapper
            types.ts                # TypeScript interfaces
            constants.ts            # German labels, badges, filters
            state.svelte.ts         # root state (re-exports sub-states)
            state-data.svelte.ts    # data state ($state)
            state-ui.svelte.ts      # UI state ($state for filters, modals)
            {Component}.svelte      # individual components

    (admin)/{feature}/
        {sub-route}/+page.svelte + +page.server.ts + _lib/
```

### Step 5.1: Main page [STATUS]

**New files:** {N}

**Quality check:**

```bash
cd frontend && pnpm exec svelte-check --tsconfig ./tsconfig.json
cd frontend && pnpm exec eslint 'src/routes/(app)/(shared)/{feature}/'
```

### Step 5.N: Additional pages [STATUS]

{Same format}

### Mandatory frontend patterns

**apiClient (CRITICAL — past Kaizen bug!):**

```typescript
// apiClient.get<T>() returns data DIRECTLY (already unwrapped)
const data = await apiClient.get<MyType>('/my-endpoint');
// `data` IS the MyType object — NOT { success, data: MyType }
```

**State management (Svelte 5 runes):**

```typescript
// state-data.svelte.ts
let items = $state<MyType[]>([]);
let selected = $state<MyType | null>(null);
```

**+page.server.ts pattern:**

```typescript
export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') redirect(302, '/login');
  const { user } = await parent();
  // addon check + data loading
};
```

### Phase 5 — Definition of Done

- [ ] Main page renders for all relevant roles
- [ ] All CRUD operations work via UI
- [ ] Svelte 5 runes (`$state`, `$derived`, `$effect`) used
- [ ] apiClient generic = DATA shape (not wrapper)
- [ ] svelte-check 0 errors, 0 warnings
- [ ] ESLint 0 errors
- [ ] Navigation config updated (all role menus)
- [ ] Breadcrumb entries added
- [ ] Responsive design (mobile + desktop)
- [ ] German labels / texts everywhere user-facing

---

## Phase 6: Integration + Polish + ADR

> **Dependency:** Phase 5 complete.

### Integrations

- [ ] {System A}: {integration description}
- [ ] {System B}: {integration description}
- [ ] Notification system: persistent DB notifications + SSE + badges
- [ ] Audit logging: `ActivityLoggerService` in every mutation service
- [ ] Dashboard: new count in dashboard widget

### Documentation

- [ ] ADR-{N} written (architectural decisions)
- [ ] `FEATURES.md` updated
- [ ] Customer migrations synced: `./scripts/sync-customer-migrations.sh`

### _(OPTIMIZATION only)_ Phase Z: Re-measurement + Delta Gate

Re-run the **exact procedure** from §0.4 and fill in:

| Metric | Baseline (§0.4) | After | Delta | Expected | Verdict (PASS/FAIL) |
| ------ | --------------- | ----- | ----- | -------- | ------------------- |
| {m1}   | {n}             | {n}   | {Δ}   | {n}      | {PASS/FAIL}         |

**Delta Gate:**

- **All PASS** (delta within ±20 % of expected, right direction): proceed to ADR as "Accepted".
- **Any FAIL:** revert implementation commits; post-mortem; re-enter Phase H with new hypothesis.

### Phase 6 — Definition of Done

- [ ] All integrations work end-to-end
- [ ] ADR written and reviewed — _(OPTIMIZATION:_ Status "Accepted" only if §Z all-PASS*)*
- [ ] `FEATURES.md` feature status updated
- [ ] No open TODOs in code (implement now, not later!)
- [ ] _(OPTIMIZATION only)_ §Z delta table filled with verified numbers

---

## Session Tracking

> **Rule:** one session = one logical work block. Not too small (1 function), not too big
> (entire module). Ideal: 1–3 hours of focused work.

| Session | Phase | Description                       | Status | Date       |
| ------- | ----- | --------------------------------- | ------ | ---------- |
| 1       | 0     | Baseline measurement              | DONE   | YYYY-MM-DD |
| 2       | H     | Hypothesis probe (OPT only)       | DONE   | YYYY-MM-DD |
| 3       | 1     | Migration {N}: {description}      | DONE   | YYYY-MM-DD |
| 4       | 2     | Module skeleton + types + DTOs    |        |            |
| 5       | 2     | {Base service} + {Config service} |        |            |
| 6       | 2     | {CRUD services}                   |        |            |
| 7       | 2     | {Core service} + controller       |        |            |
| 8       | 3     | Unit tests ({N}+ tests)           |        |            |
| 9       | 4     | API integration tests             |        |            |
| 10      | 5     | Frontend: main page               |        |            |
| 11      | 5     | Frontend: admin pages             |        |            |
| 12      | 6     | Integration + polish + ADR + Z    |        |            |

### Session log (fill per session)

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
- _(OPTIMIZATION only)_ Metric delta: {before → after}
  **Deviations:** {what differed from plan and why}
  **Next session:** {what comes next}
```

---

## Quick Reference: File Paths

### Backend (new)

| File                                                 | Purpose             |
| ---------------------------------------------------- | ------------------- |
| `backend/src/nest/{feature}/{feature}.module.ts`     | NestJS module       |
| `backend/src/nest/{feature}/{feature}.controller.ts` | REST controller     |
| `backend/src/nest/{feature}/{feature}.service.ts`    | Core business logic |
| `backend/src/nest/{feature}/{feature}.types.ts`      | All interfaces      |
| `backend/src/nest/{feature}/dto/*.ts`                | DTOs (Zod)          |

### Backend (modified)

| File                             | Change                         |
| -------------------------------- | ------------------------------ |
| `backend/src/nest/app.module.ts` | Module import added            |
| `backend/src/utils/eventBus.ts`  | Event interface + emit methods |

### Database (new)

| File                                        | Purpose       |
| ------------------------------------------- | ------------- |
| `database/migrations/{timestamp}_{name}.ts` | Migration {N} |

### Frontend (new)

| Path                                                 | Purpose     |
| ---------------------------------------------------- | ----------- |
| `frontend/src/routes/(app)/(shared)/{feature}/`      | Main page   |
| `frontend/src/routes/(app)/(admin)/{feature}/{sub}/` | Admin pages |

---

## Spec Deviations

> If the spec / prompt contradicts the actual code, ALWAYS follow the code and document the
> deviation here.

| #   | Spec says    | Actual code         | Decision             |
| --- | ------------ | ------------------- | -------------------- |
| D1  | {spec claim} | {what really holds} | {what we do and why} |

---

## Known Limitations (V1 — deliberately excluded)

> Write down explicitly what is NOT being built. Prevents scope creep, sets expectations.

1. **{Limitation A}** — {why not in V1, alternative}
2. **{Limitation B}** — {why not in V1, alternative}
3. **{Limitation C}** — {why not in V1, alternative}

---

## Post-Mortem (fill after completion)

### What went well

- {point 1}
- {point 2}

### What went badly

- {point 1 + how we avoid it next time}
- {point 2 + how we avoid it next time}

### Metrics

| Metric                                   | Planned | Actual |
| ---------------------------------------- | ------- | ------ |
| Sessions                                 | {N}     | {N}    |
| Migration files                          | {N}     | {N}    |
| New backend files                        | {N}     | {N}    |
| New frontend files                       | {N}     | {N}    |
| Changed files                            | {N}     | {N}    |
| Unit tests                               | {N}     | {N}    |
| API tests                                | {N}     | {N}    |
| ESLint errors at release                 | 0       | {N}    |
| Spec deviations                          | 0       | {N}    |
| _(OPTIMIZATION)_ Metric delta vs. target | {Δ}     | {Δ}    |

---

**This document is the execution plan. Every session starts here, takes the next unchecked
item, and marks it done. No coding starts before Phase 0 is green. For OPTIMIZATION plans,
no real code starts before Phase H is CONFIRMED.**
````

---

## Rules for a Good Masterplan

### 1. Dependency order is sacred

```
FEATURE:      Phase 0 → 1 (DB) → 2 (Backend) → 3 (Unit) → 4 (API) → 5 (Frontend) → 6 (Integration + ADR)
OPTIMIZATION: Phase 0 → 0.4 (Baseline) → 0.5 (Hypothesis) → H (Probe) → [only if CONFIRMED] 1–5 → 6 (+ §Z Delta)
```

Never start Phase 5 before Phase 2 has at least the endpoints. Never start Phase 3 before
Phase 2 has the services. The order is not negotiable. For optimizations, never start Phase
1 before Phase H is CONFIRMED.

### 2. Definition of Done = contract with yourself

Every phase has a DoD. Every item is a checkbox. You may NOT start the next phase until
every checkbox of the current phase is green. Exceptions are allowed but must be documented
with justification.

### 3. Session = atomic unit

A session has:

- **One goal** (not five)
- **Verification at the end** (ESLint, type-check, tests, _for OPT: metric_)
- **A log entry** (what was done, what deviated)

If you cannot close a session cleanly, it is too big — split it.

### 4. Verification is not optional

After EVERY session:

```bash
# Backend
docker exec assixx-backend pnpm exec eslint backend/src/nest/{feature}/
docker exec assixx-backend pnpm run type-check

# Frontend
cd frontend && pnpm exec svelte-check --tsconfig ./tsconfig.json

# Tests
docker exec assixx-backend pnpm exec vitest run backend/src/nest/{feature}/
```

For OPTIMIZATION sessions also re-check the metric — lint-green is NOT DONE if the number
hasn't moved.

### 5. Take the risk register seriously

Every identified risk needs:

- **Impact** (what happens in the worst case)
- **Mitigation** (what we do about it)
- **Verification** (how we check the mitigation works)

"Be careful" is not a mitigation. "Unit test for scenario X" is.

### 6. Document spec deviations immediately

If the spec says one thing and the code does another, put it in the deviations table
IMMEDIATELY — not "I'll remember". Written down.

### 7. Known Limitations = anti-scope-creep

Explicitly write what you are NOT building. Prevents:

- Scope creep ("while we're in there, could we also…")
- Wrong expectations ("I thought this also covered X")
- Endless sessions ("just one more thing…")

### 8. Masterplan ALWAYS in English

The entire masterplan — phases, steps, session logs, risk register, spec deviations,
known limitations, post-mortem — is written in English. No exceptions. German labels /
texts in frontend UI are fine; the plan itself is English.

### 9. Post-mortem = learning for the next plan

After completion: what went well? What went badly? Concrete metrics (planned vs. actual).
This is not overhead — it is investment in your future self.

### 10. _(OPTIMIZATION only)_ PROVE before PRESCRIBE

Do not write Phase 1+ code until Phase H has produced a numeric CONFIRMED verdict. Framework
documentation is NOT proof — it describes intent, not observed runtime behavior. Lint-green
is NOT proof of performance. The probe is the only proof.

**Failure mode this rule exists to prevent** (2026-04-15 post-mortem):

- Identified a backend log pattern (5 redundant fetch bursts per 5-nav sequence) ✅
- Wrote a 600-line masterplan + ADR marking the fix "Accepted" ❌ (before probing)
- Implemented all three invalidation triggers + the `depends()` refactor ❌ (still no probe)
- Finally pulled the logs after Phase 3 — discovered the fix did **nothing** (SvelteKit
  server loads rerun every navigation regardless of `depends()`) ❌
- Net impact: hours wasted, all changes discarded.

A 10-minute probe (one `console.log` in the load + 5 clicks) would have killed the plan
at Phase H. That is the entire point of the proof-gate.

---

## Related

- [HOW-TO-TEST.md](./HOW-TO-TEST.md) — writing API integration tests
- [HOW-TO-INTEGRATE-FEATURE.md](./HOW-TO-INTEGRATE-FEATURE.md) — addon integration checklist
- `CLAUDE-KAIZEN-MANIFEST.md` — failure catalogue (root of repo, if present)
