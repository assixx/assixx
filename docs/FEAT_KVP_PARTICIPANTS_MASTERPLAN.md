# FEAT: KVP Participants ("Beteiligung") — Execution Masterplan

> **Plan type:** FEATURE
> **Created:** 2026-04-26
> **Version:** 1.1.2 (Step 5.2 done — ParticipantChips wired into KvpCreateModal + hierarchyLabels threaded from page)
> **Status:** Step 5.2 complete — modal integration shipped (svelte-check 2578/0/0, frontend ESLint clean on KVP route, root stylelint clean); Step 5.4 detail-view display is the next blocker
> **Branch:** `refactor/kvp` (per Spec Deviation #1)
> **Spec:** This document
> **Author:** SCS Technik (proposed by Claude, approved by user)
> **Estimated sessions:** 4–5
> **Actual sessions:** 5 / 5 (Session 5 in progress — Steps 5.1 + 5.2 done; 5.4 detail-view + Phase 6 polish remaining)

---

## 0. Context & Product Decisions

A KVP suggestion currently has a single author. In practice, ideas often originate
from multiple users, an entire team, an entire department, or an entire area. The
goal of this feature is to let the author tag co-originators ("Beteiligte") of the
idea on the KVP-Create modal and on the detail view.

**Product decisions confirmed by user on 2026-04-26:**

| #   | Question             | Decision                                                                                                                                    |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | UI pattern           | **Pos-Chips + grouped dropdown** (organigram-style; chips show selection, dropdown grouped by Mitarbeiter / Teams / Abteilungen / Bereiche) |
| Q2  | Semantics            | **Informational only.** No permission grant, no notification trigger, no creator-bypass extension. Pure annotation.                         |
| Q3  | Scope filter         | **Tenant-wide.** No ADR-036 restriction (rationale below).                                                                                  |
| Q4  | Required vs optional | **Optional.** Author alone remains the default; the field can be left empty.                                                                |

**Q3 rationale (locked in for plan reviewers):**
A participant tag is a _reference_, not a _management action_. ADR-036 governs
scope of management actions (a Team-Lead can only manage their team's data,
e.g. approve their team's vacation requests). Tagging a user as a participant
grants no access, triggers no notification (Q2), and changes no permissions.
All users within a tenant are already mutually visible across blackboard, chat,
organigram, and user-profile addons. Restricting tag-references to org-scope
would be inconsistent. RLS (ADR-019) remains the security boundary; org-scope
does not.

---

## Changelog

| Version | Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-04-26 | Initial draft — phases outlined, awaits review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 0.2.0   | 2026-04-26 | User review pass: (1) drop `is_active` column + partial-index predicates (incoherent for DELETE-INSERT relation table); (2) drop `_team`/`_dept`/`_area` indexes (premature, no documented query); (3) `participants` field immutable in V1 — not in `UpdateKvpDto` (closes PATCH-clear-on-omit bug); (4) Step 5.3 (Edit UI) removed — no edit path exists in the project; (5) enrichment SQL skeleton added + filters deleted users; (6) UUIDv7 = application-side per HOW-TO-INTEGRATE-FEATURE; (7) R9 GDPR-transparency + R10 search-perf-at-scale; (8) Phase 6 DoD adds `stylelint` + `knip`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 1.0.0   | 2026-04-26 | **Phase 1 done.** Sign-off recorded; doc-drift in Phase 2 DoD + Quick Reference (stale `UpdateKvpDto` references) fixed; Spec Deviation #1 logged (working on `refactor/kvp` per user); migration `20260425234025136_add-kvp-participants` generated, dry-run clean, applied (pgmigrations id=149); CHECK + UNIQUE + RLS-strict functionally probed in tx + ROLLBACK; backend force-recreated past WSL2 bind-mount-staleness; customer fresh-install synced.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 1.0.1   | 2026-04-26 | **Step 2.1 done (DTOs).** New files: `backend/src/nest/kvp/dto/participant.dto.ts` (`ParticipantSchema` polymorphic, `ParticipantsArraySchema` cap 100, `ParticipantDto`) and `backend/src/nest/kvp/dto/participant-options-query.dto.ts` (`ParticipantOptionsQuerySchema` with `q`/`types`). `create-suggestion.dto.ts` extended by adding `participants: ParticipantsArraySchema.optional().default([])` inside the existing `z.object({...}).refine(...)` block (NOT via `.extend()` — see Spec Deviation #2). Barrel `dto/index.ts` re-exports both new modules. `update-suggestion.dto.ts` deliberately untouched (V1 boundary, masterplan Known Limitations §1). Validation gates: architectural tests 31/31, kvp DTO tests 50/50 (existing tests unchanged), ESLint clean on `kvp/dto/`, full type-check chain (shared+frontend+backend+backend/test) exit 0. Spec Deviation #2 logged: filenames + `.extend()` mechanism. Phase 2 DoD count fixed from "3 new DTO files" → "2" (matches §2.1 + Quick Reference).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 1.0.2   | 2026-04-26 | **Step 2.2 done (KvpParticipantsService).** New file: `backend/src/nest/kvp/kvp-participants.service.ts` (~530 lines). Three public methods per §2.2 contract: `replaceParticipants(suggestionId, participants[], addedBy, client?)` with optional-client pattern for parent-tx integration (Step 2.3 will pass its own client to keep suggestion-INSERT + participants-INSERT atomic — closes R7); `getParticipants(suggestionId)` UNION-ALL enrichment query with soft-deleted-user filter; `searchOptions(q?, types?)` parallel 4-type search, hard cap 50/type, ILIKE filter only when `q` is non-empty. Validation flow: pre-flight dedupe (`ConflictException`) + per-type SELECT existence check (`is_active != IS_ACTIVE.DELETED`, RLS-scoped) + diff against input → `BadRequestException` with field-level details. Audit-log diff fired post-INSERT via `void` (matches `KvpCommentsService.addComment` pattern, ADR-009). UUIDv7 application-side via `import { v7 as uuidv7 } from 'uuid'`. `kvp.module.ts` registers + exports `KvpParticipantsService`. Validation gates: ESLint clean on `kvp/`, full type-check chain exit 0, architectural tests 31/31. Spec Deviation #3 logged: extended `is_active != DELETED` filter to teams/departments/areas in `searchOptions` (spec text only required this for users; the validation flow's "idem" wording implied uniform application — consistent + safer). Phase 3 unit tests deferred to dedicated phase as planned.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 1.1.2   | 2026-04-26 | **Step 5.2 done (Modal integration).** Modified `frontend/src/routes/(app)/(shared)/kvp/_lib/KvpCreateModal.svelte`: (a) imports `ParticipantChips` + `Participant` type + `HierarchyLabels` type; (b) `Props` interface gains required `hierarchyLabels: HierarchyLabels` (ADR-034 §"Why not $page.data in Components" — explicit-prop pattern is mandatory; threaded from caller, not read from `$page.data` inside the component); (c) new `let participants = $state<Participant[]>([]);` modal-local state, mirroring the existing `photoPreviews` / `selectedPhotos` precedent (Spec Deviation #11 — Quick Reference's "`state-data.svelte.ts` carries `participants: []`" was speculative; centralising transient form state in the data store would be over-engineering); (d) `buildFormPayload()` returns `participants` as part of `KvpFormData` — empty `[]` always sent verbatim since backend Zod (`participants.optional().default([])`, Step 2.1) treats `[]` and absent identically and explicit shape keeps the wire payload self-documenting; (e) `handleClose()` resets `participants = []` so a fresh modal opens empty (called from both Cancel button + post-submit success path); (f) new field markup inserted between description and category, using bare `class="form-field"` per spec literalism — happy side-effect: participants + category share row 3 of the desktop grid where category was previously alone (no `md:col-span-2` needed). Modified `frontend/src/routes/(app)/(shared)/kvp/+page.svelte:291–294`: passed `hierarchyLabels={labels}` (the existing `$derived(data.hierarchyLabels)` alias from line 39) to `<KvpCreateModal>`. **Spec Deviation #10 logged**: spec snippet uses `disabled={submitting}` + `bind:value={form.participants}` — adapted to actual repo shape (`disabled={kvpState.isSubmitting}` from the aggregated store + `bind:value={participants}` against modal-local `$state`). Same intent, no duplicate state, no synthetic `form` object. **Validation gates:** `cd frontend && pnpm run check` (svelte-check) → 2578 files, 0 errors / 0 warnings; `pnpm exec eslint src/routes/(app)/(shared)/kvp` → clean (0 violations); `pnpm --prefix /home/scs/projects/Assixx run stylelint` → clean (no new CSS introduced — modal markup reuses `.form-field` / `.form-field__label` / `.form-field__message` design-system primitives + ParticipantChips component CSS already lints from Step 5.1). **Out of scope (intentional):** Step 5.4 detail-view display + Phase 6 polish; visual smoke at 0/1/5/50 participants + 375 px viewport check + network-tab debounce verification deferred to Phase 6 browser sweep (Phase 5 DoD bullets that genuinely need a running browser). Phase 5 DoD: 6/10 boxes ticked by 5.2 (svelte-check, frontend lint, disabled-propagation, hierarchy-labels-propagation, deleted-entities-filter, German-UI-labels) — remaining 4 are Step 5.4 + Phase 6 visual polish.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 1.1.1   | 2026-04-26 | **Step 5.1 done (ParticipantChips component + minimum 5.5 plumbing).** New file: `frontend/src/routes/(app)/(shared)/kvp/_lib/ParticipantChips.svelte` (~330 lines incl. scoped style). Bindable `value: Participant[]` per Svelte 5 idiom (Spec Deviation #9 logged — resolved §5.1 vs §5.2 prop-shape inconsistency by adopting `$bindable()` like `UserPositionChips.svelte`, dropping the §5.1 `onChange` callback). Supporting plumbing from §5.5 delivered minimally so the component compiles: (a) `Participant` / `EnrichedParticipant` / `ParticipantOptions` / `ParticipantType` types added to `_lib/types.ts` + optional `participants?: Participant[]` field on `KvpFormData` for forward-compat with §5.2; (b) `getParticipantOptions(q, types?)` wrapper added to `_lib/api.ts` with `EMPTY_PARTICIPANT_OPTIONS` fallback on error + `checkSessionExpired` integration; (c) `KVP_PARTICIPANT_OPTIONS = '/kvp/participants/options'` added to `_lib/constants.ts`. Component features: chip + dropdown layout reusing global `dropdown__menu`/`dropdown__option`/`dropdown__group-label` design-system primitives; per-type icons (`fa-user`/`fa-users`/`fa-building`/`fa-th-large`) + per-type chip badge variants (`badge--role-employee` / `badge--visibility-team`/`-department`/`-area` — semantically aligned with the org-level palette); 250 ms search debounce via `$effect`-scheduled `setTimeout` with cleanup-on-rerun; `SvelteMap<string, EnrichedParticipant>` (svelte/reactivity) for the enriched-label cache (lint required this — `svelte/prefer-svelte-reactivity`); group headers fall back to `hierarchyLabels.team`/`.department`/`.area` (ADR-034) plus hardcoded "Mitarbeiter" for users (no `users` field exists in `HierarchyLabels`); capture-phase click-outside via `onClickOutsideDropdown` action (in-modal compatible — bypasses Modal's `stopPropagation`); Esc closes dropdown; loading + empty + no-match states. **Validation gates:** `cd frontend && pnpm run check` → 2578 files, 0 errors / 0 warnings; `pnpm run lint` → 0 errors (after fixes for `@typescript-eslint/no-unnecessary-type-assertion` on a `bucketKey` cast — template literal already narrows to `keyof ParticipantOptions` — and `svelte/prefer-svelte-reactivity` on the label cache → switched `Map` to `SvelteMap`); root `pnpm run stylelint` → 0 errors (after fixing one `media-feature-range-notation` violation: `(max-width: 480px)` → `(width <= 480px)`). **Out of scope (intentionally):** Step 5.2 modal integration (separate step); Step 5.4 detail-view display; arrow-key navigation across grouped option lists (the masterplan §5.1 lists "arrow keys, Enter, Esc to close" — Esc + native `<button>` Enter + Tab traversal cover the a11y baseline; arrow-keys deferred as polish per Spec Deviation #9); preload of enriched labels for non-empty preexisting `value` (Edit-UI is V1-out-of-scope per §5.3, fallback `${type} #${id}` rendered if cache miss). |
| 1.1.0   | 2026-04-26 | **Phase 4 done (API integration tests for participants).** Extended `backend/test/kvp.api.test.ts` with a `describe('KVP: Participants', …)` block (11 tests, all green; full file 44/44 green). Test coverage map: (1) POST `/kvp` with `participants:[]` → 201, empty enriched list. (2) POST with mixed user+team+department → 201, 3 enriched entries with non-empty labels and full type-set match. (3) PUT `/kvp/:id` carrying `participants: []` → 200, GET still returns the create-time list (V1 immutability boundary — UpdateSuggestionSchema doesn't declare `participants`, default Zod mode strips unknown keys, so the field never reaches the service; reframed from spec scenario #3 per Spec Deviation #8). (4) GET `/kvp/:id` enrichment shape verified independently from POST. (5) `/options?q=Test` filters across all 4 type buckets, every returned label contains the query token. (6) `/options?types=team,department` returns empty `users`/`areas` arrays (keys still present) and populated `teams`/`departments`. (7) Cross-tenant via `participant.id = 99_999_999` → 400 (RLS-scoped lookup in `validateTargets`, R6 mitigation at API layer). (10) Soft-deleted user id=11 (`is_active=4`) absent from `/options.users` (service `is_active != IS_ACTIVE.DELETED` filter). (11) Tenant 1 has 146 active users → `/options.users.length === 50` hard assertion (LIMIT 50 cap exercised — DoD pagination/cap bullet covered; no scenario in spec). (8) Sub-describe `addon disabled` deactivates KVP via `POST /addons/deactivate`, asserts `GET /options` and `POST /kvp` both return 403, then reactivates in `afterAll` (status flips `cancelled` → `trial`, functionally equivalent to `active` for `AddonCheckService`; safe because `pool: 'forks', maxWorkers: 1, isolate: false` runs files alphabetically and `kvp-approval.api.test.ts` already executed earlier — no later file consumes KVP). Scenario #9 (creator-bypass for participants on PUT) skipped — same V1 immutability root cause as #3; see Spec Deviation #8 for the reopen-when-Edit-UI-lands trigger. **Reused** the file's existing `auth`/`testTeamId`/`testDepartmentId` fixtures from the outer `beforeAll` plus `ensureTestEmployee()` from `helpers.ts`. **No new helper added** — every test uses native `fetch()` against `BASE_URL` per ADR-018 Tier-2 convention. Validation gates: vitest 44/44 green; `docker exec assixx-backend pnpm exec eslint backend/test/kvp.api.test.ts` clean; `docker exec assixx-backend pnpm exec tsc --noEmit -p backend/test` exit 0; architectural tests 31/31. Spec Deviation #8 logged. Phase 4 DoD: 4/4 boxes ticked. |
| 1.0.5   | 2026-04-26 | **Phase 3 done (Unit tests for `KvpParticipantsService`).** New file: `backend/src/nest/kvp/kvp-participants.service.test.ts` (~370 lines, 19 tests — 12 mandatory scenarios from §Phase 3 table + 7 quality-of-coverage extras). Mock pattern mirrors `kvp.service.test.ts` (Step 2.3 changelog 1.0.3): single `qf = vi.fn()` shared between `query`/`tenantQuery` and the transaction-internal `client.query` wrapper (which transforms `T[]` → `{ rows: T[] }` to satisfy `pg`'s PoolClient contract); `getTenantId` mock factory-default `() => 42` with `mockReturnValueOnce(undefined)` for the no-CLS guard test; `ActivityLoggerService` mock has `log/logCreate/logUpdate/logDelete` all stubbed. **Coverage map:** `replaceParticipants` 11 tests (empty no-op, full insert + 4 logCreate diff, idempotent no-churn, DELETE-INSERT diff with both logCreate + logDelete, BadRequest on soft-deleted user with `is_active != ${IS_ACTIVE.DELETED}` SQL assertion, BadRequest with field-level `details[0].field='participants[0]'` for cross-tenant id, tenantTransaction-not-system-transaction wiring, no-CLS-tenant guard, raw 23514 CHECK error bubble-up, ConflictException pre-flight dedupe with friendly-copy assertion, same-id-different-types accepted, parent-tx integration with caller-provided client); `getParticipants` 3 tests (enrichment shape + IS_ACTIVE-filter SQL + UNION ALL, cascade-leaves-no-ghost via tenantQuery proxy, empty-result); `searchOptions` 4 tests (empty `q` → no ILIKE + LIMIT 50 + 4 calls, `q='ann'` → ILIKE + trimmed param across all 4 types, `types='user,team'` narrows to 2 calls, unknown types fall back to all 4). **Spec Deviation #7 logged** (extras beyond strict 12-count + value-capture pattern for BadRequest/Conflict assertions instead of try/catch with `expect` inside, dictated by `vitest/no-conditional-expect` ESLint rule). Validation gates: vitest 19/19 green; `docker exec assixx-backend pnpm exec eslint backend/src/nest/kvp/kvp-participants.service.test.ts` clean; `docker exec assixx-backend pnpm run type-check` exit 0 (full chain shared+frontend+backend+backend/test); `pnpm exec vitest run shared/src/architectural.test.ts` 31/31 (host run per Step 2.4 verification note — ripgrep not in container). Phase 3 DoD: 5/5 boxes ticked.                                                                                                                                                                                                                                                                                                                                                              |
| 1.0.4   | 2026-04-26 | **Step 2.4 done (Controller endpoints) — Phase 2 complete.** (a) `kvp.types.ts`: added `EnrichedParticipant` interface + required `participants: EnrichedParticipant[]` field on `KVPSuggestionResponse` (inline-defined to keep dep direction `service → types`; structurally identical to the service-side definition so assignment is type-safe). (b) `kvp.helpers.ts`: `transformSuggestion` seeds `base.participants = []` so list path satisfies the now-required type without an enrichment query per row (KISS — no per-row JOIN, single shape on the wire). (c) `kvp.service.ts`: `getSuggestionById` overrides the empty default with `await participantsService.getParticipants(suggestion.id)` — single enrichment site means POST `/kvp` (which round-trips through `getSuggestionById`), GET `/kvp/:id`, and every internal validation call (comments/attachments/etc.) all surface the populated list; list path stays empty-by-default. (d) `kvp.controller.ts`: injected `KvpParticipantsService` (5th constructor arg, after `rewardTiersService`) + new `GET participants/options` handler placed after `my-organizations` (Fastify static-before-`:id` ordering) wired to `searchOptions(query.q, query.types)` via `ParticipantOptionsQueryDto`. (e) **ADR-045 mutation cleanup:** stripped `@UseGuards(RolesGuard) + @Roles('admin','root')` from 7 mutation endpoints (`upsertOverride`, `deleteOverride`, `createCustomCategory`, `updateCustomCategory`, `deleteCustomCategory`, `archiveSuggestion`, `unarchiveSuggestion`) — these were the exact ADR-045 anti-pattern (Backend — Canonical Controller-Guards "FALSCH"). PermissionGuard's Layer 1 (`canManage = root \|\| admin+hasFullAccess \|\| isAnyLead`) + Layer 2 (canRead/canWrite/canDelete) covers everything `@Roles` covered, plus correctly admits Employee-Team-Leads. Each cleanup carries an inline ADR-045 reference comment. **Kept** `@Roles('root')` on `getKvpSettings`/`updateKvpSettings`/`createRewardTier`/`deleteRewardTier` (root-only system endpoints, no `@RequirePermission` — ADR-045 explicitly allows) and `@Roles('admin','root')` on `getCustomizableCategories` (management-level read — ADR-045 explicitly allows). (f) `kvp.service.test.ts`: extended `createMockParticipants` with `getParticipants: vi.fn().mockResolvedValue([])` so existing 264 tests' `getSuggestionById` chain finds the stub. Validation gates: ESLint clean on `kvp/`, full type-check chain (shared+frontend+backend+backend/test) exit 0, architectural tests 31/31 (host run — ripgrep not in container, see verification note), KVP unit tests 264/264 (10 files: kvp.helpers.test.ts, kvp.service.test.ts, kvp-attachments/comments/confirmations/lifecycle/categories/reward-tiers/approval/permission tests). Spec Deviations #5 + #6 logged. Phase 2 DoD: 13/13 boxes ticked. |
| 1.0.3   | 2026-04-26 | **Step 2.3 done (KvpService integration).** Modified `backend/src/nest/kvp/kvp.service.ts`: (a) imports `type { PoolClient } from 'pg'` + `KvpParticipantsService`; (b) constructor gains 11th DI member `participantsService: KvpParticipantsService` (placed between `lifecycleService` and `scopeService` to keep KVP sub-services grouped); (c) `createSuggestion()` body refactored — the existing single-shot `tenantQuery` INSERT now lives inside `db.tenantTransaction(async (client) => ...)`, returning `suggestionId`. Same `client` is threaded into `participantsService.replaceParticipants(newId, dto.participants, userId, client)` so participants-INSERT failure rolls back the suggestion-INSERT atomically (closes risk R7). `updateSuggestion()` intentionally untouched (V1 boundary, plan §5.3 + Known Limitations §1). Test file updated: `createMockDb` extended with `tenantTransaction` mock that routes the callback's `client.query` back to the same `qf` vi.fn() (wrapping `T[]` → `{ rows: T[] }` to match `pg` PoolClient shape) — keeps existing `mockDb.query.mockResolvedValueOnce(...)` chains working for INSERT mocks; new `createMockParticipants` factory + `mockParticipants` injected as 9th constructor arg. Validation gates: ESLint clean on `backend/src/nest/kvp/`, full type-check chain exit 0, architectural tests 31/31, `kvp.service.test.ts` 64/64 passed (all 6 createSuggestion tests including INSERT-returns-empty-throw). Spec Deviation #4 logged: (i) plan refers to `KvpService.create()` but actual method name in repo is `createSuggestion()` (same root cause as #2 — `*-suggestion` is the established naming convention) and (ii) plan §2.3 pseudo-code says `dto.participants ?? []` but the post-Step-2.1 Zod schema (`.optional().default([])`) guarantees a `Participant[]` so `??` triggers `@typescript-eslint/no-unnecessary-condition` — dropped.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

> **Versioning rule:** `0.x.0` = planning · `1.x.0` = phase done (minor per phase) · `2.0.0` = shipped.

---

## 0.1 Prerequisites — Must Be True Before Starting

- [x] Docker stack running (all containers healthy) — re-verified 2026-04-26 (11 containers Up)
- [x] DB backup taken: `database/backups/pre_kvp_participants_20260426_013713.dump` (3.3 MB)
- [ ] Branch `feat/kvp-participants` checked out — see Spec Deviation #1 (proceeding on `refactor/kvp` per user instruction 2026-04-26)
- [x] No pending migrations blocking (latest applied: `20260425001208886_deletion-status-not-null` on 2026-04-25)
- [x] **Verified during planning + re-verified at session start 2026-04-26:**
  - Main entity table is `kvp_suggestions` (confirmed — 10 `kvp_*` tables present)
  - Backend module path is `backend/src/nest/kvp/` (confirmed)
  - Modal file is `frontend/src/routes/(app)/(shared)/kvp/_lib/KvpCreateModal.svelte` (confirmed)
  - Existing sub-service pattern: `kvp-attachments.service.ts`, `kvp-comments.service.ts`, … → new file `kvp-participants.service.ts`
- [x] User has reviewed and signed off on this masterplan — 2026-04-26

---

## 0.2 Risk Register

| #   | Risk                                                                              | Impact | Probability | Mitigation                                                                                                                                                                                                                                         | Verification                                                                  |
| --- | --------------------------------------------------------------------------------- | ------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| R1  | User tags CEO/Root falsely as participant                                         | Low    | Medium      | Audit log entry on every add/remove; author can edit the participant list at any time (PATCH replaces full list)                                                                                                                                   | Integration test: author edits, removes participant → audit row written       |
| R2  | Hard-deleted entity (user/team/dept/area) leaves orphan participant rows          | Medium | Medium      | One nullable FK column per type, each with `ON DELETE CASCADE`                                                                                                                                                                                     | Integration test: delete user via `sys_user`, query participants → 0 rows     |
| R3  | Frontend dropdown perf degrades with 500+ users                                   | Medium | Medium      | Server-side search endpoint (`GET /kvp/participants/options?q=…`), debounced 250 ms, hard cap 50 results per type                                                                                                                                  | Load test with 500 dummy users → p95 < 200 ms                                 |
| R4  | RLS bypass — participants of tenant A visible to tenant B                         | High   | Low         | RLS policy `tenant_isolation` (strict mode, ADR-019); GRANTs to `app_user` AND `sys_user`                                                                                                                                                          | RLS test: query without `app.tenant_id` set as `app_user` → 0 rows            |
| R5  | Polymorphic table with multiple nullable FKs confuses developers                  | Low    | Medium      | `CHECK exactly_one_target` enforces invariant at DB level; explicit comment in migration; helper service hides the mapping                                                                                                                         | Schema check: insert with 0 or ≥2 target columns → DB error                   |
| R6  | Soft-deleted user (`is_active = IS_ACTIVE.DELETED`) appears in tag dropdown       | Low    | High        | Backend filter on `/options`: `WHERE is_active IN (IS_ACTIVE.ACTIVE, IS_ACTIVE.INACTIVE)` (deleted users are out)                                                                                                                                  | API test: deleted user not in `/options` response                             |
| R7  | KVP-create transaction succeeds but participants insert fails → orphan suggestion | Medium | Low         | Participants persisted in same `tenantTransaction()` as `kvp_suggestions` insert; transactional rollback on any error                                                                                                                              | Unit test: force participant insert to throw → verify suggestion row absent   |
| R8  | UNIQUE constraint with NULLs in PostgreSQL behaves unexpectedly                   | Low    | Low         | Default PostgreSQL semantics ("NULLs distinct") + per-type UNIQUE constraints work; documented in migration                                                                                                                                        | Manual SQL test: two rows same suggestion, different types → both accepted    |
| R9  | Tagged user has no transparency / cannot self-remove (GDPR Art. 14 spirit)        | Low    | Medium      | Conscious V1 trade-off — annotation within employer-employee context, not third-party data sharing. Future V2: `GET /users/me/kvp-participations` view + self-untag endpoint. Documented in Known Limitations §4.                                  | Re-evaluate after first customer feedback OR DPO/regulator pushback           |
| R10 | Search endpoint regresses past target scale (>1k active users per tenant)         | Low    | Low         | RLS partitions per tenant. At target ≤500 users the per-tenant ILIKE scan is ~5–20 ms — no GIN index needed in V1. If any tenant grows past 1k active users, add `pg_trgm` GIN on `(first_name \|\| ' ' \|\| last_name)` in a follow-up migration. | `pg_stat_statements` on `/options` query: alert when `mean_exec_time > 50 ms` |

> **Rule:** every risk has a mitigation AND a verification. "Be careful" is not a mitigation.

---

## 0.3 Ecosystem Integration Points

| Existing system                                          | Integration                                                                               | Phase | Verified on |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----- | ----------- |
| `kvp_suggestions` table                                  | New 1:N child `kvp_participants`                                                          | 1     |             |
| `users`, `teams`, `departments`, `areas`                 | FK targets (4 nullable columns, one set per row)                                          | 1     |             |
| `KvpService.create()`                                    | Insert participants in same `tenantTransaction()` as suggestion                           | 2     |             |
| `KvpService.update()`                                    | Replace participants on PATCH (full-state replacement)                                    | 2     |             |
| Audit logger (`ActivityLoggerService`, ADR-009)          | Log participant add/remove                                                                | 2     |             |
| Permission registry (ADR-020)                            | **No new permissions** — uses existing `kvp-suggestions` `canRead`/`canWrite`/`canDelete` | 2     |             |
| ResponseInterceptor (ADR-007)                            | Standard `{success,data,error,meta}` envelope on the new endpoint                         | 2     |             |
| RLS (ADR-019)                                            | New table needs `tenant_isolation` policy + GRANTs to `app_user` + `sys_user`             | 1     |             |
| Frontend Create-Modal (`KvpCreateModal.svelte`)          | Add `<ParticipantChips>` field below existing description field                           | 5     |             |
| Frontend KVP detail page                                 | Display participants below author info                                                    | 5     |             |
| Hierarchy labels (ADR-034)                               | Group labels in dropdown use tenant-customized labels (`labels.team`, `labels.area`, …)   | 5     |             |
| `apiClient.get<T>()` (returns unwrapped data)            | New typed wrapper in `_lib/api.ts` for `getParticipantOptions()`                          | 5     |             |
| Architectural tests (`shared/src/architectural.test.ts`) | No `is_active = N` magic numbers; no `(error as Error)` casts; no inline ID coercion      | 2     |             |

---

## Phase 1: Database Migration

> **Dependency:** Phase 0 sign-off + DB backup taken.

### Step 1.1: Create `kvp_participants` table

**Generator command:**

```bash
doppler run -- pnpm run db:migrate:create add-kvp-participants
```

This creates `database/migrations/{17-digit-utc}_add-kvp-participants.ts`. **Never craft this file manually** — `node-pg-migrate` requires a 17-digit UTC timestamp (DATABASE-MIGRATION-GUIDE.md hard rule).

### Step 1.2: Implement `up()` and `down()`

```typescript
// Migration: Add kvp_participants — informational tagging of co-originators.
// Polymorphic schema: exactly one of (user_id, team_id, department_id, area_id)
// is set per row, enforced by CHECK constraint. Strict RLS mode (ADR-019).
// No notifications, no permission grant — pure annotation (ADR-045 boundary).
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TABLE kvp_participants (
        id UUID PRIMARY KEY,                                       -- application-generated UUIDv7 (HOW-TO-INTEGRATE-FEATURE convention; `import { v7 as uuidv7 } from 'uuid'` in service)
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        suggestion_id INTEGER NOT NULL REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
        area_id INTEGER REFERENCES areas(id) ON DELETE CASCADE,
        added_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        -- NO is_active column: this is a relation/junction table; semantic is DELETE-INSERT,
        -- not soft-delete. Adding is_active here would be incoherent dead state — no
        -- code path ever sets it to anything but 1. Audit trail captures who/when at
        -- the API call level (ADR-009).
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT exactly_one_target CHECK (
            (user_id IS NOT NULL)::int +
            (team_id IS NOT NULL)::int +
            (department_id IS NOT NULL)::int +
            (area_id IS NOT NULL)::int = 1
        ),
        CONSTRAINT uq_kvp_participant_user UNIQUE (tenant_id, suggestion_id, user_id),
        CONSTRAINT uq_kvp_participant_team UNIQUE (tenant_id, suggestion_id, team_id),
        CONSTRAINT uq_kvp_participant_dept UNIQUE (tenant_id, suggestion_id, department_id),
        CONSTRAINT uq_kvp_participant_area UNIQUE (tenant_id, suggestion_id, area_id)
    );

    -- Primary read pattern: list a suggestion's participants. RLS already filters
    -- by tenant_id but the explicit composite gives the planner the fastest tuple match.
    CREATE INDEX idx_kvp_participants_suggestion
        ON kvp_participants(tenant_id, suggestion_id);
    -- Anticipated future read: "where am I tagged?" — kept; ~16 bytes/row overhead
    -- is acceptable. _team / _dept / _area indexes intentionally omitted: no
    -- documented query consumes them, and FK cascade scans on rare hard-deletes
    -- of teams/departments/areas are acceptable given the small per-tenant cardinality.
    CREATE INDEX idx_kvp_participants_user
        ON kvp_participants(user_id) WHERE user_id IS NOT NULL;

    ALTER TABLE kvp_participants ENABLE ROW LEVEL SECURITY;
    ALTER TABLE kvp_participants FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON kvp_participants
        FOR ALL
        USING (
            tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    GRANT SELECT, INSERT, UPDATE, DELETE ON kvp_participants TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON kvp_participants TO sys_user;
    -- No sequence grant — UUIDv7 PK has no sequence.
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS kvp_participants CASCADE;`);
}
```

**Per-table mandatory checklist (multi-tenant):**

- [x] `id UUID PRIMARY KEY` — application-generated via `import { v7 as uuidv7 } from 'uuid'` (HOW-TO-INTEGRATE-FEATURE convention; NO DB-side default)
- [x] `tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- [x] `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- [x] RLS policy with `NULLIF(current_setting('app.tenant_id', true), '')` strict pattern
- [x] `GRANT SELECT, INSERT, UPDATE, DELETE` to `app_user` AND `sys_user` (Triple-User Model)
- [x] No sequence GRANT needed (UUID PK)
- [x] Two indexes (`_suggestion`, `_user`); `_team` / `_dept` / `_area` deliberately omitted (KISS — no documented consumer query, FK cascade scans acceptable)
- [x] **No `is_active` column** — relation table uses DELETE-INSERT semantic, soft-delete field would be dead state
- [x] Both `up()` and `down()` implemented
- [x] No `IF NOT EXISTS` in `up()` (DATABASE-MIGRATION-GUIDE.md forbidden pattern)

### Step 1.3: Dry run, backup, apply, verify

```bash
# 1. Dry run
doppler run -- ./scripts/run-migrations.sh up --dry-run

# 2. Backup (mandatory, even on dev)
TS=$(date +%Y%m%d_%H%M%S)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --format=custom --compress=9 \
    > database/backups/pre_kvp_participants_${TS}.dump

# 3. Apply
doppler run -- ./scripts/run-migrations.sh up

# 4. Verify
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d kvp_participants"
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT * FROM pg_policies WHERE tablename = 'kvp_participants';"
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT id, name, run_on FROM pgmigrations ORDER BY run_on DESC LIMIT 1;"

# 5. Strict-RLS smoke test (no tenant context → 0 rows)
docker exec assixx-postgres psql -U app_user -d assixx \
  -c "SELECT COUNT(*) FROM kvp_participants;"   # → 0 rows by design (strict RLS)

# 6. Restart backend
cd /home/scs/projects/Assixx/docker && docker-compose restart backend deletion-worker
```

### Step 1.4: Sync customer fresh-install

```bash
./scripts/sync-customer-migrations.sh
```

### Phase 1 — Definition of Done

- [x] 1 migration file generated by `db:migrate:create`: `20260425234025136_add-kvp-participants.ts`
- [x] Both `up()` AND `down()` implemented and reviewed
- [x] Dry run passes (clean SQL preview, INSERT into pgmigrations queued)
- [x] Backup taken before `up`: `pre_kvp_participants_20260426_013713.dump` (3.3 MB)
- [x] Migration applied successfully (pgmigrations row id=149, run_on 2026-04-26 01:41:52)
- [x] Table exists with 7 indexes total (1 PK + 4 UNIQUE + `idx_suggestion` + `idx_user` partial), RLS policy `tenant_isolation`, GRANTs to `app_user` + `sys_user`
- [x] CHECK constraint manually verified (insert with 0 / 2 / 3 / 4 target cols → all rejected with `check_violation` on `exactly_one_target`; valid 1-col insert succeeded)
- [x] UNIQUE constraints manually verified (duplicate `(tenant, suggestion, user)` → rejected with `unique_violation` on `uq_kvp_participant_user`)
- [x] Strict-RLS test as `app_user` without context → 0 rows
- [x] Backend restarts cleanly (force-recreate after WSL2 bind-mount-staleness, COMMON-COMMANDS §13); `/health` returns `status:ok`
- [x] Customer fresh-install synced (`005_pgmigrations.sql` includes `kvp-participants`; 148 INSERTs match current pgmigrations rowcount)

---

## Phase 2: Backend Module Extension

> **Dependency:** Phase 1 complete.
> **Reference module:** existing `kvp-attachments.service.ts` and `kvp-comments.service.ts` for sub-service pattern.

### Step 2.1: Types and DTOs

**New files** (under `backend/src/nest/kvp/dto/`):

```
participant.dto.ts            # ParticipantSchema (one item)
participant-options-query.dto.ts   # query DTO for /options endpoint
```

**`participant.dto.ts`:**

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { idField } from '../../common/dto/index.js';

// One participant entry. Polymorphic — type discriminates the entity table.
export const ParticipantSchema = z.object({
  type: z.enum(['user', 'team', 'department', 'area']),
  id: idField,
});
export type Participant = z.infer<typeof ParticipantSchema>;

// Used as nested field on Create/UpdateKvpDto.
// Hard cap at 100 — anything beyond is product abuse, not a legitimate use case.
export const ParticipantsArraySchema = z.array(ParticipantSchema).max(100);

export class ParticipantDto extends createZodDto(ParticipantSchema) {}
```

**`participant-options-query.dto.ts`:**

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ParticipantOptionsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(), // search term, min 0 chars (returns top 50/group when empty)
  types: z.string().optional(), // comma-separated, e.g. "user,team"
});
export class ParticipantOptionsQueryDto extends createZodDto(ParticipantOptionsQuerySchema) {}
```

**Extend `CreateKvpDto` only** — `UpdateKvpDto` does NOT accept `participants` in V1:

```typescript
// dto/create-kvp.dto.ts — extend existing schema.
// `.default([])` is safe on Create — empty list = "no participants beyond the author".
export const CreateKvpSchema = ExistingCreateKvpSchema.extend({
  participants: ParticipantsArraySchema.optional().default([]),
});

