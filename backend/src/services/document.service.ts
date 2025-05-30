/**
 * Document Service
 * Handles document business logic
 */

import * as path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import Document from '../models/document';
import { logger } from '../utils/logger';
import { formatPaginationResponse } from '../utils/helpers';

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import types from Document model
import type {
  DbDocument,
  DocumentCreateData as ModelDocumentCreateData,
  DocumentUpdateData as ModelDocumentUpdateData,
} from '../models/document';

// Service-specific interfaces
interface DocumentData extends Omit<DbDocument, 'file_content'> {
  tenantId: number;
  name: string;
  filename: string;
  mimetype: string;
  size: number;
  uploaded_by: number;
  uploaded_by_name?: string;
  user_name?: string | null;
}

interface GetDocumentsOptions {
  tenantId: number;
  category?: string;
  userId?: number;
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
  tenantId: number;
  name: string;
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

// Removed unused DocumentQueryResult interface

class DocumentService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(__dirname, '../../../uploads/documents');
  }

  /**
   * Get documents with filters
   */
  async getDocuments(options: GetDocumentsOptions): Promise<DocumentsResponse> {
    try {
      const { limit, offset } = options;

      // TODO: Implement findAll method in Document model
      const documents = [] as DocumentData[];
      const total = 0;

      return {
        data: documents,
        pagination: formatPaginationResponse(
          total,
          Math.floor(offset / limit) + 1,
          limit
        ),
      };
    } catch (error) {
      logger.error('Error in document service getDocuments:', error);
      throw error;
    }
  }

  /**
   * Get document by ID
   */
  async getDocumentById(
    documentId: number,
    _tenantId: number
  ): Promise<DocumentData | null> {
    try {
      const doc = await Document.findById(documentId);
      if (!doc) return null;

      return {
        ...doc,
        tenantId: doc.tenant_id,
        name: doc.file_name,
        filename: doc.file_name,
        mimetype: 'application/pdf', // Default for now
        size: 0, // Would need to be calculated
        uploaded_by: doc.user_id,
        category: doc.category || 'other',
      };
    } catch (error) {
      logger.error('Error in document service getDocumentById:', error);
      throw error;
    }
  }

  /**
   * Create new document record
   */
  async createDocument(
    documentData: ServiceDocumentCreateData
  ): Promise<DocumentData | null> {
    try {
      const modelData: ModelDocumentCreateData = {
        userId: documentData.uploadedBy,
        fileName: documentData.name,
        category: documentData.category,
        description:
          documentData.description !== null
            ? documentData.description
            : undefined,
        tenant_id: documentData.tenantId,
      };
      const documentId = await Document.create(modelData);
      return await this.getDocumentById(documentId, documentData.tenantId);
    } catch (error) {
      logger.error('Error in document service createDocument:', error);
      throw error;
    }
  }

  /**
   * Update document metadata
   */
  async updateDocument(
    documentId: number,
    updateData: ServiceDocumentUpdateData,
    tenantId: number
  ): Promise<boolean> {
    try {
      // Check if document exists
      const document = await this.getDocumentById(documentId, tenantId);
      if (!document) {
        return false;
      }

      const modelUpdateData: ModelDocumentUpdateData = {
        fileName: updateData.name,
        description:
          updateData.description !== null ? updateData.description : undefined,
        category:
          updateData.category !== null ? updateData.category : undefined,
      };
      await Document.update(documentId, modelUpdateData);
      return true;
    } catch (error) {
      logger.error('Error in document service updateDocument:', error);
      throw error;
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: number, tenantId: number): Promise<boolean> {
    try {
      // Get document info before deletion
      const document = await this.getDocumentById(documentId, tenantId);
      if (!document) {
        return false;
      }

      // Delete file from filesystem
      try {
        const filePath = path.join(this.uploadDir, document.filename);
        await fs.unlink(filePath);
      } catch (fileError) {
        logger.warn('Error deleting file:', fileError);
      }

      // Delete database record
      await Document.delete(documentId);
      return true;
    } catch (error) {
      logger.error('Error in document service deleteDocument:', error);
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
      throw new Error('File not found');
    }
  }

  /**
   * Get documents by user
   */
  async getDocumentsByUser(
    userId: number,
    _tenantId: number
  ): Promise<DocumentData[]> {
    try {
      const dbDocuments = await Document.findByUserId(userId);
      return dbDocuments.map((doc) => ({
        ...doc,
        tenantId: doc.tenant_id,
        name: doc.file_name,
        filename: doc.file_name,
        mimetype: 'application/pdf', // Default for now
        size: 0, // Would need to be calculated
        uploaded_by: doc.user_id,
        description: doc.description || '',
        category: doc.category || 'other',
        created_at: doc.upload_date,
        updated_at: doc.upload_date,
      }));
    } catch (error) {
      logger.error('Error in document service getDocumentsByUser:', error);
      throw error;
    }
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(_tenantId: number): Promise<DocumentStats> {
    try {
      // TODO: Implement getStats method in Document model
      // const stats = await Document.getStats(tenantId) as RawDocumentStats;
      const stats: RawDocumentStats = {
        total: 0,
        totalSize: 0,
        byCategory: {},
      };
      return {
        totalDocuments: stats.total || 0,
        byCategory: stats.byCategory || {},
        totalSize: stats.totalSize || 0,
        averageSize:
          stats.total && stats.total > 0
            ? Math.round(stats.totalSize! / stats.total)
            : 0,
      };
    } catch (error) {
      logger.error('Error in document service getDocumentStats:', error);
      throw error;
    }
  }
}

// Export singleton instance
const documentService = new DocumentService();
export default documentService;

// Named export for the class
export { DocumentService };

// CommonJS compatibility
