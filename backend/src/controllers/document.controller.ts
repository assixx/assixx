/**
 * Document Controller
 * Handles document-related requests
 */

import { Response } from 'express';
import documentService from '../services/document.service';
import { logger } from '../utils/logger';
import { parsePagination } from '../utils/helpers';
import { HTTP_STATUS } from '../utils/constants';
import { AuthenticatedRequest as BaseAuthRequest } from '../types/request.types';

// Extended Request interface for document operations
interface AuthenticatedRequest extends BaseAuthRequest {
  user: {
    id: number;
    userId: number;
    tenantId: number;
    username: string;
    email: string;
    role: string;
    tenantName?: string;
    first_name?: string;
    last_name?: string;
    department_id?: number | null;
    position?: string | null;
  };
}

interface DocumentQueryRequest extends AuthenticatedRequest {
  query: {
    page?: string;
    limit?: string;
    category?: string;
    userId?: string;
  };
}

interface DocumentByIdRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
}

interface DocumentUploadRequest extends AuthenticatedRequest {
  body: {
    category?: string;
    description?: string;
    userId?: string;
  };
}

interface DocumentUpdateRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
  body: {
    category?: string;
    description?: string;
  };
}

class DocumentController {
  /**
   * Get all documents with pagination
   */
  async getDocuments(req: DocumentQueryRequest, res: Response): Promise<void> {
    try {
      const { limit, offset } = parsePagination(req.query);
      const { category, userId } = req.query;

      const result = await documentService.getDocuments({
        tenantId: req.user.tenantId,
        category,
        userId: userId ? parseInt(userId, 10) : req.user.id,
        departmentId: req.user.department_id || undefined,
        teamId: undefined, // TODO: Add team_id to user object
        limit,
        offset,
      });

      res.json({
        success: true,
        documents: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Error getting documents:', error);
      res.status(HTTP_STATUS.SERVER_ERROR).json({
        success: false,
        message: 'Error retrieving documents',
      });
    }
  }

  /**
   * Get document by ID
   */
  async getDocumentById(
    req: DocumentByIdRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      const document = await documentService.getDocumentById(
        parseInt(id, 10),
        req.user.tenantId
      );

      if (!document) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Document not found',
        });
        return;
      }

      res.json({
        success: true,
        data: document,
      });
    } catch (error) {
      logger.error('Error getting document:', error);
      res.status(HTTP_STATUS.SERVER_ERROR).json({
        success: false,
        message: 'Error retrieving document',
      });
    }
  }

  /**
   * Upload new document
   */
  async uploadDocument(
    req: DocumentUploadRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.file) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'No file uploaded',
        });
        return;
      }

      const documentData = {
        filename: req.file.filename,
        name: req.file.originalname,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        category: req.body.category || 'general', // Provide default if undefined
        description: req.body.description || null,
        userId: req.body.userId ? parseInt(req.body.userId, 10) : req.user.id,
        uploadedBy: req.user.id,
        tenantId: req.user.tenantId,
      };

      const result = await documentService.createDocument(documentData);

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Document uploaded successfully',
        data: result,
      });
    } catch (error) {
      logger.error('Error uploading document:', error);
      res.status(HTTP_STATUS.SERVER_ERROR).json({
        success: false,
        message: 'Error uploading document',
      });
    }
  }

  /**
   * Update document metadata
   */
  async updateDocument(
    req: DocumentUpdateRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = {
        category: req.body.category,
        description: req.body.description,
      };

      const result = await documentService.updateDocument(
        parseInt(id, 10),
        updateData,
        req.user.tenantId
      );

      if (!result) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Document not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Document updated successfully',
      });
    } catch (error) {
      logger.error('Error updating document:', error);
      res.status(HTTP_STATUS.SERVER_ERROR).json({
        success: false,
        message: 'Error updating document',
      });
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(req: DocumentByIdRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await documentService.deleteDocument(
        parseInt(id, 10),
        req.user.tenantId
      );

      if (!result) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Document not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Document deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting document:', error);
      res.status(HTTP_STATUS.SERVER_ERROR).json({
        success: false,
        message: 'Error deleting document',
      });
    }
  }

  /**
   * Download document
   */
  async downloadDocument(
    req: DocumentByIdRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      const document = await documentService.getDocumentById(
        parseInt(id, 10),
        req.user.tenantId
      );

      if (!document) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Document not found',
        });
        return;
      }

      // Send file
      const filePath = await documentService.getDocumentPath(document.filename);
      res.download(filePath, document.name || document.filename);
    } catch (error) {
      logger.error('Error downloading document:', error);
      res.status(HTTP_STATUS.SERVER_ERROR).json({
        success: false,
        message: 'Error downloading document',
      });
    }
  }

  /**
   * Mark document as read
   */
  async markDocumentAsRead(
    req: DocumentByIdRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      const success = await documentService.markDocumentAsRead(
        parseInt(id, 10),
        req.user.id,
        req.user.tenantId
      );

      if (!success) {
        res.status(HTTP_STATUS.SERVER_ERROR).json({
          success: false,
          message: 'Failed to mark document as read',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Document marked as read',
      });
    } catch (error) {
      logger.error('Error marking document as read:', error);
      res.status(HTTP_STATUS.SERVER_ERROR).json({
        success: false,
        message: 'Error marking document as read',
      });
    }
  }
}

// Export singleton instance
const documentController = new DocumentController();
export default documentController;

// Named export for the class
export { DocumentController };

// CommonJS compatibility
