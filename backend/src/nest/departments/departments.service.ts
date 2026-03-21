/**
 * Departments Service
 *
 * Business logic for department management.
 * Status: 0=inactive, 1=active, 3=archived, 4=deleted
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { getErrorMessage } from '../common/index.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ScopeService } from '../hierarchy-permission/scope.service.js';
import type { CreateDepartmentDto } from './dto/create-department.dto.js';
import type { UpdateDepartmentDto } from './dto/update-department.dto.js';

/**
 * Database department row type
 */
export interface DepartmentRow {
  id: number;
  name: string;
  description: string | null;
  department_lead_id: number | null;
  department_deputy_lead_id: number | null;
  area_id: number | null;
  is_active: number;
  tenant_id: number;
  created_at: Date;
  updated_at: Date;
  department_lead_name: string | undefined;
  department_deputy_lead_name: string | undefined;
  areaName: string | undefined;
  employee_count: number | undefined;
  employee_names: string | undefined;
  team_count: number | undefined;
  team_names: string | undefined;
  hall_ids: number[] | undefined;
  hall_names: string | undefined;
  hall_count: number | undefined;
}

/**
 * API response type for department
 */
export interface DepartmentResponse {
  id: number;
  name: string;
  description: string | undefined;
  departmentLeadId: number | undefined;
  departmentDeputyLeadId: number | undefined;
  areaId: number | undefined;
  isActive: number;
  tenantId: number;
  createdAt: string | undefined;
  updatedAt: string | undefined;
  departmentLeadName: string | undefined;
  departmentDeputyLeadName: string | undefined;
  areaName: string | undefined;
  employeeCount: number | undefined;
  employeeNames: string | undefined;
  teamCount: number | undefined;
  teamNames: string | undefined;
  hallIds: number[] | undefined;
  hallNames: string | undefined;
  hallCount: number | undefined;
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
  assets: number;
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

/** Cleanup strategy for department dependencies */
interface DepartmentCleanupStrategy {
  table: string;
  operation: 'UPDATE' | 'DELETE';
  count: number;
}

/** Error message constants */
const ERROR_DEPARTMENT_NOT_FOUND = 'Department not found';

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(
    private readonly activityLogger: ActivityLoggerService,
    private readonly db: DatabaseService,
    private readonly scopeService: ScopeService,
  ) {}

