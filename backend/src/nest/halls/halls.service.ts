/**
 * Halls Service
 *
 * Business logic for hall management.
 * Halls are physical production halls assigned to areas.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { getErrorMessage } from '../common/index.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { CreateHallDto } from './dto/create-hall.dto.js';
import type { UpdateHallDto } from './dto/update-hall.dto.js';

export interface HallRow {
  id: number;
  name: string;
  description: string | null;
  area_id: number | null;
  is_active: number;
  tenant_id: number;
  created_by: number;
  created_at: Date;
  updated_at: Date;
  area_name: string | undefined;
  department_ids: number[] | undefined;
  department_names: string | undefined;
  department_count: number | undefined;
}

export interface HallResponse {
  id: number;
  name: string;
  description: string | undefined;
  areaId: number | undefined;
  isActive: number;
  tenantId: number;
  createdAt: string | undefined;
  updatedAt: string | undefined;
  areaName: string | undefined;
  departmentIds: number[] | undefined;
  departmentNames: string | undefined;
  departmentCount: number | undefined;
}

export interface HallStats {
  totalHalls: number;
}

const ERROR_HALL_NOT_FOUND = 'Hall not found';

@Injectable()
export class HallsService {
  private readonly logger = new Logger(HallsService.name);

  constructor(
    private readonly activityLogger: ActivityLoggerService,
    private readonly db: DatabaseService,
  ) {}

  private readonly FIND_ALL_HALLS_QUERY = `
    WITH dept_assignments AS (
      SELECT dh.hall_id,
        ARRAY_AGG(dh.department_id ORDER BY d.name) as department_ids,
        COUNT(*) as count,
        STRING_AGG(d.name, E'\\n' ORDER BY d.name) as names
      FROM department_halls dh
      JOIN departments d ON dh.department_id = d.id
      WHERE dh.tenant_id = $1
      GROUP BY dh.hall_id
    )
    SELECT h.*, a.name as area_name,
      da.department_ids, COALESCE(da.count, 0) as department_count,
      COALESCE(da.names, '') as department_names
    FROM halls h
    LEFT JOIN areas a ON h.area_id = a.id
    LEFT JOIN dept_assignments da ON da.hall_id = h.id
    WHERE h.tenant_id = $1
      AND h.is_active IN (${IS_ACTIVE.INACTIVE}, ${IS_ACTIVE.ACTIVE}, ${IS_ACTIVE.ARCHIVED})
    ORDER BY h.name`;

  private mapToResponse(hall: HallRow, includeExtended: boolean): HallResponse {
    return {
      id: hall.id,
      name: hall.name,
      description: hall.description ?? undefined,
      areaId: hall.area_id ?? undefined,
      isActive: hall.is_active,
      tenantId: hall.tenant_id,
      createdAt: hall.created_at.toISOString(),
      updatedAt: hall.updated_at.toISOString(),
      areaName: includeExtended ? hall.area_name : undefined,
      departmentIds: includeExtended ? (hall.department_ids ?? []) : undefined,
      departmentNames: includeExtended ? hall.department_names : undefined,
      departmentCount: includeExtended ? hall.department_count : undefined,
    };
  }

  async listHalls(
    tenantId: number,
    includeExtended: boolean = true,
  ): Promise<HallResponse[]> {
    this.logger.debug(`Fetching halls for tenant ${tenantId}`);

    try {
      const rows = await this.db.query<HallRow>(this.FIND_ALL_HALLS_QUERY, [
        tenantId,
      ]);

      return rows.map((hall: HallRow) =>
        this.mapToResponse(hall, includeExtended),
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Extended query failed, using simple query: ${getErrorMessage(error)}`,
      );

      const rows = await this.db.query<HallRow>(
        `SELECT * FROM halls WHERE tenant_id = $1 AND is_active IN (${IS_ACTIVE.INACTIVE}, ${IS_ACTIVE.ACTIVE}, ${IS_ACTIVE.ARCHIVED}) ORDER BY name`,
        [tenantId],
      );

      return rows.map((hall: HallRow) => this.mapToResponse(hall, false));
    }
  }

  async getHallById(id: number, tenantId: number): Promise<HallResponse> {
    this.logger.debug(`Fetching hall ${id} for tenant ${tenantId}`);

    try {
      const rows = await this.db.query<HallRow>(
        `SELECT h.*, a.name as area_name
         FROM halls h
         LEFT JOIN areas a ON h.area_id = a.id
         WHERE h.id = $1 AND h.tenant_id = $2`,
        [id, tenantId],
      );

      if (rows.length === 0 || rows[0] === undefined) {
        throw new NotFoundException(ERROR_HALL_NOT_FOUND);
      }

      return this.mapToResponse(rows[0], true);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.warn(
        `Extended query failed, using simple query: ${getErrorMessage(error)}`,
      );

      const rows = await this.db.query<HallRow>(
        'SELECT * FROM halls WHERE id = $1 AND tenant_id = $2',
        [id, tenantId],
      );

      if (rows.length === 0 || rows[0] === undefined) {
        throw new NotFoundException(ERROR_HALL_NOT_FOUND);
      }

      return this.mapToResponse(rows[0], false);
    }
  }

  async createHall(
    dto: CreateHallDto,
    actingUserId: number,
    tenantId: number,
  ): Promise<HallResponse> {
    this.logger.log(`Creating hall: ${dto.name}`);

    if (dto.name.trim() === '') {
      throw new BadRequestException('Hall name is required');
    }

    const isActive = dto.isActive ?? 1;
    const hallUuid = uuidv7();

    const rows = await this.db.query<{ id: number }>(
      `INSERT INTO halls (name, description, area_id, is_active, tenant_id, created_by, uuid, uuid_created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id`,
      [
        dto.name,
        dto.description,
        dto.areaId,
        isActive,
        tenantId,
        actingUserId,
        hallUuid,
      ],
    );

    if (rows.length === 0 || rows[0] === undefined) {
      throw new Error('Failed to create hall');
    }

    const hallId = rows[0].id;
    const result = await this.getHallById(hallId, tenantId);

    await this.activityLogger.logCreate(
      tenantId,
      actingUserId,
      'hall',
      hallId,
      `Halle erstellt: ${dto.name}`,
      {
        name: dto.name,
        description: dto.description,
        areaId: dto.areaId,
      },
    );

    return result;
  }

  private buildUpdateFields(dto: UpdateHallDto): {
    fields: string[];
    values: unknown[];
  } {
    const fields: string[] = [];
    const values: unknown[] = [];

    const fieldMap: [keyof UpdateHallDto, string][] = [
      ['name', 'name'],
      ['description', 'description'],
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

  async updateHall(
    id: number,
    dto: UpdateHallDto,
    actingUserId: number,
    tenantId: number,
  ): Promise<HallResponse> {
    this.logger.log(`Updating hall ${id}`);

    const existing = await this.db.query<HallRow>(
      'SELECT * FROM halls WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );

    if (existing.length === 0) {
      throw new NotFoundException(ERROR_HALL_NOT_FOUND);
    }

    const existingHall = existing[0];
    const oldValues = {
      name: existingHall?.name,
      description: existingHall?.description,
      areaId: existingHall?.area_id,
      isActive: existingHall?.is_active,
    };

    const { fields, values } = this.buildUpdateFields(dto);
    if (fields.length > 0) {
      values.push(id);
      await this.db.query(
        `UPDATE halls SET ${fields.join(', ')} WHERE id = $${values.length}`,
        values,
      );
    }

    const result = await this.getHallById(id, tenantId);

    await this.activityLogger.logUpdate(
      tenantId,
      actingUserId,
      'hall',
      id,
      `Halle aktualisiert: ${existingHall?.name ?? 'Unknown'}`,
      oldValues,
      {
        name: dto.name,
        description: dto.description,
        areaId: dto.areaId,
        isActive: dto.isActive,
      },
    );

    return result;
  }

  async deleteHall(
    id: number,
    actingUserId: number,
    tenantId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting hall ${id}`);

    const existing = await this.db.query<HallRow>(
      'SELECT * FROM halls WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );

    if (existing.length === 0) {
      throw new NotFoundException(ERROR_HALL_NOT_FOUND);
    }

    const existingHall = existing[0];

    await this.db.query('DELETE FROM halls WHERE id = $1', [id]);

    await this.activityLogger.logDelete(
      tenantId,
      actingUserId,
      'hall',
      id,
      `Halle gelöscht: ${existingHall?.name ?? 'Unknown'}`,
      {
        name: existingHall?.name,
        description: existingHall?.description,
        areaId: existingHall?.area_id,
      },
    );

    return { message: 'Hall deleted successfully' };
  }

  async getHallStats(tenantId: number): Promise<HallStats> {
    this.logger.debug(`Fetching hall stats for tenant ${tenantId}`);

    const rows = await this.db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM halls WHERE tenant_id = $1',
      [tenantId],
    );

    return {
      totalHalls: Number.parseInt(rows[0]?.count ?? '0', 10),
    };
  }
}
