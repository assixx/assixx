import { Router } from 'express';

import { authenticateV2 as authenticateToken } from '../../../middleware/v2/auth.middleware.js';
import { validate } from '../../../middleware/validation.js';
import { typed } from '../../../utils/routeHandlers.js';
import { departmentController } from './departments.controller.js';
import {
  createDepartmentValidation,
  departmentIdValidation,
  getDepartmentsValidation,
  updateDepartmentValidation,
} from './departments.validation.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /api/v2/departments:
 *   get:
 *     summary: Get all departments
 *     description: Retrieve all departments for the authenticated user's tenant
 *     tags: [Departments v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeExtended
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include extended fields (managerName, employeeCount, teamCount)
 *     responses:
 *       200:
 *         description: Departments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DepartmentsResponseV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedV2'
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
router.get(
  '/',
  validate(getDepartmentsValidation),
  typed.auth(async (req, res, next) => {
    await departmentController.getDepartments(req, res, next);
  }),
);

/**
 * @swagger
 * /api/v2/departments/stats:
 *   get:
 *     summary: Get department statistics
 *     description: Get statistics about departments and teams for the tenant
 *     tags: [Departments v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DepartmentStatsResponseV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedV2'
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
router.get(
  '/stats',
  typed.auth(async (req, res, next) => {
    await departmentController.getDepartmentStats(req, res, next);
  }),
);

/**
 * @swagger
 * /api/v2/departments/{id}:
 *   get:
 *     summary: Get department by ID
 *     description: Retrieve a specific department by its ID
 *     tags: [Departments v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Department ID
 *     responses:
 *       200:
 *         description: Department retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DepartmentResponseV2'
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
  validate(departmentIdValidation),
  typed.auth(async (req, res, next) => {
    await departmentController.getDepartmentById(req, res, next);
  }),
);

/**
 * @swagger
 * /api/v2/departments:
 *   post:
 *     summary: Create a new department
 *     description: Create a new department (admin/root only)
 *     tags: [Departments v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateDepartmentRequestV2'
 *     responses:
 *       201:
 *         description: Department created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DepartmentResponseV2'
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
  '/',
  validate(createDepartmentValidation),
  typed.auth(async (req, res, next) => {
    await departmentController.createDepartment(req, res, next);
  }),
);

/**
 * @swagger
 * /api/v2/departments/{id}:
 *   put:
 *     summary: Update a department
 *     description: Update an existing department (admin/root only)
 *     tags: [Departments v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Department ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateDepartmentRequestV2'
 *     responses:
 *       200:
 *         description: Department updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DepartmentResponseV2'
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
router.put(
  '/:id',
  validate(updateDepartmentValidation),
  typed.auth(async (req, res, next) => {
    await departmentController.updateDepartment(req, res, next);
  }),
);

/**
 * @swagger
 * /api/v2/departments/{id}:
 *   delete:
 *     summary: Delete a department
 *     description: Delete a department (admin/root only). Cannot delete if users are assigned.
 *     tags: [Departments v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Department ID
 *     responses:
 *       200:
 *         description: Department deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponseV2'
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
  '/:id',
  validate(departmentIdValidation),
  typed.auth(async (req, res, next) => {
    await departmentController.deleteDepartment(req, res, next);
  }),
);

/**
 * @swagger
 * /api/v2/departments/{id}/members:
 *   get:
 *     summary: Get department members
 *     description: Retrieve all users assigned to a specific department
 *     tags: [Departments v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Department ID
 *     responses:
 *       200:
 *         description: Department members retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DepartmentMembersResponseV2'
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
  '/:id/members',
  validate(departmentIdValidation),
  typed.auth(async (req, res, next) => {
    await departmentController.getDepartmentMembers(req, res, next);
  }),
);

export default router;
