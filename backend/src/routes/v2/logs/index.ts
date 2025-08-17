/**
 * Logs API v2 Routes
 * Root-only access to system audit logs
 * @swagger
 * tags:
 *   name: Logs v2
 *   description: System audit logs API v2 (Root only)
 */

import express, { Router, RequestHandler } from "express";

import { authenticateV2, requireRoleV2 } from "../../../middleware/v2/auth.middleware.js";
import { typed } from "../../../utils/routeHandlers.js";

import { logsController } from "./logs.controller.js";
import { logsValidation } from "./logs.validation.js";

const router: Router = express.Router();

/**
 * @param handler
 * @swagger
 * /api/v2/logs:
 *   get:
 *     summary: Get system logs
 *     description: Retrieve system audit logs with filters (Root only)
 *     tags: [Logs v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: userId
 *         in: query
 *         description: Filter by user ID
 *         schema:
 *           type: integer
 *       - name: tenantId
 *         in: query
 *         description: Filter by tenant ID
 *         schema:
 *           type: integer
 *       - name: action
 *         in: query
 *         description: Filter by action type
 *         schema:
 *           type: string
 *       - name: entityType
 *         in: query
 *         description: Filter by entity type
 *         schema:
 *           type: string
 *       - name: startDate
 *         in: query
 *         description: Filter logs after this date
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: endDate
 *         in: query
 *         description: Filter logs before this date
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: search
 *         in: query
 *         description: Search in user names, emails, actions, entity types
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved logs
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         logs:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/LogEntryV2'
 *                         pagination:
 *                           $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
// Temporärer Debug-Wrapper
const debugWrapper = (handler: RequestHandler): RequestHandler => {
  return async (req, res, next) => {
    console.log("[LOGS DEBUG] Request received at /api/v2/logs");
    console.log("[LOGS DEBUG] Query params:", req.query);
    console.log("[LOGS DEBUG] User:", req.user);
    try {
      await handler(req, res, next);
    } catch (error: unknown) {
      console.error("[LOGS DEBUG] Error in handler:", error);
      throw error;
    }
  };
};

router.get(
  "/",
  authenticateV2 as RequestHandler,
  requireRoleV2(["root"]) as RequestHandler,
  logsValidation.listLogs,
  debugWrapper(typed.auth(logsController.getLogs))
);

/**
 * @swagger
 * /api/v2/logs/stats:
 *   get:
 *     summary: Get log statistics
 *     description: Get statistical overview of system logs (Root only)
 *     tags: [Logs v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved statistics
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         totalLogs:
 *                           type: integer
 *                           description: Total number of logs
 *                         todayLogs:
 *                           type: integer
 *                           description: Number of logs created today
 *                         uniqueUsers:
 *                           type: integer
 *                           description: Number of unique users in logs
 *                         uniqueTenants:
 *                           type: integer
 *                           description: Number of unique tenants in logs
 *                         topActions:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               action:
 *                                 type: string
 *                               count:
 *                                 type: integer
 *                         topUsers:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               userId:
 *                                 type: integer
 *                               userName:
 *                                 type: string
 *                               count:
 *                                 type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get(
  "/stats",
  authenticateV2 as RequestHandler,
  requireRoleV2(["root"]) as RequestHandler,
  typed.auth(logsController.getStats)
);

/**
 * @swagger
 * /api/v2/logs:
 *   delete:
 *     summary: Delete logs
 *     description: Delete logs based on filters (Root only, requires password confirmation)
 *     tags: [Logs v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - confirmPassword
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: Delete logs for specific user
 *               tenantId:
 *                 type: integer
 *                 description: Delete logs for specific tenant
 *               olderThanDays:
 *                 type: integer
 *                 description: Delete logs older than specified days
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 description: Root user password confirmation
 *     responses:
 *       200:
 *         description: Successfully deleted logs
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         message:
 *                           type: string
 *                         deletedCount:
 *                           type: integer
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.delete(
  "/",
  authenticateV2 as RequestHandler,
  requireRoleV2(["root"]) as RequestHandler,
  logsValidation.deleteLogs,
  typed.auth(logsController.deleteLogs)
);

export default router;