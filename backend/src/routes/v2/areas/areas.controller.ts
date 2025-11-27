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
import {
  AreaIdParam,
  CreateAreaBody,
  GetAreasQuery,
  UpdateAreaBody,
} from './areas.validation.zod.js';
import { AreaFilters, CreateAreaRequest, UpdateAreaRequest } from './types.js';

// Constants
const USER_AGENT_HEADER = 'user-agent';

/** Build create area request from validated body */
function buildCreateRequest(body: CreateAreaBody): CreateAreaRequest {
  const data: CreateAreaRequest = { name: body.name, type: body.type };
  if (body.description !== undefined) data.description = body.description;
  if (body.capacity !== undefined && body.capacity !== null) data.capacity = body.capacity;
  if (body.parentId !== undefined && body.parentId !== null) data.parentId = body.parentId;
  if (body.address !== undefined) data.address = body.address;
  return data;
}

/** Build update area request from validated body */
function buildUpdateRequest(body: UpdateAreaBody): UpdateAreaRequest {
  const data: UpdateAreaRequest = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.type !== undefined) data.type = body.type;
  if (body.capacity !== undefined && body.capacity !== null) data.capacity = body.capacity;
  if (body.parentId !== undefined) data.parentId = body.parentId;
  if (body.address !== undefined) data.address = body.address;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  return data;
}

/** Log area action to audit log */
async function logAreaAction(
  req: AuthenticatedRequest,
  action: string,
  entityId: number,
  details: string,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>,
): Promise<void> {
  await rootLog.create({
    tenant_id: req.user.tenant_id,
    user_id: req.user.id,
    action,
    entity_type: 'area',
    entity_id: entityId,
    details,
    old_values: oldValues,
    new_values: newValues,
    ip_address: req.ip ?? req.socket.remoteAddress,
    user_agent: req.get(USER_AGENT_HEADER),
    was_role_switched: false,
  });
}

/**
 * Get all areas
 * GET /api/v2/areas
 * @param req - The request object (with validated query)
 * @param res - The response object
 */
export async function getAreasController(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // Zod middleware validates and transforms query params at runtime
    // TypeScript can't track this transformation, so we need explicit assertion
    const query = req.query as unknown as GetAreasQuery;
    const filters: AreaFilters = {
      ...(query.type !== undefined && { type: query.type }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.parentId !== undefined && { parentId: query.parentId }),
      ...(query.search !== undefined && { search: query.search }),
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
 * @param req - The request object (with validated params)
 * @param res - The response object
 */
export async function getAreaByIdController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    // Zod middleware validates and transforms params at runtime (string → number)
    // TypeScript can't track this transformation, so we need explicit assertion
    const params = req.params as unknown as AreaIdParam;
    const area = await getAreaById(params.id, req.user.tenant_id);

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
 * @param req - The request object (with validated body)
 * @param res - The response object
 */
export async function createAreaController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'root') {
      res.status(403).json(errorResponse('FORBIDDEN', 'Access denied'));
      return;
    }

    const body = req.body as CreateAreaBody;
    const data = buildCreateRequest(body);
    const newArea = await createArea(data, req.user.tenant_id, req.user.id);

    await logAreaAction(req, 'create', newArea.id, `Erstellt: ${data.name}`, undefined, {
      name: data.name,
      type: data.type,
      parent_id: data.parentId,
      address: data.address,
      capacity: data.capacity,
      created_by: req.user.email,
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
 * @param req - The request object (with validated params and body)
 * @param res - The response object
 */
export async function updateAreaController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'root') {
      res.status(403).json(errorResponse('FORBIDDEN', 'Access denied'));
      return;
    }

    const params = req.params as unknown as AreaIdParam;
    const body = req.body as UpdateAreaBody;
    const areaId = params.id;
    const oldArea = await getAreaById(areaId, req.user.tenant_id);
    const data = buildUpdateRequest(body);
    const updatedArea = await updateArea(areaId, data, req.user.tenant_id);

    await logAreaAction(
      req,
      'update',
      areaId,
      `Aktualisiert: ${data.name ?? 'Unbekannt'}`,
      {
        name: oldArea?.name,
        type: oldArea?.type,
        parent_id: oldArea?.parent_id,
        address: oldArea?.address,
        capacity: oldArea?.capacity,
        is_active: oldArea?.is_active,
      },
      {
        name: data.name,
        type: data.type,
        parent_id: data.parentId,
        address: data.address,
        capacity: data.capacity,
        is_active: data.isActive,
        updated_by: req.user.email,
      },
    );

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
 * @param req - The request object (with validated params)
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

    // Zod middleware validates and transforms params at runtime (string → number)
    // TypeScript can't track this transformation, so we need explicit assertion
    const params = req.params as unknown as AreaIdParam;
    const areaId = params.id;

    // Get force parameter from query string (e.g., /areas/123?force=true)
    const force = req.query['force'] === 'true';

    const deletedArea = await getAreaById(areaId, req.user.tenant_id);
    await deleteArea(areaId, req.user.tenant_id, force);

    await logAreaAction(req, 'delete', areaId, `Gelöscht: ${String(deletedArea?.name)}`, {
      name: deletedArea?.name,
      type: deletedArea?.type,
      parent_id: deletedArea?.parent_id,
      address: deletedArea?.address,
      capacity: deletedArea?.capacity,
      deleted_by: req.user.email,
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
