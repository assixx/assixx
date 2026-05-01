/**
 * Register E2E Keys WITH Escrow DTO
 *
 * Combined payload for the atomic key+escrow registration endpoint
 * (POST /e2e/keys/with-escrow). Both must be present — partial submission
 * is rejected at the schema level so the service layer never sees a
 * degenerate input that would force an inconsistency between the two
 * tables.
 *
 * Why a combined DTO instead of two separate calls:
 * Sequential `POST /e2e/keys` + `POST /e2e/escrow` from the client leaves
 * a race window — if the second call fails (network blip, transient DB
 * error, browser crash), the user lands in `(key, no escrow)` which is
 * irrecoverable without an admin reset. The atomic endpoint forces both
 * inserts into one `tenantTransaction()` so PostgreSQL guarantees they
 * commit together or roll back together.
 *
 * @see ADR-022 (E2E Key Escrow)
 * @see backend/src/nest/e2e-keys/dto/register-keys.dto.ts
 * @see backend/src/nest/e2e-escrow/dto/store-escrow.dto.ts
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { StoreEscrowSchema } from '../../e2e-escrow/dto/store-escrow.dto.js';
import { RegisterKeysSchema } from './register-keys.dto.js';

/**
 * Atomic registration payload: public key + escrow envelope.
 *
 * The escrow object mirrors `StoreEscrowSchema` exactly — the wrappingKey
 * was already derived client-side via Argon2id (apex-derived for
 * cross-origin handoffs, fresh derivation for same-origin first-login)
 * and used to encrypt the private key blob; the server stores the
 * envelope opaquely.
 */
export const RegisterKeysWithEscrowSchema = z.object({
  publicKey: RegisterKeysSchema.shape.publicKey,
  escrow: StoreEscrowSchema,
});

/** DTO class for NestJS pipe validation */
export class RegisterKeysWithEscrowDto extends createZodDto(RegisterKeysWithEscrowSchema) {}
