/**
 * Admin Permissions Routes
 * Handles department and group permissions for admin users
 */

import express, { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRole } from '../auth.js';
import adminPermissionService from '../services/adminPermission.service.js';
import { logger } from '../utils/logger.js';
import { body, param, validationResult } from 'express-validator';
import pool from '../config/database.js';

// Helper function to execute queries
async function executeQuery<T = any>(sql: string, params?: any[]): Promise<[T, any]> {
  return (pool as any).execute(sql, params);
}

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
const validatePermissions = [
  body('departmentIds').optional().isArray().withMessage('departmentIds muss ein Array sein'),
  body('departmentIds.*').optional().isInt({ min: 1 }).withMessage('Ungültige Abteilungs-ID'),
  body('groupIds').optional().isArray().withMessage('groupIds muss ein Array sein'),
  body('groupIds.*').optional().isInt({ min: 1 }).withMessage('Ungültige Gruppen-ID'),
  body('permissions').optional().isObject().withMessage('permissions muss ein Objekt sein'),
  body('permissions.can_read').optional().isBoolean(),
  body('permissions.can_write').optional().isBoolean(),
  body('permissions.can_delete').optional().isBoolean(),
];

// Get departments for a specific admin
router.get(
  '/:adminId',
  authenticateToken,
  authorizeRole('root'),
  param('adminId').isInt({ min: 1 }).withMessage('Ungültige Admin-ID'),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const adminId = parseInt(req.params.adminId);

    try {
      // Get the tenant_id from the admin being queried
      const adminQuery = await executeQuery<any[]>(
        'SELECT tenant_id FROM users WHERE id = ?',
        [adminId]
      );
      
      if (!adminQuery[0] || !adminQuery[0][0]) {
        res.status(404).json({
          success: false,
          error: 'Admin nicht gefunden'
        });
        return;
      }
      
      const targetTenantId = adminQuery[0][0].tenant_id;
      
      const result = await adminPermissionService.getAdminDepartments(
        adminId,
        targetTenantId
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      logger.error(`Error getting admin departments: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Abrufen der Abteilungsberechtigungen'
      });
    }
  }
);

// Get current admin's departments (for sidebar badge)
router.get(
  '/my-departments',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;

    // Only admins need department info
    if (authReq.user.role !== 'admin') {
      res.json({
        success: true,
        data: {
          departments: [],
          hasAllAccess: authReq.user.role === 'root'
        }
      });
      return;
    }

    try {
      const result = await adminPermissionService.getAdminDepartments(
        authReq.user.id,
        authReq.user.tenant_id
      );

      res.json({
        success: true,
        ...result
      });
    } catch (error: any) {
      logger.error(`Error getting my departments: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Abrufen der eigenen Abteilungen'
      });
    }
  }
);

// Set permissions for an admin
router.post(
  '/',
  authenticateToken,
  authorizeRole('root'),
  validatePermissions,
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const { 
      adminId, 
      departmentIds = [], 
      permissions = { can_read: true, can_write: false, can_delete: false } 
    } = req.body;

    if (!adminId) {
      res.status(400).json({
        success: false,
        error: 'Admin-ID ist erforderlich'
      });
      return;
    }

    try {
      logger.info('[DEBUG] POST /admin-permissions called:', {
        adminId,
        departmentIds,
        permissions,
        userId: authReq.user.id,
        tenantId: authReq.user.tenant_id
      });
      
      // Get the tenant_id from the admin being modified
      const adminTenantQuery = await executeQuery<any[]>(
        'SELECT tenant_id FROM users WHERE id = ?',
        [adminId]
      );
      
      if (!adminTenantQuery[0] || !adminTenantQuery[0][0]) {
        res.status(404).json({
          success: false,
          error: 'Admin nicht gefunden'
        });
        return;
      }
      
      const targetTenantId = adminTenantQuery[0][0].tenant_id;
      logger.info('[DEBUG] Target tenant ID:', targetTenantId);
      
      const success = await adminPermissionService.setPermissions(
        adminId,
        departmentIds,
        authReq.user.id,
        targetTenantId,
        permissions
      );

      if (success) {
        logger.info(
          `Root user ${authReq.user.id} set permissions for admin ${adminId}`
        );
        res.json({
          success: true,
          message: 'Berechtigungen erfolgreich gesetzt'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Fehler beim Setzen der Berechtigungen'
        });
      }
    } catch (error: any) {
      logger.error(`Error setting admin permissions: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Setzen der Berechtigungen'
      });
    }
  }
);

// Set group permissions for an admin
router.post(
  '/groups',
  authenticateToken,
  authorizeRole('root'),
  validatePermissions,
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const { 
      adminId, 
      groupIds = [], 
      permissions = { can_read: true, can_write: false, can_delete: false } 
    } = req.body;

    if (!adminId) {
      res.status(400).json({
        success: false,
        error: 'Admin-ID ist erforderlich'
      });
      return;
    }

    try {
      const success = await adminPermissionService.setGroupPermissions(
        adminId,
        groupIds,
        authReq.user.id,
        authReq.user.tenant_id,
        permissions
      );

      if (success) {
        logger.info(
          `Root user ${authReq.user.id} set group permissions for admin ${adminId}`
        );
        res.json({
          success: true,
          message: 'Gruppenberechtigungen erfolgreich gesetzt'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Fehler beim Setzen der Gruppenberechtigungen'
        });
      }
    } catch (error: any) {
      logger.error(`Error setting admin group permissions: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Setzen der Gruppenberechtigungen'
      });
    }
  }
);

