/**
 * Reports/Analytics v2 Service
 * Business logic for generating reports and analytics
 */
import { log, error as logError } from 'console';

import { ServiceError } from '../../../utils/ServiceError.js';
// For debugging

import { query as executeQuery } from '../../../utils/db.js';
import { dbToApi } from '../../../utils/fieldMapping.js';

interface DateRangeFilter {
  dateFrom?: string;
  dateTo?: string;
}

interface ReportFilters extends DateRangeFilter {
  tenantId: number;
  departmentId?: number;
  teamId?: number;
  categoryId?: number;
}

/**
 * Get company overview report with KPIs
 * @param filters - The filter criteria
 * @param filters.tenantId
 * @param filters.dateFrom
 * @param filters.dateTo
 */
export async function getOverviewReport(filters: {
  tenantId: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  try {
    log('[Reports Service] getOverviewReport called with:', filters);

    const dateFrom = filters.dateFrom ?? getDefaultDateFrom();
    const dateTo = filters.dateTo ?? getDefaultDateTo();

    // Get employee metrics
    log('[Reports Service] Getting employee metrics...');
    const employeeMetrics = await getEmployeeMetrics(filters.tenantId, dateFrom, dateTo);

    // Get department metrics
    log('[Reports Service] Getting department metrics...');
    const departmentMetrics = await getDepartmentMetrics(filters.tenantId, dateFrom, dateTo);

    // Get shift metrics
    log('[Reports Service] Getting shift metrics...');
    const shiftMetrics = await getShiftMetrics(filters.tenantId, dateFrom, dateTo);

    // Get KVP metrics
    log('[Reports Service] Getting KVP metrics...');
    const kvpMetrics = await getKvpMetrics(filters.tenantId, dateFrom, dateTo);

    // Get survey metrics
    log('[Reports Service] Getting survey metrics...');
    const surveyMetrics = await getSurveyMetrics(filters.tenantId, dateFrom, dateTo);

    log('[Reports Service] Overview report generated successfully');
    return {
      period: {
        from: dateFrom,
        to: dateTo,
      },
      employees: employeeMetrics,
      departments: departmentMetrics,
      shifts: shiftMetrics,
      kvp: kvpMetrics,
      surveys: surveyMetrics,
    };
  } catch (error: unknown) {
    logError('[Reports Service] Error in getOverviewReport:', error);
    throw error;
  }
}

/**
 * Get detailed employee report
 * @param filters - The filter criteria
 */
export async function getEmployeeReport(filters: ReportFilters) {
  const dateFrom = filters.dateFrom ?? getDefaultDateFrom();
  const dateTo = filters.dateTo ?? getDefaultDateTo();

  // Build query conditions
  const conditions = [`u.tenant_id = ?`];
  const params: (string | number)[] = [filters.tenantId];

  if (filters.departmentId) {
    conditions.push(`u.department_id = ?`);
    params.push(filters.departmentId);
  }

  if (filters.teamId) {
    conditions.push(`tm.team_id = ?`);
    params.push(filters.teamId);
  }

  // Get headcount trend
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
  const headcountTrend = headcountTrendRows || [];

  // Get attendance metrics
  const attendanceData = await getAttendanceMetrics(
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
      trend: (headcountTrend as Record<string, unknown>[]).map((row) => dbToApi(row)),
    },
    attendance: attendanceData,
    performance: performanceData,
  };
}

/**
 * Get department performance report
 * @param filters - The filter criteria
 * @param filters.tenantId
 * @param filters.dateFrom
 * @param filters.dateTo
 */
export async function getDepartmentReport(filters: {
  tenantId: number;
  dateFrom?: string;
  dateTo?: string;
}) {
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
  const rows = departmentData[0] || [];

  const result = (rows as Record<string, unknown>[]).map((dept: Record<string, unknown>) => ({
    departmentId: dept.department_id,
    departmentName: dept.department_name,
    metrics: {
      employees: Number.parseInt(String(dept.employees)) ?? 0,
      teams: Number.parseInt(String(dept.teams)) ?? 0,
      kvpSuggestions: Number.parseInt(String(dept.kvp_suggestions)) ?? 0,
      shiftCoverage: Number.parseFloat(String(dept.shift_coverage)) ?? 0,
      avgOvertime: Number.parseFloat(String(dept.avg_overtime)) ?? 0,
    },
  }));

  log('[Reports Service] Mapped department result:', result);
  return result;
}

