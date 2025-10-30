import { ResultSetHeader, RowDataPacket, query as executeQuery } from '../utils/db.js';
import { logger } from '../utils/logger.js';

// Database interfaces
interface DbDepartment extends RowDataPacket {
  id: number;
  name: string;
  description?: string;
  manager_id?: number;
  area_id?: number;
  status?: string;
  visibility?: string;
  tenant_id: number;
  created_at?: Date;
  updated_at?: Date;
  // Extended fields from queries
  manager_name?: string;
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

interface DbColumn extends RowDataPacket {
  Field: string;
  Type: string;
  Null: string;
  Key: string;
  Default: string | null;
  Extra: string;
}

interface DepartmentCreateData {
  name: string;
  description?: string;
  manager_id?: number;
  area_id?: number;
  status?: string;
  visibility?: string;
  tenant_id: number;
}

interface DepartmentUpdateData {
  name?: string;
  description?: string;
  manager_id?: number;
  area_id?: number;
  status?: string;
  visibility?: string;
}

export async function createDepartment(departmentData: DepartmentCreateData): Promise<number> {
  const {
    name,
    description,
    manager_id: managerId,
    area_id: areaId,
    status = 'active',
    visibility = 'public',
    tenant_id: tenantId,
  } = departmentData;
  logger.info(`Creating new department: ${name}`);

  // Check if columns exist, fallback to basic query if not
  try {
    const [columns] = await executeQuery<DbColumn[]>('DESCRIBE departments');
    const hasStatus = columns.some((col: DbColumn) => col.Field === 'status');
    const hasVisibility = columns.some((col: DbColumn) => col.Field === 'visibility');

    let query: string;
    let params: unknown[];

    if (hasStatus && hasVisibility) {
      query = `
          INSERT INTO departments (name, description, manager_id, area_id, status, visibility, tenant_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
      params = [name, description, managerId, areaId, status, visibility, tenantId];
    } else {
      logger.warn('Status/visibility columns not found, using basic query');
      query = `
          INSERT INTO departments (name, description, manager_id, area_id, tenant_id)
          VALUES (?, ?, ?, ?, ?)
        `;
      params = [name, description, managerId, areaId, tenantId];
    }

    const [result] = await executeQuery<ResultSetHeader>(query, params);
    logger.info(`Department created successfully with ID ${result.insertId}`);
    return result.insertId;
  } catch (error: unknown) {
    logger.error(`Error creating department: ${(error as Error).message}`);
    throw error;
  }
}

export async function findAllDepartments(
  tenantId: number, // PFLICHT!
): Promise<DbDepartment[]> {
  logger.info(`Fetching all departments for tenant ${tenantId}`);

  try {
    // Modern CTE approach (Best Practice 2025 for MySQL 8.0+)
    const query = `
        WITH employee_counts AS (
          SELECT
            department_id,
            COUNT(*) as count,
            GROUP_CONCAT(
              CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, username))
              ORDER BY last_name, first_name
              SEPARATOR '\n'
            ) as names
          FROM users
          WHERE tenant_id = ?
            AND is_active = 1
            AND is_archived = 0
          GROUP BY department_id
        ),
        team_counts AS (
          SELECT
            department_id,
            COUNT(*) as count,
            GROUP_CONCAT(name ORDER BY name SEPARATOR '\n') as names
          FROM teams
          GROUP BY department_id
        )
        SELECT
          d.*,
          u.username as manager_name,
          a.name as areaName,
          COALESCE(ec.count, 0) as employee_count,
          COALESCE(ec.names, '') as employee_names,
          COALESCE(tc.count, 0) as team_count,
          COALESCE(tc.names, '') as team_names
        FROM departments d
        LEFT JOIN users u ON d.manager_id = u.id
        LEFT JOIN areas a ON d.area_id = a.id
        LEFT JOIN employee_counts ec ON ec.department_id = d.id
        LEFT JOIN team_counts tc ON tc.department_id = d.id
        WHERE d.tenant_id = ?
        ORDER BY d.name
      `;

    const [rows] = await executeQuery<DbDepartment[]>(query, [tenantId, tenantId]);
    logger.info(`Retrieved ${rows.length} departments with names in tooltips`);

    return rows;
  } catch (error: unknown) {
    logger.warn(
      `Error with extended query: ${(error as Error).message}, falling back to simple query`,
    );

    // Fallback to simple query
    const simpleQuery = 'SELECT * FROM departments WHERE tenant_id = ? ORDER BY name';
    const [rows] = await executeQuery<DbDepartment[]>(simpleQuery, [tenantId]);
    logger.info(`Retrieved ${rows.length} departments with simple query`);

    return rows;
  }
}

export async function findDepartmentById(
  id: number,
  tenantId: number,
): Promise<DbDepartment | null> {
  logger.info(`Fetching department with ID ${id} for tenant ${tenantId}`);
  const query = 'SELECT * FROM departments WHERE id = ? AND tenant_id = ?';

  try {
    const [rows] = await executeQuery<DbDepartment[]>(query, [id, tenantId]);
    if (rows.length === 0) {
      logger.warn(`Department with ID ${id} not found`);
      return null;
    }
    logger.info(`Department ${id} retrieved successfully`);

    return rows[0];
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

  // Only update provided fields
  if (departmentData.name !== undefined) {
    fields.push('name = ?');
    values.push(departmentData.name);
  }
  if (departmentData.description !== undefined) {
    fields.push('description = ?');
    values.push(departmentData.description);
  }
  if (departmentData.manager_id !== undefined) {
    fields.push('manager_id = ?');
    values.push(departmentData.manager_id);
  }
  if (departmentData.area_id !== undefined) {
    fields.push('area_id = ?');
    values.push(departmentData.area_id);
  }
  if (departmentData.status !== undefined) {
    fields.push('status = ?');
    values.push(departmentData.status);
  }
  if (departmentData.visibility !== undefined) {
    fields.push('visibility = ?');
    values.push(departmentData.visibility);
  }

  if (fields.length === 0) {
    return false;
  }

  values.push(id);
  const query = `UPDATE departments SET ${fields.join(', ')} WHERE id = ?`;

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
  const query = 'DELETE FROM departments WHERE id = ?';

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
  const query = `
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.position, u.employee_id 
      FROM users u 
      WHERE u.department_id = ?
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
      'SELECT COUNT(*) as count FROM departments WHERE tenant_id = ?',
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
      'SELECT COUNT(*) as count FROM teams WHERE tenant_id = ?',
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
