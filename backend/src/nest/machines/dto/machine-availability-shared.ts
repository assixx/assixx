/**
 * Shared Machine Availability Schema
 *
 * Shared Zod enum for machine availability statuses.
 * Used by all machine availability DTOs.
 */
import { z } from 'zod';

/**
 * Machine availability status enum (matches DB enum machine_availability_status)
 */
export const MachineAvailabilityStatusSchema = z.enum([
  'operational',
  'maintenance',
  'repair',
  'standby',
  'cleaning',
  'other',
]);

export type MachineAvailabilityStatus = z.infer<
  typeof MachineAvailabilityStatusSchema
>;
