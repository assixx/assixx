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
  departmentLeadId?: number;
  areaId?: number; // Add areaId field (camelCase)
  isActive: boolean;
  isArchived: boolean;
  tenantId: number;
  createdAt?: string;
  updatedAt?: string;
  // Extended fields
  departmentLeadName?: string;
  areaName?: string;
  employeeCount?: number;
  employeeNames?: string;
  teamCount?: number;
  teamNames?: string;
}

export interface CreateDepartmentData {
  name: string;
  description?: string | undefined;
  departmentLeadId?: number | undefined;
  areaId?: number | undefined;
  isActive?: boolean | undefined;
  isArchived?: boolean | undefined;
}

export interface UpdateDepartmentData {
  name?: string | undefined;
  description?: string | undefined;
  departmentLeadId?: number | undefined;
  areaId?: number | undefined;
  isActive?: boolean | undefined;
  isArchived?: boolean | undefined;
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

/** Department foreign key dependency counts */
interface DepartmentDependencies {
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
   * Map DbDepartment to base DepartmentV2 structure
   * @param dept - Database department record
   */
  private mapDbDepartmentToBase(dept: DbDepartment): DepartmentV2 {
    const result: DepartmentV2 = {
      id: dept.id,
      name: dept.name,
      isActive: Boolean(dept.is_active ?? 1),
      isArchived: Boolean(dept.is_archived ?? 0),
      tenantId: dept.tenant_id,
    };

    if (dept.description !== undefined) result.description = dept.description;
    if (dept.department_lead_id !== undefined) result.departmentLeadId = dept.department_lead_id;
    if (dept.area_id !== undefined) result.areaId = dept.area_id;
    if (dept.created_at !== undefined) result.createdAt = dept.created_at.toISOString();
    if (dept.updated_at !== undefined) result.updatedAt = dept.updated_at.toISOString();

    return result;
  }

  /**
   * Add extended fields to DepartmentV2 object
   * @param result - Target DepartmentV2 object
   * @param dept - Source database department record
   */
  private addExtendedFields(result: DepartmentV2, dept: DbDepartment): void {
    if (dept.department_lead_name !== undefined)
      result.departmentLeadName = dept.department_lead_name;
    if (dept.areaName !== undefined) result.areaName = dept.areaName;
    if (dept.employee_count !== undefined) result.employeeCount = dept.employee_count;
    if (dept.employee_names !== undefined) result.employeeNames = dept.employee_names;
    if (dept.team_count !== undefined) result.teamCount = dept.team_count;
    if (dept.team_names !== undefined) result.teamNames = dept.team_names;
  }

  /**
   * Get all departments for a tenant
   * @param tenantId - The tenant ID
   * @param includeExtended - The includeExtended parameter
   */
  async getDepartments(tenantId: number, includeExtended: boolean = true): Promise<DepartmentV2[]> {
    try {
      const departments = await Department.findAll(tenantId);

      return departments.map((dept: DbDepartment): DepartmentV2 => {
        const baseDept = this.mapDbDepartmentToBase(dept);
        if (includeExtended) this.addExtendedFields(baseDept, dept);
        return baseDept;
      });
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

      const result = this.mapDbDepartmentToBase(department);
      this.addExtendedFields(result, department);

      return result;
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error('Error getting department:', error);
      throw new ServiceError(500, 'Failed to retrieve department', error);
    }
  }

  /**
   * Build create data for new department
   * @param data - Input data from API
   * @param tenantId - Tenant ID
   */
  private buildCreateDataForDepartment(
    data: CreateDepartmentData,
    tenantId: number,
  ): {
    name: string;
    description?: string;
    department_lead_id?: number;
    area_id?: number;
    is_active: number;
    is_archived: number;
    tenant_id: number;
  } {
    const createData: ReturnType<typeof this.buildCreateDataForDepartment> = {
      name: data.name,
      tenant_id: tenantId,
      is_active: data.isActive === false ? 0 : 1, // Default active
      is_archived: data.isArchived === true ? 1 : 0, // Default not archived
    };

    if (data.description !== undefined) createData.description = data.description;
    if (data.departmentLeadId !== undefined) createData.department_lead_id = data.departmentLeadId;
    if (data.areaId !== undefined) createData.area_id = data.areaId;

    return createData;
  }

