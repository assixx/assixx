/**
 * Survey Responses API v2 Validation with Zod
 * Replaces express-validator with Zod for survey response endpoints
 */
import { z } from 'zod';

import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.zod';
import { DateSchema, IdSchema, PaginationSchema } from '../../../schemas/common.schema';

// ============================================================
// CUSTOM SCHEMAS
// ============================================================

/**
 * Export format enum
 */
const ExportFormatSchema = z.enum(['csv', 'excel'], {
  message: 'Format must be csv or excel',
});

/**
 * Answer schema for survey responses
 */
const AnswerSchema = z.object({
  question_id: IdSchema,
  answer_text: z.string().trim().optional(),
  answer_number: z.preprocess(
    (val) => (typeof val === 'string' ? Number.parseFloat(val) : val),
    z.number().optional(),
  ),
  answer_date: DateSchema.optional(),
  answer_options: z.array(IdSchema).optional(),
});

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * Get all responses query parameters
 */
export const GetAllResponsesQuerySchema = PaginationSchema;

/**
 * Export responses query parameters
 */
export const ExportResponsesQuerySchema = z.object({
  format: ExportFormatSchema.optional(),
});

// ============================================================
// PARAM SCHEMAS
// ============================================================

/**
 * Survey ID parameter validation
 */
export const SurveyIdParamSchema = z.object({
  id: IdSchema,
});

/**
 * Response ID parameter validation
 */
export const ResponseIdParamSchema = z.object({
  id: IdSchema,
  responseId: IdSchema,
});

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * Submit response request body
 */
export const SubmitResponseBodySchema = z.object({
  answers: z.array(AnswerSchema).min(1, 'At least one answer is required'),
});

/**
 * Update response request body
 */
export const UpdateResponseBodySchema = z.object({
  answers: z.array(AnswerSchema).min(1, 'At least one answer is required'),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type GetAllResponsesQuery = z.infer<typeof GetAllResponsesQuerySchema>;
export type ExportResponsesQuery = z.infer<typeof ExportResponsesQuerySchema>;
export type SurveyIdParam = z.infer<typeof SurveyIdParamSchema>;
export type ResponseIdParam = z.infer<typeof ResponseIdParamSchema>;
export type SubmitResponseBody = z.infer<typeof SubmitResponseBodySchema>;
export type UpdateResponseBody = z.infer<typeof UpdateResponseBodySchema>;

// ============================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================

/**
 * Pre-configured validation middleware for survey response routes
 */
export const responsesValidationZod = {
  submitResponse: [validateParams(SurveyIdParamSchema), validateBody(SubmitResponseBodySchema)],
  getAllResponses: [validateParams(SurveyIdParamSchema), validateQuery(GetAllResponsesQuerySchema)],
  getMyResponse: validateParams(SurveyIdParamSchema),
  getResponseById: validateParams(ResponseIdParamSchema),
  updateResponse: [validateParams(ResponseIdParamSchema), validateBody(UpdateResponseBodySchema)],
  exportResponses: [validateParams(SurveyIdParamSchema), validateQuery(ExportResponsesQuerySchema)],
};
