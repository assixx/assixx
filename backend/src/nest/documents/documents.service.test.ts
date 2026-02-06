/**
 * Unit tests for DocumentsService (Facade)
 *
 * Phase 9: Service tests — mocked dependencies.
 * Focus: access control (admin vs creator), not-found paths, stats mapping,
 *        unread count with scope filtering, UUID resolution.
 * Pure functions already tested in documents.helpers.test.ts.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { DocumentAccessService } from './document-access.service.js';
import type { DocumentNotificationService } from './document-notification.service.js';
import type { DocumentStorageService } from './document-storage.service.js';
import { DocumentsService } from './documents.service.js';

// =============================================================
// Mocks
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

function createMockAccessService() {
  return {
    checkDocumentAccess: vi.fn().mockResolvedValue(true),
    isDocumentRead: vi.fn().mockResolvedValue(false),
    buildDocumentQuery: vi.fn(),
  };
}

function createMockStorageService() {
  return {
    getDocumentContent: vi.fn(),
    writeFileToDisk: vi.fn(),
  };
}

function createMockNotificationService() {
  return { createUploadNotification: vi.fn() };
}

function createMockActivityLogger() {
  return {
    logCreate: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined),
    logDelete: vi.fn().mockResolvedValue(undefined),
  };
}

/** Minimal doc DB row */
function createDocRow(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    tenant_id: 42,
    filename: 'doc.pdf',
    original_name: 'Report.pdf',
    file_size: 1024,
    mime_type: 'application/pdf',
    category: 'general',
    access_scope: 'company',
    owner_user_id: 10,
    target_team_id: null,
    target_department_id: null,
    description: null,
    salary_year: null,
    salary_month: null,
    blackboard_entry_id: null,
    conversation_id: null,
    tags: null,
    is_active: 1,
    created_by: 10,
    created_at: new Date('2026-01-15'),
    updated_at: new Date('2026-01-15'),
    file_uuid: 'test-uuid',
    file_checksum: null,
    file_path: null,
    file_content: null,
    storage_type: 'database',
    download_count: 0,
    uploaded_by_name: 'John Doe',
    ...overrides,
  };
}

// =============================================================
// DocumentsService
// =============================================================

