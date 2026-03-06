/**
 * Asset Availability History Query DTO
 *
 * Query parameters for fetching asset availability history.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Query parameters for asset availability history
 */
export const AssetAvailabilityHistoryQuerySchema = z.object({
  year: z
    .string()
    .regex(/^\d{4}$/, 'Year must be 4 digits')
    .optional(),
  month: z
    .string()
    .regex(/^(0[1-9]|1[0-2])$/, 'Month must be 01-12')
    .optional(),
});

export class AssetAvailabilityHistoryQueryDto extends createZodDto(
  AssetAvailabilityHistoryQuerySchema,
) {}

/**
 * Single asset availability history entry (response)
 */
export interface AssetAvailabilityHistoryEntry {
  id: number;
  assetId: number;
  status: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  notes: string | null;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Asset availability history response
 */
export interface AssetAvailabilityHistoryResponse {
  asset: {
    id: number;
    uuid: string;
    name: string;
  };
  entries: AssetAvailabilityHistoryEntry[];
  meta: {
    total: number;
    year: number | null;
    month: number | null;
  };
}
