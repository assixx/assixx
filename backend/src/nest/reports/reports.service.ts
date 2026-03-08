/**
 * Reports Service - Native NestJS Implementation
 *
 * Business logic for reporting and analytics.
 * Migrated from Express v2 to native NestJS with DatabaseService.
 *
 * Architecture:
 * - All metrics, overview, shift, kvp, employee, custom, and export
 *   reports consolidated into one service for maintainability.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { dbToApi } from '../../utils/field-mapper.js';
import { DatabaseService } from '../database/database.service.js';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Date range filter for reports
 */
interface DateRangeFilter {
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

/**
 * Extended report filters with organizational context
 */
interface ReportFilters extends DateRangeFilter {
  tenantId: number;
  departmentId?: number | undefined;
  teamId?: number | undefined;
}

/**
 * Parameters for custom report generation
 */
interface CustomReportParams {
  tenantId: number;
  name: string;
  description?: string | undefined;
  metrics: string[];
  dateFrom: string;
  dateTo: string;
  filters?:
    | {
        departmentIds?: number[] | undefined;
        teamIds?: number[] | undefined;
      }
    | undefined;
  groupBy?: string | undefined;
}

/**
 * Parameters for report export (CSV only)
 */
interface ExportReportParams {
  tenantId: number;
  reportType: string;
  format: 'csv';
  filters: {
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
    departmentId?: number | undefined;
    teamId?: number | undefined;
  };
}

/**
 * Employee metrics summary
 */
interface EmployeeMetrics {
  total: number;
  active: number;
  newThisMonth: number;
  departments: number;
  avgPerDepartment: number;
}

/**
 * Department metrics summary
 */
interface DepartmentMetrics {
  total: number;
  avgEmployees: number;
}

/**
 * Shift metrics summary
 */
interface ShiftMetrics {
  totalScheduled: number;
}

/**
 * KVP metrics summary
 */
interface KvpMetrics {
  totalSuggestions: number;
  implemented: number;
  totalSavings: number;
  avgROI: number;
}

/**
 * Survey metrics summary
 */
interface SurveyMetrics {
  totalSurveys: number;
  avgParticipation: number;
}

/**
 * KVP participation rate for the given period
 */
interface KvpParticipationMetrics {
  kvpParticipation: number;
}

/**
 * Department performance data
 */
interface DepartmentPerformanceData {
  departmentId: number;
  departmentName: string;
  metrics: {
    employees: number;
    teams: number;
    kvpSuggestions: number;
  };
}

/**
 * Export result with file metadata
 */
interface ExportResult {
  filename: string;
  content: Buffer | string;
  mimeType: string;
}

// ============================================================
// DATABASE ROW TYPES
// ============================================================

interface DbMetricsRow {
  total?: string | number;
  active?: string | number;
  new_this_month?: string | number;
  department_count?: string | number;
  avg_per_department?: string | number;
  avg_employees?: string | number;
  total_scheduled?: string | number;
  total_suggestions?: string | number;
  implemented?: string | number;
  total_savings?: string | number;
  avg_roi?: string | number;
  active_surveys?: string | number;
  avg_response_rate?: string | number;
  participants?: string | number;
  total_employees?: string | number;
  total_shifts?: string | number;
  total_required?: string | number;
  total_cost?: string | number;
}

interface DbDepartmentRow {
  department_id?: string | number;
  department_name?: string;
  employees?: string | number;
  teams?: string | number;
  kvp_suggestions?: string | number;
}

interface DbHeadcountRow {
  date?: string;
  count?: string | number;
}

interface DbKvpCategoryRow {
  category_id?: string | number;
  category_name?: string;
  suggestions?: string | number;
  implemented?: string | number;
  avg_savings?: string | number;
}

interface DbKvpPerformerRow {
  user_id?: string | number;
  name?: string;
  suggestions?: string | number;
  total_savings?: string | number;
}

interface DbShiftTypeRow {
  shift_type?: string;
  count?: string | number;
}

// ============================================================
// SERVICE IMPLEMENTATION
// ============================================================

@Injectable()
export class ReportsService {
  private readonly logger: Logger = new Logger(ReportsService.name);

