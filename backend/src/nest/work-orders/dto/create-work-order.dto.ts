/**
 * Work Orders — Create DTO
 *
 * Validates request body for POST /work-orders.
 * Supports both manual creation and TPM defect linkage.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  WorkOrderPrioritySchema,
  WorkOrderSourceTypeSchema,
} from './common.dto.js';

const BaseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Titel darf nicht leer sein')
    .max(500, 'Titel darf maximal 500 Zeichen lang sein'),
  description: z
    .string()
    .trim()
    .max(5000, 'Beschreibung darf maximal 5.000 Zeichen lang sein')
    .nullish(),
  priority: WorkOrderPrioritySchema.default('medium'),
  sourceType: WorkOrderSourceTypeSchema.default('manual'),
  sourceUuid: z.uuid().nullish(),
  dueDate: z.iso.date().nullish(),
  assigneeUuids: z
    .array(z.uuid())
    .max(10, 'Maximal 10 Zuweisungen pro Auftrag')
    .default([]),
});

type BaseInput = z.output<typeof BaseSchema>;

export const CreateWorkOrderSchema = BaseSchema.refine(
  (data: BaseInput): boolean => {
    if (data.sourceType === 'tpm_defect') {
      return data.sourceUuid != null;
    }
    return true;
  },
  {
    message: 'sourceUuid ist erforderlich wenn sourceType "tpm_defect" ist',
    path: ['sourceUuid'],
  },
).refine(
  (data: BaseInput): boolean => {
    if (data.sourceType === 'manual') {
      return data.sourceUuid == null;
    }
    return true;
  },
  {
    message: 'sourceUuid darf nur bei sourceType "tpm_defect" gesetzt werden',
    path: ['sourceUuid'],
  },
);

export class CreateWorkOrderDto extends createZodDto(CreateWorkOrderSchema) {}
