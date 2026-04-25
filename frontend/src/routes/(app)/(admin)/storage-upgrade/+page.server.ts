/**
 * Storage Upgrade - Server-Side Data Loading
 * @module storage-upgrade/+page.server
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { buildLoginUrl } from '$lib/utils/build-apex-url';

import type { PageServerLoad } from './$types';

/** Current plan response */
interface CurrentPlanResponse {
  plan?: {
    code?: string;
    name?: string;
  };
}

/** Addons response */
interface AddonsResponse {
  storageGb?: number;
}

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
  // 1. Auth check
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }

  // 2. Parallel fetch plan and addons data
  const [currentPlan, addons] = await Promise.all([
    apiFetch<CurrentPlanResponse>('/plans/current', token, fetch),
    apiFetch<AddonsResponse>('/plans/addons', token, fetch),
  ]);

  // 3. Calculate storage info
  const storageGb = addons?.storageGb ?? 5;
  const planCode = currentPlan?.plan?.code ?? 'basic';

  // 4. Return typed data
  return {
    title: 'Speicher erweitern',
    storageInfo: {
      used: 0, // Platzhalter — Backend-Endpoint für tatsächlichen Verbrauch fehlt noch
      total: storageGb * 1024 * 1024 * 1024, // Convert GB to bytes
      percentage: 0,
      plan: planCode,
    },
  };
};
