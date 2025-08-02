import { body, param } from "express-validator";

import { handleValidationErrors } from "../../../middleware/validation";

export const plansValidation = {
  /**
   * Validation for getting plan by ID
   */
  getPlanById: [
    param("id")
      .isInt({ min: 1 })
      .withMessage("Plan ID must be a positive integer"),
    handleValidationErrors,
  ],

  /**
   * Validation for upgrading plan
   */
  upgradePlan: [
    body("newPlanCode")
      .notEmpty()
      .withMessage("New plan code is required")
      .isString()
      .trim()
      .isIn(["basic", "professional", "enterprise"])
      .withMessage("Invalid plan code"),
    body("effectiveDate")
      .optional()
      .isISO8601()
      .withMessage("Effective date must be a valid ISO 8601 date"),
    handleValidationErrors,
  ],

  /**
   * Validation for updating addons
   */
  updateAddons: [
    body("employees")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Employees must be a non-negative integer"),
    body("admins")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Admins must be a non-negative integer"),
    body("storageGb")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Storage must be a non-negative integer"),
    body()
      .custom((value) => {
        const hasAtLeastOneField =
          value.employees !== undefined ||
          value.admins !== undefined ||
          value.storageGb !== undefined;
        return hasAtLeastOneField;
      })
      .withMessage("At least one addon field must be provided"),
    handleValidationErrors,
  ],
};
