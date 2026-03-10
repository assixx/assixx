import { describe, expect, it } from 'vitest';

import { UpdateHierarchyLabelsSchema } from './update-hierarchy-labels.dto.js';
import { UpsertPositionsSchema } from './upsert-positions.dto.js';

// =============================================================
// UpsertPositionsSchema
// =============================================================

describe('UpsertPositionsSchema', () => {
  const validPosition = {
    entityType: 'area',
    entityUuid: '01234567-89ab-cdef-0123-456789abcdef',
    positionX: 100,
    positionY: 200,
    width: 300,
    height: 150,
  };

  const valid = { positions: [validPosition] };

  it('should accept a single valid position', () => {
    expect(UpsertPositionsSchema.safeParse(valid).success).toBe(true);
  });

  it('should accept multiple positions', () => {
    const data = {
      positions: [
        validPosition,
        { ...validPosition, entityType: 'department', positionX: 400 },
        { ...validPosition, entityType: 'team', positionY: 500 },
      ],
    };

    expect(UpsertPositionsSchema.safeParse(data).success).toBe(true);
  });

  it.each(['area', 'department', 'team', 'asset'] as const)(
    'should accept entityType=%s',
    (entityType: string) => {
      const data = {
        positions: [{ ...validPosition, entityType }],
      };

      expect(UpsertPositionsSchema.safeParse(data).success).toBe(true);
    },
  );

  it('should reject invalid entityType', () => {
    const data = {
      positions: [{ ...validPosition, entityType: 'building' }],
    };

    expect(UpsertPositionsSchema.safeParse(data).success).toBe(false);
  });

  it('should reject empty positions array', () => {
    expect(UpsertPositionsSchema.safeParse({ positions: [] }).success).toBe(
      false,
    );
  });

  it('should reject more than 500 positions', () => {
    const positions = Array.from({ length: 501 }, (_, i: number) => ({
      ...validPosition,
      positionX: i,
    }));

    expect(UpsertPositionsSchema.safeParse({ positions }).success).toBe(false);
  });

  it('should accept exactly 500 positions', () => {
    const positions = Array.from({ length: 500 }, (_, i: number) => ({
      ...validPosition,
      positionX: i,
    }));

    expect(UpsertPositionsSchema.safeParse({ positions }).success).toBe(true);
  });

  it('should reject missing positions key', () => {
    expect(UpsertPositionsSchema.safeParse({}).success).toBe(false);
  });

  // --- entityUuid ---

  it('should reject entityUuid shorter than 36 characters', () => {
    const data = {
      positions: [{ ...validPosition, entityUuid: 'too-short' }],
    };

    expect(UpsertPositionsSchema.safeParse(data).success).toBe(false);
  });

  it('should reject entityUuid longer than 36 characters', () => {
    const data = {
      positions: [{ ...validPosition, entityUuid: 'a'.repeat(37) }],
    };

    expect(UpsertPositionsSchema.safeParse(data).success).toBe(false);
  });

  it('should trim entityUuid whitespace', () => {
    const data = {
      positions: [
        {
          ...validPosition,
          entityUuid: ' 01234567-89ab-cdef-0123-456789abcdef ',
        },
      ],
    };
    const result = UpsertPositionsSchema.safeParse(data);

    // After trim, length is 36 → should pass
    expect(result.success).toBe(true);
  });

  // --- width / height ---

  it('should reject zero width', () => {
    const data = {
      positions: [{ ...validPosition, width: 0 }],
    };

    expect(UpsertPositionsSchema.safeParse(data).success).toBe(false);
  });

  it('should reject negative width', () => {
    const data = {
      positions: [{ ...validPosition, width: -10 }],
    };

    expect(UpsertPositionsSchema.safeParse(data).success).toBe(false);
  });

  it('should reject width exceeding 2000', () => {
    const data = {
      positions: [{ ...validPosition, width: 2001 }],
    };

    expect(UpsertPositionsSchema.safeParse(data).success).toBe(false);
  });

  it('should accept width exactly 2000', () => {
    const data = {
      positions: [{ ...validPosition, width: 2000 }],
    };

    expect(UpsertPositionsSchema.safeParse(data).success).toBe(true);
  });

  it('should reject zero height', () => {
    const data = {
      positions: [{ ...validPosition, height: 0 }],
    };

    expect(UpsertPositionsSchema.safeParse(data).success).toBe(false);
  });

  it('should reject negative height', () => {
    const data = {
      positions: [{ ...validPosition, height: -5 }],
    };

    expect(UpsertPositionsSchema.safeParse(data).success).toBe(false);
  });

  it('should reject height exceeding 2000', () => {
    const data = {
      positions: [{ ...validPosition, height: 2001 }],
    };

    expect(UpsertPositionsSchema.safeParse(data).success).toBe(false);
  });

  // --- positionX / positionY allow any number (including 0 and negative) ---

  it('should accept zero positionX and positionY', () => {
    const data = {
      positions: [{ ...validPosition, positionX: 0, positionY: 0 }],
    };

    expect(UpsertPositionsSchema.safeParse(data).success).toBe(true);
  });

  it('should accept negative positionX and positionY', () => {
    const data = {
      positions: [{ ...validPosition, positionX: -50, positionY: -100 }],
    };

    expect(UpsertPositionsSchema.safeParse(data).success).toBe(true);
  });

  // --- missing required fields ---

  it('should reject missing entityType', () => {
    const { entityType: _, ...noType } = validPosition;
    const data = { positions: [noType] };

    expect(UpsertPositionsSchema.safeParse(data).success).toBe(false);
  });

  it('should reject missing entityUuid', () => {
    const { entityUuid: _, ...noUuid } = validPosition;
    const data = { positions: [noUuid] };

    expect(UpsertPositionsSchema.safeParse(data).success).toBe(false);
  });

  it('should reject missing width', () => {
    const { width: _, ...noWidth } = validPosition;
    const data = { positions: [noWidth] };

    expect(UpsertPositionsSchema.safeParse(data).success).toBe(false);
  });

  it('should reject missing height', () => {
    const { height: _, ...noHeight } = validPosition;
    const data = { positions: [noHeight] };

    expect(UpsertPositionsSchema.safeParse(data).success).toBe(false);
  });
});

