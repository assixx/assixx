/**
 * KVP API v2 Validation Rules
 * Input validation for Continuous Improvement Process endpoints
 */
import { body, param, query } from 'express-validator';

import { handleValidationErrors } from '../../../middleware/validation.js';

export const kvpValidation = {
  /**
   * Validation for getting suggestion by ID
   */
  getById: [
    param('id').isInt({ min: 1 }).withMessage('Suggestion ID must be a positive integer'),
    handleValidationErrors,
  ],

  /**
   * Validation for listing suggestions with filters
   */
  list: [
    query('status')
      .optional()
      .isIn(['new', 'in_review', 'approved', 'implemented', 'rejected', 'archived'])
      .withMessage('Invalid status value'),
    query('categoryId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Category ID must be a positive integer'),
    query('priority')
      .optional()
      .isIn(['low', 'normal', 'high', 'urgent'])
      .withMessage('Invalid priority value'),
    query('orgLevel')
      .optional()
      .isIn(['company', 'department', 'team'])
      .withMessage('Invalid organization level'),
    query('search').optional().trim().isLength({ max: 100 }).withMessage('Search query too long'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    handleValidationErrors,
  ],

  /**
   * Validation for creating a suggestion
   */
  create: [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ min: 3, max: 255 })
      .withMessage('Title must be between 3 and 255 characters'),
    body('description')
      .trim()
      .notEmpty()
      .withMessage('Description is required')
      .isLength({ min: 10, max: 5000 })
      .withMessage('Description must be between 10 and 5000 characters'),
    body('categoryId').isInt({ min: 1 }).withMessage('Valid category ID is required'),
    body('orgLevel')
      .isIn(['company', 'department', 'team'])
      .withMessage('Organization level must be company, department, or team'),
    body('orgId').isInt({ min: 0 }).withMessage('Organization ID must be a non-negative integer'),
    body('priority')
      .optional()
      .isIn(['low', 'normal', 'high', 'urgent'])
      .withMessage('Priority must be low, normal, high, or urgent'),
    body('expectedBenefit')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Expected benefit cannot exceed 500 characters'),
    body('estimatedCost')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Estimated cost cannot exceed 100 characters'),
    handleValidationErrors,
  ],

  /**
   * Validation for updating a suggestion
   */
  update: [
    param('id').isInt({ min: 1 }).withMessage('Suggestion ID must be a positive integer'),
    body('title')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Title cannot be empty')
      .isLength({ min: 3, max: 255 })
      .withMessage('Title must be between 3 and 255 characters'),
    body('description')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Description cannot be empty')
      .isLength({ min: 10, max: 5000 })
      .withMessage('Description must be between 10 and 5000 characters'),
    body('categoryId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Category ID must be a positive integer'),
    body('priority')
      .optional()
      .isIn(['low', 'normal', 'high', 'urgent'])
      .withMessage('Priority must be low, normal, high, or urgent'),
    body('expectedBenefit')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Expected benefit cannot exceed 500 characters'),
    body('estimatedCost')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Estimated cost cannot exceed 100 characters'),
    body('actualSavings')
      .optional()
      .isNumeric()
      .custom((value) => Number.parseFloat(String(value)) >= 0)
      .withMessage('Actual savings must be a non-negative number'),
    body('status')
      .optional()
      .isIn(['new', 'in_review', 'approved', 'implemented', 'rejected', 'archived'])
      .withMessage('Invalid status value'),
    body('assignedTo')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Assigned to must be a valid user ID'),
    handleValidationErrors,
  ],

  /**
   * Validation for deleting a suggestion
   */
  delete: [
    param('id').isInt({ min: 1 }).withMessage('Suggestion ID must be a positive integer'),
    handleValidationErrors,
  ],

  /**
   * Validation for adding a comment
   */
  addComment: [
    param('id').isInt({ min: 1 }).withMessage('Suggestion ID must be a positive integer'),
    body('comment')
      .trim()
      .notEmpty()
      .withMessage('Comment is required')
      .isLength({ min: 1, max: 2000 })
      .withMessage('Comment must be between 1 and 2000 characters'),
    body('isInternal').optional().isBoolean().withMessage('isInternal must be a boolean value'),
    handleValidationErrors,
  ],

  /**
   * Validation for awarding points
   */
  awardPoints: [
    body('userId').isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
    body('suggestionId').isInt({ min: 1 }).withMessage('Suggestion ID must be a positive integer'),
    body('points').isInt({ min: 1, max: 1000 }).withMessage('Points must be between 1 and 1000'),
    body('reason')
      .trim()
      .notEmpty()
      .withMessage('Reason is required')
      .isLength({ min: 3, max: 500 })
      .withMessage('Reason must be between 3 and 500 characters'),
    handleValidationErrors,
  ],

  /**
   * Validation for getting user points
   */
  getUserPoints: [
    param('userId').optional().isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
    handleValidationErrors,
  ],

  /**
   * Validation for attachment routes
   */
  attachmentId: [
    param('attachmentId').isInt({ min: 1 }).withMessage('Attachment ID must be a positive integer'),
    handleValidationErrors,
  ],

  /**
   * Validation for sharing a suggestion
   */
  share: [
    param('id').isInt({ min: 1 }).withMessage('Suggestion ID must be a positive integer'),
    body('orgLevel')
      .isIn(['company', 'department', 'team'])
      .withMessage('Organization level must be company, department, or team'),
    body('orgId').isInt({ min: 0 }).withMessage('Organization ID must be a non-negative integer'),
    handleValidationErrors,
  ],
};
