/**
 * Features Page - API Functions
 * @module features/_lib/api
 */

import { getApiClient } from '$lib/utils/api-client';

import type {
  Plan,
  TenantAddons,
  FeatureCategory,
  AddonInfo,
  TenantFeature,
} from './types';

const apiClient = getApiClient();

/** API response wrapper for plans endpoint */
interface PlansApiResponse {
  data?: Plan[];
}

/** Plan info from current plan endpoint */
interface CurrentPlanInfo {
  planCode?: string;
  planId?: number;
  status?: string;
}

/** API response wrapper for current plan endpoint */
interface CurrentPlanApiResponse {
  data?: {
    plan?: CurrentPlanInfo;
    addons?: AddonInfo[];
  };
  plan?: CurrentPlanInfo;
  addons?: AddonInfo[];
}

/** API response wrapper for tenant features endpoint */
interface TenantFeaturesApiResponse {
  data?: TenantFeature[];
}

/** Map of plan IDs to plan codes for trial resolution */
const PLAN_ID_TO_CODE: Record<number, string> = {
  1: 'basic',
  2: 'professional',
  3: 'enterprise',
};

/** Resolve plan code from plan info, handling trial status */
function resolvePlanCode(planInfo: CurrentPlanInfo | undefined): string {
  if (planInfo?.planCode === undefined || planInfo.planCode === '') {
    return 'basic';
  }

  const planCode = planInfo.planCode;

  // Trial plans need to be mapped to actual plan
  const isTrial = planCode === 'trial' || planInfo.status === 'trial';
  if (!isTrial) {
    return planCode;
  }

  if (planInfo.planId === undefined) {
    return 'basic';
  }

  return PLAN_ID_TO_CODE[planInfo.planId] ?? 'basic';
}

/** Parse addon info array into TenantAddons object */
function parseAddons(addonsInfo: AddonInfo[]): TenantAddons {
  const addons: TenantAddons = {};

  for (const addon of addonsInfo) {
    const addonType = addon.addonType ?? '';
    switch (addonType) {
      case 'employees':
        addons.employees = addon.quantity;
        break;
      case 'admins':
        addons.admins = addon.quantity;
        break;
      case 'storage_gb':
        addons.storage_gb = addon.quantity;
        break;
    }
  }

  return addons;
}

/** Load all available plans */
export async function loadPlans(): Promise<Record<string, Plan>> {
  const result = await apiClient.get<PlansApiResponse | Plan[]>('/plans');

  const plansArray: Plan[] =
    Array.isArray(result) ? result
    : Array.isArray(result.data) ? result.data
    : [];

  const loadedPlans: Record<string, Plan> = {};
  plansArray.forEach((plan) => {
    loadedPlans[plan.code] = plan;
  });

  return loadedPlans;
}

/** Load current tenant's plan info */
export async function loadCurrentPlan(): Promise<{
  planCode: string;
  addons: TenantAddons;
}> {
  const result = await apiClient.get<CurrentPlanApiResponse>('/plans/current');

  const planInfo: CurrentPlanInfo | undefined =
    result.data?.plan ?? result.plan;
  const addonsInfo: AddonInfo[] = result.data?.addons ?? result.addons ?? [];

  return {
    planCode: resolvePlanCode(planInfo),
    addons: parseAddons(addonsInfo),
  };
}

/** Load tenant features and return active feature codes */
export async function loadTenantFeatures(): Promise<TenantFeature[]> {
  const result = await apiClient.get<
    TenantFeaturesApiResponse | TenantFeature[]
  >('/features/my-features');
  return (
    Array.isArray(result) ? result
    : Array.isArray(result.data) ? result.data
    : []
  );
}

/** Update feature categories with active state from API */
export function applyTenantFeaturesToCategories(
  categories: Record<string, FeatureCategory>,
  tenantFeatures: TenantFeature[],
): Record<string, FeatureCategory> {
  const updated = { ...categories };

  Object.values(updated).forEach((category) => {
    category.features.forEach((feature) => {
      const tenantFeature = tenantFeatures.find((f) => f.code === feature.code);
      if (tenantFeature) {
        const availability = tenantFeature.isAvailable ?? 0;
        feature.active = availability === 1;
      }
    });
  });

  return updated;
}

/** Change tenant plan */
export async function changePlan(
  tenantId: number | null,
  newPlanCode: string,
): Promise<void> {
  await apiClient.post('/plans/change', { tenantId, newPlanCode });
}

/** Toggle feature activation */
export async function toggleFeature(
  tenantId: number | null,
  featureCode: string,
  activate: boolean,
): Promise<void> {
  const endpoint = activate ? '/features/activate' : '/features/deactivate';
  await apiClient.post(endpoint, { tenantId, featureCode });
}

/** Save addons configuration */
export async function saveAddons(addons: TenantAddons): Promise<void> {
  await apiClient.put('/plans/addons', {
    employees: addons.employees,
    admins: addons.admins,
    storageGb: addons.storage_gb,
  });
}
