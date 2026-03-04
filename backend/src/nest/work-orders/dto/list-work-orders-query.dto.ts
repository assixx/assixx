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

export const ListWorkOrdersQuerySchema = z.object({
  status: WorkOrderStatusSchema.optional(),
  priority: WorkOrderPrioritySchema.optional(),
  sourceType: WorkOrderSourceTypeSchema.optional(),
  assigneeUuid: z.uuid().optional(),
  page: PageSchema,
  limit: LimitSchema,
});

export class ListWorkOrdersQueryDto extends createZodDto(
  ListWorkOrdersQuerySchema,
) {}
