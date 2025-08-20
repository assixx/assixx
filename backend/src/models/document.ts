import { ResultSetHeader, RowDataPacket, query as executeQuery } from '../utils/db';
import { logger } from '../utils/logger';

// Database interfaces
interface DbDocument extends RowDataPacket {
  id: number;
  user_id: number;
  file_name: string;
  file_content?: Buffer;
  category: string;
  description?: string;
  year?: number;
  month?: string;
  upload_date: Date;
  is_archived: boolean;
  download_count?: number;
  last_downloaded?: Date;
  tenant_id: number;
  // Extended fields from joins
  first_name?: string;
  last_name?: string;
  employee_name?: string;
}

interface DocumentCreateData {
  userId?: number | null;
  teamId?: number | null;
  departmentId?: number | null;
  recipientType?: 'user' | 'team' | 'department' | 'company';
  fileName: string;
  fileContent?: Buffer;
  category?: string;
  description?: string;
  year?: number;
  month?: string;
  tenant_id: number;
  createdBy?: number; // The user who uploads the document
  tags?: string[]; // Tags for the document
  mimeType?: string; // MIME type of the document
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
  year?: number;
  month?: string;
  isArchived?: boolean;
  searchTerm?: string;
  uploadDateFrom?: Date;
  uploadDateTo?: Date;
  recipientType?: string;
  recipientId?: number;
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

export async function createDocument({
  userId,
  teamId,
  departmentId,
  recipientType = 'user',
  fileName,
  fileContent,
  category = 'other',
  description = '',
  year,
  month,
  tenant_id,
  createdBy,
  tags,
  mimeType = 'application/octet-stream',
}: DocumentCreateData): Promise<number> {
  // Log based on recipient type
  let logMessage = `Creating new document in category ${category} for `;
  switch (recipientType) {
    case 'user':
      logMessage += `user ${userId}`;
      break;
    case 'team':
      logMessage += `team ${teamId}`;
      break;
    case 'department':
      logMessage += `department ${departmentId}`;
      break;
    case 'company':
      logMessage += `entire company (tenant ${tenant_id})`;
      break;
  }
  logger.info(logMessage);

  // We need to also set default values for required fields
  const query =
    'INSERT INTO documents (user_id, team_id, department_id, recipient_type, filename, original_name, file_path, file_size, mime_type, file_content, category, description, year, month, tenant_id, created_by, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  try {
    const [result] = await executeQuery<ResultSetHeader>(query, [
      userId ?? null, // user_id can be null for company documents
      teamId,
      departmentId,
      recipientType,
      fileName,
      fileName, // original_name - same as filename for now
      `/uploads/documents/${fileName}`, // file_path
      fileContent ? fileContent.length : 0, // file_size
      mimeType, // mime_type - use provided or default
      fileContent,
      category,
      description,
      year,
      month,
      tenant_id,
      createdBy ?? userId ?? 1, // created_by - use createdBy if provided, otherwise userId, otherwise 1
      tags ? JSON.stringify(tags) : null, // tags as JSON
    ]);
    logger.info(`Document created successfully with ID ${result.insertId}`);
    return result.insertId;
  } catch (error: unknown) {
    logger.error(`Error creating document: ${(error as Error).message}`);
    throw error;
  }
}

export async function findDocumentsByUserId(userId: number): Promise<DbDocument[]> {
  logger.info(`Fetching documents for user ${userId}`);
  const query =
    'SELECT id, file_name, upload_date, category, description, year, month, is_archived FROM documents WHERE user_id = ? ORDER BY upload_date DESC';
  try {
    const [rows] = await executeQuery<DbDocument[]>(query, [userId]);
    logger.info(`Retrieved ${rows.length} documents for user ${userId}`);
    return rows;
  } catch (error: unknown) {
    logger.error(`Error fetching documents for user ${userId}: ${(error as Error).message}`);
    throw error;
  }
}

