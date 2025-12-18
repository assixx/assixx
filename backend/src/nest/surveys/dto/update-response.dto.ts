/**
 * Update Response DTO
 *
 * Validation schema for updating survey responses.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { AnswerSchema } from './submit-response.dto.js';

/**
 * Update response request body schema
 */
export const UpdateResponseSchema = z.object({
  answers: z.array(AnswerSchema).min(1, 'At least one answer is required'),
});

/**
 * Update Response DTO class
 */
export class UpdateResponseDto extends createZodDto(UpdateResponseSchema) {}
