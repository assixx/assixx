/**
 * Create Survey DTO
 *
 * Validation schema for creating surveys with questions and assignments.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { IdSchema } from '../../../schemas/common.schema.js';

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
 * Question option schema
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

/**
 * Create survey request body schema
 */
export const CreateSurveySchema = z
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
 * Create Survey DTO class
 */
export class CreateSurveyDto extends createZodDto(CreateSurveySchema) {}
