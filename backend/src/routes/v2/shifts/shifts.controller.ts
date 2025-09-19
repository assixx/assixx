/**
 * Shifts API v2 Controller
 * Handles HTTP requests and delegates business logic to service layer
 */
import { Response } from 'express';

import type { AuthenticatedRequest } from '../../../types/request.types';
import { ServiceError } from '../../../utils/ServiceError';
import { errorResponse, paginatedResponse, successResponse } from '../../../utils/apiResponse';
import { shiftsService } from './shifts.service';

// Constants
const ERROR_CODES = {
  SERVER_ERROR: 'SERVER_ERROR',
} as const;

const HEADERS = {
  USER_AGENT: 'user-agent',
} as const;

// Import types from service for type safety
interface ShiftCreateData {
  planId?: number;
  userId: number;
  templateId?: number;
  date: string;
  startTime: string;
  endTime: string;
  title?: string;
  requiredEmployees?: number;
  breakMinutes?: number;
  status?: string;
  type?: string;
  notes?: string;
  departmentId: number;
  teamId?: number;
}

interface ShiftUpdateData {
  planId?: number;
  userId?: number;
  templateId?: number;
  date?: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  requiredEmployees?: number;
  actualStart?: string;
  actualEnd?: string;
  breakMinutes?: number;
  status?: string;
  type?: string;
  notes?: string;
  departmentId?: number;
  teamId?: number;
}

interface TemplateCreateData {
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  color?: string;
  isNightShift?: boolean;
  isActive?: boolean;
}

interface TemplateUpdateData {
  name?: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  color?: string;
  isNightShift?: boolean;
  isActive?: boolean;
}

interface SwapRequestCreateData {
  shiftId: number;
  requestedWithUserId?: number;
  reason?: string;
}

// ============= SHIFTS CRUD =============

/**
 * Parse query parameter as integer or return undefined
 */
function parseIntParam(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Number.parseInt(value as string);
}

/**
 * Parse query parameter with default value
 */
function parseParamWithDefault<T>(value: unknown, defaultValue: T): T {
  return value !== undefined ? (value as T) : defaultValue;
}

/**
 * Extract and parse filter parameters from request query
 */
function parseShiftFilters(query: AuthenticatedRequest['query']): {
  date: string;
  startDate: string;
  endDate: string;
  userId: number | undefined;
  departmentId: number | undefined;
  teamId: number | undefined;
  status: string;
  type: string;
  templateId: number | undefined;
  planId: number | undefined;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
} {
  return {
    date: query.date as string,
    startDate: query.startDate as string,
    endDate: query.endDate as string,
    userId: parseIntParam(query.userId),
    departmentId: parseIntParam(query.departmentId),
    teamId: parseIntParam(query.teamId),
    status: query.status as string,
    type: query.type as string,
    templateId: parseIntParam(query.templateId),
    planId: parseIntParam(query.planId),
    page: parseParamWithDefault(parseIntParam(query.page), 1),
    limit: parseParamWithDefault(parseIntParam(query.limit), 20),
    sortBy: parseParamWithDefault(query.sortBy, 'date') as string,
    sortOrder: parseParamWithDefault(query.sortOrder, 'desc') as 'asc' | 'desc',
  };
}

/**
 * List all shifts with filters
 * @param req - The authenticated request
 * @param res - The response object
 * @returns Promise resolving to response
 */
export async function listShifts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const filters = parseShiftFilters(req.query);
    const shifts = await shiftsService.listShifts(req.user.tenant_id, filters);

    // TODO: Implement proper pagination
    res.json(
      paginatedResponse(shifts, {
        currentPage: filters.page,
        totalPages: Math.ceil(shifts.length / filters.limit),
        pageSize: filters.limit,
        totalItems: shifts.length,
      }),
    );
  } catch (error: unknown) {
    res
      .status(500)
      .json(
        errorResponse(
          ERROR_CODES.SERVER_ERROR,
          error instanceof Error ? error.message : 'Failed to list shifts',
        ),
      );
  }
}

/**
 * List all shifts with filters
 * @param req - The authenticated request
 * @param res - The response object
 * @returns Promise resolving to response
 */
