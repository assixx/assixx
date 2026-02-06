/**
 * Search Messages Query DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_LENGTH = 200;
const MAX_PAGE_LIMIT = 100;

export const SearchMessagesQuerySchema = z.object({
  q: z
    .string()
    .min(
      MIN_SEARCH_LENGTH,
      `Search query must be at least ${MIN_SEARCH_LENGTH} characters`,
    )
    .max(MAX_SEARCH_LENGTH),
  page: z.coerce.number().int().min(1, 'Invalid page number').optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_LIMIT, `Limit must be between 1 and ${MAX_PAGE_LIMIT}`)
    .optional(),
});

export class SearchMessagesQueryDto extends createZodDto(
  SearchMessagesQuerySchema,
) {}

// Type export
export type SearchMessagesQuery = z.infer<typeof SearchMessagesQuerySchema>;
