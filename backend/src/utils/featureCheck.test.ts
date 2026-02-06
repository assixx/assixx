import { describe, expect, it, vi } from 'vitest';

import { FeatureCheck } from './featureCheck.js';

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock('./db.js', () => ({
  query: mockQuery,
  RowDataPacket: class {},
}));

vi.mock('./logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('FeatureCheck.checkTenantAccess', () => {
  it('should return true when feature is found', async () => {
    mockQuery.mockResolvedValue([[{ id: 1 }]]);

    const result = await FeatureCheck.checkTenantAccess(
      10,
      'email_notifications',
    );
    expect(result).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('tenant_features'),
      [10, 'email_notifications'],
    );
  });

  it('should return false when no feature rows returned', async () => {
    mockQuery.mockResolvedValue([[]]);

    const result = await FeatureCheck.checkTenantAccess(10, 'premium_feature');
    expect(result).toBe(false);
  });

  it('should return false on error and not throw', async () => {
    mockQuery.mockRejectedValue(new Error('DB connection failed'));

    const result = await FeatureCheck.checkTenantAccess(10, 'any_feature');
    expect(result).toBe(false);
  });
});

describe('FeatureCheck.logUsage', () => {
  it('should return true on successful log', async () => {
    // First query: find feature ID
    mockQuery.mockResolvedValueOnce([[{ id: 5, code: 'email' }]]);
    // Second query: insert usage log
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    // Third query: update counter
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const result = await FeatureCheck.logUsage(10, 'email', 1, {
      action: 'send',
    });
    expect(result).toBe(true);
  });

  it('should return false when feature not found', async () => {
    mockQuery.mockResolvedValueOnce([[]]);

    const result = await FeatureCheck.logUsage(10, 'nonexistent', 1);
    expect(result).toBe(false);
  });

  it('should return false on error and not throw', async () => {
    mockQuery.mockRejectedValue(new Error('DB error'));

    const result = await FeatureCheck.logUsage(10, 'email', 1);
    expect(result).toBe(false);
  });

  it('should pass null userId by default', async () => {
    mockQuery.mockResolvedValueOnce([[{ id: 5, code: 'email' }]]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await FeatureCheck.logUsage(10, 'email');
    // Second call is the INSERT — check that userId (param 3) is null
    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[1][2]).toBeNull();
  });
});
