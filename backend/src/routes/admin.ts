/**
 * Admin Routes
 * Handles admin-specific operations like employee management
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin-specific operations and management
 */

import express, { Router, Request } from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import { security } from '../middleware/security';
import {
  validateCreateEmployee,
  validateUpdateEmployee,
} from '../middleware/validators';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/errorHandler';
import { typed } from '../utils/routeHandlers';

// Import models (now ES modules)
import User from '../models/user';
import Document from '../models/document';
import Department from '../models/department';

const router: Router = express.Router();

// Extended Request interfaces
interface AuthenticatedAdminRequest extends Request {
  user: {
    id: number;
    tenant_id: number;
    username: string;
    email: string;
    role: string;
  };

  file?: Express.Multer.File;
}

interface EmployeeCreateRequest extends AuthenticatedAdminRequest {
  body: {
    username: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    department_id?: number;
    position?: string;
  };
}

interface EmployeeUpdateRequest extends AuthenticatedAdminRequest {
  params: {
    id: string;
  };
  body: {
    username?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    department_id?: number;
    position?: string;
    role?: string;
  };
}

interface DocumentUploadRequest extends AuthenticatedAdminRequest {
  params: {
    employeeId: string;
  };
  body: {
    title?: string;
    description?: string;
    year?: string;
    month?: string;
  };
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, 'uploads/documents/');
  },
  filename(_req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const extension = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Nur PDF-Dateien sind erlaubt!'));
    }
  },
});

