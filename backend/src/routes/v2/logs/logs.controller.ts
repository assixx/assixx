import bcrypt from "bcryptjs";
import { Response } from "express";

import User from "../../../models/user.js";
import { AuthenticatedRequest } from "../../../types/request.types.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { logger } from "../../../utils/logger.js";

import { logsService } from "./logs.service.js";
import { LogsFilterParams } from "./types.js";


export const logsController = {
  /**
   * Get logs with filters
   * GET /api/v2/logs
   */
  async getLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Only root users can access logs
      if (req.user?.role !== 'root') {
        res.status(403).json(errorResponse("FORBIDDEN", "Only root users can access logs"));
        return;
      }

      const filters: LogsFilterParams = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
        tenantId: req.query.tenantId ? parseInt(req.query.tenantId as string) : undefined,
        action: req.query.action as string,
        entityType: req.query.entityType as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        search: req.query.search as string,
      };

      const result = await logsService.getLogs(filters);
      res.json(successResponse(result));
    } catch (error) {
      logger.error("[Logs v2] Error fetching logs:", error);
      res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch logs"));
    }
  },

  /**
   * Get log statistics
   * GET /api/v2/logs/stats
   */
  async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Only root users can access logs
      if (req.user?.role !== 'root') {
        res.status(403).json(errorResponse("FORBIDDEN", "Only root users can access logs"));
        return;
      }

      const stats = await logsService.getStats();
      res.json(successResponse(stats));
    } catch (error) {
      logger.error("[Logs v2] Error fetching stats:", error);
      res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch statistics"));
    }
  },

  /**
   * Delete logs with filters
   * DELETE /api/v2/logs
   */
  async deleteLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Only root users can delete logs
      if (req.user?.role !== 'root') {
        res.status(403).json(errorResponse("FORBIDDEN", "Only root users can delete logs"));
        return;
      }

      const { userId, tenantId, olderThanDays, confirmPassword } = req.body as {
        userId?: number;
        tenantId?: number;
        olderThanDays?: number;
        confirmPassword: string;
      };

      // Verify root password
      const rootUser = await User.findById(req.user.id, req.user.tenant_id);
      if (!rootUser) {
        res.status(401).json(errorResponse("UNAUTHORIZED", "User not found"));
        return;
      }

      const isValidPassword = await bcrypt.compare(confirmPassword, rootUser.password);
      if (!isValidPassword) {
        res.status(401).json(errorResponse("UNAUTHORIZED", "Invalid password"));
        return;
      }

      // At least one filter must be provided
      if (!userId && !tenantId && !olderThanDays) {
        res.status(400).json(
          errorResponse("VALIDATION_ERROR", "At least one filter must be provided")
        );
        return;
      }

      const deletedCount = await logsService.deleteLogs({
        userId,
        tenantId,
        olderThanDays
      });

      logger.info(`[Logs v2] Root user ${req.user.id} deleted ${deletedCount} logs`, {
        filters: { userId, tenantId, olderThanDays }
      });

      res.json(successResponse({
        message: `Successfully deleted ${deletedCount} logs`,
        deletedCount
      }));
    } catch (error) {
      logger.error("[Logs v2] Error deleting logs:", error);
      res.status(500).json(errorResponse("SERVER_ERROR", "Failed to delete logs"));
    }
  },
};