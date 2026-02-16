/**
 * Availability History Query DTO
 *
 * Query parameters for fetching availability history.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Availability status enum (matches DB enum)
 */
export const AvailabilityStatusSchema = z.enum([
  'available',
  'unavailable',
  'vacation',
  'sick',
  'training',
  'other',
]);

export type AvailabilityStatus = z.infer<typeof AvailabilityStatusSchema>;

/**
 * Query parameters for availability history
 */
export const AvailabilityHistoryQuerySchema = z.object({
  year: z
    .string()
    .regex(/^\d{4}$/, 'Year must be 4 digits')
    .optional(),
  month: z
    .string()
    .regex(/^(0[1-9]|1[0-2])$/, 'Month must be 01-12')
    .optional(),
});

export class AvailabilityHistoryQueryDto extends createZodDto(
  AvailabilityHistoryQuerySchema,
) {}

/**
 * Single availability history entry (response)
 */
export interface AvailabilityHistoryEntry {
  id: number;
  userId: number;
  status: string; // DB returns string from enum
  startDate: string;
  endDate: string;
  reason: string | null;
  notes: string | null;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Availability history response
 */
export interface AvailabilityHistoryResponse {
  employee: {
    id: number;
    uuid: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  entries: AvailabilityHistoryEntry[];
  meta: {
    total: number;
    year: number | null;
    month: number | null;
  };
}
