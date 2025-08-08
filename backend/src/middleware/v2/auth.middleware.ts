/**
 * API v2 Authentication Middleware
 * Handles JWT validation for protected routes in API v2
 */

import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { RowDataPacket } from "mysql2/promise";

import { executeQuery } from "../../database";
import { AuthenticatedRequest, PublicRequest } from "../../types/request.types";
import { errorResponse } from "../../utils/apiResponse";
import { dbToApi } from "../../utils/fieldMapping";

const JWT_SECRET = process.env.JWT_SECRET ?? "";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "";

if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET must be set in production!");
}

interface JWTPayload {
  id: number;
  email: string;
  role: string;
  tenantId?: number;
  tenant_id?: number; // Support both formats
  type?: "access" | "refresh"; // v1 tokens don't have this
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
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(req: PublicRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Verify JWT token and return payload
 */
async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // v1 tokens don't have type field, allow them
    if (decoded.type && decoded.type !== "access") {
      return null;
    }

    // Normalize tenant_id to tenantId
    if (!decoded.tenantId && decoded.tenant_id) {
      decoded.tenantId = decoded.tenant_id;
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.info("[AUTH v2] Token expired");
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.info("[AUTH v2] Invalid token");
    }
    return null;
  }
}

/**
 * Get user details from database with camelCase fields
 */
async function getUserDetails(
  userId: number,
  tenantId: number,
): Promise<UserDetails | null> {
  try {
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
        u.department_id,
        u.profile_picture,
        u.is_active,
        u.created_at,
        u.updated_at,
        t.company_name as tenant_name,
        d.name as department_name
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ? AND u.tenant_id = ? AND u.is_active = 1`,
      [userId, tenantId],
    );

    if (users.length === 0) {
      return null;
    }

    // Convert to camelCase for API v2
    return dbToApi(users[0]);
  } catch (error) {
    console.error("[AUTH v2] User lookup error:", error);
    return null;
  }
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

    if (!token) {
      res
        .status(401)
        .json(errorResponse("UNAUTHORIZED", "Authentication token required"));
      return;
    }

    // Verify token
    const decoded = await verifyAccessToken(token);

    if (!decoded) {
      res
        .status(401)
        .json(errorResponse("INVALID_TOKEN", "Invalid or expired token"));
      return;
    }

    // Get tenant ID from decoded token (support both formats)
    const tenantId = decoded.tenantId ?? decoded.tenant_id;

    if (!tenantId) {
      res
        .status(401)
        .json(
          errorResponse("INVALID_TOKEN", "Token missing tenant information"),
        );
      return;
    }

    // Get fresh user details from database
    const userDetails = await getUserDetails(decoded.id, tenantId);

    if (!userDetails) {
      res
        .status(403)
        .json(errorResponse("USER_NOT_FOUND", "User not found or inactive"));
      return;
    }

    // Attach user to request with v2 field names
    (req as AuthenticatedRequest).user = {
      id: userDetails.id,
      userId: userDetails.id,
      username: userDetails.username,
      email: userDetails.email,
      role: decoded.role, // CRITICAL: Always use the original role from JWT
      tenant_id: userDetails.tenantId,
      tenantName: userDetails.tenantName,
      first_name: userDetails.firstName,
      last_name: userDetails.lastName,
      department_id: userDetails.departmentId,
      // Role switch information from JWT
      activeRole: decoded.activeRole ?? decoded.role,
      isRoleSwitched: Boolean(decoded.isRoleSwitched), // Convert to boolean explicitly
    };
    // Add tenantId to request root for controllers
    (req as AuthenticatedRequest).tenantId = userDetails.tenantId;

    // Also attach for convenience
    (req as AuthenticatedRequest).userId = userDetails.id;
    (req as AuthenticatedRequest).tenantId = userDetails.tenantId;

    next();
  } catch (error) {
    console.error("[AUTH v2] Unexpected error:", error);
    res.status(500).json(errorResponse("SERVER_ERROR", "Authentication error"));
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

  if (!token) {
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

  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      res
        .status(401)
        .json(errorResponse("UNAUTHORIZED", "Authentication required"));
      return;
    }

    // When role-switched, use activeRole for permission checks
    const currentRole = req.user.activeRole ?? req.user.role;

    // Root has access to everything (check original role)
    if (req.user.role === "root") {
      next();
      return;
    }

    // Check if user's current role is allowed
    if (roles.includes(currentRole)) {
      next();
      return;
    }

    // Admin can access admin and employee resources
    if (req.user.role === "admin" && roles.includes("employee")) {
      next();
      return;
    }

    res
      .status(403)
      .json(errorResponse("FORBIDDEN", "Insufficient permissions"));
  };
}

/**
 * Verify refresh token for token refresh endpoint
 */
export async function verifyRefreshToken(
  token: string,
): Promise<JWTPayload | null> {
  try {
    const decoded = jwt.verify(
      token,
      JWT_REFRESH_SECRET || JWT_SECRET,
    ) as JWTPayload;

    // Ensure it's a refresh token
    if (decoded.type !== "refresh") {
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
