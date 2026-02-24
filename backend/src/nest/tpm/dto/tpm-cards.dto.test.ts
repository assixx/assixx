/**
 * DTO validation tests for TPM Card schemas (create + update)
 *
 * Tests: field validation, cross-field refinements, edge cases.
 * Pattern: ADR-018 Phase 8 — Zod .safeParse() + .parse() assertions.
 */
import { describe, expect, it } from 'vitest';

import { CreateCardSchema } from './create-card.dto.js';
import { UpdateCardSchema } from './update-card.dto.js';

// =============================================================
// CreateCardSchema
// =============================================================

describe('CreateCardSchema', () => {
  const valid = {
    planUuid: '019c9088-c3da-751f-ad4f-06ef7c086342',
    cardRole: 'operator' as const,
    intervalType: 'weekly' as const,
    title: 'Sichtprüfung Hydraulik',
    requiresApproval: false,
  };

  // -----------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------

  it('should accept minimal valid payload', () => {
    const result = CreateCardSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should accept full payload with all optional fields', () => {
    const result = CreateCardSchema.safeParse({
      ...valid,
      description: 'Dichtungen prüfen',
      locationDescription: 'Halle 3, links',
      weekdayOverride: 2,
      estimatedExecutionMinutes: 30,
    });
    expect(result.success).toBe(true);
  });

  it('should accept estimatedExecutionMinutes as null', () => {
    const result = CreateCardSchema.safeParse({
      ...valid,
      estimatedExecutionMinutes: null,
    });
    expect(result.success).toBe(true);
  });

  it('should accept custom interval with customIntervalDays', () => {
    const result = CreateCardSchema.safeParse({
      ...valid,
      intervalType: 'custom',
      customIntervalDays: 14,
    });
    expect(result.success).toBe(true);
  });

  // -----------------------------------------------------------
  // Required fields
  // -----------------------------------------------------------

  it('should reject missing planUuid', () => {
    const { planUuid: _, ...rest } = valid;
    expect(CreateCardSchema.safeParse(rest).success).toBe(false);
  });

  it('should reject missing title', () => {
    const { title: _, ...rest } = valid;
    expect(CreateCardSchema.safeParse(rest).success).toBe(false);
  });

  it('should reject empty title', () => {
    expect(CreateCardSchema.safeParse({ ...valid, title: '' }).success).toBe(
      false,
    );
  });

  it('should reject whitespace-only title', () => {
    expect(CreateCardSchema.safeParse({ ...valid, title: '   ' }).success).toBe(
      false,
    );
  });

  it('should reject title longer than 255 characters', () => {
    expect(
      CreateCardSchema.safeParse({ ...valid, title: 'X'.repeat(256) }).success,
    ).toBe(false);
  });

  // -----------------------------------------------------------
  // cardRole validation
  // -----------------------------------------------------------

  it.each(['operator', 'maintenance'] as const)(
    'should accept cardRole=%s',
    (cardRole) => {
      expect(CreateCardSchema.safeParse({ ...valid, cardRole }).success).toBe(
        true,
      );
    },
  );

  it('should reject invalid cardRole', () => {
    expect(
      CreateCardSchema.safeParse({ ...valid, cardRole: 'admin' }).success,
    ).toBe(false);
  });

  // -----------------------------------------------------------
  // intervalType validation
  // -----------------------------------------------------------

  it.each([
    'daily',
    'weekly',
    'monthly',
    'quarterly',
    'semi_annual',
    'annual',
  ] as const)(
    'should accept intervalType=%s without customIntervalDays',
    (intervalType) => {
      const payload = {
        ...valid,
        intervalType,
        customIntervalDays: null,
        weekdayOverride: intervalType === 'weekly' ? 0 : null,
      };
      expect(CreateCardSchema.safeParse(payload).success).toBe(true);
    },
  );

  it('should reject invalid intervalType', () => {
    expect(
      CreateCardSchema.safeParse({ ...valid, intervalType: 'biweekly' })
        .success,
    ).toBe(false);
  });

  // -----------------------------------------------------------
  // estimatedExecutionMinutes validation
  // -----------------------------------------------------------

  it('should accept estimatedExecutionMinutes=1 (minimum)', () => {
    expect(
      CreateCardSchema.safeParse({ ...valid, estimatedExecutionMinutes: 1 })
        .success,
    ).toBe(true);
  });

  it('should accept estimatedExecutionMinutes=10080 (maximum)', () => {
    expect(
      CreateCardSchema.safeParse({ ...valid, estimatedExecutionMinutes: 10080 })
        .success,
    ).toBe(true);
  });

  it('should reject estimatedExecutionMinutes=0', () => {
    expect(
      CreateCardSchema.safeParse({ ...valid, estimatedExecutionMinutes: 0 })
        .success,
    ).toBe(false);
  });

  it('should reject estimatedExecutionMinutes=10081 (over max)', () => {
    expect(
      CreateCardSchema.safeParse({ ...valid, estimatedExecutionMinutes: 10081 })
        .success,
    ).toBe(false);
  });

  it('should reject non-integer estimatedExecutionMinutes', () => {
    expect(
      CreateCardSchema.safeParse({ ...valid, estimatedExecutionMinutes: 30.5 })
        .success,
    ).toBe(false);
  });

  it('should reject negative estimatedExecutionMinutes', () => {
    expect(
      CreateCardSchema.safeParse({ ...valid, estimatedExecutionMinutes: -10 })
        .success,
    ).toBe(false);
  });

  // -----------------------------------------------------------
  // Cross-field: customIntervalDays
  // -----------------------------------------------------------

  it('should reject custom interval without customIntervalDays', () => {
    const result = CreateCardSchema.safeParse({
      ...valid,
      intervalType: 'custom',
    });
    expect(result.success).toBe(false);
  });

  it('should reject customIntervalDays for non-custom interval', () => {
    const result = CreateCardSchema.safeParse({
      ...valid,
      intervalType: 'daily',
      customIntervalDays: 14,
    });
    expect(result.success).toBe(false);
  });

  it('should reject customIntervalDays=0', () => {
    const result = CreateCardSchema.safeParse({
      ...valid,
      intervalType: 'custom',
      customIntervalDays: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject customIntervalDays > 3650', () => {
    const result = CreateCardSchema.safeParse({
      ...valid,
      intervalType: 'custom',
      customIntervalDays: 3651,
    });
    expect(result.success).toBe(false);
  });

  // -----------------------------------------------------------
  // Cross-field: weekdayOverride
  // -----------------------------------------------------------

  it('should accept weekdayOverride for weekly interval', () => {
    expect(
      CreateCardSchema.safeParse({
        ...valid,
        intervalType: 'weekly',
        weekdayOverride: 4,
      }).success,
    ).toBe(true);
  });

  it('should reject weekdayOverride for non-weekly interval', () => {
    expect(
      CreateCardSchema.safeParse({
        ...valid,
        intervalType: 'daily',
        weekdayOverride: 3,
      }).success,
    ).toBe(false);
  });

  it.each([0, 1, 2, 3, 4, 5, 6])(
    'should accept weekdayOverride=%d for weekly',
    (day) => {
      expect(
        CreateCardSchema.safeParse({
          ...valid,
          intervalType: 'weekly',
          weekdayOverride: day,
        }).success,
      ).toBe(true);
    },
  );

  it('should reject weekdayOverride=7 (out of range)', () => {
    expect(
      CreateCardSchema.safeParse({
        ...valid,
        intervalType: 'weekly',
        weekdayOverride: 7,
      }).success,
    ).toBe(false);
  });

  it('should reject weekdayOverride=-1', () => {
    expect(
      CreateCardSchema.safeParse({
        ...valid,
        intervalType: 'weekly',
        weekdayOverride: -1,
      }).success,
    ).toBe(false);
  });

  // -----------------------------------------------------------
  // description / locationDescription
  // -----------------------------------------------------------

  it('should reject description longer than 5000 characters', () => {
    expect(
      CreateCardSchema.safeParse({
        ...valid,
        description: 'X'.repeat(5001),
      }).success,
    ).toBe(false);
  });

  it('should reject locationDescription longer than 1000 characters', () => {
    expect(
      CreateCardSchema.safeParse({
        ...valid,
        locationDescription: 'X'.repeat(1001),
      }).success,
    ).toBe(false);
  });

  it('should trim title whitespace', () => {
    const data = CreateCardSchema.parse({
      ...valid,
      title: '  Trimmed Title  ',
    });
    expect(data.title).toBe('Trimmed Title');
  });
});

// =============================================================
// UpdateCardSchema
// =============================================================

describe('UpdateCardSchema', () => {
  // -----------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------

  it('should accept empty payload (no fields updated)', () => {
    expect(UpdateCardSchema.safeParse({}).success).toBe(true);
  });

  it('should accept single field update', () => {
    expect(UpdateCardSchema.safeParse({ title: 'Neuer Titel' }).success).toBe(
      true,
    );
  });

  it('should accept estimatedExecutionMinutes update', () => {
    expect(
      UpdateCardSchema.safeParse({ estimatedExecutionMinutes: 60 }).success,
    ).toBe(true);
  });

  it('should accept estimatedExecutionMinutes=null (clear value)', () => {
    expect(
      UpdateCardSchema.safeParse({ estimatedExecutionMinutes: null }).success,
    ).toBe(true);
  });

  // -----------------------------------------------------------
  // estimatedExecutionMinutes validation (same rules as create)
  // -----------------------------------------------------------

  it('should accept estimatedExecutionMinutes=1 (minimum)', () => {
    expect(
      UpdateCardSchema.safeParse({ estimatedExecutionMinutes: 1 }).success,
    ).toBe(true);
  });

  it('should accept estimatedExecutionMinutes=10080 (maximum)', () => {
    expect(
      UpdateCardSchema.safeParse({ estimatedExecutionMinutes: 10080 }).success,
    ).toBe(true);
  });

  it('should reject estimatedExecutionMinutes=0', () => {
    expect(
      UpdateCardSchema.safeParse({ estimatedExecutionMinutes: 0 }).success,
    ).toBe(false);
  });

  it('should reject estimatedExecutionMinutes=10081', () => {
    expect(
      UpdateCardSchema.safeParse({ estimatedExecutionMinutes: 10081 }).success,
    ).toBe(false);
  });

  it('should reject non-integer estimatedExecutionMinutes', () => {
    expect(
      UpdateCardSchema.safeParse({ estimatedExecutionMinutes: 15.7 }).success,
    ).toBe(false);
  });

  // -----------------------------------------------------------
  // Cross-field: custom interval
  // -----------------------------------------------------------

  it('should accept intervalType=custom with customIntervalDays', () => {
    expect(
      UpdateCardSchema.safeParse({
        intervalType: 'custom',
        customIntervalDays: 30,
      }).success,
    ).toBe(true);
  });

  it('should reject intervalType=custom without customIntervalDays', () => {
    expect(UpdateCardSchema.safeParse({ intervalType: 'custom' }).success).toBe(
      false,
    );
  });

  it('should reject customIntervalDays with non-custom intervalType', () => {
    expect(
      UpdateCardSchema.safeParse({
        intervalType: 'daily',
        customIntervalDays: 7,
      }).success,
    ).toBe(false);
  });

  it('should allow customIntervalDays without intervalType (partial update)', () => {
    // When intervalType is not provided, customIntervalDays is valid
    // (the server knows the existing intervalType)
    expect(UpdateCardSchema.safeParse({ customIntervalDays: 14 }).success).toBe(
      true,
    );
  });

  // -----------------------------------------------------------
  // Cross-field: weekdayOverride
  // -----------------------------------------------------------

  it('should accept weekdayOverride with weekly intervalType', () => {
    expect(
      UpdateCardSchema.safeParse({
        intervalType: 'weekly',
        weekdayOverride: 3,
      }).success,
    ).toBe(true);
  });

  it('should reject weekdayOverride with non-weekly intervalType', () => {
    expect(
      UpdateCardSchema.safeParse({
        intervalType: 'monthly',
        weekdayOverride: 2,
      }).success,
    ).toBe(false);
  });

  it('should allow weekdayOverride without intervalType (partial update)', () => {
    expect(UpdateCardSchema.safeParse({ weekdayOverride: 5 }).success).toBe(
      true,
    );
  });

  // -----------------------------------------------------------
  // Field constraints (same as create)
  // -----------------------------------------------------------

  it('should reject empty title', () => {
    expect(UpdateCardSchema.safeParse({ title: '' }).success).toBe(false);
  });

  it('should reject title longer than 255 characters', () => {
    expect(UpdateCardSchema.safeParse({ title: 'X'.repeat(256) }).success).toBe(
      false,
    );
  });

  it('should reject invalid cardRole', () => {
    expect(UpdateCardSchema.safeParse({ cardRole: 'engineer' }).success).toBe(
      false,
    );
  });

  it('should reject invalid intervalType', () => {
    expect(UpdateCardSchema.safeParse({ intervalType: 'hourly' }).success).toBe(
      false,
    );
  });
});
