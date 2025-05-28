/**
 * Document Service
 * Handles document business logic
 */

const path = require('path');
const fs = require('fs').promises;
const Document = require('../models/document');
const { logger } = require('../utils/logger');
const { formatPaginationResponse } = require('../utils/helpers');

class DocumentService {
  constructor() {
    this.uploadDir = path.join(__dirname, '../../../uploads/documents');
  }

  /**
   * Get documents with filters
   */
  async getDocuments(options) {
    try {
      const { tenantId, category, userId, limit, offset } = options;
      
      const result = await Document.findAll({
        tenantId,
        category,
        userId,
        limit,
        offset
      });

      return {
        data: result.documents,
        pagination: formatPaginationResponse(result.total, 
          Math.floor(offset / limit) + 1, 
          limit
        )
      };
    } catch (error) {
      logger.error('Error in document service getDocuments:', error);
      throw error;
    }
  }

  /**
   * Get document by ID
   */
  async getDocumentById(documentId, tenantId) {
    try {
      return await Document.findById(documentId, tenantId);
    } catch (error) {
      logger.error('Error in document service getDocumentById:', error);
      throw error;
    }
  }

  /**
   * Create new document record
   */
  async createDocument(documentData) {
    try {
      const documentId = await Document.create(documentData);
      return await this.getDocumentById(documentId, documentData.tenantId);
    } catch (error) {
      logger.error('Error in document service createDocument:', error);
      throw error;
    }
  }

  /**
   * Update document metadata
   */
  async updateDocument(documentId, updateData, tenantId) {
    try {
      // Check if document exists
      const document = await this.getDocumentById(documentId, tenantId);
      if (!document) {
        return null;
      }

      await Document.update(documentId, updateData, tenantId);
      return true;
    } catch (error) {
      logger.error('Error in document service updateDocument:', error);
      throw error;
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId, tenantId) {
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
        logger.warn('Error deleting file:', fileePath);
      }

      // Delete database record
      await Document.delete(documentId, tenantId);
      return true;
    } catch (error) {
      logger.error('Error in document service deleteDocument:', error);
      throw error;
    }
  }

  /**
   * Get full path for document file
   */
  async getDocumentPath(filename) {
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
  async getDocumentsByUser(userId, tenantId) {
    try {
      return await Document.findByUser(userId, tenantId);
    } catch (error) {
      logger.error('Error in document service getDocumentsByUser:', error);
      throw error;
    }
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(tenantId) {
    try {
      const stats = await Document.getStats(tenantId);
      return {
        totalDocuments: stats.total || 0,
        byCategory: stats.byCategory || {},
        totalSize: stats.totalSize || 0,
        averageSize: stats.total > 0 ? Math.round(stats.totalSize / stats.total) : 0
      };
    } catch (error) {
      logger.error('Error in document service getDocumentStats:', error);
      throw error;
    }
  }
}

module.exports = new DocumentService();