/**
 * Manage Approvals — API client for root self-termination peer decisions.
 * @module shared/manage-approvals/_lib/api
 *
 * Step 5.3 of FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md — three endpoints
 * gated by `@Roles('root')` at the backend controller class level.
 *
 * Endpoint contract (from `RootSelfTerminationController`):
 *   GET    /users/self-termination-requests/pending           → list (peer-only, no expired)
 *   POST   /users/self-termination-requests/:id/approve       → 200, body: { comment? }
 *   POST   /users/self-termination-requests/:id/reject        → 200, body: { rejectionReason }
 *
 * The list endpoint already filters server-side:
 *   - `requester_id <> $1` (no self-decision — masterplan §5.3 rule 2)
 *   - `expires_at > NOW()` (no stale rows)
 * The frontend trusts those filters and does not re-apply them.
 *
 * @see backend/src/nest/root/root-self-termination.controller.ts
 * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §5.3
 */
import { getApiClient } from '$lib/utils/api-client';

import type { RootSelfTerminationRequest } from './types';

const apiClient = getApiClient();

/** List pending peer self-termination requests in the actor's tenant. */
export async function getPendingPeerRequests(): Promise<RootSelfTerminationRequest[]> {
  const result: unknown = await apiClient.get('/users/self-termination-requests/pending');
  return Array.isArray(result) ? (result as RootSelfTerminationRequest[]) : [];
}

/**
 * Approve a peer's request and execute soft-delete atomically.
 * Backend performs §2.4 TX ordering: lock → recount → flip status →
 * set GUC → UPDATE users. Throws ApiError on backend rejection
 * (412 LAST_ROOT_PROTECTION, 409 EXPIRED / SELF_DECISION_FORBIDDEN).
 * Backend status code 200; `apiClient.post` resolves to undefined for
 * empty-body responses.
 */
export async function approvePeerRequest(id: string, comment: string | null): Promise<void> {
  await apiClient.post(`/users/self-termination-requests/${id}/approve`, {
    comment: comment ?? undefined,
  });
}

/**
 * Reject a peer's request. `rejectionReason` MUST be non-empty after trim
 * — both the DTO (Zod, 400) and the service (409) enforce this. Backend
 * status code 200.
 */
export async function rejectPeerRequest(id: string, rejectionReason: string): Promise<void> {
  await apiClient.post(`/users/self-termination-requests/${id}/reject`, {
    rejectionReason,
  });
}
