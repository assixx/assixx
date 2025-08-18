/**
 * Areas Controller v2
 * HTTP request handlers for area/location management
 */

import { Response } from "express";
import {
  getAreas,
  getAreaById,
  getAreaHierarchy,
  createArea,
  updateArea,
  deleteArea,
  getAreaStats,
} from "./areas.service.js";
import { CreateAreaRequest, UpdateAreaRequest, AreaFilters } from "./types.js";
import RootLog from "../../../models/rootLog.js";
import type { AuthenticatedRequest } from "../../../types/request.types.js";
import {
  successResponse,
  errorResponse,
} from "../../../types/response.types.js";
import { getErrorMessage } from "../../../utils/errorHandler.js";
import { ServiceError } from "../../../utils/ServiceError.js";

/**
 * Get all areas
 * GET /api/v2/areas
 * @param req
 * @param res
 */
export async function getAreasController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const filters: AreaFilters = {
      type: req.query.type as string,
      isActive: req.query.isActive === "false" ? false : true,
      parentId:
        req.query.parentId !== undefined && req.query.parentId !== ""
          ? Number.parseInt(req.query.parentId as string)
          : undefined,
      search: req.query.search as string,
    };

    const areas = await getAreas(req.user.tenant_id, filters);

    res.json(successResponse(areas, "Areas retrieved successfully"));
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    res.status(500).json(errorResponse(message, 500));
  }
}

/**
 * Get area hierarchy
 * GET /api/v2/areas/hierarchy
 * @param req
 * @param res
 */
export async function getAreaHierarchyController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const hierarchy = await getAreaHierarchy(req.user.tenant_id);

    res.json(
      successResponse(hierarchy, "Area hierarchy retrieved successfully"),
    );
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    res.status(500).json(errorResponse(message, 500));
  }
}

/**
 * Get area by ID
 * GET /api/v2/areas/:id
 * @param req
 * @param res
 */
export async function getAreaByIdController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const areaId = Number.parseInt(req.params.id);

    if (isNaN(areaId)) {
      res.status(400).json(errorResponse("Invalid area ID", 400));
      return;
    }

    const area = await getAreaById(areaId, req.user.tenant_id);

    if (!area) {
      res.status(404).json(errorResponse("Area not found", 404));
      return;
    }

    res.json(successResponse(area, "Area retrieved successfully"));
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    res.status(500).json(errorResponse(message, 500));
  }
}

/**
 * Create new area
 * POST /api/v2/areas
 * @param req
 * @param res
 */
export async function createAreaController(
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
    const newArea = await createArea(data, req.user.tenant_id, req.user.id);

    // Log area creation
    await RootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: "create",
      entity_type: "area",
      entity_id: newArea.id,
      details: `Erstellt: ${data.name}`,
      new_values: {
        name: data.name,
        type: data.type,
        parent_id: data.parentId,
        address: data.address,
        capacity: data.capacity,
        created_by: req.user.email,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get("user-agent"),
      was_role_switched: false,
    });

    res.status(201).json(successResponse(newArea, "Area created successfully"));
  } catch (error: unknown) {
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
 * @param req
 * @param res
 */
export async function updateAreaController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    // Only admin and root can update areas
    if (req.user.role !== "admin" && req.user.role !== "root") {
      res.status(403).json(errorResponse("Access denied", 403));
      return;
    }

    const areaId = Number.parseInt(req.params.id);

    if (isNaN(areaId)) {
      res.status(400).json(errorResponse("Invalid area ID", 400));
      return;
    }

    // Get old area data for logging
    const oldArea = await getAreaById(areaId, req.user.tenant_id);

    const data = req.body as UpdateAreaRequest;
    const updatedArea = await updateArea(areaId, data, req.user.tenant_id);

    // Log area update
    await RootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: "update",
      entity_type: "area",
      entity_id: areaId,
      details: `Aktualisiert: ${data.name}`,
      old_values: {
        name: oldArea?.name,
        type: oldArea?.type,
        parent_id: oldArea?.parent_id,
        address: oldArea?.address,
        capacity: oldArea?.capacity,
        is_active: oldArea?.is_active,
      },
      new_values: {
        name: data.name,
        type: data.type,
        parent_id: data.parentId,
        address: data.address,
        capacity: data.capacity,
        is_active: data.isActive,
        updated_by: req.user.email,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get("user-agent"),
      was_role_switched: false,
    });

    res.json(successResponse(updatedArea, "Area updated successfully"));
  } catch (error: unknown) {
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
 * @param req
 * @param res
 */
export async function deleteAreaController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    // Only admin and root can delete areas
    if (req.user.role !== "admin" && req.user.role !== "root") {
      res.status(403).json(errorResponse("Access denied", 403));
      return;
    }

    const areaId = Number.parseInt(req.params.id);

    if (isNaN(areaId)) {
      res.status(400).json(errorResponse("Invalid area ID", 400));
      return;
    }

    // Get area data before deletion for logging
    const deletedArea = await getAreaById(areaId, req.user.tenant_id);

    await deleteArea(areaId, req.user.tenant_id);

    // Log area deletion
    await RootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: "delete",
      entity_type: "area",
      entity_id: areaId,
      details: `Gelöscht: ${String(deletedArea?.name)}`,
      old_values: {
        name: deletedArea?.name,
        type: deletedArea?.type,
        parent_id: deletedArea?.parent_id,
        address: deletedArea?.address,
        capacity: deletedArea?.capacity,
        deleted_by: req.user.email,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get("user-agent"),
      was_role_switched: false,
    });

    res.json(successResponse(null, "Area deleted successfully"));
  } catch (error: unknown) {
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
 * @param req
 * @param res
 */
export async function getAreaStatsController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const stats = await getAreaStats(req.user.tenant_id);

    res.json(successResponse(stats, "Area statistics retrieved successfully"));
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    res.status(500).json(errorResponse(message, 500));
  }
}
