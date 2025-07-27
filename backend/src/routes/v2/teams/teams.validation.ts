/**
 * Teams v2 Validation Rules
 * Input validation for team management endpoints
 */

import { body, param, query } from "express-validator";

import { handleValidationErrors } from "../../../middleware/validation.js";

export const teamsValidation = {
  /**
   * List teams validation
   */
  list: [
    query("departmentId")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Department ID must be a positive integer"),
    query("search")
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Search term must be 1-100 characters"),
    query("includeMembers")
      .optional()
      .isBoolean()
      .withMessage("includeMembers must be a boolean"),
    handleValidationErrors,
  ],

  /**
   * Get team by ID validation
   */
  getById: [
    param("id")
      .isInt({ min: 1 })
      .withMessage("Team ID must be a positive integer"),
    handleValidationErrors,
  ],

  /**
   * Create team validation
   */
  create: [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Team name is required")
      .isLength({ min: 2, max: 100 })
      .withMessage("Team name must be 2-100 characters"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description cannot exceed 500 characters"),
    body("departmentId")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Department ID must be a positive integer"),
    body("leaderId")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Leader ID must be a positive integer"),
    handleValidationErrors,
  ],

  /**
   * Update team validation
   */
  update: [
    param("id")
      .isInt({ min: 1 })
      .withMessage("Team ID must be a positive integer"),
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Team name cannot be empty")
      .isLength({ min: 2, max: 100 })
      .withMessage("Team name must be 2-100 characters"),
    body("description")
      .optional()
      .custom((value: unknown) => {
        if (value === null || value === undefined) return true;
        if (typeof value !== "string") return false;
        return value.length <= 500;
      })
      .withMessage(
        "Description must be null or a string with max 500 characters",
      ),
    body("departmentId")
      .optional()
      .custom(
        (value) => value === null || (Number.isInteger(value) && value >= 1),
      )
      .withMessage("Department ID must be null or a positive integer"),
    body("leaderId")
      .optional()
      .custom(
        (value) => value === null || (Number.isInteger(value) && value >= 1),
      )
      .withMessage("Leader ID must be null or a positive integer"),
    handleValidationErrors,
  ],

  /**
   * Delete team validation
   */
  delete: [
    param("id")
      .isInt({ min: 1 })
      .withMessage("Team ID must be a positive integer"),
    handleValidationErrors,
  ],

  /**
   * Get team members validation
   */
  getMembers: [
    param("id")
      .isInt({ min: 1 })
      .withMessage("Team ID must be a positive integer"),
    handleValidationErrors,
  ],

  /**
   * Add team member validation
   */
  addMember: [
    param("id")
      .isInt({ min: 1 })
      .withMessage("Team ID must be a positive integer"),
    body("userId")
      .notEmpty()
      .withMessage("User ID is required")
      .isInt({ min: 1 })
      .withMessage("User ID must be a positive integer"),
    handleValidationErrors,
  ],

  /**
   * Remove team member validation
   */
  removeMember: [
    param("id")
      .isInt({ min: 1 })
      .withMessage("Team ID must be a positive integer"),
    param("userId")
      .isInt({ min: 1 })
      .withMessage("User ID must be a positive integer"),
    handleValidationErrors,
  ],
};
