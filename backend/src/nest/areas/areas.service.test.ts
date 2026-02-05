/**
 * Unit tests for AreasService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: CRUD operations, dependency checking, force delete,
 *        stats aggregation, department assignment.
 *
 * NOTE: This service uses `execute()` from utils/db.js (legacy pattern).
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { execute } from '../../utils/db.js';
import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { AreaRow } from './areas.service.js';
import { AreasService } from './areas.service.js';
import type { CreateAreaDto } from './dto/create-area.dto.js';
import type { ListAreasQueryDto } from './dto/list-areas-query.dto.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('../../utils/db.js', () => ({
  execute: vi.fn(),
}));

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('mock-uuid-v7'),
}));

const mockExecute = vi.mocked(execute);

// =============================================================
// Mock factories
// =============================================================

function createMockActivityLogger() {
  return {
    logCreate: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined),
    logDelete: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue(undefined),
  };
}

/** Standard area row — all optional fields set to defaults */
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
    is_active: 1,
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
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockActivityLogger = createMockActivityLogger();
    service = new AreasService(
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // listAreas
  // =============================================================

  describe('listAreas', () => {
    it('should return mapped area responses', async () => {
      mockExecute.mockResolvedValueOnce([
        [makeAreaRow(), makeAreaRow({ id: 2, name: 'Warehouse' })],
        [],
      ]);

      const query = {} as unknown as ListAreasQueryDto;
      const result = await service.listAreas(10, query);

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('Main Building');
      expect(result[1]?.name).toBe('Warehouse');
    });
  });

  // =============================================================
  // getAreaById
  // =============================================================

  describe('getAreaById', () => {
    it('should throw NotFoundException when area not found', async () => {
      mockExecute.mockResolvedValueOnce([[], []]);

      await expect(service.getAreaById(999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return mapped area response', async () => {
      const row = makeAreaRow({
        area_lead_name: 'Max Mustermann',
        department_count: 3,
      });
      mockExecute.mockResolvedValueOnce([[row], []]);

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
      mockExecute.mockResolvedValueOnce([
        [{ total_areas: '5', active_areas: '3', total_capacity: '500' }],
        [],
      ]);
      mockExecute.mockResolvedValueOnce([
        [
          { type: 'building', count: '2' },
          { type: 'warehouse', count: '1' },
        ],
        [],
      ]);

      const result = await service.getAreaStats(10);

      expect(result.totalAreas).toBe(5);
      expect(result.activeAreas).toBe(3);
      expect(result.totalCapacity).toBe(500);
      expect(result.byType).toEqual({ building: 2, warehouse: 1 });
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
      mockExecute.mockResolvedValueOnce([[{ id: 5 }], []]);
      // getAreaById for return
      mockExecute.mockResolvedValueOnce([
        [makeAreaRow({ id: 5, name: 'New Area' })],
        [],
      ]);

      const dto = {
        name: 'New Area',
        type: 'production',
      } as unknown as CreateAreaDto;

      const result = await service.createArea(dto, 10, 1);

      expect(result.id).toBe(5);
      expect(mockActivityLogger.logCreate).toHaveBeenCalled();
    });
  });

  // =============================================================
  // deleteArea
  // =============================================================

  describe('deleteArea', () => {
    it('should throw NotFoundException when area not found', async () => {
      mockExecute.mockResolvedValueOnce([[], []]);

      await expect(service.deleteArea(999, 1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when has dependencies and force=false', async () => {
      // getAreaById
      mockExecute.mockResolvedValueOnce([[makeAreaRow()], []]);
      // checkAreaDependencies → 5 table checks (1 has data)
      for (let i = 0; i < 5; i++) {
        mockExecute.mockResolvedValueOnce([i === 0 ? [{ id: 1 }] : [], []]);
      }

      await expect(service.deleteArea(1, 1, 10, false)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete area with no dependencies', async () => {
      // getAreaById
      mockExecute.mockResolvedValueOnce([[makeAreaRow()], []]);
      // checkAreaDependencies → 5 table checks (all empty)
      for (let i = 0; i < 5; i++) {
        mockExecute.mockResolvedValueOnce([[], []]);
      }
      // DELETE FROM areas
      mockExecute.mockResolvedValueOnce([[], []]);

      const result = await service.deleteArea(1, 1, 10);

      expect(result.message).toBe('Area deleted successfully');
      expect(mockActivityLogger.logDelete).toHaveBeenCalled();
    });
  });

  // =============================================================
  // assignDepartmentsToArea
  // =============================================================

  describe('assignDepartmentsToArea', () => {
    it('should throw NotFoundException for unknown area', async () => {
      mockExecute.mockResolvedValueOnce([[], []]);

      await expect(
        service.assignDepartmentsToArea(999, [1, 2], 10),
      ).rejects.toThrow(NotFoundException);
    });

    it('should assign departments to area', async () => {
      // getAreaById
      mockExecute.mockResolvedValueOnce([[makeAreaRow()], []]);
      // Clear existing assignments
      mockExecute.mockResolvedValueOnce([[], []]);
      // Assign new departments
      mockExecute.mockResolvedValueOnce([[], []]);

      const result = await service.assignDepartmentsToArea(1, [10, 20], 10);

      expect(result.message).toBe('Departments assigned successfully');
    });
  });
});
