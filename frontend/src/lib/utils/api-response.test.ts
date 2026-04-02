import { describe, expect, it } from 'vitest';

import { extractArray, extractId, isNonNullObject } from './api-response';

// =============================================================================
// isNonNullObject
// =============================================================================

describe('isNonNullObject', () => {
  it('should return true for plain objects', () => {
    expect(isNonNullObject({})).toBe(true);
    expect(isNonNullObject({ key: 'value' })).toBe(true);
  });

  it('should return false for null', () => {
    expect(isNonNullObject(null)).toBe(false);
  });

  it('should return false for arrays', () => {
    expect(isNonNullObject([])).toBe(false);
    expect(isNonNullObject([1, 2, 3])).toBe(false);
  });

  it('should return false for primitives', () => {
    expect(isNonNullObject(undefined)).toBe(false);
    expect(isNonNullObject(42)).toBe(false);
    expect(isNonNullObject('string')).toBe(false);
    expect(isNonNullObject(true)).toBe(false);
  });
});

// =============================================================================
// extractArray
// =============================================================================

describe('extractArray — direct array', () => {
  it('should return the array as-is', () => {
    const input = [{ id: 1 }, { id: 2 }];
    expect(extractArray(input)).toEqual(input);
  });

  it('should return empty array for empty input array', () => {
    expect(extractArray([])).toEqual([]);
  });
});

describe('extractArray — data wrapper', () => {
  it('should unwrap { data: T[] }', () => {
    const items = [{ id: 1 }, { id: 2 }];
    expect(extractArray({ data: items })).toEqual(items);
  });

  it('should return empty array when data is not an array', () => {
    expect(extractArray({ data: 'not-array' })).toEqual([]);
    expect(extractArray({ data: null })).toEqual([]);
    expect(extractArray({ data: 42 })).toEqual([]);
  });

  it('should unwrap nested { data: { data: T[] } }', () => {
    const items = [{ id: 1 }];
    expect(extractArray({ data: { data: items } })).toEqual(items);
  });
});

describe('extractArray — key parameter', () => {
  it('should extract by named key at top level', () => {
    const admins = [{ id: 1, name: 'Admin' }];
    expect(extractArray({ admins }, 'admins')).toEqual(admins);
  });

  it('should extract by named key nested in data', () => {
    const approvals = [{ id: 1 }];
    expect(extractArray({ data: { approvals } }, 'approvals')).toEqual(approvals);
  });

  it('should fall back to data array when key not found', () => {
    const items = [{ id: 1 }];
    expect(extractArray({ data: items }, 'missing')).toEqual(items);
  });

  it('should prefer top-level key over data', () => {
    const topLevel = [{ source: 'key' }];
    const dataLevel = [{ source: 'data' }];
    expect(extractArray({ items: topLevel, data: dataLevel }, 'items')).toEqual(topLevel);
  });
});

describe('extractArray — non-object responses', () => {
  it('should return empty array for null/undefined', () => {
    expect(extractArray(null)).toEqual([]);
    expect(extractArray(undefined)).toEqual([]);
  });

  it('should return empty array for primitives', () => {
    expect(extractArray(42)).toEqual([]);
    expect(extractArray('string')).toEqual([]);
    expect(extractArray(true)).toEqual([]);
  });

  it('should return empty array for empty object', () => {
    expect(extractArray({})).toEqual([]);
  });
});

// =============================================================================
// extractId
// =============================================================================

describe('extractId', () => {
  it('should extract id from top-level { id: number }', () => {
    expect(extractId({ id: 42 })).toBe(42);
  });

  it('should extract id from nested { data: { id: number } }', () => {
    expect(extractId({ data: { id: 7 } })).toBe(7);
  });

  it('should return 0 as valid id', () => {
    expect(extractId({ id: 0 })).toBe(0);
  });

  it('should prefer top-level id over nested', () => {
    expect(extractId({ id: 1, data: { id: 2 } })).toBe(1);
  });

  it('should return null for string id', () => {
    expect(extractId({ id: 'abc' })).toBeNull();
  });

  it('should return null for missing id', () => {
    expect(extractId({})).toBeNull();
    expect(extractId({ data: {} })).toBeNull();
    expect(extractId({ data: null })).toBeNull();
  });

  it('should return null for non-objects', () => {
    expect(extractId(null)).toBeNull();
    expect(extractId(undefined)).toBeNull();
    expect(extractId(42)).toBeNull();
    expect(extractId('string')).toBeNull();
  });
});
