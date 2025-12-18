/**
 * Root User ID Parameter DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RootUserIdParamSchema = z.object({
  id: z.coerce.number().int().positive('ID must be positive'),
});

export class RootUserIdParamDto extends createZodDto(RootUserIdParamSchema) {}