export async function getShiftById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = Number.parseInt(req.params.id);
    const shift = await shiftsService.getShiftById(id, req.user.tenant_id);
    res.json(successResponse(shift));
  } catch (error: unknown) {
    if (error instanceof ServiceError && error.code === 'SHIFT_NOT_FOUND') {
      res.status(404).json(errorResponse('NOT_FOUND', error.message));
    } else {
      res
        .status(500)
        .json(
          errorResponse(
            ERROR_CODES.SERVER_ERROR,
            error instanceof Error ? error.message : 'Failed to get shift',
          ),
        );
    }
  }
}

/**
 * List all shifts with filters
 * @param req - The authenticated request
 * @param res - The response object
 * @returns Promise resolving to response
 */
export async function createShift(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const shift = await shiftsService.createShift(
      req.body as ShiftCreateData, // Validated by middleware
      req.user.tenant_id,
      req.user.id,
      req.ip,
      req.get(HEADERS.USER_AGENT),
    );
    res.status(201).json(successResponse(shift));
  } catch (error: unknown) {
    res
      .status(500)
      .json(
        errorResponse(
          ERROR_CODES.SERVER_ERROR,
          error instanceof Error ? error.message : 'Failed to create shift',
        ),
      );
  }
}

/**
 * List all shifts with filters
 * @param req - The authenticated request
 * @param res - The response object
 * @returns Promise resolving to response
 */
export async function updateShift(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = Number.parseInt(req.params.id);
    const shift = await shiftsService.updateShift(
      id,
      req.body as ShiftUpdateData, // Validated by middleware
      req.user.tenant_id,
      req.user.id,
      req.ip,
      req.get(HEADERS.USER_AGENT),
    );
    res.json(successResponse(shift));
  } catch (error: unknown) {
    if (error instanceof ServiceError && error.code === 'SHIFT_NOT_FOUND') {
      res.status(404).json(errorResponse('NOT_FOUND', error.message));
    } else {
      res
        .status(500)
        .json(
          errorResponse(
            ERROR_CODES.SERVER_ERROR,
            error instanceof Error ? error.message : 'Failed to update shift',
          ),
        );
    }
  }
}

/**
 * List all shifts with filters
 * @param req - The authenticated request
 * @param res - The response object
 * @returns Promise resolving to response
 */
export async function deleteShift(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = Number.parseInt(req.params.id);
    const result = await shiftsService.deleteShift(
      id,
      req.user.tenant_id,
      req.user.id,
      req.ip,
      req.get(HEADERS.USER_AGENT),
    );
    res.json(successResponse(result));
  } catch (error: unknown) {
    if (error instanceof ServiceError && error.code === 'SHIFT_NOT_FOUND') {
      res.status(404).json(errorResponse('NOT_FOUND', error.message));
    } else {
      res
        .status(500)
        .json(
          errorResponse(
            ERROR_CODES.SERVER_ERROR,
            error instanceof Error ? error.message : 'Failed to delete shift',
          ),
        );
    }
  }
}

// ============= TEMPLATES =============

/**
 * List all shifts with filters
 * @param req - The authenticated request
 * @param res - The response object
 * @returns Promise resolving to response
 */
export async function listTemplates(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const templates = await shiftsService.listTemplates(req.user.tenant_id);
    res.json(successResponse(templates));
  } catch (error: unknown) {
    res
      .status(500)
      .json(
        errorResponse(
          ERROR_CODES.SERVER_ERROR,
          error instanceof Error ? error.message : 'Failed to list templates',
        ),
      );
  }
}

/**
 * List all shifts with filters
 * @param req - The authenticated request
 * @param res - The response object
 * @returns Promise resolving to response
 */
export async function getTemplateById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = Number.parseInt(req.params.id);
    const template = await shiftsService.getTemplateById(id, req.user.tenant_id);
    res.json(successResponse(template));
  } catch (error: unknown) {
    if (error instanceof ServiceError && error.code === 'TEMPLATE_NOT_FOUND') {
      res.status(404).json(errorResponse('NOT_FOUND', error.message));
    } else {
      res
        .status(500)
        .json(
          errorResponse(
            ERROR_CODES.SERVER_ERROR,
            error instanceof Error ? error.message : 'Failed to get template',
          ),
        );
    }
  }
}

