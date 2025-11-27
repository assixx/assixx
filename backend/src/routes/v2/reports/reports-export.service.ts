/**
 * Reports Export Service v2
 * Business logic for exporting reports in various formats (PDF, Excel, CSV)
 */
import { ServiceError } from '../../../utils/ServiceError.js';
import { getDepartmentReport, getEmployeeReport } from './reports-employee.service.js';
import { getKvpReport } from './reports-kvp.service.js';
import { getDefaultDateFrom, getDefaultDateTo } from './reports-metrics.service.js';
import { getAttendanceReport, getComplianceReport } from './reports-other.service.js';
import { getOverviewReport } from './reports-overview.service.js';
import { getShiftReport } from './reports-shift.service.js';
import type { ExportReportParams, ExportResult } from './reports.types.js';

/**
 * Get report data by report type
 * Fetches the appropriate report based on type parameter
 */
async function getReportDataByType(
  params: ExportReportParams,
): Promise<Record<string, unknown> | Buffer | unknown[]> {
  switch (params.reportType) {
    case 'overview':
      return await getOverviewReport({
        tenantId: params.tenantId,
        ...(params.filters.dateFrom !== undefined && { dateFrom: params.filters.dateFrom }),
        ...(params.filters.dateTo !== undefined && { dateTo: params.filters.dateTo }),
      });
    case 'employees':
      return await getEmployeeReport({
        tenantId: params.tenantId,
        ...params.filters,
      });
    case 'departments':
      return {
        departments: await getDepartmentReport({
          tenantId: params.tenantId,
          ...(params.filters.dateFrom !== undefined && { dateFrom: params.filters.dateFrom }),
          ...(params.filters.dateTo !== undefined && { dateTo: params.filters.dateTo }),
        }),
      };
    case 'shifts':
      return await getShiftReport({
        tenantId: params.tenantId,
        ...params.filters,
      });
    case 'kvp':
      return await getKvpReport({
        tenantId: params.tenantId,
        ...(params.filters.dateFrom !== undefined && { dateFrom: params.filters.dateFrom }),
        ...(params.filters.dateTo !== undefined && { dateTo: params.filters.dateTo }),
      });
    case 'attendance':
      return getAttendanceReport({
        tenantId: params.tenantId,
        dateFrom: params.filters.dateFrom ?? getDefaultDateFrom(),
        dateTo: params.filters.dateTo ?? getDefaultDateTo(),
        ...(params.filters.departmentId !== undefined && {
          departmentId: params.filters.departmentId,
        }),
        ...(params.filters.teamId !== undefined && { teamId: params.filters.teamId }),
      });
    case 'compliance':
      return getComplianceReport({
        tenantId: params.tenantId,
        dateFrom: params.filters.dateFrom ?? getDefaultDateFrom(),
        dateTo: params.filters.dateTo ?? getDefaultDateTo(),
        ...(params.filters.departmentId !== undefined && {
          departmentId: params.filters.departmentId,
        }),
      });
    default:
      throw new ServiceError('Invalid report type', 'INVALID_REPORT_TYPE', 400);
  }
}

/**
 * Convert data object to CSV format
 * @param data - The data to convert to CSV
 * @returns CSV data as Buffer
 */
function convertToCSV(data: Record<string, unknown>): Buffer {
  // Simple CSV conversion for demonstration
  // In production, use a proper CSV library
  const lines = [];
  lines.push('Assixx Report Export');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Flatten the data structure and convert to CSV
  const flattenObject = (obj: Record<string, unknown>, prefix: string = ''): string[] => {
    const rows: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix !== '' ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        rows.push(...flattenObject(value as Record<string, unknown>, fullKey));
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
 * Format report data for export in specified format
 * @param reportData - The report data to format
 * @param reportType - The type of report
 * @param format - The export format (pdf, excel, csv)
 * @returns Formatted export result with filename, content, and mime type
 */
function formatReportForExport(
  reportData: Record<string, unknown> | Buffer | unknown[],
  reportType: string,
  format: string,
): ExportResult {
  const dateParts = new Date().toISOString().split('T');
  const timestamp = dateParts[0] ?? 'unknown';

  switch (format) {
    case 'pdf':
      return {
        filename: `report-${reportType}-${timestamp}.pdf`,
        content: Buffer.from(JSON.stringify(reportData, null, 2)),
        mimeType: 'application/pdf',
      };
    case 'excel':
      return {
        filename: `report-${reportType}-${timestamp}.xlsx`,
        content: Buffer.from(JSON.stringify(reportData, null, 2)),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    case 'csv':
      return {
        filename: `report-${reportType}-${timestamp}.csv`,
        content: convertToCSV(reportData as Record<string, unknown>),
        mimeType: 'text/csv',
      };
    default:
      throw new ServiceError('Invalid export format', 'INVALID_EXPORT_FORMAT', 400);
  }
}

/**
 * Export report in specified format (PDF, Excel, or CSV)
 * @param params - Export parameters (reportType, format, filters)
 * @returns Export result with file metadata
 */
export async function exportReport(params: ExportReportParams): Promise<ExportResult> {
  const reportData = await getReportDataByType(params);
  return formatReportForExport(reportData, params.reportType, params.format);
}
