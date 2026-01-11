/**
 * Plan ID Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const PlanIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Plan ID must be a positive integer'),
});

export class PlanIdParamDto extends createZodDto(PlanIdParamSchema) {}
