/**
 * Settings v2 Controller
 * Handles HTTP requests for settings management
 */
import { Response } from 'express';

import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { errorResponse, successResponse } from '../../../utils/apiResponse.js';
import * as settingsService from './settings.service.js';
import type { SettingCategory, SettingData } from './settings.service.js';
import { BulkUpdateRequest, SystemSetting, UserSetting } from './types.js';

// Constants
const UNEXPECTED_ERROR = 'An unexpected error occurred';
const USER_AGENT_HEADER = 'user-agent';
const SETTING_KEY_REQUIRED = 'Setting key is required';

/**
 * Validate and get setting key from params or body
 */
function getSettingKey(paramKey: string | undefined, bodyKey: string | undefined): string {
  const key = paramKey ?? bodyKey ?? '';
  if (key === '') {
    throw new ServiceError('VALIDATION_ERROR', SETTING_KEY_REQUIRED);
  }
  return key;
}

/**
 * Build SettingData from body with optional fields
 */
function buildSettingData(key: string, bodyData: SystemSetting): SettingData {
  const data: SettingData = {
    setting_key: key,
    setting_value: bodyData.setting_value,
  };

  // value_type is a union type ('string'|'number'|'boolean'|'json'), can't be empty string
  if (bodyData.value_type !== undefined) {
    data.value_type = bodyData.value_type;
  }
  if (bodyData.category !== undefined && bodyData.category !== '') {
    data.category = bodyData.category as SettingCategory;
  }
  if (bodyData.description !== undefined && bodyData.description !== '') {
    data.description = bodyData.description;
  }
  if (bodyData.is_public !== undefined) {
    data.is_public = bodyData.is_public;
  }

  return data;
}

// ==================== SYSTEM SETTINGS ====================

/**
 * Get all system settings
 * @param req - The request object
 * @param res - The response object
 */
export const getSystemSettings = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    // Build filters object conditionally to avoid undefined values
    const filters: { category?: string; is_public?: boolean; search?: string } = {};

    const categoryParam = req.query['category'];
    if (typeof categoryParam === 'string') {
      filters.category = categoryParam;
    }

    const isPublicParam = req.query['is_public'];
    if (isPublicParam === 'true') {
      filters.is_public = true;
    } else if (isPublicParam === 'false') {
      filters.is_public = false;
    }

    const searchParam = req.query['search'];
    if (typeof searchParam === 'string') {
      filters.search = searchParam;
    }

    const settings = await settingsService.getSystemSettings(filters, req.user.role);
    res.json(successResponse({ settings }));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', UNEXPECTED_ERROR));
    }
  }
};

/**
 * Get single system setting
 * @param req - The request object
 * @param res - The response object
 */
export const getSystemSetting = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const key = req.params['key'];
    if (key === undefined || key === '') {
      throw new ServiceError('VALIDATION_ERROR', SETTING_KEY_REQUIRED);
    }

    const setting = await settingsService.getSystemSetting(key, req.user.role);
    res.json(successResponse(setting));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', UNEXPECTED_ERROR));
    }
  }
};

/**
 * Create or update system setting
 * @param req - The request object
 * @param res - The response object
 */
export const upsertSystemSetting = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const bodyData = req.body as SystemSetting;
    const key = getSettingKey(req.params['key'], bodyData.setting_key);
    const data = buildSettingData(key, bodyData);

    await settingsService.upsertSystemSetting(
      data,
      req.user.id,
      req.user.tenant_id,
      req.user.role,
      req.ip,
      req.get(USER_AGENT_HEADER),
    );

    res.json(successResponse(null));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', UNEXPECTED_ERROR));
    }
  }
};

/**
 * Delete system setting
 * @param req - The request object
 * @param res - The response object
 */
export const deleteSystemSetting = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const key = req.params['key'];
    if (key === undefined || key === '') {
      throw new ServiceError('VALIDATION_ERROR', SETTING_KEY_REQUIRED);
    }

    await settingsService.deleteSystemSetting(
      key,
      req.user.id,
      req.user.tenant_id,
      req.user.role,
      req.ip,
      req.get(USER_AGENT_HEADER),
    );

    res.json(successResponse(null));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', UNEXPECTED_ERROR));
    }
  }
};

