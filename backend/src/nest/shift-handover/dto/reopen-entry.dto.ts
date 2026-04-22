/**
 * Shift Handover — Reopen Entry Body DTO.
 *
 * Team-Lead-only endpoint (plan §2.5). `reason` is mandatory and
 * persisted to `shift_handover_entries.reopen_reason` for the audit
 * trail (plan §Product Decisions #5).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ReopenEntrySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export class ReopenEntryDto extends createZodDto(ReopenEntrySchema) {}
