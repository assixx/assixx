/**
 * Tenant Deletion Status - Server-Side Data Loading
 * @module tenant-deletion-status/+page.server
 *
 * SSR: Loads deletion status. Only root users can access.
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { DeletionStatusItem } from './_lib/types';

const log = createLogger('TenantDeletionStatus');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

/**
 * Parse API response into an array of deletion status items.
 * Handles both single object and array responses.
 */
function parseStatusResponse(
  json: ApiResponse<DeletionStatusItem | DeletionStatusItem[]>,
): DeletionStatusItem[] {
  const data = json.data ?? json;

  if (Array.isArray(data)) {
    return data;
  }

  // Single object response with queueId property
  if (typeof data === 'object' && 'queueId' in data) {
    return [data];
  }

  return [];
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Only root users can access this page
  const parentData = await parent();
  if (parentData.user?.role !== 'root') {
    redirect(302, '/login');
  }

  const userId = parentData.user.id;

  try {
    const response = await fetch(`${API_BASE}/root/tenant/deletion-status`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // 404 means no deletion found - not an error
    if (!response.ok) {
      if (response.status !== 404) {
        log.error(
          { status: response.status, endpoint: '/root/tenant/deletion-status' },
          'API error',
        );
      }
      return { statusData: [], currentUserId: userId };
    }

    const json = (await response.json()) as ApiResponse<DeletionStatusItem | DeletionStatusItem[]>;

    return {
      statusData: parseStatusResponse(json),
      currentUserId: userId,
    };
  } catch (err) {
    log.error({ err, endpoint: '/root/tenant/deletion-status' }, 'Fetch error');
    return { statusData: [], currentUserId: userId };
  }
};
