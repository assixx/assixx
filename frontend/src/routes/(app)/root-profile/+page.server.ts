/**
 * Root Profile - Server-Side Data Loading
 * @module root-profile/+page.server
 *
 * SSR: Loads user profile and pending approvals.
 */
import { redirect } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';
import type { UserProfile, ApprovalItem } from './_lib/types';

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
      console.error(`[SSR] API error ${response.status} for ${endpoint}`);
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
  } catch (error) {
    console.error(`[SSR] Fetch error for ${endpoint}:`, error);
    return null;
  }
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Get user from parent layout - only root can access
  const parentData = await parent();
  if (parentData.user?.role !== 'root') {
    redirect(302, '/dashboard');
  }

  // Parallel fetch: profile + pending approvals
  const [profileData, approvalsData] = await Promise.all([
    apiFetch<UserProfile>('/users/me', token, fetch),
    apiFetch<ApprovalItem[]>('/root/deletion-approvals/pending', token, fetch),
  ]);

  return {
    profile: profileData,
    pendingApprovals: Array.isArray(approvalsData) ? approvalsData : [],
  };
};
