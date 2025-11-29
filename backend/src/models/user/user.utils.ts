/**
 * User Utility Functions
 * Pure functions for data formatting, filtering, and query building
 */
import { query as executeQuery } from '../../utils/db.js';
import { generateEmployeeId, generateTempEmployeeId } from '../../utils/employeeIdGenerator.js';
import { logger } from '../../utils/logger.js';
import { SubdomainResult, UserCreateData, UserFilter } from './user.types.js';

/**
 * Generate initial employee ID for user creation
 */
export async function generateInitialEmployeeId(
  employeeId: string | undefined,
  tenantId: number,
  role: string | undefined,
): Promise<string | undefined> {
  if (employeeId != null && employeeId !== '') {
    return employeeId;
  }

  const [tenantResult] = await executeQuery<SubdomainResult[]>(
    'SELECT subdomain FROM tenants WHERE id = ?',
    [tenantId],
  );

  if (tenantResult.length > 0) {
    // subdomain is NOT NULL in schema, type system guarantees this
    const tenant = tenantResult[0];
    if (tenant === undefined) {
      return undefined;
    }
    const subdomain = tenant.subdomain;
    const { tempId } = generateTempEmployeeId(subdomain, role ?? 'employee');
    return tempId;
  }
  return undefined;
}

/**
 * Update temporary employee ID with actual ID after user creation
 */
export async function updateTemporaryEmployeeId(
  userId: number,
  tenantId: number,
  role: string | undefined,
  originalEmployeeId: string | undefined,
  finalEmployeeId: string | undefined,
): Promise<void> {
  if (
    (originalEmployeeId == null || originalEmployeeId === '') &&
    finalEmployeeId?.includes('TEMP') === true
  ) {
    const [tenantResult] = await executeQuery<SubdomainResult[]>(
      'SELECT subdomain FROM tenants WHERE id = ?',
      [tenantId],
    );

    if (tenantResult.length > 0) {
      // subdomain is NOT NULL in schema, type system guarantees this
      const tenant = tenantResult[0];
      if (tenant === undefined) {
        return;
      }
      const subdomain = tenant.subdomain;
      const newEmployeeId = generateEmployeeId(subdomain, role ?? 'employee', userId);
      await executeQuery('UPDATE users SET employee_id = ? WHERE id = ?', [newEmployeeId, userId]);
    }
  }
}

/**
 * Build query parameters for user creation
 * N:M REFACTORING: department_id removed - departments assigned via user_departments table
 * Root users automatically get has_full_access = 1 for full tenant access
 * REMOVED: company and iban columns dropped (2025-11-27)
 */
export function buildUserQueryParams(
  userData: UserCreateData,
  finalUsername: string,
  hashedPassword: string,
  finalEmployeeId: string | undefined,
): unknown[] {
  const {
    email,
    role,
    // REMOVED: company column dropped (2025-11-27)
    notes,
    first_name: firstName,
    last_name: lastName,
    age,
    employee_number: employeeNumber,
    // N:M REFACTORING: department_id removed
    position,
    phone,
    address,
    date_of_birth: dateOfBirth,
    hire_date: hireDate,
    emergency_contact: emergencyContact,
    profile_picture: profilePicture,
    is_archived: isArchived = 0,
    is_active: isActive = 1,
  } = userData;

  // Root users get full tenant access, others don't
  const hasFullAccess = role === 'root' ? 1 : 0;

  // REMOVED: company and iban from INSERT (2025-11-27)
  return [
    finalUsername,
    email,
    hashedPassword,
    role,
    notes,
    firstName,
    lastName,
    age,
    finalEmployeeId,
    employeeNumber ?? `EMP${Date.now()}`,
    // N:M REFACTORING: department_id removed from INSERT
    position,
    phone,
    address,
    dateOfBirth,
    hireDate,
    emergencyContact,
    profilePicture,
    isArchived,
    isActive,
    hasFullAccess,
    userData.tenant_id,
  ];
}

/**
 * Process a single field for user update query
 */
