import { Router } from "express";

import { authenticateV2 as authenticateToken } from "../../../middleware/v2/auth.middleware.js";
import { validate } from "../../../middleware/validation.js";
import { typed } from "../../../utils/routeHandlers.js";

import { adminPermissionsController } from "./controller.js";
import {
  getAdminPermissionsValidation,
  getMyPermissionsValidation,
  setPermissionsValidation,
  removePermissionValidation,
  removeGroupPermissionValidation,
  bulkPermissionsValidation,
  checkAccessValidation,
} from "./validation.js";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /api/v2/admin-permissions/my:
 *   get:
 *     summary: Get current admin's permissions
 *     description: Get all department and group permissions for the currently authenticated admin
 *     tags: [Admin Permissions v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     departments:
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
 *                           canRead:
 *                             type: boolean
 *                           canWrite:
 *                             type: boolean
 *                           canDelete:
 *                             type: boolean
 *                     groups:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           departmentCount:
 *                             type: integer
 *                           canRead:
 *                             type: boolean
 *                           canWrite:
 *                             type: boolean
 *                           canDelete:
 *                             type: boolean
 *                     hasAllAccess:
 *                       type: boolean
 *                     totalDepartments:
 *                       type: integer
 *                     assignedDepartments:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedV2'
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
router.get(
  "/my",
  validate(getMyPermissionsValidation),
  typed.auth(async (req, res) => {
    await adminPermissionsController.getMyPermissions(req, res);
  }),
);

/**
 * @swagger
 * /api/v2/admin-permissions/{adminId}:
 *   get:
 *     summary: Get permissions for a specific admin
 *     description: Get all department and group permissions for a specific admin (root only)
 *     tags: [Admin Permissions v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Admin user ID
 *     responses:
 *       200:
 *         description: Permissions retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedV2'
 *       403:
 *         $ref: '#/components/responses/ForbiddenV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
router.get(
  "/:adminId",
  validate(getAdminPermissionsValidation),
  typed.auth(async (req, res) => {
    await adminPermissionsController.getAdminPermissions(req, res);
  }),
);

/**
 * @swagger
 * /api/v2/admin-permissions:
 *   post:
 *     summary: Set permissions for an admin
 *     description: Set department and/or group permissions for an admin user (root only)
 *     tags: [Admin Permissions v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - adminId
 *             properties:
 *               adminId:
 *                 type: integer
 *                 description: Admin user ID
 *               departmentIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of department IDs to grant access to
 *               groupIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of group IDs to grant access to
 *               permissions:
 *                 type: object
 *                 properties:
 *                   canRead:
 *                     type: boolean
 *                     default: true
 *                   canWrite:
 *                     type: boolean
 *                     default: false
 *                   canDelete:
 *                     type: boolean
 *                     default: false
 *     responses:
 *       200:
 *         description: Permissions set successfully
 *       400:
 *         $ref: '#/components/responses/BadRequestV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedV2'
 *       403:
 *         $ref: '#/components/responses/ForbiddenV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
router.post(
  "/",
  validate(setPermissionsValidation),
  typed.auth(async (req, res) => {
    await adminPermissionsController.setPermissions(req, res);
  }),
);

/**
 * @swagger
 * /api/v2/admin-permissions/{adminId}/departments/{departmentId}:
 *   delete:
 *     summary: Remove department permission
 *     description: Remove a specific department permission from an admin (root only)
 *     tags: [Admin Permissions v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Admin user ID
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Department ID
 *     responses:
 *       200:
 *         description: Permission removed successfully
 *       400:
 *         $ref: '#/components/responses/BadRequestV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedV2'
 *       403:
 *         $ref: '#/components/responses/ForbiddenV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
router.delete(
  "/:adminId/departments/:departmentId",
  validate(removePermissionValidation),
  typed.auth(async (req, res) => {
    await adminPermissionsController.removeDepartmentPermission(req, res);
  }),
);

/**
 * @swagger
 * /api/v2/admin-permissions/{adminId}/groups/{groupId}:
 *   delete:
 *     summary: Remove group permission
 *     description: Remove a specific group permission from an admin (root only)
 *     tags: [Admin Permissions v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Admin user ID
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Group ID
 *     responses:
 *       200:
 *         description: Group permission removed successfully
 *       400:
 *         $ref: '#/components/responses/BadRequestV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedV2'
 *       403:
 *         $ref: '#/components/responses/ForbiddenV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
router.delete(
  "/:adminId/groups/:groupId",
  validate(removeGroupPermissionValidation),
  typed.auth(async (req, res) => {
    await adminPermissionsController.removeGroupPermission(req, res);
  }),
);

/**
 * @swagger
 * /api/v2/admin-permissions/bulk:
 *   post:
 *     summary: Bulk update permissions
 *     description: Assign or remove permissions for multiple admins at once (root only)
 *     tags: [Admin Permissions v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - adminIds
 *               - operation
 *             properties:
 *               adminIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of admin user IDs
 *               operation:
 *                 type: string
 *                 enum: [assign, remove]
 *                 description: Operation to perform
 *               departmentIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Department IDs for assign operation
 *               groupIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Group IDs for assign operation
 *               permissions:
 *                 type: object
 *                 properties:
 *                   canRead:
 *                     type: boolean
 *                     default: true
 *                   canWrite:
 *                     type: boolean
 *                     default: false
 *                   canDelete:
 *                     type: boolean
 *                     default: false
 *     responses:
 *       200:
 *         description: Bulk operation completed
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
 *                     successCount:
 *                       type: integer
 *                     totalCount:
 *                       type: integer
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         $ref: '#/components/responses/BadRequestV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedV2'
 *       403:
 *         $ref: '#/components/responses/ForbiddenV2'
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
router.post(
  "/bulk",
  validate(bulkPermissionsValidation),
  typed.auth(async (req, res) => {
    await adminPermissionsController.bulkUpdatePermissions(req, res);
  }),
);

/**
 * @swagger
 * /api/v2/admin-permissions/{adminId}/check/{departmentId}/{permissionLevel}:
 *   get:
 *     summary: Check admin access
 *     description: Check if an admin has specific access to a department (root only, for debugging)
 *     tags: [Admin Permissions v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Admin user ID
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Department ID
 *       - in: path
 *         name: permissionLevel
 *         required: false
 *         schema:
 *           type: string
 *           enum: [read, write, delete]
 *           default: read
 *         description: Permission level to check
 *     responses:
 *       200:
 *         description: Access check result
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
 *                     hasAccess:
 *                       type: boolean
 *                     source:
 *                       type: string
 *                       enum: [direct, group]
 *                     permissions:
 *                       type: object
 *                       properties:
 *                         canRead:
 *                           type: boolean
 *                         canWrite:
 *                           type: boolean
 *                         canDelete:
 *                           type: boolean
 *       400:
 *         $ref: '#/components/responses/BadRequestV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedV2'
 *       403:
 *         $ref: '#/components/responses/ForbiddenV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
// Route with permissionLevel
router.get(
  "/:adminId/check/:departmentId/:permissionLevel",
  validate(checkAccessValidation),
  typed.auth(async (req, res) => {
    await adminPermissionsController.checkAccess(req, res);
  }),
);

// Route without permissionLevel (defaults to 'read')
router.get(
  "/:adminId/check/:departmentId",
  validate(checkAccessValidation),
  typed.auth(async (req, res) => {
    await adminPermissionsController.checkAccess(req, res);
  }),
);

export default router;
