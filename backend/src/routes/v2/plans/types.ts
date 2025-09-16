import { RowDataPacket } from 'mysql2/promise';

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
  description: string;
  base_price: string | number;
  max_employees: number | null;
  max_admins: number | null;
  max_storage_gb: number | null;
  is_active: number | boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface DbPlanFeature {
  plan_id: number;
  feature_id: number;
  feature_code: string;
  feature_name: string;
  is_included: number | boolean;
}

export interface DbTenantPlan {
  id: number;
  tenant_id: number;
  plan_id: number;
  plan_code: string;
  plan_name: string;
  status: string;
  started_at: Date;
  expires_at: Date | null;
  custom_price: number | null;
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
