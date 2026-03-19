/**
 * Reject Approval DTO — Zod schema for reject action (note mandatory)
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RejectApprovalSchema = z.object({
  decisionNote: z
    .string()
    .min(1, 'Begründung ist Pflicht bei Ablehnung')
    .max(2000),
});

export class RejectApprovalDto extends createZodDto(RejectApprovalSchema) {}
