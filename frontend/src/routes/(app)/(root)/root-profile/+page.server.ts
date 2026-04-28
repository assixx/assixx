/**
 * Root Profile - Server-Side Data Loading
 * @module root-profile/+page.server
 *
 * SSR: Loads user profile and pending approvals.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { profileForRole } from '$lib/server/role-redirects';
import { buildLoginUrl } from '$lib/utils/build-apex-url';

import type { PageServerLoad } from './$types';
import type { UserProfile, ApprovalItem, SelfTerminationRequest } from './_lib/types';

export const load: PageServerLoad = async ({ cookies, fetch, parent, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }

  // Guard: only root can access their profile
  const parentData = await parent();
  if (!parentData.user) {
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }
  if (parentData.user.role !== 'root') {
    redirect(302, profileForRole(parentData.user.role));
  }

  // Use parent user data as profile (saves ~30ms redundant /users/me call)
  const profileData: UserProfile = {
    id: parentData.user.id,
    email: parentData.user.email,
    firstName: parentData.user.firstName,
    lastName: parentData.user.lastName,
    profilePicture: parentData.user.profilePicture,
    role: parentData.user.role,
  };

  // Only fetch pending approvals + self-termination state (data not in parent).
  // Both endpoints are root-only (`@Roles('root')`); the (root) layout guard
  // and the role check above already gate access — these calls are safe to
  // run unconditionally for an authenticated root user.
  const [approvalsData, selfTerminationData] = await Promise.all([
    apiFetch<ApprovalItem[]>('/root/deletion-approvals/pending', token, fetch),
    apiFetch<SelfTerminationRequest | null>('/users/me/self-termination-request', token, fetch),
  ]);

  return {
    profile: profileData,
    pendingApprovals: Array.isArray(approvalsData) ? approvalsData : [],
    // null when no pending request exists — UI uses this to pick the eligible
    // vs. pending state in `SelfTerminationCard`. See masterplan §5.1.
    selfTerminationPending: selfTerminationData ?? null,
  };
};
