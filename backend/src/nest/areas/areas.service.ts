/**
 * Areas Service
 *
 * Business logic for area/location management.
 * Status: 0=inactive, 1=active, 3=archived, 4=deleted
 * NOTE: Areas are flat (non-hierarchical) since 2025-11-29
 *
 * Side-effect: When area_lead_id changes, pending vacation requests
 * whose approver was the old area_lead get cascaded to the new lead.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { CreateAreaDto } from './dto/create-area.dto.js';
import type { ListAreasQueryDto } from './dto/list-areas-query.dto.js';
import type { UpdateAreaDto } from './dto/update-area.dto.js';

/**
 * Database area row type
 */
export interface AreaRow {
  id: number;
  tenant_id: number;
  name: string;
  description: string | null;
  area_lead_id: number | null;
  type:
    | 'building'
    | 'warehouse'
    | 'office'
    | 'production'
    | 'outdoor'
    | 'other';
  capacity: number | null;
  address: string | null;
  is_active: number;
  created_by: number;
  created_at: Date;
  updated_at: Date;
  area_lead_name: string | null;
  employee_count: number;
  department_count: number;
  department_names: string | null;
}

/**
 * API response type for area
 */
export interface AreaResponse {
  id: number;
  tenantId: number;
  name: string;
  description: string | undefined;
  areaLeadId: number | undefined;
  areaLeadName: string | undefined;
  type: string;
  capacity: number | undefined;
  address: string | undefined;
  isActive: number;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  employeeCount: number | undefined;
  departmentCount: number | undefined;
  departmentNames: string | undefined;
}

/**
 * Area statistics response
 */
export interface AreaStatsResponse {
  totalAreas: number;
  activeAreas: number;
  totalCapacity: number;
  byType: Record<string, number>;
}

/**
 * Area dependencies for deletion check
 */
interface AreaDependencies {
  departments: number;
  assets: number;
  shifts: number;
  shiftPlans: number;
  shiftFavorites: number;
  total: number;
}

@Injectable()
export class AreasService {
  private readonly logger = new Logger(AreasService.name);

  constructor(
    private readonly activityLogger: ActivityLoggerService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * SQL query for fetching areas with counts
   * Excludes soft-deleted areas (is_active = 4)
   */
  private readonly FIND_ALL_AREAS_QUERY = `
    SELECT
      a.*,
      NULLIF(TRIM(CONCAT(COALESCE(MAX(area_lead.first_name), ''), ' ', COALESCE(MAX(area_lead.last_name), ''))), '') as area_lead_name,
      COUNT(DISTINCT e.id) as employee_count,
      COUNT(DISTINCT d.id) as department_count,
      STRING_AGG(DISTINCT d.name, ', ' ORDER BY d.name) as department_names
    FROM areas a
    LEFT JOIN users area_lead ON a.area_lead_id = area_lead.id
    LEFT JOIN users e ON e.tenant_id = a.tenant_id AND e.role = 'employee'
    LEFT JOIN departments d ON d.area_id = a.id AND d.tenant_id = a.tenant_id
    WHERE a.tenant_id = $1 AND a.is_active != 4
  `;

  /**
   * Map database row to API response
   */
  private mapToResponse(row: AreaRow): AreaResponse {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description ?? undefined,
      areaLeadId: row.area_lead_id ?? undefined,
      areaLeadName: row.area_lead_name ?? undefined,
      type: row.type,
      capacity: row.capacity ?? undefined,
      address: row.address ?? undefined,
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      employeeCount: row.employee_count,
      departmentCount: row.department_count,
      departmentNames: row.department_names ?? undefined,
    };
  }

  /**
   * Build query with filters
   */
  private buildFilteredQuery(query: ListAreasQueryDto): {
    whereClause: string;
    params: (string | number)[];
    paramIndex: number;
  } {
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 2; // $1 is tenant_id

    if (query.type !== undefined) {
      conditions.push(`a.type = $${paramIndex}`);
      params.push(query.type);
      paramIndex++;
    }

    if (query.search !== undefined && query.search !== '') {
      conditions.push(
        `(a.name ILIKE $${paramIndex} OR a.description ILIKE $${paramIndex + 1})`,
      );
      params.push(`%${query.search}%`, `%${query.search}%`);
      paramIndex += 2;
    }

    const whereClause =
      conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '';

    return { whereClause, params, paramIndex };
  }

