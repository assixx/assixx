/**
 * Vacation Blackouts Service
 *
 * Manages blackout periods (vacation freeze windows) with scope polymorphism:
 * - 'global': applies to ALL employees (scope_id = NULL)
 * - 'team': applies to a specific team (scope_id = team.id)
 * - 'department': applies to a specific department (scope_id = area.id)
 *
 * Blackouts table: `vacation_blackouts` (Migration 29)
 * - CHECK(scope_type='global' AND scope_id IS NULL OR scope_type IN ('team','department') AND scope_id IS NOT NULL)
 * - CHECK(end_date \>= start_date)
 * - RLS enforced via `db.tenantTransaction()` (ADR-019)
 *
 * Used by: Capacity service (conflict detection), Vacation service (request validation)
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { DatabaseService } from '../database/database.service.js';
import type { CreateBlackoutDto } from './dto/create-blackout.dto.js';
import type { UpdateBlackoutDto } from './dto/update-blackout.dto.js';
import type {
  BlackoutConflict,
  BlackoutScopeType,
  VacationBlackout,
  VacationBlackoutRow,
} from './vacation.types.js';

/** Row shape for blackout query with scope name JOIN */
interface BlackoutWithScopeRow extends VacationBlackoutRow {
  scope_name: string | null;
}

