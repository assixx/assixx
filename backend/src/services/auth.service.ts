/**
 * Authentication Service
 * Handles authentication business logic
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { authenticateUser as authUser, generateToken } from "../auth";
import UserModel from "../models/user";
import {
  AuthResult,
  UserRegistrationData,
  TokenValidationResult,
} from "../types/auth.types";
import { DatabaseUser } from "../types/models";
import { execute, ResultSetHeader } from "../utils/db";
import { logger } from "../utils/logger";

class AuthService {
  /**
   * Authenticate user with username and password
   * @param {string} username - Username
   * @param {string} password - Plain text password
   * @returns {Promise<AuthResult>} Result with success status, token, and user data
   */
  async authenticateUser(
    username: string,
    password: string,
    fingerprint?: string,
  ): Promise<AuthResult> {
    try {
      // Use existing auth function
      const result = await authUser(username, password);

      if (!result.user) {
        // Provide specific error messages based on error type
        let message = "Invalid username or password";
        if (result.error === "USER_INACTIVE") {
          message =
            "Ihr Account wurde deaktiviert.\n\nBitte kontaktieren Sie Ihren IT-Administrator, um Ihren Account wieder zu aktivieren.";
        } else if (result.error === "USER_NOT_FOUND") {
          message = "Benutzer nicht gefunden";
        } else if (result.error === "INVALID_PASSWORD") {
          message = "Falsches Passwort";
        }

        return {
          success: false,
          user: null,
          message,
        };
      }

      // Generate cryptographically secure session ID
      const crypto = await import("crypto");
      const randomBytes = crypto.randomBytes(16).toString("hex");
      const sessionId = `sess_${Date.now()}_${randomBytes}`;

      // Generate JWT token with fingerprint and session ID
      const token = generateToken(result.user, fingerprint, sessionId);

      // Store session info if fingerprint provided
      if (fingerprint) {
        try {
          await execute<ResultSetHeader>(
            "INSERT INTO user_sessions (user_id, session_id, fingerprint, created_at, expires_at) VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 MINUTE))",
            [result.user.id, sessionId, fingerprint],
          );
        } catch (error) {
          logger.warn("Failed to store session info:", error);
          // Continue anyway - session will work without stored fingerprint
        }
      }

      // Convert database user to app user format and remove sensitive data
      const userWithoutPassword = { ...result.user };
      if ("password" in userWithoutPassword) {
        delete userWithoutPassword.password;
      }

      return {
        success: true,
        token,
        user: this.mapDatabaseUserToAppUser(
          this.dbUserToDatabaseUser(userWithoutPassword),
        ) as unknown as AuthResult["user"],
      };
    } catch (error) {
      logger.error("Authentication error:", error);
      throw error;
    }
  }

  /**
   * Register a new user
   * @param {UserRegistrationData} userData - User registration data
   * @returns {Promise<AuthResult>} Result with success status and user data
   */
  async registerUser(userData: UserRegistrationData): Promise<AuthResult> {
    try {
      const {
        username,
        password,
        email,
        vorname,
        nachname,
        role = "employee",
      } = userData;

      // Check if user already exists
      const existingUser = await UserModel.findByUsername(username);
      if (existingUser) {
        return {
          success: false,
          user: null,
          message: "Username already exists",
        };
      }

      // Check if email already exists
      const existingEmail = await UserModel.findByEmail(email);
      if (existingEmail) {
        return {
          success: false,
          user: null,
          message: "Email already exists",
        };
      }

      // Check if tenant ID is provided
      if (!userData.tenant_id) {
        return {
          success: false,
          user: null,
          message: "Tenant ID is required",
        };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const userId = await UserModel.create({
        username,
        password: hashedPassword,
        email,
        first_name: vorname,
        last_name: nachname,
        role,
        tenant_id: userData.tenant_id,
      });

      // Get created user (without password)
      const user = await UserModel.findById(userId, userData.tenant_id);
      if (!user) {
        throw new Error("Failed to retrieve created user");
      }

      const userWithoutPassword =
        user && "password" in user
          ? (() => {
              const { password: _password, ...rest } = user;
              return rest;
            })()
          : user;

      // Ensure tenant_id is present
      const userWithTenantId = {
        ...userWithoutPassword,
        tenant_id: userWithoutPassword.tenant_id ?? userData.tenant_id,
      };

      return {
        success: true,
        user: this.mapDatabaseUserToAppUser(
          this.dbUserToDatabaseUser(userWithTenantId),
        ) as unknown as AuthResult["user"],
      };
    } catch (error) {
      logger.error("Registration error:", error);
      throw error;
    }
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Promise<TokenValidationResult>} Decoded token data
   */
  async verifyToken(token: string): Promise<TokenValidationResult> {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error("JWT_SECRET not configured");
      }
      const decoded = jwt.verify(token, secret);
      return {
        valid: true,
        user: decoded as unknown as DatabaseUser,
      };
    } catch (error) {
      logger.error("Token verification error:", error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Invalid token",
      };
    }
  }

  /**
   * Map database user format to application user format
   * @private
   */
  private mapDatabaseUserToAppUser(dbUser: DatabaseUser): Omit<
    DatabaseUser,
    "password_hash"
  > & {
    firstName: string;
    lastName: string;
    departmentId: number | null;
    isActive: boolean;
    isArchived: boolean;
    profilePicture: string | null;
    phoneNumber: string | null;
    hireDate: Date | null;
    birthDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      // DatabaseUser properties (snake_case)
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      first_name: dbUser.first_name,
      last_name: dbUser.last_name,
      role: dbUser.role as "admin" | "root" | "employee",
      tenant_id: dbUser.tenant_id,
      department_id: dbUser.department_id,
      is_active: dbUser.is_active,
      is_archived: dbUser.is_archived,
      profile_picture: dbUser.profile_picture,
      phone_number: dbUser.phone_number,
      landline: dbUser.landline ?? null,
      employee_number: dbUser.employee_number ?? "",
      position: dbUser.position,
      hire_date: dbUser.hire_date,
      birth_date: dbUser.birth_date,
      created_at: dbUser.created_at,
      updated_at: dbUser.updated_at,
      // Additional camelCase properties
      firstName: dbUser.first_name,
      lastName: dbUser.last_name,
      departmentId: dbUser.department_id,
      isActive: dbUser.is_active,
      isArchived: dbUser.is_archived,
      profilePicture: dbUser.profile_picture,
      phoneNumber: dbUser.phone_number,
      hireDate: dbUser.hire_date,
      birthDate: dbUser.birth_date,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
    };
  }

  /**
   * Convert DbUser to DatabaseUser format
   * @private
   */
  private dbUserToDatabaseUser(dbUser: {
    id: number;
    username: string;
    email: string;
    password?: string;
    first_name: string;
    last_name: string;
    role: string;
    tenant_id: number | null;
    department_id?: number | null;
    is_active?: boolean | number | string;
    is_archived?: boolean;
    profile_picture?: string | null;
    phone?: string | null;
    landline?: string | null;
    employee_number?: string;
    position?: string | null;
    hire_date?: Date | null;
    birthday?: Date | null;
    created_at?: Date;
    updated_at?: Date;
  }): DatabaseUser {
    return {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      password_hash: dbUser.password ?? "",
      first_name: dbUser.first_name,
      last_name: dbUser.last_name,
      role: dbUser.role as "admin" | "employee" | "root",
      tenant_id: dbUser.tenant_id,
      department_id: dbUser.department_id ?? null,
      is_active:
        dbUser.is_active === true ||
        dbUser.is_active === 1 ||
        dbUser.is_active === "1",
      is_archived: dbUser.is_archived ?? false,
      profile_picture: dbUser.profile_picture ?? null,
      phone_number: dbUser.phone ?? null,
      landline: dbUser.landline ?? null,
      employee_number: dbUser.employee_number ?? "",
      position: dbUser.position ?? null,
      hire_date: dbUser.hire_date ?? null,
      birth_date: dbUser.birthday ?? null,
      created_at: dbUser.created_at ?? new Date(),
      updated_at: dbUser.updated_at ?? new Date(),
    };
  }
}

// Create singleton instance
const authServiceInstance = new AuthService();

// Export singleton instance for backwards compatibility
export default authServiceInstance;

// Also export class for testing
export { AuthService };

// CommonJS compatibility
