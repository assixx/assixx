/**
 * Roles API v2 Validation Rules
 * Express-validator rules for request validation
 */

import { param, body } from "express-validator";

export const getRoleValidation = [
  param("id")
    .isIn(["admin", "employee", "root"])
    .withMessage("Invalid role ID. Must be admin, employee, or root"),
];

export const checkRoleValidation = [
  body("userId").isInt({ min: 1 }).withMessage("Invalid user ID"),
  body("requiredRole")
    .isIn(["admin", "employee", "root"])
    .withMessage("Invalid role. Must be admin, employee, or root"),
];
