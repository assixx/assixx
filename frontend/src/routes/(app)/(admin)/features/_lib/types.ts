/**
 * Addon Management Page — Type Definitions
 * @module features/_lib/types
 *
 * Types match backend AddonsService response shapes (ADR-033).
 */

/** Tenant-specific addon status from backend */
export type TenantAddonStatusValue =
  | 'trial'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'not_activated';

/** Single addon from GET /addons/my-addons */
export interface AddonWithTenantStatus {
  id: number;
  code: string;
  name: string;
  description?: string;
  priceMonthly?: number;
  isActive: boolean;
  isCore: boolean;
  trialDays?: number;
  icon?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  tenantStatus?: {
    status: TenantAddonStatusValue;
    isActive: boolean;
    trialEndsAt?: string;
    activatedAt?: string;
  };
}

/** Addon status response from POST /addons/activate */
export interface AddonStatus {
  addonCode: string;
  isCore: boolean;
  status: TenantAddonStatusValue | 'core_always_active';
  trialEndsAt?: string;
  activatedAt?: string;
  daysRemaining?: number;
}

/** Tenant addon summary from GET /addons/tenant/:tenantId/summary */
export interface TenantAddonsSummary {
  tenantId: number;
  coreAddons: number;
  activeAddons: number;
  trialAddons: number;
  cancelledAddons: number;
  monthlyCost: number;
}

/** Addon filter options */
export type AddonFilter = 'all' | 'active' | 'inactive';