@Injectable()
export class VacationBlackoutsService {
  private readonly logger: Logger = new Logger(VacationBlackoutsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get all active blackout periods for a tenant.
   * Optionally filters by year (blackout overlaps with the given year).
   * JOINs teams/areas to resolve scope_name.
   */
  async getBlackouts(
    tenantId: number,
    year?: number,
  ): Promise<VacationBlackout[]> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationBlackout[]> => {
        let sql: string = `
          SELECT vb.id, vb.tenant_id, vb.name, vb.reason,
                 vb.start_date, vb.end_date,
                 vb.scope_type, vb.scope_id,
                 vb.is_active, vb.created_by, vb.created_at, vb.updated_at,
                 CASE
                   WHEN vb.scope_type = 'team' THEN t.name
                   WHEN vb.scope_type = 'department' THEN a.name
                   ELSE NULL
                 END AS scope_name
          FROM vacation_blackouts vb
          LEFT JOIN teams t ON vb.scope_type = 'team' AND vb.scope_id = t.id
          LEFT JOIN areas a ON vb.scope_type = 'department' AND vb.scope_id = a.id
          WHERE vb.tenant_id = $1 AND vb.is_active = 1`;
        const params: unknown[] = [tenantId];

        if (year !== undefined) {
          // Blackout overlaps with the given year
          sql += ` AND vb.start_date <= $2 AND vb.end_date >= $3`;
          params.push(`${year}-12-31`, `${year}-01-01`);
        }

        sql += ` ORDER BY vb.start_date ASC`;

        const result = await client.query<BlackoutWithScopeRow>(sql, params);
        return result.rows.map((row: BlackoutWithScopeRow) =>
          this.mapRowToBlackout(row),
        );
      },
    );
  }

  /**
   * Create a new blackout period.
   * Scope validation (global=no scope_id, team/dept=scope_id required)
   * is handled by the DTO's Zod refine, but we also validate scope_id
   * references a real team/area in the DB.
   */
  async createBlackout(
    tenantId: number,
    userId: number,
    dto: CreateBlackoutDto,
  ): Promise<VacationBlackout> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationBlackout> => {
        // Validate scope_id references an existing team/area
        if (dto.scopeType !== 'global' && dto.scopeId !== undefined) {
          await this.validateScopeId(
            client,
            tenantId,
            dto.scopeType,
            dto.scopeId,
          );
        }

        const id: string = uuidv7();

        const result = await client.query<BlackoutWithScopeRow>(
          `WITH inserted AS (
            INSERT INTO vacation_blackouts
              (id, tenant_id, name, reason, start_date, end_date,
               scope_type, scope_id, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
          )
          SELECT ins.id, ins.tenant_id, ins.name, ins.reason,
                 ins.start_date, ins.end_date,
                 ins.scope_type, ins.scope_id,
                 ins.is_active, ins.created_by, ins.created_at, ins.updated_at,
                 CASE
                   WHEN ins.scope_type = 'team' THEN t.name
                   WHEN ins.scope_type = 'department' THEN a.name
                   ELSE NULL
                 END AS scope_name
          FROM inserted ins
          LEFT JOIN teams t ON ins.scope_type = 'team' AND ins.scope_id = t.id
          LEFT JOIN areas a ON ins.scope_type = 'department' AND ins.scope_id = a.id`,
          [
            id,
            tenantId,
            dto.name,
            dto.reason ?? null,
            dto.startDate,
            dto.endDate,
            dto.scopeType,
            dto.scopeId ?? null,
            userId,
          ],
        );

        const row: BlackoutWithScopeRow | undefined = result.rows[0];
        if (row === undefined) {
          throw new Error('INSERT into vacation_blackouts returned no rows');
        }

        this.logger.log(
          `Blackout created: "${dto.name}" ${dto.startDate}–${dto.endDate} scope=${dto.scopeType} (tenant ${tenantId})`,
        );
        return this.mapRowToBlackout(row);
      },
    );
  }

  /**
   * Update an existing blackout period.
   * Throws NotFoundException if not found or soft-deleted.
   */
  async updateBlackout(
    tenantId: number,
    id: string,
    dto: UpdateBlackoutDto,
  ): Promise<VacationBlackout> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationBlackout> => {
        const { setClauses, params } = this.buildBlackoutSetClauses(dto);

        if (setClauses.length === 0) {
          return await this.getBlackoutById(client, tenantId, id);
        }

        await this.validateScopeChange(client, tenantId, dto);

        setClauses.push(`updated_at = NOW()`);
        const idParam: number = params.length + 1;
        params.push(id);
        const tenantParam: number = params.length + 1;
        params.push(tenantId);

        const row: BlackoutWithScopeRow | undefined =
          await this.executeUpdateWithScope(
            client,
            setClauses,
            params,
            idParam,
            tenantParam,
          );

        if (row === undefined) {
          throw new NotFoundException(`Blackout ${id} not found`);
        }

        this.logger.log(`Blackout updated: ${id} (tenant ${tenantId})`);
        return this.mapRowToBlackout(row);
      },
    );
  }

  /**
   * Soft-delete a blackout period (is_active = 4).
   * Throws NotFoundException if not found.
   */
  async deleteBlackout(tenantId: number, id: string): Promise<void> {
    await this.db.tenantTransaction(
      async (client: PoolClient): Promise<void> => {
        const result = await client.query<{ id: string }>(
          `UPDATE vacation_blackouts
           SET is_active = 4, updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2 AND is_active = 1
           RETURNING id`,
          [id, tenantId],
        );

        if (result.rows[0] === undefined) {
          throw new NotFoundException(`Blackout ${id} not found`);
        }

        this.logger.log(`Blackout soft-deleted: ${id} (tenant ${tenantId})`);
      },
    );
  }

  /**
   * Find blackout conflicts for a date range.
   * Returns blackouts that overlap with [startDate, endDate] AND match the user's scope:
   * - 'global' blackouts always conflict
   * - 'team' blackouts conflict if userTeamId matches scope_id
   * - 'department' blackouts conflict if userDeptId matches scope_id
   *
   * Used by capacity service and vacation request validation.
   */
  async getConflicts(
    tenantId: number,
    startDate: string,
    endDate: string,
    userTeamId?: number,
    userDeptId?: number,
  ): Promise<BlackoutConflict[]> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<BlackoutConflict[]> => {
        // Date overlap: blackout.start <= request.end AND blackout.end >= request.start
        const result = await client.query<
          Pick<
            VacationBlackoutRow,
            'id' | 'name' | 'start_date' | 'end_date' | 'scope_type'
          >
        >(
          `SELECT id, name, start_date, end_date, scope_type
           FROM vacation_blackouts
           WHERE tenant_id = $1
             AND is_active = 1
             AND start_date <= $3
             AND end_date >= $2
             AND (
               scope_type = 'global'
               OR (scope_type = 'team' AND scope_id = $4)
               OR (scope_type = 'department' AND scope_id = $5)
             )
           ORDER BY start_date ASC`,
          [
            tenantId,
            startDate,
            endDate,
            userTeamId ?? null,
            userDeptId ?? null,
          ],
        );

        type ConflictRow = Pick<
          VacationBlackoutRow,
          'id' | 'name' | 'start_date' | 'end_date' | 'scope_type'
        >;

        return result.rows.map((row: ConflictRow) => ({
          blackoutId: row.id,
          name: row.name,
          startDate: this.formatDate(new Date(row.start_date)),
          endDate: this.formatDate(new Date(row.end_date)),
          scopeType: row.scope_type,
        }));
      },
    );
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  /**
   * Validate that a scope_id references an existing team or area.
   * Throws NotFoundException if invalid.
   */
  private async validateScopeId(
    client: PoolClient,
    tenantId: number,
    scopeType: BlackoutScopeType,
    scopeId: number,
  ): Promise<void> {
    const table: string = scopeType === 'team' ? 'teams' : 'areas';
    const result = await client.query<{ id: number }>(
      `SELECT id FROM ${table}
       WHERE id = $1 AND tenant_id = $2`,
      [scopeId, tenantId],
    );

    if (result.rows[0] === undefined) {
      throw new NotFoundException(
        `${scopeType === 'team' ? 'Team' : 'Department'} with ID ${scopeId} not found`,
      );
    }
  }

  /** Validate scope_id if scope type changes to team/department. */
  private async validateScopeChange(
    client: PoolClient,
    tenantId: number,
    dto: UpdateBlackoutDto,
  ): Promise<void> {
    if (
      dto.scopeType !== undefined &&
      dto.scopeType !== 'global' &&
      dto.scopeId !== undefined &&
      dto.scopeId !== null
    ) {
      await this.validateScopeId(client, tenantId, dto.scopeType, dto.scopeId);
    }
  }

  /** Execute UPDATE with CTE + scope name JOIN. */
  private async executeUpdateWithScope(
    client: PoolClient,
    setClauses: string[],
    params: unknown[],
    idParam: number,
    tenantParam: number,
  ): Promise<BlackoutWithScopeRow | undefined> {
    const result = await client.query<BlackoutWithScopeRow>(
      `WITH updated AS (
        UPDATE vacation_blackouts
        SET ${setClauses.join(', ')}
        WHERE id = $${idParam} AND tenant_id = $${tenantParam} AND is_active = 1
        RETURNING *
      )
      SELECT upd.id, upd.tenant_id, upd.name, upd.reason,
             upd.start_date, upd.end_date,
             upd.scope_type, upd.scope_id,
             upd.is_active, upd.created_by, upd.created_at, upd.updated_at,
             CASE
               WHEN upd.scope_type = 'team' THEN t.name
               WHEN upd.scope_type = 'department' THEN a.name
               ELSE NULL
             END AS scope_name
      FROM updated upd
      LEFT JOIN teams t ON upd.scope_type = 'team' AND upd.scope_id = t.id
      LEFT JOIN areas a ON upd.scope_type = 'department' AND upd.scope_id = a.id`,
      params,
    );

    return result.rows[0];
  }

  /** Get a single blackout by ID (internal helper). */
  private async getBlackoutById(
    client: PoolClient,
    tenantId: number,
    id: string,
  ): Promise<VacationBlackout> {
    const result = await client.query<BlackoutWithScopeRow>(
      `SELECT vb.id, vb.tenant_id, vb.name, vb.reason,
              vb.start_date, vb.end_date,
              vb.scope_type, vb.scope_id,
              vb.is_active, vb.created_by, vb.created_at, vb.updated_at,
              CASE
                WHEN vb.scope_type = 'team' THEN t.name
                WHEN vb.scope_type = 'department' THEN a.name
                ELSE NULL
              END AS scope_name
       FROM vacation_blackouts vb
       LEFT JOIN teams t ON vb.scope_type = 'team' AND vb.scope_id = t.id
       LEFT JOIN areas a ON vb.scope_type = 'department' AND vb.scope_id = a.id
       WHERE vb.id = $1 AND vb.tenant_id = $2 AND vb.is_active = 1`,
      [id, tenantId],
    );

    const row: BlackoutWithScopeRow | undefined = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Blackout ${id} not found`);
    }

    return this.mapRowToBlackout(row);
  }

  /** Build dynamic SET clause and params for blackout update. */
  private buildBlackoutSetClauses(dto: UpdateBlackoutDto): {
    setClauses: string[];
    params: unknown[];
  } {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex: number = 1;

    const fields: { column: string; value: unknown }[] = [
      { column: 'name', value: dto.name },
      { column: 'reason', value: dto.reason },
      { column: 'start_date', value: dto.startDate },
      { column: 'end_date', value: dto.endDate },
      { column: 'scope_type', value: dto.scopeType },
      { column: 'scope_id', value: dto.scopeId },
    ];

    for (const field of fields) {
      if (field.value !== undefined) {
        setClauses.push(`${field.column} = $${paramIndex}`);
        params.push(field.value ?? null);
        paramIndex++;
      }
    }

    return { setClauses, params };
  }

  /** Map DB row to API response type (snake_case → camelCase). */
  private mapRowToBlackout(row: BlackoutWithScopeRow): VacationBlackout {
    const base: VacationBlackout = {
      id: row.id,
      name: row.name,
      reason: row.reason,
      startDate:
        typeof row.start_date === 'string' ?
          row.start_date.slice(0, 10)
        : this.formatDate(new Date(row.start_date)),
      endDate:
        typeof row.end_date === 'string' ?
          row.end_date.slice(0, 10)
        : this.formatDate(new Date(row.end_date)),
      scopeType: row.scope_type,
      scopeId: row.scope_id,
      createdBy: row.created_by,
      createdAt:
        typeof row.created_at === 'string' ?
          row.created_at
        : new Date(row.created_at).toISOString(),
      updatedAt:
        typeof row.updated_at === 'string' ?
          row.updated_at
        : new Date(row.updated_at).toISOString(),
    };

    if (row.scope_name !== null) {
      base.scopeName = row.scope_name;
    }

    return base;
  }

  /** Format a Date as YYYY-MM-DD (no timezone issues). */
  private formatDate(date: Date): string {
    const year: number = date.getFullYear();
    const month: string = String(date.getMonth() + 1).padStart(2, '0');
    const day: string = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
