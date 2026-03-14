/**
 * Update Team DTO
 *
 * Validation schema for updating teams.
 * Status: 0=inactive, 1=active, 3=archived, 4=deleted
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Update team request body schema (all fields optional)
 */
export const UpdateTeamSchema = z.object({
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
  deputyLeaderId: z.coerce
    .number()
    .int()
    .positive('Deputy Leader ID must be a positive integer')
    .nullable()
    .optional(),
  isActive: z.coerce.number().int().min(0).max(4).optional(),
});

/**
 * Update Team DTO class
 */
export class UpdateTeamDto extends createZodDto(UpdateTeamSchema) {}
