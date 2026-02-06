/**
 * Update Root User DTO
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
} from './admin.schemas.js';

export const UpdateRootUserSchema = z.object({
  firstName: NameSchema.optional(),
  lastName: NameSchema.optional(),
  email: EmailSchema.optional(),
  password: PasswordSchema.optional(),
  position: PositionSchema,
  notes: NotesSchema,
  employeeNumber: EmployeeNumberSchema,
  isActive: z.coerce.number().int().min(0).max(4).optional(),
});

export class UpdateRootUserDto extends createZodDto(UpdateRootUserSchema) {}
