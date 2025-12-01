/**
 * User Departments CRUD Operations
 * N:M relationship management for user-department assignments
 *
 * Part of Assignment System Refactoring (2025-11-27)
 * Replaces users.department_id (1:1) with consistent N:M pattern
 */
import { ResultSetHeader, RowDataPacket, query as executeQuery } from '../../../../utils/db.js';
import { logger } from '../../../../utils/logger.js';

/**
 * User department assignment row from database
 */
export interface UserDepartmentRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  user_id: number;
  department_id: number;
  is_primary: number; // tinyint(1) - 0 or 1
  assigned_by: number | null;
  assigned_at: Date | string;
  // Optional joined fields
  department_name?: string;
}

/**
 * Input data for assigning a user to a department
 */
export interface UserDepartmentAssignInput {
  tenant_id: number;
  user_id: number;
  department_id: number;
  is_primary?: boolean;
  assigned_by?: number;
}

/**
 * Assign a user to a department
 * If is_primary is true, unsets other primary assignments first
 */
export async function assignUserToDepartment(data: UserDepartmentAssignInput): Promise<number> {
  const {
    tenant_id: tenantId,
    user_id: userId,
    department_id: departmentId,
    is_primary: isPrimaryInput = false,
    assigned_by: assignedBy,
  } = data;

  logger.info(
    `Assigning user ${userId} to department ${departmentId} (primary: ${isPrimaryInput}) for tenant ${tenantId}`,
  );

  try {
    // If setting as primary, first unset any existing primary for this user
    if (isPrimaryInput) {
      await executeQuery<ResultSetHeader>(
        `UPDATE user_departments SET is_primary = 0 WHERE user_id = $1 AND tenant_id = $2`,
        [userId, tenantId],
      );
    }

    // Check if assignment already exists
    const [existing] = await executeQuery<UserDepartmentRow[]>(
      `SELECT id FROM user_departments WHERE user_id = $1 AND department_id = $2 AND tenant_id = $3`,
      [userId, departmentId, tenantId],
    );

    if (existing.length > 0 && existing[0] !== undefined) {
      // Update existing assignment
      const existingId = existing[0].id;
      await executeQuery<ResultSetHeader>(
        `UPDATE user_departments SET is_primary = $1, assigned_by = $2, assigned_at = NOW() WHERE id = $3`,
        [isPrimaryInput ? 1 : 0, assignedBy ?? null, existingId],
      );
      logger.info(`Updated existing assignment ID ${existingId}`);
      return existingId;
    }

    // Insert new assignment
    const [result] = await executeQuery<ResultSetHeader>(
      `INSERT INTO user_departments (tenant_id, user_id, department_id, is_primary, assigned_by, assigned_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [tenantId, userId, departmentId, isPrimaryInput ? 1 : 0, assignedBy ?? null],
    );

    logger.info(`User ${userId} assigned to department ${departmentId} with ID ${result.insertId}`);
    return result.insertId;
  } catch (error: unknown) {
    logger.error(`Error assigning user to department: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Remove a user from a department
 */
export async function removeUserFromDepartment(
  userId: number,
  departmentId: number,
  tenantId: number,
): Promise<boolean> {
  logger.info(`Removing user ${userId} from department ${departmentId} for tenant ${tenantId}`);

  try {
    const [result] = await executeQuery<ResultSetHeader>(
      `DELETE FROM user_departments WHERE user_id = $1 AND department_id = $2 AND tenant_id = $3`,
      [userId, departmentId, tenantId],
    );

    if (result.affectedRows === 0) {
      logger.warn(`No assignment found for user ${userId} and department ${departmentId}`);
      return false;
    }

    logger.info(`User ${userId} removed from department ${departmentId}`);
    return true;
  } catch (error: unknown) {
    logger.error(`Error removing user from department: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Remove all department assignments for a user
 */
export async function removeAllUserDepartments(userId: number, tenantId: number): Promise<number> {
  logger.info(`Removing all department assignments for user ${userId} in tenant ${tenantId}`);

  try {
    const [result] = await executeQuery<ResultSetHeader>(
      `DELETE FROM user_departments WHERE user_id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );

    logger.info(`Removed ${result.affectedRows} department assignments for user ${userId}`);
    return result.affectedRows;
  } catch (error: unknown) {
    logger.error(`Error removing all user departments: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Set the primary department for a user
 * Unsets all other primary flags and sets the specified one
 */
export async function setPrimaryDepartment(
  userId: number,
  departmentId: number,
  tenantId: number,
): Promise<boolean> {
  logger.info(`Setting primary department ${departmentId} for user ${userId}`);

  try {
    // First unset all primary flags for this user
    await executeQuery<ResultSetHeader>(
      `UPDATE user_departments SET is_primary = 0 WHERE user_id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );

    // Set the specified department as primary
    const [result] = await executeQuery<ResultSetHeader>(
      `UPDATE user_departments SET is_primary = true WHERE user_id = $1 AND department_id = $2 AND tenant_id = $3`,
      [userId, departmentId, tenantId],
    );

    if (result.affectedRows === 0) {
      logger.warn(`Assignment not found for user ${userId} and department ${departmentId}`);
      return false;
    }

    logger.info(`Primary department set to ${departmentId} for user ${userId}`);
    return true;
  } catch (error: unknown) {
    logger.error(`Error setting primary department: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Get all departments for a user
 */
export async function getUserDepartments(
  userId: number,
  tenantId: number,
): Promise<UserDepartmentRow[]> {
  try {
    const [rows] = await executeQuery<UserDepartmentRow[]>(
      `SELECT ud.*, d.name as department_name
       FROM user_departments ud
       JOIN departments d ON ud.department_id = d.id
       WHERE ud.user_id = $1 AND ud.tenant_id = $2
       ORDER BY ud.is_primary DESC, d.name ASC`,
      [userId, tenantId],
    );

    return rows;
  } catch (error: unknown) {
    logger.error(`Error getting user departments: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Get the primary department for a user
 */
export async function getUserPrimaryDepartment(
  userId: number,
  tenantId: number,
): Promise<UserDepartmentRow | null> {
  try {
    const [rows] = await executeQuery<UserDepartmentRow[]>(
      `SELECT ud.*, d.name as department_name
       FROM user_departments ud
       JOIN departments d ON ud.department_id = d.id
       WHERE ud.user_id = $1 AND ud.tenant_id = $2 AND ud.is_primary = true`,
      [userId, tenantId],
    );

    return rows[0] ?? null;
  } catch (error: unknown) {
    logger.error(`Error getting user primary department: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Get all users in a department
 */
export async function getDepartmentUsers(
  departmentId: number,
  tenantId: number,
): Promise<UserDepartmentRow[]> {
  try {
    const [rows] = await executeQuery<UserDepartmentRow[]>(
      `SELECT ud.*, u.username, u.first_name, u.last_name, u.email
       FROM user_departments ud
       JOIN users u ON ud.user_id = u.id
       WHERE ud.department_id = $1 AND ud.tenant_id = $2
       ORDER BY ud.is_primary DESC, u.last_name ASC, u.first_name ASC`,
      [departmentId, tenantId],
    );

    return rows;
  } catch (error: unknown) {
    logger.error(`Error getting department users: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Check if a user is assigned to a specific department
 */
export async function isUserInDepartment(
  userId: number,
  departmentId: number,
  tenantId: number,
): Promise<boolean> {
  try {
    const [rows] = await executeQuery<UserDepartmentRow[]>(
      `SELECT id FROM user_departments WHERE user_id = $1 AND department_id = $2 AND tenant_id = $3`,
      [userId, departmentId, tenantId],
    );

    return rows.length > 0;
  } catch (error: unknown) {
    logger.error(`Error checking user department membership: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Bulk assign a user to multiple departments
 * @param userId - User ID
 * @param departmentIds - Array of department IDs
 * @param primaryDepartmentId - Which department should be primary (optional, defaults to first)
 * @param tenantId - Tenant ID
 * @param assignedBy - ID of user making the assignment (optional)
 */
export async function bulkAssignUserDepartments(
  userId: number,
  departmentIds: number[],
  tenantId: number,
  primaryDepartmentId?: number,
  assignedBy?: number,
): Promise<void> {
  logger.info(
    `Bulk assigning user ${userId} to departments: ${departmentIds.join(', ')} (primary: ${String(primaryDepartmentId ?? 'auto')})`,
  );

  try {
    // First remove all existing assignments
    await removeAllUserDepartments(userId, tenantId);

    // Then add new assignments
    for (const departmentId of departmentIds) {
      const isPrimary =
        primaryDepartmentId !== undefined ?
          departmentId === primaryDepartmentId
        : departmentId === departmentIds[0]; // First is primary if none specified

      const assignInput: UserDepartmentAssignInput = {
        tenant_id: tenantId,
        user_id: userId,
        department_id: departmentId,
        is_primary: isPrimary,
      };
      if (assignedBy !== undefined) {
        assignInput.assigned_by = assignedBy;
      }
      await assignUserToDepartment(assignInput);
    }

    logger.info(`Bulk assignment completed for user ${userId}`);
  } catch (error: unknown) {
    logger.error(`Error in bulk assign user departments: ${(error as Error).message}`);
    throw error;
  }
}
