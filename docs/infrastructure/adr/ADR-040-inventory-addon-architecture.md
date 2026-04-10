# ADR-040: Inventory Addon Architecture

| Metadata                | Value                                                                       |
| ----------------------- | --------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                    |
| **Date**                | 2026-04-06 (V1) / 2026-04-08 (V1.1 Tag amendment)                           |
| **Decision Makers**     | SCS Technik                                                                 |
| **Affected Components** | Backend (NestJS), Frontend (SvelteKit), Database (PostgreSQL), Addon System |

---

## Context

Industrial companies need to track physical equipment (cranes, forklifts, ladders, etc.) with unique identification codes and QR labels. The existing `assets` core addon (ADR-033 #9) tracks machine availability and maintenance scheduling — it serves a different concern (operational status of production machines).

A new **purchasable addon** is needed for general equipment inventory management with:

- User-defined inventory lists (e.g., "Krane", "Gabelstapler")
- Auto-generated item codes (e.g., KRN-001, KRN-002)
- Custom fields per list (EAV pattern)
- Photo documentation
- QR code labels for physical identification

## Decision

### Separate Addon, Not Part of Assets

The inventory system is a standalone purchasable addon (`code: 'inventory'`, €10/month) — **completely separate** from the `assets` core addon.

**Rationale:**

- Assets = production machine availability (core, always active)
- Inventory = general equipment tracking (purchasable, optional)
- Different user personas: assets are managed by production leads, inventory by safety/maintenance staff
- Merging would bloat the core addon and force all tenants to pay for features they don't need

### Data Model: UUID Primary Keys

All inventory tables use `UUID PRIMARY KEY` (not `SERIAL`). The item UUID serves as the QR code target — scanning a QR label resolves directly to `/inventory/items/{uuid}`.

**Tables (5):**

- `inventory_lists` — List containers with code generation settings
- `inventory_items` — Individual equipment items with auto-generated codes
- `inventory_custom_fields` — EAV field definitions per list
- `inventory_custom_values` — EAV field values per item
- `inventory_item_photos` — Photo documentation per item

### Code Auto-Generation

Each list defines a code prefix (e.g., "KRN"), separator ("-"), and digit count (3). Items receive sequential codes: KRN-001, KRN-002, etc.

Race condition prevention: `SELECT ... FOR UPDATE` lock on `inventory_lists.next_number` within a transaction ensures no duplicate codes under concurrent inserts.

**Rules:**

- Numbers are never reused (even after deletion)
- Numbers are never manually editable
- Prefix can be changed on the list — existing codes remain unchanged

### Custom Fields (EAV Pattern)

Lists support up to 30 custom fields with typed storage:

- `value_text` (TEXT) — for text and select types
- `value_number` (NUMERIC) — for number type
- `value_date` (DATE) — for date type
- `value_boolean` (BOOLEAN) — for boolean type

Custom values are embedded in item create/update payloads (no separate CRUD endpoints for values).

### Permission Model (ADR-020)

Two permission modules:

- `inventory-lists` — canRead, canWrite, canDelete
- `inventory-items` — canRead, canWrite, canDelete

All roles (root, admin, employee) can access inventory — controlled via `user_addon_permissions` per ADR-020 pattern.

### Frontend Route: `(shared)/inventory/`

Placed in the `(shared)` route group (not `(admin)`) because all roles need access. Addon gating via `@RequireAddon('inventory')` on all backend endpoints and `apiFetchWithPermission` on the frontend SSR load.

## Alternatives Considered

| Alternative                       | Pros                       | Cons                                               |
| --------------------------------- | -------------------------- | -------------------------------------------------- |
| Extend assets addon               | No new addon, shared infra | Bloats core, different concerns, forced on tenants |
| JSON column for custom fields     | Simpler schema             | No typed queries, no indexing, hard to validate    |
| Separate CRUD for custom values   | Clean REST separation      | More HTTP calls, worse UX for batch operations     |
| Integer PKs + separate QR mapping | Familiar pattern           | Extra indirection, QR → UUID is natural            |

## Consequences

### Positive

- Clean separation from assets (single responsibility)
- UUID PKs enable direct QR code scanning without mapping tables
- EAV pattern provides unlimited field flexibility per list
- FOR UPDATE lock prevents code generation race conditions
- Follows established addon pattern (ADR-033)

### Negative

- EAV queries are more complex than flat column queries (mitigated by 30-field limit)
- UUID PKs are larger than integers (acceptable trade-off for QR utility)
- Separate addon = separate payment (but at €10/month it's low friction)

## V1 Limitations (Intentional)

- No inspection workflow (date columns reserved for V2)
- No Excel import (V2)
- No QR scanner UI (V2 — QR generation only)
- No barcode support (V2)
- No item history timeline (V2)
- No dashboard widgets (V2)

---

## V1.1 Amendment — Tag System (2026-04-08)

The original V1 design used a single freetext `inventory_lists.category VARCHAR(100)` column with a distinct-value autocomplete endpoint. This proved inadequate: tenants need to label one list with **multiple** orthogonal concepts (e.g., a "Krane" list and a "Seile" list both belong to the "Lastaufnahmemittel" category, and both also belong to "Wartungspflichtig"), and they need to filter the overview by those labels.

### Decision

Replace the freetext `category` column with a normalized **N:M tag relation**:

```
inventory_tags                       inventory_list_tags
──────────────                       ───────────────────
id UUID PK                           list_id UUID FK ──┐
tenant_id INT FK                     tag_id  UUID FK ──┴── PK
name VARCHAR(50) NOT NULL            tenant_id INT FK
icon VARCHAR(50)                     created_at
created_by, timestamps               RLS strict (ADR-019)
RLS strict (ADR-019)                 Indexes on tag_id, tenant_id
GRANTs: app_user + sys_user
UNIQUE INDEX (tenant_id, LOWER(name))
```

**Why normalized over JSONB array on inventory_lists:**

- Renaming "Lastaufnahmemittel" → "Hebezeuge" = 1 UPDATE instead of N rows
- Case-insensitive UNIQUE prevents typo duplicates ("Krane" vs "KRANE" rejected)
- Filter by tag = simple JOIN/EXISTS, not JSONB path expression
- Tag usage count is `COUNT(*) FROM inventory_list_tags GROUP BY tag_id` (gratis)
- Future tag metadata (color, sort order) without touching every list

**Why not polymorphic shared tags (KVP/Documents/etc.):**

YAGNI. Only inventory needs this right now. Polymorphic FKs break referential integrity and complicate RLS. Refactor later if a second module needs the same shape — see ADR-016 for an analogous deferred-generalisation precedent.

### Tag Lifecycle Rules

- **Hard delete only** — no `is_active` column. The junction `ON DELETE CASCADE` cleans references automatically. Soft-deleted tags would create ghost UI ("invisible label still attached to a list").
- **Case-insensitive uniqueness per tenant** — enforced via the functional unique index `idx_inventory_tags_tenant_name_lower`. The DB raises 23505 on duplicates; service catches and maps to `ConflictException` (409).
- **Hard cap** — `MAX_TAGS_PER_LIST = 10`. Enforced both in the Zod DTO (frontend feedback) and in `replaceTagsForList` (defence in depth).
- **No tag-on-item** — tags attach to lists only. Items inherit no tags. If item-level tags ever become a requirement, add a separate `inventory_item_tags` junction.

### Permission Model

Tag CRUD reuses the existing `inventory-lists` permission module — tags are list metadata, not a separate concern:

- `GET /inventory/tags` → `inventory-lists.read`
- `POST /inventory/tags` → `inventory-lists.write`
- `PATCH /inventory/tags/:id` → `inventory-lists.write`
- `DELETE /inventory/tags/:id` → `inventory-lists.delete`

No new permission module required. Tag rename is `write` (not `delete`) because it affects every referencing list, but it does not destroy data.

### Migration Path

Four sequential migrations (Schema/Data discipline per DATABASE-MIGRATION-GUIDE.md):

1. `*_inventory-tags-table` — create `inventory_tags` with RLS + GRANTs + functional unique index + trigger
2. `*_inventory-list-tags-junction` — create `inventory_list_tags` with composite PK + indexes + RLS + GRANTs
3. `*_inventory-migrate-categories-to-tags` — backfill: `DISTINCT (tenant_id, LOWER(category))` → `inventory_tags`, then link via `inventory_list_tags`. Idempotent / no-op when `category` is empty.
4. `*_inventory-drop-category-column` — `ALTER TABLE inventory_lists DROP COLUMN category`

Migration 3 is one-way (lossy rollback): the original casing of mixed-case duplicates is collapsed to `MIN(name)` per tenant. Documented in the migration header.

### API Surface Changes (Breaking)

- **Removed**: `GET /inventory/categories?q=` — replaced by `GET /inventory/tags`
- **Added**: `POST /inventory/tags`, `PATCH /inventory/tags/:tagId`, `DELETE /inventory/tags/:tagId`
- **Added query**: `GET /inventory/lists?tagIds=uuid1,uuid2` — comma-separated UUIDs, OR semantics
- **Lists payload (create/update)**: `category` field removed, `tagIds: string[]` added
- **Lists response**: `category` field removed, `tags: { id, name, icon, … }[]` added

### Frontend Components

- `TagInput.svelte` — chip input with typeahead from cached `tagsState`, inline-create on Enter (default icon `fa-tag`). Visual contract matches `form-field__control` via shared form-field tokens.
- `TagFilterDropdown.svelte` — multi-select filter on the inventory overview, OR semantics, badge with selected count.
- `TagsManagementModal.svelte` — list all tenant tags with usage counts; inline rename + icon picker; hard delete with confirmation.

The shared `tagsState` (Svelte 5 rune in `_lib/state.svelte.ts`) is hydrated from SSR via `+page.server.ts`'s parallel fetch and refreshed after every mutation through `invalidateAll()` or explicit `loadTags()` calls.

### Consequences (delta)

**Positive:**

- Tenants can now express multi-dimensional labels (a list can be both "Lastaufnahmemittel" and "Wartungspflichtig")
- Filter and search by tag works across the whole inventory
- Renaming a tag is a single global operation, not a search-and-replace per list
- Tag catalog is discoverable (management modal) and reusable across lists

**Negative:**

- One additional table + junction = 2 more migrations to maintain
- Tag CRUD adds 4 endpoints + 1 service to the inventory module surface area
- Frontend has 3 new components (TagInput, TagFilterDropdown, TagsManagementModal)
- Inline tag create from list modal uses the default `fa-tag` icon — explicit icon pick happens later via the management modal (one extra step for users who care about icons during list creation)

## References

- [Inventory Masterplan](../../FEAT_INVENTORY_MASTERPLAN.md)
- [ADR-033: Addon-based SaaS Model](./ADR-033-addon-based-saas-model.md)
- [ADR-019: Multi-Tenant RLS Isolation](./ADR-019-multi-tenant-rls-isolation.md)
- [ADR-020: Per-User Feature Permissions](./ADR-020-per-user-feature-permissions.md)
- [ADR-016: Tenant-Customizable Seed Data](./ADR-016-tenant-customizable-seed-data.md) — analogous deferred-generalisation pattern
