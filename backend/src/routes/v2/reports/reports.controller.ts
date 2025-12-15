/**
 * Reports/Analytics v2 Controller
 * Handles HTTP requests for reporting and analytics
 */
import { Response } from 'express';

import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { errorResponse, successResponse } from '../../../utils/apiResponse.js';
import * as reportsService from './reports.service.js';

const INTERNAL_ERROR_MESSAGE = 'An unexpected error occurred';
const HTTP_STATUS_INTERNAL_ERROR = 500;

/**
 * Get company overview report with high-level KPIs
 * @param req - The request object
 * @param res - The response object
 */
export const getOverviewReport = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { dateFrom, dateTo } = req.query;

    const params: { tenantId: number; dateFrom?: string; dateTo?: string } = {
      tenantId: req.user.tenant_id,
    };
    if (dateFrom !== undefined) params.dateFrom = dateFrom as string;
    if (dateTo !== undefined) params.dateTo = dateTo as string;

    const report = await reportsService.getOverviewReport(params);

    res.json(successResponse(report, 'Overview report retrieved successfully'));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(HTTP_STATUS_INTERNAL_ERROR)
        .json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    }
  }
};

/**
 * Get detailed employee analytics report
 * @param req - The request object
 * @param res - The response object
 */
export const getEmployeeReport = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { dateFrom, dateTo, departmentId, teamId } = req.query;

    const params: {
      tenantId: number;
      dateFrom?: string;
      dateTo?: string;
      departmentId?: number;
      teamId?: number;
    } = {
      tenantId: req.user.tenant_id,
    };
    if (dateFrom !== undefined) params.dateFrom = dateFrom as string;
    if (dateTo !== undefined) params.dateTo = dateTo as string;
    if (departmentId !== undefined) params.departmentId = Number.parseInt(departmentId as string);
    if (teamId !== undefined) params.teamId = Number.parseInt(teamId as string);

    const report = await reportsService.getEmployeeReport(params);

    res.json(successResponse(report, 'Employee report retrieved successfully'));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(HTTP_STATUS_INTERNAL_ERROR)
        .json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    }
  }
};

/**
 * Get department performance analytics
 * @param req - The request object
 * @param res - The response object
 */
export const getDepartmentReport = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { dateFrom, dateTo } = req.query;

    const params: { tenantId: number; dateFrom?: string; dateTo?: string } = {
      tenantId: req.user.tenant_id,
    };
    if (dateFrom !== undefined) params.dateFrom = dateFrom as string;
    if (dateTo !== undefined) params.dateTo = dateTo as string;

    const report = await reportsService.getDepartmentReport(params);

    res.json(successResponse(report, 'Department report retrieved successfully'));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(HTTP_STATUS_INTERNAL_ERROR)
        .json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    }
  }
};

/**
 * Get shift coverage and overtime analytics
 * @param req - The request object
 * @param res - The response object
 */
export const getShiftReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { dateFrom, dateTo, departmentId, teamId } = req.query;

    const params: {
      tenantId: number;
      dateFrom?: string;
      dateTo?: string;
      departmentId?: number;
      teamId?: number;
    } = {
      tenantId: req.user.tenant_id,
    };
    if (dateFrom !== undefined) params.dateFrom = dateFrom as string;
    if (dateTo !== undefined) params.dateTo = dateTo as string;
    if (departmentId !== undefined) params.departmentId = Number.parseInt(departmentId as string);
    if (teamId !== undefined) params.teamId = Number.parseInt(teamId as string);

    const report = await reportsService.getShiftReport(params);

    res.json(successResponse(report, 'Shift report retrieved successfully'));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(HTTP_STATUS_INTERNAL_ERROR)
        .json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    }
  }
};

/**
 * Get KVP ROI and performance report
 * @param req - The request object
 * @param res - The response object
 */
export const getKvpReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { dateFrom, dateTo, categoryId } = req.query;

    const params: { tenantId: number; dateFrom?: string; dateTo?: string; categoryId?: number } = {
      tenantId: req.user.tenant_id,
    };
    if (dateFrom !== undefined) params.dateFrom = dateFrom as string;
    if (dateTo !== undefined) params.dateTo = dateTo as string;
    if (categoryId !== undefined) params.categoryId = Number.parseInt(categoryId as string);

    const report = await reportsService.getKvpReport(params);

    res.json(successResponse(report, 'KVP report retrieved successfully'));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(HTTP_STATUS_INTERNAL_ERROR)
        .json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    }
  }
};

/**
 * Get attendance and absence report
 * @param req - The request object
 * @param res - The response object
 */
