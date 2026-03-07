import { createZodDto } from 'nestjs-zod';

import { createIdParamSchema } from '../../common/dto/index.js';

export const AttachmentIdParamSchema = createIdParamSchema('attachmentId');
export class AttachmentIdParamDto extends createZodDto(
  AttachmentIdParamSchema,
) {}
