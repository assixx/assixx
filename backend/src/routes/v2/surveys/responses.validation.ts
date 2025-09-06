/**
 * Survey Responses Validation
 * Request validation middleware for survey responses
 */
import { body, param, query } from 'express-validator';

// Common validation messages
const SURVEY_ID_ERROR = 'Survey ID must be a valid integer';
const RESPONSE_ID_ERROR = 'Response ID must be a valid integer';
const QUESTION_ID_ERROR = 'Question ID must be a valid integer';

/**
 * Validation for submitting a survey response
 */
export const submitResponseValidation = [
  param('id').isInt().withMessage(SURVEY_ID_ERROR),
  body('answers').isArray().withMessage('Answers must be an array'),
  body('answers.*.question_id').isInt().withMessage(QUESTION_ID_ERROR),
  body('answers.*.answer_text').optional().isString().trim(),
  body('answers.*.answer_number').optional().isNumeric(),
  body('answers.*.answer_date').optional().isISO8601(),
  body('answers.*.answer_options').optional().isArray(),
  body('answers.*.answer_options.*').optional().isInt(),
];

/**
 * Validation for getting all responses
 */
export const getAllResponsesValidation = [
  param('id').isInt().withMessage(SURVEY_ID_ERROR),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

/**
 * Validation for getting user's response
 */
export const getMyResponseValidation = [param('id').isInt().withMessage(SURVEY_ID_ERROR)];

/**
 * Validation for getting a specific response
 */
export const getResponseByIdValidation = [
  param('id').isInt().withMessage(SURVEY_ID_ERROR),
  param('responseId').isInt().withMessage(RESPONSE_ID_ERROR),
];

/**
 * Validation for updating a response
 */
export const updateResponseValidation = [
  param('id').isInt().withMessage(SURVEY_ID_ERROR),
  param('responseId').isInt().withMessage(RESPONSE_ID_ERROR),
  body('answers').isArray().withMessage('Answers must be an array'),
  body('answers.*.question_id').isInt().withMessage(QUESTION_ID_ERROR),
  body('answers.*.answer_text').optional().isString().trim(),
  body('answers.*.answer_number').optional().isNumeric(),
  body('answers.*.answer_date').optional().isISO8601(),
  body('answers.*.answer_options').optional().isArray(),
  body('answers.*.answer_options.*').optional().isInt(),
];

/**
 * Validation for exporting responses
 */
export const exportResponsesValidation = [
  param('id').isInt().withMessage(SURVEY_ID_ERROR),
  query('format').optional().isIn(['csv', 'excel']).withMessage('Format must be csv or excel'),
];
