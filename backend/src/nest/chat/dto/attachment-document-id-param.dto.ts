import { createZodDto } from 'nestjs-zod';
import type { z } from 'zod';

import { createIdParamSchema } from '../../common/dto/index.js';

export const AttachmentDocumentIdParamSchema = createIdParamSchema('documentId');
export class AttachmentDocumentIdParamDto extends createZodDto(AttachmentDocumentIdParamSchema) {}
export type AttachmentDocumentIdParam = z.infer<typeof AttachmentDocumentIdParamSchema>;