/**
 * Get shift analytics report
 * @param filters - The filter criteria
 */
export async function getShiftReport(filters: ReportFilters) {
  const dateFrom = filters.dateFrom ?? getDefaultDateFrom();
  const dateTo = filters.dateTo ?? getDefaultDateTo();

  // Build conditions
  const conditions = [`s.tenant_id = ?`];
  const params: (string | number)[] = [filters.tenantId];

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

  // Get shift summary
  const [shiftSummaryRows] = await executeQuery(
    `
    SELECT 
      COUNT(*) as total_shifts,
      SUM(required_employees) as total_required,
      SUM(required_employees) as total_filled,
      1 as coverage_rate,
      0 as total_overtime_hours,
      0 as total_overtime_cost
    FROM shifts s
    WHERE ${String(conditions.join(' AND '))}
  `,
    params,
  );
  const shiftSummary = shiftSummaryRows || [];

  // Get overtime by department
  const [overtimeByDeptRows] = await executeQuery(
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
    [filters.tenantId, dateFrom, dateTo],
  );
  const overtimeByDept = overtimeByDeptRows || [];

  // Get peak hours analysis
  const [peakHoursRows] = await executeQuery(
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
    [filters.tenantId, dateFrom, dateTo],
  );
  const peakHours = peakHoursRows || [];

  const summary = (shiftSummary as Record<string, unknown>[])[0] ?? {};

  return {
    period: {
      from: dateFrom,
      to: dateTo,
    },
    totalShifts: Number.parseInt(String(summary.total_shifts)) ?? 0,
    coverage: {
      scheduled: Number.parseInt(String(summary.total_required)) ?? 0,
      filled: Number.parseInt(String(summary.total_filled)) ?? 0,
      rate: Number.parseFloat(String(summary.coverage_rate)) ?? 0,
    },
    overtime: {
      totalHours: Number.parseFloat(String(summary.total_overtime_hours)) ?? 0,
      totalCost: Number.parseFloat(String(summary.total_overtime_cost)) ?? 0,
      byDepartment: (overtimeByDept as Record<string, unknown>[]).map((row) => dbToApi(row)),
    },
    patterns: {
      peakHours: (peakHours as Record<string, unknown>[]).map((row) => dbToApi(row)),
      understaffedShifts:
        Number.parseInt(String(summary.total_shifts)) -
        (Number.parseInt(String(summary.total_filled ?? '0')) ?? 0),
    },
  };
}

/**
 * Get KVP ROI report
 * @param filters - The filter criteria
 * @param filters.tenantId
 * @param filters.dateFrom
 * @param filters.dateTo
 * @param filters.categoryId
 */
