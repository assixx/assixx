/**
 * Department Access Middleware
 * Checks if admin users have permission to access specific departments
 */

import { Request, Response, NextFunction } from 'express';
import adminPermissionService from '../services/adminPermission.service.js';
import { logger } from '../utils/logger.js';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    tenant_id: number;
    username: string;
    email: string;
    role: string;
  };
}

/**
 * Middleware to check department access for admin users
 */
export const checkDepartmentAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const { user } = authReq;

  if (!user) {
    res.status(401).json({ error: 'Nicht authentifiziert' });
    return;
  }

  // Root and employees bypass department checks
  if (user.role === 'root' || user.role === 'employee') {
    return next();
  }

  // For admin users, check department permissions
  if (user.role === 'admin') {
    // Extract department_id from various sources
    let department_id: number | undefined;

    // Check body
    if (req.body && req.body.department_id) {
      department_id = parseInt(req.body.department_id);
    }
    // Check query parameters
    else if (req.query && req.query.department_id) {
      department_id = parseInt(req.query.department_id as string);
    }
    // Check route parameters
    else if (req.params && req.params.department_id) {
      department_id = parseInt(req.params.department_id);
    }
    // Check for departmentId variant
    else if (req.body && req.body.departmentId) {
      department_id = parseInt(req.body.departmentId);
    } else if (req.query && req.query.departmentId) {
      department_id = parseInt(req.query.departmentId as string);
    } else if (req.params && req.params.departmentId) {
      department_id = parseInt(req.params.departmentId);
    }

    // If department_id is found, check access
    if (department_id && !isNaN(department_id)) {
      // Determine required permission level based on HTTP method
      let requiredPermission: 'read' | 'write' | 'delete' = 'read';

      if (req.method === 'DELETE') {
        requiredPermission = 'delete';
      } else if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        requiredPermission = 'write';
      }

      const hasAccess = await adminPermissionService.hasAccess(
        user.id,
        department_id,
        user.tenant_id,
        requiredPermission
      );

      if (!hasAccess) {
        logger.warn(
          `Admin ${user.id} attempted to access department ${department_id} without permission (${requiredPermission})`
        );
        res.status(403).json({
          error: 'Keine Berechtigung für diese Abteilung',
          details: `Sie benötigen ${requiredPermission}-Rechte für diese Abteilung`,
        });
        return;
      }
    }

    // For list operations, we'll filter results in the controller
    // based on the admin's permissions
  }

  next();
};

/**
 * Middleware to filter department-related results based on admin permissions
 * This should be used in list endpoints to filter results
 */
export const filterDepartmentResults = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const { user } = authReq;

  if (!user || user.role !== 'admin') {
    return next();
  }

  // Store the original json method
  const originalJson = res.json;

  // Override the json method to filter results
  res.json = async function (this: Response, data: any): Promise<any> {
    // If data is an array of items with department_id
    if (Array.isArray(data)) {
      const { departments } = await adminPermissionService.getAdminDepartments(
        user.id,
        user.tenant_id
      );

      const allowedDeptIds = new Set(departments.map((d) => d.id));

      // Filter items based on department access
      data = data.filter((item) => {
        if (item.department_id) {
          return allowedDeptIds.has(item.department_id);
        }
        if (item.departmentId) {
          return allowedDeptIds.has(item.departmentId);
        }
        // If no department field, include the item
        return true;
      });
    }

    // Call the original json method with filtered data
    return originalJson.call(this, data);
  } as any;

  next();
};

/**
 * Helper function to get allowed department IDs for an admin
 */
export const getAllowedDepartmentIds = async (
  userId: number,
  tenantId: number
): Promise<number[]> => {
  const { departments } = await adminPermissionService.getAdminDepartments(
    userId,
    tenantId
  );

  return departments.map((d) => d.id);
};
