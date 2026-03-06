/**
 * Asset Availability Range Query DTO
 *
 * Query parameters for fetching asset availability entries
 * that overlap with a given date range (used by shift planning).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const AssetAvailabilityRangeQuerySchema = z.object({
  startDate: z
    .string()
    .regex(DATE_REGEX, 'startDate must be YYYY-MM-DD format'),
  endDate: z.string().regex(DATE_REGEX, 'endDate must be YYYY-MM-DD format'),
});

export class AssetAvailabilityRangeQueryDto extends createZodDto(
  AssetAvailabilityRangeQuerySchema,
) {}
