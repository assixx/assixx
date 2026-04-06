# ADR-040: Inventory Addon Architecture

| Metadata                | Value                                                                       |
| ----------------------- | --------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                    |
| **Date**                | 2026-04-06                                                                  |
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

## References

- [Inventory Masterplan](../../FEAT_INVENTORY_MASTERPLAN.md)
- [ADR-033: Addon-based SaaS Model](./ADR-033-addon-based-saas-model.md)
- [ADR-019: Multi-Tenant RLS Isolation](./ADR-019-multi-tenant-rls-isolation.md)
- [ADR-020: Per-User Feature Permissions](./ADR-020-per-user-feature-permissions.md)
