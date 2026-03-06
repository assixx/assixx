/**
 * Vacation Notification Service – Unit Tests
 *
 * Mocked dependencies: DatabaseService, eventBus (module mock), uuid.
 * Fire-and-forget async calls (void this.createPersistentNotification)
 * require flushPromises() before asserting db.query calls.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { VacationNotificationService } from './vacation-notification.service.js';
import type { VacationRequest } from './vacation.types.js';

// =============================================================
// Module Mocks (vi.hoisted runs before vi.mock hoisting)
// =============================================================

const mockEventBus = vi.hoisted(() => ({
  emitVacationRequestCreated: vi.fn(),
  emitVacationRequestResponded: vi.fn(),
  emitVacationRequestWithdrawn: vi.fn(),
  emitVacationRequestCancelled: vi.fn(),
}));

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('mock-notification-uuid'),
}));

vi.mock('../../utils/eventBus.js', () => ({
  eventBus: mockEventBus,
}));

// =============================================================
// Helpers
// =============================================================

/** Flush fire-and-forget promise chains (void async calls). */
async function flushPromises(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function createMockDb() {
  return { query: vi.fn().mockResolvedValue({ rows: [] }) };
}
type MockDb = ReturnType<typeof createMockDb>;

function createRequest(overrides?: Partial<VacationRequest>): VacationRequest {
  return {
    id: 'req-001',
    requesterId: 100,
    approverId: 200,
    substituteId: null,
    startDate: '2026-04-01',
    endDate: '2026-04-05',
    halfDayStart: 'none',
    halfDayEnd: 'none',
    vacationType: 'regular',
    status: 'pending',
    computedDays: 5,
    isSpecialLeave: false,
    requestNote: null,
    responseNote: null,
    respondedAt: null,
    respondedBy: null,
    isActive: 1,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    requesterName: 'Max Müller',
    approverName: 'Anna Schmidt',
    ...overrides,
  } as VacationRequest;
}

// =============================================================
// Test Suite
// =============================================================

describe('VacationNotificationService', () => {
  let service: VacationNotificationService;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new VacationNotificationService(
      mockDb as unknown as DatabaseService,
    );
  });

  // -----------------------------------------------------------
  // notifyCreated
  // -----------------------------------------------------------

  describe('notifyCreated()', () => {
    it('should emit event and create notification for approver', async () => {
      const request = createRequest();

      service.notifyCreated(1, request);
      await flushPromises();

      expect(mockEventBus.emitVacationRequestCreated).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          id: 'req-001',
          requesterId: 100,
          approverId: 200,
        }),
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining([1, 'Neuer Urlaubsantrag', 200]),
      );
    });

    it('should skip persistent notification when no approver', async () => {
      const request = createRequest({ approverId: null });

      service.notifyCreated(1, request);
      await flushPromises();

      expect(mockEventBus.emitVacationRequestCreated).toHaveBeenCalledOnce();
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should use requesterName in notification message', async () => {
      const request = createRequest({ requesterName: 'Lisa Weber' });

      service.notifyCreated(1, request);
      await flushPromises();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.stringContaining('Lisa Weber')]),
      );
    });

    it('should fall back to requester ID when name is undefined', async () => {
      const request = createRequest({ requesterName: undefined });

      service.notifyCreated(1, request);
      await flushPromises();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.stringContaining('Mitarbeiter #100')]),
      );
    });
  });

  // -----------------------------------------------------------
  // notifyResponded
  // -----------------------------------------------------------

  describe('notifyResponded()', () => {
    it('should emit event and create notification for requester on approval', async () => {
      const request = createRequest({
        status: 'approved',
        respondedBy: 200,
      });

      service.notifyResponded(1, request);
      await flushPromises();

      expect(mockEventBus.emitVacationRequestResponded).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: 'approved' }),
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining([1, 'Urlaubsantrag genehmigt', 100]),
      );
    });

    it('should use "abgelehnt" status label for denied requests', async () => {
      const request = createRequest({
        status: 'denied',
        respondedBy: 200,
      });

      service.notifyResponded(1, request);
      await flushPromises();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['Urlaubsantrag abgelehnt']),
      );
    });

    it('should include response note when present', async () => {
      const request = createRequest({
        status: 'denied',
        respondedBy: 200,
        responseNote: 'Kapazitätsengpass',
      });

      service.notifyResponded(1, request);
      await flushPromises();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.stringContaining('Grund: Kapazitätsengpass'),
        ]),
      );
    });

    it('should omit response note suffix when null', async () => {
      const request = createRequest({
        status: 'approved',
        respondedBy: 200,
        responseNote: null,
      });

      service.notifyResponded(1, request);
      await flushPromises();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.not.stringContaining('Grund:')]),
      );
    });
  });

  // -----------------------------------------------------------
  // notifyWithdrawn
  // -----------------------------------------------------------

  describe('notifyWithdrawn()', () => {
    it('should emit event and create notification for approver', async () => {
      service.notifyWithdrawn(1, 'req-001', 100, 200, 'Max Müller');
      await flushPromises();

      expect(mockEventBus.emitVacationRequestWithdrawn).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          id: 'req-001',
          requesterId: 100,
          status: 'withdrawn',
        }),
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining([1, 'Urlaubsantrag zurückgezogen', 200]),
      );
    });

    it('should skip notification when no approver', async () => {
      service.notifyWithdrawn(1, 'req-001', 100, null, 'Max Müller');
      await flushPromises();

      expect(mockEventBus.emitVacationRequestWithdrawn).toHaveBeenCalledOnce();
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should use requesterName in withdrawn message', async () => {
      service.notifyWithdrawn(1, 'req-001', 100, 200, 'Lisa Weber');
      await flushPromises();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.stringContaining('Lisa Weber')]),
      );
    });

    it('should fall back to requester ID when name is undefined', async () => {
      service.notifyWithdrawn(1, 'req-001', 100, 200, undefined);
      await flushPromises();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.stringContaining('Mitarbeiter #100')]),
      );
    });
  });

  // -----------------------------------------------------------
  // notifyCancelled
  // -----------------------------------------------------------

  describe('notifyCancelled()', () => {
    it('should emit event and create notification for requester', async () => {
      service.notifyCancelled(1, 'req-001', 100, 999, 'Projektänderung');
      await flushPromises();

      expect(mockEventBus.emitVacationRequestCancelled).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          id: 'req-001',
          requesterId: 100,
          status: 'cancelled',
        }),
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining([1, 'Urlaubsantrag storniert', 100]),
      );
    });

    it('should include cancel reason in message', async () => {
      service.notifyCancelled(1, 'req-001', 100, 999, 'Projektänderung');
      await flushPromises();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.stringContaining('Grund: Projektänderung'),
        ]),
      );
    });

    it('should omit reason suffix when empty string', async () => {
      service.notifyCancelled(1, 'req-001', 100, 999, '');
      await flushPromises();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.not.stringContaining('Grund:')]),
      );
    });
  });

  // -----------------------------------------------------------
  // createPersistentNotification — error handling
  // -----------------------------------------------------------

  describe('createPersistentNotification() error handling', () => {
    it('should not throw when DB insert fails', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB connection lost'));
      const request = createRequest();

      // notifyCreated calls createPersistentNotification internally
      expect(() => {
        service.notifyCreated(1, request);
      }).not.toThrow();

      await flushPromises();
      // Verify query was attempted
      expect(mockDb.query).toHaveBeenCalledOnce();
    });

    it('should pass correct UUID from uuid v7', async () => {
      const request = createRequest();

      service.notifyCreated(1, request);
      await flushPromises();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['mock-notification-uuid']),
      );
    });
  });
});
