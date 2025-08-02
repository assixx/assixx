/**
 * Auth Validation v2
 * Input validation for authentication endpoints
 */

import { body, ValidationChain } from "express-validator";

export const authValidation = {
  /**
   * Login validation
   */
  login: [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email address"),
    body("password")
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),
  ] as ValidationChain[],

  /**
   * Register validation
   */
  register: [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email address"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long")
      .matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      )
      .withMessage(
        "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character",
      ),
    body("firstName")
      .trim()
      .notEmpty()
      .withMessage("First name is required")
      .isLength({ min: 2, max: 50 })
      .withMessage("First name must be between 2 and 50 characters"),
    body("lastName")
      .trim()
      .notEmpty()
      .withMessage("Last name is required")
      .isLength({ min: 2, max: 50 })
      .withMessage("Last name must be between 2 and 50 characters"),
    body("role")
      .optional()
      .isIn(["employee", "admin"])
      .withMessage("Role must be either employee or admin"),
  ] as ValidationChain[],

  /**
   * Refresh token validation
   */
  refresh: [
    body("refreshToken")
      .notEmpty()
      .withMessage("Refresh token is required")
      .isString()
      .withMessage("Refresh token must be a string"),
  ] as ValidationChain[],
};
