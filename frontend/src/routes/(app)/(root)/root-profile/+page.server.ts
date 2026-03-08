/**
 * Root Profile - Server-Side Data Loading
 * @module root-profile/+page.server
 *
 * SSR: Loads user profile and pending approvals.
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { UserProfile, ApprovalItem } from './_lib/types';

const log = createLogger('RootProfile');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

async function apiFetch<T>(
  endpoint: string,
  token: string,
  fetchFn: typeof fetch,
): Promise<T | null> {
  try {
    const response = await fetchFn(`${API_BASE}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      log.error({ status: response.status, endpoint }, 'API error');
      return null;
    }

    const json = (await response.json()) as ApiResponse<T>;
    if ('success' in json && json.success === true) {
      return json.data ?? null;
    }
    if ('data' in json && json.data !== undefined) {
      return json.data;
    }
    return json as unknown as T;
  } catch (err: unknown) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Get user from parent layout - only root can access
  // OPTIMIZATION: Reuse user from layout (already fetched via RBAC hook)
  const parentData = await parent();
  if (parentData.user?.role !== 'root') {
    redirect(302, '/dashboard');
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
