/**
 * Attachment ID Param DTO
 *
 * Validates attachmentId path parameter.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AttachmentIdParamSchema = z.object({
  attachmentId: z.coerce.number().int().positive(),
});

export class AttachmentIdParamDto extends createZodDto(
  AttachmentIdParamSchema,
) {}
