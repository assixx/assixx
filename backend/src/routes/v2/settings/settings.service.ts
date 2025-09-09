/**
 * Settings v2 Service
 * Business logic for system, tenant, and user settings management
 */
import { RowDataPacket } from 'mysql2';

import rootLog from '../../../models/rootLog';
import { ServiceError } from '../../../utils/ServiceError.js';
import { query as executeQuery } from '../../../utils/db.js';
import { dbToApi } from '../../../utils/fieldMapping.js';

export type SettingType = 'string' | 'number' | 'boolean' | 'json';
export type SettingCategory =
  | 'general'
  | 'appearance'
  | 'notifications'
  | 'security'
  | 'workflow'
  | 'integration'
  | 'other';

export interface SettingData {
  setting_key: string;
  setting_value: string | number | boolean | Record<string, unknown>;
  value_type?: SettingType;
  category?: SettingCategory;
  description?: string;
  is_public?: boolean;
}

interface SettingFilters {
  category?: string;
  is_public?: boolean;
  search?: string;
}

/**
 * Parse setting value based on type
 * @param value - The value parameter
 * @param type - The type parameter
 */
function parseSettingValue(
  value: string | null,
  type: SettingType,
): string | number | boolean | Record<string, unknown> | null {
  if (value === null) return null;

  switch (type) {
    case 'boolean':
      return value === 'true' || value === '1';
    case 'number':
      return Number.parseFloat(value);
    case 'json':
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    default:
      return value;
  }
}

/**
 * Serialize setting value for storage
 * @param value - The value parameter
 * @param type - The type parameter
 */
function serializeSettingValue(
  value: string | number | boolean | Record<string, unknown> | null,
  type: SettingType,
): string {
  switch (type) {
    case 'boolean':
      // Handle string "false" and "true" properly
      if (typeof value === 'string') {
        return value.toLowerCase() === 'false' || value === '0' || value === '' ? 'false' : 'true';
      }
      return value ? 'true' : 'false';
    case 'number':
      return String(value);
    case 'json':
      return JSON.stringify(value);
    default:
      return String(value);
  }
}

// ==================== SYSTEM SETTINGS ====================

/**
 * Get all system settings
 * @param filters - The filter criteria
 * @param userRole - The userRole parameter
 */
