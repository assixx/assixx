/**
 * Teams v2 Controller
 * Handles HTTP requests and responses for team management
 */

import { Response } from "express";

import RootLog from "../../../models/rootLog";
import type { AuthenticatedRequest } from "../../../types/request.types.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { logger } from "../../../utils/logger.js";

import { teamsService, ServiceError } from "./teams.service.js";

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
export class TeamsController {
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

  /**
   * List all teams
   * @param req
   * @param res
   */
  async listTeams(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const filters = {
        departmentId: req.query.departmentId
          ? Number(req.query.departmentId)
          : undefined,
        search: req.query.search as string,
        includeMembers: req.query.includeMembers === "true",
      };

      if (!req.user) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "User not authenticated"));
        return;
      }
      const teams = await teamsService.listTeams(req.user.tenant_id, filters);

      res.json(successResponse(teams));
    } catch (error: unknown) {
      logger.error("Error in listTeams:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to list teams"));
      }
    }
  }

  /**
   * Get team by ID
   * @param req
   * @param res
   */
  async getTeamById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const teamId = Number.parseInt(req.params.id);
      if (!req.user) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "User not authenticated"));
        return;
      }
      const team = await teamsService.getTeamById(teamId, req.user.tenant_id);

      res.json(successResponse(team));
    } catch (error: unknown) {
      logger.error("Error in getTeamById:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to get team"));
      }
    }
  }

  /**
   * Create new team
   * @param req
   * @param res
   */
  async createTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const body = req.body as CreateTeamBody;
      const teamData = {
        name: body.name,
        description: body.description,
        departmentId: body.departmentId,
        leaderId: body.leaderId,
      };

      if (!req.user) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "User not authenticated"));
        return;
      }
      const team = await teamsService.createTeam(teamData, req.user.tenant_id);

      // Log team creation
      await RootLog.create({
        tenant_id: req.user.tenant_id,
        user_id: req.user.id,
        action: "create",
        entity_type: "team",
        entity_id: (team as Team).id,
        details: `Erstellt: ${teamData.name}`,
        new_values: {
          name: teamData.name,
          description: teamData.description,
          department_id: teamData.departmentId,
          leader_id: teamData.leaderId,
          created_by: req.user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get("user-agent"),
        was_role_switched: false,
      });

      res.status(201).json(successResponse(team, "Team created successfully"));
    } catch (error: unknown) {
      logger.error("Error in createTeam:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to create team"));
      }
    }
  }

  /**
   * Update team
   * @param req
   * @param res
   */
  async updateTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const teamId = Number.parseInt(req.params.id);
      const body = req.body as UpdateTeamBody;
      const updateData = {
        name: body.name,
        description: body.description,
        departmentId: body.departmentId,
        leaderId: body.leaderId,
      };

      if (!req.user) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "User not authenticated"));
        return;
      }
      // Get old team data for logging
      const oldTeam = await teamsService.getTeamById(
        teamId,
        req.user.tenant_id,
      );

      const team = await teamsService.updateTeam(
        teamId,
        updateData,
        req.user.tenant_id,
      );

      // Log team update
      await RootLog.create({
        tenant_id: req.user.tenant_id,
        user_id: req.user.id,
        action: "update",
        entity_type: "team",
        entity_id: teamId,
        details: `Aktualisiert: ${updateData.name}`,
        old_values: {
          name: (oldTeam as Team | null)?.name,
          description: (oldTeam as Team | null)?.description,
          department_id: (oldTeam as Team | null)?.departmentId,
          leader_id: (oldTeam as Team | null)?.leaderId,
        },
        new_values: {
          name: updateData.name,
          description: updateData.description,
          department_id: updateData.departmentId,
          leader_id: updateData.leaderId,
          updated_by: req.user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get("user-agent"),
        was_role_switched: false,
      });

      res.json(successResponse(team, "Team updated successfully"));
    } catch (error: unknown) {
      logger.error("Error in updateTeam:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to update team"));
      }
    }
  }

  /**
   * Delete team
   * @param req
   * @param res
   */
  async deleteTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const teamId = Number.parseInt(req.params.id);
      if (!req.user) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "User not authenticated"));
        return;
      }
      // Get team data before deletion for logging
      const deletedTeam = await teamsService.getTeamById(
        teamId,
        req.user.tenant_id,
      );

      const result = await teamsService.deleteTeam(teamId, req.user.tenant_id);

      // Log team deletion
      await RootLog.create({
        tenant_id: req.user.tenant_id,
        user_id: req.user.id,
        action: "delete",
        entity_type: "team",
        entity_id: teamId,
        details: `Gelöscht: ${String((deletedTeam as Team | null)?.name)}`,
        old_values: {
          name: (deletedTeam as Team | null)?.name,
          description: (deletedTeam as Team | null)?.description,
          department_id: (deletedTeam as Team | null)?.departmentId,
          leader_id: (deletedTeam as Team | null)?.leaderId,
          deleted_by: req.user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get("user-agent"),
        was_role_switched: false,
      });

      res.json(successResponse(result));
    } catch (error: unknown) {
      logger.error("Error in deleteTeam:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to delete team"));
      }
    }
  }

  /**
   * Get team members
   * @param req
   * @param res
   */
  async getTeamMembers(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const teamId = Number.parseInt(req.params.id);
      if (!req.user) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "User not authenticated"));
        return;
      }
      const members = await teamsService.getTeamMembers(
        teamId,
        req.user.tenant_id,
      );

      res.json(successResponse(members));
    } catch (error: unknown) {
      logger.error("Error in getTeamMembers:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to get team members"));
      }
    }
  }

  /**
   * Add team member
   * @param req
   * @param res
   */
  async addTeamMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const teamId = Number.parseInt(req.params.id);
      const body = req.body as AddMemberBody;
      const userId = body.userId;

      if (!req.user) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "User not authenticated"));
        return;
      }
      const result = await teamsService.addTeamMember(
        teamId,
        userId,
        req.user.tenant_id,
      );

      // Log team member addition
      await RootLog.create({
        tenant_id: req.user.tenant_id,
        user_id: req.user.id,
        action: "add_member",
        entity_type: "team",
        entity_id: teamId,
        details: `Mitglied hinzugefügt`,
        new_values: {
          user_id: userId,
          added_by: req.user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get("user-agent"),
        was_role_switched: false,
      });

      res.status(201).json(successResponse(result));
    } catch (error: unknown) {
      logger.error("Error in addTeamMember:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to add team member"));
      }
    }
  }

  /**
   * Remove team member
   * @param req
   * @param res
   */
  async removeTeamMember(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const teamId = Number.parseInt(req.params.id);
      const userId = Number.parseInt(req.params.userId);

      if (!req.user) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "User not authenticated"));
        return;
      }
      const result = await teamsService.removeTeamMember(
        teamId,
        userId,
        req.user.tenant_id,
      );

      res.json(successResponse(result));
    } catch (error: unknown) {
      logger.error("Error in removeTeamMember:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to remove team member"));
      }
    }
  }

  /**
   * Get team machines
   * @param req
   * @param res
   */
  async getTeamMachines(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const teamId = Number.parseInt(req.params.id);
      if (!req.user) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "User not authenticated"));
        return;
      }
      const machines = await teamsService.getTeamMachines(
        teamId,
        req.user.tenant_id,
      );

      res.json(successResponse(machines));
    } catch (error: unknown) {
      logger.error("Error in getTeamMachines:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to get team machines"));
      }
    }
  }

  /**
   * Add machine to team
   * @param req
   * @param res
   */
  async addTeamMachine(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const teamId = Number.parseInt(req.params.id);
      const body = req.body as AddMachineBody;
      const machineId = body.machineId;

      if (!req.user) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "User not authenticated"));
        return;
      }
      const result = await teamsService.addTeamMachine(
        teamId,
        machineId,
        req.user.tenant_id,
        req.user.id,
      );

      // Log team machine addition
      await RootLog.create({
        tenant_id: req.user.tenant_id,
        user_id: req.user.id,
        action: "add_machine",
        entity_type: "team",
        entity_id: teamId,
        details: `Maschine hinzugefügt`,
        new_values: {
          machine_id: machineId,
          added_by: req.user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get("user-agent"),
        was_role_switched: false,
      });

      res.status(201).json(successResponse(result));
    } catch (error: unknown) {
      logger.error("Error in addTeamMachine:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to add machine to team"));
      }
    }
  }

  /**
   * Remove machine from team
   * @param req
   * @param res
   */
  async removeTeamMachine(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const teamId = Number.parseInt(req.params.id);
      const machineId = Number.parseInt(req.params.machineId);

      if (!req.user) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "User not authenticated"));
        return;
      }
      const result = await teamsService.removeTeamMachine(
        teamId,
        machineId,
        req.user.tenant_id,
      );

      res.json(successResponse(result));
    } catch (error: unknown) {
      logger.error("Error in removeTeamMachine:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(
            errorResponse("SERVER_ERROR", "Failed to remove machine from team"),
          );
      }
    }
  }
}

// Export singleton instance
export const teamsController = new TeamsController();
