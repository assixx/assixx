import { describe, expect, it } from 'vitest';

import { TpmDefectItemSchema, TpmDefectsArraySchema } from './common.dto.js';
import { CompleteCardSchema } from './complete-card.dto.js';
import { CreateExecutionSchema } from './create-execution.dto.js';

const VALID_UUID = '019c9547-9fc0-771a-b022-3767e233d6f3';

// =============================================================
// TpmDefectItemSchema
// =============================================================

describe('TpmDefectItemSchema', () => {
  it('should accept valid defect', () => {
    const result = TpmDefectItemSchema.safeParse({
      title: 'Leckage am Ventil',
      description: 'Ölaustritt links',
    });
    expect(result.success).toBe(true);
  });

  it('should accept defect without description', () => {
    const result = TpmDefectItemSchema.safeParse({ title: 'Riss' });
    expect(result.success).toBe(true);
  });

  it('should accept null description', () => {
    const result = TpmDefectItemSchema.safeParse({
      title: 'Verschleiß',
      description: null,
    });
    expect(result.success).toBe(true);
  });

  it('should trim title whitespace', () => {
    const data = TpmDefectItemSchema.parse({ title: '  Leckage  ' });
    expect(data.title).toBe('Leckage');
  });

  it('should trim description whitespace', () => {
    const data = TpmDefectItemSchema.parse({
      title: 'Test',
      description: '  Details  ',
    });
    expect(data.description).toBe('Details');
  });

  it('should reject empty title', () => {
    expect(TpmDefectItemSchema.safeParse({ title: '' }).success).toBe(false);
  });

  it('should reject whitespace-only title', () => {
    expect(TpmDefectItemSchema.safeParse({ title: '   ' }).success).toBe(false);
  });

  it('should reject title exceeding 500 chars', () => {
    expect(
      TpmDefectItemSchema.safeParse({ title: 'x'.repeat(501) }).success,
    ).toBe(false);
  });

  it('should accept title at exactly 500 chars', () => {
    expect(
      TpmDefectItemSchema.safeParse({ title: 'x'.repeat(500) }).success,
    ).toBe(true);
  });

  it('should reject description exceeding 5000 chars', () => {
    expect(
      TpmDefectItemSchema.safeParse({
        title: 'Test',
        description: 'x'.repeat(5001),
      }).success,
    ).toBe(false);
  });

  it('should accept description at exactly 5000 chars', () => {
    expect(
      TpmDefectItemSchema.safeParse({
        title: 'Test',
        description: 'x'.repeat(5000),
      }).success,
    ).toBe(true);
  });

  it('should reject missing title', () => {
    expect(
      TpmDefectItemSchema.safeParse({ description: 'Details' }).success,
    ).toBe(false);
  });
});

// =============================================================
// TpmDefectsArraySchema
// =============================================================

describe('TpmDefectsArraySchema', () => {
  it('should default to empty array when undefined', () => {
    const data = TpmDefectsArraySchema.parse(undefined);
    expect(data).toEqual([]);
  });

  it('should accept empty array', () => {
    const data = TpmDefectsArraySchema.parse([]);
    expect(data).toEqual([]);
  });

  it('should accept single defect', () => {
    const data = TpmDefectsArraySchema.parse([{ title: 'Mangel 1' }]);
    expect(data).toHaveLength(1);
    expect(data[0]?.title).toBe('Mangel 1');
  });

  it('should accept multiple defects', () => {
    const defects = Array.from({ length: 5 }, (_: unknown, i: number) => ({
      title: `Mangel ${i + 1}`,
    }));
    const data = TpmDefectsArraySchema.parse(defects);
    expect(data).toHaveLength(5);
  });

  it('should accept exactly 20 defects', () => {
    const defects = Array.from({ length: 20 }, (_: unknown, i: number) => ({
      title: `Mangel ${i + 1}`,
    }));
    expect(TpmDefectsArraySchema.safeParse(defects).success).toBe(true);
  });

  it('should reject more than 20 defects', () => {
    const defects = Array.from({ length: 21 }, (_: unknown, i: number) => ({
      title: `Mangel ${i + 1}`,
    }));
    expect(TpmDefectsArraySchema.safeParse(defects).success).toBe(false);
  });

  it('should reject array with invalid defect item', () => {
    expect(TpmDefectsArraySchema.safeParse([{ title: '' }]).success).toBe(
      false,
    );
  });
});