/**
 * List all shifts with filters
 * @param req - The authenticated request
 * @param res - The response object
 * @returns Promise resolving to response
 */
export async function createTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const template = await shiftsService.createTemplate(
      req.body as TemplateCreateData, // Validated by middleware
      req.user.tenant_id,
      req.user.id,
      req.ip,
      req.get(HEADERS.USER_AGENT),
    );
    res.status(201).json(successResponse(template));
  } catch (error: unknown) {
    res
      .status(500)
      .json(
        errorResponse(
          ERROR_CODES.SERVER_ERROR,
          error instanceof Error ? error.message : 'Failed to create template',
        ),
      );
  }
}

/**
 * List all shifts with filters
 * @param req - The authenticated request
 * @param res - The response object
 * @returns Promise resolving to response
 */
export async function updateTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = Number.parseInt(req.params.id);
    const template = await shiftsService.updateTemplate(
      id,
      req.body as TemplateUpdateData, // Validated by middleware
      req.user.tenant_id,
      req.user.id,
      req.ip,
      req.get(HEADERS.USER_AGENT),
    );
    res.json(successResponse(template));
  } catch (error: unknown) {
    if (error instanceof ServiceError && error.code === 'TEMPLATE_NOT_FOUND') {
      res.status(404).json(errorResponse('NOT_FOUND', error.message));
    } else {
      res
        .status(500)
        .json(
          errorResponse(
            ERROR_CODES.SERVER_ERROR,
            error instanceof Error ? error.message : 'Failed to update template',
          ),
        );
    }
  }
}

/**
 * List all shifts with filters
 * @param req - The authenticated request
 * @param res - The response object
 * @returns Promise resolving to response
 */
export async function deleteTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = Number.parseInt(req.params.id);
    const result = await shiftsService.deleteTemplate(
      id,
      req.user.tenant_id,
      req.user.id,
      req.ip,
      req.get(HEADERS.USER_AGENT),
    );
    res.json(successResponse(result));
  } catch (error: unknown) {
    if (error instanceof ServiceError && error.code === 'TEMPLATE_NOT_FOUND') {
      res.status(404).json(errorResponse('NOT_FOUND', error.message));
    } else {
      res
        .status(500)
        .json(
          errorResponse(
            ERROR_CODES.SERVER_ERROR,
            error instanceof Error ? error.message : 'Failed to delete template',
          ),
        );
    }
  }
}

// ============= SWAP REQUESTS =============

/**
 * List all shifts with filters
 * @param req - The authenticated request
 * @param res - The response object
 * @returns Promise resolving to response
 */
export async function listSwapRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const filters = {
      userId:
        req.query.userId !== undefined ? Number.parseInt(req.query.userId as string) : undefined,
      status: req.query.status as string,
    };

    const requests = await shiftsService.listSwapRequests(req.user.tenant_id, filters);
    res.json(successResponse(requests));
  } catch (error: unknown) {
    res
      .status(500)
      .json(
        errorResponse(
          ERROR_CODES.SERVER_ERROR,
          error instanceof Error ? error.message : 'Failed to list swap requests',
        ),
      );
  }
}

/**
 * List all shifts with filters
 * @param req - The authenticated request
 * @param res - The response object
 * @returns Promise resolving to response
 */
export async function createSwapRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const request = await shiftsService.createSwapRequest(
      req.body as SwapRequestCreateData, // Validated by middleware
      req.user.tenant_id,
      req.user.id,
      req.ip,
      req.get(HEADERS.USER_AGENT),
    );
    res.status(201).json(successResponse(request));
  } catch (error: unknown) {
    if (error instanceof ServiceError && error.code === 'FORBIDDEN') {
      res.status(403).json(errorResponse('FORBIDDEN', error.message));
    } else if (error instanceof ServiceError && error.code === 'SHIFT_NOT_FOUND') {
      res.status(404).json(errorResponse('NOT_FOUND', error.message));
    } else {
      res
        .status(500)
        .json(
          errorResponse(
            ERROR_CODES.SERVER_ERROR,
            error instanceof Error ? error.message : 'Failed to create swap request',
          ),
        );
    }
  }
}

