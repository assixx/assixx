/**
 * Mark Feature Visited DTO
 *
 * Validation schema for marking a feature as visited.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Supported features for visit tracking
 */
export const FeatureSchema = z.enum(['calendar', 'kvp', 'surveys'], {
  message: 'Feature must be calendar, kvp, or surveys',
});

export type Feature = z.infer<typeof FeatureSchema>;

/**
 * Mark visited request body schema
 */
export const MarkVisitedSchema = z.object({
  feature: FeatureSchema,
});

/**
 * Mark Visited DTO class
 */
export class MarkVisitedDto extends createZodDto(MarkVisitedSchema) {}
