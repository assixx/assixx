/**
 * Migration: Convert assets + dummy_users to core addons
 *
 * Purpose: Assets and Dummy Users are essential platform features,
 * not purchasable extras. Making them core (always active, no cost).
 *
 * WARNING: One-way migration. Rollback does NOT restore deleted tenant_addons records.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Pre-check: both addons must exist
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM addons WHERE code = 'assets') THEN
        RAISE EXCEPTION 'Addon "assets" not found in addons table';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM addons WHERE code = 'dummy_users') THEN
        RAISE EXCEPTION 'Addon "dummy_users" not found in addons table';
      END IF;
    END $$;

    -- Convert to core: is_core=true, no price, no trial
    UPDATE addons
    SET is_core = true,
        price_monthly = NULL,
        trial_days = NULL,
        updated_at = NOW()
    WHERE code IN ('assets', 'dummy_users');

    -- Clean up tenant_addons entries (core addons bypass this table)
    DELETE FROM tenant_addons
    WHERE addon_id IN (SELECT id FROM addons WHERE code IN ('assets', 'dummy_users'));
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Restore purchasable status
    UPDATE addons
    SET is_core = false,
        price_monthly = 10.00,
        trial_days = 30,
        updated_at = NOW()
    WHERE code IN ('assets', 'dummy_users');

    -- NOTE: Deleted tenant_addons records cannot be restored.
    -- Tenants must re-activate these addons manually after rollback.
  `);
}
