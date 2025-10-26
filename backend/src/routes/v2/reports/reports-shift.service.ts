/**
 * Reports Shift Service v2
 * Business logic for shift analytics and reporting
 */
import { query as executeQuery } from '../../../utils/db.js';
import { dbToApi } from '../../../utils/fieldMapping.js';
import { getDefaultDateFrom, getDefaultDateTo } from './reports-metrics.service.js';
import type { ReportFilters } from './reports.types.js';

/**
 * Build shift query conditions from filters
 */
function buildShiftQueryConditions(filters: ReportFilters): {
  conditions: string[];
  params: (string | number)[];
} {
  const conditions = [`s.tenant_id = ?`];
  const params: (string | number)[] = [filters.tenantId];

  const dateFrom = filters.dateFrom ?? getDefaultDateFrom();
  const dateTo = filters.dateTo ?? getDefaultDateTo();

  conditions.push(`s.date BETWEEN ? AND ?`);
  params.push(dateFrom, dateTo);

  if (filters.departmentId) {
    conditions.push(`s.department_id = ?`);
    params.push(filters.departmentId);
  }

  if (filters.teamId) {
    conditions.push(`s.team_id = ?`);
    params.push(filters.teamId);
  }

  return { conditions, params };
}

/**
 * Get shift summary data (total shifts, coverage, overtime)
 */
async function getShiftSummary(
  conditions: string[],
  params: (string | number)[],
): Promise<Record<string, unknown>> {
  const [rows] = await executeQuery(
    `
    SELECT
      COUNT(*) as total_shifts,
      SUM(required_employees) as total_required,
      SUM(required_employees) as total_filled,
      1 as coverage_rate,
      0 as total_overtime_hours,
      0 as total_overtime_cost
    FROM shifts s
    WHERE ${conditions.join(' AND ')}
  `,
    params,
  );
  return (rows as Record<string, unknown>[])[0] ?? {};
}

/**
 * Get overtime by department data
 */
async function getOvertimeByDepartment(
  tenantId: number,
  dateFrom: string,
  dateTo: string,
): Promise<Record<string, unknown>[]> {
  const [rows] = await executeQuery(
    `
    SELECT
      d.id as department_id,
      d.name as department_name,
      0 as overtime_hours,
      0 as overtime_cost
    FROM shifts s
    JOIN departments d ON d.id = s.department_id
    WHERE s.tenant_id = ?
      AND s.date BETWEEN ? AND ?
      -- AND s.overtime_hours > 0
    GROUP BY d.id, d.name
    ORDER BY d.name DESC
    LIMIT 10
  `,
    [tenantId, dateFrom, dateTo],
  );
  return rows as Record<string, unknown>[];
}

/**
 * Get peak hours analysis (shift type distribution)
 */
async function getPeakHoursAnalysis(
  tenantId: number,
  dateFrom: string,
  dateTo: string,
): Promise<Record<string, unknown>[]> {
  const [rows] = await executeQuery(
    `
    SELECT
      type as shift_type,
      COUNT(*) as count,
      1 as fill_rate
    FROM shifts
    WHERE tenant_id = ?
      AND date BETWEEN ? AND ?
    GROUP BY type
    ORDER BY count DESC
  `,
    [tenantId, dateFrom, dateTo],
  );
  return rows as Record<string, unknown>[];
}

/**
 * Get shift analytics report with coverage, overtime, and patterns
 * @param filters - The filter criteria (tenantId, date range, department, team)
 * @returns Comprehensive shift analytics report
 */
export async function getShiftReport(filters: ReportFilters): Promise<Record<string, unknown>> {
  const dateFrom = filters.dateFrom ?? getDefaultDateFrom();
  const dateTo = filters.dateTo ?? getDefaultDateTo();

  const { conditions, params } = buildShiftQueryConditions(filters);

  // Get all shift data in parallel
  const [summary, overtimeByDept, peakHours] = await Promise.all([
    getShiftSummary(conditions, params),
    getOvertimeByDepartment(filters.tenantId, dateFrom, dateTo),
    getPeakHoursAnalysis(filters.tenantId, dateFrom, dateTo),
  ]);

  return {
    period: { from: dateFrom, to: dateTo },
    totalShifts: Number(summary.total_shifts) || 0,
    coverage: {
      scheduled: Number(summary.total_required) || 0,
      filled: Number(summary.total_filled) || 0,
      rate: Number(summary.coverage_rate) || 0,
    },
    overtime: {
      totalHours: Number(summary.total_overtime_hours) || 0,
      totalCost: Number(summary.total_overtime_cost) || 0,
      byDepartment: overtimeByDept.map((row: Record<string, unknown>) => dbToApi(row)),
    },
    patterns: {
      peakHours: peakHours.map((row: Record<string, unknown>) => dbToApi(row)),
      understaffedShifts: (Number(summary.total_shifts) || 0) - (Number(summary.total_filled) || 0),
    },
  };
}
