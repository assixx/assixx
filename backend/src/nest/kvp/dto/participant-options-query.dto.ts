/**
 * KVP Participant Options Query DTO
 *
 * Query schema for `GET /api/v2/kvp/participants/options`. Backs the server-
 * side search that populates the ParticipantChips dropdown in the KVP-create
 * modal (see docs/FEAT_KVP_PARTICIPANTS_MASTERPLAN.md §2.4).
 *
 * Tenant-wide search by design (Q3 in masterplan §0): a participant tag is a
 * reference, not a management action — ADR-036 scope does not apply. RLS
 * (ADR-019) remains the security boundary.
 *
 * Validation library: Zod via nestjs-zod (sole validation library, ADR-030).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Query parameters:
 * - `q`     — optional search term, trimmed, max 100 chars. Empty / omitted
 *             yields the top 50 of each enabled type.
 * - `types` — optional comma-separated subset of {user,team,department,area}
 *             to narrow the search. Parsing of the CSV happens in the service
 *             layer; the DTO keeps the raw string to leave parsing strategy
 *             open (e.g. case-insensitive matching, whitespace tolerance).
 *
 * Hard-cap of 50 results per type is enforced by the service, not the schema
 * (no client-supplied `limit` — caps are server policy, masterplan R3).
 */
export const ParticipantOptionsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  types: z.string().optional(),
});

/**
 * NestJS DTO class. Used by the global ZodValidationPipe via the static
 * `.schema` property (nestjs-zod / ADR-030).
 */
export class ParticipantOptionsQueryDto extends createZodDto(ParticipantOptionsQuerySchema) {}