export const getAttendanceReport = (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { dateFrom, dateTo, departmentId, teamId } = req.query;

    const params: {
      tenantId: number;
      dateFrom: string;
      dateTo: string;
      departmentId?: number;
      teamId?: number;
    } = {
      tenantId: req.user.tenant_id,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
    };
    if (departmentId !== undefined) params.departmentId = Number.parseInt(departmentId as string);
    if (teamId !== undefined) params.teamId = Number.parseInt(teamId as string);

    const report = reportsService.getAttendanceReport(params);

    res.json(successResponse(report, 'Attendance report retrieved successfully'));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(HTTP_STATUS_INTERNAL_ERROR)
        .json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    }
  }
};

/**
 * Get labor law compliance report
 * @param req - The request object
 * @param res - The response object
 */
export const getComplianceReport = (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { dateFrom, dateTo, departmentId } = req.query;

    const params: { tenantId: number; dateFrom: string; dateTo: string; departmentId?: number } = {
      tenantId: req.user.tenant_id,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
    };
    if (departmentId !== undefined) params.departmentId = Number.parseInt(departmentId as string);

    const report = reportsService.getComplianceReport(params);

    res.json(successResponse(report, 'Compliance report retrieved successfully'));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(HTTP_STATUS_INTERNAL_ERROR)
        .json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    }
  }
};

/**
 * Generate a custom report with selected metrics
 */
interface CustomReportBody {
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

export const generateCustomReport = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { name, description, metrics, dateFrom, dateTo, filters, groupBy } =
      req.body as CustomReportBody;

    const params: {
      tenantId: number;
      name: string;
      description?: string;
      metrics: string[];
      dateFrom: string;
      dateTo: string;
      filters?: { departmentIds?: number[]; teamIds?: number[] };
      groupBy?: string;
    } = {
      tenantId: req.user.tenant_id,
      name,
      metrics,
      dateFrom,
      dateTo,
    };
    if (description !== undefined) params.description = description;
    if (filters !== undefined) params.filters = filters;
    if (groupBy !== undefined) params.groupBy = groupBy;

    const report = await reportsService.generateCustomReport(params);

    res.status(201).json(successResponse(report, 'Custom report generated successfully'));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(HTTP_STATUS_INTERNAL_ERROR)
        .json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    }
  }
};

// Export format types and mappings
const VALID_FORMATS = ['pdf', 'excel', 'csv'] as const;
type ExportFormat = (typeof VALID_FORMATS)[number];

const CONTENT_TYPES: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};

const EXTENSIONS: Record<ExportFormat, string> = {
  pdf: 'pdf',
  excel: 'xlsx',
  csv: 'csv',
};

/**
 * Parse and validate export format from query param
 */
function parseExportFormat(formatParam: unknown): ExportFormat {
  if (typeof formatParam !== 'string') return 'pdf';
  return VALID_FORMATS.includes(formatParam as ExportFormat) ?
      (formatParam as ExportFormat)
    : 'pdf';
}

/**
 * Parse export filters from query params
 */
function parseExportFilters(filters: Record<string, unknown>): {
  dateFrom?: string;
  dateTo?: string;
  departmentId?: number;
  teamId?: number;
} {
  const result: { dateFrom?: string; dateTo?: string; departmentId?: number; teamId?: number } = {};
  if (filters['dateFrom'] !== undefined) result.dateFrom = filters['dateFrom'] as string;
  if (filters['dateTo'] !== undefined) result.dateTo = filters['dateTo'] as string;
  if (filters['departmentId'] !== undefined)
    result.departmentId = Number.parseInt(filters['departmentId'] as string);
  if (filters['teamId'] !== undefined) result.teamId = Number.parseInt(filters['teamId'] as string);
  return result;
}

/**
 * Set response headers for file export
 */
function setExportHeaders(res: Response, format: ExportFormat, type: string): void {
  const dateStr = new Date().toISOString().split('T')[0] ?? 'unknown';
  // eslint-disable-next-line security/detect-object-injection -- format is validated against VALID_FORMATS enum
  res.setHeader('Content-Type', CONTENT_TYPES[format]);

  // eslint-disable-next-line security/detect-object-injection -- format is validated against VALID_FORMATS enum
  const ext = EXTENSIONS[format];
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="assixx-${type}-report-${dateStr}.${ext}"`,
  );
}

/**
 * Export report in various formats (PDF, Excel, CSV)
 */
export const exportReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { type } = req.params;
    const { format: formatParam, ...filters } = req.query;

    if (type === undefined) {
      res.status(400).json(errorResponse('MISSING_PARAMETER', 'Report type is required'));
      return;
    }

    const format = parseExportFormat(formatParam);
    const exportFilters = parseExportFilters(filters as Record<string, unknown>);

    const exportData = await reportsService.exportReport({
      tenantId: req.user.tenant_id,
      reportType: type,
      format,
      filters: exportFilters,
    });

    setExportHeaders(res, format, type);
    res.send(exportData);
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(HTTP_STATUS_INTERNAL_ERROR)
        .json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    }
  }
};
