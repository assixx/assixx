/**
 * Document Controller
 * Handles document-related requests
 */

const documentService = require('../services/document.service');
const { logger } = require('../utils/logger');
const { parsePagination } = require('../utils/helpers');
const { HTTP_STATUS } = require('../utils/constants');

class DocumentController {
  /**
   * Get all documents with pagination
   */
  async getDocuments(req, res) {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const { category, userId } = req.query;

      const result = await documentService.getDocuments({
        tenantId: req.user.tenantId,
        category,
        userId,
        limit,
        offset,
      });

      res.json({
        success: true,
        ...result,
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
  async getDocumentById(req, res) {
    try {
      const { id } = req.params;

      const document = await documentService.getDocumentById(
        id,
        req.user.tenantId
      );

      if (!document) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Document not found',
        });
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
  async uploadDocument(req, res) {
    try {
      if (!req.file) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'No file uploaded',
        });
      }

      const documentData = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        category: req.body.category,
        description: req.body.description,
        userId: req.body.userId || req.user.id,
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
  async updateDocument(req, res) {
    try {
      const { id } = req.params;
      const updateData = {
        category: req.body.category,
        description: req.body.description,
      };

      const result = await documentService.updateDocument(
        id,
        updateData,
        req.user.tenantId
      );

      if (!result) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Document not found',
        });
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
  async deleteDocument(req, res) {
    try {
      const { id } = req.params;

      const result = await documentService.deleteDocument(
        id,
        req.user.tenantId
      );

      if (!result) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Document not found',
        });
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
  async downloadDocument(req, res) {
    try {
      const { id } = req.params;

      const document = await documentService.getDocumentById(
        id,
        req.user.tenantId
      );

      if (!document) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Document not found',
        });
      }

      // Send file
      const filePath = await documentService.getDocumentPath(document.filename);
      res.download(filePath, document.originalName);
    } catch (error) {
      logger.error('Error downloading document:', error);
      res.status(HTTP_STATUS.SERVER_ERROR).json({
        success: false,
        message: 'Error downloading document',
      });
    }
  }
}

module.exports = new DocumentController();
