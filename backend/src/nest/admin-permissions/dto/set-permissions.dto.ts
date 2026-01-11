/**
 * Set Permissions DTO
 *
 * Set department/group permissions (POST /)
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DefaultPermissions, PermissionSetSchema } from './permission-set.schema.js';

export const SetPermissionsSchema = z.object({
  adminId: z.number().int().positive('Admin ID must be a positive integer'),
  departmentIds: z.array(z.number().int().positive()).optional().default([]),
  groupIds: z.array(z.number().int().positive()).optional().default([]),
  permissions: PermissionSetSchema.optional().default(DefaultPermissions),
});

export class SetPermissionsDto extends createZodDto(SetPermissionsSchema) {}