export async function getSystemSettings(filters: SettingFilters, userRole: string) {
  // Only root can access system settings
  if (userRole !== 'root') {
    throw new ServiceError('FORBIDDEN', 'Access denied', 403);
  }

  let query = `SELECT * FROM system_settings WHERE 1=1`;
  const params: (string | number | boolean)[] = [];

  // Apply filters
  if (filters.category) {
    query += ` AND category = ?`;
    params.push(filters.category);
  }

  if (filters.is_public !== undefined) {
    query += ` AND is_public = ?`;
    params.push(filters.is_public ? 1 : 0);
  }

  if (filters.search) {
    query += ` AND (setting_key LIKE ? OR description LIKE ?)`;
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  query += ` ORDER BY category, setting_key`;

  const [rows] = await executeQuery<RowDataPacket[]>(query, params);

  return rows.map((row) => {
    const apiData = dbToApi(row);
    return Object.assign({}, apiData, {
      settingValue: parseSettingValue(row.setting_value, row.value_type),
      isPublic: !!row.is_public,
    });
  });
}

/**
 * Get single system setting
 * @param key - The key parameter
 * @param userRole - The userRole parameter
 */
export async function getSystemSetting(key: string, userRole: string) {
  // Check if setting is public or user has permission
  const [[setting]] = await executeQuery<RowDataPacket[]>(
    `SELECT * FROM system_settings WHERE setting_key = ?`,
    [key],
  );

  if (!setting) {
    throw new ServiceError('NOT_FOUND', 'Setting not found', 404);
  }

  // Non-admin users can only access public settings
  if (userRole !== 'root' && userRole !== 'admin' && !setting.is_public) {
    throw new ServiceError('FORBIDDEN', 'Access denied', 403);
  }

  const apiData = dbToApi(setting);
  return Object.assign({}, apiData, {
    settingValue: parseSettingValue(setting.setting_value, setting.value_type),
    isPublic: !!setting.is_public,
  });
}

/**
 * Create or update system setting
 * @param data - The data object
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 * @param userRole - The userRole parameter
 * @param ipAddress - The ipAddress parameter
 * @param userAgent - The userAgent parameter
 */
export async function upsertSystemSetting(
  data: SettingData,
  userId: number,
  tenantId: number,
  userRole: string,
  ipAddress?: string,
  userAgent?: string,
) {
  // Only root can modify system settings
  if (userRole !== 'root') {
    throw new ServiceError('FORBIDDEN', 'Only root can modify system settings', 403);
  }

  const serializedValue = serializeSettingValue(data.setting_value, data.value_type ?? 'string');

  // Check if setting exists
  const [[existing]] = await executeQuery<RowDataPacket[]>(
    `SELECT id FROM system_settings WHERE setting_key = ?`,
    [data.setting_key],
  );

  if (existing) {
    // Update existing
    await executeQuery(
      `UPDATE system_settings
       SET setting_value = ?, value_type = ?, category = ?, description = ?, is_public = ?, updated_at = NOW()
       WHERE setting_key = ?`,
      [
        serializedValue,
        data.value_type ?? 'string',
        data.category ?? 'other',
        data.description ?? null,
        data.is_public ? 1 : 0,
        data.setting_key,
      ],
    );
  } else {
    // Insert new
    await executeQuery(
      `INSERT INTO system_settings
       (setting_key, setting_value, value_type, category, description, is_public)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.setting_key,
        serializedValue,
        data.value_type ?? 'string',
        data.category ?? 'other',
        data.description ?? null,
        data.is_public ? 1 : 0,
      ],
    );
  }

  // Log the action for system settings
  await rootLog.create({
    tenant_id: tenantId, // Use the root user's tenant_id
    user_id: userId,
    action: existing ? 'system_setting_updated' : 'system_setting_created',
    entity_type: 'system_setting',
    entity_id: 0,
    new_values: data as unknown as Record<string, unknown>,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  return { success: true };
}

/**
 * Delete system setting
 * @param key - The key parameter
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 * @param userRole - The userRole parameter
 * @param ipAddress - The ipAddress parameter
 * @param userAgent - The userAgent parameter
 */
export async function deleteSystemSetting(
  key: string,
  userId: number,
  tenantId: number,
  userRole: string,
  ipAddress?: string,
  userAgent?: string,
) {
  if (userRole !== 'root') {
    throw new ServiceError('FORBIDDEN', 'Only root can delete system settings', 403);
  }

  const [[setting]] = await executeQuery<RowDataPacket[]>(
    `SELECT * FROM system_settings WHERE setting_key = ?`,
    [key],
  );

  if (!setting) {
    throw new ServiceError('NOT_FOUND', 'Setting not found', 404);
  }

  await executeQuery(`DELETE FROM system_settings WHERE setting_key = ?`, [key]);

  // Log the action for system settings
  await rootLog.create({
    tenant_id: tenantId, // Use the root user's tenant_id
    user_id: userId,
    action: 'system_setting_deleted',
    entity_type: 'system_setting',
    entity_id: 0,
    old_values: setting,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  return { success: true };
}

// ==================== TENANT SETTINGS ====================

/**
 * Get all tenant settings
 * @param tenantId - The tenant ID
 * @param filters - The filter criteria
 */
export async function getTenantSettings(tenantId: number, filters: SettingFilters) {
  let query = `SELECT * FROM tenant_settings WHERE tenant_id = ?`;
  const params: (string | number | boolean)[] = [tenantId];

  if (filters.category) {
    query += ` AND category = ?`;
    params.push(filters.category);
  }

  if (filters.search) {
    query += ` AND setting_key LIKE ?`;
    params.push(`%${filters.search}%`);
  }

  query += ` ORDER BY category, setting_key`;

  const [rows] = await executeQuery<RowDataPacket[]>(query, params);

  return rows.map((row) => {
    const apiData = dbToApi(row);
    return Object.assign({}, apiData, {
      settingValue: parseSettingValue(row.setting_value, row.value_type),
    });
  });
}

/**
 * Get single tenant setting
 * @param key - The key parameter
 * @param tenantId - The tenant ID
 */
export async function getTenantSetting(key: string, tenantId: number) {
  const [[setting]] = await executeQuery<RowDataPacket[]>(
    `SELECT * FROM tenant_settings WHERE setting_key = ? AND tenant_id = ?`,
    [key, tenantId],
  );

  if (!setting) {
    throw new ServiceError('NOT_FOUND', 'Setting not found', 404);
  }

  const apiData = dbToApi(setting);
  return Object.assign({}, apiData, {
    settingValue: parseSettingValue(setting.setting_value, setting.value_type),
  });
}

/**
 * Create or update tenant setting
 * @param data - The data object
 * @param tenantId - The tenant ID
 * @param userId - The user ID
 * @param userRole - The userRole parameter
 * @param ipAddress - The ipAddress parameter
 * @param userAgent - The userAgent parameter
 */
export async function upsertTenantSetting(
  data: SettingData,
  tenantId: number,
  userId: number,
  userRole: string,
  ipAddress?: string,
  userAgent?: string,
) {
  // Only admin and root can modify tenant settings
  if (userRole !== 'admin' && userRole !== 'root') {
    throw new ServiceError('FORBIDDEN', 'Only admins can modify tenant settings', 403);
  }

  const serializedValue = serializeSettingValue(data.setting_value, data.value_type ?? 'string');

  // Check if setting exists
  const [[existing]] = await executeQuery<RowDataPacket[]>(
    `SELECT id FROM tenant_settings WHERE setting_key = ? AND tenant_id = ?`,
    [data.setting_key, tenantId],
  );

  if (existing) {
    // Update existing
    await executeQuery(
      `UPDATE tenant_settings
       SET setting_value = ?, value_type = ?, category = ?, updated_at = NOW()
       WHERE setting_key = ? AND tenant_id = ?`,
      [
        serializedValue,
        data.value_type ?? 'string',
        data.category ?? 'other',
        data.setting_key,
        tenantId,
      ],
    );
  } else {
    // Insert new
    await executeQuery(
      `INSERT INTO tenant_settings
       (tenant_id, setting_key, setting_value, value_type, category)
       VALUES (?, ?, ?, ?, ?)`,
      [
        tenantId,
        data.setting_key,
        serializedValue,
        data.value_type ?? 'string',
        data.category ?? 'other',
      ],
    );
  }

  // Log the action
  await rootLog.create({
    tenant_id: tenantId,
    user_id: userId,
    action: existing ? 'tenant_setting_updated' : 'tenant_setting_created',
    entity_type: 'tenant_setting',
    entity_id: 0,
    new_values: data as unknown as Record<string, unknown>,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  return { success: true };
}

/**
 * Delete tenant setting
 * @param key - The key parameter
 * @param tenantId - The tenant ID
 * @param userId - The user ID
 * @param userRole - The userRole parameter
 * @param ipAddress - The ipAddress parameter
 * @param userAgent - The userAgent parameter
 */
export async function deleteTenantSetting(
  key: string,
  tenantId: number,
  userId: number,
  userRole: string,
  ipAddress?: string,
  userAgent?: string,
) {
  if (userRole !== 'admin' && userRole !== 'root') {
    throw new ServiceError('FORBIDDEN', 'Only admins can delete tenant settings', 403);
  }

  const [[setting]] = await executeQuery<RowDataPacket[]>(
    `SELECT * FROM tenant_settings WHERE setting_key = ? AND tenant_id = ?`,
    [key, tenantId],
  );

  if (!setting) {
    throw new ServiceError('NOT_FOUND', 'Setting not found', 404);
  }

  await executeQuery(`DELETE FROM tenant_settings WHERE setting_key = ? AND tenant_id = ?`, [
    key,
    tenantId,
  ]);

  // Log the action
  await rootLog.create({
    tenant_id: tenantId,
    user_id: userId,
    action: 'tenant_setting_deleted',
    entity_type: 'tenant_setting',
    entity_id: 0,
    old_values: setting,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  return { success: true };
}

// ==================== USER SETTINGS ====================

/**
 * Get all user settings
 * @param userId - The user ID
 * @param filters - The filter criteria
 * @param tenantId - The tenant ID
 * @param teamId - Optional team ID for team-specific settings
 */
export async function getUserSettings(
  userId: number,
  filters: SettingFilters,
  tenantId?: number,
  teamId?: number | null,
) {
  let query = `SELECT * FROM user_settings WHERE user_id = ?`;
  const params: (string | number | boolean | null)[] = [userId];

  // Add tenant_id filter if provided
  if (tenantId !== undefined) {
    query += ` AND tenant_id = ?`;
    params.push(tenantId);
  }

  // Add team_id filter - NULL means global settings
  if (teamId !== undefined) {
    if (teamId === null) {
      query += ` AND team_id IS NULL`;
    } else {
      query += ` AND (team_id = ? OR team_id IS NULL)`;
      params.push(teamId);
    }
  }

  if (filters.category) {
    query += ` AND category = ?`;
    params.push(filters.category);
  }

  if (filters.search) {
    query += ` AND setting_key LIKE ?`;
    params.push(`%${filters.search}%`);
  }

  query += ` ORDER BY team_id DESC, category, setting_key`;

  const [rows] = await executeQuery<RowDataPacket[]>(query, params);

  return rows.map((row) => {
    const apiData = dbToApi(row);
    return Object.assign({}, apiData, {
      settingValue: parseSettingValue(row.setting_value, row.value_type),
    });
  });
}

/**
 * Get single user setting
 * @param key - The key parameter
 * @param userId - The user ID
 */
export async function getUserSetting(key: string, userId: number) {
  const [[setting]] = await executeQuery<RowDataPacket[]>(
    `SELECT * FROM user_settings WHERE setting_key = ? AND user_id = ?`,
    [key, userId],
  );

  if (!setting) {
    throw new ServiceError('NOT_FOUND', 'Setting not found', 404);
  }

  const apiData = dbToApi(setting);
  return Object.assign({}, apiData, {
    settingValue: parseSettingValue(setting.setting_value, setting.value_type),
  });
}

/**
 * Create or update user setting
 * @param data - The data object
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 * @param teamId - Optional team ID for team-specific settings
 * @param _ipAddress - The _ipAddress parameter
 * @param _userAgent - The _userAgent parameter
 */
export async function upsertUserSetting(
  data: SettingData & { team_id?: number | null },
  userId: number,
  tenantId: number,
  teamId?: number | null,
  _ipAddress?: string,
  _userAgent?: string,
) {
  const serializedValue = serializeSettingValue(data.setting_value, data.value_type ?? 'string');

  // Use provided team_id or default to parameter
  const settingTeamId = data.team_id !== undefined ? data.team_id : teamId;

  // Check if setting exists
  const [[existing]] = await executeQuery<RowDataPacket[]>(
    `SELECT id FROM user_settings
     WHERE setting_key = ? AND user_id = ? AND tenant_id = ?
     AND (team_id = ? OR (team_id IS NULL AND ? IS NULL))`,
    [data.setting_key, userId, tenantId, settingTeamId, settingTeamId],
  );

  if (existing) {
    // Update existing
    await executeQuery(
      `UPDATE user_settings
       SET setting_value = ?, value_type = ?, category = ?, updated_at = NOW()
       WHERE setting_key = ? AND user_id = ? AND tenant_id = ?
       AND (team_id = ? OR (team_id IS NULL AND ? IS NULL))`,
      [
        serializedValue,
        data.value_type ?? 'string',
        data.category ?? 'other',
        data.setting_key,
        userId,
        tenantId,
        settingTeamId,
        settingTeamId,
      ],
    );
  } else {
    // Insert new
    await executeQuery(
      `INSERT INTO user_settings
       (user_id, tenant_id, team_id, setting_key, setting_value, value_type, category)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        tenantId,
        settingTeamId,
        data.setting_key,
        serializedValue,
        data.value_type ?? 'string',
        data.category ?? 'other',
      ],
    );
  }

  return { success: true };
}

