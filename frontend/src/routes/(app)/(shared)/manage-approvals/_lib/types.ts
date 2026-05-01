/**
 * Manage Approvals — Type Definitions
 * @module shared/manage-approvals/_lib/types
 *
 * Root self-termination peer-approval types — Step 5.3 of
 * FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md. Mirrors the backend domain
 * shape `RootSelfTerminationRequest` from
 * `backend/src/nest/root/root-self-termination.service.ts`.
 *
 * WHY a separate type file (vs. inline in +page.server.ts):
 * The card component (`RootSelfTerminationCard.svelte`) consumes the
 * same shape — keeping the type here avoids cross-file imports of an
 * inline interface from the +page.server.ts module. Mirrors the
 * `(root)/root-profile/_lib/types.ts` convention from Step 5.1.
 */

/** Status enum — matches DB `root_self_termination_status` (Phase 1 §1.1). */
export type RootSelfTerminationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'cancelled';

/**
 * Self-termination request as delivered by the API (camelCase + ISO date
 * strings). Reflects `rowToDomain()` in the backend service.
 */
export interface RootSelfTerminationRequest {
  id: string;
  tenantId: number;
  requesterId: number;
  reason: string | null;
  status: RootSelfTerminationStatus;
  expiresAt: string;
  approvedBy: number | null;
  approvedAt: string | null;
  rejectedBy: number | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lookup-table entry for resolving requester display names.
 *
 * The backend `getPendingRequestsForApproval` returns raw `requesterId`
 * (numeric) only — no enriched `requesterName`. To preserve the
 * `requestedByName` UX pattern from the existing approvals card, the
 * page-server fetches `/users?role=root` in parallel (same call
 * `/manage-root` already uses) and builds a `Record<number, string>`
 * map at SSR time.
 */
export interface RootUserLookup {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

// =============================================================================
// Approvals List — pagination types
// =============================================================================
//
// Mirrors backend `PaginatedApprovals` shape (see ApprovalsController list
// endpoint). Shared between +page.server.ts (SSR) and +page.svelte (client
// page-change re-fetch via listApprovals). Phase-2 server-driven pagination
// pattern — see docs/how-to/HOW-TO-FIX-MANAGE-PAGINATION.md.

/**
 * Single approval row as delivered by `/approvals?page=N&limit=N`. Fields
 * mirror the backend `ApprovalListItem` projection. The +page.svelte UI
 * consumes a subset (no `requestedBy`/`assignedTo`/`decidedBy` IDs needed —
 * names are sufficient for display) but the full shape is kept here so the
 * type stays a single source of truth across server + client.
 */
export interface ApprovalListItem {
  uuid: string;
  addonCode: string;
  sourceEntityType: string;
  sourceUuid: string;
  title: string;
  description: string | null;
  requestedBy: number;
  requestedByName: string;
  assignedTo: number | null;
  assignedToName: string | null;
  status: 'pending' | 'approved' | 'rejected';
  priority: string;
  decidedBy: number | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  rewardAmount: number | null;
  isRead: boolean;
  createdAt: string;
}

/** Paginated list envelope — matches backend `PaginatedApprovals`. */
export interface PaginatedApprovals {
  items: ApprovalListItem[];
  total: number;
  page: number;
  pageSize: number;
}