export async function getKvpReport(filters: {
  tenantId: number;
  dateFrom?: string;
  dateTo?: string;
  categoryId?: number;
}) {
  try {
    log('[Reports Service] getKvpReport called with:', filters);

    const dateFrom = filters.dateFrom ?? getDefaultDateFrom();
    const dateTo = filters.dateTo ?? getDefaultDateTo();

    // Build conditions
    const conditions = [`k.tenant_id = ?`];
    const params: (string | number)[] = [filters.tenantId];

    conditions.push(`k.created_at BETWEEN ? AND ?`);
    params.push(dateFrom, dateTo);

    if (filters.categoryId) {
      conditions.push(`k.category_id = ?`);
      params.push(filters.categoryId);
    }

    // Get KVP summary
    const [kvpSummaryRows] = await executeQuery(
      `
    SELECT 
      COUNT(*) as total_suggestions,
      COUNT(CASE WHEN status = 'implemented' THEN 1 END) as implemented,
      SUM(CASE WHEN status = 'implemented' THEN estimated_cost ELSE 0 END) as total_cost,
      SUM(CASE WHEN status = 'implemented' THEN actual_savings ELSE 0 END) as total_savings
    FROM kvp_suggestions k
    WHERE ${String(conditions.join(' AND '))}
  `,
      params,
    );
    const kvpSummary = kvpSummaryRows || [];

    // Get metrics by category
    const [byCategoryRows] = await executeQuery(
      `
    SELECT 
      c.id as category_id,
      c.name as category_name,
      COUNT(k.id) as suggestions,
      COUNT(CASE WHEN k.status = 'implemented' THEN 1 END) as implemented,
      AVG(CASE WHEN k.status = 'implemented' THEN k.actual_savings ELSE NULL END) as avg_savings
    FROM kvp_categories c
    LEFT JOIN kvp_suggestions k ON k.category_id = c.id
      AND k.tenant_id = ?
      AND k.created_at BETWEEN ? AND ?
    GROUP BY c.id, c.name
    ORDER BY suggestions DESC
  `,
      [filters.tenantId, dateFrom, dateTo],
    );
    const byCategory = byCategoryRows || [];

    // Get top performers
    const [topPerformersRows] = await executeQuery(
      `
    SELECT 
      u.id as user_id,
      CONCAT(u.first_name, ' ', u.last_name) as name,
      COUNT(k.id) as suggestions,
      SUM(CASE WHEN k.status = 'implemented' THEN k.actual_savings ELSE 0 END) as total_savings
    FROM users u
    JOIN kvp_suggestions k ON k.submitted_by = u.id
    WHERE k.tenant_id = ?
      AND k.created_at BETWEEN ? AND ?
    GROUP BY u.id, u.first_name, u.last_name
    HAVING suggestions > 0
    ORDER BY total_savings DESC
    LIMIT 10
  `,
      [filters.tenantId, dateFrom, dateTo],
    );
    const topPerformers = topPerformersRows || [];

    const summary = (kvpSummary as Record<string, unknown>[])[0] ?? {};
    const roi =
      Number(summary.total_cost) > 0 ?
        (Number(summary.total_savings) - Number(summary.total_cost)) / Number(summary.total_cost)
      : 0;

    return {
      period: {
        from: dateFrom,
        to: dateTo,
      },
      summary: {
        totalSuggestions: Number.parseInt(String(summary.total_suggestions)) ?? 0,
        implemented: Number.parseInt(String(summary.implemented)) ?? 0,
        totalCost: Number.parseFloat(String(summary.total_cost)) ?? 0,
        totalSavings: Number.parseFloat(String(summary.total_savings)) ?? 0,
        roi: roi,
      },
      byCategory: (byCategory as Record<string, unknown>[]).map((row) => dbToApi(row)),
      topPerformers: (topPerformers as Record<string, unknown>[]).map((row) => dbToApi(row)),
    };
  } catch (error: unknown) {
    logError('[Reports Service] Error in getKvpReport:', error);
    throw error;
  }
}

/**
 * Get attendance report
 * @param filters - The filter criteria
 */
export async function getAttendanceReport(filters: ReportFilters) {
  // For now, return mock data
  // In production, this would analyze shift attendance data

  const avgAttendanceRate = 0.92; // 92%
  const totalAbsences = Math.floor(Math.random() * 50) + 10;
  const totalLateArrivals = Math.floor(Math.random() * 30) + 5;

  // Generate mock employee data
  const employees = [];
  for (let i = 1; i <= 10; i++) {
    employees.push({
      userId: i,
      name: `Employee ${i}`,
      attendanceRate: 0.85 + Math.random() * 0.15,
      absences: Math.floor(Math.random() * 5),
      lateArrivals: Math.floor(Math.random() * 3),
    });
  }

  // Generate daily trend
  const daily = [];
  const startDate = new Date(filters.dateFrom ?? getDefaultDateFrom());
  const endDate = new Date(filters.dateTo ?? getDefaultDateTo());

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    daily.push({
      date: d.toISOString().split('T')[0],
      rate: 0.88 + Math.random() * 0.1,
    });
  }

  return {
    period: {
      from: filters.dateFrom,
      to: filters.dateTo,
    },
    summary: {
      avgAttendanceRate,
      totalAbsences,
      totalLateArrivals,
    },
    byEmployee: employees,
    trends: {
      daily,
    },
  };
}

/**
 * Get compliance report
 * @param filters - The filter criteria
 * @param filters.tenantId
 * @param filters.dateFrom
 * @param filters.dateTo
 * @param filters.departmentId
 */
