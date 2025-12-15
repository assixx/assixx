/**
 * Department Access Middleware
 * Checks if admin users have permission to access specific departments
 */
import { NextFunction, Response } from 'express';

import { hierarchyPermissionService } from '../services/hierarchyPermission.service.js';
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
  if (req.query['department_id'] != null) {
    return Number.parseInt(req.query['department_id'] as string);
  }

  // Check camelCase variant in query
  if (req.query['departmentId'] != null) {
    return Number.parseInt(req.query['departmentId'] as string);
  }

  // Check snake_case variant in params
  if ('department_id' in req.params && req.params['department_id'] !== '') {
    return Number.parseInt(req.params['department_id']);
  }

  // Check camelCase variant in params
  if ('departmentId' in req.params && req.params['departmentId'] !== '') {
    return Number.parseInt(req.params['departmentId']);
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
 * Middleware to check department access for ALL users (admin + employee)
 *
 * Permission Flow (hierarchyPermissionService):
 * 1. Root → always pass
 * 2. has_full_access flag → pass
 * 3. Direct department permission
 * 4. Inherited from Area permission
 */
export const checkDepartmentAccess = async (
  req: DepartmentAccessRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const { user } = req;

  // Root always bypasses (code-level guarantee)
  if (user.role === 'root') {
    next();
    return;
  }

  // Extract department ID - if none, allow through
  const departmentId = extractDepartmentId(req);
  if (departmentId == null || Number.isNaN(departmentId) || departmentId === 0) {
    next();
    return;
  }

  // Use hierarchyPermissionService for ALL other roles (admin + employee)
  // This handles: has_full_access flag, direct permissions, area inheritance
  const requiredPermission = getRequiredPermission(req.method);
  const hasAccess = await hierarchyPermissionService.hasAccess(
    user.id,
    user.tenant_id,
    'department',
    departmentId,
    requiredPermission,
  );

  if (!hasAccess) {
    handleUnauthorizedAccess(res, user.id, departmentId, requiredPermission);
    return;
  }

  next();
};

/**
 * Middleware to filter department-related results based on user permissions
 * This should be used in list endpoints to filter results
 *
 * Works for ALL roles using hierarchyPermissionService:
 * - Root / has_full_access → no filtering
 * - Admin / Employee → filter by accessible departments (direct + area inheritance)
 */
export const filterDepartmentResults = async (
  req: DepartmentAccessRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authReq = req;
  const { user } = authReq;

  // Root bypasses filtering
  if (user.role === 'root') {
    next();
    return;
  }

  // Type assertion for user with proper check
  if (typeof user.id !== 'number' || user.id === 0 || typeof user.tenant_id !== 'number') {
    next();
    return;
  }

  // Get accessible departments using hierarchyPermissionService
  // This handles: has_full_access, direct permissions, area inheritance
  const accessibleDeptIds = await hierarchyPermissionService.getAccessibleDepartmentIds(
    user.id,
    user.tenant_id,
  );
  const allowedDeptIds = new Set(accessibleDeptIds);

  // Store the original json method
  const originalJson = res.json.bind(res);

  // Helper to filter array by department access
  const filterByDepartment = (items: unknown[]): unknown[] => {
    return items.filter((item: unknown) => {
      if (typeof item === 'object' && item !== null) {
        const deptItem = item as Record<string, unknown>;
        // Use bracket notation for index signature access
        if ('department_id' in deptItem && typeof deptItem['department_id'] === 'number') {
          return allowedDeptIds.has(deptItem['department_id']);
        }
        if ('departmentId' in deptItem && typeof deptItem['departmentId'] === 'number') {
          return allowedDeptIds.has(deptItem['departmentId']);
        }
      }
      // If no department field, include the item
      return true;
    });
  };

  // Override the json method to filter results - type cast required for complex override
  (res as Response & { json: (data: unknown) => Response }).json = function (
    data: unknown,
  ): Response {
    // Case 1: Direct array response
    if (Array.isArray(data)) {
      return originalJson(filterByDepartment(data));
    }

    // Case 2: Paginated response with data array { data: [...], pagination: {...} }
    if (typeof data === 'object' && data !== null && 'data' in data) {
      const responseObj = data as Record<string, unknown>;
      if (Array.isArray(responseObj['data'])) {
        const filteredData = filterByDepartment(responseObj['data'] as unknown[]);
        return originalJson({ ...responseObj, data: filteredData });
      }
    }

    // Call the original json method with original data
    return originalJson(data);
  };

  next();
};

/**
 * Helper function to get allowed department IDs for any user
 * Uses hierarchyPermissionService for proper inheritance support
 */
export const getAllowedDepartmentIds = async (
  userId: number,
  tenantId: number,
): Promise<number[]> => {
  return await hierarchyPermissionService.getAccessibleDepartmentIds(userId, tenantId);
};

/**
 * Factory function to create department filter middleware with configurable field
 * @param fieldName - The field to filter on ('department_id', 'departmentId', or 'id')
 */
export const createDepartmentFilter = (fieldName: 'department_id' | 'departmentId' | 'id') => {
  return async (req: DepartmentAccessRequest, res: Response, next: NextFunction): Promise<void> => {
    const { user } = req;

    // Root bypasses filtering
    if (user.role === 'root') {
      next();
      return;
    }

    if (typeof user.id !== 'number' || user.id === 0 || typeof user.tenant_id !== 'number') {
      next();
      return;
    }

    // Get accessible departments using hierarchyPermissionService
    const accessibleDeptIds = await hierarchyPermissionService.getAccessibleDepartmentIds(
      user.id,
      user.tenant_id,
    );
    const allowedDeptIds = new Set(accessibleDeptIds);

    const originalJson = res.json.bind(res);

    const filterByField = (items: unknown[]): unknown[] => {
      return items.filter((item: unknown) => {
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          // eslint-disable-next-line security/detect-object-injection -- fieldName is a compile-time constant from type union ('department_id' | 'departmentId' | 'id'), not user input
          const fieldValue = obj[fieldName];
          if (typeof fieldValue === 'number') {
            return allowedDeptIds.has(fieldValue);
          }
        }
        return true;
      });
    };

    (res as Response & { json: (data: unknown) => Response }).json = function (
      data: unknown,
    ): Response {
      if (Array.isArray(data)) {
        return originalJson(filterByField(data));
      }
      if (typeof data === 'object' && data !== null && 'data' in data) {
        const responseObj = data as Record<string, unknown>;
        if (Array.isArray(responseObj['data'])) {
          const filteredData = filterByField(responseObj['data'] as unknown[]);
          return originalJson({ ...responseObj, data: filteredData });
        }
      }
      return originalJson(data);
    };

    next();
  };
};

