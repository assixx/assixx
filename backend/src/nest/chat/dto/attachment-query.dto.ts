/**
 * Attachment Query DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const BooleanQuerySchema = z
  .union([
    z.boolean(),
    z.string().transform((val: string): boolean => val === 'true'),
  ])
  .optional();

export const AttachmentQuerySchema = z.object({
  download: BooleanQuerySchema,
});

export class AttachmentQueryDto extends createZodDto(AttachmentQuerySchema) {}

// Type export
export type AttachmentQuery = z.infer<typeof AttachmentQuerySchema>;