export async function getComplianceReport(filters: {
  tenantId: number;
  dateFrom: string;
  dateTo: string;
  departmentId?: number;
}) {
  // For now, return mock compliance data
  // In production, this would analyze working hours, breaks, etc.

  const violations = {
    total: Math.floor(Math.random() * 20) + 5,
    byType: {
      maxWorkingHours: Math.floor(Math.random() * 10),
      missingBreaks: Math.floor(Math.random() * 8),
      insufficientRest: Math.floor(Math.random() * 5),
    },
  };

  const riskEmployees = [];
  for (let i = 1; i <= 5; i++) {
    const issues = [];
    if (Math.random() > 0.5) issues.push('Exceeded max working hours');
    if (Math.random() > 0.5) issues.push('Missing required breaks');
    if (Math.random() > 0.5) issues.push('Insufficient rest period');

    if (issues.length > 0) {
      riskEmployees.push({
        userId: i,
        name: `Employee ${i}`,
        violations: issues.length,
        issues,
      });
    }
  }

  return {
    period: {
      from: filters.dateFrom,
      to: filters.dateTo,
    },
    violations,
    riskEmployees,
  };
}

/**
 * Generate custom report
 */
interface CustomReportParams {
  tenantId: number;
  name: string;
  description?: string;
  metrics: string[];
  dateFrom: string;
  dateTo: string;
  filters?: {
    departmentIds?: number[];
    teamIds?: number[];
  };
  groupBy?: string;
}

/**
 *
 * @param params - The parameters object
 */
export async function generateCustomReport(params: CustomReportParams) {
  const reportId = `RPT-${String(Date.now())}-${String(Math.random().toString(36).substr(2, 9))}`;
  const data: Record<string, unknown> = {};

  // Generate data for each requested metric
  for (const metric of params.metrics) {
    switch (metric) {
      case 'employees':
        data.employees = await getEmployeeMetrics(params.tenantId, params.dateFrom, params.dateTo);
        break;
      case 'departments':
        data.departments = await getDepartmentReport({
          tenantId: params.tenantId,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
        });
        break;
      case 'shifts':
        data.shifts = await getShiftMetrics(params.tenantId, params.dateFrom, params.dateTo);
        break;
      case 'kvp':
        data.kvp = await getKvpMetrics(params.tenantId, params.dateFrom, params.dateTo);
        break;
      case 'attendance':
        data.attendance = await getAttendanceMetrics(
          params.tenantId,
          params.dateFrom,
          params.dateTo,
        );
        break;
      case 'compliance':
        data.compliance = await getComplianceReport({
          tenantId: params.tenantId,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
        });
        break;
    }
  }

  return {
    reportId,
    name: params.name,
    description: params.description,
    generatedAt: new Date().toISOString(),
    period: {
      from: params.dateFrom,
      to: params.dateTo,
    },
    metrics: params.metrics,
    data,
  };
}

/**
 * Export report in various formats
 */
interface ExportReportParams {
  tenantId: number;
  reportType: string;
  format: 'pdf' | 'excel' | 'csv';
  filters: {
    dateFrom?: string;
    dateTo?: string;
    departmentId?: number;
    teamId?: number;
  };
}

/**
 *
 * @param params - The parameters object
 */
export async function exportReport(params: ExportReportParams) {
  // Get report data based on type
  let reportData: Record<string, unknown> | Buffer | unknown[];

  switch (params.reportType) {
    case 'overview':
      reportData = await getOverviewReport({
        tenantId: params.tenantId,
        dateFrom: params.filters.dateFrom,
        dateTo: params.filters.dateTo,
      });
      break;
    case 'employees':
      reportData = await getEmployeeReport({
        tenantId: params.tenantId,
        ...params.filters,
      });
      break;
    case 'departments':
      reportData = {
        departments: await getDepartmentReport({
          tenantId: params.tenantId,
          dateFrom: params.filters.dateFrom,
          dateTo: params.filters.dateTo,
        }),
      };
      break;
    case 'shifts':
      reportData = await getShiftReport({
        tenantId: params.tenantId,
        ...params.filters,
      });
      break;
    case 'kvp':
      reportData = await getKvpReport({
        tenantId: params.tenantId,
        dateFrom: params.filters.dateFrom,
        dateTo: params.filters.dateTo,
      });
      break;
    case 'attendance':
      reportData = await getAttendanceReport({
        tenantId: params.tenantId,
        dateFrom: params.filters.dateFrom ?? getDefaultDateFrom(),
        dateTo: params.filters.dateTo ?? getDefaultDateTo(),
        departmentId: params.filters.departmentId,
        teamId: params.filters.teamId,
      });
      break;
    case 'compliance':
      reportData = await getComplianceReport({
        tenantId: params.tenantId,
        dateFrom: params.filters.dateFrom ?? getDefaultDateFrom(),
        dateTo: params.filters.dateTo ?? getDefaultDateTo(),
        departmentId: params.filters.departmentId,
      });
      break;
    default:
      throw new ServiceError('Invalid report type', 'INVALID_REPORT_TYPE', 400);
  }

  // For now, return the data as-is
  // In production, this would generate actual PDF/Excel/CSV files
  switch (params.format) {
    case 'pdf':
      // Would use something like puppeteer or pdfkit
      return Buffer.from(JSON.stringify(reportData, null, 2));
    case 'excel':
      // Would use something like exceljs
      return Buffer.from(JSON.stringify(reportData, null, 2));
    case 'csv':
      // Would convert to CSV format
      return convertToCSV(reportData);
    default:
      throw new ServiceError('Invalid export format', 'INVALID_EXPORT_FORMAT', 400);
  }
}

