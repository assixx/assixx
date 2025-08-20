import { ValidationChain, body, param } from 'express-validator';

// Get admin permissions validation
export const getAdminPermissionsValidation: ValidationChain[] = [
  param('adminId').isInt({ min: 1 }).withMessage('Admin ID must be a positive integer'),
];

// Get current admin's permissions validation (no params needed)
export const getMyPermissionsValidation: ValidationChain[] = [];

// Set permissions validation
export const setPermissionsValidation: ValidationChain[] = [
  body('adminId').isInt({ min: 1 }).withMessage('Admin ID must be a positive integer'),

  body('departmentIds').optional().isArray().withMessage('Department IDs must be an array'),
  body('departmentIds.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each department ID must be a positive integer'),

  body('groupIds').optional().isArray().withMessage('Group IDs must be an array'),
  body('groupIds.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each group ID must be a positive integer'),

  body('permissions').optional().isObject().withMessage('Permissions must be an object'),
  body('permissions.canRead').optional().isBoolean().withMessage('canRead must be a boolean'),
  body('permissions.canWrite').optional().isBoolean().withMessage('canWrite must be a boolean'),
  body('permissions.canDelete').optional().isBoolean().withMessage('canDelete must be a boolean'),
];

// Remove permission validation
export const removePermissionValidation: ValidationChain[] = [
  param('adminId').isInt({ min: 1 }).withMessage('Admin ID must be a positive integer'),
  param('departmentId').isInt({ min: 1 }).withMessage('Department ID must be a positive integer'),
];

// Remove group permission validation
export const removeGroupPermissionValidation: ValidationChain[] = [
  param('adminId').isInt({ min: 1 }).withMessage('Admin ID must be a positive integer'),
  param('groupId').isInt({ min: 1 }).withMessage('Group ID must be a positive integer'),
];

// Bulk operations validation
export const bulkPermissionsValidation: ValidationChain[] = [
  body('adminIds').isArray({ min: 1 }).withMessage('Admin IDs must be a non-empty array'),
  body('adminIds.*').isInt({ min: 1 }).withMessage('Each admin ID must be a positive integer'),

  body('operation')
    .isIn(['assign', 'remove'])
    .withMessage("Operation must be either 'assign' or 'remove'"),

  body('departmentIds').optional().isArray().withMessage('Department IDs must be an array'),
  body('departmentIds.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each department ID must be a positive integer'),

  body('groupIds').optional().isArray().withMessage('Group IDs must be an array'),
  body('groupIds.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each group ID must be a positive integer'),

  body('permissions').optional().isObject().withMessage('Permissions must be an object'),
  body('permissions.canRead').optional().isBoolean().withMessage('canRead must be a boolean'),
  body('permissions.canWrite').optional().isBoolean().withMessage('canWrite must be a boolean'),
  body('permissions.canDelete').optional().isBoolean().withMessage('canDelete must be a boolean'),
];

// Check access validation
export const checkAccessValidation: ValidationChain[] = [
  param('adminId').isInt({ min: 1 }).withMessage('Admin ID must be a positive integer'),
  param('departmentId').isInt({ min: 1 }).withMessage('Department ID must be a positive integer'),
  param('permissionLevel')
    .optional()
    .isIn(['read', 'write', 'delete'])
    .withMessage("Permission level must be 'read', 'write', or 'delete'"),
];
