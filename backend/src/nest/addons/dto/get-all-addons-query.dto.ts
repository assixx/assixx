/**
 * Get All Addons Query DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GetAllAddonsQuerySchema = z.object({
  includeInactive: z
    .string()
    .transform((val: string) => val === 'true')
    .optional()
    .default(false),
});

export class GetAllAddonsQueryDto extends createZodDto(GetAllAddonsQuerySchema) {}
