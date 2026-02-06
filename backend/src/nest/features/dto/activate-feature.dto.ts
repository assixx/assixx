/**
 * Activate Feature DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ActivateFeatureSchema = z.object({
  tenantId: z.number().int().positive('Tenant ID is required'),
  featureCode: z.string().min(1, 'Feature code is required'),
  options: z
    .object({
      expiresAt: z.iso.datetime().optional(),
      customConfig: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

export class ActivateFeatureDto extends createZodDto(ActivateFeatureSchema) {}
