/**
 * Users API v2 Validation Rules
 * Defines input validation for all user endpoints
 */
import { body, param, query } from 'express-validator';

import { isValidPhoneNumber } from '../../../utils/phoneValidator';

export const usersValidation = {
  // List users validation
  list: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('search').optional().isString().trim().withMessage('Search must be a string'),
    query('role').optional().isIn(['employee', 'admin', 'root']).withMessage('Invalid role'),
    query('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
    query('isArchived').optional().isBoolean().withMessage('isArchived must be boolean'),
    query('sortBy')
      .optional()
      .isIn(['firstName', 'lastName', 'email', 'createdAt', 'lastLogin'])
      .withMessage('Invalid sort field'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc'),
  ],

  // Get user by ID
  getById: [param('id').isInt({ min: 1 }).withMessage('User ID must be a valid positive integer')],

  // Create user validation
  create: [
    body('email').isEmail().withMessage('Valid email required'),
    body('firstName').isString().trim().notEmpty().withMessage('First name required'),
    body('lastName').isString().trim().notEmpty().withMessage('Last name required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').optional().isIn(['employee', 'admin']).withMessage('Invalid role'),
    body('departmentId')
      .optional({ nullable: true })
      .custom((value) => value === null || value === undefined || Number.isInteger(value))
      .withMessage('Department ID must be integer or null'),
    body('position').optional().isString().trim(),
    body('phone')
      .optional()
      .custom((value: unknown) => !value || isValidPhoneNumber(value as string))
      .withMessage('Invalid phone number format (must start with + and contain 7-29 digits)'),
    body('address').optional().isString().trim(),
    body('employeeNumber')
      .optional()
      .matches(/^[-0-9A-Za-z]{1,10}$/)
      .withMessage('Employee number: max 10 characters (letters, numbers, hyphen)'),
  ],

  // Update user validation
  update: [
    param('id').isInt().withMessage('User ID must be a valid integer'),
    body('email').optional().isEmail().withMessage('Valid email required'),
    body('firstName')
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('First name cannot be empty'),
    body('lastName')
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Last name cannot be empty'),
    body('role').optional().isIn(['employee', 'admin']).withMessage('Invalid role'),
    body('departmentId')
      .optional({ nullable: true })
      .custom((value) => value === null || value === undefined || Number.isInteger(value))
      .withMessage('Department ID must be integer or null'),
    body('position').optional().isString().trim(),
    body('phone')
      .optional()
      .custom((value: unknown) => !value || isValidPhoneNumber(value as string))
      .withMessage('Invalid phone number format (must start with + and contain 7-29 digits)'),
    body('address').optional().isString().trim(),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
    body('employeeNumber')
      .optional()
      .matches(/^[-0-9A-Za-z]{1,10}$/)
      .withMessage('Employee number: max 10 characters (letters, numbers, hyphen)'),
  ],

  // Update profile validation (limited fields for self-update)
  updateProfile: [
    body('firstName')
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('First name cannot be empty'),
    body('lastName')
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Last name cannot be empty'),
    body('phone')
      .optional()
      .custom((value: unknown) => !value || isValidPhoneNumber(value as string))
      .withMessage('Invalid phone number format (must start with + and contain 7-29 digits)'),
    body('address').optional().isString().trim(),
    body('emergencyContact').optional().isString().trim(),
    body('emergencyPhone')
      .optional()
      .custom((value: unknown) => !value || isValidPhoneNumber(value as string))
      .withMessage(
        'Invalid emergency phone number format (must start with + and contain 7-29 digits)',
      ),
  ],

  // Change password validation
  changePassword: [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .custom(
        (value: unknown, { req }) =>
          value !== (req.body as { currentPassword?: string }).currentPassword,
      )
      .withMessage('New password must be different from current password'),
    body('confirmPassword')
      .custom(
        (value: unknown, { req }) => value === (req.body as { newPassword?: string }).newPassword,
      )
      .withMessage('Passwords do not match'),
  ],

  // Update availability validation
  updateAvailability: [
    param('id').isInt().withMessage('User ID must be a valid integer'),
    body('availabilityStatus')
      .isIn(['available', 'vacation', 'sick', 'training', 'other'])
      .withMessage('Invalid availability status'),
    body('availabilityStart')
      .optional()
      .isISO8601()
      .withMessage('Start date must be valid ISO date'),
    body('availabilityEnd').optional().isISO8601().withMessage('End date must be valid ISO date'),
    body('availabilityNotes')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Notes must not exceed 500 characters'),
  ],

  // Archive/Unarchive validation - less strict for ID param
  archiveValidation: [param('id').exists().withMessage('User ID is required')],
};
