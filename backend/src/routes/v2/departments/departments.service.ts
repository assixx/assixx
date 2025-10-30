import type { RowDataPacket } from 'mysql2';

// Model classes are exported as PascalCase objects for backward compatibility
// eslint-disable-next-line @typescript-eslint/naming-convention
import Department, { DbDepartment } from '../../../models/department.js';
import { execute } from '../../../utils/db.js';
import { logger } from '../../../utils/logger.js';

// API v2 Types
export interface DepartmentV2 {
  id: number;
  name: string;
  description?: string;
  managerId?: number;
  areaId?: number; // Add areaId field (camelCase)
  status?: string;
  visibility?: string;
  tenantId: number;
  createdAt?: string;
  updatedAt?: string;
  // Extended fields
  managerName?: string;
  areaName?: string;
  employeeCount?: number;
  employeeNames?: string;
  teamCount?: number;
  teamNames?: string;
}

export interface CreateDepartmentData {
  name: string;
  description?: string;
  managerId?: number;
  areaId?: number; // camelCase for v2 API
  status?: string;
  visibility?: string;
}

export interface UpdateDepartmentData {
  name?: string;
  description?: string;
  managerId?: number;
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
/**
 *
 */
class ServiceError extends Error {
  /**
   *
   * @param code - The code parameter
   * @param message - The message parameter
   * @param details - The details parameter
   */
  constructor(
    public code: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

/**
 *
 */
class DepartmentService {
  /**
   * Get all departments for a tenant
   * @param tenantId - The tenant ID
   * @param includeExtended - The includeExtended parameter
   */
  async getDepartments(tenantId: number, includeExtended: boolean = true): Promise<DepartmentV2[]> {
    try {
      const departments = await Department.findAll(tenantId);

      return departments.map((dept: DbDepartment) => ({
        id: dept.id,
        name: dept.name,
        description: dept.description,
        managerId: dept.manager_id,
        areaId: dept.area_id, // Add areaId to response
        status: dept.status,
        visibility: dept.visibility,
        tenantId: dept.tenant_id,
        createdAt: dept.created_at?.toISOString(),
        updatedAt: dept.updated_at?.toISOString(),
        // Extended fields if available
        ...(includeExtended && {
          managerName: dept.manager_name,
          areaName: dept.areaName,
          employeeCount: dept.employee_count ?? 0,
          employeeNames: dept.employee_names ?? '',
          teamCount: dept.team_count ?? 0,
          teamNames: dept.team_names ?? '',
        }),
      }));
    } catch (error: unknown) {
      logger.error('Error getting departments:', error);
      throw new ServiceError(500, 'Failed to retrieve departments', error);
    }
  }

  /**
   * Get a single department by ID
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   */
  async getDepartmentById(id: number, tenantId: number): Promise<DepartmentV2> {
    try {
      // Get all departments to get extended info
      const departments = await Department.findAll(tenantId);
      const department = departments.find((d: DbDepartment) => d.id === id);

      if (!department) {
        throw new ServiceError(404, 'Department not found');
      }

      return {
        id: department.id,
        name: department.name,
        description: department.description,
        managerId: department.manager_id,
        areaId: department.area_id, // Add areaId to response
        status: department.status,
        visibility: department.visibility,
        tenantId: department.tenant_id,
        createdAt: department.created_at?.toISOString(),
        updatedAt: department.updated_at?.toISOString(),
        // Include extended fields
        managerName: department.manager_name,
        areaName: department.areaName,
        employeeCount: department.employee_count ?? 0,
        employeeNames: department.employee_names ?? '',
        teamCount: department.team_count ?? 0,
        teamNames: department.team_names ?? '',
      };
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error('Error getting department:', error);
      throw new ServiceError(500, 'Failed to retrieve department', error);
    }
  }

  /**
   * Create a new department
   * @param data - The data object
   * @param tenantId - The tenant ID
   */
  async createDepartment(data: CreateDepartmentData, tenantId: number): Promise<DepartmentV2> {
    try {
      // Validate required fields
      if (!data.name || data.name.trim() === '') {
        throw new ServiceError(400, 'Department name is required');
      }

      const departmentId = await Department.create({
        name: data.name,
        description: data.description,
        manager_id: data.managerId,
        area_id: data.areaId, // Add area_id field (snake_case for DB) - undefined is OK
        status: data.status ?? 'active',
        visibility: data.visibility ?? 'public',
        tenant_id: tenantId,
      });

      return await this.getDepartmentById(departmentId, tenantId);
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;

      // Check for duplicate key error
      const errorMessage = (error as Error).message || '';
      if (errorMessage.includes('Duplicate entry') || errorMessage.includes('unique_name_tenant')) {
        throw new ServiceError(400, 'Department name already exists');
      }

      logger.error('Error creating department:', error);
      throw new ServiceError(500, 'Failed to create department', error);
    }
  }

  /**
   * Validate parent department for update
   */

  /**
   * Validate manager for department
   */
  private async validateManager(managerId: number | undefined, tenantId: number): Promise<void> {
    if (managerId === undefined) return;

    const User = (await import('../../../models/user/index.js')).default;
    const manager = await User.findById(managerId, tenantId);
    if (!manager) {
      throw new ServiceError(400, 'Manager not found');
    }
  }

  /**
   * Build update data object from input data
   */
  private buildUpdateData(data: UpdateDepartmentData): Partial<{
    name: string;
    description: string;
    manager_id: number;
    area_id: number;
    status: string;
    visibility: string;
  }> {
    const updateData: ReturnType<typeof this.buildUpdateData> = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.managerId !== undefined) {
      updateData.manager_id = data.managerId;
    }
    if (data.areaId !== undefined) {
      updateData.area_id = data.areaId;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.visibility !== undefined) {
      updateData.visibility = data.visibility;
    }

    return updateData;
  }

  /**
   * Update a department
   * @param id - The resource ID
   * @param data - The data object
   * @param tenantId - The tenant ID
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
        throw new ServiceError(404, 'Department not found');
      }

      // Validate manager if provided
      await this.validateManager(data.managerId, tenantId);

      const updateData = this.buildUpdateData(data);
      const success = await Department.update(id, updateData);

      if (!success) {
        throw new ServiceError(500, 'Failed to update department');
      }

      return await this.getDepartmentById(id, tenantId);
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error('Error updating department:', error);
      throw new ServiceError(500, 'Failed to update department', error);
    }
  }

  /**
   * Helper: Count dependencies in a single table
   * @param tableName - Table name to check
   * @param departmentId - Department ID
   * @param tenantId - Tenant ID
   * @returns Count of dependent records
   */
  private async countDependencies(
    tableName: string,
    departmentId: number,
    tenantId: number,
  ): Promise<number> {
    const [rows] = await execute<RowDataPacket[]>(
      `SELECT id FROM ${tableName} WHERE department_id = ? AND tenant_id = ?`,
      [departmentId, tenantId],
    );
    return rows.length;
  }

  /**
   * Check all foreign key dependencies for a department
   * @param id - Department ID
   * @param tenantId - Tenant ID
   * @returns Object with dependency counts
   */
  private async checkDepartmentDependencies(
    id: number,
    tenantId: number,
  ): Promise<{
    users: number;
    teams: number;
    machines: number;
    shifts: number;
    shiftPlans: number;
    shiftFavorites: number;
    kvpSuggestions: number;
    documents: number;
    calendarEvents: number;
    surveyAssignments: number;
    adminPermissions: number;
    departmentGroupMembers: number;
    documentPermissions: number;
    total: number;
  }> {
    // Check all dependencies in parallel for better performance
    const [
      users,
      teams,
      machines,
      shifts,
      shiftPlans,
      shiftFavorites,
      kvpSuggestions,
      documents,
      calendarEvents,
      surveyAssignments,
      adminPermissions,
      departmentGroupMembers,
      documentPermissions,
    ] = await Promise.all([
      this.countDependencies('users', id, tenantId),
      this.countDependencies('teams', id, tenantId),
      this.countDependencies('machines', id, tenantId),
      this.countDependencies('shifts', id, tenantId),
      this.countDependencies('shift_plans', id, tenantId),
      this.countDependencies('shift_favorites', id, tenantId),
      this.countDependencies('kvp_suggestions', id, tenantId),
      this.countDependencies('documents', id, tenantId),
      this.countDependencies('calendar_events', id, tenantId),
      this.countDependencies('survey_assignments', id, tenantId),
      this.countDependencies('admin_department_permissions', id, tenantId),
      this.countDependencies('department_group_members', id, tenantId),
      this.countDependencies('document_permissions', id, tenantId),
    ]);

    const total =
      users +
      teams +
      machines +
      shifts +
      shiftPlans +
      shiftFavorites +
      kvpSuggestions +
      documents +
      calendarEvents +
      surveyAssignments +
      adminPermissions +
      departmentGroupMembers +
      documentPermissions;

    return {
      users,
      teams,
      machines,
      shifts,
      shiftPlans,
      shiftFavorites,
      kvpSuggestions,
      documents,
      calendarEvents,
      surveyAssignments,
      adminPermissions,
      departmentGroupMembers,
      documentPermissions,
      total,
    };
  }

  /**
   * Build dependency details object for error response
   * @param deps - Dependency counts
   * @returns Details object with non-zero counts
   */
  private buildDependencyDetails(
    deps: Awaited<ReturnType<DepartmentService['checkDepartmentDependencies']>>,
  ): Record<string, number> {
    // Use Object.entries to avoid dynamic key access (security/detect-object-injection)
    return {
      totalDependencies: deps.total,
      ...Object.entries(deps)
        .filter(([key, value]: [string, unknown]): boolean => {
          // Exclude 'total' (already included) and only include numbers > 0
          return key !== 'total' && typeof value === 'number' && value > 0;
        })
        .reduce<Record<string, number>>(
          (
            acc: Record<string, number>,
            [key, value]: [string, unknown],
          ): Record<string, number> => {
            return { ...acc, [key]: value as number };
          },
          {},
        ),
    };
  }

  /**
   * Helper: Remove dependency from a single table (SET NULL or DELETE)
   * @param tableName - Table name
   * @param operation - 'UPDATE' (SET NULL) or 'DELETE'
   * @param departmentId - Department ID
   * @param tenantId - Tenant ID
   */
  private async removeDependencyFrom(
    tableName: string,
    operation: 'UPDATE' | 'DELETE',
    departmentId: number,
    tenantId: number,
  ): Promise<void> {
    if (operation === 'UPDATE') {
      await execute(
        `UPDATE ${tableName} SET department_id = NULL WHERE department_id = ? AND tenant_id = ?`,
        [departmentId, tenantId],
      );
    } else {
      await execute(`DELETE FROM ${tableName} WHERE department_id = ? AND tenant_id = ?`, [
        departmentId,
        tenantId,
      ]);
    }
  }

  /**
   * Remove all department dependencies (SET NULL or DELETE)
   * @param id - Department ID
   * @param tenantId - Tenant ID
   * @param deps - Dependency counts
   */
  private async removeDepartmentDependencies(
    id: number,
    tenantId: number,
    deps: Awaited<ReturnType<DepartmentService['checkDepartmentDependencies']>>,
  ): Promise<void> {
    // Define table cleanup strategy: 'UPDATE' preserves data, 'DELETE' removes completely
    const cleanupStrategies: { table: string; operation: 'UPDATE' | 'DELETE'; count: number }[] = [
      { table: 'users', operation: 'UPDATE', count: deps.users },
      { table: 'teams', operation: 'UPDATE', count: deps.teams },
      { table: 'machines', operation: 'UPDATE', count: deps.machines },
      { table: 'shifts', operation: 'UPDATE', count: deps.shifts },
      { table: 'shift_plans', operation: 'UPDATE', count: deps.shiftPlans },
      { table: 'shift_favorites', operation: 'DELETE', count: deps.shiftFavorites },
      { table: 'kvp_suggestions', operation: 'UPDATE', count: deps.kvpSuggestions },
      { table: 'documents', operation: 'UPDATE', count: deps.documents },
      { table: 'calendar_events', operation: 'UPDATE', count: deps.calendarEvents },
      { table: 'survey_assignments', operation: 'DELETE', count: deps.surveyAssignments },
      { table: 'admin_department_permissions', operation: 'DELETE', count: deps.adminPermissions },
      {
        table: 'department_group_members',
        operation: 'DELETE',
        count: deps.departmentGroupMembers,
      },
      { table: 'document_permissions', operation: 'DELETE', count: deps.documentPermissions },
    ];

    // Execute all cleanup operations in parallel for performance
    await Promise.all(
      cleanupStrategies
        .filter((strategy: { count: number }): boolean => strategy.count > 0)
        .map(
          (strategy: { table: string; operation: 'UPDATE' | 'DELETE' }): Promise<void> =>
            this.removeDependencyFrom(strategy.table, strategy.operation, id, tenantId),
        ),
    );
  }

  /**
   * Handle department dependencies for deletion
   * @param id - Department ID
   * @param tenantId - Tenant ID
   * @param force - If true, remove all dependencies before deleting
   */
  private async handleDepartmentDependenciesForDeletion(
    id: number,
    tenantId: number,
    force: boolean,
  ): Promise<void> {
    const deps = await this.checkDepartmentDependencies(id, tenantId);

    // No dependencies - safe to delete
    if (deps.total === 0) {
      return;
    }

    // Has dependencies but force=false - throw error with details
    if (!force) {
      const details = this.buildDependencyDetails(deps);
      throw new ServiceError(400, 'Cannot delete department with dependencies', details);
    }

    // Force delete - remove all dependencies
    await this.removeDepartmentDependencies(id, tenantId, deps);
  }

  /**
   * Delete a department
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   * @param force - If true, remove all dependencies before deleting
   */
  async deleteDepartment(id: number, tenantId: number, force: boolean = false): Promise<void> {
    try {
      // Check if department exists
      const existing = await Department.findById(id, tenantId);
      if (!existing) {
        throw new ServiceError(404, 'Department not found');
      }

      // Handle all dependencies (checks 13 foreign keys)
      await this.handleDepartmentDependenciesForDeletion(id, tenantId, force);

      const success = await Department.delete(id);

      if (!success) {
        throw new ServiceError(500, 'Failed to delete department');
      }
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error('Error deleting department:', error);
      throw new ServiceError(500, 'Failed to delete department', error);
    }
  }

  /**
   * Get department members
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   */
  async getDepartmentMembers(id: number, tenantId: number): Promise<DepartmentMember[]> {
    try {
      // Check if department exists
      const existing = await Department.findById(id, tenantId);
      if (!existing) {
        throw new ServiceError(404, 'Department not found');
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
          firstName: user.first_name ?? '',
          lastName: user.last_name ?? '',
          position: user.position,
          employeeId: user.employee_id,
          role: user.role ?? 'employee',
          isActive: user.status === 'active',
        }),
      );
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error('Error getting department members:', error);
      throw new ServiceError(500, 'Failed to retrieve department members', error);
    }
  }

  /**
   * Get department statistics
   * @param tenantId - The tenant ID
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
      logger.error('Error getting department stats:', error);
      throw new ServiceError(500, 'Failed to retrieve department statistics', error);
    }
  }
}

// Export singleton instance
export const departmentService = new DepartmentService();
