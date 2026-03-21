/**
 * Unit tests for DepartmentsService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Phase 14 B2: Deepened from 13 → 35 tests.
 * Focus: CRUD operations, dependency checking, force delete,
 *        member listing, stats aggregation, private helpers.
 *
 * Uses DatabaseService mock pattern (no legacy execute).
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { ScopeService } from '../hierarchy-permission/scope.service.js';
import type { DepartmentRow } from './departments.service.js';
import { DepartmentsService } from './departments.service.js';
import type { CreateDepartmentDto } from './dto/create-department.dto.js';
import type { UpdateDepartmentDto } from './dto/update-department.dto.js';

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

function createMockScope() {
  return {
    getScope: vi.fn().mockResolvedValue({
      type: 'full',
      areaIds: [],
      departmentIds: [],
      teamIds: [],
      leadAreaIds: [],
      leadDepartmentIds: [],
      leadTeamIds: [],
      isAreaLead: false,
      isDepartmentLead: false,
      isTeamLead: false,
      isAnyLead: false,
    }),
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
    is_active: IS_ACTIVE.ACTIVE,
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
  };
}

/** Mock 11 dependency checks — all returning empty (no deps) */
function mockNoDependencies(mockDb: MockDb): void {
  for (let i = 0; i < 11; i++) {
    mockDb.query.mockResolvedValueOnce([]);
  }
}

