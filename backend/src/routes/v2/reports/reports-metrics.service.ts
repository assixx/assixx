/**
 * Reports Metrics Service v2
 * Shared helper functions for metric calculations across all report types
 * Extracted from reports.service.ts for better reusability
 */
import { query as executeQuery } from '../../../utils/db.js';
import type {
  AttendanceMetrics,
  DepartmentMetrics,
  EmployeeMetrics,
  KvpMetrics,
  PerformanceMetrics,
  ShiftMetrics,
  SurveyMetrics,
} from './reports.types.js';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Parse a value as integer, returning 0 for NaN
 */
function parseIntOrZero(value: unknown): number {
  const parsed = Number.parseInt(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Parse a value as float, returning 0 for NaN
 */
function parseFloatOrZero(value: unknown): number {
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

// ============================================================
// DATE HELPERS
// ============================================================

/**
 * Get default "from" date (30 days ago)
 */
export function getDefaultDateFrom(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  const isoDate = date.toISOString().split('T')[0];
  // split() on ISO string always returns at least one element
  if (isoDate === undefined) {
    throw new Error('Failed to format date');
  }
  return isoDate;
}

/**
 * Get default "to" date (today)
 */
export function getDefaultDateTo(): string {
  const isoDate = new Date().toISOString().split('T')[0];
  // split() on ISO string always returns at least one element
  if (isoDate === undefined) {
    throw new Error('Failed to format date');
  }
  return isoDate;
}

// ============================================================
// EMPLOYEE METRICS
// ============================================================

/**
 * Get employee metrics for the given period
 * @param tenantId - The tenant ID
 * @param _dateFrom - Start date (currently unused, for future filtering)
 * @param _dateTo - End date (currently unused, for future filtering)
 * @returns Employee metrics summary
 */
export async function getEmployeeMetrics(
  tenantId: number,
  _dateFrom: string,
  _dateTo: string,
): Promise<EmployeeMetrics> {
  const [resultRows] = await executeQuery(
    `
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
      COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_this_month,
      (SELECT COUNT(*) FROM departments WHERE tenant_id = $1 AND is_active = 1) as department_count,
      CASE
        WHEN (SELECT COUNT(*) FROM departments WHERE tenant_id = $2 AND is_active = 1) > 0
        THEN COUNT(*) / (SELECT COUNT(*) FROM departments WHERE tenant_id = $3 AND is_active = 1)
        ELSE 0
      END as avg_per_department
    FROM users
    WHERE tenant_id = $4
      AND role = 'employee'
  `,
    [tenantId, tenantId, tenantId, tenantId],
  );

  const metrics = (resultRows as Record<string, unknown>[])[0] ?? {};
  return {
    total: parseIntOrZero(metrics['total']),
    active: parseIntOrZero(metrics['active']),
    newThisMonth: parseIntOrZero(metrics['new_this_month']),
    departments: parseIntOrZero(metrics['department_count']),
    avgPerDepartment: parseFloatOrZero(metrics['avg_per_department']),
  };
}

// ============================================================
// DEPARTMENT METRICS
// ============================================================

/**
 * Get department metrics for the given period
 * @param tenantId - The tenant ID
 * @param _dateFrom - Start date (currently unused, for future filtering)
 * @param _dateTo - End date (currently unused, for future filtering)
 * @returns Department metrics summary
 */
export async function getDepartmentMetrics(
  tenantId: number,
  _dateFrom: string,
  _dateTo: string,
): Promise<DepartmentMetrics> {
  const [deptResultRows] = await executeQuery(
    `
    SELECT
      COUNT(DISTINCT d.id) as total,
      AVG(emp_count) as avg_employees
    FROM departments d
    LEFT JOIN (
      SELECT department_id, COUNT(*) as emp_count
      FROM users
      WHERE tenant_id = $1 AND role = 'employee'
      GROUP BY department_id
    ) e ON e.department_id = d.id
    WHERE d.tenant_id = $2
  `,
    [tenantId, tenantId],
  );

  const metrics = (deptResultRows as Record<string, unknown>[])[0] ?? {};
  return {
    total: parseIntOrZero(metrics['total']),
    avgEmployees: parseFloatOrZero(metrics['avg_employees']),
  };
}

// ============================================================
// SHIFT METRICS
// ============================================================

/**
 * Get shift metrics for the given period
 * @param tenantId - The tenant ID
 * @param dateFrom - Start date for metrics
 * @param dateTo - End date for metrics
 * @returns Shift metrics summary
 */
export async function getShiftMetrics(
  tenantId: number,
  dateFrom: string,
  dateTo: string,
): Promise<ShiftMetrics> {
  const [shiftResultRows] = await executeQuery(
    `
    SELECT
      COUNT(*) as total_scheduled,
      0 as overtime_hours,
      1 as coverage_rate
    FROM shifts
    WHERE tenant_id = $1
      AND date BETWEEN $2 AND $3
  `,
    [tenantId, dateFrom, dateTo],
  );

  const metrics = (shiftResultRows as Record<string, unknown>[])[0] ?? {};
  return {
    totalScheduled: parseIntOrZero(metrics['total_scheduled']),
    overtimeHours: parseFloatOrZero(metrics['overtime_hours']),
    coverageRate: parseFloatOrZero(metrics['coverage_rate']),
  };
}

// ============================================================
// KVP METRICS
// ============================================================

/**
 * Get KVP metrics for the given period
 * @param tenantId - The tenant ID
 * @param dateFrom - Start date for metrics
 * @param dateTo - End date for metrics
 * @returns KVP metrics summary
 */
export async function getKvpMetrics(
  tenantId: number,
  dateFrom: string,
  dateTo: string,
): Promise<KvpMetrics> {
  const [kvpResultRows] = await executeQuery(
    `
    SELECT
      COUNT(*) as total_suggestions,
      COUNT(CASE WHEN status = 'implemented' THEN 1 END) as implemented,
      SUM(CASE WHEN status = 'implemented' THEN actual_savings ELSE 0 END) as total_savings,
      AVG(CASE WHEN status = 'implemented' AND estimated_cost > 0
          THEN (actual_savings - estimated_cost) / estimated_cost ELSE NULL END) as avg_roi
    FROM kvp_suggestions
    WHERE tenant_id = $1
      AND created_at BETWEEN $2 AND $3
  `,
    [tenantId, dateFrom, dateTo],
  );

  const metrics = (kvpResultRows as Record<string, unknown>[])[0] ?? {};
  return {
    totalSuggestions: parseIntOrZero(metrics['total_suggestions']),
    implemented: parseIntOrZero(metrics['implemented']),
    totalSavings: parseFloatOrZero(metrics['total_savings']),
    avgROI: parseFloatOrZero(metrics['avg_roi']),
  };
}

// ============================================================
// SURVEY METRICS
// ============================================================

/**
 * Get survey metrics for the given period
 * @param tenantId - The tenant ID
 * @param dateFrom - Start date for metrics
 * @param dateTo - End date for metrics
 * @returns Survey metrics summary
 */
export async function getSurveyMetrics(
  tenantId: number,
  dateFrom: string,
  dateTo: string,
): Promise<SurveyMetrics> {
  // POSTGRESQL FIX: Parameters must be $1, $2, $3 in order they appear in array
  const [surveyResultRows] = await executeQuery(
    `
    SELECT
      COUNT(DISTINCT s.id) as active_surveys,
      AVG(response_rate) as avg_response_rate
    FROM surveys s
    LEFT JOIN (
      SELECT
        survey_id,
        COUNT(DISTINCT user_id) / (
          SELECT COUNT(*) FROM users
          WHERE tenant_id = $1 AND role = 'employee'
        ) as response_rate
      FROM survey_responses
      WHERE started_at BETWEEN $2 AND $3
      GROUP BY survey_id
    ) r ON r.survey_id = s.id
    WHERE s.tenant_id = $1
      AND s.status = 'active'
  `,
    [tenantId, dateFrom, dateTo],
  );

  const metrics = (surveyResultRows as Record<string, unknown>[])[0] ?? {};
  return {
    totalSurveys: parseIntOrZero(metrics['active_surveys']),
    completedSurveys: 0, // Not available in current query
    avgParticipation: parseFloatOrZero(metrics['avg_response_rate']),
    avgSatisfaction: 0, // Not available in current query
  };
}

// ============================================================
// ATTENDANCE METRICS
// ============================================================

/**
 * Get attendance metrics for the given period
 * @param _tenantId - The tenant ID (unused in mock implementation)
 * @param _dateFrom - Start date (unused in mock implementation)
 * @param _dateTo - End date (unused in mock implementation)
 * @param _departmentId - Optional department ID filter (unused in mock implementation)
 * @param _teamId - Optional team ID filter (unused in mock implementation)
 * @returns Attendance metrics summary
 * @remarks This is a mock implementation. In production, analyze actual shift attendance data
 */
export function getAttendanceMetrics(
  _tenantId: number,
  _dateFrom: string,
  _dateTo: string,
  _departmentId?: number,
  _teamId?: number,
): AttendanceMetrics {
  // Mock implementation for now
  return {
    avgRate: 0.92,
    absences: Math.floor(Math.random() * 50) + 10,
  };
}

// ============================================================
// PERFORMANCE METRICS
// ============================================================

/**
 * Get performance metrics for the given period
 * @param tenantId - The tenant ID
 * @param dateFrom - Start date for metrics
 * @param dateTo - End date for metrics
 * @param _departmentId - Optional department ID filter (currently unused)
 * @param _teamId - Optional team ID filter (currently unused)
 * @returns Performance metrics summary
 */
export async function getPerformanceMetrics(
  tenantId: number,
  dateFrom: string,
  dateTo: string,
  _departmentId?: number,
  _teamId?: number,
): Promise<PerformanceMetrics> {
  // Get KVP participation rate
  const [kvpResultRows] = await executeQuery(
    `
    SELECT
      COUNT(DISTINCT submitted_by) as participants,
      (SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND role = 'employee') as total_employees
    FROM kvp_suggestions
    WHERE tenant_id = $2
      AND created_at BETWEEN $3 AND $4
  `,
    [tenantId, tenantId, dateFrom, dateTo],
  );

  const kvpData = (kvpResultRows as Record<string, unknown>[])[0] ?? {};
  const kvpParticipation =
    Number(kvpData['total_employees']) > 0 ?
      Number(kvpData['participants']) / Number(kvpData['total_employees'])
    : 0;

  // Mock shift completion rate for now
  const avgShiftCompletion = 0.88 + Math.random() * 0.1;

  return {
    kvpParticipation,
    surveyCompletion: 0, // Not available in current implementation
    overallScore: avgShiftCompletion,
  };
}
