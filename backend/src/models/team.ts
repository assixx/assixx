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
  team_lead_id?: number;
  tenant_id: number;
  created_at?: Date;
  updated_at?: Date;
  is_active?: boolean;
  // Extended fields from joins
  department_name?: string;
  team_lead_name?: string;
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
  team_lead_id?: number;
  tenant_id: number;
}

interface TeamUpdateData {
  name?: string;
  description?: string | null;
  department_id?: number | null;
  team_lead_id?: number | null;
  is_active?: boolean | number;
}

interface MysqlError extends Error {
  code?: string;
  errno?: number;
  sqlState?: string;
}

export async function createTeam(teamData: TeamCreateData): Promise<number> {
  const { name, description, department_id, team_lead_id, tenant_id } =
    teamData;
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
      team_lead_id,
      tenant_id,
    ]);
    logger.info(`Team created successfully with ID ${result.insertId}`);
    return result.insertId;
  } catch (error: unknown) {
    logger.error(`Error creating team: ${(error as Error).message}`);
    throw error;
  }
}

export async function findAllTeams(
  tenant_id: number | null = null,
): Promise<DbTeam[]> {
  logger.info(
    `Fetching all teams${tenant_id != null && tenant_id !== 0 ? ` for tenant ${tenant_id}` : ""}`,
  );
  const query = `
      SELECT t.id, t.name, t.description, t.department_id, t.team_lead_id, 
             t.tenant_id, t.created_at, t.updated_at, t.is_active,
             d.name AS department_name,
             CONCAT(u.first_name, ' ', u.last_name) AS team_lead_name 
      FROM teams t
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN users u ON t.team_lead_id = u.id
      ${tenant_id != null && tenant_id !== 0 ? "WHERE t.tenant_id = ?" : ""}
      ORDER BY t.name
    `;

  try {
    const [rows] = await executeQuery<DbTeam[]>(
      query,
      tenant_id != null && tenant_id !== 0 ? [tenant_id] : [],
    );
    logger.info(`Retrieved ${rows.length} teams`);
    return rows;
  } catch (error: unknown) {
    logger.error(`Error fetching teams: ${(error as Error).message}`);
    throw error;
  }
}

export async function findTeamById(id: number): Promise<DbTeam | null> {
  logger.info(`Fetching team with ID ${id}`);
  const query = `
      SELECT t.id, t.name, t.description, t.department_id, t.team_lead_id, 
             t.tenant_id, t.created_at, t.updated_at, t.is_active,
             d.name AS department_name,
             CONCAT(u.first_name, ' ', u.last_name) AS team_lead_name 
      FROM teams t
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN users u ON t.team_lead_id = u.id
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
  } catch (error: unknown) {
    logger.error(`Error fetching team ${id}: ${(error as Error).message}`);
    throw error;
  }
}

export async function updateTeam(
  id: number,
  teamData: TeamUpdateData,
): Promise<boolean> {
  logger.info(`Updating team ${id}`);
  const { name, description, department_id, team_lead_id, is_active } =
    teamData;

  // Build dynamic update query
  const updateFields: string[] = [];
  const values: unknown[] = [];

  if (name !== undefined) {
    updateFields.push("name = ?");
    values.push(name);
  }
  if (description !== undefined) {
    updateFields.push("description = ?");
    values.push(description);
  }
  if (department_id !== undefined) {
    updateFields.push("department_id = ?");
    values.push(department_id);
  }
  if (team_lead_id !== undefined) {
    updateFields.push("team_lead_id = ?");
    values.push(team_lead_id);
  }
  if (is_active !== undefined) {
    updateFields.push("is_active = ?");
    values.push(is_active);
  }

  if (updateFields.length === 0) {
    logger.warn(`No fields to update for team ${id}`);
    return true;
  }

  const query = `
      UPDATE teams 
      SET ${updateFields.join(", ")} 
      WHERE id = ?
    `;
  values.push(id);

  try {
    const [result] = await executeQuery<ResultSetHeader>(query, values);
    if (result.affectedRows === 0) {
      logger.warn(`No team found with ID ${id} for update`);
      return false;
    }
    logger.info(`Team ${id} updated successfully`);
    return true;
  } catch (error: unknown) {
    logger.error(`Error updating team ${id}: ${(error as Error).message}`);
    throw error;
  }
}

export async function deleteTeam(id: number): Promise<boolean> {
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
  } catch (error: unknown) {
    logger.error(`Error deleting team ${id}: ${(error as Error).message}`);
    throw error;
  }
}

export async function addUserToTeam(
  userId: number,
  teamId: number,
  tenantId: number,
): Promise<boolean> {
  logger.info(`Adding user ${userId} to team ${teamId} for tenant ${tenantId}`);
  const query =
    "INSERT INTO user_teams (user_id, team_id, tenant_id) VALUES (?, ?, ?)";

  try {
    await executeQuery(query, [userId, teamId, tenantId]);
    logger.info(`User ${userId} added to team ${teamId} successfully`);
    return true;
  } catch (error: unknown) {
    const mysqlError = error as MysqlError;
    // Wenn es ein Duplikat ist, werfen wir einen Fehler
    if (mysqlError.code === "ER_DUP_ENTRY") {
      logger.warn(`User ${userId} is already a member of team ${teamId}`);
      throw new Error("User is already a member of this team");
    }
    logger.error(
      `Error adding user ${userId} to team ${teamId}: ${mysqlError.message}`,
    );
    throw error;
  }
}

export async function removeUserFromTeam(
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
  } catch (error: unknown) {
    logger.error(
      `Error removing user ${userId} from team ${teamId}: ${(error as Error).message}`,
    );
    throw error;
  }
}

export async function getTeamMembers(teamId: number): Promise<DbTeamMember[]> {
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
  } catch (error: unknown) {
    logger.error(
      `Error fetching members for team ${teamId}: ${(error as Error).message}`,
    );
    throw error;
  }
}

export async function getUserTeams(userId: number): Promise<DbTeam[]> {
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
  } catch (error: unknown) {
    logger.error(
      `Error fetching teams for user ${userId}: ${(error as Error).message}`,
    );
    throw error;
  }
}

export async function getTeamMachines(
  teamId: number,
): Promise<Array<{ id: number; name: string; model?: string }>> {
  logger.info(`Fetching machines for team ${teamId}`);
  const query = `
      SELECT m.id, m.name, m.model
      FROM machines m
      JOIN machine_teams mt ON m.id = mt.machine_id
      WHERE mt.team_id = ?
    `;

  try {
    const [rows] = await executeQuery<RowDataPacket[]>(query, [teamId]);
    logger.info(`Retrieved ${rows.length} machines for team ${teamId}`);
    return rows as Array<{ id: number; name: string; model?: string }>;
  } catch (error: unknown) {
    logger.error(
      `Error fetching machines for team ${teamId}: ${(error as Error).message}`,
    );
    throw error;
  }
}

// Backward compatibility object
const Team = {
  create: createTeam,
  findAll: findAllTeams,
  findById: findTeamById,
  update: updateTeam,
  delete: deleteTeam,
  addUserToTeam,
  removeUserFromTeam,
  getTeamMembers,
  getUserTeams,
  getTeamMachines,
};

// Export types
export type { DbTeam, TeamCreateData, TeamUpdateData };

// Default export for CommonJS compatibility
export default Team;

// CommonJS compatibility
