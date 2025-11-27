/**
 * Surveys API v2 Validation with Zod
 * Replaces express-validator with Zod for survey endpoints
 */
import { z } from 'zod';

import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.zod.js';
import { IdSchema, PaginationSchema } from '../../../schemas/common.schema.js';

// ============================================================
// CUSTOM SCHEMAS
// ============================================================

/**
 * Survey status enum
 */
const SurveyStatusSchema = z.enum(['draft', 'active', 'closed'], {
  message: 'Invalid status',
});

/**
 * Question type enum
 */
const QuestionTypeSchema = z.enum(
  ['text', 'single_choice', 'multiple_choice', 'rating', 'yes_no', 'number', 'date'],
  {
    message: 'Invalid question type',
  },
);

/**
 * Assignment type enum
 */
const AssignmentTypeSchema = z.enum(['all_users', 'area', 'department', 'team', 'user'], {
  message: 'Invalid assignment type',
});

/**
 * Date validation that accepts null, undefined, or empty string
 */
const NullableDateSchema = z
  .string()
  .refine(
    (val: string) => {
      if (val === '') return true;
      return !Number.isNaN(Date.parse(val));
    },
    { message: 'Invalid date format' },
  )
  .nullable()
  .optional();

/**
 * Question option schema - accepts both string and object formats
 * Note: For API responses, transformation happens in surveys.service.ts transformSurveyToApi()
 */
const QuestionOptionSchema = z.union([
  z.string(),
  z.object({
    optionText: z.string(),
  }),
]);

/**
 * Survey question validation schema
 */
const QuestionSchema = z.object({
  questionText: z.string().min(1, 'Question text is required'),
  questionType: QuestionTypeSchema,
  isRequired: z.union([z.number(), z.boolean()]).optional(),
  options: z
    .array(QuestionOptionSchema)
    .min(2, 'Choice questions need at least 2 options')
    .optional(),
  orderPosition: z.number().optional(),
});

/**
 * Survey assignment validation schema
 */
const AssignmentSchema = z
  .object({
    type: AssignmentTypeSchema,
    areaId: IdSchema.optional(),
    departmentId: IdSchema.optional(),
    teamId: IdSchema.optional(),
    userId: IdSchema.optional(),
  })
  .refine(
    (data: {
      type: 'all_users' | 'area' | 'department' | 'team' | 'user';
      areaId?: number | undefined;
      departmentId?: number | undefined;
      teamId?: number | undefined;
      userId?: number | undefined;
    }) => {
      if (data.type === 'area') return data.areaId !== undefined;
      if (data.type === 'department') return data.departmentId !== undefined;
      if (data.type === 'team') return data.teamId !== undefined;
      if (data.type === 'user') return data.userId !== undefined;
      return true;
    },
    {
      message: 'Required ID missing for assignment type',
      path: ['type'],
    },
  );

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * List surveys query parameters
 */
export const ListSurveysQuerySchema = PaginationSchema.extend({
  status: SurveyStatusSchema.optional(),
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
 * Template ID parameter validation
 */
export const TemplateIdParamSchema = z.object({
  templateId: IdSchema,
});

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * Create survey request body
 */
export const CreateSurveyBodySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters')
      .max(200, 'Title must not exceed 200 characters'),
    description: z
      .string()
      .trim()
      .max(1000, 'Description cannot exceed 1000 characters')
      .optional(),
    status: SurveyStatusSchema.optional(),
    isAnonymous: z.boolean().optional(),
    isMandatory: z.boolean().optional(),
    startDate: NullableDateSchema,
    endDate: NullableDateSchema,
    questions: z.array(QuestionSchema).min(1, 'Questions must be a non-empty array').optional(),
    assignments: z.array(AssignmentSchema).optional(),
  })
  .refine(
    (data: { startDate?: string | null | undefined; endDate?: string | null | undefined }) => {
      if (
        data.startDate !== undefined &&
        data.startDate !== null &&
        data.startDate !== '' &&
        data.endDate !== undefined &&
        data.endDate !== null &&
        data.endDate !== ''
      ) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        return end >= start;
      }
      return true;
    },
    {
      message: 'End date must be after start date',
      path: ['endDate'],
    },
  );

/**
 * Update survey request body (all fields optional)
 */
export const UpdateSurveyBodySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters')
      .max(200, 'Title must not exceed 200 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, 'Description cannot exceed 1000 characters')
      .optional(),
    status: SurveyStatusSchema.optional(),
    isAnonymous: z.boolean().optional(),
    isMandatory: z.boolean().optional(),
    startDate: NullableDateSchema,
    endDate: NullableDateSchema,
    questions: z.array(QuestionSchema).min(1, 'Questions must be a non-empty array').optional(),
    assignments: z.array(AssignmentSchema).optional(),
  })
  .refine(
    (data: { startDate?: string | null | undefined; endDate?: string | null | undefined }) => {
      if (
        data.startDate !== undefined &&
        data.startDate !== null &&
        data.startDate !== '' &&
        data.endDate !== undefined &&
        data.endDate !== null &&
        data.endDate !== ''
      ) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        return end >= start;
      }
      return true;
    },
    {
      message: 'End date must be after start date',
      path: ['endDate'],
    },
  );

// ============================================================
// TYPE EXPORTS
// ============================================================

export type ListSurveysQuery = z.infer<typeof ListSurveysQuerySchema>;
export type SurveyIdParam = z.infer<typeof SurveyIdParamSchema>;
export type TemplateIdParam = z.infer<typeof TemplateIdParamSchema>;
export type CreateSurveyBody = z.infer<typeof CreateSurveyBodySchema>;
export type UpdateSurveyBody = z.infer<typeof UpdateSurveyBodySchema>;

// ============================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================

/**
 * Pre-configured validation middleware for survey routes
 */
export const surveysValidationZod = {
  listSurveys: validateQuery(ListSurveysQuerySchema),
  getSurveyById: validateParams(SurveyIdParamSchema),
  createSurvey: validateBody(CreateSurveyBodySchema),
  updateSurvey: [validateParams(SurveyIdParamSchema), validateBody(UpdateSurveyBodySchema)],
  deleteSurvey: validateParams(SurveyIdParamSchema),
  getTemplates: [], // No validation needed
  createFromTemplate: validateParams(TemplateIdParamSchema),
  getStatistics: validateParams(SurveyIdParamSchema),
};
