/**
 * Reports Overview Service v2
 * Business logic for company-wide overview report (aggregates all metrics)
 * Separated from main service to avoid circular dependencies
 */
import { log, error as logError } from 'console';

import {
  getDefaultDateFrom,
  getDefaultDateTo,
  getDepartmentMetrics,
  getEmployeeMetrics,
  getKvpMetrics,
  getShiftMetrics,
  getSurveyMetrics,
} from './reports-metrics.service.js';

/**
 * Get company overview report with all KPIs aggregated
 * This is the main dashboard report combining all metrics
 * @param filters - Filter criteria containing tenantId, dateFrom, and dateTo
 * @returns Comprehensive overview with all key metrics
 */
export async function getOverviewReport(filters: {
  tenantId: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<Record<string, unknown>> {
  try {
    log('[Reports Service] getOverviewReport called with:', filters);

    const dateFrom = filters.dateFrom ?? getDefaultDateFrom();
    const dateTo = filters.dateTo ?? getDefaultDateTo();

    // Get all metrics in parallel for performance
    log('[Reports Service] Fetching all metrics in parallel...');
    const [employeeMetrics, departmentMetrics, shiftMetrics, kvpMetrics, surveyMetrics] =
      await Promise.all([
        getEmployeeMetrics(filters.tenantId, dateFrom, dateTo),
        getDepartmentMetrics(filters.tenantId, dateFrom, dateTo),
        getShiftMetrics(filters.tenantId, dateFrom, dateTo),
        getKvpMetrics(filters.tenantId, dateFrom, dateTo),
        getSurveyMetrics(filters.tenantId, dateFrom, dateTo),
      ]);

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
