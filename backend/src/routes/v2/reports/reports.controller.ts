/**
 * Reports/Analytics v2 Controller
 * Handles HTTP requests for reporting and analytics
 */

import { Response } from "express";

import { AuthenticatedRequest } from "../../../types/request.types.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { ServiceError } from "../../../utils/ServiceError.js";

import * as reportsService from "./reports.service.js";

/**
 * Get company overview report with high-level KPIs
 */
export const getOverviewReport = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }
    const { dateFrom, dateTo } = req.query;

    const report = await reportsService.getOverviewReport({
      tenantId: req.user.tenant_id,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
    });

    res.json(successResponse(report, "Overview report retrieved successfully"));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Get detailed employee analytics report
 */
export const getEmployeeReport = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }
    const { dateFrom, dateTo, departmentId, teamId } = req.query;

    const report = await reportsService.getEmployeeReport({
      tenantId: req.user.tenant_id,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      departmentId: departmentId ? parseInt(departmentId as string) : undefined,
      teamId: teamId ? parseInt(teamId as string) : undefined,
    });

    res.json(successResponse(report, "Employee report retrieved successfully"));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Get department performance analytics
 */
export const getDepartmentReport = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }
    const { dateFrom, dateTo } = req.query;

    const report = await reportsService.getDepartmentReport({
      tenantId: req.user.tenant_id,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
    });

    res.json(
      successResponse(report, "Department report retrieved successfully"),
    );
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Get shift coverage and overtime analytics
 */
export const getShiftReport = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }
    const { dateFrom, dateTo, departmentId, teamId } = req.query;

    const report = await reportsService.getShiftReport({
      tenantId: req.user.tenant_id,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      departmentId: departmentId ? parseInt(departmentId as string) : undefined,
      teamId: teamId ? parseInt(teamId as string) : undefined,
    });

    res.json(successResponse(report, "Shift report retrieved successfully"));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Get KVP ROI and performance report
 */
export const getKvpReport = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }
    const { dateFrom, dateTo, categoryId } = req.query;

    const report = await reportsService.getKvpReport({
      tenantId: req.user.tenant_id,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      categoryId: categoryId ? parseInt(categoryId as string) : undefined,
    });

    res.json(successResponse(report, "KVP report retrieved successfully"));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Get attendance and absence report
 */
export const getAttendanceReport = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }
    const { dateFrom, dateTo, departmentId, teamId } = req.query;

    const report = await reportsService.getAttendanceReport({
      tenantId: req.user.tenant_id,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      departmentId: departmentId ? parseInt(departmentId as string) : undefined,
      teamId: teamId ? parseInt(teamId as string) : undefined,
    });

    res.json(
      successResponse(report, "Attendance report retrieved successfully"),
    );
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Get labor law compliance report
 */
export const getComplianceReport = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }
    const { dateFrom, dateTo, departmentId } = req.query;

    const report = await reportsService.getComplianceReport({
      tenantId: req.user.tenant_id,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      departmentId: departmentId ? parseInt(departmentId as string) : undefined,
    });

    res.json(
      successResponse(report, "Compliance report retrieved successfully"),
    );
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
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
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }
    const { name, description, metrics, dateFrom, dateTo, filters, groupBy } =
      req.body as CustomReportBody;

    const report = await reportsService.generateCustomReport({
      tenantId: req.user.tenant_id,
      name,
      description,
      metrics,
      dateFrom,
      dateTo,
      filters,
      groupBy,
    });

    res
      .status(201)
      .json(successResponse(report, "Custom report generated successfully"));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};

/**
 * Export report in various formats (PDF, Excel, CSV)
 */
export const exportReport = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      throw new ServiceError("UNAUTHORIZED", "User not authenticated");
    }
    const { type } = req.params;
    const { format, ...filters } = req.query;

    const exportData = await reportsService.exportReport({
      tenantId: req.user.tenant_id,
      reportType: type as string,
      format: format as "pdf" | "excel" | "csv",
      filters: {
        dateFrom: filters.dateFrom as string | undefined,
        dateTo: filters.dateTo as string | undefined,
        departmentId: filters.departmentId
          ? parseInt(filters.departmentId as string)
          : undefined,
        teamId: filters.teamId ? parseInt(filters.teamId as string) : undefined,
      },
    });

    // Set appropriate headers based on format
    const contentTypes = {
      pdf: "application/pdf",
      excel:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      csv: "text/csv",
    };

    const extensions = {
      pdf: "pdf",
      excel: "xlsx",
      csv: "csv",
    };

    res.setHeader(
      "Content-Type",
      contentTypes[format as keyof typeof contentTypes],
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="assixx-${type}-report-${new Date().toISOString().split("T")[0]}.${extensions[format as keyof typeof extensions]}"`,
    );

    // For now, return mock data
    // In production, this would generate actual files
    res.send(exportData);
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
  }
};
