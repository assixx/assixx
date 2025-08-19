/**
 * Shifts API v2 Validation Rules
 * Input validation for all shift-related endpoints
 */

import { body, param, query } from "express-validator";

import { handleValidationErrors } from "../../../middleware/validation";

// Validation Messages
const MESSAGES = {
  INVALID_USER_ID: "Invalid user ID",
  INVALID_DEPARTMENT_ID: "Invalid department ID",
  INVALID_TEAM_ID: "Invalid team ID",
  INVALID_STATUS: "Invalid status",
  INVALID_TYPE: "Invalid type",
  INVALID_TEMPLATE_ID: "Invalid template ID",
  INVALID_PLAN_ID: "Invalid plan ID",
  SHIFT_ID_POSITIVE: "Shift ID must be a positive integer",
  START_TIME_FORMAT: "Start time must be in HH:MM format",
  END_TIME_FORMAT: "End time must be in HH:MM format",
  DEPARTMENT_ID_REQUIRED: "Department ID is required",
  NOTES_TOO_LONG: "Notes cannot exceed 1000 characters",
  BREAK_MINUTES_NON_NEGATIVE: "Break minutes must be a non-negative integer",
  TEMPLATE_ID_POSITIVE: "Template ID must be a positive integer",
} as const;

export const shiftsValidation = {
  // ============= SHIFTS CRUD =============

  listShifts: [
    query("date").optional().isISO8601().withMessage("Invalid date format"),
    query("startDate")
      .optional()
      .isISO8601()
      .withMessage("Invalid start date format"),
    query("endDate")
      .optional()
      .isISO8601()
      .withMessage("Invalid end date format"),
    query("userId")
      .optional()
      .isInt({ min: 1 })
      .withMessage(MESSAGES.INVALID_USER_ID),
    query("departmentId")
      .optional()
      .isInt({ min: 1 })
      .withMessage(MESSAGES.INVALID_DEPARTMENT_ID),
    query("teamId")
      .optional()
      .isInt({ min: 1 })
      .withMessage(MESSAGES.INVALID_TEAM_ID),
    query("status")
      .optional()
      .isIn(["planned", "confirmed", "in_progress", "completed", "cancelled"])
      .withMessage(MESSAGES.INVALID_STATUS),
    query("type")
      .optional()
      .isIn(["regular", "overtime", "standby", "vacation", "sick", "holiday"])
      .withMessage(MESSAGES.INVALID_TYPE),
    query("templateId")
      .optional()
      .isInt({ min: 1 })
      .withMessage(MESSAGES.INVALID_TEMPLATE_ID),
    query("planId")
      .optional()
      .isInt({ min: 1 })
      .withMessage(MESSAGES.INVALID_PLAN_ID),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("sortBy")
      .optional()
      .isIn(["date", "startTime", "endTime", "userId", "status", "type"])
      .withMessage("Invalid sort field"),
    query("sortOrder")
      .optional()
      .isIn(["asc", "desc"])
      .withMessage("Sort order must be asc or desc"),
    handleValidationErrors,
  ],

  getShiftById: [
    param("id").isInt({ min: 1 }).withMessage(MESSAGES.SHIFT_ID_POSITIVE),
    handleValidationErrors,
  ],

  createShift: [
    body("userId").isInt({ min: 1 }).withMessage("User ID is required"),
    body("date").isISO8601().withMessage("Date is required in ISO8601 format"),
    body("startTime")
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage(MESSAGES.START_TIME_FORMAT),
    body("endTime")
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage(MESSAGES.END_TIME_FORMAT),
    body("departmentId")
      .isInt({ min: 1 })
      .withMessage(MESSAGES.DEPARTMENT_ID_REQUIRED),
    body("planId")
      .optional()
      .isInt({ min: 1 })
      .withMessage(MESSAGES.INVALID_PLAN_ID),
    body("templateId")
      .optional()
      .isInt({ min: 1 })
      .withMessage(MESSAGES.INVALID_TEMPLATE_ID),
    body("title")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Title cannot exceed 200 characters"),
    body("requiredEmployees")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Required employees must be a positive integer"),
    body("breakMinutes")
      .optional()
      .isInt({ min: 0 })
      .withMessage(MESSAGES.BREAK_MINUTES_NON_NEGATIVE),
    body("status")
      .optional()
      .isIn(["planned", "confirmed", "in_progress", "completed", "cancelled"])
      .withMessage(MESSAGES.INVALID_STATUS),
    body("type")
      .optional()
      .isIn(["regular", "overtime", "standby", "vacation", "sick", "holiday"])
      .withMessage(MESSAGES.INVALID_TYPE),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage(MESSAGES.NOTES_TOO_LONG),
    body("teamId")
      .optional()
      .isInt({ min: 1 })
      .withMessage(MESSAGES.INVALID_TEAM_ID),
    handleValidationErrors,
  ],

  updateShift: [
    param("id").isInt({ min: 1 }).withMessage(MESSAGES.SHIFT_ID_POSITIVE),
    body("userId")
      .optional()
      .isInt({ min: 1 })
      .withMessage(MESSAGES.INVALID_USER_ID),
    body("date").optional().isISO8601().withMessage("Invalid date format"),
    body("startTime")
      .optional()
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage(MESSAGES.START_TIME_FORMAT),
    body("endTime")
      .optional()
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage(MESSAGES.END_TIME_FORMAT),
    body("actualStart")
      .optional()
      .matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
      .withMessage("Actual start must be in HH:MM:SS format"),
    body("actualEnd")
      .optional()
      .matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
      .withMessage("Actual end must be in HH:MM:SS format"),
    body("departmentId")
      .optional()
      .isInt({ min: 1 })
      .withMessage(MESSAGES.INVALID_DEPARTMENT_ID),
    body("planId")
      .optional()
      .isInt({ min: 1 })
      .withMessage(MESSAGES.INVALID_PLAN_ID),
    body("templateId")
      .optional()
      .isInt({ min: 1 })
      .withMessage(MESSAGES.INVALID_TEMPLATE_ID),
    body("title")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Title cannot exceed 200 characters"),
    body("requiredEmployees")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Required employees must be a positive integer"),
    body("breakMinutes")
      .optional()
      .isInt({ min: 0 })
      .withMessage(MESSAGES.BREAK_MINUTES_NON_NEGATIVE),
    body("status")
      .optional()
      .isIn(["planned", "confirmed", "in_progress", "completed", "cancelled"])
      .withMessage(MESSAGES.INVALID_STATUS),
    body("type")
      .optional()
      .isIn(["regular", "overtime", "standby", "vacation", "sick", "holiday"])
      .withMessage(MESSAGES.INVALID_TYPE),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage(MESSAGES.NOTES_TOO_LONG),
    body("teamId")
      .optional()
      .isInt({ min: 1 })
      .withMessage(MESSAGES.INVALID_TEAM_ID),
    handleValidationErrors,
  ],

  deleteShift: [
    param("id").isInt({ min: 1 }).withMessage(MESSAGES.SHIFT_ID_POSITIVE),
    handleValidationErrors,
  ],

  // ============= TEMPLATES =============

  getTemplateById: [
    param("id").isInt({ min: 1 }).withMessage(MESSAGES.TEMPLATE_ID_POSITIVE),
    handleValidationErrors,
  ],

  createTemplate: [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Template name is required")
      .isLength({ max: 100 })
      .withMessage("Name cannot exceed 100 characters"),
    body("startTime")
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage(MESSAGES.START_TIME_FORMAT),
    body("endTime")
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage(MESSAGES.END_TIME_FORMAT),
    body("breakMinutes")
      .optional()
      .isInt({ min: 0 })
      .withMessage(MESSAGES.BREAK_MINUTES_NON_NEGATIVE),
    body("color")
      .optional()
      .matches(/^#[0-9A-Fa-f]{6}$/)
      .withMessage("Color must be a valid hex color (e.g., #3498db)"),
    body("isNightShift")
      .optional()
      .isBoolean()
      .withMessage("Night shift flag must be a boolean"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("Active flag must be a boolean"),
    handleValidationErrors,
  ],

  updateTemplate: [
    param("id").isInt({ min: 1 }).withMessage(MESSAGES.TEMPLATE_ID_POSITIVE),
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Template name cannot be empty")
      .isLength({ max: 100 })
      .withMessage("Name cannot exceed 100 characters"),
    body("startTime")
      .optional()
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage(MESSAGES.START_TIME_FORMAT),
    body("endTime")
      .optional()
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage(MESSAGES.END_TIME_FORMAT),
    body("breakMinutes")
      .optional()
      .isInt({ min: 0 })
      .withMessage(MESSAGES.BREAK_MINUTES_NON_NEGATIVE),
    body("color")
      .optional()
      .matches(/^#[0-9A-Fa-f]{6}$/)
      .withMessage("Color must be a valid hex color (e.g., #3498db)"),
    body("isNightShift")
      .optional()
      .isBoolean()
      .withMessage("Night shift flag must be a boolean"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("Active flag must be a boolean"),
    handleValidationErrors,
  ],

  deleteTemplate: [
    param("id").isInt({ min: 1 }).withMessage(MESSAGES.TEMPLATE_ID_POSITIVE),
    handleValidationErrors,
  ],

  // ============= SWAP REQUESTS =============

  listSwapRequests: [
    query("userId")
      .optional()
      .isInt({ min: 1 })
      .withMessage(MESSAGES.INVALID_USER_ID),
    query("status")
      .optional()
      .isIn(["pending", "approved", "rejected", "cancelled"])
      .withMessage(MESSAGES.INVALID_STATUS),
    handleValidationErrors,
  ],

  createSwapRequest: [
    body("shiftId").isInt({ min: 1 }).withMessage("Shift ID is required"),
    body("requestedWithUserId")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Requested with user ID must be a positive integer"),
    body("reason")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Reason cannot exceed 500 characters"),
    handleValidationErrors,
  ],

  updateSwapRequestStatus: [
    param("id")
      .isInt({ min: 1 })
      .withMessage("Swap request ID must be a positive integer"),
    body("status")
      .isIn(["approved", "rejected", "cancelled"])
      .withMessage("Status must be approved, rejected, or cancelled"),
    handleValidationErrors,
  ],

  // ============= OVERTIME =============

  getOvertimeReport: [
    query("userId")
      .optional()
      .isInt({ min: 1 })
      .withMessage(MESSAGES.INVALID_USER_ID),
    query("startDate")
      .notEmpty()
      .isISO8601()
      .withMessage("Start date is required in ISO8601 format"),
    query("endDate")
      .notEmpty()
      .isISO8601()
      .withMessage("End date is required in ISO8601 format"),
    handleValidationErrors,
  ],

  // ============= EXPORT =============

  exportShifts: [
    query("startDate")
      .notEmpty()
      .isISO8601()
      .withMessage("Start date is required in ISO8601 format"),
    query("endDate")
      .notEmpty()
      .isISO8601()
      .withMessage("End date is required in ISO8601 format"),
    query("departmentId")
      .optional()
      .isInt({ min: 1 })
      .withMessage(MESSAGES.INVALID_DEPARTMENT_ID),
    query("teamId")
      .optional()
      .isInt({ min: 1 })
      .withMessage(MESSAGES.INVALID_TEAM_ID),
    query("userId")
      .optional()
      .isInt({ min: 1 })
      .withMessage(MESSAGES.INVALID_USER_ID),
    query("format")
      .optional()
      .isIn(["csv", "excel"])
      .withMessage("Format must be csv or excel"),
    handleValidationErrors,
  ],
};
