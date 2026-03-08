import { createZodDto } from 'nestjs-zod';
import type { z } from 'zod';

import { createUuidParamSchema } from '../../common/dto/index.js';

export const AttachmentFileUuidParamSchema = createUuidParamSchema('fileUuid');
export class AttachmentFileUuidParamDto extends createZodDto(
  AttachmentFileUuidParamSchema,
) {}
export type AttachmentFileUuidParam = z.infer<
  typeof AttachmentFileUuidParamSchema
>;