export function processUpdateField(
  key: string,
  value: unknown,
  allowedFields: readonly (keyof UserCreateData)[],
  fields: string[],
  values: unknown[],
): void {
  if (!allowedFields.includes(key as keyof UserCreateData)) {
    logger.warn(`Attempted to update non-allowed field: ${key}`);
    return;
  }

  // Use backticks to escape column names properly
  fields.push(`\`${key}\` = ?`);

  // Special handling for boolean fields
  if (key === 'is_active' || key === 'is_archived') {
    logger.info(
      `Special handling for ${key} field - received value: ${String(value)}, type: ${typeof value}`,
    );
    values.push(value === true ? 1 : 0);
    logger.info(`${key} will be set to: ${value === true ? 1 : 0}`);
  } else {
    values.push(value);
    logger.info(`Updating field ${key} to value: ${String(value)}`);
  }
}

/** Search columns for user queries */
const USER_SEARCH_COLUMNS = ['username', 'email', 'first_name', 'last_name', 'employee_id'];

/**
 * Add search filter across multiple columns
 */
function addSearchFilter(conditions: string[], values: unknown[], search: string): void {
  const searchCondition = USER_SEARCH_COLUMNS.map((col: string) => `u.${col} LIKE ?`).join(' OR ');
  conditions.push(`(${searchCondition})`);
  const searchTerm = `%${search}%`;
  USER_SEARCH_COLUMNS.forEach(() => values.push(searchTerm));
}

/**
 * Check if a filter value is valid (non-null and non-empty)
 */
function isValidFilter(value: unknown): boolean {
  return value != null && value !== '' && value !== 0;
}

/**
 * Build filter conditions for user search query
 * N:M REFACTORING: department_id filter now uses user_departments table
 */
export function buildFilterConditions(filters: UserFilter, values: unknown[]): string {
  const conditions: string[] = [];

  // Archived filter (default: not archived)
  conditions.push('u.is_archived = ?');
  values.push(filters.is_archived ?? false);

  // Simple equality filters
  if (isValidFilter(filters.role)) {
    conditions.push('u.role = ?');
    values.push(filters.role);
  }

  // N:M REFACTORING: Filter via user_departments table instead of users.department_id
  if (isValidFilter(filters.department_id)) {
    conditions.push(
      'u.id IN (SELECT ud.user_id FROM user_departments ud WHERE ud.department_id = ? AND ud.tenant_id = u.tenant_id)',
    );
    values.push(filters.department_id);
  }

  if (isValidFilter(filters.status)) {
    conditions.push('u.is_active = ?');
    values.push(filters.status === 'active' ? 1 : 0);
  }

  // Search filter
  if (isValidFilter(filters.search)) {
    addSearchFilter(conditions, values, filters.search as string);
  }

  return ` AND ${conditions.join(' AND ')}`;
}

/**
 * Build ORDER BY clause for user search query
 */
export function buildOrderByClause(filters: UserFilter): string {
  const validColumns = [
    'username',
    'email',
    'first_name',
    'last_name',
    'created_at',
    'employee_id',
    'position',
    'status',
  ];

  if (filters.sort_by != null && filters.sort_by !== '' && validColumns.includes(filters.sort_by)) {
    const direction = filters.sort_dir === 'desc' ? 'DESC' : 'ASC';
    return ` ORDER BY u.${filters.sort_by} ${direction}`;
  }

  return ` ORDER BY u.username ASC`;
}

/**
 * Build pagination clause for user search query
 */
export function buildPaginationClause(filters: UserFilter, values: unknown[]): string {
  if (filters.limit != null && filters.limit !== 0) {
    const parsedLimit = Number.parseInt(filters.limit.toString());
    const limit = Number.isNaN(parsedLimit) || parsedLimit === 0 ? 20 : parsedLimit;
    const parsedPage = Number.parseInt((filters.page ?? 1).toString());
    const page = Number.isNaN(parsedPage) || parsedPage === 0 ? 1 : parsedPage;
    const offset = (page - 1) * limit;

    values.push(limit, offset);
    return ` LIMIT ? OFFSET ?`;
  }
  return '';
}

/**
 * Build count query with filters
 */
export function buildCountQuery(filters: UserFilter, values: unknown[]): string {
  let query = `SELECT COUNT(*) as total FROM users u WHERE u.tenant_id = ?`;
  values.push(filters.tenant_id);

  // Reuse the existing buildFilterConditions function
  query += buildFilterConditions(filters, values);

  return query;
}
