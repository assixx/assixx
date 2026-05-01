# ADR-052: Shift Handover Protocol (Schichtübergabe)

| Metadata                | Value                                                                                                                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                                                                                                                                                                                                |
| **Date**                | 2026-04-23                                                                                                                                                                                                                                                              |
| **Decision Makers**     | SCS-Technik Team                                                                                                                                                                                                                                                        |
| **Affected Components** | PostgreSQL (3 tables), Backend NestJS module `shift-handover`, Shared package `@assixx/shared/shift-handover`, Frontend routes `/shifts` + `/shift-handover-templates`                                                                                                  |
| **Related ADRs**        | ADR-011 (Shift Data), ADR-015 (Shared Package), ADR-019 (RLS), ADR-020 (Per-User Permissions), ADR-033 (Addon SaaS), ADR-034 (Hierarchy Labels), ADR-035 (Scope), ADR-040 (Inventory Addon — reference pattern), ADR-042 (Multipart Upload), ADR-045 (Permission Stack) |
| **Masterplan**          | `docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md` (13 sessions, 2026-04-21 → 2026-04-23)                                                                                                                                                                                         |

---

## Context

Industrial shift operations need a structured handover between out-going and in-coming shift Teams. Paper protocols are:

- **Lossy** — notes leave the building, get destroyed, or never reach the next shift
- **Inauditable** — no record of who wrote what, when, or whether the successor actually read it
- **Non-searchable** — past events (malfunctions, near-misses, open tasks) evaporate
- **Not tenant-configurable** — every site writes down different things; a one-size-fits-all paper form is either too restrictive or too blank

Shift handovers are also orthogonal to the existing `shifts`/`shift_assignments` scheduling model (ADR-011). The scheduling layer answers "who is working when"; the handover layer answers "what was handed over at the end of their working block". Conflating the two would bloat an already-sensitive scheduling schema.

V1 scope (product owner, 2026-04-21): per-shift-slot handover with tenant-configurable custom fields, per-team templates, image attachments, submitted-state lock, and 24-hour auto-lock. Notifications, PDF export, historical backfill, cross-team handover links, and a dedicated list page are out of scope.

---

## Decisions

### 1. Per-shift-slot granularity, not per-day

Handover entries are keyed by the composite `(tenant_id, team_id, shift_date, shift_key)` with a UNIQUE constraint, where `shift_key ∈ {early, late, night}` is validated against the tenant's `shift_times` rows (R13 — V1 restricts to the canonical three slots; tenants with custom slot codes are blocked at the service layer with `BadRequestException` until the whitelist is extended).

**Why per-slot, not per-day or per-team:**

- A factory with three Teams per day (early/late/night) has three distinct handovers per day. Flattening to "per-day" would require the night crew to edit the same row the early crew wrote, destroying the assignee→author linkage and audit trail.
- Flattening to "per-team" (one rolling entry) would make the schema_snapshot pattern (Decision 2) useless — every schema change would orphan everything prior.
- Keeping granularity at `(team, date, slot)` matches how operations actually speak: "the late-shift handover yesterday on Line 2 said…".

**Consequence:** a team that works only one slot per day (office teams, day-shift-only production) has one row per day. A team with 24/7 coverage has three rows per day. The DB indexes on `(tenant_id, team_id, shift_date)` keep range scans cheap.

### 2. JSONB custom fields with per-entry `schema_snapshot` (drift-safety)

Each team has an optional `shift_handover_templates` row (one template per team). The template stores a JSONB `fields` array of `ShiftHandoverFieldDef` descriptors — 8 field types: `text`, `textarea`, `integer`, `decimal`, `date`, `time`, `boolean`, `select` (each with `key`, `label`, `required`, and — for `select` — an `options` array).

When an entry is **submitted**, the service COPIES the live template's fields into the entry's `schema_snapshot` column. Reading a submitted entry renders against `schema_snapshot`, **not** the live template.

**Why the snapshot:**

- Templates evolve. A Team-Lead who deletes the "Ölstand OK?" field after submitting 500 handovers must not retroactively destroy the meaning of those 500 entries. The snapshot is the frozen contract at submission time.
- Compliance: audit evidence must reproduce what the author saw. Re-rendering from a changed template is a falsification risk.
- Operational: the site can iterate on what information is useful over time without breaking historical reports.

