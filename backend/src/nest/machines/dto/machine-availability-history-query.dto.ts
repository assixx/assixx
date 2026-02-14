/**
 * Machine Availability History Query DTO
 *
 * Query parameters for fetching machine availability history.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Query parameters for machine availability history
 */
export const MachineAvailabilityHistoryQuerySchema = z.object({
  year: z
    .string()
    .regex(/^\d{4}$/, 'Year must be 4 digits')
    .optional(),
  month: z
    .string()
    .regex(/^(0[1-9]|1[0-2])$/, 'Month must be 01-12')
    .optional(),
});

export class MachineAvailabilityHistoryQueryDto extends createZodDto(
  MachineAvailabilityHistoryQuerySchema,
) {}

/**
 * Single machine availability history entry (response)
 */
export interface MachineAvailabilityHistoryEntry {
  id: number;
  machineId: number;
  status: string;
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
 * Machine availability history response
 */
export interface MachineAvailabilityHistoryResponse {
  machine: {
    id: number;
    uuid: string;
    name: string;
  };
  entries: MachineAvailabilityHistoryEntry[];
  meta: {
    total: number;
    year: number | null;
    month: number | null;
  };
}
