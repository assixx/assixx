/**
 * Root Query DTOs
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const TenantStatusSchema = z.enum(['active', 'inactive', 'suspended', 'deleted'], {
  message: 'Invalid tenant status',
});

/**
 * Root API filters
 */
export const RootApiFiltersSchema = z.object({
  status: TenantStatusSchema.optional(),
  isActive: z
    .string()
    .regex(/^(true|false)$/, 'isActive must be true or false')
    .transform((val: string) => val === 'true')
    .optional(),
  search: z.string().max(100, 'Search term too long').optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export class RootApiFiltersDto extends createZodDto(RootApiFiltersSchema) {}
