import { describe, expect, it } from 'vitest';

import { TpmDefectItemSchema, TpmDefectsArraySchema } from './common.dto.js';
import { CompleteCardSchema } from './complete-card.dto.js';
import { CreateExecutionSchema } from './create-execution.dto.js';
import { ListPlansQuerySchema } from './list-plans-query.dto.js';

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
    expect(TpmDefectItemSchema.safeParse({ title: 'x'.repeat(501) }).success).toBe(false);
  });

  it('should accept title at exactly 500 chars', () => {
    expect(TpmDefectItemSchema.safeParse({ title: 'x'.repeat(500) }).success).toBe(true);
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
    expect(TpmDefectItemSchema.safeParse({ description: 'Details' }).success).toBe(false);
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
    expect(TpmDefectsArraySchema.safeParse([{ title: '' }]).success).toBe(false);
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
      defects: [{ title: 'Leckage', description: 'Öl links' }, { title: 'Verschleiß' }],
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
    expect(CreateExecutionSchema.safeParse({ noIssuesFound: true }).success).toBe(false);
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

// =============================================================
// ListPlansQuerySchema (Phase 1.2a-B, 2026-05-01)
// Pagination via PaginationSchema (default page=1, limit=20, max=100 — D2).
// Search field: D3 convention .trim().max(100).optional().
// =============================================================

describe('ListPlansQuerySchema', () => {
  it('should accept empty query and apply defaults (limit=20 override, D2 max=100)', () => {
    const result = ListPlansQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.search).toBeUndefined();
  });

  it('should coerce page + limit from strings (HTTP query params)', () => {
    const result = ListPlansQuerySchema.parse({ page: '3', limit: '50' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it('should accept limit=100 (boundary)', () => {
    const result = ListPlansQuerySchema.parse({ limit: '100' });
    expect(result.limit).toBe(100);
  });

  it('should reject limit=101 (D2 cap, was 500 in local LimitSchema)', () => {
    expect(ListPlansQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('should reject page=0', () => {
    expect(ListPlansQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });

  // ----- search field (D3 convention) -----

  it('should accept search string', () => {
    const result = ListPlansQuerySchema.parse({ search: 'Hydraulik' });
    expect(result.search).toBe('Hydraulik');
  });

  it('should trim whitespace from search', () => {
    const result = ListPlansQuerySchema.parse({ search: '  trimmed  ' });
    expect(result.search).toBe('trimmed');
  });

  it('should accept search at exactly 100 chars (boundary)', () => {
    expect(ListPlansQuerySchema.safeParse({ search: 'A'.repeat(100) }).success).toBe(true);
  });

  it('should reject search longer than 100 chars', () => {
    expect(ListPlansQuerySchema.safeParse({ search: 'A'.repeat(101) }).success).toBe(false);
  });

  it('should accept empty search string (service treats as no filter)', () => {
    expect(ListPlansQuerySchema.safeParse({ search: '' }).success).toBe(true);
  });
});
