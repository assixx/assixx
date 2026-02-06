/**
 * Attachment Filename Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AttachmentFilenameParamSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
});

export class AttachmentFilenameParamDto extends createZodDto(
  AttachmentFilenameParamSchema,
) {}

// Type export
export type AttachmentFilenameParam = z.infer<
  typeof AttachmentFilenameParamSchema
>;
