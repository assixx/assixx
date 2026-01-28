/**
 * Check Access Param DTO
 *
 * Validates adminId, departmentId and permissionLevel parameters.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CheckAccessParamSchema = z.object({
  adminId: z.coerce
    .number()
    .int()
    .positive('Admin ID must be a positive integer'),
  departmentId: z.coerce
    .number()
    .int()
    .positive('Department ID must be a positive integer'),
  permissionLevel: z
    .enum(['read', 'write', 'delete'])
    .optional()
    .default('read'),
});

export class CheckAccessParamDto extends createZodDto(CheckAccessParamSchema) {}
