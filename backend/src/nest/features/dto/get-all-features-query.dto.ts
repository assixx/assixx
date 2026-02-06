/**
 * Get All Features Query DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GetAllFeaturesQuerySchema = z.object({
  includeInactive: z
    .string()
    .transform((val: string) => val === 'true')
    .optional()
    .default(false),
});

export class GetAllFeaturesQueryDto extends createZodDto(
  GetAllFeaturesQuerySchema,
) {}
