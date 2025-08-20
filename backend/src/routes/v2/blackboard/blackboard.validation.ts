/**
 * Blackboard API v2 Validation Rules
 */
import { body, param, query } from 'express-validator';

import { handleValidationErrors } from '../../../middleware/validation.js';

export const blackboardValidation = {
  // List entries validation
  list: [
    query('status')
      .optional()
      .isIn(['active', 'archived'])
      .withMessage("Status must be 'active' or 'archived'"),
    query('filter')
      .optional()
      .isIn(['all', 'company', 'department', 'team'])
      .withMessage('Filter must be one of: all, company, department, team'),
    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Search term cannot exceed 100 characters'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('sortBy')
      .optional()
      .isIn(['created_at', 'updated_at', 'title', 'priority', 'expires_at'])
      .withMessage('Invalid sort field'),
    query('sortDir')
      .optional()
      .isIn(['ASC', 'DESC'])
      .withMessage('Sort direction must be ASC or DESC'),
    query('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Invalid priority value'),
    query('requiresConfirmation')
      .optional()
      .isIn(['true', 'false'])
      .withMessage('requiresConfirmation must be true or false'),
    handleValidationErrors,
  ],

  // Get by ID validation
  getById: [
    param('id').isInt({ min: 1 }).withMessage('Entry ID must be a positive integer'),
    handleValidationErrors,
  ],

  // Create entry validation
  create: [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters'),
    body('content')
      .trim()
      .notEmpty()
      .withMessage('Content is required')
      .isLength({ min: 1, max: 5000 })
      .withMessage('Content must be between 1 and 5000 characters'),
    body('orgLevel')
      .isIn(['company', 'department', 'team'])
      .withMessage('Organization level must be company, department, or team'),
    body('orgId')
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage('Organization ID must be a positive integer'),
    body('expiresAt')
      .optional({ nullable: true })
      .isISO8601()
      .withMessage('Expires at must be a valid ISO 8601 date'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Priority must be low, medium, high, or urgent'),
    body('color')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Color cannot exceed 50 characters'),
    body('requiresConfirmation')
      .optional()
      .isBoolean()
      .withMessage('Requires confirmation must be a boolean'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array')
      .custom((tags) => {
        if (!Array.isArray(tags)) return false;
        return tags.every((tag) => typeof tag === 'string' && tag.length <= 50);
      })
      .withMessage('Each tag must be a string with max 50 characters'),
    handleValidationErrors,
  ],

  // Update entry validation
  update: [
    param('id').isInt({ min: 1 }).withMessage('Entry ID must be a positive integer'),
    body('title')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Title cannot be empty')
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters'),
    body('content')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Content cannot be empty')
      .isLength({ min: 1, max: 5000 })
      .withMessage('Content must be between 1 and 5000 characters'),
    body('orgLevel')
      .optional()
      .isIn(['company', 'department', 'team'])
      .withMessage('Organization level must be company, department, or team'),
    body('orgId')
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage('Organization ID must be a positive integer'),
    body('expiresAt')
      .optional({ nullable: true })
      .isISO8601()
      .withMessage('Expires at must be a valid ISO 8601 date'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Priority must be low, medium, high, or urgent'),
    body('color')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Color cannot exceed 50 characters'),
    body('status')
      .optional()
      .isIn(['active', 'archived'])
      .withMessage('Status must be active or archived'),
    body('requiresConfirmation')
      .optional()
      .isBoolean()
      .withMessage('Requires confirmation must be a boolean'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array')
      .custom((tags) => {
        if (!Array.isArray(tags)) return false;
        return tags.every((tag) => typeof tag === 'string' && tag.length <= 50);
      })
      .withMessage('Each tag must be a string with max 50 characters'),
    handleValidationErrors,
  ],

  // Delete validation
  delete: [
    param('id').isInt({ min: 1 }).withMessage('Entry ID must be a positive integer'),
    handleValidationErrors,
  ],

  // Archive/Unarchive validation
  archiveUnarchive: [
    param('id').isInt({ min: 1 }).withMessage('Entry ID must be a positive integer'),
    handleValidationErrors,
  ],

  // Confirm validation
  confirm: [
    param('id').isInt({ min: 1 }).withMessage('Entry ID must be a positive integer'),
    handleValidationErrors,
  ],

  // Dashboard entries validation
  dashboard: [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('Limit must be between 1 and 10'),
    handleValidationErrors,
  ],

  // Attachment validation
  uploadAttachment: [
    param('id').isInt({ min: 1 }).withMessage('Entry ID must be a positive integer'),
    handleValidationErrors,
  ],

  getAttachments: [
    param('id').isInt({ min: 1 }).withMessage('Entry ID must be a positive integer'),
    handleValidationErrors,
  ],

  deleteAttachment: [
    param('attachmentId').isInt({ min: 1 }).withMessage('Attachment ID must be a positive integer'),
    handleValidationErrors,
  ],

  downloadAttachment: [
    param('attachmentId').isInt({ min: 1 }).withMessage('Attachment ID must be a positive integer'),
    handleValidationErrors,
  ],
};
