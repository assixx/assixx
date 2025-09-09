/**
 * Settings v2 Validation Rules
 */
import { body, param, query } from 'express-validator';

import { handleValidationErrors } from '../../../middleware/validation.js';

// Constants for validation messages
const SETTING_KEY_MESSAGE = 'Setting key must be alphanumeric with underscores, dots, or hyphens';
const INVALID_CATEGORY_MESSAGE = 'Invalid category';
const SETTING_VALUE_REQUIRED_MESSAGE = 'Setting value is required';

// Available categories
const SETTING_CATEGORIES = [
  'general',
  'appearance',
  'notifications',
  'security',
  'workflow',
  'integration',
  'shifts',
  'other',
];

// Common validations
const settingKeyValidation = param('key')
  .isString()
  .trim()
  .isLength({ min: 1, max: 100 })
  .matches(/^[\w\-.]+$/)
  .withMessage(SETTING_KEY_MESSAGE);

const valueTypeValidation = body('value_type')
  .optional()
  .isIn(['string', 'number', 'boolean', 'json'])
  .withMessage('Invalid value type');

const categoryValidation = body('category')
  .optional()
  .isIn(SETTING_CATEGORIES)
  .withMessage(INVALID_CATEGORY_MESSAGE);

// System settings validations
export const getSystemSettingsValidation = [
  query('category').optional().isIn(SETTING_CATEGORIES).withMessage(INVALID_CATEGORY_MESSAGE),
  query('is_public')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('is_public must be true or false'),
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term too long'),
  handleValidationErrors,
];

export const getSystemSettingValidation = [settingKeyValidation, handleValidationErrors];

export const createSystemSettingValidation = [
  body('setting_key')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[\w\-.]+$/)
    .withMessage(SETTING_KEY_MESSAGE),
  body('setting_value').exists().withMessage(SETTING_VALUE_REQUIRED_MESSAGE),
  valueTypeValidation,
  categoryValidation,
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description too long'),
  body('is_public').optional().isBoolean().withMessage('is_public must be a boolean'),
  handleValidationErrors,
];

export const updateSystemSettingValidation = [
  settingKeyValidation,
  body('setting_value').exists().withMessage(SETTING_VALUE_REQUIRED_MESSAGE),
  valueTypeValidation,
  categoryValidation,
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description too long'),
  body('is_public').optional().isBoolean().withMessage('is_public must be a boolean'),
  handleValidationErrors,
];

export const deleteSystemSettingValidation = [settingKeyValidation, handleValidationErrors];

// Tenant settings validations
export const getTenantSettingsValidation = [
  query('category').optional().isIn(SETTING_CATEGORIES).withMessage(INVALID_CATEGORY_MESSAGE),
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term too long'),
  handleValidationErrors,
];

export const getTenantSettingValidation = [settingKeyValidation, handleValidationErrors];

export const createTenantSettingValidation = [
  body('setting_key')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[\w\-.]+$/)
    .withMessage(SETTING_KEY_MESSAGE),
  body('setting_value').exists().withMessage(SETTING_VALUE_REQUIRED_MESSAGE),
  valueTypeValidation,
  categoryValidation,
  handleValidationErrors,
];

export const updateTenantSettingValidation = [
  settingKeyValidation,
  body('setting_value').exists().withMessage(SETTING_VALUE_REQUIRED_MESSAGE),
  valueTypeValidation,
  categoryValidation,
  handleValidationErrors,
];

export const deleteTenantSettingValidation = [settingKeyValidation, handleValidationErrors];

// User settings validations
export const getUserSettingsValidation = [
  query('category').optional().isIn(SETTING_CATEGORIES).withMessage(INVALID_CATEGORY_MESSAGE),
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term too long'),
  handleValidationErrors,
];

export const getUserSettingValidation = [settingKeyValidation, handleValidationErrors];

export const createUserSettingValidation = [
  body('setting_key')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[\w\-.]+$/)
    .withMessage(SETTING_KEY_MESSAGE),
  body('setting_value').exists().withMessage(SETTING_VALUE_REQUIRED_MESSAGE),
  valueTypeValidation,
  categoryValidation,
  handleValidationErrors,
];

export const updateUserSettingValidation = [
  settingKeyValidation,
  body('setting_value').exists().withMessage(SETTING_VALUE_REQUIRED_MESSAGE),
  valueTypeValidation,
  categoryValidation,
  handleValidationErrors,
];

export const deleteUserSettingValidation = [settingKeyValidation, handleValidationErrors];

// Admin user settings validations
export const getAdminUserSettingsValidation = [
  param('userId').isInt({ min: 1 }).withMessage('Invalid user ID'),
  handleValidationErrors,
];

// Bulk update validation
export const bulkUpdateValidation = [
  body('type').isIn(['system', 'tenant', 'user']).withMessage('Invalid settings type'),
  body('settings').isArray({ min: 1 }).withMessage('Settings must be a non-empty array'),
  body('settings.*.setting_key')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[\w\-.]+$/)
    .withMessage(SETTING_KEY_MESSAGE),
  body('settings.*.setting_value').exists().withMessage('Setting value is required'),
  body('settings.*.value_type')
    .optional()
    .isIn(['string', 'number', 'boolean', 'json'])
    .withMessage('Invalid value type'),
  body('settings.*.category')
    .optional()
    .isIn([
      'general',
      'appearance',
      'notifications',
      'security',
      'workflow',
      'integration',
      'shifts',
      'other',
    ])
    .withMessage('Invalid category'),
  handleValidationErrors,
];
