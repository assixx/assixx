/**
 * Get Audit Stats DTO
 *
 * Query parameters for fetching audit statistics.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DateSchema } from '../../../schemas/common.schema.js';

/**
 * Get statistics query schema
 */
export const GetStatsQuerySchema = z.object({
  dateFrom: DateSchema.optional(),
  dateTo: DateSchema.optional(),
});

/**
 * DTO for get stats query parameters
 */
export class GetStatsQueryDto extends createZodDto(GetStatsQuerySchema) {}

/**
 * Audit statistics response type
 */
export interface AuditStatsResponseData {
  totalEntries: number;
  byAction: Record<string, number>;
  byResourceType: Record<string, number>;
  byUser: { userId: number; userName: string; count: number }[];
  byStatus: { success: number; failure: number };
  timeRange: { from: string; to: string };
}
