/**
 * Approve Approval DTO — Zod schema for approve action
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ApproveApprovalSchema = z.object({
  decisionNote: z.string().max(2000).nullable().optional(),
});

export class ApproveApprovalDto extends createZodDto(ApproveApprovalSchema) {}
