/**
 * DTO validation tests for TPM Card Categories (cardCategories feature)
 *
 * Tests: TpmCardCategorySchema, cardCategories in CreateCardSchema/UpdateCardSchema,
 *        cardCategory filter in ListCardsQuerySchema
 * Pattern: ADR-018 Phase 8 — Zod .safeParse() assertions.
 */
import { describe, expect, it } from 'vitest';

import { TpmCardCategorySchema } from './common.dto.js';
import { CreateCardSchema } from './create-card.dto.js';
import { ListCardsQuerySchema } from './list-cards-query.dto.js';
import { UpdateCardSchema } from './update-card.dto.js';

const VALID_UUID = '019c9547-9fc0-771a-b022-3767e233d6f3';

// =============================================================
// TpmCardCategorySchema (Enum)
// =============================================================

describe('TpmCardCategorySchema', () => {
  it.each(['reinigung', 'wartung', 'inspektion'] as const)('should accept category=%s', (value) => {
    expect(TpmCardCategorySchema.safeParse(value).success).toBe(true);
  });

  it('should reject invalid category', () => {
    expect(TpmCardCategorySchema.safeParse('cleaning').success).toBe(false);
  });

  it('should reject empty string', () => {
    expect(TpmCardCategorySchema.safeParse('').success).toBe(false);
  });

  it('should reject number', () => {
    expect(TpmCardCategorySchema.safeParse(1).success).toBe(false);
  });

  it('should reject null', () => {
    expect(TpmCardCategorySchema.safeParse(null).success).toBe(false);
  });

  it('should reject uppercase variant', () => {
    expect(TpmCardCategorySchema.safeParse('Reinigung').success).toBe(false);
  });
});

// =============================================================
// CreateCardSchema — cardCategories field
// =============================================================

describe('CreateCardSchema — cardCategories', () => {
  const validBase = {
    planUuid: VALID_UUID,
    cardRole: 'operator' as const,
    intervalType: 'weekly' as const,
    title: 'Ölstand prüfen',
  };

  it('should default to empty array when omitted', () => {
    const result = CreateCardSchema.parse(validBase);
    expect(result.cardCategories).toEqual([]);
  });

  it('should accept empty array', () => {
    const result = CreateCardSchema.parse({ ...validBase, cardCategories: [] });
    expect(result.cardCategories).toEqual([]);
  });

  it('should accept single category', () => {
    const result = CreateCardSchema.parse({
      ...validBase,
      cardCategories: ['reinigung'],
    });
    expect(result.cardCategories).toEqual(['reinigung']);
  });

  it('should reject more than 1 category', () => {
    expect(
      CreateCardSchema.safeParse({
        ...validBase,
        cardCategories: ['reinigung', 'wartung'],
      }).success,
    ).toBe(false);
  });

  it('should reject invalid category in array', () => {
    expect(
      CreateCardSchema.safeParse({
        ...validBase,
        cardCategories: ['invalid'],
      }).success,
    ).toBe(false);
  });

  it('should reject non-array value', () => {
    expect(
      CreateCardSchema.safeParse({
        ...validBase,
        cardCategories: 'reinigung',
      }).success,
    ).toBe(false);
  });
});

// =============================================================
// UpdateCardSchema — cardCategories field
// =============================================================

describe('UpdateCardSchema — cardCategories', () => {
  it('should accept update without cardCategories (optional)', () => {
    const result = UpdateCardSchema.parse({ title: 'Neuer Titel' });
    expect(result.cardCategories).toBeUndefined();
  });

  it('should accept empty array (clear categories)', () => {
    const result = UpdateCardSchema.parse({ cardCategories: [] });
    expect(result.cardCategories).toEqual([]);
  });

  it('should accept single category', () => {
    const result = UpdateCardSchema.parse({ cardCategories: ['wartung'] });
    expect(result.cardCategories).toEqual(['wartung']);
  });

  it('should reject more than 1 category', () => {
    expect(
      UpdateCardSchema.safeParse({
        cardCategories: ['reinigung', 'wartung'],
      }).success,
    ).toBe(false);
  });

  it('should reject invalid category in array', () => {
    expect(
      UpdateCardSchema.safeParse({
        cardCategories: ['cleaning'],
      }).success,
    ).toBe(false);
  });
});

// =============================================================
// ListCardsQuerySchema — cardCategory filter
// =============================================================

describe('ListCardsQuerySchema — cardCategory', () => {
  it('should accept query without cardCategory', () => {
    const result = ListCardsQuerySchema.parse({});
    expect(result.cardCategory).toBeUndefined();
  });

  it.each(['reinigung', 'wartung', 'inspektion'] as const)(
    'should accept cardCategory=%s',
    (cardCategory) => {
      expect(ListCardsQuerySchema.safeParse({ cardCategory }).success).toBe(true);
    },
  );

  it('should reject invalid cardCategory', () => {
    expect(ListCardsQuerySchema.safeParse({ cardCategory: 'cleaning' }).success).toBe(false);
  });
});