/**
 * List all shifts with filters
 * @param req - The authenticated request
 * @param res - The response object
 * @returns Promise resolving to response
 */
export async function updateSwapRequestStatus(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const id = Number.parseInt(req.params.id);
    const { status } = req.body as { status: string };

    const result = await shiftsService.updateSwapRequestStatus(
      id,
      status,
      req.user.tenant_id,
      req.user.id,
      req.ip,
      req.get(HEADERS.USER_AGENT),
    );
    res.json(successResponse(result));
  } catch (error: unknown) {
    if (error instanceof ServiceError && error.code === 'SWAP_REQUEST_NOT_FOUND') {
      res.status(404).json(errorResponse('NOT_FOUND', error.message));
    } else {
      res
        .status(500)
        .json(
          errorResponse(
            ERROR_CODES.SERVER_ERROR,
            error instanceof Error ? error.message : 'Failed to update swap request',
          ),
        );
    }
  }
}

// ============= OVERTIME =============

/**
 * List all shifts with filters
 * @param req - The authenticated request
 * @param res - The response object
 * @returns Promise resolving to response
 */
export async function getOvertimeReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId =
      req.query.userId !== undefined ? Number.parseInt(req.query.userId as string) : req.user.id;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    if (!startDate || !endDate) {
      res
        .status(400)
        .json(errorResponse('VALIDATION_ERROR', 'Start date and end date are required'));
      return;
    }

    const report = await shiftsService.getOvertimeReport(
      { userId, startDate, endDate },
      req.user.tenant_id,
    );
    res.json(successResponse(report));
  } catch (error: unknown) {
    res
      .status(500)
      .json(
        errorResponse(
          ERROR_CODES.SERVER_ERROR,
          error instanceof Error ? error.message : 'Failed to get overtime report',
        ),
      );
  }
}

// ============= EXPORT =============

/**
 * Extract and parse export filter parameters from request query
 */
function parseExportFilters(query: AuthenticatedRequest['query']): {
  startDate: string;
  endDate: string;
  departmentId: number | undefined;
  teamId: number | undefined;
  userId: number | undefined;
} {
  return {
    startDate: query.startDate as string,
    endDate: query.endDate as string,
    departmentId: parseIntParam(query.departmentId),
    teamId: parseIntParam(query.teamId),
    userId: parseIntParam(query.userId),
  };
}

/**
 * Get export format from query or return default
 */
function getExportFormat(query: AuthenticatedRequest['query']): 'csv' | 'excel' {
  return parseParamWithDefault(query.format, 'csv') as 'csv' | 'excel';
}

/**
 * Handle export error response
 */
function handleExportError(error: unknown, res: Response): void {
  if (error instanceof ServiceError && error.code === 'NOT_IMPLEMENTED') {
    res.status(501).json(errorResponse('NOT_IMPLEMENTED', error.message));
    return;
  }

  res
    .status(500)
    .json(
      errorResponse(
        ERROR_CODES.SERVER_ERROR,
        error instanceof Error ? error.message : 'Failed to export shifts',
      ),
    );
}

/**
 * List all shifts with filters
 * @param req - The authenticated request
 * @param res - The response object
 * @returns Promise resolving to response
 */
export async function exportShifts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const filters = parseExportFilters(req.query);
    const format = getExportFormat(req.query);
    const csvData = await shiftsService.exportShifts(filters, req.user.tenant_id, format);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shifts_${filters.startDate}_${filters.endDate}.csv"`,
    );
    res.send(csvData);
  } catch (error: unknown) {
    handleExportError(error, res);
  }
}

// ============= SHIFT PLAN ENDPOINTS =============

/**
 * Create a complete shift plan
 * @param req - The authenticated request
 * @param res - The response object
 */
