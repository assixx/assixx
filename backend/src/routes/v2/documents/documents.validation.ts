/**
 * Documents v2 Validation Rules
 * Input validation for document management endpoints
 */
import { body, param, query } from 'express-validator';

import { handleValidationErrors } from '../../../middleware/validation';

export const documentsValidation = {
  /**
   * List documents validation
   */
  list: [
    query('category')
      .optional()
      .isIn(['personal', 'work', 'training', 'general', 'salary'])
      .withMessage('Invalid category'),
    query('recipientType')
      .optional()
      .isIn(['user', 'team', 'department', 'company'])
      .withMessage('Invalid recipient type'),
    query('userId').optional().isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
    query('teamId').optional().isInt({ min: 1 }).withMessage('Team ID must be a positive integer'),
    query('departmentId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Department ID must be a positive integer'),
    query('year')
      .optional()
      .isInt({ min: 2000, max: 2100 })
      .withMessage('Year must be between 2000 and 2100'),
    query('month')
      .optional()
      .isInt({ min: 1, max: 12 })
      .withMessage('Month must be between 1 and 12'),
    query('isArchived').optional().isBoolean().withMessage('isArchived must be a boolean'),
    query('search')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be 1-100 characters'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    handleValidationErrors,
  ],

  /**
   * Get document by ID validation
   */
  getById: [
    param('id').isInt({ min: 1 }).withMessage('Document ID must be a positive integer'),
    handleValidationErrors,
  ],

  /**
   * Create document validation
   */
  create: [
    // File is handled by multer, these are form fields
    body('category')
      .trim()
      .notEmpty()
      .withMessage('Category is required')
      .isIn(['personal', 'work', 'training', 'general', 'salary'])
      .withMessage('Invalid category'),
    body('recipientType')
      .trim()
      .notEmpty()
      .withMessage('Recipient type is required')
      .isIn(['user', 'team', 'department', 'company'])
      .withMessage('Invalid recipient type'),
    body('userId').optional().isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
    body('teamId').optional().isInt({ min: 1 }).withMessage('Team ID must be a positive integer'),
    body('departmentId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Department ID must be a positive integer'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description cannot exceed 500 characters'),
    body('year')
      .optional()
      .isInt({ min: 2000, max: 2100 })
      .withMessage('Year must be between 2000 and 2100'),
    body('month')
      .optional()
      .isInt({ min: 1, max: 12 })
      .withMessage('Month must be between 1 and 12'),
    body('tags')
      .optional()
      .custom((value: string) => {
        try {
          const tags = JSON.parse(value);
          if (!Array.isArray(tags)) return false;
          return tags.every((tag) => typeof tag === 'string' && tag.length <= 50);
        } catch {
          return false;
        }
      })
      .withMessage('Tags must be a JSON array of strings (max 50 chars each)'),
    body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
    body('expiresAt').optional().isISO8601().withMessage('expiresAt must be a valid ISO 8601 date'),
    handleValidationErrors,
  ],

  /**
   * Update document validation
   */
  update: [
    param('id').isInt({ min: 1 }).withMessage('Document ID must be a positive integer'),
    body('filename')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Filename cannot be empty')
      .isLength({ min: 1, max: 255 })
      .withMessage('Filename must be 1-255 characters'),
    body('category')
      .optional()
      .trim()
      .isIn(['personal', 'work', 'training', 'general', 'salary'])
      .withMessage('Invalid category'),
    body('description')
      .optional()
      .custom((value: unknown) => {
        if (value === null || value === undefined) return true;
        if (typeof value !== 'string') return false;
        return value.length <= 500;
      })
      .withMessage('Description must be null or a string with max 500 characters'),
    body('tags')
      .optional()
      .custom((value: unknown) => {
        if (value === null || value === undefined) return true;
        if (!Array.isArray(value)) return false;
        return value.every((tag) => typeof tag === 'string' && tag.length <= 50);
      })
      .withMessage('Tags must be null or an array of strings (max 50 chars each)'),
    body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
    body('expiresAt')
      .optional()
      .custom((value: unknown) => {
        if (value === null || value === undefined) return true;
        // Check if it's a valid date string
        const date = new Date(value as string);
        return !Number.isNaN(date.getTime());
      })
      .withMessage('expiresAt must be null or a valid date'),
    handleValidationErrors,
  ],

  /**
   * Delete/Archive/Unarchive document validation
   */
  documentAction: [
    param('id').isInt({ min: 1 }).withMessage('Document ID must be a positive integer'),
    handleValidationErrors,
  ],
};
