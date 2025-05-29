/**
 * Departments API Routes
 * Handles department management operations
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../auth';
import { logger } from '../utils/logger';

// Import models (now ES modules)
import Department from '../models/department';
import User from '../models/user';

const router: Router = express.Router();

// Extended Request interfaces
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
    tenant_id: number;
  };
}

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

// Create department
router.post('/', async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { name, manager_id, parent_id } = req.body;

    if (!name) {
      res.status(400).json({ message: 'Abteilungsname ist erforderlich' });
      return;
    }

    // If a manager is specified, check if they exist
    if (manager_id) {
      const manager = await User.findById(manager_id);
      if (!manager) {
        res
          .status(400)
          .json({ message: 'Der angegebene Manager existiert nicht' });
        return;
      }
    }

    // If a parent department is specified, check if it exists
    if (parent_id) {
      const parentDept = await Department.findById(parent_id);
      if (!parentDept) {
        res.status(400).json({
          message: 'Die angegebene übergeordnete Abteilung existiert nicht',
        });
        return;
      }
    }

    const departmentId = await Department.create({
      ...req.body,
      tenant_id: authReq.user.tenant_id,
    });

    logger.info(
      `Department created with ID ${departmentId} by user ${authReq.user.username}`
    );

    res.status(201).json({
      message: 'Abteilung erfolgreich erstellt',
      departmentId,
    });
  } catch (error: any) {
    logger.error(`Error creating department: ${error.message}`);
    res.status(500).json({
      message: 'Fehler beim Erstellen der Abteilung',
      error: error.message,
    });
  }
});

// Get all departments
router.get('/', async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    logger.info(`Fetching departments for user: ${authReq.user.username}`);
    const departments = await Department.findAll(authReq.user.tenant_id);
    logger.info(`Returning ${departments.length} departments`);
    res.json(departments);
  } catch (error: any) {
    logger.error(`Error fetching departments: ${error.message}`);
    res.status(500).json({
      message: 'Fehler beim Abrufen der Abteilungen',
      error: error.message,
    });
  }
});

// Get single department
router.get('/:id', async (req, res): Promise<void> => {
  try {
    const department = await Department.findById(req.params.id);

    if (!department) {
      res.status(404).json({ message: 'Abteilung nicht gefunden' });
      return;
    }

    res.json(department);
  } catch (error: any) {
    logger.error(
      `Error fetching department ${req.params.id}: ${error.message}`
    );
    res.status(500).json({
      message: 'Fehler beim Abrufen der Abteilung',
      error: error.message,
    });
  }
});

// Update department
router.put('/:id', async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { name, manager_id, parent_id } = req.body;
    const departmentId = req.params.id;

    // Check if department exists
    const department = await Department.findById(departmentId);

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
      const manager = await User.findById(manager_id);
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
      if (parent_id.toString() === departmentId) {
        res.status(400).json({
          message:
            'Eine Abteilung kann nicht sich selbst als Übergeordnete haben',
        });
        return;
      }

      const parentDept = await Department.findById(parent_id);
      if (!parentDept) {
        res.status(400).json({
          message: 'Die angegebene übergeordnete Abteilung existiert nicht',
        });
        return;
      }
    }

    const success = await Department.update(departmentId, req.body);

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
  } catch (error: any) {
    logger.error(
      `Error updating department ${req.params.id}: ${error.message}`
    );
    res.status(500).json({
      message: 'Fehler beim Aktualisieren der Abteilung',
      error: error.message,
    });
  }
});

// Delete department
router.delete('/:id', async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const departmentId = req.params.id;

    // Check if department exists
    const department = await Department.findById(departmentId);

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
  } catch (error: any) {
    logger.error(
      `Error deleting department ${req.params.id}: ${error.message}`
    );
    res.status(500).json({
      message: 'Fehler beim Löschen der Abteilung',
      error: error.message,
    });
  }
});

// Get department members
router.get('/:id/members', async (req, res): Promise<void> => {
  try {
    const departmentId = req.params.id;

    // Check if department exists
    const department = await Department.findById(departmentId);

    if (!department) {
      res.status(404).json({ message: 'Abteilung nicht gefunden' });
      return;
    }

    const users = await Department.getUsersByDepartment(departmentId);
    res.json(users);
  } catch (error: any) {
    logger.error(
      `Error fetching members for department ${req.params.id}: ${error.message}`
    );
    res.status(500).json({
      message: 'Fehler beim Abrufen der Abteilungsmitglieder',
      error: error.message,
    });
  }
});

export default router;

// CommonJS compatibility
