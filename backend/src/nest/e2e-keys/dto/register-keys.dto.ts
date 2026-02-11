/**
 * Register E2E Keys DTO
 *
 * Validates the X25519 public key submitted during key registration.
 * Uses Zod for runtime validation + TypeScript type inference.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Schema for public key registration.
 * Validates that the key is a valid base64-encoded 32-byte X25519 public key.
 */
export const RegisterKeysSchema = z.object({
  publicKey: z
    .string()
    .trim()
    .min(40, 'Public key too short for 32-byte base64')
    .max(50, 'Public key too long for 32-byte base64')
    .refine(
      (val: string) => {
        try {
          const bytes = Buffer.from(val, 'base64');
          return bytes.length === 32;
        } catch {
          return false;
        }
      },
      {
        message: 'Public key must be a valid base64-encoded 32-byte X25519 key',
      },
    ),
});

/** DTO class for NestJS pipe validation */
export class RegisterKeysDto extends createZodDto(RegisterKeysSchema) {}