// Pre-configured filters for common use cases
export const filterDepartmentsByAccess = createDepartmentFilter('id');
// NOTE: Use camelCase 'departmentId' because dbToApi() converts snake_case to camelCase
export const filterTeamsByDepartment = createDepartmentFilter('departmentId');

/**
 * Filter areas by user's accessible area IDs
 * Uses hierarchyPermissionService.getAccessibleAreaIds()
 */
export const filterAreasByAccess = async (
  req: DepartmentAccessRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const { user } = req;

  // Root bypasses filtering
  if (user.role === 'root') {
    next();
    return;
  }

  if (typeof user.id !== 'number' || user.id === 0 || typeof user.tenant_id !== 'number') {
    next();
    return;
  }

  // Get accessible areas using hierarchyPermissionService
  const accessibleAreaIds = await hierarchyPermissionService.getAccessibleAreaIds(
    user.id,
    user.tenant_id,
  );
  const allowedAreaIds = new Set(accessibleAreaIds);

  const originalJson = res.json.bind(res);

  const filterByAreaId = (items: unknown[]): unknown[] => {
    return items.filter((item: unknown) => {
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        if ('id' in obj && typeof obj['id'] === 'number') {
          return allowedAreaIds.has(obj['id']);
        }
      }
      return true;
    });
  };

  (res as Response & { json: (data: unknown) => Response }).json = function (
    data: unknown,
  ): Response {
    if (Array.isArray(data)) {
      return originalJson(filterByAreaId(data));
    }
    if (typeof data === 'object' && data !== null && 'data' in data) {
      const responseObj = data as Record<string, unknown>;
      if (Array.isArray(responseObj['data'])) {
        const filteredData = filterByAreaId(responseObj['data'] as unknown[]);
        return originalJson({ ...responseObj, data: filteredData });
      }
    }
    return originalJson(data);
  };

  next();
};
