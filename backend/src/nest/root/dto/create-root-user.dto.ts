/**
 * Create Root User DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  EmailSchema,
  EmployeeNumberSchema,
  NameSchema,
  NotesSchema,
  PasswordSchema,
  PositionIdsSchema,
  PositionSchema,
  UsernameSchema,
} from './admin.schemas.js';

export const CreateRootUserSchema = z.object({
  username: UsernameSchema.optional(),
  email: EmailSchema,
  password: PasswordSchema,
  firstName: NameSchema,
  lastName: NameSchema,
  position: PositionSchema,
  positionIds: PositionIdsSchema,
  notes: NotesSchema,
  employeeNumber: EmployeeNumberSchema,
  isActive: z.coerce.number().int().min(0).max(4).default(1),
});

export class CreateRootUserDto extends createZodDto(CreateRootUserSchema) {}
