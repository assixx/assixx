/**
 * Manage Approvals — Server-Side Data Loading
 * @module shared/manage-approvals/+page.server
 *
 * SSR: Placeholder for approval data loading.
 * Access: root, admin (hasFullAccess), department_lead, area_lead, team_lead, approval masters.
 * Route lives in (shared) group — role check at page level.
 * Core addon — no requireAddon() needed (always active).
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { OrganizationalScope } from '$lib/types/organizational-scope';
import type { PageServerLoad } from './$types';

interface ApprovalListItem {
  uuid: string;
  addonCode: string;
  sourceEntityType: string;
  title: string;
  description: string | null;
  requestedByName: string;
  status: 'pending' | 'approved' | 'rejected';
  priority: string;
  createdAt: string;
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

export const load: PageServerLoad = async ({ cookies, parent, url }) => {
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

  void token;

  const emptyStats: ApprovalStats = {
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  };
  const emptyApprovals: ApprovalListItem[] = [];

  return { stats: emptyStats, approvals: emptyApprovals };
};
