/**
 * Migration: Permission New Categories (Phase 2)
 * Date: 2026-03-09
 *
 * Adds permission rows for 4 new categories that previously had no
 * @RequirePermission decorators on their controllers:
 *
 * - employees (employees-manage, employees-availability)
 * - departments (departments-manage, areas-manage)
 * - teams (teams-manage)
 * - settings (settings-tenant)
 *
 * All existing admins with hasFullAccess bypass PermissionGuard entirely,
 * so this migration is a safety net: if hasFullAccess is later revoked,
 * they still have sensible permission rows.
 *
 * Strategy: For each admin user in each tenant, grant full permissions
 * for the new modules — matching the access they had before decorators.
 *
 * @see docs/PERMISSION-REGISTRY-OFFICIAL.md v1.3.0+
 */
import type { MigrationBuilder } from 'node-pg-migrate';

/** Module definitions to seed: [featureCode, moduleCode, canRead, canWrite, canDelete] */
const NEW_MODULES: [string, string, boolean, boolean, boolean][] = [
  // employees
  ['employees', 'employees-manage', true, true, true],
  ['employees', 'employees-availability', true, true, true],
  // departments + areas
  ['departments', 'departments-manage', false, true, true],
  ['departments', 'areas-manage', false, true, true],
  // teams
  ['teams', 'teams-manage', false, true, true],
  // settings
  ['settings', 'settings-tenant', false, true, true],
];

export function up(pgm: MigrationBuilder): void {
  for (const [feat, mod, canRead, canWrite, canDelete] of NEW_MODULES) {
    pgm.sql(`
      INSERT INTO user_feature_permissions
        (tenant_id, user_id, feature_code, module_code, can_read, can_write, can_delete, assigned_by)
      SELECT
        u.tenant_id,
        u.id,
        '${feat}',
        '${mod}',
        ${canRead},
        ${canWrite},
        ${canDelete},
        u.id
      FROM users u
      WHERE u.role = 'admin'
        AND u.is_active = 1
        AND u.tenant_id IS NOT NULL
      ON CONFLICT (tenant_id, user_id, feature_code, module_code) DO NOTHING
    `);
  }
}

export function down(pgm: MigrationBuilder): void {
  const conditions = NEW_MODULES.map(
    ([feat, mod]) => `(feature_code = '${feat}' AND module_code = '${mod}')`,
  ).join('\n       OR ');

  pgm.sql(`
    DELETE FROM user_feature_permissions
    WHERE ${conditions}
  `);
}
