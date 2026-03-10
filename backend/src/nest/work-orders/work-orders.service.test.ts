/**
 * Work Orders Service — Unit Tests
 *
 * Tests Core CRUD: create, get, list, listMy, update, archive, restore, getStats.
 * Mock DatabaseService (query, queryOne, tenantTransaction) + ActivityLoggerService.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { WorkOrdersService } from './work-orders.service.js';
import type {
  CalendarWorkOrderRow,
  WorkOrderAssigneeWithNameRow,
  WorkOrderWithCountsRow,
} from './work-orders.types.js';

// ============================================================================
// Mock setup
// ============================================================================

const mockClient = { query: vi.fn() };

const mockDb = {
  query: vi.fn(),
  queryOne: vi.fn(),
  tenantTransaction: vi
    .fn()
    .mockImplementation(
      async (
        callback: (client: typeof mockClient) => Promise<unknown>,
      ): Promise<unknown> => await callback(mockClient),
    ),
};

const mockActivityLogger = {
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
};

// ============================================================================
// Factory functions
// ============================================================================

function createWorkOrderRow(
  overrides: Partial<WorkOrderWithCountsRow> = {},
): WorkOrderWithCountsRow {
  return {
    id: 1,
    uuid: '019c9547-9fc0-771a-b022-3767e233d6f3',
    tenant_id: 1,
    title: 'Ölwechsel durchführen',
    description: 'Motor-Öl wechseln',
    status: 'open',
    priority: 'medium',
    source_type: 'manual',
    source_uuid: null,
    due_date: '2026-03-10',
    created_by: 5,
    completed_at: null,
    verified_at: null,
    verified_by: null,
    is_active: IS_ACTIVE.ACTIVE,
    created_at: '2026-03-01T08:00:00.000Z',
    updated_at: '2026-03-01T08:00:00.000Z',
    created_by_name: 'Max Müller',
    assignee_count: '0',
    assignee_names: null,
    comment_count: '0',
    photo_count: '0',
    ...overrides,
  };
}

function createAssigneeRow(
  overrides: Partial<WorkOrderAssigneeWithNameRow> = {},
): WorkOrderAssigneeWithNameRow {
  return {
    id: 10,
    uuid: '019c9547-bbbb-771a-b022-222222222222',
    tenant_id: 1,
    work_order_id: 1,
    user_id: 42,
    assigned_at: '2026-03-01T09:00:00.000Z',
    assigned_by: 5,
    first_name: 'Anna',
    last_name: 'Schmidt',
    profile_picture: null,
    ...overrides,
  };
}

// ============================================================================
// Service instance
// ============================================================================

let service: WorkOrdersService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new WorkOrdersService(
    mockDb as unknown as DatabaseService,
    mockActivityLogger as never,
  );
});

// ============================================================================
// createWorkOrder
// ============================================================================

describe('createWorkOrder', () => {
  it('should create a work order without assignees', async () => {
    const row = createWorkOrderRow();
    mockClient.query.mockResolvedValueOnce({ rows: [row] });

    const result = await service.createWorkOrder(1, 5, {
      title: 'Ölwechsel durchführen',
      dueDate: '2026-04-01',
    });

    expect(result.uuid).toBe('019c9547-9fc0-771a-b022-3767e233d6f3');
    expect(result.title).toBe('Ölwechsel durchführen');
    expect(result.assignees).toEqual([]);
  });

  it('should create a work order with assignees', async () => {
    const row = createWorkOrderRow();
    const assigneeRow = createAssigneeRow();

    // 1st call: INSERT work_order
    mockClient.query.mockResolvedValueOnce({ rows: [row] });
    // 2nd call: INSERT assignee
    mockClient.query.mockResolvedValueOnce({ rows: [assigneeRow] });

    const result = await service.createWorkOrder(1, 5, {
      title: 'Ölwechsel durchführen',
      dueDate: '2026-04-01',
      assigneeUuids: ['user-uuid-1'],
    });

    expect(result.assignees).toHaveLength(1);
    expect(result.assignees[0]?.userName).toBe('Anna Schmidt');
  });

  it('should throw NotFoundException when INSERT returns no rows', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      service.createWorkOrder(1, 5, { title: 'Test', dueDate: '2026-04-01' }),
    ).rejects.toThrow('Arbeitsauftrag konnte nicht erstellt werden');
  });

  it('should use default values for optional fields', async () => {
    const row = createWorkOrderRow();
    mockClient.query.mockResolvedValueOnce({ rows: [row] });

    await service.createWorkOrder(1, 5, {
      title: 'Test',
      dueDate: '2026-04-01',
    });

    const params = mockClient.query.mock.calls[0]?.[1] as unknown[];
    // params[4] = priority (default 'medium')
    expect(params[4]).toBe('medium');
    // params[5] = sourceType (default 'manual')
    expect(params[5]).toBe('manual');
    // params[3] = description (default null)
    expect(params[3]).toBeNull();
    // params[6] = sourceUuid (default null)
    expect(params[6]).toBeNull();
    // params[7] = dueDate (now required)
    expect(params[7]).toBe('2026-04-01');
  });

  it('should log activity after creation', async () => {
    const row = createWorkOrderRow();
    mockClient.query.mockResolvedValueOnce({ rows: [row] });

    await service.createWorkOrder(1, 5, {
      title: 'Test',
      dueDate: '2026-04-01',
    });

    expect(mockActivityLogger.logCreate).toHaveBeenCalledExactlyOnceWith(
      1,
      5,
      'work_order',
      1,
      expect.stringContaining('Test'),
      expect.any(Object),
    );
  });

  it('should reject kvp_proposal when active work order exists for same source', async () => {
    mockDb.queryOne.mockResolvedValueOnce({
      uuid: 'existing-wo',
      status: 'open',
    });

    await expect(
      service.createWorkOrder(1, 5, {
        title: 'KVP: Doppelt',
        sourceType: 'kvp_proposal',
        sourceUuid: 'kvp-uuid-123',
        dueDate: '2026-04-01',
      }),
    ).rejects.toThrow('Es existiert bereits ein aktiver Arbeitsauftrag');
  });

  it('should allow kvp_proposal when all linked work orders are verified', async () => {
    // ensureNoActiveLinkedWorkOrder: no active WO found
    mockDb.queryOne.mockResolvedValueOnce(null);
    // createWorkOrder transaction
    const row = createWorkOrderRow({
      source_type: 'kvp_proposal',
      source_uuid: 'kvp-uuid-123',
    });
    mockClient.query.mockResolvedValueOnce({ rows: [row] });

    const result = await service.createWorkOrder(1, 5, {
      title: 'KVP: Neu',
      sourceType: 'kvp_proposal',
      sourceUuid: 'kvp-uuid-123',
      dueDate: '2026-04-01',
    });

    expect(result.uuid).toBeDefined();
  });

  it('should skip duplicate check for manual work orders', async () => {
    const row = createWorkOrderRow();
    mockClient.query.mockResolvedValueOnce({ rows: [row] });

    await service.createWorkOrder(1, 5, {
      title: 'Manuell',
      dueDate: '2026-04-01',
    });

    // queryOne should NOT have been called (no ensureNoActiveLinkedWorkOrder)
    expect(mockDb.queryOne).not.toHaveBeenCalled();
  });
});

// ============================================================================
// getWorkOrder
// ============================================================================

describe('getWorkOrder', () => {
  it('should return a work order with assignees', async () => {
    const row = createWorkOrderRow();
    const assignees = [createAssigneeRow()];

    mockDb.queryOne.mockResolvedValueOnce(row);
    mockDb.query.mockResolvedValueOnce(assignees);

    const result = await service.getWorkOrder(1, 'test-uuid');

    expect(result.uuid).toBe('019c9547-9fc0-771a-b022-3767e233d6f3');
    expect(result.assignees).toHaveLength(1);
  });

  it('should throw NotFoundException when not found', async () => {
    mockDb.queryOne.mockResolvedValueOnce(null);

    await expect(service.getWorkOrder(1, 'unknown')).rejects.toThrow(
      'Arbeitsauftrag nicht gefunden',
    );
  });

  it('should return empty assignees when none exist', async () => {
    mockDb.queryOne.mockResolvedValueOnce(createWorkOrderRow());
    mockDb.query.mockResolvedValueOnce([]);

    const result = await service.getWorkOrder(1, 'test-uuid');
    expect(result.assignees).toEqual([]);
  });

  it('should enrich sourceExpectedBenefit for kvp_proposal', async () => {
    const row = createWorkOrderRow({
      source_type: 'kvp_proposal',
      source_uuid: 'kvp-uuid-123',
    });
    // 1st queryOne: work order row
    mockDb.queryOne.mockResolvedValueOnce(row);
    // query: assignees
    mockDb.query.mockResolvedValueOnce([]);
    // 2nd queryOne: KVP expected_benefit
    mockDb.queryOne.mockResolvedValueOnce({
      expected_benefit: 'Reduziert Ausfallzeiten um 20%',
    });

    const result = await service.getWorkOrder(1, 'test-uuid');

    expect(result.sourceExpectedBenefit).toBe('Reduziert Ausfallzeiten um 20%');
  });

  it('should not enrich sourceExpectedBenefit for manual work orders', async () => {
    const row = createWorkOrderRow({ source_type: 'manual' });
    mockDb.queryOne.mockResolvedValueOnce(row);
    mockDb.query.mockResolvedValueOnce([]);

    const result = await service.getWorkOrder(1, 'test-uuid');

    expect(result.sourceExpectedBenefit).toBeNull();
    // Only 1 queryOne call (the WO itself), no KVP enrichment
    expect(mockDb.queryOne).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// listWorkOrders
// ============================================================================

describe('listWorkOrders', () => {
  it('should return paginated results with defaults', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ count: '5' });
    mockDb.query.mockResolvedValueOnce([createWorkOrderRow()]);

    const result = await service.listWorkOrders(1, 5, {});

    expect(result.total).toBe(5);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.items).toHaveLength(1);
  });

  it('should pass custom page and limit', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ count: '100' });
    mockDb.query.mockResolvedValueOnce([]);

    const result = await service.listWorkOrders(1, 5, { page: 3, limit: 10 });

    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(10);
  });

  it('should apply status filter', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ count: '2' });
    mockDb.query.mockResolvedValueOnce([]);

    await service.listWorkOrders(1, 5, { status: 'open' });

    const countSql = mockDb.queryOne.mock.calls[0]?.[0] as string;
    expect(countSql).toContain('wo.status = $');
  });

  it('should apply priority filter', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ count: '0' });
    mockDb.query.mockResolvedValueOnce([]);

    await service.listWorkOrders(1, 5, { priority: 'high' });

    const params = mockDb.queryOne.mock.calls[0]?.[1] as unknown[];
    expect(params).toContain('high');
  });

  it('should apply sourceType filter', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ count: '0' });
    mockDb.query.mockResolvedValueOnce([]);

    await service.listWorkOrders(1, 5, { sourceType: 'tpm_defect' });

    const countSql = mockDb.queryOne.mock.calls[0]?.[0] as string;
    expect(countSql).toContain('wo.source_type = $');
  });

  it('should apply assigneeUuid filter', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ count: '0' });
    mockDb.query.mockResolvedValueOnce([]);

    await service.listWorkOrders(1, 5, { assigneeUuid: 'user-uuid' });

    const countSql = mockDb.queryOne.mock.calls[0]?.[0] as string;
    expect(countSql).toContain('work_order_assignees');
  });

  it('should return empty items when no results', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ count: '0' });
    mockDb.query.mockResolvedValueOnce([]);

    const result = await service.listWorkOrders(1, 5, {});

    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });

  it('should handle null count result', async () => {
    mockDb.queryOne.mockResolvedValueOnce(null);
    mockDb.query.mockResolvedValueOnce([]);

    const result = await service.listWorkOrders(1, 5, {});
    expect(result.total).toBe(0);
  });

  it('should apply sourceUuid filter', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ count: '1' });
    mockDb.query.mockResolvedValueOnce([
      createWorkOrderRow({
        source_type: 'kvp_proposal',
        source_uuid: 'kvp-uuid-456',
      }),
    ]);

    await service.listWorkOrders(1, 5, { sourceUuid: 'kvp-uuid-456' });

    const countSql = mockDb.queryOne.mock.calls[0]?.[0] as string;
    expect(countSql).toContain('wo.source_uuid = $');
    const params = mockDb.queryOne.mock.calls[0]?.[1] as unknown[];
    expect(params).toContain('kvp-uuid-456');
  });

  it('should apply isActive=archived filter', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ count: '1' });
    mockDb.query.mockResolvedValueOnce([]);

    await service.listWorkOrders(1, 5, { isActive: 'archived' });

    const countSql = mockDb.queryOne.mock.calls[0]?.[0] as string;
    expect(countSql).toContain(`is_active = ${IS_ACTIVE.ARCHIVED}`);
  });

  it('should apply isActive=all filter (active + archived)', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ count: '3' });
    mockDb.query.mockResolvedValueOnce([]);

    await service.listWorkOrders(1, 5, { isActive: 'all' });

    const countSql = mockDb.queryOne.mock.calls[0]?.[0] as string;
    expect(countSql).toContain(
      `is_active IN (${IS_ACTIVE.ACTIVE}, ${IS_ACTIVE.ARCHIVED})`,
    );
  });
});

// ============================================================================
// listMyWorkOrders
// ============================================================================

describe('listMyWorkOrders', () => {
  it('should add userId filter for assigned work orders', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ count: '1' });
    mockDb.query.mockResolvedValueOnce([createWorkOrderRow()]);

    const result = await service.listMyWorkOrders(1, 42, {});

    expect(result.items).toHaveLength(1);

    const countSql = mockDb.queryOne.mock.calls[0]?.[0] as string;
    expect(countSql).toContain('work_order_assignees');
  });

  it('should include userId in query params', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ count: '0' });
    mockDb.query.mockResolvedValueOnce([]);

    await service.listMyWorkOrders(1, 42, {});

    const params = mockDb.queryOne.mock.calls[0]?.[1] as unknown[];
    expect(params).toContain(42);
  });
});

// ============================================================================
// updateWorkOrder
// ============================================================================

describe('updateWorkOrder', () => {
  it('should update title', async () => {
    // lockByUuid
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 1, title: 'Alt', priority: 'medium' }],
    });
    // UPDATE query
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

    // getWorkOrder calls: queryOne + query
    mockDb.queryOne.mockResolvedValueOnce(createWorkOrderRow({ title: 'Neu' }));
    mockDb.query.mockResolvedValueOnce([]);

    const result = await service.updateWorkOrder(1, 5, 'test-uuid', {
      title: 'Neu',
    });

    expect(result.title).toBe('Neu');
  });

  it('should return existing work order when no fields to update', async () => {
    // lockByUuid
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 1, title: 'Test', priority: 'medium' }],
    });

    // getWorkOrder (called because sets.length === 0)
    mockDb.queryOne.mockResolvedValueOnce(createWorkOrderRow());
    mockDb.query.mockResolvedValueOnce([]);

    const result = await service.updateWorkOrder(1, 5, 'test-uuid', {});

    expect(result.title).toBe('Ölwechsel durchführen');
    // Only lockByUuid was called on client, no UPDATE
    expect(mockClient.query).toHaveBeenCalledTimes(1);
  });

  it('should throw NotFoundException when work order not found', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      service.updateWorkOrder(1, 5, 'unknown', { title: 'New' }),
    ).rejects.toThrow('Arbeitsauftrag nicht gefunden');
  });

  it('should update multiple fields at once', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 1, title: 'Alt', priority: 'low' }],
    });
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });
    mockDb.queryOne.mockResolvedValueOnce(createWorkOrderRow());
    mockDb.query.mockResolvedValueOnce([]);

    await service.updateWorkOrder(1, 5, 'test-uuid', {
      title: 'Neu',
      priority: 'high',
      description: 'Neue Beschreibung',
    });

    const updateSql = mockClient.query.mock.calls[1]?.[0] as string;
    expect(updateSql).toContain('title =');
    expect(updateSql).toContain('priority =');
    expect(updateSql).toContain('description =');
  });

  it('should update dueDate', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 1, title: 'Test', priority: 'medium' }],
    });
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });
    mockDb.queryOne.mockResolvedValueOnce(
      createWorkOrderRow({ due_date: '2026-06-01' }),
    );
    mockDb.query.mockResolvedValueOnce([]);

    const result = await service.updateWorkOrder(1, 5, 'test-uuid', {
      dueDate: '2026-06-01',
    });

    const updateSql = mockClient.query.mock.calls[1]?.[0] as string;
    expect(updateSql).toContain('due_date =');
    expect(result.dueDate).toBe('2026-06-01');
  });

  it('should log activity after update', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 1, title: 'Alt', priority: 'medium' }],
    });
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });
    mockDb.queryOne.mockResolvedValueOnce(createWorkOrderRow());
    mockDb.query.mockResolvedValueOnce([]);

    await service.updateWorkOrder(1, 5, 'test-uuid', { title: 'Neu' });

    expect(mockActivityLogger.logUpdate).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// archiveWorkOrder
// ============================================================================

describe('archiveWorkOrder', () => {
  it(`should archive a work order (is_active = ${IS_ACTIVE.ARCHIVED})`, async () => {
    mockDb.queryOne.mockResolvedValueOnce({ id: 1, title: 'Test' });
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

    await service.archiveWorkOrder(1, 5, 'test-uuid');

    const sql = mockClient.query.mock.calls[0]?.[0] as string;
    expect(sql).toContain(`is_active = ${IS_ACTIVE.ARCHIVED}`);
  });

  it('should throw NotFoundException when work order not found', async () => {
    mockDb.queryOne.mockResolvedValueOnce(null);

    await expect(service.archiveWorkOrder(1, 5, 'unknown')).rejects.toThrow(
      'Arbeitsauftrag nicht gefunden',
    );
  });

  it('should log activity after archiving', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ id: 1, title: 'Test' });
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

    await service.archiveWorkOrder(1, 5, 'test-uuid');

    expect(mockActivityLogger.logUpdate).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// restoreWorkOrder
// ============================================================================

describe('restoreWorkOrder', () => {
  it(`should restore an archived work order (is_active = ${IS_ACTIVE.ACTIVE})`, async () => {
    mockDb.queryOne.mockResolvedValueOnce({ id: 1, title: 'Test' });
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

    await service.restoreWorkOrder(1, 5, 'test-uuid');

    const sql = mockClient.query.mock.calls[0]?.[0] as string;
    expect(sql).toContain(`is_active = ${IS_ACTIVE.ACTIVE}`);
  });

  it('should throw NotFoundException when archived work order not found', async () => {
    mockDb.queryOne.mockResolvedValueOnce(null);

    await expect(service.restoreWorkOrder(1, 5, 'unknown')).rejects.toThrow(
      'Archivierter Arbeitsauftrag nicht gefunden',
    );
  });

  it('should log activity after restoring', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ id: 1, title: 'Test' });
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

    await service.restoreWorkOrder(1, 5, 'test-uuid');

    expect(mockActivityLogger.logUpdate).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// getStats
// ============================================================================

describe('getStats', () => {
  it('should return parsed stats', async () => {
    mockDb.queryOne.mockResolvedValueOnce({
      open: '5',
      in_progress: '3',
      completed: '10',
      verified: '7',
      total: '25',
      overdue: '2',
    });

    const stats = await service.getStats(1);

    expect(stats.open).toBe(5);
    expect(stats.inProgress).toBe(3);
    expect(stats.completed).toBe(10);
    expect(stats.verified).toBe(7);
    expect(stats.total).toBe(25);
    expect(stats.overdue).toBe(2);
  });

  it('should default to 0 when queryOne returns null', async () => {
    mockDb.queryOne.mockResolvedValueOnce(null);

    const stats = await service.getStats(1);

    expect(stats.open).toBe(0);
    expect(stats.inProgress).toBe(0);
    expect(stats.completed).toBe(0);
    expect(stats.verified).toBe(0);
    expect(stats.total).toBe(0);
    expect(stats.overdue).toBe(0);
  });

  it('should pass tenantId to query', async () => {
    mockDb.queryOne.mockResolvedValueOnce({
      open: '0',
      in_progress: '0',
      completed: '0',
      verified: '0',
      total: '0',
      overdue: '0',
    });

    await service.getStats(42);

    const params = mockDb.queryOne.mock.calls[0]?.[1] as unknown[];
    expect(params[0]).toBe(42);
  });
});

// ============================================================================
// getCalendarWorkOrders
// ============================================================================

function createCalendarRow(
  overrides: Partial<CalendarWorkOrderRow> = {},
): CalendarWorkOrderRow {
  return {
    uuid: '019c9547-9fc0-771a-b022-3767e233d6f3',
    title: 'Wartung Anlage 3',
    due_date: '2026-03-15',
    status: 'open',
    priority: 'medium',
    source_type: 'manual',
    ...overrides,
  };
}

describe('getCalendarWorkOrders', () => {
  it('should return mapped calendar work orders for admin', async () => {
    mockDb.query.mockResolvedValueOnce([createCalendarRow()]);

    const result = await service.getCalendarWorkOrders(
      1,
      5,
      true,
      '2026-03-01',
      '2026-03-31',
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.uuid).toBe('019c9547-9fc0-771a-b022-3767e233d6f3');
    expect(result[0]?.dueDate).toBe('2026-03-15');
    expect(result[0]?.status).toBe('open');
  });

  it('should add user filter for non-admin', async () => {
    mockDb.query.mockResolvedValueOnce([]);

    await service.getCalendarWorkOrders(
      1,
      42,
      false,
      '2026-03-01',
      '2026-03-31',
    );

    const sql = mockDb.query.mock.calls[0]?.[0] as string;
    expect(sql).toContain('woa2.user_id = $4');
    const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
    expect(params).toContain(42);
  });

  it('should not add user filter for admin', async () => {
    mockDb.query.mockResolvedValueOnce([]);

    await service.getCalendarWorkOrders(1, 5, true, '2026-03-01', '2026-03-31');

    const sql = mockDb.query.mock.calls[0]?.[0] as string;
    expect(sql).not.toContain('woa2.user_id');
  });

  it('should return empty array when no results', async () => {
    mockDb.query.mockResolvedValueOnce([]);

    const result = await service.getCalendarWorkOrders(
      1,
      5,
      true,
      '2026-03-01',
      '2026-03-31',
    );

    expect(result).toEqual([]);
  });
});

// ============================================================================
// getMyStats
// ============================================================================

describe('getMyStats', () => {
  it('should return stats for a specific user', async () => {
    mockDb.queryOne.mockResolvedValueOnce({
      open: '2',
      in_progress: '1',
      completed: '4',
      verified: '3',
      total: '10',
      overdue: '0',
    });

    const stats = await service.getMyStats(1, 42);

    expect(stats.open).toBe(2);
    expect(stats.total).toBe(10);
  });

  it('should include userId in query params', async () => {
    mockDb.queryOne.mockResolvedValueOnce({
      open: '0',
      in_progress: '0',
      completed: '0',
      verified: '0',
      total: '0',
      overdue: '0',
    });

    await service.getMyStats(1, 42);

    const params = mockDb.queryOne.mock.calls[0]?.[1] as unknown[];
    expect(params).toContain(1);
    expect(params).toContain(42);
  });

  it('should use JOIN on work_order_assignees', async () => {
    mockDb.queryOne.mockResolvedValueOnce({
      open: '0',
      in_progress: '0',
      completed: '0',
      verified: '0',
      total: '0',
      overdue: '0',
    });

    await service.getMyStats(1, 42);

    const sql = mockDb.queryOne.mock.calls[0]?.[0] as string;
    expect(sql).toContain('work_order_assignees');
  });
});
