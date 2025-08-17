/**
 * Machines API v2 Controller
 * Handles HTTP requests and delegates business logic to service layer
 */

import { Response } from "express";
import { validationResult, ValidationError } from "express-validator";

import type { AuthenticatedRequest } from "../../../types/request.types";
import { successResponse, errorResponse } from "../../../utils/apiResponse";
import { logger } from "../../../utils/logger";
import { ServiceError } from "../../../utils/ServiceError";

import { machinesService } from "./machines.service";
import {
  MachineCreateRequest,
  MachineUpdateRequest,
  MaintenanceRecordRequest,
} from "./types";

// Helper to map validation errors to our error response format
/**
 *
 * @param errors
 */
function mapValidationErrors(
  errors: ValidationError[],
): Array<{ field: string; message: string }> {
  return errors.map((error) => ({
    field: error.type === "field" ? error.path : "general",
    message: error.msg,
  }));
}

export const machinesController = {
  /**
   * List all machines with filters
   * GET /api/v2/machines
   * @param req
   * @param res
   */
  async listMachines(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res
          .status(400)
          .json(
            errorResponse(
              "VALIDATION_ERROR",
              "Invalid input",
              mapValidationErrors(errors.array()),
            ),
          );
        return;
      }

      if (!req.tenantId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Tenant ID missing"));
        return;
      }

      const filters = {
        status: req.query.status as string,
        machine_type: req.query.machineType as string,
        department_id: req.query.departmentId
          ? Number.parseInt(req.query.departmentId as string)
          : undefined,
        search: req.query.search as string,
        is_active: req.query.isActive === "false" ? false : true,
        needs_maintenance: req.query.needsMaintenance === "true",
      };

      const machines = await machinesService.listMachines(
        req.tenantId,
        filters,
      );

      res.json(successResponse(machines));
    } catch (error: unknown) {
      logger.error("[Machines v2] List error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as
                | Array<{ field: string; message: string }>
                | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to fetch machines"));
      }
    }
  },

  /**
   * Get machine by ID
   * GET /api/v2/machines/:id
   * @param req
   * @param res
   */
  async getMachine(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Tenant ID missing"));
        return;
      }

      const machineId = Number.parseInt(req.params.id);
      if (isNaN(machineId)) {
        res.status(400).json(errorResponse("INVALID_ID", "Invalid machine ID"));
        return;
      }

      const machine = await machinesService.getMachineById(
        machineId,
        req.tenantId,
      );
      res.json(successResponse(machine));
    } catch (error: unknown) {
      logger.error("[Machines v2] Get error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.code, error.message));
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to fetch machine"));
      }
    }
  },

  /**
   * Create new machine
   * POST /api/v2/machines
   * @param req
   * @param res
   */
  async createMachine(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res
          .status(400)
          .json(
            errorResponse(
              "VALIDATION_ERROR",
              "Invalid input",
              mapValidationErrors(errors.array()),
            ),
          );
        return;
      }

      if (!req.tenantId || !req.userId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Tenant ID or User ID missing"));
        return;
      }

      const machine = await machinesService.createMachine(
        req.body as MachineCreateRequest,
        req.tenantId,
        req.userId,
        req.ip,
        req.headers["user-agent"],
      );

      res.status(201).json(successResponse(machine));
    } catch (error: unknown) {
      logger.error("[Machines v2] Create error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as
                | Array<{ field: string; message: string }>
                | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to create machine"));
      }
    }
  },

  /**
   * Update machine
   * PUT /api/v2/machines/:id
   * @param req
   * @param res
   */
  async updateMachine(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res
          .status(400)
          .json(
            errorResponse(
              "VALIDATION_ERROR",
              "Invalid input",
              mapValidationErrors(errors.array()),
            ),
          );
        return;
      }

      if (!req.tenantId || !req.userId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Tenant ID or User ID missing"));
        return;
      }

      const machineId = Number.parseInt(req.params.id);
      if (isNaN(machineId)) {
        res.status(400).json(errorResponse("INVALID_ID", "Invalid machine ID"));
        return;
      }

      const machine = await machinesService.updateMachine(
        machineId,
        req.body as MachineUpdateRequest,
        req.tenantId,
        req.userId,
        req.ip,
        req.headers["user-agent"],
      );

      res.json(successResponse(machine));
    } catch (error: unknown) {
      logger.error("[Machines v2] Update error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as
                | Array<{ field: string; message: string }>
                | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to update machine"));
      }
    }
  },

  /**
   * Delete machine (soft delete)
   * DELETE /api/v2/machines/:id
   * @param req
   * @param res
   */
  async deleteMachine(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantId || !req.userId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Tenant ID or User ID missing"));
        return;
      }

      const machineId = Number.parseInt(req.params.id);
      if (isNaN(machineId)) {
        res.status(400).json(errorResponse("INVALID_ID", "Invalid machine ID"));
        return;
      }

      await machinesService.deleteMachine(
        machineId,
        req.tenantId,
        req.userId,
        req.ip,
        req.headers["user-agent"],
      );

      res.json(successResponse({ message: "Machine deleted successfully" }));
    } catch (error: unknown) {
      logger.error("[Machines v2] Delete error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.code, error.message));
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to delete machine"));
      }
    }
  },

  /**
   * Get maintenance history for a machine
   * GET /api/v2/machines/:id/maintenance
   * @param req
   * @param res
   */
  async getMaintenanceHistory(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.tenantId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Tenant ID missing"));
        return;
      }

      const machineId = Number.parseInt(req.params.id);
      if (isNaN(machineId)) {
        res.status(400).json(errorResponse("INVALID_ID", "Invalid machine ID"));
        return;
      }

      const history = await machinesService.getMaintenanceHistory(
        machineId,
        req.tenantId,
      );
      res.json(successResponse(history));
    } catch (error: unknown) {
      logger.error("[Machines v2] Get maintenance history error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.code, error.message));
      } else {
        res
          .status(500)
          .json(
            errorResponse(
              "SERVER_ERROR",
              "Failed to fetch maintenance history",
            ),
          );
      }
    }
  },

  /**
   * Add maintenance record
   * POST /api/v2/machines/maintenance
   * @param req
   * @param res
   */
  async addMaintenanceRecord(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res
          .status(400)
          .json(
            errorResponse(
              "VALIDATION_ERROR",
              "Invalid input",
              mapValidationErrors(errors.array()),
            ),
          );
        return;
      }

      if (!req.tenantId || !req.userId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Tenant ID or User ID missing"));
        return;
      }

      const record = await machinesService.addMaintenanceRecord(
        req.body as MaintenanceRecordRequest,
        req.tenantId,
        req.userId,
        req.ip,
        req.headers["user-agent"],
      );

      res.status(201).json(successResponse(record));
    } catch (error: unknown) {
      logger.error("[Machines v2] Add maintenance record error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(
            errorResponse(
              error.code,
              error.message,
              error.details as
                | Array<{ field: string; message: string }>
                | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(
            errorResponse("SERVER_ERROR", "Failed to add maintenance record"),
          );
      }
    }
  },

  /**
   * Get upcoming maintenance
   * GET /api/v2/machines/upcoming-maintenance
   * @param req
   * @param res
   */
  async getUpcomingMaintenance(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.tenantId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Tenant ID missing"));
        return;
      }

      const days = req.query.days
        ? Number.parseInt(req.query.days as string)
        : 30;
      if (isNaN(days) || days < 1 || days > 365) {
        res
          .status(400)
          .json(
            errorResponse("INVALID_DAYS", "Days must be between 1 and 365"),
          );
        return;
      }

      const machines = await machinesService.getUpcomingMaintenance(
        req.tenantId,
        days,
      );
      res.json(successResponse(machines));
    } catch (error: unknown) {
      logger.error("[Machines v2] Get upcoming maintenance error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.code, error.message));
      } else {
        res
          .status(500)
          .json(
            errorResponse(
              "SERVER_ERROR",
              "Failed to fetch upcoming maintenance",
            ),
          );
      }
    }
  },

  /**
   * Get machine statistics
   * GET /api/v2/machines/statistics
   * @param req
   * @param res
   */
  async getStatistics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Tenant ID missing"));
        return;
      }

      const stats = await machinesService.getStatistics(req.tenantId);
      res.json(successResponse(stats));
    } catch (error: unknown) {
      logger.error("[Machines v2] Get statistics error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.code, error.message));
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to fetch statistics"));
      }
    }
  },

  /**
   * Get machine categories
   * GET /api/v2/machines/categories
   * @param _req
   * @param res
   */
  async getCategories(
    _req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const categories = await machinesService.getCategories();
      res.json(successResponse(categories));
    } catch (error: unknown) {
      logger.error("[Machines v2] Get categories error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.code, error.message));
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to fetch categories"));
      }
    }
  },
};
