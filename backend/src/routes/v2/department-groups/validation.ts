/**
 * Department Groups API v2 Validation Rules
 * Express-validator rules for request validation
 */
import { body, param, query } from 'express-validator';

export const createGroupValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Group name is required')
    .isLength({ max: 100 })
    .withMessage('Group name must be at most 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be at most 500 characters'),
  body('parentGroupId').optional().isInt({ min: 1 }).withMessage('Invalid parent group ID'),
  body('departmentIds').optional().isArray().withMessage('departmentIds must be an array'),
  body('departmentIds.*').optional().isInt({ min: 1 }).withMessage('Invalid department ID'),
];

export const updateGroupValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid group ID'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Group name is required')
    .isLength({ max: 100 })
    .withMessage('Group name must be at most 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be at most 500 characters'),
];

export const getGroupValidation = [param('id').isInt({ min: 1 }).withMessage('Invalid group ID')];

export const deleteGroupValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid group ID'),
];

export const addDepartmentsValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid group ID'),
  body('departmentIds').isArray({ min: 1 }).withMessage('departmentIds must be a non-empty array'),
  body('departmentIds.*').isInt({ min: 1 }).withMessage('Invalid department ID'),
];

export const removeDepartmentValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid group ID'),
  param('departmentId').isInt({ min: 1 }).withMessage('Invalid department ID'),
];

export const getGroupDepartmentsValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid group ID'),
  query('includeSubgroups')
    .optional()
    .isBoolean()
    .withMessage('includeSubgroups must be a boolean'),
];
