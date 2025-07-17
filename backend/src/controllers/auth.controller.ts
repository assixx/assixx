/**
 * Authentication Controller
 * Handles all authentication-related business logic
 */

import { Request, Response } from "express";
import authService from "../services/auth.service";
import userService from "../services/user.service";
import { logger } from "../utils/logger";
import { AuthenticatedRequest } from "../types/request.types";
import { createLog } from "../routes/logs.js";
import { executeQuery } from "../database";
import { RowDataPacket } from "mysql2/promise";

// Type guard to check if request has authenticated user
function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return "user" in req && req.user != null && "id" in req.user;
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
      res.json({
        authenticated: true,
        user: {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role,
        },
      });
    } catch (error) {
      logger.error("Error in auth check:", error);
      res.status(500).json({ message: "Server error" });
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
        res.status(404).json({ message: "User not found" });
        return;
      }

      res.json(user);
    } catch (error) {
      logger.error("Error in get user profile:", error);
      res.status(500).json({ message: "Server error" });
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
        res.status(400).json({
          message: "Username and password are required",
        });
        return;
      }

      // Authenticate user with fingerprint
      console.log("[DEBUG] Calling authService.authenticateUser");
      const result = await authService.authenticateUser(
        username,
        password,
        fingerprint,
      );
      console.log("[DEBUG] Auth result:", result ? "Success" : "Failed");

      if (!result.success) {
        res.status(401).json({
          message: result.message ?? "Invalid credentials",
        });
        return;
      }

      // Set token as httpOnly cookie for HTML pages
      if (!result.token) {
        res.status(500).json({ message: "Token generation failed" });
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
          req.ip || "unknown",
          req.headers["user-agent"] || "unknown",
        );
      }

      // Return user data and token (compatible with legacy frontend)
      res.json({
        message: "Login erfolgreich",
        token: result.token,
        role: result.user?.role,
        user: result.user,
      });
    } catch (error) {
      logger.error("Login error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error("[DEBUG] Login error details:", errorMessage, errorStack);
      res.status(500).json({
        message: "Server error during login",
        error:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
      });
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
        res.status(400).json({
          message: result.message ?? "Registration failed",
        });
        return;
      }

      res.status(201).json({
        message: "Registration successful",
        user: result.user,
      });
    } catch (error) {
      logger.error("Registration error:", error);
      res.status(500).json({ message: "Server error during registration" });
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
        req.ip || "unknown",
        req.headers["user-agent"] || "unknown",
      );
    }

    // Clear the httpOnly cookie
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.json({ message: "Logout successful" });
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
        res.status(404).json({
          error: "User not found",
          valid: false,
        });
        return;
      }

      // Check if user is active
      if (!user.is_active) {
        res.status(403).json({
          error: "User account is inactive",
          valid: false,
        });
        return;
      }

      res.json({
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
      });
    } catch (error) {
      logger.error("[AUTH] Validation error:", error);
      res.status(500).json({
        error: "Internal server error",
        valid: false,
      });
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
}

// Export singleton instance
const authController = new AuthController();
export default authController;

// Named export for the class
export { AuthController };

// CommonJS compatibility
