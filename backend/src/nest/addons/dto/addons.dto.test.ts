import { describe, expect, it } from 'vitest';

import { ActivateAddonSchema } from './activate-addon.dto.js';
import { AddonCodeParamSchema } from './addon-code-param.dto.js';
import { DeactivateAddonSchema } from './deactivate-addon.dto.js';
import { GetAllAddonsQuerySchema } from './get-all-addons-query.dto.js';
import { GetUsageStatsQuerySchema } from './get-usage-stats-query.dto.js';

// =============================================================
// ActivateAddonSchema
// =============================================================

describe('ActivateAddonSchema', () => {
  const valid = { tenantId: 1, addonCode: 'tpm' };

  it('should accept valid activate data', () => {
    expect(ActivateAddonSchema.safeParse(valid).success).toBe(true);
  });

  it('should reject missing tenantId', () => {
    expect(ActivateAddonSchema.safeParse({ addonCode: 'tpm' }).success).toBe(false);
  });

  it('should reject missing addonCode', () => {
    expect(ActivateAddonSchema.safeParse({ tenantId: 1 }).success).toBe(false);
  });

  it('should reject tenantId of zero', () => {
    expect(ActivateAddonSchema.safeParse({ ...valid, tenantId: 0 }).success).toBe(false);
  });

  it('should reject negative tenantId', () => {
    expect(ActivateAddonSchema.safeParse({ ...valid, tenantId: -5 }).success).toBe(false);
  });

  it('should reject non-integer tenantId', () => {
    expect(ActivateAddonSchema.safeParse({ ...valid, tenantId: 1.5 }).success).toBe(false);
  });

  it('should reject empty addonCode', () => {
    expect(ActivateAddonSchema.safeParse({ ...valid, addonCode: '' }).success).toBe(false);
  });
});

// =============================================================
// DeactivateAddonSchema
// =============================================================

describe('DeactivateAddonSchema', () => {
  const valid = { tenantId: 1, addonCode: 'chat' };

  it('should accept valid deactivate data', () => {
    expect(DeactivateAddonSchema.safeParse(valid).success).toBe(true);
  });

  it('should reject missing tenantId', () => {
    expect(DeactivateAddonSchema.safeParse({ addonCode: 'chat' }).success).toBe(false);
  });

  it('should reject missing addonCode', () => {
    expect(DeactivateAddonSchema.safeParse({ tenantId: 1 }).success).toBe(false);
  });

  it('should reject tenantId of zero', () => {
    expect(DeactivateAddonSchema.safeParse({ ...valid, tenantId: 0 }).success).toBe(false);
  });

  it('should reject negative tenantId', () => {
    expect(DeactivateAddonSchema.safeParse({ ...valid, tenantId: -3 }).success).toBe(false);
  });

  it('should reject non-integer tenantId', () => {
    expect(DeactivateAddonSchema.safeParse({ ...valid, tenantId: 2.7 }).success).toBe(false);
  });

  it('should reject empty addonCode', () => {
    expect(DeactivateAddonSchema.safeParse({ ...valid, addonCode: '' }).success).toBe(false);
  });
});

// =============================================================
// AddonCodeParamSchema
// =============================================================

describe('AddonCodeParamSchema', () => {
  it('should accept valid addon code', () => {
    expect(AddonCodeParamSchema.safeParse({ code: 'tpm' }).success).toBe(true);
  });

  it('should reject missing code', () => {
    expect(AddonCodeParamSchema.safeParse({}).success).toBe(false);
  });

  it('should reject empty code', () => {
    expect(AddonCodeParamSchema.safeParse({ code: '' }).success).toBe(false);
  });
});

// =============================================================
// GetAllAddonsQuerySchema
// =============================================================

describe('GetAllAddonsQuerySchema', () => {
  it('should transform "true" string to boolean true', () => {
    const data = GetAllAddonsQuerySchema.parse({ includeInactive: 'true' });

    expect(data.includeInactive).toBe(true);
  });

  it('should transform "false" string to boolean false', () => {
    const data = GetAllAddonsQuerySchema.parse({ includeInactive: 'false' });

    expect(data.includeInactive).toBe(false);
  });

  it('should default to false when omitted', () => {
    const data = GetAllAddonsQuerySchema.parse({});

    expect(data.includeInactive).toBe(false);
  });

  it('should transform non-"true" string to false', () => {
    const data = GetAllAddonsQuerySchema.parse({ includeInactive: 'yes' });

    expect(data.includeInactive).toBe(false);
  });
});

// =============================================================
// GetUsageStatsQuerySchema
// =============================================================

describe('GetUsageStatsQuerySchema', () => {
  const valid = { startDate: '2026-01-01', endDate: '2026-03-11' };

  it('should accept valid date range', () => {
    expect(GetUsageStatsQuerySchema.safeParse(valid).success).toBe(true);
  });

  it('should reject missing startDate', () => {
    expect(GetUsageStatsQuerySchema.safeParse({ endDate: '2026-03-11' }).success).toBe(false);
  });

  it('should reject missing endDate', () => {
    expect(GetUsageStatsQuerySchema.safeParse({ startDate: '2026-01-01' }).success).toBe(false);
  });

  it('should reject invalid startDate format', () => {
    expect(GetUsageStatsQuerySchema.safeParse({ ...valid, startDate: '01-01-2026' }).success).toBe(
      false,
    );
  });

  it('should reject invalid endDate format', () => {
    expect(GetUsageStatsQuerySchema.safeParse({ ...valid, endDate: '2026/03/11' }).success).toBe(
      false,
    );
  });

  it('should reject partial date string', () => {
    expect(GetUsageStatsQuerySchema.safeParse({ ...valid, startDate: '2026-01' }).success).toBe(
      false,
    );
  });
});
