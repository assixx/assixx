/**
 * Chat User DTOs
 * Zod-based validation for chat user operations
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MIN_SEARCH_LENGTH = 2;

// ============================================================
// QUERY SCHEMAS
// ============================================================

export const GetUsersQuerySchema = z.object({
  search: z
    .string()
    .min(MIN_SEARCH_LENGTH, `Search term must be at least ${MIN_SEARCH_LENGTH} characters`)
    .optional(),
});

export class GetUsersQueryDto extends createZodDto(GetUsersQuerySchema) {}

// Type exports
export type GetUsersQuery = z.infer<typeof GetUsersQuerySchema>;
