/**
 * Areas Controller v2
 * HTTP request handlers for area/location management
 */
import { Response } from 'express';

import rootLog from '../../../models/rootLog.js';
import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { errorResponse, successResponse } from '../../../utils/apiResponse.js';
import { getErrorMessage } from '../../../utils/errorHandler.js';
import {
  createArea,
  deleteArea,
  getAreaById,
  getAreaHierarchy,
  getAreaStats,
  getAreas,
  updateArea,
} from './areas.service.js';
import { AreaFilters, CreateAreaRequest, UpdateAreaRequest } from './types.js';

/**
 * Get all areas
 * GET /api/v2/areas
 * @param req - The request object
 * @param res - The response object
 */
export async function getAreasController(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const filters: AreaFilters = {
      type: req.query.type as string,
      isActive:
        req.query.isActive === 'true' ? true
        : req.query.isActive === 'false' ? false
        : undefined, // Don't filter by default - return all areas
      parentId:
        req.query.parentId !== undefined && req.query.parentId !== '' ?
          Number.parseInt(req.query.parentId as string)
        : undefined,
      search: req.query.search as string,
    };

    const areas = await getAreas(req.user.tenant_id, filters);

    res.json(successResponse(areas, 'Areas retrieved successfully'));
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    res.status(500).json(errorResponse('SERVER_ERROR', message));
  }
}

/**
 * Get area hierarchy
 * GET /api/v2/areas/hierarchy
 * @param req - The request object
 * @param res - The response object
 */
export async function getAreaHierarchyController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const hierarchy = await getAreaHierarchy(req.user.tenant_id);

    res.json(successResponse(hierarchy, 'Area hierarchy retrieved successfully'));
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    res.status(500).json(errorResponse('SERVER_ERROR', message));
  }
}

/**
 * Get area by ID
 * GET /api/v2/areas/:id
 * @param req - The request object
 * @param res - The response object
 */
export async function getAreaByIdController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const areaId = Number.parseInt(req.params.id);

    if (Number.isNaN(areaId)) {
      res.status(400).json(errorResponse('BAD_REQUEST', 'Invalid area ID'));
      return;
    }

    const area = await getAreaById(areaId, req.user.tenant_id);

    if (!area) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Area not found'));
      return;
    }

    res.json(successResponse(area, 'Area retrieved successfully'));
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    res.status(500).json(errorResponse('SERVER_ERROR', message));
  }
}

/**
 * Create new area
 * POST /api/v2/areas
 * @param req - The request object
 * @param res - The response object
 */
export async function createAreaController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    // Only admin and root can create areas
    if (req.user.role !== 'admin' && req.user.role !== 'root') {
      res.status(403).json(errorResponse('FORBIDDEN', 'Access denied'));
      return;
    }

    const data = req.body as CreateAreaRequest;
    const newArea = await createArea(data, req.user.tenant_id, req.user.id);

    // Log area creation
    await rootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'create',
      entity_type: 'area',
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
      user_agent: req.get('user-agent'),
      was_role_switched: false,
    });

    res.status(201).json(successResponse(newArea, 'Area created successfully'));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(
          errorResponse(
            error.code,
            error.message,
            error.details as { field: string; message: string }[] | undefined,
          ),
        );
    } else {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse('SERVER_ERROR', message));
    }
  }
}

/**
 * Update area
 * PUT /api/v2/areas/:id
 * @param req - The request object
 * @param res - The response object
 */
export async function updateAreaController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    // Only admin and root can update areas
    if (req.user.role !== 'admin' && req.user.role !== 'root') {
      res.status(403).json(errorResponse('FORBIDDEN', 'Access denied'));
      return;
    }

    const areaId = Number.parseInt(req.params.id);

    if (Number.isNaN(areaId)) {
      res.status(400).json(errorResponse('BAD_REQUEST', 'Invalid area ID'));
      return;
    }

    // Get old area data for logging
    const oldArea = await getAreaById(areaId, req.user.tenant_id);

    const data = req.body as UpdateAreaRequest;
    const updatedArea = await updateArea(areaId, data, req.user.tenant_id);

    // Log area update
    await rootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'update',
      entity_type: 'area',
      entity_id: areaId,
      details: `Aktualisiert: ${data.name ?? 'Unbekannt'}`,
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
      user_agent: req.get('user-agent'),
      was_role_switched: false,
    });

    res.json(successResponse(updatedArea, 'Area updated successfully'));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(
          errorResponse(
            error.code,
            error.message,
            error.details as { field: string; message: string }[] | undefined,
          ),
        );
    } else {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse('SERVER_ERROR', message));
    }
  }
}

/**
 * Delete area
 * DELETE /api/v2/areas/:id
 * @param req - The request object
 * @param res - The response object
 */
export async function deleteAreaController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    // Only admin and root can delete areas
    if (req.user.role !== 'admin' && req.user.role !== 'root') {
      res.status(403).json(errorResponse('FORBIDDEN', 'Access denied'));
      return;
    }

    const areaId = Number.parseInt(req.params.id);

    if (Number.isNaN(areaId)) {
      res.status(400).json(errorResponse('BAD_REQUEST', 'Invalid area ID'));
      return;
    }

    // Get force parameter from query string (e.g., /areas/123?force=true)
    const force = req.query.force === 'true';

    // Get area data before deletion for logging
    const deletedArea = await getAreaById(areaId, req.user.tenant_id);

    await deleteArea(areaId, req.user.tenant_id, force);

    // Log area deletion
    await rootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'delete',
      entity_type: 'area',
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
      user_agent: req.get('user-agent'),
      was_role_switched: false,
    });

    res.json(successResponse(null, 'Area deleted successfully'));
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      // IMPORTANT: Pass error.details to frontend so warning modal can show dependency counts
      res
        .status(error.statusCode)
        .json(
          errorResponse(
            error.code,
            error.message,
            error.details as { field: string; message: string }[] | undefined,
          ),
        );
    } else {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse('SERVER_ERROR', message));
    }
  }
}

/**
 * Get area statistics
 * GET /api/v2/areas/stats
 * @param req - The request object
 * @param res - The response object
 */
export async function getAreaStatsController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const stats = await getAreaStats(req.user.tenant_id);

    res.json(successResponse(stats, 'Area statistics retrieved successfully'));
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    res.status(500).json(errorResponse('SERVER_ERROR', message));
  }
}