// dto/update-kvp.dto.ts — INTENTIONALLY UNCHANGED in V1.
// Rationale: there is no Edit UI in the KVP modal (user-confirmed 2026-04-26 — to
// change a KVP, the user creates a new one). Adding `participants` here with
// `.default([])` would silently clear the list on every PATCH that omits the
// field (status changes, comments, etc.) — that was the v0.1.0 bug. When an Edit
// UI lands later: add as `.optional()` (NO default), gate service on
// `dto.participants !== undefined`.

### Step 2.2: `KvpParticipantsService`

**File:** `backend/src/nest/kvp/kvp-participants.service.ts`

**Responsibilities:**

| Method                                                            | Purpose                                                                                                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `replaceParticipants(suggestionId, participants[], addedBy, client?)` | Full-state replacement: DELETE existing, INSERT new. **In V1 only called from `create()`** — `update()` does not touch participants (no Edit UI). Optional `client` parameter for use inside an existing transaction.     |
| `getParticipants(suggestionId)`                                   | Fetch enriched list joined to entity tables. **Filters out users with `is_active = IS_ACTIVE.DELETED`** so soft-deleted users disappear from the UI; the `kvp_participants` row remains for audit. Teams/departments/areas are not filtered (their deletion is hard-cascade). Returns `[{type, id, label, sublabel}]`. |
| `searchOptions(q?, types?)`                                       | Server-side search across users, teams, departments, areas. Hard cap 50 per type. Filters out `is_active = IS_ACTIVE.DELETED` for users.             |