  /**
   * SQL query for fetching departments with employee/team counts via user_departments N:M
   * Returns all non-deleted departments (is_active IN 0, 1, 3) for client-side filtering
   */
  private readonly FIND_ALL_DEPARTMENTS_QUERY = `
    WITH employee_counts AS (
      SELECT ud.department_id, COUNT(*) as count,
        STRING_AGG(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, u.username)),
          E'\\n' ORDER BY u.last_name, u.first_name) as names
      FROM user_departments ud
      JOIN users u ON ud.user_id = u.id AND ud.tenant_id = u.tenant_id
      WHERE ud.tenant_id = $1 AND u.is_active IN (${IS_ACTIVE.INACTIVE}, ${IS_ACTIVE.ACTIVE})
      GROUP BY ud.department_id
    ),
    team_counts AS (
      SELECT department_id, COUNT(*) as count,
        STRING_AGG(name, E'\\n' ORDER BY name) as names
      FROM teams GROUP BY department_id
    ),
    hall_assignments AS (
      SELECT dh.department_id,
        ARRAY_AGG(dh.hall_id ORDER BY h.name) as hall_ids,
        COUNT(*) as count,
        STRING_AGG(h.name, E'\\n' ORDER BY h.name) as names
      FROM department_halls dh
      JOIN halls h ON dh.hall_id = h.id
      WHERE dh.tenant_id = $1
      GROUP BY dh.department_id
    )
    SELECT d.*,
      CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as department_lead_name,
      NULLIF(TRIM(CONCAT(COALESCE(du.first_name, ''), ' ', COALESCE(du.last_name, ''))), '') as department_deputy_lead_name,
      a.name as "areaName",
      COALESCE(ec.count, 0) as employee_count, COALESCE(ec.names, '') as employee_names,
      COALESCE(tc.count, 0) as team_count, COALESCE(tc.names, '') as team_names,
      ha.hall_ids, COALESCE(ha.count, 0) as hall_count, COALESCE(ha.names, '') as hall_names
    FROM departments d
    LEFT JOIN users u ON d.department_lead_id = u.id
    LEFT JOIN users du ON d.department_deputy_lead_id = du.id
    LEFT JOIN areas a ON d.area_id = a.id
    LEFT JOIN employee_counts ec ON ec.department_id = d.id
    LEFT JOIN team_counts tc ON tc.department_id = d.id
    LEFT JOIN hall_assignments ha ON ha.department_id = d.id
    WHERE d.tenant_id = $2 AND d.is_active IN (${IS_ACTIVE.INACTIVE}, ${IS_ACTIVE.ACTIVE}, ${IS_ACTIVE.ARCHIVED})
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
      departmentDeputyLeadId: dept.department_deputy_lead_id ?? undefined,
      areaId: dept.area_id ?? undefined,
      isActive: dept.is_active,
      tenantId: dept.tenant_id,
      createdAt: dept.created_at.toISOString(),
      updatedAt: dept.updated_at.toISOString(),
      departmentLeadName: undefined,
      departmentDeputyLeadName: undefined,
      areaName: undefined,
      employeeCount: undefined,
      employeeNames: undefined,
      teamCount: undefined,
      teamNames: undefined,
      hallIds: undefined,
      hallNames: undefined,
      hallCount: undefined,
    };

    if (includeExtended) {
      response.departmentLeadName = dept.department_lead_name;
      response.departmentDeputyLeadName = dept.department_deputy_lead_name;
      response.areaName = dept.areaName;
      response.employeeCount = dept.employee_count;
      response.employeeNames = dept.employee_names;
      response.teamCount = dept.team_count;
      response.teamNames = dept.team_names;
      response.hallIds = dept.hall_ids ?? [];
      response.hallNames = dept.hall_names;
      response.hallCount = dept.hall_count;
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
    this.logger.debug(`Fetching departments for tenant ${tenantId}`);

    const scope = await this.scopeService.getScope();
    if (scope.type === 'none' || (scope.type === 'limited' && scope.departmentIds.length === 0)) {
      return [];
    }

    const scopeFilter = scope.type === 'limited' ? ` AND d.id = ANY($3::int[])` : '';
    const scopeParams: unknown[] = scope.type === 'limited' ? [scope.departmentIds] : [];

    try {
      const rows = await this.db.query<DepartmentRow>(
        `${this.FIND_ALL_DEPARTMENTS_QUERY}${scopeFilter}`,
        [tenantId, tenantId, ...scopeParams],
      );

      return rows.map((dept: DepartmentRow) => this.mapToResponse(dept, includeExtended));
    } catch (error: unknown) {
      this.logger.warn(`Extended query failed, using simple query: ${getErrorMessage(error)}`);

      const simpleScope = scope.type === 'limited' ? ` AND id = ANY($2::int[])` : '';
      const rows = await this.db.query<DepartmentRow>(
        `SELECT * FROM departments WHERE tenant_id = $1 AND is_active IN (${IS_ACTIVE.INACTIVE}, ${IS_ACTIVE.ACTIVE}, ${IS_ACTIVE.ARCHIVED})${simpleScope} ORDER BY name`,
        [tenantId, ...scopeParams],
      );

      return rows.map((dept: DepartmentRow) => this.mapToResponse(dept, false));
    }
  }

  /**
   * SQL query for fetching a single department by ID (includes all statuses)
   */
  private readonly FIND_DEPARTMENT_BY_ID_QUERY = `
    WITH employee_counts AS (
      SELECT ud.department_id, COUNT(*) as count,
        STRING_AGG(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, u.username)),
          E'\\n' ORDER BY u.last_name, u.first_name) as names
      FROM user_departments ud
      JOIN users u ON ud.user_id = u.id AND ud.tenant_id = u.tenant_id
      WHERE ud.tenant_id = $1 AND u.is_active IN (${IS_ACTIVE.INACTIVE}, ${IS_ACTIVE.ACTIVE})
      GROUP BY ud.department_id
    ),
    team_counts AS (
      SELECT department_id, COUNT(*) as count,
        STRING_AGG(name, E'\\n' ORDER BY name) as names
      FROM teams GROUP BY department_id
    ),
    hall_assignments AS (
      SELECT dh.department_id,
        ARRAY_AGG(dh.hall_id ORDER BY h.name) as hall_ids,
        COUNT(*) as count,
        STRING_AGG(h.name, E'\\n' ORDER BY h.name) as names
      FROM department_halls dh
      JOIN halls h ON dh.hall_id = h.id
      WHERE dh.tenant_id = $1
      GROUP BY dh.department_id
    )
    SELECT d.*,
      CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as department_lead_name,
      NULLIF(TRIM(CONCAT(COALESCE(du.first_name, ''), ' ', COALESCE(du.last_name, ''))), '') as department_deputy_lead_name,
      a.name as "areaName",
      COALESCE(ec.count, 0) as employee_count, COALESCE(ec.names, '') as employee_names,
      COALESCE(tc.count, 0) as team_count, COALESCE(tc.names, '') as team_names,
      ha.hall_ids, COALESCE(ha.count, 0) as hall_count, COALESCE(ha.names, '') as hall_names
    FROM departments d
    LEFT JOIN users u ON d.department_lead_id = u.id
    LEFT JOIN users du ON d.department_deputy_lead_id = du.id
    LEFT JOIN areas a ON d.area_id = a.id
    LEFT JOIN employee_counts ec ON ec.department_id = d.id
    LEFT JOIN team_counts tc ON tc.department_id = d.id
    LEFT JOIN hall_assignments ha ON ha.department_id = d.id
    WHERE d.id = $2 AND d.tenant_id = $3`;

  /**
   * Get a single department by ID
   * Note: Does NOT filter by is_active to allow fetching inactive/archived departments
   */
  async getDepartmentById(id: number, tenantId: number): Promise<DepartmentResponse> {
    this.logger.debug(`Fetching department ${id} for tenant ${tenantId}`);

    try {
      const rows = await this.db.query<DepartmentRow>(this.FIND_DEPARTMENT_BY_ID_QUERY, [
        tenantId,
        id,
        tenantId,
      ]);

      if (rows.length === 0 || rows[0] === undefined) {
        throw new NotFoundException(ERROR_DEPARTMENT_NOT_FOUND);
      }

      return this.mapToResponse(rows[0], true);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.warn(`Extended query failed, using simple query: ${getErrorMessage(error)}`);

      const rows = await this.db.query<DepartmentRow>(
        'SELECT * FROM departments WHERE id = $1 AND tenant_id = $2',
        [id, tenantId],
      );

      if (rows.length === 0 || rows[0] === undefined) {
        throw new NotFoundException(ERROR_DEPARTMENT_NOT_FOUND);
      }

      return this.mapToResponse(rows[0], false);
    }
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
      const existing = await this.db.query<{ id: number }>(
        'SELECT id FROM user_departments WHERE user_id = $1 AND department_id = $2 AND tenant_id = $3',
        [leaderId, departmentId, tenantId],
      );

      if (existing.length > 0) {
        this.logger.log(`Leader ${leaderId} already assigned to department ${departmentId}`);
        return;
      }

      await this.db.query(
        `INSERT INTO user_departments (tenant_id, user_id, department_id, is_primary, assigned_at)
         VALUES ($1, $2, $3, true, NOW())`,
        [tenantId, leaderId, departmentId],
      );
      this.logger.log(`Added leader ${leaderId} to department ${departmentId}`);
    } catch (error: unknown) {
      this.logger.error(`Error ensuring leader in department: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Validate leader exists, is active, and has admin/root role.
   * Safety gate: only admin/root users can lead departments.
   */
  private async validateLeader(
    leaderId: number | null | undefined,
    tenantId: number,
  ): Promise<void> {
    if (leaderId === null || leaderId === undefined) return;

    const rows = await this.db.query<{ id: number; role: string }>(
      `SELECT id, role FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [leaderId, tenantId],
    );

    if (rows.length === 0) {
      throw new BadRequestException('Invalid leader ID or user inactive');
    }

    const user = rows[0];
    if (user?.role !== 'admin' && user?.role !== 'root') {
      throw new BadRequestException('Department leader must have role "admin" or "root"');
    }
  }

  /**
   * Create a new department
   */
  async createDepartment(
    dto: CreateDepartmentDto,
    actingUserId: number,
    tenantId: number,
  ): Promise<DepartmentResponse> {
    this.logger.log(`Creating department: ${dto.name}`);

    if (dto.name.trim() === '') {
      throw new BadRequestException('Department name is required');
    }

    await this.validateLeader(dto.departmentLeadId, tenantId);
    await this.validateLeader(dto.departmentDeputyLeadId, tenantId);

    const isActive = dto.isActive ?? 1;

    const departmentUuid = uuidv7();
    const rows = await this.db.query<{ id: number }>(
      `INSERT INTO departments (name, description, department_lead_id, department_deputy_lead_id, area_id, is_active, tenant_id, uuid, uuid_created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING id`,
      [
        dto.name,
        dto.description,
        dto.departmentLeadId,
        dto.departmentDeputyLeadId ?? null,
        dto.areaId,
        isActive,
        tenantId,
        departmentUuid,
      ],
    );

    if (rows.length === 0 || rows[0] === undefined) {
      throw new Error('Failed to create department');
    }

    const departmentId = rows[0].id;

    if (dto.departmentLeadId !== undefined && dto.departmentLeadId !== null) {
      await this.ensureLeaderInDepartment(dto.departmentLeadId, departmentId, tenantId);
    }

    const result = await this.getDepartmentById(departmentId, tenantId);

    await this.activityLogger.logCreate(
      tenantId,
      actingUserId,
      'department',
      departmentId,
      `Abteilung erstellt: ${dto.name}`,
      {
        name: dto.name,
        description: dto.description,
        departmentLeadId: dto.departmentLeadId,
        departmentDeputyLeadId: dto.departmentDeputyLeadId,
        areaId: dto.areaId,
      },
    );

    return result;
  }

  /**
   * Build update fields from DTO
   */
  private buildUpdateFields(dto: UpdateDepartmentDto): {
    fields: string[];
    values: unknown[];
  } {
    const fields: string[] = [];
    const values: unknown[] = [];

    const fieldMap: [keyof UpdateDepartmentDto, string][] = [
      ['name', 'name'],
      ['description', 'description'],
      ['departmentLeadId', 'department_lead_id'],
      ['departmentDeputyLeadId', 'department_deputy_lead_id'],
      ['areaId', 'area_id'],
      ['isActive', 'is_active'],
    ];

    for (const [dtoKey, dbCol] of fieldMap) {
      const value = dto[dtoKey];
      if (value !== undefined) {
        fields.push(`${dbCol} = $${values.length + 1}`);
        values.push(value);
      }
    }

    return { fields, values };
  }

  /**
   * Update a department
   */
  async updateDepartment(
    id: number,
    dto: UpdateDepartmentDto,
    actingUserId: number,
    tenantId: number,
  ): Promise<DepartmentResponse> {
    this.logger.log(`Updating department ${id}`);

    const existing = await this.db.query<DepartmentRow>(
      'SELECT * FROM departments WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );

    if (existing.length === 0) {
      throw new NotFoundException(ERROR_DEPARTMENT_NOT_FOUND);
    }

    const existingDept = existing[0];
    const oldValues = {
      name: existingDept?.name,
      description: existingDept?.description,
      departmentLeadId: existingDept?.department_lead_id,
      departmentDeputyLeadId: existingDept?.department_deputy_lead_id,
      areaId: existingDept?.area_id,
      isActive: existingDept?.is_active,
    };

    await this.validateLeader(dto.departmentLeadId, tenantId);
    await this.validateLeader(dto.departmentDeputyLeadId, tenantId);

    const { fields, values } = this.buildUpdateFields(dto);
    if (fields.length > 0) {
      values.push(id);
      await this.db.query(
        `UPDATE departments SET ${fields.join(', ')} WHERE id = $${values.length}`,
        values,
      );
    }

    if (dto.departmentLeadId !== undefined && dto.departmentLeadId !== null) {
      await this.ensureLeaderInDepartment(dto.departmentLeadId, id, tenantId);
    }

    const result = await this.getDepartmentById(id, tenantId);
    const newValues = {
      name: dto.name,
      description: dto.description,
      departmentLeadId: dto.departmentLeadId,
      departmentDeputyLeadId: dto.departmentDeputyLeadId,
      areaId: dto.areaId,
      isActive: dto.isActive,
    };

    await this.activityLogger.logUpdate(
      tenantId,
      actingUserId,
      'department',
      id,
      `Abteilung aktualisiert: ${existingDept?.name ?? 'Unknown'}`,
      oldValues,
      newValues,
    );

    return result;
  }

  /**
   * Count dependencies in a single table
   */
  private async countDependencies(
    tableName: string,
    departmentId: number,
    tenantId: number,
  ): Promise<number> {
    const rows = await this.db.query<{ id: number }>(
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
      'assets',
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
      assets: counts[2] ?? 0,
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
      await this.db.query(
        `UPDATE ${tableName} SET department_id = NULL WHERE department_id = $1 AND tenant_id = $2`,
        [departmentId, tenantId],
      );
    } else {
      await this.db.query(`DELETE FROM ${tableName} WHERE department_id = $1 AND tenant_id = $2`, [
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
    const strategies = this.buildDepartmentCleanupStrategies(deps);

    await Promise.all(
      strategies
        .filter((s: DepartmentCleanupStrategy) => s.count > 0)
        .map((s: DepartmentCleanupStrategy) =>
          this.removeDependencyFrom(s.table, s.operation, id, tenantId),
        ),
    );
  }

  /** Map department dependencies to cleanup strategies (table + operation) */
  private buildDepartmentCleanupStrategies(
    deps: DepartmentDependencies,
  ): DepartmentCleanupStrategy[] {
    return [
      {
        table: 'user_departments',
        operation: 'DELETE',
        count: deps.userDepartments,
      },
      { table: 'teams', operation: 'UPDATE', count: deps.teams },
      { table: 'assets', operation: 'UPDATE', count: deps.assets },
      { table: 'shifts', operation: 'UPDATE', count: deps.shifts },
      { table: 'shift_plans', operation: 'UPDATE', count: deps.shiftPlans },
      {
        table: 'shift_favorites',
        operation: 'DELETE',
        count: deps.shiftFavorites,
      },
      {
        table: 'kvp_suggestions',
        operation: 'UPDATE',
        count: deps.kvpSuggestions,
      },
      {
        table: 'calendar_events',
        operation: 'UPDATE',
        count: deps.calendarEvents,
      },
      {
        table: 'survey_assignments',
        operation: 'DELETE',
        count: deps.surveyAssignments,
      },
      {
        table: 'admin_department_permissions',
        operation: 'DELETE',
        count: deps.adminPermissions,
      },
      {
        table: 'document_permissions',
        operation: 'DELETE',
        count: deps.documentPermissions,
      },
    ];
  }

  /**
   * Delete a department
   */
  async deleteDepartment(
    id: number,
    actingUserId: number,
    tenantId: number,
    force: boolean = false,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting department ${id}, force: ${force}`);

    const existing = await this.db.query<DepartmentRow>(
      'SELECT * FROM departments WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );

    if (existing.length === 0) {
      throw new NotFoundException(ERROR_DEPARTMENT_NOT_FOUND);
    }

    const existingDept = existing[0];

    const deps = await this.checkDepartmentDependencies(id, tenantId);

    if (deps.total > 0) {
      if (!force) {
        throw new BadRequestException({
          message: 'Cannot delete department with dependencies',
          details: {
            totalDependencies: deps.total,
            ...(deps.userDepartments > 0 && {
              userDepartments: deps.userDepartments,
            }),
            ...(deps.teams > 0 && { teams: deps.teams }),
            ...(deps.assets > 0 && { assets: deps.assets }),
            ...(deps.shifts > 0 && { shifts: deps.shifts }),
            ...(deps.shiftPlans > 0 && { shiftPlans: deps.shiftPlans }),
          },
        });
      }

      await this.removeDepartmentDependencies(id, tenantId, deps);
    }

    await this.db.query('DELETE FROM departments WHERE id = $1', [id]);

    await this.activityLogger.logDelete(
      tenantId,
      actingUserId,
      'department',
      id,
      `Abteilung gelöscht: ${existingDept?.name ?? 'Unknown'}`,
      {
        name: existingDept?.name,
        description: existingDept?.description,
        departmentLeadId: existingDept?.department_lead_id,
        areaId: existingDept?.area_id,
        force,
      },
    );

    return { message: 'Department deleted successfully' };
  }

  /**
   * Get department members
   */
  async getDepartmentMembers(id: number, tenantId: number): Promise<DepartmentMember[]> {
    this.logger.debug(`Fetching members for department ${id}`);

    const existing = await this.db.query<DepartmentRow>(
      'SELECT * FROM departments WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );

    if (existing.length === 0) {
      throw new NotFoundException(ERROR_DEPARTMENT_NOT_FOUND);
    }

    interface UserRow {
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

    const users = await this.db.query<UserRow>(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.position, u.employee_id, u.role, u.is_active
       FROM users u
       JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id
       WHERE ud.department_id = $1 AND u.role != 'dummy' AND u.is_active = ${IS_ACTIVE.ACTIVE}`,
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
   * Assign halls to a department (clear-then-reassign)
   */
  async assignHallsToDepartment(
    departmentId: number,
    hallIds: number[],
    tenantId: number,
    assignedBy: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Assigning ${hallIds.length} halls to department ${departmentId}`);

    await this.getDepartmentById(departmentId, tenantId);

    await this.db.query(
      `DELETE FROM department_halls WHERE tenant_id = $1 AND department_id = $2`,
      [tenantId, departmentId],
    );

    if (hallIds.length > 0) {
      const values: unknown[] = [tenantId, departmentId, assignedBy];
      const rows = hallIds
        .map((_: number, i: number) => {
          values.push(hallIds[i]);
          return `($1, $2, $${i + 4}, $3, NOW())`;
        })
        .join(', ');

      await this.db.query(
        `INSERT INTO department_halls (tenant_id, department_id, hall_id, assigned_by, assigned_at)
         VALUES ${rows}`,
        values,
      );
    }

    return { message: 'Halls assigned to department successfully' };
  }

  /**
   * Get hall IDs assigned to a department
   */
  async getDepartmentHallIds(departmentId: number, tenantId: number): Promise<number[]> {
    const rows = await this.db.query<{ hall_id: number }>(
      `SELECT hall_id FROM department_halls WHERE department_id = $1 AND tenant_id = $2`,
      [departmentId, tenantId],
    );
    return rows.map((r: { hall_id: number }) => r.hall_id);
  }

  /**
   * Get department statistics
   */
  async getDepartmentStats(tenantId: number): Promise<DepartmentStats> {
    this.logger.debug(`Fetching department stats for tenant ${tenantId}`);

    interface CountResult {
      count: string;
    }

    const [deptRows, teamRows] = await Promise.all([
      this.db.query<CountResult>('SELECT COUNT(*) as count FROM departments WHERE tenant_id = $1', [
        tenantId,
      ]),
      this.db.query<CountResult>('SELECT COUNT(*) as count FROM teams WHERE tenant_id = $1', [
        tenantId,
      ]),
    ]);

    return {
      totalDepartments: Number.parseInt(deptRows[0]?.count ?? '0', 10),
      totalTeams: Number.parseInt(teamRows[0]?.count ?? '0', 10),
    };
  }
}
