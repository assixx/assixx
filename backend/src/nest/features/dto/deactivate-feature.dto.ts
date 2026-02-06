/**
 * Deactivate Feature DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const DeactivateFeatureSchema = z.object({
  tenantId: z.number().int().positive('Tenant ID is required'),
  featureCode: z.string().min(1, 'Feature code is required'),
});

export class DeactivateFeatureDto extends createZodDto(
  DeactivateFeatureSchema,
) {}
