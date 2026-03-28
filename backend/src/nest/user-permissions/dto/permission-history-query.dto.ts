/**
 * Permission History Query DTO
 *
 * Query parameters for paginated permission change history.
 * HTTP query params arrive as strings — z.coerce handles conversion.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const PermissionHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export class PermissionHistoryQueryDto extends createZodDto(PermissionHistoryQuerySchema) {}
