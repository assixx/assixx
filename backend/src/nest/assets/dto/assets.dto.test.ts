import { describe, expect, it } from 'vitest';

import { AssetIdParamSchema } from './asset-id-param.dto.js';
import { CreateAssetSchema } from './create-asset.dto.js';
import { ListAssetsQuerySchema } from './list-assets-query.dto.js';
import { AddMaintenanceRecordSchema } from './maintenance.dto.js';
import { SetAssetTeamsSchema } from './set-asset-teams.dto.js';
import { UpcomingMaintenanceQuerySchema } from './upcoming-maintenance-query.dto.js';
import { UpdateAssetSchema } from './update-asset.dto.js';

// =============================================================
// CreateAssetSchema
// =============================================================

describe('CreateAssetSchema', () => {
  const valid = { name: 'CNC Mill A1' };

  it('should accept valid asset with defaults', () => {
    const data = CreateAssetSchema.parse(valid);

    expect(data.assetType).toBe('production');
    expect(data.status).toBe('operational');
  });

  it('should reject missing name', () => {
    expect(CreateAssetSchema.safeParse({}).success).toBe(false);
  });

  it('should reject empty name', () => {
    expect(CreateAssetSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('should reject name longer than 100 characters', () => {
    expect(CreateAssetSchema.safeParse({ name: 'M'.repeat(101) }).success).toBe(false);
  });

  it.each(['production', 'packaging', 'quality_control', 'logistics', 'utility', 'other'] as const)(
    'should accept assetType=%s',
    (assetType) => {
      expect(CreateAssetSchema.safeParse({ ...valid, assetType }).success).toBe(true);
    },
  );

  it.each(['operational', 'maintenance', 'repair', 'standby', 'decommissioned'] as const)(
    'should accept status=%s',
    (status) => {
      expect(CreateAssetSchema.safeParse({ ...valid, status }).success).toBe(true);
    },
  );

  it('should accept valid URL for manualUrl', () => {
    expect(
      CreateAssetSchema.safeParse({
        ...valid,
        manualUrl: 'https://example.com/manual.pdf',
      }).success,
    ).toBe(true);
  });

  it('should reject invalid manualUrl', () => {
    expect(CreateAssetSchema.safeParse({ ...valid, manualUrl: 'not-a-url' }).success).toBe(false);
  });

  it('should accept valid ISO datetime for dates', () => {
    expect(
      CreateAssetSchema.safeParse({
        ...valid,
        purchaseDate: '2024-01-15T00:00:00Z',
      }).success,
    ).toBe(true);
  });

  it('should reject negative operatingHours', () => {
    expect(CreateAssetSchema.safeParse({ ...valid, operatingHours: -1 }).success).toBe(false);
  });
});

// =============================================================
// UpdateAssetSchema
// =============================================================

describe('UpdateAssetSchema', () => {
  it('should accept empty object (all optional)', () => {
    expect(UpdateAssetSchema.safeParse({}).success).toBe(true);
  });

  it('should accept partial update', () => {
    expect(UpdateAssetSchema.safeParse({ status: 'maintenance' }).success).toBe(true);
  });
});

// =============================================================
// AssetIdParamSchema
// =============================================================

describe('AssetIdParamSchema', () => {
  it('should coerce string id to number', () => {
    const data = AssetIdParamSchema.parse({ id: '15' });

    expect(data.id).toBe(15);
  });

  it('should reject non-positive id', () => {
    expect(AssetIdParamSchema.safeParse({ id: '0' }).success).toBe(false);
  });
});

// =============================================================
// SetAssetTeamsSchema
// =============================================================

describe('SetAssetTeamsSchema', () => {
  it('should accept valid team IDs array', () => {
    const result = SetAssetTeamsSchema.safeParse({ teamIds: [1, 2, 3] });

    expect(result.success).toBe(true);
  });

  it('should accept empty array', () => {
    expect(SetAssetTeamsSchema.safeParse({ teamIds: [] }).success).toBe(true);
  });

  it('should reject array with more than 50 items', () => {
    const teamIds = Array.from({ length: 51 }, (_, i) => i + 1);

    expect(SetAssetTeamsSchema.safeParse({ teamIds }).success).toBe(false);
  });
});

// =============================================================
// AddMaintenanceRecordSchema
// =============================================================

describe('AddMaintenanceRecordSchema', () => {
  const valid = {
    assetId: 1,
    maintenanceType: 'preventive' as const,
    performedDate: '2025-06-15T10:00:00Z',
  };

  it('should accept valid maintenance record with defaults', () => {
    const data = AddMaintenanceRecordSchema.parse(valid);

    expect(data.statusAfter).toBe('operational');
  });

  it('should reject missing assetId', () => {
    const { assetId: _id, ...noId } = valid;

    expect(AddMaintenanceRecordSchema.safeParse(noId).success).toBe(false);
  });

  it.each(['preventive', 'corrective', 'inspection', 'calibration', 'cleaning', 'other'] as const)(
    'should accept maintenanceType=%s',
    (maintenanceType) => {
      expect(AddMaintenanceRecordSchema.safeParse({ ...valid, maintenanceType }).success).toBe(
        true,
      );
    },
  );

  it.each(['operational', 'needs_repair', 'decommissioned'] as const)(
    'should accept statusAfter=%s',
    (statusAfter) => {
      expect(AddMaintenanceRecordSchema.safeParse({ ...valid, statusAfter }).success).toBe(true);
    },
  );

  it('should reject negative cost', () => {
    expect(AddMaintenanceRecordSchema.safeParse({ ...valid, cost: -10 }).success).toBe(false);
  });

  it('should accept valid reportUrl', () => {
    expect(
      AddMaintenanceRecordSchema.safeParse({
        ...valid,
        reportUrl: 'https://reports.example.com/123',
      }).success,
    ).toBe(true);
  });
});

// =============================================================
// UpcomingMaintenanceQuerySchema
// =============================================================

describe('UpcomingMaintenanceQuerySchema', () => {
  it('should default days to 30', () => {
    const data = UpcomingMaintenanceQuerySchema.parse({});

    expect(data.days).toBe(30);
  });

  it('should coerce days from string', () => {
    const data = UpcomingMaintenanceQuerySchema.parse({ days: '60' });

    expect(data.days).toBe(60);
  });

  it('should reject days > 365', () => {
    expect(UpcomingMaintenanceQuerySchema.safeParse({ days: '366' }).success).toBe(false);
  });
});

// =============================================================
// ListAssetsQuerySchema
// =============================================================

describe('ListAssetsQuerySchema', () => {
  it('should accept teamId as positive integer', () => {
    const data = ListAssetsQuerySchema.parse({ teamId: '468' });

    expect(data.teamId).toBe(468);
  });

  it('should accept departmentId and teamId together', () => {
    const data = ListAssetsQuerySchema.parse({
      departmentId: '5',
      teamId: '468',
    });

    expect(data.departmentId).toBe(5);
    expect(data.teamId).toBe(468);
  });

  it('should reject negative teamId', () => {
    expect(ListAssetsQuerySchema.safeParse({ teamId: '-1' }).success).toBe(false);
  });

  it('should leave teamId undefined when not provided', () => {
    const data = ListAssetsQuerySchema.parse({});

    expect(data.teamId).toBeUndefined();
  });
});
