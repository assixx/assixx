/**
 * Shifts API v2 Routes
 *
 * OpenAPI/Swagger documentation:
 * Tags:
 *   - name: Shifts v2
 *     description: Shift planning and management API v2
 */
import { Router } from 'express';

import { authenticateV2 } from '../../../middleware/v2/auth.middleware';
import { requireRoleV2 } from '../../../middleware/v2/roleCheck.middleware';
import { typed } from '../../../utils/routeHandlers';
import * as shiftsController from './shifts.controller';
import { shiftsValidation } from './shifts.validation';

const router = Router();

// Route constants
const ROUTES = {
  TEMPLATE_BY_ID: '/templates/:id',
} as const;

// ============= SHIFTS CRUD =============

/**
 * /api/v2/shifts:
 *   get:
 *     summary: List shifts
 *     tags: [Shifts v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by specific date
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: Filter by user ID
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: integer
 *         description: Filter by department ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [planned, confirmed, in_progress, completed, cancelled]
 *         description: Filter by status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [regular, overtime, standby, vacation, sick, holiday]
 *         description: Filter by type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: Shifts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShiftListResponseV2'
 */
router.get(
  '/',
  authenticateV2,
  shiftsValidation.listShifts,
  typed.auth(shiftsController.listShifts),
);

// ============= TEMPLATES (MUST BE BEFORE /:id) =============

/**
 * /api/v2/shifts/templates:
 *   get:
 *     summary: List shift templates
 *     tags: [Shifts v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Templates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplateListResponseV2'
 */
router.get('/templates', authenticateV2, typed.auth(shiftsController.listTemplates));

/**
 * /api/v2/shifts/templates/{id}:
 *   get:
 *     summary: Get template by ID
 *     tags: [Shifts v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Template retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplateResponseV2'
 *       404:
 *         description: Template not found
 */
router.get(
  ROUTES.TEMPLATE_BY_ID,
  authenticateV2,
  shiftsValidation.getTemplateById,
  typed.auth(shiftsController.getTemplateById),
);

/**
 * /api/v2/shifts/templates:
 *   post:
 *     summary: Create shift template
 *     tags: [Shifts v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTemplateRequestV2'
 *     responses:
 *       201:
 *         description: Template created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplateResponseV2'
 */
router.post(
  '/templates',
  authenticateV2,
  requireRoleV2(['admin', 'root']),
  shiftsValidation.createTemplate,
  typed.auth(shiftsController.createTemplate),
);

/**
 * /api/v2/shifts/templates/{id}:
 *   put:
 *     summary: Update shift template
 *     tags: [Shifts v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Template ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateTemplateRequestV2'
 *     responses:
 *       200:
 *         description: Template updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplateResponseV2'
 *       404:
 *         description: Template not found
 */
router.put(
  ROUTES.TEMPLATE_BY_ID,
  authenticateV2,
  requireRoleV2(['admin', 'root']),
  shiftsValidation.updateTemplate,
  typed.auth(shiftsController.updateTemplate),
);

/**
 * /api/v2/shifts/templates/{id}:
 *   delete:
 *     summary: Delete shift template
 *     tags: [Shifts v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Template deleted successfully
 *       404:
 *         description: Template not found
 */
router.delete(
  ROUTES.TEMPLATE_BY_ID,
  authenticateV2,
  requireRoleV2(['admin', 'root']),
  shiftsValidation.deleteTemplate,
  typed.auth(shiftsController.deleteTemplate),
);

// ============= SWAP REQUESTS (MUST BE BEFORE /:id) =============

/**
 * /api/v2/shifts/swap-requests:
 *   get:
 *     summary: List swap requests
 *     tags: [Shifts v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: Filter by user ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, cancelled]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Swap requests retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SwapRequestListResponseV2'
 */
router.get(
  '/swap-requests',
  authenticateV2,
  shiftsValidation.listSwapRequests,
  typed.auth(shiftsController.listSwapRequests),
);

/**
 * /api/v2/shifts/swap-requests:
 *   post:
 *     summary: Create swap request
 *     tags: [Shifts v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSwapRequestV2'
 *     responses:
 *       201:
 *         description: Swap request created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SwapRequestResponseV2'
 *       403:
 *         description: You can only request swaps for your own shifts
 *       404:
 *         description: Shift not found
 */
router.post(
  '/swap-requests',
  authenticateV2,
  shiftsValidation.createSwapRequest,
  typed.auth(shiftsController.createSwapRequest),
);

/**
 * /api/v2/shifts/swap-requests/{id}/status:
 *   put:
 *     summary: Update swap request status
 *     tags: [Shifts v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Swap request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected, cancelled]
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       404:
 *         description: Swap request not found
 */
router.put(
  '/swap-requests/:id/status',
  authenticateV2,
  requireRoleV2(['admin', 'root']),
  shiftsValidation.updateSwapRequestStatus,
  typed.auth(shiftsController.updateSwapRequestStatus),
);

// ============= OVERTIME (MUST BE BEFORE /:id) =============

/**
 * /api/v2/shifts/overtime:
 *   get:
 *     summary: Get overtime report
 *     tags: [Shifts v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: User ID (defaults to current user)
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for report
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for report
 *     responses:
 *       200:
 *         description: Overtime report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OvertimeReportResponseV2'
 *       400:
 *         description: Invalid date range
 */
