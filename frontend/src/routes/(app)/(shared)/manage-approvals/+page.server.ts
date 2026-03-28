/**
 * Manage Approvals — Server-Side Data Loading
 * @module shared/manage-approvals/+page.server
 *
 * SSR: Loads approvals + stats from backend API.
 * Access: root, admin (hasFullAccess), department_lead, area_lead, team_lead.
 * Route lives in (shared) group — role check at page level.
 * Core addon — no requireAddon() needed (always active).
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { createLogger } from '$lib/utils/logger';

import type { OrganizationalScope } from '$lib/types/organizational-scope';
import type { PageServerLoad } from './$types';

interface ApprovalListItem {
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

interface PaginatedApprovals {
  items: ApprovalListItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

const log = createLogger('ManageApprovals');

function hasManageAccess(
  role: string,
  hasFullAccess: boolean,
  orgScope: OrganizationalScope,
): boolean {
  if (role === 'root') return true;
  if (role === 'admin' && hasFullAccess) return true;
  return orgScope.isAnyLead;
}

export const load: PageServerLoad = async ({ cookies, fetch, parent, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const parentData = await parent();
  const user = parentData.user;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defense-in-depth
  if (user === null || user === undefined) {
    log.warn({ pathname: url.pathname }, 'RBAC: No user data');
    redirect(302, '/login');
  }

  if (!hasManageAccess(user.role, user.hasFullAccess, parentData.orgScope)) {
    log.warn(
      { pathname: url.pathname, userRole: user.role },
      'RBAC: Access denied to manage-approvals',
    );
    redirect(302, '/permission-denied');
  }

  const emptyPage: PaginatedApprovals = {
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  };
  const emptyStats: ApprovalStats = {
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  };

  const [approvalsData, statsData, rewardTiersData] = await Promise.all([
    apiFetch<PaginatedApprovals>('/approvals?page=1&limit=20', token, fetch),
    apiFetch<ApprovalStats>('/approvals/stats', token, fetch),
    apiFetch<{ id: number; amount: number; sortOrder: number }[]>(
      '/kvp/reward-tiers',
      token,
      fetch,
    ),
  ]);

  return {
    approvals: approvalsData ?? emptyPage,
    stats: statsData ?? emptyStats,
    rewardTiers: Array.isArray(rewardTiersData) ? rewardTiersData : [],
  };
};
