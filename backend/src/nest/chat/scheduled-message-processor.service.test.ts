/**
 * Unit tests for ScheduledMessageProcessorService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Message processing loop, concurrency guard, send flow,
 *        error handling (per-message + global), event emission.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { ScheduledMessageProcessorService } from './scheduled-message-processor.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('mock-uuid-v7'),
}));

const { mockEmitNewMessage } = vi.hoisted(() => ({
  mockEmitNewMessage: vi.fn(),
}));

vi.mock('../../utils/eventBus.js', () => ({
  eventBus: {
    emitNewMessage: mockEmitNewMessage,
  },
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

function makeScheduledRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    tenant_id: 10,
    conversation_id: 1,
    sender_id: 5,
    content: 'Hello scheduled',
    attachment_path: null,
    attachment_name: null,
    attachment_type: null,
    attachment_size: null,
    scheduled_for: new Date('2025-06-01T10:00:00Z'),
    is_active: IS_ACTIVE.ACTIVE,
    created_at: new Date('2025-06-01T09:00:00Z'),
    sent_at: null,
    ...overrides,
  };
}

// =============================================================
// ScheduledMessageProcessorService
// =============================================================

describe('ScheduledMessageProcessorService', () => {
  let service: ScheduledMessageProcessorService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new ScheduledMessageProcessorService(
      mockDb as unknown as DatabaseService,
    );
  });

  // =============================================================
  // processAtMinute (delegates to processScheduledMessages)
  // =============================================================

  describe('processAtMinute', () => {
    it('should do nothing when no due messages', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.processAtMinute();

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should process due messages successfully', async () => {
      const scheduled = makeScheduledRow();
      // getDueMessages
      mockDb.query.mockResolvedValueOnce([scheduled]);
      // INSERT message RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 100 }]);
      // UPDATE conversation
      mockDb.query.mockResolvedValueOnce([]);
      // UPDATE scheduled_messages (mark sent)
      mockDb.query.mockResolvedValueOnce([]);
      // GET recipients
      mockDb.query.mockResolvedValueOnce([{ user_id: 8 }, { user_id: 9 }]);

      await service.processAtMinute();

      expect(mockEmitNewMessage).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          id: 100,
          uuid: 'mock-uuid-v7',
          conversationId: 1,
          senderId: 5,
          recipientIds: [8, 9],
        }),
      );
    });

    it('should handle send failure gracefully (per-message catch)', async () => {
      const scheduled = makeScheduledRow();
      // getDueMessages
      mockDb.query.mockResolvedValueOnce([scheduled]);
      // INSERT fails
      mockDb.query.mockResolvedValueOnce([]);

      // Should not throw — error is caught per-message
      await expect(service.processAtMinute()).resolves.toBeUndefined();
    });
  });

  // =============================================================
  // onModuleInit
  // =============================================================

  describe('onModuleInit', () => {
    it('should process messages on startup', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.onModuleInit();

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  // =============================================================
  // Concurrency guard
  // =============================================================

  describe('concurrency guard', () => {
    it('should skip processing if already in progress', async () => {
      // Simulate slow processing by never resolving
      let resolveFirst: (() => void) | undefined;
      mockDb.query.mockImplementationOnce(
        () =>
          new Promise<unknown[]>((resolve) => {
            resolveFirst = () => resolve([]);
          }),
      );

      // Start first call (blocks on db.query)
      const first = service.processAtMinute();

      // Second call should skip (isProcessing = true) — no additional query
      await service.processAtMinute();

      // Only 1 query call (first one still pending, second skipped entirely)
      expect(mockDb.query).toHaveBeenCalledTimes(1);

      // Complete first call
      resolveFirst?.();
      await first;
    });
  });
});
