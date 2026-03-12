import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const PositionNameSchema = z
  .string()
  .trim()
  .min(1, 'Position darf nicht leer sein')
  .max(100, 'Position darf maximal 100 Zeichen haben');

export const UpdatePositionOptionsSchema = z.object({
  employee: z.array(PositionNameSchema).max(50).optional(),
  admin: z.array(PositionNameSchema).max(50).optional(),
  root: z.array(PositionNameSchema).max(50).optional(),
});

export class UpdatePositionOptionsDto extends createZodDto(
  UpdatePositionOptionsSchema,
) {}
