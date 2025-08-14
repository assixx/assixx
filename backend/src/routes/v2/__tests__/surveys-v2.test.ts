/**
 * Tests for Surveys API v2
 * Tests survey management functionality with role-based access
 */

import request from "supertest";
import app from "../../../app";
import { Pool } from "mysql2/promise";
import {
  createTestDatabase,
  cleanupTestData,
  createTestTenant,
  createTestUser,
  createTestDepartment,
  createTestTeam,
} from "../../mocks/database";
import type { ResultSetHeader } from "mysql2";

describe("Surveys API v2", () => {
  let testDb: Pool;
  let tenantId: number;
  let adminToken: string;
  let employeeToken: string;
  let adminUserId: number;
  let employeeUserId: number;
  let departmentId: number;
  let testSurveyId: number;

  beforeAll(async () => {
    testDb = await createTestDatabase();

    // Create test tenant
    tenantId = await createTestTenant(
      testDb,
      "surveys-test",
      "Test Surveys Tenant",
    );

    // Create test department and team
    departmentId = await createTestDepartment(
      testDb,
      tenantId,
      "Test Department",
    );

    await createTestTeam(testDb, tenantId, departmentId, "Test Team");
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Clean up existing test data
    await testDb.execute("DELETE FROM survey_responses WHERE tenant_id = ?", [
      tenantId,
    ]);
    await testDb.execute("DELETE FROM survey_answers WHERE tenant_id = ?", [
      tenantId,
    ]);
    await testDb.execute("DELETE FROM survey_assignments WHERE tenant_id = ?", [
      tenantId,
    ]);
    await testDb.execute("DELETE FROM survey_questions WHERE tenant_id = ?", [
      tenantId,
    ]);
    await testDb.execute("DELETE FROM surveys WHERE tenant_id = ?", [tenantId]);

    // Create test users
    const adminUser = await createTestUser(testDb, {
      username: "surveys_admin_v2",
      email: "surveys_admin_v2@test.com",
      password: "TestPass123!",
      role: "admin",
      tenant_id: tenantId,
      department_id: departmentId,
    });
    adminUserId = adminUser.id;

    const adminLoginRes = await request(app).post("/api/v2/auth/login").send({
      email: adminUser.email,
      password: "TestPass123!",
    });
    adminToken = adminLoginRes.body.data.accessToken;

    const employeeUser = await createTestUser(testDb, {
      username: "surveys_employee_v2",
      email: "surveys_employee_v2@test.com",
      password: "TestPass123!",
      role: "employee",
      tenant_id: tenantId,
      department_id: departmentId,
    });
    employeeUserId = employeeUser.id;
    void employeeUserId; // Use the variable to avoid TS error

    const employeeLoginRes = await request(app)
      .post("/api/v2/auth/login")
      .send({
        email: employeeUser.email,
        password: "TestPass123!",
      });
    employeeToken = employeeLoginRes.body.data.accessToken;
  });

  afterEach(async () => {
    // Clean up surveys data after each test
    await testDb.execute("DELETE FROM survey_responses WHERE tenant_id = ?", [
      tenantId,
    ]);
    await testDb.execute("DELETE FROM survey_answers WHERE tenant_id = ?", [
      tenantId,
    ]);
    await testDb.execute("DELETE FROM survey_assignments WHERE tenant_id = ?", [
      tenantId,
    ]);
    await testDb.execute("DELETE FROM survey_questions WHERE tenant_id = ?", [
      tenantId,
    ]);
    await testDb.execute("DELETE FROM surveys WHERE tenant_id = ?", [tenantId]);
  });

  // ============= BASIC CRUD TESTS =============

  describe("Survey CRUD Operations", () => {
    it("should create a new survey", async () => {
      const surveyData = {
        title: "Employee Satisfaction Survey 2025",
        description: "Annual satisfaction survey",
        status: "draft",
      };

      const res = await request(app)
        .post("/api/v2/surveys")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(surveyData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        title: surveyData.title,
        description: surveyData.description,
        status: surveyData.status,
      });
      testSurveyId = res.body.data.id;
    });

    it("should fail to create survey without admin role", async () => {
      const surveyData = {
        title: "Test Survey",
        description: "Test",
      };

      const res = await request(app)
        .post("/api/v2/surveys")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send(surveyData);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should validate required fields", async () => {
      const invalidData = {
        description: "Missing title",
      };

      const res = await request(app)
        .post("/api/v2/surveys")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invalidData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ============= SURVEY LIST/GET TESTS =============

  describe("Survey List and Get Operations", () => {
    beforeEach(async () => {
      // Create test survey directly in DB
      const [surveyResult] = await testDb.execute<ResultSetHeader>(
        `INSERT INTO surveys (tenant_id, title, description, status, is_anonymous, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          "All Users Survey",
          "For all employees",
          "active",
          1,
          adminUserId,
        ],
      );
      testSurveyId = surveyResult.insertId;

      // Add all_users assignment
      await testDb.execute(
        `INSERT INTO survey_assignments (tenant_id, survey_id, assignment_type)
         VALUES (?, ?, ?)`,
        [tenantId, testSurveyId, "all_users"],
      );
    });

    it("should list surveys", async () => {
      const res = await request(app)
        .get("/api/v2/surveys")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("should get survey by ID", async () => {
      const res = await request(app)
        .get(`/api/v2/surveys/${testSurveyId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testSurveyId);
    });

    it("should return 404 for non-existent survey", async () => {
      const res = await request(app)
        .get("/api/v2/surveys/99999")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ============= SURVEY UPDATE/DELETE TESTS =============

  describe("Survey Update and Delete Operations", () => {
    beforeEach(async () => {
      // Create a test survey
      const [result] = await testDb.execute<ResultSetHeader>(
        `INSERT INTO surveys (tenant_id, title, description, status, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [tenantId, "Test Survey", "To be updated", "draft", adminUserId],
      );
      testSurveyId = result.insertId;
    });

    it("should update survey fields", async () => {
      const updateData = {
        title: "Updated Survey Title",
        description: "Updated description",
        status: "active",
      };

      const res = await request(app)
        .put(`/api/v2/surveys/${testSurveyId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject(updateData);
    });

    it("employee should not be able to update survey", async () => {
      const res = await request(app)
        .put(`/api/v2/surveys/${testSurveyId}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ title: "New Title" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should delete survey without responses", async () => {
      const res = await request(app)
        .delete(`/api/v2/surveys/${testSurveyId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify deletion
      const [rows] = await testDb.execute(
        "SELECT * FROM surveys WHERE id = ?",
        [testSurveyId],
      );
      expect((rows as any[]).length).toBe(0);
    });

    it("employee should not be able to delete survey", async () => {
      const res = await request(app)
        .delete(`/api/v2/surveys/${testSurveyId}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // ============= MULTI-TENANT ISOLATION TESTS =============

  describe("Multi-Tenant Isolation", () => {
    let otherTenantId: number;
    let otherTenantSurveyId: number;

    beforeEach(async () => {
      // Create another tenant with survey
      otherTenantId = await createTestTenant(
        testDb,
        "other-survey-tenant",
        "Other Tenant",
      );

      const otherUser = await createTestUser(testDb, {
        username: "other_admin",
        email: "other_admin@test.com",
        password: "TestPass123!",
        role: "admin",
        tenant_id: otherTenantId,
      });

      const [result] = await testDb.execute<ResultSetHeader>(
        `INSERT INTO surveys (tenant_id, title, status, created_by)
         VALUES (?, ?, ?, ?)`,
        [otherTenantId, "Other Tenant Survey", "active", otherUser.id],
      );
      otherTenantSurveyId = result.insertId;
    });

    it("should not access surveys from other tenants", async () => {
      const res = await request(app)
        .get(`/api/v2/surveys/${otherTenantSurveyId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should not list surveys from other tenants", async () => {
      const res = await request(app)
        .get("/api/v2/surveys")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Should not include the other tenant's survey
      expect(
        res.body.data.every((s: any) => s.id !== otherTenantSurveyId),
      ).toBe(true);
    });
  });
});