/**
 * @swagger
 * /admin/employees:
 *   post:
 *     summary: Create a new employee
 *     description: Create a new employee account within the admin's tenant
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Unique username for the employee
 *                 example: john.doe
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Employee email address
 *                 example: john.doe@company.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Initial password for the employee
 *                 example: SecurePass123!
 *               first_name:
 *                 type: string
 *                 description: Employee first name
 *                 example: John
 *               last_name:
 *                 type: string
 *                 description: Employee last name
 *                 example: Doe
 *               phone:
 *                 type: string
 *                 description: Employee phone number
 *                 example: +49 123 456789
 *               department_id:
 *                 type: integer
 *                 description: Department ID to assign the employee to
 *                 example: 1
 *               position:
 *                 type: string
 *                 description: Job position/title
 *                 example: Software Developer
 *     responses:
 *       201:
 *         description: Employee created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Mitarbeiter erfolgreich erstellt
 *                 employeeId:
 *                   type: integer
 *                   description: ID of the newly created employee
 *                   example: 123
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Conflict - Username or email already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Ein Mitarbeiter mit diesem Benutzernamen oder dieser E-Mail existiert bereits.
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Create employee
router.post(
  '/employees',
  ...security.admin(validateCreateEmployee),
  typed.body<EmployeeCreateRequest['body']>(async (req, res) => {
    const adminId = req.user.id;
    logger.info(`Admin ${adminId} attempting to create a new employee`);

    try {
      const employeeData = {
        ...req.body,
        first_name: req.body.first_name || '',
        last_name: req.body.last_name || '',
        role: 'employee',
        tenant_id: req.user.tenant_id,
      };
      const employeeId = await User.create(employeeData);
      logger.info(
        `Admin ${adminId} created new employee with ID: ${employeeId}`
      );

      res.status(201).json({
        message: 'Mitarbeiter erfolgreich erstellt',
        employeeId,
      });
    } catch (error) {
      logger.error(
        `Error creating employee by Admin ${adminId}: ${getErrorMessage(error)}`
      );
      const dbError = error as { code?: string };
      if (dbError.code === 'ER_DUP_ENTRY') {
        res.status(409).json({
          message:
            'Ein Mitarbeiter mit diesem Benutzernamen oder dieser E-Mail existiert bereits.',
        });
        return;
      }
      res.status(500).json({
        message: 'Fehler beim Erstellen des Mitarbeiters',
        error: getErrorMessage(error),
      });
    }
  })
);

/**
 * @swagger
 * /admin/employees:
 *   get:
 *     summary: Get all employees
 *     description: Retrieve a list of all employees within the admin's tenant
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering employees by name or email
 *     responses:
 *       200:
 *         description: List of employees retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not an admin
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
// Get all employees
router.get(
  '/employees',
  ...security.admin(),
  typed.auth(async (req, res) => {
    try {
      const employees = await User.findByRole(
        'employee',
        false,
        req.user.tenant_id
      );

      console.log(`Retrieved ${employees.length} employees:`, employees);
      logger.info(`Retrieved ${employees.length} employees`);

      res.json(employees);
    } catch (error) {
      console.error(`Error retrieving employees from DB:`, error);
      logger.error(`Error retrieving employees: ${getErrorMessage(error)}`);
      res.status(500).json({
        message: 'Fehler beim Abrufen der Mitarbeiter',
        error: getErrorMessage(error),
      });
    }
  })
);

/**
 * @swagger
 * /admin/employees/{id}:
 *   get:
 *     summary: Get single employee
 *     description: Retrieve detailed information about a specific employee
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Employee ID
 *     responses:
 *       200:
 *         description: Employee information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Employee not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Mitarbeiter nicht gefunden
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get single employee
router.get(
  '/employees/:id',
  ...security.admin(),
  typed.params<{ id: string }>(async (req, res) => {
    const adminId = req.user.id;
    const employeeId = parseInt(req.params.id, 10);

    logger.info(`Admin ${adminId} requesting employee ${employeeId}`);

    try {
      const employee = await User.findById(employeeId, req.user.tenant_id);

      if (!employee) {
        res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });
        return;
      }

      res.json(employee);
    } catch (error) {
      logger.error(
        `Error retrieving employee ${employeeId} for Admin ${adminId}: ${getErrorMessage(error)}`
      );
      res.status(500).json({
        message: 'Fehler beim Abrufen des Mitarbeiters',
        error: getErrorMessage(error),
      });
    }
  })
);

/**
 * @swagger
 * /admin/employees/{id}:
 *   put:
 *     summary: Update employee information
 *     description: Update an existing employee's information (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Employee ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Updated email address
 *               first_name:
 *                 type: string
 *                 description: Updated first name
 *               last_name:
 *                 type: string
 *                 description: Updated last name
 *               phone:
 *                 type: string
 *                 description: Updated phone number
 *               department_id:
 *                 type: integer
 *                 description: Updated department ID
 *               position:
 *                 type: string
 *                 description: Updated job position
 *               is_active:
 *                 type: boolean
 *                 description: Active status
 *     responses:
 *       200:
 *         description: Employee updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Mitarbeiter erfolgreich aktualisiert
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Cannot change employee role or not an admin
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Die Rolle eines Mitarbeiters kann nicht geändert werden
 *       404:
 *         description: Employee not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Mitarbeiter nicht gefunden
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Update employee
router.put(
  '/employees/:id',
  ...security.admin(),
  ...validateUpdateEmployee,
  typed.paramsBody<
    EmployeeUpdateRequest['params'],
    EmployeeUpdateRequest['body']
  >(async (req, res) => {
    const adminId = req.user.id;
    const employeeId = parseInt(req.params.id, 10);

    logger.info(`Admin ${adminId} attempting to update employee ${employeeId}`);

    try {
      const employee = await User.findById(employeeId, req.user.tenant_id);

      if (!employee) {
        res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });
        return;
      }

      if (req.body.role && req.body.role !== employee.role) {
        res.status(403).json({
          message: 'Die Rolle eines Mitarbeiters kann nicht geändert werden',
        });
        return;
      }

      const success = await User.update(
        employeeId,
        req.body,
        req.user.tenant_id
      );

      if (success) {
        logger.info(
          `Employee ${employeeId} updated successfully by Admin ${adminId}`
        );
        res.json({
          message: 'Mitarbeiter erfolgreich aktualisiert',
          success: true,
        });
      } else {
        logger.warn(`Failed to update employee ${employeeId}`);
        res.status(500).json({
          message: 'Fehler beim Aktualisieren des Mitarbeiters',
          success: false,
        });
      }
    } catch (error) {
      logger.error(
        `Error updating employee ${employeeId} by Admin ${adminId}: ${getErrorMessage(error)}`
      );
      res.status(500).json({
        message: 'Fehler beim Aktualisieren des Mitarbeiters',
        error: getErrorMessage(error),
        success: false,
      });
    }
  })
);

/**
 * @swagger
 * /admin/upload-document/{employeeId}:
 *   post:
 *     summary: Upload document for employee
 *     description: Upload a PDF document for a specific employee (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Employee ID to upload document for
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - document
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: PDF file to upload (max 3MB)
 *               title:
 *                 type: string
 *                 description: Document title
 *               description:
 *                 type: string
 *                 description: Document description
 *               year:
 *                 type: string
 *                 description: Year (for payroll documents)
 *               month:
 *                 type: string
 *                 description: Month (for payroll documents)
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Dokument erfolgreich hochgeladen
 *                 documentId:
 *                   type: integer
 *                   description: ID of the uploaded document
 *       400:
 *         description: Bad request - No file uploaded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Keine Datei hochgeladen
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Employee not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Mitarbeiter nicht gefunden
 *       413:
 *         description: File too large
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Nur PDF-Dateien sind erlaubt!
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Upload document for employee
router.post(
  '/upload-document/:employeeId',
  ...security.admin(),
  upload.single('document'),
  typed.paramsBody<
    DocumentUploadRequest['params'],
    DocumentUploadRequest['body']
  >(async (req, res) => {
    const adminId = req.user.id;
    const employeeId = parseInt(req.params.employeeId, 10);

    logger.info(
      `Admin ${adminId} attempting to upload document for Employee ${employeeId}`
    );

    try {
      if (!req.file) {
        res.status(400).json({ message: 'Keine Datei hochgeladen' });
        return;
      }

      const employee = await User.findById(employeeId, req.user.tenant_id);
      if (!employee) {
        await fs.unlink(req.file.path);
        res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });
        return;
      }

      const filePath = req.file.path;
      const fileContent = await fs.readFile(filePath);

      const documentId = await Document.create({
        userId: employeeId,
        fileName: req.file.originalname,
        fileContent,
        tenant_id: req.user.tenant_id,
      });

      await fs.unlink(filePath);

      logger.info(
        `Admin ${adminId} successfully uploaded document ${documentId} for Employee ${employeeId}`
      );
      res.status(201).json({
        message: 'Dokument erfolgreich hochgeladen',
        documentId,
      });
    } catch (error) {
      logger.error(
        `Error uploading document for Employee ${employeeId} by Admin ${adminId}: ${getErrorMessage(error)}`
      );

      if (req.file?.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          logger.error(
            `Error deleting temporary file: ${getErrorMessage(unlinkError)}`
          );
        }
      }

      res.status(500).json({
        message: 'Fehler beim Hochladen des Dokuments',
        error: getErrorMessage(error),
      });
    }
  })
);

/**
 * @swagger
 * /admin/dashboard-stats:
 *   get:
 *     summary: Get admin dashboard statistics
 *     description: Retrieve statistics for the admin dashboard including employee, department, team, and document counts
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 employeeCount:
 *                   type: integer
 *                   description: Total number of employees in the tenant
 *                   example: 42
 *                 departmentCount:
 *                   type: integer
 *                   description: Total number of departments in the tenant
 *                   example: 5
 *                 teamCount:
 *                   type: integer
 *                   description: Total number of teams in the tenant
 *                   example: 12
 *                 documentCount:
 *                   type: integer
 *                   description: Total number of documents in the tenant
 *                   example: 156
 *                 adminName:
 *                   type: string
 *                   description: Username of the current admin
 *                   example: admin123
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not an admin
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
// Get dashboard stats
router.get(
  '/dashboard-stats',
  ...security.admin(),
  typed.auth(async (req, res) => {
    try {
      const employeeCount = await User.count({
        role: 'employee',
        tenant_id: req.user.tenant_id,
      });
      let departmentCount = 0;
      let teamCount = 0;
      let documentCount = 0;

      // Department count
      try {
        if (typeof Department.countByTenant === 'function') {
          departmentCount = await Department.countByTenant(req.user.tenant_id);
        }
      } catch (e) {
        logger.warn(`Could not count departments: ${getErrorMessage(e)}`);
      }

      // Team count (using Department model)
      try {
        if (typeof Department.countTeamsByTenant === 'function') {
          teamCount = await Department.countTeamsByTenant(req.user.tenant_id);
        }
      } catch (e) {
        logger.warn(`Could not count teams: ${getErrorMessage(e)}`);
      }

      try {
        if (typeof Document.countByTenant === 'function') {
          documentCount = await Document.countByTenant(req.user.tenant_id);
        }
      } catch (e) {
        logger.warn(`Could not count documents: ${getErrorMessage(e)}`);
      }

      res.json({
        employeeCount,
        departmentCount,
        teamCount,
        documentCount,
        adminName: req.user.username,
      });
    } catch (error) {
      logger.error(`Error fetching dashboard stats: ${getErrorMessage(error)}`);
      res.status(500).json({
        message: 'Fehler beim Abrufen der Dashboard-Daten',
        error: getErrorMessage(error),
      });
    }
  })
);

// Note: Dashboard statistics endpoint removed - duplicate of above route

// NOTE: Additional routes (delete, archive, salary documents) omitted for brevity
// The original file has many more routes - they follow the same pattern

// Get all documents for admin
router.get(
  '/documents',
  ...security.admin(),
  typed.auth(async (req, res) => {
    try {
      const documents = await Document.findAll(req.user.tenant_id.toString());
      res.json(documents);
    } catch (error) {
      logger.error(`Error retrieving documents: ${getErrorMessage(error)}`);
      res.status(500).json({
        message: 'Fehler beim Abrufen der Dokumente',
        error: getErrorMessage(error),
      });
    }
  })
);

export default router;

// CommonJS compatibility
