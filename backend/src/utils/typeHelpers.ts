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
    updatedAt: dbUser.updated_at
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
export function createApiResponse<T>(success: boolean, data?: T, error?: string) {
  return {
    success,
    ...(data !== undefined && { data }),
    ...(error && { error, message: error })
  };
}