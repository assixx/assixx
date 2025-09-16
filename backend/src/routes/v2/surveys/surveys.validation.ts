/**
 * Surveys API v2 Validation Rules
 * Input validation for all survey-related endpoints
 */
import { ValidationChain, body, param, query } from 'express-validator';

import { handleValidationErrors } from '../../../middleware/validation';

// Custom validators
const validateQuestions: ValidationChain = body('questions')
  .optional()
  .isArray({ min: 1 })
  .withMessage('Questions must be a non-empty array')
  .custom((questions: unknown[]) => {
    for (const [index, item] of questions.entries()) {
      const question = item as Record<string, unknown>;
      if (!question.questionText || typeof question.questionText !== 'string') {
        throw new Error(`Question ${index + 1}: questionText is required`);
      }

      const validTypes = ['text', 'single_choice', 'multiple_choice', 'rating', 'number'];
      if (
        typeof question.questionType !== 'string' ||
        !validTypes.includes(question.questionType)
      ) {
        throw new Error(`Question ${index + 1}: Invalid questionType`);
      }

      // Check options for choice questions
      if (
        ['single_choice', 'multiple_choice'].includes(question.questionType) &&
        (!Array.isArray(question.options) || question.options.length < 2)
      ) {
        throw new Error(`Question ${index + 1}: Choice questions need at least 2 options`);
      }

      // Check orderPosition
      if (question.orderPosition !== undefined && typeof question.orderPosition !== 'number') {
        throw new Error(`Question ${index + 1}: orderPosition must be a number`);
      }
    }
    return true;
  });

const validateAssignments: ValidationChain = body('assignments')
  .optional()
  .isArray()
  .withMessage('Assignments must be an array')
  .custom((assignments: unknown[]) => {
    for (const [index, item] of assignments.entries()) {
      const assignment = item as Record<string, unknown>;
      const validTypes = ['all_users', 'department', 'team', 'user'];
      if (typeof assignment.type !== 'string' || !validTypes.includes(assignment.type)) {
        throw new Error(`Assignment ${index + 1}: Invalid type`);
      }

      // Validate based on type
      if (assignment.type === 'department' && !assignment.departmentId) {
        throw new Error(`Assignment ${index + 1}: departmentId required for department type`);
      }
      if (assignment.type === 'team' && !assignment.teamId) {
        throw new Error(`Assignment ${index + 1}: teamId required for team type`);
      }
      if (assignment.type === 'individual' && !assignment.userId) {
        throw new Error(`Assignment ${index + 1}: userId required for individual type`);
      }
    }
    return true;
  });

export const surveysValidation = {
  // ============= SURVEYS CRUD =============

  listSurveys: [
    query('status').optional().isIn(['draft', 'active', 'closed']).withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    handleValidationErrors,
  ],

  getSurveyById: [
    param('id').isInt({ min: 1 }).withMessage('Survey ID must be a positive integer'),
    handleValidationErrors,
  ],

  createSurvey: [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description cannot exceed 1000 characters'),
    body('status').optional().isIn(['draft', 'active', 'closed']).withMessage('Invalid status'),
    body('isAnonymous').optional().isBoolean().withMessage('isAnonymous must be a boolean'),
    body('isMandatory').optional().isBoolean().withMessage('isMandatory must be a boolean'),
    body('startDate')
      .optional({ nullable: true })
      .custom((value) => {
        if (value === null || value === undefined || value === '') return true;
        if (!Number.isNaN(Date.parse(value as string))) return true;
        throw new Error('Invalid date format');
      })
      .withMessage('Invalid start date format'),
    body('endDate')
      .optional({ nullable: true })
      .custom((value) => {
        if (value === null || value === undefined || value === '') return true;
        if (!Number.isNaN(Date.parse(value as string))) return true;
        throw new Error('Invalid date format');
      })
      .withMessage('Invalid end date format')
      .custom((endDate, { req }) => {
        const body = req.body as { startDate?: unknown };
        if (!endDate || !body.startDate) return true;
        const start = new Date(body.startDate as string);
        const end = new Date(endDate as string);
        if (end < start) {
          throw new Error('End date must be after start date');
        }
        return true;
      }),
    validateQuestions,
    validateAssignments,
    handleValidationErrors,
  ],

  updateSurvey: [
    param('id').isInt({ min: 1 }).withMessage('Survey ID must be a positive integer'),
    body('title')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Title cannot be empty')
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description cannot exceed 1000 characters'),
    body('status').optional().isIn(['draft', 'active', 'closed']).withMessage('Invalid status'),
    body('isAnonymous').optional().isBoolean().withMessage('isAnonymous must be a boolean'),
    body('isMandatory').optional().isBoolean().withMessage('isMandatory must be a boolean'),
    body('startDate')
      .optional({ nullable: true })
      .custom((value) => {
        if (value === null || value === undefined || value === '') return true;
        if (!Number.isNaN(Date.parse(value as string))) return true;
        throw new Error('Invalid date format');
      })
      .withMessage('Invalid start date format'),
    body('endDate')
      .optional({ nullable: true })
      .custom((value) => {
        if (value === null || value === undefined || value === '') return true;
        if (!Number.isNaN(Date.parse(value as string))) return true;
        throw new Error('Invalid date format');
      })
      .withMessage('Invalid end date format')
      .custom((endDate, { req }) => {
        const body = req.body as { startDate?: unknown };
        if (!endDate || !body.startDate) return true;
        const start = new Date(body.startDate as string);
        const end = new Date(endDate as string);
        if (end < start) {
          throw new Error('End date must be after start date');
        }
        return true;
      }),
    validateQuestions,
    handleValidationErrors,
  ],

  deleteSurvey: [
    param('id').isInt({ min: 1 }).withMessage('Survey ID must be a positive integer'),
    handleValidationErrors,
  ],

  // ============= TEMPLATES =============

  getTemplates: [
    // No validation needed
    handleValidationErrors,
  ],

  createFromTemplate: [
    param('templateId').isInt({ min: 1 }).withMessage('Template ID must be a positive integer'),
    handleValidationErrors,
  ],

  // ============= STATISTICS =============

  getStatistics: [
    param('id').isInt({ min: 1 }).withMessage('Survey ID must be a positive integer'),
    handleValidationErrors,
  ],
};
