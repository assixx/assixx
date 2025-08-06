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
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : null;

  // Check cookie as fallback
  const cookieToken = req.cookies?.token;

  return bearerToken ?? cookieToken ?? null;
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
    const [users] = await executeQuery<RowDataPacket[]>(
      `SELECT 
        u.id, u.username, u.email, u.role, u.tenant_id,
        u.first_name as firstName, u.last_name as lastName,
        u.department_id,
        t.company_name as tenantName
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.id = ? AND u.is_active = 1`,
      [userId],
    );

    if (users.length === 0) {
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

    if (!token) {
      res
        .status(401)
        .json(errorResponse("Authentication token required", 401, "NO_TOKEN"));
      return;
    }

    // Verify token
    const decoded = await verifyToken(token);

    if (!decoded) {
      // Check if request accepts HTML (browser request) vs JSON (API request)
      const acceptsHtml = req.headers.accept?.includes("text/html");

      if (acceptsHtml) {
        // Send HTML page that redirects to login with timeout parameter
        res.status(403).send(`
          <!DOCTYPE html>
          <html lang="de">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Sitzung abgelaufen - Assixx</title>
            <link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&display=swap" rel="stylesheet">
            <style>
              :root {
                --primary-color: #2196f3;
                --primary-dark: #1976d2;
                --text-primary: #ffffff;
                --text-secondary: rgba(255, 255, 255, 0.7);
                --spacing-md: 16px;
                --spacing-lg: 24px;
                --spacing-xl: 32px;
                --radius-md: 12px;
              }
              
              * { margin: 0; padding: 0; box-sizing: border-box; }
              
              body {
                font-family: 'Ubuntu', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #000000;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                position: relative;
                overflow-x: hidden;
              }
              
              body::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: radial-gradient(circle at 50% 50%, #1e1e1e 0%, #121212 50%, #0a0a0a 100%);
                opacity: 0.9;
                z-index: -1;
              }
              
              body::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(5deg, transparent, rgba(0, 142, 255, 0.1) 100%, #01000482 0, rgba(0, 0, 4, 0.6) 100%, #000);
                z-index: -1;
              }
              
              .session-expired-card {
                width: 100%;
                max-width: 450px;
                background: rgba(255, 255, 255, 0.02);
                backdrop-filter: blur(20px) saturate(180%);
                -webkit-backdrop-filter: blur(20px) saturate(180%);
                padding: var(--spacing-xl);
                border-radius: var(--radius-md);
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05);
                border: 1px solid hsla(0, 0%, 100%, 0.1);
                text-align: center;
                animation: fadeInUp 0.6s ease-out;
              }
              
              @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(30px); }
                to { opacity: 1; transform: translateY(0); }
              }
              
              .icon {
                font-size: 64px;
                margin-bottom: var(--spacing-lg);
                display: inline-block;
                color: #ff9800;
              }
              
              h1 {
                color: var(--text-primary);
                font-size: 28px;
                font-weight: 700;
                margin-bottom: var(--spacing-md);
              }
              
              .message {
                color: var(--text-secondary);
                font-size: 16px;
                line-height: 1.6;
                margin-bottom: var(--spacing-xl);
              }
              
              .security-info {
                background: rgba(255, 152, 0, 0.1);
                border: 1px solid rgba(255, 152, 0, 0.2);
                border-radius: var(--radius-md);
                padding: var(--spacing-lg);
                margin-bottom: var(--spacing-xl);
              }
              
              .security-text {
                color: #ff9800;
                font-size: 14px;
                font-weight: 500;
              }
              
              .redirect-info {
                color: var(--text-secondary);
                font-size: 14px;
                margin-bottom: var(--spacing-lg);
              }
              
              .btn-primary {
                display: inline-block;
                padding: var(--spacing-md) var(--spacing-xl);
                background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 500;
                font-size: 16px;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
              }
              
              .btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(33, 150, 243, 0.4);
              }
              
              .countdown {
                color: var(--primary-color);
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            <div class="session-expired-card">
              <div class="icon">🔒</div>
              <h1>Sitzung abgelaufen</h1>
              <p class="message">
                Ihre Sitzung ist aus Sicherheitsgründen abgelaufen. 
                Bitte melden Sie sich erneut an, um fortzufahren.
              </p>
              <div class="security-info">
                <p class="security-text">🛡️ Automatische Abmeldung zum Schutz Ihrer Daten</p>
              </div>
              <p class="redirect-info">
                Sie werden in <span id="countdown" class="countdown">5</span> Sekunden zur Anmeldeseite weitergeleitet...
              </p>
              <a href="/login?timeout=true" class="btn-primary">Jetzt anmelden</a>
            </div>
            
            <script>
              // Clear all local storage to ensure clean logout
              localStorage.clear();
              sessionStorage.clear();
              
              // Clear all cookies
              document.cookie.split(";").forEach(function(c) { 
                document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
              });
              
              // Countdown and redirect
              let seconds = 5;
              const countdownEl = document.getElementById('countdown');
              
              const interval = setInterval(() => {
                seconds--;
                if (countdownEl) countdownEl.textContent = seconds;
                
                if (seconds <= 0) {
                  clearInterval(interval);
                  window.location.href = '/login?timeout=true';
                }
              }, 1000);
              
              // Immediate redirect if user clicks anywhere
              document.body.addEventListener('click', () => {
                window.location.href = '/login?timeout=true';
              });
            </script>
          </body>
          </html>
        `);
      } else {
        // API request - return JSON
        res
          .status(403)
          .json(
            errorResponse("Invalid or expired token", 403, "INVALID_TOKEN"),
          );
      }
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

    if (!userDetails) {
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
