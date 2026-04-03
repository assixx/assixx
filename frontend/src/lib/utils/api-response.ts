/**
 * API Response Extraction Utilities
 *
 * Shared helpers for type-safe data extraction from various API response formats.
 * Consolidates per-module copies of extractArray/extractId helpers.
 */

/** Type guard: non-null object (not array) */
export function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Extract array from API response.
 *
 * Handles these shapes (in priority order):
 * - `T[]` — direct array
 * - `{ [key]: T[] }` — named key (when `key` provided)
 * - `{ data: T[] }` — standard wrapper
 * - `{ data: { [key]: T[] } }` — nested named key
 * - `{ data: { data: T[] } }` — double-wrapped
 */
export function extractArray<T>(response: unknown, key?: string): T[] {
  if (Array.isArray(response)) return response as T[];
  if (!isNonNullObject(response)) return [];

  if (key !== undefined && Array.isArray(response[key])) {
    return response[key] as T[];
  }
  if (Array.isArray(response.data)) return response.data as T[];
  if (!isNonNullObject(response.data)) return [];
  if (key !== undefined && Array.isArray(response.data[key])) {
    return response.data[key] as T[];
  }
  if (Array.isArray(response.data.data)) return response.data.data as T[];

  return [];
}

/**
 * Extract numeric ID from API response.
 *
 * Handles: `{ id: number }`, `{ data: { id: number } }`
 */
export function extractId(result: unknown): number | null {
  if (!isNonNullObject(result)) return null;
  if (typeof result.id === 'number') return result.id;
  if (isNonNullObject(result.data) && typeof result.data.id === 'number') {
    return result.data.id;
  }
  return null;
}
