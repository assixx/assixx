/**
 * Update Blackout DTO
 *
 * Zod schema for updating an existing blackout period.
 * Multi-scope model: isGlobal OR array(s) of departmentIds/teamIds/areaIds.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DateSchema } from './common.dto.js';

const OrgIdArray = z.array(z.number().int().positive()).optional();

const BaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name cannot exceed 100 characters')
    .optional(),
  reason: z.string().trim().max(255, 'Reason cannot exceed 255 characters').nullish(),
  startDate: DateSchema.optional(),
  endDate: DateSchema.optional(),
  isGlobal: z.boolean().optional(),
  departmentIds: OrgIdArray,
  teamIds: OrgIdArray,
  areaIds: OrgIdArray,
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
).refine(
  (data: BaseInput) => {
    if (data.isGlobal === true) {
      const hasDepts = data.departmentIds !== undefined && data.departmentIds.length > 0;
      const hasTeams = data.teamIds !== undefined && data.teamIds.length > 0;
      const hasAreas = data.areaIds !== undefined && data.areaIds.length > 0;
      return !hasDepts && !hasTeams && !hasAreas;
    }
    return true;
  },
  {
    message: 'Global blackouts must not have org targets.',
    path: ['isGlobal'],
  },
);

export class UpdateBlackoutDto extends createZodDto(UpdateBlackoutSchema) {}