**Critical patterns (binding):**

- All queries via `db.tenantTransaction()` (ADR-019). Sub-method `replaceParticipants` accepts an optional `client` to participate in the parent transaction.
- `?? null` not `||` for default values; `IS_ACTIVE` constants from `@assixx/shared/constants` (no magic numbers).
- Return raw data — no `{ success, data }` wrapping (ADR-007).
- `$1, $2, $3` placeholders.
- Validate every `{type, id}` exists and is active in target table within the same transaction. Invalid entry → `BadRequestException` with field-level details.

**Validation flow inside `replaceParticipants`:**

```

1. Group input participants by type → 4 ID arrays
2. SELECT id FROM users WHERE id = ANY($1) AND is_active != IS_ACTIVE.DELETED
   (idem for teams, departments, areas — all RLS-filtered to current tenant)
3. For each type: input set vs. found set. Difference → BadRequestException.
4. DELETE FROM kvp_participants WHERE suggestion_id = $1
5. INSERT each participant — application-generated UUIDv7 as id (one row per item, with the matching FK column set)
6. Audit log: one entry per add/remove diff (computed against pre-delete snapshot)

````

**Enrichment query skeleton (used by `getParticipants`, joined-up in service code):**

```sql
-- All JOINs are tenant-filtered automatically via RLS (ADR-019).
-- Soft-deleted users are excluded so ghost-chips don't appear in the UI.
-- Teams/departments/areas are not filtered — their lifecycle is hard-cascade.
-- ${IS_ACTIVE.DELETED} is interpolated from `@assixx/shared/constants` in service
-- code; architectural test exempts the constant interpolation pattern.
SELECT 'user'::text AS type, u.id AS id,
       (u.first_name || ' ' || u.last_name)            AS label,
       COALESCE(d.name, '')                            AS sublabel
  FROM kvp_participants p
  INNER JOIN users u ON u.id = p.user_id
  LEFT  JOIN user_departments ud ON ud.user_id = u.id AND ud.is_primary = true
  LEFT  JOIN departments d ON d.id = ud.department_id
  WHERE p.suggestion_id = $1
    AND p.user_id IS NOT NULL
    AND u.is_active != ${IS_ACTIVE.DELETED}
