/**
 * Swap Request Status DTO
 *
 * Zod schema for updating swap request status.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Update swap request status body
 */
export const UpdateSwapRequestStatusSchema = z.object({
  status: z.enum(['approved', 'rejected', 'cancelled'], {
    message: 'Status must be approved, rejected, or cancelled',
  }),
});

export class UpdateSwapRequestStatusDto extends createZodDto(
  UpdateSwapRequestStatusSchema,
) {}
