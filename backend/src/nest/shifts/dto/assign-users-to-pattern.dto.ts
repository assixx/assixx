/**
 * Assign Users To Pattern DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ShiftDateSchema } from './common.dto.js';
import { ShiftGroupSchema } from './rotation-common.dto.js';

/**
 * Assignment item for assigning users to rotation
 */
const AssignmentItemSchema = z.object({
  userId: z.number().int().positive('User ID is required'),
  group: ShiftGroupSchema,
});

/**
 * Assign users to rotation pattern request body
 */
export const AssignUsersToPatternSchema = z.object({
  patternId: z.number().int().positive('Pattern ID is required'),
  assignments: z
    .array(AssignmentItemSchema)
    .min(1, 'At least one assignment is required'),
  teamId: z.number().int().positive().nullable().optional(),
  startsAt: ShiftDateSchema,
  endsAt: ShiftDateSchema.optional(),
});

export class AssignUsersToPatternDto extends createZodDto(
  AssignUsersToPatternSchema,
) {}