router.get(
  '/overtime',
  authenticateV2,
  shiftsValidation.getOvertimeReport,
  typed.auth(shiftsController.getOvertimeReport),
);

// ============= EXPORT (MUST BE BEFORE /:id) =============

/**
 * /api/v2/shifts/export:
 *   get:
 *     summary: Export shifts
 *     tags: [Shifts v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for export
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for export
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: integer
 *         description: Filter by department ID
 *       - in: query
 *         name: teamId
 *         schema:
 *           type: integer
 *         description: Filter by team ID
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: Filter by user ID
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, excel]
 *           default: csv
 *         description: Export format
 *     responses:
 *       200:
 *         description: Export generated successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       501:
 *         description: Excel export not yet implemented
 */
router.get(
  '/export',
  authenticateV2,
  requireRoleV2(['admin', 'root']),
  shiftsValidation.exportShifts,
  typed.auth(shiftsController.exportShifts),
);

// ============= DYNAMIC ROUTES (MUST BE LAST) =============

/**
 * /api/v2/shifts/plan:
 *   get:
 *     summary: Get shift plan with all shifts and notes
 *     tags: [Shifts v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Shift plan retrieved successfully
 */
router.get('/plan', authenticateV2, typed.auth(shiftsController.getShiftPlan));

/**
 * @swagger
 * /api/v2/shifts/plan/{id}:
 *   put:
 *     summary: Update existing shift plan
 *     tags: [Shifts v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Plan ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               shiftNotes:
 *                 type: string
 *               departmentId:
 *                 type: integer
 *               teamId:
 *                 type: integer
 *               machineId:
 *                 type: integer
 *               areaId:
 *                 type: integer
 *               shifts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     date:
 *                       type: string
 *                       format: date
 *                     type:
 *                       type: string
 *                       enum: [early, late, night]
 *                     userId:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Plan updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Plan not found
 */
router.put('/plan/:id', authenticateV2, typed.auth(shiftsController.updateShiftPlan));

/**
 * /api/v2/shifts/{id}:
 *   get:
 *     summary: Get shift by ID
 *     tags: [Shifts v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Shift ID
 *     responses:
 *       200:
 *         description: Shift retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShiftResponseV2'
 *       404:
 *         description: Shift not found
 */
router.get(
  '/:id',
  authenticateV2,
  shiftsValidation.getShiftById,
  typed.auth(shiftsController.getShiftById),
);

/**
 * /api/v2/shifts:
 *   post:
 *     summary: Create new shift
 *     tags: [Shifts v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateShiftRequestV2'
 *     responses:
 *       201:
 *         description: Shift created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShiftResponseV2'
 */
router.post(
  '/',
  authenticateV2,
  requireRoleV2(['admin', 'root']),
  shiftsValidation.createShift,
  typed.auth(shiftsController.createShift),
);

/**
 * /api/v2/shifts/{id}:
 *   put:
 *     summary: Update shift
 *     tags: [Shifts v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Shift ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateShiftRequestV2'
 *     responses:
 *       200:
 *         description: Shift updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShiftResponseV2'
 *       404:
 *         description: Shift not found
 */
router.put(
  '/:id',
  authenticateV2,
  requireRoleV2(['admin', 'root']),
  shiftsValidation.updateShift,
  typed.auth(shiftsController.updateShift),
);

/**
 * /api/v2/shifts/{id}:
 *   delete:
 *     summary: Delete shift
 *     tags: [Shifts v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Shift ID
 *     responses:
 *       200:
 *         description: Shift deleted successfully
 *       404:
 *         description: Shift not found
 */
router.delete(
  '/:id',
  authenticateV2,
  requireRoleV2(['admin', 'root']),
  shiftsValidation.deleteShift,
  typed.auth(shiftsController.deleteShift),
);

// ============= SHIFT PLAN ENDPOINTS =============

/**
 * /api/v2/shifts/plan:
 *   post:
 *     summary: Create a complete shift plan with multiple shifts
 *     tags: [Shifts v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - startDate
 *               - endDate
 *               - departmentId
 *               - shifts
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               areaId:
 *                 type: integer
 *               departmentId:
 *                 type: integer
 *               teamId:
 *                 type: integer
 *               machineId:
 *                 type: integer
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               shifts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: integer
 *                     date:
 *                       type: string
 *                       format: date
 *                     type:
 *                       type: string
 *                       enum: [early, late, night, day, flexible]
 *                     startTime:
 *                       type: string
 *                       format: time
 *                     endTime:
 *                       type: string
 *                       format: time
 *               dailyNotes:
 *                 type: object
 *     responses:
 *       201:
 *         description: Shift plan created successfully
 */
router.post(
  '/plan',
  authenticateV2,
  requireRoleV2(['admin', 'root']),
  typed.auth(shiftsController.createShiftPlan),
);

/**
 * /api/v2/shifts/plan:
 *   get:
 *     summary: Get shift plan with all shifts and notes
 *     tags: [Shifts v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: areaId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: teamId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: machineId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Shift plan retrieved successfully
 */
export default router;
