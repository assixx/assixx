/**
 * Features Management - Data Layer
 * Handles all API interactions for features and plans
 */

import { ApiClient } from '../../utils/api-client';
import type { FeatureCategory, Plan, CurrentPlanResponse, TenantFeature, TenantAddons } from './types';

const apiClient = ApiClient.getInstance();

/**
 * Shared state - exported for access across modules
 */
export let plans: Record<string, Plan> = {};
let allPlans: Plan[] = []; // Internal only - used in loadPlans()
export let currentPlan: string = 'basic';
export let tenantAddons: TenantAddons = {};
export let currentTenantId: number | null = null;

/**
 * Feature categories with hardcoded structure
 * WHY: Features are predefined in the app, not dynamic from API
 */
export const featureCategories: Record<string, FeatureCategory> = {
  'Kern-Features': {
    icon: '⚙️',
    features: [
      {
        code: 'employees',
        name: 'Mitarbeiterverwaltung',
        description: 'Verwalten Sie Ihre Mitarbeiter effizient',
        minPlan: 'basic',
        active: false,
      },
      {
        code: 'documents',
        name: 'Dokumentenverwaltung',
        description: 'Zentrale Ablage für alle Dokumente',
        minPlan: 'basic',
        active: false,
      },
    ],
  },
  Kommunikation: {
    icon: '💬',
    features: [
      {
        code: 'blackboard',
        name: 'Schwarzes Brett',
        description: 'Unternehmensweite Ankündigungen',
        minPlan: 'professional',
        active: false,
      },
      {
        code: 'chat',
        name: 'Chat System',
        description: 'Echtzeit-Kommunikation im Team',
        minPlan: 'professional',
        active: false,
      },
      {
        code: 'surveys',
        name: 'Umfragen',
        description: 'Mitarbeiterfeedback sammeln',
        minPlan: 'enterprise',
        active: false,
      },
    ],
  },
  Organisation: {
    icon: '📊',
    features: [
      {
        code: 'calendar',
        name: 'Firmenkalender',
        description: 'Termine und Events verwalten',
        minPlan: 'professional',
        active: false,
      },
      {
        code: 'shift_planning',
        name: 'Schichtplanung',
        description: 'Automatisierte Schichtpläne',
        minPlan: 'enterprise',
        active: false,
      },
      {
        code: 'kvp',
        name: 'KVP System',
        description: 'Kontinuierliche Verbesserung',
        minPlan: 'enterprise',
        active: false,
      },
    ],
  },
};

/**
 * Parse JWT token to get tenant ID
 * Supports both snake_case (tenant_id) and camelCase (tenantId)
 */
function parseJwt(token: string): { tenant_id?: number; tenantId?: number } | null {
  try {
    return JSON.parse(atob(token.split('.')[1])) as { tenant_id?: number; tenantId?: number };
  } catch {
    return null;
  }
}

/**
 * Initialize tenant ID from token
 * WHY: JWT token contains tenant_id which is required for API calls
 * Tries both snake_case and camelCase formats for compatibility
 */
export function initializeTenantId(): void {
  const storedToken = localStorage.getItem('token');
  if (storedToken !== null) {
    const decoded = parseJwt(storedToken);
    if (decoded !== null) {
      // Try both formats: tenant_id (snake_case) and tenantId (camelCase)
      currentTenantId = decoded.tenant_id ?? decoded.tenantId ?? null;

      // Debug logging
      if (currentTenantId === null) {
        console.warn('JWT token does not contain tenant_id or tenantId:', decoded);
      } else {
        console.log('Tenant ID initialized:', currentTenantId);
      }
    }
  }
}

/**
 * Load all available plans from API
 */
export async function loadPlans(): Promise<void> {
  const plansData = await apiClient.request<{ data?: Plan[]; [key: string]: unknown }>('/plans', {
    method: 'GET',
  });

  // Extract data array
  allPlans = Array.isArray(plansData.data) ? plansData.data : Array.isArray(plansData) ? plansData : [];

  if (!Array.isArray(allPlans)) {
    console.error('Plans response is not an array:', allPlans);
    throw new Error('Invalid plans response');
  }

  // Convert to object format for easy access
  const loadedPlans: Record<string, Plan> = {};
  allPlans.forEach((plan) => {
    loadedPlans[plan.code] = plan;
  });

  // Only replace plans if we got valid data
  if (Object.keys(loadedPlans).length > 0) {
    plans = loadedPlans;
  }
}

/**
 * Load current tenant's plan
 */
