/**
 * Type-safe Validation Middleware
 * Provides request validation using express-validator with proper TypeScript types
 */

import {
  body,
  param,
  query,
  validationResult,
  ValidationChain,
} from "express-validator";
import { Request, Response, NextFunction } from "express";
import { ValidationMiddleware } from "../types/middleware.types";
import { errorResponse } from "../utils/apiResponse";

// Helper to handle validation results
export function handleValidationErrors(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Convert to API v2 format
    const details = errors.array().map((err) => ({
      field: err.type === "field" ? err.path : "unknown",
      message: err.msg,
    }));

    const response = errorResponse(
      "VALIDATION_ERROR",
      "Validation failed",
      details,
    );

    res.status(400).json(response);
    return;
  }

  next();
}

// Common validation rules
export const commonValidations = {
  // ID validations
  id: param("id").isInt().withMessage("ID must be an integer"),

  // Pagination
  pagination: [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("offset")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Offset must be non-negative"),
  ],

  // Email
  email: body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Invalid email address"),

  // Password
  password: body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    ),

  // Username
  username: body("username")
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[\w-]+$/)
    .withMessage(
      "Username can only contain letters, numbers, underscores, and hyphens",
    ),

  // Text fields
  requiredText: (field: string): ValidationChain =>
    body(field).notEmpty().trim().withMessage(`${field} is required`),

  optionalText: (field: string): ValidationChain =>
    body(field).optional().trim(),

  // Boolean
  boolean: (field: string): ValidationChain =>
    body(field)
      .optional()
      .isBoolean()
      .withMessage(`${field} must be a boolean`),

  // Date
  date: (field: string): ValidationChain =>
    body(field)
      .optional()
      .isISO8601()
      .withMessage(`${field} must be a valid date`),

  // Array
  array: (field: string): ValidationChain =>
    body(field).optional().isArray().withMessage(`${field} must be an array`),

  // Integer
  integer: (field: string, min?: number, max?: number): ValidationChain => {
    let validation = body(field).isInt();
    if (min !== undefined) validation = validation.isInt({ min });
    if (max !== undefined) validation = validation.isInt({ max });
    return validation.withMessage(
      `${field} must be an integer${min != null ? ` >= ${min}` : ""}${max != null ? ` <= ${max}` : ""}`,
    );
  },
};

