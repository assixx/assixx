/**
 * ApproveSelfTerminationDto — POST body for approving a peer's pending
 * self-termination request (FEAT_ROOT_ACCOUNT_PROTECTION §2.5 / Step 2.5).
 * Maps to `RootSelfTerminationService.approveSelfTermination(actor, id, comment?)`.
 *
 * `comment` is recorded in the approval audit-log row (`ActivityLoggerService`
 * → `root_logs`) so the rejection-vs-approval trail captures approver
 * context. Optional per masterplan §2.4 method signature.
 *
 * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §2.4 (service signature)
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ApproveSelfTerminationSchema = z.object({
  /** Optional approver comment, persisted in the audit-log entry. */
  comment: z.string().trim().max(1000).optional(),
});

export class ApproveSelfTerminationDto extends createZodDto(ApproveSelfTerminationSchema) {}
