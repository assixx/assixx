/**
 * Upgrade Plan DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpgradePlanSchema = z.object({
  newPlanCode: z.string().min(1, 'New plan code is required'),
  effectiveDate: z.iso.datetime().optional(),
});

export class UpgradePlanDto extends createZodDto(UpgradePlanSchema) {}
