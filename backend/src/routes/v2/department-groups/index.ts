/**
 * Department Groups Routes v2
 * Handles hierarchical department group management
 */

import { Router } from "express";
import { departmentGroupsController } from "./controller.js";
import {
  createGroupValidation,
  updateGroupValidation,
  getGroupValidation,
  deleteGroupValidation,
  addDepartmentsValidation,
  removeDepartmentValidation,
  getGroupDepartmentsValidation,
} from "./validation.js";
import { authenticateV2 as authenticateToken } from "../../../middleware/v2/auth.middleware.js";
import { validate } from "../../../middleware/validation.js";
import { typed } from "../../../utils/routeHandlers.js";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /api/v2/department-groups:
 *   get:
 *     summary: Get all department groups
 *     description: Get all department groups with hierarchical structure
 *     tags: [Department Groups v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Department groups retrieved successfully
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
 *                         type: integer
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       parentGroupId:
 *                         type: integer
 *                       memberCount:
 *                         type: integer
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                       createdBy:
 *                         type: integer
 *                       departments:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             name:
 *                               type: string
 *                             description:
 *                               type: string
 *                       subgroups:
 *                         type: array
 *                         items:
 *                           $ref: '#/components/schemas/DepartmentGroupWithHierarchy'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedV2'
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
router.get(
  "/",
  typed.auth(async (req, res) => {
    await departmentGroupsController.getGroups(req, res);
  }),
);

/**
 * @swagger
 * /api/v2/department-groups/{id}:
 *   get:
 *     summary: Get a department group by ID
 *     description: Get a single department group by its ID
 *     tags: [Department Groups v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Department group ID
 *     responses:
 *       200:
 *         description: Department group retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DepartmentGroup'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
router.get(
  "/:id",
  validate(getGroupValidation),
  typed.auth(async (req, res) => {
    await departmentGroupsController.getGroupById(req, res);
  }),
);

/**
 * @swagger
 * /api/v2/department-groups:
 *   post:
 *     summary: Create a new department group
 *     description: Create a new department group (root only)
 *     tags: [Department Groups v2]
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
 *                 description: Group name
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 description: Group description
 *                 maxLength: 500
 *               parentGroupId:
 *                 type: integer
 *                 description: Parent group ID for hierarchical structure
 *               departmentIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Initial departments to add to the group
 *     responses:
 *       201:
 *         description: Department group created successfully
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
 *                     id:
 *                       type: integer
 *                 message:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/BadRequestV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedV2'
 *       403:
 *         $ref: '#/components/responses/ForbiddenV2'
 *       409:
 *         description: Conflict - Group name already exists
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
router.post(
  "/",
  validate(createGroupValidation),
  typed.auth(async (req, res) => {
    await departmentGroupsController.createGroup(req, res);
  }),
);

/**
 * @swagger
 * /api/v2/department-groups/{id}:
 *   put:
 *     summary: Update a department group
 *     description: Update a department group (root only)
 *     tags: [Department Groups v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Department group ID
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
 *                 description: Group name
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 description: Group description
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Department group updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/BadRequestV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedV2'
 *       403:
 *         $ref: '#/components/responses/ForbiddenV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 *       409:
 *         description: Conflict - Group name already exists
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
router.put(
  "/:id",
  validate(updateGroupValidation),
  typed.auth(async (req, res) => {
    await departmentGroupsController.updateGroup(req, res);
  }),
);

/**
 * @swagger
 * /api/v2/department-groups/{id}:
 *   delete:
 *     summary: Delete a department group
 *     description: Delete a department group (root only). Cannot delete if group has admin permissions or subgroups.
 *     tags: [Department Groups v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Department group ID
 *     responses:
 *       200:
 *         description: Department group deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedV2'
 *       403:
 *         $ref: '#/components/responses/ForbiddenV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 *       409:
 *         description: Conflict - Group has admin permissions or subgroups
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
router.delete(
  "/:id",
  validate(deleteGroupValidation),
  typed.auth(async (req, res) => {
    await departmentGroupsController.deleteGroup(req, res);
  }),
);

/**
 * @swagger
 * /api/v2/department-groups/{id}/departments:
 *   post:
 *     summary: Add departments to a group
 *     description: Add one or more departments to a department group (root only)
 *     tags: [Department Groups v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Department group ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - departmentIds
 *             properties:
 *               departmentIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of department IDs to add
 *                 minItems: 1
 *     responses:
 *       200:
 *         description: Departments added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
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
  "/:id/departments",
  validate(addDepartmentsValidation),
  typed.auth(async (req, res) => {
    await departmentGroupsController.addDepartments(req, res);
  }),
);

/**
 * @swagger
 * /api/v2/department-groups/{id}/departments/{departmentId}:
 *   delete:
 *     summary: Remove a department from a group
 *     description: Remove a department from a department group (root only)
 *     tags: [Department Groups v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Department group ID
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Department ID to remove
 *     responses:
 *       200:
 *         description: Department removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
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
  "/:id/departments/:departmentId",
  validate(removeDepartmentValidation),
  typed.auth(async (req, res) => {
    await departmentGroupsController.removeDepartment(req, res);
  }),
);

/**
 * @swagger
 * /api/v2/department-groups/{id}/departments:
 *   get:
 *     summary: Get departments in a group
 *     description: Get all departments in a department group
 *     tags: [Department Groups v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Department group ID
 *       - in: query
 *         name: includeSubgroups
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include departments from subgroups
 *     responses:
 *       200:
 *         description: Departments retrieved successfully
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
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedV2'
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
router.get(
  "/:id/departments",
  validate(getGroupDepartmentsValidation),
  typed.auth(async (req, res) => {
    await departmentGroupsController.getGroupDepartments(req, res);
  }),
);

export default router;
