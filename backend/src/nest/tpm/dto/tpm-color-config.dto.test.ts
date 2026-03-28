/**
 * DTO validation tests for TPM Color Config schemas
 *
 * Tests: UpdateColorConfigSchema, UpdateIntervalColorConfigSchema,
 *        UpdateCategoryColorConfigSchema
 * Pattern: ADR-018 Phase 8 — Zod .safeParse() assertions.
 */
import { describe, expect, it } from 'vitest';

import { UpdateCategoryColorConfigSchema } from './update-category-color-config.dto.js';
import { UpdateColorConfigSchema } from './update-color-config.dto.js';
import { UpdateIntervalColorConfigSchema } from './update-interval-color-config.dto.js';

// =============================================================
// UpdateColorConfigSchema
// =============================================================

describe('UpdateColorConfigSchema', () => {
  const valid = {
    statusKey: 'green' as const,
    colorHex: '#22c55e',
    label: 'Erledigt',
  };

  it('should accept valid payload', () => {
    expect(UpdateColorConfigSchema.safeParse(valid).success).toBe(true);
  });

  it.each(['green', 'red', 'yellow', 'overdue'] as const)(
    'should accept statusKey=%s',
    (statusKey) => {
      expect(UpdateColorConfigSchema.safeParse({ ...valid, statusKey }).success).toBe(true);
    },
  );

  it('should reject invalid statusKey', () => {
    expect(UpdateColorConfigSchema.safeParse({ ...valid, statusKey: 'blue' }).success).toBe(false);
  });

  it('should reject invalid hex color', () => {
    expect(UpdateColorConfigSchema.safeParse({ ...valid, colorHex: 'red' }).success).toBe(false);
  });

  it('should reject empty label', () => {
    expect(UpdateColorConfigSchema.safeParse({ ...valid, label: '' }).success).toBe(false);
  });

  it('should reject label longer than 50 chars', () => {
    expect(UpdateColorConfigSchema.safeParse({ ...valid, label: 'A'.repeat(51) }).success).toBe(
      false,
    );
  });

  it('should trim whitespace from colorHex', () => {
    const result = UpdateColorConfigSchema.parse({
      ...valid,
      colorHex: '  #aabbcc  ',
    });
    expect(result.colorHex).toBe('#aabbcc');
  });

  it('should trim whitespace from label', () => {
    const result = UpdateColorConfigSchema.parse({
      ...valid,
      label: '  Erledigt  ',
    });
    expect(result.label).toBe('Erledigt');
  });
});

// =============================================================
// UpdateIntervalColorConfigSchema
// =============================================================

describe('UpdateIntervalColorConfigSchema', () => {
  const valid = {
    intervalKey: 'daily' as const,
    colorHex: '#4CAF50',
    label: 'Täglich',
  };

  // -----------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------

  it('should accept valid payload without includeInCard', () => {
    expect(UpdateIntervalColorConfigSchema.safeParse(valid).success).toBe(true);
  });

  it('should accept valid payload with includeInCard=true', () => {
    expect(
      UpdateIntervalColorConfigSchema.safeParse({
        ...valid,
        includeInCard: true,
      }).success,
    ).toBe(true);
  });

  it('should accept valid payload with includeInCard=false', () => {
    expect(
      UpdateIntervalColorConfigSchema.safeParse({
        ...valid,
        includeInCard: false,
      }).success,
    ).toBe(true);
  });

  // -----------------------------------------------------------
  // intervalKey validation
  // -----------------------------------------------------------

  it.each(['daily', 'weekly', 'monthly', 'quarterly', 'semi_annual', 'annual', 'custom'] as const)(
    'should accept intervalKey=%s',
    (intervalKey) => {
      expect(UpdateIntervalColorConfigSchema.safeParse({ ...valid, intervalKey }).success).toBe(
        true,
      );
    },
  );

  it('should reject invalid intervalKey', () => {
    expect(
      UpdateIntervalColorConfigSchema.safeParse({
        ...valid,
        intervalKey: 'biweekly',
      }).success,
    ).toBe(false);
  });

  // -----------------------------------------------------------
  // colorHex validation
  // -----------------------------------------------------------

  it('should reject invalid hex color', () => {
    expect(
      UpdateIntervalColorConfigSchema.safeParse({
        ...valid,
        colorHex: 'not-a-color',
      }).success,
    ).toBe(false);
  });

  it('should reject 3-digit hex shorthand', () => {
    expect(UpdateIntervalColorConfigSchema.safeParse({ ...valid, colorHex: '#abc' }).success).toBe(
      false,
    );
  });

  it('should accept lowercase hex', () => {
    expect(
      UpdateIntervalColorConfigSchema.safeParse({
        ...valid,
        colorHex: '#aabbcc',
      }).success,
    ).toBe(true);
  });

  it('should accept uppercase hex', () => {
    expect(
      UpdateIntervalColorConfigSchema.safeParse({
        ...valid,
        colorHex: '#AABBCC',
      }).success,
    ).toBe(true);
  });

  // -----------------------------------------------------------
  // label validation
  // -----------------------------------------------------------

  it('should reject empty label', () => {
    expect(UpdateIntervalColorConfigSchema.safeParse({ ...valid, label: '' }).success).toBe(false);
  });

  it('should reject whitespace-only label', () => {
    expect(UpdateIntervalColorConfigSchema.safeParse({ ...valid, label: '   ' }).success).toBe(
      false,
    );
  });

  it('should reject label longer than 50 chars', () => {
    expect(
      UpdateIntervalColorConfigSchema.safeParse({
        ...valid,
        label: 'A'.repeat(51),
      }).success,
    ).toBe(false);
  });

  it('should accept label with exactly 50 chars', () => {
    expect(
      UpdateIntervalColorConfigSchema.safeParse({
        ...valid,
        label: 'A'.repeat(50),
      }).success,
    ).toBe(true);
  });

  // -----------------------------------------------------------
  // includeInCard validation
  // -----------------------------------------------------------

  it('should reject non-boolean includeInCard', () => {
    expect(
      UpdateIntervalColorConfigSchema.safeParse({
        ...valid,
        includeInCard: 'yes',
      }).success,
    ).toBe(false);
  });

  it('should not include includeInCard in result when omitted', () => {
    const result = UpdateIntervalColorConfigSchema.parse(valid);
    expect('includeInCard' in result).toBe(false);
  });

  it('should include includeInCard in result when provided', () => {
    const result = UpdateIntervalColorConfigSchema.parse({
      ...valid,
      includeInCard: true,
    });
    expect(result.includeInCard).toBe(true);
  });

  // -----------------------------------------------------------
  // Transforms (trim)
  // -----------------------------------------------------------

  it('should trim whitespace from colorHex and label', () => {
    const result = UpdateIntervalColorConfigSchema.parse({
      ...valid,
      colorHex: '  #aabbcc  ',
      label: '  Täglich  ',
    });
    expect(result.colorHex).toBe('#aabbcc');
    expect(result.label).toBe('Täglich');
  });
});

