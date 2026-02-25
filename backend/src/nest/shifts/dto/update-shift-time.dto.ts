/**
 * Update Shift Time DTO
 *
 * Zod schema for updating a single shift time definition.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { TimeSchema } from './common.dto.js';

/** Update a single shift time definition */
export const UpdateShiftTimeSchema = z.object({
  label: z.string().min(1).max(100),
  startTime: TimeSchema,
  endTime: TimeSchema,
});

export class UpdateShiftTimeDto extends createZodDto(UpdateShiftTimeSchema) {}
