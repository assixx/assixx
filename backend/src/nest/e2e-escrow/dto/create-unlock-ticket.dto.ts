/**
 * Create Escrow Unlock Ticket DTO
 *
 * Validates the client-derived wrapping key uploaded for short-lived Redis
 * storage during cross-origin login handoff.
 *
 * The client (apex origin, during login use:enhance callback) derives the
 * wrappingKey via Argon2id on the user's password + escrow salt, then posts
 * it here. The backend stores it in Redis with a 60s TTL under a UUIDv7
 * ticket ID and returns the ticket ID. The client appends `?unlock=<id>` to
 * the subdomain handoff URL; the subdomain post-login layout consumes the
 * ticket and unwraps the escrow blob client-side — no Argon2id re-derivation
 * on the subdomain (password is no longer available after cross-origin
 * redirect).
 *
 * Bytes rationale: wrappingKey is an XChaCha20 32-byte key encoded as
 * unpadded base64 (43 chars) OR padded base64 (44 chars with `=`). Anything
 * else is tampered input.
 *
 * @see ADR-022 (Escrow design)
 * @see ADR-050 (cross-origin handoff rationale — same reason the existing
 *      `auth/handoff/mint` + `oauth:handoff:` ticket pattern exists)
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateEscrowUnlockTicketSchema = z.object({
  wrappingKey: z
    .string()
    .trim()
    .min(43, 'Wrapping key too short for 32-byte base64')
    .max(44, 'Wrapping key too long for 32-byte base64')
    .refine(
      (val: string) => {
        try {
          return Buffer.from(val, 'base64').length === 32;
        } catch {
          return false;
        }
      },
      { message: 'Wrapping key must be a valid base64-encoded 32-byte value' },
    ),
});

export class CreateEscrowUnlockTicketDto extends createZodDto(CreateEscrowUnlockTicketSchema) {}
