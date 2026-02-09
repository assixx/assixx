/**
 * Unit tests for TeamsService
 *
 * Phase 11: Service tests -- mocked dependencies.
 * Focus: CRUD operations, member/machine management, validation guards,
 *        duplicate name checks, leader role enforcement.
 *
 * Uses DatabaseService DI with mocked query method.
 */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { CreateTeamDto } from './dto/create-team.dto.js';
import type { UpdateTeamDto } from './dto/update-team.dto.js';
import type { TeamRow } from './teams.service.js';
import { TeamsService } from './teams.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('mock-uuid-v7'),
}));

function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
    tenantTransaction: vi.fn(),
  };
}

type MockDb = ReturnType<typeof createMockDb>;

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

/** Standard team row -- all optional fields set to null/undefined */
function makeTeamRow(overrides: Partial<TeamRow> = {}): TeamRow {
  return {
    id: 1,
    name: 'Alpha Team',
    description: null,
    department_id: null,
    team_lead_id: null,
    is_active: 1,
    tenant_id: 10,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
    department_name: undefined,
    department_area_name: undefined,
    team_lead_name: undefined,
    member_count: undefined,
    machine_count: undefined,
    member_names: null,
    machine_names: null,
    ...overrides,
  } as TeamRow;
}

// =============================================================
// TeamsService
// =============================================================

