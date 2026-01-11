/**
 * Admin Logs Query DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AdminLogsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export class AdminLogsQueryDto extends createZodDto(AdminLogsQuerySchema) {}
