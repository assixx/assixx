/**
 * Settings v2 Controller
 * Handles HTTP requests for settings management
 */

import { Response } from "express";

import type { AuthenticatedRequest } from "../../../types/request.types.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { ServiceError } from "../../../utils/ServiceError.js";

import * as settingsService from "./settings.service.js";
import type {
  SettingData,
  SettingType,
  SettingCategory,
} from "./settings.service.js";
import { SystemSetting, UserSetting, BulkUpdateRequest } from "./types.js";

// ==================== SYSTEM SETTINGS ====================

/**
 * Get all system settings
 * @param req
 * @param res
 */
export const getSystemSettings = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    const filters = {
      category: req.query.category as string | undefined,
      is_public:
        req.query.is_public === "true"
          ? true
          : req.query.is_public === "false"
            ? false
            : undefined,
      search: req.query.search as string | undefined,
    };

    const settings = await settingsService.getSystemSettings(
      filters,
      req.user.role,
    );
    res.json(successResponse({ settings }));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode ?? 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Get single system setting
 * @param req
 * @param res
 */
export const getSystemSetting = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    const setting = await settingsService.getSystemSetting(
      req.params.key,
      req.user.role,
    );
    res.json(successResponse(setting));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode ?? 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Create or update system setting
 * @param req
 * @param res
 */
export const upsertSystemSetting = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    const bodyData = req.body as SystemSetting;
    const data: SettingData = {
      setting_key: req.params.key || bodyData.setting_key,
      setting_value: bodyData.setting_value,
      value_type: (bodyData.value_type as SettingType) ?? "string",
      category: (bodyData.category as SettingCategory) ?? "other",
      description: bodyData.description,
      is_public: bodyData.is_public,
    };

    await settingsService.upsertSystemSetting(
      data,
      req.user.id,
      req.user.tenant_id,
      req.user.role,
      req.ip,
      req.get("user-agent"),
    );

    res.json(successResponse(null));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode ?? 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Delete system setting
 * @param req
 * @param res
 */
export const deleteSystemSetting = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    await settingsService.deleteSystemSetting(
      req.params.key,
      req.user.id,
      req.user.tenant_id,
      req.user.role,
      req.ip,
      req.get("user-agent"),
    );

    res.json(successResponse(null));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode ?? 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

// ==================== TENANT SETTINGS ====================

/**
 * Get all tenant settings
 * @param req
 * @param res
 */
export const getTenantSettings = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    const filters = {
      category: req.query.category as string | undefined,
      search: req.query.search as string | undefined,
    };

    const settings = await settingsService.getTenantSettings(
      req.user.tenant_id,
      filters,
    );

    res.json(successResponse({ settings }));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode ?? 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Get single tenant setting
 * @param req
 * @param res
 */
export const getTenantSetting = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    const setting = await settingsService.getTenantSetting(
      req.params.key,
      req.user.tenant_id,
    );

    res.json(successResponse(setting));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode ?? 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Create or update tenant setting
 * @param req
 * @param res
 */
export const upsertTenantSetting = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    const bodyData = req.body as SystemSetting;
    const data: SettingData = {
      setting_key: req.params.key || bodyData.setting_key,
      setting_value: bodyData.setting_value,
      value_type: (bodyData.value_type as SettingType) ?? "string",
      category: (bodyData.category as SettingCategory) ?? "other",
      description: bodyData.description,
      is_public: bodyData.is_public,
    };

    await settingsService.upsertTenantSetting(
      data,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
      req.ip,
      req.get("user-agent"),
    );

    res.json(successResponse(null));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode ?? 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Delete tenant setting
 * @param req
 * @param res
 */
export const deleteTenantSetting = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    await settingsService.deleteTenantSetting(
      req.params.key,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
      req.ip,
      req.get("user-agent"),
    );

    res.json(successResponse(null));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode ?? 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

// ==================== USER SETTINGS ====================

/**
 * Get all user settings
 * @param req
 * @param res
 */
export const getUserSettings = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    const filters = {
      category: req.query.category as string | undefined,
      search: req.query.search as string | undefined,
    };

    const settings = await settingsService.getUserSettings(
      req.user.id,
      filters,
    );

    res.json(successResponse({ settings }));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode ?? 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Get single user setting
 * @param req
 * @param res
 */
export const getUserSetting = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    const setting = await settingsService.getUserSetting(
      req.params.key,
      req.user.id,
    );

    res.json(successResponse(setting));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode ?? 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Create or update user setting
 * @param req
 * @param res
 */
export const upsertUserSetting = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    const bodyData = req.body as UserSetting;
    const data: SettingData = {
      setting_key: req.params.key || bodyData.setting_key,
      setting_value: bodyData.setting_value,
      value_type: (bodyData.value_type as SettingType) ?? "string",
      category: (bodyData.category as SettingCategory) ?? "other",
      description: bodyData.description,
    };

    await settingsService.upsertUserSetting(
      data,
      req.user.id,
      req.ip,
      req.get("user-agent"),
    );

    res.json(successResponse(null));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode ?? 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Delete user setting
 * @param req
 * @param res
 */
export const deleteUserSetting = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    await settingsService.deleteUserSetting(req.params.key, req.user.id);

    res.json(successResponse(null));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode ?? 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

// ==================== ADMIN USER SETTINGS ====================

/**
 * Get another user's settings (admin only)
 * @param req
 * @param res
 */
export const getAdminUserSettings = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    const targetUserId = Number.parseInt(req.params.userId);
    const settings = await settingsService.getAdminUserSettings(
      targetUserId,
      req.user.tenant_id,
      req.user.role,
    );

    res.json(successResponse({ settings }));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode ?? 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

// ==================== COMMON ====================

/**
 * Get settings categories
 * @param _req
 * @param res
 */
export const getCategories = async (
  _req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const categories = await settingsService.getSettingsCategories();
    res.json(successResponse({ categories }));
  } catch {
    res
      .status(500)
      .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
  }
};

/**
 * Bulk update settings
 * @param req
 * @param res
 */
export const bulkUpdate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    const { type, settings } = req.body as BulkUpdateRequest;

    if (!["system", "tenant", "user"].includes(type)) {
      throw new ServiceError("VALIDATION_ERROR", "Invalid settings type");
    }

    if (!Array.isArray(settings) || settings.length === 0) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Settings must be a non-empty array",
      );
    }

    const contextId = type === "user" ? req.user.id : req.user.tenant_id;

    // Convert settings to SettingData format
    const settingsData: SettingData[] = settings.map((setting) => ({
      setting_key: setting.setting_key,
      setting_value: setting.setting_value,
      value_type: (setting.value_type as SettingType) ?? "string",
      category: (setting.category as SettingCategory) ?? "other",
      description: setting.description,
      is_public: setting.is_public,
    }));

    const results = await settingsService.bulkUpdateSettings(
      type as "system" | "tenant" | "user",
      settingsData,
      contextId,
      req.user.id,
      req.user.tenant_id,
      req.user.role,
      req.ip,
      req.get("user-agent"),
    );

    res.json(successResponse({ results }));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode ?? 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};
