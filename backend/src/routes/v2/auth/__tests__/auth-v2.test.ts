/**
 * API Tests for Authentication v2 Endpoints
 * Tests standardized responses, JWT tokens, and field mapping
 */

import "../../../../__tests__/test-env-setup"; // Must be first import
import request from "supertest";
import jwt from "jsonwebtoken";
import { Pool } from "mysql2/promise";
import app from "../../../../app";
import {
  createTestDatabase,
  cleanupTestData,
  closeTestDatabase,
  createTestTenant,
  createTestUser,
} from "../../../mocks/database";

describe("Authentication API v2 Endpoints", () => {
  let testDb: Pool;
  let tenantId: number;
  let testUser: any;

  const JWT_SECRET = process.env.JWT_SECRET ?? "test-jwt-secret";

  beforeAll(async () => {
    testDb = await createTestDatabase();
    await cleanupTestData();

    // Create test tenant
    tenantId = await createTestTenant(testDb, "testv2", "Test Company v2");

    // Create test user
    testUser = await createTestUser(testDb, {
      username: "testuser_v2",
      email: "test@v2api.com",
      password: "TestPass123!", // createTestUser handles hashing
      first_name: "Test",
      last_name: "User",
      role: "admin",
      tenant_id: tenantId,
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeTestDatabase();
  });

  describe("POST /api/v2/auth/login", () => {
    it("should return standardized success response with tokens", async () => {
      const response = await request(app).post("/api/v2/auth/login").send({
        email: testUser.email, // Use actual email with AUTOTEST prefix
        password: "TestPass123!",
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          user: {
            id: expect.any(Number),
            email: testUser.email, // Use actual email with AUTOTEST prefix
            firstName: "Test", // camelCase!
            lastName: "User", // camelCase!
            role: "admin",
          },
        },
        meta: {
          timestamp: expect.any(String),
          version: "2.0",
        },
      });

      // Verify JWT structure
      const decoded = jwt.verify(
        response.body.data.accessToken,
        JWT_SECRET,
      ) as any;
      expect(decoded).toMatchObject({
        id: testUser.id,
        email: testUser.email,
        type: "access",
      });
    });

    it("should return standardized error for invalid credentials", async () => {
      const response = await request(app).post("/api/v2/auth/login").send({
        email: testUser.email,
        password: "WrongPassword",
      });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        },
        meta: {
          timestamp: expect.any(String),
          requestId: expect.any(String),
        },
      });
    });

    it("should validate required fields", async () => {
      const response = await request(app).post("/api/v2/auth/login").send({
        email: testUser.email,
        // missing password
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Email and password are required",
        },
      });
    });
  });

  describe("GET /api/v2/auth/verify", () => {
    let validToken: string;

    beforeEach(() => {
      validToken = jwt.sign(
        {
          id: testUser.id,
          email: testUser.email,
          role: testUser.role,
          tenantId: tenantId,
          type: "access",
        },
        JWT_SECRET,
        { expiresIn: "15m" },
      );
    });

    it("should verify valid token", async () => {
      const response = await request(app)
        .get("/api/v2/auth/verify")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          valid: true,
          user: {
            id: testUser.id,
            email: testUser.email,
          },
        },
      });
    });

    it("should reject invalid token", async () => {
      const response = await request(app)
        .get("/api/v2/auth/verify")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: "Invalid or expired token",
        },
      });
    });

    it("should reject missing token", async () => {
      const response = await request(app).get("/api/v2/auth/verify");

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication token required",
        },
      });
    });
  });

  describe("POST /api/v2/auth/refresh", () => {
    let refreshToken: string;

    beforeEach(() => {
      refreshToken = jwt.sign(
        {
          id: testUser.id,
          email: testUser.email,
          type: "refresh",
        },
        JWT_SECRET,
        { expiresIn: "7d" },
      );
    });

    it("should refresh access token with valid refresh token", async () => {
      const response = await request(app).post("/api/v2/auth/refresh").send({
        refreshToken: refreshToken,
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          accessToken: expect.any(String),
          // Should NOT return new refresh token
        },
      });

      // Verify new access token
      const decoded = jwt.verify(
        response.body.data.accessToken,
        JWT_SECRET,
      ) as any;
      expect(decoded.type).toBe("access");
    });

    it("should reject access token as refresh token", async () => {
      const accessToken = jwt.sign(
        {
          id: testUser.id,
          type: "access",
        },
        JWT_SECRET,
        { expiresIn: "15m" },
      );

      const response = await request(app).post("/api/v2/auth/refresh").send({
        refreshToken: accessToken,
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/v2/auth/me", () => {
    let validToken: string;

    beforeEach(() => {
      validToken = jwt.sign(
        {
          id: testUser.id,
          email: testUser.email,
          role: testUser.role,
          tenantId: tenantId,
          type: "access",
        },
        JWT_SECRET,
        { expiresIn: "15m" },
      );
    });

    it("should return current user with camelCase fields", async () => {
      const response = await request(app)
        .get("/api/v2/auth/me")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: testUser.id,
          email: testUser.email,
          firstName: "Test", // camelCase!
          lastName: "User", // camelCase!
          role: "admin",
          tenantId: tenantId, // camelCase!
          isActive: true, // camelCase!
        },
      });

      // Should NOT have snake_case fields
      expect(response.body.data.first_name).toBeUndefined();
      expect(response.body.data.last_name).toBeUndefined();
      expect(response.body.data.tenant_id).toBeUndefined();
    });
  });

  describe("Deprecation Headers", () => {
    it("should include deprecation headers on v1 endpoints", async () => {
      const response = await request(app).post("/api/auth/login").send({
        username: "testuser",
        password: "password",
      });

      expect(response.headers["deprecation"]).toBe("true");
      expect(response.headers["sunset"]).toBe("2025-12-31");
      expect(response.headers["link"]).toContain("successor-version");
    });

    it("should NOT include deprecation headers on v2 endpoints", async () => {
      const response = await request(app).post("/api/v2/auth/login").send({
        email: "test@example.com",
        password: "password",
      });

      expect(response.headers["deprecation"]).toBeUndefined();
      expect(response.headers["sunset"]).toBeUndefined();
    });
  });
});
