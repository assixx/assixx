import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import { Pool } from "mysql2/promise";
import app from "../../../../app.js";
import {
  createTestDatabase,
  cleanupTestData,
  createTestTenant,
  createTestUser,
} from "../../../mocks/database.js";

describe("DEBUG Calendar v2 Test User Creation", () => {
  let testDb: Pool;
  let tenantId: number;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = "test-secret-key-for-calendar-v2-debug";
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  it("should debug user creation and login", async () => {
    console.log("\n=== DEBUG TEST START ===");

    // Step 1: Create tenant
    console.log("1. Creating test tenant...");
    tenantId = await createTestTenant(
      testDb,
      "debugcalv2",
      "Debug Calendar v2 Company",
    );
    console.log("   Tenant created with ID:", tenantId);

    // Step 2: Create test user
    console.log("\n2. Creating test user...");
    const userResult = await createTestUser(testDb, {
      username: "debug.calv2@test.com",
      email: "debug.calv2@test.com",
      password: "DebugPass123!",
      role: "admin",
      tenant_id: tenantId,
      first_name: "Debug",
      last_name: "User",
    });
    console.log("   User created:", userResult);

    // Step 3: Check user in database
    console.log("\n3. Checking user in database...");
    const [dbUsers] = await testDb.execute(
      "SELECT id, username, email, tenant_id, status, role FROM users WHERE id = ?",
      [userResult.id],
    );
    console.log("   Database result:", dbUsers);

    // Step 4: Try v2 login with returned email
    console.log("\n4. Trying v2 login with returned email...");
    console.log("   Using email:", userResult.email);
    console.log("   Using password: DebugPass123!");

    const loginRes = await request(app).post("/api/v2/auth/login").send({
      email: userResult.email,
      password: "DebugPass123!",
    });

    console.log("   Login response status:", loginRes.status);
    console.log("   Login response body:", loginRes.body);

    // Step 5: Try with original email (without prefix)
    console.log("\n5. Trying v2 login with original email (no prefix)...");
    console.log("   Using email: debug.calv2@test.com");

    const loginRes2 = await request(app).post("/api/v2/auth/login").send({
      email: "debug.calv2@test.com",
      password: "DebugPass123!",
    });

    console.log("   Login response status:", loginRes2.status);
    console.log("   Login response body:", loginRes2.body);

    // Step 6: Check all test users in DB
    console.log("\n6. Checking all test users in database...");
    const [allTestUsers] = await testDb.execute(
      "SELECT id, username, email FROM users WHERE email LIKE '%debug.calv2%' OR email LIKE '%__AUTOTEST__%'",
    );
    console.log("   All test users:", allTestUsers);

    console.log("\n=== DEBUG TEST END ===\n");

    // Test that login works with the correct email
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
  });
});
