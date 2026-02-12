/**
 * Create Blackout DTO
 *
 * Zod schema for creating a vacation blackout period.
 * scope_type='global' requires scope_id=null, 'team'/'department' requires scope_id.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { BlackoutScopeTypeSchema, DateSchema } from './common.dto.js';

const BaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name cannot exceed 100 characters'),
  reason: z
    .string()
    .trim()
    .max(255, 'Reason cannot exceed 255 characters')
    .optional(),
  startDate: DateSchema,
  endDate: DateSchema,
  scopeType: BlackoutScopeTypeSchema.default('global'),
  scopeId: z.number().int().positive().optional(),
});

type BaseInput = z.infer<typeof BaseSchema>;

export const CreateBlackoutSchema = BaseSchema.refine(
  (data: BaseInput) => data.endDate >= data.startDate,
  {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  },
).refine(
  (data: BaseInput) => {
    if (data.scopeType === 'global') {
      return data.scopeId === undefined;
    }
    return data.scopeId !== undefined;
  },
  {
    message:
      'scope_id must be null for global scope, and required for team/department scope',
    path: ['scopeId'],
  },
);

export class CreateBlackoutDto extends createZodDto(CreateBlackoutSchema) {}
