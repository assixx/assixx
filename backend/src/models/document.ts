/* eslint-disable max-lines */
/* eslint-disable @typescript-eslint/naming-convention */
import { ResultSetHeader, RowDataPacket, query as executeQuery } from '../utils/db.js';
import { logger } from '../utils/logger.js';

// Database interfaces
interface DbDocument extends RowDataPacket {
  id: number;
  // NEW: Clean access control fields (refactored 2025-01-10)
  access_scope: 'personal' | 'team' | 'department' | 'company' | 'payroll';
  owner_user_id?: number | null;
  target_team_id?: number | null;
  target_department_id?: number | null;
  // File fields
  file_name: string;
  filename?: string;
  original_name?: string;
  file_content?: Buffer;
  file_size?: number;
  mime_type?: string;
  // NEW: Flexible category (VARCHAR instead of ENUM)
  category: string;
  description?: string;
  // NEW: Payroll-specific fields
  salary_year?: number;
  salary_month?: number;
  upload_date: Date;
  uploaded_at?: string;
  is_archived: boolean;
  download_count?: number;
  last_downloaded?: Date;
  tenant_id: number;
  created_by?: number;
  // Extended fields from joins
  first_name?: string;
  last_name?: string;
  employee_name?: string;
  uploader_first_name?: string;
  uploader_last_name?: string;
  uploaded_by_name?: string;
}

interface DocumentCreateData {
  // NEW: Clean access control (refactored 2025-01-10)
  accessScope: 'personal' | 'team' | 'department' | 'company' | 'payroll';
  ownerUserId?: number | null;
  targetTeamId?: number | null;
  targetDepartmentId?: number | null;
  // File fields
  fileName: string; // UUID-based filename for storage
  originalName?: string; // User-visible name from modal input
  fileContent?: Buffer;
  category?: string;
  description?: string;
  // NEW: Payroll-specific fields
  salaryYear?: number;
  salaryMonth?: number;
  tenant_id: number;
  createdBy?: number; // The user who uploads the document
  tags?: string[]; // Tags for the document
  mimeType?: string; // MIME type of the document
  // UUID-based storage
  fileUuid?: string; // UUID v4 for unique filename
  fileChecksum?: string; // SHA-256 hash for integrity
  storageType?: 'database' | 'filesystem' | 's3'; // Where file is stored
  version?: number; // Version number
  parentVersionId?: number; // Previous version ID
}

interface DocumentUpdateData {
  fileName?: string;
  fileContent?: Buffer;
  category?: string;
  description?: string;
  year?: number;
  month?: string;
  isArchived?: boolean;
  // v2 API specific fields
  filename?: string;
  tags?: string[] | null;
}

interface DocumentFilters {
  userId?: number;
  tenant_id?: number;
  category?: string;
  // NEW: Payroll filters (refactored 2025-01-10)
  salaryYear?: number;
  salaryMonth?: number;
  isArchived?: boolean;
  searchTerm?: string;
  uploadDateFrom?: Date;
  uploadDateTo?: Date;
  // NEW: Access scope filter instead of recipientType
  accessScope?: 'personal' | 'team' | 'department' | 'company' | 'payroll';
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

interface DocumentCountFilter {
  userId?: number;
  category?: string;
  isArchived?: boolean;
}

interface CountResult extends RowDataPacket {
  total: number;
}

interface TotalSizeResult extends RowDataPacket {
  total_size: number | string | null; // SUM of OCTET_LENGTH can be string or number or null
}

export async function createDocument({
  accessScope,
  ownerUserId,
  targetTeamId,
  targetDepartmentId,
  fileName,
  originalName, // User-visible name from modal input
  fileContent,
  category = 'other',
  description = '',
  salaryYear,
  salaryMonth,
  tenant_id,
  createdBy,
  tags,
  mimeType = 'application/octet-stream',
  fileUuid,
  fileChecksum,
  storageType = 'filesystem',
  version = 1,
  parentVersionId,
}: DocumentCreateData): Promise<number> {
  logger.info(`Creating document with access_scope=${accessScope} for tenant ${tenant_id}`);

  // NEW: Clean database structure (refactored 2025-01-10)
  const query =
    'INSERT INTO documents (tenant_id, access_scope, owner_user_id, target_team_id, target_department_id, salary_year, salary_month, filename, original_name, file_path, file_size, mime_type, file_content, category, description, created_by, tags, file_uuid, file_checksum, storage_type, version, parent_version_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  try {
    const [result] = await executeQuery<ResultSetHeader>(query, [
      tenant_id,
      accessScope,
      ownerUserId ?? null, // owner_user_id for personal/payroll
      targetTeamId ?? null, // target_team_id for team scope
      targetDepartmentId ?? null, // target_department_id for department scope
      salaryYear ?? null, // salary_year for payroll documents
      salaryMonth ?? null, // salary_month for payroll documents
      fileName, // UUID-based filename for storage
      originalName ?? fileName, // User-visible name (fallback to fileName if not provided)
      `/uploads/documents/${fileName}`, // file_path - will be updated by controller with UUID path
      fileContent ? fileContent.length : 0, // file_size
      mimeType, // mime_type - use provided or default
      fileContent,
      category,
      description,
      createdBy ?? ownerUserId ?? 1, // created_by - use createdBy if provided, otherwise ownerUserId, otherwise 1
      tags ? JSON.stringify(tags) : null, // tags as JSON
      fileUuid ?? null, // UUID for unique filename
      fileChecksum ?? null, // SHA-256 checksum
      storageType, // storage type
      version, // version number
      parentVersionId ?? null, // parent version for versioning
    ]);
    logger.info(`Document created with ID ${result.insertId}`);
    return result.insertId;
  } catch (error: unknown) {
    logger.error(`Error creating document: ${(error as Error).message}`);
    throw error;
  }
}

