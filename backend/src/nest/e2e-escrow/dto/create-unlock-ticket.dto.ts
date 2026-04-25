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

/**
 * Argon2id params — same bounds as `store-escrow.dto.ts`. Duplicated inline
 * (rather than imported) because (a) the validation surface here is limited
 * to the bootstrap branch and (b) `store-escrow.dto.ts` does not export the
 * sub-schema. KISS — divergence is unlikely (the params are RFC 9106 bounds).
 */
const Argon2ParamsSchema = z.object({
  memory: z
    .number()
    .int()
    .min(16384, 'Argon2 memory must be at least 16 MiB')
    .max(1048576, 'Argon2 memory must be at most 1 GiB'),
  iterations: z
    .number()
    .int()
    .min(1, 'Argon2 iterations must be at least 1')
    .max(100, 'Argon2 iterations must be at most 100'),
  parallelism: z
    .number()
    .int()
    .min(1, 'Argon2 parallelism must be at least 1')
    .max(16, 'Argon2 parallelism must be at most 16'),
});

/** Base64-encoded 32-byte salt — identical bounds to `store-escrow.dto.ts`. */
const Argon2SaltSchema = z
  .string()
  .trim()
  .min(40, 'Argon2 salt too short for 32-byte base64')
  .max(50, 'Argon2 salt too long for 32-byte base64')
  .refine(
    (val: string) => {
      try {
        return Buffer.from(val, 'base64').length === 32;
      } catch {
        return false;
      }
    },
    { message: 'Argon2 salt must be a valid base64-encoded 32-byte value' },
  );

/**
 * Body for `POST /e2e/escrow/unlock-ticket`.
 *
 * Two shapes accepted, discriminated by the optional bootstrap fields:
 *
 *   1. **Unlock ticket** (default): `{ wrappingKey }`. Used when an escrow
 *      blob already exists on the server — the apex client derived the
 *      wrappingKey from `(password, escrow.argon2Salt, escrow.argon2Params)`
 *      and the subdomain will use it to unwrap the existing blob.
 *
 *   2. **Bootstrap ticket**: `{ wrappingKey, argon2Salt, argon2Params }`.
 *      Used when no escrow exists yet — the apex client minted a fresh
 *      salt and derived the wrappingKey from `(password, fresh_salt)`.
 *      The subdomain will create the user's first escrow blob using the
 *      same salt + params (so future logins can unwrap with the same
 *      password). See ADR-022 §"New-user scenario".
 *
 * `argon2Salt` and `argon2Params` MUST be set together or both omitted —
 * a half-bootstrap payload is rejected (cross-field refine below).
 */
export const CreateEscrowUnlockTicketSchema = z
  .object({
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
    argon2Salt: Argon2SaltSchema.optional(),
    argon2Params: Argon2ParamsSchema.optional(),
  })
  .refine(
    // ADR-041 exactOptionalPropertyTypes: optional fields must be `T | undefined`,
    // not `T?` — Zod inference produces the explicit-undefined shape.
    (val: {
      wrappingKey: string;
      argon2Salt?: string | undefined;
      argon2Params?: { memory: number; iterations: number; parallelism: number } | undefined;
    }): boolean => (val.argon2Salt === undefined) === (val.argon2Params === undefined),
    {
      message:
        'argon2Salt and argon2Params must be set together (bootstrap) or both omitted (unlock)',
      path: ['argon2Salt'],
    },
  );

export class CreateEscrowUnlockTicketDto extends createZodDto(CreateEscrowUnlockTicketSchema) {}
