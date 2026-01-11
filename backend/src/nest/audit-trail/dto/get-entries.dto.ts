/**
 * Get Audit Entries DTO
 *
 * Query parameters for fetching audit trail entries.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DateSchema, IdSchema, PaginationSchema } from '../../../schemas/common.schema.js';

/**
 * Audit trail status enum
 */
const AuditStatusSchema = z.enum(['success', 'failure'], {
  message: 'Status must be success or failure',
});

/**
 * Sort field enum for audit entries
 */
const SortBySchema = z.enum(['created_at', 'action', 'user_id', 'resource_type'], {
  message: 'Invalid sort field',
});

/**
 * Get audit entries query schema
 */
export const GetEntriesQuerySchema = PaginationSchema.extend({
  userId: IdSchema.optional(),
  action: z.string().trim().optional(),
  resourceType: z.string().trim().optional(),
  resourceId: IdSchema.optional(),
  status: AuditStatusSchema.optional(),
  dateFrom: DateSchema.optional(),
  dateTo: DateSchema.optional(),
  search: z.string().trim().optional(),
  sortBy: SortBySchema.optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * DTO for get entries query parameters
 */
export class GetEntriesQueryDto extends createZodDto(GetEntriesQuerySchema) {}

/**
 * Audit entry response type
 */
export interface AuditEntryResponse {
  id: number;
  tenantId: number;
  userId: number;
  userName?: string;
  userRole?: string;
  action: string;
  resourceType: string;
  resourceId?: number;
  resourceName?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure';
  errorMessage?: string;
  createdAt: string;
}

/**
 * Pagination response type
 */
export interface AuditPaginationResponse {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/**
 * Full response type for entries list
 */
export interface GetEntriesResponseData {
  entries: AuditEntryResponse[];
  pagination: AuditPaginationResponse;
}