// =============================================================
// DepartmentsService
// =============================================================

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockActivityLogger = createMockActivityLogger();
    mockDb = createMockDb();
    const mockScope = createMockScope();
    service = new DepartmentsService(
      mockActivityLogger as unknown as ActivityLoggerService,
      mockDb as unknown as DatabaseService,
      mockScope as unknown as ScopeService,
    );
  });

  // =============================================================
  // listDepartments
  // =============================================================

  describe('listDepartments', () => {
    it('should return mapped department responses', async () => {
      mockDb.query.mockResolvedValueOnce([makeDeptRow(), makeDeptRow({ id: 2, name: 'QA' })]);

      const result = await service.listDepartments(10);

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('Engineering');
      expect(result[1]?.name).toBe('QA');
    });

    it('should return empty array when scope is "none"', async () => {
      const mockScope = createMockScope();
      mockScope.getScope.mockResolvedValueOnce({ type: 'none' });
      const scopedService = new DepartmentsService(
        mockActivityLogger as unknown as ActivityLoggerService,
        mockDb as unknown as DatabaseService,
        mockScope as unknown as ScopeService,
      );

      const result = await scopedService.listDepartments(10);

      expect(result).toEqual([]);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should fall back to simple query on error', async () => {
      // Extended query fails
      mockDb.query.mockRejectedValueOnce(new Error('Complex query failed'));
      // Simple fallback query succeeds
      mockDb.query.mockResolvedValueOnce([makeDeptRow()]);

      const result = await service.listDepartments(10);

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no departments exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.listDepartments(10);

      expect(result).toHaveLength(0);
    });

    it('should omit extended fields when includeExtended=false', async () => {
      const row = makeDeptRow({
        department_lead_name: 'Max',
        employee_count: 5,
        team_count: 2,
      });
      mockDb.query.mockResolvedValueOnce([row]);

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
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getDepartmentById(999, 10)).rejects.toThrow(NotFoundException);
    });

    it('should return mapped response', async () => {
      const row = makeDeptRow({
        department_lead_name: 'Max Mustermann',
        employee_count: 5,
      });
      mockDb.query.mockResolvedValueOnce([row]);

      const result = await service.getDepartmentById(1, 10);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Engineering');
      expect(result.departmentLeadName).toBe('Max Mustermann');
      expect(result.employeeCount).toBe(5);
    });

    it('should fall back to simple query when extended fails', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('CTE error'));
      mockDb.query.mockResolvedValueOnce([makeDeptRow()]);

      const result = await service.getDepartmentById(1, 10);

      expect(result.id).toBe(1);
      // Fallback uses includeExtended=false
      expect(result.departmentLeadName).toBeUndefined();
    });

    it('should throw NotFoundException when fallback also finds nothing', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('CTE error'));
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getDepartmentById(999, 10)).rejects.toThrow(NotFoundException);
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

      await expect(service.createDepartment(dto, 1, 10)).rejects.toThrow(BadRequestException);
    });

    it('should create department and log activity', async () => {
      // INSERT RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]);
      // getDepartmentById for return
      mockDb.query.mockResolvedValueOnce([makeDeptRow({ id: 5, name: 'New Dept' })]);

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
      // validateLeader: admin found
      mockDb.query.mockResolvedValueOnce([{ id: 42, role: 'admin' }]);
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]); // INSERT
      // ensureLeaderInDepartment: check existing
      mockDb.query.mockResolvedValueOnce([]); // not assigned yet
      mockDb.query.mockResolvedValueOnce([]); // INSERT user_departments
      // getDepartmentById
      mockDb.query.mockResolvedValueOnce([makeDeptRow({ id: 5, department_lead_id: 42 })]);

      const dto = {
        name: 'Led Dept',
        description: null,
        departmentLeadId: 42,
        areaId: null,
      } as unknown as CreateDepartmentDto;

      const result = await service.createDepartment(dto, 1, 10);

      expect(result.id).toBe(5);
      // Verify user_departments INSERT was called
      const insertCall = mockDb.query.mock.calls[3]?.[0] as string;
      expect(insertCall).toContain('INSERT INTO user_departments');
    });

    it('should throw when INSERT returns no rows', async () => {
      mockDb.query.mockResolvedValueOnce([]); // INSERT returns empty

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

    it('should create department with root leader', async () => {
      const dto = {
        name: 'Root Led',
        description: null,
        departmentLeadId: 1,
        areaId: null,
      } as unknown as CreateDepartmentDto;

      // validateLeader: root found
      mockDb.query.mockResolvedValueOnce([{ id: 1, role: 'root' }]);
      // INSERT RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 8 }]);
      // ensureLeaderInDepartment: check existing
      mockDb.query.mockResolvedValueOnce([]);
      // ensureLeaderInDepartment: INSERT
      mockDb.query.mockResolvedValueOnce([]);
      // getDepartmentById
      mockDb.query.mockResolvedValueOnce([makeDeptRow({ id: 8, department_lead_id: 1 })]);

      const result = await service.createDepartment(dto, 1, 10);

      expect(result.departmentLeadId).toBe(1);
    });

    it('should reject employee as department leader', async () => {
      const dto = {
        name: 'Bad Lead',
        description: null,
        departmentLeadId: 99,
        areaId: null,
      } as unknown as CreateDepartmentDto;

      // validateLeader: employee found — not admin/root
      mockDb.query.mockResolvedValueOnce([{ id: 99, role: 'employee' }]);

      await expect(service.createDepartment(dto, 1, 10)).rejects.toThrow(BadRequestException);
    });

    it('should reject inactive user as department leader', async () => {
      const dto = {
        name: 'Inactive Lead',
        description: null,
        departmentLeadId: 50,
        areaId: null,
      } as unknown as CreateDepartmentDto;

      // validateLeader: no active user found
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.createDepartment(dto, 1, 10)).rejects.toThrow(BadRequestException);
    });

    it('should reject non-existent user as department leader', async () => {
      const dto = {
        name: 'Ghost Lead',
        description: null,
        departmentLeadId: 9999,
        areaId: null,
      } as unknown as CreateDepartmentDto;

      // validateLeader: no user found
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.createDepartment(dto, 1, 10)).rejects.toThrow(BadRequestException);
    });
  });

  // =============================================================
  // updateDepartment
  // =============================================================

  describe('updateDepartment', () => {
    it('should throw NotFoundException when department not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const dto = { name: 'Updated' } as unknown as UpdateDepartmentDto;

      await expect(service.updateDepartment(999, dto, 1, 10)).rejects.toThrow(NotFoundException);
    });

    it('should update fields and log activity', async () => {
      mockDb.query.mockResolvedValueOnce([makeDeptRow()]); // find existing
      mockDb.query.mockResolvedValueOnce([]); // UPDATE
      // getDepartmentById → extended query
      mockDb.query.mockResolvedValueOnce([makeDeptRow({ name: 'Updated' })]);

      const dto = { name: 'Updated' } as unknown as UpdateDepartmentDto;
      const result = await service.updateDepartment(1, dto, 1, 10);

      expect(result.name).toBe('Updated');
      expect(mockActivityLogger.logUpdate).toHaveBeenCalled();
    });

    it('should skip UPDATE when no fields provided', async () => {
      mockDb.query.mockResolvedValueOnce([makeDeptRow()]); // find existing
      // No UPDATE call — fields.length === 0
      // getDepartmentById
      mockDb.query.mockResolvedValueOnce([makeDeptRow()]);

      const dto = {} as unknown as UpdateDepartmentDto;
      const result = await service.updateDepartment(1, dto, 1, 10);

      expect(result.name).toBe('Engineering');
      // 2 query calls: find + getDepartmentById (no UPDATE)
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should call ensureLeaderInDepartment when lead provided', async () => {
      mockDb.query.mockResolvedValueOnce([makeDeptRow()]); // find existing
      // validateLeader: admin found
      mockDb.query.mockResolvedValueOnce([{ id: 42, role: 'admin' }]);
      mockDb.query.mockResolvedValueOnce([]); // UPDATE
      // ensureLeaderInDepartment
      mockDb.query.mockResolvedValueOnce([]); // check existing → not found
      mockDb.query.mockResolvedValueOnce([]); // INSERT user_departments
      // getDepartmentById
      mockDb.query.mockResolvedValueOnce([makeDeptRow()]);

      const dto = {
        name: 'WithLead',
        departmentLeadId: 42,
      } as unknown as UpdateDepartmentDto;

      await service.updateDepartment(1, dto, 1, 10);

      const insertCall = mockDb.query.mock.calls[4]?.[0] as string;
      expect(insertCall).toContain('INSERT INTO user_departments');
    });

    it('should reject employee leader on update', async () => {
      const dto = {
        departmentLeadId: 99,
      } as unknown as UpdateDepartmentDto;

      mockDb.query.mockResolvedValueOnce([makeDeptRow()]); // find existing
      // validateLeader: employee found
      mockDb.query.mockResolvedValueOnce([{ id: 99, role: 'employee' }]);

      await expect(service.updateDepartment(1, dto, 1, 10)).rejects.toThrow(BadRequestException);
    });

    it('should allow removing leader (null) on update', async () => {
      const dto = {
        departmentLeadId: null,
      } as unknown as UpdateDepartmentDto;

      mockDb.query.mockResolvedValueOnce([makeDeptRow({ department_lead_id: 42 })]); // find existing
      // validateLeader: null → skip
      // UPDATE departments
      mockDb.query.mockResolvedValueOnce([]);
      // getDepartmentById (return updated)
      mockDb.query.mockResolvedValueOnce([makeDeptRow({ department_lead_id: null })]);

      const result = await service.updateDepartment(1, dto, 1, 10);

      expect(result.departmentLeadId).toBeUndefined();
    });
  });

  // =============================================================
  // deleteDepartment
  // =============================================================

  describe('deleteDepartment', () => {
    it('should throw NotFoundException when department not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.deleteDepartment(999, 1, 10)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when has dependencies and force=false', async () => {
      // find department
      mockDb.query.mockResolvedValueOnce([makeDeptRow()]);
      // checkDepartmentDependencies → 11 table checks
      for (let i = 0; i < 11; i++) {
        mockDb.query.mockResolvedValueOnce(i === 0 ? [{ id: 1 }] : []);
      }

      await expect(service.deleteDepartment(1, 1, 10, false)).rejects.toThrow(BadRequestException);
    });

    it('should delete department with force=true', async () => {
      // find department
      mockDb.query.mockResolvedValueOnce([makeDeptRow()]);
      // checkDepartmentDependencies → 11 table checks (1 has data)
      for (let i = 0; i < 11; i++) {
        mockDb.query.mockResolvedValueOnce(i === 0 ? [{ id: 1 }] : []);
      }
      // removeDependmentDependencies → DELETE user_departments (count > 0)
      mockDb.query.mockResolvedValueOnce([]);
      // DELETE FROM departments
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.deleteDepartment(1, 1, 10, true);

      expect(result.message).toBe('Department deleted successfully');
      expect(mockActivityLogger.logDelete).toHaveBeenCalled();
    });

    it('should force-delete with UPDATE-type dependency cleanup', async () => {
      // find department
      mockDb.query.mockResolvedValueOnce([makeDeptRow()]);
      // checkDepartmentDependencies → 11 table checks (teams at index 1 has data)
      for (let i = 0; i < 11; i++) {
        mockDb.query.mockResolvedValueOnce(i === 1 ? [{ id: 2 }] : []);
      }
      // removeDependencyFrom → UPDATE teams SET department_id = NULL
      mockDb.query.mockResolvedValueOnce([]);
      // DELETE FROM departments
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.deleteDepartment(1, 1, 10, true);

      expect(result.message).toBe('Department deleted successfully');
    });

    it('should delete directly when no dependencies exist', async () => {
      mockDb.query.mockResolvedValueOnce([makeDeptRow()]); // find
      mockNoDependencies(mockDb); // all 11 checks return empty
      mockDb.query.mockResolvedValueOnce([]); // DELETE FROM departments

      const result = await service.deleteDepartment(1, 1, 10);

      expect(result.message).toBe('Department deleted successfully');
      // No removeDependencies calls — total = find(1) + deps(11) + delete(1) = 13
      expect(mockDb.query).toHaveBeenCalledTimes(13);
    });
  });

  // =============================================================
  // getDepartmentMembers
  // =============================================================

  describe('getDepartmentMembers', () => {
    it('should throw NotFoundException when department not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getDepartmentMembers(999, 10)).rejects.toThrow(NotFoundException);
    });

    it('should return mapped members', async () => {
      // find department
      mockDb.query.mockResolvedValueOnce([makeDeptRow()]);
      // fetch members
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          username: 'maxm',
          email: 'max@example.com',
          first_name: 'Max',
          last_name: 'Mustermann',
          position: null,
          employee_id: null,
          role: 'employee',
          is_active: IS_ACTIVE.ACTIVE,
        },
      ]);

      const result = await service.getDepartmentMembers(1, 10);

      expect(result).toHaveLength(1);
      expect(result[0]?.firstName).toBe('Max');
      expect(result[0]?.isActive).toBe(true);
    });

    it('should apply defaults for null member fields', async () => {
      mockDb.query.mockResolvedValueOnce([makeDeptRow()]);
      mockDb.query.mockResolvedValueOnce([
        {
          id: 2,
          username: 'ghost',
          email: 'g@test.com',
          first_name: null,
          last_name: null,
          position: null,
          employee_id: null,
          role: null,
          is_active: IS_ACTIVE.INACTIVE,
        },
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
      mockDb.query.mockResolvedValueOnce([{ count: '5' }]);
      mockDb.query.mockResolvedValueOnce([{ count: '12' }]);

      const result = await service.getDepartmentStats(10);

      expect(result.totalDepartments).toBe(5);
      expect(result.totalTeams).toBe(12);
    });

    it('should default to 0 when no rows returned', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

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
        assets: 0,
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

  // =============================================================
  // assignHallsToDepartment
  // =============================================================

  describe('assignHallsToDepartment', () => {
    it('should clear existing and insert new hall assignments', async () => {
      // getDepartmentById → find department
      mockDb.query.mockResolvedValueOnce([makeDeptRow()]);
      // DELETE existing
      mockDb.query.mockResolvedValueOnce([]);
      // INSERT new halls
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.assignHallsToDepartment(1, [10, 20, 30], 10, 5);

      expect(result.message).toBe('Halls assigned to department successfully');
      // 3 queries: getDepartmentById(1) + DELETE(1) + INSERT(1)
      expect(mockDb.query).toHaveBeenCalledTimes(3);

      const insertSql = mockDb.query.mock.calls[2]?.[0] as string;
      expect(insertSql).toContain('INSERT INTO department_halls');
      // Verify parameterized values: [tenantId, departmentId, assignedBy, ...hallIds]
      const insertParams = mockDb.query.mock.calls[2]?.[1] as unknown[];
      expect(insertParams).toEqual([10, 1, 5, 10, 20, 30]);
    });

    it('should only clear halls when hallIds is empty', async () => {
      mockDb.query.mockResolvedValueOnce([makeDeptRow()]); // getDepartmentById
      mockDb.query.mockResolvedValueOnce([]); // DELETE existing

      const result = await service.assignHallsToDepartment(1, [], 10, 5);

      expect(result.message).toBe('Halls assigned to department successfully');
      // Only 2 queries: getDepartmentById(1) + DELETE(1), no INSERT
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when department does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]); // getDepartmentById → not found

      await expect(service.assignHallsToDepartment(999, [10], 10, 5)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should assign a single hall correctly', async () => {
      mockDb.query.mockResolvedValueOnce([makeDeptRow()]); // getDepartmentById
      mockDb.query.mockResolvedValueOnce([]); // DELETE
      mockDb.query.mockResolvedValueOnce([]); // INSERT

      await service.assignHallsToDepartment(1, [42], 10, 5);

      const insertSql = mockDb.query.mock.calls[2]?.[0] as string;
      expect(insertSql).toContain('($1, $2, $4, $3, NOW())');
      const insertParams = mockDb.query.mock.calls[2]?.[1] as unknown[];
      expect(insertParams).toEqual([10, 1, 5, 42]);
    });
  });

  // =============================================================
  // getDepartmentHallIds
  // =============================================================

  describe('getDepartmentHallIds', () => {
    it('should return hall IDs for a department', async () => {
      mockDb.query.mockResolvedValueOnce([{ hall_id: 10 }, { hall_id: 20 }, { hall_id: 30 }]);

      const result = await service.getDepartmentHallIds(1, 10);

      expect(result).toEqual([10, 20, 30]);
      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('SELECT hall_id FROM department_halls');
    });

    it('should return empty array when no halls assigned', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getDepartmentHallIds(1, 10);

      expect(result).toEqual([]);
    });
  });

  describe('ensureLeaderInDepartment (private)', () => {
    it('should skip INSERT when leader already assigned', async () => {
      // check existing → found
      mockDb.query.mockResolvedValueOnce([{ id: 99 }]);

      await service['ensureLeaderInDepartment'](42, 1, 10);

      // Only 1 query (the check), no INSERT
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should INSERT when leader not yet assigned', async () => {
      mockDb.query.mockResolvedValueOnce([]); // check → empty
      mockDb.query.mockResolvedValueOnce([]); // INSERT

      await service['ensureLeaderInDepartment'](42, 1, 10);

      expect(mockDb.query).toHaveBeenCalledTimes(2);
      const insertSql = mockDb.query.mock.calls[1]?.[0] as string;
      expect(insertSql).toContain('INSERT INTO user_departments');
    });

    it('should catch errors without throwing', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB error'));

      // Should NOT throw
      await expect(service['ensureLeaderInDepartment'](42, 1, 10)).resolves.toBeUndefined();
    });
  });
});