// =============================================================
// CreateExecutionSchema — defects field integration
// =============================================================

describe('CreateExecutionSchema', () => {
  const validBase = {
    cardUuid: VALID_UUID,
    noIssuesFound: true,
  };

  it('should accept execution without defects', () => {
    const data = CreateExecutionSchema.parse(validBase);
    expect(data.defects).toEqual([]);
  });

  it('should accept execution with defects', () => {
    const data = CreateExecutionSchema.parse({
      ...validBase,
      noIssuesFound: false,
      defects: [
        { title: 'Leckage', description: 'Öl links' },
        { title: 'Verschleiß' },
      ],
    });
    expect(data.defects).toHaveLength(2);
  });

  it('should reject invalid defect in execution', () => {
    expect(
      CreateExecutionSchema.safeParse({
        ...validBase,
        defects: [{ title: '' }],
      }).success,
    ).toBe(false);
  });

  it('should reject missing cardUuid', () => {
    expect(
      CreateExecutionSchema.safeParse({ noIssuesFound: true }).success,
    ).toBe(false);
  });

  it('should default noIssuesFound to false', () => {
    const data = CreateExecutionSchema.parse({ cardUuid: VALID_UUID });
    expect(data.noIssuesFound).toBe(false);
  });

  it('should accept valid executionDate', () => {
    const data = CreateExecutionSchema.parse({
      ...validBase,
      executionDate: '2026-03-01',
    });
    expect(data.executionDate).toBe('2026-03-01');
  });

  it('should reject invalid executionDate', () => {
    expect(
      CreateExecutionSchema.safeParse({
        ...validBase,
        executionDate: 'not-a-date',
      }).success,
    ).toBe(false);
  });

  it('should reject duration below 1', () => {
    expect(
      CreateExecutionSchema.safeParse({
        ...validBase,
        actualDurationMinutes: 0,
      }).success,
    ).toBe(false);
  });

  it('should reject duration above 1440', () => {
    expect(
      CreateExecutionSchema.safeParse({
        ...validBase,
        actualDurationMinutes: 1441,
      }).success,
    ).toBe(false);
  });

  it('should accept null duration', () => {
    const data = CreateExecutionSchema.parse({
      ...validBase,
      actualDurationMinutes: null,
    });
    expect(data.actualDurationMinutes).toBeNull();
  });

  it('should reject staff count below 1', () => {
    expect(
      CreateExecutionSchema.safeParse({
        ...validBase,
        actualStaffCount: 0,
      }).success,
    ).toBe(false);
  });

  it('should reject staff count above 50', () => {
    expect(
      CreateExecutionSchema.safeParse({
        ...validBase,
        actualStaffCount: 51,
      }).success,
    ).toBe(false);
  });

  it('should reject documentation exceeding 10000 chars', () => {
    expect(
      CreateExecutionSchema.safeParse({
        ...validBase,
        documentation: 'x'.repeat(10_001),
      }).success,
    ).toBe(false);
  });

  it('should reject more than 10 participants', () => {
    const uuids = Array.from({ length: 11 }, () => VALID_UUID);
    expect(
      CreateExecutionSchema.safeParse({
        ...validBase,
        participantUuids: uuids,
      }).success,
    ).toBe(false);
  });
});

// =============================================================
// CompleteCardSchema — defects field integration
// =============================================================

describe('CompleteCardSchema', () => {
  it('should accept minimal payload', () => {
    const data = CompleteCardSchema.parse({});
    expect(data.noIssuesFound).toBe(false);
    expect(data.defects).toEqual([]);
  });

  it('should accept payload with defects', () => {
    const data = CompleteCardSchema.parse({
      noIssuesFound: false,
      defects: [{ title: 'Riss am Gehäuse' }],
    });
    expect(data.defects).toHaveLength(1);
  });

  it('should reject invalid defect', () => {
    expect(
      CompleteCardSchema.safeParse({
        defects: [{ title: '' }],
      }).success,
    ).toBe(false);
  });
});
