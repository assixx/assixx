/**
 * User CRUD Operations
 * Main business logic for user management
 */
import { ResultSetHeader, query as executeQuery } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { normalizeMySQLBoolean } from '../../utils/typeHelpers.js';
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
  const iban = userData.iban ?? '';
  const hashedPassword = password;

  const finalEmployeeId = await generateInitialEmployeeId(employeeId, tenantId, role);

  const query = `
    INSERT INTO users (
      username, email, password, role, company, notes,
      first_name, last_name, age, employee_id, employee_number, iban,
      department_id, position, phone, address, birthday,
      hire_date, emergency_contact, profile_picture,
      status, is_archived, is_active, tenant_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  try {
    const queryParams = buildUserQueryParams(
      userData,
      finalUsername,
      hashedPassword,
      finalEmployeeId,
      iban,
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
    const [rows] = await executeQuery<DbUser[]>('SELECT * FROM users WHERE username = ?', [
      username,
    ]);
    console.info('[DEBUG] Query completed, rows found:', rows.length);

    if (rows.length > 0) {
      // Normalize boolean fields from MySQL 0/1 to JavaScript true/false
      rows[0].is_active = normalizeMySQLBoolean(rows[0].is_active);
      rows[0].is_archived = normalizeMySQLBoolean(rows[0].is_archived);
      return rows[0];
    }

    return undefined;
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

    if (!id || !tenantId || Number.isNaN(id) || Number.isNaN(tenantId)) {
      logger.error(
        `Invalid parameters for User.findById: id=${id}, tenant_id=${tenantId}, idType=${typeof id}, tenantType=${typeof tenantId}`,
      );
      throw new Error(`Invalid user ID (${id}) or tenant ID (${tenantId})`);
    }

    const [rows] = await executeQuery<DbUser[]>(
      process.env.NODE_ENV === 'test' ?
        `SELECT u.*, d.name as department_name, t.company_name as company_name, t.subdomain,
             ut.team_id, tm.name as team_name
             FROM users u
             LEFT JOIN departments d ON u.department_id = d.id
             LEFT JOIN tenants t ON u.tenant_id = t.id
             LEFT JOIN user_teams ut ON u.id = ut.user_id AND ut.tenant_id = u.tenant_id
             LEFT JOIN teams tm ON ut.team_id = tm.id AND tm.tenant_id = u.tenant_id
             WHERE u.id = ? AND u.tenant_id = ?`
      : `SELECT u.*, d.name as department_name, t.company_name as company_name, t.subdomain,
             u.availability_status, u.availability_start, u.availability_end, u.availability_notes,
             ut.team_id, tm.name as team_name
             FROM users u
             LEFT JOIN departments d ON u.department_id = d.id
             LEFT JOIN tenants t ON u.tenant_id = t.id
             LEFT JOIN user_teams ut ON u.id = ut.user_id AND ut.tenant_id = u.tenant_id
             LEFT JOIN teams tm ON ut.team_id = tm.id AND tm.tenant_id = u.tenant_id
             WHERE u.id = ? AND u.tenant_id = ?`,
      [id, tenantId],
    );

    if (rows.length > 0) {
      // Normalize boolean fields from MySQL 0/1 to JavaScript true/false
      rows[0].is_active = normalizeMySQLBoolean(rows[0].is_active);
      rows[0].is_archived = normalizeMySQLBoolean(rows[0].is_archived);
      return rows[0];
    }

    return undefined;
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

    let query = `
        SELECT u.id, u.username, u.email, u.role, u.company, u.tenant_id,
        u.first_name, u.last_name, u.created_at, u.department_id,
        u.position, u.phone, u.landline, u.employee_number, u.profile_picture, u.status, u.is_archived,
        u.is_active, u.last_login, u.availability_status,
        u.availability_start, u.availability_end, u.availability_notes,
        d.name as department_name,
        t.name as team_name,
        ut.team_id
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN user_teams ut ON u.id = ut.user_id AND ut.tenant_id = u.tenant_id
        LEFT JOIN teams t ON ut.team_id = t.id AND t.tenant_id = u.tenant_id
        WHERE u.role = ? AND u.tenant_id = ?
      `;

    const params: unknown[] = [role, tenantId];

    if (!includeArchived) {
      query += ` AND u.is_archived = 0`;
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
    let query = 'SELECT * FROM users WHERE email = ? AND is_archived = 0';
    const params: (string | number)[] = [email];

    if (tenantId !== undefined) {
      query += ' AND tenant_id = ?';
      params.push(tenantId);
    }

    const [rows] = await executeQuery<DbUser[]>(query, params);

    if (rows.length > 0) {
      // Normalize boolean fields from MySQL 0/1 to JavaScript true/false
      rows[0].is_active = normalizeMySQLBoolean(rows[0].is_active);
      rows[0].is_archived = normalizeMySQLBoolean(rows[0].is_archived);
      return rows[0];
    }

    return undefined;
  } catch (error: unknown) {
    logger.error(`Error finding user by email: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Delete a user
 */
export async function deleteUser(id: number): Promise<boolean> {
  try {
    const [result] = await executeQuery<ResultSetHeader>('DELETE FROM users WHERE id = ?', [id]);
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
    const allowedFields: readonly (keyof UserCreateData)[] = [
      'username',
      'email',
      'password',
      'role',
      'company',
      'notes',
      'first_name',
      'last_name',
      'age',
      'employee_id',
      'iban',
      'department_id',
      'position',
      'phone',
      'landline',
      'employee_number',
      'address',
      'birthday',
      'hire_date',
      'emergency_contact',
      'profile_picture',
      'status',
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
    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`;

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
    if (filters.tenant_id) {
      await autoResetExpiredAvailability(filters.tenant_id);
    }

    const baseQuery = `
        SELECT u.id, u.username, u.email, u.role, u.company,
        u.first_name, u.last_name, u.employee_id, u.created_at,
        u.department_id, u.position, u.phone, u.landline, u.employee_number, u.status, u.is_archived,
        u.is_active, u.last_login, u.availability_status,
        u.availability_start, u.availability_end, u.availability_notes,
        d.name as department_name,
        t.name as team_name,
        ut.team_id
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN user_teams ut ON u.id = ut.user_id AND ut.tenant_id = u.tenant_id
        LEFT JOIN teams t ON ut.team_id = t.id AND t.tenant_id = u.tenant_id
        WHERE u.tenant_id = ?
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
    let query = `
        SELECT u.id, u.username, u.email, u.role, u.company,
        u.first_name, u.last_name, u.created_at, u.department_id,
        u.position, u.phone, u.landline, u.employee_number, u.profile_picture, u.status,
        d.name as department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.is_archived = true AND u.tenant_id = ?
      `;

    const params: unknown[] = [tenantId];

    if (role != null && role !== '') {
      query += ` AND u.role = ?`;
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
    let query = `SELECT u.*, d.name as department
                   FROM users u
                   LEFT JOIN departments d ON u.department_id = d.id
                   WHERE u.tenant_id = ?`;
    const params: unknown[] = [filters.tenant_id];

    if (filters.role != null && filters.role !== '') {
      query += ' AND u.role = ?';
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
    const [rows] = await executeQuery<DbUser[]>(
      `SELECT u.*, d.name as department
         FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.tenant_id = ?`,
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
