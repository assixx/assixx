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

  // ---- Scope validation ----

  it('should accept user config with scope arrays', () => {
    const result = UpsertApprovalConfigSchema.safeParse({
      addonCode: 'kvp',
      approverType: 'user',
      approverUserId: 42,
      scopeAreaIds: [1, 3],
      scopeDepartmentIds: null,
      scopeTeamIds: [],
    });
    expect(result.success).toBe(true);
  });

  it('should accept user config without scope (whole tenant)', () => {
    const result = UpsertApprovalConfigSchema.safeParse({
      addonCode: 'kvp',
      approverType: 'user',
      approverUserId: 42,
    });
    expect(result.success).toBe(true);
  });

  it('should accept position config with scope arrays', () => {
    const result = UpsertApprovalConfigSchema.safeParse({
      addonCode: 'kvp',
      approverType: 'position',
      approverPositionId: '550e8400-e29b-41d4-a716-446655440000',
      scopeAreaIds: [1],
    });
    expect(result.success).toBe(true);
  });

  it('should reject team_lead with non-empty scope', () => {
    const result = UpsertApprovalConfigSchema.safeParse({
      addonCode: 'kvp',
      approverType: 'team_lead',
      scopeAreaIds: [1],
    });
    expect(result.success).toBe(false);
  });

  it('should reject area_lead with non-empty scope', () => {
    const result = UpsertApprovalConfigSchema.safeParse({
      addonCode: 'kvp',
      approverType: 'area_lead',
      scopeDepartmentIds: [5],
    });
    expect(result.success).toBe(false);
  });

  it('should reject department_lead with non-empty scope', () => {
    const result = UpsertApprovalConfigSchema.safeParse({
      addonCode: 'kvp',
      approverType: 'department_lead',
      scopeTeamIds: [99],
    });
    expect(result.success).toBe(false);
  });

  it('should accept team_lead with null/empty scope', () => {
    const result = UpsertApprovalConfigSchema.safeParse({
      addonCode: 'kvp',
      approverType: 'team_lead',
      scopeAreaIds: null,
      scopeDepartmentIds: [],
    });
    expect(result.success).toBe(true);
  });
});
