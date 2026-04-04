/**
 * Swap Request Status DTO
 *
 * Zod schema for admin/lead status updates on swap requests.
 * Note: Partner consent uses RespondSwapRequestDto instead.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateSwapRequestStatusSchema = z.object({
  status: z.enum(['approved', 'rejected', 'cancelled'], {
    message: 'Status must be approved, rejected, or cancelled',
  }),
});

export class UpdateSwapRequestStatusDto extends createZodDto(UpdateSwapRequestStatusSchema) {}
