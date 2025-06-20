/**
 * Department Group Service
 * Manages hierarchical department groups
 */

import pool from '../config/database.js';
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

class DepartmentGroupService {
  /**
   * Create a new department group
   */
  async createGroup(
    name: string,
    description: string | null,
    parentGroupId: number | null,
    tenantId: number,
    createdBy: number
  ): Promise<number | null> {
    try {
      // Check for circular dependencies if parent group is specified
      if (parentGroupId) {
        const hasCircular = await this.checkCircularDependency(
          parentGroupId,
          0,
          tenantId
        );
        if (hasCircular) {
          throw new Error('Circular dependency detected');
        }
      }

      const [result] = await (pool as any).execute(
        `INSERT INTO department_groups (tenant_id, name, description, parent_group_id, created_by) 
         VALUES (?, ?, ?, ?, ?)`,
        [tenantId, name, description, parentGroupId, createdBy]
      );

      return result.insertId;
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        logger.error(
          `Group name '${name}' already exists for tenant ${tenantId}`
        );
        throw new Error('Group name already exists');
      }
      logger.error('Error creating department group:', error);
      return null;
    }
  }

  /**
   * Add departments to a group
   */
  async addDepartmentsToGroup(
    groupId: number,
    departmentIds: number[],
    tenantId: number,
    addedBy: number
  ): Promise<boolean> {
    if (departmentIds.length === 0) return true;

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Prepare bulk insert values
      const values = departmentIds.map((deptId) => [
        tenantId,
        groupId,
        deptId,
        addedBy,
      ]);

      const placeholders = departmentIds.map(() => '(?, ?, ?, ?)').join(', ');

      // Insert with ON DUPLICATE KEY UPDATE to handle existing assignments
      await connection.execute(
        `INSERT INTO department_group_members (tenant_id, group_id, department_id, added_by) 
         VALUES ${placeholders}
         ON DUPLICATE KEY UPDATE added_by = VALUES(added_by), added_at = CURRENT_TIMESTAMP`,
        values.flat()
      );

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      logger.error('Error adding departments to group:', error);
      return false;
    } finally {
      connection.release();
    }
  }

  /**
   * Remove departments from a group
   */
  async removeDepartmentsFromGroup(
    groupId: number,
    departmentIds: number[],
    tenantId: number
  ): Promise<boolean> {
    if (departmentIds.length === 0) return true;

    try {
      const placeholders = departmentIds.map(() => '?').join(', ');

      const [result] = await (pool as any).execute(
        `DELETE FROM department_group_members 
         WHERE group_id = ? AND tenant_id = ? AND department_id IN (${placeholders})`,
        [groupId, tenantId, ...departmentIds]
      );

      return result.affectedRows > 0;
    } catch (error) {
      logger.error('Error removing departments from group:', error);
      return false;
    }
  }

  /**
   * Get all departments in a group (including subgroups recursively)
   */
  async getGroupDepartments(
    groupId: number,
    tenantId: number,
    includeSubgroups: boolean = true
  ): Promise<Department[]> {
    try {
      const departments = new Map<number, Department>();

      // Get direct departments
      const [directDepts] = await (pool as any).execute(
        `SELECT d.id, d.name, d.description
         FROM departments d
         JOIN department_group_members dgm ON d.id = dgm.department_id
         WHERE dgm.group_id = ? AND dgm.tenant_id = ?`,
        [groupId, tenantId]
      );

      directDepts.forEach((dept: any) => {
        departments.set(dept.id, {
          id: dept.id,
          name: dept.name,
          description: dept.description,
        });
      });

      // Get departments from subgroups if requested
      if (includeSubgroups) {
        const subgroupDepts = await this.getSubgroupDepartments(
          groupId,
          tenantId
        );
        subgroupDepts.forEach((dept) => {
          departments.set(dept.id, dept);
        });
      }

      return Array.from(departments.values());
    } catch (error) {
      logger.error('Error getting group departments:', error);
      return [];
    }
  }

  /**
   * Get departments from all subgroups recursively
   */
  private async getSubgroupDepartments(
    parentGroupId: number,
    tenantId: number
  ): Promise<Department[]> {
    const departments = new Map<number, Department>();

    // Get all subgroups
    const [subgroups] = await (pool as any).execute(
      `SELECT id FROM department_groups 
       WHERE parent_group_id = ? AND tenant_id = ?`,
      [parentGroupId, tenantId]
    );

    // For each subgroup, get its departments
    for (const subgroup of subgroups) {
      const subgroupDepts = await this.getGroupDepartments(
        subgroup.id,
        tenantId,
        true // Include nested subgroups
      );

      subgroupDepts.forEach((dept) => {
        departments.set(dept.id, dept);
      });
    }

    return Array.from(departments.values());
  }

  /**
   * Get the complete group hierarchy for a tenant
   */
  async getGroupHierarchy(tenantId: number): Promise<DepartmentGroup[]> {
    try {
      // Get all groups
      const [groups] = await (pool as any).execute(
        `SELECT id, name, description, parent_group_id 
         FROM department_groups 
         WHERE tenant_id = ? 
         ORDER BY parent_group_id NULLS FIRST, name`,
        [tenantId]
      );

      // Get all department assignments
      const [assignments] = await (pool as any).execute(
        `SELECT dgm.group_id, d.id as dept_id, d.name as dept_name, d.description as dept_desc
         FROM department_group_members dgm
         JOIN departments d ON dgm.department_id = d.id
         WHERE dgm.tenant_id = ?`,
        [tenantId]
      );

      // Build assignment map
      const assignmentMap = new Map<number, Department[]>();
      assignments.forEach((row: any) => {
        if (!assignmentMap.has(row.group_id)) {
          assignmentMap.set(row.group_id, []);
        }
        assignmentMap.get(row.group_id)!.push({
          id: row.dept_id,
          name: row.dept_name,
          description: row.dept_desc,
        });
      });

      // Build hierarchy
      const groupMap = new Map<number, DepartmentGroup>();
      const rootGroups: DepartmentGroup[] = [];

      // First pass: create all group objects
      groups.forEach((row: any) => {
        const group: DepartmentGroup = {
          id: row.id,
          name: row.name,
          description: row.description,
          parent_group_id: row.parent_group_id,
          departments: assignmentMap.get(row.id) || [],
          subgroups: [],
        };
        groupMap.set(row.id, group);
      });

      // Second pass: build hierarchy
      groups.forEach((row: any) => {
        const group = groupMap.get(row.id)!;
        if (row.parent_group_id === null) {
          rootGroups.push(group);
        } else {
          const parent = groupMap.get(row.parent_group_id);
          if (parent) {
            parent.subgroups!.push(group);
          }
        }
      });

      return rootGroups;
    } catch (error) {
      logger.error('Error getting group hierarchy:', error);
      return [];
    }
  }

  /**
   * Update a group
   */
  async updateGroup(
    groupId: number,
    name: string,
    description: string | null,
    tenantId: number
  ): Promise<boolean> {
    try {
      const [result] = await (pool as any).execute(
        `UPDATE department_groups 
         SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ? AND tenant_id = ?`,
        [name, description, groupId, tenantId]
      );

      return result.affectedRows > 0;
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('Group name already exists');
      }
      logger.error('Error updating department group:', error);
      return false;
    }
  }

  /**
   * Delete a group (only if no admin permissions exist)
   */
  async deleteGroup(groupId: number, tenantId: number): Promise<boolean> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Check if any admin has permissions on this group
      const [permissions] = await connection.execute(
        `SELECT COUNT(*) as count FROM admin_group_permissions 
         WHERE group_id = ? AND tenant_id = ?`,
        [groupId, tenantId]
      );

      if (permissions[0].count > 0) {
        throw new Error('Cannot delete group with active admin permissions');
      }

      // Check if group has subgroups
      const [subgroups] = await connection.execute(
        `SELECT COUNT(*) as count FROM department_groups 
         WHERE parent_group_id = ? AND tenant_id = ?`,
        [groupId, tenantId]
      );

      if (subgroups[0].count > 0) {
        throw new Error('Cannot delete group with subgroups');
      }

      // Delete department assignments
      await connection.execute(
        `DELETE FROM department_group_members 
         WHERE group_id = ? AND tenant_id = ?`,
        [groupId, tenantId]
      );

      // Delete the group
      const [result] = await connection.execute(
        `DELETE FROM department_groups 
         WHERE id = ? AND tenant_id = ?`,
        [groupId, tenantId]
      );

      await connection.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      logger.error('Error deleting department group:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Check for circular dependencies
   */
  private async checkCircularDependency(
    groupId: number,
    targetId: number,
    tenantId: number
  ): Promise<boolean> {
    if (groupId === targetId) return true;

    const [parents] = await (pool as any).execute(
      `SELECT parent_group_id FROM department_groups 
       WHERE id = ? AND tenant_id = ?`,
      [groupId, tenantId]
    );

    if (parents.length === 0 || parents[0].parent_group_id === null) {
      return false;
    }

    return this.checkCircularDependency(
      parents[0].parent_group_id,
      targetId,
      tenantId
    );
  }
}

export default new DepartmentGroupService();