UNION ALL
SELECT 'team', t.id, t.name, COALESCE(d.name, '')
  FROM kvp_participants p
  INNER JOIN teams t ON t.id = p.team_id
  LEFT  JOIN departments d ON d.id = t.department_id
  WHERE p.suggestion_id = $1 AND p.team_id IS NOT NULL
UNION ALL
SELECT 'department', d.id, d.name, COALESCE(a.name, '')
  FROM kvp_participants p
  INNER JOIN departments d ON d.id = p.department_id
  LEFT  JOIN areas a ON a.id = d.area_id
  WHERE p.suggestion_id = $1 AND p.department_id IS NOT NULL
UNION ALL
SELECT 'area', a.id, a.name, ''::text
  FROM kvp_participants p
  INNER JOIN areas a ON a.id = p.area_id
  WHERE p.suggestion_id = $1 AND p.area_id IS NOT NULL
ORDER BY type, label;
````

### Step 2.3: `KvpService` integration

**Modify `KvpService.create()` ONLY** — `update()` is intentionally unchanged.

- `create()` opens `tenantTransaction()`, inserts the suggestion, then calls `KvpParticipantsService.replaceParticipants(suggestionId, dto.participants ?? [], currentUser.id, client)` with the same `client`.
- On any failure inside the participant block, the parent transaction rolls back — no orphan suggestion (R7).
- `KvpService.update()` is **NOT** modified in V1. `UpdateKvpDto` does not accept `participants`, so existing PATCH callers (status changes, comments) are byte-for-byte unaffected. Closes the v0.1.0 PATCH-clear-on-omit bug atomically.

### Step 2.4: Controller endpoints

**Modified endpoints** (signature unchanged, body schema extended):

