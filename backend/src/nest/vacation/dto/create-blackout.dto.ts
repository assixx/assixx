/**
 * Create Blackout DTO
 *
 * Zod schema for creating a vacation blackout period.
 * Multi-scope model: isGlobal OR array(s) of departmentIds/teamIds/areaIds.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DateSchema } from './common.dto.js';

const OrgIdArray = z.array(z.number().int().positive()).optional().default([]);

const BaseSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
  reason: z.string().trim().max(255, 'Reason cannot exceed 255 characters').optional(),
  startDate: DateSchema,
  endDate: DateSchema,
  isGlobal: z.boolean().default(true),
  departmentIds: OrgIdArray,
  teamIds: OrgIdArray,
  areaIds: OrgIdArray,
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
    if (data.isGlobal) {
      return (
        data.departmentIds.length === 0 && data.teamIds.length === 0 && data.areaIds.length === 0
      );
    }
    return data.departmentIds.length > 0 || data.teamIds.length > 0 || data.areaIds.length > 0;
  },
  {
    message:
      'Global blackouts must not have org targets. Non-global blackouts must have at least one department, team, or area.',
    path: ['isGlobal'],
  },
);

export class CreateBlackoutDto extends createZodDto(CreateBlackoutSchema) {}