  /**
   * List all areas for a tenant
   */
  async listAreas(
    tenantId: number,
    query: ListAreasQueryDto,
  ): Promise<AreaResponse[]> {
    this.logger.debug(`Fetching areas for tenant ${tenantId}`);

    const { whereClause, params } = this.buildFilteredQuery(query);
    const fullQuery = `${this.FIND_ALL_AREAS_QUERY}${whereClause} GROUP BY a.id ORDER BY a.name`;

    const rows = await this.db.query<AreaRow>(fullQuery, [tenantId, ...params]);

    return rows.map((row: AreaRow) => this.mapToResponse(row));
  }

  /**
   * Get a single area by ID
   */
  async getAreaById(id: number, tenantId: number): Promise<AreaResponse> {
    this.logger.debug(`Fetching area ${id} for tenant ${tenantId}`);

    const query = `${this.FIND_ALL_AREAS_QUERY} AND a.id = $2 GROUP BY a.id`;
    const rows = await this.db.query<AreaRow>(query, [tenantId, id]);

    if (rows.length === 0 || rows[0] === undefined) {
      throw new NotFoundException('Area not found');
    }

    return this.mapToResponse(rows[0]);
  }

  /**
   * Get area statistics
   */
  async getAreaStats(tenantId: number): Promise<AreaStatsResponse> {
    this.logger.debug(`Fetching area stats for tenant ${tenantId}`);

    interface StatsRow {
      total_areas: string;
      active_areas: string;
      total_capacity: string | null;
    }

    interface TypeStatsRow {
      type: string;
      count: string;
    }

    const [statsRows, typeRows] = await Promise.all([
      this.db.query<StatsRow>(
        `SELECT
          COUNT(*) as total_areas,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_areas,
          SUM(capacity) as total_capacity
        FROM areas
        WHERE tenant_id = $1`,
        [tenantId],
      ),
      this.db.query<TypeStatsRow>(
        `SELECT type, COUNT(*) as count
        FROM areas
        WHERE tenant_id = $1 AND is_active = 1
        GROUP BY type`,
        [tenantId],
      ),
    ]);

    const byType: Record<string, number> = {};
    typeRows.forEach((row: TypeStatsRow) => {
      // Safe: type comes from database, not user input
      byType[row.type] = Number.parseInt(row.count, 10);
    });

    const stats = statsRows[0];

    return {
      totalAreas: Number.parseInt(stats?.total_areas ?? '0', 10),
      activeAreas: Number.parseInt(stats?.active_areas ?? '0', 10),
      totalCapacity: Number.parseInt(stats?.total_capacity ?? '0', 10),
      byType,
    };
  }

  /**
   * Create a new area
   */
  async createArea(
    dto: CreateAreaDto,
    tenantId: number,
    userId: number,
  ): Promise<AreaResponse> {
    this.logger.log(`Creating area: ${dto.name}`);

    if (dto.name.trim() === '') {
      throw new BadRequestException('Area name is required');
    }

    const areaUuid = uuidv7();
    const rows = await this.db.query<{ id: number }>(
      `INSERT INTO areas (
        tenant_id, name, description, area_lead_id, type, capacity,
        address, created_by, is_active, uuid, uuid_created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING id`,
      [
        tenantId,
        dto.name,
        dto.description ?? null,
        dto.areaLeadId ?? null,
        dto.type,
        dto.capacity ?? null,
        dto.address ?? null,
        userId,
        1, // is_active = 1 (active)
        areaUuid,
      ],
    );

    if (rows.length === 0 || rows[0] === undefined) {
      throw new Error('Failed to create area');
    }

    const areaId = rows[0].id;
    const result = await this.getAreaById(areaId, tenantId);

    await this.activityLogger.logCreate(
      tenantId,
      userId,
      'area',
      areaId,
      `Bereich erstellt: ${dto.name}`,
      {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        areaLeadId: dto.areaLeadId,
        capacity: dto.capacity,
        address: dto.address,
      },
    );

    return result;
  }

