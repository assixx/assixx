import { body, param, query } from 'express-validator';

import { handleValidationErrors } from '../../../middleware/validation';

// Validation message constants
const FEATURE_CODE_REQUIRED = 'Feature code is required';
const FEATURE_CODE_LENGTH = 'Feature code must be between 3 and 50 characters';
const FEATURE_CODE_FORMAT =
  'Feature code must contain only lowercase letters, numbers, underscores and hyphens';
const INVALID_TENANT_ID = 'Invalid tenant ID';

// Common validators
const featureCodeValidator = param('code')
  .trim()
  .notEmpty()
  .withMessage(FEATURE_CODE_REQUIRED)
  .isLength({ min: 3, max: 50 })
  .withMessage(FEATURE_CODE_LENGTH)
  .matches(/^[-0-9_a-z]+$/)
  .withMessage(FEATURE_CODE_FORMAT);

const tenantIdValidator = param('tenantId').isInt({ min: 1 }).withMessage(INVALID_TENANT_ID);

// GET /api/v2/features
export const getAllFeaturesValidation = [
  query('includeInactive').optional().isBoolean().withMessage('includeInactive must be a boolean'),
  handleValidationErrors,
];

// GET /api/v2/features/categories
export const getFeaturesByCategoryValidation = [
  query('includeInactive').optional().isBoolean().withMessage('includeInactive must be a boolean'),
  handleValidationErrors,
];

// GET /api/v2/features/:code
export const getFeatureByCodeValidation = [featureCodeValidator, handleValidationErrors];

// GET /api/v2/features/tenant/:tenantId
export const getTenantFeaturesValidation = [tenantIdValidator, handleValidationErrors];

// GET /api/v2/features/tenant/:tenantId/summary
export const getTenantFeaturesSummaryValidation = [tenantIdValidator, handleValidationErrors];

// POST /api/v2/features/activate
export const activateFeatureValidation = [
  body('tenantId').isInt({ min: 1 }).withMessage(INVALID_TENANT_ID),
  body('featureCode')
    .trim()
    .notEmpty()
    .withMessage(FEATURE_CODE_REQUIRED)
    .isLength({ min: 3, max: 50 })
    .withMessage(FEATURE_CODE_LENGTH)
    .matches(/^[-0-9_a-z]+$/)
    .withMessage(FEATURE_CODE_FORMAT),
  body('options').optional().isObject().withMessage('Options must be an object'),
  body('options.expiresAt')
    .optional()
    .isISO8601()
    .withMessage('expiresAt must be a valid ISO 8601 date')
    .custom((value) => {
      const date = new Date(value as string);
      if (date <= new Date()) {
        throw new Error('expiresAt must be in the future');
      }
      return true;
    }),
  body('options.customPrice')
    .optional()
    .isNumeric()
    .withMessage('customPrice must be a number')
    .custom((value) => Number.parseFloat(value as string) >= 0)
    .withMessage('customPrice must be positive'),
  body('options.trialDays')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('trialDays must be between 1 and 365'),
  body('options.usageLimit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('usageLimit must be a positive integer'),
  body('options.customConfig').optional().isObject().withMessage('customConfig must be an object'),
  handleValidationErrors,
];

// POST /api/v2/features/deactivate
export const deactivateFeatureValidation = [
  body('tenantId').isInt({ min: 1 }).withMessage(INVALID_TENANT_ID),
  body('featureCode')
    .trim()
    .notEmpty()
    .withMessage(FEATURE_CODE_REQUIRED)
    .isLength({ min: 3, max: 50 })
    .withMessage(FEATURE_CODE_LENGTH)
    .matches(/^[-0-9_a-z]+$/)
    .withMessage(FEATURE_CODE_FORMAT),
  handleValidationErrors,
];

// GET /api/v2/features/usage/:featureCode
export const getUsageStatsValidation = [
  param('featureCode')
    .trim()
    .notEmpty()
    .withMessage(FEATURE_CODE_REQUIRED)
    .isLength({ min: 3, max: 50 })
    .withMessage(FEATURE_CODE_LENGTH)
    .matches(/^[-0-9_a-z]+$/)
    .withMessage(FEATURE_CODE_FORMAT),
  query('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .custom((endDate, { req }) => {
      const startDate = req.query.startDate;
      const endDateStr = endDate as string;
      if (startDate && new Date(endDateStr) < new Date(startDate as string)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  handleValidationErrors,
];

// GET /api/v2/features/test/:featureCode
export const testFeatureAccessValidation = [
  param('featureCode')
    .trim()
    .notEmpty()
    .withMessage(FEATURE_CODE_REQUIRED)
    .isLength({ min: 3, max: 50 })
    .withMessage(FEATURE_CODE_LENGTH)
    .matches(/^[-0-9_a-z]+$/)
    .withMessage(FEATURE_CODE_FORMAT),
  handleValidationErrors,
];
