/**
 * KVP Comment DTO
 *
 * Validation schema for KVP suggestion comments.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Add comment request body schema
 */
export const AddCommentSchema = z.object({
  comment: z
    .string()
    .trim()
    .min(1, 'Comment is required')
    .max(2000, 'Comment must not exceed 2000 characters'),
  isInternal: z.boolean().optional().default(false),
  parentId: z.number().int().positive().optional(),
});

/**
 * Add Comment DTO class
 */
export class AddCommentDto extends createZodDto(AddCommentSchema) {}
