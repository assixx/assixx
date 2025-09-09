/**
 * Department Access Middleware
 * Checks if admin users have permission to access specific departments
 */
import { NextFunction, Request, Response } from 'express';

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
  body: {
    department_id?: string | number;
    departmentId?: string | number;
    [key: string]: unknown;
  };
}

/**
 * Middleware to check department access for admin users
 */
export const checkDepartmentAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authReq = req;
  const { user } = authReq;

  if (!user) {
    res.status(401).json({ error: 'Nicht authentifiziert' });
    return;
  }

  // Root and employees bypass department checks
  if (user.role === 'root' || user.role === 'employee') {
    next();
    return;
  }

  // For admin users, check department permissions
  if (user.role === 'admin') {
    // Extract department_id from various sources
    let departmentId: number | undefined;

    // Check body
    if (authReq.body.department_id != null) {
      departmentId = Number.parseInt(String(authReq.body.department_id));
    }
    // Check query parameters
    else if (req.query.department_id != null) {
      departmentId = Number.parseInt(req.query.department_id as string);
    }
    // Check route parameters
    else if ('department_id' in req.params && req.params.department_id) {
      departmentId = Number.parseInt(req.params.department_id);
    }
    // Check for departmentId variant
    else if (authReq.body.departmentId != null) {
      departmentId = Number.parseInt(String(authReq.body.departmentId));
    } else if (req.query.departmentId != null) {
      departmentId = Number.parseInt(req.query.departmentId as string);
    } else if ('departmentId' in req.params && req.params.departmentId) {
      departmentId = Number.parseInt(req.params.departmentId);
    }

    // If department_id is found, check access
    if (departmentId != null && !Number.isNaN(departmentId) && departmentId !== 0) {
      // Determine required permission level based on HTTP method
      let requiredPermission: 'read' | 'write' | 'delete' = 'read';

      if (req.method === 'DELETE') {
        requiredPermission = 'delete';
      } else if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        requiredPermission = 'write';
      }

      const hasAccess = await adminPermissionService.hasAccess(
        user.id,
        departmentId,
        user.tenant_id,
        requiredPermission,
      );

      if (!hasAccess) {
        logger.warn(
          `Admin ${user.id} attempted to access department ${departmentId} without permission (${requiredPermission})`,
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
  next: NextFunction,
): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const { user } = authReq;

  if (!user || user.role !== 'admin') {
    next();
    return;
  }

  // Type assertion for user with proper check
  if (!user.id || typeof user.tenant_id !== 'number') {
    next();
    return;
  }

  // Get departments upfront for the admin
  const { departments } = await adminPermissionService.getAdminDepartments(user.id, user.tenant_id);
  const allowedDeptIds = new Set(departments.map((d) => d.id));

  // Store the original json method
  const originalJson = res.json.bind(res);

  // Override the json method to filter results - type cast required for complex override
  (res as Response & { json: (data: unknown) => Response }).json = function (
    data: unknown,
  ): Response {
    // If data is an array of items with department_id
    if (Array.isArray(data)) {
      // Filter items based on department access
      const filteredData = data.filter((item) => {
        if (typeof item === 'object' && item !== null) {
          const deptItem = item as Record<string, unknown>;
          if ('department_id' in deptItem && typeof deptItem.department_id === 'number') {
            return allowedDeptIds.has(deptItem.department_id);
          }
          if ('departmentId' in deptItem && typeof deptItem.departmentId === 'number') {
            return allowedDeptIds.has(deptItem.departmentId);
          }
        }
        // If no department field, include the item
        return true;
      });

      // Call the original json method with filtered data
      return originalJson(filteredData);
    }

    // Call the original json method with original data
    return originalJson(data);
  };

  next();
};

/**
 * Helper function to get allowed department IDs for an admin
 */
export const getAllowedDepartmentIds = async (
  userId: number,
  tenantId: number,
): Promise<number[]> => {
  const { departments } = await adminPermissionService.getAdminDepartments(userId, tenantId);

  return departments.map((d) => d.id);
};
