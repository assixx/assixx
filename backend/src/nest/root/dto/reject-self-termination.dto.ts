/**
 * RejectSelfTerminationDto — POST body for rejecting a peer's pending
 * self-termination request (FEAT_ROOT_ACCOUNT_PROTECTION §2.5 / Step 2.5).
 * Maps to `RootSelfTerminationService.rejectSelfTermination(actor, id, rejectionReason)`.
 *
 * Per masterplan §2.4 ("Required: `rejectionReason` non-empty") and §3
 * tests ("Reject without reason → ValidationException"), `rejectionReason`
 * MUST be a non-empty trimmed string. The DTO is the first defense
 * (400 BadRequest at the global ZodValidationPipe); the service re-asserts
 * (409 ConflictException) for callers that bypass the pipe (direct service
 * usage, tests).
 *
 * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §2.4 + §3
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RejectSelfTerminationSchema = z.object({
  /** Required, trimmed, non-empty. Surfaced to the requester in the rejection notification. */
  rejectionReason: z.string().trim().min(1, 'Begründung erforderlich').max(1000),
});

export class RejectSelfTerminationDto extends createZodDto(RejectSelfTerminationSchema) {}