/**
 * Delete user setting
 * @param key - The key parameter
 * @param userId - The user ID
 */
export async function deleteUserSetting(key: string, userId: number) {
  const [[setting]] = await executeQuery<RowDataPacket[]>(
    `SELECT * FROM user_settings WHERE setting_key = ? AND user_id = ?`,
    [key, userId],
  );

  if (!setting) {
    throw new ServiceError('NOT_FOUND', 'Setting not found', 404);
  }

  await executeQuery(`DELETE FROM user_settings WHERE setting_key = ? AND user_id = ?`, [
    key,
    userId,
  ]);

  return { success: true };
}

/**
 * Get admin's user settings (for admin panel)
 * @param targetUserId - The targetUserId parameter
 * @param tenantId - The tenant ID
 * @param userRole - The userRole parameter
 */
export async function getAdminUserSettings(
  targetUserId: number,
  tenantId: number,
  userRole: string,
) {
  if (userRole !== 'admin' && userRole !== 'root') {
    throw new ServiceError('FORBIDDEN', "Only admins can view other users' settings", 403);
  }

  // Verify user belongs to same tenant
  const [[user]] = await executeQuery<RowDataPacket[]>(
    `SELECT id FROM users WHERE id = ? AND tenant_id = ?`,
    [targetUserId, tenantId],
  );

  if (!user) {
    throw new ServiceError('NOT_FOUND', 'User not found', 404);
  }

  return await getUserSettings(targetUserId, {});
}

