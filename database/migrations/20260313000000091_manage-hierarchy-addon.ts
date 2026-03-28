/**
 * Migration: Register manage_hierarchy addon
 *
 * Purpose: Core addon for organizational structure management (areas, departments, teams, employees).
 * Simplified (D5): Only addon entry. No admin permission rows seeded.
 * Root grants manage_hierarchy permissions manually on the permission page.
 *
 * @see docs/FEAT_ORGANIZATIONAL_SCOPE_ACCESS_MASTERPLAN.md Step 3.1b
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Addon registrieren (core, immer aktiv)
    -- ON CONFLICT DO NOTHING: idempotent — safe bei Re-Run (Seed-Daten Pattern, ADR-033)
    INSERT INTO addons (code, name, description, is_core, is_active, icon, sort_order)
    VALUES (
      'manage_hierarchy',
      'Organisationsstruktur',
      'Verwaltung von Bereichen, Abteilungen, Teams und Mitarbeitern',
      true,
      1,
      'fa-sitemap',
      50
    )
    ON CONFLICT (code) DO NOTHING;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Permission-Rows zuerst löschen (FK-Constraint)
    DELETE FROM user_addon_permissions WHERE addon_code = 'manage_hierarchy';

    -- UPDATE statt DELETE: prevent_addons_delete Trigger blockt DELETE auf addons
    UPDATE addons SET is_active = 0 WHERE code = 'manage_hierarchy';
  `);
}
