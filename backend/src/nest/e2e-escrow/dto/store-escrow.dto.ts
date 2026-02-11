/**
 * Store/Update E2E Escrow DTO
 *
 * Validates the encrypted private key blob and associated crypto parameters.
 * Uses Zod for runtime validation + TypeScript type inference.
 *
 * @see ADR-022 (E2E Key Escrow)
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Argon2id parameter validation — matches ADR-022 defaults */
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

/**
 * Schema for escrow blob storage.
 * All binary data is base64-encoded.
 */
export const StoreEscrowSchema = z.object({
  encryptedBlob: z
    .string()
    .trim()
    .min(40, 'Encrypted blob too short')
    .max(500, 'Encrypted blob too long'),
  argon2Salt: z
    .string()
    .trim()
    .min(40, 'Argon2 salt too short for 32-byte base64')
    .max(50, 'Argon2 salt too long for 32-byte base64')
    .refine(
      (val: string) => {
        try {
          const bytes = Buffer.from(val, 'base64');
          return bytes.length === 32;
        } catch {
          return false;
        }
      },
      { message: 'Argon2 salt must be a valid base64-encoded 32-byte value' },
    ),
  xchachaNonce: z
    .string()
    .trim()
    .min(28, 'XChaCha nonce too short for 24-byte base64')
    .max(40, 'XChaCha nonce too long for 24-byte base64')
    .refine(
      (val: string) => {
        try {
          const bytes = Buffer.from(val, 'base64');
          return bytes.length === 24;
        } catch {
          return false;
        }
      },
      { message: 'XChaCha nonce must be a valid base64-encoded 24-byte value' },
    ),
  argon2Params: Argon2ParamsSchema,
});

/** DTO class for NestJS pipe validation */
export class StoreEscrowDto extends createZodDto(StoreEscrowSchema) {}