  /**
   * Build update fields from DTO
   */
  private buildUpdateFields(dto: UpdateAreaDto): {
    fields: string[];
    values: unknown[];
  } {
    const fields: string[] = [];
    const values: unknown[] = [];

    const fieldMap: [keyof UpdateAreaDto, string][] = [
      ['name', 'name'],
      ['description', 'description'],
      ['areaLeadId', 'area_lead_id'],
      ['type', 'type'],
      ['capacity', 'capacity'],
      ['address', 'address'],
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
   * Update an area
   */
  async updateArea(
    id: number,
    dto: UpdateAreaDto,
    actingUserId: number,
    tenantId: number,
  ): Promise<AreaResponse> {
    this.logger.log(`Updating area ${id}`);

    const existingArea = await this.getAreaById(id, tenantId);
    const oldValues = {
      name: existingArea.name,
      description: existingArea.description,
      type: existingArea.type,
      areaLeadId: existingArea.areaLeadId,
      capacity: existingArea.capacity,
      address: existingArea.address,
      isActive: existingArea.isActive,
    };

    const { fields, values } = this.buildUpdateFields(dto);
    if (fields.length > 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id, tenantId);
      await this.db.query(
        `UPDATE areas SET ${fields.join(', ')} WHERE id = $${values.length - 1} AND tenant_id = $${values.length}`,
        values,
      );
    }

    // Cascade: re-assign pending vacation requests when area_lead changes
    const oldLeadId = existingArea.areaLeadId ?? null;
    const newLeadId = dto.areaLeadId ?? null;
    if (dto.areaLeadId !== undefined && oldLeadId !== newLeadId) {
      await this.cascadeVacationApprover(tenantId, id, oldLeadId, newLeadId);
    }

    const result = await this.getAreaById(id, tenantId);
    const newValues = {
      name: dto.name,
      description: dto.description,
      type: dto.type,
      areaLeadId: dto.areaLeadId,
      capacity: dto.capacity,
      address: dto.address,
      isActive: dto.isActive,
    };

    await this.activityLogger.logUpdate(
      tenantId,
      actingUserId,
      'area',
      id,
      `Bereich aktualisiert: ${existingArea.name}`,
      oldValues,
      newValues,
    );

    return result;
  }

  /**
   * Check area dependencies
   */
  private async checkAreaDependencies(
    id: number,
    tenantId: number,
  ): Promise<AreaDependencies> {
    const tables = [
      'departments',
      'assets',
      'shifts',
      'shift_plans',
      'shift_favorites',
    ];

    const counts = await Promise.all(
      tables.map(async (table: string) => {
        const rows = await this.db.query<{ id: number }>(
          `SELECT id FROM ${table} WHERE area_id = $1 AND tenant_id = $2`,
          [id, tenantId],
        );
        return rows.length;
      }),
    );

    return {
      departments: counts[0] ?? 0,
      assets: counts[1] ?? 0,
      shifts: counts[2] ?? 0,
      shiftPlans: counts[3] ?? 0,
      shiftFavorites: counts[4] ?? 0,
      total: counts.reduce((sum: number, c: number) => sum + c, 0),
    };
  }

  /**
   * Remove area dependencies
   */
  private async removeAreaDependencies(
    id: number,
    tenantId: number,
    deps: AreaDependencies,
  ): Promise<void> {
    const cleanupStrategies: {
      table: string;
      operation: 'UPDATE' | 'DELETE';
      count: number;
    }[] = [
      { table: 'departments', operation: 'UPDATE', count: deps.departments },
      { table: 'assets', operation: 'UPDATE', count: deps.assets },
      { table: 'shifts', operation: 'UPDATE', count: deps.shifts },
      { table: 'shift_plans', operation: 'UPDATE', count: deps.shiftPlans },
      {
        table: 'shift_favorites',
        operation: 'DELETE',
        count: deps.shiftFavorites,
      },
    ];

    interface CleanupStrategy {
      table: string;
      operation: 'UPDATE' | 'DELETE';
      count: number;
    }

    await Promise.all(
      cleanupStrategies
        .filter((s: CleanupStrategy) => s.count > 0)
        .map(async (s: CleanupStrategy) => {
          if (s.operation === 'UPDATE') {
            await this.db.query(
              `UPDATE ${s.table} SET area_id = NULL WHERE area_id = $1 AND tenant_id = $2`,
              [id, tenantId],
            );
          } else {
            await this.db.query(
              `DELETE FROM ${s.table} WHERE area_id = $1 AND tenant_id = $2`,
              [id, tenantId],
            );
          }
        }),
    );
  }

  /**
   * Delete an area
   */
  async deleteArea(
    id: number,
    actingUserId: number,
    tenantId: number,
    force: boolean = false,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting area ${id}, force: ${force}`);

    // Check if area exists and get values for logging
    const existingArea = await this.getAreaById(id, tenantId);

    const deps = await this.checkAreaDependencies(id, tenantId);

    if (deps.total > 0) {
      if (!force) {
        throw new BadRequestException({
          message: 'Cannot delete area with dependencies',
          details: {
            totalDependencies: deps.total,
            ...(deps.departments > 0 && { departments: deps.departments }),
            ...(deps.assets > 0 && { assets: deps.assets }),
            ...(deps.shifts > 0 && { shifts: deps.shifts }),
            ...(deps.shiftPlans > 0 && { shiftPlans: deps.shiftPlans }),
            ...(deps.shiftFavorites > 0 && {
              shiftFavorites: deps.shiftFavorites,
            }),
          },
        });
      }

      await this.removeAreaDependencies(id, tenantId, deps);
    }

    await this.db.query('DELETE FROM areas WHERE id = $1 AND tenant_id = $2', [
      id,
      tenantId,
    ]);

    await this.activityLogger.logDelete(
      tenantId,
      actingUserId,
      'area',
      id,
      `Bereich gelöscht: ${existingArea.name}`,
      {
        name: existingArea.name,
        description: existingArea.description,
        type: existingArea.type,
        areaLeadId: existingArea.areaLeadId,
        force,
      },
    );

    return { message: 'Area deleted successfully' };
  }

  /**
   * Assign departments to an area
   */
  async assignDepartmentsToArea(
    areaId: number,
    departmentIds: number[],
    tenantId: number,
  ): Promise<{ message: string }> {
    this.logger.log(
      `Assigning ${departmentIds.length} departments to area ${areaId}`,
    );

    // Check if area exists
    await this.getAreaById(areaId, tenantId);

    // Clear all existing department assignments for this area
    await this.db.query(
      `UPDATE departments SET area_id = NULL WHERE tenant_id = $1 AND area_id = $2`,
      [tenantId, areaId],
    );

    // Assign selected departments (if any)
    if (departmentIds.length > 0) {
      const placeholders = departmentIds
        .map((_: number, i: number) => `$${i + 3}`)
        .join(', ');
      await this.db.query(
        `UPDATE departments SET area_id = $1 WHERE tenant_id = $2 AND id IN (${placeholders})`,
        [areaId, tenantId, ...departmentIds],
      );
    }

    return { message: 'Departments assigned successfully' };
  }

  /**
   * Cascade vacation approver when area_lead changes.
   *
   * Updates all PENDING vacation requests where:
   * - approver_id = old area_lead
   * - requester is in a department belonging to this area
   *
   * If newLeadId is null, sets approver_id to NULL (auto-approved).
   */
  private async cascadeVacationApprover(
    tenantId: number,
    areaId: number,
    oldLeadId: number | null,
    newLeadId: number | null,
  ): Promise<void> {
    if (oldLeadId === null) return;

    const result = await this.db.query<{ count: string }>(
      `WITH affected AS (
         UPDATE vacation_requests vr
         SET approver_id = $1,
             updated_at = NOW()
         WHERE vr.tenant_id = $2
           AND vr.status = 'pending'
           AND vr.approver_id = $3
           AND vr.requester_id IN (
             SELECT ud.user_id
             FROM user_departments ud
             JOIN departments d ON d.id = ud.department_id
             WHERE d.area_id = $4 AND d.tenant_id = $2
           )
         RETURNING vr.id
       )
       SELECT COUNT(*)::text AS count FROM affected`,
      [newLeadId, tenantId, oldLeadId, areaId],
    );

    const updatedCount = Number.parseInt(result[0]?.count ?? '0', 10);
    if (updatedCount > 0) {
      this.logger.log(
        `Cascaded ${updatedCount} pending vacation request(s): approver ${oldLeadId} → ${String(newLeadId ?? 'auto-approve')} (area ${areaId})`,
      );
    }
  }
}
