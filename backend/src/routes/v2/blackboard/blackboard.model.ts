/* eslint-disable max-lines */
/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Blackboard Model
 * Handles database operations for the blackboard entries and confirmations
 */
import { v7 as uuidv7 } from 'uuid';

import { ResultSetHeader, RowDataPacket, query as executeQuery } from '../../../utils/db.js';
import { logger } from '../../../utils/logger.js';
import User from '../users/model/index.js';

// Database interfaces
interface DbBlackboardEntry extends RowDataPacket {
  id: number;
  uuid: string; // External UUIDv7 identifier for secure, SEO-friendly URLs
  tenant_id: number;
  title: string;
  content: string | Buffer | { type: 'Buffer'; data: number[] };
  org_level: 'company' | 'department' | 'team' | 'area';
  org_id: number;
  author_id: number;
  expires_at?: Date | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  color: string;
  status: 'active' | 'archived';
  created_at: Date;
  updated_at: Date;
  uuid_created_at?: Date; // Track when UUID was generated
  // Extended fields from joins
  author_name?: string;
  is_confirmed?: number;
  confirmed_at?: Date;
  author_first_name?: string;
  author_last_name?: string;
  author_full_name?: string;
  attachment_count?: number;
  comment_count?: number;
  // Note: attachments are fetched separately via documents API
}

// DEPRECATED: DbBlackboardAttachment removed - use documents API with blackboard_entry_id

interface DbConfirmationUser extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  confirmed: number;
  confirmed_at?: Date;
}

interface DbBlackboardComment extends RowDataPacket {
  id: number;
  tenant_id: number;
  entry_id: number;
  user_id: number;
  comment: string;
  is_internal: number;
  created_at: Date;
  // Extended fields from joins (match KVP format)
  user_name?: string;
  user_first_name?: string;
  user_last_name?: string;
  user_full_name?: string;
  user_role?: string;
  user_profile_picture?: string | null;
}

export interface EntryQueryOptions {
  status?: 'active' | 'archived';
  filter?: 'all' | 'company' | 'department' | 'team' | 'area';
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
  priority?: string;
}

export interface EntryCreateData {
  tenant_id: number;
  title: string;
  content: string;
  org_level: 'company' | 'department' | 'team' | 'area';
  org_id: number | null;
  area_id?: number | null;
  author_id: number;
  expires_at?: Date | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  color?: string;
}

export interface EntryUpdateData {
  title?: string;
  content?: string;
  org_level?: 'company' | 'department' | 'team' | 'area';
  org_id?: number | null;
  area_id?: number | null;
  expires_at?: Date | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  color?: string;
  status?: 'active' | 'archived';
  author_id?: number;
}

interface CountResult extends RowDataPacket {
  total: number;
}

/**
 * Apply access control filters based on user role and permissions
 * VISIBILITY-FIX: Now also filters for admins based on their area/department permissions
 */
function applyAccessControl(
  query: string,
  params: unknown[],
  role: string | null | undefined,
  departmentId: number | null | undefined,
  teamId: number | null | undefined,
  userId?: number,
  hasFullAccess?: boolean,
): { query: string; params: unknown[] } {
  // Root users or users with full access see everything
  if (role === 'root' || hasFullAccess === true) {
    return { query, params };
  }

  // Admin users: Filter by their area/department permissions
  if (role === 'admin' && userId !== undefined) {
    query += ` AND (
      -- Company-wide entries without specific org assignments
      (e.org_level = 'company' AND NOT EXISTS (
        SELECT 1 FROM blackboard_entry_organizations beo WHERE beo.entry_id = e.id
      ))
      OR
      -- Entries assigned to areas the admin has access to
      EXISTS (
        SELECT 1 FROM blackboard_entry_organizations beo
        JOIN admin_area_permissions aap ON beo.org_type = 'area' AND beo.org_id = aap.area_id
        WHERE beo.entry_id = e.id AND aap.admin_user_id = ?
      )
      OR
      -- Entries assigned to departments the admin has access to (direct or via area)
      EXISTS (
        SELECT 1 FROM blackboard_entry_organizations beo
        JOIN departments d ON beo.org_type = 'department' AND beo.org_id = d.id
        LEFT JOIN admin_area_permissions aap ON d.area_id = aap.area_id AND aap.admin_user_id = ?
        LEFT JOIN admin_department_permissions adp ON d.id = adp.department_id AND adp.admin_user_id = ?
        WHERE beo.entry_id = e.id AND (aap.id IS NOT NULL OR adp.id IS NOT NULL)
      )
      OR
      -- Entries assigned to teams in departments the admin has access to
      EXISTS (
        SELECT 1 FROM blackboard_entry_organizations beo
        JOIN teams t ON beo.org_type = 'team' AND beo.org_id = t.id
        JOIN departments d ON t.department_id = d.id
        LEFT JOIN admin_area_permissions aap ON d.area_id = aap.area_id AND aap.admin_user_id = ?
        LEFT JOIN admin_department_permissions adp ON d.id = adp.department_id AND adp.admin_user_id = ?
        WHERE beo.entry_id = e.id AND (aap.id IS NOT NULL OR adp.id IS NOT NULL)
      )
    )`;
    params.push(userId, userId, userId, userId, userId);
    return { query, params };
  }

  // Employee users: Filter by their department/team
  query += ` AND (
    e.org_level = 'company' OR
    (e.org_level = 'department' AND e.org_id = ?) OR
    (e.org_level = 'team' AND e.org_id = ?)
  )`;
  params.push(departmentId ?? 0, teamId ?? 0);

  return { query, params };
}