export async function findDocumentsByUserIdAndCategory(
  userId: number,
  category: string,
  archived = false,
): Promise<DbDocument[]> {
  logger.info(`Fetching ${category} documents for user ${userId} (archived: ${archived})`);
  const query =
    'SELECT id, file_name, upload_date, category, description, year, month FROM documents WHERE user_id = ? AND category = ? AND is_archived = ? ORDER BY year DESC, CASE month WHEN "Januar" THEN 1 WHEN "Februar" THEN 2 WHEN "März" THEN 3 WHEN "April" THEN 4 WHEN "Mai" THEN 5 WHEN "Juni" THEN 6 WHEN "Juli" THEN 7 WHEN "August" THEN 8 WHEN "September" THEN 9 WHEN "Oktober" THEN 10 WHEN "November" THEN 11 WHEN "Dezember" THEN 12 ELSE 13 END DESC';
  try {
    const [rows] = await executeQuery<DbDocument[]>(query, [userId, category, archived]);
    logger.info(`Retrieved ${rows.length} ${category} documents for user ${userId}`);
    return rows;
  } catch (error: unknown) {
    logger.error(
      `Error fetching ${category} documents for user ${userId}: ${(error as Error).message}`,
    );
    throw error;
  }
}

export async function findDocumentById(id: number): Promise<DbDocument | null> {
  logger.info(`Fetching document with ID ${id}`);
  const query = 'SELECT * FROM documents WHERE id = ?';
  try {
    const [rows] = await executeQuery<DbDocument[]>(query, [id]);
    if (rows.length === 0) {
      logger.warn(`Document with ID ${id} not found`);
      return null;
    }
    logger.info(`Document ${id} retrieved successfully`);
    return rows[0];
  } catch (error: unknown) {
    logger.error(`Error fetching document ${id}: ${(error as Error).message}`);
    throw error;
  }
}

export async function incrementDownloadCount(id: number): Promise<boolean> {
  logger.info(`Incrementing download count for document ${id}`);
  // Note: download_count column doesn't exist in current schema
  // For now, just verify the document exists
  const query = 'SELECT id FROM documents WHERE id = ?';
  try {
    const [rows] = await executeQuery<RowDataPacket[]>(query, [id]);
    if (rows.length === 0) {
      logger.warn(`No document found with ID ${id} for download tracking`);
      return false;
    }
    logger.info(`Download tracked for document ${id}`);
    return true;
  } catch (error: unknown) {
    logger.error(`Error tracking download for document ${id}: ${(error as Error).message}`);
    throw error;
  }
}

export async function updateDocument(id: number, data: DocumentUpdateData): Promise<boolean> {
  const { fileName, fileContent, category, description, year, month, isArchived } = data;
  logger.info(`Updating document ${id}`);
  let query = 'UPDATE documents SET ';
  const params: unknown[] = [];
  const updates: string[] = [];

  if (fileName !== undefined) {
    updates.push('file_name = ?');
    params.push(fileName);
  }
  if (fileContent !== undefined) {
    updates.push('file_content = ?');
    params.push(fileContent);
  }
  if (category !== undefined) {
    updates.push('category = ?');
    params.push(category);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description);
  }
  if (year !== undefined) {
    updates.push('year = ?');
    params.push(year);
  }
  if (month !== undefined) {
    updates.push('month = ?');
    params.push(month);
  }
  if (isArchived !== undefined) {
    updates.push('is_archived = ?');
    params.push(isArchived);
  }
  // Handle additional fields that v2 API uses
  if (data.filename !== undefined) {
    updates.push('filename = ?');
    params.push(data.filename);
  }
  if (data.tags !== undefined) {
    updates.push('tags = ?');
    params.push(JSON.stringify(data.tags));
  }

  if (updates.length === 0) {
    logger.warn(`No updates provided for document ${id}`);
    return false;
  }

  query += `${updates.join(', ')} WHERE id = ?`;
  params.push(id);

  try {
    const [result] = await executeQuery<ResultSetHeader>(query, params);
    if (result.affectedRows === 0) {
      logger.warn(`No document found with ID ${id} for update`);
      return false;
    }
    logger.info(`Document ${id} updated successfully`);
    return true;
  } catch (error: unknown) {
    logger.error(`Error updating document ${id}: ${(error as Error).message}`);
    throw error;
  }
}

export async function archiveDocument(id: number): Promise<boolean> {
  logger.info(`Archiving document ${id}`);
  return await updateDocument(id, { isArchived: true });
}

export async function unarchiveDocument(id: number): Promise<boolean> {
  logger.info(`Unarchiving document ${id}`);
  return await updateDocument(id, { isArchived: false });
}

