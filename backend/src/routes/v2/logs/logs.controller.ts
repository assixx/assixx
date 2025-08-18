import bcrypt from "bcryptjs";
import { Response } from "express";
import { logsService } from "./logs.service.js";
import { LogsFilterParams } from "./types.js";
import User from "../../../models/user.js";
import type { AuthenticatedRequest } from "../../../types/request.types.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { logger } from "../../../utils/logger.js";


export const logsController = {
  /**
   * Get logs with filters
   * GET /api/v2/logs
   * @param req
   * @param res
   */
  async getLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    console.log("===== LOGS V2 CONTROLLER GETLOGS CALLED =====");
    console.log("Query params:", req.query);
    console.log("User:", req.user);

    logger.info("[Logs v2 Controller] =====START===== getLogs endpoint called");
    logger.info("[Logs v2 Controller] Query params:", req.query);
    logger.info("[Logs v2 Controller] User info:", {
      id: req.user?.id,
      role: req.user?.role,
    });

    try {
      // Only root users can access logs
      if (req.user?.role !== "root") {
        logger.warn(
          "[Logs v2 Controller] Access denied - user role:",
          req.user?.role,
        );
        res
          .status(403)
          .json(errorResponse("FORBIDDEN", "Only root users can access logs"));
        return;
      }

      logger.info("[Logs v2 Controller] User is root, proceeding");

      // Support both 'offset' and 'page' parameters for compatibility
      const limit = req.query.limit
        ? Number.parseInt(req.query.limit as string)
        : 50;
      let page = 1;

      if (req.query.offset !== undefined) {
        // If offset is provided, calculate page from it
        const offset = Number.parseInt(req.query.offset as string);
        page = Math.floor(offset / limit) + 1;
        logger.info(
          `[Logs v2] Converting offset ${offset} to page ${page} (limit: ${limit})`,
        );
      } else if (req.query.page) {
        // Otherwise use page directly
        page = Number.parseInt(req.query.page as string);
      }

      const filters: LogsFilterParams = {
        page,
        limit,
        userId: req.query.userId
          ? Number.parseInt(req.query.userId as string)
          : undefined,
        tenantId: req.query.tenantId
          ? Number.parseInt(req.query.tenantId as string)
          : undefined,
        action: req.query.action as string,
        entityType: req.query.entityType as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        search: req.query.search as string,
      };

      logger.info("[Logs v2] Fetching logs with filters:", filters);
      const result = await logsService.getLogs(filters);
      logger.info(`[Logs v2] Successfully fetched ${result.logs.length} logs`);
      res.json(successResponse(result));
    } catch (error: unknown) {
      console.error("===== LOGS V2 CONTROLLER ERROR =====");
      console.error("Error:", error);
      console.error("Stack:", (error as Error).stack);
      logger.error("[Logs v2] Error fetching logs - Details:", error);
      logger.error("[Logs v2] Error stack:", (error as Error).stack);
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to fetch logs"));
    }
  },

  /**
   * Get log statistics
   * GET /api/v2/logs/stats
   * @param req
   * @param res
   */
  async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Only root users can access logs
      if (req.user?.role !== "root") {
        res
          .status(403)
          .json(errorResponse("FORBIDDEN", "Only root users can access logs"));
        return;
      }

      const stats = await logsService.getStats();
      res.json(successResponse(stats));
    } catch (error: unknown) {
      logger.error("[Logs v2] Error fetching stats:", error);
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to fetch statistics"));
    }
  },

  /**
   * Delete logs with filters
   * DELETE /api/v2/logs
   * @param req
   * @param res
   */
  async deleteLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Only root users can delete logs
      if (req.user?.role !== "root") {
        res
          .status(403)
          .json(errorResponse("FORBIDDEN", "Only root users can delete logs"));
        return;
      }

      const {
        userId,
        tenantId,
        olderThanDays,
        action,
        entityType,
        confirmPassword,
      } = req.body as {
        userId?: number;
        tenantId?: number;
        olderThanDays?: number;
        action?: string;
        entityType?: string;
        confirmPassword: string;
      };

      logger.info(`[Logs v2 DELETE] Request body:`, {
        userId,
        tenantId,
        olderThanDays,
        action,
        entityType,
        confirmPassword: "***",
      });
      console.log("[Logs v2 DELETE] Filters:", {
        userId,
        tenantId,
        olderThanDays,
        action,
        entityType,
      });

      // Verify root password
      const rootUser = await User.findById(req.user.id, req.user.tenant_id);
      if (!rootUser) {
        res.status(401).json(errorResponse("UNAUTHORIZED", "User not found"));
        return;
      }

      const isValidPassword = await bcrypt.compare(
        confirmPassword,
        rootUser.password,
      );
      if (!isValidPassword) {
        res.status(401).json(errorResponse("UNAUTHORIZED", "Invalid password"));
        return;
      }

      // At least one filter must be provided
      if (
        !userId &&
        !tenantId &&
        olderThanDays === undefined &&
        !action &&
        !entityType
      ) {
        res
          .status(400)
          .json(
            errorResponse(
              "VALIDATION_ERROR",
              "At least one filter must be provided",
            ),
          );
        return;
      }

      const deletedCount = await logsService.deleteLogs({
        userId,
        tenantId,
        olderThanDays,
        action,
        entityType,
      });

      logger.info(
        `[Logs v2] Root user ${req.user.id} deleted ${deletedCount} logs`,
        {
          filters: { userId, tenantId, olderThanDays },
        },
      );

      res.json(
        successResponse({
          message: `Successfully deleted ${deletedCount} logs`,
          deletedCount,
        }),
      );
    } catch (error: unknown) {
      logger.error("[Logs v2] Error deleting logs:", error);
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to delete logs"));
    }
  },
};
