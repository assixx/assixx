/**
 * Shared Asset Availability Schema
 *
 * Shared Zod enum for asset availability statuses.
 * Used by all asset availability DTOs.
 */
import { z } from 'zod';

/**
 * Asset availability status enum (matches DB enum asset_availability_status)
 */
export const AssetAvailabilityStatusSchema = z.enum([
  'operational',
  'maintenance',
  'repair',
  'standby',
  'cleaning',
  'other',
]);

export type AssetAvailabilityStatus = z.infer<typeof AssetAvailabilityStatusSchema>;
