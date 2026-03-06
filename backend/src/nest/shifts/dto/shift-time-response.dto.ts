/**
 * Shift Time Response DTO
 *
 * Zod schema for the API response shape of a shift time definition.
 */
import { z } from 'zod';

/** Response shape for a single shift time */
export const ShiftTimeResponseSchema = z.object({
  shiftKey: z.string(),
  label: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  sortOrder: z.number(),
  isActive: z.number(),
});

export type ShiftTimeResponse = z.infer<typeof ShiftTimeResponseSchema>;
