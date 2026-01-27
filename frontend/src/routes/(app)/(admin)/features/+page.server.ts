/**
 * Features Page - Server-Side Data Loading
 * @module features/+page.server
 *
 * SSR: Loads plans, current plan, and tenant features in parallel.
 * Access restricted to root users only.
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type {
  Plan,
  TenantAddons,
  TenantFeature,
  AddonInfo,
} from './_lib/types';

const log = createLogger('Features');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  plan?: {
    planCode?: string;
    planId?: number;
    status?: string;
  };
  addons?: AddonInfo[];
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
  } catch (err) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

interface CurrentPlanResponse {
  plan?: {
    planCode?: string;
    planId?: number;
    status?: string;
  };
  addons?: AddonInfo[];
}

interface PlanInfo {
  planCode?: string;
  planId?: number;
  status?: string;
}

const PLAN_ID_MAP: Record<number, string> = {
  1: 'basic',
  2: 'professional',
  3: 'enterprise',
};

/** Convert plans array to dictionary keyed by plan code */
function buildPlansDictionary(plansData: Plan[] | null): Record<string, Plan> {
  const plans: Record<string, Plan> = {};
  const plansArray = Array.isArray(plansData) ? plansData : [];
  for (const plan of plansArray) {
    plans[plan.code] = plan;
  }
  return plans;
}

/** Resolve plan code, handling trial status mapping */
function resolvePlanCode(planInfo: PlanInfo): string {
  const code = planInfo.planCode ?? 'basic';
  if (code === 'trial' || planInfo.status === 'trial') {
    return PLAN_ID_MAP[planInfo.planId ?? 1] ?? 'basic';
  }
  return code;
}

/** Parse addon info array into TenantAddons object */
function parseAddons(addonsInfo: AddonInfo[]): TenantAddons {
  const addons: TenantAddons = {};
  for (const addon of addonsInfo) {
    const addonType = addon.addonType ?? '';
    if (addonType === 'employees') addons.employees = addon.quantity;
    else if (addonType === 'admins') addons.admins = addon.quantity;
    else if (addonType === 'storage_gb') addons.storage_gb = addon.quantity;
  }
  return addons;
}

/** Process current plan response into plan code and addons */
function processCurrentPlan(data: CurrentPlanResponse | null): {
  planCode: string;
  addons: TenantAddons;
} {
  if (data === null) {
    return { planCode: 'basic', addons: {} };
  }

  const planInfo: PlanInfo = data.plan ?? (data as unknown as PlanInfo);
  const planCode = resolvePlanCode(planInfo);
  const addons = parseAddons(data.addons ?? []);

  return { planCode, addons };
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

  const [plansData, currentPlanData, tenantFeaturesData] = await Promise.all([
    apiFetch<Plan[]>('/plans', token, fetch),
    apiFetch<CurrentPlanResponse>('/plans/current', token, fetch),
    apiFetch<TenantFeature[]>('/features/my-features', token, fetch),
  ]);

  const plans = buildPlansDictionary(plansData);
  const { planCode: currentPlanCode, addons } =
    processCurrentPlan(currentPlanData);
  const tenantFeatures =
    Array.isArray(tenantFeaturesData) ? tenantFeaturesData : [];

  return {
    plans,
    currentPlanCode,
    addons,
    tenantFeatures,
    tenantId: parentData.user.tenantId,
  };
};