// =============================================================
// UpdateHierarchyLabelsSchema
// =============================================================

describe('UpdateHierarchyLabelsSchema', () => {
  const valid = {
    levels: {
      area: 'Hallen',
      department: 'Segmente',
      team: 'Teilbereiche',
      asset: 'Maschinen',
    },
  };

  it('should accept all labels provided', () => {
    expect(UpdateHierarchyLabelsSchema.safeParse(valid).success).toBe(true);
  });

  it('should accept partial labels (only area)', () => {
    const data = { levels: { area: 'Hallen' } };

    expect(UpdateHierarchyLabelsSchema.safeParse(data).success).toBe(true);
  });

  it('should accept partial labels (only department and team)', () => {
    const data = { levels: { department: 'Linien', team: 'Gruppen' } };

    expect(UpdateHierarchyLabelsSchema.safeParse(data).success).toBe(true);
  });

  it('should accept empty levels object (all optional)', () => {
    expect(UpdateHierarchyLabelsSchema.safeParse({ levels: {} }).success).toBe(
      true,
    );
  });

  it('should reject missing levels key', () => {
    expect(UpdateHierarchyLabelsSchema.safeParse({}).success).toBe(false);
  });

  // --- LabelSchema constraints ---

  it('should reject empty string label', () => {
    const data = { levels: { area: '' } };

    expect(UpdateHierarchyLabelsSchema.safeParse(data).success).toBe(false);
  });

  it('should reject whitespace-only label (trimmed to empty)', () => {
    const data = { levels: { area: '   ' } };

    expect(UpdateHierarchyLabelsSchema.safeParse(data).success).toBe(false);
  });

  it('should reject label exceeding 50 characters', () => {
    const data = { levels: { area: 'A'.repeat(51) } };

    expect(UpdateHierarchyLabelsSchema.safeParse(data).success).toBe(false);
  });

  it('should accept label with exactly 50 characters', () => {
    const data = { levels: { area: 'A'.repeat(50) } };

    expect(UpdateHierarchyLabelsSchema.safeParse(data).success).toBe(true);
  });

  it('should accept single character label', () => {
    const data = { levels: { team: 'X' } };

    expect(UpdateHierarchyLabelsSchema.safeParse(data).success).toBe(true);
  });

  it('should trim whitespace from labels', () => {
    const data = { levels: { area: '  Hallen  ' } };
    const result = UpdateHierarchyLabelsSchema.parse(data);

    expect(result.levels.area).toBe('Hallen');
  });

  it.each(['area', 'department', 'team', 'asset'] as const)(
    'should accept updating only %s',
    (key: string) => {
      const data = { levels: { [key]: 'Custom Label' } };

      expect(UpdateHierarchyLabelsSchema.safeParse(data).success).toBe(true);
    },
  );
});
