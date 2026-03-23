/**
 * Chat Messages Service – Unit Tests
 *
 * Tests for pure helper methods + DB-mocked public methods.
 * Uses ClsService mock for tenant/user context.
 */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ClsService } from 'nestjs-cls';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import type { E2eKeysService } from '../e2e-keys/e2e-keys.service.js';
import { ChatMessagesService } from './chat-messages.service.js';

vi.mock('../../utils/event-bus.js', () => ({
  eventBus: {
    emitMessagesRead: vi.fn(),
    emitNewMessage: vi.fn(),
  },
}));

// ============================================================
// Setup
// ============================================================

function createServiceWithMock(): {
  service: ChatMessagesService;
  mockDb: {
    query: ReturnType<typeof vi.fn>;
    tenantTransaction: ReturnType<typeof vi.fn>;
  };
  mockCls: { get: ReturnType<typeof vi.fn> };
  mockE2eKeys: { validateKeyVersion: ReturnType<typeof vi.fn> };
} {
  const mockDb = {
    query: vi.fn(),
    tenantTransaction: vi.fn((callback: (client: unknown) => unknown) =>
      callback({
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }),
    ),
  };
  const mockCls = {
    get: vi.fn((key: string) => {
      if (key === 'tenantId') return 1;
      if (key === 'userId') return 5;
      return undefined;
    }),
  };
  const mockE2eKeys = {
    validateKeyVersion: vi.fn().mockResolvedValue(true),
  };

  const service = new ChatMessagesService(
    mockCls as unknown as ClsService,
    mockDb as unknown as DatabaseService,
    mockE2eKeys as unknown as E2eKeysService,
  );

  return { service, mockDb, mockCls, mockE2eKeys };
}

// ============================================================
// Pure Private Methods
// ============================================================

describe('ChatMessagesService – pure helpers', () => {
  let service: ChatMessagesService;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
  });

  describe('buildMessagesWhereClause', () => {
    it('builds base clause without filters', () => {
      const result = service['buildMessagesWhereClause'](1, 1, {}, null);

      expect(result.whereClause).toContain('conversation_id = $1');
      expect(result.whereClause).toContain('tenant_id = $2');
      expect(result.params).toEqual([1, 1]);
      expect(result.paramIndex).toBe(3);
    });

    it('adds deletedAt filter', () => {
      const deletedAt = new Date('2025-06-01');
      const result = service['buildMessagesWhereClause'](1, 1, {}, deletedAt);

      expect(result.whereClause).toContain('created_at > $3');
      expect(result.params).toEqual([1, 1, deletedAt]);
      expect(result.paramIndex).toBe(4);
    });

    it('adds search filter', () => {
      const result = service['buildMessagesWhereClause'](1, 1, { search: 'hello' }, null);

      expect(result.whereClause).toContain('content LIKE $3');
      expect(result.params).toContain('%hello%');
    });

    it('adds date range filters', () => {
      const result = service['buildMessagesWhereClause'](
        1,
        1,
        { startDate: '2025-06-01', endDate: '2025-06-30' },
        null,
      );

      expect(result.whereClause).toContain('created_at >= $3');
      expect(result.whereClause).toContain('created_at <= $4');
    });

    it('adds hasAttachment filter', () => {
      const result = service['buildMessagesWhereClause'](1, 1, { hasAttachment: true }, null);

      expect(result.whereClause).toContain('attachment_path IS NOT NULL');
    });
  });
});

// ============================================================
// Context Helpers
// ============================================================

