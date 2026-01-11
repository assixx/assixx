/**
 * List Logs Query DTO
 *
 * Query parameters for fetching system logs.
 * Uses Zod for runtime validation.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DateSchema, IdSchema, PaginationSchema } from '../../../schemas/common.schema.js';

/**
 * List logs query schema
 */
export const ListLogsQuerySchema = PaginationSchema.extend({
  userId: IdSchema.optional(),
  tenantId: IdSchema.optional(),
  action: z.string().trim().min(1, 'Action must be a non-empty string').optional(),
  entityType: z.string().trim().min(1, 'Entity type must be a non-empty string').optional(),
  startDate: DateSchema.optional(),
  endDate: DateSchema.optional(),
  search: z.string().trim().optional(),
  offset: z.preprocess(
    (val: unknown) => (typeof val === 'string' ? Number.parseInt(val, 10) : val),
    z.number().int().min(0, 'Offset must be a non-negative integer').optional(),
  ),
});

/**
 * DTO for list logs query parameters
 */
export class ListLogsQueryDto extends createZodDto(ListLogsQuerySchema) {}

/**
 * Response type for logs list
 */
export interface LogsResponse {
  id: number;
  tenantId: number;
  tenantName?: string;
  userId: number;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  userFirstName?: string;
  userLastName?: string;
  employeeNumber?: string;
  departmentName?: string;
  areaName?: string;
  teamName?: string;
  action: string;
  entityType?: string;
  entityId?: number;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  wasRoleSwitched: boolean;
  createdAt: string;
}

/**
 * Pagination meta for logs response
 */
export interface LogsPaginationMeta {
  total: number;
  page: number;
  limit: number;
  offset: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Full response type for logs list endpoint
 */
export interface LogsListResponseData {
  logs: LogsResponse[];
  pagination: LogsPaginationMeta;
}
