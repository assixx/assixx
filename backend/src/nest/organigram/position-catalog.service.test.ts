/**
 * Unit tests for PositionCatalogService
 *
 * Focus: CRUD, system position protection, duplicate detection,
 * ensureSystemPositions idempotency, soft-delete.
 */
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { PositionCatalogService } from './position-catalog.service.js';
import type { PositionCatalogRow } from './position-catalog.types.js';

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
  return {
    query: vi.fn(),
    getUserId: vi.fn().mockReturnValue(1),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockActivityLogger() {
  return { log: vi.fn().mockResolvedValue(undefined) };
}

function makeRow(
  overrides: Partial<PositionCatalogRow> = {},
): PositionCatalogRow {
  return {
    id: 'pos-uuid-001',
    tenant_id: 10,
    name: 'Qualitätsmanager',
    role_category: 'employee',
    sort_order: 0,
    is_system: false,
    is_active: 1,
    created_at: '2026-03-20T10:00:00Z',
    updated_at: '2026-03-20T10:00:00Z',
    ...overrides,
  };
}

// =============================================================
// Tests
// =============================================================

describe('PositionCatalogService', () => {
  let service: PositionCatalogService;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    const mockActivityLogger = createMockActivityLogger();
    service = new PositionCatalogService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // ensureSystemPositions
  // =============================================================

  describe('ensureSystemPositions', () => {
    it('should insert system + default positions with ON CONFLICT DO NOTHING', async () => {
      mockDb.query.mockResolvedValue([]);

      await service.ensureSystemPositions(10);

      // 4 system + 18 defaults = 22
      expect(mockDb.query).toHaveBeenCalledTimes(22);
      const calls = mockDb.query.mock.calls;
      // All use ON CONFLICT with partial index predicate
      expect(calls[0]?.[0]).toContain('ON CONFLICT');
      expect(calls[0]?.[0]).toContain('WHERE is_active = 1');
      // System positions first (is_system = true)
      expect(calls[0]?.[1]).toEqual(
        expect.arrayContaining([10, 'team_lead', 'employee']),
      );
      expect(calls[1]?.[1]).toEqual(
        expect.arrayContaining([10, 'deputy_lead', 'employee']),
      );
      expect(calls[2]?.[1]).toEqual(
        expect.arrayContaining([10, 'area_lead', 'admin']),
      );
      expect(calls[3]?.[1]).toEqual(
        expect.arrayContaining([10, 'department_lead', 'admin']),
      );
      // Default positions after (is_system = false)
      expect(calls[4]?.[1]).toEqual(
        expect.arrayContaining([10, 'Produktionsmitarbeiter', 'employee']),
      );
    });
  });

  // =============================================================
  // getAll
  // =============================================================

  describe('getAll', () => {
    /** Mock 21 seed queries + 1 SELECT */
    function mockSeedThenSelect(selectResult: PositionCatalogRow[]): void {
      // 22 seed queries return empty (ON CONFLICT DO NOTHING)
      for (let i = 0; i < 22; i++) {
        mockDb.query.mockResolvedValueOnce([]);
      }
      // Final SELECT
      mockDb.query.mockResolvedValueOnce(selectResult);
    }

    it('should call ensureSystemPositions then return mapped entries', async () => {
      mockSeedThenSelect([makeRow()]);

      const result = await service.getAll(10);

      expect(mockDb.query).toHaveBeenCalledTimes(23);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Qualitätsmanager');
      expect(result[0]?.roleCategory).toBe('employee');
    });

    it('should filter by roleCategory when provided', async () => {
      mockSeedThenSelect([makeRow({ role_category: 'admin' })]);

      await service.getAll(10, 'admin');

      const selectCall = mockDb.query.mock.calls[22];
      expect(selectCall?.[0]).toContain('AND role_category = $3');
      expect(selectCall?.[1]).toContain('admin');
    });

    it('should return empty array when no positions exist', async () => {
      mockSeedThenSelect([]);

      const result = await service.getAll(10);

      expect(result).toEqual([]);
    });
  });

  // =============================================================
  // create
  // =============================================================

  describe('create', () => {
    it('should create a position and return mapped entry', async () => {
      // assertNameUnique: no duplicate
      mockDb.query.mockResolvedValueOnce([]);
      // INSERT RETURNING
      mockDb.query.mockResolvedValueOnce([makeRow({ name: 'Schichtführer' })]);

      const result = await service.create(10, {
        name: 'Schichtführer',
        roleCategory: 'employee',
        sortOrder: 0,
      });

      expect(result.name).toBe('Schichtführer');
      expect(result.isSystem).toBe(false);
    });

    it('should throw ConflictException on duplicate name', async () => {
      mockDb.query.mockResolvedValueOnce([makeRow()]); // duplicate found

      await expect(
        service.create(10, {
          name: 'Qualitätsmanager',
          roleCategory: 'employee',
          sortOrder: 0,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // =============================================================
  // update
  // =============================================================

  describe('update', () => {
    it('should update name and sortOrder', async () => {
      // findOneOrFail
      mockDb.query.mockResolvedValueOnce([makeRow()]);
      // assertNameUnique
      mockDb.query.mockResolvedValueOnce([]);
      // UPDATE RETURNING
      mockDb.query.mockResolvedValueOnce([
        makeRow({ name: 'Neuer Name', sort_order: 5 }),
      ]);

      const result = await service.update(10, 'pos-uuid-001', {
        name: 'Neuer Name',
        sortOrder: 5,
      });

      expect(result.name).toBe('Neuer Name');
      expect(result.sortOrder).toBe(5);
    });

    it('should throw ForbiddenException for system positions', async () => {
      mockDb.query.mockResolvedValueOnce([makeRow({ is_system: true })]);

      await expect(
        service.update(10, 'pos-uuid-001', { name: 'Renamed' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException on duplicate name during update', async () => {
      mockDb.query.mockResolvedValueOnce([makeRow()]);
      // assertNameUnique finds duplicate
      mockDb.query.mockResolvedValueOnce([makeRow({ id: 'other-uuid' })]);

      await expect(
        service.update(10, 'pos-uuid-001', { name: 'Duplicate' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should return unchanged entry when no fields provided', async () => {
      mockDb.query.mockResolvedValueOnce([makeRow()]);

      const result = await service.update(10, 'pos-uuid-001', {});

      expect(result.name).toBe('Qualitätsmanager');
      // No UPDATE query should have been executed (only findOneOrFail)
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when position does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.update(10, 'nonexistent', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =============================================================
  // delete
  // =============================================================

  describe('delete', () => {
    it('should soft-delete a custom position', async () => {
      mockDb.query.mockResolvedValueOnce([makeRow()]); // findOneOrFail
      mockDb.query.mockResolvedValueOnce([]); // UPDATE is_active

      await service.delete(10, 'pos-uuid-001');

      const updateCall = mockDb.query.mock.calls[1];
      expect(updateCall?.[0]).toContain('is_active = $1');
      expect(updateCall?.[1]?.[0]).toBe(4); // IS_ACTIVE.DELETED
    });

    it('should throw ForbiddenException for system positions', async () => {
      mockDb.query.mockResolvedValueOnce([makeRow({ is_system: true })]);

      await expect(service.delete(10, 'pos-uuid-001')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when position does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.delete(10, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