describe('ChatMessagesService – context helpers', () => {
  it('throws ForbiddenException when tenantId is undefined', () => {
    const mockDb = { query: vi.fn(), tenantTransaction: vi.fn() };
    const mockCls = { get: vi.fn().mockReturnValue(undefined) };
    const mockE2eKeys = { validateKeyVersion: vi.fn() };
    const service = new ChatMessagesService(
      mockCls as unknown as ClsService,
      mockDb as unknown as DatabaseService,
      mockE2eKeys as unknown as E2eKeysService,
    );

    expect(() => service['getTenantId']()).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when userId is undefined', () => {
    const mockDb = { query: vi.fn(), tenantTransaction: vi.fn() };
    const mockCls = { get: vi.fn().mockReturnValue(undefined) };
    const mockE2eKeys = { validateKeyVersion: vi.fn() };
    const service = new ChatMessagesService(
      mockCls as unknown as ClsService,
      mockDb as unknown as DatabaseService,
      mockE2eKeys as unknown as E2eKeysService,
    );

    expect(() => service['getUserId']()).toThrow(ForbiddenException);
  });
});

// ============================================================
// Stub Methods
// ============================================================

describe('ChatMessagesService – stubs', () => {
  let service: ChatMessagesService;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
  });

  it('editMessage throws NotFoundException when message not found', async () => {
    const result = createServiceWithMock();
    result.mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: unknown) => unknown) =>
        callback({
          query: vi.fn().mockResolvedValue({ rows: [] }),
        }),
    );
    await expect(result.service.editMessage(999, {} as never)).rejects.toThrow(NotFoundException);
  });

  it('editMessage throws UnprocessableEntityException for E2E messages', async () => {
    const result = createServiceWithMock();
    result.mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: unknown) => unknown) =>
        callback({
          query: vi.fn().mockResolvedValue({ rows: [{ is_e2e: true }] }),
        }),
    );
    await expect(result.service.editMessage(1, {} as never)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('editMessage throws BadRequestException for non-E2E messages (stub)', async () => {
    const result = createServiceWithMock();
    result.mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: unknown) => unknown) =>
        callback({
          query: vi.fn().mockResolvedValue({ rows: [{ is_e2e: false }] }),
        }),
    );
    await expect(result.service.editMessage(1, {} as never)).rejects.toThrow(BadRequestException);
  });

  it('deleteMessage throws BadRequestException', async () => {
    await expect(service.deleteMessage(1)).rejects.toThrow(BadRequestException);
  });

  it('searchMessages throws BadRequestException', async () => {
    await expect(service.searchMessages({} as never)).rejects.toThrow(BadRequestException);
  });
});

// ============================================================
// DB-Mocked Methods
// ============================================================

