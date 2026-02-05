/**
 * Unit tests for DepartmentsService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: CRUD operations, dependency checking, force delete,
 *        member listing, stats aggregation.
 *
 * NOTE: This service uses `execute()` from utils/db.js (legacy pattern).
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { execute } from '../../utils/db.js';
import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DepartmentRow } from './departments.service.js';
import { DepartmentsService } from './departments.service.js';
import type { CreateDepartmentDto } from './dto/create-department.dto.js';
import type { UpdateDepartmentDto } from './dto/update-department.dto.js';

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

/** Standard department row — all optional fields set to defaults */
function makeDeptRow(overrides: Partial<DepartmentRow> = {}): DepartmentRow {
  return {
    id: 1,
    name: 'Engineering',
    description: null,
    department_lead_id: null,
    area_id: null,
    is_active: 1,
    tenant_id: 10,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
    department_lead_name: undefined,
    areaName: undefined,
    employee_count: undefined,
    employee_names: undefined,
    team_count: undefined,
    team_names: undefined,
    ...overrides,
  } as DepartmentRow;
}

// =============================================================
// DepartmentsService
// =============================================================

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockActivityLogger = createMockActivityLogger();
    service = new DepartmentsService(
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // listDepartments
  // =============================================================

  describe('listDepartments', () => {
    it('should return mapped department responses', async () => {
      mockExecute.mockResolvedValueOnce([
        [makeDeptRow(), makeDeptRow({ id: 2, name: 'QA' })],
        [],
      ]);

      const result = await service.listDepartments(10);

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('Engineering');
      expect(result[1]?.name).toBe('QA');
    });

    it('should fall back to simple query on error', async () => {
      // Extended query fails
      mockExecute.mockRejectedValueOnce(new Error('Complex query failed'));
      // Simple fallback query succeeds
      mockExecute.mockResolvedValueOnce([[makeDeptRow()], []]);

      const result = await service.listDepartments(10);

      expect(result).toHaveLength(1);
    });
  });

  // =============================================================
  // getDepartmentById
  // =============================================================

  describe('getDepartmentById', () => {
    it('should throw NotFoundException when department not found', async () => {
      mockExecute.mockResolvedValueOnce([[], []]);

      await expect(service.getDepartmentById(999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return mapped response', async () => {
      const row = makeDeptRow({
        department_lead_name: 'Max Mustermann',
        employee_count: 5,
      });
      mockExecute.mockResolvedValueOnce([[row], []]);

      const result = await service.getDepartmentById(1, 10);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Engineering');
      expect(result.departmentLeadName).toBe('Max Mustermann');
      expect(result.employeeCount).toBe(5);
    });
  });

  // =============================================================
  // createDepartment
  // =============================================================

  describe('createDepartment', () => {
    it('should throw BadRequestException for empty name', async () => {
      const dto = {
        name: '  ',
        description: null,
        departmentLeadId: null,
        areaId: null,
      } as unknown as CreateDepartmentDto;

      await expect(service.createDepartment(dto, 1, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create department and log activity', async () => {
      // INSERT RETURNING id
      mockExecute.mockResolvedValueOnce([[{ id: 5 }], []]);
      // getDepartmentById for return
      mockExecute.mockResolvedValueOnce([
        [makeDeptRow({ id: 5, name: 'New Dept' })],
        [],
      ]);

      const dto = {
        name: 'New Dept',
        description: null,
        departmentLeadId: null,
        areaId: null,
      } as unknown as CreateDepartmentDto;

      const result = await service.createDepartment(dto, 1, 10);

      expect(result.id).toBe(5);
      expect(mockActivityLogger.logCreate).toHaveBeenCalled();
    });
  });

  // =============================================================
  // updateDepartment
  // =============================================================

  describe('updateDepartment', () => {
    it('should throw NotFoundException when department not found', async () => {
      mockExecute.mockResolvedValueOnce([[], []]);

      const dto = { name: 'Updated' } as unknown as UpdateDepartmentDto;

      await expect(service.updateDepartment(999, dto, 1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =============================================================
  // deleteDepartment
  // =============================================================

  describe('deleteDepartment', () => {
    it('should throw NotFoundException when department not found', async () => {
      mockExecute.mockResolvedValueOnce([[], []]);

      await expect(service.deleteDepartment(999, 1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when has dependencies and force=false', async () => {
      // find department
      mockExecute.mockResolvedValueOnce([[makeDeptRow()], []]);
      // checkDepartmentDependencies → 11 table checks
      for (let i = 0; i < 11; i++) {
        mockExecute.mockResolvedValueOnce([i === 0 ? [{ id: 1 }] : [], []]);
      }

      await expect(service.deleteDepartment(1, 1, 10, false)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete department with force=true', async () => {
      // find department
      mockExecute.mockResolvedValueOnce([[makeDeptRow()], []]);
      // checkDepartmentDependencies → 11 table checks (1 has data)
      for (let i = 0; i < 11; i++) {
        mockExecute.mockResolvedValueOnce([i === 0 ? [{ id: 1 }] : [], []]);
      }
      // removeDepartmentDependencies → DELETE user_departments (count > 0)
      mockExecute.mockResolvedValueOnce([[], []]);
      // DELETE FROM departments
      mockExecute.mockResolvedValueOnce([[], []]);

      const result = await service.deleteDepartment(1, 1, 10, true);

      expect(result.message).toBe('Department deleted successfully');
      expect(mockActivityLogger.logDelete).toHaveBeenCalled();
    });
  });

  // =============================================================
  // getDepartmentMembers
  // =============================================================

  describe('getDepartmentMembers', () => {
    it('should throw NotFoundException when department not found', async () => {
      mockExecute.mockResolvedValueOnce([[], []]);

      await expect(service.getDepartmentMembers(999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return mapped members', async () => {
      // find department
      mockExecute.mockResolvedValueOnce([[makeDeptRow()], []]);
      // fetch members
      mockExecute.mockResolvedValueOnce([
        [
          {
            id: 1,
            username: 'maxm',
            email: 'max@example.com',
            first_name: 'Max',
            last_name: 'Mustermann',
            position: null,
            employee_id: null,
            role: 'employee',
            is_active: 1,
          },
        ],
        [],
      ]);

      const result = await service.getDepartmentMembers(1, 10);

      expect(result).toHaveLength(1);
      expect(result[0]?.firstName).toBe('Max');
      expect(result[0]?.isActive).toBe(true);
    });
  });

  // =============================================================
  // getDepartmentStats
  // =============================================================

  describe('getDepartmentStats', () => {
    it('should return aggregated statistics', async () => {
      // dept count + team count (Promise.all)
      mockExecute.mockResolvedValueOnce([[{ count: '5' }], []]);
      mockExecute.mockResolvedValueOnce([[{ count: '12' }], []]);

      const result = await service.getDepartmentStats(10);

      expect(result.totalDepartments).toBe(5);
      expect(result.totalTeams).toBe(12);
    });
  });
});
