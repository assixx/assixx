/**
 * Area ID Param DTO
 *
 * Validation schema for area ID route parameter.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Area ID parameter schema
 */
export const AreaIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Area ID must be a positive integer'),
});

/**
 * Area ID Param DTO class
 */
export class AreaIdParamDto extends createZodDto(AreaIdParamSchema) {}
