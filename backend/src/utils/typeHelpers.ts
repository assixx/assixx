// TypeScript Utility Functions for Type Safety
import { DatabaseUser, User } from '../types/models.js';

/**
 * Converts database user format to application user format
 * UPDATED: isArchived removed, using isActive status (2025-12-02)
 */
export function mapDatabaseUserToUser(dbUser: DatabaseUser): User {
  return {
    id: dbUser.id,
    username: dbUser.username,
    email: dbUser.email,
    firstName: dbUser.first_name,
    lastName: dbUser.last_name,
    role: dbUser.role,
    tenant_id: dbUser.tenant_id,
    departmentId: dbUser.department_id,
    isActive: dbUser.is_active, // Status: 0=inactive, 1=active, 3=archived, 4=deleted
    profilePicture: dbUser.profile_picture,
    phoneNumber: dbUser.phone_number,
    landline: dbUser.landline,
    employeeNumber: dbUser.employee_number,
    position: dbUser.position,
    hireDate: dbUser.hire_date,
    birthDate: dbUser.birth_date,
    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at,
  };
}

/**
 * Type guard to check if a value is a valid user role
 */
export function isValidUserRole(role: string): role is User['role'] {
  return ['admin', 'employee', 'root'].includes(role);
}

/**
 * Safe JSON parse with type checking
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Creates a type-safe API response
 */
export function createApiResponse<T>(
  success: boolean,
  data?: T,
  error?: string,
): {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
} {
  return {
    success,
    ...(data !== undefined && { data }),
    ...(error != null && error !== '' && { error, message: error }),
  };
}

/**
 * Convert snake_case string to camelCase
 */
export function snakeToCamelString(str: string): string {
  return str.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase());
}

/**
 * Convert camelCase string to snake_case
 */
export function camelToSnakeString(str: string): string {
  return str.replace(/[A-Z]/g, (letter: string) => `_${letter.toLowerCase()}`);
}

/**
 * Convert object keys from snake_case to camelCase
 */
export function snakeToCamel(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item: unknown) => snakeToCamel(item));
  }

  if (typeof obj !== 'object' || obj instanceof Date) {
    return obj;
  }

  const converted: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = snakeToCamelString(key);
      // ESLint disable needed: camelKey is derived from object's own properties (checked with hasOwnProperty)
      // eslint-disable-next-line security/detect-object-injection
      converted[camelKey] = snakeToCamel((obj as Record<string, unknown>)[key]);
    }
  }
  return converted;
}

/**
 * Convert object keys from camelCase to snake_case
 */
export function camelToSnake(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item: unknown) => camelToSnake(item));
  }

  if (typeof obj !== 'object' || obj instanceof Date) {
    return obj;
  }

  const converted: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const snakeKey = camelToSnakeString(key);
      // ESLint disable needed: snakeKey is derived from object's own properties (checked with hasOwnProperty)
      // eslint-disable-next-line security/detect-object-injection
      converted[snakeKey] = camelToSnake((obj as Record<string, unknown>)[key]);
    }
  }
  return converted;
}

/**
 * Normalize database boolean values to JavaScript boolean
 * PostgreSQL/databases return 0/1 for boolean fields, this converts them properly
 */
export function normalizeDbBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    return value === '1' || value.toLowerCase() === 'true';
  }

  return false;
}
