/**
 * Create From Template DTO
 *
 * Validation schema for creating notifications from templates (admin only).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { IdSchema } from '../../../schemas/common.schema.js';

/**
 * Recipient type enum
 */
const RecipientTypeSchema = z.enum(['user', 'department', 'team', 'all'], {
  message: 'Invalid recipient type',
});

/**
 * Create from template request body schema
 */
export const CreateFromTemplateSchema = z.object({
  templateId: z.string().trim().min(1, 'Template ID is required'),
  variables: z.record(z.string(), z.unknown()).optional(),
  recipientType: RecipientTypeSchema,
  recipientId: IdSchema.optional(),
});

/**
 * Create From Template DTO class
 */
export class CreateFromTemplateDto extends createZodDto(
  CreateFromTemplateSchema,
) {}
