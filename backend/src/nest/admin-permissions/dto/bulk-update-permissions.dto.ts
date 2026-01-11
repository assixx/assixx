/**
 * Bulk Update Permissions DTO
 *
 * Bulk update permissions (POST /bulk)
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DefaultPermissions, PermissionSetSchema } from './permission-set.schema.js';

export const BulkUpdatePermissionsSchema = z.object({
  adminIds: z.array(z.number().int().positive()).min(1, 'At least one admin ID is required'),
  operation: z.enum(['assign', 'remove']),
  departmentIds: z.array(z.number().int().positive()).optional(),
  groupIds: z.array(z.number().int().positive()).optional(),
  permissions: PermissionSetSchema.optional().default(DefaultPermissions),
});

export class BulkUpdatePermissionsDto extends createZodDto(BulkUpdatePermissionsSchema) {}
