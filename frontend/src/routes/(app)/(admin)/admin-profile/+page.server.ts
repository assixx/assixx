/**
 * Admin Profile - Server-Side Data Loading
 * @module admin-profile/+page.server
 *
 * SSR: Loads admin user profile data.
 * Note: Admin profile is readonly except for password.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { profileForRole } from '$lib/server/role-redirects';

import type { PageServerLoad } from './$types';
import type { AdminProfile } from './_lib/types';

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Guard: only admin can access their profile
  const parentData = await parent();
  if (!parentData.user) {
    redirect(302, '/login');
  }
  if (parentData.user.role !== 'admin') {
    redirect(302, profileForRole(parentData.user.role));
  }

  // Fetch admin profile data
  const profileData = await apiFetch<AdminProfile>('/users/me', token, fetch);

  return {
    profile: profileData,
    // Tenant companyName from parent layout (not from user profile)
    tenantCompanyName: parentData.tenant?.companyName ?? null,
  };
};
