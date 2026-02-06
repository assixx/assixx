/**
 * Deletion Approval Body DTO
 *
 * SECURITY: Password is REQUIRED for Two-Person-Principle (Zwei-Personen-Prinzip).
 * The approving user must provide their password to verify identity before
 * approving the tenant deletion request.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const DeletionApprovalBodySchema = z.object({
  // REQUIRED: Password for identity verification (Two-Person-Principle)
  password: z.string().min(1, 'Password is required for approval'),
  comment: z.string().max(500, 'Comment too long').optional(),
});

export class DeletionApprovalBodyDto extends createZodDto(
  DeletionApprovalBodySchema,
) {}
