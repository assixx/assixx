/**
 * Role Switch Route Validation Schemas
 * SECURITY: Ensures no unexpected parameters are sent to role switch endpoints
 */
import { z } from 'zod';

/**
 * Empty body validation
 * CRITICAL: Role switch endpoints should not accept any body parameters
 * All role information comes from authenticated JWT token
 */
export const EmptyBodySchema = z
  .object({})
  .strict() // Reject any unexpected properties
  .describe('Role switch endpoints must have empty request body');

/**
 * Role switch status response schema (for type safety)
 */
export const RoleSwitchStatusResponseSchema = z.object({
  currentRole: z.enum(['admin', 'employee', 'root']),
  originalRole: z.enum(['admin', 'employee', 'root']).optional(),
  canSwitch: z.boolean(),
  availableRoles: z.array(z.enum(['admin', 'employee', 'root'])),
});

// ========================================
// TYPE EXPORTS
// ========================================

export type EmptyBody = z.infer<typeof EmptyBodySchema>;
export type RoleSwitchStatusResponse = z.infer<typeof RoleSwitchStatusResponseSchema>;
