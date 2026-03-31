/**
 * Migration: Add user_profiles core addon
 *
 * Purpose: Enables per-user permission "Read User Profiles" so admins can
 *          grant or deny the ability to view other users' profile pages.
 *          Core addon (always active, no cost).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    INSERT INTO addons (code, name, description, is_core, is_active, icon, sort_order)
    VALUES (
      'user_profiles',
      'Benutzerprofile',
      'Ansicht von Benutzerprofilen anderer Mitarbeiter',
      true,
      1,
      'fa-id-card',
      55
    )
    ON CONFLICT (code) DO NOTHING;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DELETE FROM user_addon_permissions WHERE addon_code = 'user_profiles';
    UPDATE addons SET is_active = 0 WHERE code = 'user_profiles';
  `);
}
