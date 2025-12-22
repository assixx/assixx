/**
 * Features Page - API Functions
 * @module features/_lib/api
 */

import type { Plan, TenantAddons, FeatureCategory, AddonInfo, TenantFeature } from './types';

/** Get auth token from localStorage */
function getAuthToken(): string | null {
  return localStorage.getItem('accessToken');
}

/** Create auth headers */
function createHeaders(includeContentType = false): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
  };
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

/**
 * Load all available plans
 * @returns Dictionary of plans by code
 */
export async function loadPlans(): Promise<Record<string, Plan>> {
  const response = await fetch('/api/v2/plans', {
    headers: createHeaders(),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const result = await response.json();
  const plansArray: Plan[] = Array.isArray(result.data)
    ? result.data
    : Array.isArray(result)
      ? result
      : [];

  const loadedPlans: Record<string, Plan> = {};
  plansArray.forEach((plan) => {
    loadedPlans[plan.code] = plan;
  });

  return loadedPlans;
}

/**
 * Load current tenant's plan info
 * @returns Object with current plan code and addons
 */
export async function loadCurrentPlan(): Promise<{
  planCode: string;
  addons: TenantAddons;
}> {
  const response = await fetch('/api/v2/plans/current', {
    headers: createHeaders(),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const result = await response.json();
  const planInfo = result.data?.plan ?? result.plan;
  const addonsInfo: AddonInfo[] = result.data?.addons ?? result.addons ?? [];

  let planCode = 'basic';

  if (planInfo?.planCode) {
    planCode = planInfo.planCode;

    // Handle trial status
    if (planCode === 'trial' || planInfo.status === 'trial') {
      const planMap: Record<number, string> = {
        1: 'basic',
        2: 'professional',
        3: 'enterprise',
      };
      planCode = planMap[planInfo.planId] ?? 'basic';
    }
  }

  // Parse addons
  const addons: TenantAddons = {};
  addonsInfo.forEach((addon) => {
    const addonType = addon.addonType ?? addon.addon_type ?? '';
    if (addonType === 'employees') addons.employees = addon.quantity;
    else if (addonType === 'admins') addons.admins = addon.quantity;
    else if (addonType === 'storage_gb') addons.storage_gb = addon.quantity;
  });

  return { planCode, addons };
}

/**
 * Load tenant features and return active feature codes
 * @returns Array of feature codes with their availability
 */
export async function loadTenantFeatures(): Promise<TenantFeature[]> {
  const response = await fetch('/api/v2/features/my-features', {
    headers: createHeaders(),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const result = await response.json();
  return Array.isArray(result.data) ? result.data : Array.isArray(result) ? result : [];
}

/**
 * Update feature categories with active state from API
 * @param categories - Feature categories to update
 * @param tenantFeatures - Tenant features from API
 */
export function applyTenantFeaturesToCategories(
  categories: Record<string, FeatureCategory>,
  tenantFeatures: TenantFeature[],
): Record<string, FeatureCategory> {
  const updated = { ...categories };

  Object.values(updated).forEach((category) => {
    category.features.forEach((feature) => {
      const tenantFeature = tenantFeatures.find((f) => f.code === feature.code);
      if (tenantFeature) {
        const availability = tenantFeature.is_available ?? tenantFeature.isAvailable ?? 0;
        feature.active = availability === 1;
      }
    });
  });

  return updated;
}

/**
 * Change tenant plan
 * @param tenantId - Tenant ID
 * @param newPlanCode - New plan code to switch to
 */
export async function changePlan(tenantId: number | null, newPlanCode: string): Promise<void> {
  await fetch('/api/v2/plans/change', {
    method: 'POST',
    headers: createHeaders(true),
    body: JSON.stringify({
      tenantId,
      newPlanCode,
    }),
  });
}

/**
 * Toggle feature activation
 * @param tenantId - Tenant ID
 * @param featureCode - Feature code
 * @param activate - Whether to activate or deactivate
 */
export async function toggleFeature(
  tenantId: number | null,
  featureCode: string,
  activate: boolean,
): Promise<void> {
  const endpoint = activate ? '/api/v2/features/activate' : '/api/v2/features/deactivate';

  await fetch(endpoint, {
    method: 'POST',
    headers: createHeaders(true),
    body: JSON.stringify({
      tenantId,
      featureCode,
    }),
  });
}

/**
 * Save addons configuration
 * @param addons - Addons to save
 */
export async function saveAddons(addons: TenantAddons): Promise<void> {
  const response = await fetch('/api/v2/plans/addons', {
    method: 'PUT',
    headers: createHeaders(true),
    body: JSON.stringify({
      employees: addons.employees,
      admins: addons.admins,
      storageGb: addons.storage_gb,
    }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}
