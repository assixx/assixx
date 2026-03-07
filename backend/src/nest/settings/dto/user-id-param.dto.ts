import { createZodDto } from 'nestjs-zod';

import { createIdParamSchema } from '../../common/dto/index.js';

export const UserIdParamSchema = createIdParamSchema('userId');
export class UserIdParamDto extends createZodDto(UserIdParamSchema) {}
