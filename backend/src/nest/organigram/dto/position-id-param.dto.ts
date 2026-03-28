import { createZodDto } from 'nestjs-zod';

import { createUuidParamSchema } from '../../common/dto/index.js';

export const PositionIdParamSchema = createUuidParamSchema('id');
export class PositionIdParamDto extends createZodDto(PositionIdParamSchema) {}
