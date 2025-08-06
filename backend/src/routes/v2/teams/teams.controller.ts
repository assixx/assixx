/**
 * Teams v2 Controller
 * Handles HTTP requests and responses for team management
 */

import { Response } from "express";

import { RootLog } from "../../../models/rootLog.js";
import { AuthenticatedRequest } from "../../../types/request.types.js";
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

export class TeamsController {
  /**
   * List all teams
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
    } catch (error) {
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
   */
  async getTeamById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const teamId = parseInt(req.params.id);
      if (!req.user) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "User not authenticated"));
        return;
      }
      const team = await teamsService.getTeamById(teamId, req.user.tenant_id);

      res.json(successResponse(team));
    } catch (error) {
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
    } catch (error) {
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
   */
  async updateTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const teamId = parseInt(req.params.id);
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
    } catch (error) {
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
   */
  async deleteTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const teamId = parseInt(req.params.id);
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
        details: `Gelöscht: ${(deletedTeam as Team | null)?.name}`,
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
    } catch (error) {
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
   */
  async getTeamMembers(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const teamId = parseInt(req.params.id);
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
    } catch (error) {
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
   */
  async addTeamMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const teamId = parseInt(req.params.id);
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
    } catch (error) {
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
   */
  async removeTeamMember(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const teamId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);

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
    } catch (error) {
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
}

// Export singleton instance
export const teamsController = new TeamsController();
