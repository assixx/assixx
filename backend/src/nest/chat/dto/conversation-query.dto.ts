/**
 * Conversation Query DTOs
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MAX_SEARCH_LENGTH = 200;
const MAX_PAGE_LIMIT = 100;

const PageSchema = z.coerce.number().int().min(1, 'Invalid page number').optional();

const LimitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_PAGE_LIMIT, `Limit must be between 1 and ${MAX_PAGE_LIMIT}`)
  .optional();

const SearchSchema = z.string().max(MAX_SEARCH_LENGTH).optional();

const BooleanQuerySchema = z
  .union([z.boolean(), z.string().transform((val: string): boolean => val === 'true')])
  .optional();

export const GetConversationsQuerySchema = z.object({
  page: PageSchema,
  limit: LimitSchema,
  search: SearchSchema,
  isGroup: BooleanQuerySchema,
  hasUnread: BooleanQuerySchema,
});

export class GetConversationsQueryDto extends createZodDto(GetConversationsQuerySchema) {}

// Type exports
export type GetConversationsQuery = z.infer<typeof GetConversationsQuerySchema>;
