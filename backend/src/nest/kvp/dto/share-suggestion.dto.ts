/**
 * Share KVP Suggestion DTO
 *
 * Validation schema for sharing KVP suggestions at organization level.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Organization level enum
 */
const OrgLevelSchema = z.enum(['company', 'department', 'area', 'team'], {
  message: 'Organization level must be company, department, area, or team',
});

/**
 * Share suggestion request body schema
 */
export const ShareSuggestionSchema = z.object({
  orgLevel: OrgLevelSchema,
  orgId: z
    .number()
    .int()
    .min(0, 'Organization ID must be a non-negative integer'),
});

/**
 * Share Suggestion DTO class
 */
export class ShareSuggestionDto extends createZodDto(ShareSuggestionSchema) {}
