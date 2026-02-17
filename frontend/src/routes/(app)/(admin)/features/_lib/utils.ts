/**
 * Features Page - Utility Functions
 * @module features/_lib/utils
 */

import { PLAN_ORDER, ADDON_PRICING } from './constants';

import type { Feature, JwtPayload, Plan, TenantAddons } from './types';

/** Parse JWT token to extract payload */
export function parseJwt(token: string): JwtPayload | null {
  try {
    const tokenPart = token.split('.')[1];
    if (!tokenPart) return null;
    return JSON.parse(atob(tokenPart)) as JwtPayload;
  } catch {
    return null;
  }
}

/** Check if feature can be activated based on current plan */
export function canActivateFeature(
  currentPlan: string,
  minPlan: string,
): boolean {
  return (
    PLAN_ORDER.indexOf(currentPlan as (typeof PLAN_ORDER)[number]) >=
    PLAN_ORDER.indexOf(minPlan as (typeof PLAN_ORDER)[number])
  );
}

/** Check if feature is included in current plan */
export function isFeatureIncludedInPlan(
  featureCode: string,
  currentPlan: string,
  plans: Record<string, Plan | undefined>,
): boolean {
  if (currentPlan === 'enterprise') return true;
  const planData = plans[currentPlan];
  if (planData?.features === undefined) return false;
  return planData.features.some((f) => f.featureCode === featureCode);
}

/** Get plan badge text for display */
export function getPlanBadge(minPlan: string): string {
  if (minPlan === 'basic') return 'Ab Basic';
  if (minPlan === 'professional') return 'Ab Professional';
  if (minPlan === 'enterprise') return 'Enterprise Only';
  return minPlan;
}

/** Get feature status text */
export function getFeatureStatusText(
  isActive: boolean,
  canActivate: boolean,
): string {
  if (isActive) return 'Aktiv';
  if (!canActivate) return 'Gesperrt';
  return 'Inaktiv';
}

/** Get feature status CSS class */
export function getFeatureStatusClass(
  isActive: boolean,
  canActivate: boolean,
): string {
  if (isActive) return 'status-active';
  if (!canActivate) return 'status-locked';
  return 'status-inactive';
}

/** Get feature card CSS classes */
export function getFeatureCardClasses(
  feature: Feature,
  currentPlan: string,
): string {
  const canActivate = canActivateFeature(currentPlan, feature.minPlan);
  let classes = 'feature-card';
  if (!canActivate) classes += ' feature-card--premium';
  else if (feature.active) classes += ' active';
  else classes += ' inactive';
  return classes;
}

/** Calculate total monthly cost */
export function calculateTotalCost(
  planData: Plan | undefined,
  addons: TenantAddons,
): number {
  const baseCost = planData?.basePrice ?? 0;
  const employeeCost = (addons.employees ?? 0) * ADDON_PRICING.employees;
  const adminCost = (addons.admins ?? 0) * ADDON_PRICING.admins;
  const storageCost =
    ((addons.storage_gb ?? 0) / 100) * ADDON_PRICING.storage_per_100gb;
  return baseCost + employeeCost + adminCost + storageCost;
}

/** Count active features */
export function countActiveFeatures(
  featureCategories: Record<string, { features: Feature[] }>,
  currentPlan: string,
): { active: number; total: number } {
  let active = 0;
  let total = 0;

  Object.values(featureCategories).forEach((cat) => {
    cat.features.forEach((f) => {
      if (canActivateFeature(currentPlan, f.minPlan)) {
        total++;
        if (f.active) active++;
      }
    });
  });

  return { active, total };
}

/** Create a deep copy of feature categories for state management */
export function cloneFeatureCategories<T>(categories: T): T {
  return JSON.parse(JSON.stringify(categories)) as T;
}
