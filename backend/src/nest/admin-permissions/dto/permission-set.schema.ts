/**
 * Permission Set Schema
 *
 * Shared schema for permission flags.
 */
import { z } from 'zod';

export const PermissionSetSchema = z.object({
  canRead: z.boolean().default(true),
  canWrite: z.boolean().default(false),
  canDelete: z.boolean().default(false),
});

export const DefaultPermissions = {
  canRead: true,
  canWrite: false,
  canDelete: false,
} as const;
