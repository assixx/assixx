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
 * List all shifts with filters
 * @param req - The authenticated request
 * @param res - The response object
 * @returns Promise resolving to response
 */
export async function listShifts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const filters = {
      date: req.query.date as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      userId:
        req.query.userId !== undefined ? Number.parseInt(req.query.userId as string) : undefined,
      departmentId:
        req.query.departmentId !== undefined ?
          Number.parseInt(req.query.departmentId as string)
        : undefined,
      teamId:
        req.query.teamId !== undefined ? Number.parseInt(req.query.teamId as string) : undefined,
      status: req.query.status as string,
      type: req.query.type as string,
      templateId:
        req.query.templateId !== undefined ?
          Number.parseInt(req.query.templateId as string)
        : undefined,
      planId:
        req.query.planId !== undefined ? Number.parseInt(req.query.planId as string) : undefined,
      page: req.query.page !== undefined ? Number.parseInt(req.query.page as string) : 1,
      limit: req.query.limit !== undefined ? Number.parseInt(req.query.limit as string) : 20,
      sortBy: req.query.sortBy !== undefined ? (req.query.sortBy as string) : 'date',
      sortOrder:
        req.query.sortOrder !== undefined ? (req.query.sortOrder as 'asc' | 'desc') : 'desc',
    };

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
 * List all shifts with filters
 * @param req - The authenticated request
 * @param res - The response object
 * @returns Promise resolving to response
 */
export async function exportShifts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      departmentId:
        req.query.departmentId !== undefined ?
          Number.parseInt(req.query.departmentId as string)
        : undefined,
      teamId:
        req.query.teamId !== undefined ? Number.parseInt(req.query.teamId as string) : undefined,
      userId:
        req.query.userId !== undefined ? Number.parseInt(req.query.userId as string) : undefined,
    };

    const format = req.query.format !== undefined ? (req.query.format as 'csv' | 'excel') : 'csv';
    const csvData = await shiftsService.exportShifts(filters, req.user.tenant_id, format);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shifts_${filters.startDate}_${filters.endDate}.csv"`,
    );
    res.send(csvData);
  } catch (error: unknown) {
    if (error instanceof ServiceError && error.code === 'NOT_IMPLEMENTED') {
      res.status(501).json(errorResponse('NOT_IMPLEMENTED', error.message));
    } else {
      res
        .status(500)
        .json(
          errorResponse(
            ERROR_CODES.SERVER_ERROR,
            error instanceof Error ? error.message : 'Failed to export shifts',
          ),
        );
    }
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
 * Get shift plan with shifts and notes
 * @param req - The authenticated request
 * @param res - The response object
 */
export async function getShiftPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const filters = {
      areaId:
        req.query.areaId !== undefined ? Number.parseInt(req.query.areaId as string) : undefined,
      departmentId:
        req.query.departmentId !== undefined ?
          Number.parseInt(req.query.departmentId as string)
        : undefined,
      teamId:
        req.query.teamId !== undefined ? Number.parseInt(req.query.teamId as string) : undefined,
      machineId:
        req.query.machineId !== undefined ?
          Number.parseInt(req.query.machineId as string)
        : undefined,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };

    const result = await shiftsService.getShiftPlan(filters, req.user.tenant_id);

    res.json(successResponse(result, 'Shift plan retrieved successfully'));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(400).json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(
          errorResponse(
            ERROR_CODES.SERVER_ERROR,
            error instanceof Error ? error.message : 'Failed to get shift plan',
          ),
        );
    }
  }
}

/**
 * Update existing shift plan
 * @param req - The authenticated request
 * @param res - The response object
 */
export async function updateShiftPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const planId = Number.parseInt(req.params.id);

    if (Number.isNaN(planId)) {
      res.status(400).json(errorResponse('INVALID_ID', 'Invalid plan ID'));
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
    if (error instanceof ServiceError) {
      res
        .status(error.code === 'NOT_FOUND' ? 404 : 400)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(
          errorResponse(
            ERROR_CODES.SERVER_ERROR,
            error instanceof Error ? error.message : 'Failed to update shift plan',
          ),
        );
    }
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
 * Delete shift planning favorite
 */
export async function deleteFavorite(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const favoriteId = Number.parseInt(req.params.id, 10);

    if (Number.isNaN(favoriteId)) {
      res.status(400).json(errorResponse('INVALID_ID', 'Invalid favorite ID'));
      return;
    }

    await shiftsService.deleteFavorite(favoriteId, req.user.tenant_id, req.user.id);

    res.json(successResponse(null, 'Favorite deleted successfully'));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res
        .status(error.code === 'NOT_FOUND' ? 404 : 400)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(
          errorResponse(
            ERROR_CODES.SERVER_ERROR,
            error instanceof Error ? error.message : 'Failed to delete favorite',
          ),
        );
    }
  }
}

/**
 * Delete shift plan and associated shifts
 */
export async function deleteShiftPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const planId = Number(req.params.id);

    if (Number.isNaN(planId)) {
      res.status(400).json(errorResponse('INVALID_INPUT', 'Invalid plan ID'));
      return;
    }

    // Delete the shift plan and associated shifts
    await shiftsService.deleteShiftPlan(planId, req.user.tenant_id);

    res.json(successResponse(null, 'Shift plan deleted successfully'));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res
        .status(error.code === 'NOT_FOUND' ? 404 : 403)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(
          errorResponse(
            ERROR_CODES.SERVER_ERROR,
            error instanceof Error ? error.message : 'Failed to delete shift plan',
          ),
        );
    }
  }
}
