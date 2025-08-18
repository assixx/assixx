/**
 * Department Groups Service v2
 * Business logic for managing hierarchical department groups
 */

import { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  DepartmentGroup,
  DepartmentGroupWithHierarchy,
  GroupDepartment,
  CreateGroupRequest,
  UpdateGroupRequest,
} from "./types.js";
import RootLog from "../../../models/rootLog";
import { execute, getConnection } from "../../../utils/db.js";
import { logger } from "../../../utils/logger.js";
import { ServiceError } from "../../../utils/ServiceError.js";

interface GroupRow extends RowDataPacket {
  id: number;
  name: string;
  description?: string;
  parent_group_id?: number;
  member_count: number;
  created_at: string;
  updated_at: string;
  created_by: number;
}

interface DepartmentRow extends RowDataPacket {
  id: number;
  name: string;
  description?: string;
}

interface AssignmentRow extends RowDataPacket {
  group_id: number;
  dept_id: number;
  dept_name: string;
  dept_desc?: string;
}

/**
 *
 */
export class DepartmentGroupsService {
  /**
   * Create a new department group
   * @param data
   * @param tenantId
   * @param createdBy
   */
  async createGroup(
    data: CreateGroupRequest,
    tenantId: number,
    createdBy: number,
  ): Promise<number> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      // Check for circular dependencies if parent group is specified
      if (data.parentGroupId) {
        const hasCircular = await this.checkCircularDependency(
          data.parentGroupId,
          0,
          tenantId,
        );
        if (hasCircular) {
          throw new ServiceError(
            "CIRCULAR_DEPENDENCY",
            "Circular dependency detected",
          );
        }
      }

