/**
 * Teams Service
 *
 * Business logic for team management.
 * Status: 0=inactive, 1=active, 3=archived, 4=deleted
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import type { RowDataPacket } from '../../utils/db.js';
import { execute } from '../../utils/db.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { CreateTeamDto } from './dto/create-team.dto.js';
import type { UpdateTeamDto } from './dto/update-team.dto.js';

/**
 * Error messages constants
 */
const ERROR_MESSAGES = {
  TEAM_NOT_FOUND: 'Team not found',
  DEPARTMENT_NOT_FOUND: 'Department not found',
} as const;

/**
 * Database team row type
 */
export interface TeamRow extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  department_id: number | null;
  team_lead_id: number | null;
  is_active: number;
  tenant_id: number;
  created_at: Date;
  updated_at: Date;
  department_name: string | undefined;
  department_area_name: string | undefined;
  team_lead_name: string | undefined;
  member_count: number | undefined;
  machine_count: number | undefined;
  member_names: string | null;
  machine_names: string | null;
}

/**
 * API response type for team
 */
export interface TeamResponse {
  id: number;
  name: string;
  description: string | null;
  departmentId: number | null;
  leaderId: number | null;
  isActive: number;
  status: 'active' | 'inactive';
  tenantId: number;
  createdAt: string | undefined;
  updatedAt: string | undefined;
  departmentName: string | undefined;
  departmentAreaName: string | undefined;
  leaderName: string | undefined;
  memberCount: number | undefined;
  machineCount: number | undefined;
  memberNames: string | undefined;
  machineNames: string | undefined;
}

/**
 * Team member type
 */
export interface TeamMember {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  position: string | undefined;
  employeeId: string | undefined;
  role: string | undefined;
  userRole: string | undefined;
  availabilityStatus: string | undefined;
  availabilityStart: string | undefined;
  availabilityEnd: string | undefined;
}

/**
 * Team machine type
 */
export interface TeamMachine {
  id: number;
  name: string;
  serialNumber: string | undefined;
  status: string | undefined;
  isPrimary: boolean;
  assignedAt: string | undefined;
  notes: string | undefined;
}

/**
 * Filter options for listing teams
 */
export interface TeamFilters {
  departmentId: number | undefined;
  search: string | undefined;
  includeMembers: boolean | undefined;
}

/**
 * Database row type for team member queries
 */
interface TeamMemberRow extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  employee_id: string | null;
  role: string | null;
  user_role: string | null;
  availability_status: string | null;
  availability_start: Date | null;
  availability_end: Date | null;
}

/**
 * SQL query for finding a team by ID
 */
const FIND_TEAM_BY_ID_QUERY =
  'SELECT * FROM teams WHERE id = $1 AND tenant_id = $2';

/**
 * SQL query for team members with date range availability
 */
const TEAM_MEMBERS_DATE_RANGE_QUERY = `
  SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.position, u.employee_id,
         ut.role, u.role as user_role,
         ea.status as availability_status, ea.start_date as availability_start, ea.end_date as availability_end
  FROM users u
  JOIN user_teams ut ON u.id = ut.user_id
  LEFT JOIN employee_availability ea ON u.id = ea.employee_id
         AND ea.start_date <= $2::date AND ea.end_date >= $3::date
  WHERE ut.team_id = $1`;

/**
 * SQL query for team members with current date availability
 */
