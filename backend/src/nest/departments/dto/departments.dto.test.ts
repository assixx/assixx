import { describe, expect, it } from 'vitest';

import { AssignHallsSchema } from './assign-halls.dto.js';
import { CreateDepartmentSchema } from './create-department.dto.js';
import { DeleteDepartmentQuerySchema } from './delete-department.dto.js';
import { DepartmentIdParamSchema } from './department-id-param.dto.js';
import { ListDepartmentsQuerySchema } from './list-departments-query.dto.js';
import { UpdateDepartmentSchema } from './update-department.dto.js';

// =============================================================
// AssignHallsSchema
// =============================================================

describe('AssignHallsSchema', () => {
  it('should accept valid hall IDs array', () => {
    const data = AssignHallsSchema.parse({ hallIds: [1, 2, 3] });

    expect(data.hallIds).toEqual([1, 2, 3]);
  });

  it('should accept empty array', () => {
    const data = AssignHallsSchema.parse({ hallIds: [] });

    expect(data.hallIds).toEqual([]);
  });

  it('should coerce string IDs to numbers', () => {
    const data = AssignHallsSchema.parse({ hallIds: ['1', '2'] });

    expect(data.hallIds).toEqual([1, 2]);
  });

  it('should reject negative hall IDs', () => {
    expect(AssignHallsSchema.safeParse({ hallIds: [-1] }).success).toBe(false);
  });

  it('should reject missing hallIds', () => {
    expect(AssignHallsSchema.safeParse({}).success).toBe(false);
  });
});

// =============================================================
// CreateDepartmentSchema
// =============================================================

describe('CreateDepartmentSchema', () => {
  const valid = { name: 'Engineering' };

  it('should accept valid department', () => {
    expect(CreateDepartmentSchema.safeParse(valid).success).toBe(true);
  });

  it('should accept full payload with optional fields', () => {
    const data = CreateDepartmentSchema.parse({
      ...valid,
      description: 'Software team',
      departmentLeadId: '5',
      areaId: '2',
      isActive: '1',
    });

    expect(data.departmentLeadId).toBe(5);
    expect(data.areaId).toBe(2);
    expect(data.isActive).toBe(1);
  });

  it('should reject name shorter than 2 characters', () => {
    expect(CreateDepartmentSchema.safeParse({ name: 'A' }).success).toBe(false);
  });

  it('should reject name longer than 100 characters', () => {
    expect(CreateDepartmentSchema.safeParse({ name: 'X'.repeat(101) }).success).toBe(false);
  });

  it('should reject description longer than 500 characters', () => {
    expect(
      CreateDepartmentSchema.safeParse({
        ...valid,
        description: 'D'.repeat(501),
      }).success,
    ).toBe(false);
  });

  it('should reject isActive out of range', () => {
    expect(CreateDepartmentSchema.safeParse({ ...valid, isActive: '5' }).success).toBe(false);
  });
});

// =============================================================
// UpdateDepartmentSchema
// =============================================================

describe('UpdateDepartmentSchema', () => {
  it('should accept empty object (all optional)', () => {
    expect(UpdateDepartmentSchema.safeParse({}).success).toBe(true);
  });

  it('should accept partial update', () => {
    const data = UpdateDepartmentSchema.parse({ name: 'Sales' });

    expect(data.name).toBe('Sales');
  });

  it('should coerce nullable departmentLeadId', () => {
    const data = UpdateDepartmentSchema.parse({
      departmentLeadId: null,
    });

    expect(data.departmentLeadId).toBeNull();
  });
});

// =============================================================
// ListDepartmentsQuerySchema
// =============================================================

describe('ListDepartmentsQuerySchema', () => {
  it('should accept empty query', () => {
    expect(ListDepartmentsQuerySchema.safeParse({}).success).toBe(true);
  });

  it.each([
    ['true', true],
    ['false', false],
    ['1', true],
    ['0', false],
    [1, true],
    [0, false],
    [true, true],
    [false, false],
  ] as const)('should coerce includeExtended=%s to %s', (input, expected) => {
    const data = ListDepartmentsQuerySchema.parse({
      includeExtended: input,
    });

    expect(data.includeExtended).toBe(expected);
  });
});

// =============================================================
// DepartmentIdParamSchema
// =============================================================

describe('DepartmentIdParamSchema', () => {
  it('should coerce string id to number', () => {
    const data = DepartmentIdParamSchema.parse({ id: '42' });

    expect(data.id).toBe(42);
  });

  it('should reject zero', () => {
    expect(DepartmentIdParamSchema.safeParse({ id: '0' }).success).toBe(false);
  });
});

// =============================================================
// DeleteDepartmentQuerySchema
// =============================================================

describe('DeleteDepartmentQuerySchema', () => {
  it('should accept empty query (force is optional)', () => {
    expect(DeleteDepartmentQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should coerce string "true" to boolean true', () => {
    const data = DeleteDepartmentQuerySchema.parse({ force: 'true' });

    expect(data.force).toBe(true);
  });

  it('should coerce string "false" to boolean false', () => {
    const data = DeleteDepartmentQuerySchema.parse({ force: 'false' });

    expect(data.force).toBe(false);
  });
});
