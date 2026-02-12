/**
 * Update Staffing Rule DTO
 *
 * Zod schema for updating an existing minimum staffing rule.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateStaffingRuleSchema = z.object({
  minStaffCount: z
    .number()
    .int()
    .positive('Minimum staff count must be at least 1'),
});

export class UpdateStaffingRuleDto extends createZodDto(
  UpdateStaffingRuleSchema,
) {}
