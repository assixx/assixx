/**
 * Create Admin DTO
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

export const CreateAdminSchema = z.object({
  username: UsernameSchema.optional(),
  email: EmailSchema,
  password: PasswordSchema,
  firstName: NameSchema.optional(),
  lastName: NameSchema.optional(),
  notes: NotesSchema,
  employeeNumber: EmployeeNumberSchema,
  position: PositionSchema,
});

export class CreateAdminDto extends createZodDto(CreateAdminSchema) {}