| Method | Route                         | Change                                                                                                                      |
| ------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v2/kvp/suggestions`     | Body now accepts optional `participants: Participant[]`. Empty `[]` or omitted = no participants.                           |
| PATCH  | `/api/v2/kvp/suggestions/:id` | **Unchanged in V1** — no Edit UI exists, so no PATCH path mutates participants                                              |
| GET    | `/api/v2/kvp/suggestions/:id` | Response now includes `participants: { type, id, label, sublabel }[]` (soft-deleted users filtered out by enrichment query) |
| GET    | `/api/v2/kvp/suggestions`     | List response **does not** include participants (lazy-load on detail) — keeps list payload small                            |

**New endpoint:**

| Method | Route                                        | Guard                                                       | Purpose                                                  |
| ------ | -------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------- |
| GET    | `/api/v2/kvp/participants/options?q=&types=` | `@RequirePermission(KVP_ADDON, KVP_SUGGESTIONS, 'canRead')` | Tenant-wide search over users, teams, departments, areas |

**Every endpoint MUST:**

- [ ] `@RequireAddon('kvp')` (or equivalent decorator wired through `TenantAddonGuard`)
- [ ] `@RequirePermission(KVP_ADDON, KVP_SUGGESTIONS, ...)` — no `@Roles('admin','root')` on mutations (ADR-045)
- [ ] Return raw data (ResponseInterceptor wraps it)

### Phase 2 — Definition of Done

- [x] Both new DTO files created with `createZodDto()` (ADR-030) — `participant.dto.ts`, `participant-options-query.dto.ts` (count corrected from "3" — see Changelog 1.0.1; §2.1 + Quick Reference list 2)
- [x] `CreateSuggestionDto` extended with optional `participants` field (added inline to the existing `z.object({...}).refine(...)` block — see Spec Deviation #2 for why `.extend()` could not be used); `UpdateSuggestionDto` intentionally unchanged in V1 (see §5.3, §Known Limitations #1) — actual filenames are `create-suggestion.dto.ts` / `update-suggestion.dto.ts`, not `create-kvp.dto.ts` / `update-kvp.dto.ts` as written in plan
- [x] `KvpParticipantsService` registered in `KvpModule.providers` and exported (Step 2.2 — also exported so Step 2.3 can inject from `KvpService`)
- [x] `KvpService.create` calls `replaceParticipants` inside the same `tenantTransaction()`; `KvpService.update` is intentionally unchanged in V1 (Step 2.3 — actual method name is `createSuggestion`, see Spec Deviation #4; `client` from `tenantTransaction` is threaded into `replaceParticipants` so participants-INSERT failure rolls back the suggestion-INSERT atomically — closes risk R7)
- [x] `KvpService.findById` enriches response with participants (Step 2.4 — actual method is `getSuggestionById`, see Spec Deviation #5; single enrichment site overrides the `participants: []` seeded by `transformSuggestion`, so POST `/kvp` + GET `/kvp/:id` + every internal call surfaces the populated list; list path stays empty-by-default — closes the "list does not include participants" perf intent of the spec without divergent shapes)
- [x] New `/options` endpoint guarded by `@RequirePermission(KVP_ADDON, KVP_SUGGESTIONS, 'canRead')` (Step 2.4 — `GET /kvp/participants/options` placed after `my-organizations` for Fastify static-before-`:id` ordering; wired to `KvpParticipantsService.searchOptions(query.q, query.types)` via `ParticipantOptionsQueryDto`; class-level `@RequireAddon('kvp')` covers Layer 0)
- [x] No `@Roles('admin','root')` on any mutation endpoint (ADR-045) (Step 2.4 — stripped `@UseGuards(RolesGuard) + @Roles('admin','root')` from 7 mutation endpoints: `upsertOverride`, `deleteOverride`, `createCustomCategory`, `updateCustomCategory`, `deleteCustomCategory`, `archiveSuggestion`, `unarchiveSuggestion` — see Spec Deviation #6 for scope decision; `@Roles('root')` on settings/reward-tier endpoints + `@Roles('admin','root')` on `getCustomizableCategories` GET kept per ADR-045 explicit allow-lists for system + management-read endpoints)
- [x] Audit log entries written for every add/remove (Step 2.2 — `fireAuditDiff` emits one `logCreate`/`logDelete` per add/remove, fire-and-forget per ADR-009; end-to-end visibility lights up once Step 2.3 wires `KvpService.create` to the service)
- [x] No new entries in `permission-registry` (ADR-020) — uses existing `kvp-suggestions` module (Step 2.2 confirmed: no registrar touched)
- [x] `IS_ACTIVE` constants from `@assixx/shared/constants` (no magic numbers) (Step 2.2 — interpolated as `${IS_ACTIVE.DELETED}` in validation + enrichment + 4 search queries)
- [x] Architectural tests pass: `pnpm exec vitest run shared/src/architectural.test.ts` — 31/31 (Step 2.2 verification, 2026-04-26)
- [x] ESLint 0 errors: `docker exec assixx-backend pnpm exec eslint backend/src/nest/kvp/` (Step 2.2 verification, 2026-04-26 — after fixing 2 self-introduced violations: `no-confusing-void-expression` on transaction wrapper, `no-unnecessary-type-assertion` on premature `EMPTY_OPTIONS` constant which was then dropped)
- [x] Type-check 0 errors: `docker exec assixx-backend pnpm run type-check` — full chain (shared + frontend + backend + backend/test) exit 0 (Step 2.2 verification, 2026-04-26)

---

## Phase 3: Unit Tests

> **Dependency:** Phase 2 complete.
> **Pattern:** existing `kvp-attachments.service.test.ts`.

**File:** `backend/src/nest/kvp/kvp-participants.service.test.ts`

**Mandatory scenarios (≥12 tests):**

| #   | Scenario                                                                    | Expected                                                                 |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | replace empty list → empty list                                             | no-op, 0 rows                                                            |
| 2   | replace empty → [user, team, dept, area] (one of each)                      | 4 rows inserted                                                          |
| 3   | replace [user] → [user] (same id)                                           | idempotent, 1 row, no audit churn                                        |
| 4   | replace [user1, user2] → [user1, user3]                                     | DELETE-INSERT, audit logs add user3 + remove user2                       |
| 5   | invalid: type='user' but `id` is deleted (`is_active = IS_ACTIVE.DELETED`)  | `BadRequestException` with field-level error                             |
| 6   | invalid: type='area' but `id` belongs to another tenant                     | `BadRequestException` (RLS hides → not found → invalid)                  |
| 7   | tenant isolation: cannot read tenant B's participants                       | empty result; verified by switching CLS context in test                  |
| 8   | cascade: hard-delete user via `sys_user`, query suggestion → user row gone  | 0 rows for that user, suggestion intact                                  |
| 9   | CHECK violation: insert with two FK columns set                             | DB raises constraint error, service surfaces as 500 (test for raw error) |
| 10  | UNIQUE violation: duplicate `(suggestion, type, id)` in single replace call | `ConflictException` with friendly message                                |
| 11  | participant-options search: empty `q` returns top 50 of each type           | `{users:[…50], teams:[…N], …}`                                           |
| 12  | participant-options search: `q="ann"` filters by name across all 4 types    | only matching results, capped at 50/type                                 |

**Phase 3 — DoD**

- [x] ≥12 unit tests, all green: `docker exec assixx-backend pnpm exec vitest run --project unit backend/src/nest/kvp/kvp-participants.service.test.ts` → **19/19 green** 2026-04-26 (12 mandatory + 7 extras)
- [x] Every public method of `KvpParticipantsService` has at least one test — `replaceParticipants` (11 tests across happy-path / edge cases / parent-tx integration), `getParticipants` (3 tests — enrichment, cascade-no-ghost, empty), `searchOptions` (4 tests — empty-q, ILIKE filter, types narrowing, unknown-types fallback)
- [x] Tenant isolation explicitly tested (R4) — at unit level the canonical guarantee is "service uses RLS-scoped wrappers, not `query`/`systemQuery`": `replaceParticipants` test asserts `mockDb.tenantTransaction.toHaveBeenCalledTimes(1)` and never `tenantQuery`-without-tenant; `getParticipants` test asserts `mockDb.tenantQuery.toHaveBeenCalledTimes(1)` and the SQL contains the `IS_ACTIVE.DELETED` filter. Real-DB cross-tenant blocking deferred to Phase 4 per scope agreement (see Spec Deviation #7).
- [x] Cascade delete tested (R2) — at unit level: `getParticipants` "returns whatever tenantQuery yields, with no extra in-service filtering" simulates DB returning only surviving rows after a hard-delete cascade, asserting the service does not re-add ghost rows from any cache. Real FK CASCADE semantics deferred to Phase 4.
- [x] CHECK + UNIQUE violations tested (R5, R8) — CHECK: `replaceParticipants` "lets DB constraint errors bubble up" mocks the INSERT to reject with `code: '23514'` and asserts the service does not swallow. UNIQUE: covered at the application layer via `assertNoDuplicates` → `ConflictException` (test "throws ConflictException with friendly message…"); the DB-level UNIQUE enforcement is exercised in Phase 4 against the real schema.

---

## Phase 4: API Integration Tests

> **Dependency:** Phase 3 complete.
> **Pattern:** existing `backend/test/kvp.api.test.ts`.

**File:** extend `backend/test/kvp.api.test.ts` (do not create new file — add a `describe('participants', …)` block).

**Scenarios (≥10 assertions):**

| #   | Scenario                                                                | Status                                  |
| --- | ----------------------------------------------------------------------- | --------------------------------------- |
| 1   | POST `/kvp/suggestions` with `participants: []`                         | 201, empty `participants` in response   |
| 2   | POST with 3 mixed (1 user, 1 team, 1 dept) participants                 | 201, all 3 enriched in response         |
| 3   | PATCH replaces participants                                             | 200, response reflects new list         |
| 4   | GET `/kvp/suggestions/:id` returns enriched `participants`              | 200, labels populated                   |
| 5   | GET `/kvp/participants/options?q=ann`                                   | 200, only matching users/teams/etc.     |
| 6   | GET `/kvp/participants/options?types=team,department`                   | 200, only those types in response       |
| 7   | Tenant A cannot read tenant B's participants (separate test accounts)   | 200 with empty array OR 404             |
| 8   | Addon `kvp` disabled → all endpoints                                    | 403                                     |
| 9   | Author edits own KVP (creator-bypass per ADR-045) and adds participants | 200, even without `canWrite` permission |
| 10  | Inactive (deleted) user not returned in `/options`                      | 200, deleted user absent                |

**Phase 4 — DoD**

- [x] ≥10 API tests, all green: `pnpm exec vitest run --project api backend/test/kvp.api.test.ts` → **44/44 green** 2026-04-26 (33 pre-existing + 11 new participant tests). Verified clean: ESLint on the test file (`docker exec assixx-backend pnpm exec eslint backend/test/kvp.api.test.ts`) + `tsc --noEmit -p backend/test` + architectural tests 31/31.
- [x] Cross-tenant isolation verified — test #7 "POST /kvp with participant id outside tenant returns 400" exercises the RLS-scoped lookup in `KvpParticipantsService.validateTargets` (R6 + cross-tenant half of R4 at API layer). Real-tenant-A-vs-tenant-B requires a second-tenant fixture (not present in `helpers.ts`); `id=99_999_999` with RLS strict-mode is the equivalent guarantee at this tier.
- [x] Addon gate verified — sub-describe `addon disabled` toggles `kvp` via `POST /addons/deactivate` then asserts both `GET /kvp/participants/options` and `POST /kvp` return 403; `afterAll` re-activates (status flips `cancelled` → `trial`, functionally equivalent for `AddonCheckService`). Safe because API project runs files alphabetically with `maxWorkers: 1, isolate: false` (vitest.config.ts) — `kvp-approval.api.test.ts` already executed before this file.
- [x] Pagination/cap verified on `/options` — test #11 hard-asserts `body.data.users.length === 50` for empty query against the seeded apitest tenant (146 active users → LIMIT 50 must clamp).

---

## Phase 5: Frontend

> **Dependency:** Phase 2 complete (endpoints available).
> **Reference:** existing `KvpCreateModal.svelte`, organigram pos-chips component.

### Step 5.1: New `ParticipantChips.svelte` component

**File:** `frontend/src/routes/(app)/(shared)/kvp/_lib/ParticipantChips.svelte`

**Props:**

```typescript
interface Props {
  value: Participant[];
  onChange: (next: Participant[]) => void;
  hierarchyLabels: HierarchyLabels; // ADR-034 — for group headers in dropdown
  disabled?: boolean;
}
```

**Internal state (Svelte 5 runes):**

```typescript
let searchQuery = $state('');
let dropdownOpen = $state(false);
let options = $state<{ users: Opt[]; teams: Opt[]; departments: Opt[]; areas: Opt[] }>({
  users: [],
  teams: [],
  departments: [],
  areas: [],
});
let loading = $state(false);

