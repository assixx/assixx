/**
 * Role ID Param DTO
 *
 * Validation schema for role ID route parameter.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Valid role enum
 */
export const RoleEnumSchema = z.enum(['admin', 'employee', 'root'], {
  message: 'Invalid role. Must be admin, employee, or root',
});

/**
 * Role ID parameter schema
 */
export const RoleIdParamSchema = z.object({
  id: RoleEnumSchema,
});

/**
 * Role ID Param DTO class
 */
export class RoleIdParamDto extends createZodDto(RoleIdParamSchema) {}

/**
 * RoleName type export
 */
export type RoleName = z.infer<typeof RoleEnumSchema>;