const TEAM_MEMBERS_CURRENT_DATE_QUERY = `
  SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.position, u.employee_id,
         ut.role, u.role as user_role,
         ea.status as availability_status, ea.start_date as availability_start, ea.end_date as availability_end
  FROM users u
  JOIN user_teams ut ON u.id = ut.user_id
  LEFT JOIN employee_availability ea ON u.id = ea.employee_id
         AND CURRENT_DATE BETWEEN ea.start_date AND ea.end_date
  WHERE ut.team_id = $1`;

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(private readonly activityLogger: ActivityLoggerService) {}

  /**
   * SQL query for fetching teams with extended info
   * Includes area name via department→area join for badge tooltips
   * Includes aggregated member/machine names for tooltips
   */
  private readonly FIND_ALL_TEAMS_QUERY = `
    SELECT t.*,
      d.name as department_name,
      a.name as department_area_name,
      CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as team_lead_name,
      (SELECT COUNT(*) FROM user_teams ut WHERE ut.team_id = t.id) as member_count,
      (SELECT COUNT(*) FROM machine_teams mt WHERE mt.team_id = t.id) as machine_count,
      (SELECT STRING_AGG(CONCAT(COALESCE(mu.first_name, ''), ' ', COALESCE(mu.last_name, '')), ', ' ORDER BY mu.last_name)
       FROM user_teams mut
       JOIN users mu ON mut.user_id = mu.id
       WHERE mut.team_id = t.id) as member_names,
      (SELECT STRING_AGG(mm.name, ', ' ORDER BY mm.name)
       FROM machine_teams mmt
       JOIN machines mm ON mmt.machine_id = mm.id
       WHERE mmt.team_id = t.id) as machine_names
    FROM teams t
    LEFT JOIN departments d ON t.department_id = d.id
    LEFT JOIN areas a ON d.area_id = a.id
    LEFT JOIN users u ON t.team_lead_id = u.id
    WHERE t.tenant_id = $1 AND t.is_active != 4
    ORDER BY t.name`;

  /**
   * Map database row to API response
   */
  private mapToResponse(team: TeamRow): TeamResponse {
    return {
      id: team.id,
      name: team.name,
      description: team.description,
      departmentId: team.department_id,
      leaderId: team.team_lead_id,
      isActive: team.is_active,
      status: team.is_active === 1 ? 'active' : 'inactive',
      tenantId: team.tenant_id,
      createdAt: team.created_at.toISOString(),
      updatedAt: team.updated_at.toISOString(),
      departmentName: team.department_name,
      departmentAreaName: team.department_area_name,
      leaderName: team.team_lead_name,
      memberCount: team.member_count,
      machineCount: team.machine_count,
      memberNames: team.member_names ?? undefined,
      machineNames: team.machine_names ?? undefined,
    };
  }

  /**
   * List all teams for a tenant
   */
  async listTeams(
    tenantId: number,
    filters?: TeamFilters,
  ): Promise<TeamResponse[]> {
    this.logger.debug(`Fetching teams for tenant ${tenantId}`);

    const [rows] = await execute<TeamRow[]>(this.FIND_ALL_TEAMS_QUERY, [
      tenantId,
    ]);

    let teams = rows.map((team: TeamRow) => this.mapToResponse(team));

    if (filters?.departmentId !== undefined) {
      teams = teams.filter(
        (team: TeamResponse) => team.departmentId === filters.departmentId,
      );
    }

    if (filters?.search !== undefined && filters.search !== '') {
      const searchLower = filters.search.toLowerCase();
      teams = teams.filter(
        (team: TeamResponse) =>
          team.name.toLowerCase().includes(searchLower) ||
          (team.description?.toLowerCase().includes(searchLower) ?? false),
      );
    }

    return teams;
  }

  /**
   * Get a single team by ID
   */
  async getTeamById(id: number, tenantId: number): Promise<TeamResponse> {
    this.logger.debug(`Fetching team ${id} for tenant ${tenantId}`);

    const [rows] = await execute<TeamRow[]>(
      `SELECT t.*,
        d.name as department_name,
        a.name as department_area_name,
        CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as team_lead_name,
        (SELECT COUNT(*) FROM user_teams ut WHERE ut.team_id = t.id) as member_count,
        (SELECT COUNT(*) FROM machine_teams mt WHERE mt.team_id = t.id) as machine_count,
        (SELECT STRING_AGG(CONCAT(COALESCE(mu.first_name, ''), ' ', COALESCE(mu.last_name, '')), ', ' ORDER BY mu.last_name)
         FROM user_teams mut
         JOIN users mu ON mut.user_id = mu.id
         WHERE mut.team_id = t.id) as member_names,
        (SELECT STRING_AGG(mm.name, ', ' ORDER BY mm.name)
         FROM machine_teams mmt
         JOIN machines mm ON mmt.machine_id = mm.id
         WHERE mmt.team_id = t.id) as machine_names
      FROM teams t
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN areas a ON d.area_id = a.id
      LEFT JOIN users u ON t.team_lead_id = u.id
      WHERE t.id = $1 AND t.tenant_id = $2`,
      [id, tenantId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(ERROR_MESSAGES.TEAM_NOT_FOUND);
    }

    return this.mapToResponse(rows[0] as TeamRow);
  }

  /**
   * Check if team name is duplicate
   */
  private async checkDuplicateName(
    name: string,
    tenantId: number,
    excludeId?: number,
  ): Promise<void> {
    const [existing] = await execute<TeamRow[]>(
      'SELECT id FROM teams WHERE LOWER(name) = LOWER($1) AND tenant_id = $2',
      [name, tenantId],
    );

    const duplicate = existing.find((t: TeamRow) => t.id !== excludeId);
    if (duplicate !== undefined) {
      throw new ConflictException('Team with this name already exists');
    }
  }

  /**
   * Validate department exists
   */
  private async validateDepartment(
    departmentId: number | null | undefined,
    tenantId: number,
  ): Promise<void> {
    if (departmentId === null || departmentId === undefined) return;

    const [rows] = await execute<RowDataPacket[]>(
      'SELECT id FROM departments WHERE id = $1 AND tenant_id = $2',
      [departmentId, tenantId],
    );

    if (rows.length === 0) {
      throw new BadRequestException('Invalid department ID');
    }
  }

  /**
   * Validate leader exists and has appropriate role
   */
  private async validateLeader(
    leaderId: number | null | undefined,
    tenantId: number,
  ): Promise<void> {
    if (leaderId === null || leaderId === undefined) return;

    interface UserRow extends RowDataPacket {
      role: string;
    }

    // SECURITY: Only allow ACTIVE users (is_active = 1) as team leaders
    const [rows] = await execute<UserRow[]>(
      'SELECT role FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = 1',
      [leaderId, tenantId],
    );

    if (rows.length === 0) {
      throw new BadRequestException('Invalid leader ID or user inactive');
    }

    const user = rows[0];
    if (user !== undefined && user.role !== 'root' && user.role !== 'admin') {
      throw new BadRequestException('Team leader must be a root user or admin');
    }
  }

  /**
   * Ensure leader is in team with lead role
   */
  private async ensureLeaderInTeam(
    leaderId: number,
    teamId: number,
    tenantId: number,
  ): Promise<void> {
    try {
      const [existing] = await execute<RowDataPacket[]>(
        'SELECT id FROM user_teams WHERE user_id = $1 AND team_id = $2',
        [leaderId, teamId],
      );

      if (existing.length > 0) {
        await execute(
          'UPDATE user_teams SET role = $1 WHERE user_id = $2 AND team_id = $3',
          ['lead', leaderId, teamId],
        );
        this.logger.log(
          `Updated existing member ${leaderId} to lead role in team ${teamId}`,
        );
      } else {
        await execute(
          `INSERT INTO user_teams (tenant_id, user_id, team_id, role, joined_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [tenantId, leaderId, teamId, 'lead'],
        );
        this.logger.log(
          `Added leader ${leaderId} to team ${teamId} with lead role`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        `Error ensuring leader in team: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Create a new team
   */
  async createTeam(
    dto: CreateTeamDto,
    actingUserId: number,
    tenantId: number,
  ): Promise<TeamResponse> {
    this.logger.log(`Creating team: ${dto.name}`);

    await this.validateDepartment(dto.departmentId, tenantId);
    await this.validateLeader(dto.leaderId, tenantId);
    await this.checkDuplicateName(dto.name, tenantId);

    const teamUuid = uuidv7();
    const [rows] = await execute<{ id: number }[]>(
      `INSERT INTO teams (name, description, department_id, team_lead_id, is_active, tenant_id, uuid, uuid_created_at)
       VALUES ($1, $2, $3, $4, 1, $5, $6, NOW())
       RETURNING id`,
      [
        dto.name,
        dto.description,
        dto.departmentId,
        dto.leaderId,
        tenantId,
        teamUuid,
      ],
    );

    if (rows.length === 0 || rows[0] === undefined) {
      throw new Error('Failed to create team');
    }

    const teamId = rows[0].id;

    if (dto.leaderId !== undefined) {
      await this.ensureLeaderInTeam(dto.leaderId, teamId, tenantId);
    }

    const result = await this.getTeamById(teamId, tenantId);

    await this.activityLogger.logCreate(
      tenantId,
      actingUserId,
      'team',
      teamId,
      `Team erstellt: ${dto.name}`,
      {
        name: dto.name,
        description: dto.description,
        departmentId: dto.departmentId,
        leaderId: dto.leaderId,
      },
    );

    return result;
  }

  /**
   * Build update fields from DTO
   */
  private buildUpdateFields(dto: UpdateTeamDto): {
    fields: string[];
    values: unknown[];
  } {
    const fields: string[] = [];
    const values: unknown[] = [];

    const fieldMap: [keyof UpdateTeamDto, string][] = [
      ['name', 'name'],
      ['description', 'description'],
      ['departmentId', 'department_id'],
      ['leaderId', 'team_lead_id'],
      ['isActive', 'is_active'],
    ];

    for (const [dtoKey, dbCol] of fieldMap) {
      const value = dto[dtoKey];
      if (value !== undefined) {
        fields.push(`${dbCol} = $${values.length + 1}`);
        values.push(value);
      }
    }

    return { fields, values };
  }

  /**
   * Handle leader change - demote old leader and promote new
   */
  private async handleLeaderChange(
    dto: UpdateTeamDto,
    currentLeaderId: number | null,
    teamId: number,
    tenantId: number,
  ): Promise<void> {
    if (dto.leaderId === undefined || dto.leaderId === null) return;
    if (currentLeaderId !== null && currentLeaderId !== dto.leaderId) {
      await execute(
        'UPDATE user_teams SET role = $1 WHERE user_id = $2 AND team_id = $3',
        ['member', currentLeaderId, teamId],
      );
    }
    await this.ensureLeaderInTeam(dto.leaderId, teamId, tenantId);
  }

  /**
   * Update a team
   */
  async updateTeam(
    id: number,
    dto: UpdateTeamDto,
    actingUserId: number,
    tenantId: number,
  ): Promise<TeamResponse> {
    this.logger.log(`Updating team ${id}`);

    const [existing] = await execute<TeamRow[]>(FIND_TEAM_BY_ID_QUERY, [
      id,
      tenantId,
    ]);
    if (existing.length === 0) {
      throw new NotFoundException(ERROR_MESSAGES.TEAM_NOT_FOUND);
    }

    const currentTeam = existing[0] as TeamRow;
    const oldValues = {
      name: currentTeam.name,
      description: currentTeam.description,
      departmentId: currentTeam.department_id,
      leaderId: currentTeam.team_lead_id,
      isActive: currentTeam.is_active,
    };

    await this.validateDepartment(dto.departmentId, tenantId);
    await this.validateLeader(dto.leaderId, tenantId);
    if (dto.name !== undefined)
      await this.checkDuplicateName(dto.name, tenantId, id);

    const { fields, values } = this.buildUpdateFields(dto);
    if (fields.length > 0) {
      values.push(id);
      await execute(
        `UPDATE teams SET ${fields.join(', ')} WHERE id = $${values.length}`,
        values,
      );
    }

    await this.handleLeaderChange(dto, currentTeam.team_lead_id, id, tenantId);
    const result = await this.getTeamById(id, tenantId);

    const newValues = {
      name: dto.name,
      description: dto.description,
      departmentId: dto.departmentId,
      leaderId: dto.leaderId,
      isActive: dto.isActive,
    };

    await this.activityLogger.logUpdate(
      tenantId,
      actingUserId,
      'team',
      id,
      `Team aktualisiert: ${currentTeam.name}`,
      oldValues,
      newValues,
    );

    return result;
  }

  /**
   * Delete a team
   */
  async deleteTeam(
    id: number,
    actingUserId: number,
    tenantId: number,
    force: boolean = false,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting team ${id}, force: ${force}`);

    const [existing] = await execute<TeamRow[]>(FIND_TEAM_BY_ID_QUERY, [
      id,
      tenantId,
    ]);

    if (existing.length === 0) {
      throw new NotFoundException(ERROR_MESSAGES.TEAM_NOT_FOUND);
    }

    const existingTeam = existing[0] as TeamRow;

    const [members] = await execute<RowDataPacket[]>(
      'SELECT user_id FROM user_teams WHERE team_id = $1',
      [id],
    );

    if (members.length > 0) {
      if (!force) {
        throw new BadRequestException({
          message: 'Cannot delete team with members',
          details: { memberCount: members.length },
        });
      }

      await execute('DELETE FROM user_teams WHERE team_id = $1', [id]);
    }

    await execute('DELETE FROM teams WHERE id = $1', [id]);

    await this.activityLogger.logDelete(
      tenantId,
      actingUserId,
      'team',
      id,
      `Team gelöscht: ${existingTeam.name}`,
      {
        name: existingTeam.name,
        description: existingTeam.description,
        departmentId: existingTeam.department_id,
        leaderId: existingTeam.team_lead_id,
        force,
      },
    );

    return { message: 'Team deleted successfully' };
  }

  /**
   * Get team members with optional date range for availability filtering.
   * If dates provided, returns entries overlapping the range. Otherwise uses CURRENT_DATE.
   */
  async getTeamMembers(
    id: number,
    tenantId: number,
    startDate?: string,
    endDate?: string,
  ): Promise<TeamMember[]> {
    const dateRangeStr =
      startDate !== undefined ? `${startDate} - ${endDate ?? 'none'}` : 'none';
    this.logger.debug(
      `Fetching members for team ${id}, dateRange: ${dateRangeStr}`,
    );

    const [existing] = await execute<TeamRow[]>(FIND_TEAM_BY_ID_QUERY, [
      id,
      tenantId,
    ]);
    if (existing.length === 0) {
      throw new NotFoundException(ERROR_MESSAGES.TEAM_NOT_FOUND);
    }

    const hasDateRange =
      startDate !== undefined &&
      startDate !== '' &&
      endDate !== undefined &&
      endDate !== '';
    const query =
      hasDateRange ?
        TEAM_MEMBERS_DATE_RANGE_QUERY
      : TEAM_MEMBERS_CURRENT_DATE_QUERY;
    const params = hasDateRange ? [id, endDate, startDate] : [id];

    const [members] = await execute<TeamMemberRow[]>(query, params);

    return members.map((member: TeamMemberRow) => ({
      id: member.id,
      username: member.username,
      email: member.email,
      firstName: member.first_name ?? '',
      lastName: member.last_name ?? '',
      position: member.position ?? undefined,
      employeeId: member.employee_id ?? undefined,
      role: member.role ?? undefined,
      userRole: member.user_role ?? undefined,
      availabilityStatus: member.availability_status ?? undefined,
      availabilityStart: member.availability_start?.toISOString() ?? undefined,
      availabilityEnd: member.availability_end?.toISOString() ?? undefined,
    }));
  }

  /**
   * Add member to team
   */
  async addTeamMember(
    teamId: number,
    userId: number,
    tenantId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Adding user ${userId} to team ${teamId}`);

    const [teamRows] = await execute<TeamRow[]>(FIND_TEAM_BY_ID_QUERY, [
      teamId,
      tenantId,
    ]);

    if (teamRows.length === 0) {
      throw new NotFoundException(ERROR_MESSAGES.TEAM_NOT_FOUND);
    }

    const [userRows] = await execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = 1',
      [userId, tenantId],
    );

    if (userRows.length === 0) {
      throw new BadRequestException('Invalid user ID');
    }

    const [existing] = await execute<RowDataPacket[]>(
      'SELECT id FROM user_teams WHERE user_id = $1 AND team_id = $2',
      [userId, teamId],
    );

    if (existing.length > 0) {
      throw new ConflictException('User is already a member of this team');
    }

    await execute(
      `INSERT INTO user_teams (tenant_id, user_id, team_id, role, joined_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [tenantId, userId, teamId, 'member'],
    );

    return { message: 'Team member added successfully' };
  }

  /**
   * Remove member from team
   */
  async removeTeamMember(
    teamId: number,
    userId: number,
    tenantId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Removing user ${userId} from team ${teamId}`);

    const [teamRows] = await execute<TeamRow[]>(FIND_TEAM_BY_ID_QUERY, [
      teamId,
      tenantId,
    ]);

    if (teamRows.length === 0) {
      throw new NotFoundException(ERROR_MESSAGES.TEAM_NOT_FOUND);
    }

    const [existing] = await execute<RowDataPacket[]>(
      'SELECT id FROM user_teams WHERE user_id = $1 AND team_id = $2',
      [userId, teamId],
    );

    if (existing.length === 0) {
      throw new BadRequestException('User is not a member of this team');
    }

    await execute(
      'DELETE FROM user_teams WHERE user_id = $1 AND team_id = $2',
      [userId, teamId],
    );

    return { message: 'Team member removed successfully' };
  }

  /**
   * Get team machines
   */
  async getTeamMachines(
    teamId: number,
    tenantId: number,
  ): Promise<TeamMachine[]> {
    this.logger.debug(`Fetching machines for team ${teamId}`);

    interface MachineRow extends RowDataPacket {
      id: number;
      name: string;
      serial_number: string | null;
      status: string | null;
      is_primary: boolean;
      assigned_at: Date | null;
      notes: string | null;
    }

    const [machines] = await execute<MachineRow[]>(
      `SELECT m.id, m.name, m.serial_number, m.status, mt.is_primary, mt.assigned_at, mt.notes
       FROM machine_teams mt
       JOIN machines m ON mt.machine_id = m.id
       WHERE mt.team_id = $1 AND mt.tenant_id = $2`,
      [teamId, tenantId],
    );

    return machines.map((machine: MachineRow) => ({
      id: machine.id,
      name: machine.name,
      serialNumber: machine.serial_number ?? undefined,
      status: machine.status ?? undefined,
      isPrimary: machine.is_primary,
      assignedAt: machine.assigned_at?.toISOString(),
      notes: machine.notes ?? undefined,
    }));
  }

  /**
   * Add machine to team
   */
  async addTeamMachine(
    teamId: number,
    machineId: number,
    tenantId: number,
    assignedBy: number,
  ): Promise<{ id: number; message: string }> {
    this.logger.log(`Adding machine ${machineId} to team ${teamId}`);

    const [machineRows] = await execute<RowDataPacket[]>(
      'SELECT id FROM machines WHERE id = $1 AND tenant_id = $2',
      [machineId, tenantId],
    );

    if (machineRows.length === 0) {
      throw new NotFoundException('Machine not found');
    }

    const [existing] = await execute<RowDataPacket[]>(
      'SELECT id FROM machine_teams WHERE machine_id = $1 AND team_id = $2 AND tenant_id = $3',
      [machineId, teamId, tenantId],
    );

    if (existing.length > 0) {
      throw new ConflictException('Machine already assigned to this team');
    }

    const [rows] = await execute<{ id: number }[]>(
      `INSERT INTO machine_teams (tenant_id, machine_id, team_id, assigned_by, assigned_at, is_primary)
       VALUES ($1, $2, $3, $4, NOW(), false)
       RETURNING id`,
      [tenantId, machineId, teamId, assignedBy],
    );

    return {
      id: rows[0]?.id ?? 0,
      message: 'Machine added to team successfully',
    };
  }

  /**
   * Remove machine from team
   */
  async removeTeamMachine(
    teamId: number,
    machineId: number,
    tenantId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Removing machine ${machineId} from team ${teamId}`);

    const [existing] = await execute<RowDataPacket[]>(
      'SELECT id FROM machine_teams WHERE machine_id = $1 AND team_id = $2 AND tenant_id = $3',
      [machineId, teamId, tenantId],
    );

    if (existing.length === 0) {
      throw new NotFoundException('Machine not assigned to this team');
    }

    await execute(
      'DELETE FROM machine_teams WHERE machine_id = $1 AND team_id = $2 AND tenant_id = $3',
      [machineId, teamId, tenantId],
    );

    return { message: 'Machine removed from team successfully' };
  }
}
