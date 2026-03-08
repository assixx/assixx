import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { idField } from '../../common/dto/index.js';

export const AdminDepartmentParamSchema = z.object({
  adminId: idField,
  departmentId: idField,
});

export class AdminDepartmentParamDto extends createZodDto(
  AdminDepartmentParamSchema,
) {}
