/**
 * Simple debug test for Calendar v2 API
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import { Pool } from "mysql2/promise";
import app from "../../../../app.js";
import {
  createTestDatabase,
  cleanupTestData,
  createTestTenant,
  createTestUser,
  createTestDepartment,
} from "../../../mocks/database.js";

describe("Calendar v2 API - Simple Debug Test", () => {
  let testDb: Pool;
  let tenantId: number;
  let deptId: number;
  let adminUser: any;

  beforeAll(async () => {
    console.info("1. Creating test database...");
    testDb = await createTestDatabase();

    console.info("2. Setting JWT secret...");
    process.env.JWT_SECRET = "test-secret-key-for-calendar-debug";

    console.info("3. Creating test tenant...");
    tenantId = await createTestTenant(
      testDb,
      "caldebugtest",
      "Calendar Debug Test Company",
    );
    console.info("   Tenant created with ID:", tenantId);

    console.info("4. Creating test department...");
    deptId = await createTestDepartment(testDb, tenantId, "Test Department");
    console.info("   Department created with ID:", deptId);

    console.info("5. Creating admin user...");
    adminUser = await createTestUser(testDb, {
      username: "admin.caldebug@test.com",
      email: "admin.caldebug@test.com",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenantId,
      first_name: "Admin",
      last_name: "Debug",
      department_id: deptId,
    });
    console.info("   Admin user created:", adminUser);
  });

  afterAll(async () => {
    console.info("Cleaning up test data...");
    await cleanupTestData();
    await testDb.end();
  });

  it("should login admin user", async () => {
    console.info("Attempting login with credentials:");
    console.info("  Email:", adminUser.email);
    console.info("  Password: AdminPass123!");

    const response = await request(app).post("/api/v2/auth/login").send({
      email: adminUser.email,
      password: "AdminPass123!",
    });

    console.info("Login response status:", response.status);
    console.info(
      "Login response body:",
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("accessToken");
  });

  it("should access calendar endpoint with token", async () => {
    // First login
    const loginRes = await request(app).post("/api/v2/auth/login").send({
      email: adminUser.email,
      password: "AdminPass123!",
    });

    const token = loginRes.body.data?.accessToken;
    console.info("Got token:", token ? "Yes" : "No");

    if (token) {
      const calendarRes = await request(app)
        .get("/api/v2/calendar/events")
        .set("Authorization", `Bearer ${token}`);

      console.info("Calendar response status:", calendarRes.status);
      console.info(
        "Calendar response body:",
        JSON.stringify(calendarRes.body, null, 2),
      );

      expect(calendarRes.status).toBe(200);
      expect(calendarRes.body.success).toBe(true);
    }
  });
});
