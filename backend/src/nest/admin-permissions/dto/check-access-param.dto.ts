import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { idField } from '../../common/dto/index.js';

export const CheckAccessParamSchema = z.object({
  adminId: idField,
  departmentId: idField,
  permissionLevel: z.enum(['read', 'write', 'delete']).optional().default('read'),
});

export class CheckAccessParamDto extends createZodDto(CheckAccessParamSchema) {}
