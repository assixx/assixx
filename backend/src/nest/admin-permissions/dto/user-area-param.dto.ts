import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { idField } from '../../common/dto/index.js';

export const UserAreaParamSchema = z.object({
  userId: idField,
  areaId: idField,
});

export class UserAreaParamDto extends createZodDto(UserAreaParamSchema) {}
