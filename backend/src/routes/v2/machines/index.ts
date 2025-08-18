/**
 * Machines API v2 Routes
 * Industrial machine management system
 * @swagger
 * tags:
 *   name: Machines v2
 *   description: Industrial machine management API v2
 */

import express, { Router, RequestHandler } from "express";

import {
  authenticateV2,
  requireRoleV2,
} from "../../../middleware/v2/auth.middleware";
import { typed } from "../../../utils/routeHandlers";

import { machinesController } from "./machines.controller";
import { machineValidation } from "./validation";

const router: Router = express.Router();

/**
 * @swagger
 * /api/v2/machines:
 *   get:
 *     summary: List all machines
 *     description: Get a paginated list of machines with optional filters
 *     tags: [Machines v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - name: status
 *         in: query
 *         description: Filter by machine status
 *         schema:
 *           type: string
 *           enum: [operational, maintenance, repair, standby, decommissioned]
 *       - name: machineType
 *         in: query
 *         description: Filter by machine type
 *         schema:
 *           type: string
 *           enum: [production, packaging, quality_control, logistics, utility, other]
 *       - name: departmentId
 *         in: query
 *         description: Filter by department ID
 *         schema:
 *           type: integer
 *       - name: needsMaintenance
 *         in: query
 *         description: Filter machines needing maintenance
 *         schema:
 *           type: boolean
 *       - name: sortBy
 *         in: query
 *         description: Sort field
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, name, next_maintenance]
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
 *         description: Successfully retrieved machines list
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/MachineV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/",
  authenticateV2 as RequestHandler,
  machineValidation.listMachines,
  typed.auth(machinesController.listMachines),
);

/**
 * @swagger
 * /api/v2/machines/statistics:
 *   get:
 *     summary: Get machine statistics
 *     description: Get statistical overview of all machines in the system
 *     tags: [Machines v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved machine statistics
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
 *                         totalMachines:
 *                           type: integer
 *                           description: Total number of active machines
 *                         operational:
 *                           type: integer
 *                           description: Number of operational machines
 *                         inMaintenance:
 *                           type: integer
 *                           description: Number of machines in maintenance
 *                         inRepair:
 *                           type: integer
 *                           description: Number of machines in repair
 *                         standby:
 *                           type: integer
 *                           description: Number of machines on standby
 *                         decommissioned:
 *                           type: integer
 *                           description: Number of decommissioned machines
 *                         needsMaintenanceSoon:
 *                           type: integer
 *                           description: Number of machines needing maintenance within 30 days
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/statistics",
  authenticateV2 as RequestHandler,
  typed.auth(machinesController.getStatistics),
);

/**
 * @swagger
 * /api/v2/machines/categories:
 *   get:
 *     summary: Get machine categories
 *     description: Get all available machine categories
 *     tags: [Machines v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved machine categories
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                           icon:
 *                             type: string
 *                           sortOrder:
 *                             type: integer
 *                           isActive:
 *                             type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/categories",
  authenticateV2 as RequestHandler,
  typed.auth(machinesController.getCategories),
);

/**
 * @swagger
 * /api/v2/machines/upcoming-maintenance:
 *   get:
 *     summary: Get upcoming maintenance
 *     description: Get machines that need maintenance within specified days
 *     tags: [Machines v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: days
 *         in: query
 *         description: Number of days to look ahead (1-365)
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *     responses:
 *       200:
 *         description: Successfully retrieved machines needing maintenance
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/MachineV2'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/upcoming-maintenance",
  authenticateV2 as RequestHandler,
  machineValidation.upcomingMaintenance,
  typed.auth(machinesController.getUpcomingMaintenance),
);

/**
 * @swagger
 * /api/v2/machines/maintenance:
 *   post:
 *     summary: Add maintenance record
 *     description: Record a new maintenance activity for a machine (admin only)
 *     tags: [Machines v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - machineId
 *               - maintenanceType
 *               - performedDate
 *             properties:
 *               machineId:
 *                 type: integer
 *                 description: ID of the machine
 *               maintenanceType:
 *                 type: string
 *                 enum: [preventive, corrective, inspection, calibration, cleaning, other]
 *                 description: Type of maintenance performed
 *               performedDate:
 *                 type: string
 *                 format: date-time
 *                 description: Date when maintenance was performed
 *               performedBy:
 *                 type: integer
 *                 description: ID of the user who performed maintenance
 *               externalCompany:
 *                 type: string
 *                 maxLength: 100
 *                 description: Name of external company if maintenance was outsourced
 *               description:
 *                 type: string
 *                 description: Detailed description of maintenance performed
 *               partsReplaced:
 *                 type: string
 *                 description: List of parts that were replaced
 *               cost:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 description: Cost of maintenance
 *               durationHours:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 description: Duration of maintenance in hours
 *               statusAfter:
 *                 type: string
 *                 enum: [operational, needs_repair, decommissioned]
 *                 default: operational
 *                 description: Machine status after maintenance
 *               nextMaintenanceDate:
 *                 type: string
 *                 format: date
 *                 description: Date of next scheduled maintenance
 *               reportUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL to maintenance report document
 *     responses:
 *       201:
 *         description: Maintenance record created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/MaintenanceHistoryV2'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post(
  "/maintenance",
  authenticateV2 as RequestHandler,
  requireRoleV2(["admin"]) as RequestHandler,
  machineValidation.addMaintenanceRecord,
  typed.auth(machinesController.addMaintenanceRecord),
);

/**
 * @swagger
 * /api/v2/machines/{id}:
 *   get:
 *     summary: Get machine by ID
 *     description: Get detailed information about a specific machine
 *     tags: [Machines v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Machine ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Successfully retrieved machine
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/MachineV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  "/:id",
  authenticateV2 as RequestHandler,
  machineValidation.machineId,
  typed.auth(machinesController.getMachine),
);

/**
 * @swagger
 * /api/v2/machines/{id}/maintenance:
 *   get:
 *     summary: Get maintenance history
 *     description: Get all maintenance records for a specific machine
 *     tags: [Machines v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Machine ID
 *         schema:
 *           type: integer
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Successfully retrieved maintenance history
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/MaintenanceHistoryV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  "/:id/maintenance",
  authenticateV2 as RequestHandler,
  machineValidation.machineId,
  typed.auth(machinesController.getMaintenanceHistory),
);

/**
 * @swagger
 * /api/v2/machines:
 *   post:
 *     summary: Create new machine
 *     description: Create a new machine in the system (admin only)
 *     tags: [Machines v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Machine name
 *                 example: CNC Machine 001
 *               model:
 *                 type: string
 *                 maxLength: 100
 *                 description: Machine model
 *                 example: DMG MORI DMU 50
 *               manufacturer:
 *                 type: string
 *                 maxLength: 100
 *                 description: Machine manufacturer
 *                 example: DMG MORI
 *               serialNumber:
 *                 type: string
 *                 maxLength: 100
 *                 description: Unique serial number
 *                 example: SN-2024-001
 *               assetNumber:
 *                 type: string
 *                 maxLength: 50
 *                 description: Internal asset number
 *                 example: ASSET-001
 *               departmentId:
 *                 type: integer
 *                 description: Department ID
 *               areaId:
 *                 type: integer
 *                 description: Area ID within department
 *               location:
 *                 type: string
 *                 maxLength: 255
 *                 description: Physical location
 *                 example: Building A, Floor 2, Bay 3
 *               machineType:
 *                 type: string
 *                 enum: [production, packaging, quality_control, logistics, utility, other]
 *                 default: production
 *                 description: Type of machine
 *               status:
 *                 type: string
 *                 enum: [operational, maintenance, repair, standby, decommissioned]
 *                 default: operational
 *                 description: Current machine status
 *               purchaseDate:
 *                 type: string
 *                 format: date
 *                 description: Date of purchase
 *                 example: 2024-01-15
 *               installationDate:
 *                 type: string
 *                 format: date
 *                 description: Date of installation
 *                 example: 2024-02-01
 *               warrantyUntil:
 *                 type: string
 *                 format: date
 *                 description: Warranty expiration date
 *                 example: 2027-01-15
 *               lastMaintenance:
 *                 type: string
 *                 format: date
 *                 description: Date of last maintenance
 *               nextMaintenance:
 *                 type: string
 *                 format: date
 *                 description: Date of next scheduled maintenance
 *               operatingHours:
 *                 type: integer
 *                 minimum: 0
 *                 description: Total operating hours
 *               productionCapacity:
 *                 type: string
 *                 maxLength: 100
 *                 description: Production capacity
 *                 example: 500 units/hour
 *               energyConsumption:
 *                 type: string
 *                 maxLength: 100
 *                 description: Energy consumption
 *                 example: 50 kW
 *               manualUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL to machine manual
 *               qrCode:
 *                 type: string
 *                 maxLength: 255
 *                 description: QR code data
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *     responses:
 *       201:
 *         description: Machine created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/MachineV2'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post(
  "/",
  authenticateV2 as RequestHandler,
  requireRoleV2(["admin"]) as RequestHandler,
  machineValidation.createMachine,
  typed.auth(machinesController.createMachine),
);

/**
 * @swagger
 * /api/v2/machines/{id}:
 *   put:
 *     summary: Update machine
 *     description: Update an existing machine's information (admin only)
 *     tags: [Machines v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Machine ID
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Machine name
 *               model:
 *                 type: string
 *                 maxLength: 100
 *                 description: Machine model
 *               manufacturer:
 *                 type: string
 *                 maxLength: 100
 *                 description: Machine manufacturer
 *               serialNumber:
 *                 type: string
 *                 maxLength: 100
 *                 description: Unique serial number
 *               assetNumber:
 *                 type: string
 *                 maxLength: 50
 *                 description: Internal asset number
 *               departmentId:
 *                 type: integer
 *                 description: Department ID
 *               areaId:
 *                 type: integer
 *                 description: Area ID within department
 *               location:
 *                 type: string
 *                 maxLength: 255
 *                 description: Physical location
 *               machineType:
 *                 type: string
 *                 enum: [production, packaging, quality_control, logistics, utility, other]
 *                 description: Type of machine
 *               status:
 *                 type: string
 *                 enum: [operational, maintenance, repair, standby, decommissioned]
 *                 description: Current machine status
 *               purchaseDate:
 *                 type: string
 *                 format: date
 *                 description: Date of purchase
 *               installationDate:
 *                 type: string
 *                 format: date
 *                 description: Date of installation
 *               warrantyUntil:
 *                 type: string
 *                 format: date
 *                 description: Warranty expiration date
 *               lastMaintenance:
 *                 type: string
 *                 format: date
 *                 description: Date of last maintenance
 *               nextMaintenance:
 *                 type: string
 *                 format: date
 *                 description: Date of next scheduled maintenance
 *               operatingHours:
 *                 type: integer
 *                 minimum: 0
 *                 description: Total operating hours
 *               productionCapacity:
 *                 type: string
 *                 maxLength: 100
 *                 description: Production capacity
 *               energyConsumption:
 *                 type: string
 *                 maxLength: 100
 *                 description: Energy consumption
 *               manualUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL to machine manual
 *               qrCode:
 *                 type: string
 *                 maxLength: 255
 *                 description: QR code data
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *               isActive:
 *                 type: boolean
 *                 description: Whether the machine is active
 *     responses:
 *       200:
 *         description: Machine updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/MachineV2'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  "/:id",
  authenticateV2 as RequestHandler,
  requireRoleV2(["admin"]) as RequestHandler,
  machineValidation.updateMachine,
  typed.auth(machinesController.updateMachine),
);

/**
 * @swagger
 * /api/v2/machines/{id}:
 *   delete:
 *     summary: Delete machine
 *     description: Hard delete a machine (permanently removes from database, admin only)
 *     tags: [Machines v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Machine ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Machine deleted successfully
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
 *                           example: Machine deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete(
  "/:id",
  authenticateV2 as RequestHandler,
  requireRoleV2(["admin"]) as RequestHandler,
  machineValidation.machineId,
  typed.auth(machinesController.deleteMachine),
);

/**
 * @swagger
 * /api/v2/machines/{id}/deactivate:
 *   put:
 *     summary: Deactivate machine
 *     description: Deactivate a machine (marks as inactive, admin only)
 *     tags: [Machines v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Machine ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Machine deactivated successfully
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
 *                           example: Machine deactivated successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  "/:id/deactivate",
  authenticateV2 as RequestHandler,
  requireRoleV2(["admin"]) as RequestHandler,
  machineValidation.machineId,
  typed.auth(machinesController.deactivateMachine),
);

/**
 * @swagger
 * /api/v2/machines/{id}/activate:
 *   put:
 *     summary: Activate machine
 *     description: Activate a previously deactivated machine (admin only)
 *     tags: [Machines v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Machine ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Machine activated successfully
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
 *                           example: Machine activated successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  "/:id/activate",
  authenticateV2 as RequestHandler,
  requireRoleV2(["admin"]) as RequestHandler,
  machineValidation.machineId,
  typed.auth(machinesController.activateMachine),
);

export default router;
