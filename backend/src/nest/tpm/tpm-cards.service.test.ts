/**
 * Unit tests for TpmCardsService
 *
 * Mocked dependencies: DatabaseService (query, queryOne, tenantTransaction),
 * ActivityLoggerService (logCreate, logUpdate, logDelete).
 * Tests: getCard, listCardsForAsset, listCardsForPlan, getCardsByStatus,
 * createCard (plan resolution, card code generation, auto asset_id,
 * interval_order from map, sort_order auto-increment, UUIDv7),
 * updateCard (dynamic SET, interval_order recalc, FOR UPDATE, empty dto),
 * deleteCard (soft-delete, activity logging).
 *
 * Pattern: tenantTransaction callback receives mockClient with query() mock.
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { TpmCardJoinRow } from './tpm-cards.helpers.js';
import { TpmCardsService } from './tpm-cards.service.js';
import type { TpmSchedulingService } from './tpm-scheduling.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockActivityLogger() {
  return {
    logCreate: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined),
    logDelete: vi.fn().mockResolvedValue(undefined),
  };
}

function createCardRow(overrides?: Partial<TpmCardJoinRow>): TpmCardJoinRow {
  return {
    id: 1,
    uuid: 'card-uuid-001                            ',
    tenant_id: 10,
    plan_id: 100,
    asset_id: 42,
    card_code: 'BT1',
    card_role: 'operator',
    interval_type: 'weekly',
    interval_order: 2,
    title: 'Sichtprüfung',
    description: 'Visuelle Kontrolle der Dichtungen',
    location_description: 'Halle 3, Anlage links',
    location_photo_url: null,
    requires_approval: false,
    status: 'green',
    current_due_date: null,
    last_completed_at: null,
    last_completed_by: null,
    sort_order: 1,
    custom_fields: {},
    custom_interval_days: null,
    weekday_override: null,
    estimated_execution_minutes: null,
    is_active: 1,
    created_by: 5,
    created_at: '2026-02-18T00:00:00.000Z',
    updated_at: '2026-02-18T00:00:00.000Z',
    plan_uuid: 'plan-uuid-001                            ',
    asset_name: 'CNC-001',
    created_by_name: 'admin',
    ...overrides,
  };
}

// =============================================================
// TpmCardsService
// =============================================================

describe('TpmCardsService', () => {
  let service: TpmCardsService;
  let mockDb: MockDb;
  let mockClient: { query: ReturnType<typeof vi.fn> };
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;
  const mockSchedulingService = {
    initializeCardSchedule: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };
    mockActivityLogger = createMockActivityLogger();

    mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: typeof mockClient) => Promise<unknown>) => {
        return await callback(mockClient);
      },
    );

    service = new TpmCardsService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
      mockSchedulingService as unknown as TpmSchedulingService,
    );
  });

  // =============================================================
  // getCard
  // =============================================================

  describe('getCard()', () => {
    it('should return a mapped card with JOIN data', async () => {
      mockDb.queryOne.mockResolvedValueOnce(createCardRow());

      const result = await service.getCard(10, 'card-uuid-001');

      expect(result.uuid).toBe('card-uuid-001');
      expect(result.assetId).toBe(42);
      expect(result.cardCode).toBe('BT1');
      expect(result.cardRole).toBe('operator');
      expect(result.intervalType).toBe('weekly');
      expect(result.intervalOrder).toBe(2);
      expect(result.title).toBe('Sichtprüfung');
      expect(result.planUuid).toBe('plan-uuid-001');
      expect(result.assetName).toBe('CNC-001');
    });

    it('should throw NotFoundException when card not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(service.getCard(10, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not set optional fields when JOIN columns are missing', async () => {
      mockDb.queryOne.mockResolvedValueOnce(
        createCardRow({
          plan_uuid: undefined,
          asset_name: undefined,
          created_by_name: undefined,
          last_completed_by_name: undefined,
        }),
      );

      const result = await service.getCard(10, 'card-uuid-001');

      expect(result.planUuid).toBeUndefined();
      expect(result.assetName).toBeUndefined();
      expect(result.createdByName).toBeUndefined();
      expect(result.lastCompletedByName).toBeUndefined();
    });
  });

  // =============================================================
  // listCardsForAsset
  // =============================================================

  describe('listCardsForAsset()', () => {
    it('should return paginated cards with total', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '5' });
      mockDb.query.mockResolvedValueOnce([
        createCardRow(),
        createCardRow({ id: 2, uuid: 'card-uuid-002', card_code: 'BT2' }),
      ]);

      const result = await service.listCardsForAsset(10, 'asset-uuid-001');

      expect(result.total).toBe(5);
      expect(result.data).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
    });

    it('should return empty list when no cards exist', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '0' });
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.listCardsForAsset(10, 'asset-uuid-001');

      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });

    it('should apply status filter', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '2' });
      mockDb.query.mockResolvedValueOnce([createCardRow({ status: 'red' })]);

      await service.listCardsForAsset(10, 'asset-uuid-001', 1, 50, {
        status: 'red',
      });

      const countSql = mockDb.queryOne.mock.calls[0]?.[0] as string;
      expect(countSql).toContain('c.status = $');
    });

    it('should apply multiple filters', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '1' });
      mockDb.query.mockResolvedValueOnce([createCardRow()]);

      await service.listCardsForAsset(10, 'asset-uuid-001', 1, 50, {
        status: 'green',
        intervalType: 'weekly',
        cardRole: 'operator',
      });

      const countSql = mockDb.queryOne.mock.calls[0]?.[0] as string;
      expect(countSql).toContain('c.status = $');
      expect(countSql).toContain('c.interval_type = $');
      expect(countSql).toContain('c.card_role = $');
    });
  });

  // =============================================================
  // listCardsForPlan
  // =============================================================

  describe('listCardsForPlan()', () => {
    it('should return paginated cards for a plan', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '3' });
      mockDb.query.mockResolvedValueOnce([createCardRow()]);

      const result = await service.listCardsForPlan(10, 'plan-uuid-001');

      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(1);
    });

    it('should handle null count result', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.listCardsForPlan(10, 'plan-uuid-001');

      expect(result.total).toBe(0);
    });
  });

  // =============================================================
  // getCardsByStatus
  // =============================================================

  describe('getCardsByStatus()', () => {
    it('should return cards with the given status', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '2' });
      mockDb.query.mockResolvedValueOnce([
        createCardRow({ status: 'red' }),
        createCardRow({ id: 2, status: 'red' }),
      ]);

      const result = await service.getCardsByStatus(10, 'red');

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.pageSize).toBe(20);
    });

    it('should apply correct offset for page 2', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '30' });
      mockDb.query.mockResolvedValueOnce([]);

      await service.getCardsByStatus(10, 'red', 2, 10);

      // Data query params: [tenantId, status, pageSize, offset]
      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toEqual([10, 'red', 10, 10]);
    });
  });

  // =============================================================
  // createCard
  // =============================================================

  describe('createCard()', () => {
    it('should resolve plan IDs, generate card code, and INSERT', async () => {
      // resolvePlanIds
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: 100, asset_id: 42, base_weekday: 0, base_repeat_every: 1 },
        ],
      });
      // generateCardCode (COUNT)
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '0' }],
      });
      // getNextSortOrder (MAX)
      mockClient.query.mockResolvedValueOnce({
        rows: [{ max_sort: '0' }],
      });
      // INSERT RETURNING
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow()],
      });

      const result = await service.createCard(
        10,
        {
          planUuid: 'plan-uuid-001',
          cardRole: 'operator',
          intervalType: 'weekly',
          title: 'Sichtprüfung',
          requiresApproval: false,
        },
        5,
      );

      expect(result.cardCode).toBe('BT1');
      expect(result.assetId).toBe(42);
      expect(result.intervalOrder).toBe(2);
    });

    it('should auto-set asset_id from plan (denormalization)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 100, asset_id: 99 }],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockClient.query.mockResolvedValueOnce({ rows: [{ max_sort: '0' }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ asset_id: 99 })],
      });

      const result = await service.createCard(
        10,
        {
          planUuid: 'plan-uuid-001',
          cardRole: 'operator',
          intervalType: 'daily',
          title: 'Test',
          requiresApproval: false,
        },
        5,
      );

      // INSERT params: asset_id is at index 3 (0-based)
      const insertParams = mockClient.query.mock.calls[3]?.[1] as unknown[];
      expect(insertParams?.[3]).toBe(99);
      expect(result.assetId).toBe(99);
    });

    it('should generate BT prefix for operator role', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: 100, asset_id: 42, base_weekday: 0, base_repeat_every: 1 },
        ],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '4' }] });
      mockClient.query.mockResolvedValueOnce({ rows: [{ max_sort: '3' }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ card_code: 'BT5' })],
      });

      await service.createCard(
        10,
        {
          planUuid: 'plan-uuid-001',
          cardRole: 'operator',
          intervalType: 'weekly',
          title: 'Test',
          requiresApproval: false,
        },
        5,
      );

      // card_code is at index 4 in INSERT params
      const insertParams = mockClient.query.mock.calls[3]?.[1] as unknown[];
      expect(insertParams?.[4]).toBe('BT5');
    });

    it('should generate IV prefix for maintenance role', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: 100, asset_id: 42, base_weekday: 0, base_repeat_every: 1 },
        ],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      mockClient.query.mockResolvedValueOnce({ rows: [{ max_sort: '0' }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ card_code: 'IV3', card_role: 'maintenance' })],
      });

      await service.createCard(
        10,
        {
          planUuid: 'plan-uuid-001',
          cardRole: 'maintenance',
          intervalType: 'monthly',
          title: 'Ölwechsel',
          requiresApproval: true,
        },
        5,
      );

      const insertParams = mockClient.query.mock.calls[3]?.[1] as unknown[];
      expect(insertParams?.[4]).toBe('IV3');
    });

    it('should auto-set interval_order from INTERVAL_ORDER_MAP', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: 100, asset_id: 42, base_weekday: 0, base_repeat_every: 1 },
        ],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockClient.query.mockResolvedValueOnce({ rows: [{ max_sort: '0' }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createCardRow({ interval_type: 'quarterly', interval_order: 4 }),
        ],
      });

      await service.createCard(
        10,
        {
          planUuid: 'plan-uuid-001',
          cardRole: 'operator',
          intervalType: 'quarterly',
          title: 'Vierteljährliche Prüfung',
          requiresApproval: false,
        },
        5,
      );

      // interval_order is at index 7 in INSERT params
      const insertParams = mockClient.query.mock.calls[3]?.[1] as unknown[];
      expect(insertParams?.[7]).toBe(4); // quarterly = 4
    });

    it('should auto-increment sort_order per plan', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: 100, asset_id: 42, base_weekday: 0, base_repeat_every: 1 },
        ],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockClient.query.mockResolvedValueOnce({ rows: [{ max_sort: '7' }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ sort_order: 8 })],
      });

      await service.createCard(
        10,
        {
          planUuid: 'plan-uuid-001',
          cardRole: 'operator',
          intervalType: 'daily',
          title: 'Test',
          requiresApproval: false,
        },
        5,
      );

      // sort_order is at index 12 in INSERT params
      const insertParams = mockClient.query.mock.calls[3]?.[1] as unknown[];
      expect(insertParams?.[12]).toBe(8); // 7 + 1
    });

    it('should throw NotFoundException when plan not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.createCard(
          10,
          {
            planUuid: 'nonexistent',
            cardRole: 'operator',
            intervalType: 'weekly',
            title: 'Test',
            requiresApproval: false,
          },
          5,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when INSERT returns no rows', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: 100, asset_id: 42, base_weekday: 0, base_repeat_every: 1 },
        ],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockClient.query.mockResolvedValueOnce({ rows: [{ max_sort: '0' }] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.createCard(
          10,
          {
            planUuid: 'plan-uuid-001',
            cardRole: 'operator',
            intervalType: 'weekly',
            title: 'Test',
            requiresApproval: false,
          },
          5,
        ),
      ).rejects.toThrow('INSERT into tpm_cards returned no rows');
    });

    it('should pass null for optional fields when not provided', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: 100, asset_id: 42, base_weekday: 0, base_repeat_every: 1 },
        ],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockClient.query.mockResolvedValueOnce({ rows: [{ max_sort: '0' }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createCardRow({
            description: null,
            location_description: null,
            custom_interval_days: null,
          }),
        ],
      });

      await service.createCard(
        10,
        {
          planUuid: 'plan-uuid-001',
          cardRole: 'operator',
          intervalType: 'weekly',
          title: 'Minimal Card',
          requiresApproval: false,
        },
        5,
      );

      const insertParams = mockClient.query.mock.calls[3]?.[1] as unknown[];
      // description=9, locationDescription=10, customIntervalDays=13,
      // weekdayOverride=14, estimatedExecutionMinutes=15
      expect(insertParams?.[9]).toBeNull();
      expect(insertParams?.[10]).toBeNull();
      expect(insertParams?.[13]).toBeNull();
      expect(insertParams?.[14]).toBeNull();
      expect(insertParams?.[15]).toBeNull();
    });

    it('should pass estimatedExecutionMinutes to INSERT when provided', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: 100, asset_id: 42, base_weekday: 0, base_repeat_every: 1 },
        ],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockClient.query.mockResolvedValueOnce({ rows: [{ max_sort: '0' }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ estimated_execution_minutes: 45 })],
      });

      const result = await service.createCard(
        10,
        {
          planUuid: 'plan-uuid-001',
          cardRole: 'operator',
          intervalType: 'weekly',
          title: 'Ölstandkontrolle',
          requiresApproval: false,
          estimatedExecutionMinutes: 45,
        },
        5,
      );

      // estimatedExecutionMinutes is at index 15 in INSERT params
      const insertParams = mockClient.query.mock.calls[3]?.[1] as unknown[];
      expect(insertParams?.[15]).toBe(45);
      expect(result.estimatedExecutionMinutes).toBe(45);
    });

    it('should call activity logger after successful creation', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: 100, asset_id: 42, base_weekday: 0, base_repeat_every: 1 },
        ],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockClient.query.mockResolvedValueOnce({ rows: [{ max_sort: '0' }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow()],
      });

      await service.createCard(
        10,
        {
          planUuid: 'plan-uuid-001',
          cardRole: 'operator',
          intervalType: 'weekly',
          title: 'Sichtprüfung',
          requiresApproval: false,
        },
        5,
      );

      expect(mockActivityLogger.logCreate).toHaveBeenCalledWith(
        10,
        5,
        'tpm_card',
        42,
        expect.stringContaining('BT1'),
        expect.objectContaining({ cardUuid: 'card-uuid-001' }),
      );
    });
  });

  // =============================================================
  // updateCard
  // =============================================================

  describe('updateCard()', () => {
    it('should update with provided fields', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ title: 'Updated Title' })],
      });

      const result = await service.updateCard(10, 5, 'card-uuid-001', {
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
    });

    it('should return existing card when no fields provided', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow()],
      });

      const result = await service.updateCard(10, 5, 'card-uuid-001', {});

      expect(result.title).toBe('Sichtprüfung');
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    it('should recalculate interval_order when intervalType changes', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ interval_type: 'weekly' })],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ interval_type: 'monthly', interval_order: 3 })],
      });

      await service.updateCard(10, 5, 'card-uuid-001', {
        intervalType: 'monthly',
      });

      const updateSql = mockClient.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain('interval_order = $');
    });

    it('should not recalculate interval_order when intervalType unchanged', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ interval_type: 'weekly' })],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ title: 'New Title' })],
      });

      await service.updateCard(10, 5, 'card-uuid-001', {
        intervalType: 'weekly',
        title: 'New Title',
      });

      const updateSql = mockClient.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain('interval_type = $');
      expect(updateSql).not.toContain('interval_order');
    });

    it('should use FOR UPDATE lock', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow()],
      });

      await service.updateCard(10, 5, 'card-uuid-001', { title: 'X' });

      const lockSql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(lockSql).toContain('FOR UPDATE');
    });

    it('should throw NotFoundException when card not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateCard(10, 5, 'nonexistent', { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should call activity logger after successful update', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ title: 'Updated' })],
      });

      await service.updateCard(10, 5, 'card-uuid-001', { title: 'Updated' });

      expect(mockActivityLogger.logUpdate).toHaveBeenCalledWith(
        10,
        5,
        'tpm_card',
        42,
        expect.any(String),
        expect.objectContaining({ cardUuid: 'card-uuid-001' }),
        expect.any(Object),
      );
    });
  });

  // =============================================================
  // deleteCard
  // =============================================================

  describe('deleteCard()', () => {
    it('should soft-delete a card (is_active = 4)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow()],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.deleteCard(10, 5, 'card-uuid-001'),
      ).resolves.toBeUndefined();

      const deleteSql = mockClient.query.mock.calls[1]?.[0] as string;
      expect(deleteSql).toContain('is_active = 4');
    });

    it('should throw NotFoundException when card not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.deleteCard(10, 5, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should call activity logger after successful deletion', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow()],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.deleteCard(10, 5, 'card-uuid-001');

      expect(mockActivityLogger.logDelete).toHaveBeenCalledWith(
        10,
        5,
        'tpm_card',
        42,
        expect.stringContaining('BT1'),
        expect.objectContaining({ cardUuid: 'card-uuid-001' }),
      );
    });
  });
});
