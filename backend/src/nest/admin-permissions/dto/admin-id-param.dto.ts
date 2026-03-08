import { createZodDto } from 'nestjs-zod';

import { createIdParamSchema } from '../../common/dto/index.js';

export const AdminIdParamSchema = createIdParamSchema('adminId');
export class AdminIdParamDto extends createZodDto(AdminIdParamSchema) {}
