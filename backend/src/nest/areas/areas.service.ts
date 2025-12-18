/**
 * Areas Service
 *
 * Business logic for area/location management.
 * Status: 0=inactive, 1=active, 3=archived, 4=deleted
 * NOTE: Areas are flat (non-hierarchical) since 2025-11-29
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import type { RowDataPacket } from '../../utils/db.js';
import { execute } from '../../utils/db.js';
import type { CreateAreaDto } from './dto/create-area.dto.js';
import type { ListAreasQueryDto } from './dto/list-areas-query.dto.js';
import type { UpdateAreaDto } from './dto/update-area.dto.js';

/**
 * Database area row type
 */
export interface AreaRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  name: string;
  description: string | null;
  area_lead_id: number | null;
  type: 'building' | 'warehouse' | 'office' | 'production' | 'outdoor' | 'other';
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
  machines: number;
  shifts: number;
  shiftPlans: number;
  shiftFavorites: number;
  total: number;
}

@Injectable()
export class AreasService {
  private readonly logger = new Logger(AreasService.name);

  /**
   * SQL query for fetching areas with counts
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
    WHERE a.tenant_id = $1
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
      conditions.push(`(a.name ILIKE $${paramIndex} OR a.description ILIKE $${paramIndex + 1})`);
      params.push(`%${query.search}%`, `%${query.search}%`);
      paramIndex += 2;
    }

    const whereClause = conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '';

    return { whereClause, params, paramIndex };
  }

  /**
   * List all areas for a tenant
   */
  async listAreas(tenantId: number, query: ListAreasQueryDto): Promise<AreaResponse[]> {
    this.logger.log(`Fetching areas for tenant ${tenantId}`);

    const { whereClause, params } = this.buildFilteredQuery(query);
    const fullQuery = `${this.FIND_ALL_AREAS_QUERY}${whereClause} GROUP BY a.id ORDER BY a.name`;

    const [rows] = await execute<AreaRow[]>(fullQuery, [tenantId, ...params]);

    return rows.map((row: AreaRow) => this.mapToResponse(row));
  }

  /**
   * Get a single area by ID
   */
  async getAreaById(id: number, tenantId: number): Promise<AreaResponse> {
    this.logger.log(`Fetching area ${id} for tenant ${tenantId}`);

    const query = `${this.FIND_ALL_AREAS_QUERY} AND a.id = $2 GROUP BY a.id`;
    const [rows] = await execute<AreaRow[]>(query, [tenantId, id]);

    if (rows.length === 0 || rows[0] === undefined) {
      throw new NotFoundException('Area not found');
    }

    return this.mapToResponse(rows[0]);
  }

