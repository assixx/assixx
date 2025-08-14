/**
 * Document Service
 * Handles document business logic
 */

import { promises as fs } from "fs";
import * as path from "path";

import Document, {
  DocumentCreateData as ModelDocumentCreateData,
  DocumentUpdateData as ModelDocumentUpdateData,
} from "../models/document";
import { query as executeQuery, RowDataPacket } from "../utils/db";
import { formatPaginationResponse } from "../utils/helpers";
import { logger } from "../utils/logger";
/**
 * Document Service
 * Handles document business logic
 */

// Use process.cwd() for compatibility with both ESM and CommonJS
const projectRoot = process.cwd();

// Import types from Document model
// Service-specific interfaces
interface DocumentData extends RowDataPacket {
  id: number;
  tenant_id: number;
  name: string;
  filename: string;
  file_name: string;
  mimetype: string;
  mime_type?: string;
  size: number;
  file_size: number;
  uploaded_by: number;
  uploaded_by_name?: string;
  user_name?: string | null;
  user_id: number;
  team_id?: number;
  department_id?: number;
  recipient_type: string;
  category: string;
  scope: string;
  description?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  is_read?: boolean;
}

interface GetDocumentsOptions {
  tenant_id: number;
  category?: string;
  userId?: number;
  scope?: "all" | "company" | "department" | "team" | "personal";
  departmentId?: number;
  teamId?: number;
  limit: number;
  offset: number;
}

interface DocumentsResponse {
  data: DocumentData[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface ServiceDocumentCreateData {
  tenant_id: number;
  name: string;
  originalName?: string;
  description?: string | null;
  filename: string;
  mimetype: string;
  size: number;
  category: string;
  uploadedBy: number;
  userId?: number | null;
}

interface ServiceDocumentUpdateData {
  name?: string;
  description?: string | null;
  category?: string;
  user_id?: number | null;
}

interface DocumentStats {
  totalDocuments: number;
  byCategory: Record<string, number>;
  totalSize: number;
  averageSize: number;
}

interface RawDocumentStats {
  total?: number;
  byCategory?: Record<string, number>;
  totalSize?: number;
}

class DocumentService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(projectRoot, "uploads/documents");
  }