export async function deleteDocument(id: number): Promise<boolean> {
  logger.info(`Deleting document ${id}`);
  const query = 'DELETE FROM documents WHERE id = ?';
  try {
    const [result] = await executeQuery<ResultSetHeader>(query, [id]);
    if (result.affectedRows === 0) {
      logger.warn(`No document found with ID ${id} for deletion`);
      return false;
    }
    logger.info(`Document ${id} deleted successfully`);
    return true;
  } catch (error: unknown) {
    logger.error(`Error deleting document ${id}: ${(error as Error).message}`);
    throw error;
  }
}

export async function findAllDocuments(category: string | null = null): Promise<DbDocument[]> {
  logger.info(
    `Fetching all documents${category != null && category !== '' ? ` of category ${category}` : ''}`,
  );
  let query = `
      SELECT d.*, u.first_name, u.last_name, 
             CONCAT(u.first_name, ' ', u.last_name) AS employee_name
      FROM documents d
      LEFT JOIN users u ON d.user_id = u.id`;

  const params: unknown[] = [];

  if (category !== null && category !== '') {
    query += ' WHERE d.category = ?';
    params.push(category);
  }

  query += ' ORDER BY d.uploaded_at DESC';

  try {
    const [rows] = await executeQuery<DbDocument[]>(query, params);
    logger.info(
      `Retrieved ${rows.length} documents${category != null && category !== '' ? ` of category ${category}` : ''}`,
    );
    return rows;
  } catch (error: unknown) {
    logger.error(`Error fetching documents: ${(error as Error).message}`);
    throw error;
  }
}

export async function searchDocuments(userId: number, searchTerm: string): Promise<DbDocument[]> {
  logger.info(`Searching documents for user ${userId} with term: ${searchTerm}`);
  const query =
    'SELECT id, file_name, upload_date, category, description FROM documents WHERE user_id = ? AND (file_name LIKE ? OR description LIKE ?)';
  try {
    const [rows] = await executeQuery<DbDocument[]>(query, [
      userId,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
    ]);
    logger.info(`Found ${rows.length} documents matching search for user ${userId}`);
    return rows;
  } catch (error: unknown) {
    logger.error(`Error searching documents for user ${userId}: ${(error as Error).message}`);
    throw error;
  }
}

