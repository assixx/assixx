/**
 * Unit tests for TpmNotificationService
 *
 * Mocked dependencies: DatabaseService (query), eventBus (module-level mock),
 * uuid (deterministic v7).
 *
 * Tests: Dual-pattern (EventBus + DB) for all 5 notification methods.
 * Each method emits an SSE event AND creates persistent DB notifications
 * (except notifyMaintenanceCompleted which is SSE-only).
 *
 * Pattern: eventBus is module-level import → vi.mock required.
 * DB notifications fire-and-forget (void) with silent error catch.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import {
  type TpmNotificationCard,
  TpmNotificationService,
} from './tpm-notification.service.js';

// =============================================================
// Module-level mocks (vi.hoisted runs before vi.mock hoisting)
// =============================================================

const { mockEventBus } = vi.hoisted(() => ({
  mockEventBus: {
    emitTpmMaintenanceDue: vi.fn(),
    emitTpmMaintenanceOverdue: vi.fn(),
    emitTpmMaintenanceCompleted: vi.fn(),
    emitTpmApprovalRequired: vi.fn(),
    emitTpmApprovalResult: vi.fn(),
  },
}));

vi.mock('../../utils/eventBus.js', () => ({
  eventBus: mockEventBus,
}));

vi.mock('uuid', () => ({
  v7: vi.fn(() => 'mock-uuid-v7-001'),
}));

// =============================================================
// Factories
// =============================================================

function createMockDb() {
  return {
    query: vi.fn().mockResolvedValue([]),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createTestCard(
  overrides?: Partial<TpmNotificationCard>,
): TpmNotificationCard {
  return {
    uuid: 'card-uuid-001',
    cardCode: 'BT1',
    title: 'Sichtprüfung',
    machineId: 42,
    machineName: 'Presse P17',
    intervalType: 'weekly',
    status: 'red',
    ...overrides,
  };
}

// =============================================================
// TpmNotificationService
// =============================================================

describe('TpmNotificationService', () => {
  let service: TpmNotificationService;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new TpmNotificationService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // notifyMaintenanceDue
  // =============================================================

  describe('notifyMaintenanceDue()', () => {
    it('should emit TPM maintenance due event via eventBus', () => {
      const card = createTestCard();

      service.notifyMaintenanceDue(10, card, [7, 8]);

      expect(mockEventBus.emitTpmMaintenanceDue).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          uuid: 'card-uuid-001',
          cardCode: 'BT1',
          title: 'Sichtprüfung',
          machineId: 42,
          machineName: 'Presse P17',
          intervalType: 'weekly',
          status: 'red',
        }),
      );
    });

    it('should create persistent notification for each assigned user', () => {
      const card = createTestCard();

      service.notifyMaintenanceDue(10, card, [7, 8, 9]);

      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });

    it('should include card code in notification title', () => {
      const card = createTestCard({ cardCode: 'IV5' });

      service.notifyMaintenanceDue(10, card, [7]);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('INSERT INTO notifications');

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[1]).toBe('Wartung fällig: IV5');
    });

    it('should not create notifications for empty assignedUserIds', () => {
      const card = createTestCard();

      service.notifyMaintenanceDue(10, card, []);

      expect(mockEventBus.emitTpmMaintenanceDue).toHaveBeenCalledTimes(1);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should fallback to "Maschine #ID" when machineName is undefined', () => {
      const card = createTestCard({ machineName: undefined });

      service.notifyMaintenanceDue(10, card, [7]);

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      const message = params?.[2] as string;
      expect(message).toContain('Maschine #42');
    });
  });

  // =============================================================
  // notifyMaintenanceOverdue
  // =============================================================

  describe('notifyMaintenanceOverdue()', () => {
    it('should emit TPM maintenance overdue event', () => {
      const card = createTestCard({ status: 'overdue' });

      service.notifyMaintenanceOverdue(10, card, 5);

      expect(mockEventBus.emitTpmMaintenanceOverdue).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ uuid: 'card-uuid-001' }),
      );
    });

    it('should create persistent notification for team lead', () => {
      const card = createTestCard();

      service.notifyMaintenanceOverdue(10, card, 5);

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[3]).toBe(5); // recipientId = teamLeadId
    });

    it('should include "überfällig" in notification message', () => {
      const card = createTestCard();

      service.notifyMaintenanceOverdue(10, card, 5);

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      const message = params?.[2] as string;
      expect(message).toContain('überfällig');
    });
  });

  // =============================================================
  // notifyMaintenanceCompleted
  // =============================================================

  describe('notifyMaintenanceCompleted()', () => {
    it('should emit TPM maintenance completed event with userId', () => {
      const card = createTestCard({ status: 'green' });

      service.notifyMaintenanceCompleted(10, card, 7);

      expect(mockEventBus.emitTpmMaintenanceCompleted).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ uuid: 'card-uuid-001' }),
        7,
      );
    });

    it('should NOT create persistent notification', () => {
      const card = createTestCard();

      service.notifyMaintenanceCompleted(10, card, 7);

      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  // =============================================================
  // notifyApprovalRequired
  // =============================================================

  describe('notifyApprovalRequired()', () => {
    it('should emit TPM approval required event with executionUuid', () => {
      const card = createTestCard({ status: 'yellow' });

      service.notifyApprovalRequired(10, card, 'exec-uuid-001', [5, 6]);

      expect(mockEventBus.emitTpmApprovalRequired).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ uuid: 'card-uuid-001' }),
        'exec-uuid-001',
      );
    });

    it('should create persistent notification for each approver', () => {
      const card = createTestCard();

      service.notifyApprovalRequired(10, card, 'exec-uuid-001', [5, 6]);

      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should include "Freigabe erforderlich" in notification title', () => {
      const card = createTestCard({ cardCode: 'BT3' });

      service.notifyApprovalRequired(10, card, 'exec-uuid-001', [5]);

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[1]).toBe('Freigabe erforderlich: BT3');
    });
  });

  // =============================================================
  // notifyApprovalResult
  // =============================================================

  describe('notifyApprovalResult()', () => {
    it('should emit TPM approval result event for approved', () => {
      const card = createTestCard({ status: 'green' });

      service.notifyApprovalResult(10, card, 'exec-uuid-001', 7, true);

      expect(mockEventBus.emitTpmApprovalResult).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ uuid: 'card-uuid-001' }),
        'exec-uuid-001',
        true,
      );
    });

    it('should emit TPM approval result event for rejected', () => {
      const card = createTestCard({ status: 'red' });

      service.notifyApprovalResult(10, card, 'exec-uuid-001', 7, false);

      expect(mockEventBus.emitTpmApprovalResult).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ uuid: 'card-uuid-001' }),
        'exec-uuid-001',
        false,
      );
    });

    it('should create persistent notification with "freigegeben" label', () => {
      const card = createTestCard();

      service.notifyApprovalResult(10, card, 'exec-uuid-001', 7, true);

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[1]).toBe('Wartung freigegeben: BT1');
      const message = params?.[2] as string;
      expect(message).toContain('freigegeben');
    });

    it('should create persistent notification with "abgelehnt" label', () => {
      const card = createTestCard();

      service.notifyApprovalResult(10, card, 'exec-uuid-001', 7, false);

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[1]).toBe('Wartung abgelehnt: BT1');
      const message = params?.[2] as string;
      expect(message).toContain('abgelehnt');
    });
  });

  // =============================================================
  // Persistent notification internals
  // =============================================================

  describe('Persistent notification details', () => {
    it('should silently catch and log DB errors', () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB connection lost'));
      const card = createTestCard();

      // Should NOT throw — fire-and-forget with error catch
      expect(() => {
        service.notifyMaintenanceDue(10, card, [7]);
      }).not.toThrow();
    });

    it('should use UUIDv7 for notification uuid', () => {
      const card = createTestCard();

      service.notifyMaintenanceDue(10, card, [7]);

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[8]).toBe('mock-uuid-v7-001');
    });

    it('should set action_url to /lean-management/tpm', () => {
      const card = createTestCard();

      service.notifyMaintenanceDue(10, card, [7]);

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[4]).toBe('/lean-management/tpm');
    });

    it('should store cardUuid in metadata JSON', () => {
      const card = createTestCard({ uuid: 'special-uuid-999' });

      service.notifyMaintenanceDue(10, card, [7]);

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[6]).toBe(
        JSON.stringify({ cardUuid: 'special-uuid-999' }),
      );
    });

    it('should omit machineName from event payload when undefined', () => {
      const card = createTestCard({ machineName: undefined });

      service.notifyMaintenanceDue(10, card, [7]);

      const eventPayload = mockEventBus.emitTpmMaintenanceDue.mock
        .calls[0]?.[1] as Record<string, unknown>;
      expect(eventPayload).not.toHaveProperty('machineName');
    });
  });
});
