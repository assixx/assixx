/**
 * Create Swap Request DTO
 *
 * Body for POST /shifts/swap-requests
 * Shift IDs are optional — if missing, resolved by user_id + date in service.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateSwapRequestSchema = z.object({
  requesterShiftId: z.number().int().positive().optional(),
  targetShiftId: z.number().int().positive().optional(),
  targetId: z.number().int().positive('Target user ID is required'),
  swapScope: z.enum(['single_day', 'week', 'date_range']).default('single_day'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  reason: z.string().trim().max(500, 'Reason cannot exceed 500 characters').optional(),
});

export class CreateSwapRequestDto extends createZodDto(CreateSwapRequestSchema) {}
