/**
 * Areas Validation v2
 * Request validation rules for area endpoints
 */

import { body, param, query } from "express-validator";

export const getAreasValidation = [
  query("type")
    .optional()
    .isIn(["building", "warehouse", "office", "production", "outdoor", "other"])
    .withMessage("Invalid area type"),
  query("isActive")
    .optional()
    .isIn(["true", "false"])
    .withMessage("isActive must be true or false"),
  query("parentId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Parent ID must be a positive integer"),
  query("search")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search term too long"),
];

export const getAreaByIdValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Area ID must be a positive integer"),
];

export const createAreaValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ max: 255 })
    .withMessage("Name too long"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description too long"),
  body("type")
    .optional()
    .isIn(["building", "warehouse", "office", "production", "outdoor", "other"])
    .withMessage("Invalid area type"),
  body("capacity")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Capacity must be a non-negative integer"),
  body("parentId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Parent ID must be a positive integer"),
  body("address")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Address too long"),
];

export const updateAreaValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Area ID must be a positive integer"),
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Name cannot be empty")
    .isLength({ max: 255 })
    .withMessage("Name too long"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description too long"),
  body("type")
    .optional()
    .isIn(["building", "warehouse", "office", "production", "outdoor", "other"])
    .withMessage("Invalid area type"),
  body("capacity")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Capacity must be a non-negative integer"),
  body("parentId")
    .optional()
    .custom((value) => value === null || (Number.isInteger(value) && value > 0))
    .withMessage("Parent ID must be null or a positive integer"),
  body("address")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Address too long"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

export const deleteAreaValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Area ID must be a positive integer"),
];
