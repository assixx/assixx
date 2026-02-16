/**
 * Create Staffing Rule DTO
 *
 * Zod schema for creating a minimum staffing rule per machine.
 * UNIQUE(tenant_id, machine_id) enforced at DB level.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateStaffingRuleSchema = z.object({
  machineId: z.number().int().positive('Machine ID is required'),
  minStaffCount: z
    .number()
    .int()
    .positive('Minimum staff count must be at least 1'),
});

export class CreateStaffingRuleDto extends createZodDto(
  CreateStaffingRuleSchema,
) {}
