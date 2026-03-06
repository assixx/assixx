/**
 * Unit tests for ChatScheduledService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: CLS context validation, scheduled message CRUD,
 *        time validation, cancel state asset.
 */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { ChatScheduledService } from './chat-scheduled.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('./chat.helpers.js', () => ({
  mapScheduledMessage: vi.fn((row: Record<string, unknown>) => ({
    id: row['id'],
    content: row['content'],
    scheduledFor: row['scheduled_for'],
    status: 'pending',
  })),
  validateScheduledTime: vi.fn().mockReturnValue(null),
}));

vi.mock('./chat.types.js', () => ({
  MAX_SCHEDULE_DAYS: 60,
  MIN_SCHEDULE_MINUTES: 5,
  SCHEDULED_STATUS: {
    CANCELLED: 0,
    PENDING: 1,
    SENT: 4,
  },
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

function makeScheduledRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    tenant_id: 10,
    conversation_id: 1,
    sender_id: 5,
    content: 'Scheduled hello',
    attachment_path: null,
    attachment_name: null,
    attachment_type: null,
    attachment_size: null,
    scheduled_for: new Date('2025-06-15T10:00:00Z'),
    is_active: 1,
    created_at: new Date(),
    sent_at: null,
    ...overrides,
  };
}

// =============================================================
// ChatScheduledService
// =============================================================

describe('ChatScheduledService', () => {
  let service: ChatScheduledService;
  let mockCls: ReturnType<typeof createMockCls>;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCls = createMockCls();
    mockDb = createMockDb();
    service = new ChatScheduledService(
      mockCls as never,
      mockDb as unknown as DatabaseService,
    );
  });

  // =============================================================
  // Context validation
  // =============================================================

  describe('context validation', () => {
    it('should throw ForbiddenException when tenantId is missing', async () => {
      mockCls.get.mockReturnValue(undefined);

      await expect(service.getScheduledMessages()).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException when userId is missing', async () => {
      mockCls.get.mockImplementation((key: string) => {
        if (key === 'tenantId') return 10;
        return undefined;
      });

      await expect(service.getScheduledMessages()).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // =============================================================
  // createScheduledMessage
  // =============================================================

  describe('createScheduledMessage', () => {
    const verifyAccess = vi.fn().mockResolvedValue(undefined);

    it('should create scheduled message', async () => {
      const row = makeScheduledRow();
      mockDb.query.mockResolvedValueOnce([row]);

      const result = await service.createScheduledMessage(
        {
          conversationId: 1,
          content: 'Hello',
          scheduledFor: '2025-06-15T10:00:00Z',
        } as never,
        verifyAccess,
      );

      expect(result.content).toBe('Scheduled hello');
      expect(verifyAccess).toHaveBeenCalledWith(1, 5, 10);
    });

    it('should throw BadRequestException for invalid date', async () => {
      await expect(
        service.createScheduledMessage(
          {
            conversationId: 1,
            content: 'Hello',
            scheduledFor: 'not-a-date',
          } as never,
          verifyAccess,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when insert fails', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.createScheduledMessage(
          {
            conversationId: 1,
            content: 'Hello',
            scheduledFor: '2025-06-15T10:00:00Z',
          } as never,
          verifyAccess,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =============================================================
  // getScheduledMessages
  // =============================================================

  describe('getScheduledMessages', () => {
    it('should return mapped messages', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeScheduledRow(),
        makeScheduledRow({ id: '2' }),
      ]);

      const result = await service.getScheduledMessages();

      expect(result).toHaveLength(2);
    });
  });

  // =============================================================
  // getScheduledMessage
  // =============================================================

  describe('getScheduledMessage', () => {
    it('should throw NotFoundException when not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getScheduledMessage('999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return mapped message', async () => {
      mockDb.query.mockResolvedValueOnce([makeScheduledRow()]);

      const result = await service.getScheduledMessage('1');

      expect(result.id).toBe('1');
    });
  });

  // =============================================================
  // cancelScheduledMessage
  // =============================================================

  describe('cancelScheduledMessage', () => {
    it('should throw NotFoundException when not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.cancelScheduledMessage('999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when already sent', async () => {
      mockDb.query.mockResolvedValueOnce([makeScheduledRow({ is_active: 4 })]);

      await expect(service.cancelScheduledMessage('1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when already cancelled', async () => {
      mockDb.query.mockResolvedValueOnce([makeScheduledRow({ is_active: 0 })]);

      await expect(service.cancelScheduledMessage('1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should cancel successfully', async () => {
      mockDb.query.mockResolvedValueOnce([makeScheduledRow()]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.cancelScheduledMessage('1');

      expect(result.message).toBe('Scheduled message cancelled successfully');
    });
  });

  // =============================================================
  // getConversationScheduledMessages
  // =============================================================

  describe('getConversationScheduledMessages', () => {
    it('should verify access and return messages', async () => {
      const verifyAccess = vi.fn().mockResolvedValue(undefined);
      mockDb.query.mockResolvedValueOnce([makeScheduledRow()]);

      const result = await service.getConversationScheduledMessages(
        1,
        verifyAccess,
      );

      expect(verifyAccess).toHaveBeenCalledWith(1, 5, 10);
      expect(result).toHaveLength(1);
    });
  });
});
