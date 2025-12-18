/**
 * Admin ID Parameter DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AdminIdParamSchema = z.object({
  id: z.coerce.number().int().positive('ID must be positive'),
});

export class AdminIdParamDto extends createZodDto(AdminIdParamSchema) {}
