import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdatePositionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name darf nicht leer sein')
    .max(100, 'Name darf maximal 100 Zeichen haben')
    .optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export class UpdatePositionDto extends createZodDto(UpdatePositionSchema) {}
