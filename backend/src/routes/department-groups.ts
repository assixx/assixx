/**
 * Department Groups Routes
 * Handles hierarchical department group management
 */

import express, { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRole } from '../auth.js';
import departmentGroupService from '../services/departmentGroup.service.js';
import { logger } from '../utils/logger.js';
import { body, param, validationResult } from 'express-validator';

const router: Router = express.Router();

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    tenant_id: number;
    username: string;
    email: string;
    role: string;
  };
}

// Validation middleware
const validateCreateGroup = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Gruppenname ist erforderlich')
    .isLength({ max: 100 })
    .withMessage('Gruppenname darf maximal 100 Zeichen lang sein'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Beschreibung darf maximal 500 Zeichen lang sein'),
  body('parentGroupId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Ungültige übergeordnete Gruppen-ID'),
  body('departmentIds')
    .optional()
    .isArray()
    .withMessage('departmentIds muss ein Array sein'),
  body('departmentIds.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Ungültige Abteilungs-ID'),
];

// Get all groups
router.get(
  '/',
  authenticateToken,
  authorizeRole('admin'),
  async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;

    try {
      const groups = await departmentGroupService.getGroupHierarchy(
        authReq.user.tenant_id
      );

      res.json({
        success: true,
        data: groups,
      });
    } catch (error: any) {
      logger.error(`Error getting department groups: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Abrufen der Abteilungsgruppen',
      });
    }
  }
);

// Get hierarchical structure
router.get(
  '/hierarchy',
  authenticateToken,
  authorizeRole('admin'),
  async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;

    try {
      const hierarchy = await departmentGroupService.getGroupHierarchy(
        authReq.user.tenant_id
      );

      res.json({
        success: true,
        data: hierarchy,
      });
    } catch (error: any) {
      logger.error(`Error getting group hierarchy: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Abrufen der Gruppenhierarchie',
      });
    }
  }
);

// Create a new group
router.post(
  '/',
  authenticateToken,
  authorizeRole('root'),
  validateCreateGroup,
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const { name, description, parentGroupId, departmentIds = [] } = req.body;

    try {
      const groupId = await departmentGroupService.createGroup(
        name,
        description || null,
        parentGroupId || null,
        authReq.user.tenant_id,
        authReq.user.id
      );

      if (!groupId) {
        res.status(500).json({
          success: false,
          error: 'Fehler beim Erstellen der Gruppe',
        });
        return;
      }

      // Add departments if provided
      if (departmentIds.length > 0) {
        await departmentGroupService.addDepartmentsToGroup(
          groupId,
          departmentIds,
          authReq.user.tenant_id,
          authReq.user.id
        );
      }

      logger.info(
        `Root user ${authReq.user.id} created department group ${groupId}`
      );

      res.status(201).json({
        success: true,
        data: { id: groupId },
        message: 'Abteilungsgruppe erfolgreich erstellt',
      });
    } catch (error: any) {
      if (error.message === 'Group name already exists') {
        res.status(409).json({
          success: false,
          error: 'Eine Gruppe mit diesem Namen existiert bereits',
        });
      } else if (error.message === 'Circular dependency detected') {
        res.status(400).json({
          success: false,
          error: 'Zirkuläre Abhängigkeit erkannt',
        });
      } else {
        logger.error(`Error creating department group: ${error.message}`);
        res.status(500).json({
          success: false,
          error: 'Fehler beim Erstellen der Gruppe',
        });
      }
    }
  }
);