// ==================== TENANT SETTINGS ====================

/**
 * Get all tenant settings
 * @param req - The request object
 * @param res - The response object
 */
export const getTenantSettings = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    // Build filters object conditionally to avoid undefined values
    const filters: { category?: string; search?: string } = {};

    const categoryParam = req.query['category'];
    if (typeof categoryParam === 'string') {
      filters.category = categoryParam;
    }

    const searchParam = req.query['search'];
    if (typeof searchParam === 'string') {
      filters.search = searchParam;
    }

    const settings = await settingsService.getTenantSettings(req.user.tenant_id, filters);

    res.json(successResponse({ settings }));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', UNEXPECTED_ERROR));
    }
  }
};

/**
 * Get single tenant setting
 * @param req - The request object
 * @param res - The response object
 */
export const getTenantSetting = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const key = req.params['key'];
    if (key === undefined || key === '') {
      throw new ServiceError('VALIDATION_ERROR', SETTING_KEY_REQUIRED);
    }

    const setting = await settingsService.getTenantSetting(key, req.user.tenant_id);

    res.json(successResponse(setting));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', UNEXPECTED_ERROR));
    }
  }
};

/**
 * Create or update tenant setting
 * @param req - The request object
 * @param res - The response object
 */
export const upsertTenantSetting = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const bodyData = req.body as SystemSetting;
    const key = getSettingKey(req.params['key'], bodyData.setting_key);
    const data = buildSettingData(key, bodyData);

    await settingsService.upsertTenantSetting(
      data,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
      req.ip,
      req.get(USER_AGENT_HEADER),
    );

    res.json(successResponse(null));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', UNEXPECTED_ERROR));
    }
  }
};

/**
 * Delete tenant setting
 * @param req - The request object
 * @param res - The response object
 */
export const deleteTenantSetting = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const key = req.params['key'];
    if (key === undefined || key === '') {
      throw new ServiceError('VALIDATION_ERROR', SETTING_KEY_REQUIRED);
    }

    await settingsService.deleteTenantSetting(
      key,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
      req.ip,
      req.get(USER_AGENT_HEADER),
    );

    res.json(successResponse(null));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', UNEXPECTED_ERROR));
    }
  }
};

// ==================== USER SETTINGS ====================

/**
 * Get all user settings
 * @param req - The request object
 * @param res - The response object
 */
export const getUserSettings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Build filters object conditionally to avoid undefined values
    const filters: { category?: string; search?: string } = {};

    const categoryParam = req.query['category'];
    if (typeof categoryParam === 'string') {
      filters.category = categoryParam;
    }

    const searchParam = req.query['search'];
    if (typeof searchParam === 'string') {
      filters.search = searchParam;
    }

    // Get team_id from query params if provided
    const teamIdParam = req.query['team_id'];
    const teamId =
      typeof teamIdParam === 'string' && teamIdParam !== '' ? Number(teamIdParam) : undefined;

    const settings = await settingsService.getUserSettings(
      req.user.id,
      filters,
      req.user.tenant_id,
      teamId,
    );

    res.json(successResponse({ settings }));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', UNEXPECTED_ERROR));
    }
  }
};

/**
 * Get single user setting
 * @param req - The request object
 * @param res - The response object
 */
export const getUserSetting = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const key = req.params['key'];
    if (key === undefined || key === '') {
      throw new ServiceError('VALIDATION_ERROR', SETTING_KEY_REQUIRED);
    }

    const setting = await settingsService.getUserSetting(key, req.user.id);

    res.json(successResponse(setting));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', UNEXPECTED_ERROR));
    }
  }
};

/**
 * Build user setting data from body with optional team_id
 */
function buildUserSettingData(
  key: string,
  bodyData: UserSetting & { team_id?: number | null },
): SettingData & { team_id?: number | null } {
  const data: SettingData & { team_id?: number | null } = {
    setting_key: key,
    setting_value: bodyData.setting_value,
  };

  // value_type is a union type ('string'|'number'|'boolean'|'json'), can't be empty string
  if (bodyData.value_type !== undefined) {
    data.value_type = bodyData.value_type;
  }
  if (bodyData.category !== undefined && bodyData.category !== '') {
    data.category = bodyData.category as SettingCategory;
  }
  if (bodyData.description !== undefined && bodyData.description !== '') {
    data.description = bodyData.description;
  }
  if (bodyData.team_id !== undefined) {
    data.team_id = bodyData.team_id;
  }

  return data;
}

