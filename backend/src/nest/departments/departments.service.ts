/**
 * Departments Service
 *
 * Business logic for department management.
 * Status: 0=inactive, 1=active, 3=archived, 4=deleted
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import type { RowDataPacket } from '../../utils/db.js';
import { execute } from '../../utils/db.js';
import type { CreateDepartmentDto } from './dto/create-department.dto.js';
import type { UpdateDepartmentDto } from './dto/update-department.dto.js';

/**
 * Database department row type
 */
export interface DepartmentRow extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  department_lead_id: number | null;
  area_id: number | null;
  is_active: number;
  tenant_id: number;
  created_at: Date;
  updated_at: Date;
  department_lead_name: string | undefined;
  areaName: string | undefined;
  employee_count: number | undefined;
  employee_names: string | undefined;
  team_count: number | undefined;
  team_names: string | undefined;
}

/**
 * API response type for department
 */
export interface DepartmentResponse {
  id: number;
  name: string;
  description: string | undefined;
  departmentLeadId: number | undefined;
  areaId: number | undefined;
  isActive: number;
  tenantId: number;
  createdAt: string | undefined;
  updatedAt: string | undefined;
  departmentLeadName: string | undefined;
  areaName: string | undefined;
  employeeCount: number | undefined;
  employeeNames: string | undefined;
  teamCount: number | undefined;
  teamNames: string | undefined;
}

/**
 * Department member type
 */
export interface DepartmentMember {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  position: string | undefined;
  employeeId: string | undefined;
  role: string;
  isActive: boolean;
}

/**
 * Department statistics type
 */
export interface DepartmentStats {
  totalDepartments: number;
  totalTeams: number;
}

/**
 * Department dependencies for deletion check
 */
