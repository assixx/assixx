/**
 * TPM Defect Statistics Service (Mängelgrafik)
 *
 * Aggregates defect data per calendar week for cumulative chart display.
 * Data sources:
 *   - "Mängel erkannt": tpm_execution_defects (via card executions)
 *   - "Mängel behoben": work_orders with source_type='tpm_defect' + status='verified'
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type { DefectChartData, DefectWeeklyEntry } from './tpm.types.js';

/** Common JOIN chain for defects → cards → plans */
const DEFECT_PLAN_JOIN = `
  FROM tpm_execution_defects d
  JOIN tpm_card_executions e ON d.execution_id = e.id
  JOIN tpm_cards c ON e.card_id = c.id
  JOIN tpm_maintenance_plans p ON c.plan_id = p.id` as const;

/** Extended JOIN for resolved defects (adds work_orders) */
const RESOLVED_PLAN_JOIN = `
  FROM work_orders wo
  JOIN tpm_execution_defects d ON wo.source_uuid = d.uuid
  JOIN tpm_card_executions e ON d.execution_id = e.id
  JOIN tpm_cards c ON e.card_id = c.id
  JOIN tpm_maintenance_plans p ON c.plan_id = p.id` as const;

interface WeekCount {
  week: string;
  count: string;
}

interface CountResult {
  count: string;
}

interface YearResult {
  year: string;
}

@Injectable()
export class TpmDefectStatsService {
  constructor(private readonly db: DatabaseService) {}

  /** Aggregated defect stats per calendar week for a plan */
  async getDefectStats(tenantId: number, planUuid: string, year: number): Promise<DefectChartData> {
    const planRow = await this.fetchPlanInfo(tenantId, planUuid);
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const [detectedMap, resolvedMap, baseDetected, baseResolved, availableYears] =
      await Promise.all([
        this.fetchWeeklyCounts(tenantId, planUuid, yearStart, yearEnd, 'detected'),
        this.fetchWeeklyCounts(tenantId, planUuid, yearStart, yearEnd, 'resolved'),
        this.fetchBaseline(tenantId, planUuid, yearStart, 'detected'),
        this.fetchBaseline(tenantId, planUuid, yearStart, 'resolved'),
        this.fetchAvailableYears(tenantId, planUuid, year),
      ]);

    const weeks = buildWeeklyEntries(detectedMap, resolvedMap, baseDetected, baseResolved);
    const last = weeks[weeks.length - 1];

    return {
      year,
      assetName: planRow.asset_name,
      planName: planRow.name,
      weeks,
      baseDetected,
      baseResolved,
      totalDetected: last?.cumulativeDetected ?? baseDetected,
      totalResolved: last?.cumulativeResolved ?? baseResolved,
      availableYears,
    };
  }

  // ==========================================================================
  // PRIVATE QUERY HELPERS
  // ==========================================================================

  private async fetchPlanInfo(
    tenantId: number,
    planUuid: string,
  ): Promise<{ name: string; asset_name: string }> {
    const row = await this.db.tenantQueryOne<{ name: string; asset_name: string }>(
      `SELECT p.name, a.name AS asset_name
       FROM tpm_maintenance_plans p
       JOIN assets a ON p.asset_id = a.id
       WHERE p.uuid = $1 AND p.tenant_id = $2`,
      [planUuid, tenantId],
    );

    if (row === null) {
      throw new NotFoundException(`Wartungsplan ${planUuid} nicht gefunden`);
    }
    return row;
  }

