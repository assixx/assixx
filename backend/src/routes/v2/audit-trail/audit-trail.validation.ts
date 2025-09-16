/**
 * Validation rules for Audit Trail API v2
 */
import { body, param, query } from 'express-validator';

import { handleValidationErrors } from '../../../middleware/validation.js';

export const auditTrailValidation = {
  /**
   * Validation for getting audit entries
   */
  getEntries: [
    query('userId').optional().isInt().withMessage('User ID must be an integer'),
    query('action').optional().isString().trim(),
    query('resourceType').optional().isString().trim(),
    query('resourceId').optional().isInt().withMessage('Resource ID must be an integer'),
    query('status')
      .optional()
      .isIn(['success', 'failure'])
      .withMessage('Status must be success or failure'),
    query('dateFrom').optional().isISO8601().withMessage('Date from must be a valid ISO date'),
    query('dateTo').optional().isISO8601().withMessage('Date to must be a valid ISO date'),
    query('search').optional().isString().trim(),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('sortBy')
      .optional()
      .isIn(['created_at', 'action', 'user_id', 'resource_type'])
      .withMessage('Invalid sort field'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc'),
    handleValidationErrors,
  ],

  /**
   * Validation for getting a single entry
   */
  getEntry: [
    param('id').isInt().withMessage('Entry ID must be an integer'),
    handleValidationErrors,
  ],

  /**
   * Validation for getting statistics
   */
  getStats: [
    query('dateFrom').optional().isISO8601().withMessage('Date from must be a valid ISO date'),
    query('dateTo').optional().isISO8601().withMessage('Date to must be a valid ISO date'),
    handleValidationErrors,
  ],

  /**
   * Validation for generating compliance report
   */
  generateReport: [
    body('reportType')
      .isIn(['gdpr', 'data_access', 'data_changes', 'user_activity'])
      .withMessage('Invalid report type'),
    body('dateFrom').isISO8601().withMessage('Date from must be a valid ISO date'),
    body('dateTo').isISO8601().withMessage('Date to must be a valid ISO date'),
    body('dateTo').custom((value, { req }) => {
      // Type assertion safe because dateFrom is validated as ISO8601 string above
      const requestBody = req.body as { dateFrom: string };
      const dateFromStr = requestBody.dateFrom;
      const dateToStr = value as string;

      const dateFrom = new Date(dateFromStr);
      const dateTo = new Date(dateToStr);

      if (dateTo < dateFrom) {
        throw new Error('Date to must be after date from');
      }
      // Max 1 year range
      const maxDate = new Date(dateFrom);
      maxDate.setFullYear(maxDate.getFullYear() + 1);
      if (dateTo > maxDate) {
        throw new Error('Date range cannot exceed 1 year');
      }
      return true;
    }),
    handleValidationErrors,
  ],

  /**
   * Validation for exporting entries
   */
  exportEntries: [
    query('format').optional().isIn(['json', 'csv']).withMessage('Format must be json or csv'),
    query('dateFrom').optional().isISO8601().withMessage('Date from must be a valid ISO date'),
    query('dateTo').optional().isISO8601().withMessage('Date to must be a valid ISO date'),
    handleValidationErrors,
  ],

  /**
   * Validation for deleting old entries
   */
  deleteOldEntries: [
    body('olderThanDays').isInt({ min: 90 }).withMessage('Must specify days (minimum 90)'),
    body('confirmPassword')
      .notEmpty()
      .withMessage('Password confirmation required for this action'),
    handleValidationErrors,
  ],
};
