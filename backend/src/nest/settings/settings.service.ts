/**
 * Settings Service (NestJS)
 *
 * Native NestJS implementation for system, tenant, and user settings management.
 * Uses DatabaseService directly for PostgreSQL queries.
 *
 * IMPORTANT: Uses PostgreSQL $1, $2, $3 placeholders (NOT MySQL's ?)
 */
import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { QueryResultRow } from 'pg';

import { DatabaseService } from '../database/database.service.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Setting value type */
export type SettingValue = string | number | boolean | Record<string, unknown>;

/** Setting type enum */
export type SettingType = 'system' | 'tenant' | 'user';

/** Setting data type (storage type) */
export type SettingValueType = 'string' | 'number' | 'boolean' | 'json';

/** Setting category */
export type SettingCategory =
  | 'general'
  | 'appearance'
  | 'notifications'
  | 'security'
  | 'workflow'
  | 'integration'
  | 'other';

/** Parsed setting response */
export interface ParsedSetting {
  settingKey: string;
  settingValue: SettingValue | null;
  valueType: string;
  category: string | undefined;
  description: string | undefined;
  isPublic: boolean | undefined;
  createdAt: string | undefined;
  updatedAt: string | undefined;
}

/** Settings category definition */
export interface SettingCategoryDefinition {
  key: string;
  label: string;
  description: string;
}

/** Bulk update result */
export interface BulkUpdateResult {
  key: string;
  success: boolean;
  error?: string | undefined;
}

/** Setting data for create/update */
export interface SettingData {
  setting_key: string;
  setting_value: string | number | boolean | Record<string, unknown>;
  value_type?: SettingValueType | undefined;
  category?: SettingCategory | undefined;
  description?: string | undefined;
  is_public?: boolean | undefined;
}

/** Filter options */
interface SettingFilters {
  category?: string | undefined;
  is_public?: boolean | undefined;
  search?: string | undefined;
}

// ============================================================================
// DATABASE ROW TYPES
// ============================================================================

interface DbSystemSetting extends QueryResultRow {
  id: number;
  setting_key: string;
  setting_value: string | null;
  value_type: string;
  category: string | null;
  description: string | null;
  is_public: boolean | number;
  created_at: Date | null;
  updated_at: Date | null;
}

interface DbBaseSetting extends QueryResultRow {
  setting_key: string;
  setting_value: string | null;
  value_type: string;
  category: string | null;
  created_at: Date | null;
  updated_at: Date | null;
}

interface DbTenantSetting extends DbBaseSetting {
  id: number;
  tenant_id: number;
}

interface DbUserSetting extends DbBaseSetting {
  id: number;
  user_id: number;
  tenant_id: number;
  team_id: number | null;
}

