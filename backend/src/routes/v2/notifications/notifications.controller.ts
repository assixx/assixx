/**
 * Notifications v2 Controller
 * Handles HTTP requests for notification management
 */

import { Response } from "express";

import { AuthenticatedRequest } from "../../../types/request.types.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { ServiceError } from "../../../utils/ServiceError.js";

import * as notificationsService from "./notifications.service.js";
import { NotificationData, NotificationPreferences } from "./types.js";

/**
 * List notifications for the authenticated user
 */
export const listNotifications = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    const filters = {
      type: req.query.type as string | undefined,
      priority: req.query.priority as string | undefined,
      unread: req.query.unread === "true",
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    const result = await notificationsService.listNotifications(
      req.user.id,
      req.user.tenant_id,
      filters,
    );

    res.json(successResponse(result));
  } catch (error) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode || 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Create a new notification (admin only)
 */
export const createNotification = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    // Check admin permission
    if (req.user.role !== "admin" && req.user.role !== "root") {
      throw new ServiceError(
        "FORBIDDEN",
        "Only admins can create notifications",
        403,
      );
    }

    const result = await notificationsService.createNotification(
      req.body as NotificationData,
      req.user.id,
      req.user.tenant_id,
      req.ip,
      req.get("user-agent"),
    );

    res.status(201).json(successResponse(result));
  } catch (error) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode || 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Mark notification as read
 */
export const markAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    const notificationId = parseInt(req.params.id);
    await notificationsService.markAsRead(
      notificationId,
      req.user.id,
      req.user.tenant_id,
    );

    res.json(successResponse(null));
  } catch (error) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode || 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    const result = await notificationsService.markAllAsRead(
      req.user.id,
      req.user.tenant_id,
    );

    res.json(successResponse(result));
  } catch (error) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode || 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Delete notification
 */
export const deleteNotification = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    const notificationId = parseInt(req.params.id);
    await notificationsService.deleteNotification(
      notificationId,
      req.user.id,
      req.user.tenant_id,
      req.user.role,
      req.ip,
      req.get("user-agent"),
    );

    res.json(successResponse(null));
  } catch (error) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode || 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Get notification preferences
 */
export const getPreferences = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    const preferences = await notificationsService.getPreferences(
      req.user.id,
      req.user.tenant_id,
    );

    res.json(successResponse({ preferences }));
  } catch (error) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode || 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Update notification preferences
 */
export const updatePreferences = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    await notificationsService.updatePreferences(
      req.user.id,
      req.user.tenant_id,
      req.body as NotificationPreferences,
      req.ip,
      req.get("user-agent"),
    );

    res.json(successResponse(null));
  } catch (error) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode || 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Get notification statistics (admin only)
 */
export const getStatistics = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    // Check admin permission
    if (req.user.role !== "admin" && req.user.role !== "root") {
      throw new ServiceError(
        "FORBIDDEN",
        "Only admins can view statistics",
        403,
      );
    }

    const stats = await notificationsService.getStatistics(req.user.tenant_id);

    res.json(successResponse(stats));
  } catch (error) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode || 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Get personal notification statistics
 */
export const getPersonalStats = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    const stats = await notificationsService.getPersonalStats(
      req.user.id,
      req.user.tenant_id,
    );

    res.json(successResponse(stats));
  } catch (error) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode || 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Subscribe to push notifications (placeholder)
 */
export const subscribe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    // TODO: Implement push notification subscription
    // For now, return a mock subscription ID
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    res.json(
      successResponse(
        { subscriptionId },
        "Successfully subscribed to notifications",
      ),
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode || 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Unsubscribe from push notifications (placeholder)
 */
export const unsubscribe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    // TODO: Implement push notification unsubscription
    res.json(
      successResponse(null, "Successfully unsubscribed from notifications"),
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode || 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Get notification templates (admin only)
 */
export const getTemplates = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    // Check admin permission
    if (req.user.role !== "admin" && req.user.role !== "root") {
      throw new ServiceError(
        "FORBIDDEN",
        "Only admins can view templates",
        403,
      );
    }

    // TODO: Implement template management
    // For now, return empty array
    res.json(successResponse({ templates: [] }));
  } catch (error) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode || 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Create notification from template (admin only)
 */
export const createFromTemplate = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    // Check admin permission
    if (req.user.role !== "admin" && req.user.role !== "root") {
      throw new ServiceError(
        "FORBIDDEN",
        "Only admins can create notifications",
        403,
      );
    }

    // TODO: Implement template-based notification creation
    // For now, return not found
    throw new ServiceError("NOT_FOUND", "Template not found", 404);
  } catch (error) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode || 500)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};
