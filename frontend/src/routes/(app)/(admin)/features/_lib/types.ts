/**
 * Features Page - Type Definitions
 * @module features/_lib/types
 */

/** Single feature definition */
export interface Feature {
  code: string;
  name: string;
  description: string;
  minPlan: string;
  active: boolean;
  category?: string;
}

/** Feature category with icon and features list */
export interface FeatureCategory {
  icon: string;
  features: Feature[];
}

/** Subscription plan definition */
export interface Plan {
  id: number;
  code: string;
  name: string;
  basePrice: number;
  maxEmployees: number | null;
  maxAdmins: number | null;
  features?: { featureCode: string }[];
}

/** Tenant addon quantities */
export interface TenantAddons {
  employees?: number;
  admins?: number;
  storage_gb?: number;
}

/** Feature filter options */
export type FeatureFilter = 'all' | 'active' | 'included' | 'addons';

/** Addon type for adjustments */
export type AddonType = 'employees' | 'admins' | 'storage';

/** JWT payload structure */
export interface JwtPayload {
  tenantId?: number;
  [key: string]: unknown;
}

/** API response wrapper */
export interface ApiResponse<T> {
  data?: T;
  plan?: T;
  addons?: AddonInfo[];
}

/** Addon info from API */
export interface AddonInfo {
  addonType?: string;
  quantity: number;
}

/** Tenant feature from API */
export interface TenantFeature {
  code: string;
  isAvailable?: number;
}
