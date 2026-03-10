/**
 * Unit tests for AreasService
 *
 * Phase 11: Service tests -- mocked dependencies.
 * Phase 14 B5: Deepened from 11 -> 28 tests.
 * Focus: CRUD operations, dependency checking, force delete,
 *        stats aggregation, department assignment, private helpers.
 *
 * Uses DatabaseService mock (migrated from legacy execute pattern).
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { AreaRow } from './areas.service.js';
import { AreasService } from './areas.service.js';
import type { CreateAreaDto } from './dto/create-area.dto.js';
import type { ListAreasQueryDto } from './dto/list-areas-query.dto.js';
import type { UpdateAreaDto } from './dto/update-area.dto.js';

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
    log: vi.fn().mockResolvedValue(undefined),
  };
}

/** Standard area row -- all optional fields set to defaults */
function makeAreaRow(overrides: Partial<AreaRow> = {}): AreaRow {
  return {
    id: 1,
    tenant_id: 10,
    name: 'Main Building',
    description: null,
    area_lead_id: null,
    type: 'building',
    capacity: null,
    address: null,
    is_active: IS_ACTIVE.ACTIVE,
    created_by: 1,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
    area_lead_name: null,
    employee_count: 0,
    department_count: 0,
    department_names: null,
    ...overrides,
  } as AreaRow;
}

// =============================================================
// AreasService
// =============================================================