**Why JSONB, not a relational per-field table:**

- Field schemas are tenant + team specific and change often. A relational `shift_handover_field_values` table would require `JOIN … WHERE field_key = ?` per field on every read — O(fields × entries) joins.
- The validator already lives in `@assixx/shared/shift-handover` as `buildEntryValuesSchema(fields[])` (shared between frontend + backend). Treating values as a single JSONB `custom_values` object matches the Zod validator shape 1:1.
- Partial updates (draft saves) require a single `UPDATE … SET custom_values = $1` round-trip, not N field UPSERTs.

**Enforcement:** both the DTO (via `nestjs-zod`) and the service (defense-in-depth per Power-of-Ten Rule 5) re-parse incoming values with `buildEntryValuesSchema()` built from either the live template (drafts) or the snapshot (submitted edits — V1 does not allow them, but the code path is guarded anyway).

### 3. Active-shift-resolver as pure function (injectable clock)

Determining "who was assigned to this (team, date, slot)" combines two sources — `shifts` (canonical) and `shift_rotation_history` (generated by the rotation feature). The resolver at `backend/src/nest/shift-handover/active-shift-resolver.service.ts` does a single SQL `UNION` across both, mirroring the canonical merge pattern at `shifts.service.ts:681-691` verbatim. The resolver is also responsible for the 24-hour write-window check (`canWriteForShift`) and the auto-lock cutoff (`getAutoLockCutoff`).

**Purity contract:**

- No `Date.now()` anywhere in the service. Time enters via an injected `SHIFT_HANDOVER_CLOCK` token (module binding: `{provide: SHIFT_HANDOVER_CLOCK, useValue: () => new Date()}`).
- No `process.env.TZ` reads — timezone handling lives in SQL (`AT TIME ZONE 'Europe/Berlin'`), which is DST-correct by construction and unaffected by the Node runtime's TZ.
- Every timing input is an explicit parameter.
- No RLS context required — callers pass `tenantId` explicitly so the resolver is usable from cron jobs, WebSocket handlers, and unit tests without CLS setup.

**Why pure:**

- Unit-testable without mocking the system clock globally. `vi.fn(() => FIXED_NOW)` injected per test.
- Cron job (Decision implied in masterplan §2.8) runs `runAutoLockSweep(nowUtc)` with a captured `new Date()` in the handler — if the handler fires during a DST transition, the sweep still uses a single authoritative `now`.
- Write-window edge cases (night-shift-that-crosses-midnight, submitted-during-DST-gap) are SQL-resident, not JS-resident, so the tests actually test PostgreSQL's DST handling — which is what production runs on.

**Verified:** 17 unit tests in `active-shift-resolver.service.test.ts` + 8 matrix cases for Berlin-TZ write-window (R5).

### 4. Inventory upload pattern — ADAPT, not reuse

The Inventory addon (ADR-040) has an image-upload flow — `memoryStorage()` + `FileInterceptor` (via `@webundsoehne/nest-fastify-file-upload`) + inline controller-side disk-write. Session 1 §0.7 spike evaluated whether Shift-Handover should **reuse** Inventory's service/controller or **adapt** the pattern.

**Decision: ADAPT.**

Dedicated `shift_handover_attachments` table + independent `ShiftHandoverAttachmentsService` that copies the Inventory pattern but owns its own lifecycle (validation → 5-cap check → disk write → INSERT, all inside `tenantTransaction`).

**Why adapt, not reuse:**

