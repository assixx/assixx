import { RowDataPacket } from "mysql2/promise";

// Features API v2 Types

export interface Feature {
  id: number;
  code: string;
  name: string;
  description?: string;
  category: "basic" | "core" | "premium" | "enterprise";
  price?: number;
  isActive: boolean;
  createdAt: string; // ISO string
  updatedAt: string;
}

export interface TenantFeature {
  id: number;
  tenantId: number;
  featureId: number;
  featureCode: string;
  featureName: string;
  status: "active" | "trial" | "disabled";
  isActive: boolean;
  validFrom?: string;
  validUntil?: string;
  activatedBy?: number;
  activatedAt?: string;
  customConfig?: Record<string, unknown>;
}

export interface FeatureWithTenantInfo extends Feature {
  tenantFeature?: {
    status: string;
    isActive: boolean;
    validFrom?: string;
    validUntil?: string;
  };
}

export interface FeatureActivationRequest {
  tenantId: number;
  featureCode: string;
  options?: {
    expiresAt?: string;
    customPrice?: number;
    trialDays?: number;
    usageLimit?: number;
    customConfig?: Record<string, unknown>;
  };
}

export interface FeatureDeactivationRequest {
  tenantId: number;
  featureCode: string;
}

export interface FeatureUsageStats {
  date: string;
  featureCode: string;
  usageCount: number;
  uniqueUsers: number;
}

export interface FeatureUsageFilters {
  startDate: string;
  endDate: string;
  featureCode?: string;
}

export interface FeatureCategory {
  category: string;
  features: Feature[];
}

export interface TenantFeaturesSummary {
  tenantId: number;
  activeFeatures: number;
  trialFeatures: number;
  disabledFeatures: number;
  totalCost: number;
  features: TenantFeature[];
}

// Database result types
export interface DbFeature extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: "basic" | "core" | "premium" | "enterprise";
  base_price: string | number | null;
  is_active: number | boolean;
  requires_setup: number | boolean;
  setup_instructions: string | null;
  icon: string | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface DbTenantFeature extends RowDataPacket {
  id: number;
  tenant_id: number;
  feature_id: number;
  feature_code?: string;
  feature_name?: string;
  is_active: number | boolean;
  activated_at: Date;
  expires_at: Date | null;
  activated_by: number | null;
  custom_config: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbFeatureUsageLog extends RowDataPacket {
  id: number;
  tenant_id: number;
  feature_id: number;
  user_id: number | null;
  usage_date: Date;
  metadata: string | null;
  created_at: Date;
}

export interface DbFeatureUsageStats extends RowDataPacket {
  date: Date;
  usage_count: number;
  unique_users: number;
}

// Service response types
export interface ServiceError extends Error {
  statusCode?: number;
}

export interface TenantWithFeatures {
  id: number;
  subdomain: string;
  companyName: string;
  status: string;
  featuresummary: {
    activeFeatures: number;
    trialFeatures: number;
    disabledFeatures: number;
    totalCost: number;
  };
}

// Request validation types
export interface ActivationOptions {
  expiresAt?: string | Date | null;
  customPrice?: number | null;
  trialDays?: number | null;
  usageLimit?: number | null;
  customConfig?: Record<string, unknown> | null;
  activatedBy?: number;
}
