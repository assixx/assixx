import {
  query as executeQuery,
  RowDataPacket,
  ResultSetHeader,
} from "../utils/db";
import { logger } from "../utils/logger";

// Database interfaces
interface DbTeam extends RowDataPacket {
  id: number;
  name: string;
  description?: string;
  department_id?: number;
  leader_id?: number;
  tenant_id: number;
  created_at?: Date;
  updated_at?: Date;
  // Extended fields from joins
  department_name?: string;
}

interface DbTeamMember extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  position?: string;
  employee_id?: string;
}

interface TeamCreateData {
  name: string;
  description?: string;
  department_id?: number;
  leader_id?: number;
  tenant_id: number;
}

interface TeamUpdateData {
  name?: string;
  description?: string;
  department_id?: number;
  leader_id?: number;
}

interface MysqlError extends Error {
  code?: string;
  errno?: number;
  sqlState?: string;
}

export class Team {
  static async create(teamData: TeamCreateData): Promise<number> {
    const { name, description, department_id, leader_id, tenant_id } = teamData;
    logger.info(`Creating new team: ${name}`);

    const query = `
      INSERT INTO teams (name, description, department_id, team_lead_id, tenant_id) 
      VALUES (?, ?, ?, ?, ?)
    `;

    try {
      const [result] = await executeQuery<ResultSetHeader>(query, [
        name,
        description,
        department_id,
        leader_id,
        tenant_id,
      ]);
      logger.info(`Team created successfully with ID ${result.insertId}`);
      return result.insertId;
    } catch (error) {
      logger.error(`Error creating team: ${(error as Error).message}`);
      throw error;
    }
  }

  static async findAll(tenant_id: number | null = null): Promise<DbTeam[]> {
    logger.info(
      `Fetching all teams${tenant_id ? ` for tenant ${tenant_id}` : ""}`,
    );
    const query = `
      SELECT t.*, d.name AS department_name 
      FROM teams t
      LEFT JOIN departments d ON t.department_id = d.id
      ${tenant_id ? "WHERE t.tenant_id = ?" : ""}
      ORDER BY t.name
    `;

    try {
      const [rows] = await executeQuery<DbTeam[]>(
        query,
        tenant_id ? [tenant_id] : [],
      );
      logger.info(`Retrieved ${rows.length} teams`);
      return rows;
    } catch (error) {
      logger.error(`Error fetching teams: ${(error as Error).message}`);
      throw error;
    }
  }

  static async findById(id: number): Promise<DbTeam | null> {
    logger.info(`Fetching team with ID ${id}`);
    const query = `
      SELECT t.*, d.name AS department_name 
      FROM teams t
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE t.id = ?
    `;

    try {
      const [rows] = await executeQuery<DbTeam[]>(query, [id]);
      if (rows.length === 0) {
        logger.warn(`Team with ID ${id} not found`);
        return null;
      }
      logger.info(`Team ${id} retrieved successfully`);
      return rows[0];
    } catch (error) {
      logger.error(`Error fetching team ${id}: ${(error as Error).message}`);
      throw error;
    }
  }

  static async update(id: number, teamData: TeamUpdateData): Promise<boolean> {
    logger.info(`Updating team ${id}`);
    const { name, description, department_id, leader_id } = teamData;

    const query = `
      UPDATE teams 
      SET name = ?, description = ?, department_id = ?, team_lead_id = ? 
      WHERE id = ?
    `;

    try {
      const [result] = await executeQuery<ResultSetHeader>(query, [
        name,
        description,
        department_id,
        leader_id,
        id,
      ]);
      if (result.affectedRows === 0) {
        logger.warn(`No team found with ID ${id} for update`);
        return false;
      }
      logger.info(`Team ${id} updated successfully`);
      return true;
    } catch (error) {
      logger.error(`Error updating team ${id}: ${(error as Error).message}`);
      throw error;
    }
  }

  static async delete(id: number): Promise<boolean> {
    logger.info(`Deleting team ${id}`);
    const query = "DELETE FROM teams WHERE id = ?";

    try {
      const [result] = await executeQuery<ResultSetHeader>(query, [id]);
      if (result.affectedRows === 0) {
        logger.warn(`No team found with ID ${id} for deletion`);
        return false;
      }
      logger.info(`Team ${id} deleted successfully`);
      return true;
    } catch (error) {
      logger.error(`Error deleting team ${id}: ${(error as Error).message}`);
      throw error;
    }
  }

  static async addUserToTeam(userId: number, teamId: number): Promise<boolean> {
    logger.info(`Adding user ${userId} to team ${teamId}`);
    const query = "INSERT INTO user_teams (user_id, team_id) VALUES (?, ?)";

    try {
      await executeQuery(query, [userId, teamId]);
      logger.info(`User ${userId} added to team ${teamId} successfully`);
      return true;
    } catch (error) {
      const mysqlError = error as MysqlError;
      // Wenn es ein Duplikat ist, ignorieren wir es
      if (mysqlError.code === "ER_DUP_ENTRY") {
        logger.warn(`User ${userId} is already a member of team ${teamId}`);
        return true;
      }
      logger.error(
        `Error adding user ${userId} to team ${teamId}: ${mysqlError.message}`,
      );
      throw error;
    }
  }

  static async removeUserFromTeam(
    userId: number,
    teamId: number,
  ): Promise<boolean> {
    logger.info(`Removing user ${userId} from team ${teamId}`);
    const query = "DELETE FROM user_teams WHERE user_id = ? AND team_id = ?";

    try {
      const [result] = await executeQuery<ResultSetHeader>(query, [
        userId,
        teamId,
      ]);
      if (result.affectedRows === 0) {
        logger.warn(`User ${userId} is not a member of team ${teamId}`);
        return false;
      }
      logger.info(`User ${userId} removed from team ${teamId} successfully`);
      return true;
    } catch (error) {
      logger.error(
        `Error removing user ${userId} from team ${teamId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  static async getTeamMembers(teamId: number): Promise<DbTeamMember[]> {
    logger.info(`Fetching members for team ${teamId}`);
    const query = `
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.position, u.employee_id 
      FROM users u 
      JOIN user_teams ut ON u.id = ut.user_id
      WHERE ut.team_id = ?
    `;

    try {
      const [rows] = await executeQuery<DbTeamMember[]>(query, [teamId]);
      logger.info(`Retrieved ${rows.length} members for team ${teamId}`);
      return rows;
    } catch (error) {
      logger.error(
        `Error fetching members for team ${teamId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  static async getUserTeams(userId: number): Promise<DbTeam[]> {
    logger.info(`Fetching teams for user ${userId}`);
    const query = `
      SELECT t.*, d.name AS department_name 
      FROM teams t
      JOIN user_teams ut ON t.id = ut.team_id
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE ut.user_id = ?
    `;

    try {
      const [rows] = await executeQuery<DbTeam[]>(query, [userId]);
      logger.info(`Retrieved ${rows.length} teams for user ${userId}`);
      return rows;
    } catch (error) {
      logger.error(
        `Error fetching teams for user ${userId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}

// Export types
export type { DbTeam, TeamCreateData, TeamUpdateData };

// Default export for CommonJS compatibility
export default Team;

// CommonJS compatibility