// Validation schemas for different endpoints
export const validationSchemas = {
  // Auth validations
  login: [
    body("username").notEmpty().withMessage("Username is required"),
    body("password").notEmpty().withMessage("Password is required"),
    handleValidationErrors,
  ] as ValidationMiddleware,

  signup: [
    commonValidations.username,
    commonValidations.email,
    commonValidations.password,
    body("company_name")
      .notEmpty()
      .trim()
      .withMessage("Company name is required"),
    body("subdomain")
      .notEmpty()
      .matches(/^[-0-9a-z]+$/)
      .withMessage(
        "Subdomain can only contain lowercase letters, numbers, and hyphens",
      ),
    handleValidationErrors,
  ] as ValidationMiddleware,

  // User validations
  createUser: [
    commonValidations.username,
    commonValidations.email,
    commonValidations.password,
    body("role").isIn(["admin", "employee"]).withMessage("Invalid role"),
    body("first_name").optional().trim(),
    body("last_name").optional().trim(),
    body("department_id").optional().isInt(),
    body("position").optional().trim(),
    handleValidationErrors,
  ] as ValidationMiddleware,

  updateUser: [
    param("id").isInt(),
    body("email").optional().isEmail().normalizeEmail(),
    body("first_name").optional().trim(),
    body("last_name").optional().trim(),
    body("department_id").optional().isInt(),
    body("position").optional().trim(),
    body("status").optional().isIn(["active", "inactive"]),
    handleValidationErrors,
  ] as ValidationMiddleware,

  // Document validations
  uploadDocument: [
    body("category").notEmpty().withMessage("Category is required"),
    body("title").optional().trim(),
    body("description").optional().trim(),
    handleValidationErrors,
  ] as ValidationMiddleware,

  // Chat validations
  sendMessage: [
    param("id").isInt().withMessage("Conversation ID must be an integer"),
    body("content")
      .notEmpty()
      .trim()
      .withMessage("Message content is required"),
    body("attachment_ids").optional().isArray(),
    body("attachment_ids.*").optional().isInt(),
    handleValidationErrors,
  ] as ValidationMiddleware,

  createConversation: [
    body("participant_ids")
      .isArray({ min: 1 })
      .withMessage("At least one participant is required"),
    body("participant_ids.*")
      .isInt()
      .withMessage("Participant IDs must be integers"),
    body("is_group").optional().isBoolean(),
    body("name").optional().trim(),
    handleValidationErrors,
  ] as ValidationMiddleware,

  // Feature validations
  toggleFeature: [
    param("feature").notEmpty().withMessage("Feature name is required"),
    body("enabled").isBoolean().withMessage("Enabled must be a boolean"),
    handleValidationErrors,
  ] as ValidationMiddleware,

  // Survey validations
  createSurvey: [
    body("title").notEmpty().trim().withMessage("Title is required"),
    body("description").optional().trim(),
    body("questions")
      .isArray({ min: 1 })
      .withMessage("At least one question is required"),
    body("questions.*.text")
      .notEmpty()
      .withMessage("Question text is required"),
    body("questions.*.type")
      .isIn(["text", "multiple_choice", "rating", "yes_no"])
      .withMessage("Invalid question type"),
    body("questions.*.options").optional().isArray(),
    body("questions.*.required").optional().isBoolean(),
    body("expires_at").optional().isISO8601(),
    handleValidationErrors,
  ] as ValidationMiddleware,

  // Blackboard validations
  createBlackboardEntry: [
    body("title").notEmpty().trim().withMessage("Title is required"),
    body("content").notEmpty().trim().withMessage("Content is required"),
    body("priority").optional().isIn(["low", "medium", "high"]),
    body("expires_at").optional().isISO8601(),
    body("tags").optional().isArray(),
    body("tags.*").optional().isString().trim(),
    handleValidationErrors,
  ] as ValidationMiddleware,

  // Profile validations
  profileUpdate: [
    body("first_name").optional().trim(),
    body("last_name").optional().trim(),
    body("email").optional().isEmail().normalizeEmail(),
    body("phone").optional().trim(),
    body("department_id").optional().isInt(),
    body("position").optional().trim(),
    handleValidationErrors,
  ] as ValidationMiddleware,

  // Password change validation
  passwordChange: [
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters")
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage(
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      ),
    body("confirmPassword")
      .notEmpty()
      .withMessage("Password confirmation is required")
      .custom(
        (value, { req }) =>
          value === (req.body as { newPassword?: string }).newPassword,
      )
      .withMessage("Passwords do not match"),
    handleValidationErrors,
  ] as ValidationMiddleware,

  // Availability update validation
  availabilityUpdate: [
    body("monday_start")
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("Invalid time format"),
    body("monday_end")
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("Invalid time format"),
    body("tuesday_start")
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("Invalid time format"),
    body("tuesday_end")
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("Invalid time format"),
    body("wednesday_start")
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("Invalid time format"),
    body("wednesday_end")
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("Invalid time format"),
    body("thursday_start")
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("Invalid time format"),
    body("thursday_end")
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("Invalid time format"),
    body("friday_start")
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("Invalid time format"),
    body("friday_end")
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("Invalid time format"),
    body("saturday_start")
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("Invalid time format"),
    body("saturday_end")
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("Invalid time format"),
    body("sunday_start")
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("Invalid time format"),
    body("sunday_end")
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("Invalid time format"),
    handleValidationErrors,
  ] as ValidationMiddleware,
};

// Helper to create custom validation middleware
export function createValidation(
  validations: ValidationChain[],
): ValidationMiddleware {
  return [...validations, handleValidationErrors] as ValidationMiddleware;
}

// Helper to validate request against schema
export function validate(schema: ValidationMiddleware): ValidationMiddleware {
  return schema;
}

// Export validation result checker for custom use
export { validationResult } from "express-validator";

// Re-export common validators for use in routes
export { body, param, query } from "express-validator";

export default validationSchemas;
