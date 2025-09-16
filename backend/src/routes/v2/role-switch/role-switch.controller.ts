/**
 * Role Switch Controller v2
 * RESTful endpoints for role switching with enhanced security
 */
import { Response } from 'express';

import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { errorResponse, successResponse } from '../../../types/response.types.js';
import { getErrorMessage } from '../../../utils/errorHandler.js';
import { ServiceError, roleSwitchService } from './role-switch.service.js';

/**
 * Switch admin/root view to employee mode
 * @param req - The request object
 * @param res - The response object
 */
export async function switchToEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // SECURITY: All values from authenticated token
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;

    const result = await roleSwitchService.switchToEmployee(userId, tenantId);

    res.json(
      successResponse({
        token: result.token,
        user: result.user,
        message: result.message,
      }),
    );
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.message, error.statusCode, error.code));
    } else {
      console.error('Role switch error:', getErrorMessage(error));
      res.status(500).json(errorResponse('Internal server error', 500, 'INTERNAL_ERROR'));
    }
  }
}

/**
 * Switch back to original role (admin/root)
 * @param req - The request object
 * @param res - The response object
 */
export async function switchToOriginal(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // SECURITY: All values from authenticated token
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;

    const result = await roleSwitchService.switchToOriginalRole(userId, tenantId);

    res.json(
      successResponse({
        token: result.token,
        user: result.user,
        message: result.message,
      }),
    );
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.message, error.statusCode, error.code));
    } else {
      console.error('Role switch error:', getErrorMessage(error));
      res.status(500).json(errorResponse('Internal server error', 500, 'INTERNAL_ERROR'));
    }
  }
}

/**
 * Switch root to admin view
 * @param req - The request object
 * @param res - The response object
 */
export async function rootToAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // SECURITY: All values from authenticated token
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;

    const result = await roleSwitchService.rootToAdmin(userId, tenantId);

    res.json(
      successResponse({
        token: result.token,
        user: result.user,
        message: result.message,
      }),
    );
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.message, error.statusCode, error.code));
    } else {
      console.error('Role switch error:', getErrorMessage(error));
      res.status(500).json(errorResponse('Internal server error', 500, 'INTERNAL_ERROR'));
    }
  }
}

/**
 * Get current role switch status
 * @param req - The request object
 * @param res - The response object
 */
export function getStatus(req: AuthenticatedRequest, res: Response): void {
  try {
    // Return current role information from token
    const status = {
      userId: req.user.id,
      tenantId: req.user.tenant_id,
      originalRole: req.user.role,
      activeRole: req.user.activeRole ?? req.user.role,
      isRoleSwitched: req.user.isRoleSwitched ?? false,
      canSwitch: req.user.role === 'admin' || req.user.role === 'root',
    };

    res.json(successResponse(status));
  } catch (error: unknown) {
    console.error('Get status error:', getErrorMessage(error));
    res.status(500).json(errorResponse('Internal server error', 500, 'INTERNAL_ERROR'));
  }
}

// Re-export as a namespace for backward compatibility
export const RoleSwitchController = {
  switchToEmployee,
  switchToOriginal,
  rootToAdmin,
  getStatus,
};
