/**
 * Unit tests for TpmPlansService
 *
 * Mocked dependencies: DatabaseService (query, queryOne, tenantTransaction),
 * ActivityLoggerService (logCreate, logUpdate, logDelete).
 * Tests: getPlan, listPlans, getPlanByAssetId, createPlan (asset resolution,
 * uniqueness check, UUIDv7), updatePlan (dynamic SET, FOR UPDATE),
 * deletePlan (soft-delete, activity logging).
 *
 * Pattern: tenantTransaction callback receives mockClient with query() mock.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { ScopeService } from '../hierarchy-permission/scope.service.js';
import type { TpmPlanJoinRow } from './tpm-plans.helpers.js';
import { TpmPlansService } from './tpm-plans.service.js';

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

function createMockScopeService() {
  return { getScope: vi.fn() };
}

/** Full-access user stub — scope filtering is bypassed */
const FULL_ACCESS_USER: NestAuthUser = {
  id: 1,
  email: 'admin@test.de',
  role: 'admin',
  tenantId: 10,
  activeRole: 'admin',
  isRoleSwitched: false,
  hasFullAccess: true,
};

function createPlanRow(overrides?: Partial<TpmPlanJoinRow>): TpmPlanJoinRow {
  return {
    id: 1,
    uuid: 'plan-uuid-001                          ',
    tenant_id: 10,
    asset_id: 42,
    name: 'Wartungsplan P17',
    base_weekday: 3,
    base_repeat_every: 1,
    base_time: '09:15',
    notes: 'Wöchentliche Kontrolle',
    created_by: 5,
    is_active: IS_ACTIVE.ACTIVE,
    created_at: '2026-02-18T00:00:00.000Z',
    updated_at: '2026-02-18T00:00:00.000Z',
    asset_name: 'CNC-001',
    created_by_name: 'admin',
    ...overrides,
  };
}

// =============================================================
// TpmPlansService
// =============================================================