interface DbIdResult extends QueryResultRow {
  id: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CATEGORY = 'other';
const SETTING_NOT_FOUND = 'Setting not found';

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly db: DatabaseService) {}

  // ==================== SYSTEM SETTINGS ====================

  /**
   * Get all system settings
   */
  async getSystemSettings(filters: SettingFilters, userRole: string): Promise<ParsedSetting[]> {
    this.logger.debug('Fetching system settings');

    if (userRole !== 'root') {
      throw new ForbiddenException('Access denied');
    }

    let query = `SELECT * FROM system_settings WHERE 1=1`;
    const params: (string | number | boolean)[] = [];

    if (filters.category !== undefined && filters.category !== '') {
      const nextIndex = params.length + 1;
      query += ` AND category = $${nextIndex}`;
      params.push(filters.category);
    }

    if (filters.is_public !== undefined) {
      const nextIndex = params.length + 1;
      query += ` AND is_public = $${nextIndex}`;
      params.push(filters.is_public);
    }

    if (filters.search !== undefined && filters.search !== '') {
      const nextIndex = params.length + 1;
      query += ` AND (setting_key ILIKE $${nextIndex} OR description ILIKE $${nextIndex + 1})`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ` ORDER BY category, setting_key`;

    const rows = await this.db.query<DbSystemSetting>(query, params);
    return rows.map((row: DbSystemSetting) => this.mapSystemSetting(row));
  }

  /**
   * Get single system setting
   */
  async getSystemSetting(key: string, userRole: string): Promise<ParsedSetting> {
    this.logger.debug(`Fetching system setting: ${key}`);

    const rows = await this.db.query<DbSystemSetting>(
      `SELECT * FROM system_settings WHERE setting_key = $1`,
      [key],
    );

    if (rows.length === 0) {
      throw new NotFoundException(SETTING_NOT_FOUND);
    }

    const setting = rows[0];
    if (setting === undefined) {
      throw new NotFoundException(SETTING_NOT_FOUND);
    }

    const isPublic = Boolean(setting.is_public);
    if (userRole !== 'root' && userRole !== 'admin' && !isPublic) {
      throw new ForbiddenException('Access denied');
    }

    return this.mapSystemSetting(setting);
  }

  /**
   * Create or update system setting
   */
  async upsertSystemSetting(
    data: SettingData,
    userId: number,
    tenantId: number,
    userRole: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean }> {
    this.logger.log(`Upserting system setting: ${data.setting_key}`);

    if (userRole !== 'root') {
      throw new ForbiddenException('Only root can modify system settings');
    }

    const serializedValue = this.serializeValue(data.setting_value, data.value_type ?? 'string');

    const existing = await this.db.query<DbIdResult>(
      `SELECT id FROM system_settings WHERE setting_key = $1`,
      [data.setting_key],
    );

    if (existing.length > 0) {
      await this.db.query(
        `UPDATE system_settings
         SET setting_value = $1, value_type = $2, category = $3, description = $4, is_public = $5, updated_at = NOW()
         WHERE setting_key = $6`,
        [
          serializedValue,
          data.value_type ?? 'string',
          data.category ?? DEFAULT_CATEGORY,
          data.description ?? null,
          data.is_public === true,
          data.setting_key,
        ],
      );
    } else {
      await this.db.query(
        `INSERT INTO system_settings
         (setting_key, setting_value, value_type, category, description, is_public)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          data.setting_key,
          serializedValue,
          data.value_type ?? 'string',
          data.category ?? DEFAULT_CATEGORY,
          data.description ?? null,
          data.is_public === true,
        ],
      );
    }

    await this.createAuditLog(
      existing.length > 0 ? 'system_setting_updated' : 'system_setting_created',
      userId,
      tenantId,
      'system_setting',
      data as unknown as Record<string, unknown>,
      ipAddress,
      userAgent,
    );

    return { success: true };
  }

  /**
   * Delete system setting
   */
  async deleteSystemSetting(
    key: string,
    userId: number,
    tenantId: number,
    userRole: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean }> {
    this.logger.log(`Deleting system setting: ${key}`);

    if (userRole !== 'root') {
      throw new ForbiddenException('Only root can delete system settings');
    }

    const rows = await this.db.query<DbSystemSetting>(
      `SELECT * FROM system_settings WHERE setting_key = $1`,
      [key],
    );

    if (rows.length === 0) {
      throw new NotFoundException(SETTING_NOT_FOUND);
    }

    await this.db.query(`DELETE FROM system_settings WHERE setting_key = $1`, [key]);

    await this.createAuditLog(
      'system_setting_deleted',
      userId,
      tenantId,
      'system_setting',
      { setting_key: key },
      ipAddress,
      userAgent,
    );

    return { success: true };
  }

  // ==================== TENANT SETTINGS ====================

  /**
   * Get all tenant settings
   */
  async getTenantSettings(tenantId: number, filters: SettingFilters): Promise<ParsedSetting[]> {
    this.logger.debug(`Fetching tenant settings for tenant ${tenantId}`);

    let query = `SELECT * FROM tenant_settings WHERE tenant_id = $1`;
    const params: (string | number)[] = [tenantId];

    if (filters.category !== undefined && filters.category !== '') {
      const nextIndex = params.length + 1;
      query += ` AND category = $${nextIndex}`;
      params.push(filters.category);
    }

    if (filters.search !== undefined && filters.search !== '') {
      const nextIndex = params.length + 1;
      query += ` AND setting_key ILIKE $${nextIndex}`;
      params.push(`%${filters.search}%`);
    }

    query += ` ORDER BY category, setting_key`;

    const rows = await this.db.query<DbTenantSetting>(query, params);
    return rows.map((row: DbTenantSetting) => this.mapTenantSetting(row));
  }

  /**
   * Get single tenant setting
   */
  async getTenantSetting(key: string, tenantId: number): Promise<ParsedSetting> {
    this.logger.debug(`Fetching tenant setting: ${key}`);

    const rows = await this.db.query<DbTenantSetting>(
      `SELECT * FROM tenant_settings WHERE setting_key = $1 AND tenant_id = $2`,
      [key, tenantId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(SETTING_NOT_FOUND);
    }

    const setting = rows[0];
    if (setting === undefined) {
      throw new NotFoundException(SETTING_NOT_FOUND);
    }

    return this.mapTenantSetting(setting);
  }

  /**
   * Create or update tenant setting
   */
  async upsertTenantSetting(
    data: SettingData,
    tenantId: number,
    userId: number,
    userRole: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean }> {
    this.logger.log(`Upserting tenant setting: ${data.setting_key}`);

    if (userRole !== 'admin' && userRole !== 'root') {
      throw new ForbiddenException('Only admins can modify tenant settings');
    }

    const serializedValue = this.serializeValue(data.setting_value, data.value_type ?? 'string');

    const existing = await this.db.query<DbIdResult>(
      `SELECT id FROM tenant_settings WHERE setting_key = $1 AND tenant_id = $2`,
      [data.setting_key, tenantId],
    );

    if (existing.length > 0) {
      await this.db.query(
        `UPDATE tenant_settings
         SET setting_value = $1, value_type = $2, category = $3, updated_at = NOW()
         WHERE setting_key = $4 AND tenant_id = $5`,
        [
          serializedValue,
          data.value_type ?? 'string',
          data.category ?? DEFAULT_CATEGORY,
          data.setting_key,
          tenantId,
        ],
      );
    } else {
      await this.db.query(
        `INSERT INTO tenant_settings
         (tenant_id, setting_key, setting_value, value_type, category)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          tenantId,
          data.setting_key,
          serializedValue,
          data.value_type ?? 'string',
          data.category ?? DEFAULT_CATEGORY,
        ],
      );
    }

    await this.createAuditLog(
      existing.length > 0 ? 'tenant_setting_updated' : 'tenant_setting_created',
      userId,
      tenantId,
      'tenant_setting',
      data as unknown as Record<string, unknown>,
      ipAddress,
      userAgent,
    );

    return { success: true };
  }

  /**
   * Delete tenant setting
   */
  async deleteTenantSetting(
    key: string,
    tenantId: number,
    userId: number,
    userRole: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean }> {
    this.logger.log(`Deleting tenant setting: ${key}`);

    if (userRole !== 'admin' && userRole !== 'root') {
      throw new ForbiddenException('Only admins can delete tenant settings');
    }

    const rows = await this.db.query<DbTenantSetting>(
      `SELECT * FROM tenant_settings WHERE setting_key = $1 AND tenant_id = $2`,
      [key, tenantId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(SETTING_NOT_FOUND);
    }

    await this.db.query(`DELETE FROM tenant_settings WHERE setting_key = $1 AND tenant_id = $2`, [
      key,
      tenantId,
    ]);

    await this.createAuditLog(
      'tenant_setting_deleted',
      userId,
      tenantId,
      'tenant_setting',
      { setting_key: key },
      ipAddress,
      userAgent,
    );

    return { success: true };
  }

  // ==================== USER SETTINGS ====================

  /**
   * Get all user settings
   */
  async getUserSettings(
    userId: number,
    filters: SettingFilters,
    tenantId?: number,
    teamId?: number | null,
  ): Promise<ParsedSetting[]> {
    this.logger.debug(`Fetching user settings for user ${userId}`);

    let query = `SELECT * FROM user_settings WHERE user_id = $1`;
    const params: (string | number | null)[] = [userId];

    if (tenantId !== undefined) {
      const nextIndex = params.length + 1;
      query += ` AND tenant_id = $${nextIndex}`;
      params.push(tenantId);
    }

    if (teamId !== undefined) {
      if (teamId === null) {
        query += ` AND team_id IS NULL`;
      } else {
        const nextIndex = params.length + 1;
        query += ` AND (team_id = $${nextIndex} OR team_id IS NULL)`;
        params.push(teamId);
      }
    }

    if (filters.category !== undefined && filters.category !== '') {
      const nextIndex = params.length + 1;
      query += ` AND category = $${nextIndex}`;
      params.push(filters.category);
    }

    if (filters.search !== undefined && filters.search !== '') {
      const nextIndex = params.length + 1;
      query += ` AND setting_key ILIKE $${nextIndex}`;
      params.push(`%${filters.search}%`);
    }

    query += ` ORDER BY team_id DESC, category, setting_key`;

    const rows = await this.db.query<DbUserSetting>(query, params);
    return rows.map((row: DbUserSetting) => this.mapUserSetting(row));
  }

  /**
   * Get single user setting
   */
  async getUserSetting(key: string, userId: number): Promise<ParsedSetting> {
    this.logger.debug(`Fetching user setting: ${key}`);

    const rows = await this.db.query<DbUserSetting>(
      `SELECT * FROM user_settings WHERE setting_key = $1 AND user_id = $2`,
      [key, userId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(SETTING_NOT_FOUND);
    }

    const setting = rows[0];
    if (setting === undefined) {
      throw new NotFoundException(SETTING_NOT_FOUND);
    }

    return this.mapUserSetting(setting);
  }

  /**
   * Create or update user setting
   */
  async upsertUserSetting(
    data: SettingData & { team_id?: number | null | undefined },
    userId: number,
    tenantId: number,
    teamId?: number | null,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<{ success: boolean }> {
    this.logger.log(`Upserting user setting: ${data.setting_key}`);

    const serializedValue = this.serializeValue(data.setting_value, data.value_type ?? 'string');
    const settingTeamId = data.team_id !== undefined ? data.team_id : teamId;

    // Check if exists with exact team_id match
    let checkQuery = `SELECT id FROM user_settings WHERE setting_key = $1 AND user_id = $2 AND tenant_id = $3`;
    const checkParams: (string | number | null)[] = [data.setting_key, userId, tenantId];

    if (settingTeamId === null || settingTeamId === undefined) {
      checkQuery += ` AND team_id IS NULL`;
    } else {
      checkQuery += ` AND team_id = $4`;
      checkParams.push(settingTeamId);
    }

    const existing = await this.db.query<DbIdResult>(checkQuery, checkParams);

    if (existing.length > 0) {
      let updateQuery = `UPDATE user_settings
         SET setting_value = $1, value_type = $2, category = $3, updated_at = NOW()
         WHERE setting_key = $4 AND user_id = $5 AND tenant_id = $6`;
      const updateParams: (string | number | null)[] = [
        serializedValue,
        data.value_type ?? 'string',
        data.category ?? DEFAULT_CATEGORY,
        data.setting_key,
        userId,
        tenantId,
      ];

      if (settingTeamId === null || settingTeamId === undefined) {
        updateQuery += ` AND team_id IS NULL`;
      } else {
        updateQuery += ` AND team_id = $7`;
        updateParams.push(settingTeamId);
      }

      await this.db.query(updateQuery, updateParams);
    } else {
      await this.db.query(
        `INSERT INTO user_settings
         (user_id, tenant_id, team_id, setting_key, setting_value, value_type, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          tenantId,
          settingTeamId ?? null,
          data.setting_key,
          serializedValue,
          data.value_type ?? 'string',
          data.category ?? DEFAULT_CATEGORY,
        ],
      );
    }

    return { success: true };
  }

  /**
   * Delete user setting
   */
  async deleteUserSetting(key: string, userId: number): Promise<{ success: boolean }> {
    this.logger.log(`Deleting user setting: ${key}`);

    const rows = await this.db.query<DbUserSetting>(
      `SELECT * FROM user_settings WHERE setting_key = $1 AND user_id = $2`,
      [key, userId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(SETTING_NOT_FOUND);
    }

    await this.db.query(`DELETE FROM user_settings WHERE setting_key = $1 AND user_id = $2`, [
      key,
      userId,
    ]);

    return { success: true };
  }

  // ==================== ADMIN USER SETTINGS ====================

  /**
   * Get another user's settings (admin only)
   */
  async getAdminUserSettings(
    targetUserId: number,
    tenantId: number,
    userRole: string,
  ): Promise<ParsedSetting[]> {
    this.logger.debug(`Fetching settings for user ${targetUserId} (admin)`);

    if (userRole !== 'admin' && userRole !== 'root') {
      throw new ForbiddenException("Only admins can view other users' settings");
    }

    // SECURITY: Only return settings for ACTIVE users (is_active = 1)
    const userRows = await this.db.query<DbIdResult>(
      `SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = 1`,
      [targetUserId, tenantId],
    );

    if (userRows.length === 0) {
      throw new NotFoundException('User not found or inactive');
    }

    return await this.getUserSettings(targetUserId, {});
  }

  // ==================== COMMON ====================

  /**
   * Get all settings categories
   */
  getCategories(): SettingCategoryDefinition[] {
    return [
      { key: 'general', label: 'General', description: 'General application settings' },
      { key: 'appearance', label: 'Appearance', description: 'UI and theme settings' },
      { key: 'notifications', label: 'Notifications', description: 'Notification preferences' },
      { key: 'security', label: 'Security', description: 'Security and privacy settings' },
      { key: 'workflow', label: 'Workflow', description: 'Workflow and automation settings' },
      { key: 'integration', label: 'Integration', description: 'Third-party integrations' },
      { key: 'other', label: 'Other', description: 'Miscellaneous settings' },
    ];
  }

  /**
   * Bulk update settings
   */
  async bulkUpdate(
    type: SettingType,
    settings: SettingData[],
    contextId: number,
    userId: number,
    tenantId: number,
    userRole: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<BulkUpdateResult[]> {
    this.logger.log(`Bulk updating ${settings.length} ${type} settings`);

    const results: BulkUpdateResult[] = [];

    for (const setting of settings) {
      try {
        switch (type) {
          case 'system':
            await this.upsertSystemSetting(
              setting,
              userId,
              tenantId,
              userRole,
              ipAddress,
              userAgent,
            );
            break;
          case 'tenant':
            await this.upsertTenantSetting(
              setting,
              contextId,
              userId,
              userRole,
              ipAddress,
              userAgent,
            );
            break;
          case 'user':
            await this.upsertUserSetting(
              setting,
              contextId,
              tenantId,
              undefined,
              ipAddress,
              userAgent,
            );
            break;
        }
        results.push({ key: setting.setting_key, success: true });
      } catch (error: unknown) {
        const errorResult: BulkUpdateResult = {
          key: setting.setting_key,
          success: false,
        };
        if (error instanceof Error) {
          errorResult.error = error.message;
        }
        results.push(errorResult);
      }
    }

    return results;
  }

  // ==================== HELPERS ====================

  /**
   * Parse setting value based on type
   */
  private parseValue(value: string | null, type: string): SettingValue | null {
    if (value === null) return null;

    switch (type) {
      case 'boolean':
        return value === 'true' || value === '1';
      case 'number':
        return Number.parseFloat(value);
      case 'json':
        try {
          return JSON.parse(value) as Record<string, unknown>;
        } catch {
          return {};
        }
      default:
        return value;
    }
  }

  /**
   * Serialize setting value for storage
   */
  private serializeValue(value: SettingValue | null, type: SettingValueType): string {
    if (value === null) return '';

    switch (type) {
      case 'boolean':
        return this.serializeBooleanValue(value);
      case 'number':
        return this.serializeNumberValue(value);
      case 'json':
        return JSON.stringify(value);
      default:
        return this.serializeStringValue(value);
    }
  }

  /**
   * Serialize boolean setting value
   */
  private serializeBooleanValue(value: SettingValue): string {
    if (typeof value === 'string') {
      const isFalsy = value.toLowerCase() === 'false' || value === '0' || value === '';
      return isFalsy ? 'false' : 'true';
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
      const isTruthy = value !== 0 && !Number.isNaN(value);
      return isTruthy ? 'true' : 'false';
    }
    return 'true';
  }

  /**
   * Serialize number setting value
   */
  private serializeNumberValue(value: SettingValue): string {
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return value;
    return '0';
  }

  /**
   * Serialize string setting value (default case)
   */
  private serializeStringValue(value: SettingValue): string {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  /**
   * Map system setting DB row to API response
   */
  private mapSystemSetting(row: DbSystemSetting): ParsedSetting {
    return {
      settingKey: row.setting_key,
      settingValue: this.parseValue(row.setting_value, row.value_type),
      valueType: row.value_type,
      category: row.category ?? undefined,
      description: row.description ?? undefined,
      isPublic: Boolean(row.is_public),
      createdAt: row.created_at?.toISOString() ?? undefined,
      updatedAt: row.updated_at?.toISOString() ?? undefined,
    };
  }

  /**
   * Map base setting DB row to API response (shared implementation)
   */
  private mapBaseSetting(row: DbBaseSetting): ParsedSetting {
    return {
      settingKey: row.setting_key,
      settingValue: this.parseValue(row.setting_value, row.value_type),
      valueType: row.value_type,
      category: row.category ?? undefined,
      description: undefined,
      isPublic: undefined,
      createdAt: row.created_at?.toISOString() ?? undefined,
      updatedAt: row.updated_at?.toISOString() ?? undefined,
    };
  }

  /**
   * Map tenant setting DB row to API response
   */
  private mapTenantSetting(row: DbTenantSetting): ParsedSetting {
    return this.mapBaseSetting(row);
  }

  /**
   * Map user setting DB row to API response
   */
  private mapUserSetting(row: DbUserSetting): ParsedSetting {
    return this.mapBaseSetting(row);
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    action: string,
    userId: number,
    tenantId: number,
    entityType: string,
    data: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO root_logs (action, user_id, tenant_id, entity_type, new_values, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          action,
          userId,
          tenantId,
          entityType,
          JSON.stringify(data),
          ipAddress ?? null,
          userAgent ?? null,
        ],
      );
    } catch (error: unknown) {
      this.logger.error('Failed to create audit log:', error);
    }
  }
}