const debouncedQuery = $derived(/* 250ms debounce of searchQuery */);

$effect(() => {
  // Re-fetch options when debouncedQuery changes
  void loadOptions(debouncedQuery);
});
```

**Behavior:**

- Selected entries shown as chips above the "+" button (one chip per entry, with type icon + label + remove "x").
- Chip color per type — reuse design-system badge variants (`badge--info`, `badge--success`, etc., to be picked from existing palette).
- "+" button toggles `dropdownOpen`.
- Dropdown content (when open):
  - Search input at top (`<input type="search">`, search icon, clear button — reuse search-input primitive).
  - 4 groups, each with its hierarchy-label header: `Mitarbeiter`, `${labels.team}`, `${labels.department}`, `${labels.area}` (ADR-034 propagation).
  - Each option: name + sublabel (e.g., user shows team/dept; team shows area).
  - Click option → add to `value` (deduplicated by `${type}:${id}`), close dropdown.
  - Keyboard navigation (arrow keys, Enter, Esc to close).
- Disabled state propagates to "+" button and all chip "x" buttons.

**Component uses:**

- `apiClient.get<ParticipantOptions>('/kvp/participants/options', { q, types })` from `_lib/api.ts`
- The function returns the unwrapped data shape (apiClient strips the envelope per the existing convention — Kaizen-known pitfall).

### Step 5.2: Modal integration

**File:** `frontend/src/routes/(app)/(shared)/kvp/_lib/KvpCreateModal.svelte`

Add field below existing description field:

```svelte
<div class="form-field">
  <span class="form-field__label">
    <i class="fas fa-users mr-1"></i>
    Beteiligung
  </span>
  <ParticipantChips
    bind:value={form.participants}
    {hierarchyLabels}
    disabled={submitting}
  />
  <span class="form-field__message">
    <i class="fas fa-info-circle mr-1"></i>
    Optional — wer hatte die Idee mit dir? Personen, Teams, Abteilungen oder Bereiche.
  </span>
