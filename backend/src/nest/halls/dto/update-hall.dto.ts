/**
 * Update Hall DTO
 *
 * Validation schema for updating halls. All fields optional.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateHallSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Hall name must be at least 2 characters')
    .max(255, 'Hall name must not exceed 255 characters')
    .optional(),
  description: z.string().trim().max(500, 'Description must not exceed 500 characters').nullish(),
  areaId: z.coerce
    .number()
    .int()
    .positive('Area ID must be a positive integer')
    .nullable()
    .optional(),
  isActive: z.coerce.number().int().min(0).max(4).optional(),
});

export class UpdateHallDto extends createZodDto(UpdateHallSchema) {}
