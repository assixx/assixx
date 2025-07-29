/**
 * Role Switch Controller v2
 * RESTful endpoints for role switching with enhanced security
 */

import { Response } from "express";

import { AuthenticatedRequest } from "../../../types/request.types.js";
import {
  errorResponse,
  successResponse,
} from "../../../types/response.types.js";
import { getErrorMessage } from "../../../utils/errorHandler.js";

import { RoleSwitchService, ServiceError } from "./role-switch.service.js";

export class RoleSwitchController {
  /**
   * @route POST /api/v2/role-switch/to-employee
   * @desc Switch admin/root view to employee mode
   * @access Private (Admin/Root only)
   */
  static async switchToEmployee(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      // SECURITY: All values from authenticated token
      const userId = req.user.id;
      const tenantId = req.user.tenant_id;

      const result = await RoleSwitchService.switchToEmployee(userId, tenantId);

      res.json(
        successResponse({
          token: result.token,
          user: result.user,
          message: result.message,
        }),
      );
    } catch (error) {
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.message, error.statusCode, error.code));
      } else {
        console.error("Role switch error:", getErrorMessage(error));
        res
          .status(500)
          .json(errorResponse("Internal server error", 500, "INTERNAL_ERROR"));
      }
    }
  }

  /**
   * @route POST /api/v2/role-switch/to-original
   * @desc Switch back to original role (admin/root)
   * @access Private
   */
  static async switchToOriginal(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      // SECURITY: All values from authenticated token
      const userId = req.user.id;
      const tenantId = req.user.tenant_id;

      const result = await RoleSwitchService.switchToOriginalRole(
        userId,
        tenantId,
      );

      res.json(
        successResponse({
          token: result.token,
          user: result.user,
          message: result.message,
        }),
      );
    } catch (error) {
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.message, error.statusCode, error.code));
      } else {
        console.error("Role switch error:", getErrorMessage(error));
        res
          .status(500)
          .json(errorResponse("Internal server error", 500, "INTERNAL_ERROR"));
      }
    }
  }

  /**
   * @route POST /api/v2/role-switch/root-to-admin
   * @desc Switch root to admin view
   * @access Private (Root only)
   */
  static async rootToAdmin(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      // SECURITY: All values from authenticated token
      const userId = req.user.id;
      const tenantId = req.user.tenant_id;

      const result = await RoleSwitchService.rootToAdmin(userId, tenantId);

      res.json(
        successResponse({
          token: result.token,
          user: result.user,
          message: result.message,
        }),
      );
    } catch (error) {
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.message, error.statusCode, error.code));
      } else {
        console.error("Role switch error:", getErrorMessage(error));
        res
          .status(500)
          .json(errorResponse("Internal server error", 500, "INTERNAL_ERROR"));
      }
    }
  }

  /**
   * @route GET /api/v2/role-switch/status
   * @desc Get current role switch status
   * @access Private
   */
  static async getStatus(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      // Return current role information from token
      const status = {
        userId: req.user.id,
        tenantId: req.user.tenant_id,
        originalRole: req.user.role,
        activeRole: req.user.activeRole ?? req.user.role,
        isRoleSwitched: req.user.isRoleSwitched ?? false,
        canSwitch: req.user.role === "admin" || req.user.role === "root",
      };

      res.json(successResponse(status));
    } catch (error) {
      console.error("Get status error:", getErrorMessage(error));
      res
        .status(500)
        .json(errorResponse("Internal server error", 500, "INTERNAL_ERROR"));
    }
  }
}
