/**
 * Teams v2 Service Layer
 * Handles all business logic for team management
 */
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

// eslint-disable-next-line @typescript-eslint/naming-convention
import Department from '../../../models/department.js';
// eslint-disable-next-line @typescript-eslint/naming-convention
import Team from '../../../models/team.js';
import type { TeamCreateData, TeamUpdateData } from '../../../models/team.js';
// eslint-disable-next-line @typescript-eslint/naming-convention
import User from '../../../models/user.js';
import { execute } from '../../../utils/db.js';
import { dbToApi } from '../../../utils/fieldMapping.js';
import { logger } from '../../../utils/logger.js';

/**
 *
 */
export class ServiceError extends Error {
  /**
   *
   * @param code - The code parameter
   * @param message - The message parameter
   * @param statusCode - The statusCode parameter
   * @param details - The details parameter
   */
  constructor(
    public code: string,
    public message: string,
    public statusCode = 500,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

const TEAM_NOT_FOUND_MSG = 'Team not found';

export interface TeamFilters {
  departmentId?: number;
  search?: string;
  includeMembers?: boolean;
}

export interface TeamCreateInput {
  name: string;
  description?: string;
  departmentId?: number;
  leaderId?: number;
}

export interface TeamUpdateInput {
  name?: string;
  description?: string;
  departmentId?: number;
  leaderId?: number;
  status?: 'active' | 'inactive';
}

/**
 *
 */
export class TeamsService {
  /**
   * List all teams for a tenant
   * @param tenantId - The tenant ID
   * @param filters - The filter criteria
   */
  async listTeams(tenantId: number, filters?: TeamFilters): Promise<Record<string, unknown>[]> {
    try {
      // Get all teams for the tenant
      const teams = await Team.findAll(tenantId);

      // Apply filters
      let filteredTeams = teams;

      if (filters?.departmentId) {
        filteredTeams = filteredTeams.filter((team) => team.department_id === filters.departmentId);
      }

      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        filteredTeams = filteredTeams.filter(
          (team) =>
            team.name.toLowerCase().includes(searchLower) ||
            team.description?.toLowerCase().includes(searchLower),
        );
      }

      // Convert to API format
      return filteredTeams.map((team) => {
        const apiTeam = dbToApi(team);

        // Map team_lead_id to leaderId
        if ('teamLeadId' in apiTeam) {
          apiTeam.leaderId = apiTeam.teamLeadId;
          delete apiTeam.teamLeadId;
        }

        // Map team_lead_name to leaderName
        if ('teamLeadName' in apiTeam) {
          apiTeam.leaderName = apiTeam.teamLeadName;
          delete apiTeam.teamLeadName;
        }

        // Convert empty strings to null for optional fields
        if (apiTeam.description === '') {
          apiTeam.description = null;
        }
        apiTeam.leaderId ??= null;

        // Include member count if requested
        if (filters?.includeMembers) {
          // This would need to be implemented in the model
          apiTeam.memberCount = 0; // Placeholder
        }

        return apiTeam;
      });
    } catch (error: unknown) {
      logger.error(`Error listing teams: ${(error as Error).message}`);
      throw new ServiceError('SERVER_ERROR', 'Failed to list teams', 500);
    }
  }

  /**
   * Get team by ID
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   */
  async getTeamById(id: number, tenantId: number): Promise<Record<string, unknown>> {
    try {
      const team = await Team.findById(id);

      if (!team) {
        throw new ServiceError('NOT_FOUND', TEAM_NOT_FOUND_MSG, 404);
      }

      // Check tenant isolation
      if (team.tenant_id !== tenantId) {
        throw new ServiceError('NOT_FOUND', TEAM_NOT_FOUND_MSG, 404);
      }

      // Get team members
      const members = await Team.getTeamMembers(id);

      // Get team machines
      const machines = await Team.getTeamMachines(id);

      const apiTeam = dbToApi(team);

      // Map team_lead_id to leaderId
      if ('teamLeadId' in apiTeam) {
        apiTeam.leaderId = apiTeam.teamLeadId;
        delete apiTeam.teamLeadId;
      }

      // Map team_lead_name to leaderName
      if ('teamLeadName' in apiTeam) {
        apiTeam.leaderName = apiTeam.teamLeadName;
        delete apiTeam.teamLeadName;
      }

      // Convert empty strings to null for optional fields
      if (apiTeam.description === '') {
        apiTeam.description = null;
      }
      apiTeam.leaderId ??= null;

      apiTeam.members = members.map((member) => ({
        id: member.id,
        username: member.username,
        email: member.email,
        firstName: member.first_name,
        lastName: member.last_name,
        position: member.position,
        employeeId: member.employee_id,
      }));

      // Add machines to response
      apiTeam.machines = machines;

      return apiTeam;
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      logger.error(`Error getting team ${id}: ${(error as Error).message}`);
      throw new ServiceError('SERVER_ERROR', 'Failed to get team', 500);
    }
  }

  /**
   * Create a new team
   * @param data - The data object
   * @param tenantId - The tenant ID
   */
  async createTeam(data: TeamCreateInput, tenantId: number): Promise<Record<string, unknown>> {
    try {
      // Validate department if provided
      if (data.departmentId) {
        const dept = await Department.findById(data.departmentId, tenantId);
        if (!dept) {
          throw new ServiceError('BAD_REQUEST', 'Invalid department ID', 400);
        }
      }

      // Validate leader if provided
      if (data.leaderId) {
        const leader = await User.findById(data.leaderId, tenantId);
        if (!leader) {
          throw new ServiceError('BAD_REQUEST', 'Invalid leader ID', 400);
        }
      }

      // Check for duplicate name
      const existingTeams = await Team.findAll(tenantId);
      const duplicate = existingTeams.find((t) => t.name.toLowerCase() === data.name.toLowerCase());

      if (duplicate) {
        throw new ServiceError('CONFLICT', 'Team with this name already exists', 409);
      }

      // Create the team
      const teamData: TeamCreateData = {
        name: data.name,
        description: data.description,
        department_id: data.departmentId,
        team_lead_id: data.leaderId,
        tenant_id: tenantId,
      };

      const teamId = await Team.create(teamData);

      // Return the created team
      return await this.getTeamById(teamId, tenantId);
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      logger.error(`Error creating team: ${(error as Error).message}`);
      throw new ServiceError('SERVER_ERROR', 'Failed to create team', 500);
    }
  }

  /**
   * Update a team
   * @param id - The resource ID
   * @param data - The data object
   * @param tenantId - The tenant ID
   */
  async updateTeam(
    id: number,
    data: TeamUpdateInput,
    tenantId: number,
  ): Promise<Record<string, unknown>> {
    try {
      // Check if team exists and belongs to tenant
      const existingTeam = await Team.findById(id);
      if (!existingTeam || existingTeam.tenant_id !== tenantId) {
        throw new ServiceError('NOT_FOUND', TEAM_NOT_FOUND_MSG, 404);
      }

      // Validate department if provided
      if (data.departmentId !== undefined && data.departmentId) {
        const dept = await Department.findById(data.departmentId, tenantId);
        if (!dept) {
          throw new ServiceError('BAD_REQUEST', 'Invalid department ID', 400);
        }
      }

      // Validate leader if provided
      if (data.leaderId !== undefined && data.leaderId) {
        const leader = await User.findById(data.leaderId, tenantId);
        if (!leader) {
          throw new ServiceError('BAD_REQUEST', 'Invalid leader ID', 400);
        }
      }

      // Check for duplicate name
      if (data.name && data.name !== existingTeam.name) {
        const teams = await Team.findAll(tenantId);
        const duplicate = teams.find(
          (t) => t.id !== id && t.name.toLowerCase() === (data.name?.toLowerCase() ?? ''),
        );

        if (duplicate) {
          throw new ServiceError('CONFLICT', 'Team with this name already exists', 409);
        }
      }

      // Update the team
      const updateData: TeamUpdateData = {};

      // Only include fields that are being updated
      if (data.name !== undefined) {
        updateData.name = data.name;
      }
      if (data.description !== undefined) {
        updateData.description = data.description;
      }
      if (data.departmentId !== undefined) {
        updateData.department_id = data.departmentId;
      }
      if (data.leaderId !== undefined) {
        updateData.team_lead_id = data.leaderId;
      }
      if (data.status !== undefined) {
        // Convert status string to is_active boolean
        updateData.is_active = data.status === 'active' ? 1 : 0;
      }

      const success = await Team.update(id, updateData);
      if (!success) {
        throw new ServiceError('SERVER_ERROR', 'Failed to update team', 500);
      }

      // Return updated team
      return await this.getTeamById(id, tenantId);
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      logger.error(`Error updating team ${id}: ${(error as Error).message}`);
      throw new ServiceError('SERVER_ERROR', 'Failed to update team', 500);
    }
  }

  /**
   * Delete a team
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   * @param force - If true, removes all team members before deleting the team
   */
  async deleteTeam(id: number, tenantId: number, force = false): Promise<{ message: string }> {
    try {
      // Check if team exists and belongs to tenant
      const team = await Team.findById(id);
      if (!team || team.tenant_id !== tenantId) {
        throw new ServiceError('NOT_FOUND', TEAM_NOT_FOUND_MSG, 404);
      }

      // Check if team has members
      const members = await Team.getTeamMembers(id);
      if (members.length > 0) {
        if (force) {
          // Remove all team members first
          for (const member of members) {
            await Team.removeUserFromTeam(member.id, id);
          }
        } else {
          throw new ServiceError('BAD_REQUEST', 'Cannot delete team with members', 400, {
            memberCount: members.length,
          });
        }
      }

      const success = await Team.delete(id);
      if (!success) {
        throw new ServiceError('SERVER_ERROR', 'Failed to delete team', 500);
      }

      return { message: 'Team deleted successfully' };
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      logger.error(`Error deleting team ${id}: ${(error as Error).message}`);
      throw new ServiceError('SERVER_ERROR', 'Failed to delete team', 500);
    }
  }

  /**
   * Get team members
   * @param teamId - The teamId parameter
   * @param tenantId - The tenant ID
   */
  async getTeamMembers(teamId: number, tenantId: number): Promise<Record<string, unknown>[]> {
    try {
      // Check if team exists and belongs to tenant
      const team = await Team.findById(teamId);
      if (!team || team.tenant_id !== tenantId) {
        throw new ServiceError('NOT_FOUND', TEAM_NOT_FOUND_MSG, 404);
      }

      const members = await Team.getTeamMembers(teamId);

      return members.map((member) => ({
        id: member.id,
        username: member.username,
        email: member.email,
        firstName: member.first_name,
        lastName: member.last_name,
        position: member.position,
        employeeId: member.employee_id,
      }));
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      logger.error(`Error getting team members: ${(error as Error).message}`);
      throw new ServiceError('SERVER_ERROR', 'Failed to get team members', 500);
    }
  }

  /**
   * Add member to team
   * @param teamId - The teamId parameter
   * @param userId - The user ID
   * @param tenantId - The tenant ID
   */
  async addTeamMember(
    teamId: number,
    userId: number,
    tenantId: number,
  ): Promise<{ message: string }> {
    try {
      // Check if team exists and belongs to tenant
      const team = await Team.findById(teamId);
      if (!team || team.tenant_id !== tenantId) {
        throw new ServiceError('NOT_FOUND', TEAM_NOT_FOUND_MSG, 404);
      }

      // Check if user exists and belongs to tenant
      const user = await User.findById(userId, tenantId);
      if (!user) {
        throw new ServiceError('BAD_REQUEST', 'Invalid user ID', 400);
      }

      const success = await Team.addUserToTeam(userId, teamId, tenantId);
      if (!success) {
        throw new ServiceError('SERVER_ERROR', 'Failed to add team member', 500);
      }

      return { message: 'Team member added successfully' };
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }

      const errorMessage = (error as Error).message;
      logger.error(`Error adding team member: ${errorMessage}`);

      // Handle duplicate member error
      if (errorMessage.includes('already a member')) {
        throw new ServiceError('CONFLICT', 'User is already a member of this team', 409);
      }

      throw new ServiceError('SERVER_ERROR', 'Failed to add team member', 500);
    }
  }

