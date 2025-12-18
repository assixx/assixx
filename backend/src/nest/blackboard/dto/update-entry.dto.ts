/**
 * Update Blackboard Entry DTO
 *
 * Validation schema for updating blackboard entries.
 * All fields are optional for partial updates.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DateSchema } from '../../../schemas/common.schema.js';

/**
 * Entry status enum
 */
const EntryStatusSchema = z.enum(['active', 'archived'], {
  message: "Status must be 'active' or 'archived'",
});

/**
 * Organization level enum
 */
const OrgLevelSchema = z.enum(['company', 'department', 'team', 'area'], {
  message: 'Organization level must be company, department, team, or area',
});

/**
 * Priority enum
 */
const PrioritySchema = z.enum(['low', 'medium', 'high', 'urgent'], {
  message: 'Priority must be low, medium, high, or urgent',
});

/**
 * Update blackboard entry request body schema
 */
export const UpdateEntrySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title cannot be empty')
    .max(200, 'Title must not exceed 200 characters')
    .optional(),
  content: z
    .string()
    .trim()
    .min(1, 'Content cannot be empty')
    .max(5000, 'Content must not exceed 5000 characters')
    .optional(),
  // Multi-organization support - arrays of IDs
  departmentIds: z.array(z.number().int().positive()).optional(),
  teamIds: z.array(z.number().int().positive()).optional(),
  areaIds: z.array(z.number().int().positive()).optional(),
  // Legacy fields (backwards compatibility)
  orgLevel: OrgLevelSchema.optional(),
  orgId: z.number().int().positive('Organization ID must be positive').nullable().optional(),
  expiresAt: DateSchema.nullable().optional(),
  priority: PrioritySchema.optional(),
  color: z.string().trim().max(50, 'Color cannot exceed 50 characters').optional(),
  status: EntryStatusSchema.optional(),
});

/**
 * Update Entry DTO class
 */
export class UpdateEntryDto extends createZodDto(UpdateEntrySchema) {}
