/**
 * Dummy Users — Common Schemas
 *
 * Reusable Zod schemas for dummy user validation.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** UUID path parameter */
export const UuidParamSchema = z.object({
  uuid: z.uuid(),
});

export class UuidParamDto extends createZodDto(UuidParamSchema) {}

/** Pagination — page parameter (coerced from query string) */
export const PageSchema = z.coerce.number().int().positive().default(1);

/** Pagination — limit parameter (coerced from query string) */
export const LimitSchema = z.coerce.number().int().min(1).max(100).default(20);

/** is_active filter values */
export const IsActiveSchema = z.coerce
  .number()
  .int()
  .refine((v: number) => [0, 1, 3].includes(v), 'isActive muss 0, 1, oder 3 sein');
