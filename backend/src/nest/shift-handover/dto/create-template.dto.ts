/**
 * Shift Handover — Create/Upsert Template Body DTO.
 *
 * `PUT /shift-handover/templates/:teamId` is idempotent upsert (plan §2.2);
 * this DTO is the body shape used for both create and update paths. The
 * `fields` array is validated by the shared-package schema which enforces
 * per-field invariants plus the 30-field cap and duplicate-key rejection.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ShiftHandoverTemplateFieldsSchema } from './common.dto.js';

export const CreateTemplateSchema = z.object({
  fields: ShiftHandoverTemplateFieldsSchema,
});

export class CreateTemplateDto extends createZodDto(CreateTemplateSchema) {}
