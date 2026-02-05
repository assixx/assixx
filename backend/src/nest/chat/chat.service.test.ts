/**
 * Unit tests for ChatService (Facade)
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Context validation (tenant/user from CLS),
 *        user listing by permissions, delegation to sub-services,
 *        stub methods (BadRequestException).
 */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import type { ChatConversationsService } from './chat-conversations.service.js';
import type { ChatMessagesService } from './chat-messages.service.js';
import type { ChatScheduledService } from './chat-scheduled.service.js';
import { ChatService } from './chat.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('./chat.helpers.js', () => ({
  filterUsersBySearch: vi.fn(
    (users: { username: string }[], search: string | undefined) => {
      if (search === undefined || search === '') return users;
      const s = search.toLowerCase();
      return users.filter((u: { username: string }) =>
        u.username.toLowerCase().includes(s),
      );
    },
  ),
  mapRowToChatUser: vi.fn((row: Record<string, unknown>) => ({
    id: row['id'],
    username: row['username'],
    email: row['email'],
    firstName: row['first_name'] ?? '',
    lastName: row['last_name'] ?? '',
    role: row['role'],
    status: 'offline',
    lastSeen: null,
  })),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockCls() {
  return {
    get: vi.fn((key: string) => {
      if (key === 'tenantId') return 10;
      if (key === 'userId') return 5;
      return undefined;
    }),
  };
}

function createMockDb() {
  return { query: vi.fn() };
}

