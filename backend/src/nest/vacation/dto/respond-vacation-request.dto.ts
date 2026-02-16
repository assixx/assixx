/**
 * Respond to Vacation Request DTO
 *
 * Zod schema for approving or denying a vacation request.
 * Deny requires a responseNote (DB constraint denied_needs_reason).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { RespondActionSchema } from './common.dto.js';

const BaseSchema = z.object({
  action: RespondActionSchema,
  isSpecialLeave: z.boolean().default(false),
  responseNote: z
    .string()
    .trim()
    .max(1000, 'Response note cannot exceed 1000 characters')
    .optional(),
});

type BaseInput = z.infer<typeof BaseSchema>;

export const RespondVacationRequestSchema = BaseSchema.refine(
  (data: BaseInput) => {
    // Deny requires a reason
    if (data.action === 'denied') {
      return data.responseNote !== undefined && data.responseNote.length > 0;
    }
    return true;
  },
  {
    message: 'A reason is required when denying a request',
    path: ['responseNote'],
  },
);

export class RespondVacationRequestDto extends createZodDto(
  RespondVacationRequestSchema,
) {}
