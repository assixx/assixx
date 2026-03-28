/**
 * Create Team DTO
 *
 * Validation schema for creating new teams.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Create team request body schema
 */
export const CreateTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Team name must be at least 2 characters')
    .max(100, 'Team name must not exceed 100 characters'),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional(),
  departmentId: z.coerce
    .number()
    .int()
    .positive('Department ID must be a positive integer')
    .nullable()
    .optional(),
  leaderId: z.coerce
    .number()
    .int()
    .positive('Leader ID must be a positive integer')
    .nullable()
    .optional(),
});

/**
 * Create Team DTO class
 */
export class CreateTeamDto extends createZodDto(CreateTeamSchema) {}
