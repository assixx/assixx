/**
 * Addon Code Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AddonCodeParamSchema = z.object({
  code: z.string().min(1, 'Addon code is required'),
});

export class AddonCodeParamDto extends createZodDto(AddonCodeParamSchema) {}
