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
  GenerateRotationRequest,
} from './rotation.types.js';

// Constants
const INTERNAL_ERROR_MESSAGE = 'An unexpected error occurred';

/**
 * Get all rotation patterns
 */
export const getRotationPatterns = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const activeOnly = req.query.active_only !== 'false';
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
    const patternId = Number(req.params.id);
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
    console.error('[ROTATION ERROR] Full error:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      const errorMessage = error instanceof Error ? error.message : INTERNAL_ERROR_MESSAGE;
      console.error('[ROTATION ERROR] Details:', errorMessage);
      res.status(500).json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    }
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

    const patternId = Number(req.params.id);
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

    const patternId = Number(req.params.id);
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
    console.error('[GENERATE ERROR] Full error:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      const errorMessage = error instanceof Error ? error.message : INTERNAL_ERROR_MESSAGE;
      console.error('[GENERATE ERROR] Details:', errorMessage);
      res.status(500).json(errorResponse('INTERNAL_ERROR', INTERNAL_ERROR_MESSAGE));
    }
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
    const filters = {
      patternId: req.query.pattern_id ? Number(req.query.pattern_id) : undefined,
      userId: req.query.user_id ? Number(req.query.user_id) : undefined,
      startDate: req.query.start_date as string | undefined,
      endDate: req.query.end_date as string | undefined,
      status: req.query.status as string | undefined,
    };

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
    const teamId = req.query.team_id ? Number(req.query.team_id) : undefined;

    if (!teamId) {
      throw new ServiceError('BAD_REQUEST', 'team_id is required', 400);
    }

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
