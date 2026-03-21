/**
 * Add Member DTO
 *
 * Validation schema for adding members to teams.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Add member request body
 */
export const AddMemberSchema = z.object({
  userId: z.coerce.number().int().positive('User ID must be a positive integer'),
});

/**
 * Add Member DTO class
 */
export class AddMemberDto extends createZodDto(AddMemberSchema) {}
