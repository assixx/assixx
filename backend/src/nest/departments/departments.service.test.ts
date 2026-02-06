/**
 * Unit tests for DepartmentsService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Phase 14 B2: Deepened from 13 → 35 tests.
 * Focus: CRUD operations, dependency checking, force delete,
 *        member listing, stats aggregation, private helpers.
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

/** Mock 11 dependency checks — all returning empty (no deps) */
function mockNoDependencies(): void {
  for (let i = 0; i < 11; i++) {
    mockExecute.mockResolvedValueOnce([[], []]);
  }
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

    it('should return empty array when no departments exist', async () => {
      mockExecute.mockResolvedValueOnce([[], []]);

      const result = await service.listDepartments(10);

      expect(result).toHaveLength(0);
    });

    it('should omit extended fields when includeExtended=false', async () => {
      const row = makeDeptRow({
        department_lead_name: 'Max',
        employee_count: 5,
        team_count: 2,
      });
      mockExecute.mockResolvedValueOnce([[row], []]);

      const result = await service.listDepartments(10, false);

      expect(result[0]?.departmentLeadName).toBeUndefined();
      expect(result[0]?.employeeCount).toBeUndefined();
      expect(result[0]?.teamCount).toBeUndefined();
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

    it('should fall back to simple query when extended fails', async () => {
      mockExecute.mockRejectedValueOnce(new Error('CTE error'));
      mockExecute.mockResolvedValueOnce([[makeDeptRow()], []]);

      const result = await service.getDepartmentById(1, 10);

      expect(result.id).toBe(1);
      // Fallback uses includeExtended=false
      expect(result.departmentLeadName).toBeUndefined();
    });

    it('should throw NotFoundException when fallback also finds nothing', async () => {
      mockExecute.mockRejectedValueOnce(new Error('CTE error'));
      mockExecute.mockResolvedValueOnce([[], []]);

      await expect(service.getDepartmentById(999, 10)).rejects.toThrow(
        NotFoundException,
      );
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

    it('should call ensureLeaderInDepartment when lead provided', async () => {
      mockExecute.mockResolvedValueOnce([[{ id: 5 }], []]); // INSERT
      // ensureLeaderInDepartment: check existing
      mockExecute.mockResolvedValueOnce([[], []]); // not assigned yet
      mockExecute.mockResolvedValueOnce([[], []]); // INSERT user_departments
      // getDepartmentById
      mockExecute.mockResolvedValueOnce([
        [makeDeptRow({ id: 5, department_lead_id: 42 })],
        [],
      ]);

      const dto = {
        name: 'Led Dept',
        description: null,
        departmentLeadId: 42,
        areaId: null,
      } as unknown as CreateDepartmentDto;

      const result = await service.createDepartment(dto, 1, 10);

      expect(result.id).toBe(5);
      // Verify user_departments INSERT was called
      const insertCall = mockExecute.mock.calls[2]?.[0] as string;
      expect(insertCall).toContain('INSERT INTO user_departments');
    });

    it('should throw when INSERT returns no rows', async () => {
      mockExecute.mockResolvedValueOnce([[], []]); // INSERT returns empty

      const dto = {
        name: 'FailDept',
        description: null,
        departmentLeadId: null,
        areaId: null,
      } as unknown as CreateDepartmentDto;

      await expect(service.createDepartment(dto, 1, 10)).rejects.toThrow(
        'Failed to create department',
      );
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

    it('should update fields and log activity', async () => {
      mockExecute.mockResolvedValueOnce([[makeDeptRow()], []]); // find existing
      mockExecute.mockResolvedValueOnce([[], []]); // UPDATE
      // getDepartmentById → extended query
      mockExecute.mockResolvedValueOnce([
        [makeDeptRow({ name: 'Updated' })],
        [],
      ]);

      const dto = { name: 'Updated' } as unknown as UpdateDepartmentDto;
      const result = await service.updateDepartment(1, dto, 1, 10);

      expect(result.name).toBe('Updated');
      expect(mockActivityLogger.logUpdate).toHaveBeenCalled();
    });

    it('should skip UPDATE when no fields provided', async () => {
      mockExecute.mockResolvedValueOnce([[makeDeptRow()], []]); // find existing
      // No UPDATE call — fields.length === 0
      // getDepartmentById
      mockExecute.mockResolvedValueOnce([[makeDeptRow()], []]);

      const dto = {} as unknown as UpdateDepartmentDto;
      const result = await service.updateDepartment(1, dto, 1, 10);

      expect(result.name).toBe('Engineering');
      // 2 execute calls: find + getDepartmentById (no UPDATE)
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it('should call ensureLeaderInDepartment when lead provided', async () => {
      mockExecute.mockResolvedValueOnce([[makeDeptRow()], []]); // find existing
      mockExecute.mockResolvedValueOnce([[], []]); // UPDATE
      // ensureLeaderInDepartment
      mockExecute.mockResolvedValueOnce([[], []]); // check existing → not found
      mockExecute.mockResolvedValueOnce([[], []]); // INSERT user_departments
      // getDepartmentById
      mockExecute.mockResolvedValueOnce([[makeDeptRow()], []]);

      const dto = {
        name: 'WithLead',
        departmentLeadId: 42,
      } as unknown as UpdateDepartmentDto;

      await service.updateDepartment(1, dto, 1, 10);

      const insertCall = mockExecute.mock.calls[3]?.[0] as string;
      expect(insertCall).toContain('INSERT INTO user_departments');
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
      // removeDependmentDependencies → DELETE user_departments (count > 0)
      mockExecute.mockResolvedValueOnce([[], []]);
      // DELETE FROM departments
      mockExecute.mockResolvedValueOnce([[], []]);

      const result = await service.deleteDepartment(1, 1, 10, true);

      expect(result.message).toBe('Department deleted successfully');
      expect(mockActivityLogger.logDelete).toHaveBeenCalled();
    });

    it('should delete directly when no dependencies exist', async () => {
      mockExecute.mockResolvedValueOnce([[makeDeptRow()], []]); // find
      mockNoDependencies(); // all 11 checks return empty
      mockExecute.mockResolvedValueOnce([[], []]); // DELETE FROM departments

      const result = await service.deleteDepartment(1, 1, 10);

      expect(result.message).toBe('Department deleted successfully');
      // No removeDependencies calls — total = find(1) + deps(11) + delete(1) = 13
      expect(mockExecute).toHaveBeenCalledTimes(13);
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

    it('should apply defaults for null member fields', async () => {
      mockExecute.mockResolvedValueOnce([[makeDeptRow()], []]);
      mockExecute.mockResolvedValueOnce([
        [
          {
            id: 2,
            username: 'ghost',
            email: 'g@test.com',
            first_name: null,
            last_name: null,
            position: null,
            employee_id: null,
            role: null,
            is_active: 0,
          },
        ],
        [],
      ]);

      const result = await service.getDepartmentMembers(1, 10);

      expect(result[0]?.firstName).toBe('');
      expect(result[0]?.lastName).toBe('');
      expect(result[0]?.position).toBeUndefined();
      expect(result[0]?.role).toBe('employee');
      expect(result[0]?.isActive).toBe(false);
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

    it('should default to 0 when no rows returned', async () => {
      mockExecute.mockResolvedValueOnce([[], []]);
      mockExecute.mockResolvedValueOnce([[], []]);

      const result = await service.getDepartmentStats(10);

      expect(result.totalDepartments).toBe(0);
      expect(result.totalTeams).toBe(0);
    });
  });

  // =============================================================
  // Private helpers (via bracket notation)
  // =============================================================

  describe('mapToResponse (private)', () => {
    it('should include extended fields when includeExtended=true', () => {
      const row = makeDeptRow({
        department_lead_name: 'Anna Lead',
        areaName: 'Production',
        employee_count: 8,
        employee_names: 'A\nB',
        team_count: 3,
        team_names: 'T1\nT2\nT3',
      });

      const result = service['mapToResponse'](row, true);

      expect(result.departmentLeadName).toBe('Anna Lead');
      expect(result.areaName).toBe('Production');
      expect(result.employeeCount).toBe(8);
      expect(result.teamCount).toBe(3);
    });

    it('should exclude extended fields when includeExtended=false', () => {
      const row = makeDeptRow({
        department_lead_name: 'Anna Lead',
        employee_count: 8,
      });

      const result = service['mapToResponse'](row, false);

      expect(result.departmentLeadName).toBeUndefined();
      expect(result.employeeCount).toBeUndefined();
      expect(result.name).toBe('Engineering');
    });

    it('should map null description to undefined', () => {
      const row = makeDeptRow({ description: null });
      const result = service['mapToResponse'](row, false);
      expect(result.description).toBeUndefined();
    });
  });

  describe('buildUpdateFields (private)', () => {
    it('should build fields from DTO keys', () => {
      const dto = {
        name: 'Updated',
        description: 'New desc',
        isActive: 0,
      } as unknown as UpdateDepartmentDto;

      const { fields, values } = service['buildUpdateFields'](dto);

      expect(fields).toHaveLength(3);
      expect(values).toEqual(['Updated', 'New desc', 0]);
      expect(fields[0]).toBe('name = $1');
    });

    it('should return empty arrays for empty dto', () => {
      const dto = {} as unknown as UpdateDepartmentDto;
      const { fields, values } = service['buildUpdateFields'](dto);

      expect(fields).toHaveLength(0);
      expect(values).toHaveLength(0);
    });
  });

  describe('buildDepartmentCleanupStrategies (private)', () => {
    it('should map all 11 dependency tables with correct operations', () => {
      const deps = {
        userDepartments: 1,
        teams: 2,
        machines: 0,
        shifts: 0,
        shiftPlans: 0,
        shiftFavorites: 3,
        kvpSuggestions: 0,
        calendarEvents: 0,
        surveyAssignments: 0,
        adminPermissions: 0,
        documentPermissions: 0,
        total: 6,
      };

      const strategies = service['buildDepartmentCleanupStrategies'](deps);

      expect(strategies).toHaveLength(11);
      // user_departments → DELETE
      expect(strategies[0]).toEqual({
        table: 'user_departments',
        operation: 'DELETE',
        count: 1,
      });
      // teams → UPDATE (nullify)
      expect(strategies[1]).toEqual({
        table: 'teams',
        operation: 'UPDATE',
        count: 2,
      });
      // shift_favorites → DELETE
      expect(strategies[5]).toEqual({
        table: 'shift_favorites',
        operation: 'DELETE',
        count: 3,
      });
    });
  });

  describe('ensureLeaderInDepartment (private)', () => {
    it('should skip INSERT when leader already assigned', async () => {
      // check existing → found
      mockExecute.mockResolvedValueOnce([[{ id: 99 }], []]);

      await service['ensureLeaderInDepartment'](42, 1, 10);

      // Only 1 query (the check), no INSERT
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('should INSERT when leader not yet assigned', async () => {
      mockExecute.mockResolvedValueOnce([[], []]); // check → empty
      mockExecute.mockResolvedValueOnce([[], []]); // INSERT

      await service['ensureLeaderInDepartment'](42, 1, 10);

      expect(mockExecute).toHaveBeenCalledTimes(2);
      const insertSql = mockExecute.mock.calls[1]?.[0] as string;
      expect(insertSql).toContain('INSERT INTO user_departments');
    });

    it('should catch errors without throwing', async () => {
      mockExecute.mockRejectedValueOnce(new Error('DB error'));

      // Should NOT throw
      await expect(
        service['ensureLeaderInDepartment'](42, 1, 10),
      ).resolves.toBeUndefined();
    });
  });
});