interface DepartmentDependencies {
  userDepartments: number;
  teams: number;
  machines: number;
  shifts: number;
  shiftPlans: number;
  shiftFavorites: number;
  kvpSuggestions: number;
  calendarEvents: number;
  surveyAssignments: number;
  adminPermissions: number;
  documentPermissions: number;
  total: number;
}

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);

  /**
   * SQL query for fetching departments with employee/team counts via user_departments N:M
   */
  private readonly FIND_ALL_DEPARTMENTS_QUERY = `
    WITH employee_counts AS (
      SELECT ud.department_id, COUNT(*) as count,
        STRING_AGG(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, u.username)),
          E'\\n' ORDER BY u.last_name, u.first_name) as names
      FROM user_departments ud
      JOIN users u ON ud.user_id = u.id AND ud.tenant_id = u.tenant_id
      WHERE ud.tenant_id = $1 AND u.is_active IN (0, 1)
      GROUP BY ud.department_id
    ),
    team_counts AS (
      SELECT department_id, COUNT(*) as count,
        STRING_AGG(name, E'\\n' ORDER BY name) as names
      FROM teams GROUP BY department_id
    )
    SELECT d.*, CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as department_lead_name, a.name as "areaName",
      COALESCE(ec.count, 0) as employee_count, COALESCE(ec.names, '') as employee_names,
      COALESCE(tc.count, 0) as team_count, COALESCE(tc.names, '') as team_names
    FROM departments d
    LEFT JOIN users u ON d.department_lead_id = u.id
    LEFT JOIN areas a ON d.area_id = a.id
    LEFT JOIN employee_counts ec ON ec.department_id = d.id
    LEFT JOIN team_counts tc ON tc.department_id = d.id
    WHERE d.tenant_id = $2 AND d.is_active = 1
    ORDER BY d.name`;

  /**
   * Map database row to API response
   */
  private mapToResponse(dept: DepartmentRow, includeExtended: boolean): DepartmentResponse {
    const response: DepartmentResponse = {
      id: dept.id,
      name: dept.name,
      description: dept.description ?? undefined,
      departmentLeadId: dept.department_lead_id ?? undefined,
      areaId: dept.area_id ?? undefined,
      isActive: dept.is_active,
      tenantId: dept.tenant_id,
      createdAt: dept.created_at.toISOString(),
      updatedAt: dept.updated_at.toISOString(),
      departmentLeadName: undefined,
      areaName: undefined,
      employeeCount: undefined,
      employeeNames: undefined,
      teamCount: undefined,
      teamNames: undefined,
    };

    if (includeExtended) {
      response.departmentLeadName = dept.department_lead_name;
      response.areaName = dept.areaName;
      response.employeeCount = dept.employee_count;
      response.employeeNames = dept.employee_names;
      response.teamCount = dept.team_count;
      response.teamNames = dept.team_names;
    }

    return response;
  }

  /**
   * List all departments for a tenant
   */
  async listDepartments(
    tenantId: number,
    includeExtended: boolean = true,
  ): Promise<DepartmentResponse[]> {
    this.logger.log(`Fetching departments for tenant ${tenantId}`);

    try {
      const [rows] = await execute<DepartmentRow[]>(this.FIND_ALL_DEPARTMENTS_QUERY, [
        tenantId,
        tenantId,
      ]);

      return rows.map((dept: DepartmentRow) => this.mapToResponse(dept, includeExtended));
    } catch (error: unknown) {
      this.logger.warn(`Extended query failed, using simple query: ${(error as Error).message}`);

      const [rows] = await execute<DepartmentRow[]>(
        'SELECT * FROM departments WHERE tenant_id = $1 AND is_active = 1 ORDER BY name',
        [tenantId],
      );

      return rows.map((dept: DepartmentRow) => this.mapToResponse(dept, false));
    }
  }

  /**
   * Get a single department by ID
   */
  async getDepartmentById(id: number, tenantId: number): Promise<DepartmentResponse> {
    this.logger.log(`Fetching department ${id} for tenant ${tenantId}`);

    const departments = await this.listDepartments(tenantId, true);
    const department = departments.find((d: DepartmentResponse) => d.id === id);

    if (department === undefined) {
      throw new NotFoundException('Department not found');
    }

    return department;
  }

  /**
   * Ensure leader is in user_departments junction table
   */
  private async ensureLeaderInDepartment(
    leaderId: number,
    departmentId: number,
    tenantId: number,
  ): Promise<void> {
    try {
      const [existing] = await execute<RowDataPacket[]>(
        'SELECT id FROM user_departments WHERE user_id = $1 AND department_id = $2 AND tenant_id = $3',
        [leaderId, departmentId, tenantId],
      );

      if (existing.length > 0) {
        this.logger.log(`Leader ${leaderId} already assigned to department ${departmentId}`);
        return;
      }

      await execute(
        `INSERT INTO user_departments (tenant_id, user_id, department_id, is_primary, assigned_at)
         VALUES ($1, $2, $3, true, NOW())`,
        [tenantId, leaderId, departmentId],
      );
      this.logger.log(`Added leader ${leaderId} to department ${departmentId}`);
    } catch (error: unknown) {
      this.logger.error(`Error ensuring leader in department: ${(error as Error).message}`);
    }
  }

  /**
   * Create a new department
   */
  async createDepartment(dto: CreateDepartmentDto, tenantId: number): Promise<DepartmentResponse> {
    this.logger.log(`Creating department: ${dto.name}`);

    if (dto.name.trim() === '') {
      throw new BadRequestException('Department name is required');
    }

    const isActive = dto.isActive ?? 1;

    const [rows] = await execute<{ id: number }[]>(
      `INSERT INTO departments (name, description, department_lead_id, area_id, is_active, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [dto.name, dto.description, dto.departmentLeadId, dto.areaId, isActive, tenantId],
    );

    if (rows.length === 0 || rows[0] === undefined) {
      throw new Error('Failed to create department');
    }

    const departmentId = rows[0].id;

    if (dto.departmentLeadId !== undefined && dto.departmentLeadId !== null) {
      await this.ensureLeaderInDepartment(dto.departmentLeadId, departmentId, tenantId);
    }

    return await this.getDepartmentById(departmentId, tenantId);
  }

  /**
   * Update a department
   */
  async updateDepartment(
    id: number,
    dto: UpdateDepartmentDto,
    tenantId: number,
  ): Promise<DepartmentResponse> {
    this.logger.log(`Updating department ${id}`);

    const [existing] = await execute<DepartmentRow[]>(
      'SELECT * FROM departments WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );

    if (existing.length === 0) {
      throw new NotFoundException('Department not found');
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (dto.name !== undefined) {
      fields.push(`name = $${values.length + 1}`);
      values.push(dto.name);
    }
    if (dto.description !== undefined) {
      fields.push(`description = $${values.length + 1}`);
      values.push(dto.description);
    }
    if (dto.departmentLeadId !== undefined) {
      fields.push(`department_lead_id = $${values.length + 1}`);
      values.push(dto.departmentLeadId);
    }
    if (dto.areaId !== undefined) {
      fields.push(`area_id = $${values.length + 1}`);
      values.push(dto.areaId);
    }
    if (dto.isActive !== undefined) {
      fields.push(`is_active = $${values.length + 1}`);
      values.push(dto.isActive);
    }

    if (fields.length > 0) {
      values.push(id);
      await execute(
        `UPDATE departments SET ${fields.join(', ')} WHERE id = $${values.length}`,
        values,
      );
    }

    if (dto.departmentLeadId !== undefined && dto.departmentLeadId !== null) {
      await this.ensureLeaderInDepartment(dto.departmentLeadId, id, tenantId);
    }

    return await this.getDepartmentById(id, tenantId);
  }

  /**
   * Count dependencies in a single table
   */
  private async countDependencies(
    tableName: string,
    departmentId: number,
    tenantId: number,
  ): Promise<number> {
    const [rows] = await execute<RowDataPacket[]>(
      `SELECT id FROM ${tableName} WHERE department_id = $1 AND tenant_id = $2`,
      [departmentId, tenantId],
    );
    return rows.length;
  }

  /**
   * Check all foreign key dependencies for a department
   */
  private async checkDepartmentDependencies(
    id: number,
    tenantId: number,
  ): Promise<DepartmentDependencies> {
    const tables = [
      'user_departments',
      'teams',
      'machines',
      'shifts',
      'shift_plans',
      'shift_favorites',
      'kvp_suggestions',
      'calendar_events',
      'survey_assignments',
      'admin_department_permissions',
      'document_permissions',
    ];

    const counts = await Promise.all(
      tables.map((table: string) => this.countDependencies(table, id, tenantId)),
    );

    return {
      userDepartments: counts[0] ?? 0,
      teams: counts[1] ?? 0,
      machines: counts[2] ?? 0,
      shifts: counts[3] ?? 0,
      shiftPlans: counts[4] ?? 0,
      shiftFavorites: counts[5] ?? 0,
      kvpSuggestions: counts[6] ?? 0,
      calendarEvents: counts[7] ?? 0,
      surveyAssignments: counts[8] ?? 0,
      adminPermissions: counts[9] ?? 0,
      documentPermissions: counts[10] ?? 0,
      total: counts.reduce((sum: number, c: number) => sum + c, 0),
    };
  }

  /**
   * Remove dependency from a single table
   */
  private async removeDependencyFrom(
    tableName: string,
    operation: 'UPDATE' | 'DELETE',
    departmentId: number,
    tenantId: number,
  ): Promise<void> {
    if (operation === 'UPDATE') {
      await execute(
        `UPDATE ${tableName} SET department_id = NULL WHERE department_id = $1 AND tenant_id = $2`,
        [departmentId, tenantId],
      );
    } else {
      await execute(`DELETE FROM ${tableName} WHERE department_id = $1 AND tenant_id = $2`, [
        departmentId,
        tenantId,
      ]);
    }
  }

  /**
   * Remove all department dependencies
   */
  private async removeDepartmentDependencies(
    id: number,
    tenantId: number,
    deps: DepartmentDependencies,
  ): Promise<void> {
    const cleanupStrategies: { table: string; operation: 'UPDATE' | 'DELETE'; count: number }[] = [
      { table: 'user_departments', operation: 'DELETE', count: deps.userDepartments },
      { table: 'teams', operation: 'UPDATE', count: deps.teams },
      { table: 'machines', operation: 'UPDATE', count: deps.machines },
      { table: 'shifts', operation: 'UPDATE', count: deps.shifts },
      { table: 'shift_plans', operation: 'UPDATE', count: deps.shiftPlans },
      { table: 'shift_favorites', operation: 'DELETE', count: deps.shiftFavorites },
      { table: 'kvp_suggestions', operation: 'UPDATE', count: deps.kvpSuggestions },
      { table: 'calendar_events', operation: 'UPDATE', count: deps.calendarEvents },
      { table: 'survey_assignments', operation: 'DELETE', count: deps.surveyAssignments },
      { table: 'admin_department_permissions', operation: 'DELETE', count: deps.adminPermissions },
      { table: 'document_permissions', operation: 'DELETE', count: deps.documentPermissions },
    ];

    interface CleanupStrategy {
      table: string;
      operation: 'UPDATE' | 'DELETE';
      count: number;
    }
    await Promise.all(
      cleanupStrategies
        .filter((strategy: CleanupStrategy) => strategy.count > 0)
        .map((strategy: CleanupStrategy) =>
          this.removeDependencyFrom(strategy.table, strategy.operation, id, tenantId),
        ),
    );
  }

  /**
   * Delete a department
   */
  async deleteDepartment(
    id: number,
    tenantId: number,
    force: boolean = false,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting department ${id}, force: ${force}`);

    const [existing] = await execute<DepartmentRow[]>(
      'SELECT * FROM departments WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );

    if (existing.length === 0) {
      throw new NotFoundException('Department not found');
    }

    const deps = await this.checkDepartmentDependencies(id, tenantId);

    if (deps.total > 0) {
      if (!force) {
        throw new BadRequestException({
          message: 'Cannot delete department with dependencies',
          details: {
            totalDependencies: deps.total,
            ...(deps.userDepartments > 0 && { userDepartments: deps.userDepartments }),
            ...(deps.teams > 0 && { teams: deps.teams }),
            ...(deps.machines > 0 && { machines: deps.machines }),
            ...(deps.shifts > 0 && { shifts: deps.shifts }),
            ...(deps.shiftPlans > 0 && { shiftPlans: deps.shiftPlans }),
          },
        });
      }

      await this.removeDepartmentDependencies(id, tenantId, deps);
    }

    await execute('DELETE FROM departments WHERE id = $1', [id]);

    return { message: 'Department deleted successfully' };
  }

  /**
   * Get department members
   */
  async getDepartmentMembers(id: number, tenantId: number): Promise<DepartmentMember[]> {
    this.logger.log(`Fetching members for department ${id}`);

    const [existing] = await execute<DepartmentRow[]>(
      'SELECT * FROM departments WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );

    if (existing.length === 0) {
      throw new NotFoundException('Department not found');
    }

    interface UserRow extends RowDataPacket {
      id: number;
      username: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      position: string | null;
      employee_id: string | null;
      role: string | null;
      is_active: number;
    }

    const [users] = await execute<UserRow[]>(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.position, u.employee_id, u.role, u.is_active
       FROM users u
       JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id
       WHERE ud.department_id = $1`,
      [id],
    );

    return users.map((user: UserRow) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name ?? '',
      lastName: user.last_name ?? '',
      position: user.position ?? undefined,
      employeeId: user.employee_id ?? undefined,
      role: user.role ?? 'employee',
      isActive: user.is_active === 1,
    }));
  }

  /**
   * Get department statistics
   */
  async getDepartmentStats(tenantId: number): Promise<DepartmentStats> {
    this.logger.log(`Fetching department stats for tenant ${tenantId}`);

    interface CountResult extends RowDataPacket {
      count: string;
    }

    const [[deptRows], [teamRows]] = await Promise.all([
      execute<CountResult[]>('SELECT COUNT(*) as count FROM departments WHERE tenant_id = $1', [
        tenantId,
      ]),
      execute<CountResult[]>('SELECT COUNT(*) as count FROM teams WHERE tenant_id = $1', [
        tenantId,
      ]),
    ]);

    return {
      totalDepartments: Number.parseInt(deptRows[0]?.count ?? '0', 10),
      totalTeams: Number.parseInt(teamRows[0]?.count ?? '0', 10),
    };
  }
}
