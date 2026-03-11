/**
 * Addon Management Page — Server-Side Data Loading
 * @module addons/+page.server
 *
 * SSR: Loads all addons with tenant status + summary.
 * Access restricted to root users.
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { AddonWithTenantStatus, TenantAddonsSummary } from './_lib/types';

const log = createLogger('AddonManagement');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

const EMPTY_SUMMARY: TenantAddonsSummary = {
  tenantId: 0,
  coreAddons: 0,
  activeAddons: 0,
  trialAddons: 0,
  cancelledAddons: 0,
  monthlyCost: 0,
};

async function apiFetch<T>(
  endpoint: string,
  token: string,
  fetchFn: typeof fetch,
): Promise<T | null> {
  try {
    const response = await fetchFn(`${API_BASE}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      log.error({ status: response.status, endpoint }, 'API error');
      return null;
    }

    return (await response.json()) as T;
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

  const parentData = await parent();
  if (parentData.user?.role !== 'root') {
    redirect(302, '/login');
  }

  const tenantId = parentData.user.tenantId;

  const [addonsData, summaryData] = await Promise.all([
    apiFetch<AddonWithTenantStatus[]>('/addons/my-addons', token, fetch),
    apiFetch<TenantAddonsSummary>(
      `/addons/tenant/${String(tenantId)}/summary`,
      token,
      fetch,
    ),
  ]);

  return {
    addons: addonsData ?? [],
    summary: summaryData ?? { ...EMPTY_SUMMARY, tenantId },
    tenantId,
  };
};
