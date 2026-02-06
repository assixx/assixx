/**
 * Deletion Rejection Body DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const DeletionRejectionBodySchema = z.object({
  reason: z
    .string()
    .min(10, 'Rejection reason must be at least 10 characters')
    .max(500, 'Rejection reason too long'),
});

export class DeletionRejectionBodyDto extends createZodDto(
  DeletionRejectionBodySchema,
) {}
