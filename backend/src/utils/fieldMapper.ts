/**
 * Field Mapper Utility
 * Converts between database snake_case and API camelCase
 */
import lodash from 'lodash';

// Wrap lodash methods to avoid unbound method issues
const camelCase = (str: string): string => lodash.camelCase(str);
const snakeCase = (str: string): string => lodash.snakeCase(str);

/**
 * Check if key should be converted to boolean
 * EXCEPTION: is_active uses multi-state values (0=inactive, 1=active, 3=archived, 4=deleted)
 */
function shouldConvertToBoolean(key: string): boolean {
  if (key === 'is_active') return false;
  return key.startsWith('is_') || key.startsWith('has_') || key === 'active';
}

/**
 * Transform a single value from DB format to API format
 */
function transformDbValue(
  key: string,
  value: unknown,
  dbToApiFn: (obj: Record<string, unknown>) => unknown,
): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value === null) return null;
  if (shouldConvertToBoolean(key)) return Boolean(value);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return dbToApiFn(value as Record<string, unknown>);
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) =>
      item != null && typeof item === 'object' ? dbToApiFn(item as Record<string, unknown>) : item,
    );
  }
  return value;
}

export const fieldMapper = {
  /**
   * Convert database object (snake_case) to API object (camelCase)
   */
  dbToApi(dbObject: Record<string, unknown> | null | undefined): unknown {
    if (dbObject == null) return dbObject;

    const result: Record<string, unknown> = {};
    const boundDbToApi = this.dbToApi.bind(this);

    for (const [key, value] of Object.entries(dbObject)) {
      const camelKey = camelCase(key);
      // eslint-disable-next-line security/detect-object-injection -- camelKey is derived from safe camelCase() transformation, not user input
      result[camelKey] = transformDbValue(key, value, boundDbToApi);
    }

    return result;
  },

  /**
   * Convert API object (camelCase) to database object (snake_case)
   */
  apiToDb(apiObject: Record<string, unknown> | null | undefined): unknown {
    if (apiObject == null) return apiObject;

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(apiObject)) {
      const snakeKey = snakeCase(key);

      // Handle Date strings
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        // eslint-disable-next-line security/detect-object-injection -- snakeKey is derived from safe snakeCase() transformation, not user input
        result[snakeKey] = value;
      }
      // Handle null values
      else if (value === null) {
        // eslint-disable-next-line security/detect-object-injection -- snakeKey is derived from safe snakeCase() transformation, not user input
        result[snakeKey] = null;
      }
      // Recursively handle nested objects
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        // eslint-disable-next-line security/detect-object-injection -- snakeKey is derived from safe snakeCase() transformation, not user input
        result[snakeKey] = this.apiToDb(value as Record<string, unknown>);
      }
      // Handle arrays
      else if (Array.isArray(value)) {
        // eslint-disable-next-line security/detect-object-injection -- snakeKey is derived from safe snakeCase() transformation, not user input
        result[snakeKey] = value.map((item: unknown) =>
          item != null && typeof item === 'object' ?
            this.apiToDb(item as Record<string, unknown>)
          : item,
        );
      } else {
        // eslint-disable-next-line security/detect-object-injection -- snakeKey is derived from safe snakeCase() transformation, not user input
        result[snakeKey] = value;
      }
    }

    return result;
  },

  /**
   * Map specific field names (for exceptions to the camelCase rule)
   */
  mapField(field: string, direction: 'toApi' | 'toDb'): string {
    const customMappings: Record<string, string> = {
      // Add any custom mappings here if needed
      // e.g., 'db_field': 'apiField'
    };

    if (direction === 'toApi') {
      // eslint-disable-next-line security/detect-object-injection -- field is a controlled parameter from internal code, not user input
      return customMappings[field] ?? camelCase(field);
    } else {
      // Reverse lookup for toDb
      const reverseMapping = Object.entries(customMappings).find(
        ([_dbField, apiField]: [string, string]) => apiField === field,
      );
      return reverseMapping ? reverseMapping[0] : snakeCase(field);
    }
  },
};
