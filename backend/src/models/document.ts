import pool from "../database";
import { logger } from "../utils/logger";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";

// Helper function to handle both real pool and mock database
async function executeQuery<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: any[],
): Promise<[T, any]> {
  const result = await (pool as any).query(sql, params);
  if (Array.isArray(result) && result.length === 2) {
    return result as [T, any];
  }
  return [result as T, null];
}

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
  userId: number;
  fileName: string;
  fileContent?: Buffer;
  category?: string;
  description?: string;
  year?: number;
  month?: string;
  tenant_id: number;
}

interface DocumentUpdateData {
  fileName?: string;
  fileContent?: Buffer;
  category?: string;
  description?: string;
  year?: number;
  month?: string;
  isArchived?: boolean;
}

interface DocumentCountFilter {
  userId?: number;
  category?: string;
  isArchived?: boolean;
}

interface CountResult extends RowDataPacket {
  total: number;
}

export class Document {
  static async create({
    userId,
    fileName,
    fileContent,
    category = "other",
    description = "",
    year,
    month,
    tenant_id,
  }: DocumentCreateData): Promise<number> {
    logger.info(
      `Creating new document for user ${userId} in category ${category}`,
    );
    const query =
      "INSERT INTO documents (user_id, file_name, file_content, category, description, year, month, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    try {
      const [result] = await executeQuery<ResultSetHeader>(query, [
        userId,
        fileName,
        fileContent,
        category,
        description,
        year,
        month,
        tenant_id,
      ]);
      logger.info(`Document created successfully with ID ${result.insertId}`);
      return result.insertId;
    } catch (error) {
      logger.error(`Error creating document: ${(error as Error).message}`);
      throw error;
    }
  }

  static async findByUserId(userId: number): Promise<DbDocument[]> {
    logger.info(`Fetching documents for user ${userId}`);
    const query =
      "SELECT id, file_name, upload_date, category, description, year, month, is_archived FROM documents WHERE user_id = ? ORDER BY upload_date DESC";
    try {
      const [rows] = await executeQuery<DbDocument[]>(query, [userId]);
      logger.info(`Retrieved ${rows.length} documents for user ${userId}`);
      return rows;
    } catch (error) {
      logger.error(
        `Error fetching documents for user ${userId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  static async findByUserIdAndCategory(
    userId: number,
    category: string,
    archived = false,
  ): Promise<DbDocument[]> {
    logger.info(
      `Fetching ${category} documents for user ${userId} (archived: ${archived})`,
    );
    const query =
      'SELECT id, file_name, upload_date, category, description, year, month FROM documents WHERE user_id = ? AND category = ? AND is_archived = ? ORDER BY year DESC, CASE month WHEN "Januar" THEN 1 WHEN "Februar" THEN 2 WHEN "März" THEN 3 WHEN "April" THEN 4 WHEN "Mai" THEN 5 WHEN "Juni" THEN 6 WHEN "Juli" THEN 7 WHEN "August" THEN 8 WHEN "September" THEN 9 WHEN "Oktober" THEN 10 WHEN "November" THEN 11 WHEN "Dezember" THEN 12 ELSE 13 END DESC';
    try {
      const [rows] = await executeQuery<DbDocument[]>(query, [
        userId,
        category,
        archived,
      ]);
      logger.info(
        `Retrieved ${rows.length} ${category} documents for user ${userId}`,
      );
      return rows;
    } catch (error) {
      logger.error(
        `Error fetching ${category} documents for user ${userId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  static async findById(id: number): Promise<DbDocument | null> {
    logger.info(`Fetching document with ID ${id}`);
    const query = "SELECT * FROM documents WHERE id = ?";
    try {
      const [rows] = await executeQuery<DbDocument[]>(query, [id]);
      if (rows.length === 0) {
        logger.warn(`Document with ID ${id} not found`);
        return null;
      }
      logger.info(`Document ${id} retrieved successfully`);
      return rows[0];
    } catch (error) {
      logger.error(
        `Error fetching document ${id}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  static async incrementDownloadCount(id: number): Promise<boolean> {
    logger.info(`Incrementing download count for document ${id}`);
    const query =
      "UPDATE documents SET download_count = COALESCE(download_count, 0) + 1, last_downloaded = NOW() WHERE id = ?";
    try {
      const [result] = await executeQuery<ResultSetHeader>(query, [id]);
      if (result.affectedRows === 0) {
        logger.warn(`No document found with ID ${id} for download tracking`);
        return false;
      }
      logger.info(`Download count incremented for document ${id}`);
      return true;
    } catch (error) {
      logger.error(
        `Error incrementing download count for document ${id}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  static async update(
    id: number,
    {
      fileName,
      fileContent,
      category,
      description,
      year,
      month,
      isArchived,
    }: DocumentUpdateData,
  ): Promise<boolean> {
    logger.info(`Updating document ${id}`);
    let query = "UPDATE documents SET ";
    const params: any[] = [];
    const updates: string[] = [];

    if (fileName !== undefined) {
      updates.push("file_name = ?");
      params.push(fileName);
    }
    if (fileContent !== undefined) {
      updates.push("file_content = ?");
      params.push(fileContent);
    }
    if (category !== undefined) {
      updates.push("category = ?");
      params.push(category);
    }
    if (description !== undefined) {
      updates.push("description = ?");
      params.push(description);
    }
    if (year !== undefined) {
      updates.push("year = ?");
      params.push(year);
    }
    if (month !== undefined) {
      updates.push("month = ?");
      params.push(month);
    }
    if (isArchived !== undefined) {
      updates.push("is_archived = ?");
      params.push(isArchived);
    }

    if (updates.length === 0) {
      logger.warn(`No updates provided for document ${id}`);
      return false;
    }

    query += `${updates.join(", ")} WHERE id = ?`;
    params.push(id);

    try {
      const [result] = await executeQuery<ResultSetHeader>(query, params);
      if (result.affectedRows === 0) {
        logger.warn(`No document found with ID ${id} for update`);
        return false;
      }
      logger.info(`Document ${id} updated successfully`);
      return true;
    } catch (error) {
      logger.error(
        `Error updating document ${id}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  static async archiveDocument(id: number): Promise<boolean> {
    logger.info(`Archiving document ${id}`);
    return this.update(id, { isArchived: true });
  }

  static async unarchiveDocument(id: number): Promise<boolean> {
    logger.info(`Unarchiving document ${id}`);
    return this.update(id, { isArchived: false });
  }

  static async delete(id: number): Promise<boolean> {
    logger.info(`Deleting document ${id}`);
    const query = "DELETE FROM documents WHERE id = ?";
    try {
      const [result] = await executeQuery<ResultSetHeader>(query, [id]);
      if (result.affectedRows === 0) {
        logger.warn(`No document found with ID ${id} for deletion`);
        return false;
      }
      logger.info(`Document ${id} deleted successfully`);
      return true;
    } catch (error) {
      logger.error(
        `Error deleting document ${id}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  static async findAll(category: string | null = null): Promise<DbDocument[]> {
    logger.info(
      `Fetching all documents${category ? ` of category ${category}` : ""}`,
    );
    let query = `
      SELECT d.*, u.first_name, u.last_name, 
             CONCAT(u.first_name, ' ', u.last_name) AS employee_name
      FROM documents d
      LEFT JOIN users u ON d.user_id = u.id`;

    const params: any[] = [];

    if (category) {
      query += " WHERE d.category = ?";
      params.push(category);
    }

    query += " ORDER BY d.upload_date DESC";

    try {
      const [rows] = await executeQuery<DbDocument[]>(query, params);
      logger.info(
        `Retrieved ${rows.length} documents${category ? ` of category ${category}` : ""}`,
      );
      return rows;
    } catch (error) {
      logger.error(`Error fetching documents: ${(error as Error).message}`);
      throw error;
    }
  }

  static async search(
    userId: number,
    searchTerm: string,
  ): Promise<DbDocument[]> {
    logger.info(
      `Searching documents for user ${userId} with term: ${searchTerm}`,
    );
    const query =
      "SELECT id, file_name, upload_date, category, description FROM documents WHERE user_id = ? AND (file_name LIKE ? OR description LIKE ?)";
    try {
      const [rows] = await executeQuery<DbDocument[]>(query, [
        userId,
        `%${searchTerm}%`,
        `%${searchTerm}%`,
      ]);
      logger.info(
        `Found ${rows.length} documents matching search for user ${userId}`,
      );
      return rows;
    } catch (error) {
      logger.error(
        `Error searching documents for user ${userId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // Count method with optional filters
  static async count(filters?: DocumentCountFilter): Promise<number> {
    // If no filters provided, count all documents
    if (!filters || Object.keys(filters).length === 0) {
      try {
        const [rows] = await executeQuery<any[]>(
          "SELECT COUNT(*) as count FROM documents",
          [],
        );
        return rows[0]?.count || 0;
      } catch (error) {
        logger.error(
          `Error counting all documents: ${(error as Error).message}`,
        );
        return 0;
      }
    }

    // Count with filters
    logger.info("Counting documents with filters");
    let query = "SELECT COUNT(*) as total FROM documents WHERE 1=1";
    const params: any[] = [];

    if (filters.userId) {
      query += " AND user_id = ?";
      params.push(filters.userId);
    }
    if (filters.category) {
      query += " AND category = ?";
      params.push(filters.category);
    }
    if (filters.isArchived !== undefined) {
      query += " AND is_archived = ?";
      params.push(filters.isArchived);
    }

    try {
      const [rows] = await executeQuery<CountResult[]>(query, params);
      return rows[0].total;
    } catch (error) {
      logger.error(`Error counting documents: ${(error as Error).message}`);
      throw error;
    }
  }

  // Legacy compatibility method
  static async findByUser(userId: number): Promise<DbDocument[]> {
    // Alias for findByUserId for legacy compatibility
    return this.findByUserId(userId);
  }

  // Count documents by tenant
  static async countByTenant(tenantId: number): Promise<number> {
    try {
      const [rows] = await executeQuery<any[]>(
        "SELECT COUNT(*) as count FROM documents WHERE tenant_id = ?",
        [tenantId],
      );
      return rows[0]?.count || 0;
    } catch (error) {
      logger.error(
        `Error counting documents by tenant: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  // Get total storage used by tenant (in bytes)
  static async getTotalStorageUsed(tenantId: number): Promise<number> {
    logger.info(`Calculating total storage used by tenant ${tenantId}`);
    try {
      const [rows] = await executeQuery<any[]>(
        "SELECT SUM(OCTET_LENGTH(file_content)) as total_size FROM documents WHERE tenant_id = ?",
        [tenantId],
      );
      const totalSize = rows[0]?.total_size || 0;
      logger.info(`Tenant ${tenantId} is using ${totalSize} bytes of storage`);
      return totalSize;
    } catch (error) {
      logger.error(
        `Error calculating storage for tenant ${tenantId}: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  // Find documents with flexible filters
  static async findWithFilters(filters: any): Promise<DbDocument[]> {
    logger.info("Finding documents with filters", filters);

    let query = `
      SELECT d.*, u.first_name, u.last_name, 
             CONCAT(u.first_name, ' ', u.last_name) AS employee_name
      FROM documents d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE 1=1`;

    const params: any[] = [];

    // Add filters
    if (filters.userId) {
      query += " AND d.user_id = ?";
      params.push(filters.userId);
    }

    if (filters.tenantId) {
      query += " AND d.tenant_id = ?";
      params.push(filters.tenantId);
    }

    if (filters.category) {
      query += " AND d.category = ?";
      params.push(filters.category);
    }

    if (filters.year) {
      query += " AND d.year = ?";
      params.push(filters.year);
    }

    if (filters.month) {
      query += " AND d.month = ?";
      params.push(filters.month);
    }

    if (filters.isArchived !== undefined) {
      query += " AND d.is_archived = ?";
      params.push(filters.isArchived);
    }

    if (filters.searchTerm) {
      query += " AND (d.file_name LIKE ? OR d.description LIKE ?)";
      params.push(`%${filters.searchTerm}%`, `%${filters.searchTerm}%`);
    }

    // Add date range filters
    if (filters.uploadDateFrom) {
      query += " AND d.upload_date >= ?";
      params.push(filters.uploadDateFrom);
    }

    if (filters.uploadDateTo) {
      query += " AND d.upload_date <= ?";
      params.push(filters.uploadDateTo);
    }

    // Add ordering
    if (filters.orderBy) {
      const validOrderFields = [
        "upload_date",
        "file_name",
        "category",
        "year",
        "month",
      ];
      const orderField = validOrderFields.includes(filters.orderBy)
        ? filters.orderBy
        : "upload_date";
      const orderDirection = filters.orderDirection === "ASC" ? "ASC" : "DESC";
      query += ` ORDER BY d.${orderField} ${orderDirection}`;
    } else {
      query += " ORDER BY d.upload_date DESC";
    }

    // Add pagination
    if (filters.limit) {
      query += " LIMIT ?";
      params.push(parseInt(filters.limit));

      if (filters.offset) {
        query += " OFFSET ?";
        params.push(parseInt(filters.offset));
      }
    }

    try {
      const [rows] = await executeQuery<DbDocument[]>(query, params);
      logger.info(`Found ${rows.length} documents with filters`);
      return rows;
    } catch (error) {
      logger.error(
        `Error finding documents with filters: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}

// Export types
export type { DbDocument, DocumentCreateData, DocumentUpdateData };

// Default export for CommonJS compatibility
export default Document;

// CommonJS compatibility
