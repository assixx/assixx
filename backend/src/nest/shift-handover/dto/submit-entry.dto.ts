/**
 * Shift Handover — Submit Entry DTO.
 *
 * `POST /shift-handover/entries/:id/submit` carries no body in V1. The
 * DTO is kept for consistency with other mutation endpoints and leaves
 * room for a compliance-attestation field later (e.g. `confirmed: true`)
 * without breaking the wire format.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SubmitEntrySchema = z.object({}).strict();
export class SubmitEntryDto extends createZodDto(SubmitEntrySchema) {}
