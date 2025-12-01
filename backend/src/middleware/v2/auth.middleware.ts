/**
 * API v2 Authentication Middleware
 * Handles JWT validation for protected routes in API v2
 */
import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';

import type { AuthUser, AuthenticatedRequest, PublicRequest } from '../../types/request.types.js';
import { errorResponse } from '../../utils/apiResponse.js';
import { RowDataPacket, query as executeQuery } from '../../utils/db.js';
import { dbToApi } from '../../utils/fieldMapping.js';

const JWT_SECRET = process.env['JWT_SECRET'] ?? '';
const JWT_REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'] ?? '';

if (JWT_SECRET === '' && process.env['NODE_ENV'] === 'production') {
  throw new Error('JWT_SECRET must be set in production!');
}

interface JWTPayload {
  id: number;
  email: string;
  role: string;
  tenantId?: number;
  tenant_id?: number; // Support both formats
  type?: 'access' | 'refresh'; // v1 tokens don't have this
  // Role switch fields
  activeRole?: string;
  isRoleSwitched?: boolean;
  iat?: number;
  exp?: number;
}

interface UserDetails {
  id: number;
  username: string;
  email: string;
  role: string;
  tenantId: number;
  tenantName?: string;
  firstName?: string;
  lastName?: string;
  departmentId?: number | null;
  departmentName?: string;
  employeeNumber?: string;
  profilePicture?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Extract token from request (Authorization header, cookie, or query param)
 * Priority: Authorization header, then Cookie, then Query param
 */
function extractBearerToken(req: PublicRequest): string | null {
  // First check Authorization header (API calls with fetch/XHR)
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookie for page requests (browser navigation sends cookies, not headers)
  const cookieToken = req.cookies['token'] as string | undefined;
  if (typeof cookieToken === 'string' && cookieToken !== '') {
    return cookieToken;
  }

  // For SSE/EventSource, check query parameter (they can't send headers)
  if (typeof req.query['token'] === 'string' && req.query['token'] !== '') {
    return req.query['token'];
  }

  return null;
}

/**
 * Verify JWT token and return payload
 */
function verifyAccessToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // v1 tokens don't have type field, allow them
    if (decoded.type !== undefined && decoded.type !== 'access') {
      return null;
    }

    // Normalize tenant_id to tenantId
    if (decoded.tenantId === undefined && typeof decoded.tenant_id === 'number') {
      decoded.tenantId = decoded.tenant_id;
    }

    return decoded;
  } catch (error: unknown) {
    if (error instanceof jwt.TokenExpiredError) {
      console.info('[AUTH v2] Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.info('[AUTH v2] Invalid token');
    }
    return null;
  }
}

/**
 * Get user details from database with camelCase fields
 */
async function getUserDetails(userId: number, tenantId: number): Promise<UserDetails | null> {
  try {
    // N:M REFACTORING: JOIN via user_departments table instead of users.department_id
    const [users] = await executeQuery<RowDataPacket[]>(
      `SELECT
        u.id,
        u.username,
        u.email,
        u.role,
        u.tenant_id,
        u.first_name,
        u.last_name,
        u.employee_number,
        ud.department_id,
        u.profile_picture,
        u.is_active,
        u.created_at,
        u.updated_at,
        t.company_name as tenant_name,
        d.name as department_name
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
      LEFT JOIN departments d ON ud.department_id = d.id
      WHERE u.id = $1 AND u.tenant_id = $2 AND u.is_active = true`,
      [userId, tenantId],
    );

    const user = users[0];
    if (user === undefined) {
      return null;
    }

    // Convert to camelCase for API v2
    return dbToApi(user) as unknown as UserDetails;
  } catch (error: unknown) {
    console.error('[AUTH v2] User lookup error:', error);
    return null;
  }
}

type ValidRole = 'root' | 'admin' | 'employee';
const VALID_ROLES: readonly ValidRole[] = ['root', 'admin', 'employee'];

/** Validate and extract role from decoded token */
function extractValidRole(roleValue: unknown, fallback: ValidRole = 'employee'): ValidRole {
  if (typeof roleValue === 'string' && VALID_ROLES.includes(roleValue as ValidRole)) {
    return roleValue as ValidRole;
  }
  return fallback;
}

