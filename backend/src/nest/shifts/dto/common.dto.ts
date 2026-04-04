/**
 * Common Shift Schemas
 *
 * Reusable Zod schemas for shift validation.
 */
import { z } from 'zod';

/**
 * Shift date schema - accepts both YYYY-MM-DD and ISO 8601 formats
 */
export const ShiftDateSchema = z.string().refine(
  (val: string) => {
    const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    return dateOnlyPattern.test(val) || isoDatePattern.test(val);
  },
  { message: 'Invalid date format. Use YYYY-MM-DD or ISO 8601 format' },
);

/**
 * Shift status enum
 */
export const ShiftStatusSchema = z.enum(
  ['planned', 'confirmed', 'in_progress', 'completed', 'cancelled'],
  { message: 'Invalid status' },
);

/**
 * Shift type enum
 */
export const ShiftTypeSchema = z.enum(
  [
    'regular',
    'overtime',
    'standby',
    'vacation',
    'sick',
    'holiday',
    'early',
    'late',
    'night',
    'day',
    'flexible',
    'F',
    'S',
    'N',
  ],
  { message: 'Invalid type' },
);

/**
 * Time format HH:MM
 */
export const TimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format');

/**
 * Time format with seconds HH:MM:SS
 */
export const TimeWithSecondsSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, 'Time must be in HH:MM:SS format');

/**
 * Sort field enum for shifts
 */
export const SortBySchema = z.enum(['date', 'startTime', 'endTime', 'userId', 'status', 'type'], {
  message: 'Invalid sort field',
});

/**
 * Sort order enum
 */
export const SortOrderSchema = z.enum(['asc', 'desc'], {
  message: 'Sort order must be asc or desc',
});

/**
 * Swap request status enum
 */
export const SwapRequestStatusSchema = z.enum(
  ['pending_partner', 'pending_approval', 'approved', 'rejected', 'cancelled'],
  { message: 'Invalid swap request status' },
);
