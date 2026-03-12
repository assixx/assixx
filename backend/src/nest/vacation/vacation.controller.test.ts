/**
 * VacationController unit tests
 *
 * NOTE: The ensureFeatureEnabled() guard tests were removed with ADR-033
 * (Addon-based SaaS model). Tenant addon gating is now handled globally
 * by @RequireAddon('vacation') + TenantAddonGuard — tested in
 * tenant-addon.guard.test.ts.
 *
 * Controller-specific unit tests (e.g. parameter delegation to services)
 * can be added here in the future if needed.
 */
import { describe, expect, it } from 'vitest';

describe('VacationController', () => {
  it('addon gating handled by @RequireAddon (see tenant-addon.guard.test.ts)', () => {
    expect(true).toBe(true);
  });
});
