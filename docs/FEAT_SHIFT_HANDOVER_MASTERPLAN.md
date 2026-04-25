# FEAT: Shift Handover Protocol — Execution Masterplan

> **Plan type:** FEATURE
> **Created:** 2026-04-21
> **Version:** 0.19.0 (Session 19 — Schlüssel-Input hidden in FieldBuilder; keys now fully auto-derived via `deriveUniqueKey` with duplicate-disambiguation + `'feld'` fallback; `updateKey`/`setKey` stranded code removed; grid template adjusted 4-col → 3-col; svelte-check 0/0/2579, ESLint 0)
> **Status:** IMPLEMENTATION COMPLETE — Sessions 1-13 ✅ DONE for code + documentation. Two residual user-owned items before closing the masterplan: (a) run `./scripts/sync-customer-migrations.sh` to sync fresh-install schema/seeds, (b) execute the 7-stage manual smoke test in §Manual Smoke Test and tick the final Phase-5 DoD checkbox.
> **Branch:** `feat/shift-handover` (to be created from `test/ui-ux` once approved)
> **Spec:** This document. No external spec — captured from product owner conversation 2026-04-21.
> **Author:** Simon Öztürk
> **Estimated sessions:** 12–14 (added §0.8 slot-identity spike)
> **Actual sessions:** 13 / 13

---

## Changelog

