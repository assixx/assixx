/**
 * Addon Management Page — Utility Functions
 * @module addons/_lib/utils
 */
import type { AddonWithTenantStatus } from './types';

/** Get effective status string for display */
export function getEffectiveStatus(addon: AddonWithTenantStatus): string {
  if (addon.isCore) return 'core_always_active';
  return addon.tenantStatus?.status ?? 'not_activated';
}

/** Calculate days remaining until trial expires */
export function getTrialDaysRemaining(trialEndsAt: string): number {
  const msRemaining = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(msRemaining / 86_400_000));
}

/** Whether the addon can be activated (not_activated, cancelled, or expired) */
export function canActivate(addon: AddonWithTenantStatus): boolean {
  if (addon.isCore) return false;
  const status = addon.tenantStatus?.status ?? 'not_activated';
  return (
    status === 'not_activated' || status === 'cancelled' || status === 'expired'
  );
}

/** Whether the addon can be deactivated (active or trial) */
export function canDeactivate(addon: AddonWithTenantStatus): boolean {
  if (addon.isCore) return false;
  const status = addon.tenantStatus?.status ?? 'not_activated';
  return status === 'active' || status === 'trial';
}
