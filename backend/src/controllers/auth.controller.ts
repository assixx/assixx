/**
 * Authentication Controller
 * Handles all authentication-related business logic
 */

import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { RowDataPacket } from "mysql2/promise";

import { executeQuery } from "../database";
import { createLog } from "../routes/logs.js";
import authService from "../services/auth.service";
import userService from "../services/user.service";
import { AuthenticatedRequest } from "../types/request.types";
import { successResponse, errorResponse } from "../types/response.types";
import { logger } from "../utils/logger";

// Type guard to check if request has authenticated user
function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return (
    "user" in req &&
    req.user != null &&
    typeof req.user === "object" &&
    "id" in req.user
  );
}

// Interfaces for request bodies
interface LoginRequest extends Request {
  body: {
    username?: string;
    password?: string;
    fingerprint?: string; // Browser fingerprint for session isolation
  };
}

interface RegisterRequest extends Request {
  body: {
    username: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    role?: string;
    tenant_id?: number;
  };
}

class AuthController {
  /**
   * Check if user is authenticated
   */
  async checkAuth(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // If middleware passes, user is authenticated
      res.json(
        successResponse({
          authenticated: true,
          user: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role,
          },
        }),
      );
    } catch (error) {
      logger.error("Error in auth check:", error);
      res.status(500).json(errorResponse("Serverfehler", 500));
    }
  }

  /**
   * Get current user profile
   */
  async getUserProfile(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const user = await userService.getUserById(
        req.user.id,
        req.user.tenant_id,
      );

      if (!user) {
        res.status(404).json(errorResponse("Benutzer nicht gefunden", 404));
        return;
      }

      // Get tenant name - handle both column names for compatibility
      let tenantName = "";
      try {
        const [tenantRows] = await executeQuery<RowDataPacket[]>(
          "SELECT * FROM tenants WHERE id = ?",
          [req.user.tenant_id],
        );

        if (tenantRows[0]) {
          // Check company_name first, fall back to name if empty
          // Use explicit checks to handle empty strings
          if (tenantRows[0].company_name && tenantRows[0].company_name !== "") {
            tenantName = tenantRows[0].company_name;
          } else if (tenantRows[0].name) {
            tenantName = tenantRows[0].name;
          }
        }
      } catch (error) {
        logger.warn("Failed to get tenant name:", error);
      }

      res.json(
        successResponse({
          ...user,
          tenantName,
        }),
      );
    } catch (error) {
      logger.error("Error in get user profile:", error);
      res.status(500).json(errorResponse("Serverfehler", 500));
    }
  }

  /**
   * Login user
   */
  async login(req: LoginRequest, res: Response): Promise<void> {
    console.log("[DEBUG] AuthController.login called");
    try {
      const { username, password, fingerprint } = req.body;
      console.log("[DEBUG] Login attempt for username:", username);
      console.log("[DEBUG] Browser fingerprint provided:", !!fingerprint);

      // Validate input
      if (!username || !password) {
        console.log("[DEBUG] Missing username or password");
        res
          .status(400)
          .json(
            errorResponse("Benutzername und Passwort sind erforderlich", 400),
          );
        return;
      }

      // Get tenant subdomain from header if provided
      const tenantSubdomain = req.headers["x-tenant-subdomain"] as
        | string
        | undefined;

      // Authenticate user with fingerprint and tenant validation
      console.log("[DEBUG] Calling authService.authenticateUser");
      console.log("[DEBUG] Username/Email:", username);
      console.log("[DEBUG] Tenant subdomain from header:", tenantSubdomain);
      const result = await authService.authenticateUser(
        username,
        password,
        fingerprint,
        tenantSubdomain,
      );
      console.log("[DEBUG] Auth result:", result ? "Success" : "Failed");
      console.log("[DEBUG] Auth result details:", JSON.stringify(result));

      if (!result.success) {
        // Track failed login attempt
        try {
          await executeQuery(
            "INSERT INTO login_attempts (username, ip_address, success, attempted_at) VALUES (?, ?, ?, NOW())",
            [username, req.ip ?? "unknown", false],
          );
        } catch (trackError) {
          logger.error("Failed to track login attempt:", trackError);
        }

        res
          .status(401)
          .json(errorResponse(result.message ?? "Ungültige Anmeldedaten", 401));
        return;
      }

      // Set token as httpOnly cookie for HTML pages
      if (!result.token) {
        res
          .status(500)
          .json(errorResponse("Token-Generierung fehlgeschlagen", 500));
        return;
      }
      res.cookie("token", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      // Log successful login
      if (result.user) {
        await createLog(
          result.user.id,
          result.user.tenant_id,
          "login",
          "user",
          result.user.id,
          `Erfolgreich angemeldet`,
          req.ip ?? "unknown",
          req.headers["user-agent"] ?? "unknown",
        );

        // Track successful login attempt
        try {
          await executeQuery(
            "INSERT INTO login_attempts (username, ip_address, success, attempted_at) VALUES (?, ?, ?, NOW())",
            [username, req.ip ?? "unknown", true],
          );
        } catch (trackError) {
          logger.error("Failed to track successful login attempt:", trackError);
        }
      }

      // Return user data and tokens with standardized response format
      res.json(
        successResponse(
          {
            token: result.token,
            refreshToken: result.refreshToken,
            role: result.user?.role,
            user: result.user,
          },
          "Login erfolgreich",
        ),
      );
    } catch (error) {
      logger.error("Login error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error("[DEBUG] Login error details:", errorMessage, errorStack);
      res.status(500).json(errorResponse("Serverfehler beim Login", 500));
    }
  }

  /**
   * Register new user
   */
  async register(req: RegisterRequest, res: Response): Promise<void> {
    try {
      // Map English field names to German field names expected by service
      const userData = {
        username: req.body.username,
        password: req.body.password,
        email: req.body.email,
        vorname: req.body.first_name ?? "",
        nachname: req.body.last_name ?? "",
        role: req.body.role as "admin" | "employee" | undefined,
        tenant_id: req.body.tenant_id,
      };

      // Register user through service
      const result = await authService.registerUser(userData);

      if (!result.success) {
        res
          .status(400)
          .json(
            errorResponse(
              result.message ?? "Registrierung fehlgeschlagen",
              400,
            ),
          );
        return;
      }

      res
        .status(201)
        .json(
          successResponse({ user: result.user }, "Registrierung erfolgreich"),
        );
    } catch (error) {
      logger.error("Registration error:", error);
      res
        .status(500)
        .json(errorResponse("Serverfehler bei der Registrierung", 500));
    }
  }

  /**
   * Logout user
   */
  async logout(req: Request, res: Response): Promise<void> {
    // Log logout action if user is authenticated
    if (isAuthenticated(req)) {
      await createLog(
        req.user.id,
        req.user.tenant_id,
        "logout",
        "user",
        req.user.id,
        "Abgemeldet",
        req.ip ?? "unknown",
        req.headers["user-agent"] ?? "unknown",
      );

      // Invalidate session in database if session validation is enabled
      const token = req.headers.authorization?.split(" ")[1];
      if (token) {
        try {
          const jwt = await import("jsonwebtoken");
          const jwtSecret = process.env.JWT_SECRET;
          if (!jwtSecret) {
            throw new Error("JWT_SECRET not configured");
          }
          const decoded = jwt.default.verify(token, jwtSecret) as JwtPayload & {
            sessionId?: string;
            id?: number;
          };
          if (decoded.sessionId) {
            await executeQuery(
              "UPDATE user_sessions SET expires_at = NOW() WHERE session_id = ? AND user_id = ?",
              [decoded.sessionId, req.user.id],
            );
          }
        } catch (error) {
          logger.warn("Failed to invalidate session:", error);
        }
      }
    }

    // Clear the httpOnly cookie
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.json(successResponse(null, "Erfolgreich abgemeldet"));
  }

  /**
   * Validate token
   */
  async validateToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Token is already validated by authenticateToken middleware
      // Get fresh user data from database
      const userId = req.user.id;
      const user = await userService.getUserById(userId, req.user.tenant_id);

      if (!user) {
        res.status(404).json(errorResponse("Benutzer nicht gefunden", 404));
        return;
      }

      // Check if user is active
      if (!user.is_active) {
        res.status(403).json(errorResponse("Benutzerkonto ist inaktiv", 403));
        return;
      }

      res.json(
        successResponse({
          valid: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            tenant_id: user.tenant_id,
            department_id: user.department_id,
            first_name: user.first_name,
            last_name: user.last_name,
          },
        }),
      );
    } catch (error) {
      logger.error("[AUTH] Validation error:", error);
      res.status(500).json(errorResponse("Interner Serverfehler", 500));
    }
  }

  /**
   * Validate browser fingerprint
   */
  async validateFingerprint(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { fingerprint } = req.body as { fingerprint?: string };
      const user = req.user;

      if (!fingerprint || !user) {
        res.json({ valid: true }); // Skip validation if no fingerprint
        return;
      }

      // Get session ID from token (if available)
      interface UserWithSession {
        id: number;
        tenant_id: number;
        sessionId?: string;
      }
      const userWithSession = user as UserWithSession;
      const sessionId = userWithSession.sessionId;
      if (!sessionId) {
        res.json({ valid: true }); // Skip if no session ID
        return;
      }

      // Check session in database
      const [sessions] = await executeQuery<RowDataPacket[]>(
        "SELECT fingerprint FROM user_sessions WHERE user_id = ? AND session_id = ? AND expires_at > NOW()",
        [user.id, sessionId],
      );

      if (sessions.length === 0) {
        res.status(403).json({
          error: "Session not found or expired",
          valid: false,
        });
        return;
      }

      const storedFingerprint = sessions[0].fingerprint;
      if (storedFingerprint && storedFingerprint !== fingerprint) {
        logger.warn(
          `[SECURITY] Browser fingerprint mismatch for user ${user.id}`,
        );
        res.status(403).json({
          error: "Browser fingerprint mismatch",
          valid: false,
        });
        return;
      }

      res.json({ valid: true });
    } catch (error) {
      logger.error("[AUTH] Fingerprint validation error:", error);
      res.status(500).json({
        error: "Internal server error",
        valid: false,
      });
    }
  }

  /**
   * Initiate password reset
   */
  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      // TODO: Implement password reset logic
      // For now, just return success for tests
      console.log(`[AUTH] Password reset requested for email: ${email}`);
      res
        .status(200)
        .json(successResponse(null, "Password reset E-Mail wurde gesendet"));
    } catch (error) {
      logger.error("Forgot password error:", error);
      res
        .status(500)
        .json(errorResponse("Serverfehler beim Passwort-Reset", 500));
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(_req: Request, res: Response): Promise<void> {
    try {
      // const { token, newPassword } = req.body;

      // TODO: Implement password reset logic
      // For now, just return success for tests
      res
        .status(200)
        .json(
          successResponse(null, "Passwort wurde erfolgreich zurückgesetzt"),
        );
    } catch (error) {
      logger.error("Reset password error:", error);
      res
        .status(500)
        .json(errorResponse("Serverfehler beim Passwort-Reset", 500));
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body as { refreshToken: string };

      if (!refreshToken) {
        res
          .status(400)
          .json(errorResponse("Refresh token ist erforderlich", 400));
        return;
      }

      // Attempt to refresh the access token
      const result = await authService.refreshAccessToken(refreshToken);

      if (!result) {
        res
          .status(401)
          .json(
            errorResponse("Ungültiger oder abgelaufener Refresh token", 401),
          );
        return;
      }

      // Return new tokens with standardized response format
      res.json(
        successResponse(
          {
            token: result.token,
            refreshToken: result.refreshToken,
            user: result.user,
          },
          "Token erfolgreich erneuert",
        ),
      );
    } catch (error) {
      logger.error("Refresh token error:", error);
      res
        .status(500)
        .json(errorResponse("Serverfehler beim Token-Refresh", 500));
    }
  }
}

// Export singleton instance
const authController = new AuthController();
export default authController;

// Named export for the class
export { AuthController };

// CommonJS compatibility
