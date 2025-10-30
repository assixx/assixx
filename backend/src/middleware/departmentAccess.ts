/**
 * Department Access Middleware
 * Checks if admin users have permission to access specific departments
 */
import { NextFunction, Response } from 'express';

import adminPermissionService from '../services/adminPermission.service.js';
import type { AuthenticatedRequest } from '../types/request.types.js';
import { logger } from '../utils/logger.js';

interface DepartmentAccessRequest extends AuthenticatedRequest {
  body: {
    department_id?: string | number;
    departmentId?: string | number;
    [key: string]: unknown;
  };
}

/**
 * Extract department ID from request
 */
function extractDepartmentId(req: DepartmentAccessRequest): number | undefined {
  // Check snake_case variant in body
  if (req.body.department_id != null) {
    return Number.parseInt(String(req.body.department_id));
  }

  // Check camelCase variant in body
  if (req.body.departmentId != null) {
    return Number.parseInt(String(req.body.departmentId));
  }

  // Check snake_case variant in query
  if (req.query.department_id != null) {
    return Number.parseInt(req.query.department_id as string);
  }

  // Check camelCase variant in query
  if (req.query.departmentId != null) {
    return Number.parseInt(req.query.departmentId as string);
  }

  // Check snake_case variant in params
  if ('department_id' in req.params && req.params.department_id) {
    return Number.parseInt(req.params.department_id);
  }

  // Check camelCase variant in params
  if ('departmentId' in req.params && req.params.departmentId) {
    return Number.parseInt(req.params.departmentId);
  }

  return undefined;
}

/**
 * Determine required permission based on HTTP method
 */
function getRequiredPermission(method: string): 'read' | 'write' | 'delete' {
  if (method === 'DELETE') {
    return 'delete';
  }
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    return 'write';
  }
  return 'read';
}

/**
 * Handle unauthorized department access
 */
function handleUnauthorizedAccess(
  res: Response,
  userId: number,
  departmentId: number,
  permission: string,
): void {
  logger.warn(
    `Admin ${userId} attempted to access department ${departmentId} without permission (${permission})`,
  );
  res.status(403).json({
    error: 'Keine Berechtigung für diese Abteilung',
    details: `Sie benötigen ${permission}-Rechte für diese Abteilung`,
  });
}

/**
 * Validate department access for admin
 */
async function validateAdminDepartmentAccess(
  req: DepartmentAccessRequest,
  res: Response,
  user: NonNullable<DepartmentAccessRequest['user']>,
): Promise<boolean> {
  const departmentId = extractDepartmentId(req);

  // If no department ID or invalid, allow through
  if (departmentId == null || Number.isNaN(departmentId) || departmentId === 0) {
    return true;
  }

  const requiredPermission = getRequiredPermission(req.method);
  const hasAccess = await adminPermissionService.hasAccess(
    user.id,
    departmentId,
    user.tenant_id,
    requiredPermission,
  );

  if (!hasAccess) {
    handleUnauthorizedAccess(res, user.id, departmentId, requiredPermission);
    return false;
  }

  return true;
}

/**
 * Middleware to check department access for admin users
 */
export const checkDepartmentAccess = async (
  req: DepartmentAccessRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const { user } = req;

  // Root and employees bypass department checks
  if (user.role === 'root' || user.role === 'employee') {
    next();
    return;
  }

  // For admin users (only remaining role), check department permissions
  const hasAccess = await validateAdminDepartmentAccess(req, res, user);
  if (!hasAccess) {
    return;
  }

  next();
};

/**
 * Middleware to filter department-related results based on admin permissions
 * This should be used in list endpoints to filter results
 */
export const filterDepartmentResults = async (
  req: DepartmentAccessRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authReq = req;
  const { user } = authReq;

  if (user.role !== 'admin') {
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
  const allowedDeptIds = new Set(departments.map((d: { id: number }) => d.id));

  // Store the original json method
  const originalJson = res.json.bind(res);

  // Override the json method to filter results - type cast required for complex override
  (res as Response & { json: (data: unknown) => Response }).json = function (
    data: unknown,
  ): Response {
    // If data is an array of items with department_id
    if (Array.isArray(data)) {
      // Filter items based on department access
      const filteredData = data.filter((item: unknown) => {
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

  return departments.map((d: { id: number }) => d.id);
};
