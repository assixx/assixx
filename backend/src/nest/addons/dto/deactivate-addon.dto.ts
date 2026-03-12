/**
 * Deactivate Addon DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const DeactivateAddonSchema = z.object({
  tenantId: z.number().int().positive('Tenant ID is required'),
  addonCode: z.string().min(1, 'Addon code is required'),
});

export class DeactivateAddonDto extends createZodDto(DeactivateAddonSchema) {}
