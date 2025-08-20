/**
 * Document Controller
 * Handles document-related requests
 */
import { Request, Response } from 'express';

import Team from '../models/team';
import documentService from '../services/document.service';
import type { AuthenticatedRequest } from '../types/request.types';
import { HTTP_STATUS } from '../utils/constants';
import { parsePagination } from '../utils/helpers';
import { logger } from '../utils/logger';

// Extended request interface for file upload
interface DocumentUploadRequest extends AuthenticatedRequest {
  body: {
    category?: string;
    description?: string | null;
    userId?: string;
  };
}

// Extended request interface for update
interface DocumentUpdateRequest extends AuthenticatedRequest {
  body: {
    category?: string;
    description?: string | null;
  };
}

// Type guard to check if request is authenticated
/**
 *
 * @param req
 */
function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return (
    'user' in req && req.user != null && typeof req.user === 'object' && 'tenant_id' in req.user
  );
}

/**
 *
 */
class DocumentController {
  /**
   * Get all documents with pagination
   * @param req
   * @param res
   */
  async getDocuments(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const { limit, offset } = parsePagination(
        req.query as {
          page?: string | number;
          limit?: string | number;
          [key: string]: string | number | undefined;
        },
      );
      const category = req.query.category as string | undefined;
      const userId = req.query.userId as string | undefined;

      // Get user's teams
      let userTeamId: number | undefined;
      try {
        const userTeams = await Team.getUserTeams(req.user.id);
        if (Array.isArray(userTeams) && userTeams.length > 0) {
          // Use the first team for now
          const firstTeam = userTeams[0];
          userTeamId = firstTeam.id;
        }
      } catch (error: unknown) {
        logger.warn(`Failed to fetch teams for user ${req.user.id}:`, error);
      }

      const result = await documentService.getDocuments({
        tenant_id: req.user.tenant_id,
        category,
        userId: userId != null && userId !== '' ? Number.parseInt(userId, 10) : req.user.id,
        departmentId: req.user.department_id ?? undefined,
        teamId: userTeamId,
        limit,
        offset,
      });

      res.json({
        success: true,
        documents: result.data,
        pagination: result.pagination,
      });
    } catch (error: unknown) {
      logger.error('Error getting documents:', error);
      res.status(HTTP_STATUS.SERVER_ERROR).json({
        success: false,
        message: 'Error retrieving documents',
      });
    }
  }

  /**
   * Get document by ID
   * @param req
   * @param res
   */
  async getDocumentById(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const id = req.params.id;

      const document = await documentService.getDocumentById(
        Number.parseInt(id, 10),
        req.user.tenant_id,
      );

      if (document === null) {
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
    } catch (error: unknown) {
      logger.error('Error getting document:', error);
      res.status(HTTP_STATUS.SERVER_ERROR).json({
        success: false,
        message: 'Error retrieving document',
      });
    }
  }

  /**
   * Upload new document
   * @param req
   * @param res
   */
  async uploadDocument(
    req: Request & Partial<DocumentUploadRequest>,
    res: Response,
  ): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      if (req.file === undefined) {
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
        category: (req.body as DocumentUploadRequest['body']).category ?? 'general', // Provide default if undefined
        description: (req.body as DocumentUploadRequest['body']).description ?? null,
        userId: (() => {
          const bodyUserId = (req.body as DocumentUploadRequest['body']).userId;
          if (bodyUserId != null && bodyUserId !== '') {
            return Number.parseInt(bodyUserId, 10);
          }
          return null; // Company documents don't have a specific user
        })(),
        uploadedBy: (req as AuthenticatedRequest).user.id,
        tenant_id: (req as AuthenticatedRequest).user.tenant_id,
      };

      const result = await documentService.createDocument(documentData);

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Document uploaded successfully',
        data: result,
      });
    } catch (error: unknown) {
      logger.error('Error uploading document:', error);
      res.status(HTTP_STATUS.SERVER_ERROR).json({
        success: false,
        message: 'Error uploading document',
      });
    }
  }

  /**
   * Update document metadata
   * @param req
   * @param res
   */
  async updateDocument(
    req: Request & Partial<DocumentUpdateRequest>,
    res: Response,
  ): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const id = req.params.id;
      const updateData = {
        category: (req.body as DocumentUpdateRequest['body']).category,
        description: (req.body as DocumentUpdateRequest['body']).description,
      };

      const result = await documentService.updateDocument(
        Number.parseInt(id, 10),
        updateData,
        (req as AuthenticatedRequest).user.tenant_id,
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
    } catch (error: unknown) {
      logger.error('Error updating document:', error);
      res.status(HTTP_STATUS.SERVER_ERROR).json({
        success: false,
        message: 'Error updating document',
      });
    }
  }

  /**
   * Delete document
   * @param req
   * @param res
   */
  async deleteDocument(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const id = req.params.id;

      const result = await documentService.deleteDocument(
        Number.parseInt(id, 10),
        req.user.tenant_id,
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
    } catch (error: unknown) {
      logger.error('Error deleting document:', error);
      res.status(HTTP_STATUS.SERVER_ERROR).json({
        success: false,
        message: 'Error deleting document',
      });
    }
  }

  /**
   * Download document
   * @param req
   * @param res
   */
  async downloadDocument(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const id = req.params.id;

      const document = await documentService.getDocumentById(
        Number.parseInt(id, 10),
        req.user.tenant_id,
      );

      if (document === null) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Document not found',
        });
        return;
      }

      // Send file
      const filePath = await documentService.getDocumentPath(document.filename);
      res.download(
        filePath,
        document.name && document.name.trim() !== '' ? document.name : document.filename,
      );
    } catch (error: unknown) {
      logger.error('Error downloading document:', error);
      res.status(HTTP_STATUS.SERVER_ERROR).json({
        success: false,
        message: 'Error downloading document',
      });
    }
  }

  /**
   * Mark document as read
   * @param req
   * @param res
   */
  async markDocumentAsRead(req: Request, res: Response): Promise<void> {
    try {
      if (!isAuthenticated(req)) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const id = req.params.id;

      const success = await documentService.markDocumentAsRead(
        Number.parseInt(id, 10),
        req.user.id,
        req.user.tenant_id,
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
    } catch (error: unknown) {
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
