/**
 * Department Group Service
 * Manages hierarchical department groups
 */
import { ResultSetHeader, RowDataPacket, execute, getConnection } from '../utils/db';
import { logger } from '../utils/logger.js';

interface DepartmentGroup {
  id: number;
  name: string;
  description?: string;
  parent_group_id?: number;
  departments?: Department[];
  subgroups?: DepartmentGroup[];
}

interface Department {
  id: number;
  name: string;
  description?: string;
}

/**
 *
 */
class DepartmentGroupService {
  /**
   * Create a new department group
   * @param name
   * @param description
   * @param parentGroupId
   * @param tenantId
   * @param createdBy
   */
  async createGroup(
    name: string,
    description: string | null,
    parentGroupId: number | null,
    tenantId: number,
    createdBy: number,
  ): Promise<number | null> {
    try {
      // Check for circular dependencies if parent group is specified
      if (parentGroupId != null && parentGroupId !== 0) {
        const hasCircular = await this.checkCircularDependency(parentGroupId, 0, tenantId);
        if (hasCircular) {
          throw new Error('Circular dependency detected');
        }
      }

      const [result] = await execute<ResultSetHeader>(
        `INSERT INTO department_groups (tenant_id, name, description, parent_group_id, created_by) 
         VALUES (?, ?, ?, ?, ?)`,
        [tenantId, name, description, parentGroupId, createdBy],
      );

      return result.insertId;
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        logger.error(`Group name '${name}' already exists for tenant ${tenantId}`);
        throw new Error('Group name already exists');
      }
      logger.error('Error creating department group:', error);
      return null;
    }
  }

  /**
   * Add departments to a group
   * @param groupId
   * @param departmentIds
   * @param tenantId
   * @param addedBy
   */
  async addDepartmentsToGroup(
    groupId: number,
    departmentIds: number[],
    tenantId: number,
    addedBy: number,
  ): Promise<boolean> {
    if (departmentIds.length === 0) return true;

    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      // Prepare bulk insert values
      const values = departmentIds.map((deptId) => [tenantId, groupId, deptId, addedBy]);

      const placeholders = departmentIds.map(() => '(?, ?, ?, ?)').join(', ');

      // Insert with ON DUPLICATE KEY UPDATE to handle existing assignments
      await connection.execute(
        `INSERT INTO department_group_members (tenant_id, group_id, department_id, added_by) 
         VALUES ${placeholders}
         ON DUPLICATE KEY UPDATE added_by = VALUES(added_by), added_at = CURRENT_TIMESTAMP`,
        values.flat(),
      );

      await connection.commit();
      return true;
    } catch (error: unknown) {
      await connection.rollback();
      logger.error('Error adding departments to group:', error);
      return false;
    } finally {
      connection.release();
    }
  }

  /**
   * Remove departments from a group
   * @param groupId
   * @param departmentIds
   * @param tenantId
   */
  async removeDepartmentsFromGroup(
    groupId: number,
    departmentIds: number[],
    tenantId: number,
  ): Promise<boolean> {
    if (departmentIds.length === 0) return true;

    try {
      const placeholders = departmentIds.map(() => '?').join(', ');

      const [result] = await execute<ResultSetHeader>(
        `DELETE FROM department_group_members 
         WHERE group_id = ? AND tenant_id = ? AND department_id IN (${placeholders})`,
        [groupId, tenantId, ...departmentIds],
      );

      return result.affectedRows > 0;
    } catch (error: unknown) {
      logger.error('Error removing departments from group:', error);
      return false;
    }
  }

  /**
   * Get all departments in a group (including subgroups recursively)
   * @param groupId
   * @param tenantId
   * @param includeSubgroups
   */
  async getGroupDepartments(
    groupId: number,
    tenantId: number,
    includeSubgroups = true,
  ): Promise<Department[]> {
    try {
      const departments = new Map<number, Department>();

      // Get direct departments
      const [directDepts] = await execute<RowDataPacket[]>(
        `SELECT d.id, d.name, d.description
         FROM departments d
         JOIN department_group_members dgm ON d.id = dgm.department_id
         WHERE dgm.group_id = ? AND dgm.tenant_id = ?`,
        [groupId, tenantId],
      );

      directDepts.forEach((dept: RowDataPacket) => {
        departments.set(dept.id as number, {
          id: dept.id as number,
          name: dept.name as string,
          description: (dept.description as string | null) ?? undefined,
        });
      });

      // Get departments from subgroups if requested
      if (includeSubgroups) {
        const subgroupDepts = await this.getSubgroupDepartments(groupId, tenantId);
        subgroupDepts.forEach((dept) => {
          departments.set(dept.id, dept);
        });
      }

      return [...departments.values()];
    } catch (error: unknown) {
      logger.error('Error getting group departments:', error);
      return [];
    }
  }

  /**
   * Get departments from all subgroups recursively
   * @param parentGroupId
   * @param tenantId
   */
  private async getSubgroupDepartments(
    parentGroupId: number,
    tenantId: number,
  ): Promise<Department[]> {
    const departments = new Map<number, Department>();

    // Get all subgroups
    const [subgroups] = await execute<RowDataPacket[]>(
      `SELECT id FROM department_groups 
       WHERE parent_group_id = ? AND tenant_id = ?`,
      [parentGroupId, tenantId],
    );

    // For each subgroup, get its departments
    for (const subgroup of subgroups) {
      const subgroupDepts = await this.getGroupDepartments(
        subgroup.id as number,
        tenantId,
        true, // Include nested subgroups
      );

      subgroupDepts.forEach((dept) => {
        departments.set(dept.id, dept);
      });
    }

    return [...departments.values()];
  }

  /**
   * Get the complete group hierarchy for a tenant
   * @param tenantId
   */
  async getGroupHierarchy(tenantId: number): Promise<DepartmentGroup[]> {
    try {
      // Get all groups
      const [groups] = await execute<RowDataPacket[]>(
        `SELECT id, name, description, parent_group_id 
         FROM department_groups 
         WHERE tenant_id = ? 
         ORDER BY parent_group_id NULLS FIRST, name`,
        [tenantId],
      );

      // Get all department assignments
      const [assignments] = await execute<RowDataPacket[]>(
        `SELECT dgm.group_id, d.id as dept_id, d.name as dept_name, d.description as dept_desc
         FROM department_group_members dgm
         JOIN departments d ON dgm.department_id = d.id
         WHERE dgm.tenant_id = ?`,
        [tenantId],
      );

      // Build assignment map
      const assignmentMap = new Map<number, Department[]>();
      assignments.forEach((row: RowDataPacket) => {
        if (!assignmentMap.has(row.group_id as number)) {
          assignmentMap.set(row.group_id as number, []);
        }
        assignmentMap.get(row.group_id as number)?.push({
          id: row.dept_id as number,
          name: row.dept_name as string,
          description: (row.dept_desc as string | null) ?? undefined,
        });
      });

      // Build hierarchy
      const groupMap = new Map<number, DepartmentGroup>();
      const rootGroups: DepartmentGroup[] = [];

      // First pass: create all group objects
      groups.forEach((row: RowDataPacket) => {
        const group: DepartmentGroup = {
          id: row.id as number,
          name: row.name as string,
          description: (row.description as string | null) ?? undefined,
          parent_group_id: (row.parent_group_id as number | null) ?? undefined,
          departments: assignmentMap.get(row.id as number) ?? [],
          subgroups: [],
        };
        groupMap.set(row.id as number, group);
      });

      // Second pass: build hierarchy
      groups.forEach((row: RowDataPacket) => {
        const group = groupMap.get(row.id as number);
        if (!group) return;
        if (row.parent_group_id === null) {
          rootGroups.push(group);
        } else {
          const parent = groupMap.get(row.parent_group_id as number);
          if (parent) {
            parent.subgroups?.push(group);
          }
        }
      });

      return rootGroups;
    } catch (error: unknown) {
      logger.error('Error getting group hierarchy:', error);
      return [];
    }
  }

  /**
   * Update a group
   * @param groupId
   * @param name
   * @param description
   * @param tenantId
   */
  async updateGroup(
    groupId: number,
    name: string,
    description: string | null,
    tenantId: number,
  ): Promise<boolean> {
    try {
      const [result] = await execute<ResultSetHeader>(
        `UPDATE department_groups 
         SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ? AND tenant_id = ?`,
        [name, description, groupId, tenantId],
      );

      return result.affectedRows > 0;
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new Error('Group name already exists');
      }
      logger.error('Error updating department group:', error);
      return false;
    }
  }

  /**
   * Delete a group (only if no admin permissions exist)
   * @param groupId
   * @param tenantId
   */
  async deleteGroup(groupId: number, tenantId: number): Promise<boolean> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      // Check if any admin has permissions on this group
      const [permissions] = await connection.execute(
        `SELECT COUNT(*) as count FROM admin_group_permissions 
         WHERE group_id = ? AND tenant_id = ?`,
        [groupId, tenantId],
      );

      if ((permissions as RowDataPacket[])[0].count > 0) {
        throw new Error('Cannot delete group with active admin permissions');
      }

      // Check if group has subgroups
      const [subgroups] = await connection.execute(
        `SELECT COUNT(*) as count FROM department_groups 
         WHERE parent_group_id = ? AND tenant_id = ?`,
        [groupId, tenantId],
      );

      if ((subgroups as RowDataPacket[])[0].count > 0) {
        throw new Error('Cannot delete group with subgroups');
      }

      // Delete department assignments
      await connection.execute(
        `DELETE FROM department_group_members 
         WHERE group_id = ? AND tenant_id = ?`,
        [groupId, tenantId],
      );

      // Delete the group
      const [result] = await connection.execute(
        `DELETE FROM department_groups 
         WHERE id = ? AND tenant_id = ?`,
        [groupId, tenantId],
      );

      await connection.commit();
      return (result as ResultSetHeader).affectedRows > 0;
    } catch (error: unknown) {
      await connection.rollback();
      logger.error('Error deleting department group:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Check for circular dependencies
   * @param groupId
   * @param targetId
   * @param tenantId
   */
  private async checkCircularDependency(
    groupId: number,
    targetId: number,
    tenantId: number,
  ): Promise<boolean> {
    if (groupId === targetId) return true;

    const [parents] = await execute<RowDataPacket[]>(
      `SELECT parent_group_id FROM department_groups 
       WHERE id = ? AND tenant_id = ?`,
      [groupId, tenantId],
    );

    if (parents.length === 0 || parents[0].parent_group_id === null) {
      return false;
    }

    return this.checkCircularDependency(parents[0].parent_group_id as number, targetId, tenantId);
  }
}

export default new DepartmentGroupService();