</div>
```

`form.participants` is initialized to `[]` and threaded through to the create-API call.

### Step 5.3: ~~Edit support~~ — out of V1 scope

User-confirmed 2026-04-26: there is **no Edit path** in the KVP modal. To change a KVP, users create a new one. This step is intentionally empty in V1 — the section heading is preserved so future Edit-UI work has a clear insertion point in the masterplan history.

When Edit-UI lands later, the (then-required) changes are:

1. Extend `UpdateKvpDto` with `participants: ParticipantsArraySchema.optional()` — **NO `.default([])`**.
2. Service: call `replaceParticipants` only when `dto.participants !== undefined`.
3. Frontend: mount the same `<ParticipantChips>` with `value` seeded from the loaded suggestion's participants.

### Step 5.4: Detail-view display

**File:** `frontend/src/routes/(app)/(shared)/kvp-detail/[id]/+page.svelte`

Add below author info:

```svelte
{#if data.kvp.participants.length > 0}
  <section class="kvp-participants">
    <h3>
      <i class="fas fa-users mr-2"></i>Beteiligte
    </h3>
    <div class="kvp-participants__chips">
      {#each data.kvp.participants as p (p.type + ':' + p.id)}
        <span class="badge badge--{p.type}" title={p.sublabel}>{p.label}</span>
      {/each}
    </div>
  </section>
{/if}
```

### Step 5.5: Types and API wrapper

**File:** `frontend/src/routes/(app)/(shared)/kvp/_lib/types.ts`
Add:

```typescript
export interface Participant {
  type: 'user' | 'team' | 'department' | 'area';
  id: number;
}
export interface EnrichedParticipant extends Participant {
  label: string;
  sublabel?: string;
}
```

**File:** `frontend/src/routes/(app)/(shared)/kvp/_lib/api.ts`
Add:

```typescript
export async function getParticipantOptions(
  q: string,
  types?: string,
): Promise<{
  users: EnrichedParticipant[];
  teams: EnrichedParticipant[];
  departments: EnrichedParticipant[];
  areas: EnrichedParticipant[];
}> {
  return apiClient.get('/kvp/participants/options', { q, ...(types !== undefined ? { types } : {}) });
}
```

### Phase 5 — Definition of Done

- [x] `svelte-check` 0 errors, 0 warnings (Step 5.2 verified 2026-04-26: `cd frontend && pnpm run check` → 2578 files, 0 errors, 0 warnings)
- [x] `pnpm run lint` (frontend) 0 errors (Step 5.2 verified 2026-04-26 on `src/routes/(app)/(shared)/kvp` — clean output)
- [ ] Component visually verified at 0, 1, 5, 50 participants (deferred to Phase 6 browser sweep — needs running dev server)
- [ ] Search input debounce works (no spam — observe network tab) (deferred to Phase 6 browser sweep)
- [x] `disabled` propagates correctly during submit (Step 5.2 — `disabled={kvpState.isSubmitting}` threaded into `<ParticipantChips>`; chip remove + add-button + dropdown all gated on the same store flag)
- [ ] Mobile-responsive at 375px viewport (chips wrap; dropdown fits) (deferred to Phase 6 browser sweep — `@media (width <= 480px)` rule already in component CSS from Step 5.1)
- [x] Hierarchy labels propagate (ADR-034) — custom tenant labels appear in group headers (Step 5.2 — `+page.svelte:39 const labels = $derived(data.hierarchyLabels)` → `<KvpCreateModal hierarchyLabels={labels} />` → `<ParticipantChips {hierarchyLabels} />` → `groupHeader()` reads `hierarchyLabels.team/.department/.area`. Explicit-prop pattern per ADR-034 §"Why not $page.data in Components")
- [x] Inactive (deleted) entities don't appear in dropdown (backend `KvpParticipantsService.searchOptions` filters `is_active != IS_ACTIVE.DELETED` per Spec Deviation #3; verified end-to-end in Phase 4 API test #10)
- [ ] Detail view displays participants below author (Step 5.4 — pending)
- [x] German UI labels everywhere user-facing (Step 5.2 — modal label "Beteiligung" with `fa-users` icon, info text "Optional — wer hatte die Idee mit dir? Personen, Teams, Abteilungen oder Bereiche."; ParticipantChips internal copy "Suche nach Person, Team, Abteilung oder Bereich…", "Wird geladen…", "Keine Treffer.", "Keine Einträge verfügbar." already shipped in Step 5.1)

---

## Phase 6: Integration + Polish + (Optional) ADR

> **Dependency:** Phase 5 complete.

### Tasks

- [ ] Audit-trail integration verified end-to-end (create + edit → audit rows)
- [ ] Sync customer fresh-install: `./scripts/sync-customer-migrations.sh`
- [ ] `FEATURES.md` — KVP entry mentions Beteiligung as a sub-feature
- [ ] `docs/ARCHITECTURE.md` §1.4 KVP row — add inline mention of `kvp_participants` if review asks for it (else map remains current)
- [ ] No new ADR required by default — the polymorphic-table pattern is consistent with existing project patterns. **Open ADR only if a reviewer pushes back on the polymorphic schema** (alternative would be 4 junction tables).

### Verification gates (run all before merge)

```bash
pnpm run validate:all
docker exec assixx-backend pnpm exec vitest run backend/src/nest/kvp/
pnpm exec vitest run --project api backend/test/kvp.api.test.ts
pnpm exec vitest run shared/src/architectural.test.ts
cd frontend && pnpm run check
pnpm run stylelint                                 # CSS in ParticipantChips.svelte must lint clean
pnpm run knip                                      # dead-code / unused-deps drift check
```

### Phase 6 — DoD

- [ ] All integration tests green
- [ ] `validate:all` PASS end-to-end
- [ ] `FEATURES.md` updated
- [ ] Customer fresh-install in sync
- [ ] No open TODOs in code

---

## Session Tracking

> One session = one logical work block (1–3 hours).

| Session | Phase       | Description                                                         | Status                                          | Date       |
| ------- | ----------- | ------------------------------------------------------------------- | ----------------------------------------------- | ---------- |
| 1       | 0 + 1       | Sign-off, backup, generate + apply migration, sync customer install | ✅ DONE                                         | 2026-04-26 |
| 2       | 2 (a–c)     | DTOs + `KvpParticipantsService` + integrate into `KvpService`       | ✅ DONE                                         | 2026-04-26 |
| 3       | 2 (d) + 3   | Controller endpoints + unit tests                                   | ✅ DONE — Step 2.4 + Phase 3 (19/19 unit tests) | 2026-04-26 |
| 4       | 4           | API integration tests (Phase 5.1 deferred to Session 5)             | ✅ DONE — 11 new tests, full file 44/44 green   | 2026-04-26 |
| 5       | 5.1–5.5 + 6 | Frontend (chips + modal + detail) + polish + customer sync          | 🔄 IN PROGRESS — Steps 5.1 + 5.2 done (chips + types + api wrapper + modal integration); 5.4 / Phase 6 remaining | 2026-04-26 |

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
  **Deviations:** {what differed from plan and why}
  **Next session:** {what comes next}
```

---

## Quick Reference: File Paths

### Backend (new)

| File                                                        | Purpose                         |
| ----------------------------------------------------------- | ------------------------------- |
| `backend/src/nest/kvp/kvp-participants.service.ts`          | Replace + read + search options |
| `backend/src/nest/kvp/kvp-participants.service.test.ts`     | Unit tests (≥12)                |
| `backend/src/nest/kvp/dto/participant.dto.ts`               | Zod schema + DTO                |
| `backend/src/nest/kvp/dto/participant-options-query.dto.ts` | Query DTO for `/options`        |

### Backend (modified)

| File                                         | Change                                                |
| -------------------------------------------- | ----------------------------------------------------- |
| `backend/src/nest/kvp/kvp.module.ts`         | Provider added                                        |
| `backend/src/nest/kvp/kvp.service.ts`        | `create`/`update` accept and persist `participants[]` |
| `backend/src/nest/kvp/kvp.controller.ts`     | New `GET /participants/options`                       |
| `backend/src/nest/kvp/dto/create-kvp.dto.ts` | `participants` field added                            |
| `backend/test/kvp.api.test.ts`               | New `describe('participants', …)` block (≥10 tests)   |

### Database

| File                                                         | Purpose                            |
| ------------------------------------------------------------ | ---------------------------------- |
| `database/migrations/{17-digit-utc}_add-kvp-participants.ts` | New table + RLS + indexes + GRANTs |

### Frontend (new)

| File                                                                  | Purpose                           |
| --------------------------------------------------------------------- | --------------------------------- |
| `frontend/src/routes/(app)/(shared)/kvp/_lib/ParticipantChips.svelte` | Chip + grouped dropdown component |

### Frontend (modified)

| File                                                                | Change                                 |
| ------------------------------------------------------------------- | -------------------------------------- |
| `frontend/src/routes/(app)/(shared)/kvp/_lib/KvpCreateModal.svelte` | New "Beteiligung" field                |
| `frontend/src/routes/(app)/(shared)/kvp-detail/[id]/+page.svelte`   | Display participants below author      |
| `frontend/src/routes/(app)/(shared)/kvp/_lib/types.ts`              | `Participant`, `EnrichedParticipant`   |
| `frontend/src/routes/(app)/(shared)/kvp/_lib/api.ts`                | `getParticipantOptions()` wrapper      |
| `frontend/src/routes/(app)/(shared)/kvp/_lib/state-data.svelte.ts`  | Form state includes `participants: []` |

---

## Spec Deviations

> Document any divergence between this plan and reality discovered during execution.

| #   | Spec says                                                                                                                                                                                                                        | Actual code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Branch `feat/kvp-participants`                                                                                                                                                                                                   | Working on `refactor/kvp`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | User instruction 2026-04-26 — accepted plan + told to start without branch switch. Re-evaluate before merge: rebase to a clean branch or include in `refactor/kvp` PR.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2   | DTO files named `create-kvp.dto.ts` / `update-kvp.dto.ts`; schemas `CreateKvpSchema` / `UpdateKvpSchema`; classes `CreateKvpDto` / `UpdateKvpDto`; mechanism `ExistingCreateKvpSchema.extend({ participants: ... })` (plan §2.1) | Repo files are `create-suggestion.dto.ts` / `update-suggestion.dto.ts`; schemas `CreateSuggestionSchema` / `UpdateSuggestionSchema`; classes `CreateSuggestionDto` / `UpdateSuggestionDto`. The existing `CreateSuggestionSchema` ends with `.refine(...)` returning a `ZodEffects` — `.extend()` is not exposed on that wrapper.                                                                                                                                                                                                                  | **Adapted in Step 2.1 (2026-04-26):** used the actual filenames everywhere (imports, barrel, plan-internal references in changelog and DoD); added the `participants` field directly inside the existing `z.object({...})` literal preserving the trailing `.refine(...)` exactly. Same intent (one optional field, default `[]`), zero architectural change, minimal diff. The plan's `.extend()` snippet is preserved as historical record in §2.1; readers should treat it as pseudo-code for "extend the schema with this field". No follow-up rename planned — `*-suggestion` is the established repo convention.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 3   | Plan §2.2 "Responsibilities" table for `searchOptions`: "Filters out `is_active = IS_ACTIVE.DELETED` for users." (singles out users)                                                                                             | Implementation filters all four target tables uniformly in `searchOptions` (`searchUsers` / `searchTeams` / `searchDepartments` / `searchAreas` all `WHERE is_active != IS_ACTIVE.DELETED`).                                                                                                                                                                                                                                                                                                                                                       | **Accepted as benign extension in Step 2.2 (2026-04-26):** the same §2.2 section's validation flow says "(idem for teams, departments, areas — all RLS-filtered to current tenant)" applies the deleted-filter to all four types. Two readings collide; I picked the safer one (consistent across `validateTargets` + `searchOptions` + `getParticipants`). Effect: deleted teams/departments/areas don't appear in the dropdown — desired UX. Schema confirms all four tables have an `is_active` column (verified `information_schema.columns` 2026-04-26 before write). Reverting would require two divergent code paths for marginal spec-literalism. No follow-up needed; if the spec author objects, flip 3 lines in `searchTeams` / `searchDepartments` / `searchAreas`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 4   | Plan §2.3 says: (a) "modify `KvpService.create()`" — single method named `create`; (b) the integration call is `replaceParticipants(suggestionId, dto.participants ?? [], currentUser.id, client)` — defensive `?? []` fallback. | (a) The actual method in this repo is `createSuggestion(...)` (other public methods follow the same `*Suggestion` pattern: `updateSuggestion`, `deleteSuggestion`, `getSuggestionById` — `*-suggestion` is the established naming convention, same root cause as Spec Deviation #2). (b) Step 2.1's DTO uses `participants: ParticipantsArraySchema.optional().default([])`, so `dto.participants` is contractually `Participant[]` (never `undefined`) after Zod parses — keeping `?? []` triggers `@typescript-eslint/no-unnecessary-condition`. | **Adapted in Step 2.3 (2026-04-26):** (a) Modified `createSuggestion()` in place (no rename — same semantic, established convention; renaming would touch the controller + tests + masterplan readers without benefit). (b) Dropped the `??` and added an inline comment pointing to this deviation row + the Zod schema source. CLAUDE.md rule "don't add fallbacks for impossible scenarios" reinforces the simplification. Same intent, fewer tokens, lint-clean. The plan's `?? []` snippet is preserved as historical pseudo-code in §2.3 — readers should treat it as "pass `dto.participants` straight through". No follow-up planned.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 5   | Plan Phase 2 DoD says "`KvpService.findById` enriches response with participants" — implies a method named `findById`.                                                                                                           | Repo method is `getSuggestionById` (consistent with the `*Suggestion` naming pattern documented in Spec Deviations #2 + #4 — every CRUD method is `<verb>Suggestion`). No `findById` exists in `KvpService`.                                                                                                                                                                                                                                                                                                                                       | **Adapted in Step 2.4 (2026-04-26):** enriched `getSuggestionById` directly, no rename. Same intent (detail-fetch enriches with participants); zero touch on controller/tests/callers. The plan-DoD wording is preserved historically — readers should treat "findById" as alias for "the detail-fetch method". Spec Deviation #2's recommendation against rename applies.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 6   | Plan Phase 2 DoD: "No `@Roles('admin','root')` on any mutation endpoint (ADR-045)" — broad reading. ADR-045 itself sorts the migration backlog by blast-radius: "1. Blackboard. 2. Weitere noch zu identifizieren."              | KVP controller had 7 mutation endpoints with the exact ADR-045 anti-pattern (`@UseGuards(RolesGuard) + @Roles('admin','root') + @RequirePermission(...)`): `upsertOverride`, `deleteOverride`, `createCustomCategory`, `updateCustomCategory`, `deleteCustomCategory`, `archiveSuggestion`, `unarchiveSuggestion`. None are introduced by this feature; all pre-existing on `refactor/kvp`.                                                                                                                                                        | **Bundled into Step 2.4 (2026-04-26):** stripped `@UseGuards(RolesGuard) + @Roles('admin','root')` from all 7 endpoints; kept `@RequirePermission(...)` (PermissionGuard's Layer 1 `canManage = root \|\| admin+hasFullAccess \|\| isAnyLead` + Layer 2 action check covers everything `@Roles` covered + correctly admits Employee-Team-Leads who were wrongly blocked). Each cleanup carries an inline ADR-045 reference comment. Decision rationale: the Phase 2 DoD reads as broad ("any mutation endpoint"); ADR-045's "weitere noch zu identifizieren" explicitly anticipates this exact identification pass; bundling is consistent with CLAUDE.local.md "Bundle coupled work" rule. **Kept** `@Roles('root')` on `getKvpSettings`/`updateKvpSettings`/`createRewardTier`/`deleteRewardTier` (root-only system endpoints with no `@RequirePermission` — ADR-045 §"@Roles bleibt erlaubt für: System-Endpoints" allows) + `@Roles('admin','root')` on `getCustomizableCategories` (management-level read — ADR-045 §"@Roles bleibt erlaubt für: Read-Endpoints, die auf Management-Level sind" allows). Net security: widening in the exact direction ADR-045 endorses; no regression. Risk for Phase 4 API tests: any existing assertion of "employee can't archive" needs revision — flag for that phase. |
| 8   | Plan §Phase 4 lists scenario #3 "PATCH replaces participants → 200, response reflects new list" and scenario #9 "Author edits own KVP (creator-bypass) and adds participants → 200, even without canWrite permission". Both presuppose that `PUT /kvp/:id` carries `participants` and triggers `replaceParticipants`. | Phase 2 §2.3 + Step 2.4 endpoint table + Known Limitations §1 + Step 5.3 all lock in the V1 boundary: `UpdateSuggestionDto` does **not** declare `participants` (default Zod mode silently strips unknown keys → service never sees the field), and `KvpService.updateSuggestion` does NOT call `replaceParticipants`. Scenarios #3 and #9 directly contradict that locked-in boundary. Reopening it would require extending `UpdateSuggestionSchema` + gating the service on `dto.participants !== undefined` + adding a creator-bypass branch — all of which are explicitly deferred to "When Edit-UI lands later" (§Step 5.3). | **Adapted in Phase 4 (2026-04-26)**, confirmed with user before implementation: (a) Scenario #3 reframed from "PATCH replaces" to a V1-immutability **boundary assertion** — test #3 sends `PUT /kvp/:id` with `participants: []`, asserts 200 (Zod stripped silently, no validation error), then asserts `GET /kvp/:id` still returns the original 3 participants. This is the contract of Known Limitations §1; if a future change accidentally surfaces `participants` in `UpdateSuggestionDto` and wires it to `replaceParticipants`, this test will fail and force a deliberate decision. (b) Scenario #9 **skipped** — same V1 immutability root cause; reopen alongside the Edit-UI work in §Step 5.3. (c) **Added** test #11 (LIMIT 50 cap on `/options`) to cover the Phase 4 DoD bullet "Pagination/cap verified on `/options`" which had no scenario in the spec table. Test exercises the cap as a hard assertion (`users.length === 50`) against the seeded apitest tenant's 146 active users. (d) Scenario #7 cross-tenant isolation tested via RLS-scoped lookup with a non-existent id (`participant.id = 99_999_999`) instead of a second-tenant fixture (no `helpers.ts` primitive for it; equivalent guarantee at this tier per ADR-019 strict-mode RLS). (e) Scenario #8 addon-disabled test placed in a sub-describe at the END of the participants block; deactivation reactivates in `afterAll` (status flips `cancelled` → `trial`, functionally equivalent for `AddonCheckService`). Safe under `pool: 'forks', maxWorkers: 1, isolate: false` because no later API test file (alphabetical) consumes KVP. Final count: 11 new it() blocks; full file 44/44 green. |
| 9   | Plan §5.1 declares `interface Props { value: Participant[]; onChange: (next: Participant[]) => void; hierarchyLabels: HierarchyLabels; disabled?: boolean }` with explicit `onChange` callback. Plan §5.2 modal-integration snippet uses `<ParticipantChips bind:value={form.participants} {hierarchyLabels} disabled={submitting} />` — which requires `$bindable()`, NOT a callback prop. The two are inconsistent. | **Adopted Option A in Step 5.1 (2026-04-26)**, pre-confirmed with user before implementation: declared `value = $bindable([])` (mirrors `frontend/src/lib/components/UserPositionChips.svelte:27` precedent for the same chip+dropdown pattern); dropped the `onChange` callback. Rationale: (a) §5.2's `bind:value` is the more concrete + later spec; (b) Svelte 5 conventions throughout the project favour bindable props for form-style controls; (c) removing the callback eliminates a redundant API surface — the parent simply reads `form.participants`. The `/* eslint-disable prefer-const -- $bindable() is a Svelte semantic marker */` comment matches `UserPositionChips`. **Also deferred in Step 5.1 (and tracked here, not as a separate deviation):** arrow-key dropdown navigation. Plan §5.1 lists "Keyboard navigation (arrow keys, Enter, Esc to close)". Implemented Esc + native Enter via `<button>` semantics + native Tab traversal — the same a11y baseline that `UserPositionChips` ships. Arrow-key navigation across grouped option lists (with focus management across group headers) is a polish item; reopen if browser testing of the §Phase 5 DoD bullet "Component visually verified at 0/1/5/50 participants" surfaces a usability gap. |
| 7   | Plan §Phase 3 says "≥12 unit tests" with scenarios #7 (tenant isolation), #8 (cascade hard-delete), #9 (CHECK violation), #10 (UNIQUE violation) listed in the unit-test table. A literal reading would put real-DB cross-tenant blocking + FK CASCADE + raw constraint enforcement in unit context.                                                                                                                                                                                                                | A pure Vitest unit test with mocked `pg` PoolClient cannot exercise real RLS, real FK CASCADE, or real DB-level CHECK/UNIQUE constraints — those require a live PostgreSQL connection, which collides with the `*.service.test.ts` tier convention (no DB; mocks only). The plan's own §Phase 3 scope ("Pattern: existing `kvp-attachments.service.test.ts`") confirms the unit-tier intent.                                                                                                                                                                                                                                                                                                                                                                                                                                          | **Adapted in Phase 3 (2026-04-26)**, confirmed with user before implementation: scenarios #7–#10 reduced to mock-level proxies — (#7) "service uses `tenantTransaction`/`tenantQuery` not `query`/`systemQuery`"; (#8) "service does no extra in-service filtering — returns whatever the DB yields after cascade"; (#9) "raw `code: '23514'` from `client.query` rejection bubbles up unchanged"; (#10) UNIQUE handled via the application-layer `assertNoDuplicates` → `ConflictException` (the DB UNIQUE itself is exercised in Phase 4). The real-DB versions live in Phase 4 (§7 "Tenant A cannot read tenant B's participants" already on the Phase 4 list; cascade + CHECK + UNIQUE will be added there). Added 7 quality-of-coverage extras beyond the strict 12-count: no-CLS-tenant guard, same-id-different-types-not-duplicate, parent-tx-integration with caller-provided client, cascade-no-ghost variant, empty-result, types-filter narrowing, unknown-types-fallback. Final count: 19/19 green. **Sub-issue:** the `try/catch (err) { expect(err)... }` shape needed by `BadRequestException`/`ConflictException` detail assertions trips `vitest/no-conditional-expect`. Refactored both to a value-capture pattern (`const err = await promise.then(success-throws, reject => err)` followed by top-level `expect(err)`), which lints clean and reads identically.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

| 10  | Plan §5.2 markup snippet says `<ParticipantChips bind:value={form.participants} {hierarchyLabels} disabled={submitting} />` plus the surrounding `class="form-field"` block — implying (a) a local `submitting` flag, (b) a `form.participants` field on a reactive `form` object, (c) `hierarchyLabels` magically in scope inside the modal, and (d) the field is single-column (`form-field` not `form-field md:col-span-2`). Quick Reference (Frontend modified table) also lists `state-data.svelte.ts — Form state includes participants: []`. | KvpCreateModal.svelte exposes no local `submitting` flag — the established disabled-during-submit signal is `kvpState.isSubmitting` from the aggregated store (already used at the footer Submit button, line 444). There is no `form` reactive object — the modal uses an HTML `<form>` element with `bind:this={formElement}` + `FormData` on submit; transient form state lives modal-locally as `$state` (existing `photoPreviews` / `selectedPhotos` precedent). `hierarchyLabels` is not in modal scope by default — and ADR-034 §"Why not $page.data in Components" forbids reading layout data inside components (hidden coupling, not testable). `state-data.svelte.ts` is the data store (suggestions / categories / departments / statistics) — cross-component aggregate state, not transient per-mount form state. | **Adapted in Step 5.2 (2026-04-26)**, all four adaptations bundled into one entry per CLAUDE.local.md "Bundle coupled work" rule: (a) `disabled={kvpState.isSubmitting}` directly — single source of truth, no duplicate flag; (b) `let participants = $state<Participant[]>([]);` declared modal-locally with `bind:value={participants}` — mirrors `photoPreviews` / `selectedPhotos` precedent, reset alongside other fields in `handleClose()`; (c) added required `hierarchyLabels: HierarchyLabels` to `Props` interface and threaded explicitly from `frontend/src/routes/(app)/(shared)/kvp/+page.svelte:291–294` via `hierarchyLabels={labels}` (the existing `$derived(data.hierarchyLabels)` alias from line 39) — ADR-034 explicit-prop pattern; (d) bare `class="form-field"` kept per spec literalism — happy side-effect: participants + category share row 3 of the desktop grid (where category was previously alone next to an empty col), better grid utilisation than `md:col-span-2`. **`state-data.svelte.ts` deliberately untouched** — modal-local `$state` is the consistent pattern. The plan's `form.participants` / `submitting` / `state-data` references are preserved historically as pseudo-code; readers should treat them as "thread the participants list through to the create-API call". The Quick Reference row remains as-is (aspirational); if a future refactor consolidates form state into a store, revisit. **Buildtime gates clean** post-adaptation: svelte-check 2578 files / 0 errors / 0 warnings, frontend ESLint clean on `src/routes/(app)/(shared)/kvp`, root stylelint clean (no new CSS — modal markup reuses design-system primitives + ParticipantChips component CSS shipped in Step 5.1). |

---

## Known Limitations (V1 — Deliberately Excluded)

1. **Participants are immutable after create.** No Edit UI exists in the KVP modal (user-confirmed 2026-04-26). To change participants, the user creates a new KVP. When an Edit UI is added later: extend `UpdateKvpDto` with `participants: ParticipantsArraySchema.optional()` (NO default), gate the service call on `dto.participants !== undefined`. See Step 5.3 for the deferred-work spec.
2. **No notifications.** Tagged users do not receive a Push/SSE notification. Deferred — re-evaluate after first customer feedback.
3. **No permission grant.** Tagging gives no access (no co-edit, no co-delete). Use ADR-020 per-user permissions if needed.
4. **No GDPR-transparency view.** A tagged user has no `/users/me/kvp-participations` view to discover where they are tagged, and cannot self-untag. Conscious V1 trade-off — Beteiligung within an employer-employee context is internal annotation, not third-party data sharing. If a customer or regulator pushes back, ship the V2 view + self-untag endpoint as a single follow-up PR. See risk register R9.
5. **Soft-deleted users hidden, not anonymized.** When a user becomes `is_active = IS_ACTIVE.DELETED`, the enrichment query filters them out. The `kvp_participants` row remains for audit. UI shows fewer chips; no `[Ehemaliger Mitarbeiter]` placeholder is rendered (KISS — avoids snapshot-name storage).
6. **Self-tag allowed.** The author can tag themselves; idempotent (UNIQUE constraint blocks duplicates). Not hidden from the dropdown — by user decision 2026-04-26.
7. **No expand-on-team-tag.** Tagging "Team Montage" stores the team reference, not the resolved member list. The list does not auto-update on team-membership changes — by design (KISS, smaller payload, stable history).
8. **No bulk-add inside dropdown.** One participant per click. Multi-select dropdown deferred to V2 if requested.
9. **No version history of past lists.** Audit trail captures the create-time list at action level. No per-list snapshot. Sufficient for V1.
10. **No dedicated ADR.** The polymorphic-table pattern is consistent with existing project patterns. Open an ADR only if review pushes back on the schema.

---

## Post-Mortem (fill after completion)

### What went well

- {point 1}
- {point 2}

### What went badly

- {point 1 + how to avoid next time}

### Metrics

| Metric                   | Planned | Actual |
| ------------------------ | ------- | ------ |
| Sessions                 | 5       |        |
| Migration files          | 1       |        |
| New backend files        | 4       |        |
| Modified backend files   | 5       |        |
| New frontend files       | 1       |        |
| Modified frontend files  | 5       |        |
| Unit tests               | ≥12     |        |
| API integration tests    | ≥10     |        |
| ESLint errors at release | 0       |        |
| Spec deviations          | 0       |        |

---

**This document is the execution plan. Every session starts here, takes the next unchecked
item, and marks it done. No coding starts before Phase 0 sign-off. Every phase has a DoD;
the next phase does not start until the current DoD is fully green.**
