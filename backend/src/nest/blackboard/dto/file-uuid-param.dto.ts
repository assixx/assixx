import { createZodDto } from 'nestjs-zod';

import { createUuidParamSchema } from '../../common/dto/index.js';

export const FileUuidParamSchema = createUuidParamSchema('fileUuid');
export class FileUuidParamDto extends createZodDto(FileUuidParamSchema) {}