// Helper functions

/**
 *
 */
function getDefaultDateFrom(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
}

/**
 *
 */
function getDefaultDateTo(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 *
 * @param tenantId - The tenant ID
 * @param _dateFrom - The _dateFrom parameter
 * @param _dateTo - The _dateTo parameter
 */
async function getEmployeeMetrics(tenantId: number, _dateFrom: string, _dateTo: string) {
  const [resultRows] = await executeQuery(
    `
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
      COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_this_month
    FROM users
    WHERE tenant_id = ?
      AND role = 'employee'
  `,
    [tenantId],
  );

  const metrics = (resultRows as Record<string, unknown>[])[0] ?? {};
  return {
    total: Number.parseInt(String(metrics.total)) ?? 0,
    active: Number.parseInt(String(metrics.active)) ?? 0,
    newThisMonth: Number.parseInt(String(metrics.new_this_month)) ?? 0,
  };
}

/**
 *
 * @param tenantId - The tenant ID
 * @param _dateFrom - The _dateFrom parameter
 * @param _dateTo - The _dateTo parameter
 */
async function getDepartmentMetrics(tenantId: number, _dateFrom: string, _dateTo: string) {
  const [deptResultRows] = await executeQuery(
    `
    SELECT 
      COUNT(DISTINCT d.id) as total,
      AVG(emp_count) as avg_employees
    FROM departments d
    LEFT JOIN (
      SELECT department_id, COUNT(*) as emp_count
      FROM users
      WHERE tenant_id = ? AND role = 'employee'
      GROUP BY department_id
    ) e ON e.department_id = d.id
    WHERE d.tenant_id = ?
  `,
    [tenantId, tenantId],
  );

  const metrics = (deptResultRows as Record<string, unknown>[])[0] ?? {};
  return {
    total: Number.parseInt(String(metrics.total)) ?? 0,
    avgEmployeesPerDept: Number.parseFloat(String(metrics.avg_employees)) ?? 0,
  };
}

/**
 *
 * @param tenantId - The tenant ID
 * @param dateFrom - The dateFrom parameter
 * @param dateTo - The dateTo parameter
 */
async function getShiftMetrics(tenantId: number, dateFrom: string, dateTo: string) {
  const [shiftResultRows] = await executeQuery(
    `
    SELECT 
      COUNT(*) as total_scheduled,
      0 as overtime_hours,
      1 as coverage_rate
    FROM shifts
    WHERE tenant_id = ?
      AND date BETWEEN ? AND ?
  `,
    [tenantId, dateFrom, dateTo],
  );

  const metrics = (shiftResultRows as Record<string, unknown>[])[0] ?? {};
  return {
    totalScheduled: Number.parseInt(String(metrics.total_scheduled)) ?? 0,
    overtimeHours: Number.parseFloat(String(metrics.overtime_hours)) ?? 0,
    coverageRate: Number.parseFloat(String(metrics.coverage_rate)) ?? 0,
  };
}

/**
 *
 * @param tenantId - The tenant ID
 * @param dateFrom - The dateFrom parameter
 * @param dateTo - The dateTo parameter
 */
async function getKvpMetrics(tenantId: number, dateFrom: string, dateTo: string) {
  const [kvpResultRows] = await executeQuery(
    `
    SELECT 
      COUNT(*) as total_suggestions,
      COUNT(CASE WHEN status = 'implemented' THEN 1 END) as implemented,
      SUM(CASE WHEN status = 'implemented' THEN actual_savings ELSE 0 END) as total_savings,
      AVG(CASE WHEN status = 'implemented' AND estimated_cost > 0 
          THEN (actual_savings - estimated_cost) / estimated_cost ELSE NULL END) as avg_roi
    FROM kvp_suggestions
    WHERE tenant_id = ?
      AND created_at BETWEEN ? AND ?
  `,
    [tenantId, dateFrom, dateTo],
  );

  const metrics = (kvpResultRows as Record<string, unknown>[])[0] ?? {};
  return {
    totalSuggestions: Number.parseInt(String(metrics.total_suggestions)) ?? 0,
    implemented: Number.parseInt(String(metrics.implemented)) ?? 0,
    totalSavings: Number.parseFloat(String(metrics.total_savings)) ?? 0,
    avgROI: Number.parseFloat(String(metrics.avg_roi)) ?? 0,
  };
}

/**
 *
 * @param tenantId - The tenant ID
 * @param dateFrom - The dateFrom parameter
 * @param dateTo - The dateTo parameter
 */
async function getSurveyMetrics(tenantId: number, dateFrom: string, dateTo: string) {
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
          WHERE tenant_id = ? AND role = 'employee'
        ) as response_rate
      FROM survey_responses
      WHERE started_at BETWEEN ? AND ?
      GROUP BY survey_id
    ) r ON r.survey_id = s.id
    WHERE s.tenant_id = ?
      AND s.status = 'active'
  `,
    [tenantId, dateFrom, dateTo, tenantId],
  );

  const metrics = (surveyResultRows as Record<string, unknown>[])[0] ?? {};
  return {
    active: Number.parseInt(String(metrics.active_surveys)) ?? 0,
    avgResponseRate: Number.parseFloat(String(metrics.avg_response_rate)) ?? 0,
  };
}

/**
 *
 * @param _tenantId - The _tenantId parameter
 * @param _dateFrom - The _dateFrom parameter
 * @param _dateTo - The _dateTo parameter
 * @param _departmentId - The _departmentId parameter
 * @param _teamId - The _teamId parameter
 */
async function getAttendanceMetrics(
  _tenantId: number,
  _dateFrom: string,
  _dateTo: string,
  _departmentId?: number,
  _teamId?: number,
) {
  // Mock implementation for now
  return {
    avgRate: 0.92,
    absences: Math.floor(Math.random() * 50) + 10,
  };
}

/**
 *
 * @param tenantId - The tenant ID
 * @param dateFrom - The dateFrom parameter
 * @param dateTo - The dateTo parameter
 * @param _departmentId - The _departmentId parameter
 * @param _teamId - The _teamId parameter
 */
async function getPerformanceMetrics(
  tenantId: number,
  dateFrom: string,
  dateTo: string,
  _departmentId?: number,
  _teamId?: number,
) {
  // Get KVP participation rate
  const [kvpResultRows] = await executeQuery(
    `
    SELECT 
      COUNT(DISTINCT submitted_by) as participants,
      (SELECT COUNT(*) FROM users WHERE tenant_id = ? AND role = 'employee') as total_employees
    FROM kvp_suggestions
    WHERE tenant_id = ?
      AND created_at BETWEEN ? AND ?
  `,
    [tenantId, tenantId, dateFrom, dateTo],
  );

  const kvpData = (kvpResultRows as Record<string, unknown>[])[0] ?? {};
  const kvpParticipation =
    Number(kvpData.total_employees) > 0 ?
      Number(kvpData.participants) / Number(kvpData.total_employees)
    : 0;

  // Mock shift completion rate for now
  const avgShiftCompletion = 0.88 + Math.random() * 0.1;

  return {
    kvpParticipation,
    avgShiftCompletion,
  };
}

/**
 *
 * @param data - The data object
 */
function convertToCSV(data: Record<string, unknown>): Buffer {
  // Simple CSV conversion for demonstration
  // In production, use a proper CSV library
  const lines = [];
  lines.push('Assixx Report Export');
  lines.push(`Generated: ${String(new Date().toISOString())}`);
  lines.push('');

  // Flatten the data structure and convert to CSV
  const flattenObject = (obj: Record<string, unknown>, prefix = ''): string[] => {
    const rows: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        rows.push(...flattenObject(value as Record<string, unknown>, fullKey));
      } else if (Array.isArray(value)) {
        rows.push(`"${fullKey}","${value.length} items"`);
      } else {
        rows.push(`"${fullKey}","${value}"`);
      }
    }
    return rows;
  };

  lines.push(...flattenObject(data));

  return Buffer.from(lines.join('\n'));
}
