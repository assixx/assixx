/**
 * Teams v2 Controller
 * Handles HTTP requests and responses for team management
 */
import { Response } from 'express';

import rootLog from '../../../models/rootLog.js';
import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { errorResponse, successResponse } from '../../../utils/apiResponse.js';
import { logger } from '../../../utils/logger.js';
import { ServiceError, teamsService } from './teams.service.js';

// Constants
const USER_AGENT_HEADER = 'user-agent';
const TEAM_ID_REQUIRED_MSG = 'Team ID is required';

interface Team {
  id: number;
  name: string;
  description?: string;
  departmentId?: number;
  leaderId?: number;
  [key: string]: unknown;
}

// Request body types
interface CreateTeamBody {
  name: string;
  description?: string;
  departmentId?: number;
  leaderId?: number;
}

interface UpdateTeamBody {
  name?: string;
  description?: string;
  departmentId?: number;
  leaderId?: number;
  status?: 'active' | 'inactive';
}

interface AddMemberBody {
  userId: number;
}

interface AddMachineBody {
  machineId: number;
}

/**
 *
 */
class TeamsController {
  /**
   *
   */
  constructor() {
    // Bind all methods to ensure correct context
    this.listTeams = this.listTeams.bind(this);
    this.getTeamById = this.getTeamById.bind(this);
    this.createTeam = this.createTeam.bind(this);
    this.updateTeam = this.updateTeam.bind(this);
    this.deleteTeam = this.deleteTeam.bind(this);
    this.getTeamMembers = this.getTeamMembers.bind(this);
    this.addTeamMember = this.addTeamMember.bind(this);
    this.removeTeamMember = this.removeTeamMember.bind(this);
    this.getTeamMachines = this.getTeamMachines.bind(this);
    this.addTeamMachine = this.addTeamMachine.bind(this);
    this.removeTeamMachine = this.removeTeamMachine.bind(this);
  }

  /** Build update data object from request body */
  private buildUpdateData(body: UpdateTeamBody): {
    name?: string;
    description?: string;
    departmentId?: number;
    leaderId?: number;
    status?: 'active' | 'inactive';
  } {
    const updateData: {
      name?: string;
      description?: string;
      departmentId?: number;
      leaderId?: number;
      status?: 'active' | 'inactive';
    } = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.departmentId !== undefined) updateData.departmentId = body.departmentId;
    if (body.leaderId !== undefined) updateData.leaderId = body.leaderId;
    if (body.status !== undefined) updateData.status = body.status;

