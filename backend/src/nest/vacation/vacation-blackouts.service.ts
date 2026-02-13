/**
 * Vacation Blackouts Service
 *
 * Manages blackout periods (vacation freeze windows) with multi-scope support:
 * - is_global=true: applies to ALL employees
 * - Junction table `vacation_blackout_scopes`: maps to departments, teams, areas
 *
 * Pattern mirrors blackboard_entry_organizations (ADR-019 RLS applied).
 *
 * Tables: `vacation_blackouts` + `vacation_blackout_scopes` (Migration 29 + 32)
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
  BlackoutOrgType,
  VacationBlackout,
  VacationBlackoutRow,
  VacationBlackoutScopeRow,
} from './vacation.types.js';

@Injectable()
export class VacationBlackoutsService {
  private readonly logger: Logger = new Logger(VacationBlackoutsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get all active blackout periods for a tenant.
   * Optionally filters by year (blackout overlaps with the given year).
   * Loads scope arrays from junction table.
   */
  async getBlackouts(
    tenantId: number,
    year?: number,
  ): Promise<VacationBlackout[]> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationBlackout[]> => {
        let sql: string = `
          SELECT vb.id, vb.tenant_id, vb.name, vb.reason,
                 vb.start_date, vb.end_date, vb.is_global,
                 vb.is_active, vb.created_by, vb.created_at, vb.updated_at
          FROM vacation_blackouts vb
          WHERE vb.tenant_id = $1 AND vb.is_active = 1`;
        const params: unknown[] = [tenantId];

        if (year !== undefined) {
          sql += ` AND vb.start_date <= $2 AND vb.end_date >= $3`;
          params.push(`${year}-12-31`, `${year}-01-01`);
        }

        sql += ` ORDER BY vb.start_date ASC`;

        const result = await client.query<VacationBlackoutRow>(sql, params);

        if (result.rows.length === 0) {
          return [];
        }

        const blackoutIds: string[] = result.rows.map(
          (row: VacationBlackoutRow) => row.id,
        );
        const scopeMap: Map<string, VacationBlackoutScopeRow[]> =
          await this.loadScopesForBlackouts(client, blackoutIds);

        return result.rows.map((row: VacationBlackoutRow) =>
          this.mapRowToBlackout(row, scopeMap.get(row.id) ?? []),
        );
      },
    );
  }

  /**
   * Create a new blackout period.
   * Inserts into vacation_blackouts, then syncs scopes in junction table.
   */
  async createBlackout(
    tenantId: number,
    userId: number,
    dto: CreateBlackoutDto,
  ): Promise<VacationBlackout> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationBlackout> => {
        const id: string = uuidv7();

        const result = await client.query<VacationBlackoutRow>(
          `INSERT INTO vacation_blackouts
             (id, tenant_id, name, reason, start_date, end_date,
              is_global, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            id,
            tenantId,
            dto.name,
            dto.reason ?? null,
            dto.startDate,
            dto.endDate,
            dto.isGlobal,
            userId,
          ],
        );

        const row: VacationBlackoutRow | undefined = result.rows[0];
        if (row === undefined) {
          throw new Error('INSERT into vacation_blackouts returned no rows');
        }

        if (!dto.isGlobal) {
          await this.syncBlackoutScopes(
            client,
            id,
            dto.departmentIds,
            dto.teamIds,
            dto.areaIds,
          );
        }

        const scopes: VacationBlackoutScopeRow[] =
          dto.isGlobal ? [] : await this.loadScopes(client, id);

        this.logger.log(
          `Blackout created: "${dto.name}" ${dto.startDate}\u2013${dto.endDate} global=${String(dto.isGlobal)} (tenant ${tenantId})`,
        );
        return this.mapRowToBlackout(row, scopes);
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
        const { setClauses, params } = this.buildUpdateSetClauses(dto);

        if (setClauses.length === 0 && !this.hasScopeChanges(dto)) {
          return await this.getBlackoutById(client, tenantId, id);
        }

        if (setClauses.length > 0) {
          setClauses.push(`updated_at = NOW()`);
          const idParam: number = params.length + 1;
          params.push(id);
          const tenantParam: number = params.length + 1;
          params.push(tenantId);

          const result = await client.query<VacationBlackoutRow>(
            `UPDATE vacation_blackouts
             SET ${setClauses.join(', ')}
             WHERE id = $${idParam} AND tenant_id = $${tenantParam} AND is_active = 1
             RETURNING *`,
            params,
          );

          if (result.rows[0] === undefined) {
            throw new NotFoundException(`Blackout ${id} not found`);
          }
        }

        if (this.hasScopeChanges(dto)) {
          await this.syncBlackoutScopes(
            client,
            id,
            dto.departmentIds ?? [],
            dto.teamIds ?? [],
            dto.areaIds ?? [],
          );
        }

        this.logger.log(`Blackout updated: ${id} (tenant ${tenantId})`);
        return await this.getBlackoutById(client, tenantId, id);
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
   * - is_global=true blackouts always conflict
   * - Scoped blackouts conflict if junction table has matching team/department/area
   * - Area matching: resolves user's area from their department
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
        const result = await client.query<
          Pick<
            VacationBlackoutRow,
            'id' | 'name' | 'start_date' | 'end_date' | 'is_global'
          >
        >(
          `SELECT vb.id, vb.name, vb.start_date, vb.end_date, vb.is_global
           FROM vacation_blackouts vb
           WHERE vb.tenant_id = $1
             AND vb.is_active = 1
             AND vb.start_date <= $3
             AND vb.end_date >= $2
             AND (
               vb.is_global = true
               OR EXISTS (
                 SELECT 1 FROM vacation_blackout_scopes vbs
                 WHERE vbs.blackout_id = vb.id
                 AND (
                   (vbs.org_type = 'team' AND vbs.org_id = $4)
                   OR (vbs.org_type = 'department' AND vbs.org_id = $5)
                   OR (vbs.org_type = 'area' AND $5 IS NOT NULL AND vbs.org_id = (
                     SELECT area_id FROM departments WHERE id = $5 LIMIT 1
                   ))
                 )
               )
             )
           ORDER BY vb.start_date ASC`,
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
          'id' | 'name' | 'start_date' | 'end_date' | 'is_global'
        >;

        return result.rows.map((row: ConflictRow) => ({
          blackoutId: row.id,
          name: row.name,
          startDate: this.formatDate(new Date(row.start_date)),
          endDate: this.formatDate(new Date(row.end_date)),
          isGlobal: row.is_global,
        }));
      },
    );
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  /**
   * Sync blackout scopes in junction table (delete + re-insert pattern).
   * Mirrors blackboard_entry_organizations syncEntryOrganizations.
   */
  private async syncBlackoutScopes(
    client: PoolClient,
    blackoutId: string,
    departmentIds: number[],
    teamIds: number[],
    areaIds: number[],
  ): Promise<void> {
    await client.query(
      'DELETE FROM vacation_blackout_scopes WHERE blackout_id = $1',
      [blackoutId],
    );

    for (const orgId of departmentIds) {
      await client.query(
        'INSERT INTO vacation_blackout_scopes (blackout_id, org_type, org_id) VALUES ($1, $2, $3)',
        [blackoutId, 'department', orgId],
      );
    }

    for (const orgId of teamIds) {
      await client.query(
        'INSERT INTO vacation_blackout_scopes (blackout_id, org_type, org_id) VALUES ($1, $2, $3)',
        [blackoutId, 'team', orgId],
      );
    }

    for (const orgId of areaIds) {
      await client.query(
        'INSERT INTO vacation_blackout_scopes (blackout_id, org_type, org_id) VALUES ($1, $2, $3)',
        [blackoutId, 'area', orgId],
      );
    }
  }

  /** Load all scopes for a single blackout. */
  private async loadScopes(
    client: PoolClient,
    blackoutId: string,
  ): Promise<VacationBlackoutScopeRow[]> {
    const result = await client.query<VacationBlackoutScopeRow>(
      `SELECT id, blackout_id, org_type, org_id, created_at
       FROM vacation_blackout_scopes
       WHERE blackout_id = $1
       ORDER BY org_type, org_id`,
      [blackoutId],
    );
    return result.rows;
  }

  /** Load scopes for multiple blackouts in a single query. Returns Map(blackoutId, scopes). */
  private async loadScopesForBlackouts(
    client: PoolClient,
    blackoutIds: string[],
  ): Promise<Map<string, VacationBlackoutScopeRow[]>> {
    if (blackoutIds.length === 0) {
      return new Map();
    }

    const placeholders: string = blackoutIds
      .map((_: string, i: number) => `$${i + 1}`)
      .join(', ');
    const result = await client.query<VacationBlackoutScopeRow>(
      `SELECT id, blackout_id, org_type, org_id, created_at
       FROM vacation_blackout_scopes
       WHERE blackout_id IN (${placeholders})
       ORDER BY blackout_id, org_type, org_id`,
      blackoutIds,
    );

    const map = new Map<string, VacationBlackoutScopeRow[]>();
    for (const row of result.rows) {
      const existing: VacationBlackoutScopeRow[] =
        map.get(row.blackout_id) ?? [];
      existing.push(row);
      map.set(row.blackout_id, existing);
    }
    return map;
  }

  /** Get a single blackout by ID (internal helper). */
  private async getBlackoutById(
    client: PoolClient,
    tenantId: number,
    id: string,
  ): Promise<VacationBlackout> {
    const result = await client.query<VacationBlackoutRow>(
      `SELECT id, tenant_id, name, reason, start_date, end_date,
              is_global, is_active, created_by, created_at, updated_at
       FROM vacation_blackouts
       WHERE id = $1 AND tenant_id = $2 AND is_active = 1`,
      [id, tenantId],
    );

    const row: VacationBlackoutRow | undefined = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Blackout ${id} not found`);
    }

    const scopes: VacationBlackoutScopeRow[] = await this.loadScopes(
      client,
      id,
    );
    return this.mapRowToBlackout(row, scopes);
  }

  /** Build dynamic SET clause and params for blackout update (non-scope fields only). */
  private buildUpdateSetClauses(dto: UpdateBlackoutDto): {
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
      { column: 'is_global', value: dto.isGlobal },
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

  /** Check if the DTO contains scope array changes. */
  private hasScopeChanges(dto: UpdateBlackoutDto): boolean {
    return (
      dto.departmentIds !== undefined ||
      dto.teamIds !== undefined ||
      dto.areaIds !== undefined
    );
  }

  /** Map DB row + scope rows to API response type. */
  private mapRowToBlackout(
    row: VacationBlackoutRow,
    scopes: VacationBlackoutScopeRow[],
  ): VacationBlackout {
    return {
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
      isGlobal: row.is_global,
      departmentIds: this.extractOrgIds(scopes, 'department'),
      teamIds: this.extractOrgIds(scopes, 'team'),
      areaIds: this.extractOrgIds(scopes, 'area'),
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
  }

  /** Extract org IDs of a specific type from scope rows. */
  private extractOrgIds(
    scopes: VacationBlackoutScopeRow[],
    orgType: BlackoutOrgType,
  ): number[] {
    return scopes
      .filter((s: VacationBlackoutScopeRow) => s.org_type === orgType)
      .map((s: VacationBlackoutScopeRow) => s.org_id);
  }

  /** Format a Date as YYYY-MM-DD (no timezone issues). */
  private formatDate(date: Date): string {
    const year: number = date.getFullYear();
    const month: string = String(date.getMonth() + 1).padStart(2, '0');
    const day: string = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
