/**
 * Migration: Add halls as core addon + fix sort_order for all addons
 *
 * Purpose:
 * 1. Halls (Produktionshallen) is infrastructure — must be a core addon.
 *    Permission category 'halls' existed but had no matching addon in DB.
 * 2. 13 of 24 addons had sort_order=0, making display order non-deterministic.
 *    This sets intentional ordering: core first (grouped), then purchasable (grouped).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- 1. Insert halls as core addon (ON CONFLICT for idempotency — halls seed may arrive later)
    INSERT INTO addons (code, name, description, price_monthly, is_active, is_core, trial_days, icon, sort_order)
    VALUES ('halls', 'Hallen', 'Verwaltung von Produktionshallen', NULL, 1, true, NULL, 'fa-warehouse', 45)
    ON CONFLICT (code) DO UPDATE SET
      is_core = true,
      price_monthly = NULL,
      trial_days = NULL,
      icon = 'fa-warehouse',
      sort_order = 45,
      updated_at = NOW();

    -- 2. Fix sort_order for ALL addons — deterministic grouping
    -- Core addons: 10–90 (infrastructure first, then organizational)
    UPDATE addons SET sort_order = 10 WHERE code = 'dashboard';
    UPDATE addons SET sort_order = 15 WHERE code = 'settings';
    UPDATE addons SET sort_order = 20 WHERE code = 'notifications';
    UPDATE addons SET sort_order = 25 WHERE code = 'employees';
    UPDATE addons SET sort_order = 30 WHERE code = 'departments';
    UPDATE addons SET sort_order = 35 WHERE code = 'teams';
    UPDATE addons SET sort_order = 40 WHERE code = 'manage_hierarchy';
    UPDATE addons SET sort_order = 45 WHERE code = 'halls';
    UPDATE addons SET sort_order = 50 WHERE code = 'assets';
    UPDATE addons SET sort_order = 55 WHERE code = 'dummy_users';
    UPDATE addons SET sort_order = 60 WHERE code = 'approvals';
    UPDATE addons SET sort_order = 65 WHERE code = 'user_profiles';
    UPDATE addons SET sort_order = 70 WHERE code = 'calendar';
    UPDATE addons SET sort_order = 75 WHERE code = 'blackboard';

    -- Purchasable addons: 100–200 (most-used first)
    UPDATE addons SET sort_order = 100 WHERE code = 'documents';
    UPDATE addons SET sort_order = 110 WHERE code = 'vacation';
    UPDATE addons SET sort_order = 120 WHERE code = 'shift_planning';
    UPDATE addons SET sort_order = 130 WHERE code = 'chat';
    UPDATE addons SET sort_order = 140 WHERE code = 'work_orders';
    UPDATE addons SET sort_order = 150 WHERE code = 'surveys';
    UPDATE addons SET sort_order = 160 WHERE code = 'kvp';
    UPDATE addons SET sort_order = 170 WHERE code = 'tpm';
    UPDATE addons SET sort_order = 180 WHERE code = 'reports';
    UPDATE addons SET sort_order = 190 WHERE code = 'audit_trail';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Remove halls addon
    DELETE FROM addons WHERE code = 'halls';

    -- Reset sort_order to 0 (original state for most)
    UPDATE addons SET sort_order = 0;
  `);
}