  private async fetchWeeklyCounts(
    tenantId: number,
    planUuid: string,
    yearStart: string,
    yearEnd: string,
    type: 'detected' | 'resolved',
  ): Promise<Map<number, number>> {
    const sql =
      type === 'detected' ?
        `SELECT EXTRACT(WEEK FROM e.execution_date)::int AS week, COUNT(*)::int AS count
           ${DEFECT_PLAN_JOIN}
           WHERE p.uuid = $1 AND d.tenant_id = $2
             AND d.is_active = ${IS_ACTIVE.ACTIVE}
             AND e.execution_date >= $3::date AND e.execution_date <= $4::date
           GROUP BY week ORDER BY week`
      : `SELECT EXTRACT(WEEK FROM COALESCE(wo.completed_at, wo.verified_at))::int AS week,
                COUNT(*)::int AS count
           ${RESOLVED_PLAN_JOIN}
           WHERE p.uuid = $1 AND wo.tenant_id = $2
             AND wo.source_type = 'tpm_defect'
             AND wo.status IN ('completed', 'verified')
             AND wo.is_active = ${IS_ACTIVE.ACTIVE} AND d.is_active = ${IS_ACTIVE.ACTIVE}
             AND COALESCE(wo.completed_at, wo.verified_at) >= $3::date
             AND COALESCE(wo.completed_at, wo.verified_at) < ($4::date + INTERVAL '1 day')
           GROUP BY week ORDER BY week`;

    const rows = await this.db.tenantQuery<WeekCount>(sql, [
      planUuid,
      tenantId,
      yearStart,
      yearEnd,
    ]);
    const map = new Map<number, number>();
    for (const row of rows) {
      map.set(Number(row.week), Number(row.count));
    }
    return map;
  }

  private async fetchBaseline(
    tenantId: number,
    planUuid: string,
    yearStart: string,
    type: 'detected' | 'resolved',
  ): Promise<number> {
    const sql =
      type === 'detected' ?
        `SELECT COUNT(*)::int AS count ${DEFECT_PLAN_JOIN}
           WHERE p.uuid = $1 AND d.tenant_id = $2
             AND d.is_active = ${IS_ACTIVE.ACTIVE}
             AND e.execution_date < $3::date`
      : `SELECT COUNT(*)::int AS count ${RESOLVED_PLAN_JOIN}
           WHERE p.uuid = $1 AND wo.tenant_id = $2
             AND wo.source_type = 'tpm_defect'
             AND wo.status IN ('completed', 'verified')
             AND wo.is_active = ${IS_ACTIVE.ACTIVE} AND d.is_active = ${IS_ACTIVE.ACTIVE}
             AND COALESCE(wo.completed_at, wo.verified_at) < $3::date`;

    const row = await this.db.tenantQueryOne<CountResult>(sql, [planUuid, tenantId, yearStart]);
    return Number.parseInt(row?.count ?? '0', 10);
  }

  private async fetchAvailableYears(
    tenantId: number,
    planUuid: string,
    currentYear: number,
  ): Promise<number[]> {
    const rows = await this.db.tenantQuery<YearResult>(
      `SELECT DISTINCT EXTRACT(YEAR FROM e.execution_date)::int AS year
       ${DEFECT_PLAN_JOIN}
       WHERE p.uuid = $1 AND d.tenant_id = $2 AND d.is_active = ${IS_ACTIVE.ACTIVE}
       ORDER BY year`,
      [planUuid, tenantId],
    );

    const years = rows.map((r: YearResult) => Number(r.year));
    if (!years.includes(currentYear)) {
      years.push(currentYear);
      years.sort((a: number, b: number) => a - b);
    }
    return years;
  }
}

// ============================================================================
// PURE HELPERS
// ============================================================================

/** Build 52 weekly entries with cumulative sums */
function buildWeeklyEntries(
  detectedMap: Map<number, number>,
  resolvedMap: Map<number, number>,
  baseDetected: number,
  baseResolved: number,
): DefectWeeklyEntry[] {
  let cumDetected = baseDetected;
  let cumResolved = baseResolved;
  const weeks: DefectWeeklyEntry[] = [];

  for (let w = 1; w <= 52; w++) {
    const detected = detectedMap.get(w) ?? 0;
    const resolved = resolvedMap.get(w) ?? 0;
    cumDetected += detected;
    cumResolved += resolved;
    weeks.push({
      week: w,
      detected,
      resolved,
      cumulativeDetected: cumDetected,
      cumulativeResolved: cumResolved,
    });
  }

  return weeks;
}
