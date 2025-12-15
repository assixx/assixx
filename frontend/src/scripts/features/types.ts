/**
 * Features Management - Type Definitions
 * All interfaces and types for feature/plan management
 */

/**
 * Feature interface (from API)
 */
export interface Feature {
  code: string;
  name: string;
  description: string;
  minPlan: string;
  active: boolean;
  category?: string;
}

/**
 * Feature category grouping
 */
export interface FeatureCategory {
  icon: string;
  features: Feature[];
}

/**
 * Plan interface (from API)
 */
export interface Plan {
  id: number;
  code: string;
  name: string;
  basePrice: number;
  maxEmployees: number | null;
  maxAdmins: number | null;
  features?: { featureCode: string }[];
}

/**
 * Current plan response from API
 */
export interface CurrentPlanResponse {
  data?: {
    plan: {
      planId: number;
      planCode: string;
      status: string;
    };
    addons: {
      addonType?: string;
      addon_type?: string;
      quantity: number;
    }[];
  };
  plan?: {
    planId: number;
    planCode: string;
    status: string;
  };
  addons?: {
    addonType?: string;
    addon_type?: string;
    quantity: number;
  }[];
}

/**
 * Tenant feature response from API
 * WHY: Backend may return snake_case or camelCase
 */
export interface TenantFeature {
  code: string;
  is_available?: number;
  isAvailable?: number;
}

/**
 * Addons state
 */
export interface TenantAddons {
  employees?: number;
  admins?: number;
  storage_gb?: number;
}

/**
 * Filter type for features
 */
export type FeatureFilter = 'all' | 'active' | 'included' | 'addons';

/**
 * Window interface with global feature handlers
 */
export interface WindowWithFeatureHandlers extends Window {
  setHTML?: (element: HTMLElement, html: string) => void;
}
