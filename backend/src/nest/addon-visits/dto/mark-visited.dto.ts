/**
 * Mark Addon Visited DTO
 *
 * Validation schema for marking an addon as visited.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Addon codes that support visit tracking
 */
export const VisitableAddonSchema = z.enum(['calendar', 'kvp', 'surveys'], {
  message: 'Addon must be calendar, kvp, or surveys',
});

export type VisitableAddon = z.infer<typeof VisitableAddonSchema>;

/**
 * Mark visited request body schema
 */
export const MarkVisitedSchema = z.object({
  addon: VisitableAddonSchema,
});

/**
 * Mark Visited DTO class
 */
export class MarkVisitedDto extends createZodDto(MarkVisitedSchema) {}
