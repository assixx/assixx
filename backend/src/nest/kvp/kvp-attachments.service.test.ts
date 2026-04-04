/**
 * Unit tests for KvpAttachmentsService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Attachment CRUD, UUID-based lookup (NotFoundException),
 *        field mapping (camelCase output), date toISOString.
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { KvpAttachmentsService } from './kvp-attachments.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  const qf = vi.fn();
  return { query: qf, tenantQuery: qf };
}

function makeDbAttachment(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    suggestion_id: 42,
    file_name: 'doc.pdf',
    file_path: '/uploads/doc.pdf',
    file_type: 'application/pdf',
    file_size: 1024,
    uploaded_by: 5,
    file_uuid: 'uuid-123',
    uploaded_at: new Date('2025-06-01T10:00:00Z'),
    ...overrides,
  };
}

// =============================================================
// KvpAttachmentsService
// =============================================================

describe('KvpAttachmentsService', () => {
  let service: KvpAttachmentsService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new KvpAttachmentsService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // getAttachments
  // =============================================================

  describe('getAttachments', () => {
    it('should return mapped attachments', async () => {
      mockDb.query.mockResolvedValueOnce([makeDbAttachment()]);

      const result = await service.getAttachments(42, 10);

      expect(result).toHaveLength(1);
      expect(result[0]?.fileName).toBe('doc.pdf');
      expect(result[0]?.fileUuid).toBe('uuid-123');
    });

    it('should handle null uploaded_at', async () => {
      mockDb.query.mockResolvedValueOnce([makeDbAttachment({ uploaded_at: null })]);

      const result = await service.getAttachments(42, 10);

      expect(result[0]?.createdAt).toBeDefined();
    });
  });

  // =============================================================
  // addAttachment
  // =============================================================

  describe('addAttachment', () => {
    it('should insert and return attachment', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 99 }]);

      const result = await service.addAttachment(42, {
        fileName: 'report.pdf',
        filePath: '/uploads/report.pdf',
        fileType: 'application/pdf',
        fileSize: 2048,
        uploadedBy: 5,
        fileUuid: 'new-uuid',
      });

      expect(result.id).toBe(99);
      expect(result.suggestionId).toBe(42);
    });

    it('should throw when insert fails', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.addAttachment(42, {
          fileName: 'test.pdf',
          filePath: '/test',
          fileType: 'application/pdf',
          fileSize: 100,
          uploadedBy: 5,
          fileUuid: 'uuid',
        }),
      ).rejects.toThrow('Failed to add attachment');
    });
  });

  // =============================================================
  // findAttachmentByUuid
  // =============================================================

  describe('findAttachmentByUuid', () => {
    it('should throw NotFoundException when not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.findAttachmentByUuid('missing-uuid', 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return attachment with suggestion data', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          ...makeDbAttachment(),
          submitted_by: 5,
          status: 'open',
          org_level: 'company',
          org_id: 10,
        },
      ]);

      const result = await service.findAttachmentByUuid('uuid-123', 10);

      expect(result.submitted_by).toBe(5);
    });
  });
});
