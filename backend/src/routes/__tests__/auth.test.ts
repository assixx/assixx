/**
 * API Tests for Authentication Endpoints
 * Tests login, logout, token refresh, and multi-tenant authentication
 */

import "../../__tests__/test-env-setup"; // Must be first import
import request from "supertest";
import jwt from "jsonwebtoken";
import { Pool } from "mysql2/promise";
import bcrypt from "bcryptjs";
import app from "../../app";
import {
  createTestDatabase,
  cleanupTestData,
  createTestTenant,
  createTestUser,
} from "../mocks/database";
import { asTestRows } from "../../__tests__/mocks/db-types";

describe("Authentication API Endpoints", () => {
  let testDb: Pool;
  let tenant1Id: number;
  let tenant2Id: number;
  let testUser1: any;
  let testUser2: any;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = "test-secret-key-for-auth-tests";
    process.env.SESSION_SECRET = "test-session-secret";
    
    // Test database connection
    try {
      const [rows] = await testDb.execute("SELECT 1");
      console.log("Database connection successful");
    } catch (error) {
      console.error("Database connection failed:", error);
    }

    // Create test tenants
    tenant1Id = await createTestTenant(
      testDb,
      "authtest1",
      "Auth Test Company 1",
    );
    tenant2Id = await createTestTenant(
      testDb,
      "authtest2",
      "Auth Test Company 2",
    );

    // Create test users
    testUser1 = await createTestUser(testDb, {
      username: "testuser1",
      email: "testuser1@authtest1.de",
      password: "TestPass123!",
      role: "admin",
      tenant_id: tenant1Id,
      first_name: "Test",
      last_name: "User1",
    });

    testUser2 = await createTestUser(testDb, {
      username: "testuser2",
      email: "testuser2@authtest2.de",
      password: "TestPass456!",
      role: "employee",
      tenant_id: tenant2Id,
      first_name: "Test",
      last_name: "User2",
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Clear sessions before each test
    await testDb.execute("DELETE FROM user_sessions");
  });

  describe("POST /api/auth/login", () => {
    it("should successfully login with valid credentials", async () => {
      console.log("Attempting login with username:", testUser1.username);
      const response = await request(app).post("/api/auth/login").send({
        username: testUser1.username,
        password: "TestPass123!",
        fingerprint: "test-fingerprint-123",
      });

      if (response.status !== 200) {
        console.error("Login failed with:", response.status, response.body);
        console.error("Test user data:", testUser1);
      }
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: "Login erfolgreich",
        data: {
          user: {
            id: testUser1.id,
            username: testUser1.username,
            email: testUser1.email,
            role: "admin",
            tenant_id: tenant1Id,
            first_name: "Test",
            last_name: "User1",
          },
          role: "admin",
        },
      });

      // Token should be set in response
      expect(response.body.data.token).toBeDefined();

      // Cookie should be set
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie) => cookie.startsWith("token="))).toBe(true);
    });

    it("should verify JWT token contains correct claims", async () => {
      const response = await request(app).post("/api/auth/login").send({
        username: testUser1.username,
        password: "TestPass123!",
      });

      const token = response.body.data.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

      expect(decoded).toMatchObject({
        id: testUser1.id,
        tenant_id: tenant1Id,
        role: "admin",
        username: testUser1.username,
      });
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    });

    it("should create session record in database", async () => {
      const response = await request(app).post("/api/auth/login").send({
        username: testUser1.username,
        password: "TestPass123!",
        fingerprint: "unique-fingerprint",
      });

      expect(response.status).toBe(200);

      // Check session was created
      const [rows] = await testDb.execute(
        "SELECT * FROM user_sessions WHERE user_id = ?",
        [testUser1.id],
      );
      const sessions = asTestRows<any>(rows);
      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toMatchObject({
        user_id: testUser1.id,
        fingerprint: "unique-fingerprint",
        is_active: 1,
      });
    });

    it("should reject invalid username", async () => {
      const response = await request(app).post("/api/auth/login").send({
        username: "nonexistent",
        password: "TestPass123!",
      });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: "Ungültige Anmeldedaten",
      });
    });

    it("should reject invalid password", async () => {
      const response = await request(app).post("/api/auth/login").send({
        username: testUser1.username,
        password: "WrongPassword123!",
      });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: "Ungültige Anmeldedaten",
      });
    });

    it("should reject inactive user", async () => {
      // Deactivate user
      await testDb.execute(
        "UPDATE users SET status = 'inactive' WHERE id = ?",
        [testUser1.id],
      );

      const response = await request(app).post("/api/auth/login").send({
        username: testUser1.username,
        password: "TestPass123!",
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("deaktiviert");

      // Reactivate for other tests
      await testDb.execute("UPDATE users SET status = 'active' WHERE id = ?", [
        testUser1.id,
      ]);
    });

    it("should handle login attempts with missing fields", async () => {
      const response1 = await request(app)
        .post("/api/auth/login")
        .send({ username: testUser1.username });

      expect(response1.status).toBe(400);
      expect(response1.body.errors).toBeDefined();

      const response2 = await request(app)
        .post("/api/auth/login")
        .send({ password: "TestPass123!" });

      expect(response2.status).toBe(400);
    });

    it("should rate limit login attempts", async () => {
      const attempts = Array(6)
        .fill(null)
        .map(() =>
          request(app).post("/api/auth/login").send({
            username: testUser1.username,
            password: "WrongPass",
          }),
        );

      const responses = await Promise.all(attempts);
      const rateLimited = responses.filter((r) => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it("should track failed login attempts", async () => {
      // Make failed attempts
      for (let i = 0; i < 3; i++) {
        await request(app).post("/api/auth/login").send({
          username: testUser1.username,
          password: "WrongPass",
        });
      }

      // Check failed attempts were logged
      const [rows] = await testDb.execute(
        "SELECT COUNT(*) as count FROM login_attempts WHERE username = ? AND success = 0",
        [testUser1.username],
      );
      const attempts = asTestRows<any>(rows);
      expect(attempts[0].count).toBeGreaterThanOrEqual(3);
    });

    it("should support email login as alternative to username", async () => {
      const response = await request(app).post("/api/auth/login").send({
        username: testUser1.email,
        password: "TestPass123!",
      });

      expect(response.status).toBe(200);
      expect(response.body.data.user.email).toBe(testUser1.email);
    });
  });

  describe("POST /api/auth/logout", () => {
    let authToken: string;

    beforeEach(async () => {
      // Login first to get token
      const loginResponse = await request(app).post("/api/auth/login").send({
        username: testUser1.username,
        password: "TestPass123!",
      });
      authToken = loginResponse.body.data.token;
    });

    it("should successfully logout authenticated user", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: "Erfolgreich abgemeldet",
      });

      // Cookie should be cleared
      const cookies = response.headers["set-cookie"];
      expect(cookies.some((cookie) => cookie.includes("token=;"))).toBe(true);
    });

    it("should invalidate session in database", async () => {
      // Create session first
      const decoded = jwt.verify(authToken, process.env.JWT_SECRET!) as any;
      await testDb.execute(
        "INSERT INTO user_sessions (user_id, session_id, fingerprint) VALUES (?, ?, ?)",
        [decoded.id, decoded.sessionId || "test-session", "test-fingerprint"],
      );

      await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${authToken}`);

      // Check session was invalidated
      const [rows] = await testDb.execute(
        "SELECT * FROM user_sessions WHERE user_id = ? AND is_active = 1",
        [decoded.id],
      );
      const sessions = asTestRows<any>(rows);
      expect(sessions).toHaveLength(0);
    });

    it("should handle logout without authentication", async () => {
      const response = await request(app).post("/api/auth/logout");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/auth/me", () => {
    let authToken1: string;
    let authToken2: string;

    beforeEach(async () => {
      // Login both users
      const login1 = await request(app).post("/api/auth/login").send({
        username: testUser1.username,
        password: "TestPass123!",
      });
      authToken1 = login1.body.data.token;

      const login2 = await request(app).post("/api/auth/login").send({
        username: testUser2.username,
        password: "TestPass456!",
      });
      authToken2 = login2.body.data.token;
    });

    it("should return current user info", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${authToken1}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: testUser1.id,
          username: testUser1.username,
          email: testUser1.email,
          role: "admin",
          tenant_id: tenant1Id,
          tenantName: "Auth Test Company 1",
        },
      });
    });

    it("should include tenant information", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${authToken1}`);

      expect(response.body.data.tenantName).toBe("Auth Test Company 1");
      expect(response.body.data.tenant_id).toBe(tenant1Id);
    });

    it("should return 401 without authentication", async () => {
      const response = await request(app).get("/api/auth/me");

      expect(response.status).toBe(401);
    });

    it("should return 403 with invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(403);
    });

    it("should ensure tenant isolation", async () => {
      const response1 = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${authToken1}`);

      const response2 = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${authToken2}`);

      expect(response1.body.data.tenant_id).toBe(tenant1Id);
      expect(response2.body.data.tenant_id).toBe(tenant2Id);
      expect(response1.body.data.tenant_id).not.toBe(
        response2.body.data.tenant_id,
      );
    });
  });

  describe("POST /api/auth/refresh", () => {
    let authToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app).post("/api/auth/login").send({
        username: testUser1.username,
        password: "TestPass123!",
      });
      authToken = loginResponse.body.data.token;
      refreshToken = loginResponse.body.data.refreshToken;
    });

    it("should refresh JWT token", async () => {
      // Wait a bit to ensure new token has different timestamp
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          token: expect.any(String),
          refreshToken: expect.any(String),
        },
      });

      // New token should be different
      expect(response.body.data.token).not.toBe(authToken);
    });

    it("should maintain user claims in new token", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken });

      const newToken = response.body.data.token;
      const decoded = jwt.verify(newToken, process.env.JWT_SECRET!) as any;

      expect(decoded).toMatchObject({
        id: testUser1.id,
        tenant_id: tenant1Id,
        role: "admin",
      });
    });

    it("should reject invalid refresh token", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "invalid-refresh-token" });

      expect(response.status).toBe(401);
    });

    it("should reject expired refresh token", async () => {
      // Create expired token
      const expiredToken = jwt.sign(
        { id: testUser1.id, type: "refresh" },
        process.env.JWT_SECRET!,
        { expiresIn: "-1h" },
      );

      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: expiredToken });

      expect(response.status).toBe(401);
    });
  });

  describe("Multi-Tenant Authentication", () => {
    it("should isolate login attempts by tenant", async () => {
      // Try to login user1 with tenant2's subdomain
      const response = await request(app)
        .post("/api/auth/login")
        .set("X-Tenant-Subdomain", "authtest2")
        .send({
          username: testUser1.username,
          password: "TestPass123!",
        });

      expect(response.status).toBe(401);
    });

    it("should not allow cross-tenant token usage", async () => {
      // Get token for user1 (tenant1)
      const login1 = await request(app).post("/api/auth/login").send({
        username: testUser1.username,
        password: "TestPass123!",
      });
      const token1 = login1.body.data.token;

      // Try to use token1 to access tenant2 resources
      const response = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${token1}`)
        .set("X-Tenant-Id", tenant2Id.toString());

      expect(response.status).toBe(403);
    });
  });

  describe("Password Reset Flow", () => {
    it("should initiate password reset", async () => {
      const response = await request(app)
        .post("/api/auth/forgot-password")
        .send({
          email: testUser1.email,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("E-Mail"),
      });

      // Check reset token was saved
      const [rows] = await testDb.execute(
        "SELECT * FROM password_reset_tokens WHERE user_id = ?",
        [testUser1.id],
      );
      const tokens = asTestRows<any>(rows);
      expect(tokens).toHaveLength(1);
    });

    it("should reset password with valid token", async () => {
      // Create reset token
      const resetToken = "test-reset-token-123";
      const hashedToken = await bcrypt.hash(resetToken, 10);
      await testDb.execute(
        "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))",
        [testUser1.id, hashedToken],
      );

      const response = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: resetToken,
          newPassword: "NewSecurePass123!",
        });

      expect(response.status).toBe(200);

      // Verify can login with new password
      const loginResponse = await request(app).post("/api/auth/login").send({
        username: testUser1.username,
        password: "NewSecurePass123!",
      });
      expect(loginResponse.status).toBe(200);
    });
  });

  describe("Security Headers", () => {
    it("should include security headers in auth responses", async () => {
      const response = await request(app).post("/api/auth/login").send({
        username: testUser1.username,
        password: "TestPass123!",
      });

      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["x-frame-options"]).toBe("DENY");
      expect(response.headers["x-xss-protection"]).toBe("1; mode=block");
    });

    it("should set secure cookie flags", async () => {
      process.env.NODE_ENV = "production";

      const response = await request(app).post("/api/auth/login").send({
        username: testUser1.username,
        password: "TestPass123!",
      });

      const cookies = response.headers["set-cookie"];
      const tokenCookie = cookies.find((c) => c.startsWith("token="));

      expect(tokenCookie).toContain("HttpOnly");
      expect(tokenCookie).toContain("SameSite=Strict");

      process.env.NODE_ENV = "test";
    });
  });
});
