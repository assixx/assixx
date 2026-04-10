/**
 * Tag ID Path Parameter DTO
 *
 * Validates `:tagId` route parameters as UUIDs.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const TagIdParamSchema = z.object({
  tagId: z.uuid('Ungültige Tag-UUID'),
});

export class TagIdParamDto extends createZodDto(TagIdParamSchema) {}