// DEPRECATED: Use findDocumentsByEmployeeWithAccess for full access control
// This only returns documents where the user is the owner (personal/payroll)
export async function findDocumentsByUserId(
  userId: number,
  tenantId: number,
): Promise<DbDocument[]> {
  // NEW: Query by owner_user_id for personal/payroll documents (refactored 2025-01-10)
  const query =
    'SELECT id, file_name, upload_date, category, description, salary_year, salary_month, is_archived, access_scope FROM documents WHERE owner_user_id = ? AND tenant_id = ? AND access_scope IN ("personal", "payroll") ORDER BY uploaded_at DESC';
  try {
    const [rows] = await executeQuery<DbDocument[]>(query, [userId, tenantId]);
    return rows;
  } catch (error: unknown) {
    logger.error(
      `Error fetching owner documents for user ${userId} in tenant ${tenantId}: ${(error as Error).message}`,
    );
    throw error;
  }
}

// DEPRECATED: Use findDocumentsByEmployeeWithAccess with filters for full access control
// This only returns documents where the user is the owner (personal/payroll)
export async function findDocumentsByUserIdAndCategory(
  userId: number,
  tenantId: number,
  category: string,
  archived?: boolean,
): Promise<DbDocument[]> {
  const resolvedArchived = archived ?? false;

  logger.info(
    `Fetching ${category} owner documents for user ${userId} in tenant ${tenantId} (archived: ${resolvedArchived})`,
  );
  // NEW: Query by owner_user_id with salary_month ordering (refactored 2025-01-10)
  const query =
    'SELECT id, file_name, upload_date, category, description, salary_year, salary_month, access_scope FROM documents WHERE owner_user_id = ? AND tenant_id = ? AND category = ? AND is_archived = ? AND access_scope IN ("personal", "payroll") ORDER BY salary_year DESC, salary_month DESC';
  try {
    const [rows] = await executeQuery<DbDocument[]>(query, [
      userId,
      tenantId,
      category,
      resolvedArchived,
    ]);
    return rows;
  } catch (error: unknown) {
    logger.error(
      `Error fetching ${category} owner documents for user ${userId} in tenant ${tenantId}: ${(error as Error).message}`,
    );
    throw error;
  }
}

export async function findDocumentById(id: number, tenantId: number): Promise<DbDocument | null> {
  const query = 'SELECT * FROM documents WHERE id = ? AND tenant_id = ?';
  try {
    const [rows] = await executeQuery<DbDocument[]>(query, [id, tenantId]);
    if (rows.length === 0) {
      logger.warn(`Document with ID ${id} not found in tenant ${tenantId}`);
      return null;
    }
    return rows[0];
  } catch (error: unknown) {
    logger.error(
      `Error fetching document ${id} for tenant ${tenantId}: ${(error as Error).message}`,
    );
    throw error;
  }
}