  /**
   * Remove member from team
   * @param teamId - The teamId parameter
   * @param userId - The user ID
   * @param tenantId - The tenant ID
   */
  async removeTeamMember(
    teamId: number,
    userId: number,
    tenantId: number,
  ): Promise<{ message: string }> {
    try {
      // Check if team exists and belongs to tenant
      const team = await Team.findById(teamId);
      if (!team || team.tenant_id !== tenantId) {
        throw new ServiceError('NOT_FOUND', TEAM_NOT_FOUND_MSG, 404);
      }

      const success = await Team.removeUserFromTeam(userId, teamId);
      if (!success) {
        throw new ServiceError('BAD_REQUEST', 'User is not a member of this team', 400);
      }

      return { message: 'Team member removed successfully' };
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      logger.error(`Error removing team member: ${(error as Error).message}`);
      throw new ServiceError('SERVER_ERROR', 'Failed to remove team member', 500);
    }
  }

  /**
   * Get team machines
   * @param teamId - The teamId parameter
   * @param tenantId - The tenant ID
   */
  async getTeamMachines(teamId: number, tenantId: number): Promise<unknown[]> {
    try {
      // Get machines assigned to this team
      const [result] = await execute(
        `SELECT
          m.id,
          m.name,
          m.serial_number,
          m.status,
          mt.is_primary,
          mt.assigned_at,
          mt.notes
        FROM machine_teams mt
        JOIN machines m ON mt.machine_id = m.id
        WHERE mt.team_id = ? AND mt.tenant_id = ?`,
        [teamId, tenantId],
      );

      return result as unknown[];
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      logger.error(`Error getting team machines: ${(error as Error).message}`);
      throw new ServiceError('SERVER_ERROR', 'Failed to get team machines', 500);
    }
  }

