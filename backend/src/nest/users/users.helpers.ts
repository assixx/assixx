/**
 * Users Helpers
 *
 * Pure functions for user data transformation and query building.
 * No DI, no side effects, no database calls.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';

import { dbToApi } from '../../utils/field-mapper.js';
import type { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import type { SafeUserResponse, UserDepartmentRow, UserRow, UserTeamRow } from './users.types.js';

/**
 * Sort field mapping: camelCase API field → snake_case DB column
 * Single source of truth for both validation and mapping (prevents SQL injection)
 */
const SORT_FIELD_MAP: Record<string, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  email: 'email',
  createdAt: 'created_at',
  lastLogin: 'last_login',
};

/**
 * Convert DB row to safe API response (camelCase, without password)
 * Uses dbToApi() for snake_case → camelCase transformation
 */
export function toSafeUserResponse(user: UserRow): SafeUserResponse {
  const { password, ...safeUser } = user;
  void password;
  return dbToApi(safeUser as unknown as Record<string, unknown>) as unknown as SafeUserResponse;
}

/**
 * Add department info to response
 */
export function addDepartmentInfo(
  response: SafeUserResponse,
  departments: UserDepartmentRow[],
): void {
  response.departmentIds = departments.map((d: UserDepartmentRow) => d.department_id);
  response.departmentNames = departments.map((d: UserDepartmentRow) => d.department_name);
}

/**
 * Add team info to response
 * INHERITANCE-FIX: Includes department and area info from team chain
 */
export function addTeamInfo(response: SafeUserResponse, teams: UserTeamRow[]): void {
  response.teamIds = teams.map((t: UserTeamRow) => t.team_id);
  response.teamNames = teams.map((t: UserTeamRow) => t.team_name);

  // INHERITANCE-FIX: Add inherited department/area from first (primary) team
  const primaryTeam = teams[0];
  if (primaryTeam !== undefined) {
    response.teamDepartmentId = primaryTeam.team_department_id;
    response.teamDepartmentName = primaryTeam.team_department_name;
    response.teamAreaId = primaryTeam.team_area_id;
    response.teamAreaName = primaryTeam.team_area_name;
  }
}

/**
 * Map API sort field to database column
 * Falls back to created_at for invalid fields (prevents SQL injection)
 */
export function mapSortField(sortBy: string): string {
  return SORT_FIELD_MAP[sortBy] ?? 'created_at';
}

/**
 * Check if error is a PostgreSQL unique constraint violation for a specific field
 */
export function isUniqueConstraintViolation(error: unknown, fieldName: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const pgError = error as { code?: string; constraint?: string };
  // PostgreSQL unique violation code is 23505
  if (pgError.code !== '23505') return false;
  // Check if constraint name contains the field name
  return pgError.constraint?.toLowerCase().includes(fieldName.toLowerCase()) ?? false;
}

/**
 * Build update fields and params from DTO data
 * NOTE: Availability fields removed - now managed via user_availability table
 */
export function buildUpdateFields(
  data: Record<string, unknown>,
  hasFullAccess: boolean | undefined,
): { updates: string[]; params: unknown[]; paramIndex: number } {
  // Availability fields removed - now in user_availability table
  const fieldMap: Record<string, string> = {
    email: 'email',
    firstName: 'first_name',
    lastName: 'last_name',
    role: 'role',
    position: 'position',
    phone: 'phone',
    address: 'address',
    employeeNumber: 'employee_number',
    dateOfBirth: 'date_of_birth',
  };

  const updates: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];
  let paramIndex: number = 1;

  for (const [dtoField, dbColumn] of Object.entries(fieldMap)) {
    // Safe: dtoField comes from hardcoded fieldMap keys, not user input

    const value = data[dtoField];
    if (value !== undefined) {
      updates.push(`${dbColumn} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }
  }

  if (data['isActive'] !== undefined) {
    updates.push(`is_active = $${paramIndex}`);
    // isActive is now a number (0, 1, 3) - pass through directly
    params.push(data['isActive']);
    paramIndex++;
  }

  if (hasFullAccess !== undefined) {
    updates.push(`has_full_access = $${paramIndex}`);
    params.push(hasFullAccess ? 1 : 0);
    paramIndex++;
  }

  return { updates, params, paramIndex };
}

/**
 * Build WHERE clause and params for user list query
 * Always excludes soft-deleted users (is_active = 4) unless specific isActive filter is provided
 */
export function buildUserListWhereClause(
  tenantId: number,
  query: ListUsersQueryDto,
): { whereClause: string; params: unknown[]; paramIndex: number } {
  const conditions: string[] = ['tenant_id = $1'];
  const params: unknown[] = [tenantId];
  let paramIndex: number = 2;

  if (query.role !== undefined) {
    conditions.push(`role = $${paramIndex}`);
    params.push(query.role);
    paramIndex++;
  } else {
    // Default: exclude dummy users from employee/user lists
    conditions.push("role != 'dummy'");
  }

  if (query.isActive !== undefined) {
    // Explicit isActive filter - use exactly what was requested
    conditions.push(`is_active = $${paramIndex}`);
    params.push(query.isActive);
    paramIndex++;
  } else {
    // Default: exclude soft-deleted users (is_active = 4)
    conditions.push(`is_active != ${IS_ACTIVE.DELETED}`);
  }

  if (query.position !== undefined && query.position !== '') {
    conditions.push(`position = $${paramIndex}`);
    params.push(query.position);
    paramIndex++;
  }

  if (query.search !== undefined && query.search !== '') {
    conditions.push(
      `(first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`,
    );
    params.push(`%${query.search}%`);
    paramIndex++;
  }

  return { whereClause: conditions.join(' AND '), params, paramIndex };
}
