/**
 * Root Controller v2
 * HTTP request handlers for root user operations
 */

import { Request, Response } from "express";

import { tenantDeletionService } from "../../../services/tenantDeletion.service.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { execute } from "../../../utils/db.js";
import { logger } from "../../../utils/logger.js";

import { rootService } from "./root.service.js";
import {
  CreateAdminRequest,
  UpdateAdminRequest,
  CreateRootUserRequest,
  UpdateRootUserRequest,
  TenantDeletionRequest,
} from "./types.js";

export class RootController {
  /**
   * @swagger
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
  async getAdmins(req: Request, res: Response): Promise<void> {
    try {
      const admins = await rootService.getAdmins(req.user.tenant_id);
      res.json({ admins });
    } catch (error: unknown) {
      logger.error("Error getting admins:", error);
      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to retrieve admin users",
      });
    }
  }

  /**
   * @swagger
   * /api/v2/root/admins/{id}:
   *   get:
   *     summary: Get admin user by ID
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
   *         description: Admin user details
   *       404:
   *         description: Admin not found
   */
  async getAdminById(req: Request, res: Response): Promise<void> {
    try {
      const admin = await rootService.getAdminById(
        parseInt(req.params.id),
        req.user.tenant_id,
      );

      if (!admin) {
        res.status(404).json({
          error: "NOT_FOUND",
          message: "Admin not found",
        });
        return;
      }

      res.json({ admin });
    } catch (error: unknown) {
      logger.error("Error getting admin:", error);
      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to retrieve admin",
      });
    }
  }

  /**
   * @swagger
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
  async createAdmin(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateAdminRequest = req.body;
      const adminId = await rootService.createAdmin(data, req.user.tenant_id);

      logger.info(`Admin user created: ${data.email} (ID: ${adminId})`);

      res.status(201).json({
        message: "Admin user created successfully",
        adminId,
      });
    } catch (error: unknown) {
      logger.error("Error creating admin:", error);

      if ((error as { code: string }).code === "DUPLICATE_ENTRY") {
        res.status(409).json({
          error: "DUPLICATE_ENTRY",
          message: "Username or email already exists",
        });
        return;
      }

      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to create admin",
      });
    }
  }

  /**
   * @swagger
   * /api/v2/root/admins/{id}:
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
  async updateAdmin(req: Request, res: Response): Promise<void> {
    try {
      const data: UpdateAdminRequest = req.body;
      await rootService.updateAdmin(
        parseInt(req.params.id),
        data,
        req.user.tenant_id,
      );

      res.json({ message: "Admin updated successfully" });
    } catch (error: unknown) {
      logger.error("Error updating admin:", error);

      if ((error as { code: string }).code === "NOT_FOUND") {
        res.status(404).json({
          error: "NOT_FOUND",
          message: "Admin not found",
        });
        return;
      }

      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to update admin",
      });
    }
  }

  /**
   * @swagger
   * /api/v2/root/admins/{id}:
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
  async deleteAdmin(req: Request, res: Response): Promise<void> {
    try {
      await rootService.deleteAdmin(
        parseInt(req.params.id),
        req.user.tenant_id,
      );

      logger.info(`Admin deleted: ${req.params.id}`);
      res.json({ message: "Admin deleted successfully" });
    } catch (error: unknown) {
      logger.error("Error deleting admin:", error);

      if ((error as { code: string }).code === "NOT_FOUND") {
        res.status(404).json({
          error: "NOT_FOUND",
          message: "Admin not found",
        });
        return;
      }

      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to delete admin",
      });
    }
  }

  /**
   * @swagger
   * /api/v2/root/admins/{id}/logs:
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
  async getAdminLogs(req: Request, res: Response): Promise<void> {
    try {
      const days = parseInt(req.query.days as string) ?? 30;
      const logs = await rootService.getAdminLogs(
        parseInt(req.params.id),
        req.user.tenant_id,
        days,
      );

      res.json({ logs });
    } catch (error: unknown) {
      logger.error("Error getting admin logs:", error);

      if ((error as { code: string }).code === "NOT_FOUND") {
        res.status(404).json({
          error: "NOT_FOUND",
          message: "Admin not found",
        });
        return;
      }

      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to retrieve admin logs",
      });
    }
  }

  /**
   * @swagger
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
  async getTenants(_req: Request, res: Response): Promise<void> {
    try {
      const tenants = await rootService.getTenants();
      res.json({ tenants });
    } catch (error: unknown) {
      logger.error("Error getting tenants:", error);
      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to retrieve tenants",
      });
    }
  }

  /**
   * @swagger
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
  async getRootUsers(req: Request, res: Response): Promise<void> {
    try {
      const users = await rootService.getRootUsers(req.user.tenant_id);
      res.json({ users });
    } catch (error: unknown) {
      logger.error("Error getting root users:", error);
      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to retrieve root users",
      });
    }
  }

  /**
   * @swagger
   * /api/v2/root/users/{id}:
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
  async getRootUserById(req: Request, res: Response): Promise<void> {
    try {
      const user = await rootService.getRootUserById(
        parseInt(req.params.id),
        req.user.tenant_id,
      );

      if (!user) {
        res.status(404).json({
          error: "NOT_FOUND",
          message: "Root user not found",
        });
        return;
      }

      res.json({ user });
    } catch (error: unknown) {
      logger.error("Error getting root user:", error);
      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to retrieve root user",
      });
    }
  }

  /**
   * @swagger
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
  async createRootUser(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateRootUserRequest = req.body;
      const userId = await rootService.createRootUser(data, req.user.tenant_id);

      // Log the action
      await execute(
        `INSERT INTO admin_logs (tenant_id, user_id, action, entity_type, entity_id, new_values, ip_address, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          req.user.tenant_id,
          req.user.id,
          "root_user_created",
          "user",
          userId,
          JSON.stringify({
            email: data.email,
            created_by: req.user.email,
          }),
          req.ip,
        ],
      );

      logger.warn(`Root user created: ${data.email} by ${req.user.email}`);

      res.status(201).json({
        message: "Root user created successfully",
        userId,
      });
    } catch (error: unknown) {
      logger.error("Error creating root user:", error);

      if ((error as { code: string }).code === "DUPLICATE_EMAIL") {
        res.status(400).json({
          error: "DUPLICATE_EMAIL",
          message: "Email already in use",
        });
        return;
      }

      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to create root user",
      });
    }
  }

  /**
   * @swagger
   * /api/v2/root/users/{id}:
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
  async updateRootUser(req: Request, res: Response): Promise<void> {
    try {
      const data: UpdateRootUserRequest = req.body;
      await rootService.updateRootUser(
        parseInt(req.params.id),
        data,
        req.user.tenant_id,
      );

      // Log the action
      await execute(
        `INSERT INTO admin_logs (tenant_id, user_id, action, entity_type, entity_id, new_values, ip_address, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          req.user.tenant_id,
          req.user.id,
          "root_user_updated",
          "user",
          req.params.id,
          JSON.stringify({
            updated_by: req.user.email,
            changes: data,
          }),
          req.ip,
        ],
      );

      res.json({ message: "Root user updated successfully" });
    } catch (error: unknown) {
      logger.error("Error updating root user:", error);

      if ((error as { code: string }).code === "NOT_FOUND") {
        res.status(404).json({
          error: "NOT_FOUND",
          message: "Root user not found",
        });
        return;
      }

      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to update root user",
      });
    }
  }

  /**
   * @swagger
   * /api/v2/root/users/{id}:
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
  async deleteRootUser(req: Request, res: Response): Promise<void> {
    try {
      await rootService.deleteRootUser(
        parseInt(req.params.id),
        req.user.tenant_id,
        req.user.id,
      );

      logger.warn(`Root user ${req.params.id} deleted by ${req.user.email}`);
      res.json({ message: "Root user deleted successfully" });
    } catch (error: unknown) {
      logger.error("Error deleting root user:", error);

      const errorCode = (error as { code: string }).code;

      if (errorCode === "NOT_FOUND") {
        res.status(404).json({
          error: "NOT_FOUND",
          message: "Root user not found",
        });
        return;
      }

      if (errorCode === "SELF_DELETE") {
        res.status(400).json({
          error: "SELF_DELETE",
          message: "Cannot delete yourself",
        });
        return;
      }

      if (errorCode === "LAST_ROOT_USER") {
        res.status(400).json({
          error: "LAST_ROOT_USER",
          message: "At least one root user must remain",
        });
        return;
      }

      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to delete root user",
      });
    }
  }

  /**
   * @swagger
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
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const stats = await rootService.getDashboardStats(req.user.tenant_id);
      res.json(stats);
    } catch (error: unknown) {
      logger.error("Error getting dashboard stats:", error);
      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to retrieve dashboard statistics",
      });
    }
  }

  /**
   * @swagger
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
  async getStorageInfo(req: Request, res: Response): Promise<void> {
    try {
      const storage = await rootService.getStorageInfo(req.user.tenant_id);
      res.json(successResponse(storage));
    } catch (error: unknown) {
      logger.error("Error getting storage info:", error);

      if ((error as { code: string }).code === "NOT_FOUND") {
        res.status(404).json(errorResponse("NOT_FOUND", "Tenant not found"));
        return;
      }

      res
        .status(500)
        .json(
          errorResponse(
            "SERVER_ERROR",
            "Failed to retrieve storage information",
          ),
        );
    }
  }

  /**
   * @swagger
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
  async requestTenantDeletion(req: Request, res: Response): Promise<void> {
    try {
      const { reason }: TenantDeletionRequest = req.body;
      const queueId = await rootService.requestTenantDeletion(
        req.user.tenant_id,
        req.user.id,
        reason,
        req.ip,
      );

      logger.warn(
        `Tenant deletion requested: ${req.user.tenant_id} by ${req.user.email}`,
      );

      res.json({
        queueId,
        tenantId: req.user.tenant_id,
        scheduledDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        message: "Deletion requested - approval from second root user required",
        approvalRequired: true,
      });
    } catch (error: unknown) {
      logger.error("Error requesting deletion:", error);

      if ((error as { code: string }).code === "INSUFFICIENT_ROOT_USERS") {
        res.status(400).json({
          error: "INSUFFICIENT_ROOT_USERS",
          message: "At least 2 root users required before tenant deletion",
        });
        return;
      }

      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to request deletion",
      });
    }
  }

  /**
   * @swagger
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
  async getDeletionStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = await rootService.getDeletionStatus(req.user.tenant_id);

      if (!status) {
        res.status(404).json({
          error: "NOT_FOUND",
          message: "No active deletion found",
        });
        return;
      }

      res.json(status);
    } catch (error: unknown) {
      logger.error("Error getting deletion status:", error);
      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to retrieve deletion status",
      });
    }
  }

  /**
   * @swagger
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
  async cancelDeletion(req: Request, res: Response): Promise<void> {
    try {
      await tenantDeletionService.cancelDeletion(
        req.user.tenant_id,
        req.user.id,
      );

      res.json({ message: "Deletion cancelled successfully" });
    } catch (error: unknown) {
      logger.error("Error cancelling deletion:", error);
      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to cancel deletion",
      });
    }
  }

  /**
   * @swagger
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
      logger.error("Error getting deletion requests:", error);
      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to retrieve deletion requests",
      });
    }
  }

  /**
   * @swagger
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
  async getPendingApprovals(req: Request, res: Response): Promise<void> {
    try {
      const approvals = await rootService.getPendingApprovals(req.user.id);
      res.json({ approvals });
    } catch (error: unknown) {
      logger.error("Error getting pending approvals:", error);
      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to retrieve pending approvals",
      });
    }
  }

  /**
   * @swagger
   * /api/v2/root/deletion-approvals/{queueId}/approve:
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
  async approveDeletion(req: Request, res: Response): Promise<void> {
    try {
      const queueId = parseInt(req.params.queueId);
      const { comment } = req.body;

      await tenantDeletionService.approveDeletion(
        queueId,
        req.user.id,
        comment,
      );

      res.json({ message: "Deletion approved successfully" });
    } catch (error: unknown) {
      logger.error("Error approving deletion:", error);
      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to approve deletion",
      });
    }
  }

  /**
   * @swagger
   * /api/v2/root/deletion-approvals/{queueId}/reject:
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
  async rejectDeletion(req: Request, res: Response): Promise<void> {
    try {
      const queueId = parseInt(req.params.queueId);
      const { reason } = req.body;

      if (!reason) {
        res.status(400).json({
          error: "REASON_REQUIRED",
          message: "Reason for rejection is required",
        });
        return;
      }

      await tenantDeletionService.rejectDeletion(queueId, req.user.id, reason);

      res.json({ message: "Deletion rejected successfully" });
    } catch (error: unknown) {
      logger.error("Error rejecting deletion:", error);
      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to reject deletion",
      });
    }
  }

  /**
   * @swagger
   * /api/v2/root/deletion-queue/{queueId}/emergency-stop:
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
  async emergencyStop(req: Request, res: Response): Promise<void> {
    try {
      const queueId = parseInt(req.params.queueId);

      await tenantDeletionService.triggerEmergencyStop(queueId, req.user.id);

      logger.error(
        `EMERGENCY STOP: User ${req.user.email} stopped deletion ${queueId}`,
      );

      res.json({ message: "Emergency stop activated" });
    } catch (error: unknown) {
      logger.error("Error triggering emergency stop:", error);
      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to trigger emergency stop",
      });
    }
  }

  /**
   * @swagger
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
  async deletionDryRun(req: Request, res: Response): Promise<void> {
    try {
      const report = await rootService.performDeletionDryRun(
        req.user.tenant_id,
      );
      res.json(report);
    } catch (error: unknown) {
      logger.error("Error performing dry run:", error);
      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to perform dry run",
      });
    }
  }
}

// Export singleton instance
export const rootController = new RootController();
