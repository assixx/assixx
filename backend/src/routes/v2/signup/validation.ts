/**
 * Signup API v2 Validation Rules
 * Express-validator rules for request validation
 */

import { body, param } from "express-validator";

export const signupValidation = [
  body("companyName")
    .notEmpty()
    .trim()
    .withMessage("Company name is required")
    .isLength({ max: 255 })
    .withMessage("Company name must be at most 255 characters"),
  body("subdomain")
    .notEmpty()
    .trim()
    .matches(/^[a-z0-9-]+$/)
    .withMessage(
      "Subdomain can only contain lowercase letters, numbers, and hyphens",
    )
    .isLength({ min: 3, max: 63 })
    .withMessage("Subdomain must be between 3 and 63 characters"),
  body("email").isEmail().normalizeEmail().withMessage("Invalid email address"),
  body("phone")
    .notEmpty()
    .trim()
    .matches(/^\+[0-9]{7,29}$/)
    .withMessage(
      "Phone must start with + and contain 7-29 digits (e.g. +491234567890)",
    ),
  body("address")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Address must be at most 500 characters"),
  body("adminEmail")
    .isEmail()
    .normalizeEmail()
    .withMessage("Invalid admin email address"),
  body("adminPassword")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    ),
  body("adminFirstName")
    .notEmpty()
    .trim()
    .withMessage("Admin first name is required")
    .isLength({ max: 100 })
    .withMessage("First name must be at most 100 characters"),
  body("adminLastName")
    .notEmpty()
    .trim()
    .withMessage("Admin last name is required")
    .isLength({ max: 100 })
    .withMessage("Last name must be at most 100 characters"),
  body("plan")
    .optional()
    .isIn(["basic", "professional", "enterprise"])
    .withMessage("Invalid plan selected"),
];

export const checkSubdomainValidation = [
  param("subdomain")
    .notEmpty()
    .trim()
    .matches(/^[a-z0-9-]+$/)
    .withMessage("Invalid subdomain format")
    .isLength({ min: 3, max: 63 })
    .withMessage("Subdomain must be between 3 and 63 characters"),
];
