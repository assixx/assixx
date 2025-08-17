/**
 * Notifications v2 Controller
 * Handles HTTP requests for notification management
 */

import { Response } from "express";

import type { AuthenticatedRequest } from "../../../types/request.types.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { ServiceError } from "../../../utils/ServiceError.js";

import * as notificationsService from "./notifications.service.js";
import { NotificationData, NotificationPreferences } from "./types.js";

/**
 * @param req
 * @param res
 * @swagger
 * /api/v2/notifications:
 *   get:
 *     summary: List notifications for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [email, push, in_app]
 *         description: Filter by notification type
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *         description: Filter by priority
 *       - in: query
 *         name: unread
 *         schema:
 *           type: boolean
 *         description: Filter unread notifications only
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of notifications
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationListResponse'
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
      page: req.query.page ? Number.parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? Number.parseInt(req.query.limit as string) : 20,
    };

    const result = await notificationsService.listNotifications(
      req.user.id,
      req.user.tenant_id,
      filters,
    );

    res.json(successResponse(result));
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
 * @param req
 * @param res
 * @swagger
 * /api/v2/notifications:
 *   post:
 *     summary: Create a new notification (admin only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateNotificationRequest'
 *     responses:
 *       201:
 *         description: Notification created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationResponse'
 *       403:
 *         description: Forbidden - Admin only
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
 * @param req
 * @param res
 * @swagger
 * /api/v2/notifications/{id}/read:
 *   put:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 */
export const markAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    const notificationId = Number.parseInt(req.params.id);
    await notificationsService.markAsRead(
      notificationId,
      req.user.id,
      req.user.tenant_id,
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
 * @param req
 * @param res
 * @swagger
 * /api/v2/notifications/mark-all-read:
 *   put:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     updated:
 *                       type: integer
 *                       description: Number of notifications marked as read
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
 * @param req
 * @param res
 * @swagger
 * /api/v2/notifications/{id}:
 *   delete:
 *     summary: Delete notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 *       404:
 *         description: Notification not found
 */
export const deleteNotification = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    const notificationId = Number.parseInt(req.params.id);
    await notificationsService.deleteNotification(
      notificationId,
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
 * @param req
 * @param res
 * @swagger
 * /api/v2/notifications/preferences:
 *   get:
 *     summary: Get notification preferences for authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User notification preferences
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationPreferencesResponse'
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
 * @param req
 * @param res
 * @swagger
 * /api/v2/notifications/preferences:
 *   put:
 *     summary: Update notification preferences
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePreferencesRequest'
 *     responses:
 *       200:
 *         description: Preferences updated successfully
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
 * @param req
 * @param res
 * @swagger
 * /api/v2/notifications/stats:
 *   get:
 *     summary: Get notification statistics (admin only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationStatsResponse'
 *       403:
 *         description: Forbidden - Admin only
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
 * @param req
 * @param res
 * @swagger
 * /api/v2/notifications/stats/me:
 *   get:
 *     summary: Get personal notification statistics
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Personal notification statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PersonalStatsResponse'
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
 * @param req
 * @param res
 * @swagger
 * /api/v2/notifications/subscribe:
 *   post:
 *     summary: Subscribe to push notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubscribeRequest'
 *     responses:
 *       200:
 *         description: Successfully subscribed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     subscriptionId:
 *                       type: string
 */
export const subscribe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }

    // TODO: Implement push notification subscription
    // For now, return a mock subscription ID
    const subscriptionId = `sub_${String(Date.now())}_${String(Math.random().toString(36).substr(2, 9))}`;

    res.json(
      successResponse(
        { subscriptionId },
        "Successfully subscribed to notifications",
      ),
    );
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
 * @param req
 * @param res
 * @swagger
 * /api/v2/notifications/subscribe/{id}:
 *   delete:
 *     summary: Unsubscribe from push notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID
 *     responses:
 *       200:
 *         description: Successfully unsubscribed
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
 * @param req
 * @param res
 * @swagger
 * /api/v2/notifications/templates:
 *   get:
 *     summary: Get notification templates (admin only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notification templates
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplatesResponse'
 *       403:
 *         description: Forbidden - Admin only
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
 * @param req
 * @param res
 * @swagger
 * /api/v2/notifications/from-template:
 *   post:
 *     summary: Create notification from template (admin only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateFromTemplateRequest'
 *     responses:
 *       201:
 *         description: Notification created from template
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationResponse'
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Template not found
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
