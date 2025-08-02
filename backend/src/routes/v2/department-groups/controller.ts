/**
 * Department Groups Controller v2
 * HTTP request handlers for department groups API
 */

import { Response } from "express";
import { validationResult } from "express-validator";

import { AuthenticatedRequest } from "../../../types/request.types.js";
import { logger } from "../../../utils/logger.js";
import { ServiceError } from "../../../utils/ServiceError.js";

import { departmentGroupsService } from "./service.js";
import {
  CreateGroupRequest,
  UpdateGroupRequest,
  AddDepartmentsRequest,
} from "./types.js";

export class DepartmentGroupsController {
  /**
   * Get all department groups with hierarchy
   */
  async getGroups(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const groups = await departmentGroupsService.getGroupHierarchy(
        req.user.tenant_id,
      );

      res.json({
        success: true,
        data: groups,
      });
    } catch (error) {
      logger.error("Error getting department groups:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Failed to fetch department groups",
        },
      });
    }
  }

  /**
   * Get a single group by ID
   */
  async getGroupById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const groupId = parseInt(req.params.id);
      const group = await departmentGroupsService.getGroupById(
        groupId,
        req.user.tenant_id,
      );

      res.json({
        success: true,
        data: group,
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      } else {
        logger.error("Error getting group by ID:", error);
        res.status(500).json({
          success: false,
          error: {
            code: "SERVER_ERROR",
            message: "Failed to fetch group",
          },
        });
      }
    }
  }

  /**
   * Create a new department group
   */
  async createGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
    // Check if user is root
    if (req.user.role !== "root") {
      res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Only root users can create department groups",
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
      const groupId = await departmentGroupsService.createGroup(
        req.body as CreateGroupRequest,
        req.user.tenant_id,
        req.user.id,
      );

      res.status(201).json({
        success: true,
        data: {
          id: groupId,
        },
        message: "Department group created successfully",
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      } else {
        logger.error("Error creating department group:", error);
        res.status(500).json({
          success: false,
          error: {
            code: "SERVER_ERROR",
            message: "Failed to create department group",
          },
        });
      }
    }
  }

  /**
   * Update a department group
   */
  async updateGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
    // Check if user is root
    if (req.user.role !== "root") {
      res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Only root users can update department groups",
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
      const groupId = parseInt(req.params.id);
      await departmentGroupsService.updateGroup(
        groupId,
        req.body as UpdateGroupRequest,
        req.user.tenant_id,
        req.user.id,
      );

      res.json({
        success: true,
        message: "Department group updated successfully",
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      } else {
        logger.error("Error updating department group:", error);
        res.status(500).json({
          success: false,
          error: {
            code: "SERVER_ERROR",
            message: "Failed to update department group",
          },
        });
      }
    }
  }

  /**
   * Delete a department group
   */
  async deleteGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
    // Check if user is root
    if (req.user.role !== "root") {
      res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Only root users can delete department groups",
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
      const groupId = parseInt(req.params.id);
      await departmentGroupsService.deleteGroup(
        groupId,
        req.user.tenant_id,
        req.user.id,
      );

      res.json({
        success: true,
        message: "Department group deleted successfully",
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      } else {
        logger.error("Error deleting department group:", error);
        res.status(500).json({
          success: false,
          error: {
            code: "SERVER_ERROR",
            message: "Failed to delete department group",
          },
        });
      }
    }
  }

  /**
   * Add departments to a group
   */
  async addDepartments(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    // Check if user is root
    if (req.user.role !== "root") {
      res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Only root users can modify department groups",
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
      const groupId = parseInt(req.params.id);
      const { departmentIds } = req.body as AddDepartmentsRequest;
      await departmentGroupsService.addDepartmentsToGroup(
        groupId,
        departmentIds,
        req.user.tenant_id,
        req.user.id,
      );

      res.json({
        success: true,
        message: "Departments added to group successfully",
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      } else {
        logger.error("Error adding departments to group:", error);
        res.status(500).json({
          success: false,
          error: {
            code: "SERVER_ERROR",
            message: "Failed to add departments",
          },
        });
      }
    }
  }

  /**
   * Remove a department from a group
   */
  async removeDepartment(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    // Check if user is root
    if (req.user.role !== "root") {
      res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Only root users can modify department groups",
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
      const groupId = parseInt(req.params.id);
      const departmentId = parseInt(req.params.departmentId);

      await departmentGroupsService.removeDepartmentFromGroup(
        groupId,
        departmentId,
        req.user.tenant_id,
        req.user.id,
      );

      res.json({
        success: true,
        message: "Department removed from group successfully",
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      } else {
        logger.error("Error removing department from group:", error);
        res.status(500).json({
          success: false,
          error: {
            code: "SERVER_ERROR",
            message: "Failed to remove department",
          },
        });
      }
    }
  }

  /**
   * Get departments in a group
   */
  async getGroupDepartments(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
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
      const groupId = parseInt(req.params.id);
      const includeSubgroups = req.query.includeSubgroups !== "false";

      const departments = await departmentGroupsService.getGroupDepartments(
        groupId,
        req.user.tenant_id,
        includeSubgroups,
      );

      res.json({
        success: true,
        data: departments,
      });
    } catch (error) {
      logger.error("Error getting group departments:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Failed to fetch departments",
        },
      });
    }
  }
}

export const departmentGroupsController = new DepartmentGroupsController();