describe('DocumentsService', () => {
  let service: DocumentsService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockAccess: ReturnType<typeof createMockAccessService>;
  let mockStorage: ReturnType<typeof createMockStorageService>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockAccess = createMockAccessService();
    mockStorage = createMockStorageService();
    service = new DocumentsService(
      mockDb as unknown as DatabaseService,
      mockAccess as unknown as DocumentAccessService,
      mockStorage as unknown as DocumentStorageService,
      createMockNotificationService() as unknown as DocumentNotificationService,
      createMockActivityLogger() as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // getDocumentById
  // =============================================================

  describe('getDocumentById', () => {
    it('should throw NotFoundException when document not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getDocumentById(999, 42, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user has no access', async () => {
      mockDb.query.mockResolvedValueOnce([createDocRow()]);
      mockAccess.checkDocumentAccess.mockResolvedValueOnce(false);

      await expect(service.getDocumentById(1, 42, 99)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return enriched document when user has access', async () => {
      mockDb.query.mockResolvedValueOnce([createDocRow()]);
      mockAccess.checkDocumentAccess.mockResolvedValueOnce(true);
      // markAsRead
      mockDb.query.mockResolvedValueOnce([]);
      mockAccess.isDocumentRead.mockResolvedValueOnce(true);

      const result = await service.getDocumentById(1, 42, 10);

      expect(result).toBeDefined();
    });
  });

  // =============================================================
  // getDocumentByFileUuid
  // =============================================================

  describe('getDocumentByFileUuid', () => {
    it('should return null when document not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getDocumentByFileUuid('missing-uuid', 42, 1);

      expect(result).toBeNull();
    });

    it('should return null when user has no access', async () => {
      mockDb.query.mockResolvedValueOnce([createDocRow()]);
      mockAccess.checkDocumentAccess.mockResolvedValueOnce(false);

      const result = await service.getDocumentByFileUuid('test-uuid', 42, 99);

      expect(result).toBeNull();
    });
  });

  // =============================================================
  // deleteDocument — role checks
  // =============================================================

  describe('deleteDocument', () => {
    it('should throw NotFoundException when document missing', async () => {
      // getDocumentRow → query returns empty
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.deleteDocument(999, 42, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for non-admin user', async () => {
      // getDocumentRow
      mockDb.query.mockResolvedValueOnce([createDocRow()]);
      // getUserById → employee
      mockDb.query.mockResolvedValueOnce([{ role: 'employee' }]);

      await expect(service.deleteDocument(1, 42, 3)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should soft-delete for admin user', async () => {
      // getDocumentRow
      mockDb.query.mockResolvedValueOnce([createDocRow()]);
      // getUserById → admin
      mockDb.query.mockResolvedValueOnce([{ role: 'admin' }]);
      // UPDATE is_active = 4
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.deleteDocument(1, 42, 2);

      expect(result.message).toBe('Document deleted successfully');
      const updateSql = mockDb.query.mock.calls[2]?.[0] as string;
      expect(updateSql).toContain('is_active = 4');
    });
  });

  // =============================================================
  // archiveDocument / unarchiveDocument — role checks
  // =============================================================

  describe('archiveDocument', () => {
    it('should throw ForbiddenException for employee', async () => {
      mockDb.query.mockResolvedValueOnce([{ role: 'employee' }]);

      await expect(service.archiveDocument(1, 42, 3)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should set is_active=3 for admin', async () => {
      mockDb.query.mockResolvedValueOnce([{ role: 'admin' }]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.archiveDocument(1, 42, 2);

      expect(result.message).toBe('Document archived successfully');
      const updateSql = mockDb.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain('is_active = 3');
    });
  });

  describe('unarchiveDocument', () => {
    it('should throw ForbiddenException for employee', async () => {
      mockDb.query.mockResolvedValueOnce([{ role: 'employee' }]);

      await expect(service.unarchiveDocument(1, 42, 3)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should set is_active=1 for root', async () => {
      mockDb.query.mockResolvedValueOnce([{ role: 'root' }]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.unarchiveDocument(1, 42, 1);

      expect(result.message).toBe('Document unarchived successfully');
      const updateSql = mockDb.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain('is_active = 1');
    });
  });

  // =============================================================
  // getDocumentStats
  // =============================================================

  describe('getDocumentStats', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getDocumentStats(42, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should include storage for admin', async () => {
      // getUserById → admin
      mockDb.query.mockResolvedValueOnce([{ role: 'admin' }]);
      // unread count
      mockDb.query.mockResolvedValueOnce([{ count: '5' }]);
      // storage
      mockDb.query.mockResolvedValueOnce([{ total: '1048576' }]);
      // categories
      mockDb.query.mockResolvedValueOnce([
        { category: 'general', count: '10' },
        { category: 'payroll', count: '3' },
      ]);

      const result = await service.getDocumentStats(42, 2);

      expect(result.unreadCount).toBe(5);
      expect(result.storageUsed).toBe(1048576);
      expect(result.categoryCounts).toEqual({ general: 10, payroll: 3 });
    });

    it('should skip storage for employee', async () => {
      // getUserById → employee
      mockDb.query.mockResolvedValueOnce([{ role: 'employee' }]);
      // unread count
      mockDb.query.mockResolvedValueOnce([{ count: '2' }]);
      // categories (no storage query for employee)
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getDocumentStats(42, 3);

      expect(result.storageUsed).toBe(0);
      // Only 3 queries (user, unread, categories — no storage)
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });
  });

  // =============================================================
  // getUnreadCount — scope filtering
  // =============================================================

  describe('getUnreadCount', () => {
    it('should not add access scope filter for admin', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '10' }]);

      const result = await service.getUnreadCount(42, 2, 'admin');

      expect(result.count).toBe(10);
      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).not.toContain('access_scope');
    });

    it('should add access scope filter for employee', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '3' }]);

      const result = await service.getUnreadCount(42, 3, 'employee');

      expect(result.count).toBe(3);
      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('access_scope');
      expect(sql).toContain('company');
      expect(sql).toContain('personal');
      expect(sql).toContain('payroll');
    });
  });

  // =============================================================
  // getDocumentContent — access check
  // =============================================================

  describe('getDocumentContent', () => {
    it('should throw ForbiddenException when no access', async () => {
      // getDocumentRow
      mockDb.query.mockResolvedValueOnce([createDocRow()]);
      mockAccess.checkDocumentAccess.mockResolvedValueOnce(false);

      await expect(service.getDocumentContent(1, 42, 99)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // =============================================================
  // UUID resolution
  // =============================================================

  describe('getDocumentByUuid', () => {
    it('should throw NotFoundException for unknown UUID', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.getDocumentByUuid('unknown-uuid', 42, 1),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
