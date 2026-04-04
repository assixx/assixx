/**
 * Unit tests for DocumentsService (Facade)
 *
 * Phase 9: Service tests — mocked dependencies.
 * Focus: access control (admin vs creator), not-found paths, stats mapping,
 *        unread count with scope filtering, UUID resolution.
 * Pure functions already tested in documents.helpers.test.ts.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { DocumentAccessService } from './document-access.service.js';
import type { DocumentNotificationService } from './document-notification.service.js';
import type { DocumentStorageService } from './document-storage.service.js';
import type { DocumentCreateInput } from './documents.service.js';
import { DocumentsService } from './documents.service.js';

// =============================================================
// Module Mocks
// =============================================================

const mockEventBus = vi.hoisted(() => ({
  emitDocumentUploaded: vi.fn(),
}));

vi.mock('../../utils/event-bus.js', () => ({
  eventBus: mockEventBus,
}));

// =============================================================
// Mocks
// =============================================================

function createMockDb() {
  const tenantQuery = vi.fn();
  return {
    tenantQuery,
    tenantQueryOne: vi.fn().mockResolvedValue(null),
    /** Helper functions in documents.helpers.ts still call db.query directly */
    query: tenantQuery,
  };
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
    is_active: IS_ACTIVE.ACTIVE,
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
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.getDocumentById(999, 42, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user has no access', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([createDocRow()]);
      mockAccess.checkDocumentAccess.mockResolvedValueOnce(false);

      await expect(service.getDocumentById(1, 42, 99)).rejects.toThrow(ForbiddenException);
    });

    it('should return enriched document when user has access', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([createDocRow()]);
      mockAccess.checkDocumentAccess.mockResolvedValueOnce(true);
      // markAsRead
      mockDb.tenantQuery.mockResolvedValueOnce([]);
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
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.getDocumentByFileUuid('missing-uuid', 42, 1);

      expect(result).toBeNull();
    });

    it('should return null when user has no access', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([createDocRow()]);
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
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.deleteDocument(999, 42, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-admin user', async () => {
      // getDocumentRow
      mockDb.tenantQuery.mockResolvedValueOnce([createDocRow()]);
      // getUserById → employee
      mockDb.tenantQuery.mockResolvedValueOnce([{ role: 'employee' }]);

      await expect(service.deleteDocument(1, 42, 3)).rejects.toThrow(ForbiddenException);
    });

    it('should soft-delete for admin user', async () => {
      // getDocumentRow
      mockDb.tenantQuery.mockResolvedValueOnce([createDocRow()]);
      // getUserById → admin
      mockDb.tenantQuery.mockResolvedValueOnce([{ role: 'admin' }]);
      // UPDATE is_active = 4
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.deleteDocument(1, 42, 2);

      expect(result.message).toBe('Document deleted successfully');
      const updateSql = mockDb.tenantQuery.mock.calls[2]?.[0] as string;
      expect(updateSql).toContain(`is_active = ${IS_ACTIVE.DELETED}`);
    });
  });

  // =============================================================
  // archiveDocument / unarchiveDocument — role checks
  // =============================================================

  describe('archiveDocument', () => {
    it('should throw ForbiddenException for employee', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ role: 'employee' }]);

      await expect(service.archiveDocument(1, 42, 3)).rejects.toThrow(ForbiddenException);
    });

    it(`should set is_active = ${IS_ACTIVE.ARCHIVED} for admin`, async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ role: 'admin' }]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.archiveDocument(1, 42, 2);

      expect(result.message).toBe('Document archived successfully');
      const updateSql = mockDb.tenantQuery.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain(`is_active = ${IS_ACTIVE.ARCHIVED}`);
    });
  });

  describe('unarchiveDocument', () => {
    it('should throw ForbiddenException for employee', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ role: 'employee' }]);

      await expect(service.unarchiveDocument(1, 42, 3)).rejects.toThrow(ForbiddenException);
    });

    it(`should set is_active = ${IS_ACTIVE.ACTIVE} for root`, async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ role: 'root' }]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.unarchiveDocument(1, 42, 1);

      expect(result.message).toBe('Document unarchived successfully');
      const updateSql = mockDb.tenantQuery.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain(`is_active = ${IS_ACTIVE.ACTIVE}`);
    });
  });

  // =============================================================
  // getDocumentStats
  // =============================================================

  describe('getDocumentStats', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.getDocumentStats(42, 999)).rejects.toThrow(NotFoundException);
    });

    it('should include storage for admin', async () => {
      // getUserById → admin
      mockDb.tenantQuery.mockResolvedValueOnce([{ role: 'admin' }]);
      // unread count
      mockDb.tenantQuery.mockResolvedValueOnce([{ count: '5' }]);
      // storage
      mockDb.tenantQuery.mockResolvedValueOnce([{ total: '1048576' }]);
      // categories
      mockDb.tenantQuery.mockResolvedValueOnce([
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
      mockDb.tenantQuery.mockResolvedValueOnce([{ role: 'employee' }]);
      // unread count
      mockDb.tenantQuery.mockResolvedValueOnce([{ count: '2' }]);
      // categories (no storage query for employee)
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.getDocumentStats(42, 3);

      expect(result.storageUsed).toBe(0);
      // Only 3 queries (user, unread, categories — no storage)
      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(3);
    });
  });

  // =============================================================
  // getUnreadCount — scope filtering
  // =============================================================

  describe('getUnreadCount', () => {
    it('should add chat privacy filter but no role-based scope filter for admin', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ count: '10' }]);

      const result = await service.getUnreadCount(42, 2, 'admin');

      expect(result.count).toBe(10);
      const sql = mockDb.tenantQuery.mock.calls[0]?.[0] as string;
      // Chat privacy filter is present for ALL users
      expect(sql).toContain("d.access_scope != 'chat'");
      expect(sql).toContain('conversation_participants');
      // But no role-based scope filter (company/personal/payroll) for admin
      expect(sql).not.toContain("d.access_scope = 'company'");
    });

    it('should add access scope filter for employee', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ count: '3' }]);

      const result = await service.getUnreadCount(42, 3, 'employee');

      expect(result.count).toBe(3);
      const sql = mockDb.tenantQuery.mock.calls[0]?.[0] as string;
      expect(sql).toContain('access_scope');
      expect(sql).toContain('company');
      expect(sql).toContain('personal');
      expect(sql).toContain('payroll');
    });

    it('should include chat in employee access scope filter', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ count: '5' }]);

      await service.getUnreadCount(42, 3, 'employee');

      const sql = mockDb.tenantQuery.mock.calls[0]?.[0] as string;
      // Employee scope filter must include 'chat' — chat privacy check
      // already restricts to conversation participants only.
      // Without this, employees see 0 unread chat attachments.
      expect(sql).toContain("d.access_scope = 'chat'");
    });
  });

  // =============================================================
  // getDocumentContent — access check
  // =============================================================

  describe('getDocumentContent', () => {
    it('should throw ForbiddenException when no access', async () => {
      // getDocumentRow
      mockDb.tenantQuery.mockResolvedValueOnce([createDocRow()]);
      mockAccess.checkDocumentAccess.mockResolvedValueOnce(false);

      await expect(service.getDocumentContent(1, 42, 99)).rejects.toThrow(ForbiddenException);
    });
  });

  // =============================================================
  // UUID resolution
  // =============================================================

  describe('getDocumentByUuid', () => {
    it('should throw NotFoundException for unknown UUID', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.getDocumentByUuid('unknown-uuid', 42, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =============================================================
  // updateDocument
  // =============================================================

  describe('updateDocument', () => {
    it('should throw NotFoundException when document not found', async () => {
      // getDocumentRow → empty
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.updateDocument(999, { filename: 'x' } as never, 42, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([createDocRow()]);
      // getUserById → empty
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.updateDocument(1, { filename: 'x' } as never, 42, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for non-admin non-creator', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([createDocRow({ created_by: 10 })]);
      // getUserById → employee (not creator)
      mockDb.tenantQuery.mockResolvedValueOnce([{ role: 'employee' }]);

      await expect(service.updateDocument(1, { filename: 'x' } as never, 42, 99)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow admin to update any document', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([createDocRow({ created_by: 10 })]);
      mockDb.tenantQuery.mockResolvedValueOnce([{ role: 'admin' }]);
      // UPDATE
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.updateDocument(1, { filename: 'Updated.pdf' } as never, 42, 2);

      expect(result.message).toBe('Document updated successfully');
    });

    it('should allow creator to update own document', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([createDocRow({ created_by: 10 })]);
      mockDb.tenantQuery.mockResolvedValueOnce([{ role: 'employee' }]);
      // UPDATE
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.updateDocument(1, { description: 'New desc' } as never, 42, 10);

      expect(result.message).toBe('Document updated successfully');
    });
  });

  // =============================================================
  // markDocumentAsRead
  // =============================================================

  describe('markDocumentAsRead', () => {
    it('should upsert read status and return success', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.markDocumentAsRead(1, 42, 10);

      expect(result.success).toBe(true);
      expect(mockDb.tenantQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        [1, 10, 42],
      );
    });
  });

  // =============================================================
  // getChatFolders
  // =============================================================

  describe('getChatFolders', () => {
    it('should return folders with total count', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([
        {
          conversationId: 1,
          conversationUuid: 'conv-uuid',
          participantName: 'Lisa',
          participantId: 2,
          attachmentCount: 3,
          isGroup: false,
          groupName: null,
        },
      ]);

      const result = await service.getChatFolders(42, 10);

      expect(result.folders).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.folders[0]?.participantName).toBe('Lisa');
    });

    it('should return empty when no chat folders', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.getChatFolders(42, 10);

      expect(result.folders).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // =============================================================
  // getDocumentContent — success path
  // =============================================================

  describe('getDocumentContent — success', () => {
    it('should return content from storage service', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([createDocRow()]);
      mockAccess.checkDocumentAccess.mockResolvedValueOnce(true);
      mockStorage.getDocumentContent.mockResolvedValueOnce({
        content: Buffer.from('PDF data'),
        originalName: 'Report.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
      });

      const result = await service.getDocumentContent(1, 42, 10);

      expect(result.originalName).toBe('Report.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(mockStorage.getDocumentContent).toHaveBeenCalledOnce();
    });

    it('should throw NotFoundException when document missing', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.getDocumentContent(999, 42, 10)).rejects.toThrow(NotFoundException);
    });
  });

  // =============================================================
  // getDocumentByFileUuid — success path
  // =============================================================

  describe('getDocumentByFileUuid — success', () => {
    it('should return enriched document when found and accessible', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([createDocRow()]);
      mockAccess.checkDocumentAccess.mockResolvedValueOnce(true);
      mockAccess.isDocumentRead.mockResolvedValueOnce(true);

      const result = await service.getDocumentByFileUuid('test-uuid', 42, 10);

      expect(result).not.toBeNull();
    });
  });

  // =============================================================
  // listDocuments
  // =============================================================

  describe('listDocuments', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]); // getUserById → empty

      await expect(
        service.listDocuments(42, 999, {
          page: 1,
          limit: 10,
          isActive: 1,
        } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return paginated documents for admin', async () => {
      // getUserById → admin
      mockDb.tenantQuery.mockResolvedValueOnce([{ role: 'admin' }]);
      mockAccess.buildDocumentQuery.mockReturnValueOnce({
        baseQuery:
          "SELECT d.*, u.username as uploaded_by_name FROM documents d LEFT JOIN users u ON d.created_by = u.id WHERE d.tenant_id = $1 AND d.is_active = $2 AND d.access_scope != 'chat'",
        params: [42, 1],
        paramIndex: 3,
      });
      // getDocumentsCount → count query
      mockDb.tenantQuery.mockResolvedValueOnce([{ count: '25' }]);
      // paginated query → 2 docs
      mockDb.tenantQuery.mockResolvedValueOnce([createDocRow({ id: 1 }), createDocRow({ id: 2 })]);
      // isDocumentRead for each doc
      mockAccess.isDocumentRead.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      const result = await service.listDocuments(42, 1, {
        page: 1,
        limit: 10,
        isActive: 1,
      } as never);

      expect(result.documents).toHaveLength(2);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(3);
    });
  });

  // =============================================================
  // createDocument
  // =============================================================

  describe('createDocument', () => {
    const validInput: DocumentCreateInput = {
      filename: 'report.pdf',
      originalName: 'Quarterly Report.pdf',
      fileSize: 2048,
      fileContent: Buffer.from('PDF content'),
      mimeType: 'application/pdf',
      category: 'general',
      accessScope: 'company',
    };

    it('should create document and emit event', async () => {
      // insertDocumentRecord → INSERT RETURNING id
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 42 }]);
      // getDocumentById → SELECT doc
      mockDb.tenantQuery.mockResolvedValueOnce([createDocRow({ id: 42 })]);
      mockAccess.checkDocumentAccess.mockResolvedValueOnce(true);
      // markAsRead
      mockDb.tenantQuery.mockResolvedValueOnce([]);
      mockAccess.isDocumentRead.mockResolvedValueOnce(true);

      const result = await service.createDocument(validInput, 10, 1);

      expect(result).toBeDefined();
      expect(mockEventBus.emitDocumentUploaded).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ id: 42 }),
      );
    });

    it('should write to disk when storageType is filesystem', async () => {
      const input: DocumentCreateInput = {
        ...validInput,
        storageType: 'filesystem',
        filePath: '/uploads/test.pdf',
      };

      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 42 }]);
      mockDb.tenantQuery.mockResolvedValueOnce([createDocRow({ id: 42 })]);
      mockAccess.checkDocumentAccess.mockResolvedValueOnce(true);
      mockDb.tenantQuery.mockResolvedValueOnce([]);
      mockAccess.isDocumentRead.mockResolvedValueOnce(true);

      await service.createDocument(input, 10, 1);

      expect(mockStorage.writeFileToDisk).toHaveBeenCalledWith(
        '/uploads/test.pdf',
        input.fileContent,
      );
    });
  });

  // =============================================================
  // UUID-based wrappers
  // =============================================================

  describe('UUID wrappers', () => {
    it('updateDocumentByUuid should resolve UUID and update', async () => {
      // resolveDocumentIdByUuid → SELECT id
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 5 }]);
      // getDocumentRow
      mockDb.tenantQuery.mockResolvedValueOnce([createDocRow({ id: 5 })]);
      // getUserById
      mockDb.tenantQuery.mockResolvedValueOnce([{ role: 'admin' }]);
      // UPDATE
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.updateDocumentByUuid(
        'doc-uuid',
        { filename: 'New.pdf' } as never,
        42,
        1,
      );

      expect(result.message).toBe('Document updated successfully');
    });

    it('deleteDocumentByUuid should resolve UUID and delete', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 5 }]);
      mockDb.tenantQuery.mockResolvedValueOnce([createDocRow({ id: 5 })]);
      mockDb.tenantQuery.mockResolvedValueOnce([{ role: 'admin' }]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.deleteDocumentByUuid('doc-uuid', 42, 1);

      expect(result.message).toBe('Document deleted successfully');
    });

    it('archiveDocumentByUuid should resolve UUID and archive', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 5 }]);
      mockDb.tenantQuery.mockResolvedValueOnce([{ role: 'admin' }]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.archiveDocumentByUuid('doc-uuid', 42, 1);

      expect(result.message).toBe('Document archived successfully');
    });

    it('unarchiveDocumentByUuid should resolve UUID and unarchive', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 5 }]);
      mockDb.tenantQuery.mockResolvedValueOnce([{ role: 'root' }]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.unarchiveDocumentByUuid('doc-uuid', 42, 1);

      expect(result.message).toBe('Document unarchived successfully');
    });

    it('getDocumentContentByUuid should resolve UUID and get content', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 5 }]);
      mockDb.tenantQuery.mockResolvedValueOnce([createDocRow({ id: 5 })]);
      mockAccess.checkDocumentAccess.mockResolvedValueOnce(true);
      mockStorage.getDocumentContent.mockResolvedValueOnce({
        content: Buffer.from('data'),
        originalName: 'file.pdf',
        mimeType: 'application/pdf',
        fileSize: 512,
      });

      const result = await service.getDocumentContentByUuid('doc-uuid', 42, 1);

      expect(result.originalName).toBe('file.pdf');
    });

    it('markDocumentAsReadByUuid should resolve UUID and mark read', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 5 }]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.markDocumentAsReadByUuid('doc-uuid', 42, 1);

      expect(result.success).toBe(true);
    });
  });

  // =============================================================
  // Edge cases: user not found
  // =============================================================

  describe('edge cases — user not found', () => {
    it('archiveDocument should throw when user not found', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.archiveDocument(1, 42, 999)).rejects.toThrow(NotFoundException);
    });

    it('unarchiveDocument should throw when user not found', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.unarchiveDocument(1, 42, 999)).rejects.toThrow(NotFoundException);
    });

    it('deleteDocument should throw when user not found', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([createDocRow()]);
      mockDb.tenantQuery.mockResolvedValueOnce([]); // getUserById → empty

      await expect(service.deleteDocument(1, 42, 999)).rejects.toThrow(NotFoundException);
    });
  });

  // =============================================================
  // getUnreadCount — root role
  // =============================================================

  describe('getUnreadCount — root', () => {
    it('should not add scope filter for root user', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ count: '7' }]);

      const result = await service.getUnreadCount(42, 1, 'root');

      expect(result.count).toBe(7);
      const sql = mockDb.tenantQuery.mock.calls[0]?.[0] as string;
      expect(sql).not.toContain("d.access_scope = 'company'");
    });
  });
});
