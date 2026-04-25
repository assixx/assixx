/**
 * Consume Escrow Unlock Ticket DTO
 *
 * Validates the UUIDv7 ticket ID presented by the subdomain after a
 * cross-origin login handoff. UUIDv7 format: 8-4-4-4-12 hex digits with
 * hyphens (36 chars total). Regex-enforced to reject tampered or
 * malformed identifiers before they hit Redis.
 *
 * @see ADR-022 / ADR-050
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** UUID (any version, lowercase hex) — same shape used elsewhere for oauth state/handoff tickets. */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const ConsumeEscrowUnlockTicketSchema = z.object({
  ticketId: z
    .string()
    .trim()
    .length(36, 'Ticket ID must be a 36-character UUID')
    .regex(UUID_REGEX, 'Ticket ID must be a valid UUID'),
});

export class ConsumeEscrowUnlockTicketDto extends createZodDto(ConsumeEscrowUnlockTicketSchema) {}
