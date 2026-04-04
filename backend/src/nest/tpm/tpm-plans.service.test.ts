/**
 * Unit tests for TpmPlansService
 *
 * Mocked dependencies: DatabaseService (query, queryOne, tenantTransaction),
 * ActivityLoggerService (logCreate, logUpdate, logDelete), ScopeService (getScope).
 * Tests: getPlan, listPlans (full + scoped), getPlanByAssetId, createPlan (asset
 * resolution, uniqueness check, UUIDv7), updatePlan (dynamic SET, FOR UPDATE),
 * deletePlan (soft-delete), archivePlan, unarchivePlan,
 * getMyPermissions, getIntervalMatrix, getScopedOrgData.
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
import { detectChangedFields } from './tpm-plans.helpers.js';
import { TpmPlansService } from './tpm-plans.service.js';
import type { TpmMaintenancePlanRow } from './tpm.types.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  const qf = vi.fn();
  const qof = vi.fn();
  return {
    query: qf,
    tenantQuery: qf,
    queryOne: qof,
    tenantQueryOne: qof,
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
    buffer_hours: '4.0',
    notes: 'Wöchentliche Kontrolle',
    revision_number: 1,
    approval_version: 1,
    revision_minor: 0,
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
  // getMyPermissions
  // =============================================================

  describe('getMyPermissions()', () => {
    it('should return all-true for full-access users', async () => {
      const result = await service.getMyPermissions(1, true);

      expect(result.plans).toEqual({ canRead: true, canWrite: true, canDelete: true });
      expect(result.cards).toEqual({ canRead: true, canWrite: true, canDelete: true });
      expect(result.executions).toEqual({ canRead: true, canWrite: true });
      expect(result.config).toEqual({ canRead: true, canWrite: true });
      expect(result.locations).toEqual({ canRead: true, canWrite: true, canDelete: true });
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should map DB permission rows to structured permissions', async () => {
      mockDb.query.mockResolvedValueOnce([
        { module_code: 'tpm-plans', can_read: true, can_write: true, can_delete: false },
        { module_code: 'tpm-cards', can_read: true, can_write: false, can_delete: false },
        { module_code: 'tpm-executions', can_read: true, can_write: true, can_delete: false },
        { module_code: 'tpm-config', can_read: true, can_write: false, can_delete: false },
        { module_code: 'tpm-locations', can_read: true, can_write: true, can_delete: true },
      ]);

      const result = await service.getMyPermissions(5, false);

      expect(result.plans).toEqual({ canRead: true, canWrite: true, canDelete: false });
      expect(result.cards).toEqual({ canRead: true, canWrite: false, canDelete: false });
      expect(result.executions).toEqual({ canRead: true, canWrite: true });
      expect(result.config).toEqual({ canRead: true, canWrite: false });
      expect(result.locations).toEqual({ canRead: true, canWrite: true, canDelete: true });
    });

    it('should default to false for missing modules', async () => {
      mockDb.query.mockResolvedValueOnce([]); // no rows

      const result = await service.getMyPermissions(5, false);

      expect(result.plans).toEqual({ canRead: false, canWrite: false, canDelete: false });
      expect(result.cards).toEqual({ canRead: false, canWrite: false, canDelete: false });
      expect(result.executions).toEqual({ canRead: false, canWrite: false });
      expect(result.config).toEqual({ canRead: false, canWrite: false });
      expect(result.locations).toEqual({ canRead: false, canWrite: false, canDelete: false });
    });
  });

  // =============================================================
  // getIntervalMatrix
  // =============================================================

  describe('getIntervalMatrix()', () => {
    it('should return grouped card counts for full-access user', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          plan_uuid: 'plan-uuid-001',
          interval_type: 'weekly',
          card_count: '5',
          green_count: '3',
          red_count: '1',
          yellow_count: '1',
          overdue_count: '0',
        },
      ]);

      const result = await service.getIntervalMatrix(10, FULL_ACCESS_USER);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        planUuid: 'plan-uuid-001',
        intervalType: 'weekly',
        cardCount: 5,
        greenCount: 3,
        redCount: 1,
        yellowCount: 1,
        overdueCount: 0,
      });
    });

    it('should return empty array when no cards exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getIntervalMatrix(10, FULL_ACCESS_USER);

      expect(result).toEqual([]);
    });

    it('should apply scope filter for non-full-access user', async () => {
      mockScopeService.getScope.mockResolvedValueOnce({
        type: 'limited',
        teamIds: [1, 2],
      });
      mockDb.query.mockResolvedValueOnce([]);

      const scopedUser: NestAuthUser = { ...FULL_ACCESS_USER, hasFullAccess: false };
      await service.getIntervalMatrix(10, scopedUser);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('asset_teams');
      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toEqual([10, [1, 2]]);
    });
  });

  // =============================================================
  // getScopedOrgData
  // =============================================================

  describe('getScopedOrgData()', () => {
    it('should load all org data for full-access user', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 1, name: 'Bereich A', uuid: 'area-1' }]) // areas
        .mockResolvedValueOnce([{ id: 10, name: 'Abteilung X', uuid: 'dept-1', area_id: 1 }]) // depts
        .mockResolvedValueOnce([
          {
            id: 42,
            name: 'CNC-001',
            uuid: 'asset-1',
            department_id: 10,
            asset_number: 'A42',
            status: 'operational',
          },
        ]); // assets

      const result = await service.getScopedOrgData(10, FULL_ACCESS_USER);

      expect(result.areas).toHaveLength(1);
      expect(result.departments).toHaveLength(1);
      expect(result.departments[0]?.areaId).toBe(1);
      expect(result.assets).toHaveLength(1);
      expect(result.assets[0]?.departmentId).toBe(10);
    });

    it('should load scoped org data via asset_teams for non-full-access user', async () => {
      mockScopeService.getScope.mockResolvedValueOnce({
        type: 'limited',
        teamIds: [5],
      });
      const scopedUser: NestAuthUser = { ...FULL_ACCESS_USER, hasFullAccess: false };

      mockDb.query
        .mockResolvedValueOnce([
          {
            id: 42,
            name: 'CNC-001',
            uuid: 'asset-1',
            department_id: 10,
            asset_number: null,
            status: 'operational',
          },
        ]) // scoped assets
        .mockResolvedValueOnce([{ id: 10, name: 'Dept', uuid: 'dept-1', area_id: 1 }]) // depts
        .mockResolvedValueOnce([{ id: 1, name: 'Area', uuid: 'area-1' }]); // areas

      const result = await service.getScopedOrgData(10, scopedUser);

      expect(result.assets).toHaveLength(1);
      expect(result.departments).toHaveLength(1);
      expect(result.areas).toHaveLength(1);

      // First query should use asset_teams JOIN
      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('asset_teams');
    });

    it('should return empty departments and areas when no scoped assets exist', async () => {
      mockScopeService.getScope.mockResolvedValueOnce({
        type: 'limited',
        teamIds: [5],
      });
      const scopedUser: NestAuthUser = { ...FULL_ACCESS_USER, hasFullAccess: false };

      mockDb.query.mockResolvedValueOnce([]); // no scoped assets

      const result = await service.getScopedOrgData(10, scopedUser);

      expect(result.assets).toHaveLength(0);
      expect(result.departments).toHaveLength(0);
      expect(result.areas).toHaveLength(0);
      // Only 1 query (assets) — dept/area queries skipped due to empty array
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  // =============================================================
  // listPlans (scoped)
  // =============================================================

  describe('listPlans() — scoped', () => {
    it('should apply scope filter when user has limited access', async () => {
      mockScopeService.getScope.mockResolvedValueOnce({
        type: 'limited',
        teamIds: [3, 7],
      });
      const scopedUser: NestAuthUser = { ...FULL_ACCESS_USER, hasFullAccess: false };

      mockDb.queryOne.mockResolvedValueOnce({ count: '1' });
      mockDb.query.mockResolvedValueOnce([createPlanRow()]);

      await service.listPlans(10, 1, 20, scopedUser);

      // Count query should include scope clause
      const countSql = mockDb.queryOne.mock.calls[0]?.[0] as string;
      expect(countSql).toContain('asset_teams');
      const countParams = mockDb.queryOne.mock.calls[0]?.[1] as unknown[];
      expect(countParams).toEqual([10, [3, 7]]);

      // Data query should include scope clause
      const dataSql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(dataSql).toContain('asset_teams');
      const dataParams = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(dataParams).toEqual([10, 20, 0, [3, 7]]);
    });

    it('should fall back to user_teams when scope is none (non-lead employee)', async () => {
      mockScopeService.getScope.mockResolvedValueOnce({
        type: 'none',
        teamIds: [],
        areaIds: [],
        departmentIds: [],
      });
      const employee: NestAuthUser = {
        ...FULL_ACCESS_USER,
        id: 44,
        role: 'employee',
        hasFullAccess: false,
      };

      // 1st db.query: user_teams fallback
      mockDb.query.mockResolvedValueOnce([{ team_id: 10 }, { team_id: 15 }]);
      // 2nd: count query
      mockDb.queryOne.mockResolvedValueOnce({ count: '1' });
      // 3rd: data query
      mockDb.query.mockResolvedValueOnce([createPlanRow()]);

      await service.listPlans(10, 1, 20, employee);

      // First db.query call = user_teams fallback
      const teamsSql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(teamsSql).toContain('user_teams');
      expect(mockDb.query.mock.calls[0]?.[1]).toEqual([44, 10]);

      // Count + data queries should use the resolved team IDs [10, 15]
      const countParams = mockDb.queryOne.mock.calls[0]?.[1] as unknown[];
      expect(countParams).toEqual([10, [10, 15]]);

      const dataParams = mockDb.query.mock.calls[1]?.[1] as unknown[];
      expect(dataParams).toEqual([10, 20, 0, [10, 15]]);
    });
  });

  // =============================================================
  // archivePlan
  // =============================================================

  describe('archivePlan()', () => {
    it(`should set is_active = ${IS_ACTIVE.ARCHIVED}`, async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow()],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.archivePlan(10, 5, 'plan-uuid-001');

      expect(result.name).toBe('Wartungsplan P17');
      const archiveSql = mockClient.query.mock.calls[1]?.[0] as string;
      expect(archiveSql).toContain(`is_active = ${IS_ACTIVE.ARCHIVED}`);
    });

    it('should throw NotFoundException when plan not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.archivePlan(10, 5, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should call activity logger after archiving', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow()],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.archivePlan(10, 5, 'plan-uuid-001');

      expect(mockActivityLogger.logUpdate).toHaveBeenCalledWith(
        10,
        5,
        'tpm_plan',
        42,
        expect.stringContaining('archiviert'),
        expect.objectContaining({ planUuid: 'plan-uuid-001' }),
        expect.objectContaining({ isActive: 3 }),
      );
    });
  });

  // =============================================================
  // unarchivePlan
  // =============================================================

  describe('unarchivePlan()', () => {
    it('should restore an archived plan to active', async () => {
      // lockPlanByUuidAnyStatus
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow({ is_active: IS_ACTIVE.ARCHIVED })],
      });
      // ensureNoPlanForAsset → no conflict
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // UPDATE is_active = 1
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.unarchivePlan(10, 5, 'plan-uuid-001');

      expect(result.name).toBe('Wartungsplan P17');
      const updateSql = mockClient.query.mock.calls[2]?.[0] as string;
      expect(updateSql).toContain(`is_active = ${IS_ACTIVE.ACTIVE}`);
    });

    it('should throw ConflictException when plan is not archived', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow({ is_active: IS_ACTIVE.ACTIVE })],
      });

      await expect(service.unarchivePlan(10, 5, 'plan-uuid-001')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when another active plan exists for same asset', async () => {
      // lockPlanByUuidAnyStatus → archived plan
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow({ is_active: IS_ACTIVE.ARCHIVED })],
      });
      // ensureNoPlanForAsset → another active plan exists
      mockClient.query.mockResolvedValueOnce({
        rows: [{ uuid: 'other-plan' }],
      });

      await expect(service.unarchivePlan(10, 5, 'plan-uuid-001')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException when plan not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.unarchivePlan(10, 5, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should use FOR UPDATE lock that includes archived status', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow({ is_active: IS_ACTIVE.ARCHIVED })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.unarchivePlan(10, 5, 'plan-uuid-001');

      const lockSql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(lockSql).toContain('FOR UPDATE');
      expect(lockSql).toContain(`${IS_ACTIVE.ARCHIVED}`);
    });

    it('should call activity logger after unarchiving', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow({ is_active: IS_ACTIVE.ARCHIVED })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.unarchivePlan(10, 5, 'plan-uuid-001');

      expect(mockActivityLogger.logUpdate).toHaveBeenCalledWith(
        10,
        5,
        'tpm_plan',
        42,
        expect.stringContaining('wiederhergestellt'),
        expect.objectContaining({ planUuid: 'plan-uuid-001' }),
        expect.objectContaining({ isActive: 1 }),
      );
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

  // =============================================================
  // Revision History (Plan Revisions)
  // =============================================================

  describe('createPlan() — revision v1', () => {
    it('should create v1 revision entry alongside plan', async () => {
      // resolveAssetId
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 42 }],
      });
      // ensureNoPlanForAsset
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // INSERT plan
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow()],
      });
      // INSERT revision (v1)
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.createPlan(10, 5, {
        assetUuid: 'asset-uuid',
        name: 'Wartungsplan P17',
        baseWeekday: 3,
        baseRepeatEvery: 1,
      });

      // 4th call = revision INSERT
      const revisionCall = mockClient.query.mock.calls[3];
      const sql = revisionCall?.[0] as string;
      const params = revisionCall?.[1] as unknown[];

      expect(sql).toContain('tpm_plan_revisions');
      // [uuid, tenantId, planId, revNum, approvalVersion, revMinor, name, assetId, weekday, repeat, time, buffer, notes, changedBy, reason, fields]
      expect(params?.[3]).toBe(1); // revision_number = 1
      expect(params?.[4]).toBe(0); // approval_version = 0 (pending)
      expect(params?.[5]).toBe(0); // revision_minor = 0
      expect(params?.[6]).toBe('Wartungsplan P17'); // name snapshot
      expect(params?.[13]).toBe(5); // changed_by = userId
      expect(params?.[14]).toBe('Initial version'); // change_reason
    });
  });

  describe('updatePlan() — revision creation', () => {
    it('should create revision with correct changed_fields', async () => {
      // lockPlanByUuid
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow({ base_time: '08:00' })],
      });
      // UPDATE plan
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow({ base_time: '14:00', revision_number: 2 })],
      });
      // INSERT revision
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.updatePlan(10, 5, 'plan-uuid-001', {
        baseTime: '14:00',
      });

      // 3rd call = revision INSERT via insertRevisionSnapshot
      // Params: [uuid, tenantId, planId, revNum, approvalVersion, revMinor, name, assetId, weekday, repeat, time, buffer, notes, changedBy, reason, fields]
      const revisionCall = mockClient.query.mock.calls[2];
      const params = revisionCall?.[1] as unknown[];

      expect(params?.[3]).toBe(2); // revision_number
      expect(params?.[14]).toBeNull(); // changeReason not provided
      expect(params?.[15]).toEqual(['base_time']); // changed_fields
    });

    it('should increment revision_number on plan', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow({ revision_number: 3 })],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow({ revision_number: 4, name: 'New Name' })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.updatePlan(10, 5, 'plan-uuid-001', {
        name: 'New Name',
      });

      expect(result.revisionNumber).toBe(4);

      // Verify UPDATE SQL includes revision_number
      const updateCall = mockClient.query.mock.calls[1];
      const sql = updateCall?.[0] as string;
      expect(sql).toContain('revision_number');
    });

    it('should skip revision when no fields actually changed', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow({ name: 'Same Name' })],
      });

      const result = await service.updatePlan(10, 5, 'plan-uuid-001', {
        name: 'Same Name',
      });

      // Only 1 call: lockPlanByUuid. No UPDATE, no revision INSERT.
      expect(mockClient.query).toHaveBeenCalledTimes(1);
      expect(result.name).toBe('Same Name');
    });

    it('should include changeReason in revision when provided', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow({ name: 'Updated', revision_number: 2 })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.updatePlan(10, 5, 'plan-uuid-001', {
        name: 'Updated',
        changeReason: 'Schichtwechsel erfordert Anpassung',
      });

      const revisionCall = mockClient.query.mock.calls[2];
      const params = revisionCall?.[1] as unknown[];
      expect(params?.[14]).toBe('Schichtwechsel erfordert Anpassung');
    });

    it('should set changeReason to null when not provided', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createPlanRow({ name: 'Updated', revision_number: 2 })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.updatePlan(10, 5, 'plan-uuid-001', {
        name: 'Updated',
      });

      const revisionCall = mockClient.query.mock.calls[2];
      const params = revisionCall?.[1] as unknown[];
      expect(params?.[14]).toBeNull();
    });
  });

  // =============================================================
  // detectChangedFields (pure helper)
  // =============================================================

  describe('detectChangedFields()', () => {
    const baseRow: TpmMaintenancePlanRow = {
      id: 1,
      uuid: 'plan-uuid',
      tenant_id: 10,
      asset_id: 42,
      name: 'Plan A',
      base_weekday: 1,
      base_repeat_every: 1,
      base_time: '08:00',
      buffer_hours: '4.0',
      notes: 'Initial notes',
      revision_number: 1,
      created_by: 5,
      is_active: 1,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };

    it('should identify changed fields correctly', () => {
      const result = detectChangedFields(baseRow, {
        baseWeekday: 3,
        baseTime: '14:00',
      });

      expect(result).toEqual(['base_weekday', 'base_time']);
    });

    it('should ignore unchanged fields in partial update', () => {
      const result = detectChangedFields(baseRow, {
        name: 'Plan A', // same value
        baseWeekday: 3, // different
      });

      expect(result).toEqual(['base_weekday']);
      expect(result).not.toContain('name');
    });

    it('should return empty array when nothing changed', () => {
      const result = detectChangedFields(baseRow, {
        name: 'Plan A',
        baseWeekday: 1,
        notes: 'Initial notes',
      });

      expect(result).toEqual([]);
    });

    it('should handle null ↔ undefined as equivalent', () => {
      const rowWithNull: TpmMaintenancePlanRow = { ...baseRow, base_time: null };

      const result = detectChangedFields(rowWithNull, {
        baseTime: null,
      });

      expect(result).toEqual([]);
    });

    it('should detect buffer_hours change (string vs number comparison)', () => {
      const result = detectChangedFields(baseRow, {
        bufferHours: 6.5,
      });

      expect(result).toEqual(['buffer_hours']);
    });
  });
});
