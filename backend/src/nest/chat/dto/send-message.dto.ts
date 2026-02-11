/**
 * Send Message DTO
 *
 * Supports both plaintext messages (group chat) and E2E encrypted messages (1:1 chat).
 * E2E messages provide encryptedContent + e2eNonce + e2eKeyVersion + e2eKeyEpoch.
 * Plaintext messages provide message (content).
 * At least one of message or encryptedContent must be provided.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MAX_MESSAGE_LENGTH = 5000;
/** Base64 ciphertext upper bound (~5000 chars plaintext + AEAD tag + base64 overhead) */
const MAX_ENCRYPTED_LENGTH = 100_000;
/** Base64 encoded 24-byte nonce is ~32-36 chars */
const MAX_NONCE_LENGTH = 40;

export const SendMessageBodySchema = z.object({
  /** Plaintext message content (for group/system messages) */
  message: z
    .string()
    .max(
      MAX_MESSAGE_LENGTH,
      `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`,
    )
    .optional(),

  /** E2E: base64-encoded ciphertext */
  encryptedContent: z
    .string()
    .max(MAX_ENCRYPTED_LENGTH, 'Encrypted content too large')
    .optional(),

  /** E2E: base64-encoded 24-byte XChaCha20-Poly1305 nonce */
  e2eNonce: z.string().max(MAX_NONCE_LENGTH, 'Nonce too large').optional(),

  /** E2E: sender's key version at time of encryption */
  e2eKeyVersion: z
    .number()
    .int()
    .positive('Key version must be positive')
    .optional(),

  /** E2E: HKDF epoch (Math.floor(Date.now() / 86_400_000)) for decryption key derivation */
  e2eKeyEpoch: z
    .number()
    .int()
    .nonnegative('Key epoch must be non-negative')
    .optional(),
});

export class SendMessageDto extends createZodDto(SendMessageBodySchema) {}

// Type export
export type SendMessageBody = z.infer<typeof SendMessageBodySchema>;
