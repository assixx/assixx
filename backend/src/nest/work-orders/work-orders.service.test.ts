/**
 * Work Orders Service — Unit Tests
 *
 * Tests Core CRUD: create, get, list, listMy, update, delete, getStats.
 * Mock DatabaseService (query, queryOne, tenantTransaction) + ActivityLoggerService.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { WorkOrdersService } from './work-orders.service.js';
import type {
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
    is_active: 1,
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
      assigneeUuids: ['user-uuid-1'],
    });

    expect(result.assignees).toHaveLength(1);
    expect(result.assignees[0]?.userName).toBe('Anna Schmidt');
  });

  it('should throw NotFoundException when INSERT returns no rows', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      service.createWorkOrder(1, 5, { title: 'Test' }),
    ).rejects.toThrow('Arbeitsauftrag konnte nicht erstellt werden');
  });

  it('should use default values for optional fields', async () => {
    const row = createWorkOrderRow();
    mockClient.query.mockResolvedValueOnce({ rows: [row] });

    await service.createWorkOrder(1, 5, { title: 'Test' });

    const params = mockClient.query.mock.calls[0]?.[1] as unknown[];
    // params[4] = priority (default 'medium')
    expect(params[4]).toBe('medium');
    // params[5] = sourceType (default 'manual')
    expect(params[5]).toBe('manual');
    // params[3] = description (default null)
    expect(params[3]).toBeNull();
    // params[6] = sourceUuid (default null)
    expect(params[6]).toBeNull();
    // params[7] = dueDate (default null)
    expect(params[7]).toBeNull();
  });

  it('should log activity after creation', async () => {
    const row = createWorkOrderRow();
    mockClient.query.mockResolvedValueOnce({ rows: [row] });

    await service.createWorkOrder(1, 5, { title: 'Test' });

    expect(mockActivityLogger.logCreate).toHaveBeenCalledExactlyOnceWith(
      1,
      5,
      'work_order',
      1,
      expect.stringContaining('Test'),
      expect.any(Object),
    );
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
});

// ============================================================================
// listWorkOrders
// ============================================================================

describe('listWorkOrders', () => {
  it('should return paginated results with defaults', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ count: '5' });
    mockDb.query.mockResolvedValueOnce([createWorkOrderRow()]);

    const result = await service.listWorkOrders(1, {});

    expect(result.total).toBe(5);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.items).toHaveLength(1);
  });

  it('should pass custom page and limit', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ count: '100' });
    mockDb.query.mockResolvedValueOnce([]);

    const result = await service.listWorkOrders(1, { page: 3, limit: 10 });

    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(10);
  });

  it('should apply status filter', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ count: '2' });
    mockDb.query.mockResolvedValueOnce([]);

    await service.listWorkOrders(1, { status: 'open' });

    const countSql = mockDb.queryOne.mock.calls[0]?.[0] as string;
    expect(countSql).toContain('wo.status = $');
  });

  it('should apply priority filter', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ count: '0' });
    mockDb.query.mockResolvedValueOnce([]);

    await service.listWorkOrders(1, { priority: 'high' });

    const params = mockDb.queryOne.mock.calls[0]?.[1] as unknown[];
    expect(params).toContain('high');
  });

  it('should apply sourceType filter', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ count: '0' });
    mockDb.query.mockResolvedValueOnce([]);

    await service.listWorkOrders(1, { sourceType: 'tpm_defect' });

    const countSql = mockDb.queryOne.mock.calls[0]?.[0] as string;
    expect(countSql).toContain('wo.source_type = $');
  });

  it('should apply assigneeUuid filter', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ count: '0' });
    mockDb.query.mockResolvedValueOnce([]);

    await service.listWorkOrders(1, { assigneeUuid: 'user-uuid' });

    const countSql = mockDb.queryOne.mock.calls[0]?.[0] as string;
    expect(countSql).toContain('work_order_assignees');
  });

  it('should return empty items when no results', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ count: '0' });
    mockDb.query.mockResolvedValueOnce([]);

    const result = await service.listWorkOrders(1, {});

    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });

  it('should handle null count result', async () => {
    mockDb.queryOne.mockResolvedValueOnce(null);
    mockDb.query.mockResolvedValueOnce([]);

    const result = await service.listWorkOrders(1, {});
    expect(result.total).toBe(0);
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
// deleteWorkOrder
// ============================================================================

describe('deleteWorkOrder', () => {
  it('should soft-delete a work order (is_active = 4)', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ id: 1, title: 'Test' });
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

    await service.deleteWorkOrder(1, 5, 'test-uuid');

    const sql = mockClient.query.mock.calls[0]?.[0] as string;
    expect(sql).toContain('is_active = 4');
  });

  it('should throw NotFoundException when work order not found', async () => {
    mockDb.queryOne.mockResolvedValueOnce(null);

    await expect(service.deleteWorkOrder(1, 5, 'unknown')).rejects.toThrow(
      'Arbeitsauftrag nicht gefunden',
    );
  });

  it('should log activity after deletion', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ id: 1, title: 'Test' });
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

    await service.deleteWorkOrder(1, 5, 'test-uuid');

    expect(mockActivityLogger.logDelete).toHaveBeenCalledExactlyOnceWith(
      1,
      5,
      'work_order',
      1,
      expect.stringContaining('Test'),
      expect.objectContaining({ uuid: 'test-uuid' }),
    );
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
