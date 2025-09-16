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
import { logger } from '../../../utils/logger.js';
import { adminPermissionsService } from './service.js';
import { BulkPermissionsRequest, PermissionLevel, SetPermissionsRequest } from './types.js';

// Constants for error messages
const VALIDATION_ERROR = 'VALIDATION_ERROR';
const FORBIDDEN_ERROR = 'FORBIDDEN';
const NOT_FOUND_ERROR = 'NOT_FOUND';
const SERVER_ERROR = 'SERVER_ERROR';
const ROOT_ACCESS_REQUIRED = 'Root access required';
const ADMIN_NOT_FOUND = 'Admin not found';
const INVALID_INPUT = 'Invalid input';

// SQL Queries
const GET_ADMIN_TENANT_QUERY = "SELECT tenant_id FROM users WHERE id = ? AND role = 'admin'";

export const adminPermissionsController = {
  /**
   * Get permissions for a specific admin
   * Root only
   * @param req - The request object
   * @param res - The response object
   */
  async getAdminPermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
    logger.info('[Admin Permissions v2] === START getAdminPermissions ===');
    logger.info('[Admin Permissions v2] Request URL:', req.url);
    logger.info('[Admin Permissions v2] Request method:', req.method);

    try {
      logger.info('[Admin Permissions v2] Inside try block');
      logger.info('[Admin Permissions v2] User object:', JSON.stringify(req.user));
      logger.info('[Admin Permissions v2] Params:', JSON.stringify(req.params));
      logger.info('[Admin Permissions v2] User role:', req.user.role);
      logger.info('[Admin Permissions v2] User id:', req.user.id);
      logger.info('[Admin Permissions v2] User tenantId:', req.user.tenant_id);

      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const validationErrors = errors.array().map((error) => ({
          field: error.type === 'field' ? error.path : 'general',
          message: error.msg,
        }));
        res.status(400).json(errorResponse(VALIDATION_ERROR, INVALID_INPUT, validationErrors));
        return;
      }

      // Check permissions
      if (req.user.role !== 'root') {
        logger.info('[Admin Permissions v2] Access denied - not root');
        res.status(403).json(errorResponse(FORBIDDEN_ERROR, ROOT_ACCESS_REQUIRED));
        return;
      }

      const adminId = Number.parseInt(req.params.adminId);
      logger.info('[Admin Permissions v2] Admin ID:', adminId);

      // Get the admin's tenant ID
      const [adminRows] = await execute<RowDataPacket[]>(GET_ADMIN_TENANT_QUERY, [adminId]);

      if (adminRows.length === 0) {
        res.status(404).json(errorResponse(NOT_FOUND_ERROR, ADMIN_NOT_FOUND));
        return;
      }

      const targetTenantId = (adminRows[0] as { tenant_id: number }).tenant_id;
      const permissions = await adminPermissionsService.getAdminPermissions(
        adminId,
        targetTenantId,
      );

      res.json(successResponse(permissions));
    } catch (error: unknown) {
      logger.error('[Admin Permissions v2] Get permissions error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse(SERVER_ERROR, 'Failed to get permissions'));
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
      logger.error('[Admin Permissions v2] Get my permissions error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse(SERVER_ERROR, 'Failed to get permissions'));
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
        res.status(400).json(errorResponse(VALIDATION_ERROR, INVALID_INPUT, validationErrors));
        return;
      }

      // Check permissions
      if (req.user.role !== 'root') {
        res.status(403).json(errorResponse(FORBIDDEN_ERROR, ROOT_ACCESS_REQUIRED));
        return;
      }

      const {
        adminId,
        departmentIds = [],
        groupIds = [],
        permissions = { canRead: true, canWrite: false, canDelete: false },
      } = req.body as SetPermissionsRequest;

      // Get the admin's tenant ID
      const [adminRows] = await execute<RowDataPacket[]>(GET_ADMIN_TENANT_QUERY, [adminId]);

      if (adminRows.length === 0) {
        res.status(404).json(errorResponse(NOT_FOUND_ERROR, ADMIN_NOT_FOUND));
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
      logger.error('[Admin Permissions v2] Set permissions error:', error);
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
        res.status(400).json(errorResponse(VALIDATION_ERROR, INVALID_INPUT, validationErrors));
        return;
      }

      // Check permissions
      if (req.user.role !== 'root') {
        res.status(403).json(errorResponse(FORBIDDEN_ERROR, ROOT_ACCESS_REQUIRED));
        return;
      }

      const adminId = Number.parseInt(req.params.adminId);
      const departmentId = Number.parseInt(req.params.departmentId);

      // Get the admin's tenant ID
      const [adminRows] = await execute<RowDataPacket[]>(GET_ADMIN_TENANT_QUERY, [adminId]);

      if (adminRows.length === 0) {
        res.status(404).json(errorResponse(NOT_FOUND_ERROR, ADMIN_NOT_FOUND));
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
      logger.error('[Admin Permissions v2] Remove permission error:', error);
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
        res.status(400).json(errorResponse(VALIDATION_ERROR, INVALID_INPUT, validationErrors));
        return;
      }

      // Check permissions
      if (req.user.role !== 'root') {
        res.status(403).json(errorResponse(FORBIDDEN_ERROR, ROOT_ACCESS_REQUIRED));
        return;
      }

      const adminId = Number.parseInt(req.params.adminId);
      const groupId = Number.parseInt(req.params.groupId);

      // Get the admin's tenant ID
      const [adminRows] = await execute<RowDataPacket[]>(GET_ADMIN_TENANT_QUERY, [adminId]);

      if (adminRows.length === 0) {
        res.status(404).json(errorResponse(NOT_FOUND_ERROR, ADMIN_NOT_FOUND));
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
      logger.error('[Admin Permissions v2] Remove group permission error:', error);
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
        res.status(400).json(errorResponse(VALIDATION_ERROR, INVALID_INPUT, validationErrors));
        return;
      }

      // Check permissions
      if (req.user.role !== 'root' || !req.tenantId) {
        res.status(403).json(errorResponse(FORBIDDEN_ERROR, ROOT_ACCESS_REQUIRED));
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
      logger.error('[Admin Permissions v2] Bulk update error:', error);
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
        res.status(400).json(errorResponse(VALIDATION_ERROR, INVALID_INPUT, validationErrors));
        return;
      }

      // Check permissions
      if (req.user.role !== 'root') {
        res.status(403).json(errorResponse(FORBIDDEN_ERROR, ROOT_ACCESS_REQUIRED));
        return;
      }

      const adminId = Number.parseInt(req.params.adminId);
      const departmentId = Number.parseInt(req.params.departmentId);
      const permissionLevel: PermissionLevel =
        req.params.permissionLevel ? (req.params.permissionLevel as PermissionLevel) : 'read';

      // Get the admin's tenant ID
      const [adminRows] = await execute<RowDataPacket[]>(GET_ADMIN_TENANT_QUERY, [adminId]);

      if (adminRows.length === 0) {
        res.status(404).json(errorResponse(NOT_FOUND_ERROR, ADMIN_NOT_FOUND));
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
      logger.error('[Admin Permissions v2] Check access error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to check access'));
      }
    }
  },
};
