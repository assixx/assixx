/**
 * Migration: UUIDv7 defaults cleanup — switch all UUID columns from gen_random_uuid() to uuidv7()
 *
 * Purpose:
 *   Project policy (CLAUDE.md): "uuid v13.0.0 (UUIDv7 everywhere — DB records AND files)".
 *   Reality check on 2026-04-16: 10 columns across 10 tables defaulted to gen_random_uuid() (UUIDv4).
 *   Migration 20260311000000088_addon-system-tenant-addons.ts documented this as
 *   "SPEC DEVIATION D1: Uses gen_random_uuid() (v4) instead of uuid_generate_v7()".
 *   PostgreSQL 18.3 ships native uuidv7() (no extension required), so we standardize on it.
 *
 *   This migration only changes column DEFAULTs for FUTURE inserts.
 *   Existing rows keep their UUIDv4 IDs — no data migration, no FK breakage.
 *
 * Prerequisite for: docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md (Phase 1, user_oauth_accounts).
 *
 * Discovery query that produced the table list (re-runnable verification):
 *   SELECT n.nspname, c.relname, a.attname, pg_get_expr(d.adbin, d.adrelid)
 *   FROM pg_attribute a
 *   JOIN pg_class c ON c.oid = a.attrelid
 *   JOIN pg_namespace n ON n.oid = c.relnamespace
 *   JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
 *   WHERE n.nspname = 'public'
 *     AND pg_get_expr(d.adbin, d.adrelid) ILIKE '%gen_random_uuid%'
 *   ORDER BY c.relname, a.attnum;
 *
 * 10 columns covered (alphabetical):
 *   chat_scheduled_messages.id, inventory_custom_fields.id, inventory_custom_values.id,
 *   inventory_item_photos.id, inventory_items.id, inventory_lists.id, inventory_tags.id,
 *   shift_swap_requests.uuid, tenant_addons.id, tenant_storage.id
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE chat_scheduled_messages ALTER COLUMN id   SET DEFAULT uuidv7();
    ALTER TABLE inventory_custom_fields ALTER COLUMN id   SET DEFAULT uuidv7();
    ALTER TABLE inventory_custom_values ALTER COLUMN id   SET DEFAULT uuidv7();
    ALTER TABLE inventory_item_photos   ALTER COLUMN id   SET DEFAULT uuidv7();
    ALTER TABLE inventory_items         ALTER COLUMN id   SET DEFAULT uuidv7();
    ALTER TABLE inventory_lists         ALTER COLUMN id   SET DEFAULT uuidv7();
    ALTER TABLE inventory_tags          ALTER COLUMN id   SET DEFAULT uuidv7();
    ALTER TABLE shift_swap_requests     ALTER COLUMN uuid SET DEFAULT uuidv7();
    ALTER TABLE tenant_addons           ALTER COLUMN id   SET DEFAULT uuidv7();
    ALTER TABLE tenant_storage          ALTER COLUMN id   SET DEFAULT uuidv7();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE chat_scheduled_messages ALTER COLUMN id   SET DEFAULT gen_random_uuid();
    ALTER TABLE inventory_custom_fields ALTER COLUMN id   SET DEFAULT gen_random_uuid();
    ALTER TABLE inventory_custom_values ALTER COLUMN id   SET DEFAULT gen_random_uuid();
    ALTER TABLE inventory_item_photos   ALTER COLUMN id   SET DEFAULT gen_random_uuid();
    ALTER TABLE inventory_items         ALTER COLUMN id   SET DEFAULT gen_random_uuid();
    ALTER TABLE inventory_lists         ALTER COLUMN id   SET DEFAULT gen_random_uuid();
    ALTER TABLE inventory_tags          ALTER COLUMN id   SET DEFAULT gen_random_uuid();
    ALTER TABLE shift_swap_requests     ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
    ALTER TABLE tenant_addons           ALTER COLUMN id   SET DEFAULT gen_random_uuid();
    ALTER TABLE tenant_storage          ALTER COLUMN id   SET DEFAULT gen_random_uuid();
  `);
}