  /**
   * Add machine to team
   * @param teamId - The teamId parameter
   * @param machineId - The machineId parameter
   * @param tenantId - The tenant ID
   * @param assignedBy - The assignedBy parameter
   */
  async addTeamMachine(
    teamId: number,
    machineId: number,
    tenantId: number,
    assignedBy: number,
  ): Promise<{ id: number; message: string }> {
    try {
      // Check if machine exists
      const [machineResult] = await execute(
        'SELECT id FROM machines WHERE id = ? AND tenant_id = ?',
        [machineId, tenantId],
      );

      if ((machineResult as RowDataPacket[]).length === 0) {
        throw new ServiceError('NOT_FOUND', 'Machine not found', 404);
      }

      // Check if machine is already assigned to this team
      const [existingResult] = await execute(
        'SELECT id FROM machine_teams WHERE machine_id = ? AND team_id = ? AND tenant_id = ?',
        [machineId, teamId, tenantId],
      );

      if ((existingResult as RowDataPacket[]).length > 0) {
        throw new ServiceError('CONFLICT', 'Machine already assigned to this team', 409);
      }

      // Add machine to team
      const [result] = await execute(
        `INSERT INTO machine_teams (tenant_id, machine_id, team_id, assigned_by, is_primary)
         VALUES (?, ?, ?, ?, ?)`,
        [tenantId, machineId, teamId, assignedBy, false],
      );

      return {
        id: (result as ResultSetHeader).insertId,
        message: 'Machine added to team successfully',
      };
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      logger.error(`Error adding machine to team: ${(error as Error).message}`);
      throw new ServiceError('SERVER_ERROR', 'Failed to add machine to team', 500);
    }
  }

  /**
   * Remove machine from team
   * @param teamId - The teamId parameter
   * @param machineId - The machineId parameter
   * @param tenantId - The tenant ID
   */
  async removeTeamMachine(
    teamId: number,
    machineId: number,
    tenantId: number,
  ): Promise<{ message: string }> {
    try {
      // Check if machine is assigned to this team
      const [existingResult] = await execute(
        'SELECT id FROM machine_teams WHERE machine_id = ? AND team_id = ? AND tenant_id = ?',
        [machineId, teamId, tenantId],
      );

      if ((existingResult as RowDataPacket[]).length === 0) {
        throw new ServiceError('NOT_FOUND', 'Machine not assigned to this team', 404);
      }

      // Remove machine from team
      await execute(
        'DELETE FROM machine_teams WHERE machine_id = ? AND team_id = ? AND tenant_id = ?',
        [machineId, teamId, tenantId],
      );

      return { message: 'Machine removed from team successfully' };
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      logger.error(`Error removing machine from team: ${(error as Error).message}`);
      throw new ServiceError('SERVER_ERROR', 'Failed to remove machine from team', 500);
    }
  }
}

// Export singleton instance
export const teamsService = new TeamsService();
