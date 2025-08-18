/**
 * Shifts API v2 Validation Rules
 * Input validation for all shift-related endpoints
 */

import { body, param, query } from "express-validator";
import { handleValidationErrors } from "../../../middleware/validation";

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
    query("userId").optional().isInt({ min: 1 }).withMessage("Invalid user ID"),
    query("departmentId")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Invalid department ID"),
    query("teamId").optional().isInt({ min: 1 }).withMessage("Invalid team ID"),
    query("status")
      .optional()
      .isIn(["planned", "confirmed", "in_progress", "completed", "cancelled"])
      .withMessage("Invalid status"),
    query("type")
      .optional()
      .isIn(["regular", "overtime", "standby", "vacation", "sick", "holiday"])
      .withMessage("Invalid type"),
    query("templateId")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Invalid template ID"),
    query("planId").optional().isInt({ min: 1 }).withMessage("Invalid plan ID"),
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
    param("id")
      .isInt({ min: 1 })
      .withMessage("Shift ID must be a positive integer"),
    handleValidationErrors,
  ],

  createShift: [
    body("userId").isInt({ min: 1 }).withMessage("User ID is required"),
    body("date").isISO8601().withMessage("Date is required in ISO8601 format"),
    body("startTime")
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage("Start time must be in HH:MM format"),
    body("endTime")
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage("End time must be in HH:MM format"),
    body("departmentId")
      .isInt({ min: 1 })
      .withMessage("Department ID is required"),
    body("planId").optional().isInt({ min: 1 }).withMessage("Invalid plan ID"),
    body("templateId")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Invalid template ID"),
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
      .withMessage("Break minutes must be a non-negative integer"),
    body("status")
      .optional()
      .isIn(["planned", "confirmed", "in_progress", "completed", "cancelled"])
      .withMessage("Invalid status"),
    body("type")
      .optional()
      .isIn(["regular", "overtime", "standby", "vacation", "sick", "holiday"])
      .withMessage("Invalid type"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Notes cannot exceed 1000 characters"),
    body("teamId").optional().isInt({ min: 1 }).withMessage("Invalid team ID"),
    handleValidationErrors,
  ],

  updateShift: [
    param("id")
      .isInt({ min: 1 })
      .withMessage("Shift ID must be a positive integer"),
    body("userId").optional().isInt({ min: 1 }).withMessage("Invalid user ID"),
    body("date").optional().isISO8601().withMessage("Invalid date format"),
    body("startTime")
      .optional()
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage("Start time must be in HH:MM format"),
    body("endTime")
      .optional()
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage("End time must be in HH:MM format"),
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
      .withMessage("Invalid department ID"),
    body("planId").optional().isInt({ min: 1 }).withMessage("Invalid plan ID"),
    body("templateId")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Invalid template ID"),
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
      .withMessage("Break minutes must be a non-negative integer"),
    body("status")
      .optional()
      .isIn(["planned", "confirmed", "in_progress", "completed", "cancelled"])
      .withMessage("Invalid status"),
    body("type")
      .optional()
      .isIn(["regular", "overtime", "standby", "vacation", "sick", "holiday"])
      .withMessage("Invalid type"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Notes cannot exceed 1000 characters"),
    body("teamId").optional().isInt({ min: 1 }).withMessage("Invalid team ID"),
    handleValidationErrors,
  ],

  deleteShift: [
    param("id")
      .isInt({ min: 1 })
      .withMessage("Shift ID must be a positive integer"),
    handleValidationErrors,
  ],

  // ============= TEMPLATES =============

  getTemplateById: [
    param("id")
      .isInt({ min: 1 })
      .withMessage("Template ID must be a positive integer"),
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
      .withMessage("Start time must be in HH:MM format"),
    body("endTime")
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage("End time must be in HH:MM format"),
    body("breakMinutes")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Break minutes must be a non-negative integer"),
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
    param("id")
      .isInt({ min: 1 })
      .withMessage("Template ID must be a positive integer"),
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
      .withMessage("Start time must be in HH:MM format"),
    body("endTime")
      .optional()
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage("End time must be in HH:MM format"),
    body("breakMinutes")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Break minutes must be a non-negative integer"),
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
    param("id")
      .isInt({ min: 1 })
      .withMessage("Template ID must be a positive integer"),
    handleValidationErrors,
  ],

  // ============= SWAP REQUESTS =============

  listSwapRequests: [
    query("userId").optional().isInt({ min: 1 }).withMessage("Invalid user ID"),
    query("status")
      .optional()
      .isIn(["pending", "approved", "rejected", "cancelled"])
      .withMessage("Invalid status"),
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
    query("userId").optional().isInt({ min: 1 }).withMessage("Invalid user ID"),
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
      .withMessage("Invalid department ID"),
    query("teamId").optional().isInt({ min: 1 }).withMessage("Invalid team ID"),
    query("userId").optional().isInt({ min: 1 }).withMessage("Invalid user ID"),
    query("format")
      .optional()
      .isIn(["csv", "excel"])
      .withMessage("Format must be csv or excel"),
    handleValidationErrors,
  ],
};
