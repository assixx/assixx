/**
 * User Statistics & Counting
 * Provides counting and statistics functions for users
 */
import { RowDataPacket, query as executeQuery } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { CountResult, DocumentCountResult, UserDepartmentTeam, UserFilter } from './user.types.js';
import { buildCountQuery } from './user.utils.js';

/**
 * Count users with filters (for pagination)
 */
export async function countUsersWithFilters(filters: UserFilter): Promise<number> {
  try {
    const values: unknown[] = [];
    const query = buildCountQuery(filters, values);

    const [rows] = await executeQuery<CountResult[]>(query, values);
    const row = rows[0];
    if (row === undefined) {
      return 0;
    }
    return row.total;
  } catch (error: unknown) {
    logger.error(`Error counting users: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Count users with optional filters
 */
export async function countUsers(filters: UserFilter): Promise<number> {
  try {
    let query = 'SELECT COUNT(*) as count FROM users WHERE tenant_id = ?';
    const params: unknown[] = [filters.tenant_id];

    if (filters.role != null && filters.role !== '') {
      query += ' AND role = ?';
      params.push(filters.role);
    }

    interface UserCountResult extends RowDataPacket {
      count: number;
    }
    const [rows] = await executeQuery<UserCountResult[]>(query, params);
    return rows[0]?.count ?? 0;
  } catch (error: unknown) {
    logger.error(`Error counting users: ${(error as Error).message}`);
    return 0;
  }
}

/**
 * Count active users by tenant
 */
export async function countActiveUsersByTenant(tenantId: number): Promise<number> {
  try {
    interface ActiveCountResult extends RowDataPacket {
      count: number;
    }
    const [rows] = await executeQuery<ActiveCountResult[]>(
      'SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND is_active = 1',
      [tenantId],
    );
    return rows[0]?.count ?? 0;
  } catch (error: unknown) {
    logger.error(`Error counting active users: ${(error as Error).message}`);
    return 0;
  }
}

/**
 * Check if a user has documents
 */
export async function userHasDocuments(userId: number): Promise<boolean> {
  try {
    const query = `
        SELECT COUNT(*) as document_count
        FROM documents
        WHERE user_id = ?
      `;

    const [rows] = await executeQuery<DocumentCountResult[]>(query, [userId]);
    const row = rows[0];
    if (row === undefined) {
      return false;
    }

    return row.document_count > 0;
  } catch (error: unknown) {
    logger.error(`Error checking if user ${userId} has documents: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Get user's document count
 */
export async function getUserDocumentCount(userId: number): Promise<number> {
  try {
    const query = `
        SELECT COUNT(*) as document_count
        FROM documents
        WHERE user_id = ?
      `;

    const [rows] = await executeQuery<DocumentCountResult[]>(query, [userId]);
    const row = rows[0];
    if (row === undefined) {
      return 0;
    }

    return row.document_count;
  } catch (error: unknown) {
    logger.error(`Error counting documents for user ${userId}: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Get user's department and team information
 * @param userId - User ID
 * @returns Object with role, departmentId, teamId, departmentName, and teamName
 */
export async function getUserDepartmentAndTeam(userId: number): Promise<{
  role: string | null;
  departmentId: number | null;
  teamId: number | null;
  departmentName: string | null;
  teamName: string | null;
}> {
  try {
    const query = `
        SELECT
          u.role,
          u.department_id,
          ut.team_id,
          d.name as department_name,
          t.name as team_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN user_teams ut ON u.id = ut.user_id
        LEFT JOIN teams t ON ut.team_id = t.id
        WHERE u.id = ?
      `;

    const [rows] = await executeQuery<UserDepartmentTeam[]>(query, [userId]);

    const user = rows[0];
    if (user === undefined) {
      return {
        role: null,
        departmentId: null,
        teamId: null,
        departmentName: null,
        teamName: null,
      };
    }

    return {
      role: user.role,
      departmentId: user.department_id,
      teamId: user.team_id,
      departmentName: user.department_name,
      teamName: user.team_name,
    };
  } catch (error: unknown) {
    logger.error(`Error getting user department and team: ${(error as Error).message}`);
    throw error;
  }
}
