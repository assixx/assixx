/**
 * Roles Controller v2
 * HTTP request handlers for roles API
 */

import { validationResult } from "express-validator";

import { Response } from "express";

import type { AuthenticatedRequest } from "../../../types/request.types.js";
import { logger } from "../../../utils/logger.js";
import { ServiceError } from "../../../utils/ServiceError.js";

import { rolesService } from "./service.js";
import type { RoleCheckRequest, RoleName } from "./types.js";

/**
 *
 */
export class RolesController {
  /**
   * Get all available roles
   * @param _req
   * @param res
   */
  async getAllRoles(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const roles = await rolesService.getAllRoles();

      res.json({
        success: true,
        data: roles,
      });
    } catch (error: unknown) {
      logger.error("Error getting roles:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Failed to fetch roles",
        },
      });
    }
  }

  /**
   * Get a single role by ID
   * @param req
   * @param res
   */
  async getRoleById(req: AuthenticatedRequest, res: Response): Promise<void> {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: errors.array().map((error) => ({
            field: error.type === "field" ? error.path : "general",
            message: error.msg,
          })),
        },
      });
      return;
    }

    try {
      const roleId = req.params.id as RoleName;
      const role = await rolesService.getRoleById(roleId);

      res.json({
        success: true,
        data: role,
      });
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      } else {
        logger.error("Error getting role by ID:", error);
        res.status(500).json({
          success: false,
          error: {
            code: "SERVER_ERROR",
            message: "Failed to fetch role",
          },
        });
      }
    }
  }

  /**
   * Get role hierarchy
   * @param _req
   * @param res
   */
  async getRoleHierarchy(
    _req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const hierarchy = await rolesService.getRoleHierarchy();

      res.json({
        success: true,
        data: hierarchy,
      });
    } catch (error: unknown) {
      logger.error("Error getting role hierarchy:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Failed to fetch role hierarchy",
        },
      });
    }
  }

  /**
   * Get roles that can be assigned by the current user
   * @param req
   * @param res
   */
  async getAssignableRoles(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const currentUserRole = req.user.role as RoleName;
      const assignableRoles =
        await rolesService.getAssignableRoles(currentUserRole);

      res.json({
        success: true,
        data: assignableRoles,
      });
    } catch (error: unknown) {
      logger.error("Error getting assignable roles:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Failed to fetch assignable roles",
        },
      });
    }
  }

  /**
   * Check if a user has a specific role
   * @param req
   * @param res
   */
  async checkUserRole(req: AuthenticatedRequest, res: Response): Promise<void> {
    // Check if user is admin or root
    if (req.user.role !== "admin" && req.user.role !== "root") {
      res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Only administrators can check user roles",
        },
      });
      return;
    }

    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: errors.array().map((error) => ({
            field: error.type === "field" ? error.path : "general",
            message: error.msg,
          })),
        },
      });
      return;
    }

    try {
      const request = req.body as RoleCheckRequest;
      const result = await rolesService.checkUserRole(request);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      } else {
        logger.error("Error checking user role:", error);
        res.status(500).json({
          success: false,
          error: {
            code: "SERVER_ERROR",
            message: "Failed to check user role",
          },
        });
      }
    }
  }
}

export const rolesController = new RolesController();
