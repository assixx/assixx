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
 * List logs query schema.
 *
 * `offset` ist nicht mehr separat überschrieben — `PaginationSchema` aus
 * `common.schema.ts` definiert es bereits korrekt via `z.coerce.number()`.
 * Der frühere lokale `z.preprocess`-Override war redundant + verstieß gegen
 * ADR-030 §4 ("z.coerce over z.preprocess"). Entfernt 2026-04-30 zusammen
 * mit dem PaginationSchema-Fix für den Zod-3→4-Regression-Bug.
 */
export const ListLogsQuerySchema = PaginationSchema.extend({
  userId: IdSchema.optional(),
  tenantId: IdSchema.optional(),
  action: z.string().trim().min(1, 'Action must be a non-empty string').optional(),
  entityType: z.string().trim().min(1, 'Entity type must be a non-empty string').optional(),
  startDate: DateSchema.optional(),
  endDate: DateSchema.optional(),
  search: z.string().trim().optional(),
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
