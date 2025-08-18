/**
 * Notifications v2 Validation
 * Input validation for notification endpoints
 */

import { body, param, query } from "express-validator";

import { handleValidationErrors as handleValidation } from "../../../middleware/validation.js";

/**
 * List notifications validation
 */
export const listNotifications = [
  query("type")
    .optional()
    .isIn(["system", "task", "message", "announcement", "reminder"])
    .withMessage("Invalid notification type"),
  query("priority")
    .optional()
    .isIn(["low", "normal", "medium", "high", "urgent"])
    .withMessage("Invalid priority"),
  query("unread")
    .optional()
    .isBoolean()
    .withMessage("Unread must be a boolean"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  handleValidation,
];

/**
 * Create notification validation
 */
export const createNotification = [
  body("type")
    .trim()
    .notEmpty()
    .withMessage("Type is required")
    .isIn(["system", "task", "message", "announcement", "reminder"])
    .withMessage("Invalid notification type"),
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 1, max: 255 })
    .withMessage("Title must be between 1 and 255 characters"),
  body("message").trim().notEmpty().withMessage("Message is required"),
  body("priority")
    .optional()
    .isIn(["low", "normal", "medium", "high", "urgent"])
    .withMessage("Invalid priority"),
  body("recipient_type")
    .notEmpty()
    .withMessage("Recipient type is required")
    .isIn(["user", "department", "team", "all"])
    .withMessage("Invalid recipient type"),
  body("recipient_id")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Recipient ID must be a positive integer")
    .custom((value, { req }) => {
      // recipient_id is required for specific recipient types
      if (req.body.recipient_type !== "all" && !value) {
        throw new Error("Recipient ID is required for this recipient type");
      }
      return true;
    }),
  body("action_url")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Action URL cannot exceed 500 characters"),
  body("action_label")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Action label cannot exceed 100 characters"),
  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),
  body("scheduled_for")
    .optional()
    .isISO8601()
    .withMessage("Scheduled for must be a valid date"),
  handleValidation,
];

/**
 * Mark as read validation
 */
export const markAsRead = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Notification ID must be a positive integer"),
  handleValidation,
];

/**
 * Delete notification validation
 */
export const deleteNotification = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Notification ID must be a positive integer"),
  handleValidation,
];

/**
 * Update preferences validation
 */
export const updatePreferences = [
  body("email_notifications")
    .optional()
    .isBoolean()
    .withMessage("Email notifications must be a boolean"),
  body("push_notifications")
    .optional()
    .isBoolean()
    .withMessage("Push notifications must be a boolean"),
  body("sms_notifications")
    .optional()
    .isBoolean()
    .withMessage("SMS notifications must be a boolean"),
  body("notification_types")
    .optional()
    .isObject()
    .withMessage("Notification types must be an object")
    .custom((value) => {
      // Validate structure of notification_types
      const validTypes = ["system", "task", "message", "announcement"];
      const validChannels = ["email", "push", "sms"];

      for (const [type, settings] of Object.entries(value)) {
        if (!validTypes.includes(type)) {
          throw new Error(`Invalid notification type: ${type}`);
        }
        if (typeof settings !== "object") {
          throw new Error(`Settings for ${type} must be an object`);
        }
        for (const [channel, enabled] of Object.entries(
          settings as Record<string, boolean>,
        )) {
          if (!validChannels.includes(channel)) {
            throw new Error(`Invalid channel: ${channel}`);
          }
          if (typeof enabled !== "boolean") {
            throw new Error(`${channel} setting must be a boolean`);
          }
        }
      }
      return true;
    }),
  handleValidation,
];

/**
 * Subscribe validation
 */
export const subscribe = [
  body("deviceToken").trim().notEmpty().withMessage("Device token is required"),
  body("platform")
    .trim()
    .notEmpty()
    .withMessage("Platform is required")
    .isIn(["web", "ios", "android"])
    .withMessage("Invalid platform"),
  handleValidation,
];

/**
 * Unsubscribe validation
 */
export const unsubscribe = [
  param("id").notEmpty().withMessage("Subscription ID is required"),
  handleValidation,
];

/**
 * Create from template validation
 */
export const createFromTemplate = [
  body("templateId").trim().notEmpty().withMessage("Template ID is required"),
  body("variables")
    .optional()
    .isObject()
    .withMessage("Variables must be an object"),
  body("recipient_type")
    .notEmpty()
    .withMessage("Recipient type is required")
    .isIn(["user", "department", "team", "all"])
    .withMessage("Invalid recipient type"),
  body("recipient_id")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Recipient ID must be a positive integer"),
  handleValidation,
];
