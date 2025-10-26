/**
 * User Utility Functions
 * Pure functions for data formatting, filtering, and query building
 */
import { query as executeQuery } from '../../utils/db';
import { generateEmployeeId, generateTempEmployeeId } from '../../utils/employeeIdGenerator';
import { logger } from '../../utils/logger';
import { SubdomainResult, UserCreateData, UserFilter } from './user.types';

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
    // Defensive check: subdomain is NOT NULL in schema but fallback for safety
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const subdomain = tenantResult[0].subdomain ?? 'DEFAULT';
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
      // Defensive check: subdomain is NOT NULL in schema but fallback for safety
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const subdomain = tenantResult[0].subdomain ?? 'DEFAULT';
      const newEmployeeId = generateEmployeeId(subdomain, role ?? 'employee', userId);
      await executeQuery('UPDATE users SET employee_id = ? WHERE id = ?', [newEmployeeId, userId]);
    }
  }
}

/**
 * Build query parameters for user creation
 */
export function buildUserQueryParams(
  userData: UserCreateData,
  finalUsername: string,
  hashedPassword: string,
  finalEmployeeId: string | undefined,
  iban: string,
): unknown[] {
  const {
    email,
    role,
    company,
    notes,
    first_name: firstName,
    last_name: lastName,
    age,
    employee_number: employeeNumber,
    department_id: departmentId,
    position,
    phone,
    address,
    birthday,
    hire_date: hireDate,
    emergency_contact: emergencyContact,
    profile_picture: profilePicture,
    status = 'active',
    is_archived: isArchived = 0,
    is_active: isActive = 1,
  } = userData;

  return [
    finalUsername,
    email,
    hashedPassword,
    role,
    company,
    notes,
    firstName,
    lastName,
    age,
    finalEmployeeId,
    employeeNumber ?? `EMP${Date.now()}`,
    iban,
    departmentId,
    position,
    phone,
    address,
    birthday,
    hireDate,
    emergencyContact,
    profilePicture,
    status,
    isArchived,
    isActive,
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

/**
 * Build filter conditions for user search query
 */
export function buildFilterConditions(filters: UserFilter, values: unknown[]): string {
  let conditions = '';

  // Filter für archivierte Benutzer
  if (filters.is_archived !== undefined) {
    conditions += ` AND u.is_archived = ?`;
    values.push(filters.is_archived);
  } else {
    conditions += ` AND u.is_archived = 0`;
  }

  // Weitere Filter hinzufügen
  if (filters.role != null && filters.role !== '') {
    conditions += ` AND u.role = ?`;
    values.push(filters.role);
  }

  if (filters.department_id != null && filters.department_id !== 0) {
    conditions += ` AND u.department_id = ?`;
    values.push(filters.department_id);
  }

  if (filters.status != null && filters.status !== '') {
    conditions += ` AND u.status = ?`;
    values.push(filters.status);
  }

  if (filters.search != null && filters.search !== '') {
    conditions += ` AND (
          u.username LIKE ? OR
          u.email LIKE ? OR
          u.first_name LIKE ? OR
          u.last_name LIKE ? OR
          u.employee_id LIKE ?
        )`;
    const searchTerm = `%${filters.search}%`;
    values.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
  }

  return conditions;
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
    const limit = Number.parseInt(filters.limit.toString()) || 20;
    const page = Number.parseInt((filters.page ?? 1).toString()) || 1;
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
