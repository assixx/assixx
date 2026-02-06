/**
 * Get Messages Query DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MAX_SEARCH_LENGTH = 200;
const MAX_PAGE_LIMIT = 100;

const BooleanQuerySchema = z
  .union([
    z.boolean(),
    z.string().transform((val: string): boolean => val === 'true'),
  ])
  .optional();

export const GetMessagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'Invalid page number').optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_LIMIT, `Limit must be between 1 and ${MAX_PAGE_LIMIT}`)
    .optional(),
  search: z.string().max(MAX_SEARCH_LENGTH).optional(),
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
  hasAttachment: BooleanQuerySchema,
});

export class GetMessagesQueryDto extends createZodDto(GetMessagesQuerySchema) {}

// Type export
export type GetMessagesQuery = z.infer<typeof GetMessagesQuerySchema>;
