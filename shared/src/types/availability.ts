/**
 * Availability Status Types
 *
 * Employee availability statuses used in shifts and employee management.
 */

/** Employee availability status values */
export type AvailabilityStatus =
  | 'available'
  | 'vacation'
  | 'sick'
  | 'unavailable'
  | 'training'
  | 'other';

/** All valid availability statuses as a readonly array */
export const AVAILABILITY_STATUSES = [
  'available',
  'vacation',
  'sick',
  'unavailable',
  'training',
  'other',
] as const satisfies readonly AvailabilityStatus[];
