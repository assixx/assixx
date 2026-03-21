import { describe, expect, it } from 'vitest';

import {
  buildFullName,
  buildSetClause,
  parseStringAgg,
  parseStringAggNumbers,
  toIsoString,
  toIsoStringOrNull,
} from './db-helpers.js';

// =============================================================
// toIsoString
// =============================================================

describe('toIsoString', () => {
  it('should pass through string values unchanged', () => {
    expect(toIsoString('2026-03-01T10:00:00.000Z')).toBe('2026-03-01T10:00:00.000Z');
  });

  it('should convert Date to ISO string', () => {
    const date = new Date('2026-03-01T10:00:00.000Z');
    expect(toIsoString(date)).toBe('2026-03-01T10:00:00.000Z');
  });
});

// =============================================================
// toIsoStringOrNull
// =============================================================

describe('toIsoStringOrNull', () => {
  it('should return null for null input', () => {
    expect(toIsoStringOrNull(null)).toBeNull();
  });

  it('should pass through string values unchanged', () => {
    expect(toIsoStringOrNull('2026-03-01T08:00:00.000Z')).toBe('2026-03-01T08:00:00.000Z');
  });

  it('should convert Date to ISO string', () => {
    const date = new Date('2026-03-01T08:00:00.000Z');
    expect(toIsoStringOrNull(date)).toBe('2026-03-01T08:00:00.000Z');
  });
});

// =============================================================
// buildFullName
// =============================================================

describe('buildFullName', () => {
  it('should combine first and last name', () => {
    expect(buildFullName('Max', 'Müller')).toBe('Max Müller');
  });

  it('should handle null first name', () => {
    expect(buildFullName(null, 'Müller')).toBe('Müller');
  });

  it('should handle null last name', () => {
    expect(buildFullName('Max', null)).toBe('Max');
  });

  it('should handle undefined values', () => {
    expect(buildFullName(undefined, undefined)).toBe('Unknown');
  });

  it('should handle both null', () => {
    expect(buildFullName(null, null)).toBe('Unknown');
  });

  it('should handle empty strings', () => {
    expect(buildFullName('', '')).toBe('Unknown');
  });

  it('should use custom fallback', () => {
    expect(buildFullName(null, null, 'N/A')).toBe('N/A');
  });
});

// =============================================================
// parseStringAgg
// =============================================================

describe('parseStringAgg', () => {
  it('should return empty array for null', () => {
    expect(parseStringAgg(null)).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    expect(parseStringAgg('')).toEqual([]);
  });

  it('should parse comma-separated values', () => {
    expect(parseStringAgg('Alpha, Beta, Gamma')).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('should trim whitespace', () => {
    expect(parseStringAgg(' a , b , c ')).toEqual(['a', 'b', 'c']);
  });
});

// =============================================================
// parseStringAggNumbers
// =============================================================

describe('parseStringAggNumbers', () => {
  it('should return empty array for null', () => {
    expect(parseStringAggNumbers(null)).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    expect(parseStringAggNumbers('')).toEqual([]);
  });

  it('should parse comma-separated numbers', () => {
    expect(parseStringAggNumbers('1,2,3')).toEqual([1, 2, 3]);
  });

  it('should trim whitespace', () => {
    expect(parseStringAggNumbers(' 10 , 20 , 30 ')).toEqual([10, 20, 30]);
  });
});

// =============================================================
// buildSetClause
// =============================================================

describe('buildSetClause', () => {
  const mappings = [
    ['name', 'name'],
    ['baseWeekday', 'base_weekday'],
    ['notes', 'notes'],
  ] as const;

  it('should build clauses for defined fields only', () => {
    const result = buildSetClause({ name: 'Plan A', notes: 'Notiz' }, mappings);

    expect(result.setClauses).toEqual(['name = $1', 'notes = $2']);
    expect(result.params).toEqual(['Plan A', 'Notiz']);
    expect(result.nextParamIndex).toBe(3);
  });

  it('should skip undefined fields', () => {
    const result = buildSetClause({ name: 'Plan B' }, mappings);

    expect(result.setClauses).toEqual(['name = $1']);
    expect(result.params).toEqual(['Plan B']);
    expect(result.nextParamIndex).toBe(2);
  });

  it('should return empty for no matching fields', () => {
    const result = buildSetClause({ unknown: 'value' }, mappings);

    expect(result.setClauses).toEqual([]);
    expect(result.params).toEqual([]);
    expect(result.nextParamIndex).toBe(1);
  });

  it('should respect startIndex', () => {
    const result = buildSetClause({ name: 'Plan C' }, mappings, 5);

    expect(result.setClauses).toEqual(['name = $5']);
    expect(result.nextParamIndex).toBe(6);
  });

  it('should include null values (explicit set to null)', () => {
    const result = buildSetClause({ notes: null }, mappings);

    expect(result.setClauses).toEqual(['notes = $1']);
    expect(result.params).toEqual([null]);
  });
});
