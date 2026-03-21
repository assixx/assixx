import { describe, expect, it } from 'vitest';

import { UpsertApprovalConfigSchema } from './upsert-approval-config.dto.js';

describe('UpsertApprovalConfigSchema', () => {
  it('should accept valid team_lead config', () => {
    const result = UpsertApprovalConfigSchema.safeParse({
      addonCode: 'kvp',
      approverType: 'team_lead',
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid user config with approverUserId', () => {
    const result = UpsertApprovalConfigSchema.safeParse({
      addonCode: 'kvp',
      approverType: 'user',
      approverUserId: 42,
    });
    expect(result.success).toBe(true);
  });

  it('should reject user config without approverUserId', () => {
    const result = UpsertApprovalConfigSchema.safeParse({
      addonCode: 'kvp',
      approverType: 'user',
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid position config with approverPositionId', () => {
    const result = UpsertApprovalConfigSchema.safeParse({
      addonCode: 'kvp',
      approverType: 'position',
      approverPositionId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('should reject position config without approverPositionId', () => {
    const result = UpsertApprovalConfigSchema.safeParse({
      addonCode: 'kvp',
      approverType: 'position',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty addonCode', () => {
    const result = UpsertApprovalConfigSchema.safeParse({
      addonCode: '',
      approverType: 'team_lead',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid approverType', () => {
    const result = UpsertApprovalConfigSchema.safeParse({
      addonCode: 'kvp',
      approverType: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});