    return updateData;
  }

  /** Log team action to audit log */
  private async logTeamAction(
    req: AuthenticatedRequest,
    tenantId: number,
    action: string,
    entityId: number,
    details: string,
    oldValues?: Record<string, unknown>,
    newValues?: Record<string, unknown>,
  ): Promise<void> {
    await rootLog.create({
      tenant_id: tenantId,
      user_id: req.user.id,
      action,
      entity_type: 'team',
      entity_id: entityId,
      details,
      old_values: oldValues,
      new_values: newValues,
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get(USER_AGENT_HEADER),
      was_role_switched: false,
    });
  }

  /**
   * List all teams
   * @param req - The request object
   * @param res - The response object
   */
  async listTeams(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Build filters object without undefined values to satisfy exactOptionalPropertyTypes
      const filters: {
        departmentId?: number;
        search?: string;
        includeMembers?: boolean;
      } = {
        includeMembers: req.query['includeMembers'] === 'true',
      };

      const departmentIdQuery = req.query['departmentId'];
      if (typeof departmentIdQuery === 'string' && departmentIdQuery !== '') {
        filters.departmentId = Number(departmentIdQuery);
      }

      const searchQuery = req.query['search'];
      if (typeof searchQuery === 'string' && searchQuery !== '') {
        filters.search = searchQuery;
      }

      const tenantId = req.user.tenant_id;
      const teams = await teamsService.listTeams(tenantId, filters);

      res.json(successResponse(teams));
    } catch (error: unknown) {
      logger.error('Error in listTeams:', error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode ?? 500)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to list teams'));
      }
    }
  }

  /**
   * Get team by ID
   * @param req - The request object
   * @param res - The response object
   */
  async getTeamById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const idParam = req.params['id'];
      if (idParam === undefined) {
        res.status(400).json(errorResponse('BAD_REQUEST', TEAM_ID_REQUIRED_MSG));
        return;
      }
      const teamId = Number.parseInt(idParam);
      const tenantId = req.user.tenant_id;
      const team = await teamsService.getTeamById(teamId, tenantId);

      res.json(successResponse(team));
    } catch (error: unknown) {
      logger.error('Error in getTeamById:', error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode ?? 500)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get team'));
      }
    }
  }

  /**
   * Create new team
   * @param req - The request object
   * @param res - The response object
   */
  async createTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const body = req.body as CreateTeamBody;

      // Build teamData object without undefined values to satisfy exactOptionalPropertyTypes
      const teamData: {
        name: string;
        description?: string;
        departmentId?: number;
        leaderId?: number;
      } = {
        name: body.name,
      };

      if (body.description !== undefined) {
        teamData.description = body.description;
      }

      if (body.departmentId !== undefined) {
        teamData.departmentId = body.departmentId;
      }

      if (body.leaderId !== undefined) {
        teamData.leaderId = body.leaderId;
      }

      const tenantId = req.user.tenant_id;
      const team = await teamsService.createTeam(teamData, tenantId);

      await this.logTeamAction(
        req,
        tenantId,
        'create',
        (team as Team).id,
        `Erstellt: ${teamData.name}`,
        undefined,
        {
          name: teamData.name,
          description: teamData.description,
          department_id: teamData.departmentId,
          leader_id: teamData.leaderId,
          created_by: req.user.email,
        },
      );

      res.status(201).json(successResponse(team, 'Team created successfully'));
    } catch (error: unknown) {
      logger.error('Error in createTeam:', error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode ?? 500)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to create team'));
      }
    }
  }

  /**
   * Update team
   * @param req - The request object
   * @param res - The response object
   */
  async updateTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const idParam = req.params['id'];
      if (idParam === undefined) {
        res.status(400).json(errorResponse('BAD_REQUEST', TEAM_ID_REQUIRED_MSG));
        return;
      }
      const teamId = Number.parseInt(idParam);
      const body = req.body as UpdateTeamBody;
      const updateData = this.buildUpdateData(body);
      const tenantId = req.user.tenant_id;
      const oldTeam = (await teamsService.getTeamById(teamId, tenantId)) as Team | null;
      const team = await teamsService.updateTeam(teamId, updateData, tenantId);

      await this.logTeamAction(
        req,
        tenantId,
        'update',
        teamId,
        `Aktualisiert: ${updateData.name ?? 'Team'}`,
        {
          name: oldTeam?.name,
          description: oldTeam?.description,
          department_id: oldTeam?.departmentId,
          leader_id: oldTeam?.leaderId,
          status: oldTeam?.['status'],
        },
        {
          name: updateData.name,
          description: updateData.description,
          department_id: updateData.departmentId,
          leader_id: updateData.leaderId,
          status: updateData.status,
          updated_by: req.user.email,
        },
      );

      res.json(successResponse(team, 'Team updated successfully'));
    } catch (error: unknown) {
      logger.error('Error in updateTeam:', error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode ?? 500)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to update team'));
      }
    }
  }

  /**
   * Delete team
   * @param req - The request object
   * @param res - The response object
   */
  async deleteTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const idParam = req.params['id'];
      if (idParam === undefined) {
        res.status(400).json(errorResponse('BAD_REQUEST', TEAM_ID_REQUIRED_MSG));
        return;
      }
      const teamId = Number.parseInt(idParam);
      const force = req.query['force'] === 'true';
      const tenantId = req.user.tenant_id;
      const deletedTeam = (await teamsService.getTeamById(teamId, tenantId)) as Team | null;
      const result = await teamsService.deleteTeam(teamId, tenantId, force);

      await this.logTeamAction(
        req,
        tenantId,
        'delete',
        teamId,
        `Gelöscht: ${String(deletedTeam?.name)}`,
        {
          name: deletedTeam?.name,
          description: deletedTeam?.description,
          department_id: deletedTeam?.departmentId,
          leader_id: deletedTeam?.leaderId,
          deleted_by: req.user.email,
        },
      );

      res.json(successResponse(result));
    } catch (error: unknown) {
      logger.error('Error in deleteTeam:', error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode ?? 500)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to delete team'));
      }
    }
  }

  /**
   * Get team members
   * @param req - The request object
   * @param res - The response object
   */
  async getTeamMembers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const idParam = req.params['id'];
      if (idParam === undefined) {
        res.status(400).json(errorResponse('BAD_REQUEST', TEAM_ID_REQUIRED_MSG));
        return;
      }
      const teamId = Number.parseInt(idParam);
      const tenantId = req.user.tenant_id;
      const members = await teamsService.getTeamMembers(teamId, tenantId);

      res.json(successResponse(members));
    } catch (error: unknown) {
      logger.error('Error in getTeamMembers:', error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode ?? 500)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get team members'));
      }
    }
  }

  /**
   * Add team member
   * @param req - The request object
   * @param res - The response object
   */
  async addTeamMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const idParam = req.params['id'];
      if (idParam === undefined) {
        res.status(400).json(errorResponse('BAD_REQUEST', TEAM_ID_REQUIRED_MSG));
        return;
      }
      const teamId = Number.parseInt(idParam);
      const body = req.body as AddMemberBody;
      const userId = body.userId;
      const tenantId = req.user.tenant_id;
      const result = await teamsService.addTeamMember(teamId, userId, tenantId);

      await this.logTeamAction(
        req,
        tenantId,
        'add_member',
        teamId,
        'Mitglied hinzugefügt',
        undefined,
        {
          user_id: userId,
          added_by: req.user.email,
        },
      );

      res.status(201).json(successResponse(result));
    } catch (error: unknown) {
      logger.error('Error in addTeamMember:', error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode ?? 500)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to add team member'));
      }
    }
  }

  /**
   * Remove team member
   * @param req - The request object
   * @param res - The response object
   */
  async removeTeamMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const idParam = req.params['id'];
      const userIdParam = req.params['userId'];
      if (idParam === undefined) {
        res.status(400).json(errorResponse('BAD_REQUEST', TEAM_ID_REQUIRED_MSG));
        return;
      }
      if (userIdParam === undefined) {
        res.status(400).json(errorResponse('BAD_REQUEST', 'User ID is required'));
        return;
      }
      const teamId = Number.parseInt(idParam);
      const userId = Number.parseInt(userIdParam);
      const tenantId = req.user.tenant_id;
      const result = await teamsService.removeTeamMember(teamId, userId, tenantId);

      res.json(successResponse(result));
    } catch (error: unknown) {
      logger.error('Error in removeTeamMember:', error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode ?? 500)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to remove team member'));
      }
    }
  }

  /**
   * Get team machines
   * @param req - The request object
   * @param res - The response object
   */
  async getTeamMachines(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const idParam = req.params['id'];
      if (idParam === undefined) {
        res.status(400).json(errorResponse('BAD_REQUEST', TEAM_ID_REQUIRED_MSG));
        return;
      }
      const teamId = Number.parseInt(idParam);
      const tenantId = req.user.tenant_id;
      const machines = await teamsService.getTeamMachines(teamId, tenantId);

      res.json(successResponse(machines));
    } catch (error: unknown) {
      logger.error('Error in getTeamMachines:', error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode ?? 500)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get team machines'));
      }
    }
  }

  /**
   * Add machine to team
   * @param req - The request object
   * @param res - The response object
   */
  async addTeamMachine(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const idParam = req.params['id'];
      if (idParam === undefined) {
        res.status(400).json(errorResponse('BAD_REQUEST', TEAM_ID_REQUIRED_MSG));
        return;
      }
      const teamId = Number.parseInt(idParam);
      const body = req.body as AddMachineBody;
      const machineId = body.machineId;
      const tenantId = req.user.tenant_id;
      const result = await teamsService.addTeamMachine(teamId, machineId, tenantId, req.user.id);

      await this.logTeamAction(
        req,
        tenantId,
        'add_machine',
        teamId,
        'Maschine hinzugefügt',
        undefined,
        {
          machine_id: machineId,
          added_by: req.user.email,
        },
      );

      res.status(201).json(successResponse(result));
    } catch (error: unknown) {
      logger.error('Error in addTeamMachine:', error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode ?? 500)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to add machine to team'));
      }
    }
  }

  /**
   * Remove machine from team
   * @param req - The request object
   * @param res - The response object
   */
  async removeTeamMachine(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const idParam = req.params['id'];
      const machineIdParam = req.params['machineId'];
      if (idParam === undefined) {
        res.status(400).json(errorResponse('BAD_REQUEST', TEAM_ID_REQUIRED_MSG));
        return;
      }
      if (machineIdParam === undefined) {
        res.status(400).json(errorResponse('BAD_REQUEST', 'Machine ID is required'));
        return;
      }
      const teamId = Number.parseInt(idParam);
      const machineId = Number.parseInt(machineIdParam);
      const tenantId = req.user.tenant_id;
      const result = await teamsService.removeTeamMachine(teamId, machineId, tenantId);

      res.json(successResponse(result));
    } catch (error: unknown) {
      logger.error('Error in removeTeamMachine:', error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode ?? 500)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to remove machine from team'));
      }
    }
  }
}

// Export singleton instance
export const teamsController = new TeamsController();
