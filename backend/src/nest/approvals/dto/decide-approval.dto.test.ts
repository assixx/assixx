import { describe, expect, it } from 'vitest';

import { ApproveApprovalSchema } from './approve-approval.dto.js';
import { RejectApprovalSchema } from './reject-approval.dto.js';
import { UpsertApprovalConfigSchema } from './upsert-approval-config.dto.js';

// ---------------------------------------------------------------------------
// ApproveApprovalSchema
// ---------------------------------------------------------------------------
describe('ApproveApprovalSchema', () => {
  it('should accept empty object (decisionNote is optional)', () => {
    const result = ApproveApprovalSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept a valid decisionNote', () => {
    const result = ApproveApprovalSchema.safeParse({
      decisionNote: 'Looks good',
    });
    expect(result.success).toBe(true);
  });

  it('should accept null decisionNote', () => {
    const result = ApproveApprovalSchema.safeParse({ decisionNote: null });
    expect(result.success).toBe(true);
  });

  it('should reject decisionNote exceeding 2000 chars', () => {
    const result = ApproveApprovalSchema.safeParse({
      decisionNote: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RejectApprovalSchema
// ---------------------------------------------------------------------------
describe('RejectApprovalSchema', () => {
  it('should accept a valid decisionNote', () => {
    const result = RejectApprovalSchema.safeParse({
      decisionNote: 'Not feasible',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing decisionNote', () => {
    const result = RejectApprovalSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject empty decisionNote', () => {
    const result = RejectApprovalSchema.safeParse({ decisionNote: '' });
    expect(result.success).toBe(false);
  });

  it('should reject decisionNote exceeding 2000 chars', () => {
    const result = RejectApprovalSchema.safeParse({
      decisionNote: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UpsertApprovalConfigSchema
// ---------------------------------------------------------------------------
describe('UpsertApprovalConfigSchema', () => {
  it('should accept user type with approverUserId', () => {
    const result = UpsertApprovalConfigSchema.safeParse({
      addonCode: 'kvp',
      approverType: 'user',
      approverUserId: 7,
    });
    expect(result.success).toBe(true);
  });

  it('should reject user type without approverUserId', () => {
    const result = UpsertApprovalConfigSchema.safeParse({
      addonCode: 'kvp',
      approverType: 'user',
    });
    expect(result.success).toBe(false);
  });

  it('should reject user type with null approverUserId', () => {
    const result = UpsertApprovalConfigSchema.safeParse({
      addonCode: 'kvp',
      approverType: 'user',
      approverUserId: null,
    });
    expect(result.success).toBe(false);
  });

  it('should accept team_lead type without approverUserId', () => {
    const result = UpsertApprovalConfigSchema.safeParse({
      addonCode: 'kvp',
      approverType: 'team_lead',
    });
    expect(result.success).toBe(true);
  });

  it('should accept area_lead type without approverUserId', () => {
    const result = UpsertApprovalConfigSchema.safeParse({
      addonCode: 'kvp',
      approverType: 'area_lead',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid approverType', () => {
    const result = UpsertApprovalConfigSchema.safeParse({
      addonCode: 'kvp',
      approverType: 'manager',
    });
    expect(result.success).toBe(false);
  });
});