// Update a group
router.put(
  '/:id',
  authenticateToken,
  authorizeRole('root'),
  param('id').isInt({ min: 1 }).withMessage('Ungültige Gruppen-ID'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Gruppenname ist erforderlich')
    .isLength({ max: 100 })
    .withMessage('Gruppenname darf maximal 100 Zeichen lang sein'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Beschreibung darf maximal 500 Zeichen lang sein'),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const groupId = parseInt(req.params.id);
    const { name, description } = req.body;

    try {
      const success = await departmentGroupService.updateGroup(
        groupId,
        name,
        description || null,
        authReq.user.tenant_id
      );

      if (success) {
        res.json({
          success: true,
          message: 'Gruppe erfolgreich aktualisiert',
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Gruppe nicht gefunden',
        });
      }
    } catch (error: any) {
      if (error.message === 'Group name already exists') {
        res.status(409).json({
          success: false,
          error: 'Eine Gruppe mit diesem Namen existiert bereits',
        });
      } else {
        logger.error(`Error updating department group: ${error.message}`);
        res.status(500).json({
          success: false,
          error: 'Fehler beim Aktualisieren der Gruppe',
        });
      }
    }
  }
);

// Delete a group
router.delete(
  '/:id',
  authenticateToken,
  authorizeRole('root'),
  param('id').isInt({ min: 1 }).withMessage('Ungültige Gruppen-ID'),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const groupId = parseInt(req.params.id);

    try {
      const success = await departmentGroupService.deleteGroup(
        groupId,
        authReq.user.tenant_id
      );

      if (success) {
        logger.info(
          `Root user ${authReq.user.id} deleted department group ${groupId}`
        );
        res.json({
          success: true,
          message: 'Gruppe erfolgreich gelöscht',
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Gruppe nicht gefunden',
        });
      }
    } catch (error: any) {
      if (
        error.message === 'Cannot delete group with active admin permissions'
      ) {
        res.status(409).json({
          success: false,
          error:
            'Gruppe kann nicht gelöscht werden, da noch Admin-Berechtigungen existieren',
        });
      } else if (error.message === 'Cannot delete group with subgroups') {
        res.status(409).json({
          success: false,
          error:
            'Gruppe kann nicht gelöscht werden, da noch Untergruppen existieren',
        });
      } else {
        logger.error(`Error deleting department group: ${error.message}`);
        res.status(500).json({
          success: false,
          error: 'Fehler beim Löschen der Gruppe',
        });
      }
    }
  }
);

// Add departments to a group
router.post(
  '/:id/departments',
  authenticateToken,
  authorizeRole('root'),
  param('id').isInt({ min: 1 }).withMessage('Ungültige Gruppen-ID'),
  body('departmentIds')
    .isArray({ min: 1 })
    .withMessage('departmentIds muss ein nicht-leeres Array sein'),
  body('departmentIds.*')
    .isInt({ min: 1 })
    .withMessage('Ungültige Abteilungs-ID'),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const groupId = parseInt(req.params.id);
    const { departmentIds } = req.body;

    try {
      const success = await departmentGroupService.addDepartmentsToGroup(
        groupId,
        departmentIds,
        authReq.user.tenant_id,
        authReq.user.id
      );

      if (success) {
        res.json({
          success: true,
          message: 'Abteilungen erfolgreich zur Gruppe hinzugefügt',
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Fehler beim Hinzufügen der Abteilungen',
        });
      }
    } catch (error: any) {
      logger.error(`Error adding departments to group: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Hinzufügen der Abteilungen',
      });
    }
  }
);

// Remove department from a group
router.delete(
  '/:id/departments/:deptId',
  authenticateToken,
  authorizeRole('root'),
  param('id').isInt({ min: 1 }).withMessage('Ungültige Gruppen-ID'),
  param('deptId').isInt({ min: 1 }).withMessage('Ungültige Abteilungs-ID'),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const groupId = parseInt(req.params.id);
    const departmentId = parseInt(req.params.deptId);

    try {
      const success = await departmentGroupService.removeDepartmentsFromGroup(
        groupId,
        [departmentId],
        authReq.user.tenant_id
      );

      if (success) {
        res.json({
          success: true,
          message: 'Abteilung erfolgreich aus der Gruppe entfernt',
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Abteilung oder Gruppe nicht gefunden',
        });
      }
    } catch (error: any) {
      logger.error(`Error removing department from group: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Entfernen der Abteilung',
      });
    }
  }
);

// Get departments in a group
router.get(
  '/:id/departments',
  authenticateToken,
  authorizeRole('admin'),
  param('id').isInt({ min: 1 }).withMessage('Ungültige Gruppen-ID'),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const groupId = parseInt(req.params.id);
    const includeSubgroups = req.query.includeSubgroups !== 'false';

    try {
      const departments = await departmentGroupService.getGroupDepartments(
        groupId,
        authReq.user.tenant_id,
        includeSubgroups
      );

      res.json({
        success: true,
        data: departments,
      });
    } catch (error: any) {
      logger.error(`Error getting group departments: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Abrufen der Abteilungen',
      });
    }
  }
);

export default router;
