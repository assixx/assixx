/**
 * Attachment Download Query DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const BooleanQuerySchema = z
  .union([z.boolean(), z.string().transform((val: string): boolean => val === 'true')])
  .optional();

export const AttachmentDownloadQuerySchema = z.object({
  inline: BooleanQuerySchema,
});

export class AttachmentDownloadQueryDto extends createZodDto(AttachmentDownloadQuerySchema) {}

// Type export
export type AttachmentDownloadQuery = z.infer<typeof AttachmentDownloadQuerySchema>;
