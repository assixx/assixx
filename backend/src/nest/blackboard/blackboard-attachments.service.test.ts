/**
 * Unit tests for BlackboardAttachmentsService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Upload (uuid + checksum + path), get/download/preview delegation,
 *        downloadByFileUuid (NotFoundException), delete.
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import type { DocumentsService } from '../documents/documents.service.js';
import { BlackboardAttachmentsService } from './blackboard-attachments.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('mock-uuid-v7'),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

function createMockDocumentsService() {
  return {
    createDocument: vi.fn().mockResolvedValue({ id: 1, filename: 'test.pdf' }),
    listDocuments: vi.fn().mockResolvedValue({ documents: [] }),
    getDocumentContent: vi.fn().mockResolvedValue({
      content: Buffer.from('data'),
      originalName: 'test.pdf',
      mimeType: 'application/pdf',
      fileSize: 4,
    }),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
  };
}

function makeFile() {
  return {
    originalname: 'report.pdf',
    buffer: Buffer.from('file-content'),
    size: 12,
    mimetype: 'application/pdf',
  };
}

// =============================================================
// BlackboardAttachmentsService
// =============================================================

describe('BlackboardAttachmentsService', () => {
  let service: BlackboardAttachmentsService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockDocs: ReturnType<typeof createMockDocumentsService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockDocs = createMockDocumentsService();
    service = new BlackboardAttachmentsService(
      mockDb as unknown as DatabaseService,
      mockDocs as unknown as DocumentsService,
    );
  });

  // =============================================================
  // uploadAttachment
  // =============================================================

  describe('uploadAttachment', () => {
    it('should delegate to documentsService.createDocument', async () => {
      const result = await service.uploadAttachment(1, makeFile() as never, 10, 5);

      expect(result).toBeDefined();
      expect(mockDocs.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'blackboard',
          accessScope: 'blackboard',
          blackboardEntryId: 1,
          fileUuid: 'mock-uuid-v7',
        }),
        5,
        10,
      );
    });
  });

  // =============================================================
  // getAttachments
  // =============================================================

  describe('getAttachments', () => {
    it('should delegate to documentsService.listDocuments', async () => {
      const result = await service.getAttachments(1, 10, 5);

      expect(result).toEqual([]);
      expect(mockDocs.listDocuments).toHaveBeenCalledWith(10, 5, {
        blackboardEntryId: 1,
        isActive: 1,
        page: 1,
        limit: 100,
      });
    });
  });

  // =============================================================
  // downloadAttachment
  // =============================================================

  describe('downloadAttachment', () => {
    it('should delegate to documentsService.getDocumentContent', async () => {
      const result = await service.downloadAttachment(1, 5, 10);

      expect(result.originalName).toBe('test.pdf');
    });
  });

  // =============================================================
  // previewAttachment
  // =============================================================

  describe('previewAttachment', () => {
    it('should delegate to documentsService.getDocumentContent', async () => {
      const result = await service.previewAttachment(1, 5, 10);

      expect(result.originalName).toBe('test.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(mockDocs.getDocumentContent).toHaveBeenCalledWith(1, 5, 10);
    });
  });

  // =============================================================
  // downloadByFileUuid
  // =============================================================

  describe('downloadByFileUuid', () => {
    it('should throw NotFoundException when doc not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.downloadByFileUuid('some-uuid', 5, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should download by file UUID', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

      const result = await service.downloadByFileUuid('some-uuid', 5, 10);

      expect(result.originalName).toBe('test.pdf');
      expect(mockDocs.getDocumentContent).toHaveBeenCalledWith(42, 5, 10);
    });
  });

  // =============================================================
  // deleteAttachment
  // =============================================================

  describe('deleteAttachment', () => {
    it('should delegate to documentsService.deleteDocument', async () => {
      const result = await service.deleteAttachment(1, 5, 10);

      expect(result.message).toBe('Attachment deleted successfully');
      expect(mockDocs.deleteDocument).toHaveBeenCalledWith(1, 5, 10);
    });
  });
});