describe('ChatMessagesService – DB-mocked methods', () => {
  let service: ChatMessagesService;
  let mockDb: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
  });

  describe('getMessagesCount', () => {
    it('returns parsed count from query result', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '42' }]);

      const count = await service['getMessagesCount']('WHERE m.conversation_id = $1', [1]);

      expect(count).toBe(42);
    });

    it('returns 0 when no results', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const count = await service['getMessagesCount']('WHERE m.conversation_id = $1', [1]);

      expect(count).toBe(0);
    });
  });

  describe('insertMessage', () => {
    it('inserts message and updates conversation timestamp', async () => {
      mockDb.query
        .mockResolvedValueOnce([]) // INSERT message
        .mockResolvedValueOnce([]); // UPDATE conversation

      await service.insertMessage(1, 10, 5, 'Hello');

      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('attachDocumentsToMessages', () => {
    it('skips query when messages array is empty', async () => {
      await service['attachDocumentsToMessages']([], 1);

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('attaches documents to matching messages', async () => {
      const messages = [
        { id: 10, attachments: [] },
        { id: 20, attachments: [] },
      ] as never[];
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          message_id: 10,
          file_uuid: 'uuid-1',
          filename: 'f.pdf',
          original_name: 'f.pdf',
          file_size: 100,
          mime_type: 'application/pdf',
          uploaded_at: null,
        },
      ]);

      await service['attachDocumentsToMessages'](messages, 1);

      expect(mockDb.query).toHaveBeenCalledOnce();
      expect((messages[0] as { attachments: unknown[] }).attachments).toHaveLength(1);
      expect((messages[1] as { attachments: unknown[] }).attachments).toHaveLength(0);
    });
  });

  describe('fetchSenderInfo', () => {
    it('returns sender info for active user', async () => {
      const sender = {
        username: 'john',
        first_name: 'John',
        last_name: 'Doe',
        profile_picture: null,
      };
      mockDb.query.mockResolvedValueOnce([sender]);

      const result = await service['fetchSenderInfo'](5, 1);

      expect(result).toEqual(sender);
    });

    it('throws NotFoundException when sender not found or inactive', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service['fetchSenderInfo'](999, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUnreadCount', () => {
    it('returns zero when no unread messages', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getUnreadCount();

      expect(result.totalUnread).toBe(0);
      expect(result.conversations).toEqual([]);
    });

    it('returns unread summary', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          conversationId: 1,
          conversationName: 'General',
          unreadCount: '3',
          lastMessageTime: new Date('2025-06-15'),
        },
      ]);

      const result = await service.getUnreadCount();

      expect(result.totalUnread).toBe(3);
      expect(result.conversations).toHaveLength(1);
      expect(result.conversations[0]?.conversationId).toBe(1);
    });
  });

  describe('markAsRead', () => {
    it('marks conversation as read', async () => {
      const verifyAccess = vi.fn().mockResolvedValue(undefined);
      mockDb.query
        .mockResolvedValueOnce([{ last_read_message_id: 10 }]) // getUnreadMessageEntries → last_read
        .mockResolvedValueOnce([]) // getUnreadMessageEntries → unread messages (none)
        .mockResolvedValueOnce([{ max_id: 42 }]) // MAX message id
        .mockResolvedValueOnce([]); // UPDATE last_read

      const result = await service.markAsRead(1, verifyAccess);

      expect(result.markedCount).toBe(42);
      expect(verifyAccess).toHaveBeenCalledOnce();
    });

    it('emits messagesRead event when unread messages exist', async () => {
      const { eventBus } = await import('../../utils/event-bus.js');
      const verifyAccess = vi.fn().mockResolvedValue(undefined);
      mockDb.query
        .mockResolvedValueOnce([{ last_read_message_id: 10 }]) // getUnreadMessageEntries → last_read
        .mockResolvedValueOnce([
          { messageId: 11, senderId: 2 },
          { messageId: 12, senderId: 3 },
        ]) // unread messages found
        .mockResolvedValueOnce([{ max_id: 12 }]) // MAX message id
        .mockResolvedValueOnce([]); // UPDATE last_read

      const result = await service.markAsRead(1, verifyAccess);

      expect(result.markedCount).toBe(12);
      expect(eventBus.emitMessagesRead).toHaveBeenCalledWith({
        readByUserId: 5,
        entries: [
          { messageId: 11, senderId: 2 },
          { messageId: 12, senderId: 3 },
        ],
      });
    });
  });

  describe('sendMessage', () => {
    it('propagates verifyAccess rejection', async () => {
      const verifyAccess = vi.fn().mockRejectedValue(new ForbiddenException('No access'));

      await expect(
        service.sendMessage(10, { message: 'Hi' } as never, verifyAccess, vi.fn(), vi.fn()),
      ).rejects.toThrow(ForbiddenException);
      expect(verifyAccess).toHaveBeenCalledWith(10, 5, 1);
    });

    it('throws BadRequestException when content resolution fails', async () => {
      const verifyAccess = vi.fn().mockResolvedValue(undefined);

      await expect(
        service.sendMessage(10, {} as never, verifyAccess, vi.fn(), vi.fn()),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws UnprocessableEntityException on stale E2E key version', async () => {
      const result = createServiceWithMock();
      result.mockE2eKeys.validateKeyVersion.mockResolvedValue(false);
      const verifyAccess = vi.fn().mockResolvedValue(undefined);
      const dto = { encryptedContent: 'enc', e2eNonce: 'nonce', e2eKeyVersion: 1, e2eKeyEpoch: 1 };

      await expect(
        result.service.sendMessage(10, dto as never, verifyAccess, vi.fn(), vi.fn()),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });
});