describe('TpmPlansService', () => {
  let service: TpmPlansService;
  let mockDb: MockDb;
  let mockClient: { query: ReturnType<typeof vi.fn> };
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;
  let mockScopeService: ReturnType<typeof createMockScopeService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };
    mockActivityLogger = createMockActivityLogger();
    mockScopeService = createMockScopeService();

    mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: typeof mockClient) => Promise<unknown>) => {
        return await callback(mockClient);
      },
    );

    service = new TpmPlansService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
      mockScopeService as unknown as ScopeService,
    );
  });

  // =============================================================
  // getPlan
  // =============================================================

  describe('getPlan()', () => {
    it('should return a mapped plan', async () => {
      mockDb.queryOne.mockResolvedValueOnce(createPlanRow());

      const result = await service.getPlan(10, 'plan-uuid-001');

      expect(result.uuid).toBe('plan-uuid-001');
      expect(result.assetId).toBe(42);
      expect(result.name).toBe('Wartungsplan P17');
      expect(result.baseWeekday).toBe(3);
      expect(result.baseRepeatEvery).toBe(1);
      expect(result.baseTime).toBe('09:15');
      expect(result.assetName).toBe('CNC-001');
      expect(result.createdByName).toBe('admin');
    });

    it('should throw NotFoundException when plan not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(service.getPlan(10, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should not set optional fields when JOIN columns are missing', async () => {
      mockDb.queryOne.mockResolvedValueOnce(
        createPlanRow({ asset_name: undefined, created_by_name: undefined }),
      );

      const result = await service.getPlan(10, 'plan-uuid-001');

      expect(result.assetName).toBeUndefined();
      expect(result.createdByName).toBeUndefined();
    });
  });

  // =============================================================
  // listPlans
  // =============================================================

  describe('listPlans()', () => {
    it('should return paginated plans with total', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '3' });
      mockDb.query.mockResolvedValueOnce([
        createPlanRow(),
        createPlanRow({ id: 2, uuid: 'plan-uuid-002', name: 'Plan B' }),
      ]);

      const result = await service.listPlans(10, 1, 20, FULL_ACCESS_USER);

      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should return empty list when no plans exist', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '0' });
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.listPlans(10, 1, 20, FULL_ACCESS_USER);

      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });

    it('should handle null count result', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.listPlans(10, 1, 20, FULL_ACCESS_USER);

      expect(result.total).toBe(0);
    });

    it('should use default pagination values', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '0' });
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.listPlans(10, 1, 20, FULL_ACCESS_USER);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should apply correct offset for page 2', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '25' });
      mockDb.query.mockResolvedValueOnce([]);

      await service.listPlans(10, 2, 10, FULL_ACCESS_USER);

      // Second call is the data query with LIMIT/OFFSET
      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toEqual([10, 10, 10]); // tenantId, pageSize, offset(10)
    });
  });

  // =============================================================
  // getPlanByAssetId
  // =============================================================

  describe('getPlanByAssetId()', () => {
    it('should return a plan for the given asset', async () => {
      mockDb.queryOne.mockResolvedValueOnce(createPlanRow());

      const result = await service.getPlanByAssetId(10, 42);

      expect(result).not.toBeNull();
      expect(result?.assetId).toBe(42);
    });

    it('should return null when no plan exists for the asset', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service.getPlanByAssetId(10, 99);

      expect(result).toBeNull();
    });
  });

  // =============================================================
  // createPlan
  // =============================================================

  describe('createPlan()', () => {
    it('should resolve asset UUID, check uniqueness, and INSERT', async () => {
      // resolveAssetId
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 42 }],
      });
      // ensureNoPlanForAsset → no existing plan
      mockClient.query.mockResolvedValueOnce({
        rows: [],
      });
      // INSERT RETURNING
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow()],
      });

      const result = await service.createPlan(10, 5, {
        assetUuid: 'asset-uuid-001',
        name: 'Wartungsplan P17',
        baseWeekday: 3,
        baseRepeatEvery: 1,
      });

      expect(result.name).toBe('Wartungsplan P17');
      expect(result.assetId).toBe(42);
    });

    it('should throw NotFoundException when asset UUID not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.createPlan(10, 5, {
          assetUuid: 'nonexistent',
          name: 'Test Plan',
          baseWeekday: 0,
          baseRepeatEvery: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when asset already has a plan', async () => {
      // resolveAssetId → found
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 42 }],
      });
      // ensureNoPlanForAsset → existing plan found
      mockClient.query.mockResolvedValueOnce({
        rows: [{ uuid: 'existing-plan' }],
      });

      await expect(
        service.createPlan(10, 5, {
          assetUuid: 'asset-uuid-001',
          name: 'Duplicate Plan',
          baseWeekday: 0,
          baseRepeatEvery: 1,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should pass null for optional fields when not provided', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 42 }] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow({ base_time: null, notes: null })],
      });

      const result = await service.createPlan(10, 5, {
        assetUuid: 'asset-uuid-001',
        name: 'Minimal Plan',
        baseWeekday: 0,
        baseRepeatEvery: 1,
      });

      expect(result.baseTime).toBeNull();
      expect(result.notes).toBeNull();
    });

    it('should call activity logger after successful creation', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 42 }] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow()],
      });

      await service.createPlan(10, 5, {
        assetUuid: 'asset-uuid-001',
        name: 'Wartungsplan P17',
        baseWeekday: 3,
        baseRepeatEvery: 1,
      });

      expect(mockActivityLogger.logCreate).toHaveBeenCalledWith(
        10,
        5,
        'tpm_plan',
        42,
        expect.stringContaining('Wartungsplan P17'),
        expect.objectContaining({ planUuid: 'plan-uuid-001' }),
      );
    });

    it('should throw when INSERT returns no rows', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 42 }] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.createPlan(10, 5, {
          assetUuid: 'asset-uuid-001',
          name: 'Broken Plan',
          baseWeekday: 0,
          baseRepeatEvery: 1,
        }),
      ).rejects.toThrow('INSERT into tpm_maintenance_plans returned no rows');
    });

    it('should generate a UUIDv7 for the new plan', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 42 }] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow()],
      });

      await service.createPlan(10, 5, {
        assetUuid: 'asset-uuid-001',
        name: 'Test Plan',
        baseWeekday: 0,
        baseRepeatEvery: 1,
      });

      // INSERT is the 3rd query call — params[0] is the uuid
      const insertParams = mockClient.query.mock.calls[2]?.[1] as unknown[];
      const uuid = insertParams?.[0] as string;
      expect(uuid).toBeDefined();
      expect(typeof uuid).toBe('string');
      expect(uuid.length).toBeGreaterThan(0);
    });
  });

  // =============================================================
  // updatePlan
  // =============================================================

  describe('updatePlan()', () => {
    it('should update with provided fields', async () => {
      // lockPlanByUuid (FOR UPDATE)
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow()],
      });
      // UPDATE RETURNING
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow({ name: 'Updated Name' })],
      });

      const result = await service.updatePlan(10, 5, 'plan-uuid-001', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should return existing plan when no fields provided', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow()],
      });

      const result = await service.updatePlan(10, 5, 'plan-uuid-001', {});

      expect(result.name).toBe('Wartungsplan P17');
      expect(mockClient.query).toHaveBeenCalledTimes(1); // Only the lock query
    });

    it('should use FOR UPDATE lock', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow()],
      });

      await service.updatePlan(10, 5, 'plan-uuid-001', { name: 'X' });

      const lockSql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(lockSql).toContain('FOR UPDATE');
    });

    it('should throw NotFoundException when plan not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.updatePlan(10, 5, 'nonexistent', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should call activity logger after successful update', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow({ name: 'Updated' })],
      });

      await service.updatePlan(10, 5, 'plan-uuid-001', { name: 'Updated' });

      expect(mockActivityLogger.logUpdate).toHaveBeenCalledWith(
        10,
        5,
        'tpm_plan',
        42,
        expect.any(String),
        expect.objectContaining({ planUuid: 'plan-uuid-001' }),
        expect.any(Object),
      );
    });

    it('should build dynamic SET clause with multiple fields', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createPlanRow({
            name: 'New Name',
            base_weekday: 4,
            notes: 'New notes',
          }),
        ],
      });

      await service.updatePlan(10, 5, 'plan-uuid-001', {
        name: 'New Name',
        baseWeekday: 4,
        notes: 'New notes',
      });

      const updateSql = mockClient.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain('name = $1');
      expect(updateSql).toContain('base_weekday = $2');
      expect(updateSql).toContain('notes = $3');
    });
  });

  // =============================================================
  // deletePlan
  // =============================================================

  describe('deletePlan()', () => {
    it(`should soft-delete a plan (is_active = ${IS_ACTIVE.DELETED})`, async () => {
      // lockPlanByUuid
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow()],
      });
      // UPDATE is_active = 4
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.deletePlan(10, 5, 'plan-uuid-001')).resolves.toBeUndefined();

      const deleteSql = mockClient.query.mock.calls[1]?.[0] as string;
      expect(deleteSql).toContain(`is_active = ${IS_ACTIVE.DELETED}`);
    });

    it('should throw NotFoundException when plan not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.deletePlan(10, 5, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should call activity logger after successful deletion', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow()],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.deletePlan(10, 5, 'plan-uuid-001');

      expect(mockActivityLogger.logDelete).toHaveBeenCalledWith(
        10,
        5,
        'tpm_plan',
        42,
        expect.stringContaining('Wartungsplan P17'),
        expect.objectContaining({ planUuid: 'plan-uuid-001' }),
      );
    });
  });
});
