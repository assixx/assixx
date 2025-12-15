/**
 * Shift Rotation Controller
 * HTTP handlers for shift rotation patterns
 */
import type { Response } from 'express';

import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { errorResponse, successResponse } from '../../../utils/apiResponse.js';
import * as rotationService from './rotation.service.js';
import type {
  AssignRotationRequest,
  CreateRotationPatternRequest,
  GenerateRotationFromConfigRequest,
  GenerateRotationRequest,
} from './rotation.types.js';

// Constants
const INTERNAL_ERROR_MESSAGE = 'An unexpected error occurred';

/**
 * Handle rotation errors with special DUPLICATE_NAME support
 * Extracted to reduce cognitive complexity in handlers
 */
function handleRotationError(error: unknown, res: Response, logPrefix: string): void {
  console.error(`[${logPrefix} ERROR] Full error:`, error);

  if (!(error instanceof ServiceError)) {
    const errorMessage = error instanceof Error ? error.message : INTERNAL_ERROR_MESSAGE;
    console.error(`[${logPrefix} ERROR] Details:`, errorMessage);
    res.status(500).json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    return;
  }

  // Special handling for DUPLICATE_NAME - include existingId for frontend
  const errorWithId = error as ServiceError & { existingId?: number };
  if (error.code === 'DUPLICATE_NAME' && errorWithId.existingId !== undefined) {
    res.status(error.statusCode).json({
      success: false,
      error: { code: error.code, message: error.message, existingId: errorWithId.existingId },
    });
    return;
  }

  res.status(error.statusCode).json(errorResponse(error.code, error.message));
}

// Helper types
interface RotationHistoryFilters {
  patternId?: number;
  userId?: number;
  teamId?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
}

/**
 * Check if query parameter has a valid non-empty value
 */
function isValidQueryParam(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

/**
 * Parse rotation history query parameters into filters object
 */
function parseRotationHistoryFilters(query: Record<string, unknown>): RotationHistoryFilters {
  const filters: RotationHistoryFilters = {};

  if (isValidQueryParam(query['pattern_id'])) {
    filters.patternId = Number(query['pattern_id']);
  }
  if (isValidQueryParam(query['user_id'])) {
    filters.userId = Number(query['user_id']);
  }
  if (isValidQueryParam(query['team_id'])) {
    filters.teamId = Number(query['team_id']);
  }
  if (isValidQueryParam(query['start_date'])) {
    filters.startDate = query['start_date'];
  }
  if (isValidQueryParam(query['end_date'])) {
    filters.endDate = query['end_date'];
  }
  if (isValidQueryParam(query['status'])) {
    filters.status = query['status'];
  }

  return filters;
}

/**
 * Get all rotation patterns
 */
export const getRotationPatterns = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const activeOnly = req.query['active_only'] !== 'false';
    const patterns = await rotationService.getRotationPatterns(req.user.tenant_id, activeOnly);

    res.json(successResponse({ patterns }));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    }
  }
};

/**
 * Get single rotation pattern
 */
export const getRotationPattern = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const patternId = Number(req.params['id']);
    const pattern = await rotationService.getRotationPattern(patternId, req.user.tenant_id);

    res.json(successResponse({ pattern }));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    }
  }
};

/**
 * Create rotation pattern
 */
export const createRotationPattern = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    console.info('[ROTATION] Creating pattern - User:', req.user);
    console.info('[ROTATION] Request body:', JSON.stringify(req.body, null, 2));

    if (req.user.role !== 'admin' && req.user.role !== 'root') {
      throw new ServiceError('FORBIDDEN', 'Only admins can create rotation patterns', 403);
    }

    const data = req.body as CreateRotationPatternRequest;
    const pattern = await rotationService.createRotationPattern(
      data,
      req.user.tenant_id,
      req.user.id,
    );

    res.json(successResponse({ pattern }));
  } catch (error: unknown) {
    handleRotationError(error, res, 'ROTATION');
  }
};

/**
 * Update rotation pattern
 */
export const updateRotationPattern = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'root') {
      throw new ServiceError('FORBIDDEN', 'Only admins can update rotation patterns', 403);
    }

    const patternId = Number(req.params['id']);
    const data = req.body as Partial<CreateRotationPatternRequest>;

    const pattern = await rotationService.updateRotationPattern(
      patternId,
      data,
      req.user.tenant_id,
    );

    res.json(successResponse({ pattern }));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    }
  }
};

/**
 * Delete rotation pattern
 */
export const deleteRotationPattern = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'root') {
      throw new ServiceError('FORBIDDEN', 'Only admins can delete rotation patterns', 403);
    }

    const patternId = Number(req.params['id']);
    await rotationService.deleteRotationPattern(patternId, req.user.tenant_id);

    res.json(successResponse(null));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    }
  }
};

/**
 * Assign users to rotation pattern
 */
