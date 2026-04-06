/**
 * Migration: Register inventory addon in addons table
 *
 * Purpose: Insert the 'inventory' purchasable addon (€10/month) into
 * the addons catalog so tenants can activate it.
 * See docs/FEAT_INVENTORY_MASTERPLAN.md Phase 1, Step 1.3.
 *
 * Addon: inventory (id=25, sort_order=155, purchasable, 30-day trial)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // Insert addon — ON CONFLICT guards against re-run after partial apply
  pgm.sql(`
    INSERT INTO addons (
      id, code, name, description, price_monthly, is_active,
      requires_setup, setup_instructions, icon, sort_order,
      created_at, updated_at, is_core, trial_days
    ) VALUES (
      25,
      'inventory',
      'Inventar',
      'Betriebsmittel-Inventarverwaltung mit Listen, Custom Fields und QR-Codes',
      10.00,
      1,
      false,
      NULL,
      'fa-boxes-stacked',
      155,
      NOW(), NOW(),
      false,
      30
    ) ON CONFLICT (id) DO NOTHING; -- idempotent: guard against double-apply

    -- Sync sequence to prevent id collision on next insert
    SELECT setval('addons_id_seq', GREATEST((SELECT MAX(id) FROM addons), 25));
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DELETE FROM addons WHERE code = 'inventory' AND id = 25;
  `);
}
