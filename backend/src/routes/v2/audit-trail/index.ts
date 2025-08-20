/**
 * Audit Trail API v2 Routes
 * Complete audit logging and compliance reporting system
 * @swagger
 * tags:
 *   name: Audit Trail v2
 *   description: Audit logging and compliance API v2
 */
import express, { RequestHandler, Router } from 'express';

import { authenticateV2, requireRoleV2 } from '../../../middleware/v2/auth.middleware.js';
import { typed } from '../../../utils/routeHandlers.js';
import { auditTrailController } from './audit-trail.controller.js';
import { auditTrailValidation } from './audit-trail.validation.js';

const router: Router = express.Router();

// Middleware groups
const userAuth = [authenticateV2 as RequestHandler];
const adminAuth = [
  authenticateV2 as RequestHandler,
  requireRoleV2(['admin', 'root']) as RequestHandler,
];
const rootAuth = [authenticateV2 as RequestHandler, requireRoleV2(['root']) as RequestHandler];

/**
 * @swagger
 * /api/v2/audit-trail:
 *   get:
 *     summary: Get audit entries
 *     description: Retrieve audit trail entries with optional filters. Users can only see their own entries unless they are root.
 *     tags: [Audit Trail v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: query
 *         description: Filter by user ID (root only)
 *         schema:
 *           type: integer
 *       - name: action
 *         in: query
 *         description: Filter by action type
 *         schema:
 *           type: string
 *       - name: resourceType
 *         in: query
 *         description: Filter by resource type
 *         schema:
 *           type: string
 *       - name: resourceId
 *         in: query
 *         description: Filter by resource ID
 *         schema:
 *           type: integer
 *       - name: status
 *         in: query
 *         description: Filter by status
 *         schema:
 *           type: string
 *           enum: [success, failure]
 *       - name: dateFrom
 *         in: query
 *         description: Start date (ISO 8601)
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: dateTo
 *         in: query
 *         description: End date (ISO 8601)
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: search
 *         in: query
 *         description: Search in user name, resource name, or action
 *         schema:
 *           type: string
 *       - name: page
 *         in: query
 *         description: Page number
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - name: limit
 *         in: query
 *         description: Items per page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - name: sortBy
 *         in: query
 *         description: Sort field
 *         schema:
 *           type: string
 *           enum: [created_at, action, user_id, resource_type]
 *           default: created_at
 *       - name: sortOrder
 *         in: query
 *         description: Sort order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Audit entries retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     entries:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/AuditEntry'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get(
  '/',
  ...userAuth,
  auditTrailValidation.getEntries,
  typed.auth(auditTrailController.getEntries),
);

/**
 * @swagger
 * /api/v2/audit-trail/stats:
 *   get:
 *     summary: Get audit statistics
 *     description: Get aggregated statistics from audit trail (admin/root only)
 *     tags: [Audit Trail v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: dateFrom
 *         in: query
 *         description: Start date (ISO 8601)
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: dateTo
 *         in: query
 *         description: End date (ISO 8601)
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AuditStats'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get(
  '/stats',
  ...adminAuth,
  auditTrailValidation.getStats,
  typed.auth(auditTrailController.getStats),
);

/**
 * @swagger
 * /api/v2/audit-trail/reports:
 *   post:
 *     summary: Generate compliance report
 *     description: Generate a compliance report based on audit trail data (admin/root only)
 *     tags: [Audit Trail v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reportType
 *               - dateFrom
 *               - dateTo
 *             properties:
 *               reportType:
 *                 type: string
 *                 enum: [gdpr, data_access, data_changes, user_activity]
 *                 description: Type of compliance report
 *               dateFrom:
 *                 type: string
 *                 format: date-time
 *                 description: Start date for the report
 *               dateTo:
 *                 type: string
 *                 format: date-time
 *                 description: End date for the report
 *     responses:
 *       200:
 *         description: Report generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ComplianceReport'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post(
  '/reports',
  ...adminAuth,
  auditTrailValidation.generateReport,
  typed.body<{ reportType: string; dateFrom: string; dateTo: string }>(async (req, res) => {
    await auditTrailController.generateReport(req, res);
  }),
);

/**
 * @swagger
 * /api/v2/audit-trail/export:
 *   get:
 *     summary: Export audit entries
 *     description: Export audit entries in JSON or CSV format (admin/root only)
 *     tags: [Audit Trail v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: format
 *         in: query
 *         description: Export format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *       - name: dateFrom
 *         in: query
 *         description: Start date (ISO 8601)
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: dateTo
 *         in: query
 *         description: End date (ISO 8601)
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Export successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *           text/csv:
 *             schema:
 *               type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get(
  '/export',
  ...adminAuth,
  auditTrailValidation.exportEntries,
  typed.auth(auditTrailController.exportEntries),
);

/**
 * @swagger
 * /api/v2/audit-trail/retention:
 *   delete:
 *     summary: Delete old audit entries
 *     description: Delete audit entries older than specified days (root only, minimum 90 days)
 *     tags: [Audit Trail v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - olderThanDays
 *               - confirmPassword
 *             properties:
 *               olderThanDays:
 *                 type: integer
 *                 minimum: 90
 *                 description: Delete entries older than this many days
 *               confirmPassword:
 *                 type: string
 *                 description: User's password for confirmation
 *     responses:
 *       200:
 *         description: Entries deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedCount:
 *                       type: integer
 *                     cutoffDate:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.delete(
  '/retention',
  ...rootAuth,
  auditTrailValidation.deleteOldEntries,
  typed.body<{ olderThanDays: number; confirmPassword: string }>(async (req, res) => {
    await auditTrailController.deleteOldEntries(req, res);
  }),
);

/**
 * @swagger
 * /api/v2/audit-trail/{id}:
 *   get:
 *     summary: Get specific audit entry
 *     description: Get a specific audit entry by ID. Users can only see their own entries unless they are root.
 *     tags: [Audit Trail v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Audit entry ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Entry retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AuditEntry'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  '/:id',
  ...userAuth,
  auditTrailValidation.getEntry,
  typed.auth(auditTrailController.getEntry),
);

export default router;