/**
 * Get all settings categories
 */
export async function getSettingsCategories() {
  return [
    {
      key: 'general',
      label: 'General',
      description: 'General application settings',
    },
    {
      key: 'appearance',
      label: 'Appearance',
      description: 'UI and theme settings',
    },
    {
      key: 'notifications',
      label: 'Notifications',
      description: 'Notification preferences',
    },
    {
      key: 'security',
      label: 'Security',
      description: 'Security and privacy settings',
    },
    {
      key: 'workflow',
      label: 'Workflow',
      description: 'Workflow and automation settings',
    },
    {
      key: 'integration',
      label: 'Integration',
      description: 'Third-party integrations',
    },
    { key: 'other', label: 'Other', description: 'Miscellaneous settings' },
  ];
}

/**
 * Bulk update settings
 * @param type - The type parameter
 * @param settings - The settings parameter
 * @param contextId - The contextId parameter
 * @param userId - The user ID
 * @param userTenantId - The userTenantId parameter
 * @param userRole - The userRole parameter
 * @param ipAddress - The ipAddress parameter
 * @param userAgent - The userAgent parameter
 */
export async function bulkUpdateSettings(
  type: 'system' | 'tenant' | 'user',
  settings: SettingData[],
  contextId: number, // tenantId or userId
  userId: number,
  userTenantId: number, // tenant_id of the current user
  userRole: string,
  ipAddress?: string,
  userAgent?: string,
) {
  const results = [];

  for (const setting of settings) {
    try {
      switch (type) {
        case 'system':
          await upsertSystemSetting(setting, userId, userTenantId, userRole, ipAddress, userAgent);
          break;
        case 'tenant':
          await upsertTenantSetting(setting, contextId, userId, userRole, ipAddress, userAgent);
          break;
        case 'user':
          await upsertUserSetting(
            setting,
            contextId,
            userTenantId,
            undefined,
            ipAddress,
            userAgent,
          );
          break;
      }
      results.push({ key: setting.setting_key, success: true });
    } catch (error: unknown) {
      results.push({
        key: setting.setting_key,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}
