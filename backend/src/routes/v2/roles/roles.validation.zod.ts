/**
 * Roles Route Validation Schemas
 * SECURITY: Validates role management endpoints to prevent privilege escalation
 */
import { z } from 'zod';

/**
 * Valid role enum
 */
export const RoleEnum = z.enum(['admin', 'employee', 'root'], {
  message: 'Invalid role. Must be admin, employee, or root',
});

/**
 * Role ID parameter validation
 */
export const RoleIdParamSchema = z.object({
  id: RoleEnum,
});

/**
 * Check user role request body validation
 * CRITICAL: Validates role check to prevent unauthorized access checks
 */
export const CheckUserRoleSchema = z.object({
  userId: z
    .number()
    .int('User ID must be an integer')
    .positive('User ID must be positive')
    .describe('The user ID to check'),

  requiredRole: RoleEnum.describe('The role to check for'),
});

/**
 * Assign role request body validation
 * For future use when role assignment is implemented
 */
export const AssignRoleSchema = z.object({
  userId: z
    .number()
    .int('User ID must be an integer')
    .positive('User ID must be positive')
    .describe('The user to assign role to'),

  role: RoleEnum.describe('The role to assign'),

  reason: z
    .string()
    .min(1, 'Reason is required')
    .max(255, 'Reason too long')
    .optional()
    .describe('Optional reason for role assignment'),
});

// ========================================
// TYPE EXPORTS
// ========================================

export type RoleIdParam = z.infer<typeof RoleIdParamSchema>;
export type CheckUserRoleBody = z.infer<typeof CheckUserRoleSchema>;
export type AssignRoleBody = z.infer<typeof AssignRoleSchema>;
export type Role = z.infer<typeof RoleEnum>;
