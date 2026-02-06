/**
 * Get All Plans Query DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GetAllPlansQuerySchema = z.object({
  includeInactive: z
    .string()
    .transform((val: string) => val === 'true')
    .optional()
    .default(false),
});

export class GetAllPlansQueryDto extends createZodDto(GetAllPlansQuerySchema) {}
