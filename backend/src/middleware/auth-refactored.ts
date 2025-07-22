/**
 * Refactored Authentication Middleware with proper TypeScript types
 * This replaces the authenticateToken function with a type-safe implementation
 */

import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { RowDataPacket } from "mysql2/promise";

import { executeQuery } from "../database";
import { TokenPayload } from "../types/auth.types";
import { AuthenticationMiddleware } from "../types/middleware.types";
import {
  AuthenticatedRequest,
  PublicRequest,
  AuthUser,
} from "../types/request.types";
import { errorResponse } from "../types/response.types";

// Get JWT secret with proper fallback
const JWT_SECRET = process.env.JWT_SECRET ?? "";

if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET must be set in production!");
}

// Helper to extract token from request
function extractToken(req: PublicRequest): string | null {
  // Check Authorization header
  const authHeader = req.headers["authorization"];
  console.log("[AUTH-REFACTORED] Auth header:", authHeader);
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : null;

  // Check cookie as fallback
  const cookieToken = req.cookies?.token;
  console.log("[AUTH-REFACTORED] Cookie token:", !!cookieToken);

  const result = bearerToken ?? cookieToken ?? null;
  console.log("[AUTH-REFACTORED] Extracted token:", !!result, result?.substring(0, 20) + "...");
  return result;
}

// Helper to verify JWT token
async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === "string" || !decoded) {
      return null;
    }
    return decoded as TokenPayload;
  } catch {
    return null;
  }
}

// Helper to validate session (optional)
async function validateSession(
  userId: number,
  sessionId?: string,
): Promise<boolean> {
  if (!sessionId || process.env.VALIDATE_SESSIONS !== "true") {
    return true;
  }

  try {
    const [sessions] = await executeQuery<RowDataPacket[]>(
      "SELECT id FROM user_sessions WHERE user_id = ? AND session_id = ? AND expires_at > NOW()",
      [userId, sessionId],
    );
    return sessions.length > 0;
  } catch (error) {
    console.error("[AUTH] Session validation error:", error);
    // Allow access if database is down
    return true;
  }
}

// Helper to get user details from database
async function getUserDetails(
  userId: number,
): Promise<Partial<AuthUser> | null> {
  try {
    console.log("[AUTH-REFACTORED] Getting user details for ID:", userId);
    const [users] = await executeQuery<RowDataPacket[]>(
      `SELECT 
        u.id, u.username, u.email, u.role, u.tenant_id,
        u.first_name as firstName, u.last_name as lastName,
        u.department_id, u.position,
        t.company_name as tenantName
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.id = ? AND u.is_active = 1`,
      [userId],
    );
    console.log("[AUTH-REFACTORED] User query result:", users.length, "rows");

    if (users.length === 0) {
      console.log("[AUTH-REFACTORED] No active user found for ID:", userId);
      return null;
    }

    const user = users[0];
    return {
      id: user.id,
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
      tenantName: user.tenantName,
      first_name: user.firstName,
      last_name: user.lastName,
      department_id: user.department_id,
      position: user.position,
    };
  } catch (error) {
    console.error("[AUTH] User lookup error:", error);
    return null;
  }
}

// Main authentication middleware with proper types
export const authenticateToken: AuthenticationMiddleware = async function (
  req: PublicRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Extract token
    const token = extractToken(req);
    console.log("[AUTH-REFACTORED] Token extracted:", !!token);

    if (!token) {
      console.log("[AUTH-REFACTORED] No token found in request");
      res
        .status(401)
        .json(errorResponse("Authentication token required", 401, "NO_TOKEN"));
      return;
    }

    // Verify token
    const decoded = await verifyToken(token);
    console.log("[AUTH-REFACTORED] Token decoded:", !!decoded, decoded?.id);

    if (!decoded) {
      console.log("[AUTH-REFACTORED] Token verification failed");
      res
        .status(403)
        .json(errorResponse("Invalid or expired token", 403, "INVALID_TOKEN"));
      return;
    }

    // Validate session if enabled
    const sessionValid = await validateSession(decoded.id, decoded.sessionId);

    if (!sessionValid) {
      res
        .status(403)
        .json(
          errorResponse("Session expired or not found", 403, "SESSION_EXPIRED"),
        );
      return;
    }

    // Get fresh user details from database
    const userDetails = await getUserDetails(decoded.id);
    console.log("[AUTH-REFACTORED] User details fetched:", !!userDetails, userDetails?.id);

    if (!userDetails) {
      console.log("[AUTH-REFACTORED] User not found or inactive");
      res
        .status(403)
        .json(
          errorResponse("User not found or inactive", 403, "USER_NOT_FOUND"),
        );
      return;
    }

    // Build authenticated user object
    const authenticatedUser: AuthUser = {
      id: userDetails.id ?? 0,
      userId: userDetails.id ?? 0,
      username: userDetails.username ?? "",
      email: userDetails.email ?? "",
      role: decoded.activeRole ?? userDetails.role ?? "", // Support role switching
      tenant_id: userDetails.tenant_id ?? 0,
      tenantName: userDetails.tenantName,
      first_name: userDetails.first_name,
      last_name: userDetails.last_name,
      department_id: userDetails.department_id,
      position: userDetails.position,
    };

    // Attach user to request
    (req as AuthenticatedRequest).user = authenticatedUser;
    (req as AuthenticatedRequest).userId = authenticatedUser.id;
    (req as AuthenticatedRequest).tenantId = authenticatedUser.tenant_id;

    next();
  } catch (error) {
    console.error("[AUTH] Unexpected error:", error);
    res
      .status(500)
      .json(errorResponse("Authentication error", 500, "AUTH_ERROR"));
  }
};

// Optional authentication middleware (doesn't fail if no token)
export async function optionalAuth(
  req: PublicRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    // No token, but that's okay for optional auth
    next();
    return;
  }

  // If token is provided, validate it
  await authenticateToken(req, res, (err?: unknown) => {
    if (err) {
      // Token is invalid, but continue anyway for optional auth
      console.warn("[AUTH] Invalid token in optional auth:", err);
    }
    next();
  });
}

// Role-based authorization middleware
export function requireRole(allowedRoles: string | string[]) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      res
        .status(401)
        .json(
          errorResponse("Authentication required", 401, "NOT_AUTHENTICATED"),
        );
      return;
    }

    // Root has access to everything
    if (req.user.role === "root") {
      next();
      return;
    }

    // Check if user's role is allowed
    if (roles.includes(req.user.role)) {
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
      .json(errorResponse("Insufficient permissions", 403, "FORBIDDEN"));
  };
}

// Export for backward compatibility
export default authenticateToken;
