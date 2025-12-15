/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Team Service
 * Handles team-related business logic
 */
import Team, {
  DbTeam,
  TeamCreateData as ModelTeamCreateData,
  TeamUpdateData as ModelTeamUpdateData,
} from '../routes/v2/teams/team.model.js';
import { Pool } from '../utils/db.js';

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

/**
 *
 */
class TeamService {
  /**
   * Holt alle Team Einträge für einen Tenant
   * @param _tenantDb - The _tenantDb parameter
   * @param _filters - The _filters parameter
   */
  async getAll(_tenantDb: Pool, _filters: TeamFilters = {}): Promise<TeamData[]> {
    try {
      // Get tenant_id from filters or extract from tenantDb
      const teams = await Team.findAll();
      return teams.map((team: DbTeam) => {
        const result: TeamData = {
          ...team,
          team_lead_name: null as string | null,
          member_count: 0,
        };
        if (team.team_lead_id !== undefined) {
          result.team_lead_id = team.team_lead_id;
        }
        return result;
      });
    } catch (error: unknown) {
      console.error('Error in TeamService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen Team Eintrag per ID
   * @param _tenantDb - The _tenantDb parameter
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   */
  async getById(_tenantDb: Pool, id: number, tenantId: number): Promise<TeamData | null> {
    try {
      const team = await Team.findById(id, tenantId);
      if (!team) return null;

      const result: TeamData = {
        ...team,
        team_lead_name: null,
        member_count: 0,
      };
      if (team.team_lead_id !== undefined) {
        result.team_lead_id = team.team_lead_id;
      }
      return result;
    } catch (error: unknown) {
      console.error('Error in TeamService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Team Eintrag
   * @param _tenantDb - The _tenantDb parameter
   * @param data - The data object
   */
  async create(_tenantDb: Pool, data: TeamCreateData): Promise<TeamData> {
    try {
      const modelData: ModelTeamCreateData = {
        tenant_id: data.tenant_id,
        name: data.name,
      };
      if (data.description !== undefined) {
        modelData.description = data.description;
      }
      if (data.department_id !== undefined) {
        modelData.department_id = data.department_id;
      }
      if (data.team_lead_id !== null && data.team_lead_id !== undefined) {
        modelData.team_lead_id = data.team_lead_id;
      }
      const id = await Team.create(modelData);
      const created = await Team.findById(id, data.tenant_id);
      if (!created) {
        throw new Error('Failed to retrieve created team');
      }
      const result: TeamData = {
        ...created,
        team_lead_name: null,
        member_count: 0,
      };
      if (created.team_lead_id !== undefined) {
        result.team_lead_id = created.team_lead_id;
      }
      return result;
    } catch (error: unknown) {
      console.error('Error in TeamService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Team Eintrag
   * @param tenantDb - The tenantDb parameter
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   * @param data - The data object
   */
  async update(
    tenantDb: Pool,
    id: number,
    tenantId: number,
    data: TeamUpdateData,
  ): Promise<TeamData | null> {
    try {
      const modelData: ModelTeamUpdateData = {};
      if (data.name !== undefined) {
        modelData.name = data.name;
      }
      if (data.description !== undefined) {
        modelData.description = data.description;
      }
      if (data.department_id !== undefined) {
        modelData.department_id = data.department_id;
      }
      if (data.team_lead_id !== undefined) {
        modelData.team_lead_id = data.team_lead_id;
      }
      if (data.is_active !== undefined) {
        modelData.is_active = data.is_active;
      }
      const success = await Team.update(id, modelData, tenantId);
      if (success) {
        return await this.getById(tenantDb, id, tenantId);
      }
      return null;
    } catch (error: unknown) {
      console.error('Error in TeamService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen Team Eintrag
   * @param _tenantDb - The _tenantDb parameter
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   */
  async delete(_tenantDb: Pool, id: number, tenantId: number): Promise<boolean> {
    try {
      return await Team.delete(id, tenantId);
    } catch (error: unknown) {
      console.error('Error in TeamService.delete:', error);
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
