/**
 * Chat Conversations Service – Unit Tests
 *
 * Phase 11: DB-mocked public methods + CLS context.
 * Phase 14 B4: Deepened from 12 → 30 tests.
 * Uses ClsService mock for tenant/user context.
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ClsService } from 'nestjs-cls';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { ChatConversationsService } from './chat-conversations.service.js';
import type { PresenceStore } from './presence.store.js';

/** Minimal PresenceStore mock for unit tests */
const mockPresenceStore = {
  getOnlineUserIds: vi.fn().mockReturnValue(new Set<number>()),
  setOnline: vi.fn(),
  setOffline: vi.fn(),
} as unknown as PresenceStore;

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('mock-uuid-v7'),
}));

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
    mockPresenceStore,
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
    vi.clearAllMocks();
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
  });

  // ============================================================
  // getConversations
  // ============================================================

  describe('getConversations', () => {
    it('should return empty data with pagination when no conversations', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]); // getConversationCount
      mockDb.query.mockResolvedValueOnce([]); // fetchConversationsPage

      const result = await service.getConversations({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.totalItems).toBe(0);
    });

    it('should enrich conversations with participants and unread counts', async () => {
      const convRow = {
        id: 10,
        uuid: 'conv-uuid',
        name: 'Test Chat',
        is_group: false,
        created_at: new Date('2025-01-01'),
        updated_at: new Date('2025-01-02'),
        last_message_content: 'Hello',
        last_message_time: new Date('2025-01-02'),
        last_message_is_e2e: false,
      };

      mockDb.query
        .mockResolvedValueOnce([{ count: '1' }]) // count
        .mockResolvedValueOnce([convRow]) // conversations
        .mockResolvedValueOnce([
          // participants
          {
            conversation_id: 10,
            user_id: 5,
            joined_at: new Date(),
            is_admin: true,
            username: 'me',
            first_name: 'My',
            last_name: 'Self',
            profile_picture: null,
          },
        ])
        .mockResolvedValueOnce([
          // unread counts
          { conversation_id: 10, unread_count: '3' },
        ]);

      const result = await service.getConversations({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe(10);
    });
  });

  // ============================================================
  // getConversation
  // ============================================================

  describe('getConversation', () => {
    it('throws NotFoundException when user is not participant', async () => {
      mockDb.query.mockResolvedValueOnce([]); // participant check

      await expect(service.getConversation(999)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when conversation does not exist', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ user_id: 5 }]) // participant check OK
        .mockResolvedValueOnce([]); // conversation not found

      await expect(service.getConversation(999)).rejects.toThrow(NotFoundException);
    });

    it('should return conversation with participants', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ user_id: 5 }]) // participant check
        .mockResolvedValueOnce([
          // conversation
          {
            id: 10,
            uuid: '  conv-uuid  ',
            name: 'Test',
            is_group: false,
            created_at: new Date('2025-01-01'),
            updated_at: new Date('2025-01-02'),
          },
        ])
        .mockResolvedValueOnce([
          // participants
          {
            conversation_id: 10,
            user_id: 5,
            joined_at: new Date(),
            is_admin: true,
            username: 'maxm',
            first_name: 'Max',
            last_name: 'M',
            profile_picture: null,
          },
        ]);

      const result = await service.getConversation(10);

      expect(result.conversation.id).toBe(10);
      expect(result.conversation.uuid).toBe('conv-uuid'); // trimmed
      expect(result.conversation.participants).toHaveLength(1);
      expect(result.conversation.participants[0]?.firstName).toBe('Max');
      expect(result.conversation.unreadCount).toBe(0);
    });
  });

  // ============================================================
  // updateConversation
  // ============================================================

  describe('updateConversation', () => {
    it('throws BadRequestException (stub)', async () => {
      await expect(service.updateConversation(1, {} as never)).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================================
  // deleteConversation
  // ============================================================

  describe('deleteConversation', () => {
    it('throws ForbiddenException when user is not participant', async () => {
      mockDb.query.mockResolvedValueOnce([]); // participant not found

      await expect(service.deleteConversation(999)).rejects.toThrow(ForbiddenException);
    });

    it('soft-deletes conversation for participant', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 1, deleted_at: null }]) // participant found
        .mockResolvedValueOnce([]); // UPDATE deleted_at

      const result = await service.deleteConversation(1);

      expect(result.message).toBe('Conversation deleted successfully');
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('is idempotent for already-deleted conversation', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 1, deleted_at: new Date() }]) // already deleted
        .mockResolvedValueOnce([]); // UPDATE deleted_at again

      const result = await service.deleteConversation(1);

      expect(result.message).toBe('Conversation deleted successfully');
    });
  });

  // ============================================================
  // verifyConversationAccess
  // ============================================================

  describe('verifyConversationAccess', () => {
    it('throws ForbiddenException when not participant', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.verifyConversationAccess(1, 5, 1)).rejects.toThrow(ForbiddenException);
    });

    it('succeeds when user is participant', async () => {
      mockDb.query.mockResolvedValueOnce([{ user_id: 5 }]);

      await expect(service.verifyConversationAccess(1, 5, 1)).resolves.toBeUndefined();
    });
  });

  // ============================================================
  // getConversationRecipientIds
  // ============================================================

  describe('getConversationRecipientIds', () => {
    it('returns participant IDs excluding sender', async () => {
      mockDb.query.mockResolvedValueOnce([{ user_id: 1 }, { user_id: 5 }, { user_id: 10 }]);

      const result = await service.getConversationRecipientIds(1, 5);

      expect(result).toEqual([1, 10]);
    });

    it('returns empty array when only sender is participant', async () => {
      mockDb.query.mockResolvedValueOnce([{ user_id: 5 }]);

      const result = await service.getConversationRecipientIds(1, 5);

      expect(result).toEqual([]);
    });
  });

  // ============================================================
  // updateConversationTimestamp
  // ============================================================

  describe('updateConversationTimestamp', () => {
    it('executes UPDATE query', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.updateConversationTimestamp(1, 1);

      expect(mockDb.query).toHaveBeenCalledOnce();
    });
  });

  // ============================================================
  // Private helpers
  // ============================================================

  describe('getConversationCount (private)', () => {
    it('parses count string to number', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '42' }]);

      const result = await service['getConversationCount'](1, 5);

      expect(result).toBe(42);
    });

    it('defaults to 0 when count is null', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service['getConversationCount'](1, 5);

      expect(result).toBe(0);
    });
  });

  describe('getUnreadCounts (private)', () => {
    it('returns empty map for empty conversation IDs', async () => {
      const result = await service['getUnreadCounts']([], 5);

      expect(result.size).toBe(0);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('maps unread counts by conversation ID', async () => {
      mockDb.query.mockResolvedValueOnce([
        { conversation_id: 10, unread_count: '3' },
        { conversation_id: 20, unread_count: '7' },
      ]);

      const result = await service['getUnreadCounts']([10, 20], 5);

      expect(result.get(10)).toBe(3);
      expect(result.get(20)).toBe(7);
    });
  });

  describe('validateParticipantIds (private)', () => {
    it('should skip validation for empty array', async () => {
      await service['validateParticipantIds']([], 1);

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid IDs', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]); // only 1 valid

      await expect(service['validateParticipantIds']([1, 99], 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should pass when all IDs are valid', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

      await expect(service['validateParticipantIds']([1, 2], 1)).resolves.toBeUndefined();
    });
  });

  describe('insertConversation (private)', () => {
    it('should return conversation ID on success', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

      const result = await service['insertConversation'](1, 'Test', true);

      expect(result).toBe(42);
    });

    it('should throw BadRequestException when INSERT returns empty', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service['insertConversation'](1, undefined, false)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================================
  // createConversation
  // ============================================================

  describe('createConversation', () => {
    it('creates a new group conversation', async () => {
      const sendInitialMessage = vi.fn();

      // validateParticipantIds
      mockDb.query.mockResolvedValueOnce([{ id: 2 }, { id: 3 }]);
      // insertConversation
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);
      // addConversationParticipants: creator
      mockDb.query.mockResolvedValueOnce([]);
      // addConversationParticipants: participant 2
      mockDb.query.mockResolvedValueOnce([]);
      // addConversationParticipants: participant 3
      mockDb.query.mockResolvedValueOnce([]);
      // getConversation -> participant check
      mockDb.query.mockResolvedValueOnce([{ user_id: 5 }]);
      // getConversation -> conversation
      mockDb.query.mockResolvedValueOnce([
        {
          id: 42,
          uuid: 'mock-uuid-v7',
          name: 'Group',
          is_group: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
      // getConversation -> participants
      mockDb.query.mockResolvedValueOnce([
        {
          conversation_id: 42,
          user_id: 5,
          joined_at: new Date(),
          is_admin: true,
          username: 'creator',
          first_name: 'C',
          last_name: 'R',
          profile_picture: null,
        },
      ]);

      const result = await service.createConversation(
        { participantIds: [2, 3], isGroup: true, name: 'Group' },
        sendInitialMessage,
      );

      expect(result.conversation.id).toBe(42);
      expect(sendInitialMessage).not.toHaveBeenCalled();
    });

    it('returns existing 1:1 conversation when found', async () => {
      const sendInitialMessage = vi.fn();

      // findExisting1to1 -> found
      mockDb.query.mockResolvedValueOnce([{ id: 99 }]);
      // reset soft-delete
      mockDb.query.mockResolvedValueOnce([]);
      // getConversation -> participant check
      mockDb.query.mockResolvedValueOnce([{ user_id: 5 }]);
      // getConversation -> conversation
      mockDb.query.mockResolvedValueOnce([
        {
          id: 99,
          uuid: 'existing-uuid',
          name: null,
          is_group: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
      // getConversation -> participants
      mockDb.query.mockResolvedValueOnce([
        {
          conversation_id: 99,
          user_id: 5,
          joined_at: new Date(),
          is_admin: false,
          username: 'me',
          first_name: 'M',
          last_name: 'E',
          profile_picture: null,
        },
      ]);

      const result = await service.createConversation({ participantIds: [10] }, sendInitialMessage);

      expect(result.conversation.id).toBe(99);
    });

    it('sends initial message when provided on new conversation', async () => {
      const sendInitialMessage = vi.fn().mockResolvedValueOnce(undefined);

      // findExisting1to1 (1:1 with single participant -> checks existing)
      mockDb.query.mockResolvedValueOnce([]);
      // validateParticipantIds
      mockDb.query.mockResolvedValueOnce([{ id: 2 }]);
      // insertConversation
      mockDb.query.mockResolvedValueOnce([{ id: 50 }]);
      // addConversationParticipants: creator + 1 participant
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);
      // sendInitialMessage called here
      // getConversation -> participant check
      mockDb.query.mockResolvedValueOnce([{ user_id: 5 }]);
      // getConversation -> conversation
      mockDb.query.mockResolvedValueOnce([
        {
          id: 50,
          uuid: 'new-uuid',
          name: null,
          is_group: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
      // getConversation -> participants
      mockDb.query.mockResolvedValueOnce([
        {
          conversation_id: 50,
          user_id: 5,
          joined_at: new Date(),
          is_admin: true,
          username: 'me',
          first_name: 'M',
          last_name: 'E',
          profile_picture: null,
        },
      ]);

      await service.createConversation(
        { participantIds: [2], initialMessage: 'Hello!' },
        sendInitialMessage,
      );

      expect(sendInitialMessage).toHaveBeenCalledWith(1, 50, 5, 'Hello!');
    });

    it('skips empty initialMessage on new conversation', async () => {
      const sendInitialMessage = vi.fn();

      // findExisting1to1 → not found
      mockDb.query.mockResolvedValueOnce([]);
      // validateParticipantIds
      mockDb.query.mockResolvedValueOnce([{ id: 2 }]);
      // insertConversation
      mockDb.query.mockResolvedValueOnce([{ id: 60 }]);
      // addConversationParticipants: creator + 1
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);
      // getConversation chain
      mockDb.query.mockResolvedValueOnce([{ user_id: 5 }]);
      mockDb.query.mockResolvedValueOnce([
        {
          id: 60,
          uuid: 'u',
          name: null,
          is_group: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
      mockDb.query.mockResolvedValueOnce([
        {
          conversation_id: 60,
          user_id: 5,
          joined_at: new Date(),
          is_admin: true,
          username: 'me',
          first_name: 'M',
          last_name: 'E',
          profile_picture: null,
        },
      ]);

      await service.createConversation(
        { participantIds: [2], initialMessage: '' },
        sendInitialMessage,
      );

      expect(sendInitialMessage).not.toHaveBeenCalled();
    });

    it('skips empty initialMessage on existing 1:1 conversation', async () => {
      const sendInitialMessage = vi.fn();

      // findExisting1to1 → found
      mockDb.query.mockResolvedValueOnce([{ id: 77 }]);
      // reset soft-delete
      mockDb.query.mockResolvedValueOnce([]);
      // getConversation chain
      mockDb.query.mockResolvedValueOnce([{ user_id: 5 }]);
      mockDb.query.mockResolvedValueOnce([
        {
          id: 77,
          uuid: 'u',
          name: null,
          is_group: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
      mockDb.query.mockResolvedValueOnce([
        {
          conversation_id: 77,
          user_id: 5,
          joined_at: new Date(),
          is_admin: false,
          username: 'me',
          first_name: 'M',
          last_name: 'E',
          profile_picture: null,
        },
      ]);

      await service.createConversation(
        { participantIds: [10], initialMessage: '' },
        sendInitialMessage,
      );

      expect(sendInitialMessage).not.toHaveBeenCalled();
    });

    it('sends initial message on existing 1:1 conversation', async () => {
      const sendInitialMessage = vi.fn().mockResolvedValueOnce(undefined);

      // findExisting1to1 -> found
      mockDb.query.mockResolvedValueOnce([{ id: 77 }]);
      // reset soft-delete
      mockDb.query.mockResolvedValueOnce([]);
      // getConversation -> participant check
      mockDb.query.mockResolvedValueOnce([{ user_id: 5 }]);
      // getConversation -> conversation
      mockDb.query.mockResolvedValueOnce([
        {
          id: 77,
          uuid: 'existing-uuid',
          name: null,
          is_group: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
      // getConversation -> participants
      mockDb.query.mockResolvedValueOnce([
        {
          conversation_id: 77,
          user_id: 5,
          joined_at: new Date(),
          is_admin: false,
          username: 'me',
          first_name: 'M',
          last_name: 'E',
          profile_picture: null,
        },
      ]);

      await service.createConversation(
        { participantIds: [10], initialMessage: 'Hi again!' },
        sendInitialMessage,
      );

      expect(sendInitialMessage).toHaveBeenCalledWith(1, 77, 5, 'Hi again!');
    });
  });

  describe('findExisting1to1 (private)', () => {
    it('should return conversation ID when found', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 99 }]);

      const result = await service['findExisting1to1'](1, 5, 10);

      expect(result).toBe(99);
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service['findExisting1to1'](1, 5, 10);

      expect(result).toBeNull();
    });
  });
});
