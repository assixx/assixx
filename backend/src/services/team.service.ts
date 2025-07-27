/**
 * Team Service
 * Handles team-related business logic
 */

import { Pool } from "mysql2/promise";

import Team, {
  DbTeam,
  TeamCreateData as ModelTeamCreateData,
  TeamUpdateData as ModelTeamUpdateData,
} from "../models/team";
/**
 * Team Service
 * Handles team-related business logic
 */

// Import types from Team model
// Service-specific interfaces
interface TeamData extends Omit<DbTeam, 'team_lead_id'> {
  team_lead_id?: number | null;
  team_lead_name?: string | null;
  member_count?: number;
}

interface TeamFilters {
  department_id?: number;
  team_lead_id?: number;
  search?: string;
  include_counts?: boolean;
  limit?: number;
  offset?: number;
}

interface TeamCreateData extends Omit<ModelTeamCreateData, 'team_lead_id'> {
  team_lead_id?: number | null;
}

interface TeamUpdateData extends Omit<ModelTeamUpdateData, 'team_lead_id'> {
  team_lead_id?: number | null;
}

class TeamService {
  /**
   * Holt alle Team Einträge für einen Tenant
   */
  async getAll(
    _tenantDb: Pool,
    _filters: TeamFilters = {},
  ): Promise<TeamData[]> {
    try {
      // Get tenant_id from filters or extract from tenantDb
      const teams = await Team.findAll();
      return teams.map((team) => ({
        ...team,
        team_lead_id: team.team_lead_id,
        team_lead_name: null as string | null,
        member_count: 0,
      }));
    } catch (error) {
      console.error("Error in TeamService.getAll:", error);
      throw error;
    }
  }

  /**
   * Holt einen Team Eintrag per ID
   */
  async getById(_tenantDb: Pool, id: number): Promise<TeamData | null> {
    try {
      const team = await Team.findById(id);
      if (!team) return null;

      return {
        ...team,
        team_lead_id: team.team_lead_id,
        team_lead_name: null,
        member_count: 0,
      };
    } catch (error) {
      console.error("Error in TeamService.getById:", error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Team Eintrag
   */
  async create(_tenantDb: Pool, data: TeamCreateData): Promise<TeamData> {
    try {
      const modelData: ModelTeamCreateData = {
        ...data,
        team_lead_id:
          data.team_lead_id !== null ? data.team_lead_id : undefined,
      };
      const id = await Team.create(modelData);
      const created = await Team.findById(id);
      if (!created) {
        throw new Error("Failed to retrieve created team");
      }
      return {
        ...created,
        team_lead_id: created.team_lead_id,
        team_lead_name: null,
        member_count: 0,
      };
    } catch (error) {
      console.error("Error in TeamService.create:", error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Team Eintrag
   */
  async update(
    tenantDb: Pool,
    id: number,
    data: TeamUpdateData,
  ): Promise<TeamData | null> {
    try {
      const modelData: ModelTeamUpdateData = {
        ...data,
        team_lead_id:
          data.team_lead_id !== null ? data.team_lead_id : undefined,
      };
      const success = await Team.update(id, modelData);
      if (success) {
        return await this.getById(tenantDb, id);
      }
      return null;
    } catch (error) {
      console.error("Error in TeamService.update:", error);
      throw error;
    }
  }

  /**
   * Löscht einen Team Eintrag
   */
  async delete(_tenantDb: Pool, id: number): Promise<boolean> {
    try {
      // TODO: Team.delete expects different parameters
      return await Team.delete(id);
    } catch (error) {
      console.error("Error in TeamService.delete:", error);
      throw error;
    }
  }
}

// Export singleton instance
const teamService = new TeamService();
export default teamService;

// Named export for the class
export { TeamService };

// CommonJS compatibility
