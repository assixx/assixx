/**
 * Security Settings Service
 *
 * Reads/writes tenant-level security policies stored in `tenant_settings`.
 * Only one policy is exposed today — "allow user password change" — but the
 * service is structured to host more policies (e.g. session timeout,
 * enforce-MFA) without another DB migration.
 *
 * WHY a dedicated module instead of reusing SettingsController:
 * - The generic `PUT /settings/tenant/:key` allows `admin` + `root` to
 *   modify any setting. Root requested that THIS specific toggle be
 *   root-exclusive (see user-request 2026-04-20) — tightening the generic
 *   endpoint would break existing admin workflows for other settings.
 * - A small dedicated surface documents intent at the HTTP layer.
 *
 * All reads/writes go through `tenant_settings` with RLS (`tenant_isolation`)
 * — no migration required.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';

import { DatabaseService } from '../database/database.service.js';
import {
  ALLOW_USER_PASSWORD_CHANGE_KEY,
  SECURITY_SETTINGS_CATEGORY,
} from './security-settings.constants.js';

interface DbSettingValueRow extends QueryResultRow {
  setting_value: string | null;
}

interface DbIdRow extends QueryResultRow {
  id: number;
}

/** Default for `allow_user_password_change` when the row does not exist. */
const DEFAULT_ALLOW_USER_PASSWORD_CHANGE = false;

@Injectable()
export class SecuritySettingsService {
  private readonly logger = new Logger(SecuritySettingsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Read the "allow user password change" flag for the caller's tenant.
   *
   * Returns `false` (locked) when no row exists — matches the "secure by
   * default" choice Root explicitly requested.
   */
  async getUserPasswordChangePolicy(tenantId: number): Promise<boolean> {
    // queryAsTenant: explicit tenantId so we do not depend on CLS being set
    // (this method is also called from UserProfileService where CLS IS set,
    // but being explicit keeps the service reusable from non-request
    // contexts like cron jobs).
    const rows = await this.db.queryAsTenant<DbSettingValueRow>(
      `SELECT setting_value FROM tenant_settings
       WHERE tenant_id = $1 AND setting_key = $2`,
      [tenantId, ALLOW_USER_PASSWORD_CHANGE_KEY],
      tenantId,
    );

    if (rows.length === 0) {
      return DEFAULT_ALLOW_USER_PASSWORD_CHANGE;
    }

    const value = rows[0]?.setting_value;
    // SettingsService.serializeBooleanValue stores booleans as 'true'/'false'
    // strings — accept both forms plus the legacy '1'/'0' in case the row
    // was created by another writer.
    return value === 'true' || value === '1';
  }

  /**
   * Upsert the "allow user password change" flag for the caller's tenant.
   *
   * Caller must be Root — enforced by `@Roles('root')` in the controller.
   * Writes a `root_logs` audit entry so policy flips are traceable.
   */
  async setUserPasswordChangePolicy(
    tenantId: number,
    userId: number,
    allowed: boolean,
    ipAddress: string | undefined,
    userAgent: string | undefined,
  ): Promise<void> {
    const serialized = allowed ? 'true' : 'false';

    await this.db.tenantTransaction(async (client: PoolClient) => {
      const existing = await client.query<DbIdRow>(
        `SELECT id FROM tenant_settings
         WHERE tenant_id = $1 AND setting_key = $2`,
        [tenantId, ALLOW_USER_PASSWORD_CHANGE_KEY],
      );

      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE tenant_settings
           SET setting_value = $1, value_type = 'boolean', category = $2, updated_at = NOW()
           WHERE tenant_id = $3 AND setting_key = $4`,
          [serialized, SECURITY_SETTINGS_CATEGORY, tenantId, ALLOW_USER_PASSWORD_CHANGE_KEY],
        );
      } else {
        await client.query(
          `INSERT INTO tenant_settings
            (tenant_id, setting_key, setting_value, value_type, category)
           VALUES ($1, $2, $3, 'boolean', $4)`,
          [tenantId, ALLOW_USER_PASSWORD_CHANGE_KEY, serialized, SECURITY_SETTINGS_CATEGORY],
        );
      }

      // Audit trail — Root-logs matches the pattern used by SettingsService
      // (root_logs rows track config changes with IP/user-agent context).
      // Pass entity_type as a parameter (not inline) to mirror
      // SettingsService.createAuditLog exactly — same column order, same
      // 7 placeholders. Makes grep-driven refactors consistent.
      await client.query(
        `INSERT INTO root_logs
          (action, user_id, tenant_id, entity_type, new_values, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          'security_setting_updated',
          userId,
          tenantId,
          'security_setting',
          JSON.stringify({ setting_key: ALLOW_USER_PASSWORD_CHANGE_KEY, allowed }),
          ipAddress ?? null,
          userAgent ?? null,
        ],
      );
    });

    this.logger.log(
      `Tenant ${tenantId}: user-password-change policy set to ${String(allowed)} by user ${userId}`,
    );
  }
}
