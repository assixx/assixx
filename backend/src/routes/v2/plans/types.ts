import { RowDataPacket } from '../../../utils/db.js';

// Plans API v2 Types

export interface Plan {
  id: number;
  code: string;
  name: string;
  description?: string;
  basePrice: number; // camelCase!
  maxEmployees?: number | null;
  maxAdmins?: number | null;
  maxStorageGb: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string; // ISO string
  updatedAt: string;
}

export interface PlanFeature {
  planId: number;
  featureId: number;
  featureCode: string;
  featureName: string;
  isIncluded: boolean;
}

export interface PlanWithFeatures extends Plan {
  features: PlanFeature[];
}

export interface TenantPlan {
  id: number;
  tenantId: number;
  planId: number;
  planCode: string;
  planName: string;
  status: 'active' | 'trial' | 'cancelled' | 'expired';
  startedAt: string;
  expiresAt?: string;
  customPrice?: number;
  billingCycle: 'monthly' | 'yearly';
}

export interface TenantAddon {
  id: number;
  tenantId: number;
  addonType: 'employees' | 'admins' | 'storage_gb';
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: 'active' | 'cancelled';
}

export interface TenantCosts {
  basePlanCost: number;
  addonsCost: number;
  totalMonthlyCost: number;
  billingCycle: 'monthly' | 'yearly';
  effectivePrice: number;
}

export interface CurrentPlanResponse {
  plan: TenantPlan & {
    details: Plan;
    features: PlanFeature[];
  };
  addons: TenantAddon[];
  costs: TenantCosts;
}

export interface UpgradePlanRequest {
  newPlanCode: string;
  effectiveDate?: string;
}

export interface UpdateAddonsRequest {
  employees?: number;
  admins?: number;
  storageGb?: number;
}

export interface PlansFilters {
  includeInactive?: boolean;
}

// Additional types for service layer
export interface TenantAddons {
  employees: number;
  admins: number;
  storageGb: number;
}

export interface CostCalculation {
  basePlanCost: number;
  addonCosts: {
    employees: number;
    admins: number;
    storage: number;
  };
  totalMonthlyCost: number;
  currency: string;
}

// Update TenantPlan to include plan details
export interface TenantPlanWithDetails extends TenantPlan {
  plan: Plan;
}

// Database result types
export interface DbPlan extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  description?: string;
  base_price: number;
  max_employees?: number;
  max_admins?: number;
  max_storage_gb: number;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface DbPlanFeature {
  plan_id: number;
  feature_id: number;
  feature_code: string;
  feature_name: string;
  is_included: boolean;
}

// Database result type for tenant plans
// Note: expires_at and custom_price are optional to match the model definition
// expires_at: allows for plans without expiration
// custom_price: allows for plans without custom pricing
export interface DbTenantPlan {
  id: number;
  tenant_id: number;
  plan_id: number;
  plan_code: string;
  plan_name: string;
  status: string;
  started_at: Date;
  expires_at?: Date | null;
  custom_price?: number | null;
  billing_cycle: string;
}

export interface DbTenantAddon {
  id: number;
  tenant_id: number;
  addon_type: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: string;
}

export interface DbAddonResult extends RowDataPacket {
  extra_employees: number;
  extra_admins: number;
  extra_storage_gb: number;
}
