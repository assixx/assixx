/**
 * Create Swap Request DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Create swap request body
 */
export const CreateSwapRequestSchema = z.object({
  shiftId: z.number().int().positive('Shift ID is required'),
  requestedWithUserId: z
    .number()
    .int()
    .positive('Requested with user ID must be a positive integer')
    .optional(),
  reason: z.string().trim().max(500, 'Reason cannot exceed 500 characters').optional(),
});

export class CreateSwapRequestDto extends createZodDto(CreateSwapRequestSchema) {}