      // Create the group
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO department_groups (tenant_id, name, description, parent_group_id, created_by) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          tenantId,
          data.name,
          data.description ?? null,
          data.parentGroupId ?? null,
          createdBy,
        ],
      );

      const groupId = result.insertId;

      // Add departments if provided
      if (data.departmentIds && data.departmentIds.length > 0) {
        const values = data.departmentIds.map((deptId) => [
          tenantId,
          groupId,
          deptId,
          createdBy,
        ]);

        const placeholders = data.departmentIds
          .map(() => "(?, ?, ?, ?)")
          .join(", ");

        await connection.execute(
          `INSERT INTO department_group_members (tenant_id, group_id, department_id, added_by) 
           VALUES ${placeholders}`,
          values.flat(),
        );
      }

      await connection.commit();

      // Log the creation
      await RootLog.log(
        "department_group_created",
        createdBy,
        tenantId,
        `Created department group: ${data.name} (ID: ${groupId})`,
      );

      return groupId;
    } catch (error: unknown) {
      await connection.rollback();

      if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
        throw new ServiceError("GROUP_EXISTS", "Group name already exists");
      }

      if (error instanceof ServiceError) throw error;

      logger.error("Error creating department group:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to create group");
    } finally {
      connection.release();
    }
  }

  /**
   * Get all groups with hierarchy
   * @param tenantId
   */
  async getGroupHierarchy(
    tenantId: number,
  ): Promise<DepartmentGroupWithHierarchy[]> {
    try {
      // Get all groups with member count
      const [groups] = await execute<GroupRow[]>(
        `SELECT g.*, 
         (SELECT COUNT(*) FROM department_group_members dgm WHERE dgm.group_id = g.id) as member_count
         FROM department_groups g
         WHERE g.tenant_id = ? 
         ORDER BY g.parent_group_id, g.name`,
        [tenantId],
      );

      // Get all department assignments
      const [assignments] = await execute<AssignmentRow[]>(
        `SELECT dgm.group_id, d.id as dept_id, d.name as dept_name, d.description as dept_desc
         FROM department_group_members dgm
         JOIN departments d ON dgm.department_id = d.id
         WHERE dgm.tenant_id = ? AND d.is_active = 1`,
        [tenantId],
      );

      // Build assignment map
      const assignmentMap = new Map<number, GroupDepartment[]>();
      assignments.forEach((row) => {
        if (!assignmentMap.has(row.group_id)) {
          assignmentMap.set(row.group_id, []);
        }
        assignmentMap.get(row.group_id)?.push({
          id: row.dept_id,
          name: row.dept_name,
          description: row.dept_desc,
        });
      });

      // Build hierarchy
      const groupMap = new Map<number, DepartmentGroupWithHierarchy>();
      const rootGroups: DepartmentGroupWithHierarchy[] = [];

      // First pass: create all group objects
      groups.forEach((row) => {
        const group: DepartmentGroupWithHierarchy = {
          id: row.id,
          name: row.name,
          description: row.description,
          parentGroupId: row.parent_group_id ?? undefined,
          memberCount: row.member_count,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString(),
          createdBy: row.created_by,
          departments: assignmentMap.get(row.id) ?? [],
          subgroups: [],
        };
        groupMap.set(row.id, group);
      });

      // Second pass: build hierarchy
      groups.forEach((row) => {
        const group = groupMap.get(row.id);
        if (!group) return;

        if (!row.parent_group_id) {
          rootGroups.push(group);
        } else {
          const parent = groupMap.get(row.parent_group_id);
          if (parent) {
            parent.subgroups.push(group);
          }
        }
      });

      return rootGroups;
    } catch (error: unknown) {
      logger.error("Error getting group hierarchy:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to get groups");
    }
  }

  /**
   * Get a single group by ID
   * @param groupId
   * @param tenantId
   */
  async getGroupById(
    groupId: number,
    tenantId: number,
  ): Promise<DepartmentGroup> {
    try {
      const [rows] = await execute<GroupRow[]>(
        `SELECT g.*, 
         (SELECT COUNT(*) FROM department_group_members dgm WHERE dgm.group_id = g.id) as member_count
         FROM department_groups g
         WHERE g.id = ? AND g.tenant_id = ?`,
        [groupId, tenantId],
      );

      if (rows.length === 0) {
        throw new ServiceError("NOT_FOUND", "Group not found");
      }

      const row = rows[0];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        parentGroupId: row.parent_group_id ?? undefined,
        memberCount: row.member_count,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
        createdBy: row.created_by,
      };
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error("Error getting group by ID:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to get group");
    }
  }

  /**
   * Update a group
   * @param groupId
   * @param data
   * @param tenantId
   * @param updatedBy
   */
  async updateGroup(
    groupId: number,
    data: UpdateGroupRequest,
    tenantId: number,
    updatedBy: number,
  ): Promise<void> {
    try {
      const [result] = await execute<ResultSetHeader>(
        `UPDATE department_groups 
         SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ? AND tenant_id = ?`,
        [data.name, data.description ?? null, groupId, tenantId],
      );

      if (result.affectedRows === 0) {
        throw new ServiceError("NOT_FOUND", "Group not found");
      }

      // Log the update
      await RootLog.log(
        "department_group_updated",
        updatedBy,
        tenantId,
        `Updated department group: ${data.name} (ID: ${groupId})`,
      );
    } catch (error: unknown) {
      if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
        throw new ServiceError("GROUP_EXISTS", "Group name already exists");
      }
      if (error instanceof ServiceError) throw error;
      logger.error("Error updating department group:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to update group");
    }
  }

  /**
   * Delete a group
   * @param groupId
   * @param tenantId
   * @param deletedBy
   */
  async deleteGroup(
    groupId: number,
    tenantId: number,
    deletedBy: number,
  ): Promise<void> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      // Check if any admin has permissions on this group
      const [permissions] = await connection.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM admin_group_permissions 
         WHERE group_id = ? AND tenant_id = ?`,
        [groupId, tenantId],
      );

      if (permissions[0].count > 0) {
        throw new ServiceError(
          "HAS_PERMISSIONS",
          "Cannot delete group with active admin permissions",
        );
      }

      // Check if group has subgroups
      const [subgroups] = await connection.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM department_groups 
         WHERE parent_group_id = ? AND tenant_id = ?`,
        [groupId, tenantId],
      );

      if (subgroups[0].count > 0) {
        throw new ServiceError(
          "HAS_SUBGROUPS",
          "Cannot delete group with subgroups",
        );
      }

      // Get group name for logging
      const [groupData] = await connection.execute<RowDataPacket[]>(
        `SELECT name FROM department_groups WHERE id = ? AND tenant_id = ?`,
        [groupId, tenantId],
      );

      if (groupData.length === 0) {
        throw new ServiceError("NOT_FOUND", "Group not found");
      }

      const groupName = groupData[0].name;

      // Delete department assignments
      await connection.execute(
        `DELETE FROM department_group_members 
         WHERE group_id = ? AND tenant_id = ?`,
        [groupId, tenantId],
      );

      // Delete the group
      await connection.execute(
        `DELETE FROM department_groups 
         WHERE id = ? AND tenant_id = ?`,
        [groupId, tenantId],
      );

      await connection.commit();

      // Log the deletion
      await RootLog.log(
        "department_group_deleted",
        deletedBy,
        tenantId,
        `Deleted department group: ${groupName} (ID: ${groupId})`,
      );
    } catch (error: unknown) {
      await connection.rollback();
      if (error instanceof ServiceError) throw error;
      logger.error("Error deleting department group:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to delete group");
    } finally {
      connection.release();
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
  ): Promise<void> {
    if (departmentIds.length === 0) return;

    try {
      // Check if group exists
      const [groupCheck] = await execute<RowDataPacket[]>(
        `SELECT id FROM department_groups WHERE id = ? AND tenant_id = ?`,
        [groupId, tenantId],
      );

      if (groupCheck.length === 0) {
        throw new ServiceError("NOT_FOUND", "Group not found");
      }

      // Prepare bulk insert values
      const values = departmentIds.map((deptId) => [
        tenantId,
        groupId,
        deptId,
        addedBy,
      ]);

      const placeholders = departmentIds.map(() => "(?, ?, ?, ?)").join(", ");

      // Insert with ON DUPLICATE KEY UPDATE to handle existing assignments
      await execute(
        `INSERT INTO department_group_members (tenant_id, group_id, department_id, added_by) 
         VALUES ${placeholders}
         ON DUPLICATE KEY UPDATE added_by = VALUES(added_by), added_at = CURRENT_TIMESTAMP`,
        values.flat(),
      );

      // Log the action
      await RootLog.log(
        "departments_added_to_group",
        addedBy,
        tenantId,
        `Added ${departmentIds.length} departments to group ${groupId}`,
      );
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error("Error adding departments to group:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to add departments");
    }
  }

  /**
   * Remove a department from a group
   * @param groupId
   * @param departmentId
   * @param tenantId
   * @param removedBy
   */
  async removeDepartmentFromGroup(
    groupId: number,
    departmentId: number,
    tenantId: number,
    removedBy: number,
  ): Promise<void> {
    try {
      const [result] = await execute<ResultSetHeader>(
        `DELETE FROM department_group_members 
         WHERE group_id = ? AND department_id = ? AND tenant_id = ?`,
        [groupId, departmentId, tenantId],
      );

      if (result.affectedRows === 0) {
        throw new ServiceError("NOT_FOUND", "Department not found in group");
      }

      // Log the action
      await RootLog.log(
        "department_removed_from_group",
        removedBy,
        tenantId,
        `Removed department ${departmentId} from group ${groupId}`,
      );
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error("Error removing department from group:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to remove department");
    }
  }

  /**
   * Get departments in a group
   * @param groupId
   * @param tenantId
   * @param includeSubgroups
   */
  async getGroupDepartments(
    groupId: number,
    tenantId: number,
    includeSubgroups = true,
  ): Promise<GroupDepartment[]> {
    try {
      const departments = new Map<number, GroupDepartment>();

      // Get direct departments
      const [directDepts] = await execute<DepartmentRow[]>(
        `SELECT d.id, d.name, d.description
         FROM departments d
         JOIN department_group_members dgm ON d.id = dgm.department_id
         WHERE dgm.group_id = ? AND dgm.tenant_id = ? AND d.is_active = 1`,
        [groupId, tenantId],
      );

      directDepts.forEach((dept) => {
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
          tenantId,
        );
        subgroupDepts.forEach((dept) => {
          departments.set(dept.id, dept);
        });
      }

      return [...departments.values()];
    } catch (error: unknown) {
      logger.error("Error getting group departments:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to get departments");
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
  ): Promise<GroupDepartment[]> {
    const departments = new Map<number, GroupDepartment>();

    // Get all subgroups
    const [subgroups] = await execute<RowDataPacket[]>(
      `SELECT id FROM department_groups 
       WHERE parent_group_id = ? AND tenant_id = ?`,
      [parentGroupId, tenantId],
    );

    // For each subgroup, get its departments
    for (const subgroup of subgroups) {
      const subgroupDepts = await this.getGroupDepartments(
        subgroup.id,
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

    if (parents.length === 0 || !parents[0].parent_group_id) {
      return false;
    }

    return this.checkCircularDependency(
      parents[0].parent_group_id,
      targetId,
      tenantId,
    );
  }
}

export const departmentGroupsService = new DepartmentGroupsService();
