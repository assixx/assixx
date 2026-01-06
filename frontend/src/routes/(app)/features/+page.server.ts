/**
 * Features Page - Server-Side Data Loading
 * @module features/+page.server
 *
 * SSR: Loads plans, current plan, and tenant features in parallel.
 * Access restricted to root users only.
 */
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Plan, TenantAddons, TenantFeature, AddonInfo } from './_lib/types';

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

interface CurrentPlanResponse {
  plan?: {
    planCode?: string;
    planId?: number;
    status?: string;
  };
  addons?: AddonInfo[];
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const startTime = performance.now();

  const token = cookies.get('accessToken');
  if (!token) {
    redirect(302, '/login');
  }

  // Check role from parent layout - only root users can access this page
  const parentData = await parent();
  if (parentData.user?.role !== 'root') {
    redirect(302, '/login');
  }

  // Parallel fetch: plans + current plan + tenant features
  const [plansData, currentPlanData, tenantFeaturesData] = await Promise.all([
    apiFetch<Plan[]>('/plans', token, fetch),
    apiFetch<CurrentPlanResponse>('/plans/current', token, fetch),
    apiFetch<TenantFeature[]>('/features/my-features', token, fetch),
  ]);

  // Process plans into dictionary
  const plans: Record<string, Plan> = {};
  const plansArray = Array.isArray(plansData) ? plansData : [];
  plansArray.forEach((plan) => {
    plans[plan.code] = plan;
  });

  // Process current plan info
  let currentPlanCode = 'basic';
  const addons: TenantAddons = {};

  if (currentPlanData !== null) {
    // Handle different response formats
    const planInfo =
      currentPlanData.plan ??
      (currentPlanData as unknown as { planCode?: string; planId?: number; status?: string });
    const addonsInfo: AddonInfo[] = currentPlanData.addons ?? [];

    if (planInfo?.planCode) {
      currentPlanCode = planInfo.planCode;

      // Handle trial status - map to actual plan
      if (currentPlanCode === 'trial' || planInfo.status === 'trial') {
        const planMap: Record<number, string> = {
          1: 'basic',
          2: 'professional',
          3: 'enterprise',
        };
        currentPlanCode = planMap[planInfo.planId ?? 1] ?? 'basic';
      }
    }

    // Parse addons
    addonsInfo.forEach((addon) => {
      const addonType = addon.addonType ?? '';
      if (addonType === 'employees') addons.employees = addon.quantity;
      else if (addonType === 'admins') addons.admins = addon.quantity;
      else if (addonType === 'storage_gb') addons.storage_gb = addon.quantity;
    });
  }

  // Safe fallback for tenant features
  const tenantFeatures = Array.isArray(tenantFeaturesData) ? tenantFeaturesData : [];

  const duration = (performance.now() - startTime).toFixed(1);
  console.info(`[SSR] features loaded in ${duration}ms (3 parallel API calls)`);

  return {
    plans,
    currentPlanCode,
    addons,
    tenantFeatures,
    tenantId: parentData.user?.tenantId ?? null,
  };
};
