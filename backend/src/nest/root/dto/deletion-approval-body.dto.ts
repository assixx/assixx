/**
 * Deletion Approval Body DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const DeletionApprovalBodySchema = z.object({
  comment: z.string().max(500, 'Comment too long').optional(),
});

export class DeletionApprovalBodyDto extends createZodDto(DeletionApprovalBodySchema) {}