/** Build AuthUser object from user details and token data */
function buildAuthUser(
  userDetails: UserDetails,
  role: ValidRole,
  activeRole: ValidRole,
  isRoleSwitched: boolean,
): AuthUser {
  const authUser: AuthUser = {
    id: userDetails.id,
    userId: userDetails.id,
    username: userDetails.username,
    email: userDetails.email,
    role,
    tenant_id: userDetails.tenantId,
    department_id: userDetails.departmentId ?? null,
    activeRole,
    isRoleSwitched,
  };
  if (userDetails.tenantName !== undefined) authUser.tenantName = userDetails.tenantName;
  if (userDetails.firstName !== undefined) authUser.first_name = userDetails.firstName;
  if (userDetails.lastName !== undefined) authUser.last_name = userDetails.lastName;
  return authUser;
}

/**
 * Main authentication middleware for API v2
 */
export async function authenticateV2(
  req: PublicRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Extract token from Authorization header
    const token = extractBearerToken(req);

    // eslint-disable-next-line security/detect-possible-timing-attacks -- False positive: checking token existence (null), not comparing secret values
    if (token === null) {
      res.status(401).json(errorResponse('UNAUTHORIZED', 'Authentication token required'));
      return;
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    if (decoded === null) {
      res.status(401).json(errorResponse('INVALID_TOKEN', 'Invalid or expired token'));
      return;
    }

    // Get tenant ID from decoded token (support both formats)
    const tenantId = decoded.tenantId ?? decoded.tenant_id;

    if (tenantId === undefined || tenantId === 0) {
      res.status(401).json(errorResponse('INVALID_TOKEN', 'Token missing tenant information'));
      return;
    }

    // Get fresh user details from database
    const userDetails = await getUserDetails(decoded.id, tenantId);

    if (!userDetails) {
      res.status(403).json(errorResponse('USER_NOT_FOUND', 'User not found or inactive'));
      return;
    }

    // Validate roles using helpers
    const role = extractValidRole(decoded.role);
    const activeRole = extractValidRole(decoded.activeRole, role);

    // Build and attach user to request
    const authUser = buildAuthUser(userDetails, role, activeRole, Boolean(decoded.isRoleSwitched));
    (req as AuthenticatedRequest).user = authUser;
    (req as AuthenticatedRequest).userId = userDetails.id;
    (req as AuthenticatedRequest).tenantId = userDetails.tenantId;

    next();
  } catch (error: unknown) {
    console.error('[AUTH v2] Unexpected error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Authentication error'));
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
export async function optionalAuthV2(
  req: PublicRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearerToken(req);

  // eslint-disable-next-line security/detect-possible-timing-attacks -- False positive: checking token existence (null), not comparing secret values
  if (token === null) {
    // No token, continue without auth
    next();
    return;
  }

  // If token provided, validate it but don't fail
  try {
    await authenticateV2(req, res, () => {
      next();
    });
  } catch {
    // Invalid token, but continue anyway
    next();
  }
}

/**
 * Role-based authorization for API v2
 */
export function requireRoleV2(allowedRoles: string | string[]) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // When role-switched, use activeRole for permission checks
    const currentRole = req.user.activeRole ?? req.user.role;

    // Root has access to everything (check original role)
    if (req.user.role === 'root') {
      next();
      return;
    }

    // Check if user's current role is allowed
    if (roles.includes(currentRole)) {
      next();
      return;
    }

    // Admin can access admin and employee resources
    if (req.user.role === 'admin' && roles.includes('employee')) {
      next();
      return;
    }

    res.status(403).json(errorResponse('FORBIDDEN', 'Insufficient permissions'));
  };
}

/**
 * Verify refresh token for token refresh endpoint
 */
export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    const secret = JWT_REFRESH_SECRET !== '' ? JWT_REFRESH_SECRET : JWT_SECRET;
    const decoded = jwt.verify(token, secret) as JWTPayload;

    // Ensure it's a refresh token
    if (decoded.type !== 'refresh') {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

// Export all v2 auth middleware
export default {
  authenticate: authenticateV2,
  optionalAuth: optionalAuthV2,
  requireRole: requireRoleV2,
  verifyRefreshToken,
};
