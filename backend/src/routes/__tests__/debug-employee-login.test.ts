import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import { Pool } from "mysql2/promise";
import app from "../../app.js";
import {
  createTestDatabase,
  cleanupTestData,
  createTestTenant,
  createTestUser,
} from "../mocks/database.js";

describe("Debug Employee Login", () => {
  let testDb: Pool;
  let tenantId: number;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = "test-secret-key-for-debug-employee";

    // Create test tenant
    tenantId = await createTestTenant(
      testDb,
      "debugemployee",
      "Debug Employee Test Company",
    );
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  it("should debug why employee login fails", async () => {
    // Create three users with different roles
    const adminUser = await createTestUser(testDb, {
      username: "debug.admin2@test.com",
      email: "debug.admin2@test.com",
      password: "TestPass123",
      role: "admin",
      tenant_id: tenantId,
      first_name: "Debug",
      last_name: "Admin2",
    });

    const employeeUser = await createTestUser(testDb, {
      username: "debug.employee2@test.com",
      email: "debug.employee2@test.com",
      password: "TestPass123",
      role: "employee",
      tenant_id: tenantId,
      first_name: "Debug",
      last_name: "Employee2",
    });

    const rootUser = await createTestUser(testDb, {
      username: "debug.root2@test.com",
      email: "debug.root2@test.com",
      password: "TestPass123",
      role: "root",
      tenant_id: tenantId,
      first_name: "Debug",
      last_name: "Root2",
    });

    console.info("Created users:");
    console.info("Admin:", adminUser);
    console.info("Employee:", employeeUser);
    console.info("Root:", rootUser);

    // Try to login each user
    console.info("\n--- Testing Admin Login ---");
    const adminLoginRes = await request(app).post("/api/v2/auth/login").send({
      email: adminUser.email,
      password: "TestPass123",
    });
    console.info("Admin login status:", adminLoginRes.status);
    console.info("Admin login body:", adminLoginRes.body);

    console.info("\n--- Testing Employee Login ---");
    const employeeLoginRes = await request(app)
      .post("/api/v2/auth/login")
      .send({
        email: employeeUser.email,
        password: "TestPass123",
      });
    console.info("Employee login status:", employeeLoginRes.status);
    console.info("Employee login body:", employeeLoginRes.body);

    console.info("\n--- Testing Root Login ---");
    const rootLoginRes = await request(app).post("/api/v2/auth/login").send({
      email: rootUser.email,
      password: "TestPass123",
    });
    console.info("Root login status:", rootLoginRes.status);
    console.info("Root login body:", rootLoginRes.body);

    // Check database directly
    console.info("\n--- Checking Database Directly ---");
    const [users] = await testDb.execute(
      "SELECT id, username, email, role, status FROM users WHERE tenant_id = ?",
      [tenantId],
    );
    console.info("Users in database:", users);

    // All should succeed
    expect(adminLoginRes.status).toBe(200);
    expect(employeeLoginRes.status).toBe(200);
    expect(rootLoginRes.status).toBe(200);
  });
});
