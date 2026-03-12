/**
 * Upsert User Permissions DTO
 *
 * Validates the structure of permission upsert requests.
 * Business validation (addonCode/moduleCode existence) happens in the service,
 * because Zod schemas have no access to PermissionRegistryService.
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Single permission entry for one addon module */
export const PermissionEntrySchema = z.object({
  addonCode: z
    .string()
    .min(1, 'addonCode must not be empty')
    .max(50, 'addonCode must not exceed 50 characters'),
  moduleCode: z
    .string()
    .min(1, 'moduleCode must not be empty')
    .max(50, 'moduleCode must not exceed 50 characters'),
  canRead: z.boolean(),
  canWrite: z.boolean(),
  canDelete: z.boolean(),
});

/** Request body: array of permission entries */
export const UpsertUserPermissionsSchema = z.object({
  permissions: z
    .array(PermissionEntrySchema)
    .min(1, 'At least one permission entry is required'),
});

export class UpsertUserPermissionsDto extends createZodDto(
  UpsertUserPermissionsSchema,
) {}

/** Inferred type for a single permission entry */
export type PermissionEntry = z.infer<typeof PermissionEntrySchema>;
