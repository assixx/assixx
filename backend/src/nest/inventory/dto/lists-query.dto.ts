/**
 * Lists Query DTO
 *
 * Optional `tagIds` filter for GET /inventory/lists. The query string
 * accepts comma-separated UUIDs (e.g. `?tagIds=uuid1,uuid2`) which Zod
 * splits and validates. Empty / missing → no tag filter, all lists.
 *
 * Filter semantics: OR — a list matches if it has at least one of the
 * supplied tags. Matches typical multi-select chip UX.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ListsQuerySchema = z.object({
  tagIds: z
    .string()
    .trim()
    .min(1)
    .optional()
    .transform((value: string | undefined): string[] | undefined => {
      if (value === undefined) return undefined;
      const parts = value
        .split(',')
        .map((part: string): string => part.trim())
        .filter((part: string): boolean => part !== '');
      return parts.length === 0 ? undefined : parts;
    })
    .pipe(z.array(z.uuid('Ungültige Tag-UUID')).optional()),
});

export class ListsQueryDto extends createZodDto(ListsQuerySchema) {}