export async function createShiftPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = req.body as {
      startDate: string;
      endDate: string;
      areaId?: number;
      departmentId: number;
      teamId?: number;
      machineId?: number;
      name?: string;
      shift_notes?: string; // Renamed from description for consistency
      shifts: {
        userId: number;
        date: string;
        type: string;
        startTime: string;
        endTime: string;
      }[];
      // dailyNotes removed - redundant with shift_notes
    };

    const result = await shiftsService.createShiftPlan(data, req.user.tenant_id, req.user.id);

    res.status(201).json(successResponse(result, result.message));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(400).json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(
          errorResponse(
            ERROR_CODES.SERVER_ERROR,
            error instanceof Error ? error.message : 'Failed to create shift plan',
          ),
        );
    }
  }
}

/**
 * Extract and parse shift plan filter parameters from request query
 */
function parseShiftPlanFilters(query: AuthenticatedRequest['query']): {
  areaId: number | undefined;
  departmentId: number | undefined;
  teamId: number | undefined;
  machineId: number | undefined;
  startDate: string;
  endDate: string;
} {
  return {
    areaId: parseIntParam(query.areaId),
    departmentId: parseIntParam(query.departmentId),
    teamId: parseIntParam(query.teamId),
    machineId: parseIntParam(query.machineId),
    startDate: query.startDate as string,
    endDate: query.endDate as string,
  };
}

/**
 * Handle shift plan error response
 */
function handleShiftPlanError(error: unknown, res: Response, operation: string): void {
  if (error instanceof ServiceError) {
    res.status(400).json(errorResponse(error.code, error.message));
    return;
  }

  res
    .status(500)
    .json(
      errorResponse(
        ERROR_CODES.SERVER_ERROR,
        error instanceof Error ? error.message : `Failed to ${operation}`,
      ),
    );
}

/**
 * Get shift plan with shifts and notes
 * @param req - The authenticated request
 * @param res - The response object
 */
export async function getShiftPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const filters = parseShiftPlanFilters(req.query);
    const result = await shiftsService.getShiftPlan(filters, req.user.tenant_id);
    res.json(successResponse(result, 'Shift plan retrieved successfully'));
  } catch (error: unknown) {
    handleShiftPlanError(error, res, 'get shift plan');
  }
}

/**
 * Validate and parse plan ID from request params
 */
function validatePlanId(params: AuthenticatedRequest['params'], res: Response): number | null {
  const planId = Number.parseInt(params.id);

  if (Number.isNaN(planId)) {
    res.status(400).json(errorResponse('INVALID_ID', 'Invalid plan ID'));
    return null;
  }

  return planId;
}

/**
 * Handle shift plan update error response
 */
function handleShiftPlanUpdateError(error: unknown, res: Response): void {
  if (error instanceof ServiceError) {
    const status = error.code === 'NOT_FOUND' ? 404 : 400;
    res.status(status).json(errorResponse(error.code, error.message));
    return;
  }

  res
    .status(500)
    .json(
      errorResponse(
        ERROR_CODES.SERVER_ERROR,
        error instanceof Error ? error.message : 'Failed to update shift plan',
      ),
    );
}

/**
 * Update existing shift plan
 * @param req - The authenticated request
 * @param res - The response object
 */
export async function updateShiftPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const planId = validatePlanId(req.params, res);
    if (planId === null) {
      return;
    }

    const data = req.body as {
      startDate?: string;
      endDate?: string;
      areaId?: number;
      departmentId?: number;
      teamId?: number;
      machineId?: number;
      name?: string;
      shiftNotes?: string;
      shifts?: {
        date: string;
        type: string;
        userId: number;
        startTime?: string;
        endTime?: string;
      }[];
    };

    const result = await shiftsService.updateShiftPlan(
      planId,
      data,
      req.user.tenant_id,
      req.user.id,
    );

    res.json(successResponse(result, 'Shift plan updated successfully'));
  } catch (error: unknown) {
    handleShiftPlanUpdateError(error, res);
  }
}

// ============= FAVORITES =============

/**
 * List user's shift planning favorites
 */