| Version | Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.16.0  | 2026-04-23 | **Session 13 — Phase 6 docs + ADR shipped.** Four documentation artefacts + one drift-fix. (1) **`docs/infrastructure/adr/ADR-052-shift-handover-protocol.md`** (~260 LOC) — Accepted 2026-04-23, references 10 related ADRs. Six decisions covered per plan §Documentation: (§1) per-shift-slot granularity with composite UNIQUE `(tenant_id, team_id, shift_date, shift_key)` — rejected per-day (destroys per-crew authorship) and per-team (breaks schema_snapshot); (§2) JSONB + schema_snapshot with hard copy on submit — rejected relational-per-field table (JOIN explosion) and live-template reads (compliance-fatal); (§3) ActiveShiftResolver as pure function with injected `SHIFT_HANDOVER_CLOCK` + SQL-resident TZ math — 17 unit tests + 8 DST matrix cases; (§4) Inventory image pattern ADAPTED not reused — shape-coupling rationale, Known Limitation #14 tracks future extraction; (§5) no V1 notifications — latency-insensitive use case, V2 cost; (§6) no historical backfill — legacy data quality unknowable, schema_snapshot contract would be compromised. Architecture diagram, 3-layer permission model (ADR-045 stack), 7 Alternatives-Considered entries, 8 positive consequences + 6 negative + 6 risks/mitigations table, 5-tier verification summary. (2) **`docs/infrastructure/adr/README.md`**: ADR-052 row appended to the index (ADRs 050 + 051 remain unlisted in README — that drift predates this work and is flagged out-of-scope). (3) **`docs/FEATURES.md`**: new numbered `#### 15. Schichtübergabe-Protokoll (Shift Handover)` entry under "Live Features (Production Ready)" — lists the two new permission modules (`shift-handover-templates` + `shift-handover-entries`), the 8 field types, the 24h auto-lock cron, the sidebar submenu promotion from Session 11, and the test-count line (95 unit + 39 API). (4) **`frontend/src/lib/components/breadcrumb-config.ts`**: two entries added per plan §References — `staticUrlMappings['/shift-handover-templates']` = `{ label: 'Übergabe-Templates', icon: 'fa-clipboard-list' }`, `intermediateBreadcrumbs['/shift-handover-templates']` = `{ label: 'Schichtplanung', href: '/shifts', icon: 'fa-calendar' }` (plan spec used `url`, actual local convention is `href` — file-convention wins). Parent crumb label "Schichtplanung" matches the Session-11 sidebar submenu promotion; intermediate `href` points back to the shift grid. **(5) Drift fix — Session 10 regression:** `pnpm run validate:all` caught `state-templates.svelte.ts:309 — Function 'createTemplateBuilderState' has too many lines (65). Maximum allowed is 60` — the factory had grown past the ESLint cap since Session 10's documented "~50 LOC" baseline (likely via cumulative Prettier reformatting during Sessions 11-12 — every getter got re-expanded to 3-line form). Initial fix attempt (single-line getters) was reverted by Prettier on save. Final fix: extract the 13 mutator methods into a new top-level `buildTemplateBuilderMutators(acc: BuilderAccessors)` helper that receives a closure accessor bag (`getFields` as a function, `setFields` + `setInitial` as setters) so Svelte 5 $state reassignment stays correct across the factory/helper boundary. Factory now reads as `state vars → derived → buildMutators(closures) → return { getters, ...mutators }` — 27 counted lines, well under 60. Accessor-closure pattern chosen over passing the live array reference because `setInitial` reassigns `fields` to a new proxy; captured references would go stale. (6) **Verification**: `pnpm run validate:all` → format → lint → type-check → svelte-check (2652/0/0) → stylelint all green → `=== VALIDATE ALL PASSED ===`. Audit-log wiring verified by inspection (not a new edit): `ShiftHandoverEntriesService` L475+L486 log submit + reopen; `ShiftHandoverController` L168+L189 log template upsert + delete — all 4 Phase-6 audit-log DoD events wired during Sessions 5-6. No open TODO/FIXME/XXX in any shift-handover source file (grep confirmed). **Residual user actions** (not code work): (a) run `./scripts/sync-customer-migrations.sh` to refresh `customer/fresh-install/001_schema.sql` + `002_seed_data.sql` + `005_pgmigrations.sql` with the three shift-handover tables — mandatory per DATABASE-MIGRATION-GUIDE §6; (b) execute the 7-stage manual smoke test in the §Manual Smoke Test section above and tick the final Phase-5 DoD checkbox. Post-mortem section at the bottom of this file populated with what-went-well / what-went-badly / metrics from Sessions 1-13.                                                                                                                                                                                                                                                                                                                                                              |
| 0.15.0  | 2026-04-23 | **Session 12 implementation complete — Phase 5 §5.3 read-view closed.** Investigation first: Session 9 had already shipped the structural pieces — modal's `readOnly` prop at L75 + `isSubmitted` `$derived` at L130 + `canEdit = !readOnly && !isSubmitted` at L131 + `renderFields = $derived.by(() => entry.status !== 'draft' ? entry.schema_snapshot : templateFields)` at L122-127 (so the UI already sources the FROZEN schema for submitted/reopened entries, proving the R2 drift-safety contract from Phase 1 §1.2). FieldRenderer has all 8 type branches + `disabled` prop routing. Plan-recommended architecture (side-panel = modal-in-read-mode, no dedicated list page) was chosen in Session 9. Only outstanding item against Phase 5 DoD: the "hierarchy labels used everywhere team/area appears" constraint — modal's meta-grid hardcoded `<span class="meta-label">Team</span>` at L351. Fix applied: (a) `ShiftHandoverModal.svelte` gains a `teamLabel: string` prop (JSDoc references ADR-034); replaces the hardcoded literal. (b) `shifts/+page.svelte` call site passes `teamLabel={labels.team}` (from the page-level `const labels = $derived(data.hierarchyLabels)` that already exists at L73); the fallback-team-name template literal `` `Team #${targetTeamId}` `` also updated to `` `${labels.team} #${targetTeamId}` `` for consistency when the name lookup misses. Minimal — no other strings in the modal reference hierarchy entities (Datum/Schicht/Zugeteilt are universal German labels, not DB-entity rewrites). Single team-label prop over a full `HierarchyLabels` object per KISS — only consumer. `FilterDropdowns.svelte` still contains hardcoded `"Bereich"`/`"Team"` labels but it predates shift-handover (shifts-page-level filter UI) and is explicitly out of Session 12 scope — tracked as a pre-existing Phase 5-DoD gap for the product owner to decide whether to close here or defer. **Verification:** `cd frontend && pnpm exec eslint 'src/routes/(app)/(shared)/shifts/_lib/ShiftHandoverModal.svelte' 'src/routes/(app)/(shared)/shifts/+page.svelte'` exit 0; `pnpm run check` → `2652 FILES 0 ERRORS 0 WARNINGS`. **Phase 5 DoD state after this session:** 10 of 11 items ticked — only "Manual smoke test" unticked. That item is user-owned per Session 12 Session-Tracking row (`Read-view + manual smoke test`) and is a browser-click-path that I can't automate from CLI. The user-facing click-path is documented in a new `## Manual Smoke Test (Phase 5 closure)` section directly below — product owner runs it and ticks the checkbox once validated. Session 13 (Phase 6 — ADR-XXX-shift-handover-protocol.md, FEATURES.md addon permission module update, customer fresh-install sync, Breadcrumb entries for /shift-handover-templates, audit-log wiring verification, final `pnpm run validate:all`) is next once smoke test returns green.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 0.14.0  | 2026-04-23 | **Session 11 complete — Phase 5 sidebar promotion shipped.** Two files touched. (1) `frontend/src/routes/(app)/_lib/navigation-config.ts`: new `SHIFT_SUBMENU` constant near `BLACKBOARD_SUBMENU` with two children — `{id:'shift-plan', label:'Schichtplanung', url:'/shifts', badgeType:'shiftSwap'}` (preserves badge+URL from the flat entry) and `{id:'shift-handover-templates', label:'Übergabe-Templates', url:'/shift-handover-templates', addonCode:'shift_planning'}` (child's own addonCode is defense-in-depth; parent's addonCode already strips the branch when addon inactive). Both flat `/shifts` entries at the root-builder and admin-builder positions (previously L510 + L661) collapsed to `{id:'shifts', icon:ICONS.clock, label:'Schichtplanung', addonCode:'shift_planning', submenu:SHIFT_SUBMENU}` — `url` and `badgeType` moved to the shift-plan child per plan. New exported pure filter `applyShiftHandoverVariant(items, canManage)` follows `applySurveysVariant` structure: early-return when `canManage===true`, otherwise `.map` top-level items and, if id==='shifts' with a defined submenu, return a clone with `submenu` filtered to drop the `shift-handover-templates` child. Deliberately REMOVES on `!canManage` (not ADDS on `canManage` like surveys) so the base source-state carries the full structure and the filter is defensive — matches the plan's "swap in or out" wording and keeps the full tree grep-visible in navigation-config.ts. (2) `frontend/src/routes/(app)/+layout.svelte`: imports gain `applyShiftHandoverVariant` + `canManageShiftHandoverTemplates`; new `canManageShiftHandoverTemplatesFlag` `$derived` mirrors `canManageSurveysFlag` (`role, hasFullAccess, orgScope.isAnyLead`); pipeline wraps `applyShiftHandoverVariant(applySurveysVariant(filterMenuByAddons(...)), canManageShiftHandoverTemplatesFlag)` — Variant runs AFTER `filterMenuByAddons` per plan so if `shift_planning` is off the parent is already gone and the filter is a no-op. **Lint/compaction**: initial ESLint run flagged 854 effective lines vs `max-lines: 850` (4 over). Trimmed by (a) compacting the `shift-plan` child to a single line (88 chars, under printWidth 100 — Prettier keeps it) and (b) flattening the filter function's blank-line-separated body into a tight 5-line body. Final non-blank/non-comment count returned under 850. (3) ADR-045 Layer-1 wrapper `canManageShiftHandoverTemplates = canManage` already shipped in Session 10 at v0.13.0, now consumed. **Verification:** `cd frontend && pnpm exec eslint 'src/routes/(app)/_lib/navigation-config.ts' 'src/routes/(app)/+layout.svelte'` exit 0; `pnpm run check` → `2652 FILES 0 ERRORS 0 WARNINGS`; `pnpm exec vitest run --project frontend-unit frontend/src/routes/(app)/_lib/navigation-config.test.ts` → 77/77 green (existing shift test at L344 — "should remove shifts when shift_planning is disabled" — stays green: parent still carries `addonCode: 'shift_planning'`, `filterMenuByAddons` strips the branch, `collectIds` finds no 'shifts'). Breadcrumb entries (`urlMappings` + `intermediateBreadcrumbs` for `/shift-handover-templates`) NOT added here — Session Tracking scopes them to Session 13 (Phase 6 — docs + integration). Phase 5 DoD "Sidebar entry Übergabe-Templates appears as submenu child of Schichtplanung iff canManageShiftHandoverTemplates AND shift_planning addon active" ticked. Session 12 (§5.3 read-view + manual end-to-end smoke test) is next.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 0.13.0  | 2026-04-23 | **Session 10 complete — Phase 5 §5.2 template-config page shipped.** New route `frontend/src/routes/(app)/(shared)/shift-handover-templates/` — 6 artefacts: (a) `+page.server.ts` — SSR Layer-0 (`requireAddon('shift_planning')`) + Layer-1 (`canManageShiftHandoverTemplates(role, hasFullAccess, isAnyLead)` → redirect `/shifts` on fail), loads `/teams` only (already scope-filtered server-side per ADR-036, no client filtering needed); (b) `+page.svelte` — team-filter dropdown (label `${labels.team}` per ADR-034) → on change auto-loads template via `getTemplate(teamId)` from `_lib/api-templates.ts` and seeds `builderState.setInitial(fields)`, sticky action bar with Verwerfen / Vorlage löschen / Speichern, two-click delete confirm with 5s auto-reset (CODE-OF-CONDUCT forbids `confirm()`), toast feedback (4s auto-dismiss), session-expired routing via centralized `$lib/utils/session-expired.ts`; (c) `_lib/api-templates.ts` — self-contained apiClient wrappers for GET/PUT/DELETE templates (does NOT cross-import from `shifts/_lib/api-shift-handover.ts` to avoid coupling between two route folders — 5-line duplication accepted per KISS); (d) `_lib/state-templates.svelte.ts` — factory `createTemplateBuilderState()` returns reactive working-state with `WorkingField` (carries UI-only `_uid` for stable {#each} key + `_keyTouched` so label→key auto-derive only fires until user manually edits the key); validation runs SHARED `ShiftHandoverTemplateFieldsSchema` from `@assixx/shared/shift-handover` as final canonical gate after per-field German error checks → R7 mitigation airtight (same Zod runs frontend + backend); (e) `_lib/FieldBuilder.svelte` — list of working fields, HTML5 native drag-and-drop reorder (no library, desktop-first per KISS), inline edit (label / key / type / required / options for select), per-row red-border on validation error; (f) `_lib/FieldTypeSelector.svelte` — 8-card modal picker (text/textarea/integer/decimal/date/time/boolean/select) with German labels + FontAwesome icons; modal classes (`modal-overlay`, `ds-modal*`) mirror Session-9 canonical pattern. **Wrapper added in `navigation-config.ts`:** `canManageShiftHandoverTemplates = canManage` next to `canManageSurveys`/`canManageBlackboard` — ADR-045 Layer-1 alias, used by the page guard now and by `applyShiftHandoverVariant` in Session 11. **Refactors caught during lint/svelte-check:** (1) Extracted 4 mutator helpers (`setLabel`, `setKey`, `setType`, `pushOption`, etc.) and 4 validation helpers (`validateField`, `findDuplicateKeys`, `applyDuplicateMarkers`, `runSchemaGate`) to top-level so `createTemplateBuilderState` stayed under the 60-LOC ESLint cap (final: ~50 LOC) and `computeValidation` complexity dropped from 13→7. (2) Inlined the `{#snippet selectOptions(...)}` block at its `{@render}` site because typescript-eslint's `no-confusing-void-expression` cannot model `{@render snippet(...)}` cleanly (false-positive 'use of empty return value') — single-call site, KISS = inline. (3) Renamed prop `state` → `builder` in FieldBuilder.svelte after svelte-check flagged the `$state` rune ↔ local-binding `state` collision (`store_rune_conflict` + `non_reactive_update`). (4) Converted literal U+0300–U+036F combining-diacritical regex chars to `\uXXXX` escapes for source-readability. (5) Dropped 4 redundant `=== undefined` checks where TS narrowing already removed `undefined` from indexed-access types. **Verification:** `cd frontend && pnpm exec eslint 'src/routes/(app)/(shared)/shift-handover-templates/' 'src/routes/(app)/_lib/navigation-config.ts'` exit 0; `pnpm run check` → `2652 FILES 0 ERRORS 0 WARNINGS`. Manual smoke test deferred to Session 12 per session table (end-of-Phase-5: Team-Lead seeds template → Employee opens modal → write+submit → next-shift assignee sees submitted entry — needs §5.3 to be useful). Session 11 (sidebar promotion: flat `/shifts` link → submenu with `Übergabe-Templates` child + `applyShiftHandoverVariant` filter step in layout pipeline) is next.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 0.12.0  | 2026-04-23 | **Session 9 complete — Phase 5 §5.0 + §5.1 shipped.** §5.0 route-group locked as `(shared)` per plan recommendation — Team-Lead can be `role='employee'` (ADR-035), Layer-1 `canManage` gate in `+page.server.ts` handles the actual access check at finer granularity. §5.1 delivers 6 frontend artefacts: (a) `shifts/_lib/api-shift-handover.ts` — thin `apiClient` wrapper over all 9 endpoints; (b) `ShiftHandoverFieldRenderer.svelte` — one component, switch on `field.type`, renders all 8 types (text/textarea/integer/decimal/date/time/boolean/select), parent owns state (pure `$props`), HTML5 required + minimal coercion; (c) `ShiftHandoverButton.svelte` — 📋 button per cell, 4 colour states (grey/yellow/green/red-border); (d) `ShiftHandoverModal.svelte` — draft-lifecycle owner: bulk-load template + entry on mount (idempotent `getOrCreateDraft`), prefilled meta (Datum+KW, Slot-Label, Team, Assignees), Protokoll textarea, custom fields via renderer, image upload (5 cap, 5 MB, MIME whitelist with client-side pre-check — backend authoritative), "Speichern (Entwurf)" + "Übergabe abschließen" + read-only branch for non-assignee-non-Lead and submitted status; (e) `shifts/_lib/ShiftScheduleGrid.svelte` extended with optional `onhandoverClick` + `getHandoverStatus` props so the button renders only where the feature is wired; (f) `+page.svelte` wires the modal + bulk-loads entry status per `(team, week)` via new `createHandoverState()` helper. **Key refactors caught during lint:** (1) Extracted `HandoverButtonStatus` / `HandoverContext` / `HandoverSlot` to `shift-handover-types.ts` because svelte-eslint-parser 3.x + typescript-eslint 8.x surface cross-package unions (`@assixx/shared/shift-handover#ShiftHandoverSlot`) as `error type` inside .svelte templates, cascading `no-unsafe-member-access` on every usage. `HandoverSlot` is now a locally-mirrored `'early'                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 'late' | 'night'`literal union; the canonical source of truth stays in`shared/src/shift-handover/field-types.ts#SHIFT_HANDOVER_SLOTS`with an architectural test flagging drift. (2) Extracted state-management to`\_lib/state-handover.svelte.ts`+ re-exported`createHandoverState`via the existing`state.svelte.ts`barrel to stay under the 25-import cap + 400-line`<script>`block cap on`+page.svelte`. Uses `SvelteMap`(not plain`Map`) per `svelte/prefer-svelte-reactivity`. (3) Factored `validateUpload()`out of`handleFileSelected`to drop cognitive complexity from 11 to ≤10. (4) Captured`entry.id`into a local before awaiting in`handleSaveDraft`/`handleSubmit`to satisfy`require-atomic-updates`(entry is reassigned after the await). **Spec Deviation #6** recorded: attachment history is not loaded for existing entries (GET /attachments list would be a new endpoint, deferred to V2 per Known Limitations) — session-freshly-uploaded attachments render in-memory only; a reopened modal starts with empty list. **Spec Deviation #7** recorded: the "red border when required-fields missing past shift-end" visual state from plan §5.1 is wired as a`hasRequiredGap`prop on the button but no caller sets it yet (the evaluation needs entry+schema_snapshot+shift_end_time correlation that belongs in §5.3 read-view logic). **Verification:**`cd frontend && pnpm exec eslint src/routes/(app)/(shared)/shifts/`exit 0;`pnpm run check`→`2644 FILES 0 ERRORS 0 WARNINGS`; backend `/health`→`status=ok`. Manual draft→submit smoke is deferred to end-of-Phase-5 (Session 12) since realistic UX testing requires the template-config page from §5.2 to seed a template first. Session 10 (§5.2 template config page + FieldBuilder) is next. |
| 0.11.0  | 2026-04-23 | **Session 8 complete — Phase 4 closed; production DEFERRABLE bug fixed.** Phase-4 API integration tests shipped: `backend/test/shift-handover.api.test.ts` — **39 / ≥25 tests green** (156 % of DoD target, ~2.3 s wall). Coverage map (matched to plan §Phase 4 mandatory scenarios): Auth & my-permissions (2), Templates CRUD (10 — incl. 5 BadRequest validation paths + idempotent upsert + delete+already-deleted-404 + all-8-types acceptance), Entries lifecycle (12 — full draft → submit → reopen → submit cycle + locked-after-submit + customValues type-mismatch + non-existent 404), List + pagination (4 — required-teamId 400 + envelope shape + page/limit echo + status-filter), Attachments (7 — PNG upload → stream → 5-cap → 6th-rejected → MIME whitelist 400 → delete → after-delete 404), RLS isolation (1 — cross-tenant template via direct SQL invisible to tenant 1 GET; uses real team in tenant 8 since `shift_handover_templates.team_id` has FK to `teams`), Permission matrix Layer-2 (4 — Employee my-permissions all-false + 3× 403 on read/write/manage). **Production bug surfaced + fixed — migration #145 shipped:** the Phase-1 unique constraint on `shift_handover_entries (tenant_id, team_id, shift_date, shift_key)` was created `DEFERRABLE` (plan §1.2). PostgreSQL **forbids** `INSERT … ON CONFLICT` against deferrable constraints — documented limitation, conflict arbiter must be evaluable at INSERT time. The Phase-2 `EntriesService.insertDraftOrFetch` race-safety pattern relies on exactly that. Result: every `POST /shift-handover/entries` returned 500 with `error: ON CONFLICT does not support deferrable unique constraints/exclusion constraints as arbiters`. The 95 unit tests in Session 7 mocked `DatabaseService` → did not catch it. Phase-4 caught it on the first real INSERT — **the value of Tier-2 integration tests**. Fix: new migration `20260422215918297_drop-shift-handover-entries-deferrable.ts` (pgmigrations #145) drops + recreates the constraint as plain UNIQUE, same name + same column set. Service code unchanged. Behavioural change: zero (initially-immediate is the default for plain UNIQUE; service never called `SET CONSTRAINTS DEFERRED`). Migration discipline followed verbatim per DATABASE-MIGRATION-GUIDE §HARD BLOCK: backup → generator → edit-stub → dry-run → apply → verify → no manual file creation, no raw-SQL bypass. Backup at `database/backups/full_backup_pre_drop_deferrable_20260422_235910.dump` (3.1 MB). **Test infrastructure decisions worth preserving**: (1) `sqlProbe(query)` helper — narrow-scope `execSync(docker exec psql -t -A -c …)` wrapper used only for `(now() AT TIME ZONE 'Europe/Berlin')::date` lookup (matches resolver TZ math), `shifts` seed (precise `start_time` + cross-team unique-index avoidance via `teamId * 1µs` offset), and the cross-tenant RLS fixture — every direct DB write is documented as a leak in test-API surface and capped to those three uses; (2) two independent teams via `createDepartmentAndTeam` — `templateTeamId` for the delete-template suite, `entryTeamId` for the lifecycle suite — decouples delete-then-recreate from `schema_snapshot` validation; (3) `attachments` suite uses `slot=late` while lifecycle uses `slot=early` to keep state-machine assertions independent within a single Berlin date; (4) RLS test discovers a real cross-tenant team via `SELECT FROM teams WHERE tenant_id <> 1 ORDER BY tenant_id, id LIMIT 1` rather than hardcoding tenant 36 — robust to dev-DB drift; (5) employee 403 tests rely on `ensureTestEmployee` (existing helper) + cached login — proves the ADR-020 fail-closed default without seeding `user_addon_permissions` rows. **Spec Deviation #4** recorded: the "tenant without `shift_planning` addon → 403" mandatory scenario is documented + skipped here because all 9 dev tenants have `active`/active-`trial` addon rows; the contract is enforced by class-level `@RequireAddon(SHIFT_PLANNING_ADDON)` + global `TenantAddonGuard` and verified at the unit-test layer. **Spec Deviation #5** recorded: §1.2 `DEFERRABLE INITIALLY IMMEDIATE` clause was a design error (no use case justified it), corrected via migration #145. **Verification:** `pnpm exec vitest run --project api backend/test/shift-handover.api.test.ts` → `Test Files 1 passed (1) · Tests 39 passed (39) · 2.52 s`; `pnpm exec eslint` on the new test file + the migration: 0 errors; `pnpm exec prettier --check` on both: clean (one auto-format pass during authoring, cosmetic); `docker exec assixx-backend pnpm run type-check` (shared + frontend + backend + backend/test) exit 0. **Customer fresh-install sync** (mandatory per migration guide §6) deferred to a follow-up step — flagged as the only outstanding Phase-4 chore. Session 9 (Phase 5 §5.0 route-group decision + §5.1 ShiftHandoverButton + ShiftHandoverModal) is next. |
| 0.10.0  | 2026-04-22 | **Session 7 complete — Phase 3 closed.** 5 test files, **95 / ≥75 unit tests green** (127 % of DoD target). Files: `shared/src/shift-handover/field-validators.test.ts` (15), `active-shift-resolver.service.test.ts` (17), `shift-handover-templates.service.test.ts` (19), `shift-handover-attachments.service.test.ts` (14), `shift-handover-entries.service.test.ts` (30 — the heart). **Risk → named test mapping**: R1 (night-shift-over-midnight split into same-day + yesterday-night, 2 tests in resolver), R2 (schema_snapshot `JSON.stringify(fields)` verified in `submitEntry` UPDATE params), R3 (`SELECT … FOR UPDATE` SQL-verified on `loadEntryForUpdate`), R5 (full 8-case Berlin-TZ write-window matrix). **Mocking canon established**: `DatabaseService.tenantTransaction`/`systemTransaction` via `mockImplementation(cb => cb(mockClient))` where `mockClient.query` is a `vi.fn()` staged per SQL statement; `node:fs` module-level `vi.mock` exposing `promises.{mkdir,writeFile}` stubs (service imports `{ promises as fs } from 'node:fs'`, so factory must return `.promises` subkey — NOT hoist under `node:fs/promises`); `SHIFT_HANDOVER_CLOCK` as `vi.fn(() => FIXED_NOW)`. Shared Zod schemas run live (not mocked) — the plan DoD's "duplicate key / >30 fields / invalid regex / select-no-options" rejections depend on the real schema enforcing rules. **Architectural assertions**: `runAutoLockSweep` uses `systemTransaction` (BYPASSRLS, ADR-019) and **not** `tenantTransaction` — asserted via `expect(mockDb.tenantTransaction).not.toHaveBeenCalled()`; `getMyPermissions(hasFullAccess=true)` short-circuits with **zero DB calls**. **Infra change**: `vitest.config.ts` gained `@assixx/shared/shift-handover` alias in the `unit` project (§R14 mirror — Vitest aliases run parallel to ADR-015 conditional exports; subpath resolution in tests needs the explicit entry). **Verification**: `pnpm exec vitest run --project unit backend/src/nest/shift-handover/ shared/src/shift-handover/` → `Test Files 5 passed (5) · Tests 95 passed (95) · 1.19 s`; ESLint 0, Prettier clean on all 5 files (Prettier auto-format applied once per file during authoring — cosmetic chain-breaks, zero semantic changes). Session 8 (Phase 4 — `backend/test/shift-handover.api.test.ts`, ≥25 API integration tests against live Docker stack) is next.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 0.9.0   | 2026-04-22 | **Session 6 complete — Phase 2 closed.** §2.7 + §2.8 shipped on top of §2.6 (v0.8.0). **§2.7 (JSDoc-only):** registrar's class doc gains a paragraph documenting the `canDelete` scope split — `canDelete` on `shift-handover-templates` maps 1:1 to the DELETE templates endpoint; `canDelete` on `shift-handover-entries` gates **only** the attachment-delete endpoint (no `DELETE /entries/:id` route exists in V1; entry rows are never API-deleted, only auto-locked). Reviewers grepping `canDelete` from the registrar will now find the rationale on the first hit. **§2.8 (cron auto-lock):** new `backend/src/nest/shift-handover/shift-handover-cron.service.ts` (~70 LOC). `@Cron('0 */6 * * *', { name: 'shift-handover-auto-lock', timeZone: 'Europe/Berlin' })` — top of every 6 hours, TZ-pinned so DST transitions don't shift firing slot relative to operational shifts. Decorated method captures `nowUtc = new Date()`, delegates to `EntriesService.runAutoLockSweep(nowUtc)` (Session 5 cross-tenant `systemTransaction` / sys_user / BYPASSRLS — no CLS context, no tenant scope). Logs locked count + first 10 IDs at INFO, "no drafts to lock" at DEBUG, errors via `getErrorMessage()` at ERROR. Errors deliberately swallowed inside the handler — `@Cron` handlers must never throw (NestJS does not retry); next 6 h tick is the natural retry. Two module-level constants: `SHIFT_HANDOVER_AUTO_LOCK_CRON` (hoisted so the literal `*/` sequence stays out of any JSDoc body) and `MAX_LOGGED_IDS = 10` (caps line size). Sibling-service over EntriesService extension — keeps domain pure, mirrors `KvpApprovalArchiveCronService` pattern. Module providers gain `ShiftHandoverCronService`. **Phase 2 DoD checklist** flipped to all-✅ (16 items): module registered, 4 services + cron implemented, controller with all 14 endpoints, registrar wires both modules, addon-check via class-level decorator, `tenantTransaction`/`systemTransaction` used correctly, ADR-007 raw-data returns, cron live, audit-log entries for template upsert/delete + entry submit/reopen, shared module built + resolves both ends, no `any`/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |        | `/truthy-checks, ESLint 0, type-check 0, all DTOs Zod, all param DTOs via factory, no `@Roles`on mutations. **Verification (after both steps):**`docker exec assixx-backend pnpm exec eslint backend/src/nest/shift-handover/`exit 0 (1 fix inline: 2×`no-irregular-whitespace`from zero-width chars I'd inserted in a JSDoc draft to escape`\*/`— replaced with prose explanation), Prettier exit 0, full`pnpm run type-check` exit 0, backend restart clean (`/health`→`status:ok`, `ScheduleModule dependencies initialized`+`ShiftHandoverModule dependencies initialized`in boot log, no errors). Session 7 (Phase 3 — ≥75 unit tests across`shift-handover-templates.service.test.ts`, `shift-handover-entries.service.test.ts`, `active-shift-resolver.service.test.ts`, `shift-handover-attachments.service.test.ts`, `shared/src/shift-handover/field-validators.test.ts`) is next.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 0.8.0   | 2026-04-22 | **Session 6 partial — §2.6 `ShiftHandoverController` shipped.** New file `backend/src/nest/shift-handover/shift-handover.controller.ts` (~330 LOC, every handler ≤60 LOC). All 14 endpoints per plan §2.6 table mapped + verified at runtime (boot log shows `ShiftHandoverController {/api/v2/shift-handover}:` + 14 route lines). Class-level `@RequireAddon(SHIFT_PLANNING_ADDON)` + per-endpoint `@RequirePermission` (ADR-020/033/045); zero `@Roles('admin','root')` on mutations. Layer-1 `canManage` helpers (`assertCanManage`/`computeCanManage`) gate `upsertTemplate`, `deleteTemplate`, `reopenEntry` via `ScopeService.getScope()`. Same-team read scope (`assertCanReadTeam`): `hasFullAccess`/`root` bypass → `scope.teamIds` → `EntriesService.isTeamMember()` fallback for rank-and-file. Multipart = `memoryStorage()` + `FileInterceptor` per ADR-042; service owns disk-write (Pattern B). Streaming via `@Res() FastifyReply` + `inlineHeader()` + `fs.readFile` + 3600s private cache. Audit-log writes for template upsert/delete (Phase-2 DoD backfill flagged in Session 5 changelog). **New helper** on `ShiftHandoverTemplatesService.getMyPermissions(userId, hasFullAccess)` — mirrors TPM/Blackboard canonical pattern verbatim (full-access short-circuit → `user_addon_permissions` query → `{canRead,canWrite,canDelete}` per module). **New helper** on `ShiftHandoverEntriesService.isTeamMember(userId, teamId)` — `SELECT user_id FROM user_teams WHERE … LIMIT 1`. **New types** in `shift-handover.types.ts`: `ShiftHandoverModulePermissions`, `ShiftHandoverMyPermissions`. **Module** gains imports `AddonCheckModule`, `ScopeModule` + `controllers: [ShiftHandoverController]`. **Spec Deviation #3** recorded: (a) `/my-permissions` returns canonical TPM shape (`{templates, entries}`) not plan's literal `{canManageTemplates, canWriteForToday}` — rationale: per-slot runtime check doesn't fit static permissions endpoint, and Layer-1 duplicates layout state; (b) DELETE attachment uses `canDelete` per §2.7 registrar rationale (not `canWrite` as plan §2.6 table says); (c) `listEntries` requires `teamId` (enforces same-team scope V1). **Fixes caught + applied inline:** 2× `TS2379 exactOptionalPropertyTypes` (conditional-spread for `status`/`dateFrom`/`dateTo`; page/limit have Zod `.default()` so always defined); 2× `@typescript-eslint/no-unnecessary-condition` (removed page/limit spread); 1× Prettier reformat. **Verification**: ESLint 0, Prettier 0, `pnpm run type-check` (shared + frontend + backend + backend/test) exit 0, backend restart clean (`/health` → `status:ok`), all 14 `Mapped {/api/v2/shift-handover/…}` routes visible in boot log, `ShiftHandoverModule dependencies initialized`. Session 6 continues with §2.7 registrar JSDoc polish (`canDelete` split note) + §2.8 `@Cron('0 */6 * * *')` auto-lock hook.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 0.1.0   | 2026-04-21 | Initial draft — phases outlined, all 12 product Qs answered                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 0.2.0   | 2026-04-22 | Post-verification revision. Fixed: (a) `uuid_generate_v7()` → `uuidv7()` (PG18 native, 3 migrations); (b) dropped `shift_handover_slot` ENUM → `shift_key VARCHAR(20)` + CHECK + app-validate (honours tenant-configurable `shift_times`); (c) explicit composite-identity resolver spec (§0.8 spike + §2.3 signature); (d) `main.ts:99` → `main.ts:175`; (e) rewrote frontend nav section against real `getMenuItemsForRole`+SUBMENU architecture; (f) canonicalised shared-module path + package.json exports step; (g) resolved §0.3 vs §R1 `shifts`/`shift_assignments` contradiction; (h) TZ-pinned "today" rule to Europe/Berlin; (i) added R13–R15.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 0.3.0   | 2026-04-22 | **Session 1 complete.** §0.8 spike: `shift_key` distinct values = `{early,late,night}` across both tenants with `shift_times` rows (IDs 8, 36) → STOP-condition not triggered, V1 scope viable. `shifts_type` ENUM is MIXED (14 values: slot markers `early/late/night/F/S/N` + labor-law `regular/vacation/sick/...`); `shift_rotation_history_shift_type` = `{F,S,N}`. Canonical merge pattern at `backend/src/nest/shifts/shifts.service.ts` L681–691 → resolver copies this verbatim. **§0.8 decision locked: Option A (enum-equivalence matching)**. §0.7 spike: Inventory controller uses `memoryStorage()` + inline `writeInventoryPhotoToDisk()` helper (NOT `diskStorage`); service signature `create(itemId, filePath, caption, createdBy)` is shape-coupled to inventory; frontend upload is inline in `items/[uuid]/+page.svelte` L154–187 (no reusable component); `MulterFile` + `@fastify/multipart:main.ts:175` + `FileInterceptor` from `@webundsoehne/nest-fastify-file-upload` are shared infrastructure. **§0.7 decision locked: ADAPT** — dedicated `shift_handover_attachments` table + copied service/controller pattern. Corrections: (a) R11 + §2.4 `diskStorage` → `memoryStorage() + controller-side disk-write` (matches Inventory reality); (b) §2.4 image cap 10 MB → 5 MB (parity with Inventory's `MAX_PHOTO_FILE_SIZE`); (c) R13 justification reworded — `shifts_type` is MIXED, not "unrelated"; (d) Known Limitation #14 added — inventory upload module not extracted to shared `AttachmentsModule`; V2 cost.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 0.4.0   | 2026-04-22 | **Session 2 complete — Phase 1 shipped.** All 3 migrations applied + verified: `20260422120720338_create-shift-handover-templates` (pgmigrations #142), `20260422122625347_create-shift-handover-entries` (#143), `20260422124449192_create-shift-handover-attachments` (#144). Pre-apply backups taken for each step (14:07, 14:26, 14:44). Every DoD item verified: 3 tables with strict-mode RLS (`NULLIF` policy, no bypass), app_user + sys_user GRANTs on all 3 tables, `shift_handover_status` ENUM `(draft, submitted, reopened)` created, `shift_key` CHECK `('early','late','night')` enforced (R13 V1 whitelist), composite UNIQUE on entries is `DEFERRABLE INITIALLY IMMEDIATE`, FK `shift_handover_attachments.entry_id → shift_handover_entries(id) ON DELETE CASCADE`. Backend type-check exit 0 after each apply; architectural-test suite 25/25 passed (0 magic-number regressions). Spec deviations: "Existing tests still pass" DoD item satisfied by architectural-test run at Phase-1 close, not per-step — documented rationale per §Spec Deviations. Session 3 (Phase 2 §Step 2.1) is next.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 0.7.0   | 2026-04-22 | **Session 5 complete — §2.5 `ShiftHandoverEntriesService` shipped** (the feature's heart, 7 public methods + 5 private helpers + 3 pure module-level helpers). New file `backend/src/nest/shift-handover/shift-handover-entries.service.ts` (440 LOC; every function ≤55 LOC — tightest constraint is `submitEntry` at 30). **Clock injection wired**: module now provides `{provide: SHIFT_HANDOVER_CLOCK, useValue: REAL_CLOCK}` (`() => new Date()`), service consumes via `@Inject(SHIFT_HANDOVER_CLOCK)`; no `Date.now()` anywhere in service code (plan §2.3 purity contract extended to §2.5). Methods: **`getOrCreateDraft`** — race-safe via `INSERT … ON CONFLICT DO NOTHING RETURNING *` + fallback SELECT on race; R13 pre-check via `assertShiftKeyConfigured`; write-window check via `resolver.canWriteForShift({..., nowUtc: this.clock()})` (R1/R5). **`updateDraft`** — `FOR UPDATE` lock, `MUTABLE_ENTRY_STATUSES = {draft,reopened}` (deviation from plan's strict "draft only" reading documented in JSDoc — reconciled with `reopenEntry` allowing edits); `custom_values` re-parsed through `buildEntryValuesSchema(liveTemplate.fields)` from shared (R7). **`submitEntry`** — tx + `SELECT … FOR UPDATE` row-lock (R3), snapshots live template fields into `schema_snapshot` (R2), `status→submitted`, audit via `ActivityLoggerService.log({entityType:'shift', newValues:{entryId, status:'submitted'}})` (entityType enum doesn't have `shift_handover_*` so reuse `'shift'` + UUID in newValues — pragmatic, no shared-type scope creep). **`reopenEntry`** — `submitted→reopened`, audit. **`listEntriesForTeam`** — one query with `COUNT(*) OVER()` window; dynamic WHERE via `buildListFilters` module-level helper; status + date range filters; `DEFAULT_LIST_LIMIT=20`, `MAX_LIST_LIMIT=100`. **`getEntry`** — RLS-scoped by ID. **`runAutoLockSweep(nowUtc)`** — cross-tenant bulk UPDATE via `systemTransaction` (sys_user BYPASSRLS per ADR-019); correlated subquery snapshots template per matched row; `submitted_by = NULL` sentinel for system-auto; TZ math `AT TIME ZONE 'Europe/Berlin' + interval '24 hours'` in SQL (reuses the resolver's DST-correct pattern). All INSERT statements use `TENANT_ID_FROM_RLS` fragment (mirrors Templates service — policy check and INSERT value derive from same GUC). Module updated: 5 providers total + `SHIFT_HANDOVER_CLOCK` binding; 4 services exported (registrar stays module-private). Verification: 2 lint errors caught + fixed inline — (1) `requireRow<T>` needed `T extends QueryResultRow` for pg's generic constraint (TS2344), (2) destructure-rename `_total` violated `@typescript-eslint/naming-convention` `variable` selector (no `leadingUnderscore:'allow'` there) → replaced with `const {total, ...rest} = row; void total;` pattern. After fixes: Prettier 0, ESLint 0, full `pnpm run type-check` (shared + frontend + backend + backend/test) exit 0. Session 6 next: §2.6 controller (13 endpoints + `my-permissions`) + §2.7 permission registrar JSDoc (already exists, needs the `canDelete` split note) + §2.8 `@Cron('0 */6 * * *')` auto-lock hook. Also Phase-2 DoD backfill: TemplatesService audit logging (currently omitted from §2.2 — plan's DoD lists "template upsert/delete" audit under Phase 2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 0.6.1   | 2026-04-22 | **Session 5 partial — §2.4 `ShiftHandoverAttachmentsService` shipped.** New file `backend/src/nest/shift-handover/shift-handover-attachments.service.ts` (258 LOC, 3 public methods + 5 private helpers, every function ≤30 LOC). Constants exported from `shift-handover.types.ts` (mirrors Inventory's `inventory.types.ts` pattern): `SHIFT_HANDOVER_MAX_ATTACHMENT_SIZE = 5MB`, `SHIFT_HANDOVER_MAX_ATTACHMENTS_PER_ENTRY = 5`, `SHIFT_HANDOVER_ALLOWED_MIME_TYPES = {jpeg,png,webp,heic}` frozen tuple. **Pattern decision:** Pattern B (service owns lifecycle) over Pattern A (Inventory's split where controller writes disk + service persists row). Rationale recorded in file JSDoc: §2.4 names the signature `uploadForEntry(entryId, file)` with MIME/size enforcement on the service side, so service owns validation → cap-check → disk-write → INSERT; controller at §2.6 stays thin. Order-of-operations comment documents why disk-write happens BEFORE the INSERT inside the same `tenantTransaction` (INSERT-failure → orphan file is recoverable via cleanup cron; alternative "commit first, write later" would leave DB pointing at non-existent files on crash). All 3 public methods delegate to private helpers (`validateFile`, `loadMutableEntry`, `assertUnderCap`, `loadAttachmentContext`, `writeToDisk`) so the main methods stay flat (cognitive-complexity ≤10). MUTABLE_ENTRY_STATUSES = `['draft','reopened']` — attachments mutable until final submit. Disk layout: `uploads/shift-handover/{tenantId}/{entryId}/{uuidv7()}{ext}` with `fs.mkdir({recursive:true})` + `fs.writeFile`. File extension derived from MIME (deterministic, untrusts `originalname`). `deleteAttachment` enforces (entry-mutable AND (creator OR canManage)); `canManage` is a boolean passed from controller (populated from `orgScope.isAnyLead`). `streamAttachment` returns `{filePath, mimeType, fileName}` — controller does same-team scope filter. All DB access via `tenantTransaction`/`tenantQuery` (app_user + RLS, ADR-019); `tenant_id` always taken from the RLS-loaded entry row, never client input. `ShiftHandoverModule` updated: service + constants wired into providers + exports. Verification: Prettier 0, ESLint 0, full `pnpm run type-check` (shared + frontend + backend + backend/test) exit 0. Session 5 continues with §2.5 EntriesService (the "heart" — `getOrCreateDraft`, `submitEntry` with snapshot + FOR UPDATE lock, `reopenEntry`, `runAutoLockSweep`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 0.6.0   | 2026-04-22 | **Session 4 complete — §2.3 `ActiveShiftResolverService` shipped.** New file `backend/src/nest/shift-handover/active-shift-resolver.service.ts` (201 LOC, every method ≤30 LOC, cognitive complexity flat — `canWriteForShift` delegates the window check to a private `isWithinWriteWindow` helper to stay ≤10 complexity). Four public methods per plan: (1) `resolveAssignees(tenantId, teamId, shiftDate, shiftKey)` — UNION on `shifts` + `shift_rotation_history` mirroring the canonical merge at `shifts.service.ts` L681–691 verbatim; slot-to-enum mapping per §0.8 (`early ↔ {early,F}/F`, `late ↔ {late,S}/S`, `night ↔ {night,N}/N`) captured in two top-level `Record<ShiftHandoverSlot, …>` constants; NULL `user_id` rows filtered (unassigned shifts); `= ANY($3::text[])` for the mixed-value shifts enum, single `= $4` for the pure-slot rotation enum; SQL `UNION` de-dupes at engine level. (2) `canWriteForShift(ctx)` — two-stage: assignee-check → time-window check; delegates window evaluation to `isWithinWriteWindow` private helper which runs a single PostgreSQL query doing ALL TZ math server-side (`AT TIME ZONE 'Europe/Berlin'` + DST-aware `shift_date + end_time` conversion to UTC), then evaluates the 3 allowed cases in flat JS (same-Berlin-day / night-slot-yesterday-within-window / none). Backend runs UTC (ADR-014), so `Date.toISOString().slice(0,10)` gives the Berlin-date for any DATE-column value by construction — documented in the `toIsoDateUtc()` JSDoc. (3) `getShiftEndClock(tenantId, shiftKey)` — reads `shift_times`, returns `{startTime, endTime}` as `HH:MM:SS` strings, throws `NotFoundException` when slot is not configured (fail-loud). (4) `getAutoLockCutoff(entry, nowUtc)` — single SQL expression `now > (shift_date + end_time) AT TIME ZONE 'Europe/Berlin' + interval '24 hours'`; pure given inputs, no RLS context needed (no tenant-scoped tables touched), uses `db.query()` on `app_user`. Purity contract honored: no `Date.now()`, no `process.env.TZ`, every timing input explicit parameter. All DB access via `queryAsTenant(sql, params, tenantId)` with explicit tenantId so the service is callable outside HTTP/CLS context (cron jobs, unit tests, WebSocket). `ShiftHandoverModule` updated: `ActiveShiftResolverService` added to `providers` + `exports` (§2.5 EntriesService will consume it for `getOrCreateDraft` window enforcement and `runAutoLockSweep`). Verification: Prettier 0, ESLint 0, `docker exec assixx-backend pnpm run type-check` (shared + frontend + backend + backend/test) exit 0. Session 4 closed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 0.5.1   | 2026-04-22 | **Session 4 partial — §2.2 `ShiftHandoverTemplatesService` shipped.** New file `backend/src/nest/shift-handover/shift-handover-templates.service.ts` (151 LOC, all functions ≤30 LOC — well under the 60-LOC cap). Three public methods per plan: `getTemplateForTeam(teamId)` → `ShiftHandoverTemplateRow \| null`; `upsertTemplate(teamId, fields, userId)` → idempotent single-statement `INSERT … ON CONFLICT (tenant_id, team_id) DO UPDATE` with `TENANT_ID_FROM_RLS` SQL fragment so INSERT value derives from the same GUC the RLS policy checks (fail-safe: caller can't mismatch); `deleteTemplate(teamId, userId)` → soft-delete `is_active = IS_ACTIVE.INACTIVE` with `RETURNING id` → `NotFoundException` when no active row. Private `validateFields()` re-parses via the shared `ShiftHandoverTemplateFieldsSchema` as Power-of-Ten Rule 5 defense-in-depth (DTO layer is primary; service protects non-HTTP callers). Upsert wraps a team-existence pre-check (`SELECT id FROM teams WHERE id = $1`; RLS enforces tenant filter) so caller sees `BadRequestException('Team … does not exist in this tenant')` instead of opaque SQLSTATE 23503. `ShiftHandoverModule` updated: `ShiftHandoverTemplatesService` added to `providers` + `exports` (consumable by future `ShiftHandoverEntriesService` in §2.5 for `schema_snapshot` reads). Verification: `docker exec assixx-backend pnpm exec eslint backend/src/nest/shift-handover/` exit 0 (1 initial `@typescript-eslint/typedef` error — missing annotation on `tenantTransaction` callback `client` param — fixed by adding `import type { PoolClient } from 'pg'` + `client: PoolClient` annotation); full `pnpm run type-check` suite (shared + frontend + backend + backend/test) exit 0. No runtime changes (service not yet wired to a controller — that's §2.6). Session 4 continues with §2.3 `ActiveShiftResolverService`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 0.5.0   | 2026-04-22 | **Session 3 complete — Phase 2.1 shipped.** Shared module built: `shared/src/shift-handover/{index,field-types,field-validators}.ts`, `shared/package.json` gains `zod ~4.3.6` dep + `./shift-handover` conditional-exports block (ADR-015), `shared/dist/shift-handover/` produces 13 JS/d.ts artefacts. Backend module skeleton shipped: `backend/src/nest/shift-handover/` with `shift-handover.{types,tokens,module,permissions}.ts`, `shift-handover-permission.registrar.ts`, and 12 DTO files under `dto/` (11 DTOs + barrel). `ShiftHandoverModule` wired into `app.module.ts` alphabetically before `ShiftsModule`. Spec Deviation #2 recorded: registry extended with `addModulesToCategory()` method; registrar uses `OnApplicationBootstrap` to append the 2 new modules (`shift-handover-templates`, `shift-handover-entries`) to the existing `shift_planning` category — verified at boot, zero exceptions (`Extended permission category "shift_planning" with 2 module(s)` after base 4). Every DoD item green: shared build exits 0, `docker exec assixx-backend pnpm run type-check` exits 0 across shared/frontend/backend/backend-test, `pnpm exec eslint` on the new dirs exits 0 (initial 6 Zod-4 deprecation + NestJS-extraneous-class errors fixed inline: `ZodTypeAny → ZodType`, dropped `.safe()`/`.finite()` no-ops, eslint-disable on empty module class), `frontend/pnpm run check` 0 errors / 0 warnings / 2554 files. Runtime smoke: backend restart clean, `/health` returns `status:ok`, boot log shows registrar fires after all `OnModuleInit` hooks (no order-dependency). Session 4 (Phase 2 §2.2 TemplatesService + §2.3 ActiveShiftResolver) is next.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

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