  /**
   * Check if error is a duplicate entry error
   * @param error - Error to check
   */
  private isDuplicateEntryError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return (
      error.message.includes('Duplicate entry') || error.message.includes('unique_name_tenant')
    );
  }

  /**
   * Create a new department
   * @param data - The data object
   * @param tenantId - The tenant ID
   */
  async createDepartment(data: CreateDepartmentData, tenantId: number): Promise<DepartmentV2> {
    try {
      if (data.name.trim() === '') {
        throw new ServiceError(400, 'Department name is required');
      }

      const createData = this.buildCreateDataForDepartment(data, tenantId);
      const departmentId = await Department.create(createData);

      return await this.getDepartmentById(departmentId, tenantId);
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      if (this.isDuplicateEntryError(error)) {
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
   * Validate department lead
   */
  private async validateDepartmentLead(
    departmentLeadId: number | undefined,
    tenantId: number,
  ): Promise<void> {
    if (departmentLeadId === undefined) return;

    const User = (await import('../../../models/user/index.js')).default;
    const lead = await User.findById(departmentLeadId, tenantId);
    if (!lead) {
      throw new ServiceError(400, 'Department lead not found');
    }
  }

  /**
   * Build update data object from input data
   */
  private buildUpdateData(data: UpdateDepartmentData): Partial<{
    name: string;
    description: string;
    department_lead_id: number;
    area_id: number;
    is_active: number;
    is_archived: number;
  }> {
    const updateData: ReturnType<typeof this.buildUpdateData> = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.departmentLeadId !== undefined) {
      updateData.department_lead_id = data.departmentLeadId;
    }
    if (data.areaId !== undefined) {
      updateData.area_id = data.areaId;
    }
    if (data.isActive !== undefined) {
      updateData.is_active = data.isActive ? 1 : 0; // Convert boolean to TINYINT
    }
    if (data.isArchived !== undefined) {
      updateData.is_archived = data.isArchived ? 1 : 0; // Convert boolean to TINYINT
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

      // Validate department lead if provided
      await this.validateDepartmentLead(data.departmentLeadId, tenantId);

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

  /** Tables to check for department dependencies */
  private getDependencyTables(): string[] {
    return [
      'users',
      'teams',
      'machines',
      'shifts',
      'shift_plans',
      'shift_favorites',
      'kvp_suggestions',
      'documents',
      'calendar_events',
      'survey_assignments',
      'admin_department_permissions',
      'department_group_members',
      'document_permissions',
    ];
  }

  /**
   * Check all foreign key dependencies for a department
   * @param id - Department ID
   * @param tenantId - Tenant ID
   */
  private async checkDepartmentDependencies(
    id: number,
    tenantId: number,
  ): Promise<DepartmentDependencies> {
    const tables = this.getDependencyTables();
    const counts = await Promise.all(
      tables.map((table: string): Promise<number> => this.countDependencies(table, id, tenantId)),
    );

    return {
      users: counts[0] ?? 0,
      teams: counts[1] ?? 0,
      machines: counts[2] ?? 0,
      shifts: counts[3] ?? 0,
      shiftPlans: counts[4] ?? 0,
      shiftFavorites: counts[5] ?? 0,
      kvpSuggestions: counts[6] ?? 0,
      documents: counts[7] ?? 0,
      calendarEvents: counts[8] ?? 0,
      surveyAssignments: counts[9] ?? 0,
      adminPermissions: counts[10] ?? 0,
      departmentGroupMembers: counts[11] ?? 0,
      documentPermissions: counts[12] ?? 0,
      total: counts.reduce((sum: number, c: number): number => sum + c, 0),
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
          is_active?: boolean | number;
        }): DepartmentMember => {
          const member: DepartmentMember = {
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.first_name ?? '',
            lastName: user.last_name ?? '',
            role: user.role ?? 'employee',
            isActive: Boolean(user.is_active),
          };

          // Add optional fields only if defined
          if (user.position !== undefined) {
            member.position = user.position;
          }
          if (user.employee_id !== undefined) {
            member.employeeId = user.employee_id;
          }

          return member;
        },
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
