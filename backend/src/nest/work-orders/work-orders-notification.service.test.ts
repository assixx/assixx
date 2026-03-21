/**
 * Work Orders Notification Service – Unit Tests
 *
 * Mocked dependencies: DatabaseService (queryOne, query, transaction),
 * eventBus (module-level mock), uuid (deterministic v7).
 *
 * Tests: 6 public methods — 4 SSE (EventBus) + 2 persistent (DB transaction).
 * All methods call loadWorkOrderPayload() first (2 DB queries).
 * Persistent methods use this.db.transaction({ tenantId }) for RLS context.
 * Fire-and-forget pattern — errors logged, never thrown.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { WorkOrderNotificationService } from './work-orders-notification.service.js';

// =============================================================
// Module-level mocks (vi.hoisted runs before vi.mock hoisting)
// =============================================================

const { mockEventBus } = vi.hoisted(() => ({
  mockEventBus: {
    emitWorkOrderAssigned: vi.fn(),
    emitWorkOrderStatusChanged: vi.fn(),
    emitWorkOrderDueSoon: vi.fn(),
    emitWorkOrderVerified: vi.fn(),
  },
}));

vi.mock('../../utils/event-bus.js', () => ({
  eventBus: mockEventBus,
}));

vi.mock('uuid', () => ({
  v7: vi.fn(() => 'mock-uuid-v7-001'),
}));

// =============================================================
// Constants
// =============================================================

const TENANT_ID = 1;
const WO_UUID = '019c9547-aaaa-771a-b022-111111111111';
const ASSIGNEE_IDS = [5, 8];
const CREATED_BY = 42;
const VERIFIED_BY = 99;

// =============================================================
// Factories
// =============================================================

function createMockDb() {
  const mockClient = { query: vi.fn().mockResolvedValue({ rows: [] }) };

  return {
    queryOne: vi.fn(),
    query: vi.fn(),
    transaction: vi.fn(
      async (callback: (client: typeof mockClient) => Promise<void>): Promise<void> => {
        await callback(mockClient);
      },
    ),
    /** Access the mock client passed into transaction callbacks */
    _mockClient: mockClient,
  };
}
type MockDb = ReturnType<typeof createMockDb>;

/** Default work_orders row returned by loadWorkOrderPayload → queryOne */
function createWorkOrderRow() {
  return {
    uuid: WO_UUID,
    title: 'Ölwechsel Presse P17',
    status: 'open',
    priority: 'high',
  };
}

/** Default assignee rows returned by loadWorkOrderPayload → query */
function createAssigneeRows(userIds: number[] = ASSIGNEE_IDS) {
  return userIds.map((uid: number) => ({ user_id: uid }));
}

/**
 * Set up mockDb to return valid payload from loadWorkOrderPayload.
 * queryOne returns the work order row, query returns assignee rows.
 */
function setupPayloadSuccess(
  mockDb: MockDb,
  woRow = createWorkOrderRow(),
  assigneeUserIds: number[] = ASSIGNEE_IDS,
): void {
  mockDb.queryOne.mockResolvedValue(woRow);
  mockDb.query.mockResolvedValue(createAssigneeRows(assigneeUserIds));
}

/** Set up mockDb to return null (work order not found) */
function setupPayloadNotFound(mockDb: MockDb): void {
  mockDb.queryOne.mockResolvedValue(null);
}

// =============================================================
// Test Suite
// =============================================================

