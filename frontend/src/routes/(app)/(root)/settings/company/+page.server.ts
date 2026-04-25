/**
 * Addon Settings — Server-Side Data Loading
 * Root-only: RBAC enforced by (root) layout group
 */
import { redirect } from '@sveltejs/kit';

import { buildLoginUrl } from '$lib/utils/build-apex-url';
import { createLogger } from '$lib/utils/logger.js';

import type { PageServerLoad } from './$types';

const log = createLogger('Settings:Addons');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface KvpSettings {
  dailyLimit: number;
}

interface RewardTier {
  id: number;
  amount: number;
  sortOrder: number;
}

async function fetchJson<T>(url: string, token: string, fetchFn: typeof fetch): Promise<T | null> {
  const res = await fetchFn(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { success?: boolean; data?: T };
  return json.data ?? (json as unknown as T);
}

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }

  try {
    const [settingsJson, tiersJson, swapSettingJson] = await Promise.all([
      fetchJson<KvpSettings>(`${API_BASE}/kvp/settings`, token, fetch),
      fetchJson<RewardTier[]>(`${API_BASE}/kvp/reward-tiers`, token, fetch),
      fetchJson<{ swapRequestsEnabled: boolean }>(
        `${API_BASE}/organigram/swap-requests-enabled`,
        token,
        fetch,
      ),
    ]);

    return {
      kvpSettings: settingsJson,
      rewardTiers: Array.isArray(tiersJson) ? tiersJson : [],
      loadError: settingsJson === null,
      swapRequestsEnabled: swapSettingJson?.swapRequestsEnabled ?? false,
    };
  } catch (err: unknown) {
    log.error({ err }, 'Fetch error');
    return {
      kvpSettings: null,
      rewardTiers: [] as RewardTier[],
      loadError: true,
      swapRequestsEnabled: false,
    };
  }
};
