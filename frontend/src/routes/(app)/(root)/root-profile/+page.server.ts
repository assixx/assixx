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
import type { UserProfile, ApprovalItem } from './_lib/types';

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

  // Only fetch pending approvals (the only data not in parent)
  const approvalsData = await apiFetch<ApprovalItem[]>(
    '/root/deletion-approvals/pending',
    token,
    fetch,
  );

  return {
    profile: profileData,
    pendingApprovals: Array.isArray(approvalsData) ? approvalsData : [],
  };
};
