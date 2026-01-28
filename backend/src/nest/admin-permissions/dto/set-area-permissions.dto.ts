/**
 * Set Area Permissions DTO
 *
 * Set area permissions (POST /:userId/areas)
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  DefaultPermissions,
  PermissionSetSchema,
} from './permission-set.schema.js';

export const SetAreaPermissionsSchema = z.object({
  // Empty array = remove all area permissions for this admin
  areaIds: z.array(z.number().int().positive()),
  permissions: PermissionSetSchema.optional().default(DefaultPermissions),
});

export class SetAreaPermissionsDto extends createZodDto(
  SetAreaPermissionsSchema,
) {}
