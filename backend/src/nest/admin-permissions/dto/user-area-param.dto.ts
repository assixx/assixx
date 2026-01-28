/**
 * User Area Param DTO
 *
 * Validates userId and areaId path parameters.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UserAreaParamSchema = z.object({
  userId: z.coerce
    .number()
    .int()
    .positive('User ID must be a positive integer'),
  areaId: z.coerce
    .number()
    .int()
    .positive('Area ID must be a positive integer'),
});

export class UserAreaParamDto extends createZodDto(UserAreaParamSchema) {}
