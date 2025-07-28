/**
 * API Tests for Users v2 Management Endpoints
 * Tests user CRUD operations, service layer, and API v2 standards
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "@jest/globals";
import request from "supertest";
import { Pool } from "mysql2/promise";
import path from "path";
import fs from "fs/promises";
import app from "../../app.js";
import {
  createTestDatabase,
  cleanupTestData,
  createTestTenant,
  createTestUser,
  createTestDepartment,
} from "../mocks/database.js";

describe("Users v2 API Endpoints", () => {
  let testDb: Pool;
  let tenant1Id: number;
  let tenant2Id: number;
  let dept1Id: number;
  let adminTokenV2: string;
  let employeeTokenV2: string;
  let adminUser: any;
  let employeeUser: any;
  let employeeUserId: number;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = "test-secret-key-for-users-v2-tests";

    // Create test tenants
    tenant1Id = await createTestTenant(
      testDb,
      "usersv2test1",
      "Users v2 Test Company 1",
    );
    tenant2Id = await createTestTenant(
      testDb,
      "usersv2test2",
      "Users v2 Test Company 2",
    );

    // Create test departments
    dept1Id = await createTestDepartment(testDb, tenant1Id, "IT Department");

    // Create test users
    adminUser = await createTestUser(testDb, {
      username: "admin.v2@test.com",
      email: "admin.v2@test.com",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenant1Id,
      first_name: "Admin",
      last_name: "V2Test",
      department_id: dept1Id,
    });

    employeeUser = await createTestUser(testDb, {
      username: "employee.v2@test.com",
      email: "employee.v2@test.com",
      password: "EmployeePass123!",
      role: "employee",
      tenant_id: tenant1Id,
      first_name: "Employee",
      last_name: "V2Test",
      department_id: dept1Id,
    });
    employeeUserId = employeeUser.id;

    // Get v2 auth tokens - use actual emails returned by createTestUser
    const adminLoginRes = await request(app).post("/api/v2/auth/login").send({
      email: adminUser.email,
      password: "AdminPass123!",
    });
    adminTokenV2 = adminLoginRes.body.data.accessToken;

    const employeeLoginRes = await request(app)
      .post("/api/v2/auth/login")
      .send({
        email: employeeUser.email,
        password: "EmployeePass123!",
      });

    if (employeeLoginRes.status !== 200) {
      console.log(
        "Employee login failed:",
        employeeLoginRes.status,
        employeeLoginRes.body,
      );
      console.log("Tried to login with email:", employeeUser.email);
      throw new Error("Employee login failed");
    }

    employeeTokenV2 = employeeLoginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  describe("Response Format Validation", () => {
    it("should return standardized success response format", async () => {
      const response = await request(app)
        .get("/api/v2/users/me")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("meta");
      expect(response.body.meta).toHaveProperty("timestamp");
      expect(response.body.meta).toHaveProperty("version", "2.0");
    });

    it("should return standardized error response format", async () => {
      const response = await request(app)
        .get("/api/v2/users/me")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toHaveProperty("code");
      expect(response.body.error).toHaveProperty("message");
      expect(response.body).toHaveProperty("meta");
      expect(response.body.meta).toHaveProperty("timestamp");
      expect(response.body.meta).toHaveProperty("requestId");
    });
  });

  describe("Field Mapping (camelCase)", () => {
    it("should return user data with camelCase fields", async () => {
      const response = await request(app)
        .get("/api/v2/users/me")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      const user = response.body.data;

      // Check camelCase fields
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("email");
      expect(user).toHaveProperty("firstName");
      expect(user).toHaveProperty("lastName");
      expect(user).toHaveProperty("tenantId");
      expect(user).toHaveProperty("departmentId");
      expect(user).toHaveProperty("isActive");
      expect(user).toHaveProperty("createdAt");
      expect(user).toHaveProperty("updatedAt");

      // Should NOT have snake_case fields
      expect(user).not.toHaveProperty("first_name");
      expect(user).not.toHaveProperty("last_name");
      expect(user).not.toHaveProperty("tenant_id");
      expect(user).not.toHaveProperty("department_id");
      expect(user).not.toHaveProperty("is_active");
      expect(user).not.toHaveProperty("created_at");

      // Should NOT have sensitive fields
      expect(user).not.toHaveProperty("password");
      expect(user).not.toHaveProperty("passwordResetToken");
      expect(user).not.toHaveProperty("twoFactorSecret");
    });
  });

  describe("GET /api/v2/users", () => {
    it("should list users with pagination (admin only)", async () => {
      const response = await request(app)
        .get("/api/v2/users")
        .query({ page: 1, limit: 10 })
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.meta.pagination).toMatchObject({
        currentPage: 1,
        pageSize: 10,
        totalItems: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });

    it("should filter users by role", async () => {
      const response = await request(app)
        .get("/api/v2/users")
        .query({ role: "admin" })
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      const users = response.body.data;
      expect(users.every((u: any) => u.role === "admin")).toBe(true);
    });

    it("should search users by name or email", async () => {
      const response = await request(app)
        .get("/api/v2/users")
        .query({ search: "Admin" })
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      const users = response.body.data;
      expect(users.length).toBeGreaterThan(0);
      expect(
        users.some(
          (u: any) =>
            u.firstName.includes("Admin") ||
            u.lastName.includes("Admin") ||
            u.email.includes("admin"),
        ),
      ).toBe(true);
    });

    it("should deny access to non-admin users", async () => {
      const response = await request(app)
        .get("/api/v2/users")
        .set("Authorization", `Bearer ${employeeTokenV2}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("POST /api/v2/users", () => {
    it("should create a new user with camelCase input", async () => {
      const newUser = {
        email: `__AUTOTEST__newuser.v2.${Date.now()}@test.com`, // Make email unique
        firstName: "New",
        lastName: "UserV2",
        password: "NewPass123!",
        role: "employee",
        departmentId: dept1Id,
        position: "Developer",
        phone: `+123456${Date.now().toString().slice(-7)}`,
      };

      const response = await request(app)
        .post("/api/v2/users")
        .send(newUser)
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        departmentId: newUser.departmentId,
        position: newUser.position,
        phone: newUser.phone,
        isActive: true,
      });
      expect(response.body.data).toHaveProperty("employeeNumber");
      expect(response.body.data.employeeNumber).toMatch(/^EMP/);
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/v2/users")
        .send({
          email: "__AUTOTEST__invalid@test.com",
          // Missing required fields
        })
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.details).toBeInstanceOf(Array);
    });

    it("should prevent duplicate emails", async () => {
      const response = await request(app)
        .post("/api/v2/users")
        .send({
          email: adminUser.email, // Already exists - use actual email from createTestUser
          firstName: "Duplicate",
          lastName: "User",
          password: "Pass123!",
        })
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("CONFLICT");
    });
  });

  describe("PUT /api/v2/users/:id", () => {
    let testUserId: number;
    let testUser: any;

    beforeEach(async () => {
      testUser = await createTestUser(testDb, {
        username: "update.test@test.com",
        email: "__AUTOTEST__update.test@test.com",
        password: "UpdatePass123!",
        role: "employee",
        tenant_id: tenant1Id,
        first_name: "Update",
        last_name: "Test",
      });
      testUserId = testUser.id;
    });

    it("should update user with camelCase fields", async () => {
      const updates = {
        firstName: "Updated",
        lastName: "Name",
        position: "Senior Developer",
        isActive: false,
      };

      const response = await request(app)
        .put(`/api/v2/users/${testUserId}`)
        .send(updates)
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject(updates);
    });

    it("should not allow password updates via this endpoint", async () => {
      const response = await request(app)
        .put(`/api/v2/users/${testUserId}`)
        .send({
          password: "NewPassword123!",
        })
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      // Password should be ignored - verify by trying to login with old password
      const loginRes = await request(app).post("/api/v2/auth/login").send({
        email: testUser.email,
        password: "UpdatePass123!", // Old password
      });
      expect(loginRes.status).toBe(200);
    });
  });

  describe("POST /api/v2/users/:id/archive & /unarchive", () => {
    let archiveUserId: number;

    beforeEach(async () => {
      const user = await createTestUser(testDb, {
        username: "archive.test@test.com",
        email: "__AUTOTEST__archive.test@test.com",
        password: "ArchivePass123!",
        role: "employee",
        tenant_id: tenant1Id,
        first_name: "Archive",
        last_name: "Test",
      });
      archiveUserId = user.id;
    });

    it("should archive a user", async () => {
      const response = await request(app)
        .post(`/api/v2/users/${archiveUserId}/archive`)
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json")
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify user is archived
      const getResponse = await request(app)
        .get(`/api/v2/users/${archiveUserId}`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(getResponse.body.data.isArchived).toBe(true);
    });

    it("should unarchive a user", async () => {
      // First archive
      await request(app)
        .post(`/api/v2/users/${archiveUserId}/archive`)
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json")
        .send({});

      // Then unarchive
      const response = await request(app)
        .post(`/api/v2/users/${archiveUserId}/unarchive`)
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json")
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify user is unarchived
      const getResponse = await request(app)
        .get(`/api/v2/users/${archiveUserId}`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(getResponse.body.data.isArchived).toBe(false);
    });
  });

  describe("PUT /api/v2/users/me/password", () => {
    it("should change password with correct current password", async () => {
      const response = await request(app)
        .put("/api/v2/users/me/password")
        .send({
          currentPassword: "EmployeePass123!",
          newPassword: "NewEmployeePass123!",
          confirmPassword: "NewEmployeePass123!",
        })
        .set("Authorization", `Bearer ${employeeTokenV2}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify new password works
      const loginRes = await request(app).post("/api/v2/auth/login").send({
        email: employeeUser.email,
        password: "NewEmployeePass123!",
      });
      expect(loginRes.status).toBe(200);

      // Verify it's the same user
      const meRes = await request(app)
        .get("/api/v2/users/me")
        .set("Authorization", `Bearer ${loginRes.body.data.accessToken}`);
      expect(meRes.body.data.id).toBe(employeeUserId);
    });

    it("should reject incorrect current password", async () => {
      const response = await request(app)
        .put("/api/v2/users/me/password")
        .send({
          currentPassword: "WrongPassword123!",
          newPassword: "NewPassword123!",
          confirmPassword: "NewPassword123!",
        })
        .set("Authorization", `Bearer ${employeeTokenV2}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });

    it("should validate password confirmation", async () => {
      const response = await request(app)
        .put("/api/v2/users/me/password")
        .send({
          currentPassword: "EmployeePass123!",
          newPassword: "NewPassword123!",
          confirmPassword: "DifferentPassword123!",
        })
        .set("Authorization", `Bearer ${employeeTokenV2}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Profile Picture Endpoints", () => {
    const uploadDir = path.join(process.cwd(), "uploads", "profiles");

    beforeAll(async () => {
      // Ensure upload directory exists
      await fs.mkdir(uploadDir, { recursive: true });
    });

    it("should upload profile picture", async () => {
      const response = await request(app)
        .post("/api/v2/users/me/profile-picture")
        .attach("profilePicture", Buffer.from("fake-image-data"), "profile.jpg")
        .set("Authorization", `Bearer ${employeeTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("profilePicture");
    });

    it("should download profile picture", async () => {
      // First upload
      await request(app)
        .post("/api/v2/users/me/profile-picture")
        .attach("profilePicture", Buffer.from("fake-image-data"), "profile.jpg")
        .set("Authorization", `Bearer ${employeeTokenV2}`);

      // Then download
      const response = await request(app)
        .get("/api/v2/users/me/profile-picture")
        .set("Authorization", `Bearer ${employeeTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.type).toMatch(/image/);
    });

    it("should delete profile picture", async () => {
      // First upload
      await request(app)
        .post("/api/v2/users/me/profile-picture")
        .attach("profilePicture", Buffer.from("fake-image-data"), "profile.jpg")
        .set("Authorization", `Bearer ${employeeTokenV2}`);

      // Then delete
      const response = await request(app)
        .delete("/api/v2/users/me/profile-picture")
        .set("Authorization", `Bearer ${employeeTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify it's deleted
      const getResponse = await request(app)
        .get("/api/v2/users/me/profile-picture")
        .set("Authorization", `Bearer ${employeeTokenV2}`);

      expect(getResponse.status).toBe(404);
    });
  });

  describe("PUT /api/v2/users/:id/availability", () => {
    let availabilityUserId: number;

    beforeEach(async () => {
      const user = await createTestUser(testDb, {
        username: "availability.test@test.com",
        email: "__AUTOTEST__availability.test@test.com",
        password: "AvailPass123!",
        role: "employee",
        tenant_id: tenant1Id,
        first_name: "Avail",
        last_name: "Test",
      });
      availabilityUserId = user.id;
    });

    it("should update user availability", async () => {
      const availabilityData = {
        availabilityStatus: "vacation",
        availabilityStart: "2024-08-01",
        availabilityEnd: "2024-08-15",
        availabilityNotes: "Summer vacation",
      };

      const response = await request(app)
        .put(`/api/v2/users/${availabilityUserId}/availability`)
        .send(availabilityData)
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        availabilityStatus: availabilityData.availabilityStatus,
        availabilityNotes: availabilityData.availabilityNotes,
      });
      // Check dates separately as they are returned as ISO strings
      // Extract date part from ISO string (YYYY-MM-DD from YYYY-MM-DDTHH:mm:ss.sssZ)
      console.log(
        "Availability response:",
        response.body.data.availabilityStart,
        response.body.data.availabilityEnd,
      );

      // Handle timezone differences - the date might be off by one day due to timezone conversion
      const startDate = new Date(response.body.data.availabilityStart);
      const endDate = new Date(response.body.data.availabilityEnd);

      // Check if the dates are within reasonable range (accounting for timezone differences)
      const expectedStart = new Date("2024-08-01");
      const expectedEnd = new Date("2024-08-15");

      // Allow for up to 1 day difference due to timezone conversion
      const startDiff = Math.abs(startDate.getTime() - expectedStart.getTime());
      const endDiff = Math.abs(endDate.getTime() - expectedEnd.getTime());
      const oneDayMs = 24 * 60 * 60 * 1000;

      expect(startDiff).toBeLessThanOrEqual(oneDayMs);
      expect(endDiff).toBeLessThanOrEqual(oneDayMs);
    });

    it("should validate availability status enum", async () => {
      const response = await request(app)
        .put(`/api/v2/users/${availabilityUserId}/availability`)
        .send({
          availabilityStatus: "invalid-status",
        })
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Multi-Tenant Isolation", () => {
    let tenant2AdminToken: string;
    let tenant2Admin: any;

    beforeAll(async () => {
      // Create admin in tenant 2
      tenant2Admin = await createTestUser(testDb, {
        username: "admin.tenant2@test.com",
        email: "admin.tenant2@test.com",
        password: "AdminPass123!",
        role: "admin",
        tenant_id: tenant2Id,
        first_name: "Admin",
        last_name: "Tenant2",
      });

      // Get token
      const loginRes = await request(app).post("/api/v2/auth/login").send({
        email: tenant2Admin.email,
        password: "AdminPass123!",
      });
      tenant2AdminToken = loginRes.body.data.accessToken;
    });

    it("should not allow cross-tenant user access", async () => {
      // Try to access tenant1 user from tenant2 admin
      const response = await request(app)
        .get(`/api/v2/users/${adminUser.id}`)
        .set("Authorization", `Bearer ${tenant2AdminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("should not list users from other tenants", async () => {
      const response = await request(app)
        .get("/api/v2/users")
        .set("Authorization", `Bearer ${tenant2AdminToken}`);

      expect(response.status).toBe(200);
      const users = response.body.data;

      // Verify we have users
      expect(users.length).toBeGreaterThan(0); // Should have at least the admin user

      // Since tenantId is not exposed in the response (good for security),
      // we verify isolation by checking that:
      // 1. We only see the users we created for tenant2
      // 2. We don't see any users from tenant1

      // Check that we only have the expected tenant2 user(s)
      expect(users.length).toBe(1); // Only the tenant2Admin should be visible

      // Verify it's the correct user by email
      const tenant2AdminEmail = users.find((u: any) =>
        u.email.includes("admin.tenant2"),
      );
      expect(tenant2AdminEmail).toBeDefined();

      // Verify we don't see any tenant1 users
      const tenant1Users = users.filter(
        (u: any) =>
          u.email.includes("admin.v2@test.com") ||
          u.email.includes("employee.v2@test.com"),
      );
      expect(tenant1Users.length).toBe(0);
    });
  });
});