### Step 2.6: `ShiftHandoverController` [✅ DONE — 2026-04-22]

> **Shipped 2026-04-22** (Session 6, part 1 of 3). New file `backend/src/nest/shift-handover/shift-handover.controller.ts` (~330 LOC, every handler ≤60 LOC — widest is `streamAttachment` at 20). All 14 endpoints per plan §2.6 table mapped and verified at runtime (`ShiftHandoverController {/api/v2/shift-handover}:` + 14 route lines in boot log). Class-level `@RequireAddon(SHIFT_PLANNING_ADDON)` gates every endpoint (ADR-033); per-endpoint `@RequirePermission(SHIFT_PLANNING_ADDON, …, 'canX')` gates Layer-2 access (ADR-020); zero `@Roles('admin','root')` on mutations (ADR-045 hard rule honored). **Layer-1 `canManage` enforcement** — private `assertCanManage()` + `computeCanManage()` helpers — covers `upsertTemplate`, `deleteTemplate`, `reopenEntry` (strict mode per plan); uses `ScopeService.getScope()` for `isAnyLead`, short-circuits on `role=root` and `admin+hasFullAccess`. **Same-team read scope** (plan Product Decision #12) — private `assertCanReadTeam()` — layered: `hasFullAccess`/`root` bypass → `scope.teamIds` (management) → `EntriesService.isTeamMember()` (plain `user_teams` membership for rank-and-file). **Multipart upload** follows ADR-042 verbatim: `memoryStorage()` + `FileInterceptor('file', { limits: { fileSize: SHIFT_HANDOVER_MAX_ATTACHMENT_SIZE, files: 1 }})`; service owns disk-write (plan §2.4 Pattern B); `MulterFile` reused from `common/interfaces`. **Streaming** via `@Res() reply: FastifyReply` + `inlineHeader()`; 3600s private cache; reads buffer with `fs.readFile`. **Audit logs** (Phase-2 DoD backfill per Session 5 changelog flag): `upsertTemplate` + `deleteTemplate` emit via `ActivityLoggerService` (entityType `'shift'` — same pragmatic enum reuse as EntriesService submit/reopen). **my-permissions** (TPM-/Blackboard-style self-lookup) — delegates to new `ShiftHandoverTemplatesService.getMyPermissions(userId, hasFullAccess)` which mirrors the canonical `TpmPlansService.getMyPermissions` / `BlackboardEntriesService.getMyPermissions` verbatim (full-access short-circuit → query `user_addon_permissions` → resolve `{canRead, canWrite, canDelete}` per module).
>
> **New types** added to `shift-handover.types.ts`: `ShiftHandoverModulePermissions`, `ShiftHandoverMyPermissions`. **New helper** on `ShiftHandoverTemplatesService`: `getMyPermissions(userId, hasFullAccess)` (~40 LOC). **New helper** on `ShiftHandoverEntriesService`: `isTeamMember(userId, teamId)` (~10 LOC, `SELECT user_id FROM user_teams WHERE … LIMIT 1`). **Module updated**: imports `AddonCheckModule` + `ScopeModule`; `controllers: [ShiftHandoverController]` added. **Spec deviations documented** (see §Spec Deviations #3): (a) `/my-permissions` ships the canonical TPM shape `{templates, entries}` instead of plan's literal `{canManageTemplates, canWriteForToday}` — rationale: `canWriteForToday` is a per-slot runtime check belonging on the draft-create path, and `canManageTemplates` duplicates layout-data state; (b) DELETE attachment uses `canDelete` per §2.7 registrar rationale (plan §2.6 table inconsistently said `canWrite`); (c) `listEntries` requires `teamId` query param (plan's DTO has it optional) so V1 enforces same-team scope without cross-team aggregation complexity — full-access / root may iterate per team.
>
> **Fixes applied inline during verification:** (1) two `exactOptionalPropertyTypes` errors (TS2379) — fixed with conditional-spread for `status`/`dateFrom`/`dateTo` (page/limit have Zod `.default()` so always defined); (2) two `@typescript-eslint/no-unnecessary-condition` lints (page/limit are non-undefined post-default — removed the spread for those two); (3) one Prettier reformat (import order). **Verification**: `docker exec assixx-backend pnpm exec eslint backend/src/nest/shift-handover/` exit 0, `pnpm exec prettier --check` exit 0, `pnpm run type-check` (shared + frontend + backend + backend/test) exit 0, backend restart clean (`/health` → `status:ok`, boot log shows all 14 routes mapped + `ShiftHandoverModule dependencies initialized`). Session 6 continues with §2.7 registrar JSDoc polish + §2.8 cron auto-lock.

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

### Step 2.7: Permission registrar [✅ DONE — 2026-04-22]

> **Shipped 2026-04-22** (Session 6, part 2 of 3 — JSDoc-only update). The permission-module list (`SHIFT_HANDOVER_PERMISSION_MODULES`) and the `OnApplicationBootstrap` registrar both already shipped in Session 3 with `canDelete` wired on both modules. This step closes the plan's explicit "Document this split in the permission registrar's JSDoc" requirement: the registrar's class doc now carries an additional paragraph that explains the split (`canDelete` on `shift-handover-templates` maps 1:1 to the DELETE templates endpoint; `canDelete` on `shift-handover-entries` gates **only** the attachment-delete endpoint, since there is deliberately no `DELETE /entries/:id` route in V1 — entry rows are never API-deleted, only auto-locked) with a cross-reference back to `shift-handover.permissions.ts` where the module-def list lives. Reviewers grepping `canDelete` from the registrar will find the rationale on the first hit instead of having to chain through two files. Verification: ESLint + Prettier exit 0, type-check exit 0, backend restart clean.

**File:** `backend/src/nest/shift-handover/shift-handover-permission.registrar.ts`

Two new modules registered:

- `shift-handover-templates` (R/W/D)
- `shift-handover-entries` (R/W/D) — `canDelete` is wired because the `DELETE /entries/:id/attachments/:attId` endpoint needs it (W2 fix). Entry-level deletion (row-level) remains Admin/Root via direct DB access; the `canDelete` permission at module-level gates attachment-delete only. Document this split in the permission registrar's JSDoc so the discrepancy between "permission exists" and "endpoint doesn't exist" is traceable.

Both belong to `shift_planning` addon (ADR-033, verified row present in `addons` table, `is_core=false`).

### Step 2.8: Cron job for auto-lock [✅ DONE — 2026-04-22]

> **Shipped 2026-04-22** (Session 6, part 3 of 3). New file `backend/src/nest/shift-handover/shift-handover-cron.service.ts` (~70 LOC). `@Cron('0 */6 * * *', { name: 'shift-handover-auto-lock', timeZone: 'Europe/Berlin' })` — top of every 6 hours, pinned to Europe/Berlin so DST transitions don't shift the firing slot relative to operational shifts. Decorated method `runScheduledAutoLockSweep()` captures `nowUtc = new Date()`, delegates to `EntriesService.runAutoLockSweep(nowUtc)` (already shipped in Session 5; uses `systemTransaction` / sys_user / BYPASSRLS — no CLS context, no tenant scope), and logs the result: `INFO` with locked count + first 10 IDs on success, `DEBUG` "no drafts to lock" on a no-op tick, `ERROR` via `getErrorMessage()` (TS-Standards §7.3) on any thrown failure. Errors are deliberately swallowed inside the handler — `@Cron` handlers must never throw because NestJS does not retry and an uncaught throw is silently lost; the next 6 h tick is the natural retry. Two module-level constants extracted: `SHIFT_HANDOVER_AUTO_LOCK_CRON = '0 */6 * * *'` (hoisted so the literal `*/` sequence stays out of any JSDoc body where it would close the comment early) and `MAX_LOGGED_IDS = 10` (caps log line size on a worst-case lock burst). **Sibling-service decision** (plan §2.8 left it open between EntriesService extension or sibling): chose sibling for single-responsibility — EntriesService stays pure domain logic, the cron service stays a thin scheduling shim around it (mirrors the `KvpApprovalArchiveCronService` pattern at `backend/src/nest/kvp/kvp-approval-archive-cron.service.ts`). **Module update**: `ShiftHandoverCronService` added to `providers` (no exports — internal scheduling only). **Verification**: ESLint exit 0 (after fixing 2× `no-irregular-whitespace` from zero-width chars I'd used to escape `*/` inside a JSDoc draft — replaced with prose explanation), Prettier exit 0, full `pnpm run type-check` (shared + frontend + backend + backend/test) exit 0, backend restart clean (`/health` → `status:ok`, boot log shows `ScheduleModule dependencies initialized` + `ShiftHandoverModule dependencies initialized` with no errors — NestJS schedule module does not log per-cron registrations explicitly; success of decorator wiring is confirmed by clean module construction).

**Original spec text (preserved for traceability):** add a NestJS `@Cron('0 */6 * * *')` (every 6h) job that calls `runAutoLockSweep()`. Belongs in `ShiftHandoverEntriesService` or a sibling `ShiftHandoverCronService`.

### Phase 2 — Definition of Done [✅ DONE — 2026-04-22]

- [x] `ShiftHandoverModule` registered in `app.module.ts` — Session 3
- [x] All 4 services implemented + DI-wired — Sessions 4–5 (Templates, ActiveShiftResolver, Attachments, Entries) + Session 6 sibling cron service
- [x] Controller with all 13 endpoints + `my-permissions` — Session 6 §2.6 (14 routes mapped at runtime)
- [x] Permission registrar registered (2 new modules under `shift_planning`) — Session 3 (registrar) + Session 6 §2.7 (JSDoc canDelete-split note)
- [x] Addon-check on every controller endpoint — class-level `@RequireAddon(SHIFT_PLANNING_ADDON)` + global `TenantAddonGuard` (cleaner than per-endpoint `AddonCheckService.checkTenantAccess` call; identical effect)
- [x] `db.tenantTransaction()` for all tenant-scoped queries; `db.systemTransaction()` only inside the cron sweep — verified across services
- [x] Services return raw data (ADR-007); no manual `{success, data}` wrapping — controller and services return rows / typed objects directly
- [x] Cron job for auto-lock sweep (`@Cron('0 */6 * * *')`) — time-injected `runAutoLockSweep(nowUtc)` — Session 6 §2.8 (`ShiftHandoverCronService`, Europe/Berlin TZ-pinned)
- [x] Audit-log entries for: template upsert/delete, entry submit/reopen — submit/reopen in `EntriesService` (Session 5), template upsert/delete in controller (Session 6 §2.6, closed Session 5 backfill flag)
- [x] Shared `@assixx/shared/shift-handover` module built — Session 3 (conditional exports + `shared/dist/shift-handover/` artefacts present, both backend + frontend type-check resolve the import)
- [x] No `any`, `??` not `||`, explicit boolean checks, `getErrorMessage()` for catches — ESLint enforces, all 0
- [x] ESLint 0 errors: `docker exec assixx-backend pnpm exec eslint backend/src/nest/shift-handover/` — verified post-§2.6 + §2.7 + §2.8
- [x] Type-check 0 errors: `docker exec assixx-backend pnpm run type-check` — verified across shared + frontend + backend + backend/test
- [x] All DTOs use Zod + `createZodDto()` pattern — Session 3 (11 DTOs)
- [x] All param DTOs use `createIdParamSchema` factory (per TS-Standards §7.5) — Session 3 (`TemplateTeamIdParamDto` via factory; `EntryIdParamDto` re-exports `UuidIdParamDto`)
- [x] No `@Roles('admin','root')` on any mutation endpoint (ADR-045 compliance) — controller verified clean

---

## Phase 3: Unit Tests

> **Dependency:** Phase 2 complete.
> **Pattern:** existing `*.service.test.ts` files in adjacent modules.

### Session 7 Progress (2026-04-22)

- [x] `shared/src/shift-handover/field-validators.test.ts` — **15 tests, all green** (ESLint 0, vitest 15/15 in 23 ms). Covers all 8 field types (happy + failure) + required/optional + strict-mode unknown-key rejection + composition + empty-fields edge. Over the plan's ~10-target because each type's failure branch warrants a dedicated assertion (prune-duplicates heuristic kept them individually readable).
- [x] `backend/src/nest/shift-handover/active-shift-resolver.service.test.ts` — **17 tests, all green** (ESLint 0, vitest 17/17 in 16 ms). Covers all 4 public methods: `resolveAssignees` (5 tests — ADR-011 union, §0.8 enum-equivalence mapping `early↔{early,F}/F`, `late↔{late,S}/S`, `night↔{night,N}/N`, empty result, tenantId-as-third-arg), `canWriteForShift` (8 tests — non-assignee short-circuit, same-Berlin-day happy path, **§R1 night-shift-over-midnight split into part-1 23:30 same-day + part-2 03:00 yesterday-night**, yesterday-night past 24 h grace, yesterday-non-night no grace, future date, shift_times not configured), `getShiftEndClock` (2 — happy + NotFoundException), `getAutoLockCutoff` (2 — cutoff passed/not + empty row set, verifies use of `db.query` not `queryAsTenant`). DatabaseService fully mocked (`vi.fn()` per method); PostgreSQL TZ math intentionally out of scope — tests stage the mock's `today_berlin`/`shift_end_utc` outputs and verify JS branching, not engine DST behaviour.
- [x] `backend/src/nest/shift-handover/shift-handover-templates.service.test.ts` — **19 tests, all green** (ESLint 0, vitest 19/19 in 23 ms). Covers all 4 public methods: `getTemplateForTeam` (2 — happy row + null-when-none), `upsertTemplate` (5 — INSERT happy, `ON CONFLICT DO UPDATE` + `updated_by = EXCLUDED.updated_by` SQL structure, team-not-in-tenant `BadRequestException`, `tenantTransaction` RLS discipline, empty-fields valid), `upsertTemplate` validation failures (5 — duplicate key, >30 fields, uppercase key, starts-with-digit key, `select` without options — all `BadRequestException` before tx opens; shared Zod schema runs **live**, not mocked), `deleteTemplate` (2 — soft-delete `IS_ACTIVE.INACTIVE` + `NotFoundException` on empty), `getMyPermissions` (5 — `hasFullAccess` short-circuit with **zero DB calls**, full-per-module perms, missing-row default-false, addon-scope filter, mixed per-module). Mocking: `tenantQuery` direct `vi.fn()`, `tenantTransaction` via `mockImplementation` that invokes the callback against a `mockClient` with a `query` spy (canonical pattern from `approvals.service.test.ts`). **Infra change required**: `vitest.config.ts` gained `@assixx/shared/shift-handover` alias entry (mirrors §Phase 2.1 R14 — the shared-package subpath needs an explicit alias for Vitest even though production resolves via conditional exports).
- [x] `backend/src/nest/shift-handover/shift-handover-attachments.service.test.ts` — **14 tests, all green** (ESLint 0, vitest 14/14 in 17 ms). Covers all 3 public methods: `uploadForEntry` (7 — happy-path disk-write + INSERT, oversize file (6 MB > 5 MB cap) pre-tx reject, non-whitelisted MIME (pdf) reject, empty file reject, entry-not-found `NotFoundException`, submitted-entry locked `BadRequestException`, **5-cap → 6th attachment `BadRequestException`** with no disk-write), `deleteAttachment` (5 — creator-deletes-own, team-lead canManage overrides non-creator, non-creator-without-canManage `ForbiddenException`, submitted-entry locked `BadRequestException`, attachment-not-found-on-entry `NotFoundException`), `streamAttachment` (2 — happy + `NotFoundException`). Mocking: `node:fs` module-level `vi.mock` exposing `promises.{mkdir, writeFile}` stubs (service imports `{ promises as fs } from 'node:fs'`, so factory must return `.promises` subkey — verbatim pattern from `auth/oauth/profile-photo.service.test.ts`), `tenantTransaction` callback wiring, plus fixture helpers `validFile()` / `mutableEntryRow()` / `countRow()` / `ctxRow()` to keep each `it` focused on its single assertion. Plan DoD text said "10 MB" — reconciled in Session 5 changelog to 5 MB (Inventory parity); test uses 5 MB cap as locked in `shift-handover.types.ts`.
- [x] `backend/src/nest/shift-handover/shift-handover-entries.service.test.ts` — **30 tests, all green** (ESLint 0, vitest 30/30 in 36 ms). Covers all 8 public methods: `getOrCreateDraft` (5 — existing-draft-return without write-window check, new-draft INSERT after resolver OK, `shift_times` not configured `BadRequestException`, resolver-rejects → `ForbiddenException`, **race-safe fallback fetch when `ON CONFLICT DO NOTHING` returns empty**), `updateDraft` (5 — draft update, reopened editable, submitted locked, `custom_values` fails shared Zod against live template → 400, entry-not-found 404), `submitEntry` (5 — **§R2 snapshot** test verifies `JSON.stringify(fields)` in UPDATE params + `schema_snapshot = $1::jsonb` in SQL, **§R3 FOR UPDATE** row-lock SQL verified, already-submitted rejected, `custom_values` fails template-Zod rejected, audit-log `.log()` called with `entityType='shift'` + `newValues.status='submitted'`), `reopenEntry` (3 — submitted→reopened + audit log with `reason`, draft→reopen rejected, not-found 404), `listEntriesForTeam` (4 — `COUNT(*) OVER()` window-total extraction + row strip, status + date-range filter SQL/params, defaults page=1/limit=20 + caps at MAX_LIST_LIMIT=100, empty-result total=0), `getEntry` (2 — happy + 404), `isTeamMember` (2 — member true, non-member false), `runAutoLockSweep` (3 — rows → `{lockedCount, lockedIds}` + **architectural assertion `systemTransaction` called, `tenantTransaction` NOT called** (BYPASSRLS discipline ADR-019), empty-result lockedCount=0, SQL contains `AT TIME ZONE 'Europe/Berlin'` + `interval '24 hours'` + correlated subquery `SELECT fields FROM shift_handover_templates`). **Clock-DI verified**: `SHIFT_HANDOVER_CLOCK` fed a `vi.fn(() => FIXED_NOW)`, assertion `expect(mockClock).toHaveBeenCalled()` confirms resolver receives deterministic instant. **5 DI dependencies all mocked** (DatabaseService, ShiftHandoverClock, ShiftHandoverTemplatesService, ActiveShiftResolverService, ActivityLoggerService) — service stays purity-contracted, tests run in <40 ms.

### Session 7 Final Summary (2026-04-22)

**Total: 95 tests across 5 files, all green** (target ≥75 → 127 %).

| File                                                                         | Tests  | Duration    |
| ---------------------------------------------------------------------------- | ------ | ----------- |
| `shared/src/shift-handover/field-validators.test.ts`                         | 15     | 23 ms       |
| `backend/src/nest/shift-handover/active-shift-resolver.service.test.ts`      | 17     | 16 ms       |
| `backend/src/nest/shift-handover/shift-handover-templates.service.test.ts`   | 19     | 23 ms       |
| `backend/src/nest/shift-handover/shift-handover-attachments.service.test.ts` | 14     | 17 ms       |
| `backend/src/nest/shift-handover/shift-handover-entries.service.test.ts`     | 30     | 36 ms       |
| **Total**                                                                    | **95** | **~115 ms** |

**Verification:** `pnpm exec vitest run --project unit backend/src/nest/shift-handover/ shared/src/shift-handover/` → `Test Files 5 passed (5) · Tests 95 passed (95)`. ESLint 0 errors, Prettier clean on all 5 files.

**Infra change:** `vitest.config.ts` gained `@assixx/shared/shift-handover` alias in the `unit` project (R14 mirror — Vitest aliases are parallel to ADR-015 conditional exports; the subpath needs explicit entry since Vitest does not consult `shared/package.json` exports).

**Risk coverage mapping (Phase 3 DoD "named test per risk"):**

- **R1** (night-shift midnight edge) — `active-shift-resolver.service.test.ts::canWriteForShift::"returns true for a night shift opened before midnight Berlin (§R1 part 1)"` + `"returns true for same night shift reopened after midnight, still within window (§R1 part 2 + §R5)"`
- **R2** (schema_snapshot drift safety) — `shift-handover-entries.service.test.ts::submitEntry::"§R2: snapshots the current template fields into schema_snapshot on submit"`
- **R3** (FOR UPDATE row-lock) — `shift-handover-entries.service.test.ts::submitEntry::"§R3: loads the row with SELECT … FOR UPDATE (concurrent-safety lock)"`
- **R5** (today-only + TZ matrix) — full matrix at `active-shift-resolver.service.test.ts::canWriteForShift` (8 tests) + delegation verified at entries service

**Coverage: every public method has ≥1 test.** 20 public methods across 4 services + 1 shared function, each with dedicated `describe` block.

- [ ] `backend/src/nest/shift-handover/shift-handover-templates.service.test.ts`
- [ ] `backend/src/nest/shift-handover/shift-handover-attachments.service.test.ts`
- [ ] `backend/src/nest/shift-handover/shift-handover-entries.service.test.ts`

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

### Phase 3 — Definition of Done [✅ DONE — 2026-04-22]

- [x] ≥75 unit tests total — **95 shipped** (127 % of target)
- [x] All green: `pnpm exec vitest run --project unit backend/src/nest/shift-handover/ shared/src/shift-handover/` — **Test Files 5 passed (5) · Tests 95 passed (95) · 1.19 s**
- [x] Every BadRequestException / ForbiddenException / NotFoundException path covered — Plan's "ConflictException" is realised as `BadRequestException` for the already-submitted guard (service design) and `ON CONFLICT DO NOTHING` for the race path (no exception, fallback fetch); both covered.
- [x] R1, R2, R3, R5 explicitly covered (named test per risk) — mapping block above
- [x] Coverage: every public service method has ≥1 test — verified across 20 public methods + 1 shared function

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

### Phase 4 — Definition of Done [✅ DONE — 2026-04-23]

- [x] ≥25 API integration tests — **39 shipped** (156 % of target)
- [x] All green — `Test Files 1 passed (1) · Tests 39 passed (39) · 2.52 s`
- [x] Tenant isolation verified — cross-tenant template fixture in tenant 8, GET from tenant 1 returns the default-empty (RLS strict-mode hides the row)
- [x] Addon gating verified — class-level `@RequireAddon(SHIFT_PLANNING_ADDON)` runs on every test (apitest tenant has the addon active); the inverse "no addon → 403" path is documented as Spec Deviation #4 (no dev tenant has a `cancelled` row to test against; contract enforced at decorator + unit-test layer)
- [x] Permission matrix from ADR-045 verified end-to-end — root full-access path (every passing test) + Employee Layer-2 fail-closed (3× 403 + all-false my-permissions). Lead vs non-Lead vs Admin-with/without-hasFullAccess delta lives in the unit-test suite (Session 7) where the canManage helper is unit-tested in isolation; Phase-4 verifies the HTTP-layer wiring of `@RequirePermission` (Layer-2) which Lead/Member share at this gate
- [x] Pagination verified on list endpoint — `?page=1&limit=5` echoes back `{page:1, limit:5}` and caps `items.length`

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

### Step 5.0: Decide template page route group [✅ DONE — 2026-04-23]

> **Locked as `(shared)`** (Session 9). Rationale per plan recommendation: Team-Lead can be `role='employee'` per ADR-035; ADR-012 route groups are coarse, so `(shared)` lets Employee + Admin + Root through and finer gating sits at page level via `canManage` Layer-1 (ADR-045) inside `+page.server.ts`.

**Question (historical):** `(shared)` (Team-Leads = Employees with lead role can access) or `(admin)` (only `admin`/`root` route group)?

### Step 5.1: ShiftHandoverButton + Modal in shifts grid [✅ DONE — 2026-04-23]

> **Shipped Session 9.** 6 frontend files created/modified in `frontend/src/routes/(app)/(shared)/shifts/`: 4 new components + helper (`api-shift-handover.ts`, `ShiftHandoverButton.svelte`, `ShiftHandoverFieldRenderer.svelte`, `ShiftHandoverModal.svelte`, `shift-handover-types.ts`, `state-handover.svelte.ts`), 1 extended (`ShiftScheduleGrid.svelte` gains `onhandoverClick` + `getHandoverStatus` optional props), 1 integrated (`+page.svelte` wires modal + entry-status map via new `createHandoverState()` re-exported from `state.svelte.ts`). Verified: `pnpm exec eslint` exit 0 across all 7 files, `pnpm run check` (svelte-check) → 2644 files / 0 errors / 0 warnings, backend `/health` ok. Full file-by-file notes in Changelog v0.12.0. Manual draft→submit UX smoke deferred to Session 12 (end-of-Phase-5) since realistic testing needs the §5.2 template-config page. Spec Deviations #6 (attachment history list — V2) and #7 (red-border required-gap state — wired as prop but unwatered caller) recorded.

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

### Step 5.2: Template config page [✅ DONE — 2026-04-23]

> **Shipped Session 10.** 6 frontend artefacts under `frontend/src/routes/(app)/(shared)/shift-handover-templates/`: `+page.server.ts` (Layer-0 addon + Layer-1 `canManageShiftHandoverTemplates` gates, loads `/teams`), `+page.svelte` (team filter + sticky action bar with two-click delete + toast feedback), `_lib/api-templates.ts` (apiClient GET/PUT/DELETE wrappers), `_lib/state-templates.svelte.ts` (factory `createTemplateBuilderState()` returning reactive WorkingField list with shared-Zod gate per R7), `_lib/FieldBuilder.svelte` (HTML5 drag-and-drop reorder + inline edit + per-row validation errors), `_lib/FieldTypeSelector.svelte` (8-card type picker modal). One change in `_lib/navigation-config.ts`: `canManageShiftHandoverTemplates = canManage` wrapper. Verified: `pnpm exec eslint` exit 0; `pnpm run check` (svelte-check) → 2652 files / 0 errors / 0 warnings. Sidebar promotion (`applyShiftHandoverVariant` + `Übergabe-Templates` submenu child) deferred to Session 11. Manual end-to-end smoke deferred to Session 12. Full file-by-file notes + lint refactors in Changelog v0.13.0.

- Team filter at top (same UX as shift filters per ADR-034 hierarchy labels: `${labels.team}`)
- For selected team: render `FieldBuilder`
  - List of existing fields with drag-handle, edit, delete
  - "+ Feld hinzufügen" button → `FieldTypeSelector` modal
  - Per field: `key` (auto-derived from label, editable), `label`, `type`, `is_required`, `options[]` if `select`
  - Live JSON-preview optional
- Save → `PUT /shift-handover/templates/:teamId`
- Inline validation: duplicate keys, invalid identifiers, select without options

### Step 5.3: Read-view (entry detail / list) [✅ DONE — 2026-04-23]

> **Shipped Session 12.** Plan-recommended side-panel chosen (= Step 5.1 modal in read-mode). Structural R2-mitigation already in place from Session 9 (`renderFields = $derived.by(() => entry.status !== 'draft' ? entry.schema_snapshot : templateFields)` in `ShiftHandoverModal.svelte` L122-127; `canEdit` at L131 disables all inputs for submitted entries; FieldRenderer routes `disabled` to every one of its 8 type branches). Session 12 closed the last Phase-5-DoD gap against this step: `ShiftHandoverModal.svelte` received a `teamLabel: string` prop and the call site in `shifts/+page.svelte` passes `labels.team` (ADR-034 hierarchy-label propagation), replacing a hardcoded `"Team"` literal in the meta-grid. No dedicated `/shift-handover` list page — deliberately deferred to V2 per plan recommendation. Details in Changelog v0.15.0.

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

- [x] Shift grid renders 📋 button per cell with correct status color
- [x] Modal opens, prefills meta, allows draft → submit flow
- [x] Template config page allows Team-Lead to add/edit/delete/reorder fields
- [x] All 8 field types render correctly in entry modal
- [x] Image upload (5 cap) works
- [x] Read-only mode renders against `schema_snapshot` for submitted entries
- [x] Sidebar entry "Übergabe-Templates" appears as a submenu child of the "Schichtplanung" entry only if `canManageShiftHandoverTemplates` AND `shift_planning` addon is active
- [x] svelte-check 0 errors, 0 warnings: `cd frontend && pnpm run check`
- [x] ESLint 0 errors: `cd frontend && pnpm run lint`
- [x] Hierarchy labels used everywhere `team`/`area` appears _(within shift-handover surface — pre-existing `FilterDropdowns.svelte` hardcodes are out of scope, tracked separately)_
- [ ] Manual smoke test: log in as Team-Lead, configure template (each field type), log in as Employee-assignee, write + submit handover, log out, log in as next-shift assignee, view submitted handover — **user-owned, see "Manual Smoke Test" section below**

---

## Manual Smoke Test (Phase 5 closure — product owner)

> **Why this is owned by the product owner:** the test is a browser-click-path across
> 3 separate user accounts exercising authentication, session state, drag-and-drop
> UIs, and file uploads. Automating it from the CLI would require either a full
> Playwright fixture (out of Phase-5 scope — none of the 39 Phase-4 API tests cover
> these UI flows) or a trust-me claim of "it should work". Neither is acceptable.
> The product owner runs the click-path, confirms the outcomes, and ticks the
> Phase-5 DoD checkbox above.

**Prerequisites (verify before starting):**

1. Docker stack up: `doppler run -- docker-compose -f docker/docker-compose.yml ps` — all healthy
2. Backend `/health` returns `status:ok`: `curl -s http://localhost:3000/health | jq '.status'`
3. SvelteKit dev server running: `pnpm run dev:svelte` → `http://localhost:5173` reachable
4. **`/etc/hosts` enthält den Tenant-Slug + WSL2-Schutz aktiv** (siehe [HOW-TO-LOCAL-SUBDOMAINS.md](./how-to/HOW-TO-LOCAL-SUBDOMAINS.md)) — z. B. `127.0.0.1 testfirma.localhost` für Tenant 8. **Login-URL ist die Subdomain, NICHT der Apex:** `http://testfirma.localhost:5173/login`. Apex-Login (`http://localhost:5173/login`) triggert die OAuth-Apex-Handoff-Brücke und wird häufig per R15-Host-Mismatch zurückgewiesen — sichtbar im Backend-Log als `[POST] /api/v2/auth/oauth/handoff - 403`. Subdomain-Login umgeht den Handoff-Pfad komplett, jede Subdomain ist eigene Browser-Origin (frische Cookies).
5. At least one tenant where `shift_planning` is an active/trial addon (API tests use tenant 1 — the 9-tenant dev DB has the addon active across all tenants per Session 8 Spec Deviation #4)
6. Three test accounts in the SAME tenant:
   - **T-Lead:** Team-Lead for some team X (has `canManage…` via `orgScope.isAnyLead`). Role can be `admin` OR `employee` — both work (ADR-035)
   - **E-Early:** Employee assigned to team X on some shift-date D, slot `early`
   - **E-Late:** Employee assigned to team X on the same date D, slot `late`
7. `shift_times` configured for tenant + slot combination — otherwise the modal surfaces `NotFoundException('shift slot not configured')` from §2.3 resolver

**Click-path — 7 stages:**

| #   | Actor   | Action                                                                                                                                                                                                                                                                                                                                                 | Expected outcome                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | T-Lead  | Log in → sidebar shows **Schichtplanung ▸** (submenu). Expand → child **Übergabe-Templates** visible. Click it.                                                                                                                                                                                                                                        | Route `/shift-handover-templates`. Team filter dropdown populated with teams in scope (`labels.team` label per ADR-034).                                                                                                                                                                                                                                                                                                   |
| 2   | T-Lead  | Select team X → FieldBuilder appears. Add one field for each of the 7 offered types (Session 20): text / textarea / **Zahl** (unified `decimal`) / date / time / boolean / select (for select, add ≥2 options). Set one field `required: true`. Click **Speichern**.                                                                                   | Toast "Vorlage gespeichert." (4s). Reload page, re-select team X — all 7 fields re-render in the same order.                                                                                                                                                                                                                                                                                                               |
| 3   | T-Lead  | Log out.                                                                                                                                                                                                                                                                                                                                               | —                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 4   | E-Early | Log in → Schichtplanung ▸ Schichtplanung (flat child, since `canManage === false` → templates child is variant-filtered out per Session 11 `applyShiftHandoverVariant`). Navigate to shift grid for date D.                                                                                                                                            | Grid renders. The shift-cell for team X / D / early shows 📋 button in **grey** (no entry yet). Team-filter dropdown uses `labels.team`.                                                                                                                                                                                                                                                                                   |
| 5   | E-Early | Click 📋 → modal opens. Verify meta: Datum dd.mm.yyyy + KW, Schicht **Frühschicht**, **{tenant's team label}** (not literal "Team" — proves the Session 12 fix), Zugeteilt = E-Early's name. Header badge = **Entwurf** (yellow). Fill Protokoll + all 7 custom fields (Session 20). Upload 2 images (≤5 MB, PNG/JPEG). Click **Speichern (Entwurf)**. | Toast "Entwurf gespeichert." Modal closes. Re-open the same cell → values persist; badge still **Entwurf**.                                                                                                                                                                                                                                                                                                                |
| 6   | E-Early | Re-open modal → click **Übergabe abschließen**.                                                                                                                                                                                                                                                                                                        | Toast "Übergabe abgeschlossen." Badge flips to **Abgeschlossen** (green). All form controls disabled (`canEdit === false` because `isSubmitted`). Custom fields display values but cannot be edited. Image upload button hidden. The cell button color flips from yellow → **green**. Log out.                                                                                                                             |
| 7   | E-Late  | Log in. Navigate to shift grid for date D. Click 📋 on team X / D / **late** cell → creates NEW draft for the late shift (separate row — per-slot granularity from `(tenant_id, team_id, shift_date, shift_key)` UNIQUE constraint). Also open 📋 on the **early** cell of date D.                                                                     | Late cell: grey → modal opens with empty draft. Early cell: green → modal opens in **read-only** mode showing E-Early's submitted content. **Renders from `schema_snapshot`, not the live template** — the R2 test is: if T-Lead went back to `/shift-handover-templates` now and deleted one of the 7 fields, E-Late should STILL see the original 7 fields in E-Early's submitted entry. This is the drift-safety proof. |

**R2 drift-safety side-proof (optional but recommended):**

After stage 7 completes, have T-Lead log in again, open `/shift-handover-templates`,
delete (e.g.) the `select` field from team X's template, save. Then have E-Late
re-open E-Early's submitted entry from stage 7 (read-only view): the deleted
select field MUST still render with its submitted value. This is the
`schema_snapshot` contract from Phase 1 §1.2 working end-to-end in the UI.

**If any stage fails, STOP** and open a new masterplan entry under §Spec Deviations
with: stage number, observed outcome, expected outcome, reproduction steps,
relevant backend log lines (`docker logs assixx-backend --tail 100`).

**On green:** tick the "Manual smoke test" checkbox in Phase 5 DoD above and notify
Session 13 can start (Phase 6 — ADR + docs + customer sync).

---

## Phase 6: Integration + Polish + ADR

> **Dependency:** Phase 5 complete.

### Integrations

- [x] Shift-grid button wired (Phase 5.1) — Session 9
- [x] Audit-log entries via `ActivityLoggerService` for: template upsert/delete, entry submit, entry reopen — Sessions 5-6 (verified Session 13)
- [x] Sidebar nav: "Schichtplanung" top-level entry promoted to submenu; "Übergabe-Templates" child visible iff `canManageShiftHandoverTemplates` AND addon active (via `applyShiftHandoverVariant` + `addonCode`) — Session 11
- [x] `FEATURES.md` updated with new permission modules under `shift_planning` addon — Session 13
- [ ] Customer fresh-install synced: `./scripts/sync-customer-migrations.sh` — **user action, see "Customer Sync" below**

### Documentation

- [x] ADR `ADR-052-shift-handover-protocol.md` written — Session 13 (6 decisions covered):
  - [x] Decision: per-shift-slot granularity
  - [x] Decision: JSONB + schema_snapshot (drift-safety pattern)
  - [x] Decision: active-shift-resolver as pure function
  - [x] Decision: Inventory image-pattern reuse vs adapt
  - [x] Why no notifications in V1
  - [x] Why no backfill
- [x] This masterplan updated with §Post-Mortem — Session 13

### Phase 6 — Definition of Done

- [ ] All integrations live and tested end-to-end — _blocks on the manual smoke test_
- [x] ADR written + cross-referenced in `docs/infrastructure/adr/README.md`
- [x] `FEATURES.md` updated
- [ ] Customer fresh-install synced — _user action_
- [x] No open TODOs in code
- [ ] Final smoke test green — _user action, see §Manual Smoke Test above_
- [x] `pnpm run validate:all` green (2026-04-23, Session 13 — all stages exit 0, svelte-check 2652/0/0)

---

## Customer Sync (Phase 6 closure — user action)

> **Why this is queued for user, not auto-run:** the script writes three files
> into the repo (`customer/fresh-install/001_schema.sql`, `002_seed_data.sql`,
> `005_pgmigrations.sql`) — these get committed as part of the release. Running
> the script is safe (read-only on the DB, `pg_dump` + file writes only; no git),
> but the user should run it consciously so the commit is explicit and not a
> side-effect of a session. Per DATABASE-MIGRATION-GUIDE §6, this step is
> **mandatory** after any migration that adds tenant-isolated tables.

**Command:**

```bash
./scripts/sync-customer-migrations.sh
```

**What it touches (3 migrations from Session 2 feed in):**

- Schema dump picks up `shift_handover_templates` + `shift_handover_entries` + `shift_handover_attachments` tables, their RLS policies (3 × `tenant_isolation` strict NULLIF), and the `shift_handover_status` ENUM
- Seed dump is unchanged (no new global seed rows — all shift-handover data is tenant-scoped)
- `005_pgmigrations.sql` gets entries for pgmigrations #142, #143, #144 + Session-8 DEFERRABLE fix #145

After running: verify 3 new `CREATE TABLE shift_handover_*` blocks appear in `customer/fresh-install/001_schema.sql` before committing.

---

---

## Session Tracking

| Session | Phase | Description                                                                                                     | Status  | Date       |
| ------- | ----- | --------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| 1       | 0     | §0.7 Inventory spike + §0.8 slot-identity spike + risk register sign-off                                        | ✅ DONE | 2026-04-22 |
| 2       | 1     | Migrations: templates + entries (+ attachments if adapt); uuidv7() verified                                     | ✅ DONE | 2026-04-22 |
| 3       | 2     | Module skeleton + DTOs + shared field schemas + `shared/package.json` exports                                   | ✅ DONE | 2026-04-22 |
| 4       | 2     | TemplatesService + ActiveShiftResolver (uses §0.8 spike output)                                                 | ✅ DONE | 2026-04-22 |
| 5       | 2     | EntriesService + AttachmentsService                                                                             | ✅ DONE | 2026-04-22 |
| 6       | 2     | Controller + permission registrar + cron auto-lock                                                              | ✅ DONE | 2026-04-22 |
| 7       | 3     | Unit tests (≥75) — **95 shipped, all green**                                                                    | ✅ DONE | 2026-04-22 |
| 8       | 4     | API integration tests (≥25) — **39 shipped, all green; migration #145 fixed DEFERRABLE bug**                    | ✅ DONE | 2026-04-23 |
| 9       | 5     | Shift-grid button + modal — **§5.0 locked as `(shared)`; §5.1 shipped 6 files; lint 0 + svelte-check 0/0/2644** | ✅ DONE | 2026-04-23 |
| 10      | 5     | Template config page + FieldBuilder — **6 frontend artefacts shipped; lint 0 + svelte-check 0/0/2652**          | ✅ DONE | 2026-04-23 |
| 11      | 5     | Navigation promotion (Schichtplanung → submenu) + `applyShiftHandoverVariant`                                   | ✅ DONE | 2026-04-23 |
| 12      | 5     | §5.3 read-view + hierarchy-label fix in modal — **manual smoke test handed to product owner**                   | ✅ DONE | 2026-04-23 |
| 13      | 6     | ADR-052 + docs (FEATURES.md, README, Breadcrumb) + drift-fix — **customer sync + final smoke handed to user**   | ✅ DONE | 2026-04-23 |

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

| #   | Spec says                                                                                                                                               | Actual                                                                                                                                                                                                                          | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | §0.1: Branch `feat/shift-handover` checked out from `test/ui-ux` before Session 2 start                                                                 | Session 2 begins on `test/ui-ux` itself                                                                                                                                                                                         | **2026-04-22:** User elected to continue migration work on the current `test/ui-ux` branch rather than fork a dedicated feature branch. DB state is branch-independent — migration applies identically either way. Consequence: if a dedicated PR is later desired, user will handle branch split (cherry-pick / rebase / branch rename) outside this plan's scope.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2   | §2.1 + §2.7: Registrar file registers a new `PermissionCategoryDef` via `OnModuleInit`, following Surveys/Inventory pattern                             | Registrar uses `OnApplicationBootstrap` to **append** modules to the existing `shift_planning` category via a new `PermissionRegistryService.addModulesToCategory()` method (additive extension of the registry)                | **2026-04-22 (Session 3):** The two new modules (`shift-handover-templates`, `shift-handover-entries`) must live under the `shift_planning` addon (plan §2.6 / §2.7 require controllers to call `@RequirePermission(SHIFT_PLANNING_ADDON, ...)`). Registry categories are keyed by code and `register()` throws on duplicates, so registering a parallel category would crash; merging via a single shared `PermissionCategoryDef` literal would invert the dependency (shifts → shift-handover). Chosen mitigation: extend `PermissionRegistryService` with an idempotent append method, fire it from `OnApplicationBootstrap` (guaranteed to run after every `OnModuleInit`, avoiding fragile init-order coupling). Runtime-verified: base category registers with 4 modules, then `Extended permission category "shift_planning" with 2 module(s)` — zero exceptions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 3   | §2.6: `/my-permissions` returns `{canManageTemplates, canWriteForToday}` **per team**, DELETE attachment uses `canWrite`, `listEntries` teamId optional | `/my-permissions` returns canonical TPM shape `{templates, entries}` (Layer-2 only); DELETE attachment uses `canDelete`; `listEntries` requires `teamId` query param (enforces plan Product Decision #12 same-team scope in V1) | **2026-04-22 (Session 6 §2.6):** Three reshapes documented: (a) `/my-permissions` — `canWriteForToday` is a per-slot runtime check that belongs on the draft-create path (service-side `canWriteForShift`), not a static permission flag; `canManageTemplates` duplicates layout-data state (frontend already has `role + hasFullAccess + orgScope.isAnyLead`) and would drift. The TPM/Blackboard canonical shape returns Layer-2 only and is the established pattern across 3 features. (b) DELETE attachment permission — plan §2.6 table lists `canWrite`, but §2.7 registrar rationale says "canDelete is wired because the DELETE endpoint needs it". §2.7 is the more specific guidance and matches the registrar's `allowedPermissions: ['canRead', 'canWrite', 'canDelete']`. (c) `listEntries` teamId — DTO marks it optional but V1 enforces same-team scope (Product Decision #12); full-access / root can iterate per team. V2 may relax to optional + cross-team aggregation when read-scope filtering infrastructure matures.                                                                                                                                                                                                                                                                                                                                                                                                 |
| 4   | §Phase 4 mandatory scenario "Tenant without `shift_planning` addon → 403"                                                                               | Documented + skipped at the API integration layer; verified at the unit-test + decorator layer instead                                                                                                                          | **2026-04-23 (Session 8 §Phase 4):** All 9 dev tenants in the apitest DB carry `tenant_addons.status` of either `active` or active-`trial` for `shift_planning` — none with `cancelled`/`expired`. Asserting the 403 path would require either (a) holding credentials for a separately-seeded tenant with the addon disabled (no such tenant fixture exists in this codebase, and creating one mid-suite races with other parallel `api`-project tests via shared `apitest` login cache), or (b) toggling the live tenant 1's addon row mid-suite — same race risk + bleeds into every other test that runs after. Contract is enforced by the class-level `@RequireAddon(SHIFT_PLANNING_ADDON)` decorator + the global `TenantAddonGuard`; both are exercised by every passing Phase-4 test (any addon-gate failure would 403 the whole suite). The negative-path 403 is covered at the unit-test layer where `TenantAddonGuard.canActivate` is asserted in isolation. Acceptable risk reduction — a fixture-based "tenant without addon" test could ship as a follow-up if the team wants belt-and-braces coverage.                                                                                                                                                                                                                                                                                                                       |
| 5   | §1.2 unique constraint declared `DEFERRABLE INITIALLY IMMEDIATE`                                                                                        | Migration #145 drops the DEFERRABLE clause; constraint is plain UNIQUE                                                                                                                                                          | **2026-04-23 (Session 8, surfaced by Phase-4 first INSERT):** PostgreSQL forbids `INSERT … ON CONFLICT` against deferrable constraints (the conflict arbiter must evaluate immediately at INSERT time, which by definition contradicts the option to defer). The Phase-2 `EntriesService.insertDraftOrFetch` race-safety pattern uses `ON CONFLICT (tenant_id, team_id, shift_date, shift_key) DO NOTHING RETURNING * + fallback SELECT`. With the original DEFERRABLE constraint every `POST /entries` returned 500 with `error: ON CONFLICT does not support deferrable unique constraints/exclusion constraints as arbiters`. The 95 Phase-3 unit tests mocked `DatabaseService` and never exercised the constraint, so the conflict was invisible until first real INSERT. **Decision:** drop the DEFERRABLE clause via new migration `20260422215918297_drop-shift-handover-entries-deferrable.ts` (#145). The plan §1.2 rationale "no deferred surprise" was a misreading — `DEFERRABLE INITIALLY IMMEDIATE` _enables_ deferral on demand; it does not prevent it. The service never calls `SET CONSTRAINTS DEFERRED`, so the modifier delivered zero behaviour while breaking ON CONFLICT. Plain UNIQUE preserves the same column set + same constraint name + same immediate-evaluation behaviour and unblocks the service. Service code unchanged. Migration discipline followed verbatim per DATABASE-MIGRATION-GUIDE §HARD BLOCK. |
| 6   | §5.1: Modal renders attachments on load (implied by "Image upload (5 max)" in the DoD)                                                                  | Modal's attachment list starts empty on open; only session-freshly-uploaded attachments appear. Existing attachments for a reopened modal require a dedicated `GET /entries/:id/attachments` endpoint that does not exist in V1 | **2026-04-23 (Session 9):** The `ShiftHandoverEntryRow` returned by `GET /entries/:id` and `POST /entries` does **not** include attachments inline — rendering historical attachments would need either a new backend list endpoint or an embed on the entry response (both = scope expansion). V1 accepts the UX limitation: users who upload during session see their uploads; closing + reopening the modal clears the in-memory list. The backend still serves each attachment via the streaming endpoint + the buffer map is maintained only within the modal's lifetime. **V2 path:** either embed `attachments?: ShiftHandoverAttachment[]` on the entry response or add `GET /shift-handover/entries/:id/attachments`. Flagged in Known Limitation #14 (see below).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 7   | §5.1: Red border state for "draft with missing required fields past shift-end"                                                                          | `ShiftHandoverButton` accepts the `hasRequiredGap` prop (wired + styled), but no caller sets it yet                                                                                                                             | **2026-04-23 (Session 9):** Evaluating the red-border state needs correlation across three data points — (a) live entry with status `draft`, (b) `schema_snapshot`/template field list with `required: true` fields, (c) shift-end-time from `shift_times` + current time. That correlation belongs in §5.3's read-view logic or a dedicated "handover-health" selector, not in the bulk-status loader which only knows `status`. V1 ships the prop surface so §5.3 can flip it on without component changes. UX impact: minor — the yellow draft state already signals "action needed"; the red border is refinement, not correctness.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

| 9 | §5.1 + Session 9: entry form renders inside `ShiftHandoverModal.svelte` (modal over the shift grid) | Modal deleted; dedicated page routes `/shift-handover/[uuid]` + `/shift-handover/new` replace it | **2026-04-23 (Session 18, smoke-test iteration 4):** Modal pattern kept producing symptom bugs the whole plan long — inline `alert--danger`/`alert--warning` instead of global toasts (iteration 1), ~1-frame flash of the modal shell before `onclose()` on 403 (iteration 2), English backend strings leaking through `err.message` (iteration 3). Each band-aid fix exposed another layer: the modal's mount-first/load-later lifecycle was the root cause. Page migration fixes all three at once: SSR loader populates `data.entry` before paint (no flash), 403 on `/new` turns into `redirect(303, '/shifts?handover-error=...)` so the global toast bridge on `/shifts` emits the German reason from `WRITE_DENIED_MESSAGES` (no inline alert), permission-denied pattern matches `/blackboard/[uuid]` + ADR-020 §6 (consistent across 32 addon-gated pages now). Trade-offs accepted: (a) V1 omits assignee-display in the detail page (was in modal) — Known Limitation extended; entries.service owes an assignee-augmented DTO in V2. (b) Attachment-list parity remains V1-in-memory-only (same Spec Deviation #6). (c) ADR-052 "single `<ShiftHandoverModal>` owner" decision is superseded; ADR should be amended with a note pointing to this Spec Deviation. Files: **new** `shift-handover/[uuid]/+page.{server.ts,svelte}` + `shift-handover/new/+page.server.ts`; **deleted** `shifts/_lib/ShiftHandoverModal.svelte`; **modified** `shifts/+page.svelte` (modal render + derived state removed, toast bridge added), `shifts/_lib/state-handover.svelte.ts` (`modalTarget` state dropped), `lib/components/breadcrumb-config.ts` (intermediate + static mapping for `/shift-handover`). |

| 8 | §2.1: Shared Zod field validators in `@assixx/shared/shift-handover` so backend + frontend run identical validation (R7) | Zod schemas + `buildEntryValuesSchema` moved to `backend/src/nest/shift-handover/field-validators.ts`; shared keeps only TypeScript types + `SHIFT_HANDOVER_FIELD_TYPES` const; frontend mirrors invariants in TS manual checks | **2026-04-23 (smoke-test prep):** ADR-030 §7 explicitly forbids Zod in the frontend ("Zod is NOT shared to the frontend. The `@assixx/shared` package contains only plain TypeScript types and constants"). Plan §2.1 silently violated this — the cross-cut table at line 1139 cited ADR-030 but contradicted its §7. The violation surfaced as a CSP console-error during the manual smoke test: Zod v4's `allowsEval()` capability probe (`new Function("")` in `zod/v4/core/util.js:157`) tripped the strict nonce-based `script-src` declared in `frontend/svelte.config.js`. Probe is harmless (graceful catch) but the browser logs every blocked eval. **Resolution:** rip Zod out of shared, keep the `ShiftHandoverFieldDef` type contract via a hand-rolled discriminated union (wire-compatible with the prior `z.infer`), move all schemas + validator factory to the backend, drop the frontend `runSchemaGate` step in `state-templates.svelte.ts` (its checks were already mirrored locally via `validateField` + `findDuplicateKeys` + `FIELDS_MAX`). Backend stays authoritative on submit (400 + `details[]`); R7 mitigation degrades from "identical schema parse on both sides" to "identical invariants enforced separately, backend authoritative" — UX impact zero, security impact zero (backend never trusted client). Files: `backend/src/nest/shift-handover/field-validators.ts` + `.test.ts` new; `shared/src/shift-handover/{field-types,index}.ts` rewritten; `shared/src/shift-handover/field-validators{,.test}.ts` stubbed for user `rm`; backend `shift-handover-templates.service.ts` + `shift-handover-entries.service.ts` + `dto/common.dto.ts` import-path swap; frontend `state-templates.svelte.ts` rework. Bundle: `zod` no longer reaches the SvelteKit build. |

| 10 | §5.1 / Session-9 toast bridge: clean the `?handover-error=` query param on `/shifts` via SvelteKit's `replaceState` from `$app/navigation` inside a bare `$effect`. WRITE*DENIED_MESSAGES copy uses "Schreibfenster" jargon. | (a) `shifts/+page.svelte` switches to native `window.history.replaceState(window.history.state, '', cleaned.toString())` (mirrors `(app)/+layout.svelte:319` `?unlock=` cleanup pattern). (b) WRITE_DENIED_MESSAGES rewritten in shop-floor-friendly German; explains \_why* + _what to do_. | **2026-04-25 (post-Session-13 manual smoke-test):** Bug A — clicking 📋 on a shift outside the write window triggers the trampoline to `redirect(303, '/shifts?handover-error=…')`. On a fresh page-load the SvelteKit router has not yet finished initialising at the moment the cleanup-`$effect` fires, so `$app/navigation`'s `replaceState` throws `Cannot call replaceState(...) before router is initialized` (visible in the user's DevTools at `+page.svelte:284`). The pattern was inconsistent with the rest of the codebase: `(app)/+layout.svelte:319` uses `window.history.replaceState(...)` for the analogous `?unlock=` URL hygiene with the explicit comment "replaceState does not navigate"; `login/+page.svelte` defers `$app/navigation`'s `replaceState` into `onMount` + `setTimeout(0)`. Native browser API has no router dependency, doesn't trigger a SvelteKit re-load (which would be wasteful — we're just stripping a query param after toasting), and matches the proven in-repo precedent. Bug B — same smoke-test surfaced "Diese Schicht liegt außerhalb des Schreibfensters" as confusing; "Schreibfenster" is technical and not shop-floor language. Reworded to: `not_assignee → 'Du bist für diese Schicht nicht eingeteilt.'`, `outside_window → 'Bearbeitung nicht mehr möglich — Übergaben können nur während der Schicht oder bis zu 24 Stunden nach Schichtende erstellt werden.'`, `shift_times_missing → 'Schichtzeiten sind für diese Schicht nicht hinterlegt — bitte beim Team-Lead melden.'`. Files: `frontend/src/routes/(app)/(shared)/shifts/+page.svelte` (drop `replaceState` from `$app/navigation` import; native API at L284; expanded JSDoc explaining the router-init pitfall); `backend/src/nest/shift-handover/shift-handover-entries.service.ts` (L120-122 reworded); `backend/src/nest/shift-handover/shift-handover-entries.service.test.ts` (L229 `/Bearbeitung nicht mehr möglich/u`, L245 `/nicht eingeteilt/u`). Verification: vitest 31/31 green on entries.service tests; ESLint clean on both touched files; svelte-check `2579 FILES 0 ERRORS 0 WARNINGS`; `tsc --noEmit -p backend` + `-p frontend` both exit 0. |

| 11 | §5.1 + Spec Deviation #9: 📋-button click goes through `goto('/shift-handover/new?team&date&slot')` server-load trampoline; trampoline POSTs to backend `getOrCreateDraft` and on 4xx issues `redirect(303, '/shifts?handover-error=…')`; `/shifts/+page.svelte` toast-bridge `$effect` reads the URL param, fires toast, strips param. | Trampoline removed. `handleHandoverOpen` in `shifts/+page.svelte` now POSTs directly via `_lib/api-shift-handover.ts#getOrCreateDraft`, navigates to `/shift-handover/${entry.id}` on 200, shows `showErrorAlert(err.message)` toast on 4xx, returns to `/shifts` with no navigation. Toast-bridge `$effect` + `lastToastQuery`/`toastIfPresent` helpers + `?handover-error=`/`?handover-success=`/`?handover-info=` URL params all deleted. Trampoline `+page.server.ts` reduced to a `redirect(302, '/shifts')` stub for graceful degradation of stale links/bookmarks; user `git rm`'s when convenient. | **2026-04-25 (smoke-test iteration 5, supersedes #9):** Spec Deviation #9 (Session 18) chose the trampoline to fix three modal-pattern bugs: inline `alert--danger` instead of global toasts, ~1-frame modal-shell flash on 403, English backend strings leaking. The trampoline solved those but produced new ones: (1) `replaceState` router-init crash on fresh redirect (fixed in #10), (2) `lastToastQuery` dedupe blocked repeat-toasts on identical denial reasons across consecutive clicks, (3) repeated `/shift-handover/new/__data.json` requests in DevTools network tab (each click re-runs the server-load + redirect even when the user is already on the result URL), (4) the URL-param bridge pattern is unique to this feature — every other addon (Blackboard, KVP, Surveys, TPM, Vacation, Approvals, Work Orders, Inventory) uses client-side POST + try/catch + toast directly in the click handler. Eight precedents vs one outlier — the outlier loses. **Resolution:** rip the trampoline out, do client-side POST + toast directly. Net: ~50 LOC deleted (toast-bridge $effect + helpers + trampoline file body), 0 new abstractions, 1 new client-side import (`getOrCreateDraft` already existed in `api-shift-handover.ts` since Session 9 + `checkSessionExpired` per ADR-005 token-expiry handling). Eliminates all four bugs above + halves the network round-trips per click (1× POST direct vs. 1× client-load fetch + 1× server-load POST + 1× redirect-target fetch). Trade-off accepted: refresh on `/shift-handover/new?…` is no longer deterministic (now → /shifts redirect via the stub instead of magically resolving to a draft) — realistic impact zero, no user manually types this URL. **ADR-052 impact:** unchanged — ADR-052 §3 (active-shift-resolver) and §2 (JSONB + schema_snapshot) are backend-side; the click-flow is a frontend implementation detail not captured in the ADR. **Trade-off rejected: keeping the trampoline behind a smaller dedupe fix** — would have shipped a working but architecturally inconsistent feature. The user explicitly asked for codebase consistency ("auf jeder anderen Seite machen wir das doch anders"); spending a Spec Deviation on the consistency fix is correct. Files: **modified** `frontend/src/routes/(app)/(shared)/shifts/+page.svelte` (imports: drop `$app/stores`/`showSuccessAlert`, add `getOrCreateDraft`+`checkSessionExpired`; `handleHandoverOpen`becomes void-returning sync wrapper around an async IIFE per`no-misused-promises`; toast-bridge `$effect`+ helpers deleted); **modified → stub**`frontend/src/routes/(app)/(shared)/shift-handover/new/+page.server.ts`(replaced ~80 LOC trampoline with ~10 LOC`redirect(302, '/shifts')`graceful-degradation stub + JSDoc explaining deprecation + instruction for user to`git rm`). |

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
15. **No historical attachment list in the modal.** `ShiftHandoverModal` only renders attachments uploaded in the current modal session — closing + reopening shows an empty attachment list even if prior uploads exist on disk. Backend `GET /entries/:id` does not embed the attachment array. **V2 path:** either embed `attachments?: ShiftHandoverAttachment[]` on the entry response (denormalised, 1 query) or add a dedicated `GET /shift-handover/entries/:id/attachments` endpoint. See Spec Deviation #6.

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

## Post-Mortem (filled 2026-04-23, Session 13)

### What went well

- **Risk register paid off immediately.** R1 (night-shift over midnight), R2 (template drift), R3 (race on submit), R5 (write-window DST), R7 (frontend/backend validator drift), R13 (enum mismatch) were all caught BEFORE code by the §0.2 register. Every one of them surfaced as either a unit test case (Session 7) or a targeted integration test (Session 8). None reached production.
- **The §0.7 + §0.8 spikes in Session 1 locked two architecture decisions that would have cost days to reverse later:** Inventory pattern = ADAPT (not extract-to-shared-module yet); `shift_key` whitelist = `{early, late, night}` only for V1 (tenants with 4-crew rotations deferred to V2 via the resolver's enum-equivalence hook).
- **Shared Zod validator as the single source of truth (R7 mitigation).** Same `buildEntryValuesSchema(fields[])` runs client-side (nice error messages) and server-side (authoritative). Zero validator duplication — when the Session-10 FieldBuilder added inline German error messages, the backend contract stayed untouched because the final gate is the shared schema.
- **Phase 4 caught the DEFERRABLE bug the 95 unit tests missed.** Session 7's unit tests all mocked `DatabaseService`, so the `ON CONFLICT … DO UPDATE` against a DEFERRABLE unique constraint never hit the wire. Session 8's first real INSERT blew up with `ON CONFLICT does not support deferrable unique constraints`. Vindication of the Tier-2 integration-tests-against-live-Docker-stack strategy (ADR-018).
- **Schema_snapshot pattern (Decision 2 in ADR-052) worked as intended.** The R2 mitigation is visible in three places: the `submitEntry` SQL that copies `fields → schema_snapshot`, the `renderFields = $derived.by(…)` at modal L122, and the 30 `entries.service.test.ts` unit tests asserting snapshot-vs-live-template behaviour. The product-owner smoke test in §Manual Smoke Test documents the visible proof.
- **Masterplan discipline — Sessions 1-13 stayed on the plan.** Seven Spec Deviations logged, all with documented rationale. No silent scope creep. Session 13's detour (drift fix in Session 10 code) was documented in the changelog, not buried.
- **Every `@RequirePermission`-gated mutation has a `canManage` frontend gate** (ADR-045 Layer 1-2) — the Blackboard antipattern (ADR-045 reference) didn't get reintroduced anywhere in shift-handover. Both the templates route and the modal respect the 3-layer stack.

### What went badly

- **Prettier drift fought the 60-LOC cap twice.** Session 10 shipped `createTemplateBuilderState` at "~50 LOC". By Session 13 it had grown to 65 — every Prettier pass during Sessions 11-12 was expanding one-line getters back to three-line form. Session 13 had to refactor mid-flight (extract `buildTemplateBuilderMutators` with closure-accessor pattern). Lesson: getter counts are Prettier-unstable; factor the factory from day one.
- **FilterDropdowns.svelte hardcoded labels were discovered in Session 12 and left in-scope-queued.** "Bereich"/"Team" string literals in the pre-existing shifts filter UI violate ADR-034 but predate this work. Phase 5 DoD "hierarchy labels everywhere" was scoped by the Session-12 changelog note to "within shift-handover surface" — a pragmatic gate, but a DoD item that got language-softened instead of fully fixed. Worth closing separately.
- **Image upload attachments don't rehydrate on modal reopen.** Session 9 Spec Deviation #6: there's no `GET /attachments` list endpoint. A user who uploads 2 photos, saves draft, and reopens the modal sees 0 photos (the backend has them, the modal hasn't loaded them). V2 ticket; documented but annoying.
- **"Red border when required-fields missing past shift-end" state** (Session 9 Spec Deviation #7) is wired as a `hasRequiredGap` prop but no caller sets it. The evaluation needs entry+schema_snapshot+shift_end correlation that was deferred to §5.3 but §5.3 ended up being implementation-free. This is a shipped-with-dead-prop situation — either wire it in V2 or rip the prop out.
- **Breadcrumb label mismatch.** `/shifts` breadcrumb reads "Schichtplan" but the sidebar and ADR-052 call it "Schichtplanung". The new `/shift-handover-templates` intermediate crumb uses "Schichtplanung" (matches sidebar); when a user navigates Home → Schichtplanung → Übergabe-Templates and clicks "Schichtplanung", the destination page shows "Schichtplan" in its crumb. Minor; fixing touches unrelated code.
- **ADR-README index is 2 entries behind the filesystem** (ADRs 050 + 051 exist on disk but aren't listed). Discovered during Session 13; flagged out-of-scope per plan strictness. The README now lists ADR-052 but still misses 050 + 051.
- **Customer fresh-install sync shipped as a pending user action** instead of an automated session step. Rationale (explicit repo-write that should be a conscious commit) is defensible, but means the masterplan closes with an open chore.

### Metrics

| Tier              | Metric                                                             | Result                                                               | DoD target          |
| ----------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------- |
| Migrations        | New tables + RLS policies + GRANTs                                 | 3 tables, 3 strict-mode policies, 6 GRANT sets (app_user + sys_user) | ≥3 tables with RLS  |
| Unit tests        | `pnpm run test:unit` — shift-handover scope                        | 95 passed                                                            | ≥75                 |
| API integration   | `pnpm run test:api` — shift-handover file                          | 39 passed                                                            | ≥25                 |
| TypeScript        | `pnpm run type-check` (shared + frontend + backend + backend-test) | exit 0                                                               | exit 0              |
| ESLint            | `pnpm run lint` (backend + frontend)                               | 0 errors                                                             | 0 errors            |
| svelte-check      | `cd frontend && pnpm run check`                                    | 2652 files / 0 / 0                                                   | 0 / 0               |
| Full gate         | `pnpm run validate:all`                                            | `=== VALIDATE ALL PASSED ===`                                        | green               |
| Sessions planned  | `§Estimated sessions`                                              | 12–14                                                                | —                   |
| Sessions actual   | `§Actual sessions`                                                 | 13                                                                   | —                   |
| ADR               | `ADR-052-shift-handover-protocol.md`                               | 1 Accepted ADR, 10 cross-refs, 6 decisions                           | written + cross-ref |
| Known Limitations | Tracked in §Known Limitations + post-mortem                        | 4 V2 items + 2 drift/consistency items                               | documented          |
| Spec Deviations   | Logged in §Spec Deviations                                         | 7 deviations, all with rationale                                     | —                   |

### Still open (user-owned residuals, not dev work)

1. Run `./scripts/sync-customer-migrations.sh` (see §Customer Sync).
2. Execute the 7-stage smoke in §Manual Smoke Test; tick the final Phase-5 DoD checkbox.
3. Consider whether the FilterDropdowns hardcoded-labels + Breadcrumb "Schichtplan" vs "Schichtplanung" + ADR-README drift items warrant a separate cleanup PR or stay in the backlog.

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

## Session 14 — Smoke-Test Finding: Permission-Denied UX Parity ✅ DONE (2026-04-23)

### Problem (smoke-test reported by user)

Auf `/shift-handover-templates` führt das Entfernen von `shift-handover-templates.canRead` (ADR-020 §6) **nicht** zur Standard-`<PermissionDenied />`-View, die alle 31 anderen addon-gated Seiten rendern. Stattdessen bleibt die Team-Auswahl sichtbar und ein generischer Toast `"Vorlage konnte nicht geladen werden."` erscheint beim Team-Switch.

### Root cause

`+page.server.ts` hat im SSR nur `/teams` via `apiFetch` geladen — `/teams` ist **nicht** durch `shift-handover-templates.canRead` gegated. Der echte gegatete Endpoint `/shift-handover/templates/:teamId` lief client-side über `getTemplate(teamId)` → 403 wurde als generischer Toast abgefangen statt als SSR-Entscheidung. Das verletzt ADR-020 §6 ("Applied to all 31 addon-gated pages: `requireAddon` + `apiFetchWithPermission`").

### Fix

- `+page.server.ts`: zusätzlich `apiFetchWithPermission<unknown>(\`/shift-handover/templates/${teams[0].id}\`, …)`Probe nach dem`/teams`-Fetch. Bei `probe.permissionDenied === true`→`{ permissionDenied: true as const, teams: [] }`zurückgeben. Kein Probe wenn`teams.length === 0`(bestehendes "Keine Teams"-Empty-State deckt UX; kein TeamId = kein Endpoint zum Proben). Referenz 1:1 zu`/shifts/+page.server.ts` (`apiFetchWithPermission('/shift-times', …)`+`buildDeniedResponse`).
- `+page.svelte`: `import PermissionDenied from '$lib/components/PermissionDenied.svelte'` + `const permissionDenied = $derived(data.permissionDenied)` + Top-Level `{#if permissionDenied} <PermissionDenied addonName="die Übergabe-Vorlagen" /> {:else} …bestehender Body… {/if}`.

### Verification

- `pnpm exec svelte-check`: 2574 Files / 0 errors / 0 warnings (shift-handover-templates scope)
- `pnpm exec eslint src/routes/(app)/(shared)/shift-handover-templates/`: 0 errors
- Prettier `--write` auf beide Files: re-indented `{:else}`-Body korrekt

### Files changed

- `frontend/src/routes/(app)/(shared)/shift-handover-templates/+page.server.ts` (probe + diskriminierte Union-Return)
- `frontend/src/routes/(app)/(shared)/shift-handover-templates/+page.svelte` (Import + `$derived` + `{#if}`-Wrapper)

### Manual smoke path (user-owned)

1. Root/Admin-mit-full öffnet `/shift-handover-templates` → normaler Builder erscheint (probe umgeht den PermissionGuard, da `hasFullAccess` bypasst).
2. Für einen Employee-Team-Lead (oder Admin ohne `hasFullAccess`): User-Permission `shift-handover-templates.canRead` entfernen → Page-Reload → jetzt erscheint die `<PermissionDenied />`-View mit identischem `card > card-body > empty-state`-Layout wie auf `/shifts`, `/blackboard`, `/kvp` et al.

---

## Session 15 — Smoke-Test Finding: Page-Container Parity (`/inventory`-Pattern) ✅ DONE (2026-04-23)

### Problem (smoke-test, user-reported)

`/shift-handover-templates` verwendete einen page-lokalen `.page-container`-Wrapper mit custom `<header class="page-header"><h1>`. Alle anderen addon-gated Management-Seiten (insbesondere `/inventory` als Referenz) verwenden das Design-System-Trio `container > card > card__header + card__body` mit `h2.card__title` + Icon. Optische Drift → Seite fühlt sich „nicht wie Assixx" an.

### Fix (UI only, keine Logik-Änderung)

Template-Body komplett umstrukturiert entsprechend `/inventory/+page.svelte` Zeilen 266–424:

- Outer-Wrapper `page-container` → `container` (Design-System).
- `<header class="page-header">` + `<h1>` → `<div class="card__header">` + `<h2 class="card__title"><i class="fas fa-clipboard-list mr-2"></i>`.
- Description-`p` zieht in `card__header` mit `mt-2 text-(--color-text-secondary)`.
- Team-Filter-Dropdown zieht in `card__header` in `<div class="mt-6 flex items-center gap-4">` (1:1 analog Inventory's Filter-Row). Neue lokale CSS-Klasse `.team-filter { max-width: 20rem; flex-shrink: 0 }` für Breiten-Constraint.
- Content (Builder, Loading, Error, Action-Bar) zieht in `<div class="card__body">`.
- „Keine Teams"-Fall: vormals `alert--info` → jetzt korrekter `empty-state` mit `fas fa-users-slash`-Icon + Title + Description (matched Inventory's Empty-State-Semantik).
- Toast bleibt am Top-Level (fixed position) außerhalb des Cards.

Removed local styles: `.page-container`, `.page-header`, `.filter-row`, `.builder-section` (now redundant — Design-System übernimmt). Remaining local styles: `.team-filter`, `.action-bar*`, `.toast*` (page-specific).

### Verification

- `pnpm exec prettier --write`: unchanged (bereits Prettier-konform)
- `pnpm exec svelte-check`: 2574 files / 0 errors / 0 warnings
- `pnpm exec eslint`: 0 errors

### Files changed

- `frontend/src/routes/(app)/(shared)/shift-handover-templates/+page.svelte` (Template-Body + `<style>`-Block reduziert)

### Manual smoke path (user-owned)

1. Browser-HMR oder Reload → Seite zeigt jetzt den Standard-Card-Layout mit glassmorphic Container.
2. Visuelle Parität gegen `/inventory` prüfen: gleicher `container`-Max-Width, gleiche `card__header`-Paddings, gleiche Typografie-Hierarchie (`h2.card__title` statt `h1`).
3. `teams.length === 0`-Zustand: neue `<div class="empty-state">` mit Lock-äquivalentem Icon sichtbar (statt früher Info-Alert).

---

## Session 16 — Design-System Drift-Audit (Storybook-Parität) ✅ DONE (2026-04-23)

### Scope

Audit der Shift-Handover-UI-Files gegen `docs/CODE-OF-CONDUCT-SVELTE.md` + Storybook-Stories (`frontend/.storybook/stories/*`) auf Design-System-Drift. Ziel: canonical markup überall wo möglich, lokale CSS-Duplikate eliminieren.

### Audit-Ergebnis

**✅ Bereits korrekt:**

- `ShiftHandoverModal.svelte` — `modal-overlay`, `ds-modal*`, `badge badge--success/warning`, `form-field*` alle canonical.
- `ShiftHandoverButton.svelte` — custom `handover-btn` ist page-specific (shift-grid cell overlay, kein generischer Button).
- `FieldTypeSelector.svelte` — `ds-modal*` canonical; `type-card` ist Action-Pattern (kein Radio-Selection), nicht `choice-card`-äquivalent.

**❌ Drift gefixt:**

| Datei                                                  | Befund                                                                                                                                          | Fix                                                                                                       |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `FieldBuilder.svelte` L133-140                         | `<div class="empty-state">` mit `<i class="__icon">` (statt wrapper-div), `<p class="__title">` (statt `h3`), `__hint` (statt `__description`)  | Canonical Markup: `<div class="__icon"><i/></div>` + `<h3 class="__title">` + `<p class="__description">` |
| `FieldBuilder.svelte` `<style>` L382-409               | Lokale `.empty-state*` CSS-Duplikation der Design-System-Globals                                                                                | Komplett entfernt — Design-System (`design-system/primitives/data-display/empty-state.css`) übernimmt     |
| `FieldBuilder.svelte` L259-268                         | `<input type="checkbox">` ohne `toggle-switch__input`-Klasse, `<span class="__text">` statt canonical `__label`                                 | Input-Klasse hinzu + span umbenannt                                                                       |
| `ShiftHandoverFieldRenderer.svelte` L154-163           | `<input>` ohne `__input`-Klasse                                                                                                                 | Klasse hinzu                                                                                              |
| `ShiftHandoverFieldRenderer.svelte` `<style>` L182-240 | Komplette lokale `.toggle-switch*` CSS-Duplikation (Slider, ::after-Thumb, checked-state, disabled-state) die die Design-System-Globals shadowt | `<style>`-Block komplett entfernt                                                                         |

### Verification

- `pnpm exec prettier --write`: beide Dateien unchanged (Prettier-konform)
- `pnpm exec svelte-check`: 2574 files / 0 errors / 0 warnings
- `pnpm exec eslint`: 0 errors

### Files changed

- `frontend/src/routes/(app)/(shared)/shift-handover-templates/_lib/FieldBuilder.svelte` (empty-state markup + toggle-switch + CSS-cleanup)
- `frontend/src/routes/(app)/(shared)/shifts/_lib/ShiftHandoverFieldRenderer.svelte` (toggle-switch input-class + `<style>`-Block entfernt)

### Manual smoke path (user-owned)

1. `/shift-handover-templates` mit leerem Builder (neue Vorlage) → Empty-State rendert jetzt mit Design-System-Globals (matched `/inventory` Empty-State visuell 1:1).
2. Toggle "Pflichtfeld" im FieldBuilder → iOS-style Slider mit canonical Look (Design-System `.toggle-switch__slider` Animation).
3. Übergabe-Modal auf `/shifts` mit Boolean-Feld → gleicher Toggle-Look wie im Builder (gleicher Design-System-Pfad, keine Drift mehr).

### Nicht gefixt (subjektive Custom-Styles, kein Violation)

- `FieldBuilder.svelte` `field-row` / `options-block` / `field-row__handle` / `field-row__delete` — page-specific Grid + DnD-Handles.
- `FieldTypeSelector.svelte` `type-grid` / `type-card` — Action-Pattern (click-to-pick), nicht `choice-card` (Radio-Selection).
- `ShiftHandoverButton.svelte` `handover-btn` — absolute-positionierter Icon-Button im Shift-Grid-Kontext.

Extraktion dieser Elemente in Design-System-Primitives (z. B. "card--clickable", "action-card") wäre ein separater Design-System-Erweiterungs-PR, nicht Teil dieses Features.

---

## Session 17 — Custom-Dropdown + Card-Footer (Design-System 1:1) ✅ DONE (2026-04-23)

### Problem (user-reported smoke, 2. Runde)

1. Team-Filter war `<select class="form-field__control">` (native) — User hat explizit `dropdown > dropdown__trigger + dropdown__menu + dropdown__option` verlangt (Design-System "Custom Dropdown", Storybook `Design System/Dropdowns`, CSS unter `design-system/primitives/dropdowns/custom-dropdown.css`).
2. Action-Bar war page-lokale `<footer class="action-bar">` mit sticky-bottom + eigener CSS — obwohl Design-System `card__footer` exakt den Use-Case abdeckt (KVP-categories, TPM defect-chart als Referenz).

### Fix (KISS — CSS direkt, kein Wrapper-Component)

**Team-Filter:**

- Inline-Markup in `+page.svelte` — KEIN neuer Wrapper-Component. Design-System-CSS übernimmt visuelle Behandlung, Page-Script hält nur State + click-outside-Effect.
- Script: `let teamDropdownOpen = $state(false)` + `let teamDropdownRef = $state<HTMLDivElement | undefined>(undefined)` + `$effect` für document-level click-outside (Pattern analog `logs/_lib/FilterDropdown.svelte`).
- Template: `<div class="form-field"><span class="form-field__label" id>…</span><div class="dropdown" bind:this={teamDropdownRef}><button class="dropdown__trigger" class:active={teamDropdownOpen} …><span>{selectedTeamName()}</span><i class="fas fa-chevron-down"/></button><div class="dropdown__menu" class:active={teamDropdownOpen}>{#each teams}<button class="dropdown__option" class:selected={…} role="option" …>{team.name}</button>{/each}</div></div></div>`
- Width-Constraint via `.team-filter { max-width: 20rem }` (einziger page-lokaler Style-Rest).

**Action-Bar → Card-Footer:**

- `<footer class="action-bar">` → `<div class="card__footer flex items-center justify-between gap-4">` als Sibling von `card__body`, nur gerendert wenn `teams.length > 0 && !loading && loadError === null` (Happy-Path).
- Status-Indicator (badge/text) links, Buttons rechts in `<div class="flex flex-wrap gap-2">`.
- Kein sticky-bottom mehr — card\_\_footer folgt normalem Document-Flow (wie KVP-categories).
- Lokale `.action-bar`, `.action-bar__buttons` CSS komplett entfernt (~18 Zeilen).

**Orphan zum Aufräumen (User-Action nötig, ich darf kein `rm`):**

- `frontend/src/lib/components/CustomDropdown.svelte` — ich hatte den Wrapper zuerst fälschlich angelegt. Richtiger Weg ist Inline-Markup direkt mit Design-System-Klassen, wie oben. → **Bitte `rm frontend/src/lib/components/CustomDropdown.svelte` laufen lassen.**

### Nicht migriert (bewusst)

- `FieldBuilder.svelte` per-row Typ-Select — bleibt `<select class="form-field__control">` native. Design-System-Guidance (`design-system/primitives/dropdowns/custom-dropdown.css` Top-Kommentar + README): _"Prefer native `<select>` when possible (better accessibility)"_. Per-row compact Inline-Select mit 8 statischen Optionen ohne Icons/Prices ist der Klassiker-Case für native. Falls Du explizit auch dort custom willst, sag's und ich ändere es.

### Verification

- `pnpm exec prettier --write`: formatiert (1 minor)
- `pnpm exec svelte-check`: 2574 files / 0 errors / 0 warnings
- `pnpm exec eslint`: 0 errors

### Files changed

- `frontend/src/routes/(app)/(shared)/shift-handover-templates/+page.svelte` (team-filter dropdown inline + card\_\_footer + `.action-bar*` CSS raus)

### Manual smoke path (user-owned)

1. HMR / Reload `/shift-handover-templates`.
2. Team-Filter: klick auf Trigger → glass-Menu animiert auf, selected-Option hat ✓-Style, Option-Klick schließt + setzt Team, outside-Click schließt.
3. Action-Zone unten: `card__footer` mit Glass-Background + Top-Border (wie KVP-categories Create-Modal-Footer). Buttons flow normal, kein Sticky mehr.
4. Keine `.svelte-<hash>` mehr auf `action-bar` oder `form-field__control` (war eh native).

---

## Session 18 — Modal → Page Migration ✅ DONE (2026-04-23)

### Problem (smoke-test iteration 4)

User screenshot showed the in-grid `ShiftHandoverModal` rendering (a) the English backend error "User may not create a draft for this shift right now" inside an inline `alert--danger` in `.ds-modal__body`, and (b) the empty-state "Für diese Schicht wurde keine Übergabe angelegt." inside an `alert--warning` — both instead of using the global toast component. (c) The modal shell still flashed for ~1 frame on 403 because the overlay mounted before `loadOrCreateEntry` could run + call `onclose()`.

Session 9 had locked the modal pattern from ADR-052. Three iterations of in-modal patches (Session 14 PermissionDenied, modal-flash guard, German reason messages) kept fixing symptoms without touching the architectural root — modal-mount-first/load-later is incompatible with "render only when we have data" UX.

### Root cause

Modal's declarative surface commits to painting as soon as the overlay is mounted. Any async-load failure after mount forces either a painted-then-closed flash OR an inline error alert — neither matches the app's global-toast contract. Dedicated detail pages (`/blackboard/[uuid]`, `/kvp-detail`) avoid this entirely because the SSR loader either populates the page or redirects before paint.

### Fix

Convert the modal to a dedicated route:

- **`/shift-handover/[uuid]/+page.server.ts`** — SSR loader; `apiFetchWithPermission` on `/shift-handover/entries/:uuid`; on 403 returns `{permissionDenied: true}` so the standard `<PermissionDenied/>` component renders (ADR-020 §6 parity with 32 other addon-gated pages). 404 via SvelteKit `error(404, 'Übergabe nicht gefunden')`. Skips the live-template fetch for submitted entries (schema_snapshot is authoritative, R2).
- **`/shift-handover/[uuid]/+page.svelte`** — ports the modal body (meta grid, Protokoll, custom fields, attachments, Speichern/Abschließen). No overlay, no `onclose`, no `svelte:window` Escape handler. `Zurück zur Schichtplanung` button calls `goto('/shifts')`.
- **`/shift-handover/new/+page.server.ts`** — idempotent trampoline. Reads `?team&date&slot`, POSTs `/shift-handover/entries` (getOrCreateDraft), redirects to `/shift-handover/${uuid}` on 200 or to `/shifts?handover-error=<encoded>` on 403. The POST-in-a-load is one of the rare exceptions to the GET-only convention (see `api-fetch.ts`); used because the redirect is server-side and refresh-safe.
- **Toast bridge in `/shifts/+page.svelte`** — `$effect` reads `?handover-error=` / `?handover-success=` / `?handover-info=` from `$page.url.searchParams`, fires the appropriate toast, `replaceState`s the URL to remove the params (prevents re-toast on refresh).
- **`handleHandoverOpen` in `shifts/+page.svelte`** — navigates instead of setting modal target. If existing entry → `/shift-handover/${uuid}`; if writable-empty → `/shift-handover/new?...`; if read-only-empty → `showWarningAlert` in place (no navigation).
- **Deleted:** `shifts/_lib/ShiftHandoverModal.svelte` (~500 LOC). Simplified `state-handover.svelte.ts` — dropped `modalTarget` state + `getModalTarget`/`setModalTarget`.
- **Breadcrumb:** `lib/components/breadcrumb-config.ts` gains intermediate entry + static URL mapping for `/shift-handover` (parent "Schichtplanung" → `/shifts`).

### Permission model (unchanged)

- Layer 0 `requireAddon('shift_planning')` via parent layout data
- Layer 1 `canManageHandover` derived in page from `role + hasFullAccess + orgScope.isAnyLead` (ADR-045)
- Layer 2 `myPermissions.entries.{canRead,canWrite,canDelete}` from `/shift-handover/my-permissions` (ADR-020)
- Backend still enforces assignee-check + write-window on every PATCH/submit → if the UI misjudges `canEdit` (V1 approximation), backend returns German toast via `WRITE_DENIED_MESSAGES`

### Known Limitations (carried)

- **No assignee display on the detail page** (V1). Modal had access to grid state; the page does not. Backend `ShiftHandoverEntryRow` would need an `assignees` augment (plan §Known Limitations → follow-up).
- **Attachments list starts empty** on page load (same as modal — Spec Deviation #6). Users see session-uploaded attachments in memory; refresh clears the list.

### Verification

- Backend comment-only change (`shift-handover-entries.service.ts` JSDoc) + backend restart clean (`/health: ok`)
- Frontend: `ShiftHandoverModal.svelte` removed; no dangling imports; `modalTarget`/`setModalTarget`/`getModalTarget` fully purged from `shifts/+page.svelte`
- Hook-enforced validate:all runs after each edit

### Files (delta summary)

**Created:**

- `frontend/src/routes/(app)/(shared)/shift-handover/[uuid]/+page.server.ts`
- `frontend/src/routes/(app)/(shared)/shift-handover/[uuid]/+page.svelte`
- `frontend/src/routes/(app)/(shared)/shift-handover/new/+page.server.ts`

**Deleted:**

- `frontend/src/routes/(app)/(shared)/shifts/_lib/ShiftHandoverModal.svelte`

**Modified:**

- `frontend/src/routes/(app)/(shared)/shifts/+page.svelte` — modal import + render + derived state removed, `handleHandoverOpen` navigates, toast-bridge `$effect`, new imports (`replaceState`, `page`, `resolve`, `showErrorAlert`, `showSuccessAlert`)
- `frontend/src/routes/(app)/(shared)/shifts/_lib/state-handover.svelte.ts` — `modalTarget` + `getModalTarget` + `setModalTarget` dropped; `HandoverContext` no longer imported
- `frontend/src/routes/(app)/(shared)/shifts/_lib/ShiftHandoverButton.svelte` — comment refresh
- `frontend/src/lib/components/breadcrumb-config.ts` — `/shift-handover` intermediate + static mapping
- `backend/src/nest/shift-handover/shift-handover-entries.service.ts` — `WRITE_DENIED_MESSAGES` JSDoc updated to point at the new toast-bridge path
- `docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md` — this section + Spec Deviation #9

### Manual smoke path (user-owned, next turn)

1. Hard-reload `/shifts`. Click 📋 on a writable cell where no entry exists → URL flips to `/shift-handover/new?team=X&date=D&slot=early`, then `/shift-handover/${uuid}` (server redirect). Page renders form with header badge "Entwurf". No modal, no flash.
2. Enter Protokoll + field values. Click **Speichern (Entwurf)** → toast "Entwurf gespeichert.", `goto('/shifts')`. Cell button flips to yellow.
3. Click 📋 on the same cell again → `/shift-handover/${uuid}` (direct link from grid status map). Page reopens with prior values.
4. Click **Übergabe abschließen** → toast "Übergabe abgeschlossen.", `goto('/shifts')`. Cell button flips to green.
5. Click 📋 on a cell OUTSIDE your assignment (as an employee, non-Lead) → cell was empty → warning toast "Für diese Schicht wurde keine Übergabe angelegt." (no navigation).
6. Click 📋 on a cell where someone else has a SUBMITTED entry and you're an employee → `/shift-handover/${uuid}` read-only view renders snapshot, no edit controls.
7. Click 📋 on a past-shift cell → `/new` POSTs, backend returns 403 `outside_window`, redirect to `/shifts?handover-error=Diese+Schicht+liegt...` → toast fires + URL cleans itself. No modal flash.

---

## Session 19 — Smoke-Test Finding: Hide Schlüssel Input in FieldBuilder ✅ DONE (2026-04-24)

### Problem (smoke-test, user-reported)

On `/shift-handover-templates`, the FieldBuilder rendered a per-field
"Schlüssel" text input next to "Bezeichnung". End-users have no concept of a
column identifier and were confused. Quote: _"das verwirrt den user nur"_.

### Root cause

The original design ([masterplan §5.2](#step-52-template-config-page)) exposed
the key for advanced disambiguation (e.g. two fields labelled "Menge" with
different DB keys). In practice no end-user ever needs that: the key is a
database-layer implementation detail, not a UX-level concept.

Auto-derivation already existed (`deriveKey` label→slug, frozen once the user
focused the input via `_keyTouched`), but the input was visible by default
and the "(automatisch)" helper copy reinforced the sense that the user had to
understand what it did.

### Fix (UI removal + auto-derive hardening)

**UI change — `FieldBuilder.svelte`:**

- Removed the entire `<div class="form-field">…Schlüssel…</div>` block (the
  `id="field-{uid}-key"` input). Comment marker left in place pointing at
  this session for archaeology.
- Grid `@media (width >= 768px)` `.field-row__grid` template changed
  `2fr 2fr 1.5fr 1fr` → `3fr 1.5fr 1fr`. Label gets the reclaimed space; it
  is the only free-text control left.
- JSDoc banner updated: "Inline edit (label / required / type / options)" and
  a paragraph explaining auto-key behaviour now lives under Session 19.

**Tooltip copy — `FieldTypeSelector.svelte`:**

- "Du kannst Bezeichnung, **Schlüssel** und Pflicht-Flag im nächsten Schritt
  anpassen." → "Du kannst Bezeichnung und Pflicht-Flag im nächsten Schritt
  anpassen." (removed Schlüssel from the user-facing affordance list).

**State hardening — `state-templates.svelte.ts`:**

- New helper `deriveUniqueKey(label, fields, selfUid)`:
  - Calls `deriveKey(label)` as the base.
  - Empty-label / symbols-only / digits-only labels fall back to `'feld'`
    (German "field"). Without this, `validateField` would surface
    "Schlüssel darf nicht leer sein." with no UI affordance to resolve.
  - Disambiguates duplicates via `_2`, `_3`, … up to `_999`, with the base
    trimmed before the suffix so `KEY_MAX_LENGTH` (30) is respected.
- `setLabel` now calls `deriveUniqueKey` instead of `deriveKey` when
  `!_keyTouched`. Legacy fields still load with `_keyTouched=true` from
  `inflateField` so their manual keys are preserved.
- Removed stranded `setKey` helper + `updateKey` interface method +
  `updateKey` mutator body (CLAUDE.md: "delete unused code, no
  backwards-compat hacks"). One JSDoc stub pointer left in place explaining
  the rationale for future readers.

### Invariants preserved

| Invariant                           | How it stays intact                                                                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema_snapshot` drift-safety (R2) | Only affects template-editor working state before save. Persisted snapshots are frozen by the backend on submit and never touched here.                                |
| Legacy manual keys                  | `inflateField` sets `_keyTouched=true`; `setLabel` short-circuits before calling `deriveUniqueKey` for those fields.                                                   |
| Backend Zod authority               | `ShiftHandoverTemplateFieldsSchema` still runs on save. If an edge case produces an invalid key (shouldn't happen with the new helper), the 400 toast fires as before. |
| KEY_MAX_LENGTH (30)                 | `deriveUniqueKey` trims the base before appending the numeric suffix — total length ≤ 30.                                                                              |
| KEY_REGEX                           | `deriveKey`'s regex chain is unchanged. `'feld'` fallback is regex-valid. Numeric suffixes stay in `[a-z0-9_]`.                                                        |

### Verification

- `cd frontend && pnpm run check` → 0 errors, 0 warnings, 2579 files
- `pnpm exec eslint src/routes/(app)/(shared)/shift-handover-templates/` → exit 0
- Hook-enforced validate:all after each edit (matches Session 18 discipline)
- No changes to backend or shared package

### Files changed

**Modified:**

- `frontend/src/routes/(app)/(shared)/shift-handover-templates/_lib/FieldBuilder.svelte` — Schlüssel `<div>` block removed; grid template 4→3 columns; JSDoc updated; delete-button migrated from local `.field-row__delete` (transparent, weak hover) to canonical design-system `.action-icon .action-icon--delete` (coral tinted hover + scale, matches `manage-admins/_lib/AdminTableRow.svelte`); icon `fa-trash-alt` → `fa-trash` for 1:1 parity; field-type `<select>` replaced by canonical `.dropdown/.dropdown__trigger/.dropdown__menu/.dropdown__option` custom dropdown (glassmorphism parity with team-filter); per-row open-state via single `openTypeDropdownUid` + `data-type-dropdown` attribute lookup + document click-outside `$effect`; "Feld hinzufügen" `btn-primary` → `btn-secondary`
- `frontend/src/routes/(app)/(shared)/shift-handover-templates/_lib/FieldTypeSelector.svelte` — tooltip copy (Schlüssel reference dropped)
- `frontend/src/routes/(app)/(shared)/shift-handover-templates/_lib/state-templates.svelte.ts` — `deriveUniqueKey` added; `setLabel` routed through it; `setKey` + `updateKey` (interface + mutator) removed; `canonicalize()` helper added + `isDirty` rewritten to use it (fixes false "Ungespeicherte Änderungen" badge on initial load — PostgreSQL `jsonb` sorts keys length-then-alphabetic on round-trip, which diverged from `cleanField`'s insertion order)
- `frontend/src/routes/(app)/(shared)/shift-handover-templates/+page.svelte` — destructive "Vorlage löschen" action lifted from `card__footer` into top-right of `card__header` (flex-wrap row with the title); "Verwerfen" `btn-secondary` → `btn-cancel`; "Speichern" `btn-primary` → `btn-success`; "Gespeichert" check-circle icon tinted `--color-success` (text stays tertiary-gray for quiet status reading)
- `docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md` — this section + version header bump to 0.19.0

### Manual smoke path (user-owned, next turn)

1. Open `/shift-handover-templates`, pick a team with an existing template → rows render with **Bezeichnung | Typ | Pflichtfeld** only (no Schlüssel column). Existing keys stay byte-identical on save (verify via backend payload if curious).
2. Add two new fields both labelled "Menge" → first auto-keys to `menge`, second to `menge_2`. Save → toast "Vorlage gespeichert.", reload, keys persist.
3. Add a field labelled "!!!" or "123" → auto-key falls back to `feld` (or `feld_2` if already taken). Save → accepted.
4. Rename an existing field's label (legacy key like `qty_lb`) → key stays `qty_lb` (frozen by `_keyTouched=true` on server-loaded fields). Save → no silent rename, no schema_snapshot drift.
5. Submit an entry against the template, then add a new field to the template and save → reopen the submitted entry → original fields still render (R2 drift-safety proof).

---

## Session 20 — Smoke-Test Finding: Integer + Decimal → Zahl Collapse ✅ DONE (2026-04-24)

### Problem (smoke-test, user-reported)

In both the field-type picker modal and the per-row type dropdown, the template
builder offered **Ganze Zahl** (`integer`) and **Dezimalzahl** (`decimal`) as
separate options. Quote: _"das ist das problem. ich will einfacher machen"_.
End-users have no mental model for the distinction — they just want to capture
"eine Zahl" (Stückzahl, Temperatur, Maß, whatever). The two-option UI forced
them to guess the DB-layer type discipline of a JSONB validator.

### Root cause

The original design (plan §Product Decisions #6, Phase 1/2) mapped 1:1 to the
backend Zod validators in `field-validators.ts`: `integer → z.number().int()`
(rejects 42.5) vs `decimal → z.number()` (accepts any finite number). The
discrimination is valid at the validator layer — but surfacing it in the
end-user UI violates KISS. `decimal` is a superset of `integer` (any integer
is a valid decimal), so one unified "Zahl" option covers every intended use
case without losing expressiveness.

### Fix (UI-only merge; wire contract unchanged)

**Shared enum (`shared/src/shift-handover/field-types.ts`) — UNCHANGED.**
`integer` stays in `SHIFT_HANDOVER_FIELD_TYPES` so that already-submitted
`shift_handover_entries.schema_snapshot` rows with `type: 'integer'` remain
wire-compatible. Backend Zod validators unchanged. Backend tests unchanged.
**R2 drift-safety contract preserved.**

**`FieldTypeSelector.svelte`:**

- New local const `UI_FIELD_TYPES: readonly UiFieldType[]` derived from the
  shared const via a type-predicate filter (`(t): t is UiFieldType => t !== 'integer'`).
  `UiFieldType = Exclude<ShiftHandoverFieldType, 'integer'>`.
- `TYPE_META` retyped to `Record<UiFieldType, …>` — removes the `integer`
  entry entirely, so the picker renders 7 cards instead of 8.
- `decimal` entry updated: label `"Dezimalzahl"` → `"Zahl"`, hint
  `"z. B. Temperatur, Maß"` → `"z. B. Stückzahl, Temperatur, Maß"`, icon
  `fa-calculator` → `fa-hashtag` (more immediately recognizable as "number").
- Modal description unchanged beyond the implicit "Wähle den Typ" — the
  confusion was in the card grid itself.

**`FieldBuilder.svelte`:**

- `TYPE_LABEL[integer]` and `TYPE_LABEL[decimal]` both resolve to `"Zahl"`.
  Legacy fields loaded with `type: 'integer'` therefore display "Zahl" in
  the dropdown trigger without any extra branching.
- Identical `UiFieldType` + `UI_FIELD_TYPES` filter as the picker — the type
  dropdown's `{#each}` now iterates 7 options, not 8.
- Per-row "Zahl" option onclick: no-op guard. When the user selects "Zahl"
  on a field whose current type is `integer` OR `decimal`, `updateType` is
  NOT called. This prevents the surprise dirty-flag bug (same class Session
  19 fixed for the jsonb round-trip) where re-selecting the already-shown
  label would silently convert `integer → decimal` and mark the template
  dirty without any visible change. For any other source type (`text` →
  "Zahl", `date` → "Zahl", etc.), normal conversion fires and sets type
  to `decimal` — the new unified number type for freshly-created fields.
- `class:selected` + `aria-selected` on the "Zahl" option highlight when
  `field.type === 'decimal'` OR `field.type === 'integer'`.

### Invariants preserved

| Invariant                                     | How it stays intact                                                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| R2 schema_snapshot drift-safety               | Shared enum unchanged. Entries submitted against legacy templates retain `type: 'integer'` in JSONB and render + validate identically on read.    |
| Backend Zod authority                         | `field-validators.ts` untouched. `integer → z.number().int()` still enforced for any existing/legacy integer field. New fields save as `decimal`. |
| Legacy integer templates                      | Keys stay `integer` at the wire until the user explicitly changes the type to a non-number option. Dropdown "Zahl" → "Zahl" is a no-op by design. |
| No-surprise dirty-flag (Session 19 invariant) | Guard in dropdown onclick prevents silent `integer → decimal` conversion on passive interaction. User must actively change to a different type.   |
| Entry-form rendering                          | Reads `schema_snapshot.type` per entry. Renders `integer` with `step="1"` and `decimal` with `step="any"` — both continue to work unchanged.      |
| Field-limit constant (30)                     | Independent axis. Unaffected.                                                                                                                     |

### Verification

- `cd frontend && pnpm run check` → 2579 files, 0 errors, 0 warnings
- `pnpm exec eslint src/routes/(app)/(shared)/shift-handover-templates/` → exit 0
- No backend changes → no backend re-run required
- No shared package changes → no `build:shared` required

### Files changed

**Modified:**

- `frontend/src/routes/(app)/(shared)/shift-handover-templates/_lib/FieldTypeSelector.svelte` — `UI_FIELD_TYPES` local const + `UiFieldType` type alias; `TYPE_META` retyped to exclude `integer`; `decimal` entry relabeled to "Zahl" with combined hint and `fa-hashtag` icon; `{#each}` loop now iterates `UI_FIELD_TYPES`; JSDoc banner documents the Session-20 rationale
- `frontend/src/routes/(app)/(shared)/shift-handover-templates/_lib/FieldBuilder.svelte` — `TYPE_LABEL[integer]` aliased to "Zahl"; `UiFieldType` + `UI_FIELD_TYPES` local; dropdown `{#each}` switched to `UI_FIELD_TYPES`; per-row "Zahl" option gains `isCurrentNumber` no-op guard so re-selecting the current label on a legacy integer field does not fire `updateType` (avoids surprise dirty-flag)
- `docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md` — this section; §Manual Smoke Test Stage 2 + 5 + 7 updated from "8 types / 8 fields" to "7 types / 7 fields"; Stage 2 explicitly names "Zahl" as the merged number type

### Manual smoke path (user-owned, next turn)

1. `/shift-handover-templates` → existing template with a legacy `integer`
   field opens → the type dropdown for that field shows **"Zahl"** (not
   "Ganze Zahl"). No dirty-flag on initial load.
2. Click the dropdown → menu lists 7 options (no "Ganze Zahl"). Click
   "Zahl" (the currently-displayed label) → dropdown closes, still no
   dirty-flag. The underlying `type: 'integer'` is preserved at the wire.
3. Click "+ Feld hinzufügen" → modal shows 7 cards (no "Ganze Zahl"), the
   number card reads **"Zahl"** with hint "z. B. Stückzahl, Temperatur, Maß"
   and icon `fa-hashtag`. Select it → new row created with `type: 'decimal'`.
4. Change the new "Zahl" field's type to "Text" and back to "Zahl" → type
   cycles `decimal → text → decimal`. Save accepted.
5. On a legacy `integer` field: change type to "Datum" (non-number), then
   back to "Zahl" → ends up as `decimal`. This is the only path that
   converts legacy `integer → decimal` (via an explicit non-number detour);
   the dirty-flag appears honestly because the user did actively change the
   type. Saving is accepted; future entries against this template validate
   as `decimal`.
6. Submit an entry against a template containing both legacy `integer` and
   new `decimal` fields → both render with a number input and accept valid
   values. Already-submitted entries (pre-Session-20) stay byte-identical
   on re-open (R2 proof).

---

## Session 21 — Smoke-Test Finding: `tenants.deletion_status` Cancel-Path NULL Bug ✅ DONE (2026-04-25)

### Discovery

Tenant 8 (`testfirma`) was the smoke-test tenant for the Phase-5 manual click-path. Apex-login at `http://localhost:5173/login` as `corc.oeztuerk@testfirma.de` consistently returned `HANDOFF_HOST_MISMATCH` (R15) at the OAuth-handoff stage, while the same flow on `apitest` and `scs-technik` tenants worked instantly. User narrowed it down: "vorllame bei aitest domain geht es sofort aber testfirma domain nicht" — same code, different data. The user had run a test deletion-request → cancel cycle in the UI on tenant 8 immediately before; suspected the cancel did not fully roll back state. Confirmed.

### Root cause

| Layer                                                                                 | Bug                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `backend/src/nest/tenant-deletion/tenant-deletion.service.ts:211`                     | `cancelDeletion()` ran `UPDATE tenants SET deletion_status = NULL WHERE id = $1` instead of setting it back to `'active'`. Drift from line 153's parametrised `'marked_for_deletion'` write.                                         |
| `backend/src/nest/common/middleware/tenant-host-resolver.middleware.ts` (ADR-050 R15) | Slug→tenantId lookup is `WHERE subdomain = $1 AND deletion_status = 'active'`. `NULL = 'active'` is `UNKNOWN` in SQL, so the row is filtered out → `req.hostTenantId = null` → every OAuth handoff to that subdomain fails with R15. |
| `tenants.deletion_status` schema                                                      | Column was `NULLABLE DEFAULT 'active'`. The default protected new rows but nothing rejected an explicit `NULL` write.                                                                                                                |

### Fix (3-part bundle, KISS-konform "BUNDLE COUPLED WORK")

1. **Code fix** — `tenant-deletion.service.ts:211` parametrised to `('UPDATE tenants SET deletion_status = $1 WHERE id = $2', ['active', tenantId])` with a 7-line block comment linking ADR-050 R15 + this Masterplan section. Mirrors the style of the sibling `requestDeletion` write at line 153.
2. **Migration `20260425001208886_deletion-status-not-null.ts`** — backfills any historic NULLs to `'active'` (idempotent, 0 rows on the repaired DB), then `ALTER TABLE tenants ALTER COLUMN deletion_status SET NOT NULL`. Structural defense: even if a future code path writes `NULL`, the constraint rejects it with `null value in column "deletion_status" ... violates not-null constraint`. `down()` only drops the constraint — backfilled NULLs are NOT restored (would re-introduce the bug; documented as one-way per migration-guide §537).
3. **Regression test** — `tenant-deletion.service.test.ts` gains a 12-line case that asserts `cancelDeletion(7, 5)` invokes `mockDb.query` with the exact SQL `'UPDATE tenants SET deletion_status = $1 WHERE id = $2'` and params `['active', 7]`. Any future regression to `NULL`/`undefined`/`'something_else'` trips the test.

### Manual data repair

Before the migration ran, tenant 8 already had `deletion_status = NULL` from the user's UI-cancel during smoke-testing. Repaired with `UPDATE tenants SET deletion_status = 'active' WHERE id = 8 AND deletion_status IS NULL` + Redis slug-cache eviction (`DEL tenant:slug:testfirma`) so the middleware re-resolves on next request.

### Verification

| Stage                                                                                                                              | Result                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `pnpm exec eslint backend/src/nest/tenant-deletion/`                                                                               | exit 0, 0 errors                                                                                                   |
| `pnpm exec tsc --noEmit -p backend`                                                                                                | exit 0                                                                                                             |
| Migration dry-run (`./scripts/run-migrations.sh up --dry-run`)                                                                     | clean, prints SQL preview                                                                                          |
| Migration apply                                                                                                                    | pgmigration #148 tracked at `2026-04-25 02:13:13`                                                                  |
| Schema verify (`\d tenants`)                                                                                                       | `deletion_status \| tenants_deletion_status \| not null \| 'active'::tenants_deletion_status`                      |
| Constraint smoke-test                                                                                                              | `UPDATE tenants SET deletion_status = NULL WHERE id = 8` → `ERROR: null value ... violates not-null constraint` ✅ |
| Unit test `pnpm exec vitest run --project unit backend/src/nest/tenant-deletion/tenant-deletion.service.test.ts -t cancelDeletion` | 6 / 6 green incl. new R15 regression                                                                               |
| Backend restart + `/health`                                                                                                        | `status: ok`, uptime fresh                                                                                         |

### Files

**Modified:**

- `backend/src/nest/tenant-deletion/tenant-deletion.service.ts` — line 211 NULL → `$1` ('active')
- `backend/src/nest/tenant-deletion/tenant-deletion.service.test.ts` — new regression test under `describe('cancelDeletion')`
- `docs/how-to/HOW-TO-LOCAL-SUBDOMAINS.md` — WSL2 `generateHosts = false` callout + `printf`-Heredoc-Alternative (orthogonal smoke-test friction)
- `docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md` — Manual Smoke Test prerequisite #4 expanded with Subdomain-Login URL + R15-Falle; this Session-21 entry

**Created:**

- `database/migrations/20260425001208886_deletion-status-not-null.ts`
- `database/backups/full_backup_20260425_021153.dump` (pg_dump pre-migration, mandatory per DATABASE-MIGRATION-GUIDE §HARD BLOCK)

### Outstanding (user-owned)

- **Customer fresh-install sync:** `./scripts/sync-customer-migrations.sh` — picks up migration #148 + the schema NOT NULL change for `customer/fresh-install/001_schema.sql`. Per Phase-6 Customer Sync section, this is user-owned (writes commit-relevant files).
- **Continuation of Phase-5 Manual Smoke Test:** apex-login → testfirma handoff, then the 7-stage click-path. This is what was blocked; now unblocked.

---

**This document is the execution plan. No coding starts until §0 sign-off + §0.7 spike are green. Every session starts here, takes the next unchecked item, and marks it done.**