export async function listFavorites(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const favorites = await shiftsService.listFavorites(req.user.tenant_id, req.user.id);

    res.json(successResponse(favorites, 'Favorites retrieved successfully'));
  } catch (error: unknown) {
    res
      .status(500)
      .json(
        errorResponse(
          ERROR_CODES.SERVER_ERROR,
          error instanceof Error ? error.message : 'Failed to list favorites',
        ),
      );
  }
}

/**
 * Create new shift planning favorite
 */
export async function createFavorite(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = req.body as {
      name: string;
      areaId: number;
      areaName: string;
      departmentId: number;
      departmentName: string;
      machineId: number;
      machineName: string;
      teamId: number;
      teamName: string;
    };

    const favorite = await shiftsService.createFavorite(req.user.tenant_id, req.user.id, data);

    res.status(201).json(successResponse(favorite, 'Favorite created successfully'));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res
        .status(error.code === 'DUPLICATE' ? 409 : 400)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(
          errorResponse(
            ERROR_CODES.SERVER_ERROR,
            error instanceof Error ? error.message : 'Failed to create favorite',
          ),
        );
    }
  }
}

/**
 * Validate and parse favorite ID from request params
 */
function validateFavoriteId(params: AuthenticatedRequest['params'], res: Response): number | null {
  const favoriteId = Number.parseInt(params.id, 10);

  if (Number.isNaN(favoriteId)) {
    res.status(400).json(errorResponse('INVALID_ID', 'Invalid favorite ID'));
    return null;
  }

  return favoriteId;
}

/**
 * Handle delete operation error response
 */
function handleDeleteError(error: unknown, res: Response, resource: string): void {
  if (error instanceof ServiceError) {
    const status = error.code === 'NOT_FOUND' ? 404 : 400;
    res.status(status).json(errorResponse(error.code, error.message));
    return;
  }

  res
    .status(500)
    .json(
      errorResponse(
        ERROR_CODES.SERVER_ERROR,
        error instanceof Error ? error.message : `Failed to delete ${resource}`,
      ),
    );
}

/**
 * Delete shift planning favorite
 */
export async function deleteFavorite(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const favoriteId = validateFavoriteId(req.params, res);
    if (favoriteId === null) {
      return;
    }

    await shiftsService.deleteFavorite(favoriteId, req.user.tenant_id, req.user.id);
    res.json(successResponse(null, 'Favorite deleted successfully'));
  } catch (error: unknown) {
    handleDeleteError(error, res, 'favorite');
  }
}

/**
 * Handle delete shift plan error response (403 for permission errors)
 */
function handleDeleteShiftPlanError(error: unknown, res: Response): void {
  if (error instanceof ServiceError) {
    const status = error.code === 'NOT_FOUND' ? 404 : 403;
    res.status(status).json(errorResponse(error.code, error.message));
    return;
  }

  res
    .status(500)
    .json(
      errorResponse(
        ERROR_CODES.SERVER_ERROR,
        error instanceof Error ? error.message : 'Failed to delete shift plan',
      ),
    );
}

/**
 * Delete shift plan and associated shifts
 */
export async function deleteShiftPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const planId = validatePlanId(req.params, res);
    if (planId === null) {
      return;
    }

    await shiftsService.deleteShiftPlan(planId, req.user.tenant_id);
    res.json(successResponse(null, 'Shift plan deleted successfully'));
  } catch (error: unknown) {
    handleDeleteShiftPlanError(error, res);
  }
}

/**
 * Get current user's shifts for calendar display
 * Returns shifts in F/S/N format for the logged-in user
 */
export async function getMyCalendarShifts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    if (!startDate || !endDate) {
      res
        .status(400)
        .json(errorResponse('VALIDATION_ERROR', 'Start date and end date are required'));
      return;
    }

    // Get shifts for current user only
    const shifts = await shiftsService.getUserCalendarShifts(
      req.user.id,
      req.user.tenant_id,
      startDate,
      endDate,
    );

    res.json(successResponse(shifts, 'User shifts retrieved successfully'));
  } catch (error: unknown) {
    res
      .status(500)
      .json(
        errorResponse(
          ERROR_CODES.SERVER_ERROR,
          error instanceof Error ? error.message : 'Failed to get user shifts',
        ),
      );
  }
}
