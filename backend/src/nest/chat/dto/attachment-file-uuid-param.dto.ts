/**
 * Attachment File UUID Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AttachmentFileUuidParamSchema = z.object({
  fileUuid: z.uuid({ message: 'Invalid file UUID format' }),
});

export class AttachmentFileUuidParamDto extends createZodDto(AttachmentFileUuidParamSchema) {}

// Type export
export type AttachmentFileUuidParam = z.infer<typeof AttachmentFileUuidParamSchema>;