// =============================================================
// UpdateCategoryColorConfigSchema
// =============================================================

describe('UpdateCategoryColorConfigSchema', () => {
  const valid = {
    categoryKey: 'reinigung' as const,
    colorHex: '#0030b4',
    label: 'Reinigung',
  };

  // -----------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------

  it('should accept valid payload', () => {
    expect(UpdateCategoryColorConfigSchema.safeParse(valid).success).toBe(true);
  });

  // -----------------------------------------------------------
  // categoryKey validation
  // -----------------------------------------------------------

  it.each(['reinigung', 'wartung', 'inspektion'] as const)(
    'should accept categoryKey=%s',
    (categoryKey) => {
      expect(UpdateCategoryColorConfigSchema.safeParse({ ...valid, categoryKey }).success).toBe(
        true,
      );
    },
  );

  it('should reject invalid categoryKey', () => {
    expect(
      UpdateCategoryColorConfigSchema.safeParse({
        ...valid,
        categoryKey: 'cleaning',
      }).success,
    ).toBe(false);
  });

  it('should reject uppercase categoryKey', () => {
    expect(
      UpdateCategoryColorConfigSchema.safeParse({
        ...valid,
        categoryKey: 'Reinigung',
      }).success,
    ).toBe(false);
  });

  it('should reject empty categoryKey', () => {
    expect(UpdateCategoryColorConfigSchema.safeParse({ ...valid, categoryKey: '' }).success).toBe(
      false,
    );
  });

  // -----------------------------------------------------------
  // colorHex validation
  // -----------------------------------------------------------

  it('should reject invalid hex color', () => {
    expect(
      UpdateCategoryColorConfigSchema.safeParse({
        ...valid,
        colorHex: 'not-a-color',
      }).success,
    ).toBe(false);
  });

  it('should reject 3-digit hex shorthand', () => {
    expect(UpdateCategoryColorConfigSchema.safeParse({ ...valid, colorHex: '#abc' }).success).toBe(
      false,
    );
  });

  it('should accept lowercase hex', () => {
    expect(
      UpdateCategoryColorConfigSchema.safeParse({
        ...valid,
        colorHex: '#aabbcc',
      }).success,
    ).toBe(true);
  });

  it('should accept uppercase hex', () => {
    expect(
      UpdateCategoryColorConfigSchema.safeParse({
        ...valid,
        colorHex: '#AABBCC',
      }).success,
    ).toBe(true);
  });

  // -----------------------------------------------------------
  // label validation
  // -----------------------------------------------------------

  it('should reject empty label', () => {
    expect(UpdateCategoryColorConfigSchema.safeParse({ ...valid, label: '' }).success).toBe(false);
  });

  it('should reject whitespace-only label', () => {
    expect(UpdateCategoryColorConfigSchema.safeParse({ ...valid, label: '   ' }).success).toBe(
      false,
    );
  });

  it('should reject label longer than 50 chars', () => {
    expect(
      UpdateCategoryColorConfigSchema.safeParse({
        ...valid,
        label: 'A'.repeat(51),
      }).success,
    ).toBe(false);
  });

  it('should accept label with exactly 50 chars', () => {
    expect(
      UpdateCategoryColorConfigSchema.safeParse({
        ...valid,
        label: 'A'.repeat(50),
      }).success,
    ).toBe(true);
  });

  // -----------------------------------------------------------
  // Transforms (trim)
  // -----------------------------------------------------------

  it('should trim whitespace from colorHex and label', () => {
    const result = UpdateCategoryColorConfigSchema.parse({
      ...valid,
      colorHex: '  #aabbcc  ',
      label: '  Reinigung  ',
    });
    expect(result.colorHex).toBe('#aabbcc');
    expect(result.label).toBe('Reinigung');
  });
});