- Inventory's service signature `create(itemId, filePath, caption, createdBy)` is shape-coupled to inventory items (captions, position indices, item-lifecycle events). Shift-handover attachments have none of those — they're just evidence photos linked to an entry.
- A shared `AttachmentsModule` would require extracting the disk-write helper + MIME validator + cap-check into a generic adapter — worth doing eventually (tracked as Known Limitation #14), but out of V1 scope. Premature generalisation would bloat the Inventory module with hooks nothing else uses yet.
- Pattern-level consistency (memoryStorage + FileInterceptor + controller-dispatched disk write, per ADR-042 Pattern B) is preserved — a future extraction PR has a clean two-consumer starting point.
- The 5 MB / 5-attachment caps are Shift-Handover-specific (Inventory uses 10 MB). Keeping them as service-level constants in `shift-handover.types.ts` surfaces them to reviewers grepping the feature.

### 5. No notifications in V1

No push, email, SSE, or in-app notification is triggered when a handover is submitted, reopened, or auto-locked.

**Why:**

- The primary consumer of a handover is the **next-shift assignee**, who arrives 8 hours later and is going to open the shift grid anyway. A notification adds latency-sensitive infrastructure (SSE fanout, Redis pub/sub) for a use case with no latency requirement.
- The secondary consumer is the Team-Lead doing morning rounds. A badge on the sidebar navigation entry would be useful but adds a real-time count query (similar to the existing `surveys`/`approvals` badges) that V1 doesn't justify.
- V2 can add either pattern cheaply once the writing/reading UX is validated.

**Consequence:** the next-shift assignee sees green/yellow/grey button-state in the shift grid when they open it; there's no proactive push. Documented in the masterplan as a Known Limitation, reviewable in V2.

### 6. No historical backfill

Existing paper handovers are not imported. The feature starts with an empty entries table per tenant.

**Why:**

- Legacy data quality is unknowable. A backfill script would either corrupt the `schema_snapshot` contract (Decision 2) by freezing fabricated schemas, or dump everything into `protocol_text` as unstructured text — defeating the whole point of custom fields.
- The feature's value is forward-looking (audit trail starts now). Past handovers have no operational use case inside the tool; if tenants need them for compliance they remain as scanned paper.
- An opt-in self-service backfill endpoint (Team-Lead pastes free-text into a "seed historical entry" UI) could be added later, but adds trust surface (who's authoring the fake row?) that requires an audit-trail extension to track "backfilled_by" separately from "submitted_by".

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  Frontend (SvelteKit)                                                │
│                                                                      │
│  /shifts                                 /shift-handover-templates   │
│    ├─ ShiftHandoverButton (📋 per cell)   ├─ Team filter dropdown    │
│    └─ ShiftHandoverModal (draft→submit)   └─ FieldBuilder + 8 types  │
│            │                                         │               │
│            └─────── apiClient ─── REST API ──────────┘               │
└──────────────────────────────────────────────────────────────────────┘
                                    │
┌──────────────────────────────────────────────────────────────────────┐
│  Backend (NestJS + Fastify)                                          │
│                                                                      │
│  ShiftHandoverController (/api/v2/shift-handover/*)                  │
│    ├─ class-level @RequireAddon('shift_planning')                    │
│    ├─ per-endpoint @RequirePermission (ADR-020/045)                  │
│    └─ 14 endpoints: templates × 4, entries × 6, attachments × 4     │
│            │                                                         │
│   ┌────────┴──────────┬──────────────┬──────────────┐                │
│   │                   │              │              │                │
│   ▼                   ▼              ▼              ▼                │
│  TemplatesService   EntriesService  AttachmentsSvc  ActiveShift-     │
│  (CRUD + audit)     (draft→submit   (upload, list,   Resolver        │
│                      + reopen +     stream, delete)  (pure fn,       │
│                      schema_snap-                    injected clock) │
│                      shot + FOR                                      │
│                      UPDATE)                                         │
│          │                 │                │              │         │
│          └──── tenantTransaction / systemTransaction ──────┘         │
│                                    │                                 │
│          ┌─── ShiftHandoverCronService (every 6h, TZ=Berlin) ─┐     │
│          │      runAutoLockSweep(nowUtc) → sys_user / BYPASSRLS  │    │
│          └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
                                    │
┌──────────────────────────────────────────────────────────────────────┐
│  PostgreSQL (3 tables, strict RLS per ADR-019)                       │
│                                                                      │
│  shift_handover_templates (UUIDv7, tenant_id + team_id UNIQUE)       │
│  shift_handover_entries    (UUIDv7, composite UNIQUE                 │
│                              (tenant_id, team_id, shift_date,        │
│                               shift_key))                            │
│  shift_handover_attachments (UUIDv7, FK→entries ON DELETE CASCADE)  │
│                                                                      │
│  Every write wraps tenantTransaction (app_user + set_config          │
│  app.tenant_id); cron uses systemTransaction (sys_user BYPASSRLS).   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Permission Model (ADR-045 Layer 1-2-3)

| Layer | Gate                                    | Mechanism                                                                                                                                    |
| ----- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Addon active?                           | `tenant_addons.status` — `@RequireAddon('shift_planning')` class-level + SSR `requireAddon()`                                                |
| 1     | Can manage?                             | `canManageShiftHandoverTemplates = canManage` → ADR-045 (`role === 'root' \|\| (role === 'admin' && hasFullAccess) \|\| orgScope.isAnyLead`) |
| 2     | Per-module `canRead/canWrite/canDelete` | `@RequirePermission(SHIFT_PLANNING_ADDON, MOD_TEMPLATES \| MOD_ENTRIES, 'canWrite')` (ADR-020)                                               |

Two new permission modules registered at boot by `ShiftHandoverPermissionRegistrar` under the existing `shift_planning` addon category:

- `shift-handover-templates` (canRead / canWrite / canDelete)
- `shift-handover-entries` (canRead / canWrite / canDelete — `canDelete` gates attachment deletion, not entry deletion; entries are never API-deleted, only auto-locked)

Creator-bypass for edits: the original `submitted_by` (or `reopened_by`) user can edit their own entry until submission. After submission, only a Lead with `canWrite` can reopen.

---

## Alternatives Considered

### A. Per-day handover row (no slot granularity)

**Rejected.** Per Decision 1 — destroys per-crew authorship and audit trail. Night Teams would overwrite early Teams' rows.

### B. Relational field values (normalised schema, no JSONB)

**Rejected.** Per Decision 2 — `JOIN … WHERE field_key = ?` per field on every read, linear in field count. Template evolution would require dynamic DDL. The shared Zod validator already treats values as an object — matching that 1:1 with JSONB is the least-impedance mapping.

### C. Live template for read (no schema_snapshot)

**Rejected.** Per Decision 2 — template evolution retroactively corrupts historical entries. Compliance-fatal.

### D. Reuse Inventory's AttachmentsService directly

**Rejected.** Per Decision 4 — signature is inventory-item-shaped, refactoring it into a generic adapter is a separate PR with its own review surface.

### E. Build historical backfill UI

**Rejected.** Per Decision 6 — V1 scope, no operational use case, adds trust-surface complications.

### F. Real-time notifications on submit

**Rejected.** Per Decision 5 — latency-insensitive use case. Adds SSE fanout + Redis pub/sub for no measurable benefit. Deferred to V2.

### G. Shared AttachmentsModule across Inventory + Shift-Handover + future addons

**Deferred.** The right long-term answer, but needs three consumers to avoid over-fitting to two. Tracked as masterplan Known Limitation #14.

---

## Consequences

### Positive

1. **Per-slot authorship preserved** — audit trail reflects operational reality.
2. **Template drift is safe** — historical handovers stay interpretable by construction.
3. **Same Zod validator runs frontend + backend** — no duplication, no drift risk between client-side "helpful errors" and server-side "authoritative errors".
4. **Resolver is testable without globals** — pure function + injected clock. 17 unit tests + 8 TZ matrix cases.
5. **RLS defense-in-depth on all 3 tables** — strict-mode policies per ADR-019, `sys_user` (BYPASSRLS) only for the cross-tenant auto-lock sweep.
6. **Addon-gated at every layer** — Addon off → Sidebar entry, controller class guard, and `+page.server.ts` guard all block independently.
7. **Submitted-state is immutable except via Lead reopen** — submitted entries survive template deletion because of the snapshot.
8. **Attachment caps are service-level, grep-visible** — `SHIFT_HANDOVER_MAX_ATTACHMENT_SIZE`, `SHIFT_HANDOVER_MAX_ATTACHMENTS_PER_ENTRY`, `SHIFT_HANDOVER_ALLOWED_MIME_TYPES` exported from `shift-handover.types.ts`.

### Negative

1. **V1 has no notifications** — next-shift assignees only see state when they open the shift grid. V2 cost.
2. **V1 has no historical list page** — side-panel (modal in read-mode) is the only read surface. A dedicated `/shift-handover` list is a V2 ask.
3. **R13 slot whitelist (early/late/night)** — tenants with custom slot codes (e.g. a 4-crew rotation with A/B/C/D) are blocked until the resolver gains enum-equivalence mapping for their codes. Session 1 §0.8 spike verified this is not a V1 blocker across the current dev tenants but must be extended before onboarding a 4-crew customer.
4. **Attachment-history not rendered on reopened modals** — session-freshly-uploaded attachments render in memory only; historical attachments would require a new `GET /attachments` list endpoint (masterplan Spec Deviation #6, V2).
5. **Inventory attachment pattern is duplicated** — worth factoring when a third consumer appears (Known Limitation #14).
6. **Cross-tenant auto-lock uses `sys_user`** — correct by design per ADR-019, but the cron handler must not accept tenant-scoped input (callers of `runAutoLockSweep` pass only `nowUtc`).

### Risks & Mitigations

| Risk                                                                   | Mitigation                                                                                                                                                                               |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Template deletion breaks draft entries                                 | Drafts validate against live template; deleting fields used in a draft is a UX-level warning, not blocked. Final authoritative validator runs on submit.                                 |
| `DEFERRABLE` unique constraint broke `ON CONFLICT` upserts (Session 8) | Fixed by migration #145 (`20260422215918297_drop-shift-handover-entries-deferrable.ts`) — constraint recreated as plain UNIQUE. Phase-4 integration tests caught it on the first INSERT. |
| Submit happens during a DST transition gap                             | Resolver does all TZ math in SQL (`AT TIME ZONE 'Europe/Berlin'`). 8 matrix test cases cover pre/during/post DST.                                                                        |
| A Lead reopens an entry after template drift                           | Edits on a reopened entry run against the SNAPSHOT (`submitted`+`reopened` both non-draft per `renderFields` derivation). Re-submitting resnapshots.                                     |
| Cron handler throws — no retry                                         | Error swallowed inside the `@Cron` handler (NestJS scheduler does not retry). Next 6h firing is the natural retry. Logged at ERROR with `getErrorMessage(error)`.                        |
| `shift_times` misconfigured for a (tenant, slot)                       | `ActiveShiftResolver.getShiftEndClock` throws `NotFoundException('shift slot not configured')` fail-loud. Modal surfaces the message.                                                    |

---

## Verification

| Tier | Metric                                  | Result                                                     |
| ---- | --------------------------------------- | ---------------------------------------------------------- |
| 1    | Unit tests (`pnpm run test:unit`)       | 95 passed (127% of DoD ≥75 target — Session 7)             |
| 2    | API integration (`pnpm run test:api`)   | 39 passed (156% of DoD ≥25 target — Session 8)             |
| 3    | `pnpm run type-check` across workspaces | shared + frontend + backend + backend-test exit 0          |
| 4    | `pnpm exec eslint` across feature dirs  | exit 0                                                     |
| 5    | `pnpm run check` (svelte-check)         | 2652 files / 0 errors / 0 warnings (Session 10-12)         |
| 6    | Manual E2E smoke                        | Owned by product owner — see masterplan §Manual Smoke Test |

---

## References

- [Masterplan](../../FEAT_SHIFT_HANDOVER_MASTERPLAN.md) — full 13-session execution history
- [ADR-011](./ADR-011-shift-data-architecture.md) — canonical shift model (resolver reuses the merge pattern at L681-691)
- [ADR-015](./ADR-015-shared-package-architecture.md) — shared Zod validator lives in `@assixx/shared/shift-handover`
- [ADR-019](./ADR-019-multi-tenant-rls-isolation.md) — strict-mode RLS + Triple-User Model used on all 3 tables
- [ADR-020](./ADR-020-per-user-feature-permissions.md) — per-user canRead/canWrite/canDelete for the two new permission modules
- [ADR-033](./ADR-033-addon-based-saas-model.md) — `shift_planning` addon gating (Layer 0)
- [ADR-034](./ADR-034-hierarchy-labels-propagation.md) — `labels.team` used in modal + template page
- [ADR-040](./ADR-040-inventory-addon-architecture.md) — reference pattern for the ADAPT decision
- [ADR-042](./ADR-042-multipart-file-upload-pipeline.md) — memoryStorage + FileInterceptor + service-owned disk write
- [ADR-045](./ADR-045-permission-visibility-design.md) — `canManage` Layer-1 gate used by templates page + `applyShiftHandoverVariant`
