// TypeScript Utility Functions for Type Safety

import { User, DatabaseUser } from '../types/models';

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
    role: dbUser.role as User['role'],
    tenantId: dbUser.tenant_id,
    departmentId: dbUser.department_id,
    isActive: dbUser.is_active,
    isArchived: dbUser.is_archived,
    profilePicture: dbUser.profile_picture,
    phoneNumber: dbUser.phone_number,
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
  error?: string
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
export function snakeToCamel<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => snakeToCamel(item)) as any;
  }

  if (typeof obj !== 'object' || obj instanceof Date) {
    return obj;
  }

  const converted: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const camelKey = snakeToCamelString(key);
      converted[camelKey] = snakeToCamel(obj[key]);
    }
  }
  return converted;
}

/**
 * Convert object keys from camelCase to snake_case
 */
export function camelToSnake<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => camelToSnake(item)) as any;
  }

  if (typeof obj !== 'object' || obj instanceof Date) {
    return obj;
  }

  const converted: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const snakeKey = camelToSnakeString(key);
      converted[snakeKey] = camelToSnake(obj[key]);
    }
  }
  return converted;
}
