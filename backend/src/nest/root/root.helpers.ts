/**
 * Root Module — Pure Helper Functions
 *
 * Stateless mappers, validators, and builders.
 * No DI, no DB calls, no side effects.
 */
import { ConflictException } from '@nestjs/common';

import type {
  AdminLog,
  AdminUser,
  DbRootLogRow,
  DbUserRow,
  RootUser,
  UpdateUserRequest,
} from './root.types.js';

// ============================================================================
// ERROR CODES (shared across all root sub-services)
// ============================================================================

export const ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  DUPLICATE_USERNAME: 'DUPLICATE_USERNAME',
  DUPLICATE_EMPLOYEE_NUMBER: 'DUPLICATE_EMPLOYEE_NUMBER',
  SELF_DELETE: 'SELF_DELETE',
  LAST_ROOT_USER: 'LAST_ROOT_USER',
  INSUFFICIENT_ROOT_USERS: 'INSUFFICIENT_ROOT_USERS',
  ALREADY_SCHEDULED: 'ALREADY_SCHEDULED',
} as const;

// ============================================================================
// MAPPERS
// ============================================================================

/**
 * Map database user row to AdminUser API response
 */
export function mapDbUserToAdminUser(
  admin: DbUserRow & {
    tenant_name?: string;
    profile_picture?: string | null;
  },
): AdminUser {
  const result: AdminUser = {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    firstName: admin.first_name ?? '',
    lastName: admin.last_name ?? '',
    isActive: admin.is_active,
    tenantId: admin.tenant_id,
    createdAt: admin.created_at,
    updatedAt: admin.updated_at,
  };

  if (admin.notes !== null) result.notes = admin.notes;
  if (admin.position !== null) result.position = admin.position;
  if (admin.employee_number !== '')
    result.employeeNumber = admin.employee_number;
  if (admin.profile_picture !== undefined)
    result.profilePicture = admin.profile_picture;
  if (admin.tenant_name !== undefined) result.tenantName = admin.tenant_name;
  if (admin.last_login !== null && admin.last_login !== undefined)
    result.lastLogin = admin.last_login;

  return result;
}

/**
 * Map database user row to RootUser API response
 */
export function mapDbUserToRootUser(user: DbUserRow): RootUser {
  const result: RootUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.first_name ?? '',
    lastName: user.last_name ?? '',
    isActive: user.is_active,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };

  if (user.position !== null) result.position = user.position;
  if (user.notes !== null) result.notes = user.notes;
  if (user.employee_number !== '') result.employeeNumber = user.employee_number;
  if (user.department_id !== null && user.department_id !== undefined)
    result.departmentId = user.department_id;
  if (user.employee_id !== null) result.employeeId = user.employee_id;

  return result;
}

/**
 * Map database log row to AdminLog API response
 */
export function mapDbLogToAdminLog(log: DbRootLogRow): AdminLog {
  const result: AdminLog = {
    id: log.id,
    userId: log.user_id,
    action: log.action,
    entityType: log.entity_type ?? '',
    createdAt: log.created_at,
  };

  if (log.entity_id !== null) result.entityId = log.entity_id;
  if (log.details !== null) result.description = log.details;
  if (log.ip_address !== null) result.ipAddress = log.ip_address;
  if (log.user_agent !== null) result.userAgent = log.user_agent;

  return result;
}

// ============================================================================
// QUERY BUILDERS
// ============================================================================

/**
 * Build user update fields for dynamic UPDATE queries
 */
export function buildUserUpdateFields(data: UpdateUserRequest): {
  fields: string[];
  values: unknown[];
  nextIndex: number;
} {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.email !== undefined) {
    const normalizedEmail = data.email.toLowerCase().trim();
    fields.push(`email = $${paramIndex++}`, `username = $${paramIndex++}`);
    values.push(normalizedEmail, normalizedEmail);
  }
  if (data.firstName !== undefined) {
    fields.push(`first_name = $${paramIndex++}`);
    values.push(data.firstName);
  }
  if (data.lastName !== undefined) {
    fields.push(`last_name = $${paramIndex++}`);
    values.push(data.lastName);
  }
  if (data.position !== undefined) {
    fields.push(`position = $${paramIndex++}`);
    values.push(data.position);
  }
  if (data.notes !== undefined) {
    fields.push(`notes = $${paramIndex++}`);
    values.push(data.notes);
  }
  if (data.employeeNumber !== undefined) {
    fields.push(`employee_number = $${paramIndex++}`);
    values.push(data.employeeNumber);
  }
  if (data.isActive !== undefined) {
    fields.push(`is_active = $${paramIndex++}`);
    values.push(data.isActive);
  }
  if (data.role !== undefined) {
    fields.push(`role = $${paramIndex++}`);
    values.push(data.role);
  }

  return { fields, values, nextIndex: paramIndex };
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Type guard for PostgreSQL unique constraint violation (23505)
 */
export function isPgUniqueViolation(
  error: unknown,
): error is { code: string; message: string } {
  if (typeof error !== 'object' || error === null) return false;
  if (!('code' in error) || !('message' in error)) return false;
  return (error as Record<string, unknown>)['code'] === '23505';
}

/**
 * Handle database duplicate entry errors
 */
export function handleDuplicateEntryError(error: unknown): void {
  if (!isPgUniqueViolation(error)) return;

  if (error.message.includes('employee_number')) {
    throw new ConflictException({
      code: ERROR_CODES.DUPLICATE_EMPLOYEE_NUMBER,
      message: 'Employee number already exists',
    });
  }
  if (error.message.includes('email')) {
    throw new ConflictException({
      code: ERROR_CODES.DUPLICATE_EMAIL,
      message: 'Email already exists',
    });
  }
  if (error.message.includes('username')) {
    throw new ConflictException({
      code: ERROR_CODES.DUPLICATE_USERNAME,
      message: 'Username already exists',
    });
  }
}
