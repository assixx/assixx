/**
 * Auth Controller v2
 * Handles authentication logic with new API standards
 */

import bcryptjs from "bcryptjs";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";

import User from "../../../models/user";
import { AuthenticatedRequest } from "../../../types/request.types";
import { successResponse, errorResponse } from "../../../utils/apiResponse";
import { dbToApi } from "../../../utils/fieldMapping";
import { logger } from "../../../utils/logger";
// Get secrets from environment variables
const JWT_SECRET = process.env.JWT_SECRET ?? "default-jwt-secret";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ??
  process.env.JWT_SECRET ??
  "default-jwt-secret";

// Token expiration times
const ACCESS_TOKEN_EXPIRES = "15m";
const REFRESH_TOKEN_EXPIRES = "7d";

/**
 * Generate JWT tokens
 */
function generateTokens(
  userId: number,
  tenantId: number,
  role: string,
  email: string,
) {
  const payload = {
    id: userId,
    email,
    role,
    tenantId,
    type: "access" as const,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });

  const refreshPayload = {
    id: userId,
    email,
    role,
    tenantId,
    type: "refresh" as const,
  };

  const refreshToken = jwt.sign(refreshPayload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
  });

  return { accessToken, refreshToken };
}

/**
 * User login
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      res
        .status(400)
        .json(
          errorResponse("VALIDATION_ERROR", "Email and password are required"),
        );
      return;
    }

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      res
        .status(401)
        .json(
          errorResponse("INVALID_CREDENTIALS", "Invalid email or password"),
        );
      return;
    }

    // Check if user is active
    if (user.status !== "active") {
      res
        .status(403)
        .json(errorResponse("ACCOUNT_INACTIVE", "Your account is not active"));
      return;
    }

    // Verify password
    const isValidPassword = await bcryptjs.compare(password, user.password);
    if (!isValidPassword) {
      res
        .status(401)
        .json(
          errorResponse("INVALID_CREDENTIALS", "Invalid email or password"),
        );
      return;
    }

    // Ensure tenant_id exists
    if (!user.tenant_id) {
      res
        .status(500)
        .json(errorResponse("TENANT_ERROR", "User has no tenant association"));
      return;
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(
      user.id,
      user.tenant_id,
      user.role,
      user.email,
    );

    // TODO: Update last login - need to add updateLastLogin method to User model

    // Remove sensitive data - create new object without password
    const {
      password: _password,
      reset_token: _resetToken,
      reset_token_expires: _resetTokenExpires,
      ...safeUser
    } = user;

    // Convert to camelCase for API response
    const userApi = dbToApi(safeUser);

    res.json(
      successResponse({
        accessToken,
        refreshToken,
        user: userApi,
      }),
    );
  } catch (error) {
    logger.error("Login error:", error);
    res
      .status(500)
      .json(errorResponse("SERVER_ERROR", "An error occurred during login"));
  }
}

/**
 * Register new user (admin only)
 */
export async function register(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      role = "employee",
    } = req.body as {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role?: string;
    };
    const user = req.user;
    if (!user) {
      res
        .status(401)
        .json(errorResponse("UNAUTHORIZED", "Authentication required"));
      return;
    }
    const { tenant_id: tenantId, role: currentUserRole } = user;

    // Only admins can create users
    if (currentUserRole !== "admin" && currentUserRole !== "root") {
      res
        .status(403)
        .json(
          errorResponse("FORBIDDEN", "Only administrators can create users"),
        );
      return;
    }

    // Check if email already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      res
        .status(409)
        .json(
          errorResponse(
            "EMAIL_EXISTS",
            "A user with this email already exists",
          ),
        );
      return;
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 10);

    // Create user - username is email without domain for backwards compatibility
    const username = email.split("@")[0];
    const userId = await User.create({
      tenant_id: tenantId,
      username,
      email,
      password: hashedPassword,
      first_name: firstName,
      last_name: lastName,
      role,
      status: "active",
    });

    // Get created user
    const newUser = await User.findById(userId, tenantId);
    if (!newUser) {
      throw new Error("Failed to retrieve created user");
    }

    // Remove sensitive data - create new object without password
    const { password: _password, ...safeUser } = newUser;

    // Convert to camelCase
    const userApi = dbToApi(safeUser);

    res.status(201).json(successResponse(userApi));
  } catch (error) {
    logger.error("Register error:", error);
    res
      .status(500)
      .json(
        errorResponse("SERVER_ERROR", "An error occurred during registration"),
      );
  }
}

/**
 * User logout
 */
export async function logout(_req: Request, res: Response): Promise<void> {
  try {
    // In a real implementation, you might want to:
    // 1. Blacklist the token
    // 2. Clear refresh token from database
    // 3. Clear any server-side sessions

    res.json(
      successResponse({
        message: "Logged out successfully",
      }),
    );
  } catch (error) {
    logger.error("Logout error:", error);
    res
      .status(500)
      .json(errorResponse("SERVER_ERROR", "An error occurred during logout"));
  }
}

/**
 * Refresh access token
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res
        .status(400)
        .json(errorResponse("MISSING_TOKEN", "Refresh token is required"));
      return;
    }

    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      JWT_REFRESH_SECRET,
    ) as jwt.JwtPayload;

    // Ensure it's a refresh token, not an access token
    if (decoded.type !== "refresh") {
      res
        .status(401)
        .json(errorResponse("INVALID_TOKEN", "Invalid refresh token"));
      return;
    }

    // Generate new access token
    const accessToken = jwt.sign(
      {
        id: decoded.id,
        email: decoded.email,
        tenantId: decoded.tenantId,
        role: decoded.role,
        type: "access",
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES },
    );

    res.json(
      successResponse({
        accessToken,
      }),
    );
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res
        .status(401)
        .json(
          errorResponse("INVALID_TOKEN", "Invalid or expired refresh token"),
        );
      return;
    }

    logger.error("Refresh token error:", error);
    res
      .status(500)
      .json(
        errorResponse("SERVER_ERROR", "An error occurred during token refresh"),
      );
  }
}

/**
 * Verify current token
 */
export async function verify(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res
        .status(401)
        .json(errorResponse("UNAUTHORIZED", "Authentication required"));
      return;
    }
    res.json(
      successResponse({
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          tenantId: user.tenant_id,
          role: user.role,
        },
      }),
    );
  } catch (error) {
    logger.error("Verify error:", error);
    res
      .status(500)
      .json(
        errorResponse("SERVER_ERROR", "An error occurred during verification"),
      );
  }
}

/**
 * Get current user information
 */
export async function getCurrentUser(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const authUser = req.user;
    if (!authUser) {
      res
        .status(401)
        .json(errorResponse("UNAUTHORIZED", "Authentication required"));
      return;
    }
    const { userId, tenant_id: tenantId } = authUser;

    const user = await User.findById(userId, tenantId);
    if (!user) {
      res.status(404).json(errorResponse("USER_NOT_FOUND", "User not found"));
      return;
    }

    // Remove sensitive data - create new object without password
    const {
      password: _password,
      reset_token: _resetToken,
      reset_token_expires: _resetTokenExpires,
      ...safeUser
    } = user;

    // Convert to camelCase
    const userApi = dbToApi(safeUser);

    res.json(successResponse(userApi));
  } catch (error) {
    logger.error("Get current user error:", error);
    res
      .status(500)
      .json(
        errorResponse(
          "SERVER_ERROR",
          "An error occurred while fetching user data",
        ),
      );
  }
}

export const authController = {
  login,
  register,
  logout,
  refresh,
  verify,
  getCurrentUser,
};
