/**
 * Work Orders — List Query DTO
 *
 * Validates query parameters for GET /work-orders and GET /work-orders/my.
 * All filter fields optional, pagination required.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  LimitSchema,
  PageSchema,
  WorkOrderPrioritySchema,
  WorkOrderSourceTypeSchema,
  WorkOrderStatusSchema,
} from './common.dto.js';

/** Accepted values for the isActive filter query parameter */
const IsActiveFilterSchema = z.enum(['active', 'archived', 'all'], {
  message: 'Ungültiger is_active Filter (active | archived | all)',
});

export const ListWorkOrdersQuerySchema = z.object({
  status: WorkOrderStatusSchema.optional(),
  priority: WorkOrderPrioritySchema.optional(),
  sourceType: WorkOrderSourceTypeSchema.optional(),
  sourceUuid: z.uuid().optional(),
  assigneeUuid: z.uuid().optional(),
  isActive: IsActiveFilterSchema.optional(),
  /** Filter: only overdue items (due_date < today AND status not done). Send "true" to enable. */
  overdue: z.enum(['true']).optional(),
  page: PageSchema,
  limit: LimitSchema,
});

export class ListWorkOrdersQueryDto extends createZodDto(ListWorkOrdersQuerySchema) {}
