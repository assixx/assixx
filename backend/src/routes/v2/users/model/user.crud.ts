/**
 * User CRUD Operations
 * Main business logic for user management
 */
import { ResultSetHeader, query as executeQuery } from '../../../../utils/db.js';
import { logger } from '../../../../utils/logger.js';
import { normalizeMySQLBoolean } from '../../../../utils/typeHelpers.js';
import { autoResetExpiredAvailability } from './user.availability.js';
import { DbUser, UserCreateData, UserFilter } from './user.types.js';
import {
  buildFilterConditions,
  buildOrderByClause,
  buildPaginationClause,
  buildUserQueryParams,
  generateInitialEmployeeId,
  processUpdateField,
  updateTemporaryEmployeeId,
} from './user.utils.js';

/**
 * Create a new user
 */
export async function createUser(userData: UserCreateData): Promise<number> {
  const { email, password, employee_id: employeeId, role, tenant_id: tenantId } = userData;

  // Validate tenant_id is required for multi-tenant isolation
  if (tenantId === undefined) {
    throw new Error('tenant_id is required for user creation');
  }

  const finalUsername = email;
  // REMOVED: iban column dropped (2025-11-27)
  const hashedPassword = password;

  const finalEmployeeId = await generateInitialEmployeeId(employeeId, tenantId, role);

  // N:M REFACTORING: department_id removed - departments assigned via user_departments table
  // Root users get has_full_access = true for full tenant access
  // REMOVED: company and iban columns dropped (2025-11-27)
  const query = `
    INSERT INTO users (
      username, email, password, role, notes,
      first_name, last_name, age, employee_id, employee_number,
      position, phone, address, date_of_birth,
      hire_date, emergency_contact, profile_picture,
      is_archived, is_active, has_full_access, tenant_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
  `;

  try {
    // REMOVED: iban parameter dropped (2025-11-27)
    const queryParams = buildUserQueryParams(
      userData,
      finalUsername,
      hashedPassword,
      finalEmployeeId,
    );
    const [result] = await executeQuery<ResultSetHeader>(query, queryParams);
    logger.info(`User created successfully with ID: ${result.insertId}`);

    await updateTemporaryEmployeeId(result.insertId, tenantId, role, employeeId, finalEmployeeId);

    return result.insertId;
  } catch (error: unknown) {
    logger.error(`Error creating user: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Find user by username
 */
export async function findUserByUsername(username: string): Promise<DbUser | undefined> {
  console.info('[DEBUG] findByUsername called for:', username);
  try {
    console.info('[DEBUG] About to execute query');
    const [rows] = await executeQuery<DbUser[]>('SELECT * FROM users WHERE username = $1', [
      username,
    ]);
    console.info('[DEBUG] Query completed, rows found:', rows.length);

    const row = rows[0];
    if (row === undefined) {
      return undefined;
    }

    // Normalize boolean fields from MySQL 0/1 to JavaScript true/false
    row.is_active = normalizeMySQLBoolean(row.is_active);
    row.is_archived = normalizeMySQLBoolean(row.is_archived);
    return row;
  } catch (error: unknown) {
    console.error('[DEBUG] findByUsername error:', error);
    logger.error(`Error finding user by username: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Find user by ID with tenant isolation
 */
export async function findUserById(id: number, tenantId: number): Promise<DbUser | undefined> {
  try {
    // Validate inputs with detailed logging
    console.info(
      `[DEBUG] User.findById called with: id=${id} (type: ${typeof id}), tenant_id=${tenantId} (type: ${typeof tenantId})`,
    );

    if (id === 0 || tenantId === 0 || Number.isNaN(id) || Number.isNaN(tenantId)) {
      logger.error(
        `Invalid parameters for User.findById: id=${id}, tenant_id=${tenantId}, idType=${typeof id}, tenantType=${typeof tenantId}`,
      );
      throw new Error(`Invalid user ID (${id}) or tenant ID (${tenantId})`);
    }

    // N:M REFACTORING: JOIN via user_departments table instead of users.department_id
    // INHERITANCE-FIX: Include full chain - Team → Department → Area
    const [rows] = await executeQuery<DbUser[]>(
      process.env['NODE_ENV'] === 'test' ?
        `SELECT u.*, ud.department_id as primary_department_id, d.name as department_name,
             t.company_name as company_name, t.subdomain,
             ut.team_id, tm.name as team_name,
             tm.department_id as team_department_id, td.name as team_department_name,
             td.area_id as team_area_id, ta.name as team_area_name
             FROM users u
             LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
             LEFT JOIN departments d ON ud.department_id = d.id
             LEFT JOIN tenants t ON u.tenant_id = t.id
             LEFT JOIN user_teams ut ON u.id = ut.user_id AND ut.tenant_id = u.tenant_id
             LEFT JOIN teams tm ON ut.team_id = tm.id AND tm.tenant_id = u.tenant_id
             LEFT JOIN departments td ON tm.department_id = td.id AND td.tenant_id = u.tenant_id
             LEFT JOIN areas ta ON td.area_id = ta.id AND ta.tenant_id = u.tenant_id
             WHERE u.id = $1 AND u.tenant_id = $2`
      : `SELECT u.*, ud.department_id as primary_department_id, d.name as department_name,
             t.company_name as company_name, t.subdomain,
             u.availability_status, u.availability_start, u.availability_end, u.availability_notes,
             ut.team_id, tm.name as team_name,
             tm.department_id as team_department_id, td.name as team_department_name,
             td.area_id as team_area_id, ta.name as team_area_name
             FROM users u
             LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
             LEFT JOIN departments d ON ud.department_id = d.id
             LEFT JOIN tenants t ON u.tenant_id = t.id
             LEFT JOIN user_teams ut ON u.id = ut.user_id AND ut.tenant_id = u.tenant_id
             LEFT JOIN teams tm ON ut.team_id = tm.id AND tm.tenant_id = u.tenant_id
             LEFT JOIN departments td ON tm.department_id = td.id AND td.tenant_id = u.tenant_id
             LEFT JOIN areas ta ON td.area_id = ta.id AND ta.tenant_id = u.tenant_id
             WHERE u.id = $1 AND u.tenant_id = $2`,
      [id, tenantId],
    );

    const row = rows[0];
    if (row === undefined) {
      return undefined;
    }

    // Normalize boolean fields from MySQL 0/1 to JavaScript true/false
    row.is_active = normalizeMySQLBoolean(row.is_active);
    row.is_archived = normalizeMySQLBoolean(row.is_archived);
    return row;
  } catch (error: unknown) {
    logger.error(`Error finding user by ID: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Find users by role
 */
export async function findUsersByRole(
  role: string,
  // eslint-disable-next-line @typescript-eslint/typedef -- Default parameter with literal value
  includeArchived = false,
  tenantId: number, // PFLICHT - nicht mehr optional!
): Promise<DbUser[]> {
  try {
    // Auto-reset expired availability before fetching
    await autoResetExpiredAvailability(tenantId);

    logger.info(
      `[findUsersByRole] Called with role=${role}, includeArchived=${includeArchived}, tenantId=${tenantId}`,
    );

    // N:M REFACTORING: JOIN via user_departments table instead of users.department_id
    // REMOVED: company column dropped (2025-11-27)
    // INHERITANCE-FIX: Include full chain - Team → Department → Area
    let query = `
        SELECT u.id, u.username, u.email, u.role, u.tenant_id,
        u.first_name, u.last_name, u.created_at,
        ud.department_id as primary_department_id,
        u.position, u.phone, u.landline, u.employee_number, u.profile_picture, u.is_archived,
        u.is_active, u.last_login, u.availability_status,
        u.availability_start, u.availability_end, u.availability_notes,
        u.has_full_access,
        d.name as department_name,
        ut.team_id,
        t.name as team_name,
        t.department_id as team_department_id,
        td.name as team_department_name,
        td.area_id as team_area_id,
        ta.name as team_area_name
        FROM users u
        LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
        LEFT JOIN departments d ON ud.department_id = d.id
        LEFT JOIN user_teams ut ON u.id = ut.user_id AND ut.tenant_id = u.tenant_id
        LEFT JOIN teams t ON ut.team_id = t.id AND t.tenant_id = u.tenant_id
        LEFT JOIN departments td ON t.department_id = td.id AND td.tenant_id = u.tenant_id
        LEFT JOIN areas ta ON td.area_id = ta.id AND ta.tenant_id = u.tenant_id
        WHERE u.role = $1 AND u.tenant_id = $2
      `;

    const params: unknown[] = [role, tenantId];

    if (!includeArchived) {
      query += ` AND u.is_archived = false`;
    }

    const [rows] = await executeQuery<DbUser[]>(query, params);

    // Normalize boolean fields from MySQL 0/1 to JavaScript true/false
    return rows.map((row: DbUser) => ({
      ...row,
      is_active: normalizeMySQLBoolean(row.is_active),
      is_archived: normalizeMySQLBoolean(row.is_archived),
    }));
  } catch (error: unknown) {
    logger.error(`Error finding users by role: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Find user by email
 */
export async function findUserByEmail(
  email: string,
  tenantId?: number,
): Promise<DbUser | undefined> {
  try {
    let query = 'SELECT * FROM users WHERE email = $1 AND is_archived = false';
    const params: (string | number)[] = [email];

    if (tenantId !== undefined) {
      query += ' AND tenant_id = $2';
      params.push(tenantId);
    }

    const [rows] = await executeQuery<DbUser[]>(query, params);

    const row = rows[0];
    if (row === undefined) {
      return undefined;
    }

    // Normalize boolean fields from MySQL 0/1 to JavaScript true/false
    row.is_active = normalizeMySQLBoolean(row.is_active);
    row.is_archived = normalizeMySQLBoolean(row.is_archived);
    return row;
  } catch (error: unknown) {
    logger.error(`Error finding user by email: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Delete a user
 * SECURITY: tenant_id is MANDATORY to prevent cross-tenant user deletion
 */
export async function deleteUser(id: number, tenantId: number): Promise<boolean> {
  try {
    const [result] = await executeQuery<ResultSetHeader>(
      'DELETE FROM users WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    return result.affectedRows > 0;
  } catch (error: unknown) {
    logger.error(`Error deleting user with ID ${id}: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Update a user
 */
export async function updateUser(
  id: number,
  userData: Partial<UserCreateData>,
  tenantId: number, // SECURITY FIX: Made tenantId mandatory to prevent cross-tenant updates
): Promise<boolean> {
  try {
    // Define allowed fields for update to prevent SQL injection
    // N:M REFACTORING: department_id removed - departments managed via user_departments table
    // REMOVED: company and iban columns dropped (2025-11-27)
    const allowedFields: readonly (keyof UserCreateData)[] = [
      'username',
      'email',
      'password',
      'role',
      'notes',
      'first_name',
      'last_name',
      'age',
      'employee_id',
      // N:M REFACTORING: department_id removed from allowed update fields
      'position',
      'phone',
      'landline',
      'employee_number',
      'address',
      'date_of_birth',
      'hire_date',
      'emergency_contact',
      'profile_picture',
      'is_archived',
      'is_active',
      'last_login', // Track last successful login timestamp
      'availability_status',
      'availability_start',
      'availability_end',
      'availability_notes',
    ] as const;

    // Dynamisch Query aufbauen basierend auf den zu aktualisierenden Feldern
    const fields: string[] = [];
    const values: unknown[] = [];

    // Für jedes übergebene Feld Query vorbereiten
    Object.entries(userData).forEach(([key, value]: [string, unknown]) => {
      processUpdateField(key, value, allowedFields, fields, values);
    });

    // Wenn keine Felder zum Aktualisieren vorhanden sind, abbrechen
    if (fields.length === 0) {
      return false;
    }

    // ID und tenant_id für die WHERE-Klausel anhängen
    values.push(id);
    values.push(tenantId);

    // SECURITY: Always include tenant_id in WHERE clause
    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length - 1} AND tenant_id = $${values.length}`;

    logger.info(`Executing update query: ${query}`);
    logger.info(`With values: ${JSON.stringify(values)}`);

    const [result] = await executeQuery<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  } catch (error: unknown) {
    logger.error(`Error updating user with ID ${id}: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Search users with filters, pagination, and sorting
 */
export async function searchUsers(filters: UserFilter): Promise<DbUser[]> {
  try {
    // Auto-reset expired availability before fetching
    if (typeof filters.tenant_id === 'number' && filters.tenant_id > 0) {
      await autoResetExpiredAvailability(filters.tenant_id);
    }

    // N:M REFACTORING: JOIN via user_departments table instead of users.department_id
    // REMOVED: company column dropped (2025-11-27)
    // INHERITANCE-FIX: Include full chain - Team → Department → Area
    const baseQuery = `
        SELECT u.id, u.username, u.email, u.role,
        u.first_name, u.last_name, u.employee_id, u.created_at,
        ud.department_id as primary_department_id, u.position, u.phone, u.landline, u.employee_number, u.is_archived,
        u.is_active, u.last_login, u.availability_status,
        u.availability_start, u.availability_end, u.availability_notes,
        u.has_full_access,
        d.name as department_name,
        ut.team_id,
        t.name as team_name,
        t.department_id as team_department_id,
        td.name as team_department_name,
        td.area_id as team_area_id,
        ta.name as team_area_name
        FROM users u
        LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
        LEFT JOIN departments d ON ud.department_id = d.id
        LEFT JOIN user_teams ut ON u.id = ut.user_id AND ut.tenant_id = u.tenant_id
        LEFT JOIN teams t ON ut.team_id = t.id AND t.tenant_id = u.tenant_id
        LEFT JOIN departments td ON t.department_id = td.id AND td.tenant_id = u.tenant_id
        LEFT JOIN areas ta ON td.area_id = ta.id AND ta.tenant_id = u.tenant_id
        WHERE u.tenant_id = $1
      `;

    const values: unknown[] = [filters.tenant_id];

    // Build query parts
    const filterConditions = buildFilterConditions(filters, values);
    const orderByClause = buildOrderByClause(filters);
    const paginationClause = buildPaginationClause(filters, values);

    // Combine query parts
    const query = baseQuery + filterConditions + orderByClause + paginationClause;

    const [rows] = await executeQuery<DbUser[]>(query, values);

    // Normalize boolean fields from MySQL 0/1 to JavaScript true/false
    return rows.map((row: DbUser) => ({
      ...row,
      is_active: normalizeMySQLBoolean(row.is_active),
      is_archived: normalizeMySQLBoolean(row.is_archived),
    }));
  } catch (error: unknown) {
    logger.error(`Error searching users: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Archive a user
 */
export async function archiveUser(
  userId: number,
  tenantId: number, // SECURITY FIX: Made tenantId mandatory
): Promise<boolean> {
  logger.info(`Archiving user ${userId}`);
  return await updateUser(userId, { is_archived: true }, tenantId);
}

/**
 * Unarchive a user
 */
export async function unarchiveUser(
  userId: number,
  tenantId: number, // SECURITY FIX: Made tenantId mandatory
): Promise<boolean> {
  logger.info(`Unarchiving user ${userId}`);
  return await updateUser(userId, { is_archived: false }, tenantId);
}

/**
 * Find all archived users
 */
export async function findArchivedUsers(
  tenantId: number, // SECURITY FIX: Added mandatory tenantId parameter
  role: string | null = null,
): Promise<DbUser[]> {
  try {
    // N:M REFACTORING: JOIN via user_departments table instead of users.department_id
    // REMOVED: company column dropped (2025-11-27)
    let query = `
        SELECT u.id, u.username, u.email, u.role,
        u.first_name, u.last_name, u.created_at,
        ud.department_id as primary_department_id,
        u.position, u.phone, u.landline, u.employee_number, u.profile_picture, u.is_active,
        d.name as department_name
        FROM users u
        LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
        LEFT JOIN departments d ON ud.department_id = d.id
        WHERE u.is_archived = true AND u.tenant_id = $1
      `;

    const params: unknown[] = [tenantId];

    if (role != null && role !== '') {
      query += ` AND u.role = $2`;
      params.push(role);
    }

    query += ` ORDER BY u.last_name, u.first_name`;

    const [rows] = await executeQuery<DbUser[]>(query, params);

    return rows;
  } catch (error: unknown) {
    logger.error(`Error finding archived users: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Find all users with optional filters
 */
export async function findAllUsers(filters: UserFilter): Promise<DbUser[]> {
  try {
    // N:M REFACTORING: JOIN via user_departments table instead of users.department_id
    let query = `SELECT u.*, ud.department_id as primary_department_id, d.name as department
                   FROM users u
                   LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
                   LEFT JOIN departments d ON ud.department_id = d.id
                   WHERE u.tenant_id = $1`;
    const params: unknown[] = [filters.tenant_id];

    if (filters.role != null && filters.role !== '') {
      query += ' AND u.role = $2';
      params.push(filters.role);
    }

    const [rows] = await executeQuery<DbUser[]>(query, params);

    // Normalize boolean fields
    return rows.map((row: DbUser) => ({
      ...row,
      is_active: normalizeMySQLBoolean(row.is_active),
      is_archived: normalizeMySQLBoolean(row.is_archived),
    }));
  } catch (error: unknown) {
    logger.error(`Error finding all users: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Find all users by tenant
 */
export async function findAllUsersByTenant(tenantId: number): Promise<DbUser[]> {
  try {
    // N:M REFACTORING: JOIN via user_departments table instead of users.department_id
    const [rows] = await executeQuery<DbUser[]>(
      `SELECT u.*, ud.department_id as primary_department_id, d.name as department
         FROM users u
         LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
         LEFT JOIN departments d ON ud.department_id = d.id
         WHERE u.tenant_id = $1`,
      [tenantId],
    );

    // Normalize boolean fields
    return rows.map((row: DbUser) => ({
      ...row,
      is_active: normalizeMySQLBoolean(row.is_active),
      is_archived: normalizeMySQLBoolean(row.is_archived),
    }));
  } catch (error: unknown) {
    logger.error(`Error finding users by tenant: ${(error as Error).message}`);
    throw error;
  }
}
