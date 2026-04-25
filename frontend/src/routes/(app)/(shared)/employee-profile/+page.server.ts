/**
 * Employee Profile - Server-Side Data Loading
 * @module employee-profile/+page.server
 *
 * SSR: Loads employee user profile data.
 * Note: Employee profile is readonly except for password.
 * Access: employee role only (admin/root get redirected to their profile)
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { profileForRole } from '$lib/server/role-redirects';
import { buildLoginUrl } from '$lib/utils/build-apex-url';

import type { PageServerLoad } from './$types';
import type { EmployeeProfile } from './_lib/types';

export const load: PageServerLoad = async ({ cookies, fetch, parent, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }

  // Guard: only employee can access their profile
  const parentData = await parent();
  if (!parentData.user) {
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }
  if (parentData.user.role !== 'employee') {
    redirect(302, profileForRole(parentData.user.role));
  }

  // Fetch employee profile data
  const profileData = await apiFetch<EmployeeProfile>('/users/me', token, fetch);

  return {
    profile: profileData,
  };
};
