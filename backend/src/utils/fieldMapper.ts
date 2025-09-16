/**
 * Field Mapper Utility
 * Converts between database snake_case and API camelCase
 */
import lodash from 'lodash';

// Wrap lodash methods to avoid unbound method issues
const camelCase = (str: string): string => lodash.camelCase(str);
const snakeCase = (str: string): string => lodash.snakeCase(str);

export const fieldMapper = {
  /**
   * Convert database object (snake_case) to API object (camelCase)
   */
  dbToApi(dbObject: Record<string, unknown> | null | undefined): unknown {
    if (dbObject == null) return dbObject;

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(dbObject)) {
      const camelKey = camelCase(key);

      // Handle Date objects
      if (value instanceof Date) {
        // eslint-disable-next-line security/detect-object-injection -- camelKey is derived from safe camelCase() transformation, not user input
        result[camelKey] = value.toISOString();
      }
      // Handle null values
      else if (value === null) {
        // eslint-disable-next-line security/detect-object-injection -- camelKey is derived from safe camelCase() transformation, not user input
        result[camelKey] = null;
      }
      // Handle boolean conversions (MySQL returns 0/1)
      else if (key.startsWith('is_') || key.startsWith('has_') || key === 'active') {
        // eslint-disable-next-line security/detect-object-injection -- camelKey is derived from safe camelCase() transformation, not user input
        result[camelKey] = Boolean(value);
      }
      // Recursively handle nested objects
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        // eslint-disable-next-line security/detect-object-injection -- camelKey is derived from safe camelCase() transformation, not user input
        result[camelKey] = this.dbToApi(value as Record<string, unknown>);
      }
      // Handle arrays
      else if (Array.isArray(value)) {
        // eslint-disable-next-line security/detect-object-injection -- camelKey is derived from safe camelCase() transformation, not user input
        result[camelKey] = value.map((item) =>
          item != null && typeof item === 'object' ?
            this.dbToApi(item as Record<string, unknown>)
          : (item as unknown),
        );
      } else {
        // eslint-disable-next-line security/detect-object-injection -- camelKey is derived from safe camelCase() transformation, not user input
        result[camelKey] = value;
      }
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
        result[snakeKey] = value.map((item) =>
          item != null && typeof item === 'object' ?
            this.apiToDb(item as Record<string, unknown>)
          : (item as unknown),
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
      return customMappings[field] || camelCase(field);
    } else {
      // Reverse lookup for toDb
      const reverseMapping = Object.entries(customMappings).find(
        ([_, apiField]) => apiField === field,
      );
      return reverseMapping ? reverseMapping[0] : snakeCase(field);
    }
  },
};

// Default export for convenience
export default fieldMapper;
