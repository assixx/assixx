import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const RoleCategorySchema = z.enum(['employee', 'admin', 'root'], {
  message: 'roleCategory muss employee, admin oder root sein',
});

export const CreatePositionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name darf nicht leer sein')
    .max(100, 'Name darf maximal 100 Zeichen haben'),
  roleCategory: RoleCategorySchema,
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
});

export class CreatePositionDto extends createZodDto(CreatePositionSchema) {}
