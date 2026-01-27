/**
 * Tenant ID Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const TenantIdParamSchema = z.object({
  tenantId: z.coerce
    .number()
    .int()
    .positive('Tenant ID must be a positive integer'),
});

export class TenantIdParamDto extends createZodDto(TenantIdParamSchema) {}
