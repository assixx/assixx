/**
 * RequestSelfTerminationDto — POST body for the controller endpoint that
 * creates a pending peer-approval request (FEAT_ROOT_ACCOUNT_PROTECTION
 * §2.5 / Step 2.5). Maps to `RootSelfTerminationService.requestSelfTermination`.
 *
 * `reason` is optional free-text shown to peer roots in the approval card
 * (Phase 5 / §5.3 manage-approvals). Service signature accepts
 * `string | null`; the controller converts undefined → null at the boundary.
 *
 * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §2.4 (service signature)
 * @see docs/infrastructure/adr/ADR-030-zod-validation-architecture.md
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RequestSelfTerminationSchema = z.object({
  /** Optional explanation surfaced to peer roots in the approval card. */
  reason: z.string().trim().max(1000).optional(),
});

export class RequestSelfTerminationDto extends createZodDto(RequestSelfTerminationSchema) {}
