import lodash from 'lodash';

// Use arrow functions to avoid unbound method issues
const camelCase = (str: string): string => lodash.camelCase(str);
const mapKeys = (
  obj: Record<string, unknown>,
  fn: (value: unknown, key: string) => string,
): Record<string, unknown> => lodash.mapKeys(obj, fn);
const snakeCase = (str: string): string => lodash.snakeCase(str);

/**
 * Convert database object to API format (snake_case to camelCase)
 * @param dbObject - Object from database with snake_case keys
 * @returns Object with camelCase keys for API
 */
export const dbToApi = (dbObject: Record<string, unknown>): Record<string, unknown> => {
  return mapKeys(dbObject, (_value: unknown, key: string) => camelCase(key));
};

/**
 * Convert API object to database format (camelCase to snake_case)
 * @param apiObject - Object from API with camelCase keys
 * @returns Object with snake_case keys for database
 */
export const apiToDb = (apiObject: Record<string, unknown>): Record<string, unknown> => {
  return mapKeys(apiObject, (_value: unknown, key: string) => snakeCase(key));
};

/**
 * Convert database calendar event to API format
 */
export function dbToApiEvent(dbEvent: Record<string, unknown>): Record<string, unknown> {
  const apiEvent = dbToApi(dbEvent);

  // Map specific calendar fields
  if (dbEvent.start_date != null) {
    apiEvent.startTime = dbEvent.start_date;
  }
  if (dbEvent.end_date != null) {
    apiEvent.endTime = dbEvent.end_date;
  }
  if (dbEvent.reminder_minutes !== undefined) {
    apiEvent.reminderMinutes = dbEvent.reminder_minutes;
  }
  if (dbEvent.created_by !== undefined) {
    apiEvent.createdBy = dbEvent.created_by;
  }
  if (dbEvent.org_level !== undefined) {
    apiEvent.orgLevel = dbEvent.org_level;
  }
  if (dbEvent.org_id !== undefined) {
    apiEvent.orgId = dbEvent.org_id;
  }

  // Remove redundant fields
  delete apiEvent.startDate;
  delete apiEvent.endDate;
  delete apiEvent.reminderTime;

  return apiEvent;
}

// Example Usage:
// const userFromDb = { first_name: 'Max', created_at: '2024-01-01' };
// const userForApi = dbToApi(userFromDb); // { firstName: 'Max', createdAt: '2024-01-01' }
//
// const userFromApi = { firstName: 'Max', createdAt: '2024-01-01' };
// const userForDb = apiToDb(userFromApi); // { first_name: 'Max', created_at: '2024-01-01' }
