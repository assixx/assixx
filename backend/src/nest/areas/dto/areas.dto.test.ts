import { describe, expect, it } from 'vitest';

import { AreaIdParamSchema } from './area-id-param.dto.js';
import { AssignDepartmentsSchema } from './assign-departments.dto.js';
import { AssignHallsSchema } from './assign-halls.dto.js';
import { AreaTypeSchema, CreateAreaSchema } from './create-area.dto.js';
import { DeleteAreaQuerySchema } from './delete-area-query.dto.js';
import { ListAreasQuerySchema } from './list-areas-query.dto.js';
import { UpdateAreaSchema } from './update-area.dto.js';

// =============================================================
// AreaTypeSchema
// =============================================================

describe('AreaTypeSchema', () => {
  const validTypes = [
    'building',
    'warehouse',
    'office',
    'production',
    'outdoor',
    'other',
  ];

  it('should accept all valid area types', () => {
    for (const type of validTypes) {
      expect(AreaTypeSchema.safeParse(type).success).toBe(true);
    }
  });

  it('should reject invalid type', () => {
    expect(AreaTypeSchema.safeParse('parking').success).toBe(false);
    expect(AreaTypeSchema.safeParse('').success).toBe(false);
  });
});

// =============================================================
// AreaIdParamSchema
// =============================================================

describe('AreaIdParamSchema', () => {
  it('should accept positive integer', () => {
    expect(AreaIdParamSchema.safeParse({ id: 1 }).success).toBe(true);
  });

  it('should coerce string', () => {
    const result = AreaIdParamSchema.safeParse({ id: '5' });
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> })
      .data;
    expect(data.id).toBe(5);
  });

  it('should reject zero', () => {
    expect(AreaIdParamSchema.safeParse({ id: 0 }).success).toBe(false);
  });
});

// =============================================================
// CreateAreaSchema
// =============================================================

describe('CreateAreaSchema', () => {
  const valid = { name: 'Hall A' };

  it('should accept minimal valid data', () => {
    expect(CreateAreaSchema.safeParse(valid).success).toBe(true);
  });

  it('should default type to other', () => {
    const result = CreateAreaSchema.safeParse(valid);
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> })
      .data;
    expect(data.type).toBe('other');
  });

  it('should accept all optional fields', () => {
    const data = {
      name: 'Warehouse B',
      description: 'Main storage',
      areaLeadId: 5,
      type: 'warehouse' as const,
      capacity: 100,
      address: 'Street 1',
    };
    expect(CreateAreaSchema.safeParse(data).success).toBe(true);
  });

  it('should reject name under 2 chars', () => {
    expect(CreateAreaSchema.safeParse({ name: 'A' }).success).toBe(false);
  });

  it('should reject name over 255 chars', () => {
    expect(CreateAreaSchema.safeParse({ name: 'a'.repeat(256) }).success).toBe(
      false,
    );
  });

  it('should accept null description', () => {
    expect(
      CreateAreaSchema.safeParse({ ...valid, description: null }).success,
    ).toBe(true);
  });

  it('should accept null areaLeadId', () => {
    expect(
      CreateAreaSchema.safeParse({ ...valid, areaLeadId: null }).success,
    ).toBe(true);
  });

  it('should reject negative capacity', () => {
    expect(CreateAreaSchema.safeParse({ ...valid, capacity: -1 }).success).toBe(
      false,
    );
  });
});

// =============================================================
// UpdateAreaSchema
// =============================================================

describe('UpdateAreaSchema', () => {
  it('should accept empty update (all optional)', () => {
    expect(UpdateAreaSchema.safeParse({}).success).toBe(true);
  });

  it('should accept partial update', () => {
    expect(UpdateAreaSchema.safeParse({ name: 'Updated Name' }).success).toBe(
      true,
    );
  });

  it('should accept isActive 0-4', () => {
    for (const val of [0, 1, 3, 4]) {
      expect(UpdateAreaSchema.safeParse({ isActive: val }).success).toBe(true);
    }
  });

  it('should reject isActive over 4', () => {
    expect(UpdateAreaSchema.safeParse({ isActive: 5 }).success).toBe(false);
  });
});

// =============================================================
// DeleteAreaQuerySchema
// =============================================================

describe('DeleteAreaQuerySchema', () => {
  it('should accept empty query', () => {
    const result = DeleteAreaQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> })
      .data;
    expect(data.force).toBe(false);
  });

  it('should transform "true" string to boolean', () => {
    const result = DeleteAreaQuerySchema.safeParse({ force: 'true' });
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> })
      .data;
    expect(data.force).toBe(true);
  });

  it('should transform boolean true', () => {
    const result = DeleteAreaQuerySchema.safeParse({ force: true });
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> })
      .data;
    expect(data.force).toBe(true);
  });
});

// =============================================================
// ListAreasQuerySchema
// =============================================================

describe('ListAreasQuerySchema', () => {
  it('should accept empty query', () => {
    expect(ListAreasQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should accept type filter', () => {
    expect(ListAreasQuerySchema.safeParse({ type: 'office' }).success).toBe(
      true,
    );
  });

  it('should transform isActive string to number', () => {
    const result = ListAreasQuerySchema.safeParse({ isActive: '1' });
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> })
      .data;
    expect(data.isActive).toBe(1);
  });

  it('should reject search over 100 chars', () => {
    expect(
      ListAreasQuerySchema.safeParse({ search: 'a'.repeat(101) }).success,
    ).toBe(false);
  });
});

// =============================================================
// AssignDepartmentsSchema
// =============================================================

describe('AssignDepartmentsSchema', () => {
  it('should accept valid department IDs', () => {
    expect(
      AssignDepartmentsSchema.safeParse({ departmentIds: [1, 2, 3] }).success,
    ).toBe(true);
  });

  it('should accept empty array', () => {
    expect(
      AssignDepartmentsSchema.safeParse({ departmentIds: [] }).success,
    ).toBe(true);
  });

  it('should reject missing departmentIds', () => {
    expect(AssignDepartmentsSchema.safeParse({}).success).toBe(false);
  });
});

// =============================================================
// AssignHallsSchema
// =============================================================

describe('AssignHallsSchema', () => {
  it('should accept valid hall IDs', () => {
    expect(AssignHallsSchema.safeParse({ hallIds: [1, 2, 3] }).success).toBe(
      true,
    );
  });

  it('should accept empty array', () => {
    expect(AssignHallsSchema.safeParse({ hallIds: [] }).success).toBe(true);
  });

  it('should coerce string IDs to numbers', () => {
    const result = AssignHallsSchema.safeParse({ hallIds: ['1', '5'] });
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: { hallIds: number[] } })
      .data;
    expect(data.hallIds).toEqual([1, 5]);
  });

  it('should reject non-positive IDs', () => {
    expect(AssignHallsSchema.safeParse({ hallIds: [0] }).success).toBe(false);
    expect(AssignHallsSchema.safeParse({ hallIds: [-1] }).success).toBe(false);
  });

  it('should reject non-integer IDs', () => {
    expect(AssignHallsSchema.safeParse({ hallIds: [1.5] }).success).toBe(false);
  });

  it('should reject missing hallIds', () => {
    expect(AssignHallsSchema.safeParse({}).success).toBe(false);
  });
});
