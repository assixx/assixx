/**
 * Admin ID Param DTO
 *
 * Validates adminId path parameter.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AdminIdParamSchema = z.object({
  adminId: z.coerce
    .number()
    .int()
    .positive('Admin ID must be a positive integer'),
});

export class AdminIdParamDto extends createZodDto(AdminIdParamSchema) {}