function createMockConversationsService() {
  return {
    getConversations: vi.fn().mockResolvedValue({ data: [], pagination: {} }),
    getConversation: vi.fn().mockResolvedValue({ conversation: {} }),
    createConversation: vi.fn().mockResolvedValue({ conversation: {} }),
    updateConversation: vi.fn().mockResolvedValue(undefined),
    deleteConversation: vi.fn().mockResolvedValue({ message: 'Deleted' }),
    verifyConversationAccess: vi.fn().mockResolvedValue(undefined),
    getConversationRecipientIds: vi.fn().mockResolvedValue([]),
    updateConversationTimestamp: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockMessagesService() {
  return {
    getMessages: vi.fn().mockResolvedValue({ data: [], pagination: {} }),
    sendMessage: vi.fn().mockResolvedValue({ message: {} }),
    editMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    markAsRead: vi.fn().mockResolvedValue({ markedCount: 0 }),
    getUnreadCount: vi
      .fn()
      .mockResolvedValue({ totalUnread: 0, conversations: [] }),
    searchMessages: vi.fn().mockResolvedValue(undefined),
    insertMessage: vi.fn().mockResolvedValue(1),
  };
}

function createMockScheduledService() {
  return {
    createScheduledMessage: vi.fn().mockResolvedValue({}),
    getScheduledMessages: vi.fn().mockResolvedValue([]),
    getScheduledMessage: vi.fn().mockResolvedValue({}),
    cancelScheduledMessage: vi.fn().mockResolvedValue({ message: 'Cancelled' }),
    getConversationScheduledMessages: vi.fn().mockResolvedValue([]),
  };
}

// =============================================================
// ChatService
// =============================================================

describe('ChatService', () => {
  let service: ChatService;
  let mockCls: ReturnType<typeof createMockCls>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockConversationsService: ReturnType<
    typeof createMockConversationsService
  >;
  let mockMessagesService: ReturnType<typeof createMockMessagesService>;
  let mockScheduledService: ReturnType<typeof createMockScheduledService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCls = createMockCls();
    mockDb = createMockDb();
    mockConversationsService = createMockConversationsService();
    mockMessagesService = createMockMessagesService();
    mockScheduledService = createMockScheduledService();
    service = new ChatService(
      mockCls as never,
      mockDb as unknown as DatabaseService,
      mockConversationsService as unknown as ChatConversationsService,
      mockMessagesService as unknown as ChatMessagesService,
      mockScheduledService as unknown as ChatScheduledService,
    );
  });

  // =============================================================
  // Context validation
  // =============================================================

  describe('getChatUsers — context validation', () => {
    it('should throw ForbiddenException when tenantId is missing', async () => {
      mockCls.get.mockReturnValue(undefined);

      await expect(
        service.getChatUsers({ search: undefined } as never),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when userId is missing', async () => {
      mockCls.get.mockImplementation((key: string) =>
        key === 'tenantId' ? 10 : undefined,
      );
      // getCurrentUserPermissions will run but userId check fires first
      // Actually: getTenantId passes, getUserId throws
      await expect(
        service.getChatUsers({ search: undefined } as never),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =============================================================
  // getChatUsers — privileged
  // =============================================================

  describe('getChatUsers — admin/root', () => {
    it('should return all active users for admin', async () => {
      // getCurrentUserPermissions
      mockDb.query.mockResolvedValueOnce([
        { role: 'admin', department_id: null },
      ]);
      // fetchChatUsersByPermissions → privileged query
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          username: 'user1',
          email: 'u1@test.com',
          first_name: 'User',
          last_name: 'One',
          role: 'employee',
        },
        {
          id: 2,
          username: 'user2',
          email: 'u2@test.com',
          first_name: 'User',
          last_name: 'Two',
          role: 'employee',
        },
      ]);

      const result = await service.getChatUsers({ search: undefined } as never);

      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  // =============================================================
  // getChatUsers — non-privileged
  // =============================================================

  describe('getChatUsers — employee', () => {
    it('should return department-filtered users for employee', async () => {
      // getCurrentUserPermissions
      mockDb.query.mockResolvedValueOnce([
        { role: 'employee', department_id: 3 },
      ]);
      // fetchChatUsersByPermissions → restricted query
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          username: 'colleague',
          email: 'c@test.com',
          first_name: 'Col',
          last_name: 'League',
          role: 'employee',
        },
      ]);

      const result = await service.getChatUsers({ search: undefined } as never);

      expect(result.users).toHaveLength(1);
    });

    it('should throw NotFoundException when current user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.getChatUsers({ search: undefined } as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =============================================================
  // Conversation delegation
  // =============================================================

  describe('getConversations', () => {
    it('should delegate to conversationsService', async () => {
      const expected = { data: [], pagination: {} };
      mockConversationsService.getConversations.mockResolvedValueOnce(expected);

      const result = await service.getConversations({} as never);

      expect(result).toBe(expected);
      expect(mockConversationsService.getConversations).toHaveBeenCalled();
    });
  });

  describe('deleteConversation', () => {
    it('should delegate to conversationsService', async () => {
      await service.deleteConversation(1);

      expect(mockConversationsService.deleteConversation).toHaveBeenCalledWith(
        1,
      );
    });
  });

  // =============================================================
  // Message delegation
  // =============================================================

  describe('getUnreadCount', () => {
    it('should delegate to messagesService', async () => {
      const expected = { totalUnread: 5, conversations: [] };
      mockMessagesService.getUnreadCount.mockResolvedValueOnce(expected);

      const result = await service.getUnreadCount();

      expect(result).toBe(expected);
    });
  });

  // =============================================================
  // Scheduled message delegation
  // =============================================================

  describe('getScheduledMessages', () => {
    it('should delegate to scheduledService', async () => {
      const expected = [{ id: '1', content: 'Hello' }];
      mockScheduledService.getScheduledMessages.mockResolvedValueOnce(expected);

      const result = await service.getScheduledMessages();

      expect(result).toBe(expected);
    });
  });

  describe('cancelScheduledMessage', () => {
    it('should delegate to scheduledService', async () => {
      await service.cancelScheduledMessage('msg-1');

      expect(mockScheduledService.cancelScheduledMessage).toHaveBeenCalledWith(
        'msg-1',
      );
    });
  });

  // =============================================================
  // Stub methods (not yet implemented)
  // =============================================================

  describe('addParticipants', () => {
    it('should throw BadRequestException (not implemented)', async () => {
      await expect(
        service.addParticipants(1, { userIds: [2] } as never),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeParticipant', () => {
    it('should throw BadRequestException (not implemented)', async () => {
      await expect(service.removeParticipant(1, 2)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('leaveConversation', () => {
    it('should throw BadRequestException (not implemented)', async () => {
      await expect(service.leaveConversation(1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
