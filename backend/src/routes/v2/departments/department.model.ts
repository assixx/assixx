import { ResultSetHeader, RowDataPacket, query as executeQuery } from '../../../utils/db.js';
import { logger } from '../../../utils/logger.js';

// Database interfaces
interface DbDepartment extends RowDataPacket {
  id: number;
  name: string;
  description?: string;
  department_lead_id?: number;
  area_id?: number;
  is_active?: number; // TINYINT(1) from DB
  is_archived?: number; // TINYINT(1) from DB
  tenant_id: number;
  created_at?: Date;
  updated_at?: Date;
  // Extended fields from queries
  department_lead_name?: string;
  areaName?: string;
  employee_count?: number;
  employee_names?: string;
  team_count?: number;
  team_names?: string;
}

interface DbUser extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  position?: string;
  employee_id?: string;
}

interface DepartmentCreateData {
  name: string;
  description?: string;
  department_lead_id?: number;
  area_id?: number;
  is_active?: number; // TINYINT(1) 0 or 1
  is_archived?: number; // TINYINT(1) 0 or 1
  tenant_id: number;
}

interface DepartmentUpdateData {
  name?: string;
  description?: string;
  department_lead_id?: number;
  area_id?: number;
  is_active?: number; // TINYINT(1) 0 or 1
  is_archived?: number; // TINYINT(1) 0 or 1
}

