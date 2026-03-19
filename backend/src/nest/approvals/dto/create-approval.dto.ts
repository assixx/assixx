/**
 * Create Approval DTO — Zod schema for creating a new approval request
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateApprovalSchema = z.object({
  addonCode: z.string().min(1).max(50),
  sourceEntityType: z.string().min(1).max(100),
  sourceUuid: z.string().length(36),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  assignedTo: z.number().int().positive().nullable().optional(),
});

export class CreateApprovalDto extends createZodDto(CreateApprovalSchema) {}
