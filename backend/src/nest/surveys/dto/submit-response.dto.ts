/**
 * Submit Response DTO
 *
 * Validation schema for submitting survey responses.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DateSchema, IdSchema } from '../../../schemas/common.schema.js';

/**
 * Answer schema for survey responses
 * Accepts both camelCase (from frontend) and snake_case (from database)
 */
export const AnswerSchema = z
  .object({
    // Accept both camelCase and snake_case for question ID
    question_id: IdSchema.optional(),
    questionId: IdSchema.optional(),
    // Answer fields - camelCase
    answerText: z.string().trim().optional(),
    answerNumber: z.preprocess(
      (val: unknown) =>
        typeof val === 'string' ? Number.parseFloat(val) : val,
      z.number().optional(),
    ),
    answerDate: DateSchema.optional(),
    answerOptions: z.array(IdSchema).optional(),
    // Answer fields - snake_case (for backwards compatibility)
    answer_text: z.string().trim().optional(),
    answer_number: z.preprocess(
      (val: unknown) =>
        typeof val === 'string' ? Number.parseFloat(val) : val,
      z.number().optional(),
    ),
    answer_date: DateSchema.optional(),
    answer_options: z.array(IdSchema).optional(),
  })
  .refine(
    (data: {
      question_id?: number | undefined;
      questionId?: number | undefined;
    }): boolean =>
      data.question_id !== undefined || data.questionId !== undefined,
    {
      message: 'Either question_id or questionId is required',
      path: ['question_id'],
    },
  );

/**
 * Submit response request body schema
 */
export const SubmitResponseSchema = z.object({
  answers: z.array(AnswerSchema).min(1, 'At least one answer is required'),
});

/**
 * Submit Response DTO class
 */
export class SubmitResponseDto extends createZodDto(SubmitResponseSchema) {}
