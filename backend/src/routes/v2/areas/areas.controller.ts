/**
 * Areas Controller v2
 * HTTP request handlers for area/location management
 */

import { Response } from "express";

import { AuthenticatedRequest } from "../../../types/request.types.js";
import {
  successResponse,
  errorResponse,
} from "../../../types/response.types.js";
import { getErrorMessage } from "../../../utils/errorHandler.js";
import { ServiceError } from "../../../utils/ServiceError.js";

import { AreasService } from "./areas.service.js";
import { CreateAreaRequest, UpdateAreaRequest, AreaFilters } from "./types.js";

export class AreasController {
  /**
   * Get all areas
   * GET /api/v2/areas
   */
  static async getAreas(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const filters: AreaFilters = {
        type: req.query.type as string,
        isActive: req.query.isActive === "false" ? false : true,
        parentId: req.query.parentId
          ? parseInt(req.query.parentId as string)
          : undefined,
        search: req.query.search as string,
      };

      const areas = await AreasService.getAreas(req.user.tenant_id, filters);

      res.json(successResponse(areas, "Areas retrieved successfully"));
    } catch (error) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse(message, 500));
    }
  }

  /**
   * Get area hierarchy
   * GET /api/v2/areas/hierarchy
   */
  static async getAreaHierarchy(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const hierarchy = await AreasService.getAreaHierarchy(req.user.tenant_id);

      res.json(
        successResponse(hierarchy, "Area hierarchy retrieved successfully"),
      );
    } catch (error) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse(message, 500));
    }
  }

  /**
   * Get area by ID
   * GET /api/v2/areas/:id
   */
  static async getAreaById(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const areaId = parseInt(req.params.id);

      if (isNaN(areaId)) {
        res.status(400).json(errorResponse("Invalid area ID", 400));
        return;
      }

      const area = await AreasService.getAreaById(areaId, req.user.tenant_id);

      if (!area) {
        res.status(404).json(errorResponse("Area not found", 404));
        return;
      }

      res.json(successResponse(area, "Area retrieved successfully"));
    } catch (error) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse(message, 500));
    }
  }

  /**
   * Create new area
   * POST /api/v2/areas
   */
  static async createArea(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      // Only admin and root can create areas
      if (req.user.role !== "admin" && req.user.role !== "root") {
        res.status(403).json(errorResponse("Access denied", 403));
        return;
      }

      const data = req.body as CreateAreaRequest;
      const newArea = await AreasService.createArea(
        data,
        req.user.tenant_id,
        req.user.id,
      );

      res
        .status(201)
        .json(successResponse(newArea, "Area created successfully"));
    } catch (error) {
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.message, error.statusCode));
      } else {
        const message = getErrorMessage(error);
        res.status(500).json(errorResponse(message, 500));
      }
    }
  }

  /**
   * Update area
   * PUT /api/v2/areas/:id
   */
  static async updateArea(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      // Only admin and root can update areas
      if (req.user.role !== "admin" && req.user.role !== "root") {
        res.status(403).json(errorResponse("Access denied", 403));
        return;
      }

      const areaId = parseInt(req.params.id);

      if (isNaN(areaId)) {
        res.status(400).json(errorResponse("Invalid area ID", 400));
        return;
      }

      const data = req.body as UpdateAreaRequest;
      const updatedArea = await AreasService.updateArea(
        areaId,
        data,
        req.user.tenant_id,
      );

      res.json(successResponse(updatedArea, "Area updated successfully"));
    } catch (error) {
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.message, error.statusCode));
      } else {
        const message = getErrorMessage(error);
        res.status(500).json(errorResponse(message, 500));
      }
    }
  }

  /**
   * Delete area
   * DELETE /api/v2/areas/:id
   */
  static async deleteArea(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      // Only admin and root can delete areas
      if (req.user.role !== "admin" && req.user.role !== "root") {
        res.status(403).json(errorResponse("Access denied", 403));
        return;
      }

      const areaId = parseInt(req.params.id);

      if (isNaN(areaId)) {
        res.status(400).json(errorResponse("Invalid area ID", 400));
        return;
      }

      await AreasService.deleteArea(areaId, req.user.tenant_id);

      res.json(successResponse(null, "Area deleted successfully"));
    } catch (error) {
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.message, error.statusCode));
      } else {
        const message = getErrorMessage(error);
        res.status(500).json(errorResponse(message, 500));
      }
    }
  }

  /**
   * Get area statistics
   * GET /api/v2/areas/stats
   */
  static async getAreaStats(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const stats = await AreasService.getAreaStats(req.user.tenant_id);

      res.json(
        successResponse(stats, "Area statistics retrieved successfully"),
      );
    } catch (error) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse(message, 500));
    }
  }
}