export async function incrementDownloadCount(id: number, tenantId: number): Promise<boolean> {
  // Note: download_count column doesn't exist in current schema
  // For now, just verify the document exists and belongs to tenant
  const query = 'SELECT id FROM documents WHERE id = ? AND tenant_id = ?';
  try {
    const [rows] = await executeQuery<RowDataPacket[]>(query, [id, tenantId]);
    if (rows.length === 0) {
      logger.warn(`No document found with ID ${id} in tenant ${tenantId} for download tracking`);
      return false;
    }
    return true;
  } catch (error: unknown) {
    logger.error(
      `Error tracking download for document ${id} in tenant ${tenantId}: ${(error as Error).message}`,
    );
    throw error;
  }
}

function buildUpdateQuery(data: DocumentUpdateData): { updates: string[]; params: unknown[] } {
  const updates: string[] = [];
  const params: unknown[] = [];

  const fieldMappings: Record<string, string> = {
    fileName: 'file_name',
    fileContent: 'file_content',
    category: 'category',
    description: 'description',
    year: 'year',
    month: 'month',
    isArchived: 'is_archived',
    filename: 'filename',
  };

  for (const [key, dbColumn] of Object.entries(fieldMappings)) {
    const value = data[key as keyof DocumentUpdateData];
    if (value !== undefined) {
      updates.push(`${dbColumn} = ?`);
      params.push(value);
    }
  }

  // Handle special case for tags
  if (data.tags !== undefined) {
    updates.push('tags = ?');
    params.push(JSON.stringify(data.tags));
  }

  return { updates, params };
}

export async function updateDocument(
  id: number,
  data: DocumentUpdateData,
  tenantId: number,
): Promise<boolean> {
  const { updates, params } = buildUpdateQuery(data);

  if (updates.length === 0) {
    logger.warn(`No updates provided for document ${id}`);
    return false;
  }

  const query = `UPDATE documents SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`;
  params.push(id, tenantId);

  try {
    const [result] = await executeQuery<ResultSetHeader>(query, params);
    if (result.affectedRows === 0) {
      logger.warn(`No document found with ID ${id} in tenant ${tenantId} for update`);
      return false;
    }
    logger.info(`Document ${id} in tenant ${tenantId} updated successfully`);
    return true;
  } catch (error: unknown) {
    logger.error(
      `Error updating document ${id} in tenant ${tenantId}: ${(error as Error).message}`,
    );
    throw error;
  }
}

export async function archiveDocument(id: number, tenantId: number): Promise<boolean> {
  return await updateDocument(id, { isArchived: true }, tenantId);
}

export async function unarchiveDocument(id: number, tenantId: number): Promise<boolean> {
  return await updateDocument(id, { isArchived: false }, tenantId);
}

export async function deleteDocument(id: number, tenantId: number): Promise<boolean> {
  const query = 'DELETE FROM documents WHERE id = ? AND tenant_id = ?';
  try {
    const [result] = await executeQuery<ResultSetHeader>(query, [id, tenantId]);
    if (result.affectedRows === 0) {
      logger.warn(`No document found with ID ${id} in tenant ${tenantId} for deletion`);
      return false;
    }
    logger.info(`Document ${id} in tenant ${tenantId} deleted successfully`);
    return true;
  } catch (error: unknown) {
    logger.error(
      `Error deleting document ${id} in tenant ${tenantId}: ${(error as Error).message}`,
    );
    throw error;
  }
}

export async function findAllDocuments(
  tenantId: number,
  category: string | null = null,
): Promise<DbDocument[]> {
  logger.info(
    `Fetching all documents for tenant ${tenantId}${category != null && category !== '' ? ` of category ${category}` : ''}`,
  );
  // NEW: Join on owner_user_id (refactored 2025-01-10)
  let query = `
      SELECT d.*, u.first_name, u.last_name,
             CONCAT(u.first_name, ' ', u.last_name) AS employee_name
      FROM documents d
      LEFT JOIN users u ON d.owner_user_id = u.id
      WHERE d.tenant_id = ?`;

  const params: unknown[] = [tenantId];

  if (category !== null && category !== '') {
    query += ' AND d.category = ?';
    params.push(category);
  }

  query += ' ORDER BY d.uploaded_at DESC';

  try {
    const [rows] = await executeQuery<DbDocument[]>(query, params);
    logger.info(
      `Retrieved ${rows.length} documents for tenant ${tenantId}${category != null && category !== '' ? ` of category ${category}` : ''}`,
    );
    return rows;
  } catch (error: unknown) {
    logger.error(`Error fetching documents for tenant ${tenantId}: ${(error as Error).message}`);
    throw error;
  }
}

