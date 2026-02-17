/**
 * Common Vacation Schemas
 *
 * Reusable Zod schemas for vacation validation.
 */
import { z } from 'zod';

/** Date format YYYY-MM-DD */
export const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

/** Vacation request status enum */
export const VacationRequestStatusSchema = z.enum(
  ['pending', 'approved', 'denied', 'withdrawn', 'cancelled'],
  { message: 'Invalid vacation request status' },
);

/** Vacation type enum */
export const VacationTypeSchema = z.enum(['regular', 'unpaid'], {
  message: 'Invalid vacation type',
});

/** Half day enum */
export const VacationHalfDaySchema = z.enum(['none', 'morning', 'afternoon'], {
  message: 'Invalid half day value. Must be none, morning, or afternoon',
});

/** Respond action enum (approve or deny) */
export const RespondActionSchema = z.enum(['approved', 'denied'], {
  message: 'Action must be approved or denied',
});

/** Pagination page parameter */
export const PageSchema = z.coerce.number().int().positive().default(1);

/** Pagination limit parameter */
export const LimitSchema = z.coerce.number().int().min(1).max(100).default(20);

/** Year parameter (coerced from query string) */
export const YearSchema = z.coerce.number().int().min(2020).max(2100);

/** Positive number for days (multiples of 0.5) */
export const DaysSchema = z
  .number()
  .positive('Days must be positive')
  .multipleOf(0.5, 'Days must be a multiple of 0.5');

/** Non-negative number for days (multiples of 0.5) */
export const NonNegativeDaysSchema = z
  .number()
  .min(0, 'Days cannot be negative')
  .multipleOf(0.5, 'Days must be a multiple of 0.5');
