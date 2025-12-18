/**
 * Admin Department Param DTO
 *
 * Validates adminId and departmentId path parameters.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AdminDepartmentParamSchema = z.object({
  adminId: z.coerce.number().int().positive('Admin ID must be a positive integer'),
  departmentId: z.coerce.number().int().positive('Department ID must be a positive integer'),
});

export class AdminDepartmentParamDto extends createZodDto(AdminDepartmentParamSchema) {}
