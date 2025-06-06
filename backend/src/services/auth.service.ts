/**
 * Authentication Service
 * Handles authentication business logic
 */

import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import UserModel from "../models/user";
import { authenticateUser as authUser, generateToken } from "../auth";
import { logger } from "../utils/logger";
import {
  AuthResult,
  UserRegistrationData,
  TokenValidationResult,
} from "../types/auth.types";
import { DatabaseUser } from "../types/models";

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

      // Generate JWT token - pass the whole user object
      const token = generateToken(result.user);

      // Convert database user to app user format and remove sensitive data
      const userWithoutPassword = { ...result.user };
      delete (userWithoutPassword as any).password;

      return {
        success: true,
        token,
        user: this.mapDatabaseUserToAppUser(
          this.dbUserToDatabaseUser(userWithoutPassword),
        ),
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
      if (!userData.tenantId) {
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
        tenant_id: userData.tenantId,
      });

      // Get created user (without password)
      const user = await UserModel.findById(userId, userData.tenantId);
      if (!user) {
        throw new Error("Failed to retrieve created user");
      }

      delete (user as any).password;

      return {
        success: true,
        user: this.mapDatabaseUserToAppUser(this.dbUserToDatabaseUser(user)),
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "");
      return {
        valid: true,
        user: decoded as any,
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
  private mapDatabaseUserToAppUser(dbUser: DatabaseUser): any {
    return {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      firstName: dbUser.first_name,
      lastName: dbUser.last_name,
      role: dbUser.role,
      tenantId: dbUser.tenant_id,
      departmentId: dbUser.department_id,
      isActive: dbUser.is_active,
      isArchived: dbUser.is_archived,
      profilePicture: dbUser.profile_picture,
      phoneNumber: dbUser.phone_number,
      position: dbUser.position,
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
  private dbUserToDatabaseUser(dbUser: any): DatabaseUser {
    return {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      password_hash: dbUser.password || "",
      first_name: dbUser.first_name,
      last_name: dbUser.last_name,
      role: dbUser.role,
      tenant_id: dbUser.tenant_id,
      department_id: dbUser.department_id,
      is_active:
        dbUser.is_active === true ||
        (dbUser.is_active as any) === 1 ||
        (dbUser.is_active as any) === "1",
      is_archived: dbUser.is_archived || false,
      profile_picture: dbUser.profile_picture,
      phone_number: dbUser.phone || null,
      position: dbUser.position,
      hire_date: dbUser.hire_date,
      birth_date: dbUser.birthday || null,
      created_at: dbUser.created_at || new Date(),
      updated_at: dbUser.updated_at || new Date(),
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
