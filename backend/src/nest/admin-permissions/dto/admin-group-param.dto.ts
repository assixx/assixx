import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { idField } from '../../common/dto/index.js';

export const AdminGroupParamSchema = z.object({
  adminId: idField,
  groupId: idField,
});

export class AdminGroupParamDto extends createZodDto(AdminGroupParamSchema) {}
