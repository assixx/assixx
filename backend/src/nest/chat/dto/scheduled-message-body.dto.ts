/**
 * Scheduled Message Body DTOs
 *
 * Supports both plaintext and E2E encrypted scheduled messages.
 * E2E messages provide encryptedContent + e2eNonce + e2eKeyVersion + e2eKeyEpoch.
 * Plaintext messages provide content.
 * At least one of content, encryptedContent, or attachment must be provided.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Constants
const MAX_SCHEDULED_MESSAGE_LENGTH = 10000;
const MIN_SCHEDULE_MINUTES = 5;
const MAX_SCHEDULE_DAYS = 30;
/** Base64 ciphertext upper bound (~10000 chars plaintext + AEAD tag + base64 overhead) */
const MAX_ENCRYPTED_LENGTH = 100_000;
/** Base64 encoded 24-byte nonce is ~32-36 chars */
const MAX_NONCE_LENGTH = 40;

/** Base schema for scheduled message (before refine) */
const ScheduledMessageBaseSchema = z.object({
  conversationId: z
    .number()
    .int('conversationId must be an integer')
    .positive('conversationId must be positive'),

  content: z
    .string()
    .max(
      MAX_SCHEDULED_MESSAGE_LENGTH,
      `Message is too long (max ${MAX_SCHEDULED_MESSAGE_LENGTH} characters)`,
    )
    .optional(),

  scheduledFor: z.iso
    .datetime({ message: 'Invalid date format (ISO 8601 expected)' })
    .refine(
      (dateStr: string): boolean => {
        const scheduledDate = new Date(dateStr);
        const minTime = new Date(Date.now() + MIN_SCHEDULE_MINUTES * 60 * 1000);
        return scheduledDate > minTime;
      },
      {
        message: `Time must be at least ${MIN_SCHEDULE_MINUTES} minutes in the future`,
      },
    )
    .refine(
      (dateStr: string): boolean => {
        const scheduledDate = new Date(dateStr);
        const maxTime = new Date(
          Date.now() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000,
        );
        return scheduledDate <= maxTime;
      },
      {
        message: `Time must be at most ${MAX_SCHEDULE_DAYS} days in the future`,
      },
    ),

  attachmentPath: z.string().max(500).optional(),
  attachmentName: z.string().max(255).optional(),
  attachmentType: z.string().max(100).optional(),
  attachmentSize: z.number().int().nonnegative().optional(),

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

/** Inferred type for refine callback */
type ScheduledMessageBase = z.infer<typeof ScheduledMessageBaseSchema>;

/** Schema with validation: requires either content OR encryptedContent OR attachment */
export const CreateScheduledMessageBodySchema =
  ScheduledMessageBaseSchema.refine(
    (data: ScheduledMessageBase): boolean => {
      const hasContent =
        typeof data.content === 'string' && data.content.trim().length > 0;
      const hasAttachment =
        typeof data.attachmentPath === 'string' &&
        data.attachmentPath.length > 0;
      const hasEncryptedContent =
        typeof data.encryptedContent === 'string' &&
        data.encryptedContent.length > 0;
      return hasContent || hasAttachment || hasEncryptedContent;
    },
    {
      message:
        'Either message content, encrypted content, or attachment is required',
    },
  );

export class CreateScheduledMessageDto extends createZodDto(
  CreateScheduledMessageBodySchema,
) {}

// Type exports
export type CreateScheduledMessageBody = z.infer<
  typeof CreateScheduledMessageBodySchema
>;