export const assignUsersToPattern = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'root') {
      throw new ServiceError('FORBIDDEN', 'Only admins can assign users to patterns', 403);
    }

    const data = req.body as AssignRotationRequest;
    const assignments = await rotationService.assignUsersToPattern(
      data,
      req.user.tenant_id,
      req.user.id,
    );

    res.json(successResponse({ assignments }));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    }
  }
};

/**
 * Generate rotation shifts
 */
export const generateRotationShifts = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    console.info('[GENERATE] Starting generation - User:', req.user);
    console.info('[GENERATE] Request body:', JSON.stringify(req.body, null, 2));

    if (req.user.role !== 'admin' && req.user.role !== 'root') {
      throw new ServiceError('FORBIDDEN', 'Only admins can generate rotation shifts', 403);
    }

    const data = req.body as GenerateRotationRequest;
    const generatedShifts = await rotationService.generateRotationShifts(
      data,
      req.user.tenant_id,
      req.user.id,
    );

    res.json(successResponse({ generatedShifts }));
  } catch (error: unknown) {
    handleRotationError(error, res, 'GENERATE');
  }
};

/**
 * Get rotation history
 */
export const getRotationHistory = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const filters = parseRotationHistoryFilters(req.query as Record<string, unknown>);
    const history = await rotationService.getRotationHistory(req.user.tenant_id, filters);

    res.json(successResponse({ history }));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    }
  }
};

/**
 * Delete all rotation history for the tenant
 */
export const deleteRotationHistory = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    // Get team_id from query params - CRITICAL for multi-tenant isolation
    const teamIdQuery = req.query['team_id'] as string | undefined;
    if (teamIdQuery === undefined || teamIdQuery === '') {
      throw new ServiceError('BAD_REQUEST', 'team_id is required', 400);
    }
    const teamId = Number(teamIdQuery);

    const deletedCounts = await rotationService.deleteRotationHistory(req.user.tenant_id, teamId);

    res.json(
      successResponse({
        message: `Successfully deleted rotation data for team ${teamId}`,
        deletedCounts,
      }),
    );
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    }
  }
};

/**
 * Delete rotation history for a specific date range (week)
 * Query params: team_id, start_date, end_date
 */
export const deleteRotationHistoryByDateRange = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const teamIdQuery = req.query['team_id'] as string | undefined;
    const startDateQuery = req.query['start_date'] as string | undefined;
    const endDateQuery = req.query['end_date'] as string | undefined;

    if (teamIdQuery === undefined || teamIdQuery === '') {
      throw new ServiceError('BAD_REQUEST', 'team_id is required', 400);
    }
    if (startDateQuery === undefined || startDateQuery === '') {
      throw new ServiceError('BAD_REQUEST', 'start_date is required', 400);
    }
    if (endDateQuery === undefined || endDateQuery === '') {
      throw new ServiceError('BAD_REQUEST', 'end_date is required', 400);
    }

    const teamId = Number(teamIdQuery);
    const deletedCounts = await rotationService.deleteRotationHistoryByDateRange(
      req.user.tenant_id,
      teamId,
      startDateQuery,
      endDateQuery,
    );

    res.json(
      successResponse({
        message: `Successfully deleted rotation history for team ${teamId} from ${startDateQuery} to ${endDateQuery}`,
        deletedCounts,
      }),
    );
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    }
  }
};

/**
 * Generate rotation shifts from algorithm config + employee assignments
 * New algorithm-based approach - no pattern lookup needed
 */
export const generateRotationFromConfig = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    console.info('[GENERATE-FROM-CONFIG] Starting - User:', req.user.id);
    console.info('[GENERATE-FROM-CONFIG] Request body:', JSON.stringify(req.body, null, 2));

    if (req.user.role !== 'admin' && req.user.role !== 'root') {
      throw new ServiceError('FORBIDDEN', 'Only admins can generate rotation shifts', 403);
    }

    const data = req.body as GenerateRotationFromConfigRequest;
    const result = await rotationService.generateRotationFromConfig(
      data,
      req.user.tenant_id,
      req.user.id,
    );

    res.json(successResponse(result));
  } catch (error: unknown) {
    handleRotationError(error, res, 'GENERATE-FROM-CONFIG');
  }
};

/**
 * Delete a single rotation history entry by ID
 */
export const deleteRotationHistoryEntry = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'root') {
      throw new ServiceError('FORBIDDEN', 'Only admins can delete rotation history entries', 403);
    }

    const historyId = Number(req.params['id']);
    if (Number.isNaN(historyId) || historyId <= 0) {
      throw new ServiceError('BAD_REQUEST', 'Invalid history ID', 400);
    }

    await rotationService.deleteRotationHistoryEntry(historyId, req.user.tenant_id);

    res.json(successResponse({ message: 'Entry deleted successfully' }));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    }
  }
};