export async function loadCurrentPlan(): Promise<void> {
  try {
    const currentPlanData = await apiClient.request<CurrentPlanResponse>('/plans/current', {
      method: 'GET',
    });

    // Extract plan info
    const planInfo = currentPlanData.data?.plan ?? currentPlanData.plan;
    const addonsInfo = currentPlanData.data?.addons ?? currentPlanData.addons ?? [];

    if (planInfo?.planCode === undefined) {
      console.warn('No plan data found, using fallback');
      currentPlan = 'basic';
      tenantAddons = {};
      return;
    }

    currentPlan = planInfo.planCode;

    // Handle trial status by mapping to actual plan
    if (currentPlan === 'trial' || planInfo.status === 'trial') {
      const planMap: Record<number, string> = {
        1: 'basic',
        2: 'professional',
        3: 'enterprise',
      };
      currentPlan = planMap[planInfo.planId] ?? 'basic';
    }

    // Parse addons
    tenantAddons = addonsInfo.reduce<TenantAddons>((acc, addon) => {
      const addonType = addon.addonType ?? addon.addon_type ?? '';
      if (addonType === 'employees') {
        acc.employees = addon.quantity;
      } else if (addonType === 'admins') {
        acc.admins = addon.quantity;
      } else if (addonType === 'storage_gb') {
        acc.storage_gb = addon.quantity;
      }
      return acc;
    }, {});
  } catch (error) {
    console.error('Failed to load current plan:', error);
    currentPlan = 'basic';
    tenantAddons = {};
  }
}

/**
 * Load tenant features and update active state
 */
export async function loadTenantFeatures(): Promise<void> {
  try {
    const featuresData = await apiClient.request<{ data?: TenantFeature[]; [key: string]: unknown }>(
      '/features/my-features',
      {
        method: 'GET',
      },
    );

    const features: TenantFeature[] = Array.isArray(featuresData.data)
      ? featuresData.data
      : Array.isArray(featuresData)
        ? featuresData
        : [];

    // Update feature active states
    Object.values(featureCategories).forEach((category) => {
      category.features.forEach((feature) => {
        const tenantFeature = features.find((f: TenantFeature) => f.code === feature.code);
        if (tenantFeature !== undefined) {
          // Backend may return either is_available (snake_case) or isAvailable (camelCase)
          const availability = tenantFeature.is_available ?? tenantFeature.isAvailable ?? 0;
          feature.active = availability === 1;
        }
      });
    });
  } catch (error) {
    console.error('Error loading tenant features:', error);
  }
}

/**
 * Change tenant plan
 */
export async function changePlan(newPlanCode: string): Promise<void> {
  if (currentTenantId === null) {
    throw new Error('Tenant ID not initialized');
  }

  await apiClient.request('/plans/change', {
    method: 'POST',
    body: JSON.stringify({
      tenantId: currentTenantId,
      newPlanCode: newPlanCode,
    }),
  });

  // Update local state
  currentPlan = newPlanCode;
}

/**
 * Activate a feature
 */
export async function activateFeature(featureCode: string): Promise<void> {
  if (currentTenantId === null) {
    throw new Error('Tenant ID not initialized');
  }

  await apiClient.request('/features/activate', {
    method: 'POST',
    body: JSON.stringify({
      tenantId: currentTenantId,
      featureCode: featureCode,
    }),
  });

  // Update local state
  Object.values(featureCategories).forEach((category) => {
    const feature = category.features.find((f) => f.code === featureCode);
    if (feature !== undefined) {
      feature.active = true;
    }
  });
}

/**
 * Deactivate a feature
 */
export async function deactivateFeature(featureCode: string): Promise<void> {
  if (currentTenantId === null) {
    throw new Error('Tenant ID not initialized');
  }

  await apiClient.request('/features/deactivate', {
    method: 'POST',
    body: JSON.stringify({
      tenantId: currentTenantId,
      featureCode: featureCode,
    }),
  });

  // Update local state
  Object.values(featureCategories).forEach((category) => {
    const feature = category.features.find((f) => f.code === featureCode);
    if (feature !== undefined) {
      feature.active = false;
    }
  });
}

/**
 * Save addons configuration
 * Backend expects: PUT /plans/addons with { employees?, admins?, storageGb? }
 * WHY: Admin-only endpoint, takes tenantId from req.user.tenant_id
 */
export async function saveAddons(): Promise<{ costs?: { totalCost: number } }> {
  // Convert storage_gb to storageGb for camelCase API
  const body = {
    employees: tenantAddons.employees,
    admins: tenantAddons.admins,
    storageGb: tenantAddons.storage_gb, // Backend expects camelCase
  };

  return await apiClient.request<{ costs?: { totalCost: number } }>('/plans/addons', {
    method: 'PUT', // Backend uses PUT, not POST
    body: JSON.stringify(body),
  });
}

/**
 * Adjust addon quantity
 * WHY: Explicit property access to avoid object injection security warning
 */
export function adjustAddon(type: 'employees' | 'admins' | 'storage', change: number): void {
  // Get current value with explicit checks
  let currentValue = 0;
  if (type === 'employees') {
    currentValue = tenantAddons.employees ?? 0;
  } else if (type === 'admins') {
    currentValue = tenantAddons.admins ?? 0;
  } else {
    // type === 'storage'
    currentValue = tenantAddons.storage_gb ?? 0;
  }

  const newValue = Math.max(0, currentValue + change);

  // Set new value with explicit checks
  if (type === 'employees') {
    tenantAddons.employees = newValue;
  } else if (type === 'admins') {
    tenantAddons.admins = newValue;
  } else {
    // type === 'storage'
    tenantAddons.storage_gb = newValue;
  }
}