// DEPRECATED: Use searchDocumentsWithEmployeeAccess for full access control
// This only searches documents where the user is the owner (personal/payroll)
export async function searchDocuments(
  userId: number,
  tenantId: number,
  searchTerm: string,
): Promise<DbDocument[]> {
  logger.info(
    `Searching owner documents for user ${userId} in tenant ${tenantId} with term: ${searchTerm}`,
  );
  // NEW: Search by owner_user_id (refactored 2025-01-10)
  const query =
    'SELECT id, file_name, filename, upload_date, category, description, access_scope FROM documents WHERE owner_user_id = ? AND tenant_id = ? AND access_scope IN ("personal", "payroll") AND (filename LIKE ? OR description LIKE ?)';
  try {
    const [rows] = await executeQuery<DbDocument[]>(query, [
      userId,
      tenantId,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
    ]);
    logger.info(
      `Found ${rows.length} owner documents matching search for user ${userId} in tenant ${tenantId}`,
    );
    return rows;
  } catch (error: unknown) {
    logger.error(
      `Error searching owner documents for user ${userId} in tenant ${tenantId}: ${(error as Error).message}`,
    );
    throw error;
  }
}

// Search documents with employee access (personal, team, department, company)
// NEW: Updated for clean access_scope structure (refactored 2025-01-10)
export async function searchDocumentsWithEmployeeAccess(
  userId: number,
  tenant_id: number,
  searchTerm: string,
): Promise<DbDocument[]> {
  logger.info(`Searching accessible documents for employee ${userId} with term: ${searchTerm}`);

  const query = `
      SELECT DISTINCT d.*,
        u.first_name, u.last_name,
        CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
        t.name as team_name,
        dept.name as department_name,
        CASE
          WHEN d.access_scope = 'personal' THEN CONCAT(u.first_name, ' ', u.last_name)
          WHEN d.access_scope = 'team' THEN CONCAT('Team: ', t.name)
          WHEN d.access_scope = 'department' THEN CONCAT('Abteilung: ', dept.name)
          WHEN d.access_scope = 'company' THEN 'Gesamte Firma'
          WHEN d.access_scope = 'payroll' THEN 'Gehalt'
          ELSE 'Unbekannt'
        END as recipient_display
      FROM documents d
      LEFT JOIN users u ON d.owner_user_id = u.id
      LEFT JOIN teams t ON d.target_team_id = t.id
      LEFT JOIN departments dept ON d.target_department_id = dept.id
      WHERE d.tenant_id = ?
        AND (d.filename LIKE ? OR d.description LIKE ?)
        AND ${buildAccessCondition()}
      ORDER BY d.uploaded_at DESC`;

  try {
    const [rows] = await executeQuery<DbDocument[]>(query, [
      tenant_id,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      userId, // personal
      userId, // payroll
      userId, // team
      tenant_id, // team
      userId, // department
      tenant_id, // department
    ]);
    logger.info(`Found ${rows.length} accessible documents matching search for employee ${userId}`);
    return rows;
  } catch (error: unknown) {
    logger.error(
      `Error searching accessible documents for employee ${userId}: ${(error as Error).message}`,
    );
    throw error;
  }
}

// Count method with optional filters
export async function countDocuments(filters?: DocumentCountFilter): Promise<number> {
  // If no filters provided, count all documents
  if (!filters || Object.keys(filters).length === 0) {
    try {
      const [rows] = await executeQuery<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM documents',
        [],
      );
      return (rows[0] as { count?: number }).count ?? 0;
    } catch (error: unknown) {
      logger.error(`Error counting all documents: ${(error as Error).message}`);
      return 0;
    }
  }

  // Count with filters
  logger.info('Counting documents with filters');
  let query = 'SELECT COUNT(*) as total FROM documents WHERE 1=1';
  const params: unknown[] = [];

  if (filters.userId != null && filters.userId !== 0) {
    query += ' AND user_id = ?';
    params.push(filters.userId);
  }
  if (filters.category != null && filters.category !== '') {
    query += ' AND category = ?';
    params.push(filters.category);
  }
  if (filters.isArchived !== undefined) {
    query += ' AND is_archived = ?';
    params.push(filters.isArchived);
  }

  try {
    const [rows] = await executeQuery<CountResult[]>(query, params);
    return rows[0].total;
  } catch (error: unknown) {
    logger.error(`Error counting documents: ${(error as Error).message}`);
    throw error;
  }
}

// Legacy compatibility method
export async function findDocumentsByUser(userId: number, tenantId: number): Promise<DbDocument[]> {
  // Alias for findByUserId for legacy compatibility
  return await findDocumentsByUserId(userId, tenantId);
}

