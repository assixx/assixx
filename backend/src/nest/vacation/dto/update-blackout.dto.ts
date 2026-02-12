/**
 * Update Blackout DTO
 *
 * Zod schema for updating an existing blackout period.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { BlackoutScopeTypeSchema, DateSchema } from './common.dto.js';

const BaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name cannot exceed 100 characters')
    .optional(),
  reason: z
    .string()
    .trim()
    .max(255, 'Reason cannot exceed 255 characters')
    .nullish(),
  startDate: DateSchema.optional(),
  endDate: DateSchema.optional(),
  scopeType: BlackoutScopeTypeSchema.optional(),
  scopeId: z.number().int().positive().nullish(),
});

type BaseInput = z.infer<typeof BaseSchema>;

export const UpdateBlackoutSchema = BaseSchema.refine(
  (data: BaseInput) => {
    if (data.startDate !== undefined && data.endDate !== undefined) {
      return data.endDate >= data.startDate;
    }
    return true;
  },
  { message: 'End date must be on or after start date', path: ['endDate'] },
);

export class UpdateBlackoutDto extends createZodDto(UpdateBlackoutSchema) {}
