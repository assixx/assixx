import { describe, expect, it } from 'vitest';

import { CreateMachineSchema } from './create-machine.dto.js';
import { ListMachinesQuerySchema } from './list-machines-query.dto.js';
import { MachineIdParamSchema } from './machine-id-param.dto.js';
import { AddMaintenanceRecordSchema } from './maintenance.dto.js';
import { SetMachineTeamsSchema } from './set-machine-teams.dto.js';
import { UpcomingMaintenanceQuerySchema } from './upcoming-maintenance-query.dto.js';
import { UpdateMachineSchema } from './update-machine.dto.js';

// =============================================================
// CreateMachineSchema
// =============================================================

describe('CreateMachineSchema', () => {
  const valid = { name: 'CNC Mill A1' };

  it('should accept valid machine with defaults', () => {
    const data = CreateMachineSchema.parse(valid);

    expect(data.machineType).toBe('production');
    expect(data.status).toBe('operational');
  });

  it('should reject missing name', () => {
    expect(CreateMachineSchema.safeParse({}).success).toBe(false);
  });

  it('should reject empty name', () => {
    expect(CreateMachineSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('should reject name longer than 100 characters', () => {
    expect(
      CreateMachineSchema.safeParse({ name: 'M'.repeat(101) }).success,
    ).toBe(false);
  });

  it.each([
    'production',
    'packaging',
    'quality_control',
    'logistics',
    'utility',
    'other',
  ] as const)('should accept machineType=%s', (machineType) => {
    expect(
      CreateMachineSchema.safeParse({ ...valid, machineType }).success,
    ).toBe(true);
  });

  it.each([
    'operational',
    'maintenance',
    'repair',
    'standby',
    'decommissioned',
  ] as const)('should accept status=%s', (status) => {
    expect(CreateMachineSchema.safeParse({ ...valid, status }).success).toBe(
      true,
    );
  });

  it('should accept valid URL for manualUrl', () => {
    expect(
      CreateMachineSchema.safeParse({
        ...valid,
        manualUrl: 'https://example.com/manual.pdf',
      }).success,
    ).toBe(true);
  });

  it('should reject invalid manualUrl', () => {
    expect(
      CreateMachineSchema.safeParse({ ...valid, manualUrl: 'not-a-url' })
        .success,
    ).toBe(false);
  });

  it('should accept valid ISO datetime for dates', () => {
    expect(
      CreateMachineSchema.safeParse({
        ...valid,
        purchaseDate: '2024-01-15T00:00:00Z',
      }).success,
    ).toBe(true);
  });

  it('should reject negative operatingHours', () => {
    expect(
      CreateMachineSchema.safeParse({ ...valid, operatingHours: -1 }).success,
    ).toBe(false);
  });
});

// =============================================================
// UpdateMachineSchema
// =============================================================

describe('UpdateMachineSchema', () => {
  it('should accept empty object (all optional)', () => {
    expect(UpdateMachineSchema.safeParse({}).success).toBe(true);
  });

  it('should accept partial update', () => {
    expect(
      UpdateMachineSchema.safeParse({ status: 'maintenance' }).success,
    ).toBe(true);
  });
});

// =============================================================
// MachineIdParamSchema
// =============================================================

describe('MachineIdParamSchema', () => {
  it('should coerce string id to number', () => {
    const data = MachineIdParamSchema.parse({ id: '15' });

    expect(data.id).toBe(15);
  });

  it('should reject non-positive id', () => {
    expect(MachineIdParamSchema.safeParse({ id: '0' }).success).toBe(false);
  });
});

// =============================================================
// SetMachineTeamsSchema
// =============================================================

describe('SetMachineTeamsSchema', () => {
  it('should accept valid team IDs array', () => {
    const result = SetMachineTeamsSchema.safeParse({ teamIds: [1, 2, 3] });

    expect(result.success).toBe(true);
  });

  it('should accept empty array', () => {
    expect(SetMachineTeamsSchema.safeParse({ teamIds: [] }).success).toBe(true);
  });

  it('should reject array with more than 50 items', () => {
    const teamIds = Array.from({ length: 51 }, (_, i) => i + 1);

    expect(SetMachineTeamsSchema.safeParse({ teamIds }).success).toBe(false);
  });
});

// =============================================================
// AddMaintenanceRecordSchema
// =============================================================

describe('AddMaintenanceRecordSchema', () => {
  const valid = {
    machineId: 1,
    maintenanceType: 'preventive' as const,
    performedDate: '2025-06-15T10:00:00Z',
  };

  it('should accept valid maintenance record with defaults', () => {
    const data = AddMaintenanceRecordSchema.parse(valid);

    expect(data.statusAfter).toBe('operational');
  });

  it('should reject missing machineId', () => {
    const { machineId: _id, ...noId } = valid;

    expect(AddMaintenanceRecordSchema.safeParse(noId).success).toBe(false);
  });

  it.each([
    'preventive',
    'corrective',
    'inspection',
    'calibration',
    'cleaning',
    'other',
  ] as const)('should accept maintenanceType=%s', (maintenanceType) => {
    expect(
      AddMaintenanceRecordSchema.safeParse({ ...valid, maintenanceType })
        .success,
    ).toBe(true);
  });

  it.each(['operational', 'needs_repair', 'decommissioned'] as const)(
    'should accept statusAfter=%s',
    (statusAfter) => {
      expect(
        AddMaintenanceRecordSchema.safeParse({ ...valid, statusAfter }).success,
      ).toBe(true);
    },
  );

  it('should reject negative cost', () => {
    expect(
      AddMaintenanceRecordSchema.safeParse({ ...valid, cost: -10 }).success,
    ).toBe(false);
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
    expect(
      UpcomingMaintenanceQuerySchema.safeParse({ days: '366' }).success,
    ).toBe(false);
  });
});

// =============================================================
// ListMachinesQuerySchema
// =============================================================

describe('ListMachinesQuerySchema', () => {
  it('should accept teamId as positive integer', () => {
    const data = ListMachinesQuerySchema.parse({ teamId: '468' });

    expect(data.teamId).toBe(468);
  });

  it('should accept departmentId and teamId together', () => {
    const data = ListMachinesQuerySchema.parse({
      departmentId: '5',
      teamId: '468',
    });

    expect(data.departmentId).toBe(5);
    expect(data.teamId).toBe(468);
  });

  it('should reject negative teamId', () => {
    expect(ListMachinesQuerySchema.safeParse({ teamId: '-1' }).success).toBe(
      false,
    );
  });

  it('should leave teamId undefined when not provided', () => {
    const data = ListMachinesQuerySchema.parse({});

    expect(data.teamId).toBeUndefined();
  });
});
