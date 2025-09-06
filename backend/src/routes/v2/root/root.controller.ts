/**
 * Root Controller v2
 * HTTP request handlers for root user operations
 */
import { Request, Response } from 'express';

import { tenantDeletionService } from '../../../services/tenantDeletion.service.js';
import { AuthenticatedRequest } from '../../../types/request.types.js';
import { errorResponse, successResponse } from '../../../utils/apiResponse.js';
import { logger } from '../../../utils/logger.js';
import { rootService } from './root.service.js';
import {
  CreateAdminRequest,
  CreateRootUserRequest,
  TenantDeletionRequest,
  UpdateAdminRequest,
  UpdateRootUserRequest,
} from './types.js';

/**
 *
 */
export class RootController {
  /**
   * @param req - The request object
   * @param res - The response object

   * /api/v2/root/admins:
   *   get:
   *     summary: Get all admin users
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of admin users
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 admins:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/AdminUser'
   */
  async getAdmins(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Root users see all admins from their tenant
      const admins = await rootService.getAdmins(req.user.tenant_id);
      res.json({ admins });
    } catch (error: unknown) {
      logger.error('Error getting admins:', error);
      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to retrieve admin users',
      });
    }
  }

  /**
   * Get admin user by ID
   * @param req - The request object
   * @param res - The response object
   */
  async getAdminById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const admin = await rootService.getAdminById(
        Number.parseInt(req.params.id),
        req.user.tenant_id,
      );

      if (!admin) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Admin not found',
        });
        return;
      }

      res.json({ admin });
    } catch (error: unknown) {
      logger.error('Error getting admin:', error);
      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to retrieve admin',
      });
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object

   * /api/v2/root/admins:
   *   post:
   *     summary: Create new admin user
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateAdminRequest'
   *     responses:
   *       201:
   *         description: Admin created successfully
   *       409:
   *         description: Username or email already exists
   */
  async createAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data = req.body as CreateAdminRequest;
      const adminId = await rootService.createAdmin(data, req.user.tenant_id);

      logger.info(`Admin user created: ${data.email} (ID: ${adminId})`);

      res.status(201).json({
        message: 'Admin user created successfully',
        adminId,
      });
    } catch (error: unknown) {
      logger.error('Error creating admin:', error);

      if ((error as { code: string }).code === 'DUPLICATE_ENTRY') {
        res.status(409).json({
          error: 'DUPLICATE_ENTRY',
          message: 'Username or email already exists',
        });
        return;
      }

      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to create admin',
      });
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object

   * /api/v2/root/admins/\{id\}:
   *   put:
   *     summary: Update admin user
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateAdminRequest'
   *     responses:
   *       200:
   *         description: Admin updated successfully
   *       404:
   *         description: Admin not found
   */
  async updateAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data = req.body as UpdateAdminRequest;
      await rootService.updateAdmin(Number.parseInt(req.params.id, 10), data, req.user.tenant_id);

      res.json({ message: 'Admin updated successfully' });
    } catch (error: unknown) {
      logger.error('Error updating admin:', error);

      if ((error as { code: string }).code === 'NOT_FOUND') {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Admin not found',
        });
        return;
      }

      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to update admin',
      });
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object

   * /api/v2/root/admins/\{id\}:
   *   delete:
   *     summary: Delete admin user
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Admin deleted successfully
   *       404:
   *         description: Admin not found
   */
  async deleteAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await rootService.deleteAdmin(Number.parseInt(req.params.id), req.user.tenant_id);

      logger.info(`Admin deleted: ${req.params.id}`);
      res.json({ message: 'Admin deleted successfully' });
    } catch (error: unknown) {
      logger.error('Error deleting admin:', error);

      if ((error as { code: string }).code === 'NOT_FOUND') {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Admin not found',
        });
        return;
      }

      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to delete admin',
      });
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object

   * /api/v2/root/admins/\{id\}/logs:
   *   get:
   *     summary: Get admin activity logs
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *       - in: query
   *         name: days
   *         schema:
   *           type: integer
   *           default: 30
   *     responses:
   *       200:
   *         description: List of admin logs
   *       404:
   *         description: Admin not found
   */
  async getAdminLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const daysParam = Number.parseInt(req.query.days as string, 10);
      const days = Number.isNaN(daysParam) ? 30 : daysParam;
      const logs = await rootService.getAdminLogs(
        Number.parseInt(req.params.id),
        req.user.tenant_id,
        days,
      );

      res.json({ logs });
    } catch (error: unknown) {
      logger.error('Error getting admin logs:', error);

      if ((error as { code: string }).code === 'NOT_FOUND') {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Admin not found',
        });
        return;
      }

      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to retrieve admin logs',
      });
    }
  }

  /**
   * @param _req - The _req parameter
   * @param res - The response object

   * /api/v2/root/tenants:
   *   get:
   *     summary: Get all tenants (super admin only)
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of all tenants
   */
  async getTenants(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // CRITICAL: Multi-tenant isolation - only return user's own tenant
      const tenants = await rootService.getTenants(req.user.tenant_id);
      res.json({ tenants });
    } catch (error: unknown) {
      logger.error('Error getting tenants:', error);
      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to retrieve tenants',
      });
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object

   * /api/v2/root/users:
   *   get:
   *     summary: Get all root users
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of root users
   */
  async getRootUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const users = await rootService.getRootUsers(req.user.tenant_id);
      res.json({ users });
    } catch (error: unknown) {
      logger.error('Error getting root users:', error);
      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to retrieve root users',
      });
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object

   * /api/v2/root/users/\{id\}:
   *   get:
   *     summary: Get root user by ID
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Root user details
   *       404:
   *         description: Root user not found
   */
  async getRootUserById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = await rootService.getRootUserById(
        Number.parseInt(req.params.id),
        req.user.tenant_id,
      );

      if (!user) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Root user not found',
        });
        return;
      }

      res.json({ user });
    } catch (error: unknown) {
      logger.error('Error getting root user:', error);
      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to retrieve root user',
      });
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object

   * /api/v2/root/users:
   *   post:
   *     summary: Create new root user
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateRootUserRequest'
   *     responses:
   *       201:
   *         description: Root user created successfully
   *       400:
   *         description: Email already in use
   */
  async createRootUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      logger.info('[RootController.createRootUser] Starting with tenant_id:', req.user.tenant_id);
      logger.info('[RootController.createRootUser] Request body:', req.body);

      const data = req.body as CreateRootUserRequest;
      const userId = await rootService.createRootUser(data, req.user.tenant_id);

      logger.warn(`Root user created: ${data.email} by ${req.user.email}`);

      res.status(201).json({
        message: 'Root user created successfully',
        userId,
      });
    } catch (error: unknown) {
      logger.error('[RootController.createRootUser] Error caught in controller:', error);
      logger.error('[RootController.createRootUser] Error details:', {
        message: (error as Error).message,
        stack: (error as Error).stack,
      });

      if ((error as { code: string }).code === 'DUPLICATE_EMAIL') {
        res.status(400).json({
          error: 'DUPLICATE_EMAIL',
          message: 'Email already in use',
        });
        return;
      }

      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to create root user',
      });
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object

   * /api/v2/root/users/\{id\}:
   *   put:
   *     summary: Update root user
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateRootUserRequest'
   *     responses:
   *       200:
   *         description: Root user updated successfully
   *       404:
   *         description: Root user not found
   */
  async updateRootUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data = req.body as UpdateRootUserRequest;
      await rootService.updateRootUser(Number.parseInt(req.params.id), data, req.user.tenant_id);

      res.json({ message: 'Root user updated successfully' });
    } catch (error: unknown) {
      logger.error('Error updating root user:', error);

      if ((error as { code: string }).code === 'NOT_FOUND') {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Root user not found',
        });
        return;
      }

      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to update root user',
      });
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object

   * /api/v2/root/users/\{id\}:
   *   delete:
   *     summary: Delete root user
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Root user deleted successfully
   *       400:
   *         description: Cannot delete yourself or last root user
   *       404:
   *         description: Root user not found
   */
  async deleteRootUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await rootService.deleteRootUser(
        Number.parseInt(req.params.id),
        req.user.tenant_id,
        req.user.id,
      );

      logger.warn(`Root user ${req.params.id} deleted by ${req.user.email}`);
      res.json({ message: 'Root user deleted successfully' });
    } catch (error: unknown) {
      logger.error('Error deleting root user:', error);

      const errorCode = (error as { code: string }).code;

      if (errorCode === 'NOT_FOUND') {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Root user not found',
        });
        return;
      }

      if (errorCode === 'SELF_DELETE') {
        res.status(400).json({
          error: 'SELF_DELETE',
          message: 'Cannot delete yourself',
        });
        return;
      }

      if (errorCode === 'LAST_ROOT_USER') {
        res.status(400).json({
          error: 'LAST_ROOT_USER',
          message: 'At least one root user must remain',
        });
        return;
      }

      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to delete root user',
      });
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object

   * /api/v2/root/dashboard:
   *   get:
   *     summary: Get dashboard statistics
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Dashboard statistics
   */
  async getDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const stats = await rootService.getDashboardStats(req.user.tenant_id);
      res.json(stats);
    } catch (error: unknown) {
      logger.error('Error getting dashboard stats:', error);
      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to retrieve dashboard statistics',
      });
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object

   * /api/v2/root/storage:
   *   get:
   *     summary: Get storage information
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Storage information and usage
   *       404:
   *         description: Tenant not found
   */
  async getStorageInfo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const storage = await rootService.getStorageInfo(req.user.tenant_id);
      res.json(successResponse(storage));
    } catch (error: unknown) {
      logger.error('Error getting storage info:', error);

      if ((error as { code: string }).code === 'NOT_FOUND') {
        res.status(404).json(errorResponse('NOT_FOUND', 'Tenant not found'));
        return;
      }

      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to retrieve storage information'));
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object

   * /api/v2/root/tenant/deletion:
   *   post:
   *     summary: Request tenant deletion
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               reason:
   *                 type: string
   *     responses:
   *       200:
   *         description: Deletion requested successfully
   *       400:
   *         description: Insufficient root users
   */
  async requestTenantDeletion(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reason } = req.body as TenantDeletionRequest;
      const queueId = await rootService.requestTenantDeletion(
        req.user.tenant_id,
        req.user.id,
        reason,
        req.ip,
      );

      logger.warn(`Tenant deletion requested: ${req.user.tenant_id} by ${req.user.email}`);

      res.json({
        queueId,
        tenantId: req.user.tenant_id,
        scheduledDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        message: 'Deletion requested - approval from second root user required',
        approvalRequired: true,
      });
    } catch (error: unknown) {
      logger.error('Error requesting deletion:', error);

      if ((error as { code: string }).code === 'INSUFFICIENT_ROOT_USERS') {
        res.status(400).json({
          error: 'INSUFFICIENT_ROOT_USERS',
          message: 'At least 2 root users required before tenant deletion',
        });
        return;
      }

      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to request deletion',
      });
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object

   * /api/v2/root/tenant/deletion-status:
   *   get:
   *     summary: Get current tenant deletion status
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Deletion status
   *       404:
   *         description: No active deletion found
   */
  async getDeletionStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const status = await rootService.getDeletionStatus(req.user.tenant_id);

      if (!status) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'No active deletion found',
        });
        return;
      }

      res.json(status);
    } catch (error: unknown) {
      logger.error('Error getting deletion status:', error);
      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to retrieve deletion status',
      });
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object

   * /api/v2/root/tenant/cancel-deletion:
   *   post:
   *     summary: Cancel tenant deletion
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Deletion cancelled successfully
   *       404:
   *         description: No active deletion found
   */
  async cancelDeletion(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await tenantDeletionService.cancelDeletion(req.user.tenant_id, req.user.id);

      res.json({ message: 'Deletion cancelled successfully' });
    } catch (error: unknown) {
      logger.error('Error cancelling deletion:', error);
      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to cancel deletion',
      });
    }
  }

  /**
   * @param _req - The _req parameter
   * @param res - The response object

   * /api/v2/root/deletion-approvals:
   *   get:
   *     summary: Get all deletion requests
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of all deletion requests
   */
  async getAllDeletionRequests(_req: Request, res: Response): Promise<void> {
    try {
      const deletions = await rootService.getAllDeletionRequests();
      res.json({ deletions });
    } catch (error: unknown) {
      logger.error('Error getting deletion requests:', error);
      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to retrieve deletion requests',
      });
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object

   * /api/v2/root/deletion-approvals/pending:
   *   get:
   *     summary: Get pending deletion approvals
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of pending approvals
   */
  async getPendingApprovals(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const approvals = await rootService.getPendingApprovals(req.user.id);
      res.json({ approvals });
    } catch (error: unknown) {
      logger.error('Error getting pending approvals:', error);
      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to retrieve pending approvals',
      });
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object

   * /api/v2/root/deletion-approvals/\{queueId\}/approve:
   *   post:
   *     summary: Approve deletion request
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: queueId
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               comment:
   *                 type: string
   *     responses:
   *       200:
   *         description: Deletion approved
   */
  async approveDeletion(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const queueId = Number.parseInt(req.params.queueId);
      const { comment } = req.body as { comment?: string };

      await tenantDeletionService.approveDeletion(queueId, req.user.id, comment);

      res.json({ message: 'Deletion approved successfully' });
    } catch (error: unknown) {
      logger.error('Error approving deletion:', error);
      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to approve deletion',
      });
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object

   * /api/v2/root/deletion-approvals/\{queueId\}/reject:
   *   post:
   *     summary: Reject deletion request
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: queueId
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - reason
   *             properties:
   *               reason:
   *                 type: string
   *     responses:
   *       200:
   *         description: Deletion rejected
   *       400:
   *         description: Reason required
   */
  async rejectDeletion(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const queueId = Number.parseInt(req.params.queueId);
      const { reason } = req.body as { reason?: string };

      if (!reason) {
        res.status(400).json({
          error: 'REASON_REQUIRED',
          message: 'Reason for rejection is required',
        });
        return;
      }

      await tenantDeletionService.rejectDeletion(queueId, req.user.id, reason);

      res.json({ message: 'Deletion rejected successfully' });
    } catch (error: unknown) {
      logger.error('Error rejecting deletion:', error);
      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to reject deletion',
      });
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object

   * /api/v2/root/deletion-queue/\{queueId\}/emergency-stop:
   *   post:
   *     summary: Emergency stop deletion
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: queueId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Emergency stop activated
   */
  async emergencyStop(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const queueId = Number.parseInt(req.params.queueId);

      await tenantDeletionService.triggerEmergencyStop(queueId, req.user.id);

      logger.error(`EMERGENCY STOP: User ${req.user.email} stopped deletion ${queueId}`);

      res.json({ message: 'Emergency stop activated' });
    } catch (error: unknown) {
      logger.error('Error triggering emergency stop:', error);
      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to trigger emergency stop',
      });
    }
  }

  /**
   * @param req - The request object
   * @param res - The response object

   * /api/v2/root/tenant/deletion-dry-run:
   *   post:
   *     summary: Perform deletion dry run
   *     tags: [Root]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Dry run report
   */
  async deletionDryRun(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const report = await rootService.performDeletionDryRun(req.user.tenant_id);
      res.json(report);
    } catch (error: unknown) {
      logger.error('Error performing dry run:', error);
      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'Failed to perform dry run',
      });
    }
  }
}

// Export singleton instance
export const rootController = new RootController();
