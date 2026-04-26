/**
 * KVP Participant DTO
 *
 * Polymorphic schema for tagging co-originators ("Beteiligte") of a KVP
 * suggestion. One participant entry references EXACTLY ONE of:
 * user / team / department / area. The `type` discriminator selects the
 * referenced entity table; the matching FK column is set in the database row
 * and enforced by the `exactly_one_target` CHECK constraint on
 * `kvp_participants` (see migration 20260425234025136_add-kvp-participants.ts).
 *
 * V1 semantics (locked in 2026-04-26): informational only — no permission
 * grant, no notification trigger, no creator-bypass extension. See
 * docs/FEAT_KVP_PARTICIPANTS_MASTERPLAN.md §0 (Q2) and Known Limitations §3.
 *
 * Validation library: Zod via nestjs-zod (sole validation library, ADR-030).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { idField } from '../../common/dto/index.js';

/**
 * One participant entry. `type` discriminates the entity table.
 * `id` uses the central `idField` factory (ADR-030 §5) instead of inline
 * `z.coerce.number()` to keep coercion semantics centralized.
 */
export const ParticipantSchema = z.object({
  type: z.enum(['user', 'team', 'department', 'area']),
  id: idField,
});
export type Participant = z.infer<typeof ParticipantSchema>;

/**
 * Used as nested field on CreateSuggestionDto (V1).
 *
 * Hard cap at 100 entries — anything beyond that is product abuse, not a
 * legitimate use case. Aligns with the masterplan's deliberate scope cap
 * (FEAT_KVP_PARTICIPANTS_MASTERPLAN.md §2.1).
 *
 * UpdateSuggestionDto deliberately does NOT accept `participants` in V1
 * (no Edit UI exists; see masterplan Known Limitations §1). When an Edit
 * UI lands, extend UpdateSuggestionDto with `.optional()` (NO `.default([])`)
 * and gate the service call on `dto.participants !== undefined` to avoid
 * silently clearing the list on PATCH calls that omit the field.
 */
export const ParticipantsArraySchema = z.array(ParticipantSchema).max(100);

/**
 * NestJS DTO class. Used by the global ZodValidationPipe via the static
 * `.schema` property (nestjs-zod / ADR-030).
 */
export class ParticipantDto extends createZodDto(ParticipantSchema) {}
