/**
 * Unit tests for ApprovalsConfigService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: CRUD for approval_configs, duplicate detection,
 *        soft-delete with NotFoundException, dynamic approver resolution
 *        via UNION ALL query, NULL filtering.
 *
 * Uses DatabaseService.tenantTransaction with mockClient pattern (ADR-019).
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { ApprovalsConfigService } from './approvals-config.service.js';
import type { ApprovalConfigRow } from './approvals.types.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('mock-uuid-v7'),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { tenantTransaction: vi.fn() };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockActivityLogger() {
  return {
    logCreate: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined),
    logDelete: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue(undefined),
  };
}

type ConfigRowWithName = ApprovalConfigRow & {
  approver_user_name: string | null;
};

/** Standard config row — matches DB shape */
function makeConfigRow(overrides: Partial<ConfigRowWithName> = {}): ConfigRowWithName {
  return {
    id: 1,
    uuid: 'cfg-uuid-001',
    tenant_id: 10,
    addon_code: 'vacation',
    approver_type: 'team_lead',
    approver_user_id: null,
    approver_user_name: null,
    is_active: 1,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

// =============================================================
// ApprovalsConfigService
// =============================================================

describe('ApprovalsConfigService', () => {
  let service: ApprovalsConfigService;
  let mockDb: MockDb;
  let mockClient: { query: ReturnType<typeof vi.fn> };
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;

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

    service = new ApprovalsConfigService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // getConfigs
  // =============================================================

  describe('getConfigs', () => {
    it('should return mapped configs', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          makeConfigRow({ addon_code: 'vacation', approver_type: 'team_lead' }),
          makeConfigRow({
            id: 2,
            uuid: 'cfg-uuid-002',
            addon_code: 'vacation',
            approver_type: 'user',
            approver_user_id: 42,
            approver_user_name: 'Max Mustermann',
          }),
        ],
      });

      const result = await service.getConfigs();

      expect(result).toHaveLength(2);
      expect(result[0]?.addonCode).toBe('vacation');
      expect(result[0]?.approverType).toBe('team_lead');
      expect(result[0]?.approverUserId).toBeNull();
      expect(result[1]?.approverType).toBe('user');
      expect(result[1]?.approverUserId).toBe(42);
      expect(result[1]?.approverUserName).toBe('Max Mustermann');
    });

    it('should return empty array when no configs exist', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getConfigs();

      expect(result).toEqual([]);
    });

    it('should map uuid with trimmed whitespace', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [makeConfigRow({ uuid: '  cfg-uuid-padded  ' })],
      });

      const result = await service.getConfigs();

      expect(result[0]?.uuid).toBe('cfg-uuid-padded');
    });

    it('should map createdAt from row', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [makeConfigRow({ created_at: '2026-03-01T12:00:00Z' })],
      });

      const result = await service.getConfigs();

      expect(result[0]?.createdAt).toBe('2026-03-01T12:00:00Z');
    });

    it('should default approverUserName to null when not joined', async () => {
      const row = makeConfigRow();
      delete (row as Partial<ConfigRowWithName>).approver_user_name;

      mockClient.query.mockResolvedValueOnce({ rows: [row] });

      const result = await service.getConfigs();

      expect(result[0]?.approverUserName).toBeNull();
    });

    it('should call tenantTransaction exactly once', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.getConfigs();

      expect(mockDb.tenantTransaction).toHaveBeenCalledTimes(1);
    });
  });

  // =============================================================
  // createConfig
  // =============================================================

  describe('createConfig', () => {
    const baseDto = {
      addonCode: 'vacation',
      approverType: 'team_lead' as const,
      approverUserId: undefined,
    };

    it('should create and return mapped config', async () => {
      // Duplicate check — no existing
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // INSERT RETURNING
      mockClient.query.mockResolvedValueOnce({
        rows: [
          makeConfigRow({
            uuid: 'mock-uuid-v7',
            addon_code: 'vacation',
            approver_type: 'team_lead',
          }),
        ],
      });

      const result = await service.createConfig(baseDto, 10, 1);

      expect(result.uuid).toBe('mock-uuid-v7');
      expect(result.addonCode).toBe('vacation');
      expect(result.approverType).toBe('team_lead');
    });

    it('should throw ConflictException on duplicate config', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ uuid: 'existing-uuid' }],
      });

      await expect(service.createConfig(baseDto, 10, 1)).rejects.toThrow(ConflictException);
    });

    it('should include addon_code and approver_type in ConflictException message', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ uuid: 'existing-uuid' }],
      });

      await expect(service.createConfig(baseDto, 10, 1)).rejects.toThrow(ConflictException);
    });

    it('should create config with approverUserId for user type', async () => {
      const userDto = {
        addonCode: 'vacation',
        approverType: 'user' as const,
        approverUserId: 42,
      };

      // Duplicate check
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // INSERT RETURNING
      mockClient.query.mockResolvedValueOnce({
        rows: [
          makeConfigRow({
            uuid: 'mock-uuid-v7',
            approver_type: 'user',
            approver_user_id: 42,
            approver_user_name: 'Max Mustermann',
          }),
        ],
      });

      const result = await service.createConfig(userDto, 10, 1);

      expect(result.approverUserId).toBe(42);
      expect(result.approverUserName).toBe('Max Mustermann');
    });

    it('should pass null for approverUserId when undefined', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({
        rows: [makeConfigRow({ uuid: 'mock-uuid-v7' })],
      });

      await service.createConfig(baseDto, 10, 1);

      // INSERT query is 2nd call — params array is 2nd arg
      const insertCall = mockClient.query.mock.calls[1] as [string, unknown[]];
      const params = insertCall[1];
      // $5 = approverUserId ?? null
      expect(params[4]).toBeNull();
    });

    it('should use COALESCE(approverUserId, 0) for duplicate check', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({
        rows: [makeConfigRow({ uuid: 'mock-uuid-v7' })],
      });

      await service.createConfig(baseDto, 10, 1);

      const selectCall = mockClient.query.mock.calls[0] as [string, unknown[]];
      const params = selectCall[1];
      // $4 = coalesceUserId = dto.approverUserId ?? 0
      expect(params[3]).toBe(0);
    });

    it('should log activity after successful creation', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({
        rows: [makeConfigRow({ id: 77, uuid: 'mock-uuid-v7' })],
      });

      await service.createConfig(baseDto, 10, 1);

      expect(mockActivityLogger.logCreate).toHaveBeenCalledWith(
        10,
        1,
        'approval_config',
        77,
        expect.stringContaining('team_lead'),
        expect.objectContaining({
          addonCode: 'vacation',
          approverType: 'team_lead',
        }),
      );
    });

    it('should throw Error when INSERT returns no rows', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.createConfig(baseDto, 10, 1)).rejects.toThrow('Insert returned no rows');
    });

    it('should generate uuid via uuidv7', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({
        rows: [makeConfigRow({ uuid: 'mock-uuid-v7' })],
      });

      await service.createConfig(baseDto, 10, 1);

      const insertCall = mockClient.query.mock.calls[1] as [string, unknown[]];
      const params = insertCall[1];
      expect(params[0]).toBe('mock-uuid-v7');
    });
  });

  // =============================================================
  // deleteConfig
  // =============================================================

  describe('deleteConfig', () => {
    it('should soft-delete successfully', async () => {
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

      await expect(service.deleteConfig('cfg-uuid-001', 10, 1)).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when config not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 });

      await expect(service.deleteConfig('nonexistent-uuid', 10, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException with descriptive message', async () => {
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 });

      await expect(service.deleteConfig('nonexistent-uuid', 10, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle null rowCount as 0', async () => {
      mockClient.query.mockResolvedValueOnce({ rowCount: null });

      await expect(service.deleteConfig('cfg-uuid-001', 10, 1)).rejects.toThrow(NotFoundException);
    });

    it('should log activity after successful deletion', async () => {
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

      await service.deleteConfig('cfg-uuid-001', 10, 1);

      expect(mockActivityLogger.logDelete).toHaveBeenCalledWith(
        10,
        1,
        'approval_config',
        0,
        expect.stringContaining('cfg-uuid-001'),
        expect.objectContaining({ uuid: 'cfg-uuid-001' }),
      );
    });

    it('should NOT log activity when config not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 });

      await service.deleteConfig('nonexistent-uuid', 10, 1).catch(() => {
        // expected NotFoundException
      });

      expect(mockActivityLogger.logDelete).not.toHaveBeenCalled();
    });
  });

  // =============================================================
  // resolveApprovers
  // =============================================================

  describe('resolveApprovers', () => {
    it('should return user IDs from UNION ALL query', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ approver_id: 10 }, { approver_id: 20 }, { approver_id: 30 }],
      });

      const result = await service.resolveApprovers('vacation', 5);

      expect(result).toEqual([10, 20, 30]);
    });

    it('should return empty array when no config matches', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.resolveApprovers('nonexistent-addon', 5);

      expect(result).toEqual([]);
    });

    it('should pass addonCode and requestingUserId as query params', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.resolveApprovers('vacation', 42);

      const queryCall = mockClient.query.mock.calls[0] as [string, unknown[]];
      const params = queryCall[1];
      expect(params[0]).toBe('vacation');
      expect(params[1]).toBe(42);
    });

    it('should return distinct approver IDs (DB handles DISTINCT)', async () => {
      // DB returns already-distinct rows thanks to SELECT DISTINCT
      mockClient.query.mockResolvedValueOnce({
        rows: [{ approver_id: 10 }, { approver_id: 20 }],
      });

      const result = await service.resolveApprovers('vacation', 5);

      expect(result).toHaveLength(2);
      expect(new Set(result).size).toBe(2);
    });

    it('should handle single approver result', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ approver_id: 99 }],
      });

      const result = await service.resolveApprovers('kvp', 7);

      expect(result).toEqual([99]);
    });

    it('should call tenantTransaction exactly once', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.resolveApprovers('vacation', 5);

      expect(mockDb.tenantTransaction).toHaveBeenCalledTimes(1);
    });

    it('should use UNION ALL query with all four approver type subqueries', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.resolveApprovers('vacation', 5);

      const queryCall = mockClient.query.mock.calls[0] as [string, unknown[]];
      const sql = queryCall[0];
      expect(sql).toContain('UNION ALL');
      expect(sql).toContain("approver_type = 'user'");
      expect(sql).toContain("approver_type = 'team_lead'");
      expect(sql).toContain("approver_type = 'area_lead'");
      expect(sql).toContain("approver_type = 'department_lead'");
    });

    it('should filter out NULL approver_ids via WHERE clause', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.resolveApprovers('vacation', 5);

      const queryCall = mockClient.query.mock.calls[0] as [string, unknown[]];
      const sql = queryCall[0];
      expect(sql).toContain('WHERE approver_id IS NOT NULL');
    });
  });
});
