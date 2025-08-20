/**
 * Roles Routes v2
 * Handles role management and information
 */
import { Router } from 'express';

import { authenticateV2 as authenticateToken } from '../../../middleware/v2/auth.middleware.js';
import { validate } from '../../../middleware/validation.js';
import { typed } from '../../../utils/routeHandlers.js';
import { rolesController } from './controller.js';
import { checkRoleValidation, getRoleValidation } from './validation.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /api/v2/roles:
 *   get:
 *     summary: Get all available roles
 *     description: Get a list of all available roles in the system
 *     tags: [Roles v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Roles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         enum: [admin, employee, root]
 *                       name:
 *                         type: string
 *                         example: Administrator
 *                       description:
 *                         type: string
 *                         example: Tenant administrator with full access within their tenant
 *                       level:
 *                         type: integer
 *                         example: 50
 *                       permissions:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["users.manage", "departments.manage"]
 *       401:
 *         $ref: '#/components/responses/UnauthorizedV2'
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
router.get(
  '/',
  typed.auth(async (req, res) => {
    await rolesController.getAllRoles(req, res);
  }),
);

/**
 * @swagger
 * /api/v2/roles/hierarchy:
 *   get:
 *     summary: Get role hierarchy
 *     description: Get the hierarchy of roles showing which roles can manage others
 *     tags: [Roles v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Role hierarchy retrieved successfully
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
 *                     hierarchy:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           role:
 *                             $ref: '#/components/schemas/Role'
 *                           canManage:
 *                             type: array
 *                             items:
 *                               type: string
 *                               enum: [admin, employee, root]
 *       401:
 *         $ref: '#/components/responses/UnauthorizedV2'
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
router.get(
  '/hierarchy',
  typed.auth(async (req, res) => {
    await rolesController.getRoleHierarchy(req, res);
  }),
);

/**
 * @swagger
 * /api/v2/roles/assignable:
 *   get:
 *     summary: Get assignable roles
 *     description: Get roles that the current user can assign to others
 *     tags: [Roles v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Assignable roles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Role'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedV2'
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
router.get(
  '/assignable',
  typed.auth(async (req, res) => {
    await rolesController.getAssignableRoles(req, res);
  }),
);

/**
 * @swagger
 * /api/v2/roles/{id}:
 *   get:
 *     summary: Get a specific role
 *     description: Get details of a specific role by ID
 *     tags: [Roles v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           enum: [admin, employee, root]
 *         description: Role ID
 *     responses:
 *       200:
 *         description: Role retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Role'
 *       400:
 *         $ref: '#/components/responses/BadRequestV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
router.get(
  '/:id',
  validate(getRoleValidation),
  typed.auth(async (req, res) => {
    await rolesController.getRoleById(req, res);
  }),
);

/**
 * @swagger
 * /api/v2/roles/check:
 *   post:
 *     summary: Check user role
 *     description: Check if a user has a specific role (admin/root only)
 *     tags: [Roles v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - requiredRole
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID to check
 *               requiredRole:
 *                 type: string
 *                 enum: [admin, employee, root]
 *                 description: Role to check for
 *     responses:
 *       200:
 *         description: Role check completed
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
 *                     hasRole:
 *                       type: boolean
 *                       description: Whether user has the exact role
 *                     userRole:
 *                       type: string
 *                       enum: [admin, employee, root]
 *                       description: User's actual role
 *                     requiredRole:
 *                       type: string
 *                       enum: [admin, employee, root]
 *                       description: The role that was checked
 *                     hasAccess:
 *                       type: boolean
 *                       description: Whether user has equal or higher access level
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
  '/check',
  validate(checkRoleValidation),
  typed.auth(async (req, res) => {
    await rolesController.checkUserRole(req, res);
  }),
);

export default router;
