/**
 * Create Staffing Rule DTO
 *
 * Zod schema for creating a minimum staffing rule per asset.
 * UNIQUE(tenant_id, asset_id) enforced at DB level.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateStaffingRuleSchema = z.object({
  assetId: z.number().int().positive('Asset ID is required'),
  minStaffCount: z.number().int().positive('Minimum staff count must be at least 1'),
});

export class CreateStaffingRuleDto extends createZodDto(CreateStaffingRuleSchema) {}