// Helper: Build access condition SQL for documents
// NEW: Uses clean access_scope structure (refactored 2025-01-10)
function buildAccessCondition(): string {
  return `(
    -- Personal documents (only owner can access)
    (d.access_scope = 'personal' AND d.owner_user_id = ?)
    OR
    -- Payroll documents (only owner can access)
    (d.access_scope = 'payroll' AND d.owner_user_id = ?)
    OR
    -- Team documents (user is member of the team)
    (d.access_scope = 'team' AND d.target_team_id IN (
      SELECT team_id FROM user_teams WHERE user_id = ? AND tenant_id = ?
    ))
    OR
    -- Department documents (user is in the department)
    (d.access_scope = 'department' AND d.target_department_id = (
      SELECT department_id FROM users WHERE id = ? AND tenant_id = ?
    ))
    OR
    -- Company-wide documents (all users in tenant)
    d.access_scope = 'company'
  )`;
}

// Helper: Check if filter value is valid
function isValidFilterValue(value: unknown, type: 'string' | 'number'): boolean {
  if (type === 'string') {
    return value != null && value !== '';
  }
  return value != null && value !== 0;
}

// Helper: Add single filter condition
function addFilterCondition(
  query: string,
  params: unknown[],
  condition: string,
  value: unknown,
): { query: string; params: unknown[] } {
  const updatedQuery = query + condition;
  const updatedParams = [...params, value];
  return { query: updatedQuery, params: updatedParams };
}

// Helper: Apply filter conditions to query
function applyDocumentFilters(
  query: string,
  params: unknown[],
  filters?: DocumentFilters,
): { query: string; params: unknown[] } {
  if (!filters) {
    return { query, params };
  }

  let updatedQuery = query;
  let updatedParams = [...params];

  const simpleFilters: {
    field: keyof DocumentFilters;
    condition: string;
    type: 'string' | 'number';
  }[] = [
    { field: 'category', condition: ' AND d.category = ?', type: 'string' },
    // NEW: Payroll filters (refactored 2025-01-10)
    { field: 'salaryYear', condition: ' AND d.salary_year = ?', type: 'number' },
    { field: 'salaryMonth', condition: ' AND d.salary_month = ?', type: 'number' },
    // NEW: Access scope filter instead of recipientType
    { field: 'accessScope', condition: ' AND d.access_scope = ?', type: 'string' },
  ];

  // Apply simple filters
  for (const filter of simpleFilters) {
    const value = filters[filter.field];
    if (isValidFilterValue(value, filter.type)) {
      const result = addFilterCondition(updatedQuery, updatedParams, filter.condition, value);
      updatedQuery = result.query;
      updatedParams = result.params;
    }
  }

  // Handle special cases
  if (filters.isArchived !== undefined) {
    updatedQuery += ' AND d.is_archived = ?';
    updatedParams.push(filters.isArchived);
  }

  const searchTerm = filters.searchTerm;
  if (searchTerm != null && searchTerm !== '') {
    updatedQuery += ' AND (d.filename LIKE ? OR d.description LIKE ?)';
    const searchPattern = `%${searchTerm}%`;
    updatedParams.push(searchPattern, searchPattern);
  }

  return { query: updatedQuery, params: updatedParams };
}

// Helper: Add ordering to query
function addOrdering(query: string, filters?: DocumentFilters): string {
  if (filters?.orderBy != null && filters.orderBy !== '') {
    const validOrderFields = ['uploaded_at', 'filename', 'category', 'year', 'month'];
    const orderField = validOrderFields.includes(filters.orderBy) ? filters.orderBy : 'uploaded_at';
    const orderDirection = filters.orderDirection === 'ASC' ? 'ASC' : 'DESC';
    return query + ` ORDER BY d.${orderField} ${orderDirection}`;
  }
  return query + ' ORDER BY d.uploaded_at DESC';
}

