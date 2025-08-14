import Department, { DbDepartment } from "../../../models/department.js";
import { logger } from "../../../utils/logger.js";

// API v2 Types
export interface DepartmentV2 {
  id: number;
  name: string;
  description?: string;
  managerId?: number;
  parentId?: number;
  areaId?: number; // Add areaId field (camelCase)
  status?: string;
  visibility?: string;
  tenantId: number;
  createdAt?: string;
  updatedAt?: string;
  // Extended fields
  managerName?: string;
  employeeCount?: number;
  teamCount?: number;
}

export interface CreateDepartmentData {
  name: string;
  description?: string;
  managerId?: number;
  parentId?: number;
  areaId?: number; // camelCase for v2 API
  status?: string;
  visibility?: string;
}

export interface UpdateDepartmentData {
  name?: string;
  description?: string;
  managerId?: number;
  parentId?: number;
  areaId?: number; // camelCase for v2 API
  status?: string;
  visibility?: string;
}

export interface DepartmentMember {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  position?: string;
  employeeId?: string;
  role: string;
  isActive: boolean;
}

// Service Error Class
export class ServiceError extends Error {
  constructor(
    public code: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export class DepartmentService {
  /**
   * Get all departments for a tenant
   */
  async getDepartments(
    tenantId: number,
    includeExtended: boolean = true,
  ): Promise<DepartmentV2[]> {
    try {
      const departments = await Department.findAll(tenantId);

      return departments.map((dept: DbDepartment) => ({
        id: dept.id,
        name: dept.name,
        description: dept.description,
        managerId: dept.manager_id,
        parentId: dept.parent_id,
        areaId: dept.area_id, // Add areaId to response
        status: dept.status,
        visibility: dept.visibility,
        tenantId: dept.tenant_id,
        createdAt: dept.created_at?.toISOString(),
        updatedAt: dept.updated_at?.toISOString(),
        // Extended fields if available
        ...(includeExtended && {
          managerName: dept.manager_name,
          employeeCount: dept.employee_count ?? 0,
          teamCount: dept.team_count ?? 0,
        }),
      }));
    } catch (error: unknown) {
      logger.error("Error getting departments:", error);
      throw new ServiceError(500, "Failed to retrieve departments", error);
    }
  }

  /**
   * Get a single department by ID
   */
  async getDepartmentById(id: number, tenantId: number): Promise<DepartmentV2> {
    try {
      // Get all departments to get extended info
      const departments = await Department.findAll(tenantId);
      const department = departments.find((d) => d.id === id);

      if (!department) {
        throw new ServiceError(404, "Department not found");
      }

      return {
        id: department.id,
        name: department.name,
        description: department.description,
        managerId: department.manager_id,
        parentId: department.parent_id,
        areaId: department.area_id, // Add areaId to response
        status: department.status,
        visibility: department.visibility,
        tenantId: department.tenant_id,
        createdAt: department.created_at?.toISOString(),
        updatedAt: department.updated_at?.toISOString(),
        // Include extended fields
        managerName: department.manager_name,
        employeeCount: department.employee_count ?? 0,
        teamCount: department.team_count ?? 0,
      };
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error("Error getting department:", error);
      throw new ServiceError(500, "Failed to retrieve department", error);
    }
  }

  /**
   * Create a new department
   */
  async createDepartment(
    data: CreateDepartmentData,
    tenantId: number,
  ): Promise<DepartmentV2> {
    try {
      // Validate required fields
      if (!data.name || data.name.trim() === "") {
        throw new ServiceError(400, "Department name is required");
      }

      // Validate parent department if specified
      if (data.parentId) {
        const parent = await Department.findById(data.parentId, tenantId);
        if (!parent) {
          throw new ServiceError(400, "Parent department not found");
        }
      }

      const departmentId = await Department.create({
        name: data.name,
        description: data.description,
        manager_id: data.managerId,
        parent_id: data.parentId,
        area_id: data.areaId, // Add area_id field (snake_case for DB) - undefined is OK
        status: data.status ?? "active",
        visibility: data.visibility ?? "public",
        tenant_id: tenantId,
      });

      return this.getDepartmentById(departmentId, tenantId);
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;

      // Check for duplicate key error
      const errorMessage = (error as Error).message ?? "";
      if (
        errorMessage.includes("Duplicate entry") ||
        errorMessage.includes("unique_name_tenant")
      ) {
        throw new ServiceError(400, "Department name already exists");
      }

      logger.error("Error creating department:", error);
      throw new ServiceError(500, "Failed to create department", error);
    }
  }

  /**
   * Update a department
   */
  async updateDepartment(
    id: number,
    data: UpdateDepartmentData,
    tenantId: number,
  ): Promise<DepartmentV2> {
    try {
      // Check if department exists
      const existing = await Department.findById(id, tenantId);
      if (!existing) {
        throw new ServiceError(404, "Department not found");
      }

      // Validate parent department if specified
      if (data.parentId !== undefined) {
        if (data.parentId === id) {
          throw new ServiceError(400, "Department cannot be its own parent");
        }

        if (data.parentId) {
          const parent = await Department.findById(data.parentId, tenantId);
          if (!parent) {
            throw new ServiceError(400, "Parent department not found");
          }
        }
      }

      // Validate manager if specified
      if (data.managerId !== undefined && data.managerId !== null) {
        const User = (await import("../../../models/user.js")).default;
        const manager = await User.findById(data.managerId, tenantId);
        if (!manager) {
          throw new ServiceError(400, "Manager not found");
        }
      }

      const updateData: Partial<{
        name: string;
        description: string;
        manager_id: number;
        parent_id: number;
        area_id: number;
        status: string;
        visibility: string;
      }> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.managerId !== undefined) updateData.manager_id = data.managerId;
      if (data.parentId !== undefined) updateData.parent_id = data.parentId;
      if (data.areaId !== undefined) updateData.area_id = data.areaId; // Add area_id mapping
      if (data.status !== undefined) updateData.status = data.status;
      if (data.visibility !== undefined)
        updateData.visibility = data.visibility;

      const success = await Department.update(id, updateData);

      if (!success) {
        throw new ServiceError(500, "Failed to update department");
      }

      return this.getDepartmentById(id, tenantId);
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error("Error updating department:", error);
      throw new ServiceError(500, "Failed to update department", error);
    }
  }

  /**
   * Delete a department
   */
  async deleteDepartment(id: number, tenantId: number): Promise<void> {
    try {
      // Check if department exists
      const existing = await Department.findById(id, tenantId);
      if (!existing) {
        throw new ServiceError(404, "Department not found");
      }

      // Check if department has members
      const members = await Department.getUsersByDepartment(id);
      if (members.length > 0) {
        throw new ServiceError(
          400,
          "Cannot delete department with assigned users",
          { userCount: members.length },
        );
      }

      const success = await Department.delete(id);

      if (!success) {
        throw new ServiceError(500, "Failed to delete department");
      }
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error("Error deleting department:", error);
      throw new ServiceError(500, "Failed to delete department", error);
    }
  }

  /**
   * Get department members
   */
  async getDepartmentMembers(
    id: number,
    tenantId: number,
  ): Promise<DepartmentMember[]> {
    try {
      // Check if department exists
      const existing = await Department.findById(id, tenantId);
      if (!existing) {
        throw new ServiceError(404, "Department not found");
      }

      const users = await Department.getUsersByDepartment(id);

      return users.map(
        (user: {
          id: number;
          username: string;
          email: string;
          first_name?: string;
          last_name?: string;
          position?: string;
          employee_id?: string;
          role?: string;
          status?: string;
        }) => ({
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.first_name ?? "",
          lastName: user.last_name ?? "",
          position: user.position,
          employeeId: user.employee_id,
          role: user.role ?? "employee",
          isActive: user.status === "active",
        }),
      );
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error("Error getting department members:", error);
      throw new ServiceError(
        500,
        "Failed to retrieve department members",
        error,
      );
    }
  }

  /**
   * Get department statistics
   */
  async getDepartmentStats(tenantId: number): Promise<{
    totalDepartments: number;
    totalTeams: number;
  }> {
    try {
      const departmentCount = await Department.countByTenant(tenantId);
      const teamCount = await Department.countTeamsByTenant(tenantId);

      return {
        totalDepartments: departmentCount,
        totalTeams: teamCount,
      };
    } catch (error: unknown) {
      logger.error("Error getting department stats:", error);
      throw new ServiceError(
        500,
        "Failed to retrieve department statistics",
        error,
      );
    }
  }
}

// Export singleton instance
export const departmentService = new DepartmentService();