describe('AreasService', () => {
  let service: AreasService;
  let mockDb: MockDb;
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;

  /** Mock 5 dependency checks all returning empty */
  function mockNoDependencies(): void {
    for (let i = 0; i < 6; i++) {
      mockDb.query.mockResolvedValueOnce([]);
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockActivityLogger = createMockActivityLogger();
    service = new AreasService(
      mockActivityLogger as unknown as ActivityLoggerService,
      mockDb as unknown as DatabaseService,
    );
  });

  // =============================================================
  // listAreas
  // =============================================================

  describe('listAreas', () => {
    it('should return mapped area responses', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeAreaRow(),
        makeAreaRow({ id: 2, name: 'Warehouse' }),
      ]);

      const query = {} as unknown as ListAreasQueryDto;
      const result = await service.listAreas(10, query);

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('Main Building');
      expect(result[1]?.name).toBe('Warehouse');
    });

    it('should return empty array when no areas', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.listAreas(10, {} as ListAreasQueryDto);

      expect(result).toHaveLength(0);
    });

    it('should apply type filter via buildFilteredQuery', async () => {
      mockDb.query.mockResolvedValueOnce([makeAreaRow({ type: 'warehouse' })]);

      const query = { type: 'warehouse' } as unknown as ListAreasQueryDto;
      await service.listAreas(10, query);

      const callArgs = mockDb.query.mock.calls[0];
      expect(callArgs?.[1]).toEqual([10, 'warehouse']);
    });

    it('should apply search filter via buildFilteredQuery', async () => {
      mockDb.query.mockResolvedValueOnce([makeAreaRow()]);

      const query = { search: 'Main' } as unknown as ListAreasQueryDto;
      await service.listAreas(10, query);

      const callArgs = mockDb.query.mock.calls[0];
      expect(callArgs?.[1]).toEqual([10, '%Main%', '%Main%']);
    });
  });

  // =============================================================
  // getAreaById
  // =============================================================

  describe('getAreaById', () => {
    it('should throw NotFoundException when area not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getAreaById(999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return mapped area response', async () => {
      const row = makeAreaRow({
        area_lead_name: 'Max Mustermann',
        department_count: 3,
      });
      mockDb.query.mockResolvedValueOnce([row]);

      const result = await service.getAreaById(1, 10);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Main Building');
      expect(result.type).toBe('building');
      expect(result.areaLeadName).toBe('Max Mustermann');
      expect(result.departmentCount).toBe(3);
    });
  });

  // =============================================================
  // getAreaStats
  // =============================================================

  describe('getAreaStats', () => {
    it('should return aggregated statistics', async () => {
      // stats query + type breakdown (Promise.all)
      mockDb.query.mockResolvedValueOnce([
        { total_areas: '5', active_areas: '3', total_capacity: '500' },
      ]);
      mockDb.query.mockResolvedValueOnce([
        { type: 'building', count: '2' },
        { type: 'warehouse', count: '1' },
      ]);

      const result = await service.getAreaStats(10);

      expect(result.totalAreas).toBe(5);
      expect(result.activeAreas).toBe(3);
      expect(result.totalCapacity).toBe(500);
      expect(result.byType).toEqual({ building: 2, warehouse: 1 });
    });

    it('should default to 0 when stats row is empty', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getAreaStats(10);

      expect(result.totalAreas).toBe(0);
      expect(result.activeAreas).toBe(0);
      expect(result.totalCapacity).toBe(0);
      expect(result.byType).toEqual({});
    });
  });

  // =============================================================
  // createArea
  // =============================================================

  describe('createArea', () => {
    it('should throw BadRequestException for empty name', async () => {
      const dto = {
        name: '  ',
        type: 'building',
      } as unknown as CreateAreaDto;

      await expect(service.createArea(dto, 10, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create area and log activity', async () => {
      // INSERT RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]);
      // getAreaById for return
      mockDb.query.mockResolvedValueOnce([
        makeAreaRow({ id: 5, name: 'New Area' }),
      ]);

      const dto = {
        name: 'New Area',
        type: 'production',
      } as unknown as CreateAreaDto;

      const result = await service.createArea(dto, 10, 1);

      expect(result.id).toBe(5);
      expect(mockActivityLogger.logCreate).toHaveBeenCalled();
    });

    it('should throw Error when INSERT returns empty', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const dto = {
        name: 'Fail Area',
        type: 'office',
      } as unknown as CreateAreaDto;

      await expect(service.createArea(dto, 10, 1)).rejects.toThrow(
        'Failed to create area',
      );
    });
  });

  // =============================================================
  // updateArea
  // =============================================================

  describe('updateArea', () => {
    it('should update area with fields and log activity', async () => {
      // getAreaById (existing check)
      mockDb.query.mockResolvedValueOnce([makeAreaRow()]);
      // UPDATE areas
      mockDb.query.mockResolvedValueOnce([]);
      // getAreaById (return updated)
      mockDb.query.mockResolvedValueOnce([
        makeAreaRow({ name: 'Updated Building' }),
      ]);

      const dto = { name: 'Updated Building' } as UpdateAreaDto;
      const result = await service.updateArea(1, dto, 1, 10);

      expect(result.name).toBe('Updated Building');
      expect(mockActivityLogger.logUpdate).toHaveBeenCalled();
    });

    it('should skip UPDATE when no fields changed', async () => {
      // getAreaById (existing check)
      mockDb.query.mockResolvedValueOnce([makeAreaRow()]);
      // getAreaById (return -- no UPDATE executed)
      mockDb.query.mockResolvedValueOnce([makeAreaRow()]);

      const dto = {} as UpdateAreaDto;
      const result = await service.updateArea(1, dto, 1, 10);

      expect(result.id).toBe(1);
      // Only 2 query calls (2x getAreaById, no UPDATE)
      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockActivityLogger.logUpdate).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent area', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const dto = { name: 'X' } as UpdateAreaDto;

      await expect(service.updateArea(999, dto, 1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =============================================================
  // deleteArea
  // =============================================================

  describe('deleteArea', () => {
    it('should throw NotFoundException when area not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.deleteArea(999, 1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when has dependencies and force=false', async () => {
      // getAreaById
      mockDb.query.mockResolvedValueOnce([makeAreaRow()]);
      // checkAreaDependencies -> 6 table checks (1 has data)
      for (let i = 0; i < 6; i++) {
        mockDb.query.mockResolvedValueOnce(i === 0 ? [{ id: 1 }] : []);
      }

      await expect(service.deleteArea(1, 1, 10, false)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete area with no dependencies', async () => {
      // getAreaById
      mockDb.query.mockResolvedValueOnce([makeAreaRow()]);
      // checkAreaDependencies -> 5 table checks (all empty)
      mockNoDependencies();
      // DELETE FROM areas
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.deleteArea(1, 1, 10);

      expect(result.message).toBe('Area deleted successfully');
      expect(mockActivityLogger.logDelete).toHaveBeenCalled();
    });

    it('should force-delete area removing dependencies first', async () => {
      // getAreaById
      mockDb.query.mockResolvedValueOnce([makeAreaRow()]);
      // checkAreaDependencies -> departments=2, halls=0, assets=1, rest empty
      mockDb.query.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]); // departments
      mockDb.query.mockResolvedValueOnce([]); // halls
      mockDb.query.mockResolvedValueOnce([{ id: 3 }]); // assets
      mockDb.query.mockResolvedValueOnce([]); // shifts
      mockDb.query.mockResolvedValueOnce([]); // shift_plans
      mockDb.query.mockResolvedValueOnce([]); // shift_favorites
      // removeAreaDependencies -> UPDATE departments, UPDATE assets (2 calls)
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);
      // DELETE FROM areas
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.deleteArea(1, 1, 10, true);

      expect(result.message).toBe('Area deleted successfully');
      expect(mockActivityLogger.logDelete).toHaveBeenCalled();
    });

    it('should force-delete including shift_favorites DELETE strategy', async () => {
      // getAreaById
      mockDb.query.mockResolvedValueOnce([makeAreaRow()]);
      // checkAreaDependencies -> only shiftFavorites=1
      mockDb.query.mockResolvedValueOnce([]); // departments
      mockDb.query.mockResolvedValueOnce([]); // halls
      mockDb.query.mockResolvedValueOnce([]); // assets
      mockDb.query.mockResolvedValueOnce([]); // shifts
      mockDb.query.mockResolvedValueOnce([]); // shift_plans
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]); // shift_favorites
      // removeAreaDependencies -> DELETE shift_favorites
      mockDb.query.mockResolvedValueOnce([]);
      // DELETE FROM areas
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.deleteArea(1, 1, 10, true);

      expect(result.message).toBe('Area deleted successfully');
    });
  });

  // =============================================================
  // assignDepartmentsToArea
  // =============================================================

  describe('assignDepartmentsToArea', () => {
    it('should throw NotFoundException for unknown area', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.assignDepartmentsToArea(999, [1, 2], 10),
      ).rejects.toThrow(NotFoundException);
    });

    it('should assign departments to area', async () => {
      // getAreaById
      mockDb.query.mockResolvedValueOnce([makeAreaRow()]);
      // Clear existing assignments
      mockDb.query.mockResolvedValueOnce([]);
      // Assign new departments
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.assignDepartmentsToArea(1, [10, 20], 10);

      expect(result.message).toBe('Departments assigned successfully');
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });

    it('should only clear assignments when departmentIds is empty', async () => {
      // getAreaById
      mockDb.query.mockResolvedValueOnce([makeAreaRow()]);
      // Clear existing assignments
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.assignDepartmentsToArea(1, [], 10);

      expect(result.message).toBe('Departments assigned successfully');
      // Only 2 calls: getAreaById + clear (no assign)
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  // =============================================================
  // Private helpers
  // =============================================================

  describe('mapToResponse (private)', () => {
    it('should convert null optional fields to undefined', () => {
      const row = makeAreaRow();
      const result = service['mapToResponse'](row);

      expect(result.description).toBeUndefined();
      expect(result.areaLeadId).toBeUndefined();
      expect(result.areaLeadName).toBeUndefined();
      expect(result.capacity).toBeUndefined();
      expect(result.address).toBeUndefined();
      expect(result.departmentNames).toBeUndefined();
    });

    it('should preserve values when all optional fields are set', () => {
      const row = makeAreaRow({
        description: 'A big building',
        area_lead_id: 5,
        area_lead_name: 'Anna Smith',
        capacity: 200,
        address: '123 Main St',
        department_names: 'Dept A, Dept B',
      });
      const result = service['mapToResponse'](row);

      expect(result.description).toBe('A big building');
      expect(result.areaLeadId).toBe(5);
      expect(result.areaLeadName).toBe('Anna Smith');
      expect(result.capacity).toBe(200);
      expect(result.address).toBe('123 Main St');
      expect(result.departmentNames).toBe('Dept A, Dept B');
    });
  });

  describe('buildFilteredQuery (private)', () => {
    it('should return empty clause for no filters', () => {
      const result = service['buildFilteredQuery']({} as ListAreasQueryDto);

      expect(result.whereClause).toBe('');
      expect(result.params).toHaveLength(0);
    });

    it('should add type filter', () => {
      const result = service['buildFilteredQuery']({
        type: 'office',
      } as ListAreasQueryDto);

      expect(result.whereClause).toContain('a.type = $2');
      expect(result.params).toEqual(['office']);
    });

    it('should add search filter with ILIKE', () => {
      const result = service['buildFilteredQuery']({
        search: 'hall',
      } as ListAreasQueryDto);

      expect(result.whereClause).toContain('ILIKE');
      expect(result.params).toEqual(['%hall%', '%hall%']);
    });

    it('should combine type and search filters', () => {
      const result = service['buildFilteredQuery']({
        type: 'warehouse',
        search: 'big',
      } as ListAreasQueryDto);

      expect(result.whereClause).toContain('a.type = $2');
      expect(result.whereClause).toContain('ILIKE');
      expect(result.params).toEqual(['warehouse', '%big%', '%big%']);
    });
  });

  describe('buildUpdateFields (private)', () => {
    it('should build fields for multiple DTO keys', () => {
      const dto = {
        name: 'New Name',
        capacity: 100,
        isActive: 0,
      } as UpdateAreaDto;

      const result = service['buildUpdateFields'](dto);

      expect(result.fields).toHaveLength(3);
      expect(result.values).toEqual(['New Name', 100, 0]);
    });

    it('should return empty for undefined-only DTO', () => {
      const dto = {} as UpdateAreaDto;
      const result = service['buildUpdateFields'](dto);

      expect(result.fields).toHaveLength(0);
      expect(result.values).toHaveLength(0);
    });
  });
});