/**
 * Create or update user setting
 * @param req - The request object
 * @param res - The response object
 */
export const upsertUserSetting = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const bodyData = req.body as UserSetting & { team_id?: number | null };
    const key = getSettingKey(req.params['key'], bodyData.setting_key);
    const data = buildUserSettingData(key, bodyData);

    await settingsService.upsertUserSetting(
      data,
      req.user.id,
      req.user.tenant_id,
      bodyData.team_id,
      req.ip,
      req.get(USER_AGENT_HEADER),
    );

    res.json(successResponse(null));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', UNEXPECTED_ERROR));
    }
  }
};

/**
 * Delete user setting
 * @param req - The request object
 * @param res - The response object
 */
export const deleteUserSetting = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const key = req.params['key'];
    if (key === undefined || key === '') {
      throw new ServiceError('VALIDATION_ERROR', SETTING_KEY_REQUIRED);
    }

    await settingsService.deleteUserSetting(key, req.user.id);

    res.json(successResponse(null));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', UNEXPECTED_ERROR));
    }
  }
};

// ==================== ADMIN USER SETTINGS ====================

/**
 * Get another user's settings (admin only)
 * @param req - The request object
 * @param res - The response object
 */
export const getAdminUserSettings = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userIdParam = req.params['userId'];
    if (userIdParam === undefined || userIdParam === '') {
      throw new ServiceError('VALIDATION_ERROR', 'User ID is required');
    }

    const targetUserId = Number.parseInt(userIdParam);
    const settings = await settingsService.getAdminUserSettings(
      targetUserId,
      req.user.tenant_id,
      req.user.role,
    );

    res.json(successResponse({ settings }));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', UNEXPECTED_ERROR));
    }
  }
};

// ==================== COMMON ====================

/**
 * Get settings categories
 * @param _req - The _req parameter
 * @param res - The response object
 */
export const getCategories = (_req: AuthenticatedRequest, res: Response): void => {
  try {
    const categories = settingsService.getSettingsCategories();
    res.json(successResponse({ categories }));
  } catch {
    res.status(500).json(errorResponse('INTERNAL_ERROR', UNEXPECTED_ERROR));
  }
};

/**
 * Build SettingData from bulk update item
 */
function buildBulkSettingData(setting: BulkUpdateRequest['settings'][number]): SettingData {
  const data: SettingData = {
    setting_key: setting.setting_key,
    setting_value: setting.setting_value,
  };

  // value_type is a union type ('string'|'number'|'boolean'|'json'), can't be empty string
  if (setting.value_type !== undefined) {
    data.value_type = setting.value_type;
  }
  if (setting.category !== undefined && setting.category !== '') {
    data.category = setting.category as SettingCategory;
  }
  if (setting.description !== undefined && setting.description !== '') {
    data.description = setting.description;
  }
  if (setting.is_public !== undefined) {
    data.is_public = setting.is_public;
  }

  return data;
}

/**
 * Bulk update settings
 * @param req - The request object
 * @param res - The response object
 */
export const bulkUpdate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { type, settings } = req.body as BulkUpdateRequest;

    if (!['system', 'tenant', 'user'].includes(type)) {
      throw new ServiceError('VALIDATION_ERROR', 'Invalid settings type');
    }

    if (!Array.isArray(settings) || settings.length === 0) {
      throw new ServiceError('VALIDATION_ERROR', 'Settings must be a non-empty array');
    }

    const contextId = type === 'user' ? req.user.id : req.user.tenant_id;
    const settingsData: SettingData[] = settings.map(buildBulkSettingData);

    const results = await settingsService.bulkUpdateSettings(
      type,
      settingsData,
      contextId,
      req.user.id,
      req.user.tenant_id,
      req.user.role,
      req.ip,
      req.get(USER_AGENT_HEADER),
    );

    res.json(successResponse({ results }));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', UNEXPECTED_ERROR));
    }
  }
};