  /**
   * Get area statistics
   */
  async getAreaStats(tenantId: number): Promise<AreaStatsResponse> {
    this.logger.log(`Fetching area stats for tenant ${tenantId}`);

    interface StatsRow extends RowDataPacket {
      total_areas: string;
      active_areas: string;
      total_capacity: string | null;
    }

    interface TypeStatsRow extends RowDataPacket {
      type: string;
      count: string;
    }

    const [[statsRows], [typeRows]] = await Promise.all([
      execute<StatsRow[]>(
        `SELECT
          COUNT(*) as total_areas,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_areas,
          SUM(capacity) as total_capacity
        FROM areas
        WHERE tenant_id = $1`,
        [tenantId],
      ),
      execute<TypeStatsRow[]>(
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
  async createArea(dto: CreateAreaDto, tenantId: number, userId: number): Promise<AreaResponse> {
    this.logger.log(`Creating area: ${dto.name}`);

    if (dto.name.trim() === '') {
      throw new BadRequestException('Area name is required');
    }

    const [rows] = await execute<{ id: number }[]>(
      `INSERT INTO areas (
        tenant_id, name, description, area_lead_id, type, capacity,
        address, created_by, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
      ],
    );

    if (rows.length === 0 || rows[0] === undefined) {
      throw new Error('Failed to create area');
    }

    return await this.getAreaById(rows[0].id, tenantId);
  }

  /**
   * Update an area
   */
  async updateArea(id: number, dto: UpdateAreaDto, tenantId: number): Promise<AreaResponse> {
    this.logger.log(`Updating area ${id}`);

    // Check if area exists
    await this.getAreaById(id, tenantId);

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
    if (dto.areaLeadId !== undefined) {
      fields.push(`area_lead_id = $${values.length + 1}`);
      values.push(dto.areaLeadId);
    }
    if (dto.type !== undefined) {
      fields.push(`type = $${values.length + 1}`);
      values.push(dto.type);
    }
    if (dto.capacity !== undefined) {
      fields.push(`capacity = $${values.length + 1}`);
      values.push(dto.capacity);
    }
    if (dto.address !== undefined) {
      fields.push(`address = $${values.length + 1}`);
      values.push(dto.address);
    }
    if (dto.isActive !== undefined) {
      fields.push(`is_active = $${values.length + 1}`);
      values.push(dto.isActive);
    }

    if (fields.length > 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id, tenantId);
      await execute(
        `UPDATE areas SET ${fields.join(', ')} WHERE id = $${values.length - 1} AND tenant_id = $${values.length}`,
        values,
      );
    }

    return await this.getAreaById(id, tenantId);
  }

  /**
   * Check area dependencies
   */
  private async checkAreaDependencies(id: number, tenantId: number): Promise<AreaDependencies> {
    const tables = ['departments', 'machines', 'shifts', 'shift_plans', 'shift_favorites'];

    const counts = await Promise.all(
      tables.map(async (table: string) => {
        const [rows] = await execute<RowDataPacket[]>(
          `SELECT id FROM ${table} WHERE area_id = $1 AND tenant_id = $2`,
          [id, tenantId],
        );
        return rows.length;
      }),
    );

    return {
      departments: counts[0] ?? 0,
      machines: counts[1] ?? 0,
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
    const cleanupStrategies: { table: string; operation: 'UPDATE' | 'DELETE'; count: number }[] = [
      { table: 'departments', operation: 'UPDATE', count: deps.departments },
      { table: 'machines', operation: 'UPDATE', count: deps.machines },
      { table: 'shifts', operation: 'UPDATE', count: deps.shifts },
      { table: 'shift_plans', operation: 'UPDATE', count: deps.shiftPlans },
      { table: 'shift_favorites', operation: 'DELETE', count: deps.shiftFavorites },
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
            await execute(
              `UPDATE ${s.table} SET area_id = NULL WHERE area_id = $1 AND tenant_id = $2`,
              [id, tenantId],
            );
          } else {
            await execute(`DELETE FROM ${s.table} WHERE area_id = $1 AND tenant_id = $2`, [
              id,
              tenantId,
            ]);
          }
        }),
    );
  }

  /**
   * Delete an area
   */
  async deleteArea(
    id: number,
    tenantId: number,
    force: boolean = false,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting area ${id}, force: ${force}`);

    // Check if area exists
    await this.getAreaById(id, tenantId);

    const deps = await this.checkAreaDependencies(id, tenantId);

    if (deps.total > 0) {
      if (!force) {
        throw new BadRequestException({
          message: 'Cannot delete area with dependencies',
          details: {
            totalDependencies: deps.total,
            ...(deps.departments > 0 && { departments: deps.departments }),
            ...(deps.machines > 0 && { machines: deps.machines }),
            ...(deps.shifts > 0 && { shifts: deps.shifts }),
            ...(deps.shiftPlans > 0 && { shiftPlans: deps.shiftPlans }),
            ...(deps.shiftFavorites > 0 && { shiftFavorites: deps.shiftFavorites }),
          },
        });
      }

      await this.removeAreaDependencies(id, tenantId, deps);
    }

    await execute('DELETE FROM areas WHERE id = $1 AND tenant_id = $2', [id, tenantId]);

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
    this.logger.log(`Assigning ${departmentIds.length} departments to area ${areaId}`);

    // Check if area exists
    await this.getAreaById(areaId, tenantId);

    // Clear all existing department assignments for this area
    await execute(`UPDATE departments SET area_id = NULL WHERE tenant_id = $1 AND area_id = $2`, [
      tenantId,
      areaId,
    ]);

    // Assign selected departments (if any)
    if (departmentIds.length > 0) {
      const placeholders = departmentIds.map((_: number, i: number) => `$${i + 3}`).join(', ');
      await execute(
        `UPDATE departments SET area_id = $1 WHERE tenant_id = $2 AND id IN (${placeholders})`,
        [areaId, tenantId, ...departmentIds],
      );
    }

    return { message: 'Departments assigned successfully' };
  }
}