// Helper: Execute count query
// NEW: Updated for clean access_scope structure (refactored 2025-01-10)
async function getDocumentCount(
  tenant_id: number,
  userId: number,
  filters?: DocumentFilters,
): Promise<number> {
  const baseQuery = `
    SELECT COUNT(DISTINCT d.id) as total
    FROM documents d
    LEFT JOIN users u ON d.owner_user_id = u.id
    LEFT JOIN teams t ON d.target_team_id = t.id
    LEFT JOIN departments dept ON d.target_department_id = dept.id
    WHERE d.tenant_id = ? AND ${buildAccessCondition()}`;

  // NEW: Parameters for buildAccessCondition: userId (personal), userId (payroll), userId (team), tenant_id (team), userId (dept), tenant_id (dept)
  const baseParams: unknown[] = [tenant_id, userId, userId, userId, tenant_id, userId, tenant_id];
  const { query, params } = applyDocumentFilters(baseQuery, baseParams, filters);

  const [countResult] = await executeQuery<CountResult[]>(query, params);
  return countResult[0]?.total ?? 0;
}

// Find all documents accessible to an employee (personal, team, department, company)

export async function findDocumentsByEmployeeWithAccess(
  userId: number,
  tenant_id: number,
  filters?: DocumentFilters,
): Promise<{ documents: DbDocument[]; total: number }> {
  logger.info(`Fetching all accessible documents for employee ${userId} in tenant ${tenant_id}`);

  // NEW: Clean structure with access_scope (refactored 2025-01-10)
  const baseQuery = `
    SELECT DISTINCT d.*,
      u.first_name, u.last_name,
      CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
      uploader.first_name AS uploader_first_name,
      uploader.last_name AS uploader_last_name,
      CONCAT(uploader.first_name, ' ', uploader.last_name) AS uploaded_by_name,
      t.name as team_name,
      dept.name as department_name,
      CASE
        WHEN d.access_scope = 'personal' THEN CONCAT(u.first_name, ' ', u.last_name)
        WHEN d.access_scope = 'team' THEN CONCAT('Team: ', t.name)
        WHEN d.access_scope = 'department' THEN CONCAT('Abteilung: ', dept.name)
        WHEN d.access_scope = 'company' THEN 'Gesamte Firma'
        WHEN d.access_scope = 'payroll' THEN 'Gehalt'
        ELSE 'Unbekannt'
      END as recipient_display
    FROM documents d
    LEFT JOIN users u ON d.owner_user_id = u.id
    LEFT JOIN users uploader ON d.created_by = uploader.id
    LEFT JOIN teams t ON d.target_team_id = t.id
    LEFT JOIN departments dept ON d.target_department_id = dept.id
    WHERE d.tenant_id = ? AND ${buildAccessCondition()}`;

  // NEW: Parameters for buildAccessCondition
  const baseParams: unknown[] = [tenant_id, userId, userId, userId, tenant_id, userId, tenant_id];

  try {
    // Get total count
    const total = await getDocumentCount(tenant_id, userId, filters);

    // Build main query with filters
    const { query: filteredQuery, params } = applyDocumentFilters(baseQuery, baseParams, filters);
    let finalQuery = addOrdering(filteredQuery, filters);

    // Add pagination if provided
    const finalParams = [...params];
    if (filters?.limit != null && filters.limit !== 0) {
      finalQuery += ' LIMIT ?';
      finalParams.push(filters.limit);

      if (filters.offset != null && filters.offset !== 0) {
        finalQuery += ' OFFSET ?';
        finalParams.push(filters.offset);
      }
    }

    const [rows] = await executeQuery<DbDocument[]>(finalQuery, finalParams);
    logger.info(
      `Retrieved ${rows.length} accessible documents (total: ${total}) for employee ${userId}`,
    );

    return { documents: rows, total };
  } catch (error: unknown) {
    logger.error(
      `Error fetching accessible documents for employee ${userId}: ${(error as Error).message}`,
    );
    throw error;
  }
}

// Count documents by tenant
export async function countDocumentsByTenant(tenant_id: number): Promise<number> {
  try {
    const [rows] = await executeQuery<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM documents WHERE tenant_id = ?',
      [tenant_id],
    );
    return (rows[0] as { count?: number }).count ?? 0;
  } catch (error: unknown) {
    logger.error(`Error counting documents by tenant: ${(error as Error).message}`);
    return 0;
  }
}

// Get total storage used by tenant (in bytes)
export async function getTotalStorageUsed(tenant_id: number): Promise<number> {
  try {
    const [rows] = await executeQuery<TotalSizeResult[]>(
      'SELECT SUM(OCTET_LENGTH(file_content)) as total_size FROM documents WHERE tenant_id = ?',
      [tenant_id],
    );
    // MySQL SUM can return null or string, ensure we return a number
    return Number.parseInt(String(rows[0]?.total_size ?? '0')) || 0;
  } catch (error: unknown) {
    logger.error(`Error calculating storage for tenant ${tenant_id}: ${(error as Error).message}`);
    return 0;
  }
}

