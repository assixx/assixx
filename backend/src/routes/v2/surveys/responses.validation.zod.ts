/**
 * Survey Responses API v2 Validation with Zod
 * Replaces express-validator with Zod for survey response endpoints
 */
import { z } from 'zod';

import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.zod.js';
import { DateSchema, IdSchema, PaginationSchema } from '../../../schemas/common.schema.js';

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
 * Accepts both camelCase (from frontend) and snake_case (from database)
 */
const AnswerSchema = z
  .object({
    // Accept both camelCase and snake_case for question ID
    question_id: IdSchema.optional(),
    questionId: IdSchema.optional(),
    // Answer fields - camelCase
    answerText: z.string().trim().optional(),
    answerNumber: z.preprocess(
      (val: unknown) => (typeof val === 'string' ? Number.parseFloat(val) : val),
      z.number().optional(),
    ),
    answerDate: DateSchema.optional(),
    answerOptions: z.array(IdSchema).optional(),
    // Answer fields - snake_case (for backwards compatibility)
    answer_text: z.string().trim().optional(),
    answer_number: z.preprocess(
      (val: unknown) => (typeof val === 'string' ? Number.parseFloat(val) : val),
      z.number().optional(),
    ),
    answer_date: DateSchema.optional(),
    answer_options: z.array(IdSchema).optional(),
  })
  .refine(
    (data: {
      question_id?: number;
      questionId?: number;
      answerText?: string;
      answerNumber?: number;
      answerDate?: string;
      answerOptions?: number[];
      answer_text?: string;
      answer_number?: number;
      answer_date?: string;
      answer_options?: number[];
    }) => data.question_id !== undefined || data.questionId !== undefined,
    {
      message: 'Either question_id or questionId is required',
      path: ['question_id'],
    },
  );

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
 * Accepts both numeric IDs and UUIDs
 */
export const SurveyIdParamSchema = z.object({
  id: z.union([
    // UUID format (UUIDv7)
    z
      .string()
      .refine(
        (val: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val),
        {
          message: 'Invalid UUID format',
        },
      ),
    // Numeric ID (backwards compatibility)
    IdSchema,
  ]),
});

/**
 * Response ID parameter validation
 */
export const ResponseIdParamSchema = z.object({
  id: z.union([
    // UUID format (UUIDv7)
    z
      .string()
      .refine(
        (val: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val),
        {
          message: 'Invalid UUID format',
        },
      ),
    // Numeric ID (backwards compatibility)
    IdSchema,
  ]),
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
