/**
 * Role Check Middleware for API v2
 * Enforces role-based access control
 */
import { NextFunction, RequestHandler, Response } from 'express';

import type { AuthenticatedRequest } from '../../types/request.types.js';
import { errorResponse } from '../../utils/apiResponse.js';

/**
 * Creates a middleware that checks if the user has one of the required roles
 * @param allowedRoles - Array of roles that are allowed to access the route
 */
export function requireRoleV2(allowedRoles: string[]): RequestHandler {
  return ((req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Check if user is authenticated
    // Note: This check is necessary as the type system doesn't guarantee user exists
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!req.user) {
      res.status(401).json(errorResponse('UNAUTHORIZED', 'Authentication required'));
      return;
    }

    // Check if user has one of the allowed roles
    const userRole = req.user.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      res
        .status(403)
        .json(errorResponse('FORBIDDEN', "You don't have permission to perform this action"));
      return;
    }

    // User has the required role, proceed
    next();
  }) as RequestHandler;
}
