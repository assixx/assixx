/**
 * Shift Handover — Upload Attachment Metadata DTO.
 *
 * The uploaded file is parsed by `@fastify/multipart` + `FileInterceptor`
 * (ADR-042) and reaches the controller as `@UploadedFile() file: MulterFile`.
 * This DTO only validates the accompanying multipart text field(s); per-file
 * constraints (MIME whitelist, 5 MB cap, 5-per-entry limit) live in the
 * service layer.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UploadAttachmentSchema = z.object({
  caption: z.string().trim().max(255).optional(),
});

export class UploadAttachmentDto extends createZodDto(UploadAttachmentSchema) {}
