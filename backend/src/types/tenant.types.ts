// Tenant-specific Type Definitions

export interface TenantInfo {
  id: number;
  subdomain: string;
  name: string;
  status: 'active' | 'trial' | 'suspended' | 'cancelled';
  plan: string | null;
  trialStatus?: {
    isExpired: boolean;
    trialEndsAt: Date | null;
    daysRemaining?: number;
  };
}

export interface TenantTrialStatus {
  isExpired: boolean;
  trialEndsAt: Date | null;
  daysRemaining: number;
}