export async function createDepartment(departmentData: DepartmentCreateData): Promise<number> {
  const {
    name,
    description,
    department_lead_id: departmentLeadId,
    area_id: areaId,
    is_active: isActive = true,
    is_archived: isArchived = false,
    tenant_id: tenantId,
  } = departmentData;
  logger.info(`Creating new department: ${name}`);

  try {
    const query = `
      INSERT INTO departments (name, description, department_lead_id, area_id, is_active, is_archived, tenant_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    const params = [name, description, departmentLeadId, areaId, isActive, isArchived, tenantId];

    const [result] = await executeQuery<ResultSetHeader>(query, params);
    logger.info(`Department created successfully with ID ${result.insertId}`);
    return result.insertId;
  } catch (error: unknown) {
    logger.error(`Error creating department: ${(error as Error).message}`);
    throw error;
  }
}

/** SQL query for fetching departments with employee/team counts via user_departments N:M */
const FIND_ALL_DEPARTMENTS_QUERY = `
  WITH employee_counts AS (
    SELECT ud.department_id, COUNT(*) as count,
      STRING_AGG(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, u.username)),
        E'\n' ORDER BY u.last_name, u.first_name) as names
    FROM user_departments ud
    JOIN users u ON ud.user_id = u.id AND ud.tenant_id = u.tenant_id
    WHERE ud.tenant_id = $1 AND u.is_active = true AND u.is_archived = false
    GROUP BY ud.department_id
  ),
  team_counts AS (
    SELECT department_id, COUNT(*) as count,
      STRING_AGG(name, E'\n' ORDER BY name) as names
    FROM teams GROUP BY department_id
  )
  SELECT d.*, CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as department_lead_name, a.name as areaName,
    COALESCE(ec.count, 0) as employee_count, COALESCE(ec.names, '') as employee_names,
    COALESCE(tc.count, 0) as team_count, COALESCE(tc.names, '') as team_names
  FROM departments d
  LEFT JOIN users u ON d.department_lead_id = u.id
  LEFT JOIN areas a ON d.area_id = a.id
  LEFT JOIN employee_counts ec ON ec.department_id = d.id
  LEFT JOIN team_counts tc ON tc.department_id = d.id
  WHERE d.tenant_id = $2 AND d.is_active = true
  ORDER BY d.name`;

export async function findAllDepartments(tenantId: number): Promise<DbDepartment[]> {
  logger.info(`Fetching all departments for tenant ${tenantId}`);
  try {
    const [rows] = await executeQuery<DbDepartment[]>(FIND_ALL_DEPARTMENTS_QUERY, [
      tenantId,
      tenantId,
    ]);
    logger.info(`Retrieved ${rows.length} departments with names in tooltips`);
    return rows;
  } catch (error: unknown) {
    logger.warn(`Error with extended query: ${(error as Error).message}, falling back to simple`);
    const [rows] = await executeQuery<DbDepartment[]>(
      'SELECT * FROM departments WHERE tenant_id = $1 AND is_active = true ORDER BY name',
      [tenantId],
    );
    logger.info(`Retrieved ${rows.length} departments with simple query`);
    return rows;
  }
}

export async function findDepartmentById(
  id: number,
  tenantId: number,
): Promise<DbDepartment | null> {
  logger.info(`Fetching department with ID ${id} for tenant ${tenantId}`);
  const query = 'SELECT * FROM departments WHERE id = $1 AND tenant_id = $2';

  try {
    const [rows] = await executeQuery<DbDepartment[]>(query, [id, tenantId]);
    if (rows.length === 0) {
      logger.warn(`Department with ID ${id} not found`);
      return null;
    }
    logger.info(`Department ${id} retrieved successfully`);

    return rows[0] ?? null;
  } catch (error: unknown) {
    logger.error(`Error fetching department ${id}: ${(error as Error).message}`);
    throw error;
  }
}

export async function updateDepartment(
  id: number,
  departmentData: DepartmentUpdateData,
): Promise<boolean> {
  logger.info(`Updating department ${id}`);
  const fields: string[] = [];
  const values: unknown[] = [];

  // Only update provided fields - PostgreSQL dynamic $N parameter numbering
  if (departmentData.name !== undefined) {
    const paramIndex = values.length + 1;
    fields.push(`name = $${paramIndex}`);
    values.push(departmentData.name);
  }
  if (departmentData.description !== undefined) {
    const paramIndex = values.length + 1;
    fields.push(`description = $${paramIndex}`);
    values.push(departmentData.description);
  }
  if (departmentData.department_lead_id !== undefined) {
    const paramIndex = values.length + 1;
    fields.push(`department_lead_id = $${paramIndex}`);
    values.push(departmentData.department_lead_id);
  }
  if (departmentData.area_id !== undefined) {
    const paramIndex = values.length + 1;
    fields.push(`area_id = $${paramIndex}`);
    values.push(departmentData.area_id);
  }
  if (departmentData.is_active !== undefined) {
    const paramIndex = values.length + 1;
    fields.push(`is_active = $${paramIndex}`);
    values.push(departmentData.is_active);
  }

  if (fields.length === 0) {
    return false;
  }

  const idParamIndex = values.length + 1;
  values.push(id);
  const query = `UPDATE departments SET ${fields.join(', ')} WHERE id = $${idParamIndex}`;

  try {
    const [result] = await executeQuery<ResultSetHeader>(query, values);
    if (result.affectedRows === 0) {
      logger.warn(`No department found with ID ${id} for update`);
      return false;
    }
    logger.info(`Department ${id} updated successfully`);
    return true;
  } catch (error: unknown) {
    logger.error(`Error updating department ${id}: ${(error as Error).message}`);
    throw error;
  }
}

export async function deleteDepartment(id: number): Promise<boolean> {
  logger.info(`Deleting department ${id}`);
  const query = 'DELETE FROM departments WHERE id = $1';

  try {
    const [result] = await executeQuery<ResultSetHeader>(query, [id]);
    if (result.affectedRows === 0) {
      logger.warn(`No department found with ID ${id} for deletion`);
      return false;
    }
    logger.info(`Department ${id} deleted successfully`);
    return true;
  } catch (error: unknown) {
    logger.error(`Error deleting department ${id}: ${(error as Error).message}`);
    throw error;
  }
}

export async function getUsersByDepartment(departmentId: number): Promise<DbUser[]> {
  logger.info(`Fetching users for department ${departmentId}`);
  // N:M REFACTORING: JOIN via user_departments table instead of users.department_id
  const query = `
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.position, u.employee_id
      FROM users u
      JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id
      WHERE ud.department_id = $1
    `;

  try {
    const [rows] = await executeQuery<DbUser[]>(query, [departmentId]);
    logger.info(`Retrieved ${rows.length} users for department ${departmentId}`);
    return rows;
  } catch (error: unknown) {
    logger.error(
      `Error fetching users for department ${departmentId}: ${(error as Error).message}`,
    );
    throw error;
  }
}

// Count departments by tenant
export async function countDepartmentsByTenant(tenantId: number): Promise<number> {
  try {
    interface CountResult extends RowDataPacket {
      count: number;
    }
    const [rows] = await executeQuery<CountResult[]>(
      'SELECT COUNT(*) as count FROM departments WHERE tenant_id = $1',
      [tenantId],
    );
    return rows[0]?.count ?? 0;
  } catch (error: unknown) {
    logger.error(`Error counting departments by tenant: ${(error as Error).message}`);
    return 0;
  }
}

// Count teams by tenant (assuming teams are linked to departments)
export async function countTeamsByTenant(tenantId: number): Promise<number> {
  try {
    interface CountResult extends RowDataPacket {
      count: number;
    }
    const [rows] = await executeQuery<CountResult[]>(
      'SELECT COUNT(*) as count FROM teams WHERE tenant_id = $1',
      [tenantId],
    );
    return rows[0]?.count ?? 0;
  } catch (error: unknown) {
    logger.error(`Error counting teams by tenant: ${(error as Error).message}`);
    return 0;
  }
}

// Backward compatibility object
const Department = {
  create: createDepartment,
  findAll: findAllDepartments,
  findById: findDepartmentById,
  update: updateDepartment,
  delete: deleteDepartment,
  getUsersByDepartment,
  countByTenant: countDepartmentsByTenant,
  countTeamsByTenant,
};

// Export types
export type { DbDepartment, DepartmentCreateData, DepartmentUpdateData };

// Default export for CommonJS compatibility
export default Department;

// CommonJS compatibility
