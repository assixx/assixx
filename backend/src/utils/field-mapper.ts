/**
 * Field Mapper Utility
 *
 * Single source of truth for snake_case (DB) to camelCase (API) conversion.
 *
 * Features:
 * - Recursive: handles nested objects and arrays
 * - Boolean conversion: is_* / has_* fields to Boolean (except is_active)
 * - Date handling: Date objects to ISO string
 * - Null-safe values: null stays null
 */
import lodash from 'lodash';

const camelCase = (str: string): string => lodash.camelCase(str);
const snakeCase = (str: string): string => lodash.snakeCase(str);

/**
 * Check if a DB key should be converted to boolean.
 * EXCEPTION: is_active uses multi-state values (0=inactive, 1=active, 3=archived, 4=deleted)
 */
function shouldConvertToBoolean(key: string): boolean {
  if (key === 'is_active') return false;
  return key.startsWith('is_') || key.startsWith('has_') || key === 'active';
}

/**
 * Transform a single value from DB format to API format
 */
function transformDbValue(key: string, value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value === null) return null;
  if (shouldConvertToBoolean(key)) return Boolean(value);
  if (typeof value === 'object' && !Array.isArray(value)) {
    return dbToApi(value as Record<string, unknown>);
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) =>
      item != null && typeof item === 'object' && !Array.isArray(item) ?
        dbToApi(item as Record<string, unknown>)
      : item,
    );
  }
  return value;
}

/**
 * Convert database object (snake_case) to API object (camelCase)
 *
 * Recursively converts nested objects and arrays.
 * Converts is_* / has_* fields to boolean (except is_active).
 * Converts Date values to ISO strings.
 */
export function dbToApi(dbObject: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(dbObject)) {
    result[camelCase(key)] = transformDbValue(key, value);
  }

  return result;
}

/**
 * Convert API object (camelCase) to database object (snake_case)
 *
 * Recursively converts nested objects and arrays.
 */
export function apiToDb(apiObject: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(apiObject)) {
    const snakeKey: string = snakeCase(key);

    if (value === null) {
      result[snakeKey] = null;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      result[snakeKey] = apiToDb(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[snakeKey] = value.map((item: unknown) =>
        item != null && typeof item === 'object' && !Array.isArray(item) ?
          apiToDb(item as Record<string, unknown>)
        : item,
      );
    } else {
      result[snakeKey] = value;
    }
  }

  return result;
}
