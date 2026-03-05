/**
 * TPM Cards Helpers — Unit tests for cardCategories mapping
 *
 * Tests: mapCardRowToApi (card_categories → cardCategories),
 *        buildCardUpdateFields (cardCategories → card_categories)
 * Pattern: ADR-018 — Pure function tests, no DI, no DB.
 */
import { describe, expect, it } from 'vitest';

import type { TpmCardJoinRow } from './tpm-cards.helpers.js';
import { buildCardUpdateFields, mapCardRowToApi } from './tpm-cards.helpers.js';

/** Minimal valid row with all required fields */
function createMinimalRow(
  overrides: Partial<TpmCardJoinRow> = {},
): TpmCardJoinRow {
  return {
    id: 1,
    uuid: '019c9547-9fc0-771a-b022-3767e233d6f3',
    tenant_id: 1,
    plan_id: 1,
    asset_id: 100,
    template_id: null,
    card_code: 'B-W-001',
    card_role: 'operator',
    interval_type: 'weekly',
    interval_order: 1,
    title: 'Ölstand prüfen',
    description: null,
    location_description: null,
    location_photo_url: null,
    requires_approval: false,
    status: 'green',
    current_due_date: null,
    last_completed_at: null,
    last_completed_by: null,
    sort_order: 1,
    custom_fields: {},
    custom_interval_days: null,
    weekday_override: null,
    estimated_execution_minutes: null,
    card_categories: [],
    is_active: 1,
    created_by: 1,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

// =============================================================
// mapCardRowToApi — card_categories mapping (JS array input)
// =============================================================

describe('mapCardRowToApi — cardCategories (JS array)', () => {
  it('should map empty card_categories to empty array', () => {
    const row = createMinimalRow({ card_categories: [] });
    const result = mapCardRowToApi(row);
    expect(result.cardCategories).toEqual([]);
  });

  it('should map single category', () => {
    const row = createMinimalRow({ card_categories: ['reinigung'] });
    const result = mapCardRowToApi(row);
    expect(result.cardCategories).toEqual(['reinigung']);
  });

  it('should map multiple categories', () => {
    const row = createMinimalRow({
      card_categories: ['reinigung', 'wartung', 'inspektion'],
    });
    const result = mapCardRowToApi(row);
    expect(result.cardCategories).toEqual([
      'reinigung',
      'wartung',
      'inspektion',
    ]);
  });

  it('should preserve category order', () => {
    const row = createMinimalRow({
      card_categories: ['inspektion', 'reinigung'],
    });
    const result = mapCardRowToApi(row);
    expect(result.cardCategories).toEqual(['inspektion', 'reinigung']);
  });
});

// =============================================================
// mapCardRowToApi — cardCategories parsing (PostgreSQL string input)
// pg returns custom ENUM arrays as string literals: '{reinigung}'
// =============================================================

describe('mapCardRowToApi — parsePgCategoryArray (pg string)', () => {
  it('should parse single-value pg array string', () => {
    const row = createMinimalRow({
      card_categories: '{reinigung}' as unknown as string[],
    });
    const result = mapCardRowToApi(row);
    expect(result.cardCategories).toEqual(['reinigung']);
  });

  it('should parse multi-value pg array string', () => {
    const row = createMinimalRow({
      card_categories: '{reinigung,wartung}' as unknown as string[],
    });
    const result = mapCardRowToApi(row);
    expect(result.cardCategories).toEqual(['reinigung', 'wartung']);
  });

  it('should parse all 3 categories from pg array string', () => {
    const row = createMinimalRow({
      card_categories: '{reinigung,wartung,inspektion}' as unknown as string[],
    });
    const result = mapCardRowToApi(row);
    expect(result.cardCategories).toEqual([
      'reinigung',
      'wartung',
      'inspektion',
    ]);
  });

  it('should parse empty pg array string to empty array', () => {
    const row = createMinimalRow({
      card_categories: '{}' as unknown as string[],
    });
    const result = mapCardRowToApi(row);
    expect(result.cardCategories).toEqual([]);
  });

  it('should handle empty string as empty array', () => {
    const row = createMinimalRow({
      card_categories: '' as unknown as string[],
    });
    const result = mapCardRowToApi(row);
    expect(result.cardCategories).toEqual([]);
  });

  it('should handle quoted values in pg array string', () => {
    const row = createMinimalRow({
      card_categories: '{"reinigung","wartung"}' as unknown as string[],
    });
    const result = mapCardRowToApi(row);
    expect(result.cardCategories).toEqual(['reinigung', 'wartung']);
  });

  it('should return empty array for null/undefined input', () => {
    const row = createMinimalRow({
      card_categories: null as unknown as string[],
    });
    const result = mapCardRowToApi(row);
    expect(result.cardCategories).toEqual([]);
  });

  it('should return empty array for numeric input', () => {
    const row = createMinimalRow({
      card_categories: 42 as unknown as string[],
    });
    const result = mapCardRowToApi(row);
    expect(result.cardCategories).toEqual([]);
  });

  it('should trim whitespace around pg array values', () => {
    const row = createMinimalRow({
      card_categories: '{ reinigung , wartung }' as unknown as string[],
    });
    const result = mapCardRowToApi(row);
    expect(result.cardCategories).toEqual(['reinigung', 'wartung']);
  });
});

// =============================================================
// buildCardUpdateFields — cardCategories mapping
// =============================================================

describe('buildCardUpdateFields — cardCategories', () => {
  it('should include card_categories when cardCategories is provided', () => {
    const { setClauses, params } = buildCardUpdateFields({
      cardCategories: ['reinigung', 'wartung'],
    });
    expect(setClauses).toHaveLength(1);
    expect(setClauses[0]).toBe('card_categories = $1');
    expect(params[0]).toEqual(['reinigung', 'wartung']);
  });

  it('should include card_categories with empty array (clear)', () => {
    const { setClauses, params } = buildCardUpdateFields({
      cardCategories: [],
    });
    expect(setClauses).toHaveLength(1);
    expect(setClauses[0]).toBe('card_categories = $1');
    expect(params[0]).toEqual([]);
  });

  it('should not include card_categories when cardCategories is undefined', () => {
    const { setClauses, params } = buildCardUpdateFields({
      title: 'Neuer Titel',
    });
    const hasCategories = setClauses.some((clause: string) =>
      clause.includes('card_categories'),
    );
    expect(hasCategories).toBe(false);
    expect(params).toEqual(['Neuer Titel']);
  });

  it('should map cardCategories alongside other fields', () => {
    const { setClauses, params } = buildCardUpdateFields({
      title: 'Neuer Titel',
      cardCategories: ['inspektion'],
    });
    expect(setClauses).toHaveLength(2);
    expect(setClauses).toContain('title = $1');
    expect(setClauses).toContain('card_categories = $2');
    expect(params).toEqual(['Neuer Titel', ['inspektion']]);
  });
});
