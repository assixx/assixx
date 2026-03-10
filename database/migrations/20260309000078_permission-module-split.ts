/**
 * Migration: Permission Module Split
 * Date: 2026-03-09
 *
 * TpmConfigController and TpmLocationsController previously borrowed
 * permissions from tpm-plans/tpm-cards. This migration creates dedicated
 * module rows so existing users retain access after the controller change.
 *
 * Also adds shift-times permissions for users with shift_planning access,
 * since ShiftTimesController now uses @RequirePermission.
 *
 * @see docs/PERMISSION-REGISTRY-OFFICIAL.md v1.2.0+
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // 1. tpm-config: merge permissions from tpm-plans (escalation) and tpm-cards (colors)
  //    canRead  = tpm-plans.canRead  OR tpm-cards.canRead
  //    canWrite = tpm-plans.canWrite OR tpm-cards.canWrite
  pgm.sql(`
    INSERT INTO user_feature_permissions
      (tenant_id, user_id, feature_code, module_code, can_read, can_write, can_delete, assigned_by)
    SELECT
      sub.tenant_id,
      sub.user_id,
      'tpm',
      'tpm-config',
      bool_or(sub.can_read),
      bool_or(sub.can_write),
      false,
      min(sub.assigned_by)
    FROM user_feature_permissions sub
    WHERE sub.feature_code = 'tpm'
      AND sub.module_code IN ('tpm-plans', 'tpm-cards')
    GROUP BY sub.tenant_id, sub.user_id
    ON CONFLICT (tenant_id, user_id, feature_code, module_code) DO NOTHING
  `);

  // 2. tpm-locations: copy permissions from tpm-plans (1:1)
  pgm.sql(`
    INSERT INTO user_feature_permissions
      (tenant_id, user_id, feature_code, module_code, can_read, can_write, can_delete, assigned_by)
    SELECT
      p.tenant_id,
      p.user_id,
      'tpm',
      'tpm-locations',
      p.can_read,
      p.can_write,
      p.can_delete,
      p.assigned_by
    FROM user_feature_permissions p
    WHERE p.feature_code = 'tpm'
      AND p.module_code = 'tpm-plans'
    ON CONFLICT (tenant_id, user_id, feature_code, module_code) DO NOTHING
  `);

  // 3. shift-times: grant canRead to all users who have any shift_planning module,
  //    grant canWrite to users who have shift-plan canWrite (admin delegation)
  pgm.sql(`
    INSERT INTO user_feature_permissions
      (tenant_id, user_id, feature_code, module_code, can_read, can_write, can_delete, assigned_by)
    SELECT DISTINCT
      p.tenant_id,
      p.user_id,
      'shift_planning',
      'shift-times',
      true,
      bool_or(p.can_write) FILTER (WHERE p.module_code = 'shift-plan'),
      false,
      min(p.assigned_by)
    FROM user_feature_permissions p
    WHERE p.feature_code = 'shift_planning'
    GROUP BY p.tenant_id, p.user_id
    ON CONFLICT (tenant_id, user_id, feature_code, module_code) DO NOTHING
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DELETE FROM user_feature_permissions
    WHERE (feature_code = 'tpm' AND module_code IN ('tpm-config', 'tpm-locations'))
       OR (feature_code = 'shift_planning' AND module_code = 'shift-times')
  `);
}
