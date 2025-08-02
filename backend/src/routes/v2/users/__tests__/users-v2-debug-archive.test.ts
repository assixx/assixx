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
import app from "../../../../app.js";
import {
  createTestDatabase,
  cleanupTestData,
  createTestTenant,
  createTestUser,
} from "../../../mocks/database.js";

describe("DEBUG: Users v2 Archive API", () => {
  let testDb: Pool;
  let tenantId: number;
  let adminToken: string;
  let userId: number;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = "test-secret-key-for-users-v2-archive-debug";

    // Create test tenant
    tenantId = await createTestTenant(
      testDb,
      "archivetest",
      "Archive Test Company",
    );

    // Create admin user
    const adminUser = await createTestUser(testDb, {
      username: "admin.archive@test.com",
      email: "admin.archive@test.com",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenantId,
      first_name: "Admin",
      last_name: "Archive",
    });

    // Login admin
    const loginRes = await request(app).post("/api/v2/auth/login").send({
      email: adminUser.email,
      password: "AdminPass123!",
    });

    adminToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Create test user to archive
    const user = await createTestUser(testDb, {
      username: "test.archive@test.com",
      email: "test.archive@test.com",
      password: "TestPass123!",
      role: "employee",
      tenant_id: tenantId,
      first_name: "Test",
      last_name: "Archive",
    });
    userId = user.id;
    console.log("Created user with ID:", userId, "Type:", typeof userId);
  });

  it("should check archive endpoint validation", async () => {
    console.log("Testing archive endpoint with userId:", userId);

    const response = await request(app)
      .post(`/api/v2/users/${userId}/archive`)
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("Archive response status:", response.status);
    console.log(
      "Archive response body:",
      JSON.stringify(response.body, null, 2),
    );

    // Check if this is a validation error
    if (response.status === 400) {
      console.log("Validation error details:", response.body.error);

      // Try with string ID
      const responseWithString = await request(app)
        .post(`/api/v2/users/${userId.toString()}/archive`)
        .set("Authorization", `Bearer ${adminToken}`);

      console.log("Response with string ID:", responseWithString.status);
    }

    expect(response.status).not.toBe(500);
  });

  it("should check if user exists before archive", async () => {
    // First check if we can get the user
    const getResponse = await request(app)
      .get(`/api/v2/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("Get user response status:", getResponse.status);
    console.log("Get user response body:", getResponse.body);
  });

  it("should check if route is registered", async () => {
    // Try OPTIONS request to see if route exists
    const optionsResponse = await request(app).options(
      `/api/v2/users/${userId}/archive`,
    );

    console.log("OPTIONS response status:", optionsResponse.status);
    console.log("OPTIONS response headers:", optionsResponse.headers);
  });
});
