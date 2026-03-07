import { createZodDto } from 'nestjs-zod';

import { createIdParamSchema } from '../../common/dto/index.js';

export const QueueIdParamSchema = createIdParamSchema('queueId');
export class QueueIdParamDto extends createZodDto(QueueIdParamSchema) {}
