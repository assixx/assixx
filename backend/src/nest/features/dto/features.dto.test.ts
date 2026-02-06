import { describe, expect, it } from 'vitest';

import { ActivateFeatureSchema } from './activate-feature.dto.js';
import { DeactivateFeatureSchema } from './deactivate-feature.dto.js';
import { FeatureCodeParamSchema } from './feature-code-param.dto.js';
import { GetAllFeaturesQuerySchema } from './get-all-features-query.dto.js';
import { GetUsageStatsQuerySchema } from './get-usage-stats-query.dto.js';
import { TenantIdParamSchema } from './tenant-id-param.dto.js';

// =============================================================
// ActivateFeatureSchema
// =============================================================

describe('ActivateFeatureSchema', () => {
  const valid = { tenantId: 1, featureCode: 'email_notifications' };

  it('should accept valid activation data', () => {
    expect(ActivateFeatureSchema.safeParse(valid).success).toBe(true);
  });

  it('should accept with optional options', () => {
    const data = { ...valid, options: { expiresAt: '2025-12-31T23:59:59Z' } };
    expect(ActivateFeatureSchema.safeParse(data).success).toBe(true);
  });

  it('should accept options with customConfig', () => {
    const data = { ...valid, options: { customConfig: { limit: 100 } } };
    expect(ActivateFeatureSchema.safeParse(data).success).toBe(true);
  });

  it('should reject missing tenantId', () => {
    expect(ActivateFeatureSchema.safeParse({ featureCode: 'x' }).success).toBe(
      false,
    );
  });

  it('should reject missing featureCode', () => {
    expect(ActivateFeatureSchema.safeParse({ tenantId: 1 }).success).toBe(
      false,
    );
  });

  it('should reject non-positive tenantId', () => {
    expect(
      ActivateFeatureSchema.safeParse({ ...valid, tenantId: 0 }).success,
    ).toBe(false);
    expect(
      ActivateFeatureSchema.safeParse({ ...valid, tenantId: -1 }).success,
    ).toBe(false);
  });

  it('should reject empty featureCode', () => {
    expect(
      ActivateFeatureSchema.safeParse({ ...valid, featureCode: '' }).success,
    ).toBe(false);
  });
});

// =============================================================
// DeactivateFeatureSchema
// =============================================================

describe('DeactivateFeatureSchema', () => {
  it('should accept valid deactivation data', () => {
    expect(
      DeactivateFeatureSchema.safeParse({ tenantId: 1, featureCode: 'chat' })
        .success,
    ).toBe(true);
  });

  it('should reject missing fields', () => {
    expect(DeactivateFeatureSchema.safeParse({}).success).toBe(false);
    expect(DeactivateFeatureSchema.safeParse({ tenantId: 1 }).success).toBe(
      false,
    );
  });
});

// =============================================================
// FeatureCodeParamSchema
// =============================================================

describe('FeatureCodeParamSchema', () => {
  it('should accept valid feature code', () => {
    expect(FeatureCodeParamSchema.safeParse({ code: 'chat' }).success).toBe(
      true,
    );
  });

  it('should reject empty code', () => {
    expect(FeatureCodeParamSchema.safeParse({ code: '' }).success).toBe(false);
  });

  it('should reject missing code', () => {
    expect(FeatureCodeParamSchema.safeParse({}).success).toBe(false);
  });
});

// =============================================================
// TenantIdParamSchema
// =============================================================

describe('TenantIdParamSchema', () => {
  it('should accept positive integer', () => {
    expect(TenantIdParamSchema.safeParse({ tenantId: 1 }).success).toBe(true);
  });

  it('should coerce string to number', () => {
    const result = TenantIdParamSchema.safeParse({ tenantId: '5' });
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> })
      .data;
    expect(data.tenantId).toBe(5);
  });

  it('should reject zero', () => {
    expect(TenantIdParamSchema.safeParse({ tenantId: 0 }).success).toBe(false);
  });

  it('should reject negative', () => {
    expect(TenantIdParamSchema.safeParse({ tenantId: -1 }).success).toBe(false);
  });
});

// =============================================================
// GetUsageStatsQuerySchema
// =============================================================

describe('GetUsageStatsQuerySchema', () => {
  const valid = { startDate: '2025-01-01', endDate: '2025-12-31' };

  it('should accept valid date range', () => {
    expect(GetUsageStatsQuerySchema.safeParse(valid).success).toBe(true);
  });

  it('should reject invalid date format', () => {
    expect(
      GetUsageStatsQuerySchema.safeParse({
        startDate: '01/01/2025',
        endDate: '2025-12-31',
      }).success,
    ).toBe(false);
  });

  it('should reject missing dates', () => {
    expect(GetUsageStatsQuerySchema.safeParse({}).success).toBe(false);
    expect(
      GetUsageStatsQuerySchema.safeParse({ startDate: '2025-01-01' }).success,
    ).toBe(false);
  });
});

// =============================================================
// GetAllFeaturesQuerySchema
// =============================================================

describe('GetAllFeaturesQuerySchema', () => {
  it('should accept empty object with default', () => {
    const result = GetAllFeaturesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should transform string "true" to boolean true', () => {
    const result = GetAllFeaturesQuerySchema.safeParse({
      includeInactive: 'true',
    });
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> })
      .data;
    expect(data.includeInactive).toBe(true);
  });

  it('should transform non-"true" string to false', () => {
    const result = GetAllFeaturesQuerySchema.safeParse({
      includeInactive: 'false',
    });
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> })
      .data;
    expect(data.includeInactive).toBe(false);
  });
});
