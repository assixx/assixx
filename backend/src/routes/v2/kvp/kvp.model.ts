/* eslint-disable max-lines */
/**
 * KVP (Kontinuierlicher Verbesserungsprozess) Model
 * Handles all database operations for the KVP system
 */
import * as fs from 'fs/promises';
import { v7 as uuidv7 } from 'uuid';

import {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
  getConnection,
} from '../../../utils/db.js';

// Database interfaces
export interface DbCategory extends RowDataPacket {
  id: number;
  tenant_id: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

interface DbSuggestion extends RowDataPacket {
  id: number;
  uuid: string; // NEW: External UUIDv7 identifier
  tenant_id: number;
  title: string;
  description: string;
  category_id: number;
  org_level: 'company' | 'department' | 'area' | 'team';
  org_id: number;
  submitted_by: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  expected_benefit?: string;
  estimated_cost?: string;
  status: 'new' | 'in_review' | 'approved' | 'implemented' | 'rejected' | 'archived';
  assigned_to?: number;
  actual_savings?: number;
  created_at: Date;
  updated_at: Date;
  uuid_created_at?: Date; // NEW: Track when UUID was generated
  // Extended fields from joins
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  department_name?: string; // NEW: Department name from JOIN
  team_name?: string; // NEW: Team name from JOIN
  submitted_by_name?: string;
  submitted_by_lastname?: string;
  submitted_by_email?: string;
  assigned_to_name?: string;
  assigned_to_lastname?: string;
  attachment_count?: number;
  comment_count?: number;
  avg_rating?: number;
}

interface DbAttachment extends RowDataPacket {
  id: number;
  file_uuid: string; // NEW: Secure UUID for downloads (prevents enumeration attacks)
  suggestion_id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: number;
  uploaded_at: Date;
  // Extended fields from joins
  first_name?: string;
  last_name?: string;
  submitted_by?: number;
  tenant_id?: number;
}

interface DbComment extends RowDataPacket {
  id: number;
  suggestion_id: number;
  user_id: number;
  comment: string;
  is_internal: boolean;
  created_at: Date;
  // Extended fields from joins
  first_name?: string;
  last_name?: string;
  role?: string;
}

// Raw query result from database
interface DashboardStatsResult extends RowDataPacket {
  total_suggestions: number;
  new_suggestions: number;
  in_progress_count: number; // SQL returns this field name
  implemented: number;
  rejected: number;
  avg_savings: number | null;
}

// User organization info query result
interface UserOrgInfoResult extends RowDataPacket {
  team_id: number | null;
  department_id: number | null;
  area_id: number | null;
}

interface DbDashboardStats extends RowDataPacket {
  total_suggestions: number;
  new_suggestions: number;
  in_progress: number;
  in_progress_count?: number; // Alias for in_progress (for compatibility)
  implemented: number;
  rejected: number;
  avg_savings: number | null;
}

interface SuggestionCreateData {
  tenant_id: number;
  title: string;
  description: string;
  category_id: number;
  department_id?: number | null;
  org_level: 'company' | 'department' | 'area' | 'team';
  org_id: number;
  submitted_by: number;
  team_id?: number | null;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  expected_benefit?: string;
  estimated_cost?: string;
}

interface SuggestionFilters {
  status?: string;
  category_id?: number;
  priority?: string;
  org_level?: string;
}

interface FileData {
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: number;
}

// Helper method to get database connection (uses pool from db.ts)
async function getDbConnection(): Promise<PoolConnection> {
  try {
    return await getConnection();
  } catch (error: unknown) {
    console.error('Database connection error in KVP model:', error);
    throw error;
  }
}

// Get all categories (categories are global, not tenant-specific)
export async function getKvpCategories(): Promise<DbCategory[]> {
  const connection = await getDbConnection();
  try {
    const [rows] = await connection.execute<DbCategory[]>(
      'SELECT * FROM kvp_categories ORDER BY name ASC',
    );
    return rows;
  } catch (error: unknown) {
    // Log detailed error internally, but throw generic error to prevent info leakage
    console.error('[KVP Model] Database error in getKvpCategories:', error);
    throw new Error('Failed to fetch categories from database');
  } finally {
    connection.release();
  }
}

// Create new suggestion
export async function createKvpSuggestion(
  data: SuggestionCreateData,
): Promise<SuggestionCreateData & { id: number; uuid: string }> {
  const connection = await getDbConnection();
  try {
    console.info('[KVP Model] Received data:', JSON.stringify(data));
    console.info('[KVP Model] department_id value:', data.department_id);

    // Generate UUIDv7 for external identifier (secure, time-sortable)
    const uuid = uuidv7();

    const values = [
      uuid, // NEW: Add UUID as first value
      data.tenant_id,
      data.title,
      data.description,
      data.category_id,
      data.department_id ?? null,
      data.org_level,
      data.org_id,
      data.submitted_by,
      data.team_id ?? null,
      data.priority ?? 'normal',
      data.expected_benefit ?? null,
      data.estimated_cost ?? null,
    ];

    console.info('[KVP Model] SQL VALUES (with UUID):', values);
    // PostgreSQL RETURNING returns rows array, not ResultSetHeader
    const [rows] = await connection.execute<{ id: number }[]>(
      `
        INSERT INTO kvp_suggestions
        (uuid, tenant_id, title, description, category_id, department_id, org_level, org_id, is_shared, submitted_by, team_id, priority, expected_benefit, estimated_cost)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, $9, $10, $11, $12, $13)
        RETURNING id
      `,
      values,
    );
    if (rows.length === 0 || rows[0] === undefined) {
      throw new Error('Failed to create suggestion: No ID returned from database');
    }

    return { id: rows[0].id, uuid, ...data };
  } catch (error: unknown) {
    console.error('[KVP Model] Database error in createKvpSuggestion:', error);
    throw new Error('Failed to create suggestion in database');
  } finally {
    connection.release();
  }
}

// Helper function to get user team, department, and area info
async function getUserOrgInfo(
  connection: PoolConnection,
  userId: number,
  tenantId: number,
): Promise<{ teamId: number | null; departmentId: number | null; areaId: number | null }> {
  // N:M REFACTORING: department_id from user_departments table
  const [userInfo] = await connection.execute<UserOrgInfoResult[]>(
    `SELECT ut.team_id, ud.department_id, d.area_id
     FROM users u
     LEFT JOIN user_teams ut ON u.id = ut.user_id AND ut.tenant_id = u.tenant_id
     LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
     LEFT JOIN departments d ON ud.department_id = d.id AND d.tenant_id = u.tenant_id
     WHERE u.id = $1 AND u.tenant_id = $2`,
    [userId, tenantId],
  );

  const row = userInfo[0];
  if (row === undefined) {
    return { teamId: null, departmentId: null, areaId: null };
  }

  return {
    teamId: row.team_id,
    departmentId: row.department_id,
    areaId: row.area_id,
  };
}

// Build visibility conditions for employee role
// NEW: Respects is_shared flag - private KVPs only visible to creator + team_leader
// PostgreSQL: Dynamic $N parameter numbering with startIndex
async function buildEmployeeVisibilityConditions(
  connection: PoolConnection,
  userId: number,
  userTeamId: number | null,
  userDepartmentId: number | null,
  userAreaId: number | null,
  tenantId: number,
  startIndex: number = 2, // Start after tenant_id ($1)
): Promise<{ conditions: string; params: unknown[] }> {
  const params: unknown[] = [];
  const conditions: string[] = [];
  let paramIndex = startIndex;

  // Always can see own suggestions
  conditions.push(`s.submitted_by = $${paramIndex++}`);
  params.push(userId);

  // Always can see implemented suggestions (literal value, no param)
  conditions.push("s.status = 'implemented'");

  // Check if user is a team leader for any teams
  const [teamLeaderCheck] = await connection.execute<RowDataPacket[]>(
    'SELECT id FROM teams WHERE team_lead_id = $1 AND tenant_id = $2',
    [userId, tenantId],
  );

  if (teamLeaderCheck.length > 0) {
    // User is a team leader - can see private KVPs from their team members
    const teamIds = teamLeaderCheck.map((row: RowDataPacket) => row['id'] as number);
    const placeholders = teamIds.map(() => `$${paramIndex++}`).join(',');
    conditions.push(`(s.is_shared = FALSE AND s.team_id IN (${placeholders}))`);
    params.push(...(teamIds as unknown[]));
  }

  // For shared KVPs, use org_level visibility
  let sharedConditions = '(s.is_shared = TRUE AND (';
  const sharedParts: string[] = [];

  if (userTeamId !== null) {
    sharedParts.push(`(s.org_level = 'team' AND s.org_id = $${paramIndex++})`);
    params.push(userTeamId);
  }

  if (userDepartmentId !== null) {
    sharedParts.push(`(s.org_level = 'department' AND s.org_id = $${paramIndex++})`);
    params.push(userDepartmentId);
  }

  if (userAreaId !== null) {
    sharedParts.push(`(s.org_level = 'area' AND s.org_id = $${paramIndex++})`);
    params.push(userAreaId);
  }

  sharedParts.push("s.org_level = 'company'");
  sharedConditions += sharedParts.join(' OR ') + '))';

  conditions.push(sharedConditions);

  return {
    conditions: '(' + conditions.join(' OR ') + ')',
    params,
  };
}

// Apply search filters to query
// PostgreSQL: Dynamic $N parameter numbering
function applyFiltersToQuery(
  query: string,
  params: unknown[],
  filters: SuggestionFilters,
): { query: string; params: unknown[] } {
  let filteredQuery = query;
  const filteredParams = [...params];

  if (filters.status !== undefined && filters.status !== '') {
    const paramIndex = filteredParams.length + 1;
    filteredQuery += ` AND s.status = $${paramIndex}`;
    filteredParams.push(filters.status);
  }

  if (filters.category_id !== undefined && filters.category_id !== 0) {
    const paramIndex = filteredParams.length + 1;
    filteredQuery += ` AND s.category_id = $${paramIndex}`;
    filteredParams.push(filters.category_id);
  }

  if (filters.priority !== undefined && filters.priority !== '') {
    const paramIndex = filteredParams.length + 1;
    filteredQuery += ` AND s.priority = $${paramIndex}`;
    filteredParams.push(filters.priority);
  }

  if (filters.org_level !== undefined && filters.org_level !== '') {
    const paramIndex = filteredParams.length + 1;
    filteredQuery += ` AND s.org_level = $${paramIndex}`;
    filteredParams.push(filters.org_level);
  }

  return { query: filteredQuery, params: filteredParams };
}

// Get suggestions with filters
export async function getKvpSuggestions(
  tenantId: number,
  userId: number,
  userRole: string,
  filters: SuggestionFilters = {},
): Promise<DbSuggestion[]> {
  const connection = await getDbConnection();
  try {
    let query = `
        SELECT
          s.*,
          c.name as category_name,
          c.color as category_color,
          c.icon as category_icon,
          COALESCE(d.name, td.name) as department_name,
          t.name as team_name,
          u.first_name as submitted_by_name,
          u.last_name as submitted_by_lastname,
          admin.first_name as assigned_to_name,
          admin.last_name as assigned_to_lastname,
          (SELECT COUNT(*) FROM kvp_attachments WHERE suggestion_id = s.id) as attachment_count,
          (SELECT COUNT(*) FROM kvp_comments WHERE suggestion_id = s.id) as comment_count,
          (SELECT AVG(rating) FROM kvp_ratings WHERE suggestion_id = s.id) as avg_rating
        FROM kvp_suggestions s
        LEFT JOIN kvp_categories c ON s.category_id = c.id
        LEFT JOIN departments d ON s.department_id = d.id
        LEFT JOIN teams t ON s.team_id = t.id
        LEFT JOIN departments td ON t.department_id = td.id
        LEFT JOIN users u ON s.submitted_by = u.id
        LEFT JOIN users admin ON s.assigned_to = admin.id
        WHERE s.tenant_id = $1
      `;

    let params: unknown[] = [tenantId];

    // Handle employee visibility restrictions
    if (userRole === 'employee') {
      const { teamId, departmentId, areaId } = await getUserOrgInfo(connection, userId, tenantId);
      const visibility = await buildEmployeeVisibilityConditions(
        connection,
        userId,
        teamId,
        departmentId,
        areaId,
        tenantId,
      );
      query += ' AND ' + visibility.conditions;
      params = [...params, ...visibility.params];
    }

    // Apply filters
    const filtered = applyFiltersToQuery(query, params, filters);
    filtered.query += ' ORDER BY s.created_at DESC';

    const [rows] = await connection.execute<DbSuggestion[]>(filtered.query, filtered.params);
    return rows;
  } catch (error: unknown) {
    console.error('[KVP Model] Database error in getKvpSuggestions:', error);
    throw new Error('Failed to fetch suggestions from database');
  } finally {
    connection.release();
  }
}

// Get single suggestion by UUID (NEW - secure external identifier)
/**
 * Build the base query for fetching a suggestion with all related data
 */
function buildSuggestionQuery(whereClause: string): string {
  return `
    SELECT
      s.*,
      c.name as category_name,
      c.color as category_color,
      c.icon as category_icon,
      COALESCE(d.name, td.name) as department_name,
      t.name as team_name,
      u.first_name as submitted_by_name,
      u.last_name as submitted_by_lastname,
      u.email as submitted_by_email,
      admin.first_name as assigned_to_name,
      admin.last_name as assigned_to_lastname
    FROM kvp_suggestions s
    LEFT JOIN kvp_categories c ON s.category_id = c.id
    LEFT JOIN departments d ON s.department_id = d.id
    LEFT JOIN teams t ON s.team_id = t.id
    LEFT JOIN departments td ON t.department_id = td.id
    LEFT JOIN users u ON s.submitted_by = u.id
    LEFT JOIN users admin ON s.assigned_to = admin.id
    WHERE ${whereClause}
  `;
}

/**
 * Build employee visibility query additions
 * PostgreSQL: Dynamic $N parameter numbering starting at $3
 */
async function buildEmployeeVisibility(
  connection: PoolConnection,
  userId: number,
  tenantId: number,
  userTeamId: number | null,
  userDepartmentId: number | null,
  startIndex: number = 3, // Start after uuid/id ($1) and tenant_id ($2)
): Promise<{ conditions: string; params: unknown[] }> {
  const conditions: string[] = [];
  const visParams: unknown[] = [];
  let paramIndex = startIndex;

  // Always can see own suggestions and implemented ones
  conditions.push(`s.submitted_by = $${paramIndex++}`);
  visParams.push(userId);
  conditions.push("s.status = 'implemented'");

  // Check if user is team leader
  const [teamLeaderCheck] = await connection.execute<RowDataPacket[]>(
    'SELECT id FROM teams WHERE team_lead_id = $1 AND tenant_id = $2',
    [userId, tenantId],
  );

  if (teamLeaderCheck.length > 0) {
    const teamIds = teamLeaderCheck.map((row: RowDataPacket) => row['id'] as number);
    const placeholders = teamIds.map(() => `$${paramIndex++}`).join(',');
    conditions.push(`(s.is_shared = FALSE AND s.team_id IN (${placeholders}))`);
    visParams.push(...teamIds);
  }

  // For shared KVPs
  const sharedParts: string[] = [];
  if (userTeamId !== null) {
    sharedParts.push(`(s.org_level = 'team' AND s.org_id = $${paramIndex++})`);
    visParams.push(userTeamId);
  }
  if (userDepartmentId !== null) {
    sharedParts.push(`(s.org_level = 'department' AND s.org_id = $${paramIndex++})`);
    visParams.push(userDepartmentId);
  }
  sharedParts.push("s.org_level = 'company'");
  conditions.push(`(s.is_shared = TRUE AND (${sharedParts.join(' OR ')}))`);

  return {
    conditions: '(' + conditions.join(' OR ') + ')',
    params: visParams,
  };
}

export async function getKvpSuggestionByUuid(
  uuid: string,
  tenantId: number,
  userId: number,
  userRole: string,
): Promise<DbSuggestion | null> {
  const connection = await getDbConnection();
  try {
    let query = buildSuggestionQuery('s.uuid = $1 AND s.tenant_id = $2');
    const params: unknown[] = [uuid, tenantId];

    // Handle employee visibility
    if (userRole === 'employee') {
      const { teamId, departmentId } = await getUserOrgInfo(connection, userId, tenantId);
      const visibility = await buildEmployeeVisibility(
        connection,
        userId,
        tenantId,
        teamId,
        departmentId,
        3, // Start at $3
      );
      query += ' AND ' + visibility.conditions;
      params.push(...visibility.params);
    }

    const [rows] = await connection.execute<DbSuggestion[]>(query, params);
    return rows[0] ?? null;
  } catch (error: unknown) {
    console.error('[KVP Model] Database error in getKvpSuggestionByUuid:', error);
    throw new Error('Failed to fetch suggestion from database');
  } finally {
    connection.release();
  }
}

// Get single suggestion by ID (LEGACY - for backwards compatibility)
export async function getKvpSuggestionById(
  id: number,
  tenantId: number,
  userId: number,
  userRole: string,
): Promise<DbSuggestion | null> {
  const connection = await getDbConnection();
  try {
    let query = buildSuggestionQuery('s.id = $1 AND s.tenant_id = $2');
    const params: unknown[] = [id, tenantId];

    // Handle employee visibility
    if (userRole === 'employee') {
      const { teamId, departmentId } = await getUserOrgInfo(connection, userId, tenantId);
      const visibility = await buildEmployeeVisibility(
        connection,
        userId,
        tenantId,
        teamId,
        departmentId,
        3, // Start at $3
      );
      query += ' AND ' + visibility.conditions;
      params.push(...visibility.params);
    }

    const [rows] = await connection.execute<DbSuggestion[]>(query, params);
    return rows[0] ?? null;
  } catch (error: unknown) {
    console.error('[KVP Model] Database error in getKvpSuggestionById:', error);
    throw new Error('Failed to fetch suggestion from database');
  } finally {
    connection.release();
  }
}

// Update suggestion status (Admin only)
export async function updateKvpSuggestionStatus(
  id: number | string,
  tenantId: number,
  status: string,
  userId: number,
  changeReason: string | null = null,
): Promise<boolean> {
  const connection = await getDbConnection();
  try {
    await connection.beginTransaction();

    // Dual-ID support: Use uuid column for string IDs, id column for numeric IDs
    const idColumn = typeof id === 'string' ? 'uuid' : 'id';

    // Get current status and numeric ID for history
    const [currentRows] = await connection.execute<DbSuggestion[]>(
      `SELECT id, status FROM kvp_suggestions WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    const currentRow = currentRows[0];
    if (currentRow === undefined) {
      throw new Error('Suggestion not found');
    }

    const oldStatus = currentRow.status;
    const numericId = currentRow.id; // For foreign key in status_history table

    // Update suggestion
    const [result] = await connection.execute<ResultSetHeader>(
      `
        UPDATE kvp_suggestions
        SET status = $1, assigned_to = $2, updated_at = CURRENT_TIMESTAMP
        WHERE ${idColumn} = $3 AND tenant_id = $4
      `,
      [status, userId, id, tenantId],
    );

    // Add to history (uses numeric ID as foreign key)
    await connection.execute(
      `
        INSERT INTO kvp_status_history
        (suggestion_id, old_status, new_status, changed_by, change_reason)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [numericId, oldStatus, status, userId, changeReason],
    );

    await connection.commit();
    return result.affectedRows > 0;
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Add attachment to suggestion with tenant verification
export async function addKvpAttachment(
  suggestionId: number | string,
  tenantId: number,
  fileData: FileData,
  fileUuid: string, // NEW: UUID generated in controller (like document-explorer)
): Promise<FileData & { id: number; file_uuid: string }> {
  const connection = await getDbConnection();
  try {
    // Dual-ID support: Use uuid column for string IDs, id column for numeric IDs
    const idColumn = typeof suggestionId === 'string' ? 'uuid' : 'id';

    // Verify suggestion belongs to tenant and get numeric ID for foreign key
    const [suggestionCheck] = await connection.execute<DbSuggestion[]>(
      `SELECT id FROM kvp_suggestions WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [suggestionId, tenantId],
    );

    const suggestionRow = suggestionCheck[0];
    if (suggestionRow === undefined) {
      throw new Error('Suggestion not found or does not belong to tenant');
    }

    // Get numeric ID for foreign key in kvp_attachments table
    const numericId = suggestionRow.id;

    // Insert attachment with UUID provided by controller (uses numeric ID for foreign key)
    // PostgreSQL RETURNING returns rows array, not ResultSetHeader
    const [rows] = await connection.execute<{ id: number }[]>(
      `
        INSERT INTO kvp_attachments
        (file_uuid, suggestion_id, file_name, file_path, file_type, file_size, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `,
      [
        fileUuid, // Use UUID from controller
        numericId, // Use numeric ID for foreign key (not UUID parameter)
        fileData.file_name,
        fileData.file_path,
        fileData.file_type,
        fileData.file_size,
        fileData.uploaded_by,
      ],
    );
    if (rows.length === 0 || rows[0] === undefined) {
      throw new Error('Failed to add attachment: No ID returned from database');
    }

    return { id: rows[0].id, file_uuid: fileUuid, ...fileData };
  } finally {
    connection.release();
  }
}

// Get attachments for suggestion with tenant verification
export async function getKvpAttachments(
  suggestionId: number,
  tenantId: number,
): Promise<DbAttachment[]> {
  const connection = await getDbConnection();
  try {
    const [rows] = await connection.execute<DbAttachment[]>(
      `
        SELECT a.*, u.first_name, u.last_name
        FROM kvp_attachments a
        JOIN kvp_suggestions s ON a.suggestion_id = s.id
        LEFT JOIN users u ON a.uploaded_by = u.id
        WHERE a.suggestion_id = $1 AND s.tenant_id = $2
        ORDER BY a.uploaded_at DESC
      `,
      [suggestionId, tenantId],
    );

    return rows;
  } finally {
    connection.release();
  }
}

// Add comment to suggestion
export async function addKvpComment(
  suggestionId: number,
  tenantId: number,
  userId: number,
  comment: string,

  isInternal: boolean = false,
): Promise<number> {
  const connection = await getDbConnection();
  try {
    // PostgreSQL RETURNING returns rows array, not ResultSetHeader
    const [rows] = await connection.execute<{ id: number }[]>(
      `
        INSERT INTO kvp_comments
        (tenant_id, suggestion_id, user_id, comment, is_internal)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [tenantId, suggestionId, userId, comment, isInternal],
    );
    if (rows.length === 0 || rows[0] === undefined) {
      throw new Error('Failed to add comment: No ID returned from database');
    }

    return rows[0].id;
  } finally {
    connection.release();
  }
}

// Get comments for suggestion with tenant verification
export async function getKvpComments(
  suggestionId: number,
  tenantId: number,
  userRole: string,
): Promise<DbComment[]> {
  const connection = await getDbConnection();
  try {
    let query = `
        SELECT c.*, u.first_name, u.last_name, u.role
        FROM kvp_comments c
        JOIN kvp_suggestions s ON c.suggestion_id = s.id
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.suggestion_id = $1 AND s.tenant_id = $2
      `;

    // Hide internal comments from employees
    if (userRole === 'employee') {
      query += ' AND c.is_internal = FALSE';
    }

    query += ' ORDER BY c.created_at ASC';

    const [rows] = await connection.execute<DbComment[]>(query, [suggestionId, tenantId]);
    return rows;
  } finally {
    connection.release();
  }
}

// Get dashboard statistics
export async function getKvpDashboardStats(tenantId: number): Promise<DbDashboardStats> {
  const connection = await getDbConnection();
  try {
    const [stats] = await connection.execute<DashboardStatsResult[]>(
      `
        SELECT
          COUNT(*) as total_suggestions,
          COUNT(CASE WHEN status = 'new' THEN 1 END) as new_suggestions,
          COUNT(CASE WHEN status = 'in_review' THEN 1 END) as in_progress_count,
          COUNT(CASE WHEN status = 'implemented' THEN 1 END) as implemented,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
          CAST(AVG(CASE WHEN actual_savings IS NOT NULL THEN actual_savings END) AS DECIMAL(10,2)) as avg_savings
        FROM kvp_suggestions
        WHERE tenant_id = $1
      `,
      [tenantId],
    );

    // Convert numeric strings to numbers
    const result = stats[0];
    if (result === undefined) {
      return {
        total_suggestions: 0,
        new_suggestions: 0,
        in_progress: 0,
        in_progress_count: 0,
        implemented: 0,
        rejected: 0,
        avg_savings: null,
      } as DbDashboardStats;
    }

    return {
      total_suggestions: result.total_suggestions,
      new_suggestions: result.new_suggestions,
      in_progress: result.in_progress_count,
      in_progress_count: result.in_progress_count,
      implemented: result.implemented,
      rejected: result.rejected,
      avg_savings:
        result.avg_savings != null && result.avg_savings !== 0 ? result.avg_savings : null,
    } as DbDashboardStats;
  } finally {
    connection.release();
  }
}

// Update suggestion fields
// PostgreSQL: Dynamic $N parameter numbering
export async function updateKvpSuggestion(
  id: number | string,
  tenantId: number,
  updates: Partial<{
    title: string;
    description: string;
    category_id: number;
    priority: string;
    expected_benefit: string;
    estimated_cost: string;
    actual_savings: number;
  }>,
): Promise<boolean> {
  const connection = await getDbConnection();
  try {
    // Build dynamic UPDATE query
    const fields = Object.keys(updates);
    if (fields.length === 0) {
      return false;
    }

    // PostgreSQL: Dynamic parameter numbering
    const setClause = fields
      .map((field: string, index: number) => `${field} = $${index + 1}`)
      .join(', ');

    // Dual-ID support: Use uuid column for string IDs, id column for numeric IDs
    const idColumn = typeof id === 'string' ? 'uuid' : 'id';
    const idParamIndex = fields.length + 1;
    const tenantParamIndex = fields.length + 2;
    const values = [...Object.values(updates), id, tenantId];

    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE kvp_suggestions SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE ${idColumn} = $${idParamIndex} AND tenant_id = $${tenantParamIndex}`,
      values,
    );

    return result.affectedRows > 0;
  } finally {
    connection.release();
  }
}

// Delete suggestion and all related data (only by owner)
export async function deleteKvpSuggestion(
  suggestionId: number | string,
  tenantId: number,
  userId: number,
): Promise<boolean> {
  const connection = await getDbConnection();
  try {
    await connection.beginTransaction();

    // Dual-ID support: Use uuid column for string IDs, id column for numeric IDs
    const idColumn = typeof suggestionId === 'string' ? 'uuid' : 'id';

    // Verify ownership
    const [ownerCheck] = await connection.execute<DbSuggestion[]>(
      `
        SELECT id, submitted_by FROM kvp_suggestions
        WHERE ${idColumn} = $1 AND tenant_id = $2 AND submitted_by = $3
      `,
      [suggestionId, tenantId, userId],
    );

    const ownerRow = ownerCheck[0];
    if (ownerRow === undefined) {
      throw new Error('Suggestion not found or not owned by user');
    }

    // Get numeric ID for foreign key queries (attachments table uses numeric suggestion_id)
    const numericId = ownerRow.id;

    // Get all attachment file paths for deletion
    const [attachments] = await connection.execute<DbAttachment[]>(
      `
        SELECT file_path FROM kvp_attachments WHERE suggestion_id = $1
      `,
      [numericId],
    );

    // Delete database records (cascading will handle related records)
    await connection.execute(
      `DELETE FROM kvp_suggestions WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [suggestionId, tenantId],
    );

    await connection.commit();

    // Delete attachment files from filesystem
    for (const attachment of attachments) {
      try {
        // file_path is already absolute, use it directly
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path comes from database
        await fs.unlink(attachment.file_path);
      } catch {
        // Silently ignore file deletion errors
      }
    }

    return true;
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Helper to check if employee can access attachment
async function canEmployeeAccessAttachment(
  connection: PoolConnection,
  attachment: DbAttachment & {
    status?: string;
    org_level?: string;
    org_id?: number;
  },
  userId: number,
  tenantId: number,
): Promise<boolean> {
  // Can access their own suggestions
  if (attachment.submitted_by === userId) {
    return true;
  }

  // Can access implemented suggestions
  if (attachment.status === 'implemented') {
    return true;
  }

  // Company-wide suggestions are visible to all
  if (attachment.org_level === 'company') {
    return true;
  }

  // Need to check team/department membership
  if (attachment.org_level === 'team' || attachment.org_level === 'department') {
    const { teamId, departmentId } = await getUserOrgInfo(connection, userId, tenantId);

    if (attachment.org_level === 'team' && teamId === attachment.org_id) {
      return true;
    }

    if (attachment.org_level === 'department' && departmentId === attachment.org_id) {
      return true;
    }
  }

  return false;
}

// Get single attachment with access verification using UUID (secure downloads)
export async function getKvpAttachment(
  fileUuid: string,
  tenantId: number,
  userId: number,
  userRole: string,
): Promise<DbAttachment | null> {
  const connection = await getDbConnection();
  try {
    // Get attachment with full suggestion details using file_uuid (not ID for security)
    const [attachments] = await connection.execute<DbAttachment[]>(
      `
        SELECT a.*, s.submitted_by, s.tenant_id, s.org_level, s.org_id, s.status
        FROM kvp_attachments a
        JOIN kvp_suggestions s ON a.suggestion_id = s.id
        WHERE a.file_uuid = $1 AND s.tenant_id = $2
      `,
      [fileUuid, tenantId],
    );

    const attachment = attachments[0];
    if (attachment === undefined) {
      return null;
    }

    // Admins and root users can access all attachments
    if (userRole === 'admin' || userRole === 'root') {
      return attachment;
    }

    // For employees, check access permissions
    if (userRole === 'employee') {
      const attachmentExt = attachment as DbAttachment & {
        status?: string;
        org_level?: string;
        org_id?: number;
      };

      const hasAccess = await canEmployeeAccessAttachment(
        connection,
        attachmentExt,
        userId,
        tenantId,
      );
      if (hasAccess) {
        return attachment;
      }
    }

    // No access granted
    return null;
  } finally {
    connection.release();
  }
}

/**
 * Update the organization level of a suggestion
 * @param suggestionId - The suggestion ID
 * @param tenantId - The tenant ID
 * @param orgLevel - The organization level
 * @param orgId - The organization ID
 * @param sharedBy - The user ID who is sharing
 */
export async function updateSuggestionOrgLevel(
  suggestionId: number | string,
  tenantId: number,
  orgLevel: 'company' | 'department' | 'area' | 'team',
  orgId: number,
  sharedBy: number,
): Promise<void> {
  const conn = await getDbConnection();

  try {
    // Dual-ID support: Use uuid column for string IDs, id column for numeric IDs
    const idColumn = typeof suggestionId === 'string' ? 'uuid' : 'id';

    await conn.execute(
      `UPDATE kvp_suggestions
       SET org_level = $1,
           org_id = $2,
           is_shared = TRUE,
           shared_by = $3,
           shared_at = NOW(),
           updated_at = NOW()
       WHERE ${idColumn} = $4 AND tenant_id = $5`,
      [orgLevel, orgId, sharedBy, suggestionId, tenantId],
    );
  } finally {
    conn.release();
  }
}

/**
 * Unshare a suggestion (reset to private/team level)
 * @param suggestionId - The suggestion ID
 * @param tenantId - The tenant ID
 * @param teamId - The team ID to reset to
 */
export async function unshareSuggestion(
  suggestionId: number | string,
  tenantId: number,
  teamId: number,
): Promise<void> {
  const conn = await getDbConnection();

  try {
    // Dual-ID support: Use uuid column for string IDs, id column for numeric IDs
    const idColumn = typeof suggestionId === 'string' ? 'uuid' : 'id';

    await conn.execute(
      `UPDATE kvp_suggestions
       SET org_level = 'team',
           org_id = $1,
           is_shared = FALSE,
           shared_by = NULL,
           shared_at = NULL,
           updated_at = NOW()
       WHERE ${idColumn} = $2 AND tenant_id = $3`,
      [teamId, suggestionId, tenantId],
    );
  } finally {
    conn.release();
  }
}

// Backward compatibility object
const KVPModel = {
  getConnection,
  getCategories: getKvpCategories,
  createSuggestion: createKvpSuggestion,
  getSuggestions: getKvpSuggestions,
  getSuggestionById: getKvpSuggestionById,
  getSuggestionByUuid: getKvpSuggestionByUuid, // NEW: UUID-based lookup
  updateSuggestionStatus: updateKvpSuggestionStatus,
  updateSuggestionOrgLevel,
  unshareSuggestion,
  addAttachment: addKvpAttachment,
  getAttachments: getKvpAttachments,
  addComment: addKvpComment,
  getComments: getKvpComments,
  getDashboardStats: getKvpDashboardStats,
  updateSuggestion: updateKvpSuggestion,
  deleteSuggestion: deleteKvpSuggestion,
  getAttachment: getKvpAttachment,
};

// Default export
export default KVPModel;

// CommonJS compatibility
