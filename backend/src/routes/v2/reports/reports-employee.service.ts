/**
 * Reports Employee Service v2
 * Business logic for employee and department analytics
 */
import { log } from 'console';

import { query as executeQuery } from '../../../utils/db.js';
import { dbToApi } from '../../../utils/fieldMapping.js';
import {
  getAttendanceMetrics,
  getDefaultDateFrom,
  getDefaultDateTo,
  getPerformanceMetrics,
} from './reports-metrics.service.js';
import type { DepartmentPerformanceData, ReportFilters } from './reports.types.js';

/**
 * Get detailed employee report with headcount, attendance, and performance
 * @param filters - Filter criteria (tenantId, date range, department, team)
 * @returns Comprehensive employee analytics report
 */
export async function getEmployeeReport(filters: ReportFilters): Promise<Record<string, unknown>> {
  const dateFrom = filters.dateFrom ?? getDefaultDateFrom();
  const dateTo = filters.dateTo ?? getDefaultDateTo();

  // Get headcount trend over time
  const [headcountTrendRows] = await executeQuery(
    `
    SELECT
      DATE(created_at) as date,
      COUNT(*) as count
    FROM users
    WHERE tenant_id = ?
      AND role = 'employee'
      AND created_at BETWEEN ? AND ?
    GROUP BY DATE(created_at)
    ORDER BY date
  `,
    [filters.tenantId, dateFrom, dateTo],
  );
  const headcountTrend = headcountTrendRows;

  // Get attendance metrics
  const attendanceData = getAttendanceMetrics(
    filters.tenantId,
    dateFrom,
    dateTo,
    filters.departmentId,
    filters.teamId,
  );

  // Get performance metrics
  const performanceData = await getPerformanceMetrics(
    filters.tenantId,
    dateFrom,
    dateTo,
    filters.departmentId,
    filters.teamId,
  );

  return {
    period: {
      from: dateFrom,
      to: dateTo,
    },
    filters: {
      departmentId: filters.departmentId,
      teamId: filters.teamId,
    },
    headcount: {
      trend: (headcountTrend as Record<string, unknown>[]).map((row: Record<string, unknown>) =>
        dbToApi(row),
      ),
    },
    attendance: attendanceData,
    performance: performanceData,
  };
}

/**
 * Get department performance report with employee count, teams, KVP, and shift metrics
 * @param filters - Filter criteria containing tenantId and date range
 * @returns Department performance analytics
 */
export async function getDepartmentReport(filters: {
  tenantId: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<Record<string, unknown>> {
  log('[Reports Service] getDepartmentReport called with:', filters);

  const dateFrom = filters.dateFrom ?? getDefaultDateFrom();
  const dateTo = filters.dateTo ?? getDefaultDateTo();

  const departmentData = await executeQuery(
    `
    SELECT
      d.id as department_id,
      d.name as department_name,
      COUNT(DISTINCT u.id) as employees,
      COUNT(DISTINCT t.id) as teams,
      COUNT(DISTINCT k.id) as kvp_suggestions,
      COALESCE(AVG(s.coverage_rate), 0) as shift_coverage,
      0 as avg_overtime
    FROM departments d
    LEFT JOIN users u ON u.department_id = d.id AND u.tenant_id = d.tenant_id
    LEFT JOIN teams t ON t.department_id = d.id
    LEFT JOIN kvp_suggestions k ON k.org_id = d.id
      AND k.org_level = 'department'
      AND k.created_at BETWEEN ? AND ?
    LEFT JOIN (
      SELECT
        department_id,
        1 as coverage_rate,
        0 as overtime_hours
      FROM shifts
      WHERE tenant_id = ?
        AND date BETWEEN ? AND ?
      GROUP BY department_id
    ) s ON s.department_id = d.id
    WHERE d.tenant_id = ?
    GROUP BY d.id, d.name
    ORDER BY d.name
  `,
    [dateFrom, dateTo, filters.tenantId, dateFrom, dateTo, filters.tenantId],
  );

  log('[Reports Service] Department data query result:', departmentData);

  // executeQuery returns [rows, fields], we need just the rows
  const rows = departmentData[0];

  const result: DepartmentPerformanceData[] = (rows as Record<string, unknown>[]).map(
    (dept: Record<string, unknown>) => ({
      departmentId: Number(dept.department_id),
      departmentName: String(dept.department_name),
      metrics: {
        employees: Number(dept.employees) || 0,
        teams: Number(dept.teams) || 0,
        kvpSuggestions: Number(dept.kvp_suggestions) || 0,
        shiftCoverage: Number(dept.shift_coverage) || 0,
        avgOvertime: Number(dept.avg_overtime) || 0,
      },
    }),
  );

  log('[Reports Service] Mapped department result:', result);
  return { departments: result };
}