// Search documents with employee access (personal, team, department, company)
export async function searchDocumentsWithEmployeeAccess(
  userId: number,
  tenant_id: number,
  searchTerm: string,
): Promise<DbDocument[]> {
  logger.info(`Searching accessible documents for employee ${userId} with term: ${searchTerm}`);

  let query = `
      SELECT DISTINCT d.*,
        u.first_name, u.last_name,
        CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
        t.name as team_name,
        dept.name as department_name,
        CASE 
          WHEN d.recipient_type = 'user' THEN CONCAT(u.first_name, ' ', u.last_name)
          WHEN d.recipient_type = 'team' THEN CONCAT('Team: ', t.name)
          WHEN d.recipient_type = 'department' THEN CONCAT('Abteilung: ', dept.name)
          WHEN d.recipient_type = 'company' THEN 'Gesamte Firma'
          ELSE 'Unbekannt'
        END as recipient_display
      FROM documents d
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN teams t ON d.team_id = t.id
      LEFT JOIN departments dept ON d.department_id = dept.id
      WHERE d.tenant_id = ?
        AND (d.filename LIKE ? OR d.description LIKE ?)
        AND (
          -- Personal documents
          (d.recipient_type = 'user' AND d.user_id = ?)
          OR
          -- Team documents (user is member of the team)
          (d.recipient_type = 'team' AND d.team_id IN (
            SELECT team_id FROM user_teams WHERE user_id = ? AND tenant_id = ?
          ))
          OR
          -- Department documents (user is in the department)
          (d.recipient_type = 'department' AND d.department_id = (
            SELECT department_id FROM users WHERE id = ? AND tenant_id = ?
          ))
          OR
          -- Company-wide documents
          d.recipient_type = 'company'
        )
      ORDER BY d.uploaded_at DESC`;

  try {
    const [rows] = await executeQuery<DbDocument[]>(query, [
      tenant_id,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      userId,
      userId,
      tenant_id,
      userId,
      tenant_id,
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
export async function findDocumentsByUser(userId: number): Promise<DbDocument[]> {
  // Alias for findByUserId for legacy compatibility
  return await findDocumentsByUserId(userId);
}

// Find all documents accessible to an employee (personal, team, department, company)
export async function findDocumentsByEmployeeWithAccess(
  userId: number,
  tenant_id: number,
  filters?: DocumentFilters,
): Promise<{ documents: DbDocument[]; total: number }> {
  logger.info(`Fetching all accessible documents for employee ${userId} in tenant ${tenant_id}`);

  let query = `
      SELECT DISTINCT d.*, 
        u.first_name, u.last_name,
        CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
        t.name as team_name,
        dept.name as department_name,
        CASE 
          WHEN d.recipient_type = 'user' THEN CONCAT(u.first_name, ' ', u.last_name)
          WHEN d.recipient_type = 'team' THEN CONCAT('Team: ', t.name)
          WHEN d.recipient_type = 'department' THEN CONCAT('Abteilung: ', dept.name)
          WHEN d.recipient_type = 'company' THEN 'Gesamte Firma'
          ELSE 'Unbekannt'
        END as recipient_display
      FROM documents d
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN teams t ON d.team_id = t.id
      LEFT JOIN departments dept ON d.department_id = dept.id
      WHERE d.tenant_id = ?
        AND (
          -- Personal documents
          (d.recipient_type = 'user' AND d.user_id = ?)
          OR
          -- Team documents (user is member of the team)
          (d.recipient_type = 'team' AND d.team_id IN (
            SELECT team_id FROM user_teams WHERE user_id = ? AND tenant_id = ?
          ))
          OR
          -- Department documents (user is in the department)
          (d.recipient_type = 'department' AND d.department_id = (
            SELECT department_id FROM users WHERE id = ? AND tenant_id = ?
          ))
          OR
          -- Company-wide documents
          d.recipient_type = 'company'
        )
      `;

  const params: unknown[] = [tenant_id, userId, userId, tenant_id, userId, tenant_id];

  // Apply additional filters if provided
  if (filters) {
    if (filters.category != null && filters.category !== '') {
      query += ' AND d.category = ?';
      params.push(filters.category);
    }

    if (filters.year != null && filters.year !== 0) {
      query += ' AND d.year = ?';
      params.push(filters.year);
    }

    if (filters.month != null && filters.month !== '') {
      query += ' AND d.month = ?';
      params.push(filters.month);
    }

    if (filters.isArchived !== undefined) {
      query += ' AND d.is_archived = ?';
      params.push(filters.isArchived);
    }

    if (filters.searchTerm != null && filters.searchTerm !== '') {
      query += ' AND (d.filename LIKE ? OR d.description LIKE ?)';
      params.push(`%${filters.searchTerm}%`, `%${filters.searchTerm}%`);
    }

    if (filters.recipientType != null && filters.recipientType !== '') {
      query += ' AND d.recipient_type = ?';
      params.push(filters.recipientType);
    }

    if (filters.orderBy != null && filters.orderBy !== '') {
      const validOrderFields = ['uploaded_at', 'filename', 'category', 'year', 'month'];
      const orderField =
        validOrderFields.includes(filters.orderBy) ? filters.orderBy : 'uploaded_at';
      const orderDirection = filters.orderDirection === 'ASC' ? 'ASC' : 'DESC';
      query += ` ORDER BY d.${orderField} ${orderDirection}`;
    } else {
      query += ' ORDER BY d.uploaded_at DESC';
    }
  } else {
    query += ' ORDER BY d.uploaded_at DESC';
  }

  try {
    // Get total count first
    let countQuery = `
        SELECT COUNT(DISTINCT d.id) as total
        FROM documents d
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN teams t ON d.team_id = t.id
        LEFT JOIN departments dept ON d.department_id = dept.id
        WHERE d.tenant_id = ?
          AND (
            (d.recipient_type = 'user' AND d.user_id = ?)
            OR
            (d.recipient_type = 'team' AND d.team_id IN (
              SELECT team_id FROM user_teams WHERE user_id = ? AND tenant_id = ?
            ))
            OR
            (d.recipient_type = 'department' AND d.department_id = (
              SELECT department_id FROM users WHERE id = ? AND tenant_id = ?
            ))
            OR
            d.recipient_type = 'company'
          )`;

    const countParams = [...params];

    // Remove ordering params from count query
    const countParamsLength =
      filters?.orderBy != null && filters.orderBy !== '' ? countParams.length : countParams.length;

    const [countResult] = await executeQuery<CountResult[]>(
      countQuery,
      countParams.slice(0, countParamsLength),
    );
    const total = countResult[0]?.total ?? 0;

    // Add pagination if provided
    if (filters?.limit != null && filters.limit !== 0) {
      query += ' LIMIT ?';
      params.push(filters.limit);

      if (filters.offset != null && filters.offset !== 0) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const [rows] = await executeQuery<DbDocument[]>(query, params);
    logger.info(
      `Retrieved ${rows.length} accessible documents (total: ${total}) for employee ${userId}`,
    );

    return {
      documents: rows,
      total,
    };
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
  logger.info(`Calculating total storage used by tenant ${tenant_id}`);
  try {
    const [rows] = await executeQuery<RowDataPacket[]>(
      'SELECT SUM(OCTET_LENGTH(file_content)) as total_size FROM documents WHERE tenant_id = ?',
      [tenant_id],
    );
    // MySQL SUM can return null or string, ensure we return a number
    const totalSize = Number.parseInt(String(rows[0]?.total_size ?? '0')) || 0;
    logger.info(`Tenant ${tenant_id} is using ${totalSize} bytes of storage`);
    return totalSize;
  } catch (error: unknown) {
    logger.error(`Error calculating storage for tenant ${tenant_id}: ${(error as Error).message}`);
    return 0;
  }
}

// Find documents with flexible filters
export async function findDocumentsWithFilters(
  tenantId: number,
  filters: DocumentFilters,
): Promise<{ documents: DbDocument[]; total: number }> {
  logger.info('Finding documents with filters', filters);

  let query = `
      SELECT d.*, u.first_name, u.last_name, 
             CONCAT(u.first_name, ' ', u.last_name) AS employee_name
      FROM documents d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE 1=1`;

  const params: unknown[] = [];

  // Add filters
  if (filters.userId != null && filters.userId !== 0) {
    query += ' AND d.user_id = ?';
    params.push(filters.userId);
  }

  // Always filter by tenant_id for security
  query += ' AND d.tenant_id = ?';
  params.push(tenantId);

  if (filters.category != null && filters.category !== '') {
    query += ' AND d.category = ?';
    params.push(filters.category);
  }

  if (filters.year != null && filters.year !== 0) {
    query += ' AND d.year = ?';
    params.push(filters.year);
  }

  if (filters.month != null && filters.month !== '') {
    query += ' AND d.month = ?';
    params.push(filters.month);
  }

  if (filters.isArchived !== undefined) {
    query += ' AND d.is_archived = ?';
    params.push(filters.isArchived);
  }

  if (filters.searchTerm != null && filters.searchTerm !== '') {
    query += ' AND (d.filename LIKE ? OR d.description LIKE ?)';
    params.push(`%${filters.searchTerm}%`, `%${filters.searchTerm}%`);
  }

  if (filters.recipientType != null && filters.recipientType !== '') {
    query += ' AND d.recipient_type = ?';
    params.push(filters.recipientType);
  }

  // Add date range filters
  if (filters.uploadDateFrom) {
    query += ' AND d.uploaded_at >= ?';
    params.push(filters.uploadDateFrom);
  }

  if (filters.uploadDateTo) {
    query += ' AND d.uploaded_at <= ?';
    params.push(filters.uploadDateTo);
  }

  // Add ordering
  if (filters.orderBy != null && filters.orderBy !== '') {
    const validOrderFields = ['uploaded_at', 'filename', 'category', 'year', 'month'];
    const orderField = validOrderFields.includes(filters.orderBy) ? filters.orderBy : 'uploaded_at';
    const orderDirection = filters.orderDirection === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY d.${orderField} ${orderDirection}`;
  } else {
    query += ' ORDER BY d.uploaded_at DESC';
  }

  // Add pagination
  if (filters.limit != null && filters.limit !== 0) {
    query += ' LIMIT ?';
    params.push(filters.limit);

    if (filters.offset != null && filters.offset !== 0) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }
  }

  try {
    // Get total count first (without limit/offset)
    let countQuery = `
        SELECT COUNT(DISTINCT d.id) as total
        FROM documents d
        LEFT JOIN users u ON d.user_id = u.id
        WHERE 1=1`;

    const countParams: unknown[] = [];

    // Add same filters for count query
    countQuery += ' AND d.tenant_id = ?';
    countParams.push(tenantId);

    if (filters.userId != null && filters.userId !== 0) {
      countQuery += ' AND d.user_id = ?';
      countParams.push(filters.userId);
    }

    if (filters.category != null && filters.category !== '') {
      countQuery += ' AND d.category = ?';
      countParams.push(filters.category);
    }

    if (filters.year != null && filters.year !== 0) {
      countQuery += ' AND d.year = ?';
      countParams.push(filters.year);
    }

    if (filters.month != null && filters.month !== '') {
      countQuery += ' AND d.month = ?';
      countParams.push(filters.month);
    }

    if (filters.isArchived !== undefined) {
      countQuery += ' AND d.is_archived = ?';
      countParams.push(filters.isArchived);
    }

    if (filters.searchTerm != null && filters.searchTerm !== '') {
      countQuery += ' AND (d.filename LIKE ? OR d.description LIKE ?)';
      countParams.push(`%${filters.searchTerm}%`, `%${filters.searchTerm}%`);
    }

    if (filters.recipientType != null && filters.recipientType !== '') {
      countQuery += ' AND d.recipient_type = ?';
      countParams.push(filters.recipientType);
    }

    if (filters.uploadDateFrom) {
      countQuery += ' AND d.uploaded_at >= ?';
      countParams.push(filters.uploadDateFrom);
    }

    if (filters.uploadDateTo) {
      countQuery += ' AND d.uploaded_at <= ?';
      countParams.push(filters.uploadDateTo);
    }

    const [countResult] = await executeQuery<CountResult[]>(countQuery, countParams);
    const total = countResult[0]?.total ?? 0;

    // Get documents with limit/offset
    const [rows] = await executeQuery<DbDocument[]>(query, params);
    logger.info(`Found ${rows.length} documents (total: ${total}) with filters`);

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
export async function getUnreadDocumentCountForUser(
  userId: number,
  tenant_id: number,
): Promise<number> {
  const query = `
      SELECT COUNT(DISTINCT d.id) as unread_count
      FROM documents d
      LEFT JOIN document_read_status drs ON d.id = drs.document_id AND drs.user_id = ? AND drs.tenant_id = ?
      LEFT JOIN user_teams ut ON d.team_id = ut.team_id AND ut.user_id = ? AND ut.tenant_id = ?
      LEFT JOIN users u ON u.id = ? AND u.tenant_id = ?
      WHERE d.tenant_id = ?
        AND drs.id IS NULL
        AND (
          (d.recipient_type = 'user' AND d.user_id = ?)
          OR (d.recipient_type = 'team' AND ut.user_id IS NOT NULL)
          OR (d.recipient_type = 'department' AND d.department_id = u.department_id)
          OR d.recipient_type = 'company'
        )
    `;
  const [results] = await executeQuery<RowDataPacket[]>(query, [
    userId,
    tenant_id,
    userId,
    tenant_id,
    userId,
    tenant_id,
    tenant_id,
    userId,
  ]);
  return (results[0] as { unread_count?: number }).unread_count ?? 0;
}

// Get document counts by category for a user
export async function getDocumentCountsByCategory(
  tenant_id: number,
  userId: number,
): Promise<Record<string, number>> {
  const query = `
      SELECT 
        d.category,
        COUNT(DISTINCT d.id) as count
      FROM documents d
      LEFT JOIN user_teams ut ON d.team_id = ut.team_id AND ut.user_id = ?
      LEFT JOIN users u ON u.id = ?
      WHERE d.tenant_id = ?
        AND d.is_archived = false
        AND (
          (d.recipient_type = 'user' AND d.user_id = ?)
          OR (d.recipient_type = 'team' AND ut.user_id IS NOT NULL)
          OR (d.recipient_type = 'department' AND d.department_id = u.department_id)
          OR d.recipient_type = 'company'
        )
      GROUP BY d.category
    `;

  interface CategoryCount extends RowDataPacket {
    category: string;
    count: number;
  }

  const [results] = await executeQuery<CategoryCount[]>(query, [userId, userId, tenant_id, userId]);

  // Convert to object
  const counts: Record<string, number> = {
    personal: 0,
    work: 0,
    training: 0,
    general: 0,
    salary: 0,
  };

  results.forEach((row) => {
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
