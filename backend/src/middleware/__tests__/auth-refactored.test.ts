/**
 * Unit Tests for Authentication Middleware
 * Tests JWT token validation, multi-tenant isolation, and role-based access
 */

// Mock MUST be set before imports
jest.mock("../../database");

import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { authenticateToken } from "../auth-refactored";
import type { PublicRequest } from "../../types/request.types";
import { executeQuery } from "../../database";
import { asTestRows } from "../../__tests__/mocks/db-types";

// Get mocked function
const mockExecuteQuery = executeQuery as jest.MockedFunction<
  typeof executeQuery
>;

// Set test JWT secret
process.env.JWT_SECRET = "test-secret-key";

describe("Authentication Middleware", () => {
  let mockRequest: Partial<PublicRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

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

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Token Extraction", () => {
    it("should extract token from Authorization header", async () => {
      const token = jwt.sign(
        { id: 1, tenant_id: 1, role: "admin", sessionId: "test-session" },
        process.env.JWT_SECRET!,
      );
      mockRequest.headers = { authorization: `Bearer ${token}` };

      // Mock user lookup
      mockExecuteQuery.mockResolvedValueOnce([
        asTestRows([
          {
            id: 1,
            username: "admin",
            email: "admin@test.com",
            role: "admin",
            tenant_id: 1,
            status: "active",
            firstName: "Admin",
            lastName: "User",
            tenantName: "Test Company",
          },
        ]),
      ]);

      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should extract token from cookie as fallback", async () => {
      const token = jwt.sign(
        { id: 1, tenant_id: 1, role: "admin", sessionId: "test-session" },
        process.env.JWT_SECRET!,
      );
      mockRequest.cookies = { token };

      mockExecuteQuery.mockResolvedValueOnce([
        asTestRows([
          {
            id: 1,
            username: "admin",
            email: "admin@test.com",
            role: "admin",
            tenant_id: 1,
            status: "active",
          },
        ]),
      ]);

      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should reject request without token", async () => {
      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: "Authentication token required",
        code: "NO_TOKEN",
        statusCode: 401,
        timestamp: expect.any(String),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("Token Validation", () => {
    it("should reject invalid token", async () => {
      mockRequest.headers = { authorization: "Bearer invalid-token" };

      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: "Invalid or expired token",
        code: "INVALID_TOKEN",
        statusCode: 403,
        timestamp: expect.any(String),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject expired token", async () => {
      const expiredToken = jwt.sign(
        {
          id: 1,
          tenant_id: 1,
          role: "admin",
          exp: Math.floor(Date.now() / 1000) - 3600,
        },
        process.env.JWT_SECRET!,
      );
      mockRequest.headers = { authorization: `Bearer ${expiredToken}` };

      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: "Invalid or expired token",
        code: "INVALID_TOKEN",
        statusCode: 403,
        timestamp: expect.any(String),
      });
    });

    it("should reject token with wrong secret", async () => {
      const wrongToken = jwt.sign(
        { id: 1, tenant_id: 1, role: "admin" },
        "wrong-secret",
      );
      mockRequest.headers = { authorization: `Bearer ${wrongToken}` };

      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("User Validation", () => {
    it("should reject token for non-existent user", async () => {
      const token = jwt.sign(
        { id: 999, tenant_id: 1, role: "admin", sessionId: "test-session" },
        process.env.JWT_SECRET!,
      );
      mockRequest.headers = { authorization: `Bearer ${token}` };

      // Mock empty user result
      mockExecuteQuery.mockResolvedValueOnce([asTestRows([])]);

      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: "User not found or inactive",
        code: "USER_NOT_FOUND",
        statusCode: 403,
        timestamp: expect.any(String),
      });
    });

    it("should attach user to request on successful authentication", async () => {
      const token = jwt.sign(
        { id: 1, tenant_id: 1, role: "admin", sessionId: "test-session" },
        process.env.JWT_SECRET!,
      );
      mockRequest.headers = { authorization: `Bearer ${token}` };

      const mockUser = {
        id: 1,
        username: "admin",
        email: "admin@test.com",
        role: "admin",
        tenant_id: 1,
        status: "active",
        firstName: "Admin",
        lastName: "User",
        tenantName: "Test Company",
        department_id: null,
        position: null,
      };

      mockExecuteQuery.mockResolvedValueOnce([asTestRows([mockUser])]);

      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as any).user).toBeDefined();
      expect((mockRequest as any).user.id).toBe(1);
      expect((mockRequest as any).user.tenant_id).toBe(1);
      expect((mockRequest as any).user.role).toBe("admin");
    });
  });

  describe("Multi-Tenant Isolation", () => {
    it("should ensure user can only access their tenant data", async () => {
      const token = jwt.sign(
        { id: 1, tenant_id: 1, role: "employee" },
        process.env.JWT_SECRET!,
      );
      mockRequest.headers = { authorization: `Bearer ${token}` };

      mockExecuteQuery.mockResolvedValueOnce([
        asTestRows([
          {
            id: 1,
            username: "employee",
            email: "employee@test.com",
            role: "employee",
            tenant_id: 1,
            status: "active",
          },
        ]),
      ]);

      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
      const user = (mockRequest as any).user;
      expect(user.tenant_id).toBe(1);
      // User should only be able to access tenant_id 1 data
    });

    it("should handle different tenants correctly", async () => {
      // User from tenant 1
      const token1 = jwt.sign(
        { id: 1, tenant_id: 1, role: "admin" },
        process.env.JWT_SECRET!,
      );
      mockRequest.headers = { authorization: `Bearer ${token1}` };

      mockExecuteQuery.mockResolvedValueOnce([
        asTestRows([
          {
            id: 1,
            username: "admin1",
            email: "admin1@test.com",
            role: "admin",
            tenant_id: 1,
            status: "active",
          },
        ]),
      ]);

      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      const user1 = (mockRequest as any).user;
      expect(user1.tenant_id).toBe(1);

      // Reset for second test
      jest.clearAllMocks();

      // User from tenant 2
      const token2 = jwt.sign(
        { id: 2, tenant_id: 2, role: "admin", sessionId: "test-session-2" },
        process.env.JWT_SECRET!,
      );
      mockRequest.headers = { authorization: `Bearer ${token2}` };

      mockExecuteQuery.mockResolvedValueOnce([
        asTestRows([
          {
            id: 2,
            username: "admin2",
            email: "admin2@test.com",
            role: "admin",
            tenant_id: 2,
            status: "active",
          },
        ]),
      ]);

      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      const user2 = (mockRequest as any).user;
      expect(user2.tenant_id).toBe(2);
      expect(user2.tenant_id).not.toBe(user1.tenant_id);
    });
  });

  describe("Session Validation", () => {
    beforeEach(() => {
      process.env.VALIDATE_SESSIONS = "true";
    });

    afterEach(() => {
      delete process.env.VALIDATE_SESSIONS;
    });

    it("should validate session when enabled", async () => {
      const token = jwt.sign(
        { id: 1, tenant_id: 1, role: "admin", sessionId: "session123" },
        process.env.JWT_SECRET!,
      );
      mockRequest.headers = { authorization: `Bearer ${token}` };

      // Mock session validation query
      mockExecuteQuery
        .mockResolvedValueOnce([asTestRows([{ id: 1 }])]) // Session exists
        .mockResolvedValueOnce([
          asTestRows([
            {
              id: 1,
              username: "admin",
              email: "admin@test.com",
              role: "admin",
              tenant_id: 1,
              status: "active",
            },
          ]),
        ]); // User exists

      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id FROM user_sessions"),
        [1, "session123"],
      );
    });

    it("should reject invalid session", async () => {
      const token = jwt.sign(
        { id: 1, tenant_id: 1, role: "admin", sessionId: "invalid-session" },
        process.env.JWT_SECRET!,
      );
      mockRequest.headers = { authorization: `Bearer ${token}` };

      // Mock no session found
      mockExecuteQuery.mockResolvedValueOnce([asTestRows([])]);

      await authenticateToken(
        mockRequest as PublicRequest,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: "Session expired or not found",
        code: "SESSION_EXPIRED",
        statusCode: 403,
        timestamp: expect.any(String),
      });
    });
  });
});
