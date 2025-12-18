/**
 * Update Addons DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateAddonsSchema = z.object({
  employees: z.number().int().min(0).optional(),
  admins: z.number().int().min(0).optional(),
  storageGb: z.number().int().min(0).optional(),
});

export class UpdateAddonsDto extends createZodDto(UpdateAddonsSchema) {}
