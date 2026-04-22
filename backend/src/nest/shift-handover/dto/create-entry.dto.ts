/**
 * Shift Handover — Create Entry Body DTO.
 *
 * Request body for `POST /shift-handover/entries`. Service uses the triple
 * `(teamId, shiftDate, shiftKey)` together with the request's tenantId
 * (from CLS) to `getOrCreateDraft` — the composite UNIQUE on the DB table
 * makes the endpoint idempotent for the same triple.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { idField } from '../../common/dto/index.js';
import { ShiftDateSchema, ShiftKeySchema } from './common.dto.js';

export const CreateEntrySchema = z.object({
  teamId: idField,
  shiftDate: ShiftDateSchema,
  shiftKey: ShiftKeySchema,
});

export class CreateEntryDto extends createZodDto(CreateEntrySchema) {}
