import { describe, expect, it } from 'vitest';

import { GetAllPlansQuerySchema } from './get-all-plans-query.dto.js';
import { PlanIdParamSchema } from './plan-id-param.dto.js';
import { UpdateAddonsSchema } from './update-addons.dto.js';
import { UpgradePlanSchema } from './upgrade-plan.dto.js';

// =============================================================
// PlanIdParamSchema
// =============================================================

describe('PlanIdParamSchema', () => {
  it('should accept positive integer', () => {
    expect(PlanIdParamSchema.safeParse({ id: 1 }).success).toBe(true);
  });

  it('should coerce string to number', () => {
    const result = PlanIdParamSchema.safeParse({ id: '5' });
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> })
      .data;
    expect(data.id).toBe(5);
  });

  it('should reject zero', () => {
    expect(PlanIdParamSchema.safeParse({ id: 0 }).success).toBe(false);
  });

  it('should reject negative', () => {
    expect(PlanIdParamSchema.safeParse({ id: -1 }).success).toBe(false);
  });
});

// =============================================================
// UpgradePlanSchema
// =============================================================

describe('UpgradePlanSchema', () => {
  it('should accept valid upgrade with plan code', () => {
    expect(
      UpgradePlanSchema.safeParse({ newPlanCode: 'professional' }).success,
    ).toBe(true);
  });

  it('should accept with optional effectiveDate', () => {
    const data = {
      newPlanCode: 'enterprise',
      effectiveDate: '2025-07-01T00:00:00Z',
    };
    expect(UpgradePlanSchema.safeParse(data).success).toBe(true);
  });

  it('should reject empty plan code', () => {
    expect(UpgradePlanSchema.safeParse({ newPlanCode: '' }).success).toBe(
      false,
    );
  });

  it('should reject missing plan code', () => {
    expect(UpgradePlanSchema.safeParse({}).success).toBe(false);
  });
});

// =============================================================
// UpdateAddonsSchema
// =============================================================

describe('UpdateAddonsSchema', () => {
  it('should accept all optional fields', () => {
    expect(UpdateAddonsSchema.safeParse({}).success).toBe(true);
  });

  it('should accept valid addon updates', () => {
    const data = { employees: 10, admins: 2, storageGb: 50 };
    expect(UpdateAddonsSchema.safeParse(data).success).toBe(true);
  });

  it('should accept zero values', () => {
    expect(UpdateAddonsSchema.safeParse({ employees: 0 }).success).toBe(true);
  });

  it('should reject negative values', () => {
    expect(UpdateAddonsSchema.safeParse({ employees: -1 }).success).toBe(false);
    expect(UpdateAddonsSchema.safeParse({ storageGb: -5 }).success).toBe(false);
  });

  it('should reject non-integer values', () => {
    expect(UpdateAddonsSchema.safeParse({ employees: 1.5 }).success).toBe(
      false,
    );
  });
});

// =============================================================
// GetAllPlansQuerySchema
// =============================================================

describe('GetAllPlansQuerySchema', () => {
  it('should accept empty object with defaults', () => {
    const result = GetAllPlansQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should transform "true" string to boolean', () => {
    const result = GetAllPlansQuerySchema.safeParse({
      includeInactive: 'true',
    });
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> })
      .data;
    expect(data.includeInactive).toBe(true);
  });
});
