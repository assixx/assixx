import { ValidationChain, body, param, query } from 'express-validator';

// Create department validation
export const createDepartmentValidation: ValidationChain[] = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Department name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Department name must be between 2 and 100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),

  body('managerId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Manager ID must be a positive integer'),

  body('parentId').optional().isInt({ min: 1 }).withMessage('Parent ID must be a positive integer'),

  body('areaId').optional().isInt({ min: 1 }).withMessage('Area ID must be a positive integer'),

  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage("Status must be either 'active' or 'inactive'"),

  body('visibility')
    .optional()
    .isIn(['public', 'private'])
    .withMessage("Visibility must be either 'public' or 'private'"),
];

// Update department validation
export const updateDepartmentValidation: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('Department ID must be a positive integer'),

  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Department name cannot be empty')
    .isLength({ min: 2, max: 100 })
    .withMessage('Department name must be between 2 and 100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),

  body('managerId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Manager ID must be a positive integer'),

  body('parentId').optional().isInt({ min: 1 }).withMessage('Parent ID must be a positive integer'),

  body('areaId').optional().isInt({ min: 1 }).withMessage('Area ID must be a positive integer'),

  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage("Status must be either 'active' or 'inactive'"),

  body('visibility')
    .optional()
    .isIn(['public', 'private'])
    .withMessage("Visibility must be either 'public' or 'private'"),
];

// Department ID validation
export const departmentIdValidation: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('Department ID must be a positive integer'),
];

// Get departments query validation
export const getDepartmentsValidation: ValidationChain[] = [
  query('includeExtended')
    .optional()
    .isIn(['true', 'false'])
    .withMessage("includeExtended must be either 'true' or 'false'"),
];
