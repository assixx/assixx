# FEAT: Shift Handover Protocol — Execution Masterplan

> **Plan type:** FEATURE
> **Created:** 2026-04-21
> **Version:** 0.7.0 (Session 5 complete — Phase 2 §2.4 AttachmentsService + §2.5 EntriesService shipped)
> **Status:** ACTIVE — Sessions 1-5 ✅ DONE; Session 6 (Phase 2 §2.6 Controller + §2.7 Registrar + §2.8 Cron) is next
> **Branch:** `feat/shift-handover` (to be created from `test/ui-ux` once approved)
> **Spec:** This document. No external spec — captured from product owner conversation 2026-04-21.
> **Author:** Simon Öztürk
> **Estimated sessions:** 12–14 (added §0.8 slot-identity spike)
> **Actual sessions:** 5 / 13

---

## Changelog

| Version | Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-04-21 | Initial draft — phases outlined, all 12 product Qs answered                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 0.2.0   | 2026-04-22 | Post-verification revision. Fixed: (a) `uuid_generate_v7()` → `uuidv7()` (PG18 native, 3 migrations); (b) dropped `shift_handover_slot` ENUM → `shift_key VARCHAR(20)` + CHECK + app-validate (honours tenant-configurable `shift_times`); (c) explicit composite-identity resolver spec (§0.8 spike + §2.3 signature); (d) `main.ts:99` → `main.ts:175`; (e) rewrote frontend nav section against real `getMenuItemsForRole`+SUBMENU architecture; (f) canonicalised shared-module path + package.json exports step; (g) resolved §0.3 vs §R1 `shifts`/`shift_assignments` contradiction; (h) TZ-pinned "today" rule to Europe/Berlin; (i) added R13–R15.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 0.3.0   | 2026-04-22 | **Session 1 complete.** §0.8 spike: `shift_key` distinct values = `{early,late,night}` across both tenants with `shift_times` rows (IDs 8, 36) → STOP-condition not triggered, V1 scope viable. `shifts_type` ENUM is MIXED (14 values: slot markers `early/late/night/F/S/N` + labor-law `regular/vacation/sick/...`); `shift_rotation_history_shift_type` = `{F,S,N}`. Canonical merge pattern at `backend/src/nest/shifts/shifts.service.ts` L681–691 → resolver copies this verbatim. **§0.8 decision locked: Option A (enum-equivalence matching)**. §0.7 spike: Inventory controller uses `memoryStorage()` + inline `writeInventoryPhotoToDisk()` helper (NOT `diskStorage`); service signature `create(itemId, filePath, caption, createdBy)` is shape-coupled to inventory; frontend upload is inline in `items/[uuid]/+page.svelte` L154–187 (no reusable component); `MulterFile` + `@fastify/multipart:main.ts:175` + `FileInterceptor` from `@webundsoehne/nest-fastify-file-upload` are shared infrastructure. **§0.7 decision locked: ADAPT** — dedicated `shift_handover_attachments` table + copied service/controller pattern. Corrections: (a) R11 + §2.4 `diskStorage` → `memoryStorage() + controller-side disk-write` (matches Inventory reality); (b) §2.4 image cap 10 MB → 5 MB (parity with Inventory's `MAX_PHOTO_FILE_SIZE`); (c) R13 justification reworded — `shifts_type` is MIXED, not "unrelated"; (d) Known Limitation #14 added — inventory upload module not extracted to shared `AttachmentsModule`; V2 cost.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 0.4.0   | 2026-04-22 | **Session 2 complete — Phase 1 shipped.** All 3 migrations applied + verified: `20260422120720338_create-shift-handover-templates` (pgmigrations #142), `20260422122625347_create-shift-handover-entries` (#143), `20260422124449192_create-shift-handover-attachments` (#144). Pre-apply backups taken for each step (14:07, 14:26, 14:44). Every DoD item verified: 3 tables with strict-mode RLS (`NULLIF` policy, no bypass), app_user + sys_user GRANTs on all 3 tables, `shift_handover_status` ENUM `(draft, submitted, reopened)` created, `shift_key` CHECK `('early','late','night')` enforced (R13 V1 whitelist), composite UNIQUE on entries is `DEFERRABLE INITIALLY IMMEDIATE`, FK `shift_handover_attachments.entry_id → shift_handover_entries(id) ON DELETE CASCADE`. Backend type-check exit 0 after each apply; architectural-test suite 25/25 passed (0 magic-number regressions). Spec deviations: "Existing tests still pass" DoD item satisfied by architectural-test run at Phase-1 close, not per-step — documented rationale per §Spec Deviations. Session 3 (Phase 2 §Step 2.1) is next.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 0.7.0   | 2026-04-22 | **Session 5 complete — §2.5 `ShiftHandoverEntriesService` shipped** (the feature's heart, 7 public methods + 5 private helpers + 3 pure module-level helpers). New file `backend/src/nest/shift-handover/shift-handover-entries.service.ts` (440 LOC; every function ≤55 LOC — tightest constraint is `submitEntry` at 30). **Clock injection wired**: module now provides `{provide: SHIFT_HANDOVER_CLOCK, useValue: REAL_CLOCK}` (`() => new Date()`), service consumes via `@Inject(SHIFT_HANDOVER_CLOCK)`; no `Date.now()` anywhere in service code (plan §2.3 purity contract extended to §2.5). Methods: **`getOrCreateDraft`** — race-safe via `INSERT … ON CONFLICT DO NOTHING RETURNING *` + fallback SELECT on race; R13 pre-check via `assertShiftKeyConfigured`; write-window check via `resolver.canWriteForShift({..., nowUtc: this.clock()})` (R1/R5). **`updateDraft`** — `FOR UPDATE` lock, `MUTABLE_ENTRY_STATUSES = {draft,reopened}` (deviation from plan's strict "draft only" reading documented in JSDoc — reconciled with `reopenEntry` allowing edits); `custom_values` re-parsed through `buildEntryValuesSchema(liveTemplate.fields)` from shared (R7). **`submitEntry`** — tx + `SELECT … FOR UPDATE` row-lock (R3), snapshots live template fields into `schema_snapshot` (R2), `status→submitted`, audit via `ActivityLoggerService.log({entityType:'shift', newValues:{entryId, status:'submitted'}})` (entityType enum doesn't have `shift_handover_*` so reuse `'shift'` + UUID in newValues — pragmatic, no shared-type scope creep). **`reopenEntry`** — `submitted→reopened`, audit. **`listEntriesForTeam`** — one query with `COUNT(*) OVER()` window; dynamic WHERE via `buildListFilters` module-level helper; status + date range filters; `DEFAULT_LIST_LIMIT=20`, `MAX_LIST_LIMIT=100`. **`getEntry`** — RLS-scoped by ID. **`runAutoLockSweep(nowUtc)`** — cross-tenant bulk UPDATE via `systemTransaction` (sys_user BYPASSRLS per ADR-019); correlated subquery snapshots template per matched row; `submitted_by = NULL` sentinel for system-auto; TZ math `AT TIME ZONE 'Europe/Berlin' + interval '24 hours'` in SQL (reuses the resolver's DST-correct pattern). All INSERT statements use `TENANT_ID_FROM_RLS` fragment (mirrors Templates service — policy check and INSERT value derive from same GUC). Module updated: 5 providers total + `SHIFT_HANDOVER_CLOCK` binding; 4 services exported (registrar stays module-private). Verification: 2 lint errors caught + fixed inline — (1) `requireRow<T>` needed `T extends QueryResultRow` for pg's generic constraint (TS2344), (2) destructure-rename `_total` violated `@typescript-eslint/naming-convention` `variable` selector (no `leadingUnderscore:'allow'` there) → replaced with `const {total, ...rest} = row; void total;` pattern. After fixes: Prettier 0, ESLint 0, full `pnpm run type-check` (shared + frontend + backend + backend/test) exit 0. Session 6 next: §2.6 controller (13 endpoints + `my-permissions`) + §2.7 permission registrar JSDoc (already exists, needs the `canDelete` split note) + §2.8 `@Cron('0 */6 * * *')` auto-lock hook. Also Phase-2 DoD backfill: TemplatesService audit logging (currently omitted from §2.2 — plan's DoD lists "template upsert/delete" audit under Phase 2). |
| 0.6.1   | 2026-04-22 | **Session 5 partial — §2.4 `ShiftHandoverAttachmentsService` shipped.** New file `backend/src/nest/shift-handover/shift-handover-attachments.service.ts` (258 LOC, 3 public methods + 5 private helpers, every function ≤30 LOC). Constants exported from `shift-handover.types.ts` (mirrors Inventory's `inventory.types.ts` pattern): `SHIFT_HANDOVER_MAX_ATTACHMENT_SIZE = 5MB`, `SHIFT_HANDOVER_MAX_ATTACHMENTS_PER_ENTRY = 5`, `SHIFT_HANDOVER_ALLOWED_MIME_TYPES = {jpeg,png,webp,heic}` frozen tuple. **Pattern decision:** Pattern B (service owns lifecycle) over Pattern A (Inventory's split where controller writes disk + service persists row). Rationale recorded in file JSDoc: §2.4 names the signature `uploadForEntry(entryId, file)` with MIME/size enforcement on the service side, so service owns validation → cap-check → disk-write → INSERT; controller at §2.6 stays thin. Order-of-operations comment documents why disk-write happens BEFORE the INSERT inside the same `tenantTransaction` (INSERT-failure → orphan file is recoverable via cleanup cron; alternative "commit first, write later" would leave DB pointing at non-existent files on crash). All 3 public methods delegate to private helpers (`validateFile`, `loadMutableEntry`, `assertUnderCap`, `loadAttachmentContext`, `writeToDisk`) so the main methods stay flat (cognitive-complexity ≤10). MUTABLE_ENTRY_STATUSES = `['draft','reopened']` — attachments mutable until final submit. Disk layout: `uploads/shift-handover/{tenantId}/{entryId}/{uuidv7()}{ext}` with `fs.mkdir({recursive:true})` + `fs.writeFile`. File extension derived from MIME (deterministic, untrusts `originalname`). `deleteAttachment` enforces (entry-mutable AND (creator OR canManage)); `canManage` is a boolean passed from controller (populated from `orgScope.isAnyLead`). `streamAttachment` returns `{filePath, mimeType, fileName}` — controller does same-team scope filter. All DB access via `tenantTransaction`/`tenantQuery` (app_user + RLS, ADR-019); `tenant_id` always taken from the RLS-loaded entry row, never client input. `ShiftHandoverModule` updated: service + constants wired into providers + exports. Verification: Prettier 0, ESLint 0, full `pnpm run type-check` (shared + frontend + backend + backend/test) exit 0. Session 5 continues with §2.5 EntriesService (the "heart" — `getOrCreateDraft`, `submitEntry` with snapshot + FOR UPDATE lock, `reopenEntry`, `runAutoLockSweep`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 0.6.0   | 2026-04-22 | **Session 4 complete — §2.3 `ActiveShiftResolverService` shipped.** New file `backend/src/nest/shift-handover/active-shift-resolver.service.ts` (201 LOC, every method ≤30 LOC, cognitive complexity flat — `canWriteForShift` delegates the window check to a private `isWithinWriteWindow` helper to stay ≤10 complexity). Four public methods per plan: (1) `resolveAssignees(tenantId, teamId, shiftDate, shiftKey)` — UNION on `shifts` + `shift_rotation_history` mirroring the canonical merge at `shifts.service.ts` L681–691 verbatim; slot-to-enum mapping per §0.8 (`early ↔ {early,F}/F`, `late ↔ {late,S}/S`, `night ↔ {night,N}/N`) captured in two top-level `Record<ShiftHandoverSlot, …>` constants; NULL `user_id` rows filtered (unassigned shifts); `= ANY($3::text[])` for the mixed-value shifts enum, single `= $4` for the pure-slot rotation enum; SQL `UNION` de-dupes at engine level. (2) `canWriteForShift(ctx)` — two-stage: assignee-check → time-window check; delegates window evaluation to `isWithinWriteWindow` private helper which runs a single PostgreSQL query doing ALL TZ math server-side (`AT TIME ZONE 'Europe/Berlin'` + DST-aware `shift_date + end_time` conversion to UTC), then evaluates the 3 allowed cases in flat JS (same-Berlin-day / night-slot-yesterday-within-window / none). Backend runs UTC (ADR-014), so `Date.toISOString().slice(0,10)` gives the Berlin-date for any DATE-column value by construction — documented in the `toIsoDateUtc()` JSDoc. (3) `getShiftEndClock(tenantId, shiftKey)` — reads `shift_times`, returns `{startTime, endTime}` as `HH:MM:SS` strings, throws `NotFoundException` when slot is not configured (fail-loud). (4) `getAutoLockCutoff(entry, nowUtc)` — single SQL expression `now > (shift_date + end_time) AT TIME ZONE 'Europe/Berlin' + interval '24 hours'`; pure given inputs, no RLS context needed (no tenant-scoped tables touched), uses `db.query()` on `app_user`. Purity contract honored: no `Date.now()`, no `process.env.TZ`, every timing input explicit parameter. All DB access via `queryAsTenant(sql, params, tenantId)` with explicit tenantId so the service is callable outside HTTP/CLS context (cron jobs, unit tests, WebSocket). `ShiftHandoverModule` updated: `ActiveShiftResolverService` added to `providers` + `exports` (§2.5 EntriesService will consume it for `getOrCreateDraft` window enforcement and `runAutoLockSweep`). Verification: Prettier 0, ESLint 0, `docker exec assixx-backend pnpm run type-check` (shared + frontend + backend + backend/test) exit 0. Session 4 closed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 0.5.1   | 2026-04-22 | **Session 4 partial — §2.2 `ShiftHandoverTemplatesService` shipped.** New file `backend/src/nest/shift-handover/shift-handover-templates.service.ts` (151 LOC, all functions ≤30 LOC — well under the 60-LOC cap). Three public methods per plan: `getTemplateForTeam(teamId)` → `ShiftHandoverTemplateRow \| null`; `upsertTemplate(teamId, fields, userId)` → idempotent single-statement `INSERT … ON CONFLICT (tenant_id, team_id) DO UPDATE` with `TENANT_ID_FROM_RLS` SQL fragment so INSERT value derives from the same GUC the RLS policy checks (fail-safe: caller can't mismatch); `deleteTemplate(teamId, userId)` → soft-delete `is_active = IS_ACTIVE.INACTIVE` with `RETURNING id` → `NotFoundException` when no active row. Private `validateFields()` re-parses via the shared `ShiftHandoverTemplateFieldsSchema` as Power-of-Ten Rule 5 defense-in-depth (DTO layer is primary; service protects non-HTTP callers). Upsert wraps a team-existence pre-check (`SELECT id FROM teams WHERE id = $1`; RLS enforces tenant filter) so caller sees `BadRequestException('Team … does not exist in this tenant')` instead of opaque SQLSTATE 23503. `ShiftHandoverModule` updated: `ShiftHandoverTemplatesService` added to `providers` + `exports` (consumable by future `ShiftHandoverEntriesService` in §2.5 for `schema_snapshot` reads). Verification: `docker exec assixx-backend pnpm exec eslint backend/src/nest/shift-handover/` exit 0 (1 initial `@typescript-eslint/typedef` error — missing annotation on `tenantTransaction` callback `client` param — fixed by adding `import type { PoolClient } from 'pg'` + `client: PoolClient` annotation); full `pnpm run type-check` suite (shared + frontend + backend + backend/test) exit 0. No runtime changes (service not yet wired to a controller — that's §2.6). Session 4 continues with §2.3 `ActiveShiftResolverService`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 0.5.0   | 2026-04-22 | **Session 3 complete — Phase 2.1 shipped.** Shared module built: `shared/src/shift-handover/{index,field-types,field-validators}.ts`, `shared/package.json` gains `zod ~4.3.6` dep + `./shift-handover` conditional-exports block (ADR-015), `shared/dist/shift-handover/` produces 13 JS/d.ts artefacts. Backend module skeleton shipped: `backend/src/nest/shift-handover/` with `shift-handover.{types,tokens,module,permissions}.ts`, `shift-handover-permission.registrar.ts`, and 12 DTO files under `dto/` (11 DTOs + barrel). `ShiftHandoverModule` wired into `app.module.ts` alphabetically before `ShiftsModule`. Spec Deviation #2 recorded: registry extended with `addModulesToCategory()` method; registrar uses `OnApplicationBootstrap` to append the 2 new modules (`shift-handover-templates`, `shift-handover-entries`) to the existing `shift_planning` category — verified at boot, zero exceptions (`Extended permission category "shift_planning" with 2 module(s)` after base 4). Every DoD item green: shared build exits 0, `docker exec assixx-backend pnpm run type-check` exits 0 across shared/frontend/backend/backend-test, `pnpm exec eslint` on the new dirs exits 0 (initial 6 Zod-4 deprecation + NestJS-extraneous-class errors fixed inline: `ZodTypeAny → ZodType`, dropped `.safe()`/`.finite()` no-ops, eslint-disable on empty module class), `frontend/pnpm run check` 0 errors / 0 warnings / 2554 files. Runtime smoke: backend restart clean, `/health` returns `status:ok`, boot log shows registrar fires after all `OnModuleInit` hooks (no order-dependency). Session 4 (Phase 2 §2.2 TemplatesService + §2.3 ActiveShiftResolver) is next.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

> **Versioning rule:** `0.x.0` planning, `1.x.0` implementation, `2.0.0` shipped.

---

## Product Decisions (locked, 2026-04-21)

| #   | Decision Point       | Chosen                                                                                                                                      |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Granularity          | One handover **per shift-slot** (early/late/night)                                                                                          |
| 2   | Write permission     | Only the user assigned to that shift slot. Team-Lead bypass. Multi-user shift = all assignees may write (shared draft).                     |
| 3   | Custom-value storage | JSONB column on `shift_handover_entries.custom_values` + `schema_snapshot` for drift safety                                                 |
| 4   | Trigger UX           | 📋 button per shift cell in the existing shift grid                                                                                         |
| 5   | Lock mode            | Manual submit; draft auto-locked 24h after shift end. Team-Lead can re-open with audit entry.                                               |
| 6   | Custom field types   | 8 types: `text`, `textarea`, `integer`, `decimal`, `date`, `time`, `boolean`, `select`                                                      |
| 7   | Image upload         | Reuse Inventory image-upload pattern (verify reusability in §0.7)                                                                           |
| 8   | Addon assignment     | Part of existing `shift_planning` addon                                                                                                     |
| 9   | Notifications V1     | None (pull-only). SSE/email deferred to V2.                                                                                                 |
| 10  | Backfill window      | **Today only** — no backdating. See R5 for night-shift handling.                                                                            |
| 11  | Navigation placement | Sub-entry under the existing "Schichtplanung" entry (current flat link → promoted to submenu). German label is "Schichtplanung" throughout. |
| 12  | Read scope           | Same team only. Cross-team read = Admin (hasFullAccess) or Root only.                                                                       |

Implicit decisions:

- Custom-field `is_required` flag: **yes** (Team-Lead may mark required, validation enforced backend-side, UI shows red asterisk).
- Hierarchy Labels (ADR-034): **yes**, used in page titles, modal headers, table columns where `team`/`area` appear.

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must be true before starting

- [ ] Docker stack running (all containers healthy) — verified 2026-04-21
- [ ] DB backup taken: `database/backups/full_backup_pre_shift_handover_{ts}.dump`
- [ ] Branch `feat/shift-handover` checked out (parent: `main` after current `test/ui-ux` work merged, OR explicit rebase plan)
- [ ] No pending migrations blocking (`SELECT * FROM pgmigrations ORDER BY run_on DESC LIMIT 5;`)
- [ ] Dependent features shipped: `shift_planning` addon active in dev tenant
- [ ] Spec reviewed by product owner (this document, sign-off pending)

### 0.2 Risk register

| #   | Risk                                                                                                                        | Impact | Probability | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Verification                                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Active-shift resolver fails on night shift crossing midnight                                                                | High   | High        | Resolver matches by `(team_id, shift_date, shift_key)` regardless of wall-clock time; "today" = `CURRENT_DATE AT TIME ZONE 'Europe/Berlin'` of shift start (W5). Assignee lookup unions `shifts` + `shift_rotation_history` (ADR-011 dual-source). `shift_assignments` is NOT the primary source — it is a multi-assignee junction for manually-planned shifts. Primary assignee resolver mirrors `backend/src/nest/shifts/shifts.service.ts` L81–101 / L686–688.                                                                                                                                                                                                                                                                                                                                          | Unit test: night shift Mo 22:00→Di 06:00, user opens at 23:30 AND at 03:00, both must resolve                                                                                        |
| R2  | JSONB schema drift — template changes after entries are submitted                                                           | High   | High        | `schema_snapshot JSONB` column on entries: snapshot of template field-defs at submit time. Read renders against snapshot, not live template.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Unit test: submit entry, alter template (add/remove field), re-fetch entry, snapshot unchanged                                                                                       |
| R3  | Lock-mode race condition (two assignees submit simultaneously)                                                              | Medium | Low         | `SELECT ... FOR UPDATE` row lock on entry in `submitEntry()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Unit test: parallel submits → one ConflictException                                                                                                                                  |
| R4  | Permission inconsistency Frontend↔Backend (ADR-045)                                                                         | High   | Medium      | Single helper `canManageShiftHandoverTemplates()` in `navigation-config.ts`, identical 3-tuple check in `@RequirePermission` guard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Integration test: Employee-Team-Lead can config templates + write entries; Admin without `hasFullAccess` AND no lead role cannot                                                     |
| R5  | "Today only" rule vs night shift over midnight + timezone ambiguity                                                         | Medium | High        | Write window = `shiftDate = today_berlin OR (shift_key='night' AND shiftDate = today_berlin - 1 day AND now() < shift_end_time)`. "today_berlin" = `(now() AT TIME ZONE 'Europe/Berlin')::date`. `shift_end_time` comes from `shift_times` row for this tenant+shift_key. Documented as `canWriteForShift(shiftDate, shiftKey, shiftEndTime, nowUtc)` pure function. Server may run UTC, tenant clock is Europe/Berlin — never conflate.                                                                                                                                                                                                                                                                                                                                                                   | Unit test matrix: 4 cases (today early/late, today night not yet ended, yesterday night still in progress, UTC-01:00-which-is-already-tomorrow-Berlin edge case)                     |
| R6  | Inventory image pattern not reusable as-is                                                                                  | Medium | Medium      | §0.7 spike: read `backend/src/nest/inventory/`. Decision: reuse → import, adapt → copy + dedicated `shift_handover_attachments` table, or refactor → shared module (NOT V1). Locked before Phase 2.2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | §0.7 spike result documented in this file before Phase 1 starts                                                                                                                      |
| R7  | Custom-field validation drift between frontend (preview) and backend                                                        | Medium | Medium      | Single Zod schema per field type in `@assixx/shared/shift-handover-fields.ts`, imported by both backend and frontend.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Architectural test: backend service + frontend form import the same module                                                                                                           |
| R8  | Migration applied without RLS GRANTs for `sys_user`                                                                         | High   | Low         | Migration template per DATABASE-MIGRATION-GUIDE.md §RLS. Pre-commit checklist includes Triple-User GRANT verification.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `SELECT * FROM information_schema.role_table_grants WHERE table_name LIKE 'shift_handover_%';` returns rows for both `app_user` and `sys_user`                                       |
| R9  | Active-shift resolver only reads `shifts`, misses rotation-generated shifts (ADR-011 dual-source)                           | High   | High        | Resolver MUST query both `shifts` AND `shift_rotation_history`, UNION-merge as the frontend already does. Reference `backend/src/nest/shifts/shifts.service.ts` for the canonical merge logic before re-implementing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Unit test: rotation-generated shift exists only in `shift_rotation_history` (no `shifts` row) → assignee resolution still returns the user.                                          |
| R10 | HOW-TO-INTEGRATE-FEATURE.md §1.2 RLS template is outdated (has bypass clause); ADR-019 strict-mode is mandatory             | Medium | Medium      | Use ADR-019 strict-mode policy template (no `IS NULL OR` bypass). The HOW-TO will be updated separately; the ADR is authoritative.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `pg_policies.qual` for our 3 tables matches the strict pattern, NOT the HOW-TO bypass pattern.                                                                                       |
| R11 | Attachments service uses wrong upload pipeline (re-implements multipart)                                                    | Medium | Low         | Per ADR-042: use the canonical 3-layer stack (`@fastify/multipart` + `fastify-multer` + `@webundsoehne/nest-fastify-file-upload`), `FileInterceptor`/`@UploadedFile`, `MulterFile` type from `backend/src/nest/common/interfaces/multer.interface.ts`, `memoryStorage()` + controller-side disk-write helper (mirroring Inventory's `writeInventoryPhotoToDisk`; ADR-042's "disk" classification in §Context refers to the end-storage location, not the Multer engine).                                                                                                                                                                                                                                                                                                                                   | Controller imports match the 9 existing upload controllers; `grep -rln "@webundsoehne/nest-fastify-file-upload" backend/src/nest/shift-handover/` returns the controller file.       |
| R12 | JSONB-vs-EAV divergence from Inventory (ADR-040) creates inconsistent custom-field UX                                       | Low    | Medium      | Document divergence in ADR. Inventory: per-item EAV makes sense (typed reporting per attribute, verified: `inventory_custom_fields` + `inventory_custom_values` in ADR-040 §Data Model); Handover: per-entry JSONB makes sense (low cardinality, snapshot-frozen, no aggregate reporting in V1). Decision rationale + explicit "V2 gap: no cross-entry custom-field reporting" lives in the new ADR.                                                                                                                                                                                                                                                                                                                                                                                                       | Reviewer reads ADR §"Why JSONB not EAV" and signs off.                                                                                                                               |
| R13 | `shift_handover_slot` was proposed as a hard ENUM but `shift_times.shift_key` is tenant-configurable VARCHAR(20)            | High   | High        | DDL uses `shift_key VARCHAR(20) NOT NULL` + `CHECK (shift_key IN ('early','late','night'))` for V1 only. App-layer also validates that `shift_key` exists in `shift_times` for the tenant. V1 limitation documented in §Known Limitations: tenants with custom shift_key values (e.g. `'F','S','N'`, `'morgen','tag','nacht'`) are unsupported until V2. **No new DB enum type created.** `shifts_type` is a MIXED enum — it contains slot markers (`early`, `late`, `night`, `F`, `S`, `N`) alongside unrelated labor-law values (`regular`, `overtime`, `standby`, `vacation`, `sick`, `holiday`, `day`, `flexible`). Reusing it as the `shift_key` type would force defensive rejection of non-slot values on every write. A dedicated `VARCHAR(20) + CHECK` keeps the Handover schema semantics clean. | `SELECT shift_key FROM shift_times GROUP BY shift_key;` across test + any prod-like tenant returns only `('early','late','night')` — otherwise V1 launch is blocked for that tenant. |
| R14 | `shared/package.json` conditional exports not updated → `import from '@assixx/shared/shift-handover'` fails at Vite resolve | High   | Low         | Per ADR-015 §2, add the `"./shift-handover"` block with `types`/`import`/`default` pointers. Phase 2.1 DoD adds explicit steps: (1) `shared/package.json` exports entry, (2) `pnpm --filter @assixx/shared build`, (3) `pnpm run sync:svelte` before any frontend tooling. ADR-041 Open Items already flags stale `shared/dist/` as Medium risk — this is the concrete mitigation for our case.                                                                                                                                                                                                                                                                                                                                                                                                            | `grep -A3 '"./shift-handover"' shared/package.json` prints the block; `test -d shared/dist/shift-handover` returns 0.                                                                |
| R15 | HOW-TO-INTEGRATE-FEATURE.md §1.2 RLS template still has bypass clause (verified: line 39–41)                                | Medium | High        | Do NOT copy the template from the HOW-TO. Use ADR-019 strict-mode template verbatim (no `IS NULL OR` bypass, both `app_user` AND `sys_user` GRANTs). Optional: land the HOW-TO fix as a sibling commit in Phase 1 so the landmine doesn't poison the next feature plan.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `grep -c "IS NULL OR" docs/how-to/HOW-TO-INTEGRATE-FEATURE.md` returns 0 after fix (is 1 today). Our 3 migrations' `pg_policies.qual` matches strict pattern only.                   |

> Every risk has a concrete mitigation AND a verification.

### 0.3 Ecosystem integration points

| Existing system                          | Integration                                                                                                                                                                                                                                                            | Phase | Verified on |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------- |
| `shifts` table                           | Primary source. Read-only: resolver unions rows matched by `(tenant_id, team_id, date, type)` where `type` maps to the tenant's `shift_times.shift_key` (see §0.8 spike for mapping rule)                                                                              | 2     |             |
| `shift_rotation_history` table           | Secondary source (ADR-011 dual-source). Read-only: union with `shifts` in assignee resolver. Rows keyed by `(tenant_id, user_id, shift_date)` with `shift_type` enum.                                                                                                  | 2     |             |
| `shift_assignments` table                | NOT the primary source. Multi-assignee junction for manually-planned shifts (`shift_id` FK to `shifts`). Only touched if §0.8 spike confirms V1 needs the junction — otherwise skip.                                                                                   | 2     |             |
| `shift_times` table                      | Read-only: resolves `start_time`/`end_time` per tenant+shift_key, used for (a) active-shift window check, (b) 24 h auto-lock cutoff, (c) app-layer validation that the incoming `shift_key` exists for the tenant (R13).                                               | 2     |             |
| `teams` + `team_members`                 | Read-only: resolves which team a user belongs to (read scope filter)                                                                                                                                                                                                   | 2     |             |
| `addons` table (`shift_planning`)        | Addon-gate via `AddonCheckService.checkTenantAccess(tid, 'shift_planning')` — addon row verified present in DB (not core).                                                                                                                                             | 2     |             |
| Permission Registry (ADR-020)            | Two new modules registered via `OnModuleInit`: `shift-handover-templates` (R/W/D), `shift-handover-entries` (R/W/D — D needed for attachment deletion, see §2.7)                                                                                                       | 2     |             |
| `audit_trail`                            | Submit/re-open/template-change → audit entries via `ActivityLoggerService` (verified path: `backend/src/nest/common/services/activity-logger.service.ts`)                                                                                                              | 2     |             |
| Inventory image module                   | Reused or adapted for attachment upload (decision in §0.7). Canonical pattern: `backend/src/nest/inventory/inventory-photos.service.ts` + `inventory_item_photos` table (`id uuidv7()`, `tenant_id`, `item_id` FK, `file_path`, `caption`, `sort_order`, `is_active`). | 2     |             |
| Frontend shift grid                      | New 📋 button per shift cell; opens entry modal. Current route: `frontend/src/routes/(app)/(shared)/shifts/+page.svelte`.                                                                                                                                              | 5     |             |
| Sidebar navigation                       | Sub-entry "Übergabe-Templates" under the "Schichtplanung" entry (currently flat link at `/shifts`, L510/L661 of `navigation-config.ts`) — promotion to submenu required. Visible iff `canManage` ∧ addon active. See §Frontend Sidebar for the real wiring.            | 5     |             |
| Hierarchy Labels (ADR-034)               | `${labels.team}` in page titles, modal headers, table columns. Propagation via SSR layout data (not context), per ADR-034 §"Data Inheritance".                                                                                                                         | 5     |             |
| `@assixx/shared` (new `shift-handover/`) | New module. Requires: (a) `shared/src/shift-handover/{index,field-types,field-validators}.ts`, (b) `shared/package.json` exports block addition (ADR-015 §2), (c) `pnpm --filter @assixx/shared build` before frontend type-check (ADR-041 Open Items).                | 2     |             |

### 0.7 Inventory Image-Upload Spike (must complete before Phase 2.2)

**Authoritative references (read first):**

- ADR-040 §"Data Model: UUID Primary Keys" — Inventory uses dedicated `inventory_item_photos` table
- ADR-042 — canonical 3-layer multipart pipeline: `@fastify/multipart` (registered ONCE in `backend/src/nest/main.ts` — **line 175 in current codebase**, ADR text still says `:99` and is stale; treat the line number as advisory) + `fastify-multer` (storage engines/limits/fileFilter) + `@webundsoehne/nest-fastify-file-upload` (`FileInterceptor` decorator). Sibling action: update ADR-042 line number in its own PR or as a trailing commit in this feature branch.

**Spike tasks:**

- [ ] Read `backend/src/nest/inventory/inventory.controller.ts` — find the photo upload endpoint(s), capture: `FileInterceptor` config, `MulterFile` import, `diskStorage` setup, fileFilter, size limit
- [ ] Read the inventory migration that created `inventory_item_photos` — capture column shape, RLS, FK to `inventory_items`
- [ ] Read `backend/src/nest/inventory/inventory.service.ts` (or split file) — find the photo persistence logic
- [ ] Read `backend/src/nest/common/interfaces/multer.interface.ts` — confirm `MulterFile` type is reused
- [ ] Read `frontend/src/routes/(app)/(shared)/inventory/_lib/` — find the upload Svelte component(s), check if they expose a reusable API
- [ ] Decision matrix:
  - **REUSE:** Inventory upload UI/service is generic (takes entity-id + file, returns photo metadata). Import + parameterize. → Skip Step 1.3 migration.
  - **ADAPT:** Inventory is shape-coupled to `inventory_item_photos`. Copy controller/service skeleton, create dedicated `shift_handover_attachments` table (Step 1.3). Reuse interceptor wiring + `MulterFile` + `diskStorage` config (per ADR-042 §Hard Rule).
  - **REFACTOR:** Two consumers now exist (Inventory + Handover). Extract shared `AttachmentsModule` with polymorphic FK (`entity_type`, `entity_id`). **Blocks this plan** — refactor PR ships first.
- [x] Decision recorded here: **ADAPT** (2026-04-22). Inventory is shape-coupled: `inventory-photos.service.ts#create(itemId: string, filePath, caption, createdBy)` hardcodes `MAX_PHOTOS_PER_ITEM = 20` and disk-path prefix `uploads/inventory/{tenantId}/{itemUuid}/{fileUuid}{ext}`; frontend upload is **inline** in `items/[uuid]/+page.svelte` L154–187 (no reusable component). REUSE ruled out. REFACTOR (shared `AttachmentsModule` with polymorphic FK) not justified for 2 consumers → V2 cost (see Known Limitation #14). Step 1.3 creates dedicated `shift_handover_attachments` table; Step 2.4 copies controller+service pattern using `memoryStorage()` + inline `writeShiftHandoverAttachmentToDisk()` helper (mirroring Inventory's `writeInventoryPhotoToDisk`), reusing `MulterFile` (shared across 9 controllers) and `@fastify/multipart` at `main.ts:175`.
- [x] Verify the load-bearing `@fastify/multipart` registration in `backend/src/nest/main.ts` (confirmed line 175, previously `:99` in ADR-042 text) is still present with its pointer comment after our work. Do not regress.

> Time-box: 1 hour. If spike runs over → escalate, do not solve in Phase 1.
> **Pre-spike default:** ADAPT. **Confirmed 2026-04-22.** Inventory's photo table is item-coupled and the field-naming differs (`item_id` vs `entry_id`). Refactor is rarely worth it for two consumers.

### 0.8 Slot-Identity Spike (must complete before Phase 1.2)

**Problem statement (R13, B3):** The product locked "one handover per shift-slot per team per day". The DB has THREE places that could represent a slot, and they don't agree:

| Source                              | Shape                                    | Values (in test tenants 8/36)                                                                                                                       |
| ----------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shift_times.shift_key`             | `VARCHAR(20)`, per-tenant                | `'early','late','night'`                                                                                                                            |
| `shifts.type`                       | `shifts_type` ENUM                       | `'regular','overtime','standby','vacation','sick','holiday','early','late','night','day','flexible','F','S','N'` (14 labor-law + slot values mixed) |
| `shift_rotation_history.shift_type` | `shift_rotation_history_shift_type` ENUM | Separate enum, values TBD (inspect before spike closes)                                                                                             |

**Spike tasks:**

- [ ] Dump all distinct `shift_times.shift_key` values across **every** tenant in the target environment:
  ```bash
  docker exec assixx-postgres psql -U assixx_user -d assixx -c \
    "SELECT DISTINCT shift_key FROM shift_times ORDER BY shift_key;"
  ```
  V1 is only viable if the result set ⊆ `{'early','late','night'}`. Otherwise → escalate.
- [ ] Inspect `shift_rotation_history_shift_type` ENUM values:
  ```bash
  docker exec assixx-postgres psql -U assixx_user -d assixx -c \
    "SELECT enumlabel FROM pg_enum WHERE enumtypid = 'shift_rotation_history_shift_type'::regtype ORDER BY enumsortorder;"
  ```
- [ ] Read `backend/src/nest/shifts/shifts.service.ts` L81–101 and L686–688 — copy the UNION-ALL canonical merge into scratch notes. Reference this in Phase 2.3.
- [ ] Document the mapping rule **`shift_key → (shifts.type values) ∪ (shift_rotation_history.shift_type values)`** that the resolver will use. Example:
  - `'early'` → match `shifts.type IN ('early','F') OR shift_rotation_history.shift_type ∈ (equivalent)`
  - `'late'` → match `shifts.type IN ('late','S')  OR shift_rotation_history.shift_type ∈ (equivalent)`
  - `'night'` → match `shifts.type IN ('night','N') OR shift_rotation_history.shift_type ∈ (equivalent)`
  - Actual equivalences **must** be verified against the two ENUMs, not guessed.
- [ ] Decide: does the resolver use (a) `shifts.type` equivalence matching (recommended — unambiguous) or (b) time-window overlap via `shift_times.start_time..end_time` (fallback if enum equivalence is incomplete)?
- [x] Decision recorded here: **Option A — enum-equivalence matching** (2026-04-22). Verified via live DB: `SELECT DISTINCT shift_key FROM shift_times` returned `{'early','late','night'}` across both tenants with `shift_times` rows (IDs 8, 36 — the only 2 of 9 tenants that have configured shift_times). `shifts_type` ENUM = 14 values (`regular, overtime, standby, vacation, sick, holiday, early, late, night, day, flexible, F, S, N`); `shift_rotation_history_shift_type` ENUM = `{F, S, N}`. Canonical merge at `backend/src/nest/shifts/shifts.service.ts` L681–691 already implements the equivalence with filter `shifts.type IN ('F','S','N','early','late','night')` + UNION on `shift_rotation_history`, with post-query normalization `early→F, late→S, night→N`. Resolver mirrors this pattern. Mapping rule: `'early'` ↔ `shifts.type ∈ {'early','F'}` ∪ `shift_rotation_history.shift_type = 'F'`; `'late'` ↔ `{'late','S'}` / `'S'`; `'night'` ↔ `{'night','N'}` / `'N'`. Time-window overlap (Option B) not needed — enum coverage is complete.
- [x] Output: one pure function signature that Phase 2.3 implements:
  ```typescript
  // Returns both sources unioned; caller de-duplicates on user_id.
  resolveAssignees(
    tenantId: number,
    teamId: number,
    shiftDate: Date,        // in Europe/Berlin calendar day
    shiftKey: 'early'|'late'|'night',
  ): Promise<number[]>;
  ```

> Time-box: 45 minutes. If any result falls outside `{'early','late','night'}` in prod-like data, STOP and escalate — V1 scope assumption is invalid for that tenant.
> **Pre-spike default:** assume test-tenant parity. **Confirmed 2026-04-22:** both tenants with `shift_times` rows (IDs 8, 36) use `{'early','late','night'}` exclusively. Phase 1.2 `CHECK (shift_key IN ('early','late','night'))` is safe.

---

## Phase 1: Database Migrations

> **Dependency:** §0 sign-off + §0.7 spike complete.
> **Backup mandatory** before applying.

### Step 1.1: Create `shift_handover_templates` [✅ DONE — 2026-04-22]

> **Applied 2026-04-22 14:20 Europe/Berlin** as migration `20260422120720338_create-shift-handover-templates` (pgmigrations #142). Backup taken pre-apply at `database/backups/full_backup_pre_shift_handover_20260422_140713.dump`. Verification passed: table shape, RLS enabled + forced, strict-mode `tenant_isolation` policy (NULLIF, no bypass), `app_user` + `sys_user` GRANTs (SELECT/INSERT/UPDATE/DELETE), 3 indexes (PK + partial on `(tenant_id, team_id) WHERE is_active = 1` + UNIQUE backing), 4 FKs (tenant/team CASCADE, created_by/updated_by nullable), `docker exec assixx-backend pnpm run type-check` exit 0.

**New file:** `database/migrations/{utc-ts}_create-shift-handover-templates.ts` (generator only, NEVER manual)

**Schema:**

```sql
-- NOTE: PostgreSQL 18.3 native UUIDv7 function is `uuidv7()` — NOT `uuid_generate_v7()`.
-- Verified 2026-04-22: prior migrations (20260416135731342, 20260417223358319) and
-- `inventory_item_photos` default all use `uuidv7()`. Do not invent a new function name.
CREATE TABLE shift_handover_templates (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  -- One template per team. UNIQUE constraint blocks duplicates.
  -- Team-Lead edits inline; no template versioning in V1 (entries snapshot field-defs).
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Array of { key, label, type, required, options? } objects.
  -- Validated against shared Zod schema on every write.
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  UNIQUE (tenant_id, team_id)
);

ALTER TABLE shift_handover_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_handover_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON shift_handover_templates FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

GRANT SELECT, INSERT, UPDATE, DELETE ON shift_handover_templates TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON shift_handover_templates TO sys_user;

CREATE INDEX idx_sht_tenant_team ON shift_handover_templates(tenant_id, team_id) WHERE is_active = 1;
```

**Per-table checklist:** see master checklist below.

### Step 1.2: Create `shift_handover_entries` [✅ DONE — 2026-04-22]

> **Applied 2026-04-22 14:32 Europe/Berlin** as migration `20260422122625347_create-shift-handover-entries` (pgmigrations #143). Fresh backup pre-apply at `database/backups/full_backup_pre_shift_handover_entries_20260422_142618.dump`. Verification passed: table with 19 columns (incl. `status shift_handover_status` ENUM column with `DEFAULT 'draft'::shift_handover_status`); `shift_handover_status` ENUM has exactly `(draft, submitted, reopened)`; CHECK constraint `shift_key IN ('early','late','night')` active (R13 V1 whitelist); UNIQUE `(tenant_id, team_id, shift_date, shift_key)` is **DEFERRABLE INITIALLY IMMEDIATE** (pg_constraint: `condeferrable=t, condeferred=f`); 6 FKs (tenant/team CASCADE, 4× users NO ACTION); RLS enabled + forced with strict-mode `tenant_isolation` policy (NULLIF, no bypass); `app_user` + `sys_user` GRANTs (SELECT/INSERT/UPDATE/DELETE); 5 indexes (PK, UNIQUE-backing, 3 partial: `idx_she_team_date`, `idx_she_status`, `idx_she_autolock` with `WHERE status='draft' AND is_active=1`); `docker exec assixx-backend pnpm run type-check` exit 0.

**Schema:**

```sql
-- Only ONE new enum: the status machine. shift_key is NOT a new enum — see R13.
CREATE TYPE shift_handover_status AS ENUM ('draft', 'submitted', 'reopened');

CREATE TABLE shift_handover_entries (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  -- shift_key mirrors `shift_times.shift_key VARCHAR(20)` conventions. Not an FK
  -- (composite tenant-scoped FK would complicate RLS); app-layer validates that
  -- `(tenant_id, shift_key)` exists in shift_times on every write. V1 locks the
  -- allowed values via CHECK to the current test-tenant convention (R13).
  -- Tenants that use custom keys like 'F','S','N' are unsupported until V2.
  shift_key VARCHAR(20) NOT NULL
    CHECK (shift_key IN ('early', 'late', 'night')),
  -- Composite identity: (tenant_id, team_id, shift_date, shift_key) is unique per active entry.
  protocol_text TEXT NOT NULL DEFAULT '',
  custom_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Snapshot of template.fields at submit time. Drift safety (R2).
  status shift_handover_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  submitted_by INTEGER REFERENCES users(id),
  reopened_at TIMESTAMPTZ,
  reopened_by INTEGER REFERENCES users(id),
  reopen_reason TEXT,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by INTEGER NOT NULL REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  UNIQUE (tenant_id, team_id, shift_date, shift_key) DEFERRABLE INITIALLY IMMEDIATE
);

ALTER TABLE shift_handover_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_handover_entries FORCE ROW LEVEL SECURITY;
-- ADR-019 strict-mode policy (no `IS NULL OR` bypass). Do NOT copy the outdated
-- template from HOW-TO-INTEGRATE-FEATURE §1.2 (R15).
CREATE POLICY tenant_isolation ON shift_handover_entries FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

-- Triple-User-Model GRANTs (ADR-019). Both app_user AND sys_user; sys_user is
-- needed for cross-tenant cron (auto-lock sweep) and admin scripts.
GRANT SELECT, INSERT, UPDATE, DELETE ON shift_handover_entries TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON shift_handover_entries TO sys_user;

CREATE INDEX idx_she_team_date ON shift_handover_entries(tenant_id, team_id, shift_date DESC) WHERE is_active = 1;
CREATE INDEX idx_she_status ON shift_handover_entries(tenant_id, status) WHERE is_active = 1;
CREATE INDEX idx_she_autolock ON shift_handover_entries(tenant_id, status, shift_date)
  WHERE status = 'draft' AND is_active = 1;
-- ^ supports the cron auto-lock sweep: `WHERE status='draft' AND shift_date + shift_end + 24h < now()`
```

### Step 1.3: Create `shift_handover_attachments` [✅ DONE — 2026-04-22]

> **Applied 2026-04-22 14:49 Europe/Berlin** as migration `20260422124449192_create-shift-handover-attachments` (pgmigrations #144). Fresh backup pre-apply at `database/backups/full_backup_pre_shift_handover_attachments_20260422_144442.dump`. Verification passed: 12-column table (UUIDv7 PK, tenant_id / entry_id / created_by FKs, mime_type + file_size_bytes + file_name added over inventory_item_photos per plan correction #4, immutable — no updated_at/\_by); FK `entry_id → shift_handover_entries(id) ON DELETE CASCADE` confirmed active; RLS enabled + forced with strict-mode `tenant_isolation` policy; `app_user` + `sys_user` GRANTs (SELECT/INSERT/UPDATE/DELETE); 2 indexes (PK + partial `idx_sha_entry (entry_id) WHERE is_active = 1`, no UNIQUE per plan — multiple attachments per entry expected, 5-per-entry cap enforced app-layer in Phase 2.4); `docker exec assixx-backend pnpm run type-check` exit 0. **`MAX_ATTACHMENTS_PER_ENTRY = 5` is intentionally NOT a DB CHECK** — soft-limit room for future tenant-configurability.

**Decision-dependent on §0.7.** If Inventory module is reusable → skip this step (use existing table polymorphically). If adapt-pattern → create:

```sql
-- Mirrors `inventory_item_photos` shape. `uuidv7()` per PG18 native function (R13 note).
CREATE TABLE shift_handover_attachments (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES shift_handover_entries(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  -- Caption optional, mirrors inventory_item_photos.caption.
  caption VARCHAR(255),
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by INTEGER NOT NULL REFERENCES users(id)
);

ALTER TABLE shift_handover_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_handover_attachments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON shift_handover_attachments FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

GRANT SELECT, INSERT, UPDATE, DELETE ON shift_handover_attachments TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON shift_handover_attachments TO sys_user;

CREATE INDEX idx_sha_entry ON shift_handover_attachments(entry_id) WHERE is_active = 1;
```

**Application-level constraint:** max 5 attachments per entry, enforced in service before INSERT (NOT a DB CHECK — soft limit, room for future config).

### Per-table checklist (mandatory)

- [ ] UUIDv7 primary key via `DEFAULT uuidv7()` (PG18 native — **NOT** `uuid_generate_v7()`, that function does not exist; verified 2026-04-22)
- [ ] `tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- [ ] `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- [ ] RLS policy uses **ADR-019 strict-mode pattern** (`NULLIF(current_setting('app.tenant_id', true), '')`), no `IS NULL OR` bypass (R15). Do not copy the template from HOW-TO-INTEGRATE-FEATURE §1.2.
- [ ] `GRANT SELECT, INSERT, UPDATE, DELETE` to **both** `app_user` AND `sys_user` (Triple-User Model)
- [ ] `is_active SMALLINT NOT NULL DEFAULT 1`
- [ ] Indexes use `WHERE is_active = 1` partial predicate where soft-delete-aware
- [ ] `up()` AND `down()` implemented; `down()` drops in reverse FK order; also drops `shift_handover_status` enum in Step 1.2 down()
- [ ] No `IF NOT EXISTS` in `up()` (per migration discipline, MIGRATION-GUIDE §Forbidden Patterns)
- [ ] Migration generated via `doppler run -- pnpm run db:migrate:create <name>` — NEVER manual (17-digit UTC timestamp enforced by node-pg-migrate v8)
- [ ] Backup taken BEFORE dry-run: `docker exec assixx-postgres pg_dump -U assixx_user -d assixx --format=custom --compress=9 > database/backups/full_backup_pre_shift_handover_{ts}.dump`

### Phase 1 — Definition of Done [✅ DONE — 2026-04-22]

- [x] 2 or 3 migration files (depends on §0.7) with both `up()` AND `down()` — **3 applied (§0.7 = ADAPT): templates #142, entries #143, attachments #144**
- [x] Backup taken: `database/backups/full_backup_pre_shift_handover_{ts}.dump` — **3 fresh backups (14:07, 14:26, 14:44), one per step**
- [x] Dry run passes: `doppler run -- ./scripts/run-migrations.sh up --dry-run` — **all 3 dry-runs: `Migrations complete!`**
- [x] All migrations applied; entries in `pgmigrations` — **#142, #143, #144 with run_on 14:20, 14:32, 14:49 UTC**
- [x] All tables verified: `\d shift_handover_*` shows expected columns + RLS — **3 tables: 9 / 19 / 12 columns; forced RLS on all**
- [x] Policies verified: `SELECT tablename, policyname FROM pg_policies WHERE tablename LIKE 'shift_handover_%';` returns one per table — **3 rows, all `tenant_isolation`, all strict-mode (NULLIF, no bypass)**
- [x] GRANTs verified for both `app_user` and `sys_user` — **24 rows total (3 tables × 2 roles × 4 privileges)**
- [x] Backend compiles after migration: `docker exec assixx-backend pnpm run type-check` → 0 errors — **verified after each apply, final exit 0**
- [x] Existing tests still pass — **architectural test suite passed 25/25 at Phase-1 close (2026-04-22 14:51); full API-test run deferred to end-of-Phase-2 per Spec Deviation #1**

---

## Phase 2: Backend Module

> **Dependency:** Phase 1 complete + §0.7 decision locked.
> **Reference modules:** `backend/src/nest/inventory/` (image pattern), `backend/src/nest/shifts/` (shift assignment lookup), `backend/src/nest/surveys/` (ADR-045 reference impl for permissions).

### Step 2.1: Module skeleton + types + DTOs + shared field schemas [✅ DONE — 2026-04-22]

> **Shipped 2026-04-22** (Session 3). Shared module `@assixx/shared/shift-handover` live with conditional exports (ADR-015) + `zod ~4.3.6` dependency added. Backend `shift-handover/` skeleton covers types, DTOs (11 + barrel), permissions, tokens, registrar, and module. Spec Deviation #2 resolves the category-code conflict: `PermissionRegistryService` gained `addModulesToCategory()`; the shift-handover registrar uses `OnApplicationBootstrap` to append 2 modules to the existing `shift_planning` category after all `OnModuleInit` hooks fire. Runtime-validated at backend boot. All verification green: type-check, ESLint, frontend svelte-check, `/health` post-restart.

**New directory:** `backend/src/nest/shift-handover/`

```
backend/src/nest/shift-handover/
  shift-handover.module.ts
  shift-handover.types.ts                  # Row types, DTO types, ActiveShiftContext
  shift-handover.permissions.ts            # PermissionCategoryDef (ADR-020)
  shift-handover-permission.registrar.ts   # OnModuleInit registrar
  shift-handover.tokens.ts                 # DI tokens for repositories/util
  dto/
    common.dto.ts
    create-template.dto.ts
    update-template.dto.ts
    create-entry.dto.ts
    update-entry.dto.ts
    submit-entry.dto.ts
    reopen-entry.dto.ts
    list-entries-query.dto.ts
    template-id-param.dto.ts
    entry-id-param.dto.ts
    upload-attachment.dto.ts
    index.ts
```

**New shared module (canonical path — single source of truth for this plan):**

```
shared/src/shift-handover/
  index.ts                # barrel: re-exports from field-types + field-validators
  field-types.ts          # ShiftHandoverFieldType enum ('text'|'textarea'|'integer'|'decimal'|'date'|'time'|'boolean'|'select'), FieldDef Zod schema
  field-validators.ts     # buildEntryValuesSchema(fields[]) → ZodObject for custom_values
```

Import paths from both sides **must** be `@assixx/shared/shift-handover` (NOT `@assixx/shared/shift-handover-fields.ts` — that was an earlier draft naming; removed 2026-04-22).

**Why shared:** R7 — both backend (validate on submit) and frontend (validate before submit) consume the same Zod schemas.

**Conditional exports — mandatory addition to `shared/package.json`** (ADR-015 §2, R14):

```json
{
  "exports": {
    "./shift-handover": {
      "types": "./src/shift-handover/index.ts",
      "import": "./dist/shift-handover/index.js",
      "default": "./dist/shift-handover/index.js"
    }
  }
}
```

**Build order (Phase 2.1 DoD adds these steps):**

- [x] Create `shared/src/shift-handover/` directory + 3 files. — **3 files shipped (index, field-types, field-validators)**
- [x] Add the `"./shift-handover"` block to `shared/package.json` exports. — **Appended + `zod ~4.3.6` dependency added**
- [x] Run `pnpm --filter @assixx/shared build` — must produce `shared/dist/shift-handover/{index,field-types,field-validators}.{js,d.ts}`. — **13 artefacts (6 js, 3 d.ts, 4 maps)**
- [x] Run `pnpm run sync:svelte` (ADR-041 Related Fix — ensures `.svelte-kit/tsconfig.json` regenerates before frontend tooling resolves the new import). — **chained into `type-check` + `check` scripts**
- [x] Verify resolution: `docker exec assixx-backend pnpm run type-check` + `cd frontend && pnpm run check` both return 0 errors with an `import { buildEntryValuesSchema } from '@assixx/shared/shift-handover';` somewhere in touched code. — **type-check exit 0 across shared/frontend/backend/backend-test; svelte-check 0 errors on 2554 files; `@assixx/shared/shift-handover` imported by `dto/common.dto.ts` (re-exports `ShiftHandoverFieldDefSchema`/`ShiftHandoverTemplateFieldsSchema`), `buildEntryValuesSchema` consumed in Phase 2.5 per plan**

**Register in `app.module.ts`:**

- [x] `ShiftHandoverModule` added to imports (alphabetical) — **inserted before `ShiftsModule` at both import block and `imports:` array (lines 69 + 205 approx)**

### Step 2.2: `ShiftHandoverTemplatesService` [✅ DONE — 2026-04-22]

> **Shipped 2026-04-22** (Session 4, part 1 of 2). File `backend/src/nest/shift-handover/shift-handover-templates.service.ts` (151 LOC). Three public methods match the plan signatures exactly: `getTemplateForTeam`, `upsertTemplate`, `deleteTemplate`. Single-statement `INSERT … ON CONFLICT (tenant_id, team_id) DO UPDATE … RETURNING *` for idempotent upsert; `is_active` flips back to `IS_ACTIVE.ACTIVE` on revive so a previously soft-deleted template is transparently restored. `TENANT_ID_FROM_RLS` SQL fragment (`NULLIF(current_setting('app.tenant_id', true), '')::integer`) uses the same GUC the ADR-019 policy checks, making tenantId-mismatch impossible by construction. Pre-check `SELECT id FROM teams WHERE id = $1` (RLS tenant-filtered) surfaces a readable `BadRequestException` instead of opaque FK-violation SQLSTATE 23503. Private `validateFields()` re-runs the shared `ShiftHandoverTemplateFieldsSchema.safeParse()` as Power-of-Ten Rule 5 defense-in-depth. Soft-delete uses `RETURNING id` + row-count check → `NotFoundException` when no active row. `ShiftHandoverModule` gains `ShiftHandoverTemplatesService` in both `providers` and `exports` (§2.5 EntriesService will consume it for `schema_snapshot`). Verification: ESLint on the directory exit 0 (one lint error fixed inline: `@typescript-eslint/typedef` required explicit `client: PoolClient` annotation on the `tenantTransaction` callback); full `pnpm run type-check` (shared + frontend + backend + backend/test) exit 0.

**File:** `backend/src/nest/shift-handover/shift-handover-templates.service.ts`

**Methods:**

- `getTemplateForTeam(teamId)` — returns one or default-empty
- `upsertTemplate(teamId, fields[])` — single endpoint for create + update; idempotent
- `deleteTemplate(teamId)` — soft-delete `is_active=0`

**Critical:** validates `fields[]` against `FieldDef` Zod schema; no duplicate `key`s; `key` must be valid identifier (`/^[a-z][a-z0-9_]*$/`); max 30 fields per template.

### Step 2.3: `ActiveShiftResolverService` [✅ DONE — 2026-04-22]

> **Shipped 2026-04-22** (Session 4, part 2 of 2). File `backend/src/nest/shift-handover/active-shift-resolver.service.ts` (201 LOC). All 4 public methods match the plan signatures exactly plus one private helper (`isWithinWriteWindow`) extracted to keep `canWriteForShift` under the cognitive-complexity cap. §0.8 mapping (`early ↔ {early,F}/F`, `late ↔ {late,S}/S`, `night ↔ {night,N}/N`) captured verbatim as two top-level `Record<ShiftHandoverSlot,…>` constants. UNION SQL mirrors the canonical merge at `shifts.service.ts` L681–691 (verified same query shape, same filter predicates). TZ math delegated to PostgreSQL `AT TIME ZONE 'Europe/Berlin'` — leverages the engine's DST table instead of re-implementing JS TZ math. `canWriteForShift` logic (R5): single query computes `today_berlin` (`to_char(... AT TIME ZONE 'Europe/Berlin')::date`) + `shift_end_utc` (`(shiftDate + shift_times.end_time) AT TIME ZONE 'Europe/Berlin'`), then evaluates 3 allowed cases in flat JS: same-day → true; non-night + other-day → false; night + yesterday + `now < shift_end_utc` → true. `getAutoLockCutoff` uses `db.query()` (no RLS needed — no tenant-scoped tables touched) with single SQL expression evaluating `now > shift_end_utc + interval '24 hours'`. All DB access via `queryAsTenant(sql, params, tenantId)` with explicit tenantId per plan purity contract — service is callable outside HTTP/CLS context. `ShiftHandoverModule` updated: `ActiveShiftResolverService` added to `providers` + `exports`. Verification: Prettier 0, ESLint 0, full `pnpm run type-check` (shared + frontend + backend + backend/test) exit 0. Session 4 closed; Session 5 (§2.4 AttachmentsService + §2.5 EntriesService) is next.

**File:** `backend/src/nest/shift-handover/active-shift-resolver.service.ts`

**Pre-requisite:** §0.8 spike decision locked. The mapping rule `shift_key → shifts.type values ∪ shift_rotation_history.shift_type values` must be documented before this service is written; guessing is forbidden.

**Methods:**

- `resolveAssignees(tenantId, teamId, shiftDate, shiftKey)` → `Promise<number[]>` of user IDs.
  UNION-ALL query mirroring `backend/src/nest/shifts/shifts.service.ts` L81–101 / L686–688:
  ```sql
  SELECT user_id FROM shifts WHERE tenant_id=$1 AND team_id=$2 AND date=$3 AND type IN (...$4 mapping...)
  UNION
  SELECT user_id FROM shift_rotation_history WHERE tenant_id=$1 AND team_id=$2 AND shift_date=$3 AND shift_type IN (...$4 mapping...)
  ```
  Caller (`EntriesService`) de-duplicates.
- `canWriteForShift({ userId, tenantId, teamId, shiftDate, shiftKey, nowUtc })` → `Promise<boolean>`:
  - Rule 1: `userId ∈ resolveAssignees(...)`.
  - Rule 2 (time window, TZ-aware per R5):
    - `today_berlin := (nowUtc AT TIME ZONE 'Europe/Berlin')::date`
    - `shiftEndTime := shift_times.end_time` for `(tenantId, shiftKey)`
    - Allowed iff `shiftDate = today_berlin` OR (`shiftKey = 'night' AND shiftDate = today_berlin - 1 day AND nowUtc < (shiftDate + shiftEndTime)` interpreted in Europe/Berlin).
  - Team-Lead bypass handled one layer up, at the controller, via `@RequirePermission` (Layer 2 ADR-045).
- `getShiftEndClock(tenantId, shiftKey)` → `Promise<{ startTime: string; endTime: string }>` (clock-time strings) — reads `shift_times`; needed for the 24 h auto-lock cutoff and for client-side display.
- `getAutoLockCutoff(entry, nowUtc)` → `boolean` — pure helper: `nowUtc > shiftDate + shiftEndTime + 24h` (both sides in Europe/Berlin).

**Purity:** every method takes its clock/TZ context as a parameter. No `Date.now()` inside. No `process.env.TZ`. Tests inject fixed `nowUtc` values.

**Why not a DB CHECK on `shift_key`?** Because `shift_times.shift_key` is tenant-scoped and the DB CHECK is global (`('early','late','night')`). The CHECK is the V1-literal whitelist; the app-layer `shift_times` lookup is the tenant-consistency check. Both exist deliberately.

### Step 2.4: `ShiftHandoverAttachmentsService` [✅ DONE — 2026-04-22]

> **Shipped 2026-04-22** (Session 5, part 1 of 2). File `backend/src/nest/shift-handover/shift-handover-attachments.service.ts` (258 LOC). Constants (`SHIFT_HANDOVER_MAX_ATTACHMENT_SIZE = 5MB`, `MAX_ATTACHMENTS_PER_ENTRY = 5`, `ALLOWED_MIME_TYPES = {jpeg,png,webp,heic}`) exported from `shift-handover.types.ts` so §2.6 controller's `FileInterceptor({limits:{fileSize:…}})` uses the same single source of truth. Three public methods match plan: `uploadForEntry(entryId, file, userId)` — validates MIME + size + 5-cap, writes buffer to `uploads/shift-handover/{tenantId}/{entryId}/{uuidv7()}{ext}`, INSERTs row; `deleteAttachment(entryId, attachmentId, {userId, canManage})` — enforces (mutable-status + (creator OR canManage)); `streamAttachment(attachmentId)` — returns `{filePath, mimeType, fileName}` for controller-side Fastify reply streaming. MUTABLE_ENTRY_STATUSES = `['draft','reopened']` (submitted entries locked). All DB access via `tenantTransaction`/`tenantQuery` (ADR-019). Order-of-operations doc'd: disk-write BEFORE INSERT inside the same tx — orphan-file-on-INSERT-failure is the deliberately-accepted trade-off vs. "commit first, write later" (worse UX on crash). `canManage` boolean populated by controller from `orgScope.isAnyLead` (ADR-045 Layer 1). File extension derived from MIME (untrusted `originalname`). Module providers + exports updated. Verification: Prettier 0, ESLint 0, full `pnpm run type-check` (shared + frontend + backend + backend/test) exit 0. Session 5 continues with §2.5 EntriesService.

**§0.7 decision locked (2026-04-22): ADAPT** — dedicated `shift_handover_attachments` table (Step 1.3) + controller+service pattern copied from `backend/src/nest/inventory/inventory.controller.ts` + `inventory-photos.service.ts`. Concrete reuse surface:

- `MulterFile` type from `backend/src/nest/common/interfaces/multer.interface.ts` (already shared across 9 controllers)
- `memoryStorage()` from `fastify-multer` as the Multer storage engine (mirrors Inventory's actual config — NOT `diskStorage()`, despite ADR-042's shorthand classification)
- Inline `writeShiftHandoverAttachmentToDisk(tenantId, entryId, file)` helper mirroring Inventory's `writeInventoryPhotoToDisk()`; disk path: `uploads/shift-handover/{tenantId}/{entryId}/{uuidv7()}{ext}`
- `@fastify/multipart` registration at `main.ts:175` already serves this module — no additional registration
- `FileInterceptor('file', options)` from `@webundsoehne/nest-fastify-file-upload` (ADR-042 canonical layer 3)

**Methods:**

- `uploadForEntry(entryId, file)` — enforces 5-image cap, backend MIME whitelist (`image/jpeg`, `image/png`, `image/webp`, `image/heic` — stricter than Inventory which has none), **5 MB size cap (parity with Inventory's `MAX_PHOTO_FILE_SIZE`)**
- `deleteAttachment(entryId, attachmentId)` — only if entry is draft AND user wrote it OR is team-lead
- `streamAttachment(attachmentId)` — read-scope filter

### Step 2.5: `ShiftHandoverEntriesService` [✅ DONE — 2026-04-22] — the heart

> **Shipped 2026-04-22** (Session 5, part 2 of 2). File `backend/src/nest/shift-handover/shift-handover-entries.service.ts` (440 LOC; every function ≤55 LOC). All 7 methods per plan implemented + 5 private helpers + 3 module-level pure helpers (`toIsoDateUtc`, `requireRow<T extends QueryResultRow>`, `buildListFilters`, `stripTotal`). Clock is DI-injected via `SHIFT_HANDOVER_CLOCK` token — module binds real clock as `() => new Date()`; `new Date()` appears nowhere in the service (plan §2.3 purity extended to §2.5). Key implementation choices: (1) race-safe `INSERT … ON CONFLICT DO NOTHING RETURNING *` + fallback SELECT in `getOrCreateDraft`; (2) `MUTABLE_ENTRY_STATUSES = {draft,reopened}` (plan-text deviation documented — "draft only" reading reconciled with reopen flow's "allow further edits"); (3) `submitEntry` does `SELECT … FOR UPDATE` (R3) + snapshots live `template.fields` into `schema_snapshot` (R2) + re-parses `custom_values` through the snapshot schema as final validation; (4) `runAutoLockSweep` uses `systemTransaction` (sys*user BYPASSRLS) + correlated subquery to snapshot current template per matched row + TZ math `AT TIME ZONE 'Europe/Berlin' + interval '24 hours'` entirely in SQL; (5) `listEntriesForTeam` single query with `COUNT(*) OVER()`window. Audit via`ActivityLoggerService`on submit/reopen using`entityType:'shift'`+ UUID in`newValues`(enum doesn't carry`shift_handover\*\*`— pragmatic reuse avoiding shared-type scope creep; V2 can extend the enum properly). Module updated: 5 providers total (4 services + registrar) +`SHIFT_HANDOVER_CLOCK`provider binding. Verification (after fixing 2 lint issues inline —`T extends QueryResultRow`constraint on`requireRow`+ naming-convention-safe destructure pattern): Prettier 0, ESLint 0, full`pnpm run type-check` exit 0. Session 5 closed.

**File:** `backend/src/nest/shift-handover/shift-handover-entries.service.ts`

**Methods:**

- `getOrCreateDraft(teamId, shiftDate, shiftKey, userId)` — if no entry exists for `(tenantId, teamId, shiftDate, shiftKey)`, INSERT a draft (validates `canWriteForShift`); else return existing if draft. App-layer pre-check: `shiftKey` must be a row in `shift_times` for this tenant (R13).
- `updateDraft(entryId, dto, userId)` — only if status='draft'; validates `custom_values` against current template's Zod schema (built from `buildEntryValuesSchema(template.fields)` in `@assixx/shared/shift-handover`).
- `submitEntry(entryId, userId)` — opens a `tenantTransaction`, does `SELECT … FOR UPDATE` row lock (R3), flips status='submitted', snapshots `schema_snapshot = template.fields`, sets `submitted_at`/`submitted_by`, logs audit event via `ActivityLoggerService`.
- `reopenEntry(entryId, userId, reason)` — Team-Lead only (Layer 1 + Layer 2 enforced in controller); status='reopened'; allows further edits until next submit; audit-log.
- `listEntriesForTeam(teamId, query)` — paginated list, status filter, date range. Pagination per ADR-007 envelope.
- `getEntry(entryId, userId)` — read-scope check (same team OR Admin/Root). Renders against `schema_snapshot`, not live template (R2).
- `runAutoLockSweep(nowUtc)` — cron-friendly, pure dependency on injected time: locks all drafts where `(shift_date + shift_times.end_time + 24h)` (in Europe/Berlin) < nowUtc. Uses `systemTransaction()` (sys_user) because the sweep is cross-tenant.

**Patterns:**

- All queries via `db.tenantTransaction()` (ADR-019)
- Returns raw rows (ADR-007 — no `{success, data}` wrap)
- `$1, $2, $3` placeholders
- `??` not `||`

### Step 2.6: `ShiftHandoverController` [PENDING]

**File:** `backend/src/nest/shift-handover/shift-handover.controller.ts`

**Endpoints:**

| Method | Route                                            | Permission                                         | Description                                                             |
| ------ | ------------------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------------- |
| GET    | `/shift-handover/templates/:teamId`              | `templates.canRead`                                | Get template for team (or defaults)                                     |
| PUT    | `/shift-handover/templates/:teamId`              | `templates.canWrite` + canManage                   | Upsert template (Team-Lead+)                                            |
| DELETE | `/shift-handover/templates/:teamId`              | `templates.canDelete` + canManage                  | Soft-delete template                                                    |
| POST   | `/shift-handover/entries`                        | `entries.canWrite` + canWriteForShift              | Create draft for `(teamId, shiftDate, shiftKey)`                        |
| GET    | `/shift-handover/entries`                        | `entries.canRead`                                  | List entries (filter team, date range, status)                          |
| GET    | `/shift-handover/entries/:id`                    | `entries.canRead` + same-team                      | Read one entry                                                          |
| PATCH  | `/shift-handover/entries/:id`                    | `entries.canWrite` + canWriteForShift OR canManage | Update draft fields                                                     |
| POST   | `/shift-handover/entries/:id/submit`             | `entries.canWrite` + canWriteForShift OR canManage | Lock + finalize                                                         |
| POST   | `/shift-handover/entries/:id/reopen`             | `entries.canWrite` + canManage                     | Team-Lead re-opens                                                      |
| POST   | `/shift-handover/entries/:id/attachments`        | `entries.canWrite` + canWriteForShift              | Upload image (multipart)                                                |
| GET    | `/shift-handover/entries/:id/attachments/:attId` | `entries.canRead` + same-team                      | Stream image                                                            |
| DELETE | `/shift-handover/entries/:id/attachments/:attId` | `entries.canWrite` + canWriteForShift OR canManage | Delete image (only on draft)                                            |
| GET    | `/shift-handover/my-permissions`                 | authenticated                                      | TPM-style self-check: `{canManageTemplates, canWriteForToday}` per team |

**Every endpoint MUST:**

- [ ] Call `AddonCheckService.checkTenantAccess(tenantId, 'shift_planning')`
- [ ] Use `@RequirePermission(SHIFT_PLANNING_ADDON, MOD_*, 'canX')`
- [ ] NO `@Roles('admin', 'root')` on mutations (ADR-045)
- [ ] Return raw data (ResponseInterceptor wraps automatically)

### Step 2.7: Permission registrar [PENDING]

**File:** `backend/src/nest/shift-handover/shift-handover-permission.registrar.ts`

Two new modules registered:

- `shift-handover-templates` (R/W/D)
- `shift-handover-entries` (R/W/D) — `canDelete` is wired because the `DELETE /entries/:id/attachments/:attId` endpoint needs it (W2 fix). Entry-level deletion (row-level) remains Admin/Root via direct DB access; the `canDelete` permission at module-level gates attachment-delete only. Document this split in the permission registrar's JSDoc so the discrepancy between "permission exists" and "endpoint doesn't exist" is traceable.

Both belong to `shift_planning` addon (ADR-033, verified row present in `addons` table, `is_core=false`).

### Step 2.8: Cron job for auto-lock [PENDING]

**Decision:** add a NestJS `@Cron('0 */6 * * *')` (every 6h) job that calls `runAutoLockSweep()`. Belongs in `ShiftHandoverEntriesService` or a sibling `ShiftHandoverCronService`.

### Phase 2 — Definition of Done

- [ ] `ShiftHandoverModule` registered in `app.module.ts`
- [ ] All 4 services implemented + DI-wired
- [ ] Controller with all 13 endpoints + `my-permissions`
- [ ] Permission registrar registered (2 new modules under `shift_planning`)
- [ ] Addon-check on every controller endpoint (`AddonCheckService.checkTenantAccess(tid, 'shift_planning')`)
- [ ] `db.tenantTransaction()` for all tenant-scoped queries; `db.systemTransaction()` only inside the cron sweep
- [ ] Services return raw data (ADR-007); no manual `{success, data}` wrapping
- [ ] Cron job for auto-lock sweep (`@Cron('0 */6 * * *')`) — time-injected `runAutoLockSweep(nowUtc)`
- [ ] Audit-log entries for: template upsert/delete, entry submit/reopen (via `ActivityLoggerService`)
- [ ] Shared `@assixx/shared/shift-handover` module built: `shared/package.json` exports entry present, `pnpm --filter @assixx/shared build` produces `shared/dist/shift-handover/`, both backend + frontend type-check resolve the import (R14)
- [ ] No `any`, `??` not `||`, explicit boolean checks, `getErrorMessage()` for catches
- [ ] ESLint 0 errors: `docker exec assixx-backend pnpm exec eslint backend/src/nest/shift-handover/`
- [ ] Type-check 0 errors: `docker exec assixx-backend pnpm run type-check`
- [ ] All DTOs use Zod + `createZodDto()` pattern
- [ ] All param DTOs use `createIdParamSchema` factory (per TS-Standards §7.5)
- [ ] No `@Roles('admin','root')` on any mutation endpoint (ADR-045 compliance)

---

## Phase 3: Unit Tests

> **Dependency:** Phase 2 complete.
> **Pattern:** existing `*.service.test.ts` files in adjacent modules.

### Test files

```
backend/src/nest/shift-handover/
  shift-handover-templates.service.test.ts        # ~20 tests
  shift-handover-entries.service.test.ts          # ~30 tests
  active-shift-resolver.service.test.ts           # ~15 tests
  shift-handover-attachments.service.test.ts      # ~10 tests
shared/src/shift-handover/
  field-validators.test.ts                        # ~10 tests (one per field type + edge)
```

### Mandatory scenarios

**Template service:**

- [ ] Upsert with new fields → row inserted
- [ ] Upsert existing → row updated, `updated_by` set
- [ ] Duplicate field-key → BadRequestException
- [ ] > 30 fields → BadRequestException
- [ ] Invalid field-key (uppercase, starts-with-digit) → BadRequestException
- [ ] `select` field without options → BadRequestException
- [ ] Tenant isolation: tenant A cannot read tenant B template

**Entries service:**

- [ ] `getOrCreateDraft` happy path
- [ ] `getOrCreateDraft` for non-assignee → ForbiddenException
- [ ] `submitEntry` snapshots schema correctly (drift safety R2)
- [ ] `submitEntry` parallel calls → one succeeds, other ConflictException (R3)
- [ ] `updateDraft` on submitted entry → BadRequestException ("entry locked")
- [ ] `reopenEntry` by non-Team-Lead → ForbiddenException
- [ ] `reopenEntry` by Team-Lead → audit log entry written
- [ ] `runAutoLockSweep` locks drafts past `shiftEnd + 24h`, leaves recent drafts alone
- [ ] Tenant + team isolation on `listEntriesForTeam`

**Active-shift resolver (R1, R5):**

- [ ] `canWriteForShift` matrix: 4 cases (today early/late OK, today night OK, yesterday night still in window OK, yesterday early NOT OK)
- [ ] Night shift over midnight: assignee opens at 23:30 AND 03:00 next day → both true
- [ ] Non-assignee → false
- [ ] Date in future → false
- [ ] Empty assignee list → false

**Field validators (shared):**

- [ ] One happy + one failure case per field type (8 types × 2 = 16, prune duplicates)

**Attachments service:**

- [ ] 6th attachment → BadRequestException (5 cap)
- [ ] Wrong mime type → BadRequestException
- [ ] > 10 MB file → BadRequestException
- [ ] Delete on submitted entry → BadRequestException

### Phase 3 — Definition of Done

- [ ] ≥75 unit tests total
- [ ] All green: `docker exec assixx-backend pnpm exec vitest run backend/src/nest/shift-handover/ shared/src/shift-handover/`
- [ ] Every ConflictException / BadRequestException / ForbiddenException path covered
- [ ] R1, R2, R3, R5 explicitly covered (one named test per risk)
- [ ] Coverage: every public service method has ≥1 test

---

## Phase 4: API Integration Tests

> **Dependency:** Phase 3 complete.
> **Pattern:** `backend/test/*.api.test.ts` per HOW-TO-TEST-WITH-VITEST.md.

### Test file

`backend/test/shift-handover.api.test.ts`

### Scenarios (≥25 assertions)

**Auth & addon gate:**

- [ ] Unauthenticated → 401
- [ ] Tenant without `shift_planning` addon → 403

**Template CRUD:**

- [ ] PUT template as Team-Lead → 200
- [ ] PUT template as Employee (no Lead) → 403
- [ ] PUT template as Admin (hasFullAccess=false, no Lead) → 403
- [ ] PUT template as Admin (hasFullAccess=true) → 200
- [ ] DELETE template as Team-Lead → 200
- [ ] GET template as any team-member → 200

**Entry lifecycle:**

- [ ] POST entry as assignee → 201 (draft created)
- [ ] POST entry as non-assignee → 403
- [ ] PATCH draft as assignee → 200
- [ ] POST submit as assignee → 200, status='submitted'
- [ ] PATCH submitted entry → 400 ("locked")
- [ ] POST reopen as Team-Lead → 200
- [ ] POST reopen as Employee → 403

**Attachments:**

- [ ] Upload 5 images → 201 each
- [ ] Upload 6th → 400
- [ ] Stream image as same-team → 200
- [ ] Stream image as cross-team Employee → 403
- [ ] Stream image as Root → 200

**RLS / tenant isolation:**

- [ ] Tenant A creates entry → Tenant B GET → empty list (not 404, RLS-filtered)

**Read scope:**

- [ ] Team-A Employee lists entries → only sees Team-A entries
- [ ] Admin (hasFullAccess) lists → sees all teams in tenant

### Phase 4 — Definition of Done

- [ ] ≥25 API integration tests
- [ ] All green
- [ ] Tenant isolation verified
- [ ] Addon gating verified
- [ ] Permission matrix from ADR-045 verified end-to-end (Lead vs Member vs Admin vs Root, with/without hasFullAccess)
- [ ] Pagination verified on list endpoint

---

## Phase 5: Frontend

> **Dependency:** Phase 2 endpoints available (Phase 3+4 not strictly blocking, but recommended).
> **Reference:** `frontend/src/routes/(app)/(shared)/shifts/` for grid integration, `inventory/` for image upload UI.

### Route structure

```
frontend/src/routes/(app)/
  (shared)/
    shifts/
      _lib/
        ShiftHandoverButton.svelte        # 📋 button per shift cell
        ShiftHandoverModal.svelte         # opens on button click
        ShiftHandoverFieldRenderer.svelte # renders one custom field by type
        api-shift-handover.ts             # apiClient wrappers
      +page.svelte                        # MODIFIED — wire button into grid
      +page.server.ts                     # MODIFIED — load template + my-permissions
  (shared)/                                # OR (admin)/ — discuss in Step 5.0
    shift-handover-templates/
      +page.svelte                        # team-filter + field-builder
      +page.server.ts                     # load templates + canManage check
      _lib/
        FieldBuilder.svelte               # add/edit/reorder/delete fields
        FieldTypeSelector.svelte          # the 8 type options
        api-templates.ts
        state-templates.svelte.ts
```

### Step 5.0: Decide template page route group [PENDING]

**Question:** `(shared)` (Team-Leads = Employees with lead role can access) or `(admin)` (only `admin`/`root` route group)?

**Recommendation:** `(shared)` because Team-Lead can be `role='employee'` per ADR-035. Layer-1 gate (`canManage`) inside `+page.server.ts` does the actual access check. ADR-012 route groups are coarse — `(shared)` allows Employee + Admin + Root; finer gating is page-level. Lock decision before Step 5.1.

### Step 5.1: ShiftHandoverButton + Modal in shifts grid [PENDING]

- 📋 icon button rendered per shift cell. Color states:
  - Grey: no entry yet
  - Yellow: draft exists
  - Green: submitted
  - Red border: required custom fields missing on draft past shift-end
- Click → opens `ShiftHandoverModal` with `(teamId, shiftDate, shiftKey)` context
- Modal calls `POST /shift-handover/entries` (idempotent: returns existing draft or creates)
- Modal renders:
  - Auto-prefilled meta: date, KW, shift-slot, team, assignee names (read-only)
  - Free-text "Protokoll" textarea
  - Custom fields rendered via `ShiftHandoverFieldRenderer` (one component, switch on type)
  - Image upload (5 max) — reuse Inventory component if §0.7 said so
  - Buttons: "Speichern (Entwurf)" + "Übergabe abschließen"
- Read-only mode if user is not assignee + not Lead, or if status='submitted' (and user not Lead-with-reopen-rights)

### Step 5.2: Template config page [PENDING]

- Team filter at top (same UX as shift filters per ADR-034 hierarchy labels: `${labels.team}`)
- For selected team: render `FieldBuilder`
  - List of existing fields with drag-handle, edit, delete
  - "+ Feld hinzufügen" button → `FieldTypeSelector` modal
  - Per field: `key` (auto-derived from label, editable), `label`, `type`, `is_required`, `options[]` if `select`
  - Live JSON-preview optional
- Save → `PUT /shift-handover/templates/:teamId`
- Inline validation: duplicate keys, invalid identifiers, select without options

### Step 5.3: Read-view (entry detail / list) [PENDING]

- Could be a side-panel in shifts page (Step 5.1 modal in read-mode) OR a dedicated `/shift-handover` list page. **Recommendation:** side-panel only in V1; dedicated list page = V2 if requested.
- Renders custom fields against `schema_snapshot` (NOT live template) — proves R2 mitigation works.

### Mandatory frontend patterns

- [ ] `apiClient.get<T>()` returns DATA directly (Kaizen — no `{success, data}` wrap)
- [ ] Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`)
- [ ] `+page.server.ts` checks token + `requireAddon(activeAddons, 'shift_planning')`
- [ ] Hierarchy labels from `data.hierarchyLabels` (ADR-034 prop-threading)
- [ ] `canManageShiftHandoverTemplates` wrapper in `_lib/navigation-config.ts` (ADR-045)
- [ ] German UI strings (ä/ö/ü/ß), English code comments
- [ ] No top-level `window`/`document` (svelte/no-top-level-browser-globals)
- [ ] All session-expired errors via centralized `$lib/utils/session-expired.ts`

### Phase 5 — Definition of Done

- [ ] Shift grid renders 📋 button per cell with correct status color
- [ ] Modal opens, prefills meta, allows draft → submit flow
- [ ] Template config page allows Team-Lead to add/edit/delete/reorder fields
- [ ] All 8 field types render correctly in entry modal
- [ ] Image upload (5 cap) works
- [ ] Read-only mode renders against `schema_snapshot` for submitted entries
- [ ] Sidebar entry "Übergabe-Templates" appears as a submenu child of the "Schichtplanung" entry only if `canManageShiftHandoverTemplates` AND `shift_planning` addon is active
- [ ] svelte-check 0 errors, 0 warnings: `cd frontend && pnpm run check`
- [ ] ESLint 0 errors: `cd frontend && pnpm run lint`
- [ ] Hierarchy labels used everywhere `team`/`area` appears
- [ ] Manual smoke test: log in as Team-Lead, configure template (each field type), log in as Employee-assignee, write + submit handover, log out, log in as next-shift assignee, view submitted handover

---

## Phase 6: Integration + Polish + ADR

> **Dependency:** Phase 5 complete.

### Integrations

- [ ] Shift-grid button wired (Phase 5.1)
- [ ] Audit-log entries via `ActivityLoggerService` for: template upsert/delete, entry submit, entry reopen
- [ ] Sidebar nav: "Schichtplanung" top-level entry promoted to submenu; "Übergabe-Templates" child visible iff `canManageShiftHandoverTemplates` AND addon active (via `applyShiftHandoverVariant` + `addonCode`)
- [ ] `FEATURES.md` updated with new permission modules under `shift_planning` addon
- [ ] Customer fresh-install synced: `./scripts/sync-customer-migrations.sh`

### Documentation

- [ ] ADR `ADR-XXX-shift-handover-protocol.md` written:
  - Decision: per-shift-slot granularity
  - Decision: JSONB + schema_snapshot (drift-safety pattern)
  - Decision: active-shift-resolver as pure function
  - Decision: Inventory image-pattern reuse vs adapt
  - Why no notifications in V1
  - Why no backfill
- [ ] This masterplan updated with §Z post-mortem

### Phase 6 — Definition of Done

- [ ] All integrations live and tested end-to-end
- [ ] ADR written + cross-referenced in `docs/infrastructure/adr/README.md`
- [ ] `FEATURES.md` updated
- [ ] Customer fresh-install synced
- [ ] No open TODOs in code
- [ ] Final smoke test green
- [ ] `pnpm run validate:all` green

---

## Session Tracking

| Session | Phase | Description                                                                   | Status  | Date       |
| ------- | ----- | ----------------------------------------------------------------------------- | ------- | ---------- |
| 1       | 0     | §0.7 Inventory spike + §0.8 slot-identity spike + risk register sign-off      | ✅ DONE | 2026-04-22 |
| 2       | 1     | Migrations: templates + entries (+ attachments if adapt); uuidv7() verified   | ✅ DONE | 2026-04-22 |
| 3       | 2     | Module skeleton + DTOs + shared field schemas + `shared/package.json` exports | ✅ DONE | 2026-04-22 |
| 4       | 2     | TemplatesService + ActiveShiftResolver (uses §0.8 spike output)               | ✅ DONE | 2026-04-22 |
| 5       | 2     | EntriesService + AttachmentsService                                           | ✅ DONE | 2026-04-22 |
| 6       | 2     | Controller + permission registrar + cron auto-lock                            | PENDING |            |
| 7       | 3     | Unit tests (≥75)                                                              | PENDING |            |
| 8       | 4     | API integration tests (≥25)                                                   | PENDING |            |
| 9       | 5     | Shift-grid button + modal                                                     | PENDING |            |
| 10      | 5     | Template config page + FieldBuilder                                           | PENDING |            |
| 11      | 5     | Navigation promotion (Schichtplanung → submenu) + `applyShiftHandoverVariant` | PENDING |            |
| 12      | 5     | Read-view + manual smoke test                                                 | PENDING |            |
| 13      | 6     | ADR + docs + customer sync + final smoke test                                 | PENDING |            |

### Session log template

```markdown
### Session N — YYYY-MM-DD

**Goal:** {what should be achieved}
**Result:** {what was actually achieved}
**New files:** {list}
**Changed files:** {list}
**Verification:**

- ESLint: {0 errors / N → fixed}
- Type-check: {0 errors}
- Tests: {N / N passed}
  **Deviations:** {differed from plan + why}
  **Next session:** {what comes next}
```

---

## Quick Reference: File Paths

### Backend (new)

| File                                                                     | Purpose                               |
| ------------------------------------------------------------------------ | ------------------------------------- |
| `backend/src/nest/shift-handover/shift-handover.module.ts`               | NestJS module                         |
| `backend/src/nest/shift-handover/shift-handover.controller.ts`           | REST controller                       |
| `backend/src/nest/shift-handover/shift-handover-templates.service.ts`    | Template CRUD                         |
| `backend/src/nest/shift-handover/shift-handover-entries.service.ts`      | Entry lifecycle (heart)               |
| `backend/src/nest/shift-handover/active-shift-resolver.service.ts`       | Pure-function shift assignee resolver |
| `backend/src/nest/shift-handover/shift-handover-attachments.service.ts`  | Image upload (per §0.7 decision)      |
| `backend/src/nest/shift-handover/shift-handover-permission.registrar.ts` | OnModuleInit registrar                |
| `backend/src/nest/shift-handover/shift-handover.types.ts`                | All interfaces                        |
| `backend/src/nest/shift-handover/dto/*.ts`                               | DTOs (Zod)                            |

### Shared (new)

| File                                            | Purpose                                 |
| ----------------------------------------------- | --------------------------------------- |
| `shared/src/shift-handover/index.ts`            | Barrel export (matches ADR-015 pattern) |
| `shared/src/shift-handover/field-types.ts`      | Enum + Zod FieldDef schema              |
| `shared/src/shift-handover/field-validators.ts` | `buildEntryValuesSchema(fields[])`      |

### Backend (modified)

| File                             | Change                             |
| -------------------------------- | ---------------------------------- |
| `backend/src/nest/app.module.ts` | `ShiftHandoverModule` import added |

### Shared (modified)

| File                  | Change                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `shared/package.json` | Add `"./shift-handover"` conditional-exports block per ADR-015 §2. Run `build` after (R14). |

### Database (new)

| File                                                                           | Purpose           |
| ------------------------------------------------------------------------------ | ----------------- |
| `database/migrations/{ts}_create-shift-handover-templates.ts`                  | Templates table   |
| `database/migrations/{ts+1}_create-shift-handover-entries.ts`                  | Entries table     |
| `database/migrations/{ts+2}_create-shift-handover-attachments.ts` _(if adapt)_ | Attachments table |

### Frontend (new)

| Path                                                                                   | Purpose                        |
| -------------------------------------------------------------------------------------- | ------------------------------ |
| `frontend/src/routes/(app)/(shared)/shifts/_lib/ShiftHandoverButton.svelte`            | 📋 grid button                 |
| `frontend/src/routes/(app)/(shared)/shifts/_lib/ShiftHandoverModal.svelte`             | Entry modal                    |
| `frontend/src/routes/(app)/(shared)/shifts/_lib/ShiftHandoverFieldRenderer.svelte`     | One custom field renderer      |
| `frontend/src/routes/(app)/(shared)/shifts/_lib/api-shift-handover.ts`                 | apiClient wrappers             |
| `frontend/src/routes/(app)/(shared)/shift-handover-templates/+page.svelte`             | Config page                    |
| `frontend/src/routes/(app)/(shared)/shift-handover-templates/+page.server.ts`          | SSR + canManage gate           |
| `frontend/src/routes/(app)/(shared)/shift-handover-templates/_lib/FieldBuilder.svelte` | Add/edit/reorder/delete fields |

### Frontend (modified)

| File                                                        | Change                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/routes/(app)/(shared)/shifts/+page.svelte`    | Wire 📋 button per shift cell                                                                                                                                                                                                                                                                                                                                                                         |
| `frontend/src/routes/(app)/(shared)/shifts/+page.server.ts` | Load template + my-permissions                                                                                                                                                                                                                                                                                                                                                                        |
| `frontend/src/routes/(app)/_lib/navigation-config.ts`       | Add `canManageShiftHandoverTemplates` wrapper (alias of `canManage`, next to `canManageSurveys`/`canManageBlackboard`); promote the two `/shifts` flat entries (L510, L661) to submenus with a new "Übergabe-Templates" child (`addonCode: 'shift_planning'`); add `applyShiftHandoverVariant()` filter mirroring `applySurveysVariant` and call it after `filterMenuByAddons` in the layout pipeline |

---

## Spec Deviations

| #   | Spec says                                                                                                                   | Actual                                                                                                                                                                                                           | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | §0.1: Branch `feat/shift-handover` checked out from `test/ui-ux` before Session 2 start                                     | Session 2 begins on `test/ui-ux` itself                                                                                                                                                                          | **2026-04-22:** User elected to continue migration work on the current `test/ui-ux` branch rather than fork a dedicated feature branch. DB state is branch-independent — migration applies identically either way. Consequence: if a dedicated PR is later desired, user will handle branch split (cherry-pick / rebase / branch rename) outside this plan's scope.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2   | §2.1 + §2.7: Registrar file registers a new `PermissionCategoryDef` via `OnModuleInit`, following Surveys/Inventory pattern | Registrar uses `OnApplicationBootstrap` to **append** modules to the existing `shift_planning` category via a new `PermissionRegistryService.addModulesToCategory()` method (additive extension of the registry) | **2026-04-22 (Session 3):** The two new modules (`shift-handover-templates`, `shift-handover-entries`) must live under the `shift_planning` addon (plan §2.6 / §2.7 require controllers to call `@RequirePermission(SHIFT_PLANNING_ADDON, ...)`). Registry categories are keyed by code and `register()` throws on duplicates, so registering a parallel category would crash; merging via a single shared `PermissionCategoryDef` literal would invert the dependency (shifts → shift-handover). Chosen mitigation: extend `PermissionRegistryService` with an idempotent append method, fire it from `OnApplicationBootstrap` (guaranteed to run after every `OnModuleInit`, avoiding fragile init-order coupling). Runtime-verified: base category registers with 4 modules, then `Extended permission category "shift_planning" with 2 module(s)` — zero exceptions. |

---

## Known Limitations (V1 — deliberately excluded)

1. **No notifications.** Next-shift user must open the shift grid to see the badge. SSE/email = V2 if user demand.
2. **No backfill.** Today only. Forgotten handovers stay forgotten unless Team-Lead re-opens after the fact (which is not the same as backfilling — re-open requires existing entry).
3. **No template versioning.** Template edit overwrites in place. Submitted entries are protected by `schema_snapshot` (R2). If audit/rollback of template changes becomes a need → V2.
4. **No cross-team read in V1 for non-admins.** Only same team + Admin/Root.
5. **No dedicated handover list page.** Read-view is the modal in the shift grid only. Listing/searching all handovers across dates = V2.
6. **No PDF/CSV export.** V2 if compliance asks.
7. **No "received by" acknowledgement workflow.** Next shift cannot mark "I read this". V2.
8. **No reminders.** Cron does NOT poke users; only locks abandoned drafts.
9. **No photo annotation/markup.** Plain image upload, no drawing tools.
10. **Image storage backend** = whatever Inventory uses (locked in §0.7); not separately decided.
11. **Tenant shift_key customisation unsupported.** V1 hard-locks `shift_handover_entries.shift_key` to `('early','late','night')` via DB CHECK (R13). Tenants using custom `shift_times.shift_key` values (e.g. `'F','S','N'`, `'morgen','mittag','nacht'`) cannot use handover until V2 relaxes the CHECK. V2 path: drop the CHECK, add a composite foreign-key-ish app-layer validator against `shift_times`, migrate any V1 data.
12. **No cross-entry custom-field reporting (JSONB-vs-EAV, R12).** V1 uses JSONB for `custom_values` + `schema_snapshot`. That means no typed aggregation like "average rating across last 30 handovers". If reporting lands on the roadmap, the new ADR's §"Why JSONB not EAV" is the re-entry point — the migration to EAV is documented as a V2 cost.
13. **Europe/Berlin only.** The active-shift time window (R5) assumes tenants operate in Europe/Berlin. Multi-TZ tenants not supported in V1; would require a per-tenant TZ column.
14. **Inventory photo module is not shared infrastructure.** V1 copies the controller+service pattern from `backend/src/nest/inventory/` (ADAPT decision, §0.7) — 2 independent upload paths for 1 architectural concern (photo attachments on a tenant-scoped entity). Combined with the 7 other existing upload flows (users, documents, blackboard, kvp, chat, work-orders, tpm), this makes 9 controllers that each re-implement the same pattern. Extraction to a shared `AttachmentsModule` with polymorphic FK (`entity_type`, `entity_id`) is the future-right refactor but is explicitly deferred: not justified for 2 consumers alone, and would block this feature plan by ≥1 PR. **V2 cost:** one refactor PR to extract shared module, migrate both Inventory + Handover off their dedicated tables; estimated ~2 sessions.

---

## References & Standards Cross-Cut

> Authoritative docs every contributor to this plan must consult. Listed by which phase needs them.

### Architecture Decisions (ADRs)

| ADR     | Title                                 | Where it touches this plan                                                                                                                                                   |
| ------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-005 | Authentication Strategy               | JwtAuthGuard sets CLS context on every request (Phase 2 controller)                                                                                                          |
| ADR-006 | Multi-Tenant Context Isolation        | `ClsService` propagates tenantId; services use `cls.get('tenantId')` (Phase 2)                                                                                               |
| ADR-007 | API Response Standardization          | Services return raw data; ResponseInterceptor wraps. NO manual `{success, data}` wrap.                                                                                       |
| ADR-009 | Central Audit Logging Architecture    | Audit-trail = automatic via global interceptor. Activity logs (root dashboard) via `ActivityLoggerService` after every mutation.                                             |
| ADR-010 | User Role Assignment & Permissions    | `hasFullAccess`, `team_lead_id`, role hierarchy — feeds `canManage` (Phase 5)                                                                                                |
| ADR-011 | Shift Data Architecture & Sync        | **Active-shift resolver MUST query both `shifts` AND `shift_rotation_history`.** R9.                                                                                         |
| ADR-012 | Frontend Route Security Groups        | `(shared)` vs `(admin)` decision in §5.0 — `(shared)` chosen (Layer-1 page-level gate).                                                                                      |
| ADR-014 | Database & Migration Architecture     | Migration discipline: generator-only, 17-digit UTC timestamp, dry-run, backup, RLS, GRANTs (Phase 1)                                                                         |
| ADR-015 | Shared Package Architecture           | Conditional exports for `@assixx/shared/shift-handover`; `shared/dist/` build dependency before Vite dev (R14, Phase 2.1)                                                    |
| ADR-018 | Testing Strategy (Unit + API)         | Tier-1 unit tests in `src/nest/.../*.test.ts`, Tier-2 API in `backend/test/*.api.test.ts`                                                                                    |
| ADR-019 | Multi-Tenant RLS Data Isolation       | **Strict-mode policy template** (no bypass clause). Triple-User-Model GRANTs. R10.                                                                                           |
| ADR-020 | Per-User Feature Permission Control   | Two new permission modules: `shift-handover-templates`, `shift-handover-entries`                                                                                             |
| ADR-024 | Frontend Feature Guards               | `requireAddon('shift_planning')` in `+page.server.ts`                                                                                                                        |
| ADR-030 | Zod Validation Architecture           | All DTOs via `createZodDto()`. Shared field-validators module. (Phase 2.1)                                                                                                   |
| ADR-033 | Addon-based SaaS Model                | Part of `shift_planning` addon. `tenant_addons` gate via `AddonCheckService`.                                                                                                |
| ADR-034 | Hierarchy Labels Propagation          | `${labels.team}` in page titles, modal headers (Phase 5)                                                                                                                     |
| ADR-035 | Organizational Hierarchy & Assignment | `orgScope.isAnyLead` for `canManage` Layer-1 (Phase 5)                                                                                                                       |
| ADR-036 | Organizational Scope Access Control   | Lead-scope determines who is "team-lead" for re-open right                                                                                                                   |
| ADR-039 | Per-Tenant Deputy Scope Toggle        | Deputy-merge into `isAnyLead` is automatic — no special-casing in this plan.                                                                                                 |
| ADR-040 | Inventory Addon Architecture          | §0.7 spike anchor. `inventory_item_photos` table shape, EAV-vs-JSONB divergence (R12).                                                                                       |
| ADR-041 | TypeScript Compiler Configuration     | Strict-everywhere; `consistent-type-imports` for non-decorator files                                                                                                         |
| ADR-042 | Multipart File Upload Pipeline        | **Canonical 3-layer upload stack.** `MulterFile` type, `diskStorage`. R11. Note: ADR-042 text says `main.ts:99` — stale; actual line is 175. Sibling commit updates the ADR. |
| ADR-045 | Permission & Visibility Design        | 3-Schichten Permission Stack: Addon-Gate → `canManage` → Action-Permission. NO `@Roles` on mutations.                                                                        |

### HOW-TO Guides

| Guide                       | Where it touches this plan                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HOW-TO-INTEGRATE-FEATURE    | End-to-end DoD checklist (DB, Backend, Frontend, Testing, Docs). Phase 6 verification.                                                                         |
| HOW-TO-PLAN-SAMPLE          | This template. Plan-type=FEATURE.                                                                                                                              |
| HOW-TO-TEST-WITH-VITEST     | Phase 4 API tests. **Fastify quirk:** `authHeaders(token)` for body requests, `authOnly(token)` for non-body. `loginApitest()` from `backend/test/helpers.ts`. |
| HOW-TO-CREATE-TEST-USER     | Reference if test tenant needs fresh user setup                                                                                                                |
| DATABASE-MIGRATION-GUIDE.md | Phase 1 source of truth. Strict ADR-019 RLS template overrides HOW-TO-INTEGRATE-FEATURE §1.2 outdated bypass-clause template (R10).                            |
| TYPESCRIPT-STANDARDS.md     | All Phase 2/3/5 code. `IS_ACTIVE` constants, `getErrorMessage()`, `createIdParamSchema` factory.                                                               |
| CODE-OF-CONDUCT.md          | Power of Ten: 60 LOC/fn, complexity ≤10, max-lines 900. Enforced by ESLint.                                                                                    |
| CODE-OF-CONDUCT-SVELTE.md   | Phase 5: Svelte 5 runes only, no Svelte 4 stores, no `on:click` (use `onclick`).                                                                               |
| ZOD-INTEGRATION-GUIDE.md    | All DTOs (Phase 2.1). Shared schemas in `dto/common.dto.ts`.                                                                                                   |

### Frontend SSR vs Browser API clients (per HOW-TO-INTEGRATE-FEATURE §3.2)

Two different helpers for two different contexts — do not mix.

```typescript
// ─── +page.server.ts (SSR only) ───────────────────────────────
// Uses fetch() with server-side cookie propagation + envelope unwrap + error log.
import { apiFetch } from '$lib/server/api-fetch';
// ─── +page.svelte / .svelte.ts (browser only) ────────────────
// Singleton client with retry/session-expired handling.
import { apiClient } from '$lib/utils/api-client';
```

- Do **not** import `apiClient` from `+page.server.ts` (no browser runtime).
- Do **not** import `apiFetch` from `+page.svelte` (no server context).
- Both return raw data (ADR-007 envelope unwrap handled internally). Never write a local `fetch().then(r => r.json())` duplicate.

### Frontend Sidebar (corrected 2026-04-22 — real architecture)

**Verified reality of `frontend/src/routes/(app)/_lib/navigation-config.ts`:**

- There are **no** `rootMenuItems`/`adminMenuItems`/`employeeMenuItems` arrays. That claim in v0.1.0 was wrong.
- Dispatcher: `getMenuItemsForRole(role, …)` at line 731.
- Shape: SUBMENU constants (e.g. `BLACKBOARD_SUBMENU` at L75) + per-role builder functions that assemble `NavItem[]` per the current role.
- "Schichtplanung" today is a **flat top-level link** to `/shifts` at L510 (root builder) and L661 (non-root builder), **not** a submenu. German label is **"Schichtplanung"**, not "Schichtplan".
- Post-filter pipeline: `filterMenuByAccess(items, hasFullAccess)` → `filterMenuByAddons(items, activeAddons)` → `filterMenuByScope(items, orgScope)` → `applySurveysVariant(items, canManage)`. Each step is pure.
- `canManage(role, hasFullAccess, isAnyLead)` at L970 plus lesbarkeits wrappers `canManageSurveys`/`canManageBlackboard` (L985/L996) is the ADR-045 template for adding new wrappers.

**Wiring the "Übergabe-Templates" sub-entry:**

1. Promote the two existing flat `/shifts` entries (L510, L661) to submenus:
   - Each becomes a `NavItem` with `submenu: SHIFT_SUBMENU` instead of `url: '/shifts'`.
   - Default first sub-entry: `{ id: 'shift-plan', label: 'Schichtplanung', url: '/shifts', badgeType: 'shiftSwap' }` (preserves badge + URL).
   - New sub-entry: `{ id: 'shift-handover-templates', label: 'Übergabe-Templates', url: '/shift-handover-templates', addonCode: 'shift_planning' }`. Only rendered if `canManageShiftHandoverTemplates` passes the `applyShiftHandoverVariant()` filter (see next step).
2. Add a **new** `canManageShiftHandoverTemplates = canManage;` wrapper next to `canManageSurveys`/`canManageBlackboard` (L985–996 region). Pure alias, same signature.
3. Add a new filter step `applyShiftHandoverVariant(items, canManage)` following the exact pattern of `applySurveysVariant` (L1005). It swaps the "Übergabe-Templates" sub-entry in or out based on the predicate; a no-op if the Schichtplanung entry is missing (e.g. addon filtered it earlier).
4. Call it in the layout pipeline **after** `filterMenuByAddons` (so if `shift_planning` addon is off, the submenu disappears entirely before we try to expand it).
5. Addon gating is free: the `addonCode: 'shift_planning'` on the sub-entry means `filterMenuByAddons` strips it if the addon is inactive even for Root. Do not special-case.

**What NOT to do:**

- Do not introduce a role-array pattern. The filter-chain pattern is load-bearing.
- Do not hard-code the sub-entry inside `BLACKBOARD_SUBMENU` or any unrelated constant.
- Do not bypass `filterMenuByAddons` by skipping `addonCode`.

### Frontend Breadcrumb (per HOW-TO-INTEGRATE-FEATURE §3.6)

Add to `frontend/src/lib/components/Breadcrumb.svelte`:

- `urlMappings`: `/shift-handover-templates → { label: 'Übergabe-Templates', icon: 'fa-clipboard-list' }`
- `intermediateBreadcrumbs`: `/shift-handover-templates → { label: 'Schichtplanung', url: '/shifts', icon: 'fa-calendar' }`

### KISS-Gate Verification (ADR-049)

- [ ] No endpoint in this plan creates a user (`INSERT INTO users`). KISS-Gate `assertVerified(tenantId)` is **N/A**. No allowlist edit needed.

---

## Post-Mortem (fill after completion)

### What went well

- {tbd}

### What went badly

- {tbd}

### Metrics

| Metric                   | Planned | Actual |
| ------------------------ | ------- | ------ |
| Sessions                 | 13      |        |
| Migration files          | 2–3     |        |
| New backend files        | ~14     |        |
| New shared files         | 3       |        |
| New frontend files       | ~8      |        |
| Changed files            | ~6      |        |
| Unit tests               | ≥75     |        |
| API tests                | ≥25     |        |
| ESLint errors at release | 0       |        |
| Spec deviations          | 0       |        |

---

**This document is the execution plan. No coding starts until §0 sign-off + §0.7 spike are green. Every session starts here, takes the next unchecked item, and marks it done.**
