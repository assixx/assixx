/**
 * Chat Conversations Service – Unit Tests
 *
 * Tests for DB-mocked public methods.
 * Uses ClsService mock for tenant/user context.
 */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ClsService } from 'nestjs-cls';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { ChatConversationsService } from './chat-conversations.service.js';

// ============================================================
// Setup
// ============================================================

function createServiceWithMock(): {
  service: ChatConversationsService;
  mockDb: { query: ReturnType<typeof vi.fn> };
  mockCls: { get: ReturnType<typeof vi.fn> };
} {
  const mockDb = { query: vi.fn() };
  const mockCls = {
    get: vi.fn((key: string) => {
      if (key === 'tenantId') return 1;
      if (key === 'userId') return 5;
      return undefined;
    }),
  };

  const service = new ChatConversationsService(
    mockCls as unknown as ClsService,
    mockDb as unknown as DatabaseService,
  );

  return { service, mockDb, mockCls };
}

// ============================================================
// Context Helpers
// ============================================================

describe('ChatConversationsService – context helpers', () => {
  it('throws ForbiddenException when tenantId is undefined', () => {
    const mockDb = { query: vi.fn() };
    const mockCls = { get: vi.fn().mockReturnValue(undefined) };
    const service = new ChatConversationsService(
      mockCls as unknown as ClsService,
      mockDb as unknown as DatabaseService,
    );

    expect(() => service['getTenantId']()).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when userId is undefined', () => {
    const mockDb = { query: vi.fn() };
    const mockCls = { get: vi.fn().mockReturnValue(undefined) };
    const service = new ChatConversationsService(
      mockCls as unknown as ClsService,
      mockDb as unknown as DatabaseService,
    );

    expect(() => service['getUserId']()).toThrow(ForbiddenException);
  });
});

// ============================================================
// DB-Mocked Methods
// ============================================================

describe('ChatConversationsService – DB-mocked methods', () => {
  let service: ChatConversationsService;
  let mockDb: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
  });

  describe('getConversation', () => {
    it('throws NotFoundException when user is not participant', async () => {
      mockDb.query.mockResolvedValueOnce([]); // participant check

      await expect(service.getConversation(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when conversation does not exist', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ user_id: 5 }]) // participant check OK
        .mockResolvedValueOnce([]); // conversation not found

      await expect(service.getConversation(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateConversation', () => {
    it('throws BadRequestException (stub)', async () => {
      await expect(service.updateConversation(1, {} as never)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteConversation', () => {
    it('throws ForbiddenException when user is not participant', async () => {
      mockDb.query.mockResolvedValueOnce([]); // participant not found

      await expect(service.deleteConversation(999)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('soft-deletes conversation for participant', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 1, deleted_at: null }]) // participant found
        .mockResolvedValueOnce([]); // UPDATE deleted_at

      const result = await service.deleteConversation(1);

      expect(result.message).toBe('Conversation deleted successfully');
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('verifyConversationAccess', () => {
    it('throws ForbiddenException when not participant', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.verifyConversationAccess(1, 5, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('succeeds when user is participant', async () => {
      mockDb.query.mockResolvedValueOnce([{ user_id: 5 }]);

      await expect(
        service.verifyConversationAccess(1, 5, 1),
      ).resolves.toBeUndefined();
    });
  });

  describe('getConversationRecipientIds', () => {
    it('returns participant IDs excluding sender', async () => {
      mockDb.query.mockResolvedValueOnce([
        { user_id: 1 },
        { user_id: 5 },
        { user_id: 10 },
      ]);

      const result = await service.getConversationRecipientIds(1, 5);

      expect(result).toEqual([1, 10]);
    });

    it('returns empty array when only sender is participant', async () => {
      mockDb.query.mockResolvedValueOnce([{ user_id: 5 }]);

      const result = await service.getConversationRecipientIds(1, 5);

      expect(result).toEqual([]);
    });
  });

  describe('updateConversationTimestamp', () => {
    it('executes UPDATE query', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.updateConversationTimestamp(1, 1);

      expect(mockDb.query).toHaveBeenCalledOnce();
    });
  });
});
