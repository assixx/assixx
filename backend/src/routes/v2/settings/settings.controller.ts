/**
 * Settings v2 Controller
 * Handles HTTP requests for settings management
 */
import { Response } from 'express';

import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { errorResponse, successResponse } from '../../../utils/apiResponse.js';
import * as settingsService from './settings.service.js';
import type { SettingCategory, SettingData, SettingType } from './settings.service.js';
import { BulkUpdateRequest, SystemSetting, UserSetting } from './types.js';

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
    const filters = {
      category: req.query.category as string | undefined,
      is_public:
        req.query.is_public === 'true' ? true
        : req.query.is_public === 'false' ? false
        : undefined,
      search: req.query.search as string | undefined,
    };

    const settings = await settingsService.getSystemSettings(filters, req.user.role);
    res.json(successResponse({ settings }));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
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
    const setting = await settingsService.getSystemSetting(req.params.key, req.user.role);
    res.json(successResponse(setting));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
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
    const data: SettingData = {
      setting_key: req.params.key || bodyData.setting_key,
      setting_value: bodyData.setting_value,
      value_type: bodyData.value_type ? (bodyData.value_type as SettingType) : 'string',
      category: bodyData.category ? (bodyData.category as SettingCategory) : 'other',
      description: bodyData.description,
      is_public: bodyData.is_public,
    };

    await settingsService.upsertSystemSetting(
      data,
      req.user.id,
      req.user.tenant_id,
      req.user.role,
      req.ip,
      req.get('user-agent'),
    );

    res.json(successResponse(null));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
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
    await settingsService.deleteSystemSetting(
      req.params.key,
      req.user.id,
      req.user.tenant_id,
      req.user.role,
      req.ip,
      req.get('user-agent'),
    );

    res.json(successResponse(null));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
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
    const filters = {
      category: req.query.category as string | undefined,
      search: req.query.search as string | undefined,
    };

    const settings = await settingsService.getTenantSettings(req.user.tenant_id, filters);

    res.json(successResponse({ settings }));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
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
    const setting = await settingsService.getTenantSetting(req.params.key, req.user.tenant_id);

    res.json(successResponse(setting));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
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
    const data: SettingData = {
      setting_key: req.params.key || bodyData.setting_key,
      setting_value: bodyData.setting_value,
      value_type: bodyData.value_type ? (bodyData.value_type as SettingType) : 'string',
      category: bodyData.category ? (bodyData.category as SettingCategory) : 'other',
      description: bodyData.description,
      is_public: bodyData.is_public,
    };

    await settingsService.upsertTenantSetting(
      data,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
      req.ip,
      req.get('user-agent'),
    );

    res.json(successResponse(null));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
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
    await settingsService.deleteTenantSetting(
      req.params.key,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
      req.ip,
      req.get('user-agent'),
    );

    res.json(successResponse(null));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
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
    const filters = {
      category: req.query.category as string | undefined,
      search: req.query.search as string | undefined,
    };

    // Get team_id from query params if provided
    const teamId = req.query.team_id ? Number(req.query.team_id) : undefined;

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
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
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
    const setting = await settingsService.getUserSetting(req.params.key, req.user.id);

    res.json(successResponse(setting));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  }
};

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
    const data: SettingData & { team_id?: number | null } = {
      setting_key: req.params.key || bodyData.setting_key,
      setting_value: bodyData.setting_value,
      value_type: bodyData.value_type ? (bodyData.value_type as SettingType) : 'string',
      category: bodyData.category ? (bodyData.category as SettingCategory) : 'other',
      description: bodyData.description,
      team_id: bodyData.team_id, // Include team_id if provided
    };

    await settingsService.upsertUserSetting(
      data,
      req.user.id,
      req.user.tenant_id,
      bodyData.team_id,
      req.ip,
      req.get('user-agent'),
    );

    res.json(successResponse(null));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
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
    await settingsService.deleteUserSetting(req.params.key, req.user.id);

    res.json(successResponse(null));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
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
    const targetUserId = Number.parseInt(req.params.userId);
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
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
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
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
  }
};

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

    // Convert settings to SettingData format
    const settingsData: SettingData[] = settings.map((setting) => ({
      setting_key: setting.setting_key,
      setting_value: setting.setting_value,
      value_type: setting.value_type ? (setting.value_type as SettingType) : 'string',
      category: setting.category ? (setting.category as SettingCategory) : 'other',
      description: setting.description,
      is_public: setting.is_public,
    }));

    const results = await settingsService.bulkUpdateSettings(
      type,
      settingsData,
      contextId,
      req.user.id,
      req.user.tenant_id,
      req.user.role,
      req.ip,
      req.get('user-agent'),
    );

    res.json(successResponse({ results }));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  }
};
