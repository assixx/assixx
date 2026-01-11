/**
 * Feature Code Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const FeatureCodeParamSchema = z.object({
  code: z.string().min(1, 'Feature code is required'),
});

export class FeatureCodeParamDto extends createZodDto(FeatureCodeParamSchema) {}