// Helper: Apply all document filters including date ranges
function applyAllDocumentFilters(
  query: string,
  params: unknown[],
  tenantId: number,
  filters: DocumentFilters,
): { query: string; params: unknown[] } {
  let updatedQuery = query;
  const updatedParams = [...params];

  // Add owner user filter (NEW: uses owner_user_id, refactored 2025-01-10)
  if (filters.userId != null && filters.userId !== 0) {
    updatedQuery += ' AND d.owner_user_id = ?';
    updatedParams.push(filters.userId);
  }

  // Always filter by tenant_id for security
  updatedQuery += ' AND d.tenant_id = ?';
  updatedParams.push(tenantId);

  // Apply standard filters (reuse existing helper)
  const { query: filteredQuery, params: filteredParams } = applyDocumentFilters(
    updatedQuery,
    updatedParams,
    filters,
  );

  // Add date range filters
  let finalQuery = filteredQuery;
  const finalParams = [...filteredParams];

  if (filters.uploadDateFrom) {
    finalQuery += ' AND d.uploaded_at >= ?';
    finalParams.push(filters.uploadDateFrom);
  }

  if (filters.uploadDateTo) {
    finalQuery += ' AND d.uploaded_at <= ?';
    finalParams.push(filters.uploadDateTo);
  }

  return { query: finalQuery, params: finalParams };
}

// Helper: Add pagination to query
function addPagination(
  query: string,
  params: unknown[],
  filters: DocumentFilters,
): { query: string; params: unknown[] } {
  let paginatedQuery = query;
  const paginatedParams = [...params];

  if (filters.limit != null && filters.limit !== 0) {
    paginatedQuery += ' LIMIT ?';
    paginatedParams.push(filters.limit);

    if (filters.offset != null && filters.offset !== 0) {
      paginatedQuery += ' OFFSET ?';
      paginatedParams.push(filters.offset);
    }
  }

  return { query: paginatedQuery, params: paginatedParams };
}

// Find documents with flexible filters

export async function findDocumentsWithFilters(
  tenantId: number,
  filters: DocumentFilters,
): Promise<{ documents: DbDocument[]; total: number }> {
  // NEW: Join on owner_user_id (refactored 2025-01-10)
  const baseQuery = `
      SELECT d.*,
             u.first_name, u.last_name,
             CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
             uploader.first_name AS uploader_first_name,
             uploader.last_name AS uploader_last_name,
             CONCAT(uploader.first_name, ' ', uploader.last_name) AS uploaded_by_name
      FROM documents d
      LEFT JOIN users u ON d.owner_user_id = u.id
      LEFT JOIN users uploader ON d.created_by = uploader.id
      WHERE 1=1`;

  const baseCountQuery = `
      SELECT COUNT(DISTINCT d.id) as total
      FROM documents d
      LEFT JOIN users u ON d.owner_user_id = u.id
      WHERE 1=1`;

  try {
    // Apply filters to both queries
    const { query: filteredQuery, params: queryParams } = applyAllDocumentFilters(
      baseQuery,
      [],
      tenantId,
      filters,
    );

    const { query: filteredCountQuery, params: countParams } = applyAllDocumentFilters(
      baseCountQuery,
      [],
      tenantId,
      filters,
    );

    // Get total count
    const [countResult] = await executeQuery<CountResult[]>(filteredCountQuery, countParams);
    const total = countResult[0]?.total ?? 0;

    // Add ordering and pagination to main query
    const orderedQuery = addOrdering(filteredQuery, filters);
    const { query: finalQuery, params: finalParams } = addPagination(
      orderedQuery,
      queryParams,
      filters,
    );

    // Get documents
    const [rows] = await executeQuery<DbDocument[]>(finalQuery, finalParams);
    return {
      documents: rows,
      total,
    };
  } catch (error: unknown) {
    logger.error(`Error finding documents with filters: ${(error as Error).message}`);
    throw error;
  }
}

// Mark document as read by a user
export async function markDocumentAsRead(
  documentId: number,
  userId: number,
  tenant_id: number,
): Promise<void> {
  const query = `
      INSERT INTO document_read_status (document_id, user_id, tenant_id)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP
    `;
  await executeQuery(query, [documentId, userId, tenant_id]);
}