// Remove specific department permission
router.delete(
  '/:adminId/:departmentId',
  authenticateToken,
  authorizeRole('root'),
  param('adminId').isInt({ min: 1 }).withMessage('Ungültige Admin-ID'),
  param('departmentId').isInt({ min: 1 }).withMessage('Ungültige Abteilungs-ID'),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const adminId = parseInt(req.params.adminId);
    const departmentId = parseInt(req.params.departmentId);

    try {
      const success = await adminPermissionService.removePermission(
        adminId,
        departmentId,
        authReq.user.tenant_id
      );

      if (success) {
        await adminPermissionService.logPermissionChange(
          'revoke',
          adminId,
          departmentId,
          'department',
          authReq.user.id,
          authReq.user.tenant_id
        );

        res.json({
          success: true,
          message: 'Berechtigung erfolgreich entfernt'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Berechtigung nicht gefunden'
        });
      }
    } catch (error: any) {
      logger.error(`Error removing admin permission: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Entfernen der Berechtigung'
      });
    }
  }
);

// Remove specific group permission
router.delete(
  '/:adminId/group/:groupId',
  authenticateToken,
  authorizeRole('root'),
  param('adminId').isInt({ min: 1 }).withMessage('Ungültige Admin-ID'),
  param('groupId').isInt({ min: 1 }).withMessage('Ungültige Gruppen-ID'),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const adminId = parseInt(req.params.adminId);
    const groupId = parseInt(req.params.groupId);

    try {
      const success = await adminPermissionService.removeGroupPermission(
        adminId,
        groupId,
        authReq.user.tenant_id
      );

      if (success) {
        await adminPermissionService.logPermissionChange(
          'revoke',
          adminId,
          groupId,
          'group',
          authReq.user.id,
          authReq.user.tenant_id
        );

        res.json({
          success: true,
          message: 'Gruppenberechtigung erfolgreich entfernt'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Gruppenberechtigung nicht gefunden'
        });
      }
    } catch (error: any) {
      logger.error(`Error removing admin group permission: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Entfernen der Gruppenberechtigung'
      });
    }
  }
);

// Bulk operations
router.post(
  '/bulk',
  authenticateToken,
  authorizeRole('root'),
  body('adminIds').isArray({ min: 1 }).withMessage('adminIds muss ein nicht-leeres Array sein'),
  body('adminIds.*').isInt({ min: 1 }).withMessage('Ungültige Admin-ID'),
  body('operation').isIn(['assign', 'remove']).withMessage('Operation muss assign oder remove sein'),
  validatePermissions,
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const { 
      adminIds, 
      departmentIds = [], 
      operation,
      permissions = { can_read: true, can_write: false, can_delete: false } 
    } = req.body;

    try {
      let successCount = 0;
      const errors: string[] = [];

      for (const adminId of adminIds) {
        try {
          if (operation === 'assign') {
            const success = await adminPermissionService.setPermissions(
              adminId,
              departmentIds,
              authReq.user.id,
              authReq.user.tenant_id,
              permissions
            );
            if (success) successCount++;
          } else {
            // For remove operation, remove all department permissions
            const success = await adminPermissionService.setPermissions(
              adminId,
              [],
              authReq.user.id,
              authReq.user.tenant_id
            );
            if (success) successCount++;
          }
        } catch (error: any) {
          errors.push(`Admin ${adminId}: ${error.message}`);
        }
      }

      res.json({
        success: true,
        message: `${successCount} von ${adminIds.length} Admins erfolgreich bearbeitet`,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error: any) {
      logger.error(`Error in bulk permission operation: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Fehler bei der Bulk-Operation'
      });
    }
  }
);

export default router;