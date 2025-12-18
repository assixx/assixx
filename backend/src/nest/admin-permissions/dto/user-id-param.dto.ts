/**
 * User ID Param DTO
 *
 * Validates userId path parameter.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UserIdParamSchema = z.object({
  userId: z.coerce.number().int().positive('User ID must be a positive integer'),
});

export class UserIdParamDto extends createZodDto(UserIdParamSchema) {}
