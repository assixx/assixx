/**
 * Admin Group Param DTO
 *
 * Validates adminId and groupId path parameters.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AdminGroupParamSchema = z.object({
  adminId: z.coerce.number().int().positive('Admin ID must be a positive integer'),
  groupId: z.coerce.number().int().positive('Group ID must be a positive integer'),
});

export class AdminGroupParamDto extends createZodDto(AdminGroupParamSchema) {}
