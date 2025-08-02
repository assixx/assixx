/**
 * Settings API v2 Tests - Fixed Version (Based on working Teams v2 pattern)
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
import app from "../../../../app.js";
import { Pool } from "mysql2/promise";
import {
  createTestDatabase,
  cleanupTestData,
  createTestTenant,
  createTestUser,
} from "../../../mocks/database.js";

describe("Settings API v2 - Fixed", () => {
  let testDb: Pool;
  let tenantId: number;
  let adminToken: string;
  let employeeToken: string;
  let rootToken: string;
  let adminUser: any;
  let employeeUser: any;
  let rootUser: any;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = "test-secret-key-for-settings-v2-tests";

    // Create test tenant
    tenantId = await createTestTenant(
      testDb,
      "settingsfix-test",
      "Test Settings Tenant Fixed",
    );

    // Create all test users in beforeAll
    adminUser = await createTestUser(testDb, {
      username: "settingsfix_admin_v2",
      email: "settingsfix_admin_v2@test.com",
      password: "TestPass123!",
      role: "admin",
      tenant_id: tenantId,
    });

    employeeUser = await createTestUser(testDb, {
      username: "settingsfix_emp_v2",
      email: "settingsfix_emp_v2@test.com",
      password: "TestPass123!",
      role: "employee",
      tenant_id: tenantId,
    });

    rootUser = await createTestUser(testDb, {
      username: "settingsfix_root_v2",
      email: "settingsfix_root_v2@test.com",
      password: "TestPass123!",
      role: "root",
      tenant_id: tenantId,
    });

    // Login all users
    const adminLoginRes = await request(app).post("/api/v2/auth/login").send({
      email: adminUser.email,
      password: "TestPass123!",
    });
    adminToken = adminLoginRes.body.data.accessToken;

    const employeeLoginRes = await request(app)
      .post("/api/v2/auth/login")
      .send({
        email: employeeUser.email,
        password: "TestPass123!",
      });
    employeeToken = employeeLoginRes.body.data.accessToken;

    const rootLoginRes = await request(app).post("/api/v2/auth/login").send({
      email: rootUser.email,
      password: "TestPass123!",
    });
    rootToken = rootLoginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Clear only settings data before each test (not users!)
    await testDb.execute(
      "DELETE FROM user_settings WHERE user_id IN (?, ?, ?)",
      [adminUser.id, employeeUser.id, rootUser.id],
    );
    await testDb.execute("DELETE FROM tenant_settings WHERE tenant_id = ?", [
      tenantId,
    ]);
    await testDb.execute("DELETE FROM system_settings");
  });

  describe("System Settings", () => {
    it("should deny employees access to system settings", async () => {
      const response = await request(app)
        .get("/api/v2/settings/system")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    }, 10000); // 10 second timeout

    it("should deny admin access to system settings", async () => {
      const response = await request(app)
        .get("/api/v2/settings/system")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    }, 10000);

    it("should allow root to get system settings", async () => {
      const response = await request(app)
        .get("/api/v2/settings/system")
        .set("Authorization", `Bearer ${rootToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.settings).toBeInstanceOf(Array);
    }, 10000);

    it("should create and get system setting as root", async () => {
      // Create setting
      const createRes = await request(app)
        .put("/api/v2/settings/system/test_setting")
        .set("Authorization", `Bearer ${rootToken}`)
        .set("Content-Type", "application/json")
        .send({
          setting_value: "test_value",
          value_type: "string",
          category: "general",
          description: "Test setting",
          is_public: false,
        });

      expect(createRes.status).toBe(200);
      expect(createRes.body.success).toBe(true);

      // Get setting
      const getRes = await request(app)
        .get("/api/v2/settings/system/test_setting")
        .set("Authorization", `Bearer ${rootToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.settingKey).toBe("test_setting");
      expect(getRes.body.data.settingValue).toBe("test_value");
    }, 10000);
  });

  describe("Tenant Settings", () => {
    it("should get tenant settings", async () => {
      const response = await request(app)
        .get("/api/v2/settings/tenant")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.settings).toBeInstanceOf(Array);
    }, 10000);

    it("should allow admin to create tenant setting", async () => {
      const response = await request(app)
        .put("/api/v2/settings/tenant/company_name")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send({
          setting_value: "Test Company",
          value_type: "string",
          category: "general",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    }, 10000);

    it("should deny employee from creating tenant settings", async () => {
      const response = await request(app)
        .put("/api/v2/settings/tenant/test_tenant_setting")
        .set("Authorization", `Bearer ${employeeToken}`)
        .set("Content-Type", "application/json")
        .send({
          setting_value: "test",
          value_type: "string",
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    }, 10000);
  });

  describe("User Settings", () => {
    it("should get user settings", async () => {
      const response = await request(app)
        .get("/api/v2/settings/user")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.settings).toBeInstanceOf(Array);
    }, 10000);

    it("should create user setting", async () => {
      const response = await request(app)
        .put("/api/v2/settings/user/theme")
        .set("Authorization", `Bearer ${employeeToken}`)
        .set("Content-Type", "application/json")
        .send({
          setting_value: "dark",
          value_type: "string",
          category: "appearance",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    }, 10000);

    it("should handle different value types", async () => {
      // Boolean
      await request(app)
        .put("/api/v2/settings/user/notifications_enabled")
        .set("Authorization", `Bearer ${employeeToken}`)
        .set("Content-Type", "application/json")
        .send({
          setting_value: true,
          value_type: "boolean",
          category: "notifications",
        });

      // Number
      await request(app)
        .put("/api/v2/settings/user/items_per_page")
        .set("Authorization", `Bearer ${employeeToken}`)
        .set("Content-Type", "application/json")
        .send({
          setting_value: 25,
          value_type: "number",
          category: "general",
        });

      // JSON
      await request(app)
        .put("/api/v2/settings/user/preferences")
        .set("Authorization", `Bearer ${employeeToken}`)
        .set("Content-Type", "application/json")
        .send({
          setting_value: { color: "blue", font: "Arial" },
          value_type: "json",
          category: "appearance",
        });

      const response = await request(app)
        .get("/api/v2/settings/user")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.settings).toHaveLength(3);
    }, 10000);
  });

  describe("Common Endpoints", () => {
    it("should get categories", async () => {
      const response = await request(app)
        .get("/api/v2/settings/categories")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toBeInstanceOf(Array);
      expect(response.body.data.categories).toContainEqual(
        expect.objectContaining({
          key: "general",
          label: "General",
        }),
      );
    }, 10000);

    it("should bulk update user settings", async () => {
      const response = await request(app)
        .put("/api/v2/settings/bulk")
        .set("Authorization", `Bearer ${employeeToken}`)
        .set("Content-Type", "application/json")
        .send({
          type: "user",
          settings: [
            {
              setting_key: "bulk_test_1",
              setting_value: "value1",
              value_type: "string",
            },
            {
              setting_key: "bulk_test_2",
              setting_value: 42,
              value_type: "number",
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(2);
      expect(response.body.data.results[0].success).toBe(true);
      expect(response.body.data.results[1].success).toBe(true);
    }, 10000);
  });
});
