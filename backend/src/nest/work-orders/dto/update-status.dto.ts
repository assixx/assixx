/**
 * Work Orders — Update Status DTO
 *
 * Validates request body for PATCH /work-orders/:uuid/status.
 * Status transitions are validated in the service layer, not here.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { WorkOrderStatusSchema } from './common.dto.js';

export const UpdateStatusSchema = z.object({
  status: WorkOrderStatusSchema,
});

export class UpdateStatusDto extends createZodDto(UpdateStatusSchema) {}
