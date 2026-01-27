/**
 * Check User Role DTO
 *
 * Validation schema for checking a user's role.
 * CRITICAL: Only admin/root can use this endpoint.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { RoleEnumSchema } from './role-id-param.dto.js';

/**
 * Check user role request body schema
 */
export const CheckUserRoleSchema = z.object({
  userId: z
    .number()
    .int('User ID must be an integer')
    .positive('User ID must be positive'),
  requiredRole: RoleEnumSchema,
});

/**
 * Check User Role DTO class
 */
export class CheckUserRoleDto extends createZodDto(CheckUserRoleSchema) {}
