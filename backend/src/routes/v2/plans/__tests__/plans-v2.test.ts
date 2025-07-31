/**
 * Tests for Plans API v2
 * Tests subscription plans, addons, and billing functionality
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  jest,
} from "@jest/globals";
import request from "supertest";
import app from "../../../../app.js";
import { Pool } from "mysql2/promise";
import {
  createTestDatabase,
  cleanupTestData,
  closeTestDatabase,
  createTestTenant,
  createTestUser,
} from "../../../mocks/database.js";

describe("Plans API v2", () => {
  // Increase timeout for database operations
  jest.setTimeout(60000); // 60 seconds

  let testDb: Pool;
  let tenantId: number;
  let adminToken: string;
  let userToken: string;
  let adminUserId: number;
  let basicPlanId: number;
  let professionalPlanId: number;
  let enterprisePlanId: number;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    await cleanupTestData();

    // Create test tenant
    tenantId = await createTestTenant(
      testDb,
      "plans-test",
      "Test Plans Tenant",
    );

    // Create admin user
    const adminUser = await createTestUser(testDb, {
      username: "plans_admin_v2",
      email: "admin@plansv2.test",
      password: "Admin123!",
      first_name: "Admin",
      last_name: "User",
      role: "admin",
      tenant_id: tenantId,
    });
    adminUserId = adminUser.id;

    // Create regular user
    const regularUser = await createTestUser(testDb, {
      username: "plans_user_v2",
      email: "user@plansv2.test",
      password: "User123!",
      first_name: "Regular",
      last_name: "User",
      role: "employee",
      tenant_id: tenantId,
    });

    // Login to get tokens
    const adminLogin = await request(app)
      .post("/api/v2/auth/login")
      .send({ email: adminUser.email, password: "Admin123!" });
    adminToken = adminLogin.body.data.accessToken;

    const userLogin = await request(app)
      .post("/api/v2/auth/login")
      .send({ email: regularUser.email, password: "User123!" });
    userToken = userLogin.body.data.accessToken;

    // Create test plans if they don't exist
    const [existingPlans] = await testDb.execute(
      "SELECT id, code FROM plans WHERE code IN ('basic', 'professional', 'enterprise')",
    );

    if ((existingPlans as any[]).length === 0) {
      await testDb.execute(
        `INSERT INTO plans (code, name, description, base_price, max_employees, max_admins, max_storage_gb, is_active, sort_order) 
         VALUES 
         ('basic', 'Basic Plan', 'For small teams', 49.99, 10, 2, 50, true, 1),
         ('professional', 'Professional Plan', 'For growing teams', 99.99, 50, 10, 100, true, 2),
         ('enterprise', 'Enterprise Plan', 'For large organizations', 199.99, null, null, 500, true, 3)`,
      );
    }

    // Get plan IDs
    const [plans] = await testDb.execute(
      "SELECT id, code FROM plans WHERE code IN ('basic', 'professional', 'enterprise')",
    );
    const planRows = plans as any[];
    basicPlanId = planRows.find((p) => p.code === "basic").id;
    professionalPlanId = planRows.find((p) => p.code === "professional").id;
    enterprisePlanId = planRows.find((p) => p.code === "enterprise").id;

    // Assign basic plan to test tenant
    await testDb.execute(
      `INSERT INTO tenant_plans (tenant_id, plan_id, status, started_at) 
       VALUES (?, ?, 'active', NOW())`,
      [tenantId, basicPlanId],
    );
  });

  afterAll(async () => {
    // Clean up test data
    if (testDb && tenantId) {
      await testDb.execute("DELETE FROM tenant_addons WHERE tenant_id = ?", [
        tenantId,
      ]);
      await testDb.execute("DELETE FROM tenant_plans WHERE tenant_id = ?", [
        tenantId,
      ]);
    }
    await cleanupTestData();
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Reset tenant addons before each test
    await testDb.execute("DELETE FROM tenant_addons WHERE tenant_id = ?", [
      tenantId,
    ]);
  });

  describe("GET /api/v2/plans", () => {
    it("should return all active plans without authentication", async () => {
      const response = await request(app).get("/api/v2/plans").expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            code: "basic",
            isActive: true,
          }),
          expect.objectContaining({
            code: "professional",
            isActive: true,
          }),
          expect.objectContaining({
            code: "enterprise",
            isActive: true,
          }),
        ]),
        meta: {
          timestamp: expect.any(String),
          version: "2.0",
        },
      });
    });

    it("should include features for each plan", async () => {
      const response = await request(app).get("/api/v2/plans").expect(200);

      response.body.data.forEach((plan: any) => {
        expect(plan).toHaveProperty("features");
        expect(Array.isArray(plan.features)).toBe(true);
      });
    });
  });

  describe("GET /api/v2/plans/current", () => {
    it("should return current tenant plan for authenticated user", async () => {
      const response = await request(app)
        .get("/api/v2/plans/current")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          plan: expect.objectContaining({
            tenantId: tenantId,
            planCode: "basic",
            status: "active",
          }),
          addons: expect.any(Array),
          costs: expect.objectContaining({
            basePlanCost: expect.any(Number),
            addonsCost: expect.any(Number),
            totalMonthlyCost: expect.any(Number),
            billingCycle: "monthly",
          }),
        },
        meta: {
          timestamp: expect.any(String),
          version: "2.0",
        },
      });
    });

    it("should require authentication", async () => {
      await request(app).get("/api/v2/plans/current").expect(401);
    });
  });

  describe("GET /api/v2/plans/addons", () => {
    it("should return zero addons initially", async () => {
      const response = await request(app)
        .get("/api/v2/plans/addons")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          employees: 0,
          admins: 0,
          storageGb: 0,
        },
        meta: {
          timestamp: expect.any(String),
          version: "2.0",
        },
      });
    });
  });

  describe("PUT /api/v2/plans/addons", () => {
    it("should allow admin to update addons", async () => {
      const response = await request(app)
        .put("/api/v2/plans/addons")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          employees: 5,
          admins: 1,
          storageGb: 25,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          employees: 5,
          admins: 1,
          storageGb: 25,
        },
        meta: {
          timestamp: expect.any(String),
          version: "2.0",
        },
      });

      // Verify in database
      const [addons] = await testDb.execute(
        `SELECT 
          COALESCE(MAX(CASE WHEN addon_type = 'employees' THEN quantity END), 0) as extra_employees,
          COALESCE(MAX(CASE WHEN addon_type = 'admins' THEN quantity END), 0) as extra_admins,
          COALESCE(MAX(CASE WHEN addon_type = 'storage_gb' THEN quantity END), 0) as extra_storage_gb
        FROM tenant_addons 
        WHERE tenant_id = ? AND status = 'active'`,
        [tenantId],
      );
      const addonRow = (addons as any[])[0];
      expect(addonRow.extra_employees).toBe(5);
      expect(addonRow.extra_admins).toBe(1);
      expect(addonRow.extra_storage_gb).toBe(25);
    });

    it("should prevent regular users from updating addons", async () => {
      await request(app)
        .put("/api/v2/plans/addons")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ employees: 10 })
        .expect(403);
    });

    it("should validate addon values", async () => {
      const response = await request(app)
        .put("/api/v2/plans/addons")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ employees: -5 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/v2/plans/costs", () => {
    it("should calculate current costs with addons", async () => {
      // First set some addons
      await request(app)
        .put("/api/v2/plans/addons")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ employees: 5, storageGb: 50 })
        .expect(200);

      const response = await request(app)
        .get("/api/v2/plans/costs")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          basePlanCost: 49,
          addonCosts: {
            employees: 25.0, // 5 * 5€
            admins: 0,
            storage: 5.0, // 50 * 0.10€
          },
          totalMonthlyCost: 79,
          currency: "EUR",
        },
        meta: {
          timestamp: expect.any(String),
          version: "2.0",
        },
      });
    });
  });

  describe("GET /api/v2/plans/:id", () => {
    it("should return plan by ID", async () => {
      const response = await request(app)
        .get(`/api/v2/plans/${professionalPlanId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: professionalPlanId,
          code: "professional",
          name: "Professional",
          basePrice: 149,
        }),
        meta: {
          timestamp: expect.any(String),
          version: "2.0",
        },
      });
    });

    it("should return 404 for non-existent plan", async () => {
      const response = await request(app)
        .get("/api/v2/plans/999999")
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: "PLAN_NOT_FOUND",
          message: "Plan not found",
        },
      });
    });
  });

  describe("PUT /api/v2/plans/:id/upgrade", () => {
    it("should allow admin to upgrade plan", async () => {
      const response = await request(app)
        .put(`/api/v2/plans/${professionalPlanId}/upgrade`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ newPlanCode: "professional" })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          plan: expect.objectContaining({
            planCode: "professional",
          }),
        },
        meta: {
          timestamp: expect.any(String),
          version: "2.0",
        },
      });

      // Verify in database
      const [activePlans] = await testDb.execute(
        `SELECT * FROM tenant_plans WHERE tenant_id = ? AND status = 'active'`,
        [tenantId],
      );
      expect((activePlans as any[]).length).toBe(1);
      expect((activePlans as any[])[0].plan_id).toBe(professionalPlanId);
    });

    it("should prevent non-admin from upgrading plan", async () => {
      await request(app)
        .put(`/api/v2/plans/${enterprisePlanId}/upgrade`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ newPlanCode: "enterprise" })
        .expect(403);
    });

    it("should validate plan code", async () => {
      const response = await request(app)
        .put(`/api/v2/plans/${basicPlanId}/upgrade`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ newPlanCode: "invalid-plan" })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it("should log plan changes in audit trail", async () => {
      await request(app)
        .put(`/api/v2/plans/${basicPlanId}/upgrade`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ newPlanCode: "basic" })
        .expect(200);

      // Check root_logs for audit entry
      const [logs] = await testDb.execute(
        `SELECT * FROM root_logs 
         WHERE entity_type = 'tenant_plans' 
         AND action = 'plan_upgrade' 
         AND tenant_id = ?
         ORDER BY created_at DESC 
         LIMIT 1`,
        [tenantId],
      );

      expect((logs as any[]).length).toBe(1);
      expect((logs as any[])[0].user_id).toBe(adminUserId);
    });
  });
});
