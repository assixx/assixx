/**
 * Unit tests for TeamsService
 *
 * Phase 11: Service tests -- mocked dependencies.
 * Focus: CRUD operations, member/asset management, validation guards,
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
    asset_count: undefined,
    member_names: null,
    asset_names: null,
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

    it('should find teams by description search', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeTeamRow({ name: 'Team A', description: 'Engineering team' }),
        makeTeamRow({ id: 2, name: 'Team B', description: null }),
      ]);

      const result = await service.listTeams(10, {
        departmentId: undefined,
        search: 'engineering',
        includeMembers: undefined,
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.description).toBe('Engineering team');
    });

    it('should not filter when search is empty string', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeTeamRow(),
        makeTeamRow({ id: 2, name: 'Beta' }),
      ]);

      const result = await service.listTeams(10, {
        departmentId: undefined,
        search: '',
        includeMembers: undefined,
      });

      expect(result).toHaveLength(2);
    });

    it('should map member_names and asset_names', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeTeamRow({
          member_names: 'Max, Anna',
          asset_names: 'CNC-1, Drill-2',
        }),
      ]);

      const result = await service.listTeams(10);

      expect(result[0]?.memberNames).toBe('Max, Anna');
      expect(result[0]?.assetNames).toBe('CNC-1, Drill-2');
    });

    it('should map inactive status correctly', async () => {
      mockDb.query.mockResolvedValueOnce([makeTeamRow({ is_active: 0 })]);

      const result = await service.listTeams(10);

      expect(result[0]?.status).toBe('inactive');
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

    it('should create team with leader and call ensureLeaderInTeam', async () => {
      const dto = {
        name: 'Lead Team',
        description: null,
        departmentId: 5,
        leaderId: 42,
      } as unknown as CreateTeamDto;

      // validateDepartment: SELECT departments → found
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]);
      // validateLeader: SELECT users → found with admin role
      mockDb.query.mockResolvedValueOnce([{ role: 'admin' }]);
      // checkDuplicateName: no duplicate
      mockDb.query.mockResolvedValueOnce([]);
      // INSERT team RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 7 }]);
      // ensureLeaderInTeam: SELECT user_teams → not existing
      mockDb.query.mockResolvedValueOnce([]);
      // ensureLeaderInTeam: INSERT user_teams
      mockDb.query.mockResolvedValueOnce([]);
      // getTeamById
      mockDb.query.mockResolvedValueOnce([
        makeTeamRow({
          id: 7,
          name: 'Lead Team',
          department_id: 5,
          team_lead_id: 42,
        }),
      ]);

      const result = await service.createTeam(dto, 1, 10);

      expect(result.id).toBe(7);
      expect(result.leaderId).toBe(42);
    });

    it('should throw BadRequestException for invalid department', async () => {
      const dto = {
        name: 'Bad Dept',
        description: null,
        departmentId: 999,
        leaderId: undefined,
      } as unknown as CreateTeamDto;

      // validateDepartment: SELECT departments → not found
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.createTeam(dto, 1, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid leader', async () => {
      const dto = {
        name: 'Bad Lead',
        description: null,
        departmentId: null,
        leaderId: 999,
      } as unknown as CreateTeamDto;

      // validateLeader: SELECT users → not found
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.createTeam(dto, 1, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when leader is not admin/root', async () => {
      const dto = {
        name: 'Bad Role',
        description: null,
        departmentId: null,
        leaderId: 5,
      } as unknown as CreateTeamDto;

      // validateLeader: SELECT users → found with employee role
      mockDb.query.mockResolvedValueOnce([{ role: 'employee' }]);

      await expect(service.createTeam(dto, 1, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw when INSERT returns no rows', async () => {
      // checkDuplicateName: no duplicate
      mockDb.query.mockResolvedValueOnce([]);
      // INSERT RETURNING id → empty
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.createTeam(createDto, 1, 10)).rejects.toThrow(Error);
    });

    it('should handle ensureLeaderInTeam error gracefully', async () => {
      const dto = {
        name: 'Team Err',
        description: null,
        departmentId: null,
        leaderId: 42,
      } as unknown as CreateTeamDto;

      // validateLeader: found with admin role
      mockDb.query.mockResolvedValueOnce([{ role: 'admin' }]);
      // checkDuplicateName: no duplicate
      mockDb.query.mockResolvedValueOnce([]);
      // INSERT team RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 8 }]);
      // ensureLeaderInTeam: SELECT user_teams → error
      mockDb.query.mockRejectedValueOnce(new Error('DB error in ensureLeader'));
      // getTeamById
      mockDb.query.mockResolvedValueOnce([
        makeTeamRow({ id: 8, name: 'Team Err' }),
      ]);

      const result = await service.createTeam(dto, 1, 10);

      expect(result.id).toBe(8);
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

    it('should update team name and log activity', async () => {
      const dto = { name: 'Updated Name' } as unknown as UpdateTeamDto;

      // find existing team
      mockDb.query.mockResolvedValueOnce([makeTeamRow()]);
      // validateDepartment: skip (undefined)
      // validateLeader: skip (undefined)
      // checkDuplicateName
      mockDb.query.mockResolvedValueOnce([]);
      // UPDATE teams
      mockDb.query.mockResolvedValueOnce([]);
      // handleLeaderChange: skip (dto.leaderId undefined)
      // getTeamById
      mockDb.query.mockResolvedValueOnce([
        makeTeamRow({ name: 'Updated Name' }),
      ]);

      const result = await service.updateTeam(1, dto, 1, 10);

      expect(result.name).toBe('Updated Name');
      expect(mockActivityLogger.logUpdate).toHaveBeenCalled();
    });

    it('should demote old leader and promote new leader', async () => {
      const dto = { leaderId: 5 } as unknown as UpdateTeamDto;

      // find existing team (has old leader)
      mockDb.query.mockResolvedValueOnce([makeTeamRow({ team_lead_id: 3 })]);
      // validateLeader: SELECT users → found with root role
      mockDb.query.mockResolvedValueOnce([{ role: 'root' }]);
      // UPDATE teams (team_lead_id)
      mockDb.query.mockResolvedValueOnce([]);
      // handleLeaderChange: demote old leader
      mockDb.query.mockResolvedValueOnce([]);
      // ensureLeaderInTeam: SELECT user_teams → existing
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // ensureLeaderInTeam: UPDATE user_teams role='lead'
      mockDb.query.mockResolvedValueOnce([]);
      // getTeamById
      mockDb.query.mockResolvedValueOnce([makeTeamRow({ team_lead_id: 5 })]);

      const result = await service.updateTeam(1, dto, 1, 10);

      expect(result.leaderId).toBe(5);
      expect(mockActivityLogger.logUpdate).toHaveBeenCalled();
    });

    it('should handle update with no fields', async () => {
      const dto = {} as unknown as UpdateTeamDto;

      // find existing team
      mockDb.query.mockResolvedValueOnce([makeTeamRow()]);
      // no fields → skip UPDATE, skip checkDuplicateName
      // getTeamById
      mockDb.query.mockResolvedValueOnce([makeTeamRow()]);

      const result = await service.updateTeam(1, dto, 1, 10);

      expect(result.id).toBe(1);
      expect(mockActivityLogger.logUpdate).toHaveBeenCalled();
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

    it('should delete team without members', async () => {
      // find team
      mockDb.query.mockResolvedValueOnce([makeTeamRow()]);
      // check members -> no members
      mockDb.query.mockResolvedValueOnce([]);
      // DELETE FROM teams
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.deleteTeam(1, 1, 10);

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

    it('should use date range query when dates provided', async () => {
      mockDb.query.mockResolvedValueOnce([makeTeamRow()]);
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          username: 'user1',
          email: 'user1@test.de',
          first_name: 'Test',
          last_name: 'User',
          position: 'Dev',
          employee_id: 'EMP001',
          role: 'member',
          user_role: 'employee',
          availability_status: 'available',
          availability_start: new Date('2025-03-01'),
          availability_end: new Date('2025-03-15'),
        },
      ]);

      const result = await service.getTeamMembers(
        1,
        10,
        '2025-03-01',
        '2025-03-15',
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.availabilityStatus).toBe('available');
      expect(result[0]?.position).toBe('Dev');
      expect(result[0]?.employeeId).toBe('EMP001');
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

    it('should throw BadRequestException when user not found', async () => {
      // find team
      mockDb.query.mockResolvedValueOnce([makeTeamRow()]);
      // find user → not found
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.addTeamMember(1, 999, 10)).rejects.toThrow(
        BadRequestException,
      );
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
  // addTeamAsset
  // =============================================================

  describe('addTeamAsset', () => {
    it('should throw NotFoundException when asset not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.addTeamAsset(1, 999, 10, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when asset already assigned', async () => {
      // find asset
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // check existing -> already assigned
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);

      await expect(service.addTeamAsset(1, 1, 10, 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should add asset successfully', async () => {
      // find asset
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // check existing -> not assigned
      mockDb.query.mockResolvedValueOnce([]);
      // INSERT RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

      const result = await service.addTeamAsset(1, 1, 10, 1);

      expect(result.id).toBe(42);
      expect(result.message).toBe('Asset added to team successfully');
    });
  });

  // =============================================================
  // getTeamAssets
  // =============================================================

  describe('getTeamAssets', () => {
    it('should return mapped assets', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          name: 'CNC-500',
          serial_number: 'SN-001',
          status: 'operational',
          is_primary: true,
          assigned_at: new Date('2025-01-01'),
          notes: 'Primary asset',
        },
      ]);

      const result = await service.getTeamAssets(1, 10);

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('CNC-500');
      expect(result[0]?.serialNumber).toBe('SN-001');
      expect(result[0]?.isPrimary).toBe(true);
      expect(result[0]?.notes).toBe('Primary asset');
    });

    it('should handle null optional fields', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 2,
          name: 'Drill-100',
          serial_number: null,
          status: null,
          is_primary: false,
          assigned_at: null,
          notes: null,
        },
      ]);

      const result = await service.getTeamAssets(1, 10);

      expect(result[0]?.serialNumber).toBeUndefined();
      expect(result[0]?.status).toBeUndefined();
      expect(result[0]?.notes).toBeUndefined();
    });
  });

  // =============================================================
  // removeTeamAsset
  // =============================================================

  describe('removeTeamAsset', () => {
    it('should throw NotFoundException when asset not assigned', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.removeTeamAsset(1, 999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should remove asset successfully', async () => {
      // check existing -> is assigned
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // DELETE
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.removeTeamAsset(1, 1, 10);

      expect(result.message).toBe('Asset removed from team successfully');
    });
  });
});
