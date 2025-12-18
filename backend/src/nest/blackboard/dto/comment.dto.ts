/**
 * Blackboard Comment DTOs
 *
 * Validation schemas for blackboard entry comments.
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
    .max(5000, 'Comment must not exceed 5000 characters'),
  isInternal: z.boolean().optional().default(false),
});

/**
 * Add Comment DTO class
 */
export class AddCommentDto extends createZodDto(AddCommentSchema) {}
