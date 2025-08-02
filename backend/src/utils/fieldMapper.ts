/**
 * Field Mapper Utility
 * Converts between database snake_case and API camelCase
 */

import lodash from "lodash";
const { camelCase, snakeCase } = lodash;

export const fieldMapper = {
  /**
   * Convert database object (snake_case) to API object (camelCase)
   */
  dbToApi<T>(dbObject: Record<string, unknown>): T {
    if (!dbObject) return dbObject as T;

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(dbObject)) {
      const camelKey = camelCase(key);

      // Handle Date objects
      if (value instanceof Date) {
        result[camelKey] = value.toISOString();
      }
      // Handle null values
      else if (value === null) {
        result[camelKey] = null;
      }
      // Handle boolean conversions (MySQL returns 0/1)
      else if (
        key.startsWith("is_") ||
        key.startsWith("has_") ||
        key === "active"
      ) {
        result[camelKey] = Boolean(value);
      }
      // Recursively handle nested objects
      else if (value && typeof value === "object" && !Array.isArray(value)) {
        result[camelKey] = this.dbToApi(value as Record<string, unknown>);
      }
      // Handle arrays
      else if (Array.isArray(value)) {
        result[camelKey] = value.map((item) =>
          item && typeof item === "object"
            ? this.dbToApi(item as Record<string, unknown>)
            : item,
        );
      } else {
        result[camelKey] = value;
      }
    }

    return result as T;
  },

  /**
   * Convert API object (camelCase) to database object (snake_case)
   */
  apiToDb<T>(apiObject: Record<string, unknown>): T {
    if (!apiObject) return apiObject as T;

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(apiObject)) {
      const snakeKey = snakeCase(key);

      // Handle Date strings
      if (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
      ) {
        result[snakeKey] = value;
      }
      // Handle null values
      else if (value === null) {
        result[snakeKey] = null;
      }
      // Recursively handle nested objects
      else if (value && typeof value === "object" && !Array.isArray(value)) {
        result[snakeKey] = this.apiToDb(value as Record<string, unknown>);
      }
      // Handle arrays
      else if (Array.isArray(value)) {
        result[snakeKey] = value.map((item) =>
          item && typeof item === "object"
            ? this.apiToDb(item as Record<string, unknown>)
            : item,
        );
      } else {
        result[snakeKey] = value;
      }
    }

    return result as T;
  },

  /**
   * Map specific field names (for exceptions to the camelCase rule)
   */
  mapField(field: string, direction: "toApi" | "toDb"): string {
    const customMappings: Record<string, string> = {
      // Add any custom mappings here if needed
      // e.g., 'db_field': 'apiField'
    };

    if (direction === "toApi") {
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
