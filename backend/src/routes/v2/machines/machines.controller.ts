/**
 * Machines API v2 Controller
 * Handles HTTP requests and delegates business logic to service layer
 */
import { Response } from 'express';

// Removed express-validator - using Zod validation in routes

import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { errorResponse, successResponse } from '../../../utils/apiResponse.js';
import { logger } from '../../../utils/logger.js';
import { machinesService } from './machines.service.js';
import { MachineCreateRequest, MachineUpdateRequest, MaintenanceRecordRequest } from './types.js';

// Error message constants
const ERROR_MESSAGES = {
  TENANT_ID_MISSING: 'Tenant ID missing',
  TENANT_OR_USER_ID_MISSING: 'Tenant ID or User ID missing',
  INVALID_MACHINE_ID: 'Invalid machine ID',
  INVALID_INPUT: 'Invalid input',
} as const;

// Helper type for filters
interface MachineFilters {
  status?: string;
  machine_type?: string;
  department_id?: number;
  search?: string;
  is_active?: boolean;
  needs_maintenance?: boolean;
}

/**
 * Build filters object from query parameters
 * @param query - The Express query object
 * @returns MachineFilters object
 */
function buildFiltersFromQuery(query: AuthenticatedRequest['query']): MachineFilters {
  const filters: MachineFilters = {};

  if (query['status'] !== undefined) {
    filters.status = query['status'] as string;
  }
  if (query['machineType'] !== undefined) {
    filters.machine_type = query['machineType'] as string;
  }
  if (query['departmentId'] !== undefined) {
    filters.department_id = Number.parseInt(query['departmentId'] as string);
  }
  if (query['search'] !== undefined) {
    filters.search = query['search'] as string;
  }
  if (query['isActive'] !== undefined) {
    filters.is_active = query['isActive'] === 'false' ? false : true;
  }
  if (query['needsMaintenance'] !== undefined) {
    filters.needs_maintenance = query['needsMaintenance'] === 'true';
  }

  return filters;
}

/**
 * Parse and validate machine ID from request params
 * @param idParam - The ID parameter string
 * @returns The parsed number or null if invalid
 */
function parseAndValidateMachineId(idParam: string | undefined): number | null {
  if (idParam === undefined) {
    return null;
  }
  const machineId = Number.parseInt(idParam);
  if (Number.isNaN(machineId)) {
    return null;
  }
  return machineId;
}

/**
 * Handle ServiceError responses
 * @param res - Express response object
 * @param error - The caught error
 * @param fallbackMessage - Fallback message for non-ServiceErrors
 */
function handleServiceError(res: Response, error: unknown, fallbackMessage: string): void {
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
    res.status(500).json(errorResponse('SERVER_ERROR', fallbackMessage));
  }
}