describe('TeamsService', () => {
  let service: TeamsService;
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockActivityLogger = createMockActivityLogger();
    mockDb = createMockDb();
    service = new TeamsService(
      mockActivityLogger as unknown as ActivityLoggerService,
      mockDb as unknown as DatabaseService,
    );
  });

  // =============================================================
  // listTeams
  // =============================================================

  describe('listTeams', () => {
    it('should return mapped team responses', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeTeamRow(),
        makeTeamRow({ id: 2, name: 'Beta Team' }),
      ]);

      const result = await service.listTeams(10);

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('Alpha Team');
      expect(result[1]?.name).toBe('Beta Team');
    });

    it('should filter by departmentId', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeTeamRow({ department_id: 5 }),
        makeTeamRow({ id: 2, department_id: 10 }),
      ]);

      const result = await service.listTeams(10, {
        departmentId: 5,
        search: undefined,
        includeMembers: undefined,
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.departmentId).toBe(5);
    });

    it('should filter by search term', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeTeamRow({ name: 'Alpha Team' }),
        makeTeamRow({ id: 2, name: 'Beta Team' }),
      ]);

      const result = await service.listTeams(10, {
        departmentId: undefined,
        search: 'alpha',
        includeMembers: undefined,
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Alpha Team');
    });
  });

  // =============================================================
  // getTeamById
  // =============================================================

  describe('getTeamById', () => {
    it('should throw NotFoundException when team not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getTeamById(999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return mapped team response', async () => {
      const row = makeTeamRow({ department_name: 'Engineering' });
      mockDb.query.mockResolvedValueOnce([row]);

      const result = await service.getTeamById(1, 10);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Alpha Team');
      expect(result.departmentName).toBe('Engineering');
      expect(result.status).toBe('active');
    });
  });

  // =============================================================
  // createTeam
  // =============================================================

  describe('createTeam', () => {
    const createDto = {
      name: 'New Team',
      description: 'A new team',
      departmentId: null,
      leaderId: undefined,
    } as unknown as CreateTeamDto;

    it('should create team and log activity', async () => {
      // validateDepartment -> skip (null)
      // validateLeader -> skip (undefined)
      // checkDuplicateName -> no duplicates
      mockDb.query.mockResolvedValueOnce([]);
      // INSERT RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]);
      // getTeamById (for return value)
      mockDb.query.mockResolvedValueOnce([
        makeTeamRow({ id: 5, name: 'New Team' }),
      ]);

      const result = await service.createTeam(createDto, 1, 10);

      expect(result.id).toBe(5);
      expect(result.name).toBe('New Team');
      expect(mockActivityLogger.logCreate).toHaveBeenCalledWith(
        10,
        1,
        'team',
        5,
        expect.stringContaining('New Team'),
        expect.objectContaining({ name: 'New Team' }),
      );
    });

    it('should throw ConflictException on duplicate name', async () => {
      // validateDepartment -> skip (null)
      // validateLeader -> skip (undefined)
      // checkDuplicateName -> found duplicate
      mockDb.query.mockResolvedValueOnce([{ id: 99 }]);

      await expect(service.createTeam(createDto, 1, 10)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // =============================================================
  // updateTeam
  // =============================================================

  describe('updateTeam', () => {
    it('should throw NotFoundException when team not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const dto = { name: 'Updated' } as unknown as UpdateTeamDto;

      await expect(service.updateTeam(999, dto, 1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =============================================================
  // deleteTeam
  // =============================================================

  describe('deleteTeam', () => {
    it('should throw NotFoundException when team not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.deleteTeam(999, 1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when team has members and force=false', async () => {
      // find team
      mockDb.query.mockResolvedValueOnce([makeTeamRow()]);
      // check members -> has members
      mockDb.query.mockResolvedValueOnce([{ user_id: 1 }, { user_id: 2 }]);

      await expect(service.deleteTeam(1, 1, 10, false)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete team with force=true even with members', async () => {
      // find team
      mockDb.query.mockResolvedValueOnce([makeTeamRow()]);
      // check members -> has members
      mockDb.query.mockResolvedValueOnce([{ user_id: 1 }]);
      // DELETE FROM user_teams
      mockDb.query.mockResolvedValueOnce([]);
      // DELETE FROM teams
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.deleteTeam(1, 1, 10, true);

      expect(result.message).toBe('Team deleted successfully');
      expect(mockActivityLogger.logDelete).toHaveBeenCalled();
    });
  });

  // =============================================================
  // getTeamMembers
  // =============================================================

  describe('getTeamMembers', () => {
    it('should throw NotFoundException when team not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getTeamMembers(999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return mapped team members', async () => {
      // find team
      mockDb.query.mockResolvedValueOnce([makeTeamRow()]);
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
          role: 'member',
          user_role: 'employee',
          availability_status: null,
          availability_start: null,
          availability_end: null,
        },
      ]);

      const result = await service.getTeamMembers(1, 10);

      expect(result).toHaveLength(1);
      expect(result[0]?.firstName).toBe('Max');
      expect(result[0]?.lastName).toBe('Mustermann');
    });
  });

  // =============================================================
  // addTeamMember
  // =============================================================

  describe('addTeamMember', () => {
    it('should throw NotFoundException when team not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.addTeamMember(999, 1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when user already member', async () => {
      // find team
      mockDb.query.mockResolvedValueOnce([makeTeamRow()]);
      // find user
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // check existing membership -> already member
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);

      await expect(service.addTeamMember(1, 1, 10)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should add member successfully', async () => {
      // find team
      mockDb.query.mockResolvedValueOnce([makeTeamRow()]);
      // find user
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // check existing membership -> not member
      mockDb.query.mockResolvedValueOnce([]);
      // INSERT
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.addTeamMember(1, 1, 10);

      expect(result.message).toBe('Team member added successfully');
    });
  });

  // =============================================================
  // removeTeamMember
  // =============================================================

  describe('removeTeamMember', () => {
    it('should throw BadRequestException when user not member', async () => {
      // find team
      mockDb.query.mockResolvedValueOnce([makeTeamRow()]);
      // check membership -> not member
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.removeTeamMember(1, 999, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should remove member successfully', async () => {
      // find team
      mockDb.query.mockResolvedValueOnce([makeTeamRow()]);
      // check membership -> is member
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // DELETE
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.removeTeamMember(1, 1, 10);

      expect(result.message).toBe('Team member removed successfully');
    });
  });

  // =============================================================
  // addTeamMachine
  // =============================================================

  describe('addTeamMachine', () => {
    it('should throw NotFoundException when machine not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.addTeamMachine(1, 999, 10, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when machine already assigned', async () => {
      // find machine
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // check existing -> already assigned
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);

      await expect(service.addTeamMachine(1, 1, 10, 1)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // =============================================================
  // removeTeamMachine
  // =============================================================

  describe('removeTeamMachine', () => {
    it('should throw NotFoundException when machine not assigned', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.removeTeamMachine(1, 999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should remove machine successfully', async () => {
      // check existing -> is assigned
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // DELETE
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.removeTeamMachine(1, 1, 10);

      expect(result.message).toBe('Machine removed from team successfully');
    });
  });
});
