/**
 * Rotation History Service
 *
 * Handles rotation history queries and deletion operations.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { dbToApi } from '../../utils/fieldMapper.js';
import { DatabaseService } from '../database/database.service.js';
import type {
  DbHistoryRow,
  DeleteHistoryCountsResponse,
  RotationHistoryFilters,
  RotationHistoryResponse,
} from './rotation.types.js';

@Injectable()
export class RotationHistoryService {
  private readonly logger = new Logger(RotationHistoryService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async getRotationHistory(
    tenantId: number,
    filters: RotationHistoryFilters,
  ): Promise<RotationHistoryResponse[]> {
    this.logger.debug(`Getting rotation history for tenant ${tenantId}`);

    let query = `
      SELECT
        h.*,
        u.username,
        u.first_name,
        u.last_name,
        p.name as pattern_name
      FROM shift_rotation_history h
      JOIN users u ON h.user_id = u.id
      JOIN shift_rotation_patterns p ON h.pattern_id = p.id
      WHERE h.tenant_id = $1
    `;

    const params: (string | number)[] = [tenantId];

    if (filters.patternId !== undefined) {
      const paramIndex = params.length + 1;
      query += ` AND h.pattern_id = $${paramIndex}`;
      params.push(filters.patternId);
    }

    if (filters.teamId !== undefined) {
      const paramIndex = params.length + 1;
      query += ` AND h.team_id = $${paramIndex}`;
      params.push(filters.teamId);
    }

    if (filters.userId !== undefined) {
      const paramIndex = params.length + 1;
      query += ` AND h.user_id = $${paramIndex}`;
      params.push(filters.userId);
    }

    if (filters.startDate !== undefined && filters.startDate !== '') {
      const paramIndex = params.length + 1;
      query += ` AND h.shift_date >= $${paramIndex}`;
      params.push(filters.startDate);
    }

    if (filters.endDate !== undefined && filters.endDate !== '') {
      const paramIndex = params.length + 1;
      query += ` AND h.shift_date <= $${paramIndex}`;
      params.push(filters.endDate);
    }

    if (filters.status !== undefined && filters.status !== '') {
      const paramIndex = params.length + 1;
      query += ` AND h.status = $${paramIndex}`;
      params.push(filters.status);
    }

    query += ' ORDER BY h.shift_date DESC, h.user_id';

    const rows = await this.databaseService.query<DbHistoryRow>(query, params);
    return rows.map(
      (row: DbHistoryRow) =>
        dbToApi(
          row as unknown as Record<string, unknown>,
        ) as RotationHistoryResponse,
    );
  }

  private async executeDeleteWithCount(
    query: string,
    params: unknown[],
  ): Promise<number> {
    const result = await this.databaseService.query<{ count: string }>(
      query,
      params,
    );
    return Number.parseInt(result[0]?.count ?? '0', 10);
  }

  private buildShiftsDeleteQuery(hasPatternId: boolean): string {
    const patternFilter = hasPatternId ? 'AND h.pattern_id = $3' : '';
    return `WITH to_delete AS (
      SELECT DISTINCT h.user_id, h.shift_date FROM shift_rotation_history h
      WHERE h.tenant_id = $1 AND h.team_id = $2 ${patternFilter}
    ), deleted AS (
      DELETE FROM shifts s USING to_delete td
      WHERE s.tenant_id = $1 AND s.team_id = $2 AND s.user_id = td.user_id AND s.date = td.shift_date
      RETURNING s.*
    ) SELECT COUNT(*) as count FROM deleted`;
  }

  /** @param patternId - If provided, only deletes this specific pattern instead of all */
  async deleteRotationHistory(
    tenantId: number,
    teamId: number,
    patternId?: number,
  ): Promise<DeleteHistoryCountsResponse> {
    const hasPatternId = patternId !== undefined;
    this.logger.debug(
      `Deleting ${hasPatternId ? `pattern ${patternId}` : 'all patterns'} for team ${teamId}`,
    );

    await this.databaseService.query('BEGIN', []);

    try {
      const params =
        hasPatternId ? [tenantId, teamId, patternId] : [tenantId, teamId];
      const patternCond = hasPatternId ? 'AND pattern_id = $3' : '';

      // Delete in order: shifts -> history -> assignments -> patterns -> plans
      const shifts = await this.executeDeleteWithCount(
        this.buildShiftsDeleteQuery(hasPatternId),
        params,
      );

      const history = await this.executeDeleteWithCount(
        `WITH d AS (DELETE FROM shift_rotation_history WHERE tenant_id=$1 AND team_id=$2 ${patternCond} RETURNING *) SELECT COUNT(*) as count FROM d`,
        params,
      );

      const assignments = await this.executeDeleteWithCount(
        `WITH d AS (DELETE FROM shift_rotation_assignments WHERE tenant_id=$1 AND team_id=$2 ${patternCond} RETURNING *) SELECT COUNT(*) as count FROM d`,
        params,
      );

      const patternQuery =
        hasPatternId ?
          `WITH d AS (DELETE FROM shift_rotation_patterns WHERE tenant_id=$1 AND team_id=$2 AND id=$3 RETURNING *) SELECT COUNT(*) as count FROM d`
        : `WITH d AS (DELETE FROM shift_rotation_patterns WHERE tenant_id=$1 AND team_id=$2 RETURNING *) SELECT COUNT(*) as count FROM d`;
      const patterns = await this.executeDeleteWithCount(patternQuery, params);

      // Delete plans only when deleting ALL patterns
      let plans = 0;
      if (!hasPatternId) {
        plans = await this.executeDeleteWithCount(
          `WITH d AS (DELETE FROM shift_plans WHERE tenant_id=$1 AND team_id=$2 RETURNING *) SELECT COUNT(*) as count FROM d`,
          [tenantId, teamId],
        );
      }

      await this.databaseService.query('COMMIT', []);
      return { patterns, assignments, history, shifts, plans };
    } catch (error) {
      await this.databaseService.query('ROLLBACK', []);
      throw error;
    }
  }

  async deleteRotationHistoryByDateRange(
    tenantId: number,
    teamId: number,
    startDate: string,
    endDate: string,
  ): Promise<DeleteHistoryCountsResponse> {
    this.logger.debug(
      `Deleting rotation history for team ${teamId} from ${startDate} to ${endDate}`,
    );

    const result = await this.databaseService.query<{ count: string }>(
      `WITH deleted AS (
        DELETE FROM shift_rotation_history
        WHERE tenant_id = $1 AND team_id = $2 AND shift_date >= $3 AND shift_date <= $4
        RETURNING *
      ) SELECT COUNT(*) as count FROM deleted`,
      [tenantId, teamId, startDate, endDate],
    );

    const historyDeleted = Number.parseInt(result[0]?.count ?? '0', 10);

    return {
      patterns: 0,
      assignments: 0,
      history: historyDeleted,
    };
  }

  async deleteRotationHistoryEntry(
    historyId: number,
    tenantId: number,
  ): Promise<void> {
    this.logger.debug(
      `Deleting rotation history entry ${historyId} for tenant ${tenantId}`,
    );

    const result = await this.databaseService.query<{ count: string }>(
      `WITH deleted AS (
        DELETE FROM shift_rotation_history WHERE id = $1 AND tenant_id = $2 RETURNING *
      ) SELECT COUNT(*) as count FROM deleted`,
      [historyId, tenantId],
    );

    const deletedCount = Number.parseInt(result[0]?.count ?? '0', 10);

    if (deletedCount === 0) {
      throw new NotFoundException(
        `Rotation history entry ${historyId} not found`,
      );
    }
  }
}
