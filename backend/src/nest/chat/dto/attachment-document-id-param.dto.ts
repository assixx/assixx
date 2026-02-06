/**
 * Attachment Document ID Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AttachmentDocumentIdParamSchema = z.object({
  documentId: z.coerce.number().int().min(1, 'Invalid document ID'),
});

export class AttachmentDocumentIdParamDto extends createZodDto(
  AttachmentDocumentIdParamSchema,
) {}

// Type export
export type AttachmentDocumentIdParam = z.infer<
  typeof AttachmentDocumentIdParamSchema
>;
