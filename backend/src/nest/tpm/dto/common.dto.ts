/**
 * Common TPM Schemas
 *
 * Reusable Zod schemas for TPM validation.
 * Used across all TPM DTOs for consistency.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** UUID path parameter — validates standard UUID format */
export const UuidParamSchema = z.object({
  uuid: z.uuid(),
});

export class UuidParamDto extends createZodDto(UuidParamSchema) {}

/** TPM interval type enum — mirrors PostgreSQL tpm_interval_type */
export const TpmIntervalTypeSchema = z.enum(
  [
    'daily',
    'weekly',
    'monthly',
    'quarterly',
    'semi_annual',
    'annual',
    'custom',
  ],
  { message: 'Ungültiger Intervalltyp' },
);

/** Card role enum — mirrors PostgreSQL tpm_card_role */
export const TpmCardRoleSchema = z.enum(['operator', 'maintenance'], {
  message: 'Kartenrolle muss operator oder maintenance sein',
});

/** Card status enum — mirrors PostgreSQL tpm_card_status */
export const TpmCardStatusSchema = z.enum(
  ['green', 'red', 'yellow', 'overdue'],
  { message: 'Ungültiger Kartenstatus' },
);

/** Approval action for respond-execution */
export const TpmApprovalActionSchema = z.enum(['approved', 'rejected'], {
  message: 'Aktion muss approved oder rejected sein',
});

/** Pagination — page parameter (coerced from query string) */
export const PageSchema = z.coerce.number().int().positive().default(1);

/** Pagination — limit parameter (coerced from query string) */
export const LimitSchema = z.coerce.number().int().min(1).max(500).default(20);

/** Hex color validation — #RRGGBB format */
export const HexColorSchema = z
  .string()
  .trim()
  .regex(/^#[\da-f]{6}$/i, 'Farbe muss im Format #RRGGBB sein');

/** Time format HH:MM (24h) */
export const TimeSchema = z
  .string()
  .trim()
  .regex(
    /^([01]?\d|2[0-3]):[0-5]\d$/,
    'Uhrzeit muss im Format HH:MM sein (24h)',
  );

/** Weekday 0-6 (Montag=0 bis Sonntag=6) */
export const WeekdaySchema = z
  .number()
  .int()
  .min(0, 'Wochentag muss 0-6 sein (Mo-So)')
  .max(6, 'Wochentag muss 0-6 sein (Mo-So)');

/** Positive integer for minutes (preparation, execution, followup) */
export const MinutesSchema = z
  .number()
  .int()
  .min(0, 'Minuten dürfen nicht negativ sein');

/** Staff count — at least 1 person */
export const StaffCountSchema = z
  .number()
  .int()
  .min(1, 'Mindestens 1 Person erforderlich');