  constructor(private readonly db: DatabaseService) {}

  // ============================================================
  // HELPER FUNCTIONS
  // ============================================================

  /**
   * Parse a value as integer, returning 0 for NaN
   */
  private parseIntOrZero(value: unknown): number {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Parse a value as float, returning 0 for NaN
   */
  private parseFloatOrZero(value: unknown): number {
    const parsed = Number.parseFloat(String(value));
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Get default "from" date (30 days ago)
   */
  private getDefaultDateFrom(): string {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    const isoDate = date.toISOString().split('T')[0];
    if (isoDate === undefined) {
      throw new Error('Failed to format date');
    }
    return isoDate;
  }

  /**
   * Get default "to" date (today)
   */
  private getDefaultDateTo(): string {
    const isoDate = new Date().toISOString().split('T')[0];
    if (isoDate === undefined) {
      throw new Error('Failed to format date');
    }
    return isoDate;
  }

  // ============================================================
  // EMPLOYEE METRICS
  // ============================================================

  /**
   * Get employee metrics (current snapshot, not date-filtered)
   */
  private async getEmployeeMetrics(tenantId: number): Promise<EmployeeMetrics> {
    const rows = await this.db.query<DbMetricsRow>(
      `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_this_month,
        (SELECT COUNT(*) FROM departments WHERE tenant_id = $1 AND is_active = ${IS_ACTIVE.ACTIVE}) as department_count,
        CASE
          WHEN (SELECT COUNT(*) FROM departments WHERE tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}) > 0
          THEN COUNT(*) / (SELECT COUNT(*) FROM departments WHERE tenant_id = $3 AND is_active = ${IS_ACTIVE.ACTIVE})
          ELSE 0
        END as avg_per_department
      FROM users
      WHERE tenant_id = $4
        AND role = 'employee'
      `,
      [tenantId, tenantId, tenantId, tenantId],
    );

    const metrics = rows[0] ?? {};
    return {
      total: this.parseIntOrZero(metrics.total),
      active: this.parseIntOrZero(metrics.active),
      newThisMonth: this.parseIntOrZero(metrics.new_this_month),
      departments: this.parseIntOrZero(metrics.department_count),
      avgPerDepartment: this.parseFloatOrZero(metrics.avg_per_department),
    };
  }

  // ============================================================
  // DEPARTMENT METRICS
  // ============================================================

  /**
   * Get department metrics (current snapshot, not date-filtered)
   */
  private async getDepartmentMetrics(
    tenantId: number,
  ): Promise<DepartmentMetrics> {
    const rows = await this.db.query<DbMetricsRow>(
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

    const metrics = rows[0] ?? {};
    return {
      total: this.parseIntOrZero(metrics.total),
      avgEmployees: this.parseFloatOrZero(metrics.avg_employees),
    };
  }

  // ============================================================
  // SHIFT METRICS
  // ============================================================

  /**
   * Get shift metrics for the given period
   */
  private async getShiftMetrics(
    tenantId: number,
    dateFrom: string,
    dateTo: string,
  ): Promise<ShiftMetrics> {
    const rows = await this.db.query<DbMetricsRow>(
      `
      SELECT
        COUNT(*) as total_scheduled
      FROM shifts
      WHERE tenant_id = $1
        AND date BETWEEN $2 AND $3
      `,
      [tenantId, dateFrom, dateTo],
    );

    const metrics = rows[0] ?? {};
    return {
      totalScheduled: this.parseIntOrZero(metrics.total_scheduled),
    };
  }

  // ============================================================
  // KVP METRICS
  // ============================================================

  /**
   * Get KVP metrics for the given period
   */
  private async getKvpMetrics(
    tenantId: number,
    dateFrom: string,
    dateTo: string,
  ): Promise<KvpMetrics> {
    const rows = await this.db.query<DbMetricsRow>(
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

    const metrics = rows[0] ?? {};
    return {
      totalSuggestions: this.parseIntOrZero(metrics.total_suggestions),
      implemented: this.parseIntOrZero(metrics.implemented),
      totalSavings: this.parseFloatOrZero(metrics.total_savings),
      avgROI: this.parseFloatOrZero(metrics.avg_roi),
    };
  }

  // ============================================================
  // SURVEY METRICS
  // ============================================================

  /**
   * Get survey metrics for the given period
   */
  private async getSurveyMetrics(
    tenantId: number,
    dateFrom: string,
    dateTo: string,
  ): Promise<SurveyMetrics> {
    const rows = await this.db.query<DbMetricsRow>(
      `
      SELECT
        COUNT(DISTINCT s.id) as active_surveys,
        AVG(response_rate) as avg_response_rate
      FROM surveys s
      LEFT JOIN (
        SELECT
          survey_id,
          COUNT(DISTINCT user_id) / (
            -- SECURITY: Only count ACTIVE employees (is_active = ${IS_ACTIVE.ACTIVE})
            SELECT COUNT(*) FROM users
            WHERE tenant_id = $1 AND role = 'employee' AND is_active = ${IS_ACTIVE.ACTIVE}
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

    const metrics = rows[0] ?? {};
    return {
      totalSurveys: this.parseIntOrZero(metrics.active_surveys),
      avgParticipation: this.parseFloatOrZero(metrics.avg_response_rate),
    };
  }

  // ============================================================
  // KVP PARTICIPATION METRICS
  // ============================================================

  /**
   * Get KVP participation rate for the given period
   */
  private async getKvpParticipationMetrics(
    tenantId: number,
    dateFrom: string,
    dateTo: string,
  ): Promise<KvpParticipationMetrics> {
    // SECURITY: Only count ACTIVE employees (is_active = 1)
    const rows = await this.db.query<DbMetricsRow>(
      `
      SELECT
        COUNT(DISTINCT submitted_by) as participants,
        (SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND role = 'employee' AND is_active = ${IS_ACTIVE.ACTIVE}) as total_employees
      FROM kvp_suggestions
      WHERE tenant_id = $2
        AND created_at BETWEEN $3 AND $4
      `,
      [tenantId, tenantId, dateFrom, dateTo],
    );

    const kvpData = rows[0] ?? {};
    const kvpParticipation =
      Number(kvpData.total_employees) > 0 ?
        Number(kvpData.participants) / Number(kvpData.total_employees)
      : 0;

    return { kvpParticipation };
  }

  // ============================================================
  // OVERVIEW REPORT
  // ============================================================

  /**
   * Get company overview report with all KPIs aggregated
   */
  async getOverviewReport(
    tenantId: number,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<unknown> {
    this.logger.debug(`Getting overview report for tenant ${tenantId}`);

    const from = dateFrom ?? this.getDefaultDateFrom();
    const to = dateTo ?? this.getDefaultDateTo();

    const [
      employeeMetrics,
      departmentMetrics,
      shiftMetrics,
      kvpMetrics,
      surveyMetrics,
    ] = await Promise.all([
      this.getEmployeeMetrics(tenantId),
      this.getDepartmentMetrics(tenantId),
      this.getShiftMetrics(tenantId, from, to),
      this.getKvpMetrics(tenantId, from, to),
      this.getSurveyMetrics(tenantId, from, to),
    ]);

    return {
      period: { from, to },
      employees: employeeMetrics,
      departments: departmentMetrics,
      shifts: shiftMetrics,
      kvp: kvpMetrics,
      surveys: surveyMetrics,
    };
  }

  // ============================================================
  // EMPLOYEE REPORT
  // ============================================================

  /**
   * Get detailed employee report with headcount and KVP participation
   */
  async getEmployeeReport(
    tenantId: number,
    dateFrom?: string,
    dateTo?: string,
    departmentId?: number,
    teamId?: number,
  ): Promise<unknown> {
    this.logger.debug(`Getting employee report for tenant ${tenantId}`);

    const from = dateFrom ?? this.getDefaultDateFrom();
    const to = dateTo ?? this.getDefaultDateTo();

    const [headcountTrend, kvpParticipation] = await Promise.all([
      this.db.query<DbHeadcountRow>(
        `
        SELECT
          DATE(created_at) as date,
          COUNT(*) as count
        FROM users
        WHERE tenant_id = $1
          AND role = 'employee'
          AND created_at BETWEEN $2 AND $3
        GROUP BY DATE(created_at)
        ORDER BY date
        `,
        [tenantId, from, to],
      ),
      this.getKvpParticipationMetrics(tenantId, from, to),
    ]);

    return {
      period: { from, to },
      filters: { departmentId, teamId },
      headcount: {
        trend: headcountTrend.map((row: DbHeadcountRow) =>
          dbToApi(row as Record<string, unknown>),
        ),
      },
      performance: kvpParticipation,
    };
  }

  // ============================================================
  // DEPARTMENT REPORT
  // ============================================================

  /**
   * Get department performance report
   */
  async getDepartmentReport(
    tenantId: number,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<unknown> {
    this.logger.debug(`Getting department report for tenant ${tenantId}`);

    const from = dateFrom ?? this.getDefaultDateFrom();
    const to = dateTo ?? this.getDefaultDateTo();

    const rows = await this.db.query<DbDepartmentRow>(
      `
      SELECT
        d.id as department_id,
        d.name as department_name,
        COUNT(DISTINCT ud.user_id) as employees,
        COUNT(DISTINCT t.id) as teams,
        COUNT(DISTINCT k.id) as kvp_suggestions
      FROM departments d
      LEFT JOIN user_departments ud ON ud.department_id = d.id AND ud.tenant_id = d.tenant_id
      LEFT JOIN users u ON ud.user_id = u.id AND u.is_active = ${IS_ACTIVE.ACTIVE}
      LEFT JOIN teams t ON t.department_id = d.id
      LEFT JOIN kvp_suggestions k ON k.org_id = d.id
        AND k.org_level = 'department'
        AND k.created_at BETWEEN $1 AND $2
      WHERE d.tenant_id = $3
      GROUP BY d.id, d.name
      ORDER BY d.name
      `,
      [from, to, tenantId],
    );

    const result: DepartmentPerformanceData[] = rows.map(
      (dept: DbDepartmentRow) => ({
        departmentId: Number(dept.department_id),
        departmentName: String(dept.department_name),
        metrics: {
          employees: this.parseIntOrZero(dept.employees),
          teams: this.parseIntOrZero(dept.teams),
          kvpSuggestions: this.parseIntOrZero(dept.kvp_suggestions),
        },
      }),
    );

    return { departments: result };
  }

  // ============================================================
  // SHIFT REPORT
  // ============================================================

  /**
   * Build shift query conditions from filters
   */
  private buildShiftQueryConditions(filters: ReportFilters): {
    conditions: string[];
    params: (string | number)[];
  } {
    let paramIndex = 1;
    const conditions = [`s.tenant_id = $${paramIndex++}`];
    const params: (string | number)[] = [filters.tenantId];

    const dateFrom = filters.dateFrom ?? this.getDefaultDateFrom();
    const dateTo = filters.dateTo ?? this.getDefaultDateTo();

    conditions.push(`s.date BETWEEN $${paramIndex++} AND $${paramIndex++}`);
    params.push(dateFrom, dateTo);

    if (filters.departmentId !== undefined) {
      conditions.push(`s.department_id = $${paramIndex++}`);
      params.push(filters.departmentId);
    }

    if (filters.teamId !== undefined) {
      // eslint-disable-next-line no-useless-assignment -- paramIndex++ kept for consistency so adding a new filter won't reuse the same index
      conditions.push(`s.team_id = $${paramIndex++}`);
      params.push(filters.teamId);
    }

    return { conditions, params };
  }

  /**
   * Get shift analytics report with schedule and type breakdown
   */
  async getShiftReport(
    tenantId: number,
    dateFrom?: string,
    dateTo?: string,
    departmentId?: number,
    teamId?: number,
  ): Promise<unknown> {
    this.logger.debug(`Getting shift report for tenant ${tenantId}`);

    const from = dateFrom ?? this.getDefaultDateFrom();
    const to = dateTo ?? this.getDefaultDateTo();

    const filters: ReportFilters = {
      tenantId,
      dateFrom: from,
      dateTo: to,
      departmentId,
      teamId,
    };

    const [summary, shiftsByType] = await Promise.all([
      this.getShiftSummary(filters),
      this.getShiftsByType(tenantId, from, to),
    ]);

    return {
      period: { from, to },
      totalShifts: this.parseIntOrZero(summary.total_shifts),
      totalRequired: this.parseIntOrZero(summary.total_required),
      shiftsByType: shiftsByType.map((row: DbShiftTypeRow) =>
        dbToApi(row as Record<string, unknown>),
      ),
    };
  }

  /**
   * Get shift summary metrics
   */
  private async getShiftSummary(filters: ReportFilters): Promise<DbMetricsRow> {
    const { conditions, params } = this.buildShiftQueryConditions(filters);
    const rows = await this.db.query<DbMetricsRow>(
      `
      SELECT
        COUNT(*) as total_shifts,
        SUM(required_employees) as total_required
      FROM shifts s
      WHERE ${conditions.join(' AND ')}
      `,
      params,
    );
    return rows[0] ?? ({} as DbMetricsRow);
  }

  /**
   * Get shift counts grouped by type
   */
  private async getShiftsByType(
    tenantId: number,
    from: string,
    to: string,
  ): Promise<DbShiftTypeRow[]> {
    return await this.db.query<DbShiftTypeRow>(
      `
      SELECT
        type as shift_type,
        COUNT(*) as count
      FROM shifts
      WHERE tenant_id = $1
        AND date BETWEEN $2 AND $3
      GROUP BY type
      ORDER BY count DESC
      `,
      [tenantId, from, to],
    );
  }

  // ============================================================
  // KVP REPORT
  // ============================================================

  /**
   * Get KVP ROI report with category breakdown and top performers
   */
  async getKvpReport(
    tenantId: number,
    dateFrom?: string,
    dateTo?: string,
    categoryId?: number,
  ): Promise<unknown> {
    this.logger.debug(`Getting KVP report for tenant ${tenantId}`);

    const from = dateFrom ?? this.getDefaultDateFrom();
    const to = dateTo ?? this.getDefaultDateTo();

    const summary = await this.getKvpSummary(tenantId, from, to, categoryId);
    const byCategory = await this.getKvpByCategory(tenantId, from, to);
    const topPerformers = await this.getKvpTopPerformers(tenantId, from, to);

    const totalCost = Number(summary.total_cost);
    const totalSavings = Number(summary.total_savings);
    const roi = totalCost > 0 ? (totalSavings - totalCost) / totalCost : 0;

    return {
      period: { from, to },
      summary: {
        totalSuggestions: this.parseIntOrZero(summary.total_suggestions),
        implemented: this.parseIntOrZero(summary.implemented),
        totalCost: this.parseFloatOrZero(summary.total_cost),
        totalSavings: this.parseFloatOrZero(summary.total_savings),
        roi,
      },
      byCategory: byCategory.map((row: DbKvpCategoryRow) =>
        dbToApi(row as Record<string, unknown>),
      ),
      topPerformers: topPerformers.map((row: DbKvpPerformerRow) =>
        dbToApi(row as Record<string, unknown>),
      ),
    };
  }

  /**
   * Get KVP summary metrics
   */
  private async getKvpSummary(
    tenantId: number,
    from: string,
    to: string,
    categoryId?: number,
  ): Promise<DbMetricsRow> {
    let paramIndex = 1;
    const conditions = [`k.tenant_id = $${paramIndex++}`];
    const params: (string | number)[] = [tenantId];

    conditions.push(
      `k.created_at BETWEEN $${paramIndex++} AND $${paramIndex++}`,
    );
    params.push(from, to);

    if (categoryId !== undefined && categoryId > 0) {
      // eslint-disable-next-line no-useless-assignment -- paramIndex++ kept for consistency so adding a new filter won't reuse the same index
      conditions.push(`k.category_id = $${paramIndex++}`);
      params.push(categoryId);
    }

    const rows = await this.db.query<DbMetricsRow>(
      `
      SELECT
        COUNT(*) as total_suggestions,
        COUNT(CASE WHEN status = 'implemented' THEN 1 END) as implemented,
        SUM(CASE WHEN status = 'implemented' THEN estimated_cost ELSE 0 END) as total_cost,
        SUM(CASE WHEN status = 'implemented' THEN actual_savings ELSE 0 END) as total_savings
      FROM kvp_suggestions k
      WHERE ${conditions.join(' AND ')}
      `,
      params,
    );
    return rows[0] ?? ({} as DbMetricsRow);
  }

  /**
   * Get KVP suggestions grouped by category
   */
  private async getKvpByCategory(
    tenantId: number,
    from: string,
    to: string,
  ): Promise<DbKvpCategoryRow[]> {
    return await this.db.query<DbKvpCategoryRow>(
      `
      SELECT
        c.id as category_id,
        c.name as category_name,
        COUNT(k.id) as suggestions,
        COUNT(CASE WHEN k.status = 'implemented' THEN 1 END) as implemented,
        AVG(CASE WHEN k.status = 'implemented' THEN k.actual_savings ELSE NULL END) as avg_savings
      FROM global.kvp_categories c
      LEFT JOIN kvp_suggestions k ON k.category_id = c.id
        AND k.tenant_id = $1
        AND k.created_at BETWEEN $2 AND $3
      GROUP BY c.id, c.name
      ORDER BY suggestions DESC
      `,
      [tenantId, from, to],
    );
  }

  /**
   * Get top KVP performers
   */
  private async getKvpTopPerformers(
    tenantId: number,
    from: string,
    to: string,
  ): Promise<DbKvpPerformerRow[]> {
    return await this.db.query<DbKvpPerformerRow>(
      `
      SELECT
        u.id as user_id,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        COUNT(k.id) as suggestions,
        SUM(CASE WHEN k.status = 'implemented' THEN k.actual_savings ELSE 0 END) as total_savings
      FROM users u
      JOIN kvp_suggestions k ON k.submitted_by = u.id
      WHERE k.tenant_id = $1
        AND k.created_at BETWEEN $2 AND $3
      GROUP BY u.id, u.first_name, u.last_name
      HAVING COUNT(k.id) > 0
      ORDER BY SUM(CASE WHEN k.status = 'implemented' THEN k.actual_savings ELSE 0 END) DESC
      LIMIT 10
      `,
      [tenantId, from, to],
    );
  }

  // ============================================================
  // CUSTOM REPORT
  // ============================================================

  /**
   * Generate custom report with user-selected metrics
   */
  async generateCustomReport(params: CustomReportParams): Promise<unknown> {
    this.logger.log(`Generating custom report for tenant ${params.tenantId}`);

    const reportId = `RPT-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const data: Record<string, unknown> = {};

    for (const metric of params.metrics) {
      switch (metric) {
        case 'employees':
          data['employees'] = await this.getEmployeeMetrics(params.tenantId);
          break;
        case 'departments':
          data['departments'] = await this.getDepartmentReport(
            params.tenantId,
            params.dateFrom,
            params.dateTo,
          );
          break;
        case 'shifts':
          data['shifts'] = await this.getShiftMetrics(
            params.tenantId,
            params.dateFrom,
            params.dateTo,
          );
          break;
        case 'kvp':
          data['kvp'] = await this.getKvpMetrics(
            params.tenantId,
            params.dateFrom,
            params.dateTo,
          );
          break;
      }
    }

    return {
      reportId,
      name: params.name,
      description: params.description,
      generatedAt: new Date().toISOString(),
      period: { from: params.dateFrom, to: params.dateTo },
      metrics: params.metrics,
      data,
    };
  }

  // ============================================================
  // EXPORT REPORT (CSV)
  // ============================================================

  /**
   * Get report data by report type
   */
  private async getReportDataByType(
    params: ExportReportParams,
  ): Promise<Record<string, unknown>> {
    const dateFrom = params.filters.dateFrom ?? this.getDefaultDateFrom();
    const dateTo = params.filters.dateTo ?? this.getDefaultDateTo();
    const { tenantId, filters } = params;

    return await this.executeReportHandler(
      params.reportType,
      tenantId,
      dateFrom,
      dateTo,
      filters.departmentId,
      filters.teamId,
    );
  }

  /** Execute the appropriate report handler based on type */
  private async executeReportHandler(
    type: string,
    tid: number,
    from: string,
    to: string,
    deptId?: number,
    teamId?: number,
  ): Promise<Record<string, unknown>> {
    switch (type) {
      case 'overview':
        return (await this.getOverviewReport(tid, from, to)) as Record<
          string,
          unknown
        >;
      case 'employees':
        return (await this.getEmployeeReport(
          tid,
          from,
          to,
          deptId,
          teamId,
        )) as Record<string, unknown>;
      case 'departments':
        return { departments: await this.getDepartmentReport(tid, from, to) };
      case 'shifts':
        return (await this.getShiftReport(
          tid,
          from,
          to,
          deptId,
          teamId,
        )) as Record<string, unknown>;
      case 'kvp':
        return (await this.getKvpReport(tid, from, to)) as Record<
          string,
          unknown
        >;
      default:
        throw new BadRequestException('Invalid report type');
    }
  }

  /**
   * Convert data object to CSV format
   */
  private convertToCSV(data: Record<string, unknown>): Buffer {
    const lines: string[] = [];
    lines.push('Assixx Report Export');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');

    const flattenObject = (
      obj: Record<string, unknown>,
      prefix: string = '',
    ): string[] => {
      const rows: string[] = [];
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix !== '' ? `${prefix}.${key}` : key;
        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value)
        ) {
          rows.push(
            ...flattenObject(value as Record<string, unknown>, fullKey),
          );
        } else if (Array.isArray(value)) {
          rows.push(`"${fullKey}","${value.length} items"`);
        } else {
          rows.push(`"${fullKey}","${String(value)}"`);
        }
      }
      return rows;
    };

    lines.push(...flattenObject(data));
    return Buffer.from(lines.join('\n'));
  }

  /**
   * Export report as CSV
   */
  async exportReport(params: ExportReportParams): Promise<ExportResult> {
    this.logger.log(`Exporting ${params.reportType} report as CSV`);
    const reportData = await this.getReportDataByType(params);

    const dateParts = new Date().toISOString().split('T');
    const timestamp = dateParts[0] ?? 'unknown';

    return {
      filename: `report-${params.reportType}-${timestamp}.csv`,
      content: this.convertToCSV(reportData),
      mimeType: 'text/csv',
    };
  }
}