/**
 * Build query filters for blackboard entries
 * VISIBILITY-FIX: Added userId and hasFullAccess for admin filtering
 */
function buildQueryFilters(
  query: string,
  params: unknown[],
  options: {
    filter?: string;
    search?: string;
    priority?: string;
    role?: string | null;
    departmentId?: number | null;
    teamId?: number | null;
    userId?: number;
    hasFullAccess?: boolean;
  },
): { query: string; params: unknown[] } {
  let updatedQuery = query;
  const updatedParams = [...params];

  // Apply org level filter
  if (options.filter !== undefined && options.filter !== 'all') {
    updatedQuery += ' AND e.org_level = ?';
    updatedParams.push(options.filter);
  }

  // Apply access control based on role and permissions
  const accessResult = applyAccessControl(
    updatedQuery,
    updatedParams,
    options.role,
    options.departmentId,
    options.teamId,
    options.userId,
    options.hasFullAccess,
  );
  updatedQuery = accessResult.query;

  // Apply search filter
  if (options.search !== undefined && options.search !== '') {
    updatedQuery += ' AND (e.title LIKE ? OR e.content LIKE ?)';
    const searchTerm = `%${options.search}%`;
    updatedParams.push(searchTerm, searchTerm);
  }

  // Apply priority filter
  if (options.priority !== undefined && options.priority !== '') {
    updatedQuery += ' AND e.priority = ?';
    updatedParams.push(options.priority);
  }

  return { query: updatedQuery, params: updatedParams };
}

/**
 * Process entries to convert content
 * Note: Attachments are fetched separately via documents API
 */
/**
 * Convert Buffer content to UTF-8 string for a single entry
 * Handles both Buffer and serialized Buffer object formats
 */
function processEntryContent(entry: DbBlackboardEntry): void {
  if (Buffer.isBuffer(entry.content)) {
    entry.content = entry.content.toString('utf8');
    return;
  }

  const content = entry.content;
  if (typeof content === 'object' && 'type' in content && Array.isArray(content.data)) {
    entry.content = Buffer.from(content.data).toString('utf8');
  }
}

function processEntries(entries: DbBlackboardEntry[]): void {
  for (const entry of entries) {
    processEntryContent(entry);
    // Attachments are now fetched separately via /api/v2/blackboard/entries/:id/attachments
    // which uses the documents table with blackboard_entry_id
  }
}

/**
 * Get total count of entries for pagination
 * VISIBILITY-FIX: Added userId and hasFullAccess for admin filtering
 */
async function getTotalEntriesCount(
  tenant_id: number,
  status: string,
  filter: string,
  search: string,
  role: string | null,
  departmentId: number | null,
  teamId: number | null,
  userId?: number,
  hasFullAccess?: boolean,
): Promise<number> {
  const countQuery = `
    SELECT COUNT(*) as total
    FROM blackboard_entries e
    WHERE e.tenant_id = ? AND e.status = ?
  `;
  const countBaseParams: unknown[] = [tenant_id, status];

  // Build filters without undefined properties (exactOptionalPropertyTypes)
  // VISIBILITY-FIX: Include userId and hasFullAccess for admin filtering
  const countFilters: {
    filter?: string;
    search?: string;
    priority?: string;
    role?: string | null;
    departmentId?: number | null;
    teamId?: number | null;
    userId?: number;
    hasFullAccess?: boolean;
  } = { filter, search, role, departmentId, teamId };

  // Only add userId and hasFullAccess if defined
  if (userId !== undefined) {
    countFilters.userId = userId;
  }
  if (hasFullAccess !== undefined) {
    countFilters.hasFullAccess = hasFullAccess;
  }

  const { query: filteredCountQuery, params: countParams } = buildQueryFilters(
    countQuery,
    countBaseParams,
    countFilters,
  );

  const [countResult] = await executeQuery<CountResult[]>(filteredCountQuery, countParams);
  const firstResult = countResult[0];
  return firstResult !== undefined ? firstResult.total : 0;
}

/**
 * Fetch entries with filters and pagination
 * VISIBILITY-FIX: Added hasFullAccess for admin filtering
 */
async function fetchEntries(
  tenant_id: number,
  userId: number,
  status: string,
  filter: string,
  search: string,
  priority: string | undefined,
  role: string | null,
  departmentId: number | null,
  teamId: number | null,
  sortBy: string,
  sortDir: 'ASC' | 'DESC',
  page: number,
  limit: number,
  hasFullAccess: boolean,
): Promise<DbBlackboardEntry[]> {
  const baseQuery = `
    SELECT e.id, e.uuid, e.tenant_id, e.title, e.content, e.org_level, e.org_id, e.author_id,
           e.expires_at, e.priority, e.color, e.status,
           e.created_at, e.updated_at, e.uuid_created_at,
           u.username as author_name,
           u.first_name as author_first_name,
           u.last_name as author_last_name,
           CONCAT(u.first_name, ' ', u.last_name) as author_full_name,
           CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END as is_confirmed,
           c.confirmed_at as confirmed_at,
           (SELECT COUNT(*) FROM documents WHERE blackboard_entry_id = e.id) as attachment_count,
           (SELECT COUNT(*) FROM blackboard_comments WHERE entry_id = e.id) as comment_count
    FROM blackboard_entries e
    LEFT JOIN users u ON e.author_id = u.id AND u.tenant_id = e.tenant_id
    LEFT JOIN blackboard_confirmations c ON e.id = c.entry_id AND c.user_id = ?
    WHERE e.tenant_id = ? AND e.status = ?
  `;

  const baseParams: unknown[] = [userId, tenant_id, status];

  // Build filters without undefined properties (exactOptionalPropertyTypes)
  // VISIBILITY-FIX: Include userId and hasFullAccess for admin filtering
  const entryFilters: {
    filter?: string;
    search?: string;
    priority?: string;
    role?: string | null;
    departmentId?: number | null;
    teamId?: number | null;
    userId?: number;
    hasFullAccess?: boolean;
  } = { filter, search, role, departmentId, teamId, userId, hasFullAccess };

  // Only add priority if defined
  if (priority !== undefined) {
    entryFilters.priority = priority;
  }

  const { query: filteredQuery, params: queryParams } = buildQueryFilters(
    baseQuery,
    baseParams,
    entryFilters,
  );
  const finalQuery = `${filteredQuery} ORDER BY e.priority = 'urgent' DESC, e.priority = 'high' DESC, e.${sortBy} ${sortDir} LIMIT ? OFFSET ?`;
  queryParams.push(Number.parseInt(limit.toString(), 10), (page - 1) * limit);
  const [entries] = await executeQuery<DbBlackboardEntry[]>(finalQuery, queryParams);
  return entries;
}

