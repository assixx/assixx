# FEAT: Inventory — Equipment Tracking & Inspection System Masterplan

> **Created:** 2026-04-03
> **Version:** 1.0.0
> **Status:** COMPLETE — All 6 Phases Done (5.4 QR deferred to V1.1)
> **Branch:** `feat/inventory`
> **Author:** SCS Technik (Staff Engineer)
> **Estimated Sessions:** 12
> **Actual Sessions:** 11 / 12 (1 deferred)

---

## Changelog

| Version | Date       | Change                                               |
| ------- | ---------- | ---------------------------------------------------- |
| 0.1.0   | 2026-04-03 | Initial Draft — 6 phases planned                     |
| 0.1.1   | 2026-04-03 | Fix 4 critical + 6 major + 7 minor validation issues |

---

## Executive Summary

A new **purchasable addon** (`inventory`, €10/month) for managing equipment inventories.
Users create **Inventory Lists** (e.g., "Cranes", "Forklifts", "Ladders") and add
**Inventory Items** to each list with auto-generated codes (e.g., `KRN-001`),
photos, custom fields, and QR codes for physical identification.

**Completely separate** from the existing `assets` core addon (ADR-033 #9).

### What This Is NOT (V1)

- No inspection workflow (date columns reserved for V2)
- No automated notifications for overdue inspections
- No Excel import (V2)
- No barcode/QR scanner in the UI (V2 — QR generation only in V1)

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (all containers healthy)
- [ ] DB Backup created
- [ ] Branch `feat/inventory` checked out
- [ ] No pending migrations
- [ ] ADR-033 addon system fully implemented
- [ ] `addons` seed table accepts new purchasable addons

### 0.2 Risk Register

| #   | Risk                                   | Impact | Likelihood | Mitigation                                                 | Verification                            |
| --- | -------------------------------------- | ------ | ---------- | ---------------------------------------------------------- | --------------------------------------- |
| R1  | EAV custom fields kill query perf      | High   | Medium     | Partial indexes on custom_values, limit fields per list    | EXPLAIN ANALYZE on list with 20 fields  |
| R2  | Code auto-generation race condition    | High   | Medium     | `FOR UPDATE` lock on `inventory_lists.next_number`         | Unit test: parallel item creation       |
| R3  | QR code library bloats frontend bundle | Low    | Medium     | Use lightweight `qrcode` npm (canvas-based, ~15KB gzipped) | Bundle size check before/after          |
| R4  | Custom field deletion orphans values   | Medium | Low        | CASCADE on FK + soft-delete default                        | Unit test: field delete cascades values |
| R5  | Photo upload storage limits            | Medium | Medium     | Reuse existing document upload infrastructure              | Test with 5MB+ images                   |

### 0.3 Ecosystem Integration Points

| System              | Integration                                     | Phase |
| ------------------- | ----------------------------------------------- | ----- |
| AddonCheckService   | `@RequireAddon('inventory')` on all endpoints   | 2     |
| Permission Registry | `InventoryPermissionRegistrar` via OnModuleInit | 2     |
| Addon seed data     | New row in `addons` table (purchasable)         | 1     |
| Navigation config   | New sidebar entry with addon guard              | 5     |
| Audit Trail         | Log item create/update/delete/status changes    | 6     |
| SSE/Notifications   | Not in V1 (reserved for V2 inspection alerts)   | —     |

---

## Architecture Decisions

### Data Model

```
┌──────────────────────────────────────────────────────────────┐
│  inventory_lists                                              │
│  ├── title, description, category (freetext)                 │
│  ├── code_prefix ("KRN") — UNIQUE per tenant                │
│  ├── code_digits (3), code_separator ("-")                   │
│  └── next_number (auto-increment counter per list)           │
│       │                                                       │
│       ├──── 1:N ──── inventory_items                          │
│       │                ├── code "KRN-001" (auto-generated)   │
│       │                ├── id = UUID (QR code target!)        │
│       │                ├── status (ENUM)                      │
│       │                ├── name, location, manufacturer, ...  │
│       │                ├── last/next_inspection_date (V2)     │
│       │                │                                      │
│       │                ├──── 1:N ──── inventory_item_photos   │
│       │                │               └── sort_order         │
│       │                └──── 1:N ──── inventory_custom_values │
│       │                                     │                 │
│       └──── 1:N ──── inventory_custom_fields ┘                │
│                        ├── field_name, field_type             │
│                        ├── field_options (JSONB), field_unit  │
│                        ├── is_required, sort_order            │
│                        └── UNIQUE(list_id, field_name)        │
└──────────────────────────────────────────────────────────────┘
```

### Code Auto-Generation

```
Settings per list:
  code_prefix:    "KRN"      (user-defined, 2-5 uppercase chars)
  code_separator: "-"        (default, configurable)
  code_digits:    3          (default, configurable → 001-999)

Generation:
  1. BEGIN TRANSACTION
  2. SELECT next_number FROM inventory_lists WHERE id = $1 FOR UPDATE
  3. code = prefix + separator + padStart(next_number, digits, '0')
  4. UPDATE inventory_lists SET next_number = next_number + 1
  5. INSERT INTO inventory_items (..., code)
  6. COMMIT

Result: KRN-001, KRN-002, KRN-003, ...

Rules:
  - Numbers are NEVER manually editable
  - Numbers are NEVER reused (even after deletion)
  - Prefix can be changed on the list, existing codes remain unchanged
  - Code is UNIQUE per tenant (UNIQUE(tenant_id, code))
```

### QR Code Strategy

```
QR code content = Item UUID (UUIDv7)

Scan flow:
  Phone camera → QR scan → UUID
  → App resolves: /inventory/items/{uuid}
  → Item detail page (responsive, works on mobile)

Print layout (per item):
  ┌─────────────────────────┐
  │  ┌─────────────┐        │
  │  │ ██ QR ██    │ KRN-001│
  │  │ ██ CODE ██  │        │
  │  └─────────────┘        │
  │  Brückenkran Halle A     │
  │  Lichtgitter GmbH        │
  └─────────────────────────┘

Generated client-side (no backend needed).
Library: `qrcode` (npm) — lightweight, canvas/SVG output.
  → Must be added: `cd frontend && pnpm add qrcode && pnpm add -D @types/qrcode`
Print: CSS @media print stylesheet.
```

### Custom Fields (EAV Pattern)

```
Per list, the admin defines custom fields:
  - "Tragkraft" (number, unit: "kg", required: true)
  - "Prüfsiegel" (boolean)
  - "Nächste TÜV-Prüfung" (date)
  - "Zustand" (select: ["gut", "mittel", "schlecht"])
  - "Anmerkung" (text)

Storage: Entity-Attribute-Value (EAV)
  inventory_custom_fields  → field definitions per list
    - field_name, field_type (ENUM), field_options (JSONB)
    - field_unit ("kg", "mm", "bar"), is_required (BOOLEAN)
    - sort_order (SMALLINT) — UI display order
    - UNIQUE(tenant_id, list_id, field_name)

  inventory_custom_values  → field values per item
    - UNIQUE(tenant_id, item_id, field_id)

Typed columns in custom_values:
  value_text    TEXT      ← text + select (select stored as text)
  value_number  NUMERIC   ← number
  value_date    DATE      ← date
  value_boolean BOOLEAN   ← boolean

Custom values are embedded in item create/update payloads (not separate endpoints).
Read query joins items with their custom values and pivots by field_id.
Limit: max 30 custom fields per list (prevents perf degradation).
```

### Permission Model (ADR-020)

```typescript
const INVENTORY_PERMISSIONS: PermissionCategoryDef = {
  code: 'inventory',
  label: 'Inventar',
  icon: 'fa-boxes-stacked',
  modules: [
    {
      code: 'inventory-lists',
      label: 'Inventarlisten',
      icon: 'fa-list',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'inventory-items',
      label: 'Inventargegenstände',
      icon: 'fa-cube',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
  ],
};
```

All roles (root, admin, employee) can access inventory — controlled via
`user_addon_permissions` like all other addons. Root/Admin with
`has_full_access` bypass permission checks as usual.

### Route Structure

```
frontend/src/routes/(app)/(shared)/inventory/
  +page.svelte              # Lists overview (cards with status counts)
  +page.server.ts           # requireAddon('inventory') + load lists
  lists/
    [id]/
      +page.svelte          # Items table for a specific list
      +page.server.ts       # Load list + items + custom fields
  items/
    [uuid]/
      +page.svelte          # Item detail (QR target, full info)
      +page.server.ts       # Load item + photos + custom values
  _lib/
    types.ts                # TypeScript interfaces
    state.svelte.ts         # Svelte 5 runes state
    api.ts                  # API client wrappers
    constants.ts            # Status labels, badges, icons
    ListCard.svelte         # List overview card component
    ItemRow.svelte           # Item table row
    ItemModal.svelte        # Create/edit item modal
    ListModal.svelte        # Create/edit list modal
    CustomFieldEditor.svelte # Manage custom fields
    QrLabel.svelte          # QR code + label for printing
    StatusBadge.svelte      # Color-coded status badge
```

---

## Phase 1: Database Migrations

> **Dependency:** None (first phase)
> **New tables:** 5 + 2 ENUMs + 1 addon insert
> **Migration files:** 3 (core tables, custom/photos, addon seed)
>
> **UUID convention:** `DEFAULT gen_random_uuid()` in SQL (UUIDv4).
> UUIDv7 is generated app-side via npm `uuid` package for new records.
> See migration 20260311000000088 SPEC DEVIATION D1 for rationale.
>
> **RLS convention:** Strict mode (ADR-019 updated 2026-04-04). No bypass clause.
> All new tables use `tenant_id = NULLIF(...)::integer` (returns 0 rows without context).
> GRANTs for BOTH `app_user` AND `sys_user` (Triple-User Model).

### Step 1.1: Create ENUMs + Core Tables ✅ DONE (2026-04-05)

**New migration:** `{timestamp}_inventory-core-tables.ts`

**SQL operations:**

1. Create ENUM `inventory_item_status`:
   `operational`, `defective`, `repair`, `maintenance`,
   `decommissioned`, `removed`, `stored`

2. Create ENUM `inventory_field_type`:
   `text`, `number`, `date`, `boolean`, `select`

3. Create table `inventory_lists`:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
   - `title VARCHAR(255) NOT NULL`
   - `description TEXT`
   - `category VARCHAR(100)` — freetext, nullable
   - `code_prefix VARCHAR(10) NOT NULL` — e.g., "KRN" (Zod validates 2-5 uppercase)
   - `code_separator VARCHAR(3) NOT NULL DEFAULT '-'`
   - `code_digits SMALLINT NOT NULL DEFAULT 3`
   - `next_number INTEGER NOT NULL DEFAULT 1`
   - `icon VARCHAR(50)` — optional FA icon
   - `is_active SMALLINT NOT NULL DEFAULT 1`
   - `created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - `UNIQUE(tenant_id, code_prefix)` — prevents duplicate prefixes per tenant
   - RLS policy: `tenant_isolation` (**strict mode** — ADR-019, no bypass clause)
   - GRANTs: `SELECT, INSERT, UPDATE, DELETE` to `app_user` **AND** `sys_user`
   - Index: `idx_inventory_lists_tenant ON (tenant_id) WHERE is_active = 1`
   - Trigger: `update_inventory_lists_updated_at` → `update_updated_at_column()`

4. Create table `inventory_items`:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` (QR code target!)
   - `tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
   - `list_id UUID NOT NULL REFERENCES inventory_lists(id) ON DELETE CASCADE`
   - `code VARCHAR(20) NOT NULL` — auto-generated, e.g., "KRN-001"
   - `name VARCHAR(255) NOT NULL`
   - `description TEXT`
   - `status inventory_item_status NOT NULL DEFAULT 'operational'`
   - `location VARCHAR(255)` — freetext
   - `manufacturer VARCHAR(255)`
   - `model VARCHAR(255)`
   - `serial_number VARCHAR(255)`
   - `year_of_manufacture SMALLINT`
   - `notes TEXT`
   - `responsible_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL` — nullable, V2 use
   - `last_inspection_date DATE` — nullable, V2 use
   - `next_inspection_date DATE` — nullable, V2 use
   - `inspection_interval VARCHAR(20)` — nullable, V2 use (VARCHAR for flexibility, not ENUM)
   - `is_active SMALLINT NOT NULL DEFAULT 1`
   - `created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - `UNIQUE(tenant_id, code)` — globally unique codes per tenant
   - RLS policy: `tenant_isolation` (**strict mode** — ADR-019, no bypass clause)
   - GRANTs: `SELECT, INSERT, UPDATE, DELETE` to `app_user` **AND** `sys_user`
   - Indexes:
     - `idx_inventory_items_tenant ON (tenant_id) WHERE is_active = 1`
     - `idx_inventory_items_list ON (list_id) WHERE is_active = 1`
     - `idx_inventory_items_status ON (tenant_id, status) WHERE is_active = 1`
   - Trigger: `update_inventory_items_updated_at` → `update_updated_at_column()`

### Step 1.2: Custom Fields + Photos Tables ✅ DONE (2026-04-05)

**New migration:** `{timestamp}_inventory-custom-fields-photos.ts`

1. Create table `inventory_custom_fields`:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
   - `list_id UUID NOT NULL REFERENCES inventory_lists(id) ON DELETE CASCADE`
   - `field_name VARCHAR(100) NOT NULL`
   - `field_type inventory_field_type NOT NULL DEFAULT 'text'`
   - `field_options JSONB` — for select type: `["option1", "option2"]`
   - `field_unit VARCHAR(20)` — optional: "kg", "mm", "bar"
   - `is_required BOOLEAN NOT NULL DEFAULT false`
   - `sort_order SMALLINT NOT NULL DEFAULT 0`
   - `is_active SMALLINT NOT NULL DEFAULT 1`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - `UNIQUE(tenant_id, list_id, field_name)` — no duplicate field names per list
   - RLS strict mode + GRANTs (app_user + sys_user) + Index on `(list_id) WHERE is_active = 1`
   - Trigger: `update_inventory_custom_fields_updated_at`

2. Create table `inventory_custom_values`:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
   - `item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE`
   - `field_id UUID NOT NULL REFERENCES inventory_custom_fields(id) ON DELETE CASCADE`
   - `value_text TEXT`
   - `value_number NUMERIC`
   - `value_date DATE`
   - `value_boolean BOOLEAN`
   - `is_active SMALLINT NOT NULL DEFAULT 1`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - `UNIQUE(tenant_id, item_id, field_id)` — one value per item-field pair
   - RLS strict mode + GRANTs (app_user + sys_user) + Index on `(item_id) WHERE is_active = 1`
   - Trigger: `update_inventory_custom_values_updated_at`

3. Create table `inventory_item_photos`:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
   - `item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE`
   - `file_path TEXT NOT NULL`
   - `caption VARCHAR(255)`
   - `sort_order SMALLINT NOT NULL DEFAULT 0`
   - `is_active SMALLINT NOT NULL DEFAULT 1`
   - `created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - RLS strict mode + GRANTs (app_user + sys_user) + Index on `(item_id) WHERE is_active = 1`

### Step 1.3: Addon Seed Data ✅ DONE (2026-04-05)

**New migration:** `{timestamp}_inventory-addon-seed.ts`

Inserts the `inventory` addon into the `addons` table with all 14 columns
matching the existing seed pattern:

```sql
INSERT INTO addons (
  id, code, name, description, price_monthly, is_active,
  requires_setup, setup_instructions, icon, sort_order,
  created_at, updated_at, is_core, trial_days
) VALUES (
  25,                -- next available ID after 24 existing addons
  'inventory',
  'Inventar',
  'Betriebsmittel-Inventarverwaltung mit Listen, Custom Fields und QR-Codes',
  10.00,             -- €10/month (purchasable)
  1,                 -- active
  false,             -- no setup required
  NULL,              -- no setup instructions
  'fa-boxes-stacked', -- FontAwesome icon
  155,               -- sort_order between reports (150) and audit_trail (190)
  NOW(), NOW(),
  false,             -- NOT core (purchasable)
  30                 -- 30-day trial
) ON CONFLICT (id) DO NOTHING;

-- Sync sequence
SELECT setval('addons_id_seq', GREATEST((SELECT MAX(id) FROM addons), 25));
```

After migration: run `./scripts/sync-customer-migrations.sh` to update
customer fresh-install and regenerate seed data.

### Phase 1 — Definition of Done

- [ ] 3 migration files with `up()` AND `down()`
- [ ] All migrations pass dry-run: `doppler run -- ./scripts/run-migrations.sh up --dry-run`
- [ ] All migrations successfully applied
- [ ] 5 new tables exist with RLS policies (5/5 verified via `pg_policies`)
- [ ] 5 `update_updated_at` triggers created (4 tables with updated_at)
- [ ] 2 new ENUMs created and verified
- [ ] `addons` table contains `inventory` row (id=25, code='inventory')
- [ ] `UNIQUE(tenant_id, code_prefix)` constraint on inventory_lists verified
- [ ] `UNIQUE(tenant_id, item_id, field_id)` constraint on custom_values verified
- [ ] Backend compiles without errors
- [ ] Existing tests still pass
- [ ] Backup exists before migrations
- [ ] Customer fresh-install synced: `./scripts/sync-customer-migrations.sh`

---

## Phase 2: Backend Module

> **Dependency:** Phase 1 complete
> **Reference:** `backend/src/nest/tpm/` (similar pattern)

### Step 2.1: Module Skeleton + Types + DTOs + Permissions ✅ DONE (2026-04-05)

**New directory:** `backend/src/nest/inventory/`

```
backend/src/nest/inventory/
  inventory.module.ts
  inventory.types.ts
  inventory.permissions.ts
  inventory-permission.registrar.ts
  dto/
    index.ts
    create-list.dto.ts
    update-list.dto.ts
    create-item.dto.ts
    update-item.dto.ts
    create-custom-field.dto.ts
    update-custom-field.dto.ts
    common.dto.ts
```

Register `InventoryModule` in `app.module.ts`.

### Step 2.2: InventoryListsService ✅ DONE (2026-04-05)

**Methods:**

- `findAll(tenantId)` — All lists with dynamic status counts (aggregate query)
- `findById(tenantId, listId)` — Single list with field definitions
- `create(tenantId, dto, createdBy)` — Create list with prefix validation
- `update(tenantId, listId, dto)` — Update list (prefix change does NOT affect existing codes)
- `softDelete(tenantId, listId)` — Soft-delete list (is_active = 4)
- `getCategoryAutocomplete(tenantId, query)` — Distinct categories for autocomplete

### Step 2.3: InventoryItemsService ✅ DONE (2026-04-05)

**Methods:**

- `findByList(tenantId, listId, filters)` — Items filtered by list, status, search
- `findByUuid(tenantId, uuid)` — Single item with photos + custom values (QR target)
- `create(tenantId, dto, createdBy)` — Create item + auto-generate code (FOR UPDATE lock)
- `update(tenantId, uuid, dto)` — Update item
- `updateStatus(tenantId, uuid, status)` — Status change (separate method for audit)
- `softDelete(tenantId, uuid)` — Soft-delete item

**Critical: Code auto-generation within transaction with row lock.**

### Step 2.4: InventoryCustomFieldsService ✅ DONE (2026-04-05)

**Methods:**

- `findByList(tenantId, listId)` — Field definitions for a list
- `create(tenantId, listId, dto)` — Add custom field (max 30 per list)
- `update(tenantId, fieldId, dto)` — Update field definition
- `softDelete(tenantId, fieldId)` — Soft-delete field
- `getValues(tenantId, itemId)` — All custom values for an item
- `upsertValues(tenantId, itemId, values[])` — Batch upsert custom values

### Step 2.5: InventoryPhotosService ✅ DONE (2026-04-05)

**Methods:**

- `findByItem(tenantId, itemId)` — Photos for an item
- `upload(tenantId, itemId, file, caption)` — Upload photo (reuse document upload infra)
- `updateCaption(tenantId, photoId, caption)` — Update caption
- `reorder(tenantId, itemId, photoIds[])` — Reorder photos
- `softDelete(tenantId, photoId)` — Delete photo

### Step 2.6: InventoryController ✅ DONE (2026-04-06)

**Endpoints (18 total):**

| Method | Route                                 | Permission             | Description                      |
| ------ | ------------------------------------- | ---------------------- | -------------------------------- |
| GET    | /inventory/lists                      | inventory-lists.read   | All lists with status counts     |
| POST   | /inventory/lists                      | inventory-lists.write  | Create list                      |
| GET    | /inventory/lists/:id                  | inventory-lists.read   | Single list + fields             |
| PATCH  | /inventory/lists/:id                  | inventory-lists.write  | Update list                      |
| DELETE | /inventory/lists/:id                  | inventory-lists.delete | Soft-delete list                 |
| GET    | /inventory/categories                 | inventory-lists.read   | Category autocomplete (?q=)      |
| POST   | /inventory/lists/:id/fields           | inventory-lists.write  | Add custom field                 |
| PATCH  | /inventory/fields/:fieldId            | inventory-lists.write  | Update custom field              |
| DELETE | /inventory/fields/:fieldId            | inventory-lists.write  | Soft-delete custom field         |
| GET    | /inventory/items                      | inventory-items.read   | Items (filter by listId)         |
| POST   | /inventory/items                      | inventory-items.write  | Create item (auto-code + values) |
| GET    | /inventory/items/:uuid                | inventory-items.read   | Single item (QR target)          |
| PATCH  | /inventory/items/:uuid                | inventory-items.write  | Update item (incl. values)       |
| DELETE | /inventory/items/:uuid                | inventory-items.delete | Soft-delete item                 |
| POST   | /inventory/items/:uuid/photos         | inventory-items.write  | Upload photo                     |
| PATCH  | /inventory/photos/:photoId            | inventory-items.write  | Update photo caption             |
| PUT    | /inventory/items/:uuid/photos/reorder | inventory-items.write  | Reorder photos                   |
| DELETE | /inventory/photos/:photoId            | inventory-items.write  | Soft-delete photo                |

> **Note:** Custom values are embedded in item create/update payloads (not separate endpoints).
> Custom field delete uses `inventory-lists.write` (not delete) — it's a list configuration action.

Every endpoint: `@RequireAddon('inventory')` + `@RequirePermission(...)`.

### Phase 2 — Definition of Done

- [ ] `InventoryModule` registered in `app.module.ts`
- [ ] 4 services implemented and injected
- [ ] Controller with all 18 endpoints
- [ ] Permission registrar fires on module init
- [ ] Addon check on every controller endpoint
- [ ] `db.tenantTransaction()` for ALL tenant-scoped queries
- [ ] Code auto-generation with `FOR UPDATE` lock
- [ ] No double-wrapping (ADR-007)
- [ ] All DTOs use Zod + `createZodDto()` pattern
- [ ] ESLint 0 errors
- [ ] Type-check passed

---

## Phase 3: Unit Tests ✅ DONE (2026-04-06)

> **Dependency:** Phase 2 complete

### Test Files

```
backend/src/nest/inventory/
  inventory-lists.service.test.ts       # ~25 tests
  inventory-items.service.test.ts       # ~30 tests
  inventory-custom-fields.service.test.ts  # ~15 tests
  inventory-photos.service.test.ts      # ~10 tests
```

### Critical Test Scenarios

- [ ] Code auto-generation: sequential, padded, unique
- [ ] Code generation race condition: parallel creates → no duplicates
- [ ] Prefix change: existing codes remain unchanged
- [ ] Custom field max limit (30) → BadRequestException
- [ ] Custom field deletion cascades values
- [ ] Status transitions: all valid status changes
- [ ] Soft-delete list → items still accessible via direct UUID
- [ ] Tenant isolation: Tenant A cannot see Tenant B's lists/items
- [ ] UUID lookup: invalid UUID → NotFoundException

### Phase 3 — Definition of Done

- [ ] > = 80 unit tests total
- [ ] All tests green
- [ ] Every ConflictException / BadRequestException path covered
- [ ] Race condition for code generation tested
- [ ] Coverage: all public methods have at least 1 test

---

## Phase 4: API Integration Tests ✅ DONE (2026-04-06)

> **Dependency:** Phase 3 complete

### Test File

`backend/test/inventory.api.test.ts`

### Scenarios (>= 25 assertions)

- [ ] Unauthenticated → 401
- [ ] Addon disabled → 403
- [ ] CRUD lists: create, read, update, soft-delete
- [ ] CRUD items: create (auto-code), read by UUID, update, soft-delete
- [ ] Custom fields: add, update, delete, value upsert
- [ ] Code auto-generation: verify sequential codes
- [ ] Tenant isolation: cross-tenant access blocked
- [ ] Permission denied: user without inventory permission → 403
- [ ] Category autocomplete returns distinct values

### Phase 4 — Definition of Done

- [ ] > = 25 API integration tests
- [ ] All tests green
- [ ] Tenant isolation verified
- [ ] Addon gating verified
- [ ] Permission checks verified

---

## Phase 5: Frontend

> **Dependency:** Phase 2 complete (backend endpoints available)

### Step 5.1: Lists Overview Page ✅ DONE (2026-04-06)

`(shared)/inventory/+page.svelte`

Card-based layout (like manage-halls/manage-teams):

- Each list = 1 card
- Card shows: title, category, icon, status donut/badges
- "Neue Liste" button → modal (ListModal.svelte)
- Design: reuse existing card components from design system

### Step 5.2: Items Table Page ✅ DONE (2026-04-06)

`(shared)/inventory/lists/[id]/+page.svelte`

Table layout with:

- List title + description as header
- "Neuer Gegenstand" button → modal (ItemModal.svelte)
- Table columns: Code, Name, Status (badge), Location, Custom Fields (dynamic)
- Filters: status dropdown, search
- Click row → item detail page

### Step 5.3: Item Detail Page ✅ DONE (2026-04-06)

`(shared)/inventory/items/[uuid]/+page.svelte`

This is the **QR code target page**. Must work well on mobile.

- All item fields displayed
- Photo gallery (upload + reorder)
- Custom field values (editable inline or via modal)
- QR code display + print button (QrLabel.svelte)
- Status change dropdown
- Edit button → modal

### Step 5.4: QR Code Generation + Print [DEFERRED to V1.1]

`QrLabel.svelte` component:

- Input: item UUID, code, name, tenant name
- Generates QR code via `qrcode` npm package
- Print layout with `@media print` CSS
- Batch print option from items table (select multiple → print labels)

### Phase 5 — Definition of Done

- [ ] 3 pages render for all roles
- [ ] All CRUD operations work via UI
- [ ] Svelte 5 runes ($state, $derived) used
- [ ] Custom fields render dynamically by type
- [ ] QR code generates and prints correctly
- [ ] svelte-check 0 errors
- [ ] ESLint 0 errors
- [ ] Navigation config updated (addonCode: 'inventory')
- [ ] Responsive design (mobile + desktop)
- [ ] German labels everywhere
- [ ] PermissionDenied component on 403

---

## Phase 6: Integration + Polish

> **Dependency:** Phase 5 complete

### Integrations

- [x] Audit logging: item create/update/delete/status changes ✅ (2026-04-06)
- [x] Navigation: sidebar entry with inventory icon + addon guard ✅ (Step 5.1)
- [x] ADR: Write ADR for inventory addon architecture ✅ ADR-040 (2026-04-06)
- [x] Customer migrations: `./scripts/sync-customer-migrations.sh` ✅ (2026-04-06)
- [x] ADR-033 update: add inventory to addon catalog ✅ (2026-04-06)

### Phase 6 — Definition of Done

- [x] Audit logging works end-to-end
- [x] Navigation entry visible when addon active, hidden when inactive
- [x] ADR written and reviewed
- [x] No open TODOs in code
- [x] Customer fresh-install updated

---

## Session Tracking

| Session | Phase | Description                         | Status   | Date       |
| ------- | ----- | ----------------------------------- | -------- | ---------- |
| 1       | 1     | Migration: ENUMs + core tables      | ✅ DONE  | 2026-04-05 |
| 2       | 1     | Migration: custom fields + photos   | ✅ DONE  | 2026-04-05 |
| 3       | 2     | Module skeleton + types + DTOs      | ✅ DONE  | 2026-04-05 |
| 4       | 2     | ListsService + ItemsService         | ✅ DONE  | 2026-04-05 |
| 5       | 2     | CustomFieldsService + PhotosService | ✅ DONE  | 2026-04-05 |
| 6       | 2     | Controller (18 endpoints)           | ✅ DONE  | 2026-04-06 |
| 7       | 3     | Unit tests (80+)                    | ✅ DONE  | 2026-04-06 |
| 8       | 4     | API integration tests (25+)         | ✅ DONE  | 2026-04-06 |
| 9       | 5     | Frontend: lists overview + modals   | ✅ DONE  | 2026-04-06 |
| 10      | 5     | Frontend: items table + item detail | ✅ DONE  | 2026-04-06 |
| 11      | 5     | Frontend: QR code + print + polish  | DEFERRED | V1.1       |
| 12      | 6     | Integration + audit + ADR + cleanup | ✅ DONE  | 2026-04-06 |

---

## Known Limitations (V1 — Intentionally Excluded)

1. **No inspection workflow** — Date columns exist but no UI for scheduling/tracking inspections. Will be V2 with notifications.
2. **No Excel import** — Data from existing .xlsm files must be entered manually. Bulk import is V2.
3. **No QR scanner** — V1 generates QR codes for printing. Mobile scanning (camera → item page) is V2 (just opening the URL from any QR reader works though).
4. **No barcode support** — Only QR codes in V1. Barcode (EAN/Code128) generation is V2.
5. **No item history/changelog** — Status changes are logged via audit trail but no dedicated timeline view per item. V2.
6. **No dashboard widget** — "Overdue inspections" / "Items in repair" widget on dashboard is V2.
7. **No location FK** — Location is freetext, not linked to halls/areas table. V2 can add FK.
8. **No document/certificate attachments** — Only photos in V1. PDF certificates are V2.
9. **No responsible user notifications** — `responsible_user_id` column exists but no logic in V1.

---

## Spec Deviations

| #   | Original Idea          | Actual Decision            | Reason                                     |
| --- | ---------------------- | -------------------------- | ------------------------------------------ |
| D1  | Route: manage-inventar | Route: (shared)/inventory  | All roles need access, not just admin      |
| D2  | Predefined categories  | Freetext with autocomplete | Simpler, more flexible for diverse tenants |
| D3  | Part of assets addon   | Separate addon             | Different concerns, assets = availability  |

---

## Post-Mortem (fill after completion)

### What Went Well

- TBD

### What Went Poorly

- TBD

### Metrics

| Metric                   | Planned | Actual |
| ------------------------ | ------- | ------ |
| Sessions                 | 12      |        |
| Migration files          | 3       |        |
| New backend files        | ~15     |        |
| New frontend files       | ~15     |        |
| Unit tests               | 80+     |        |
| API tests                | 25+     |        |
| ESLint errors at release | 0       |        |
| Spec deviations          | 3       |        |
