/**
 * Shift Handover — Update Draft Entry Body DTO.
 *
 * `PATCH /shift-handover/entries/:id` — both fields optional so the
 * caller can send either or both. `customValues` is shape-validated
 * against the template's dynamic Zod schema inside the service (the
 * static DTO here permits any record; the dynamic schema tightens it).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateEntrySchema = z.object({
  protocolText: z.string().max(20_000).optional(),
  customValues: z.record(z.string(), z.unknown()).optional(),
});

export class UpdateEntryDto extends createZodDto(UpdateEntrySchema) {}
