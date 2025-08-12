/**
 * Settings v2 Service
 * Business logic for system, tenant, and user settings management
 */

import { RowDataPacket } from "mysql2";

import { executeQuery } from "../../../database.js";
import RootLog from "../../../models/rootLog";
import { dbToApi } from "../../../utils/fieldMapping.js";
import { ServiceError } from "../../../utils/ServiceError.js";

export type SettingType = "string" | "number" | "boolean" | "json";
export type SettingCategory =
  | "general"
  | "appearance"
  | "notifications"
  | "security"
  | "workflow"
  | "integration"
  | "other";

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
 */
function parseSettingValue(
  value: string | null,
  type: SettingType,
): string | number | boolean | Record<string, unknown> | null {
  if (value === null) return null;

  switch (type) {
    case "boolean":
      return value === "true" || value === "1";
    case "number":
      return parseFloat(value);
    case "json":
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
 */
function serializeSettingValue(
  value: string | number | boolean | Record<string, unknown> | null,
  type: SettingType,
): string {
  switch (type) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      return String(value);
    case "json":
      return JSON.stringify(value);
    default:
      return String(value);
  }
}

// ==================== SYSTEM SETTINGS ====================

/**
 * Get all system settings
 */
export async function getSystemSettings(
  filters: SettingFilters,
  userRole: string,
) {
  // Only root can access system settings
  if (userRole !== "root") {
    throw new ServiceError("FORBIDDEN", "Access denied", 403);
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
 */
export async function getSystemSetting(key: string, userRole: string) {
  // Check if setting is public or user has permission
  const [[setting]] = await executeQuery<RowDataPacket[]>(
    `SELECT * FROM system_settings WHERE setting_key = ?`,
    [key],
  );

  if (!setting) {
    throw new ServiceError("NOT_FOUND", "Setting not found", 404);
  }

  // Non-admin users can only access public settings
  if (userRole !== "root" && userRole !== "admin" && !setting.is_public) {
    throw new ServiceError("FORBIDDEN", "Access denied", 403);
  }

  const apiData = dbToApi(setting);
  return Object.assign({}, apiData, {
    settingValue: parseSettingValue(setting.setting_value, setting.value_type),
    isPublic: !!setting.is_public,
  });
}

/**
 * Create or update system setting
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
  if (userRole !== "root") {
    throw new ServiceError(
      "FORBIDDEN",
      "Only root can modify system settings",
      403,
    );
  }

  const serializedValue = serializeSettingValue(
    data.setting_value,
    data.value_type ?? "string",
  );

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
        data.value_type ?? "string",
        data.category ?? "other",
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
        data.value_type ?? "string",
        data.category ?? "other",
        data.description ?? null,
        data.is_public ? 1 : 0,
      ],
    );
  }

  // Log the action for system settings
  await RootLog.create({
    tenant_id: tenantId, // Use the root user's tenant_id
    user_id: userId,
    action: existing ? "system_setting_updated" : "system_setting_created",
    entity_type: "system_setting",
    entity_id: 0,
    new_values: data as unknown as Record<string, unknown>,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  return { success: true };
}

/**
 * Delete system setting
 */
export async function deleteSystemSetting(
  key: string,
  userId: number,
  tenantId: number,
  userRole: string,
  ipAddress?: string,
  userAgent?: string,
) {
  if (userRole !== "root") {
    throw new ServiceError(
      "FORBIDDEN",
      "Only root can delete system settings",
      403,
    );
  }

  const [[setting]] = await executeQuery<RowDataPacket[]>(
    `SELECT * FROM system_settings WHERE setting_key = ?`,
    [key],
  );

  if (!setting) {
    throw new ServiceError("NOT_FOUND", "Setting not found", 404);
  }

  await executeQuery(`DELETE FROM system_settings WHERE setting_key = ?`, [
    key,
  ]);

  // Log the action for system settings
  await RootLog.create({
    tenant_id: tenantId, // Use the root user's tenant_id
    user_id: userId,
    action: "system_setting_deleted",
    entity_type: "system_setting",
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
 */
export async function getTenantSettings(
  tenantId: number,
  filters: SettingFilters,
) {
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
 */
export async function getTenantSetting(key: string, tenantId: number) {
  const [[setting]] = await executeQuery<RowDataPacket[]>(
    `SELECT * FROM tenant_settings WHERE setting_key = ? AND tenant_id = ?`,
    [key, tenantId],
  );

  if (!setting) {
    throw new ServiceError("NOT_FOUND", "Setting not found", 404);
  }

  const apiData = dbToApi(setting);
  return Object.assign({}, apiData, {
    settingValue: parseSettingValue(setting.setting_value, setting.value_type),
  });
}

/**
 * Create or update tenant setting
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
  if (userRole !== "admin" && userRole !== "root") {
    throw new ServiceError(
      "FORBIDDEN",
      "Only admins can modify tenant settings",
      403,
    );
  }

  const serializedValue = serializeSettingValue(
    data.setting_value,
    data.value_type ?? "string",
  );

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
        data.value_type ?? "string",
        data.category ?? "other",
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
        data.value_type ?? "string",
        data.category ?? "other",
      ],
    );
  }

  // Log the action
  await RootLog.create({
    tenant_id: tenantId,
    user_id: userId,
    action: existing ? "tenant_setting_updated" : "tenant_setting_created",
    entity_type: "tenant_setting",
    entity_id: 0,
    new_values: data as unknown as Record<string, unknown>,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  return { success: true };
}

/**
 * Delete tenant setting
 */
export async function deleteTenantSetting(
  key: string,
  tenantId: number,
  userId: number,
  userRole: string,
  ipAddress?: string,
  userAgent?: string,
) {
  if (userRole !== "admin" && userRole !== "root") {
    throw new ServiceError(
      "FORBIDDEN",
      "Only admins can delete tenant settings",
      403,
    );
  }

  const [[setting]] = await executeQuery<RowDataPacket[]>(
    `SELECT * FROM tenant_settings WHERE setting_key = ? AND tenant_id = ?`,
    [key, tenantId],
  );

  if (!setting) {
    throw new ServiceError("NOT_FOUND", "Setting not found", 404);
  }

  await executeQuery(
    `DELETE FROM tenant_settings WHERE setting_key = ? AND tenant_id = ?`,
    [key, tenantId],
  );

  // Log the action
  await RootLog.create({
    tenant_id: tenantId,
    user_id: userId,
    action: "tenant_setting_deleted",
    entity_type: "tenant_setting",
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
 */
export async function getUserSettings(userId: number, filters: SettingFilters) {
  let query = `SELECT * FROM user_settings WHERE user_id = ?`;
  const params: (string | number | boolean)[] = [userId];

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
 * Get single user setting
 */
export async function getUserSetting(key: string, userId: number) {
  const [[setting]] = await executeQuery<RowDataPacket[]>(
    `SELECT * FROM user_settings WHERE setting_key = ? AND user_id = ?`,
    [key, userId],
  );

  if (!setting) {
    throw new ServiceError("NOT_FOUND", "Setting not found", 404);
  }

  const apiData = dbToApi(setting);
  return Object.assign({}, apiData, {
    settingValue: parseSettingValue(setting.setting_value, setting.value_type),
  });
}

/**
 * Create or update user setting
 */
export async function upsertUserSetting(
  data: SettingData,
  userId: number,
  _ipAddress?: string,
  _userAgent?: string,
) {
  const serializedValue = serializeSettingValue(
    data.setting_value,
    data.value_type ?? "string",
  );

  // Check if setting exists
  const [[existing]] = await executeQuery<RowDataPacket[]>(
    `SELECT id FROM user_settings WHERE setting_key = ? AND user_id = ?`,
    [data.setting_key, userId],
  );

  if (existing) {
    // Update existing
    await executeQuery(
      `UPDATE user_settings 
       SET setting_value = ?, value_type = ?, category = ?, updated_at = NOW()
       WHERE setting_key = ? AND user_id = ?`,
      [
        serializedValue,
        data.value_type ?? "string",
        data.category ?? "other",
        data.setting_key,
        userId,
      ],
    );
  } else {
    // Insert new
    await executeQuery(
      `INSERT INTO user_settings 
       (user_id, setting_key, setting_value, value_type, category)
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        data.setting_key,
        serializedValue,
        data.value_type ?? "string",
        data.category ?? "other",
      ],
    );
  }

  return { success: true };
}

/**
 * Delete user setting
 */
export async function deleteUserSetting(key: string, userId: number) {
  const [[setting]] = await executeQuery<RowDataPacket[]>(
    `SELECT * FROM user_settings WHERE setting_key = ? AND user_id = ?`,
    [key, userId],
  );

  if (!setting) {
    throw new ServiceError("NOT_FOUND", "Setting not found", 404);
  }

  await executeQuery(
    `DELETE FROM user_settings WHERE setting_key = ? AND user_id = ?`,
    [key, userId],
  );

  return { success: true };
}

/**
 * Get admin's user settings (for admin panel)
 */
export async function getAdminUserSettings(
  targetUserId: number,
  tenantId: number,
  userRole: string,
) {
  if (userRole !== "admin" && userRole !== "root") {
    throw new ServiceError(
      "FORBIDDEN",
      "Only admins can view other users' settings",
      403,
    );
  }

  // Verify user belongs to same tenant
  const [[user]] = await executeQuery<RowDataPacket[]>(
    `SELECT id FROM users WHERE id = ? AND tenant_id = ?`,
    [targetUserId, tenantId],
  );

  if (!user) {
    throw new ServiceError("NOT_FOUND", "User not found", 404);
  }

  return getUserSettings(targetUserId, {});
}

/**
 * Get all settings categories
 */
export async function getSettingsCategories() {
  const categories = [
    {
      key: "general",
      label: "General",
      description: "General application settings",
    },
    {
      key: "appearance",
      label: "Appearance",
      description: "UI and theme settings",
    },
    {
      key: "notifications",
      label: "Notifications",
      description: "Notification preferences",
    },
    {
      key: "security",
      label: "Security",
      description: "Security and privacy settings",
    },
    {
      key: "workflow",
      label: "Workflow",
      description: "Workflow and automation settings",
    },
    {
      key: "integration",
      label: "Integration",
      description: "Third-party integrations",
    },
    { key: "other", label: "Other", description: "Miscellaneous settings" },
  ];

  return categories;
}

/**
 * Bulk update settings
 */
export async function bulkUpdateSettings(
  type: "system" | "tenant" | "user",
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
        case "system":
          await upsertSystemSetting(
            setting,
            userId,
            userTenantId,
            userRole,
            ipAddress,
            userAgent,
          );
          break;
        case "tenant":
          await upsertTenantSetting(
            setting,
            contextId,
            userId,
            userRole,
            ipAddress,
            userAgent,
          );
          break;
        case "user":
          await upsertUserSetting(setting, contextId, ipAddress, userAgent);
          break;
      }
      results.push({ key: setting.setting_key, success: true });
    } catch (error: unknown) {
      results.push({
        key: setting.setting_key,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}