/**
 * Log debug info when no entries found
 */
function logNoEntriesFound(
  userId: number,
  role: string | null,
  tenantId: number,
  status: string,
  filter: string,
  departmentId: number | null,
  teamId: number | null,
): void {
  logger.warn(
    `[Blackboard.getAllEntries] No entries found for user ${userId} (role: ${String(role)})`,
  );
  logger.debug(`Query params: tenant_id=${tenantId}, status=${status}, filter=${filter}`);
  logger.debug(`User access: departmentId=${String(departmentId)}, teamId=${String(teamId)}`);
}

/** Build pagination response object */
function buildPaginationResponse(
  entries: DbBlackboardEntry[],
  total: number,
  page: number,
  limit: number,
): {
  entries: DbBlackboardEntry[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
} {
  return {
    entries,
    pagination: {
      total,
      page: Number.parseInt(page.toString(), 10),
      limit: Number.parseInt(limit.toString(), 10),
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get all blackboard entries visible to the user
 * VISIBILITY-FIX: Now uses hasFullAccess for admin filtering
 */
export async function getAllEntries(
  tenant_id: number,
  userId: number,
  options: EntryQueryOptions = {},
): Promise<unknown> {
  try {
    const {
      status = 'active',
      filter = 'all',
      search = '',
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortDir = 'DESC',
      priority,
    } = options;
    const { role, departmentId, teamId, hasFullAccess } =
      await User.getUserDepartmentAndTeam(userId);

    const entries = await fetchEntries(
      tenant_id,
      userId,
      status,
      filter,
      search,
      priority,
      role,
      departmentId,
      teamId,
      sortBy,
      sortDir,
      page,
      limit,
      hasFullAccess,
    );

    if (entries.length === 0 && status === 'active') {
      logNoEntriesFound(userId, role, tenant_id, status, filter, departmentId, teamId);
    }
    processEntries(entries);

    const totalEntries = await getTotalEntriesCount(
      tenant_id,
      status,
      filter,
      search,
      role,
      departmentId,
      teamId,
      userId,
      hasFullAccess,
    );
    return buildPaginationResponse(entries, totalEntries, page, limit);
  } catch (error: unknown) {
    logger.error('Error in getAllEntries:', error);
    throw error;
  }
}

/**
 * Check if user has access to entry (for employees)
 */
function checkEmployeeEntryAccess(
  entry: DbBlackboardEntry,
  departmentId: number | null,
  teamId: number | null,
): boolean {
  return (
    entry.org_level === 'company' ||
    (entry.org_level === 'department' && entry.org_id === departmentId) ||
    (entry.org_level === 'team' && entry.org_id === teamId)
  );
}

/**
 * Check if admin has access to entry based on area/department permissions
 * VISIBILITY-FIX: New function to check admin permissions against database
 */
async function checkAdminEntryAccess(
  entryId: number,
  userId: number,
  tenantId: number,
): Promise<boolean> {
  // Check if entry has no org assignments (company-wide)
  const [noAssignments] = await executeQuery<RowDataPacket[]>(
    `SELECT 1 FROM blackboard_entries e
     WHERE e.id = ? AND e.tenant_id = ?
     AND NOT EXISTS (SELECT 1 FROM blackboard_entry_organizations WHERE entry_id = e.id)`,
    [entryId, tenantId],
  );
  if (noAssignments.length > 0) {
    return true;
  }

  // Check if entry is assigned to areas the admin has access to
  const [areaAccess] = await executeQuery<RowDataPacket[]>(
    `SELECT 1 FROM blackboard_entry_organizations beo
     JOIN admin_area_permissions aap ON beo.org_type = 'area' AND beo.org_id = aap.area_id
     WHERE beo.entry_id = ? AND aap.admin_user_id = ?`,
    [entryId, userId],
  );
  if (areaAccess.length > 0) {
    return true;
  }

  // Check if entry is assigned to departments the admin has access to (direct or via area)
  const [deptAccess] = await executeQuery<RowDataPacket[]>(
    `SELECT 1 FROM blackboard_entry_organizations beo
     JOIN departments d ON beo.org_type = 'department' AND beo.org_id = d.id
     LEFT JOIN admin_area_permissions aap ON d.area_id = aap.area_id AND aap.admin_user_id = ?
     LEFT JOIN admin_department_permissions adp ON d.id = adp.department_id AND adp.admin_user_id = ?
     WHERE beo.entry_id = ? AND (aap.id IS NOT NULL OR adp.id IS NOT NULL)`,
    [userId, userId, entryId],
  );
  if (deptAccess.length > 0) {
    return true;
  }

  // Check if entry is assigned to teams the admin has access to
  const [teamAccess] = await executeQuery<RowDataPacket[]>(
    `SELECT 1 FROM blackboard_entry_organizations beo
     JOIN teams t ON beo.org_type = 'team' AND beo.org_id = t.id
     JOIN departments d ON t.department_id = d.id
     LEFT JOIN admin_area_permissions aap ON d.area_id = aap.area_id AND aap.admin_user_id = ?
     LEFT JOIN admin_department_permissions adp ON d.id = adp.department_id AND adp.admin_user_id = ?
     WHERE beo.entry_id = ? AND (aap.id IS NOT NULL OR adp.id IS NOT NULL)`,
    [userId, userId, entryId],
  );
  if (teamAccess.length > 0) {
    return true;
  }

  return false;
}

/** User access info for entry visibility checks */
interface EntryAccessContext {
  role: string | null;
  hasFullAccess: boolean;
  userId: number;
  tenantId: number;
  departmentId: number | null;
  teamId: number | null;
}

/**
 * Check if user has access to a blackboard entry based on role and permissions
 * Centralizes all visibility logic for getEntryById and getEntryByUuid
 */
async function hasEntryAccess(entry: DbBlackboardEntry, ctx: EntryAccessContext): Promise<boolean> {
  // Root users and users with full access can see everything
  if (ctx.role === 'root' || ctx.hasFullAccess) {
    return true;
  }

  // Admin users: Check permissions against assigned areas/departments
  if (ctx.role === 'admin') {
    return await checkAdminEntryAccess(entry.id, ctx.userId, ctx.tenantId);
  }

  // Employee users: Check based on department/team
  return checkEmployeeEntryAccess(entry, ctx.departmentId, ctx.teamId);
}

/**
 * Get a specific blackboard entry by ID
 * VISIBILITY-FIX: Now uses hasFullAccess and proper admin permission checks
 */
export async function getEntryById(
  id: number,
  tenant_id: number,
  userId: number,
): Promise<DbBlackboardEntry | null> {
  try {
    // Determine user's department and team for access control
    // VISIBILITY-FIX: Also get hasFullAccess for admin filtering
    const { role, departmentId, teamId, hasFullAccess } =
      await User.getUserDepartmentAndTeam(userId);

    // Query the entry with confirmation status
    const query = `
        SELECT e.id, e.uuid, e.tenant_id, e.title, e.content, e.org_level, e.org_id, e.author_id,
               e.expires_at, e.priority, e.color, e.status,
               e.created_at, e.updated_at, e.uuid_created_at,
               u.username as author_name,
               u.first_name as author_first_name,
               u.last_name as author_last_name,
               CONCAT(u.first_name, ' ', u.last_name) as author_full_name,
               CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END as is_confirmed,
               c.confirmed_at as confirmed_at,
               (SELECT COUNT(*) FROM documents WHERE blackboard_entry_id = e.id) as attachment_count,
               (SELECT COUNT(*) FROM blackboard_comments WHERE entry_id = e.id) as comment_count
        FROM blackboard_entries e
        LEFT JOIN users u ON e.author_id = u.id AND u.tenant_id = e.tenant_id
        LEFT JOIN blackboard_confirmations c ON e.id = c.entry_id AND c.user_id = ?
        WHERE e.id = ? AND e.tenant_id = ?
      `;

    const [entries] = await executeQuery<DbBlackboardEntry[]>(query, [userId, id, tenant_id]);

    const entry = entries[0];
    if (entry === undefined) {
      return null;
    }

    processEntryContent(entry);

    // VISIBILITY-FIX: Check access control based on role and permissions
    const accessCtx: EntryAccessContext = {
      role,
      hasFullAccess,
      userId,
      tenantId: tenant_id,
      departmentId,
      teamId,
    };

    if (!(await hasEntryAccess(entry, accessCtx))) {
      return null;
    }

    // Attachments are fetched separately via documents API

    return entry;
  } catch (error: unknown) {
    logger.error('Error in getEntryById:', error);
    throw error;
  }
}

/**
 * Get a specific blackboard entry by UUID
 * VISIBILITY-FIX: Now uses hasFullAccess and proper admin permission checks
 */
export async function getEntryByUuid(
  uuid: string,
  tenant_id: number,
  userId: number,
): Promise<DbBlackboardEntry | null> {
  try {
    // Determine user's department and team for access control
    // VISIBILITY-FIX: Also get hasFullAccess for admin filtering
    const { role, departmentId, teamId, hasFullAccess } =
      await User.getUserDepartmentAndTeam(userId);

    // Query the entry with confirmation status
    const query = `
        SELECT e.id, e.uuid, e.tenant_id, e.title, e.content, e.org_level, e.org_id, e.author_id,
               e.expires_at, e.priority, e.color, e.status,
               e.created_at, e.updated_at, e.uuid_created_at,
               u.username as author_name,
               u.first_name as author_first_name,
               u.last_name as author_last_name,
               CONCAT(u.first_name, ' ', u.last_name) as author_full_name,
               CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END as is_confirmed,
               c.confirmed_at as confirmed_at,
               (SELECT COUNT(*) FROM documents WHERE blackboard_entry_id = e.id) as attachment_count,
               (SELECT COUNT(*) FROM blackboard_comments WHERE entry_id = e.id) as comment_count
        FROM blackboard_entries e
        LEFT JOIN users u ON e.author_id = u.id AND u.tenant_id = e.tenant_id
        LEFT JOIN blackboard_confirmations c ON e.id = c.entry_id AND c.user_id = ?
        WHERE e.uuid = ? AND e.tenant_id = ?
      `;

    const [entries] = await executeQuery<DbBlackboardEntry[]>(query, [userId, uuid, tenant_id]);

    const entry = entries[0];
    if (entry === undefined) {
      return null;
    }

    processEntryContent(entry);

    // VISIBILITY-FIX: Check access control based on role and permissions
    const accessCtx: EntryAccessContext = {
      role,
      hasFullAccess,
      userId,
      tenantId: tenant_id,
      departmentId,
      teamId,
    };

    if (!(await hasEntryAccess(entry, accessCtx))) {
      return null;
    }

    // Attachments are fetched separately via documents API

    return entry;
  } catch (error: unknown) {
    logger.error('Error in getEntryByUuid:', error);
    throw error;
  }
}

/**
 * Create a new blackboard entry
 */
export async function createEntry(entryData: EntryCreateData): Promise<DbBlackboardEntry | null> {
  try {
    const {
      tenant_id,
      title,
      content,
      org_level,
      org_id,
      area_id = null,
      author_id,
      expires_at = null,
      priority = 'medium',
      color = 'blue',
    } = entryData;

    // Validate required fields
    if (typeof tenant_id !== 'number' || tenant_id === 0 || title === '' || content === '') {
      throw new Error('Missing required fields');
    }

    // Validate org_id based on org_level (not required for area level with area_id)
    if (org_level !== 'company' && org_level !== 'area' && org_id == null) {
      throw new Error('org_id is required for department or team level entries');
    }

    // Generate UUIDv7 for external identifier (secure, time-sortable)
    const uuid = uuidv7();

    // Insert new entry with area_id support
    const query = `
        INSERT INTO blackboard_entries
        (uuid, tenant_id, title, content, org_level, org_id, area_id, author_id, expires_at, priority, color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

    const [result] = await executeQuery<ResultSetHeader>(query, [
      uuid,
      tenant_id,
      title,
      content,
      org_level,
      org_id,
      area_id,
      author_id,
      expires_at,
      priority,
      color,
    ]);

    // Get the created entry
    return await getEntryById(result.insertId, tenant_id, author_id);
  } catch (error: unknown) {
    logger.error('Error in createEntry:', error);
    throw error;
  }
}

/**
 * Build update query for entry fields
 */
function buildUpdateQuery(entryData: EntryUpdateData): { query: string; params: unknown[] } {
  let query = 'UPDATE blackboard_entries SET updated_at = NOW()';
  const queryParams: unknown[] = [];

  type EntryValue = string | number | boolean | Date | null | string[] | undefined;

  const fields: [keyof EntryUpdateData, string, (val: EntryValue) => unknown][] = [
    ['title', 'title', (v: EntryValue) => v],
    ['content', 'content', (v: EntryValue) => v],
    ['org_level', 'org_level', (v: EntryValue) => v],
    ['org_id', 'org_id', (v: EntryValue) => v],
    ['area_id', 'area_id', (v: EntryValue) => v],
    ['expires_at', 'expires_at', (v: EntryValue) => v],
    ['priority', 'priority', (v: EntryValue) => v],
    ['color', 'color', (v: EntryValue) => v],
    ['status', 'status', (v: EntryValue) => v],
  ];

  for (const [key, column, transform] of fields) {
    // eslint-disable-next-line security/detect-object-injection -- key is from predefined array, not user input
    const value = entryData[key];
    if (value !== undefined) {
      query += `, ${column} = ?`;
      queryParams.push(transform(value as EntryValue));
    }
  }

  return { query, params: queryParams };
}

/**
 * Update a blackboard entry
 */
export async function updateEntry(
  id: number | string,
  entryData: EntryUpdateData,
  tenant_id: number,
): Promise<DbBlackboardEntry | null> {
  try {
    // Build update query
    const { query, params } = buildUpdateQuery(entryData);

    // Dual-ID support: Use uuid column for string IDs, id column for numeric IDs
    const idColumn = typeof id === 'string' ? 'uuid' : 'id';

    // Finish query
    const finalQuery = query + ` WHERE ${idColumn} = ? AND tenant_id = ?`;
    params.push(id, tenant_id);

    // Execute update
    await executeQuery(finalQuery, params);

    // Get numeric ID for fetching result
    let numericId: number;
    if (typeof id === 'string') {
      const [entries] = await executeQuery<DbBlackboardEntry[]>(
        'SELECT id FROM blackboard_entries WHERE uuid = ? AND tenant_id = ?',
        [id, tenant_id],
      );
      const foundEntry = entries[0];
      if (foundEntry === undefined) return null;
      numericId = foundEntry.id;
    } else {
      numericId = id;
    }

    // Get the updated entry
    return await getEntryById(numericId, tenant_id, entryData.author_id ?? 0);
  } catch (error: unknown) {
    logger.error('Error in updateEntry:', error);
    throw error;
  }
}

/**
 * Delete a blackboard entry
 */
export async function deleteEntry(id: number | string, tenant_id: number): Promise<boolean> {
  try {
    // Dual-ID support: Use uuid column for string IDs, id column for numeric IDs
    const idColumn = typeof id === 'string' ? 'uuid' : 'id';

    // Delete entry
    const query = `DELETE FROM blackboard_entries WHERE ${idColumn} = ? AND tenant_id = ?`;
    const [result] = await executeQuery<ResultSetHeader>(query, [id, tenant_id]);

    return result.affectedRows > 0;
  } catch (error: unknown) {
    logger.error('Error in deleteEntry:', error);
    throw error;
  }
}

/**
 * Confirm a blackboard entry as read
 */
export async function confirmEntry(entryId: number | string, userId: number): Promise<boolean> {
  try {
    // Get user's tenant_id
    interface UserRow extends RowDataPacket {
      tenant_id: number;
    }
    const [users] = await executeQuery<UserRow[]>('SELECT tenant_id FROM users WHERE id = ?', [
      userId,
    ]);
    const userRow = users[0];
    if (userRow === undefined) {
      return false; // User doesn't exist
    }
    const userTenantId = userRow.tenant_id;

    // Dual-ID support: Use uuid column for string IDs, id column for numeric IDs
    const idColumn = typeof entryId === 'string' ? 'uuid' : 'id';

    // Check if entry exists and belongs to same tenant
    const [entries] = await executeQuery<DbBlackboardEntry[]>(
      `SELECT id FROM blackboard_entries WHERE ${idColumn} = ? AND tenant_id = ?`,
      [entryId, userTenantId],
    );

    const entryRow = entries[0];
    if (entryRow === undefined) {
      return false; // Entry doesn't exist or wrong tenant
    }

    const numericId = entryRow.id;

    // Check if already confirmed
    const [confirmations] = await executeQuery<RowDataPacket[]>(
      'SELECT * FROM blackboard_confirmations WHERE entry_id = ? AND user_id = ?',
      [numericId, userId],
    );

    if (confirmations.length > 0) {
      return true; // Already confirmed
    }

    // Add confirmation
    await executeQuery(
      'INSERT INTO blackboard_confirmations (tenant_id, entry_id, user_id) VALUES (?, ?, ?)',
      [userTenantId, numericId, userId],
    );

    return true;
  } catch (error: unknown) {
    logger.error('Error in confirmEntry:', error);
    throw error;
  }
}

/**
 * Remove confirmation (mark as unread)
 */
export async function unconfirmEntry(entryId: number | string, userId: number): Promise<boolean> {
  try {
    // Get user's tenant_id
    interface UserRow extends RowDataPacket {
      tenant_id: number;
    }
    const [users] = await executeQuery<UserRow[]>('SELECT tenant_id FROM users WHERE id = ?', [
      userId,
    ]);
    const userRow = users[0];
    if (userRow === undefined) {
      return false;
    }
    const userTenantId = userRow.tenant_id;

    // Dual-ID support: Use uuid column for string IDs, id column for numeric IDs
    const idColumn = typeof entryId === 'string' ? 'uuid' : 'id';

    // Get numeric entry ID
    const [entries] = await executeQuery<DbBlackboardEntry[]>(
      `SELECT id FROM blackboard_entries WHERE ${idColumn} = ? AND tenant_id = ?`,
      [entryId, userTenantId],
    );

    const entryRow = entries[0];
    if (entryRow === undefined) {
      return false;
    }

    const numericId = entryRow.id;

    // Delete confirmation
    const [result] = await executeQuery<ResultSetHeader>(
      'DELETE FROM blackboard_confirmations WHERE entry_id = ? AND user_id = ?',
      [numericId, userId],
    );

    return result.affectedRows > 0;
  } catch (error: unknown) {
    logger.error('Error in unconfirmEntry:', error);
    throw error;
  }
}

/**
 * Get confirmation status for an entry
 */
export async function getConfirmationStatus(
  entryId: number | string,
  tenant_id: number,
): Promise<DbConfirmationUser[]> {
  try {
    // Dual-ID support: Use uuid column for string IDs, id column for numeric IDs
    const idColumn = typeof entryId === 'string' ? 'uuid' : 'id';

    // Get the entry first
    const [entries] = await executeQuery<DbBlackboardEntry[]>(
      `SELECT id, org_level, org_id FROM blackboard_entries WHERE ${idColumn} = ? AND tenant_id = ?`,
      [entryId, tenant_id],
    );

    const entry = entries[0];
    if (entry === undefined) {
      return [];
    }

    const numericId = entry.id;

    // Get all users who should see this entry
    let usersQuery = `
        SELECT u.id, u.username, u.email, u.first_name, u.last_name,
               CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END as confirmed,
               c.confirmed_at
        FROM users u
        LEFT JOIN blackboard_confirmations c ON u.id = c.user_id AND c.entry_id = ?
        WHERE u.tenant_id = ?
      `;

    const queryParams: unknown[] = [numericId, tenant_id];

    // Filter by org level
    // N:M REFACTORING: department filter now uses user_departments table
    if (entry.org_level === 'department') {
      usersQuery +=
        ' AND u.id IN (SELECT ud.user_id FROM user_departments ud WHERE ud.department_id = ? AND ud.tenant_id = u.tenant_id)';
      queryParams.push(entry.org_id);
    } else if (entry.org_level === 'team') {
      usersQuery +=
        ' AND u.id IN (SELECT ut.user_id FROM user_teams ut WHERE ut.team_id = ? AND ut.tenant_id = u.tenant_id)';
      queryParams.push(entry.org_id);
    }

    const [users] = await executeQuery<DbConfirmationUser[]>(usersQuery, queryParams);

    return users;
  } catch (error: unknown) {
    logger.error('Error in getConfirmationStatus:', error);
    throw error;
  }
}

// ============================================================================
// Dashboard Query Builder Helpers
// ============================================================================

/**
 * Base SELECT query for dashboard entries
 * Placeholders: userId (for confirmations), tenant_id (for filtering)
 */
const DASHBOARD_BASE_QUERY = `
  SELECT e.id, e.uuid, e.tenant_id, e.title, e.content, e.org_level, e.org_id, e.author_id,
         e.expires_at, e.priority, e.color, e.status,
         e.created_at, e.updated_at, e.uuid_created_at,
         u.username as author_name,
         u.first_name as author_first_name,
         u.last_name as author_last_name,
         CONCAT(u.first_name, ' ', u.last_name) as author_full_name,
         CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END as is_confirmed,
         c.confirmed_at as confirmed_at,
         (SELECT COUNT(*) FROM documents WHERE blackboard_entry_id = e.id) as attachment_count,
         (SELECT COUNT(*) FROM blackboard_comments WHERE entry_id = e.id) as comment_count
  FROM blackboard_entries e
  LEFT JOIN users u ON e.author_id = u.id AND u.tenant_id = e.tenant_id
  LEFT JOIN blackboard_confirmations c ON e.id = c.entry_id AND c.user_id = ?
  WHERE e.tenant_id = ? AND e.status = 'active'
`;

/**
 * Admin visibility filter SQL fragment
 * Checks area, department, and team permissions for admin users
 */
const ADMIN_VISIBILITY_FILTER = ` AND (
  (e.org_level = 'company' AND NOT EXISTS (
    SELECT 1 FROM blackboard_entry_organizations beo WHERE beo.entry_id = e.id
  ))
  OR EXISTS (
    SELECT 1 FROM blackboard_entry_organizations beo
    JOIN admin_area_permissions aap ON beo.org_type = 'area' AND beo.org_id = aap.area_id
    WHERE beo.entry_id = e.id AND aap.admin_user_id = ?
  )
  OR EXISTS (
    SELECT 1 FROM blackboard_entry_organizations beo
    JOIN departments d ON beo.org_type = 'department' AND beo.org_id = d.id
    LEFT JOIN admin_area_permissions aap ON d.area_id = aap.area_id AND aap.admin_user_id = ?
    LEFT JOIN admin_department_permissions adp ON d.id = adp.department_id AND adp.admin_user_id = ?
    WHERE beo.entry_id = e.id AND (aap.id IS NOT NULL OR adp.id IS NOT NULL)
  )
  OR EXISTS (
    SELECT 1 FROM blackboard_entry_organizations beo
    JOIN teams t ON beo.org_type = 'team' AND beo.org_id = t.id
    JOIN departments d ON t.department_id = d.id
    LEFT JOIN admin_area_permissions aap ON d.area_id = aap.area_id AND aap.admin_user_id = ?
    LEFT JOIN admin_department_permissions adp ON d.id = adp.department_id AND adp.admin_user_id = ?
    WHERE beo.entry_id = e.id AND (aap.id IS NOT NULL OR adp.id IS NOT NULL)
  )
)`;

/**
 * Build visibility filter based on user role
 * @returns SQL fragment and parameters for the visibility filter
 */
function buildVisibilityFilter(
  role: string | null,
  userId: number,
  departmentId: number | null,
  teamId: number | null,
  hasFullAccess: boolean,
): { sql: string; params: unknown[] } {
  // Root users or users with full access see everything
  if (role === 'root' || hasFullAccess) {
    return { sql: '', params: [] };
  }

  // Admin users: complex permission-based filter
  if (role === 'admin') {
    return {
      sql: ADMIN_VISIBILITY_FILTER,
      params: [userId, userId, userId, userId, userId],
    };
  }

  // Employee users: simple department/team filter
  return {
    sql: ` AND (
      e.org_level = 'company' OR
      (e.org_level = 'department' AND e.org_id = ?) OR
      (e.org_level = 'team' AND e.org_id = ?)
    )`,
    params: [departmentId ?? 0, teamId ?? 0],
  };
}

/**
 * Build dashboard query based on user role
 * VISIBILITY-FIX: Added hasFullAccess for admin filtering
 */
function buildDashboardQuery(
  userId: number,
  tenant_id: number,
  role: string | null,
  departmentId: number | null,
  teamId: number | null,
  limit: number,
  hasFullAccess: boolean,
): { query: string; params: unknown[] } {
  const baseParams: unknown[] = [userId, tenant_id];
  const visibility = buildVisibilityFilter(role, userId, departmentId, teamId, hasFullAccess);

  const orderClause = `
    ORDER BY e.priority = 'urgent' DESC, e.priority = 'high' DESC, e.created_at DESC
    LIMIT ?
  `;

  return {
    query: DASHBOARD_BASE_QUERY + visibility.sql + orderClause,
    params: [...baseParams, ...visibility.params, Number.parseInt(limit.toString(), 10)],
  };
}

/**
 * Get dashboard entries for a user
 * VISIBILITY-FIX: Now uses hasFullAccess for admin filtering
 */
export async function getDashboardEntries(
  tenant_id: number,
  userId: number,
  // eslint-disable-next-line @typescript-eslint/typedef -- Default parameter with literal value
  limit = 3,
): Promise<DbBlackboardEntry[]> {
  try {
    // Get user info for access control
    // VISIBILITY-FIX: Also get hasFullAccess for admin filtering
    const { role, departmentId, teamId, hasFullAccess } =
      await User.getUserDepartmentAndTeam(userId);

    // Build and execute query with visibility filtering
    const { query, params } = buildDashboardQuery(
      userId,
      tenant_id,
      role,
      departmentId,
      teamId,
      limit,
      hasFullAccess,
    );
    const [entries] = await executeQuery<DbBlackboardEntry[]>(query, params);

    // Process entries (convert buffers and load attachments)
    processEntries(entries);

    return entries;
  } catch (error: unknown) {
    logger.error('Error in getDashboardEntries:', error);
    throw error;
  }
}

// DEPRECATED: Attachment functions removed - use documents API with blackboard_entry_id
// See: /api/v2/blackboard/entries/:id/attachments which uses documentsService

// ============================================================================
// Comment Methods (NEW 2025-11-24)
// ============================================================================

/**
 * Get comments for a blackboard entry
 * @param entryId - The entry ID (numeric or UUID)
 * @param tenantId - The tenant ID
 */
export async function getComments(
  entryId: number | string,
  tenantId: number,
): Promise<DbBlackboardComment[]> {
  try {
    // Dual-ID support: Get numeric ID from UUID if string
    let numericId: number;
    if (typeof entryId === 'string') {
      const [entries] = await executeQuery<DbBlackboardEntry[]>(
        'SELECT id FROM blackboard_entries WHERE uuid = ? AND tenant_id = ?',
        [entryId, tenantId],
      );
      const foundEntry = entries[0];
      if (foundEntry === undefined) {
        return [];
      }
      numericId = foundEntry.id;
    } else {
      numericId = entryId;
    }

    const [comments] = await executeQuery<DbBlackboardComment[]>(
      `SELECT c.id, c.tenant_id, c.entry_id, c.user_id, c.comment, c.is_internal, c.created_at,
              u.username as user_name,
              u.first_name as user_first_name,
              u.last_name as user_last_name,
              CONCAT(u.first_name, ' ', u.last_name) as user_full_name,
              u.role as user_role,
              u.profile_picture as user_profile_picture
       FROM blackboard_comments c
       LEFT JOIN users u ON c.user_id = u.id AND u.tenant_id = c.tenant_id
       WHERE c.entry_id = ? AND c.tenant_id = ?
       ORDER BY c.created_at ASC`,
      [numericId, tenantId],
    );

    return comments;
  } catch (error: unknown) {
    logger.error('Error getting comments:', error);
    throw error;
  }
}

/**
 * Add a comment to a blackboard entry
 * @param entryId - The entry ID (numeric or UUID)
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 * @param comment - The comment text
 * @param isInternal - Whether the comment is internal (admin only)
 */
export async function addComment(
  entryId: number | string,
  userId: number,
  tenantId: number,
  comment: string,
  isInternal: boolean = false,
): Promise<{ id: number }> {
  try {
    // Dual-ID support: Get numeric ID from UUID if string
    let numericId: number;
    logger.info(
      `[addComment] entryId=${String(entryId)}, type=${typeof entryId}, tenantId=${tenantId}`,
    );
    if (typeof entryId === 'string') {
      const [entries] = await executeQuery<DbBlackboardEntry[]>(
        'SELECT id FROM blackboard_entries WHERE uuid = ? AND tenant_id = ?',
        [entryId, tenantId],
      );
      const foundEntry = entries[0];
      logger.info(
        `[addComment] UUID lookup returned ${entries.length} entries, first id=${String(foundEntry?.id ?? 'undefined')}`,
      );
      if (foundEntry === undefined) {
        throw new Error('Entry not found');
      }
      numericId = foundEntry.id;
    } else {
      numericId = entryId;
    }
    logger.info(`[addComment] Final numericId=${numericId}`);

    const [result] = await executeQuery<ResultSetHeader>(
      `INSERT INTO blackboard_comments (tenant_id, entry_id, user_id, comment, is_internal)
       VALUES (?, ?, ?, ?, ?)`,
      [tenantId, numericId, userId, comment, isInternal ? 1 : 0],
    );

    return { id: result.insertId };
  } catch (error: unknown) {
    logger.error('Error adding comment:', error);
    throw error;
  }
}

/**
 * Delete a comment from a blackboard entry
 * @param commentId - The comment ID
 * @param tenantId - The tenant ID
 */
export async function deleteComment(commentId: number, tenantId: number): Promise<boolean> {
  try {
    const [result] = await executeQuery<ResultSetHeader>(
      'DELETE FROM blackboard_comments WHERE id = ? AND tenant_id = ?',
      [commentId, tenantId],
    );

    return result.affectedRows > 0;
  } catch (error: unknown) {
    logger.error('Error deleting comment:', error);
    throw error;
  }
}

/**
 * Get a single comment by ID
 * @param commentId - The comment ID
 * @param tenantId - The tenant ID
 */
export async function getCommentById(
  commentId: number,
  tenantId: number,
): Promise<DbBlackboardComment | null> {
  try {
    const [comments] = await executeQuery<DbBlackboardComment[]>(
      `SELECT c.id, c.tenant_id, c.entry_id, c.user_id, c.comment, c.is_internal, c.created_at,
              u.username as user_name,
              u.first_name as user_first_name,
              u.last_name as user_last_name,
              CONCAT(u.first_name, ' ', u.last_name) as user_full_name,
              u.role as user_role,
              u.profile_picture as user_profile_picture
       FROM blackboard_comments c
       LEFT JOIN users u ON c.user_id = u.id AND u.tenant_id = c.tenant_id
       WHERE c.id = ? AND c.tenant_id = ?`,
      [commentId, tenantId],
    );

    return comments[0] ?? null;
  } catch (error: unknown) {
    logger.error('Error getting comment by ID:', error);
    throw error;
  }
}

// Default export object for service layer
const Blackboard = {
  getAllEntries,
  getEntryById,
  getEntryByUuid, // UUID-based lookup
  createEntry,
  updateEntry,
  deleteEntry,
  confirmEntry,
  unconfirmEntry,
  getConfirmationStatus,
  getDashboardEntries,
  // DEPRECATED: Attachment functions removed - use documents API
  // Comment methods (NEW 2025-11-24)
  getComments,
  addComment,
  deleteComment,
  getCommentById,
};

// Type exports
export type { DbBlackboardEntry, DbConfirmationUser, DbBlackboardComment };

// Default export
export default Blackboard;
