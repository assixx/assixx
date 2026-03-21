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

  return { service, mockDb, mockCls };
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

  describe('insertMessage', () => {
    it('inserts message and updates conversation timestamp', async () => {
      mockDb.query
        .mockResolvedValueOnce([]) // INSERT message
        .mockResolvedValueOnce([]); // UPDATE conversation

      await service.insertMessage(1, 10, 5, 'Hello');

      expect(mockDb.query).toHaveBeenCalledTimes(2);
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
  });
});