  /**
   * Get documents with filters
   */
  async getDocuments(options: GetDocumentsOptions): Promise<DocumentsResponse> {
    try {
      const { tenant_id, userId, scope, departmentId, teamId, limit, offset } =
        options;

      // Build SQL query based on scope
      let query = `
        SELECT 
          d.id,
          d.tenant_id,
          d.created_by as uploaded_by,
          d.user_id,
          d.team_id,
          d.department_id,
          d.recipient_type,
          d.category,
          d.filename as file_name,
          d.original_name,
          d.file_path,
          d.file_size,
          d.mime_type,
          d.description,
          d.tags,
          d.uploaded_at as created_at,
          d.uploaded_at as updated_at,
          d.is_archived as is_deleted,
          -- Uploader info
          CONCAT(uploader.first_name, ' ', uploader.last_name) as uploaded_by_name,
          -- Check if document has been read
          CASE 
            WHEN drs.id IS NOT NULL THEN 1 
            ELSE 0 
          END as is_read,
          -- Determine scope based on recipient_type
          CASE 
            WHEN d.recipient_type = 'company' THEN 'company'
            WHEN d.recipient_type = 'department' THEN 'department'
            WHEN d.recipient_type = 'team' THEN 'team'
            WHEN d.recipient_type = 'user' AND d.user_id = ? THEN 'personal'
            ELSE 'other'
          END as scope
        FROM documents d
        LEFT JOIN users uploader ON d.created_by = uploader.id
        LEFT JOIN document_read_status drs ON d.id = drs.document_id AND drs.user_id = ?
        WHERE d.tenant_id = ?
          AND d.is_archived = 0
      `;

      const params: (number | undefined)[] = [userId, userId, tenant_id];

      // Add scope-based filters
      if (scope && scope !== "all") {
        switch (scope) {
          case "company":
            query += ` AND d.recipient_type = 'company'`;
            break;
          case "department":
            query += ` AND d.recipient_type = 'department' AND d.department_id = ?`;
            params.push(departmentId);
            break;
          case "team":
            query += ` AND d.recipient_type = 'team' AND d.team_id = ?`;
            params.push(teamId);
            break;
          case "personal":
            query += ` AND d.recipient_type = 'user' AND d.user_id = ?`;
            params.push(userId);
            break;
        }
      } else {
        // Show all documents user has access to
        query += ` AND (
          d.recipient_type = 'company' OR
          (d.recipient_type = 'department' AND d.department_id = ?) OR
          (d.recipient_type = 'team' AND d.team_id = ?) OR
          (d.recipient_type = 'user' AND d.user_id = ?)
        )`;
        params.push(departmentId, teamId, userId);
      }

      // Get total count
      const countQuery =
        query.replace("SELECT", "SELECT COUNT(*) as total FROM (SELECT") +
        ") as subquery";
      const [countRows] = await executeQuery<RowDataPacket[]>(
        countQuery,
        params,
      );
      const total =
        Array.isArray(countRows) && countRows.length > 0
          ? (countRows[0].total as number)
          : 0;

      // Add ordering and pagination
      query += ` ORDER BY d.uploaded_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const [rows] = await executeQuery<DocumentData[]>(query, params);

      return {
        data: rows,
        pagination: formatPaginationResponse(
          total,
          Math.floor(offset / limit) + 1,
          limit,
        ),
      };
    } catch (error: unknown) {
      logger.error("Error in document service getDocuments:", error);
      throw error;
    }
  }

  /**
   * Get document by ID
   */
  async getDocumentById(
    documentId: number,
    _tenantId: number,
  ): Promise<DocumentData | null> {
    try {
      const doc = await Document.findById(documentId);
      if (!doc) return null;

      return {
        ...doc,
        tenant_id: doc.tenant_id,
        name: doc.file_name,
        filename: doc.file_name,
        file_name: doc.file_name,
        mimetype: "application/pdf", // Default for now
        mime_type: "application/pdf",
        size: 0, // Would need to be calculated
        file_size: 0,
        uploaded_by: doc.user_id,
        category: doc.category || "other",
        recipient_type: "user", // Default
        scope: "personal", // Default
        created_at: doc.upload_date.toISOString(),
        updated_at: doc.upload_date.toISOString(),
        is_deleted: doc.is_archived,
      } as DocumentData;
    } catch (error: unknown) {
      logger.error("Error in document service getDocumentById:", error);
      throw error;
    }
  }

  /**
   * Create new document record
   */
  async createDocument(
    documentData: ServiceDocumentCreateData,
  ): Promise<DocumentData | null> {
    try {
      const modelData: ModelDocumentCreateData = {
        userId: documentData.userId ?? documentData.uploadedBy,
        fileName: documentData.filename,
        fileContent: undefined, // Not used for file uploads via multer
        category: documentData.category,
        description:
          documentData.description !== null
            ? documentData.description
            : undefined,
        tenant_id: documentData.tenant_id,
        recipientType:
          documentData.userId != null && documentData.userId !== 0
            ? "user"
            : "company",
        teamId: null,
        departmentId: null,
      };

      // The model will handle setting created_by, original_name, file_path, file_size, mime_type
      const documentId = await Document.create(modelData);
      return await this.getDocumentById(documentId, documentData.tenant_id);
    } catch (error: unknown) {
      logger.error("Error in document service createDocument:", error);
      throw error;
    }
  }

  /**
   * Update document metadata
   */
  async updateDocument(
    documentId: number,
    updateData: ServiceDocumentUpdateData,
    tenant_id: number,
  ): Promise<boolean> {
    try {
      // Check if document exists
      const document = await this.getDocumentById(documentId, tenant_id);
      if (!document) {
        return false;
      }

      const modelUpdateData: ModelDocumentUpdateData = {
        fileName: updateData.name,
        description:
          updateData.description !== null ? updateData.description : undefined,
        category: updateData.category ?? undefined,
      };
      await Document.update(documentId, modelUpdateData);
      return true;
    } catch (error: unknown) {
      logger.error("Error in document service updateDocument:", error);
      throw error;
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(
    documentId: number,
    tenant_id: number,
  ): Promise<boolean> {
    try {
      // Get document info before deletion
      const document = await this.getDocumentById(documentId, tenant_id);
      if (!document) {
        return false;
      }

      // Delete file from filesystem
      try {
        const filePath = path.join(this.uploadDir, document.filename);
        await fs.unlink(filePath);
      } catch (fileError: unknown) {
        logger.warn("Error deleting file:", fileError);
      }

      // Delete database record
      await Document.delete(documentId);
      return true;
    } catch (error: unknown) {
      logger.error("Error in document service deleteDocument:", error);
      throw error;
    }
  }

  /**
   * Get full path for document file
   */
  async getDocumentPath(filename: string): Promise<string> {
    const filePath = path.join(this.uploadDir, filename);

    // Check if file exists
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      throw new Error("File not found");
    }
  }

  /**
   * Get documents by user
   */
  async getDocumentsByUser(
    userId: number,
    _tenantId: number,
  ): Promise<DocumentData[]> {
    try {
      const dbDocuments = await Document.findByUserId(userId);
      return dbDocuments.map(
        (doc) =>
          ({
            ...doc,
            tenant_id: doc.tenant_id,
            name: doc.file_name,
            filename: doc.file_name,
            file_name: doc.file_name,
            mimetype: "application/pdf", // Default for now
            mime_type: "application/pdf",
            size: 0, // Would need to be calculated
            file_size: 0,
            uploaded_by: doc.user_id,
            description: doc.description ?? "",
            category: doc.category || "other",
            recipient_type: "user", // Default
            scope: "personal", // Default
            created_at: doc.upload_date.toISOString(),
            updated_at: doc.upload_date.toISOString(),
            is_deleted: doc.is_archived,
          }) as DocumentData,
      );
    } catch (error: unknown) {
      logger.error("Error in document service getDocumentsByUser:", error);
      throw error;
    }
  }

  /**
   * Get document statistics
   */
  getDocumentStats(_tenantId: number): DocumentStats {
    try {
      // TODO: Implement getStats method in Document model
      // const stats = await Document.getStats(tenantId) as RawDocumentStats;
      const stats: RawDocumentStats = {
        total: 0,
        totalSize: 0,
        byCategory: {},
      };
      return {
        totalDocuments: stats.total ?? 0,
        byCategory: stats.byCategory ?? {},
        totalSize: stats.totalSize ?? 0,
        averageSize:
          stats.total != null &&
          stats.total > 0 &&
          stats.totalSize != null &&
          stats.totalSize > 0
            ? Math.round(stats.totalSize / stats.total)
            : 0,
      };
    } catch (error: unknown) {
      logger.error("Error in document service getDocumentStats:", error);
      throw error;
    }
  }

  /**
   * Mark document as read by user
   */
  async markDocumentAsRead(
    documentId: number,
    userId: number,
    tenant_id: number,
  ): Promise<boolean> {
    try {
      const query = `
        INSERT INTO document_read_status (document_id, user_id, tenant_id)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP
      `;

      await executeQuery(query, [documentId, userId, tenant_id]);
      return true;
    } catch (error: unknown) {
      logger.error("Error marking document as read:", error);
      return false;
    }
  }
}

// Export singleton instance
const documentService = new DocumentService();
export default documentService;

// Named export for the class
export { DocumentService };

// CommonJS compatibility
