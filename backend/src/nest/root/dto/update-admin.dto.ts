/**
 * Update Admin DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  EmailSchema,
  EmployeeNumberSchema,
  NameSchema,
  NotesSchema,
  PasswordSchema,
  PositionSchema,
  UsernameSchema,
} from './admin.schemas.js';

export const UpdateAdminSchema = z.object({
  username: UsernameSchema.optional(),
  email: EmailSchema.optional(),
  password: PasswordSchema.optional(),
  firstName: NameSchema.optional(),
  lastName: NameSchema.optional(),
  notes: NotesSchema,
  isActive: z.coerce.number().int().min(0).max(4).optional(),
  employeeNumber: EmployeeNumberSchema,
  position: PositionSchema,
  role: z.enum(['admin', 'root']).optional(),
});

export class UpdateAdminDto extends createZodDto(UpdateAdminSchema) {}
