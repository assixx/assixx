/**
 * Unit tests for legacy featureCheck stub
 *
 * The canonical FeatureCheckService tests are in:
 * nest/feature-check/feature-check.service.test.ts
 *
 * This file only verifies the deprecated stub returns safe defaults.
 */
import { describe, expect, it, vi } from 'vitest';

import { FeatureCheck } from './feature-check.js';

vi.mock('./logger.js', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('FeatureCheck (deprecated stub)', () => {
  it('checkTenantAccess should return false', async () => {
    const result = await FeatureCheck.checkTenantAccess(
      10,
      'email_notifications',
    );
    expect(result).toBe(false);
  });

  it('logUsage should return false', async () => {
    const result = await FeatureCheck.logUsage(10, 'email', 1, {
      action: 'send',
    });
    expect(result).toBe(false);
  });
});
