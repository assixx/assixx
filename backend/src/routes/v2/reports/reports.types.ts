/**
 * Reports Domain Types v2
 * All type definitions and interfaces for reporting features
 * Extracted from reports.service.ts for better maintainability
 */

// ============================================================
// FILTER TYPES
// ============================================================

/**
 * Date range filter for reports
 */
export interface DateRangeFilter {
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Extended report filters with organizational context
 */
export interface ReportFilters extends DateRangeFilter {
  tenantId: number;
  departmentId?: number;
  teamId?: number;
  categoryId?: number;
}

/**
 * Parameters for custom report generation
 */
export interface CustomReportParams {
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
 * Parameters for report export
 */
export interface ExportReportParams {
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

// ============================================================
// METRIC TYPES
// ============================================================

/**
 * Employee metrics summary
 */
export interface EmployeeMetrics {
  total: number;
  active: number;
  newThisMonth: number;
  departments: number;
  avgPerDepartment: number;
}

/**
 * Department metrics summary
 */
export interface DepartmentMetrics {
  total: number;
  avgEmployees: number;
}

/**
 * Shift metrics summary
 */
export interface ShiftMetrics {
  totalScheduled: number;
  overtimeHours: number;
  coverageRate: number;
}

/**
 * KVP metrics summary
 */
export interface KvpMetrics {
  totalSuggestions: number;
  implemented: number;
  totalSavings: number;
  avgROI: number;
}

/**
 * Survey metrics summary
 */
export interface SurveyMetrics {
  totalSurveys: number;
  completedSurveys: number;
  avgParticipation: number;
  avgSatisfaction: number;
}

/**
 * Attendance metrics summary
 */
export interface AttendanceMetrics {
  avgRate: number;
  absences: number;
}

/**
 * Performance metrics summary
 */
export interface PerformanceMetrics {
  kvpParticipation: number;
  surveyCompletion: number;
  overallScore: number;
}

// ============================================================
// REPORT RESPONSE TYPES
// ============================================================

/**
 * Period information in reports
 */
export interface ReportPeriod {
  from: string;
  to: string;
}

/**
 * Department performance data
 */
export interface DepartmentPerformanceData {
  departmentId: number;
  departmentName: string;
  metrics: {
    employees: number;
    teams: number;
    kvpSuggestions: number;
    shiftCoverage: number;
    avgOvertime: number;
  };
}

/**
 * Export result with file metadata
 */
export interface ExportResult {
  filename: string;
  content: Buffer | string;
  mimeType: string;
}
