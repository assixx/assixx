/**
 * Admin Permissions Controller v2
 * Handles HTTP requests for admin permissions management
 */
import { Response } from 'express';
import { validationResult } from 'express-validator';
import { RowDataPacket } from 'mysql2/promise';

import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { errorResponse, successResponse } from '../../../utils/apiResponse.js';
import { execute } from '../../../utils/db.js';
import { adminPermissionsService } from './service.js';
import { BulkPermissionsRequest, PermissionLevel, SetPermissionsRequest } from './types.js';

export const adminPermissionsController = {
  /**
   * Get permissions for a specific admin
   * Root only
   * @param req - The request object
   * @param res - The response object
   */
  async getAdminPermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const validationErrors = errors.array().map((error) => ({
          field: error.type === 'field' ? error.path : 'general',
          message: error.msg,
        }));
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid input', validationErrors));
        return;
      }

      // Check permissions
      if (req.user.role !== 'root') {
        res.status(403).json(errorResponse('FORBIDDEN', 'Root access required'));
        return;
      }

      const adminId = Number.parseInt(req.params.adminId);

      // Get the admin's tenant ID
      const [adminRows] = await execute<RowDataPacket[]>(
        "SELECT tenant_id FROM users WHERE id = ? AND role = 'admin'",
        [adminId],
      );

      if (adminRows.length === 0) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Admin not found'));
        return;
      }

      const targetTenantId = (adminRows[0] as { tenant_id: number }).tenant_id;
      const permissions = await adminPermissionsService.getAdminPermissions(
        adminId,
        targetTenantId,
      );

      res.json(successResponse(permissions));
    } catch (error: unknown) {
      console.error('[Admin Permissions v2] Get permissions error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get permissions'));
      }
    }
  },

  /**
   * Get current admin's permissions
   * @param req - The request object
   * @param res - The response object
   */
  async getMyPermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantId) {
        res.status(401).json(errorResponse('UNAUTHORIZED', 'Authentication required'));
        return;
      }

      // Only admins need permission info
      if (req.user.role !== 'admin') {
        const response = {
          departments: [],
          groups: [],
          hasAllAccess: req.user.role === 'root',
          totalDepartments: 0,
          assignedDepartments: 0,
        };
        res.json(successResponse(response));
        return;
      }

      const permissions = await adminPermissionsService.getAdminPermissions(
        req.user.id,
        req.tenantId,
      );

      res.json(successResponse(permissions));
    } catch (error: unknown) {
      console.error('[Admin Permissions v2] Get my permissions error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get permissions'));
      }
    }
  },

  /**
   * Set permissions for an admin
   * Root only
   * @param req - The request object
   * @param res - The response object
   */
  async setPermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const validationErrors = errors.array().map((error) => ({
          field: error.type === 'field' ? error.path : 'general',
          message: error.msg,
        }));
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid input', validationErrors));
        return;
      }

      // Check permissions
      if (req.user.role !== 'root') {
        res.status(403).json(errorResponse('FORBIDDEN', 'Root access required'));
        return;
      }

      const {
        adminId,
        departmentIds = [],
        groupIds = [],
        permissions = { canRead: true, canWrite: false, canDelete: false },
      } = req.body as SetPermissionsRequest;

      // Get the admin's tenant ID
      const [adminRows] = await execute<RowDataPacket[]>(
        "SELECT tenant_id FROM users WHERE id = ? AND role = 'admin'",
        [adminId],
      );

      if (adminRows.length === 0) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Admin not found'));
        return;
      }

      const targetTenantId = (adminRows[0] as { tenant_id: number }).tenant_id;

      // Set department permissions
      await adminPermissionsService.setDepartmentPermissions(
        adminId,
        departmentIds,
        permissions,
        req.user.id,
        targetTenantId,
      );

      // Set group permissions if provided
      if (groupIds.length > 0) {
        await adminPermissionsService.setGroupPermissions(
          adminId,
          groupIds,
          permissions,
          req.user.id,
          targetTenantId,
        );
      }

      res.json(successResponse(null, 'Permissions updated successfully'));
    } catch (error: unknown) {
      console.error('[Admin Permissions v2] Set permissions error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to set permissions'));
      }
    }
  },

  /**
   * Remove specific department permission
   * Root only
   * @param req - The request object
   * @param res - The response object
   */
  async removeDepartmentPermission(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const validationErrors = errors.array().map((error) => ({
          field: error.type === 'field' ? error.path : 'general',
          message: error.msg,
        }));
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid input', validationErrors));
        return;
      }

      // Check permissions
      if (req.user.role !== 'root') {
        res.status(403).json(errorResponse('FORBIDDEN', 'Root access required'));
        return;
      }

      const adminId = Number.parseInt(req.params.adminId);
      const departmentId = Number.parseInt(req.params.departmentId);

      // Get the admin's tenant ID
      const [adminRows] = await execute<RowDataPacket[]>(
        "SELECT tenant_id FROM users WHERE id = ? AND role = 'admin'",
        [adminId],
      );

      if (adminRows.length === 0) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Admin not found'));
        return;
      }

      const targetTenantId = (adminRows[0] as { tenant_id: number }).tenant_id;

      await adminPermissionsService.removeDepartmentPermission(
        adminId,
        departmentId,
        req.user.id,
        targetTenantId,
      );

      res.json(successResponse(null, 'Permission removed successfully'));
    } catch (error: unknown) {
      console.error('[Admin Permissions v2] Remove permission error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to remove permission'));
      }
    }
  },

  /**
   * Remove specific group permission
   * Root only
   * @param req - The request object
   * @param res - The response object
   */
  async removeGroupPermission(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const validationErrors = errors.array().map((error) => ({
          field: error.type === 'field' ? error.path : 'general',
          message: error.msg,
        }));
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid input', validationErrors));
        return;
      }

      // Check permissions
      if (req.user.role !== 'root') {
        res.status(403).json(errorResponse('FORBIDDEN', 'Root access required'));
        return;
      }

      const adminId = Number.parseInt(req.params.adminId);
      const groupId = Number.parseInt(req.params.groupId);

      // Get the admin's tenant ID
      const [adminRows] = await execute<RowDataPacket[]>(
        "SELECT tenant_id FROM users WHERE id = ? AND role = 'admin'",
        [adminId],
      );

      if (adminRows.length === 0) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Admin not found'));
        return;
      }

      const targetTenantId = (adminRows[0] as { tenant_id: number }).tenant_id;

      await adminPermissionsService.removeGroupPermission(
        adminId,
        groupId,
        req.user.id,
        targetTenantId,
      );

      res.json(successResponse(null, 'Group permission removed successfully'));
    } catch (error: unknown) {
      console.error('[Admin Permissions v2] Remove group permission error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to remove group permission'));
      }
    }
  },

  /**
   * Bulk update permissions
   * Root only
   * @param req - The request object
   * @param res - The response object
   */
  async bulkUpdatePermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const validationErrors = errors.array().map((error) => ({
          field: error.type === 'field' ? error.path : 'general',
          message: error.msg,
        }));
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid input', validationErrors));
        return;
      }

      // Check permissions
      if (req.user.role !== 'root' || !req.tenantId) {
        res.status(403).json(errorResponse('FORBIDDEN', 'Root access required'));
        return;
      }

      const {
        adminIds,
        operation,
        departmentIds,
        permissions = { canRead: true, canWrite: false, canDelete: false },
      } = req.body as BulkPermissionsRequest;

      const result = await adminPermissionsService.bulkUpdatePermissions(
        adminIds,
        operation,
        departmentIds,
        permissions,
        req.user.id,
        req.tenantId,
      );

      res.json(successResponse(result, 'Bulk operation completed'));
    } catch (error: unknown) {
      console.error('[Admin Permissions v2] Bulk update error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to perform bulk operation'));
      }
    }
  },

  /**
   * Check if admin has access to a department
   * Root only (for debugging/verification)
   * @param req - The request object
   * @param res - The response object
   */
  async checkAccess(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const validationErrors = errors.array().map((error) => ({
          field: error.type === 'field' ? error.path : 'general',
          message: error.msg,
        }));
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid input', validationErrors));
        return;
      }

      // Check permissions
      if (req.user.role !== 'root') {
        res.status(403).json(errorResponse('FORBIDDEN', 'Root access required'));
        return;
      }

      const adminId = Number.parseInt(req.params.adminId);
      const departmentId = Number.parseInt(req.params.departmentId);
      const permissionLevel = (req.params.permissionLevel as PermissionLevel) ?? 'read';

      // Get the admin's tenant ID
      const [adminRows] = await execute<RowDataPacket[]>(
        "SELECT tenant_id FROM users WHERE id = ? AND role = 'admin'",
        [adminId],
      );

      if (adminRows.length === 0) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Admin not found'));
        return;
      }

      const targetTenantId = (adminRows[0] as { tenant_id: number }).tenant_id;

      const result = await adminPermissionsService.checkAccess(
        adminId,
        departmentId,
        targetTenantId,
        permissionLevel,
      );

      res.json(successResponse(result));
    } catch (error: unknown) {
      console.error('[Admin Permissions v2] Check access error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to check access'));
      }
    }
  },
};
