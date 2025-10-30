/**
 * Teams API v2 Validation with Zod
 * Replaces express-validator with Zod for team endpoints
 */
import { z } from 'zod';

import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.zod.js';
import { IdSchema } from '../../../schemas/common.schema.js';

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * List teams query parameters
 */
export const ListTeamsQuerySchema = z.object({
  departmentId: IdSchema.optional(),
  search: z
    .string()
    .trim()
    .min(1, 'Search term must be at least 1 character')
    .max(100, 'Search term must not exceed 100 characters')
    .optional(),
  includeMembers: z.preprocess(
    (val: unknown) =>
      val === 'true' ? true
      : val === 'false' ? false
      : val,
    z.boolean().optional(),
  ),
});

// ============================================================
// PARAM SCHEMAS
// ============================================================

/**
 * Team ID parameter validation
 */
export const TeamIdParamSchema = z.object({
  id: IdSchema,
});

/**
 * Team ID and User ID parameter validation
 */
export const TeamUserParamSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
});

/**
 * Team ID and Machine ID parameter validation
 */
export const TeamMachineParamSchema = z.object({
  id: IdSchema,
  machineId: IdSchema,
});

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * Create team request body
 */
export const CreateTeamBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Team name must be at least 2 characters')
    .max(100, 'Team name must not exceed 100 characters'),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional(),
  departmentId: z.number().int().positive('Department ID must be a positive integer').optional(),
  leaderId: z.number().int().positive('Leader ID must be a positive integer').optional(),
});

/**
 * Update team request body (all fields optional)
 * Supports nullable values for departmentId and leaderId
 */
export const UpdateTeamBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Team name must be at least 2 characters')
    .max(100, 'Team name must not exceed 100 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be null or a string with max 500 characters')
    .nullable()
    .optional(),
  departmentId: z
    .number()
    .int()
    .positive('Department ID must be a positive integer')
    .nullable()
    .optional(),
  leaderId: z.number().int().positive('Leader ID must be a positive integer').nullable().optional(),
  status: z
    .enum(['active', 'inactive'], {
      message: 'Status must be either "active" or "inactive"',
    })
    .optional(),
});

/**
 * Add member request body
 */
export const AddMemberBodySchema = z.object({
  userId: z.number().int().positive('User ID must be a positive integer'),
});

/**
 * Add machine request body
 */
export const AddMachineBodySchema = z.object({
  machineId: z.number().int().positive('Machine ID must be a positive integer'),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type ListTeamsQuery = z.infer<typeof ListTeamsQuerySchema>;
export type TeamIdParam = z.infer<typeof TeamIdParamSchema>;
export type TeamUserParam = z.infer<typeof TeamUserParamSchema>;
export type TeamMachineParam = z.infer<typeof TeamMachineParamSchema>;
export type CreateTeamBody = z.infer<typeof CreateTeamBodySchema>;
export type UpdateTeamBody = z.infer<typeof UpdateTeamBodySchema>;
export type AddMemberBody = z.infer<typeof AddMemberBodySchema>;
export type AddMachineBody = z.infer<typeof AddMachineBodySchema>;

// ============================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================

/**
 * Pre-configured validation middleware for team routes
 */
export const teamsValidationZod = {
  list: validateQuery(ListTeamsQuerySchema),
  getById: validateParams(TeamIdParamSchema),
  create: validateBody(CreateTeamBodySchema),
  update: [validateParams(TeamIdParamSchema), validateBody(UpdateTeamBodySchema)],
  delete: validateParams(TeamIdParamSchema),
  getMembers: validateParams(TeamIdParamSchema),
  addMember: [validateParams(TeamIdParamSchema), validateBody(AddMemberBodySchema)],
  removeMember: validateParams(TeamUserParamSchema),
  addMachine: [validateParams(TeamIdParamSchema), validateBody(AddMachineBodySchema)],
  removeMachine: validateParams(TeamMachineParamSchema),
};
