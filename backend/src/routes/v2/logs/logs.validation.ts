import { body, query } from "express-validator";
import { handleValidationErrors } from "../../../middleware/validation.js";

export const logsValidation = {
  // List logs validation
  listLogs: [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("offset")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Offset must be a non-negative integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("userId")
      .optional()
      .isInt({ min: 1 })
      .withMessage("User ID must be a positive integer"),
    query("tenantId")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Tenant ID must be a positive integer"),
    query("action")
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Action must be a non-empty string"),
    query("entityType")
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Entity type must be a non-empty string"),
    query("startDate")
      .optional()
      .isISO8601()
      .withMessage("Start date must be a valid ISO date"),
    query("endDate")
      .optional()
      .isISO8601()
      .withMessage("End date must be a valid ISO date"),
    query("search")
      .optional()
      .isString()
      .trim()
      .withMessage("Search must be a string"),
    handleValidationErrors,
  ],

  // Delete logs validation
  deleteLogs: [
    body("userId")
      .optional()
      .isInt({ min: 1 })
      .withMessage("User ID must be a positive integer"),
    body("tenantId")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Tenant ID must be a positive integer"),
    body("action")
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Action must be a non-empty string"),
    body("entityType")
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Entity type must be a non-empty string"),
    body("olderThanDays")
      .optional()
      .isInt({ min: 0 }) // 0 means delete all logs (no age filter)
      .withMessage("Days must be a non-negative integer"),
    body("confirmPassword")
      .notEmpty()
      .withMessage("Password confirmation is required for log deletion"),
    handleValidationErrors,
  ],
};
