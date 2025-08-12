import {
  query as executeQuery,
  RowDataPacket,
  ResultSetHeader,
} from "../utils/db";
import { logger } from "../utils/logger";

// Database interfaces
interface DbDepartment extends RowDataPacket {
  id: number;
  name: string;
  description?: string;
  manager_id?: number;
  parent_id?: number;
  area_id?: number;
  status?: string;
  visibility?: string;
  tenant_id: number;
  created_at?: Date;
  updated_at?: Date;
  // Extended fields from queries
  manager_name?: string;
  employee_count?: number;
  team_count?: number;
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
  parent_id?: number;
  area_id?: number;
  status?: string;
  visibility?: string;
  tenant_id: number;
}

interface DepartmentUpdateData {
  name?: string;
  description?: string;
  manager_id?: number;
  parent_id?: number;
  area_id?: number;
  status?: string;
  visibility?: string;
}

export async function createDepartment(
  departmentData: DepartmentCreateData,
): Promise<number> {
  const {
    name,
    description,
    manager_id,
    parent_id,
    area_id,
    status = "active",
    visibility = "public",
    tenant_id,
  } = departmentData;
  logger.info(`Creating new department: ${name}`);

  // Check if columns exist, fallback to basic query if not
  try {
    const [columns] = await executeQuery<DbColumn[]>("DESCRIBE departments");
    const hasStatus = columns.some((col: DbColumn) => col.Field === "status");
    const hasVisibility = columns.some(
      (col: DbColumn) => col.Field === "visibility",
    );

    let query: string;
    let params: unknown[];

    if (hasStatus && hasVisibility) {
      query = `
          INSERT INTO departments (name, description, manager_id, parent_id, area_id, status, visibility, tenant_id) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
      params = [
        name,
        description,
        manager_id,
        parent_id,
        area_id,
        status,
        visibility,
        tenant_id,
      ];
    } else {
      logger.warn("Status/visibility columns not found, using basic query");
      query = `
          INSERT INTO departments (name, description, manager_id, parent_id, area_id, tenant_id) 
          VALUES (?, ?, ?, ?, ?, ?)
        `;
      params = [name, description, manager_id, parent_id, area_id, tenant_id];
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
  tenant_id: number, // PFLICHT!
): Promise<DbDepartment[]> {
  logger.info(`Fetching all departments for tenant ${tenant_id}`);

  try {
    // First try with extended query
    const query = `
        SELECT d.*, 
          u.username as manager_name,
          (SELECT COUNT(*) FROM users WHERE department_id = d.id AND tenant_id = d.tenant_id) as employee_count,
          (SELECT COUNT(*) FROM teams WHERE department_id = d.id) as team_count
        FROM departments d
        LEFT JOIN users u ON d.manager_id = u.id
        WHERE d.tenant_id = ?
        ORDER BY d.name
      `;

    const [rows] = await executeQuery<DbDepartment[]>(query, [tenant_id]);
    logger.info(`Retrieved ${rows.length} departments with extended info`);

    return rows;
  } catch (error: unknown) {
    logger.warn(
      `Error with extended query: ${(error as Error).message}, falling back to simple query`,
    );

    // Fallback to simple query
    const simpleQuery =
      "SELECT * FROM departments WHERE tenant_id = ? ORDER BY name";
    const [rows] = await executeQuery<DbDepartment[]>(simpleQuery, [tenant_id]);
    logger.info(`Retrieved ${rows.length} departments with simple query`);

    return rows;
  }
}

export async function findDepartmentById(
  id: number,
  tenant_id: number,
): Promise<DbDepartment | null> {
  logger.info(`Fetching department with ID ${id} for tenant ${tenant_id}`);
  const query = "SELECT * FROM departments WHERE id = ? AND tenant_id = ?";

  try {
    const [rows] = await executeQuery<DbDepartment[]>(query, [id, tenant_id]);
    if (rows.length === 0) {
      logger.warn(`Department with ID ${id} not found`);
      return null;
    }
    logger.info(`Department ${id} retrieved successfully`);

    return rows[0];
  } catch (error: unknown) {
    logger.error(
      `Error fetching department ${id}: ${(error as Error).message}`,
    );
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
    fields.push("name = ?");
    values.push(departmentData.name);
  }
  if (departmentData.description !== undefined) {
    fields.push("description = ?");
    values.push(departmentData.description);
  }
  if (departmentData.manager_id !== undefined) {
    fields.push("manager_id = ?");
    values.push(departmentData.manager_id);
  }
  if (departmentData.parent_id !== undefined) {
    fields.push("parent_id = ?");
    values.push(departmentData.parent_id);
  }
  if (departmentData.area_id !== undefined) {
    fields.push("area_id = ?");
    values.push(departmentData.area_id);
  }
  if (departmentData.status !== undefined) {
    fields.push("status = ?");
    values.push(departmentData.status);
  }
  if (departmentData.visibility !== undefined) {
    fields.push("visibility = ?");
    values.push(departmentData.visibility);
  }

  if (fields.length === 0) {
    return false;
  }

  values.push(id);
  const query = `UPDATE departments SET ${fields.join(", ")} WHERE id = ?`;

  try {
    const [result] = await executeQuery<ResultSetHeader>(query, values);
    if (result.affectedRows === 0) {
      logger.warn(`No department found with ID ${id} for update`);
      return false;
    }
    logger.info(`Department ${id} updated successfully`);
    return true;
  } catch (error: unknown) {
    logger.error(
      `Error updating department ${id}: ${(error as Error).message}`,
    );
    throw error;
  }
}

export async function deleteDepartment(id: number): Promise<boolean> {
  logger.info(`Deleting department ${id}`);
  const query = "DELETE FROM departments WHERE id = ?";

  try {
    const [result] = await executeQuery<ResultSetHeader>(query, [id]);
    if (result.affectedRows === 0) {
      logger.warn(`No department found with ID ${id} for deletion`);
      return false;
    }
    logger.info(`Department ${id} deleted successfully`);
    return true;
  } catch (error: unknown) {
    logger.error(
      `Error deleting department ${id}: ${(error as Error).message}`,
    );
    throw error;
  }
}

export async function getUsersByDepartment(
  departmentId: number,
): Promise<DbUser[]> {
  logger.info(`Fetching users for department ${departmentId}`);
  const query = `
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.position, u.employee_id 
      FROM users u 
      WHERE u.department_id = ?
    `;

  try {
    const [rows] = await executeQuery<DbUser[]>(query, [departmentId]);
    logger.info(
      `Retrieved ${rows.length} users for department ${departmentId}`,
    );
    return rows;
  } catch (error: unknown) {
    logger.error(
      `Error fetching users for department ${departmentId}: ${(error as Error).message}`,
    );
    throw error;
  }
}

// Count departments by tenant
export async function countDepartmentsByTenant(
  tenant_id: number,
): Promise<number> {
  try {
    interface CountResult extends RowDataPacket {
      count: number;
    }
    const [rows] = await executeQuery<CountResult[]>(
      "SELECT COUNT(*) as count FROM departments WHERE tenant_id = ?",
      [tenant_id],
    );
    return rows[0]?.count ?? 0;
  } catch (error: unknown) {
    logger.error(
      `Error counting departments by tenant: ${(error as Error).message}`,
    );
    return 0;
  }
}

// Count teams by tenant (assuming teams are linked to departments)
export async function countTeamsByTenant(tenant_id: number): Promise<number> {
  try {
    interface CountResult extends RowDataPacket {
      count: number;
    }
    const [rows] = await executeQuery<CountResult[]>(
      "SELECT COUNT(*) as count FROM teams WHERE tenant_id = ?",
      [tenant_id],
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
