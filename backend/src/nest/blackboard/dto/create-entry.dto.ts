/**
 * Create Blackboard Entry DTO
 *
 * Validation schema for creating blackboard entries.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DateSchema } from '../../../schemas/common.schema.js';

/**
 * Organization level enum for entry visibility
 */
const OrgLevelSchema = z.enum(['company', 'department', 'team', 'area'], {
  message: 'Organization level must be company, department, team, or area',
});

/**
 * Priority enum for entry importance
 */
const PrioritySchema = z.enum(['low', 'medium', 'high', 'urgent'], {
  message: 'Priority must be low, medium, high, or urgent',
});

/**
 * Create blackboard entry request body schema
 */
export const CreateEntrySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must not exceed 200 characters'),
  content: z
    .string()
    .trim()
    .min(1, 'Content is required')
    .max(5000, 'Content must not exceed 5000 characters'),
  // Multi-organization support - arrays of IDs
  departmentIds: z.array(z.number().int().positive()).optional().default([]),
  teamIds: z.array(z.number().int().positive()).optional().default([]),
  areaIds: z.array(z.number().int().positive()).optional().default([]),
  // Legacy fields (backwards compatibility)
  orgLevel: OrgLevelSchema.optional(),
  orgId: z.number().int().positive('Organization ID must be positive').nullable().optional(),
  expiresAt: DateSchema.nullable().optional(),
  priority: PrioritySchema.optional(),
  color: z.string().trim().max(50, 'Color cannot exceed 50 characters').optional(),
});

/**
 * Create Entry DTO class
 */
export class CreateEntryDto extends createZodDto(CreateEntrySchema) {}
