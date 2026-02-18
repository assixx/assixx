/**
 * Respond Execution DTO
 *
 * Zod schema for the approval workflow — approve or reject a card execution.
 * Rejection requires a note (reason).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { TpmApprovalActionSchema } from './common.dto.js';

const BaseSchema = z.object({
  action: TpmApprovalActionSchema,
  approvalNote: z
    .string()
    .trim()
    .max(2000, 'Freigabenotiz darf maximal 2000 Zeichen lang sein')
    .nullish(),
});

type BaseInput = z.infer<typeof BaseSchema>;

export const RespondExecutionSchema = BaseSchema.refine(
  (data: BaseInput) => {
    if (data.action === 'rejected') {
      return (
        data.approvalNote !== undefined &&
        data.approvalNote !== null &&
        data.approvalNote.length > 0
      );
    }
    return true;
  },
  {
    message: 'Begründung ist bei Ablehnung erforderlich',
    path: ['approvalNote'],
  },
);

export class RespondExecutionDto extends createZodDto(
  RespondExecutionSchema,
) {}
