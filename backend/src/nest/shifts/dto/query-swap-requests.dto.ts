/**
 * Query Swap Requests DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { SwapRequestStatusSchema } from './common.dto.js';

// Re-export for backwards compatibility
export { SwapRequestStatusSchema } from './common.dto.js';

/**
 * Query swap requests parameters
 */
export const QuerySwapRequestsSchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  status: SwapRequestStatusSchema.optional(),
});

export class QuerySwapRequestsDto extends createZodDto(QuerySwapRequestsSchema) {}