describe('WorkOrderNotificationService', () => {
  let service: WorkOrderNotificationService;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new WorkOrderNotificationService(mockDb as unknown as DatabaseService);
  });

  // ===========================================================
  // notifyAssigned — SSE via EventBus
  // ===========================================================

  describe('notifyAssigned()', () => {
    it('should load payload and emit workorder.assigned event', async () => {
      setupPayloadSuccess(mockDb);

      await service.notifyAssigned(TENANT_ID, WO_UUID, ASSIGNEE_IDS);

      expect(mockEventBus.emitWorkOrderAssigned).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          uuid: WO_UUID,
          title: 'Ölwechsel Presse P17',
          status: 'open',
          priority: 'high',
          assigneeUserIds: ASSIGNEE_IDS,
        }),
      );
    });

    it('should pass assigneeUserIds from parameter, not from DB', async () => {
      setupPayloadSuccess(mockDb, createWorkOrderRow(), [10, 20]);
      const customAssignees = [77, 88];

      await service.notifyAssigned(TENANT_ID, WO_UUID, customAssignees);

      const payload = mockEventBus.emitWorkOrderAssigned.mock.calls[0]?.[1] as Record<
        string,
        unknown
      >;
      expect(payload.assigneeUserIds).toEqual(customAssignees);
    });

    it('should not emit when work order not found', async () => {
      setupPayloadNotFound(mockDb);

      await service.notifyAssigned(TENANT_ID, WO_UUID, ASSIGNEE_IDS);

      expect(mockEventBus.emitWorkOrderAssigned).not.toHaveBeenCalled();
    });
  });

  // ===========================================================
  // notifyStatusChanged — SSE via EventBus
  // ===========================================================

  describe('notifyStatusChanged()', () => {
    it('should emit workorder.status.changed with overridden status', async () => {
      setupPayloadSuccess(mockDb);

      await service.notifyStatusChanged(TENANT_ID, WO_UUID, 'in_progress', CREATED_BY);

      expect(mockEventBus.emitWorkOrderStatusChanged).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          uuid: WO_UUID,
          status: 'in_progress',
        }),
        CREATED_BY,
      );
    });

    it('should override DB status with new status parameter', async () => {
      setupPayloadSuccess(mockDb);

      await service.notifyStatusChanged(TENANT_ID, WO_UUID, 'completed', CREATED_BY);

      const payload = mockEventBus.emitWorkOrderStatusChanged.mock.calls[0]?.[1] as Record<
        string,
        unknown
      >;
      expect(payload.status).toBe('completed');
    });

    it('should not emit when work order not found', async () => {
      setupPayloadNotFound(mockDb);

      await service.notifyStatusChanged(TENANT_ID, WO_UUID, 'in_progress', CREATED_BY);

      expect(mockEventBus.emitWorkOrderStatusChanged).not.toHaveBeenCalled();
    });
  });

  // ===========================================================
  // notifyDueSoon — SSE via EventBus
  // ===========================================================

  describe('notifyDueSoon()', () => {
    it('should emit workorder.due.soon event', async () => {
      setupPayloadSuccess(mockDb);

      await service.notifyDueSoon(TENANT_ID, WO_UUID);

      expect(mockEventBus.emitWorkOrderDueSoon).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          uuid: WO_UUID,
          title: 'Ölwechsel Presse P17',
          assigneeUserIds: ASSIGNEE_IDS,
        }),
      );
    });

    it('should not emit when work order not found', async () => {
      setupPayloadNotFound(mockDb);

      await service.notifyDueSoon(TENANT_ID, WO_UUID);

      expect(mockEventBus.emitWorkOrderDueSoon).not.toHaveBeenCalled();
    });
  });

  // ===========================================================
  // notifyVerified — SSE via EventBus
  // ===========================================================

  describe('notifyVerified()', () => {
    it('should emit workorder.verified event with verifiedByUserId', async () => {
      setupPayloadSuccess(mockDb);

      await service.notifyVerified(TENANT_ID, WO_UUID, VERIFIED_BY);

      expect(mockEventBus.emitWorkOrderVerified).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({ uuid: WO_UUID }),
        VERIFIED_BY,
      );
    });

    it('should not emit when work order not found', async () => {
      setupPayloadNotFound(mockDb);

      await service.notifyVerified(TENANT_ID, WO_UUID, VERIFIED_BY);

      expect(mockEventBus.emitWorkOrderVerified).not.toHaveBeenCalled();
    });
  });

  // ===========================================================
  // persistAssignedNotification — DB transaction with RLS
  // ===========================================================

  describe('persistAssignedNotification()', () => {
    it('should call transaction with tenantId for RLS context', async () => {
      setupPayloadSuccess(mockDb);

      await service.persistAssignedNotification(TENANT_ID, WO_UUID, ASSIGNEE_IDS, CREATED_BY);

      expect(mockDb.transaction).toHaveBeenCalledWith(expect.any(Function), {
        tenantId: TENANT_ID,
      });
    });

    it('should INSERT notifications with correct title and message', async () => {
      setupPayloadSuccess(mockDb);

      await service.persistAssignedNotification(TENANT_ID, WO_UUID, [5], CREATED_BY);

      const clientQuery = mockDb._mockClient.query;
      expect(clientQuery).toHaveBeenCalledTimes(1);

      const sql = clientQuery.mock.calls[0]?.[0] as string;
      expect(sql).toContain('INSERT INTO notifications');

      const params = clientQuery.mock.calls[0]?.[1] as unknown[];
      expect(params).toContain('work_orders');
      expect(params).toContain('Neuer Arbeitsauftrag: Ölwechsel Presse P17');
      expect(params).toEqual(
        expect.arrayContaining([expect.stringContaining('Ölwechsel Presse P17')]),
      );
    });

    it('should include tenant_id, type, recipient_id, created_by in params', async () => {
      setupPayloadSuccess(mockDb);

      await service.persistAssignedNotification(TENANT_ID, WO_UUID, [5], CREATED_BY);

      const params = mockDb._mockClient.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toContain(TENANT_ID);
      expect(params).toContain(5); // recipient_id
      expect(params).toContain(CREATED_BY);
      expect(params).toContain('user'); // recipient_type
    });

    it('should create one notification per assignee (batch INSERT)', async () => {
      setupPayloadSuccess(mockDb);

      await service.persistAssignedNotification(TENANT_ID, WO_UUID, [5, 8, 12], CREATED_BY);

      const params = mockDb._mockClient.query.mock.calls[0]?.[1] as unknown[];
      // 3 users × 8 base params (incl. metadata) + 3 UUIDs = 27 params
      expect(params).toHaveLength(27);
    });

    it('should use UUIDv7 for notification uuid', async () => {
      setupPayloadSuccess(mockDb);

      await service.persistAssignedNotification(TENANT_ID, WO_UUID, [5], CREATED_BY);

      const params = mockDb._mockClient.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toContain('mock-uuid-v7-001');
    });

    it('should include metadata with entityUuid in params', async () => {
      setupPayloadSuccess(mockDb);

      await service.persistAssignedNotification(TENANT_ID, WO_UUID, [5], CREATED_BY);

      const sql = mockDb._mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('metadata');

      const params = mockDb._mockClient.query.mock.calls[0]?.[1] as unknown[];
      const metadataJson = JSON.stringify({ entityUuid: WO_UUID });
      expect(params).toContain(metadataJson);
    });

    it('should skip when assigneeUserIds is empty', async () => {
      setupPayloadSuccess(mockDb);

      await service.persistAssignedNotification(TENANT_ID, WO_UUID, [], CREATED_BY);

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should not throw when work order not found', async () => {
      setupPayloadNotFound(mockDb);

      await expect(
        service.persistAssignedNotification(TENANT_ID, WO_UUID, ASSIGNEE_IDS, CREATED_BY),
      ).resolves.toBeUndefined();

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should not throw when transaction fails', async () => {
      setupPayloadSuccess(mockDb);
      mockDb.transaction.mockRejectedValueOnce(new Error('DB down'));

      await expect(
        service.persistAssignedNotification(TENANT_ID, WO_UUID, ASSIGNEE_IDS, CREATED_BY),
      ).resolves.toBeUndefined();
    });
  });

  // ===========================================================
  // persistVerifiedNotification — DB transaction with RLS
  // ===========================================================

  describe('persistVerifiedNotification()', () => {
    it('should call transaction with tenantId for RLS context', async () => {
      setupPayloadSuccess(mockDb);

      await service.persistVerifiedNotification(TENANT_ID, WO_UUID, VERIFIED_BY);

      expect(mockDb.transaction).toHaveBeenCalledWith(expect.any(Function), {
        tenantId: TENANT_ID,
      });
    });

    it('should use assigneeUserIds from DB as recipients', async () => {
      setupPayloadSuccess(mockDb, createWorkOrderRow(), [5, 8]);

      await service.persistVerifiedNotification(TENANT_ID, WO_UUID, VERIFIED_BY);

      const params = mockDb._mockClient.query.mock.calls[0]?.[1] as unknown[];
      // 2 users → both user_ids in params
      expect(params).toContain(5);
      expect(params).toContain(8);
    });

    it('should include "verifiziert" in notification title', async () => {
      setupPayloadSuccess(mockDb);

      await service.persistVerifiedNotification(TENANT_ID, WO_UUID, VERIFIED_BY);

      const params = mockDb._mockClient.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toContain('Arbeitsauftrag verifiziert: Ölwechsel Presse P17');
    });

    it('should include verifiedByUserId as created_by', async () => {
      setupPayloadSuccess(mockDb);

      await service.persistVerifiedNotification(TENANT_ID, WO_UUID, VERIFIED_BY);

      const params = mockDb._mockClient.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toContain(VERIFIED_BY);
    });

    it('should skip when no assignees in DB', async () => {
      setupPayloadSuccess(mockDb, createWorkOrderRow(), []);

      await service.persistVerifiedNotification(TENANT_ID, WO_UUID, VERIFIED_BY);

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should not throw when work order not found', async () => {
      setupPayloadNotFound(mockDb);

      await expect(
        service.persistVerifiedNotification(TENANT_ID, WO_UUID, VERIFIED_BY),
      ).resolves.toBeUndefined();

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });

  // ===========================================================
  // loadWorkOrderPayload — shared private helper
  // ===========================================================

  describe('loadWorkOrderPayload (tested via public methods)', () => {
    it('should query work_orders with uuid and tenant_id', async () => {
      setupPayloadSuccess(mockDb);

      await service.notifyAssigned(TENANT_ID, WO_UUID, ASSIGNEE_IDS);

      expect(mockDb.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT uuid, title, status, priority'),
        [WO_UUID, TENANT_ID],
      );
    });

    it('should query assignees with uuid and tenant_id', async () => {
      setupPayloadSuccess(mockDb);

      await service.notifyAssigned(TENANT_ID, WO_UUID, ASSIGNEE_IDS);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT user_id FROM work_order_assignees'),
        [WO_UUID, TENANT_ID],
      );
    });

    it(`should filter by is_active = ${IS_ACTIVE.ACTIVE}`, async () => {
      setupPayloadSuccess(mockDb);

      await service.notifyAssigned(TENANT_ID, WO_UUID, ASSIGNEE_IDS);

      const sql = mockDb.queryOne.mock.calls[0]?.[0] as string;
      expect(sql).toContain(`is_active = ${IS_ACTIVE.ACTIVE}`);
    });

    it('should trim uuid from DB row', async () => {
      const woRow = { ...createWorkOrderRow(), uuid: `${WO_UUID}  ` };
      setupPayloadSuccess(mockDb, woRow);

      await service.notifyAssigned(TENANT_ID, WO_UUID, ASSIGNEE_IDS);

      const payload = mockEventBus.emitWorkOrderAssigned.mock.calls[0]?.[1] as Record<
        string,
        unknown
      >;
      expect(payload.uuid).toBe(WO_UUID);
    });

    it('should silently return null on DB error (no throw)', async () => {
      mockDb.queryOne.mockRejectedValue(new Error('Connection timeout'));

      await expect(
        service.notifyAssigned(TENANT_ID, WO_UUID, ASSIGNEE_IDS),
      ).resolves.toBeUndefined();

      expect(mockEventBus.emitWorkOrderAssigned).not.toHaveBeenCalled();
    });
  });
});
