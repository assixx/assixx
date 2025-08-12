/**
 * Integration Tests for Authentication Middleware
 * Tests JWT token validation, multi-tenant isolation, and role-based access
 * Using real database instead of mocks
 */

// Set NODE_ENV to production to avoid test-specific SQL in auth middleware
process.env.NODE_ENV = "production";

import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { authenticateToken } from "../auth-refactored";
import type { PublicRequest } from "../../types/request.types";
import { pool } from "../../database";
import bcrypt from "bcryptjs";

describe("Authentication Middleware - Integration Test", () => {
  let mockRequest: Partial<PublicRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let testTenantId: number;
  let testUserId: number;
  let validToken: string;

  beforeAll(async () => {
    // Create test tenant
    const [tenantResult] = await pool.execute(
      "INSERT INTO tenants (company_name, subdomain, email, status) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)",
      ["Auth Test Tenant", "auth-test", "auth@test.com", "active"],
    );
    testTenantId = (tenantResult as any).insertId;

    // Create test user
    const hashedPassword = await bcrypt.hash("testpassword", 10);
    const [userResult] = await pool.execute(
      `INSERT INTO users (username, email, password, role, tenant_id, first_name, last_name, status, employee_number) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "authtest@test.com",
        "authtest@test.com",
        hashedPassword,
        "admin",
        testTenantId,
        "Auth",
        "Test",
        "active",
        "AUTH01",
      ],
    );
    testUserId = (userResult as any).insertId;

    // Create valid JWT token
    validToken = jwt.sign(
      {
        id: testUserId,
        username: "authtest@test.com",
        role: "admin",
        tenant_id: testTenantId,
      },
      process.env.JWT_SECRET ?? "schneeseekleerehfeedrehzehwehtee",
      { expiresIn: "1h" },
    );
  });

  afterAll(async () => {
    // Cleanup
    await pool.execute("DELETE FROM users WHERE tenant_id = ?", [testTenantId]);
    await pool.execute("DELETE FROM tenants WHERE id = ?", [testTenantId]);
  });

  beforeEach(() => {
    mockRequest = {
      headers: {},
      cookies: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe("Token Validation", () => {
    it("should authenticate valid Bearer token", async () => {
      mockRequest.headers = {
        authorization: `Bearer ${validToken}`,
      };

      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect((mockRequest as any).user).toBeDefined();
      expect((mockRequest as any).user.id).toBe(testUserId);
      expect((mockRequest as any).user.tenant_id).toBe(testTenantId);
    });

    it("should authenticate valid cookie token", async () => {
      mockRequest.cookies = {
        token: validToken,
      };

      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should reject missing token", async () => {
      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Authentication token required",
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject invalid token", async () => {
      mockRequest.headers = {
        authorization: "Bearer invalid.token.here",
      };

      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Invalid or expired token",
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject expired token", async () => {
      const expiredToken = jwt.sign(
        {
          id: testUserId,
          username: "authtest@test.com",
          role: "admin",
          tenant_id: testTenantId,
        },
        process.env.JWT_SECRET ?? "schneeseekleerehfeedrehzehwehtee",
        { expiresIn: "0s" },
      );

      mockRequest.headers = {
        authorization: `Bearer ${expiredToken}`,
      };

      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Invalid or expired token",
        }),
      );
    });
  });

  describe("User Status Validation", () => {
    it("should reject inactive user", async () => {
      // Make user inactive
      await pool.execute("UPDATE users SET is_active = 0 WHERE id = ?", [
        testUserId,
      ]);

      mockRequest.headers = {
        authorization: `Bearer ${validToken}`,
      };

      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "User not found or inactive",
        }),
      );

      // Restore user to active
      await pool.execute("UPDATE users SET is_active = 1 WHERE id = ?", [
        testUserId,
      ]);
    });

    it("should reject non-existent user", async () => {
      const fakeToken = jwt.sign(
        {
          id: 99999,
          username: "fake@test.com",
          role: "admin",
          tenant_id: testTenantId,
        },
        process.env.JWT_SECRET ?? "schneeseekleerehfeedrehzehwehtee",
        { expiresIn: "1h" },
      );

      mockRequest.headers = {
        authorization: `Bearer ${fakeToken}`,
      };

      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "User not found or inactive",
        }),
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed Bearer token", async () => {
      mockRequest.headers = {
        authorization: "Bearer",
      };

      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Authentication token required",
        }),
      );
    });

    it("should handle invalid authorization header format", async () => {
      mockRequest.headers = {
        authorization: "InvalidFormat token123",
      };

      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Authentication token required",
        }),
      );
    });
  });
});