export const machinesController = {
  /**
   * List all machines with filters
   * GET /api/v2/machines
   * @param req - The request object
   * @param res - The response object
   */
  async listMachines(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.tenantId === undefined) {
        res.status(401).json(errorResponse('UNAUTHORIZED', ERROR_MESSAGES.TENANT_ID_MISSING));
        return;
      }

      const filters = buildFiltersFromQuery(req.query);
      const machines = await machinesService.listMachines(req.tenantId, filters);

      res.json(successResponse(machines));
    } catch (error: unknown) {
      logger.error('[Machines v2] List error:', error);
      handleServiceError(res, error, 'Failed to fetch machines');
    }
  },

  /**
   * Get machine by ID
   * GET /api/v2/machines/:id
   * @param req - The request object
   * @param res - The response object
   */
  async getMachine(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.tenantId === undefined) {
        res.status(401).json(errorResponse('UNAUTHORIZED', ERROR_MESSAGES.TENANT_ID_MISSING));
        return;
      }

      const machineId = parseAndValidateMachineId(req.params['id']);
      if (machineId === null) {
        res.status(400).json(errorResponse('INVALID_ID', ERROR_MESSAGES.INVALID_MACHINE_ID));
        return;
      }

      const machine = await machinesService.getMachineById(machineId, req.tenantId);
      res.json(successResponse(machine));
    } catch (error: unknown) {
      logger.error('[Machines v2] Get error:', error);
      handleServiceError(res, error, 'Failed to fetch machine');
    }
  },

  /**
   * Create new machine
   * POST /api/v2/machines
   * @param req - The request object
   * @param res - The response object
   */
  async createMachine(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.tenantId === undefined || req.userId === undefined) {
        res
          .status(401)
          .json(errorResponse('UNAUTHORIZED', ERROR_MESSAGES.TENANT_OR_USER_ID_MISSING));
        return;
      }

      const machine = await machinesService.createMachine(
        req.body as MachineCreateRequest,
        req.tenantId,
        req.userId,
        req.ip,
        req.headers['user-agent'],
      );

      res.status(201).json(successResponse(machine));
    } catch (error: unknown) {
      logger.error('[Machines v2] Create error:', error);
      handleServiceError(res, error, 'Failed to create machine');
    }
  },

  /**
   * Update machine
   * PUT /api/v2/machines/:id
   * @param req - The request object
   * @param res - The response object
   */
  async updateMachine(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.tenantId === undefined || req.userId === undefined) {
        res
          .status(401)
          .json(errorResponse('UNAUTHORIZED', ERROR_MESSAGES.TENANT_OR_USER_ID_MISSING));
        return;
      }

      const machineId = parseAndValidateMachineId(req.params['id']);
      if (machineId === null) {
        res.status(400).json(errorResponse('INVALID_ID', ERROR_MESSAGES.INVALID_MACHINE_ID));
        return;
      }

      const machine = await machinesService.updateMachine(
        machineId,
        req.body as MachineUpdateRequest,
        req.tenantId,
        req.userId,
        req.ip,
        req.headers['user-agent'],
      );

      res.json(successResponse(machine));
    } catch (error: unknown) {
      logger.error('[Machines v2] Update error:', error);
      handleServiceError(res, error, 'Failed to update machine');
    }
  },

  /**
   * Delete machine (hard delete)
   * DELETE /api/v2/machines/:id
   * @param req - The request object
   * @param res - The response object
   */
  async deleteMachine(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.tenantId === undefined || req.userId === undefined) {
        res
          .status(401)
          .json(errorResponse('UNAUTHORIZED', ERROR_MESSAGES.TENANT_OR_USER_ID_MISSING));
        return;
      }

      const machineId = parseAndValidateMachineId(req.params['id']);
      if (machineId === null) {
        res.status(400).json(errorResponse('INVALID_ID', ERROR_MESSAGES.INVALID_MACHINE_ID));
        return;
      }

      await machinesService.deleteMachine(
        machineId,
        req.tenantId,
        req.userId,
        req.ip,
        req.headers['user-agent'],
      );

      res.json(successResponse({ message: 'Machine deleted successfully' }));
    } catch (error: unknown) {
      logger.error('[Machines v2] Delete error:', error);
      handleServiceError(res, error, 'Failed to delete machine');
    }
  },

  /**
   * Deactivate machine
   * PUT /api/v2/machines/:id/deactivate
   * @param req - The request object
   * @param res - The response object
   */
  async deactivateMachine(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.tenantId === undefined || req.userId === undefined) {
        res
          .status(401)
          .json(errorResponse('UNAUTHORIZED', ERROR_MESSAGES.TENANT_OR_USER_ID_MISSING));
        return;
      }

      const machineId = parseAndValidateMachineId(req.params['id']);
      if (machineId === null) {
        res.status(400).json(errorResponse('INVALID_ID', ERROR_MESSAGES.INVALID_MACHINE_ID));
        return;
      }

      await machinesService.deactivateMachine(
        machineId,
        req.tenantId,
        req.userId,
        req.ip,
        req.headers['user-agent'],
      );

      res.json(successResponse({ message: 'Machine deactivated successfully' }));
    } catch (error: unknown) {
      logger.error('[Machines v2] Deactivate error:', error);
      handleServiceError(res, error, 'Failed to deactivate machine');
    }
  },

  /**
   * Activate machine
   * PUT /api/v2/machines/:id/activate
   * @param req - The request object
   * @param res - The response object
   */
  async activateMachine(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.tenantId === undefined || req.userId === undefined) {
        res
          .status(401)
          .json(errorResponse('UNAUTHORIZED', ERROR_MESSAGES.TENANT_OR_USER_ID_MISSING));
        return;
      }

      const machineId = parseAndValidateMachineId(req.params['id']);
      if (machineId === null) {
        res.status(400).json(errorResponse('INVALID_ID', ERROR_MESSAGES.INVALID_MACHINE_ID));
        return;
      }

      await machinesService.activateMachine(
        machineId,
        req.tenantId,
        req.userId,
        req.ip,
        req.headers['user-agent'],
      );

      res.json(successResponse({ message: 'Machine activated successfully' }));
    } catch (error: unknown) {
      logger.error('[Machines v2] Activate error:', error);
      handleServiceError(res, error, 'Failed to activate machine');
    }
  },

  /**
   * Get maintenance history for a machine
   * GET /api/v2/machines/:id/maintenance
   * @param req - The request object
   * @param res - The response object
   */
  async getMaintenanceHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.tenantId === undefined) {
        res.status(401).json(errorResponse('UNAUTHORIZED', ERROR_MESSAGES.TENANT_ID_MISSING));
        return;
      }

      const machineId = parseAndValidateMachineId(req.params['id']);
      if (machineId === null) {
        res.status(400).json(errorResponse('INVALID_ID', ERROR_MESSAGES.INVALID_MACHINE_ID));
        return;
      }

      const history = await machinesService.getMaintenanceHistory(machineId, req.tenantId);
      res.json(successResponse(history));
    } catch (error: unknown) {
      logger.error('[Machines v2] Get maintenance history error:', error);
      handleServiceError(res, error, 'Failed to fetch maintenance history');
    }
  },

  /**
   * Add maintenance record
   * POST /api/v2/machines/maintenance
   * @param req - The request object
   * @param res - The response object
   */
  async addMaintenanceRecord(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.tenantId === undefined || req.userId === undefined) {
        res
          .status(401)
          .json(errorResponse('UNAUTHORIZED', ERROR_MESSAGES.TENANT_OR_USER_ID_MISSING));
        return;
      }

      const record = await machinesService.addMaintenanceRecord(
        req.body as MaintenanceRecordRequest,
        req.tenantId,
        req.userId,
        req.ip,
        req.headers['user-agent'],
      );

      res.status(201).json(successResponse(record));
    } catch (error: unknown) {
      logger.error('[Machines v2] Add maintenance record error:', error);
      handleServiceError(res, error, 'Failed to add maintenance record');
    }
  },

  /**
   * Get upcoming maintenance
   * GET /api/v2/machines/upcoming-maintenance
   * @param req - The request object
   * @param res - The response object
   */
  async getUpcomingMaintenance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.tenantId === undefined) {
        res.status(401).json(errorResponse('UNAUTHORIZED', ERROR_MESSAGES.TENANT_ID_MISSING));
        return;
      }

      const daysParam = req.query['days'];
      const days = daysParam !== undefined ? Number.parseInt(daysParam as string) : 30;
      if (Number.isNaN(days) || days < 1 || days > 365) {
        res.status(400).json(errorResponse('INVALID_DAYS', 'Days must be between 1 and 365'));
        return;
      }

      const machines = await machinesService.getUpcomingMaintenance(req.tenantId, days);
      res.json(successResponse(machines));
    } catch (error: unknown) {
      logger.error('[Machines v2] Get upcoming maintenance error:', error);
      handleServiceError(res, error, 'Failed to fetch upcoming maintenance');
    }
  },

  /**
   * Get machine statistics
   * GET /api/v2/machines/statistics
   * @param req - The request object
   * @param res - The response object
   */
  async getStatistics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.tenantId === undefined) {
        res.status(401).json(errorResponse('UNAUTHORIZED', ERROR_MESSAGES.TENANT_ID_MISSING));
        return;
      }

      const stats = await machinesService.getStatistics(req.tenantId);
      res.json(successResponse(stats));
    } catch (error: unknown) {
      logger.error('[Machines v2] Get statistics error:', error);
      handleServiceError(res, error, 'Failed to fetch statistics');
    }
  },

  /**
   * Get machine categories
   * GET /api/v2/machines/categories
   * @param _req - The _req parameter
   * @param res - The response object
   */
  async getCategories(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const categories = await machinesService.getCategories();
      res.json(successResponse(categories));
    } catch (error: unknown) {
      logger.error('[Machines v2] Get categories error:', error);
      handleServiceError(res, error, 'Failed to fetch categories');
    }
  },
};
