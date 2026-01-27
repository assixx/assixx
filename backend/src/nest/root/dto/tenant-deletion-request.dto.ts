/**
 * Tenant Deletion Request DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const TenantDeletionRequestSchema = z.object({
  reason: z
    .string()
    .min(10, 'Deletion reason must be at least 10 characters')
    .max(500, 'Deletion reason too long')
    .optional(),
});

export class TenantDeletionRequestDto extends createZodDto(
  TenantDeletionRequestSchema,
) {}
