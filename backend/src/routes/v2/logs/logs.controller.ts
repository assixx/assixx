import bcrypt from "bcryptjs";
import { Response } from "express";
import user from "../users/model/index.js";
import type { AuthenticatedRequest } from "../../../types/request.types.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { logger } from "../../../utils/logger.js";
import { logsService } from "./logs.service.js";
import { LogsFilterParams } from "./types.js";

/**
 * Check if query parameter has a value
 */
function hasQueryParam(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

/**
 * Parse query parameter as integer with default value
 */
function parseQueryInt(value: unknown, defaultValue: number): number {
  if (!hasQueryParam(value)) return defaultValue;
  const parsed = Number.parseInt(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

// Delete filter input type (with | undefined for exactOptionalPropertyTypes)
interface DeleteFilterInput {
  userId?: number | undefined;
  tenantId?: number | undefined;
  olderThanDays?: number | undefined;
  action?: string | undefined;
  entityType?: string | undefined;
  search?: string | undefined; // Search filter for name, email, department, etc.
}

// Delete filter output type (matches service parameter)
interface DeleteFilterOutput {
  userId?: number;
  tenantId?: number;
  olderThanDays?: number;
  action?: string;
  entityType?: string;
  search?: string;
}

/**
 * Check if at least one delete filter is provided
 */
function hasAnyDeleteFilter(input: DeleteFilterInput): boolean {
  return (
    input.userId !== undefined ||
    input.tenantId !== undefined ||
    input.olderThanDays !== undefined ||
    (input.action !== undefined && input.action !== '') ||
    (input.entityType !== undefined && input.entityType !== '') ||
    (input.search !== undefined && input.search !== '')
  );
}

/**
 * Build delete filters with tenant isolation
 */
function buildDeleteFilters(input: DeleteFilterInput, enforcedTenantId: number): DeleteFilterOutput {
  const filters: DeleteFilterOutput = {
    tenantId: enforcedTenantId, // Always enforce tenant isolation
  };

  if (input.userId !== undefined) {
    filters.userId = input.userId;
  }
  if (input.olderThanDays !== undefined) {
    filters.olderThanDays = input.olderThanDays;
  }
  if (input.action !== undefined && input.action !== '') {
    filters.action = input.action;
  }
  if (input.entityType !== undefined && input.entityType !== '') {
    filters.entityType = input.entityType;
  }
  if (input.search !== undefined && input.search !== '') {
    filters.search = input.search;
  }

  return filters;
}


export const logsController = {
  /**
   * Get logs with filters
   * GET /api/v2/logs
   * @param req - The request object
   * @param res - The response object
   */
  async getLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    console.log("===== LOGS V2 CONTROLLER GETLOGS CALLED =====");
    console.log("Query params:", req.query);
    console.log("User:", req.user);
    
    logger.info("[Logs v2 Controller] =====START===== getLogs endpoint called");
    logger.info("[Logs v2 Controller] Query params:", req.query);
    logger.info("[Logs v2 Controller] User info:", { id: req.user.id, role: req.user.role });
    
    try {
      // Only root users can access logs
      if (req.user.role !== 'root') {
        logger.warn("[Logs v2 Controller] Access denied - user role:", req.user.role);
        res.status(403).json(errorResponse("FORBIDDEN", "Only root users can access logs"));
        return;
      }
      
      logger.info("[Logs v2 Controller] User is root, proceeding");

      // Support both 'offset' and 'page' parameters for compatibility
      const limit = parseQueryInt(req.query['limit'], 50);
      let page = 1;

      if (hasQueryParam(req.query['offset'])) {
        // If offset is provided, calculate page from it
        const offset = Number.parseInt(req.query['offset']);
        page = Math.floor(offset / limit) + 1;
        logger.info(`[Logs v2] Converting offset ${offset} to page ${page} (limit: ${limit})`);
      } else if (hasQueryParam(req.query['page'])) {
        // Otherwise use page directly
        page = Number.parseInt(req.query['page']);
      }

      // KRITISCH: IMMER nach tenant_id des angemeldeten Users filtern!
      // Dies ist essentiell für Multi-Tenant-Isolation
      const filters: LogsFilterParams = {
        page,
        limit,
        tenantId: req.user.tenant_id, // IMMER die tenant_id des angemeldeten Users verwenden!
      };

      // Only add optional properties if they are defined
      if (hasQueryParam(req.query['userId'])) {
        filters.userId = Number.parseInt(req.query['userId']);
      }
      if (hasQueryParam(req.query['action'])) {
        filters.action = req.query['action'];
      }
      if (hasQueryParam(req.query['entityType'])) {
        filters.entityType = req.query['entityType'];
      }
      if (hasQueryParam(req.query['startDate'])) {
        filters.startDate = req.query['startDate'];
      }
      if (hasQueryParam(req.query['endDate'])) {
        filters.endDate = req.query['endDate'];
      }
      if (hasQueryParam(req.query['search'])) {
        filters.search = req.query['search'];
      }

      logger.info("[Logs v2] Fetching logs with filters (tenant_id enforced):", filters);
      const result = await logsService.getLogs(filters);
      logger.info(`[Logs v2] Successfully fetched ${result.logs.length} logs`);
      res.json(successResponse(result));
    } catch (error: unknown) {
      console.error("===== LOGS V2 CONTROLLER ERROR =====");
      console.error("Error:", error);
      console.error("Stack:", (error as Error).stack);
      logger.error("[Logs v2] Error fetching logs - Details:", error);
      logger.error("[Logs v2] Error stack:", (error as Error).stack);
      res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch logs"));
    }
  },

  /**
   * Get log statistics
   * GET /api/v2/logs/stats
   * @param req - The request object
   * @param res - The response object
   */
  async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Only root users can access logs
      if (req.user.role !== 'root') {
        res.status(403).json(errorResponse("FORBIDDEN", "Only root users can access logs"));
        return;
      }

      // KRITISCH: Stats nur für den eigenen Tenant!
      const stats = await logsService.getStats(req.user.tenant_id);
      res.json(successResponse(stats));
    } catch (error: unknown) {
      logger.error("[Logs v2] Error fetching stats:", error);
      res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch statistics"));
    }
  },

  /**
   * Delete logs with filters
   * DELETE /api/v2/logs
   * @param req - The request object
   * @param res - The response object
   */
  async deleteLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Only root users can delete logs
      if (req.user.role !== 'root') {
        res.status(403).json(errorResponse("FORBIDDEN", "Only root users can delete logs"));
        return;
      }

      const body = req.body as DeleteFilterInput & { confirmPassword: string };
      const filterInput: DeleteFilterInput = {
        userId: body.userId,
        tenantId: body.tenantId,
        olderThanDays: body.olderThanDays,
        action: body.action,
        entityType: body.entityType,
        search: body.search,
      };

      logger.info(`[Logs v2 DELETE] Request body:`, { ...filterInput, confirmPassword: '***' });

      // Verify root password
      const rootUser = await user.findById(req.user.id, req.user.tenant_id);
      if (rootUser === undefined) {
        res.status(401).json(errorResponse("UNAUTHORIZED", "User not found"));
        return;
      }

      const isValidPassword = await bcrypt.compare(body.confirmPassword, rootUser.password);
      if (!isValidPassword) {
        res.status(401).json(errorResponse("UNAUTHORIZED", "Invalid password"));
        return;
      }

      // At least one filter must be provided
      if (!hasAnyDeleteFilter(filterInput)) {
        res.status(400).json(errorResponse("VALIDATION_ERROR", "At least one filter must be provided"));
        return;
      }

      // KRITISCH: Nur Logs des eigenen Tenants dürfen gelöscht werden!
      const deleteFilters = buildDeleteFilters(filterInput, req.user.tenant_id);
      const deletedCount = await logsService.deleteLogs(deleteFilters);

      logger.info(`[Logs v2] Root user ${req.user.id} deleted ${deletedCount} logs`, { filters: filterInput });
      res.json(successResponse({ message: `Successfully deleted ${deletedCount} logs`, deletedCount }));
    } catch (error: unknown) {
      logger.error("[Logs v2] Error deleting logs:", error);
      res.status(500).json(errorResponse("SERVER_ERROR", "Failed to delete logs"));
    }
  },
};