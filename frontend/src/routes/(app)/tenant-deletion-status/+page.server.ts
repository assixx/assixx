/**
 * Tenant Deletion Status - Server-Side Data Loading
 * @module tenant-deletion-status/+page.server
 *
 * SSR: Loads deletion status. Only root users can access.
 */
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { DeletionStatusItem } from './_lib/types';

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const startTime = performance.now();

  const token = cookies.get('accessToken');
  if (!token) {
    redirect(302, '/login');
  }

  // Only root users can access this page
  const parentData = await parent();
  if (parentData.user?.role !== 'root') {
    redirect(302, '/login');
  }

  try {
    const response = await fetch(`${API_BASE}/root/tenant/deletion-status`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // 404 means no deletion found - not an error
    if (response.status === 404) {
      return {
        statusData: [],
        currentUserId: parentData.user.id,
      };
    }

    if (!response.ok) {
      console.error(`[SSR] API error ${response.status} for /root/tenant/deletion-status`);
      return {
        statusData: [],
        currentUserId: parentData.user.id,
      };
    }

    const json = (await response.json()) as ApiResponse<DeletionStatusItem | DeletionStatusItem[]>;

    // Handle different response formats
    let statusData: DeletionStatusItem[] = [];
    const data = json.data ?? json;

    if (Array.isArray(data)) {
      statusData = data;
    } else if (typeof data === 'object' && data !== null && 'queueId' in data) {
      statusData = [data];
    }

    const duration = (performance.now() - startTime).toFixed(1);
    console.info(`[SSR] tenant-deletion-status loaded in ${duration}ms`);

    return {
      statusData,
      currentUserId: parentData.user.id,
    };
  } catch (error) {
    console.error(`[SSR] Fetch error for /root/tenant/deletion-status:`, error);
    return {
      statusData: [],
      currentUserId: parentData.user?.id ?? null,
    };
  }
};
