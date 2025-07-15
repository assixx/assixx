/**
 * Departments API Routes
 * Handles department management operations
 * @swagger
 * tags:
 *   name: Departments
 *   description: Department management and organization structure
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../auth';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorHandler';
import { typed } from '../utils/routeHandlers';
import { AuthenticatedRequest } from '../types/request.types';

// Import models (now ES modules)
import Department from '../models/department';
import User from '../models/user';

const router: Router = express.Router();

// Authentication required for all routes
router.use(authenticateToken);

// Middleware for role-based access control
router.use((req: Request, res: Response, next: NextFunction): void => {
  const authReq = req as AuthenticatedRequest;
  console.log(
    `Departments route - User: ${authReq.user?.username}, Role: ${authReq.user?.role}, Method: ${req.method}`
  );

  // Allow GET requests for all authenticated users
  if (req.method === 'GET') {
    next();
  } else if (authReq.user.role === 'admin' || authReq.user.role === 'root') {
    // Only admins and root can create, update, delete
    next();
  } else {
    res.status(403).json({ message: 'Zugriff verweigert' });
  }
});

/**
 * @swagger
 * /departments:
 *   post:
 *     summary: Create a new department
 *     description: Create a new department (Admin/Root only)
 *     tags: [Departments]
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
 *                 description: Department name
 *                 example: Produktion
 *               description:
 *                 type: string
 *                 description: Department description
 *                 example: Produktionsabteilung für alle Fertigungsprozesse
 *               manager_id:
 *                 type: integer
 *                 description: User ID of department manager
 *                 example: 42
 *               parent_id:
 *                 type: integer
 *                 description: Parent department ID for hierarchical structure
 *                 example: 1
 *               location:
 *                 type: string
 *                 description: Physical location
 *                 example: Gebäude A, 2. Stock
 *               cost_center:
 *                 type: string
 *                 description: Cost center code
 *                 example: CC-PROD-001
 *     responses:
 *       201:
 *         description: Department created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Abteilung erfolgreich erstellt
 *                 departmentId:
 *                   type: integer
 *                   example: 5
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Abteilungsname ist erforderlich
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Not admin/root
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Zugriff verweigert
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Create department
interface CreateDepartmentBody {
  name: string;
  manager_id?: number;
  parent_id?: number;
}

router.post(
  '/',
  typed.body<CreateDepartmentBody>(async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { name, manager_id, parent_id } = req.body;

      if (!name) {
        res.status(400).json({ message: 'Abteilungsname ist erforderlich' });
        return;
      }

      // If a manager is specified, check if they exist
      if (manager_id) {
        const manager = await User.findById(manager_id, authReq.user.tenant_id);
        if (!manager) {
          res
            .status(400)
            .json({ message: 'Der angegebene Manager existiert nicht' });
          return;
        }
      }

      // If a parent department is specified, check if it exists
      if (parent_id) {
        const parentDept = await Department.findById(
          parent_id,
          authReq.user.tenant_id
        );
        if (!parentDept) {
          res.status(400).json({
            message: 'Die angegebene übergeordnete Abteilung existiert nicht',
          });
          return;
        }
      }

      const departmentId = await Department.create({
        name: req.body.name,
        manager_id: req.body.manager_id,
        parent_id: req.body.parent_id,
        tenant_id: authReq.user.tenant_id,
      });

      logger.info(
        `Department created with ID ${departmentId} by user ${authReq.user.username}`
      );

      res.status(201).json({
        message: 'Abteilung erfolgreich erstellt',
        departmentId,
      });
    } catch (error) {
      logger.error(`Error creating department: ${getErrorMessage(error)}`);
      res.status(500).json({
        message: 'Fehler beim Erstellen der Abteilung',
        error: getErrorMessage(error),
      });
    }
  })
);

/**
 * @swagger
 * /departments:
 *   get:
 *     summary: Get all departments
 *     description: Retrieve all departments for the tenant
 *     tags: [Departments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Departments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Department'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get all departments
router.get(
  '/',
  typed.auth(async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      logger.info(`Fetching departments for user: ${authReq.user.username}`);
      const departments = await Department.findAll(authReq.user.tenant_id);

      logger.info(`Returning ${departments.length} departments`);
      res.json(departments);
    } catch (error) {
      logger.error(`Error fetching departments: ${getErrorMessage(error)}`);
      res.status(500).json({
        message: 'Fehler beim Abrufen der Abteilungen',
        error: getErrorMessage(error),
      });
    }
  })
);

/**
 * @swagger
 * /departments/{id}:
 *   get:
 *     summary: Get department by ID
 *     description: Retrieve a specific department by its ID
 *     tags: [Departments]
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
 *               $ref: '#/components/schemas/Department'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Department not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Abteilung nicht gefunden
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get single department
router.get(
  '/:id',
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const department = await Department.findById(
        parseInt(req.params.id, 10),
        authReq.user.tenant_id
      );

      if (!department) {
        res.status(404).json({ message: 'Abteilung nicht gefunden' });
        return;
      }

      res.json(department);
    } catch (error) {
      logger.error(
        `Error fetching department ${req.params.id}: ${getErrorMessage(error)}`
      );
      res.status(500).json({
        message: 'Fehler beim Abrufen der Abteilung',
        error: getErrorMessage(error),
      });
    }
  })
);

/**
 * @swagger
 * /departments/{id}:
 *   put:
 *     summary: Update department
 *     description: Update an existing department (Admin/Root only)
 *     tags: [Departments]
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
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Department name
 *                 example: Produktion
 *               description:
 *                 type: string
 *                 description: Department description
 *               manager_id:
 *                 type: integer
 *                 description: User ID of department manager
 *               parent_id:
 *                 type: integer
 *                 description: Parent department ID
 *               location:
 *                 type: string
 *                 description: Physical location
 *               cost_center:
 *                 type: string
 *                 description: Cost center code
 *     responses:
 *       200:
 *         description: Department updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Abteilung erfolgreich aktualisiert
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Eine Abteilung kann nicht sich selbst als Übergeordnete haben
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Not admin/root
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Zugriff verweigert
 *       404:
 *         description: Department not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Abteilung nicht gefunden
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Update department
interface UpdateDepartmentBody {
  name?: string;
  manager_id?: number;
  parent_id?: number;
}

router.put(
  '/:id',
  typed.paramsBody<{ id: string }, UpdateDepartmentBody>(async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { name, manager_id, parent_id } = req.body;
      const departmentId = parseInt(req.params.id, 10);

      // Check if department exists
      const department = await Department.findById(
        departmentId,
        authReq.user.tenant_id
      );

      if (!department) {
        res.status(404).json({ message: 'Abteilung nicht gefunden' });
        return;
      }

      if (name !== undefined && !name) {
        res.status(400).json({ message: 'Abteilungsname ist erforderlich' });
        return;
      }

      // If a manager is specified, check if they exist
      if (manager_id) {
        const manager = await User.findById(manager_id, authReq.user.tenant_id);
        if (!manager) {
          res
            .status(400)
            .json({ message: 'Der angegebene Manager existiert nicht' });
          return;
        }
      }

      // If a parent department is specified, check if it exists
      if (parent_id) {
        // Prevent circular reference
        if (parent_id === departmentId) {
          res.status(400).json({
            message:
              'Eine Abteilung kann nicht sich selbst als Übergeordnete haben',
          });
          return;
        }

        const parentDept = await Department.findById(
          parent_id,
          authReq.user.tenant_id
        );
        if (!parentDept) {
          res.status(400).json({
            message: 'Die angegebene übergeordnete Abteilung existiert nicht',
          });
          return;
        }
      }

      const success = await Department.update(departmentId, {
        name: req.body.name,
        manager_id: req.body.manager_id,
        parent_id: req.body.parent_id,
      });

      if (success) {
        logger.info(
          `Department ${departmentId} updated by user ${authReq.user.username}`
        );
        res.json({ message: 'Abteilung erfolgreich aktualisiert' });
      } else {
        logger.warn(`Failed to update department ${departmentId}`);
        res
          .status(500)
          .json({ message: 'Fehler beim Aktualisieren der Abteilung' });
      }
    } catch (error) {
      logger.error(
        `Error updating department ${req.params.id}: ${getErrorMessage(error)}`
      );
      res.status(500).json({
        message: 'Fehler beim Aktualisieren der Abteilung',
        error: getErrorMessage(error),
      });
    }
  })
);

/**
 * @swagger
 * /departments/{id}:
 *   delete:
 *     summary: Delete department
 *     description: Delete a department (Admin/Root only). Cannot delete if users are assigned.
 *     tags: [Departments]
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
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Abteilung erfolgreich gelöscht
 *       400:
 *         description: Cannot delete - has assigned users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Diese Abteilung kann nicht gelöscht werden, da ihr noch Benutzer zugeordnet sind
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Not admin/root
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Zugriff verweigert
 *       404:
 *         description: Department not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Abteilung nicht gefunden
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Delete department
router.delete(
  '/:id',
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const departmentId = parseInt(req.params.id, 10);

      // Check if department exists
      const department = await Department.findById(
        departmentId,
        authReq.user.tenant_id
      );

      if (!department) {
        res.status(404).json({ message: 'Abteilung nicht gefunden' });
        return;
      }

      // Check if there are users in this department
      const users = await Department.getUsersByDepartment(departmentId);

      if (users.length > 0) {
        res.status(400).json({
          message:
            'Diese Abteilung kann nicht gelöscht werden, da ihr noch Benutzer zugeordnet sind',
          users,
        });
        return;
      }

      const success = await Department.delete(departmentId);

      if (success) {
        logger.info(
          `Department ${departmentId} deleted by user ${authReq.user.username}`
        );
        res.json({ message: 'Abteilung erfolgreich gelöscht' });
      } else {
        logger.warn(`Failed to delete department ${departmentId}`);
        res.status(500).json({ message: 'Fehler beim Löschen der Abteilung' });
      }
    } catch (error) {
      logger.error(
        `Error deleting department ${req.params.id}: ${getErrorMessage(error)}`
      );
      res.status(500).json({
        message: 'Fehler beim Löschen der Abteilung',
        error: getErrorMessage(error),
      });
    }
  })
);

/**
 * @swagger
 * /departments/{id}/members:
 *   get:
 *     summary: Get department members
 *     description: Retrieve all users assigned to a specific department
 *     tags: [Departments]
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
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   username:
 *                     type: string
 *                   email:
 *                     type: string
 *                   first_name:
 *                     type: string
 *                   last_name:
 *                     type: string
 *                   role:
 *                     type: string
 *                     enum: [root, admin, employee]
 *                   position:
 *                     type: string
 *                   is_active:
 *                     type: boolean
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Department not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Abteilung nicht gefunden
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get department members
router.get(
  '/:id/members',
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const departmentId = parseInt(req.params.id, 10);

      // Check if department exists
      const department = await Department.findById(
        departmentId,
        authReq.user.tenant_id
      );

      if (!department) {
        res.status(404).json({ message: 'Abteilung nicht gefunden' });
        return;
      }

      const users = await Department.getUsersByDepartment(departmentId);
      res.json(users);
    } catch (error) {
      logger.error(
        `Error fetching members for department ${req.params.id}: ${getErrorMessage(error)}`
      );
      res.status(500).json({
        message: 'Fehler beim Abrufen der Abteilungsmitglieder',
        error: getErrorMessage(error),
      });
    }
  })
);

export default router;

// CommonJS compatibility