// Check if a document has been read by a user
export async function isDocumentReadByUser(
  documentId: number,
  userId: number,
  tenant_id: number,
): Promise<boolean> {
  const query = `
      SELECT 1 FROM document_read_status
      WHERE document_id = ? AND user_id = ? AND tenant_id = ?
      LIMIT 1
    `;
  const [results] = await executeQuery<RowDataPacket[]>(query, [documentId, userId, tenant_id]);
  return results.length > 0;
}

// Get unread documents count for a user
// NEW: Updated for clean access_scope structure (refactored 2025-01-10)
export async function getUnreadDocumentCountForUser(
  userId: number,
  tenant_id: number,
): Promise<number> {
  const query = `
      SELECT COUNT(DISTINCT d.id) as unread_count
      FROM documents d
      LEFT JOIN document_read_status drs ON d.id = drs.document_id AND drs.user_id = ? AND drs.tenant_id = ?
      LEFT JOIN user_teams ut ON d.target_team_id = ut.team_id AND ut.user_id = ? AND ut.tenant_id = ?
      LEFT JOIN users u ON u.id = ? AND u.tenant_id = ?
      WHERE d.tenant_id = ?
        AND drs.id IS NULL
        AND ${buildAccessCondition()}
    `;
  const [results] = await executeQuery<RowDataPacket[]>(query, [
    userId, // document_read_status join
    tenant_id, // document_read_status join
    userId, // user_teams join
    tenant_id, // user_teams join
    userId, // users join
    tenant_id, // users join
    tenant_id, // WHERE tenant filter
    userId, // buildAccessCondition: personal
    userId, // buildAccessCondition: payroll
    userId, // buildAccessCondition: team
    tenant_id, // buildAccessCondition: team
    userId, // buildAccessCondition: department
    tenant_id, // buildAccessCondition: department
  ]);
  return (results[0] as { unread_count?: number }).unread_count ?? 0;
}

// Get document counts by category for a user
// NEW: Updated for clean access_scope structure (refactored 2025-01-10)
export async function getDocumentCountsByCategory(
  tenant_id: number,
  userId: number,
): Promise<Record<string, number>> {
  const query = `
      SELECT
        d.category,
        COUNT(DISTINCT d.id) as count
      FROM documents d
      LEFT JOIN user_teams ut ON d.target_team_id = ut.team_id AND ut.user_id = ?
      LEFT JOIN users u ON u.id = ?
      WHERE d.tenant_id = ?
        AND d.is_archived = false
        AND ${buildAccessCondition()}
      GROUP BY d.category
    `;

  interface CategoryCount extends RowDataPacket {
    category: string;
    count: number;
  }

  const [results] = await executeQuery<CategoryCount[]>(query, [
    userId, // user_teams join
    userId, // users join
    tenant_id, // WHERE tenant filter
    userId, // buildAccessCondition: personal
    userId, // buildAccessCondition: payroll
    userId, // buildAccessCondition: team
    tenant_id, // buildAccessCondition: team
    userId, // buildAccessCondition: department
    tenant_id, // buildAccessCondition: department
  ]);

  // Convert to object
  const counts: Record<string, number> = {
    personal: 0,
    work: 0,
    training: 0,
    general: 0,
    salary: 0,
  };

  results.forEach((row: CategoryCount) => {
    if (Object.prototype.hasOwnProperty.call(counts, row.category)) {
      counts[row.category] = row.count;
    }
  });

  return counts;
}

// Backward compatibility object
const Document = {
  create: createDocument,
  findByUserId: findDocumentsByUserId,
  findByUserIdAndCategory: findDocumentsByUserIdAndCategory,
  findById: findDocumentById,
  incrementDownloadCount,
  update: updateDocument,
  archiveDocument,
  unarchiveDocument,
  delete: deleteDocument,
  findAll: findAllDocuments,
  search: searchDocuments,
  searchWithEmployeeAccess: searchDocumentsWithEmployeeAccess,
  count: countDocuments,
  findByUser: findDocumentsByUser,
  findByEmployeeWithAccess: findDocumentsByEmployeeWithAccess,
  countByTenant: countDocumentsByTenant,
  getTotalStorageUsed,
  findWithFilters: findDocumentsWithFilters,
  markAsRead: markDocumentAsRead,
  isReadByUser: isDocumentReadByUser,
  getUnreadCountForUser: getUnreadDocumentCountForUser,
  getCountsByCategory: getDocumentCountsByCategory,
};

// Export types
export type { DbDocument, DocumentCreateData, DocumentUpdateData };

// Default export for CommonJS compatibility
export default Document;

// CommonJS compatibility
