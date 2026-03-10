/**
 * Work Orders — Update DTO
 *
 * Validates request body for PATCH /work-orders/:uuid.
 * All fields optional (PATCH semantics). Admin only.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { WorkOrderPrioritySchema } from './common.dto.js';

export const UpdateWorkOrderSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Titel darf nicht leer sein')
    .max(500, 'Titel darf maximal 500 Zeichen lang sein')
    .optional(),
  description: z
    .string()
    .trim()
    .max(5000, 'Beschreibung darf maximal 5.000 Zeichen lang sein')
    .nullable()
    .optional(),
  priority: WorkOrderPrioritySchema.optional(),
  dueDate: z.iso.date().optional(),
});

export class UpdateWorkOrderDto extends createZodDto(UpdateWorkOrderSchema) {}
