// TypeScript Utility Functions for Type Safety

import { User, DatabaseUser } from "../types/models";

/**
 * Converts database user format to application user format
 */
export function mapDatabaseUserToUser(dbUser: DatabaseUser): User {
  return {
    id: dbUser.id,
    username: dbUser.username,
    email: dbUser.email,
    firstName: dbUser.first_name,
    lastName: dbUser.last_name,
    role: dbUser.role as User["role"],
    tenant_id: dbUser.tenant_id,
    departmentId: dbUser.department_id,
    isActive: dbUser.is_active,
    isArchived: dbUser.is_archived,
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
export function isValidUserRole(role: string): role is User["role"] {
  return ["admin", "employee", "root"].includes(role);
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
) {
  return {
    success,
    ...(data !== undefined && { data }),
    ...(error && { error, message: error }),
  };
}

/**
 * Convert snake_case string to camelCase
 */
export function snakeToCamelString(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase string to snake_case
 */
export function camelToSnakeString(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert object keys from snake_case to camelCase
 */
export function snakeToCamel<T = unknown>(obj: unknown): T {
  if (obj === null || obj === undefined) {
    return obj as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => snakeToCamel(item)) as T;
  }

  if (typeof obj !== "object" || obj instanceof Date) {
    return obj as T;
  }

  const converted: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = snakeToCamelString(key);
      converted[camelKey] = snakeToCamel((obj as Record<string, unknown>)[key]);
    }
  }
  return converted as T;
}

/**
 * Convert object keys from camelCase to snake_case
 */
export function camelToSnake<T = unknown>(obj: unknown): T {
  if (obj === null || obj === undefined) {
    return obj as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => camelToSnake(item)) as T;
  }

  if (typeof obj !== "object" || obj instanceof Date) {
    return obj as T;
  }

  const converted: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const snakeKey = camelToSnakeString(key);
      converted[snakeKey] = camelToSnake((obj as Record<string, unknown>)[key]);
    }
  }
  return converted as T;
}

/**
 * Normalize MySQL boolean values to JavaScript boolean
 * MySQL returns 0/1 for boolean fields, this converts them properly
 */
export function normalizeMySQLBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    return value === "1" || value.toLowerCase() === "true";
  }

  return false;
}
