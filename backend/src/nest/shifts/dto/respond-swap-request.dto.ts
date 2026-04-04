/**
 * Respond to Swap Request DTO
 *
 * Body for POST /shifts/swap-requests/uuid/:uuid/respond
 * Used by the target user (swap partner) to accept or decline.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RespondSwapRequestSchema = z.object({
  accept: z.boolean({ message: 'Accept must be a boolean' }),
  note: z.string().trim().max(500, 'Note cannot exceed 500 characters').optional(),
});

export class RespondSwapRequestDto extends createZodDto(RespondSwapRequestSchema) {}
