import { describe, expect, it } from 'vitest';

import { CreateHallSchema } from './create-hall.dto.js';
import { DeleteHallQuerySchema } from './delete-hall-query.dto.js';
import { HallIdParamSchema } from './hall-id-param.dto.js';
import { ListHallsQuerySchema } from './list-halls-query.dto.js';
import { UpdateHallSchema } from './update-hall.dto.js';

// =============================================================
// CreateHallSchema
// =============================================================

describe('CreateHallSchema', () => {
  const valid = { name: 'Werkshalle A' };

  it('should accept valid hall', () => {
    expect(CreateHallSchema.safeParse(valid).success).toBe(true);
  });

  it('should accept full payload with optional fields', () => {
    const data = CreateHallSchema.parse({
      ...valid,
      description: 'Hauptproduktion',
      areaId: '2',
      isActive: '1',
    });

    expect(data.areaId).toBe(2);
    expect(data.isActive).toBe(1);
  });

  it('should trim name', () => {
    const data = CreateHallSchema.parse({ name: '  Halle B  ' });

    expect(data.name).toBe('Halle B');
  });

  it('should reject name shorter than 2 characters', () => {
    expect(CreateHallSchema.safeParse({ name: 'A' }).success).toBe(false);
  });

  it('should reject name longer than 255 characters', () => {
    expect(CreateHallSchema.safeParse({ name: 'X'.repeat(256) }).success).toBe(
      false,
    );
  });

  it('should reject description longer than 500 characters', () => {
    expect(
      CreateHallSchema.safeParse({
        ...valid,
        description: 'D'.repeat(501),
      }).success,
    ).toBe(false);
  });

  it('should accept null areaId', () => {
    const data = CreateHallSchema.parse({ ...valid, areaId: null });

    expect(data.areaId).toBeNull();
  });

  it('should reject negative areaId', () => {
    expect(CreateHallSchema.safeParse({ ...valid, areaId: '-1' }).success).toBe(
      false,
    );
  });

  it('should reject isActive out of range', () => {
    expect(
      CreateHallSchema.safeParse({ ...valid, isActive: '5' }).success,
    ).toBe(false);
  });

  it('should coerce string isActive to number', () => {
    const data = CreateHallSchema.parse({ ...valid, isActive: '3' });

    expect(data.isActive).toBe(3);
  });
});

// =============================================================
// UpdateHallSchema
// =============================================================

describe('UpdateHallSchema', () => {
  it('should accept empty object (all optional)', () => {
    expect(UpdateHallSchema.safeParse({}).success).toBe(true);
  });

  it('should accept partial update', () => {
    const data = UpdateHallSchema.parse({ name: 'Halle C' });

    expect(data.name).toBe('Halle C');
  });

  it('should coerce nullable areaId', () => {
    const data = UpdateHallSchema.parse({ areaId: null });

    expect(data.areaId).toBeNull();
  });

  it('should reject name shorter than 2 characters', () => {
    expect(UpdateHallSchema.safeParse({ name: 'X' }).success).toBe(false);
  });
});

// =============================================================
// ListHallsQuerySchema
// =============================================================

describe('ListHallsQuerySchema', () => {
  it('should accept empty query', () => {
    expect(ListHallsQuerySchema.safeParse({}).success).toBe(true);
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
    const data = ListHallsQuerySchema.parse({
      includeExtended: input,
    });

    expect(data.includeExtended).toBe(expected);
  });
});

// =============================================================
// HallIdParamSchema
// =============================================================

describe('HallIdParamSchema', () => {
  it('should coerce string id to number', () => {
    const data = HallIdParamSchema.parse({ id: '42' });

    expect(data.id).toBe(42);
  });

  it('should reject zero', () => {
    expect(HallIdParamSchema.safeParse({ id: '0' }).success).toBe(false);
  });
});

// =============================================================
// DeleteHallQuerySchema
// =============================================================

describe('DeleteHallQuerySchema', () => {
  it('should accept empty query (force is optional)', () => {
    expect(DeleteHallQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should coerce string "true" to boolean true', () => {
    const data = DeleteHallQuerySchema.parse({ force: 'true' });

    expect(data.force).toBe(true);
  });

  it('should coerce string "false" to boolean false', () => {
    const data = DeleteHallQuerySchema.parse({ force: 'false' });

    expect(data.force).toBe(false);
  });

  it('should coerce number 1 to boolean true', () => {
    const data = DeleteHallQuerySchema.parse({ force: 1 });

    expect(data.force).toBe(true);
  });

  it('should coerce number 0 to boolean false', () => {
    const data = DeleteHallQuerySchema.parse({ force: 0 });

    expect(data.force).toBe(false);
  });
});
