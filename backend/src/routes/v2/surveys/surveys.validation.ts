/**
 * Surveys API v2 Validation Rules
 * Input validation for all survey-related endpoints
 */
import { ValidationChain, body, param, query } from 'express-validator';

import { handleValidationErrors } from '../../../middleware/validation';

// Helper functions for validation
const VALID_QUESTION_TYPES = ['text', 'single_choice', 'multiple_choice', 'rating', 'number'];
const CHOICE_QUESTION_TYPES = ['single_choice', 'multiple_choice'];

function validateQuestionText(question: Record<string, unknown>, index: number): void {
  if (!question.questionText || typeof question.questionText !== 'string') {
    throw new Error(`Question ${index + 1}: questionText is required`);
  }
}

function validateQuestionType(question: Record<string, unknown>, index: number): void {
  if (
    typeof question.questionType !== 'string' ||
    !VALID_QUESTION_TYPES.includes(question.questionType)
  ) {
    throw new Error(`Question ${index + 1}: Invalid questionType`);
  }
}

function validateChoiceOptions(question: Record<string, unknown>, index: number): void {
  const isChoiceQuestion =
    typeof question.questionType === 'string' &&
    CHOICE_QUESTION_TYPES.includes(question.questionType);

  if (!isChoiceQuestion) return;

  if (!Array.isArray(question.options) || question.options.length < 2) {
    throw new Error(`Question ${index + 1}: Choice questions need at least 2 options`);
  }
}

function validateOrderPosition(question: Record<string, unknown>, index: number): void {
  if (question.orderPosition === undefined) return;

  if (typeof question.orderPosition !== 'number') {
    throw new Error(`Question ${index + 1}: orderPosition must be a number`);
  }
}

// Custom validators
const validateQuestions: ValidationChain = body('questions')
  .optional()
  .isArray({ min: 1 })
  .withMessage('Questions must be a non-empty array')
  .custom((questions: unknown[]) => {
    for (const [index, item] of questions.entries()) {
      const question = item as Record<string, unknown>;
      validateQuestionText(question, index);
      validateQuestionType(question, index);
      validateChoiceOptions(question, index);
      validateOrderPosition(question, index);
    }
    return true;
  });

// Helper functions for assignment validation
const VALID_ASSIGNMENT_TYPES = ['all_users', 'department', 'team', 'user'];

function validateAssignmentType(assignment: Record<string, unknown>, index: number): void {
  if (typeof assignment.type !== 'string' || !VALID_ASSIGNMENT_TYPES.includes(assignment.type)) {
    throw new Error(`Assignment ${index + 1}: Invalid type`);
  }
}

function validateAssignmentRequiredFields(
  assignment: Record<string, unknown>,
  index: number,
): void {
  switch (assignment.type) {
    case 'department':
      if (!assignment.departmentId) {
        throw new Error(`Assignment ${index + 1}: departmentId required for department type`);
      }
      break;
    case 'team':
      if (!assignment.teamId) {
        throw new Error(`Assignment ${index + 1}: teamId required for team type`);
      }
      break;
    case 'user':
      if (!assignment.userId) {
        throw new Error(`Assignment ${index + 1}: userId required for user type`);
      }
      break;
    case 'all_users':
      // No additional fields required for all_users
      break;
  }
}

const validateAssignments: ValidationChain = body('assignments')
  .optional()
  .isArray()
  .withMessage('Assignments must be an array')
  .custom((assignments: unknown[]) => {
    for (const [index, item] of assignments.entries()) {
      const assignment = item as Record<string, unknown>;
      validateAssignmentType(assignment, index);
      validateAssignmentRequiredFields(assignment, index);
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
