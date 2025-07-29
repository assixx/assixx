/**
 * Tests for KVP API v2
 * Tests continuous improvement process functionality
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "@jest/globals";
import request from "supertest";
import app from "../../../app.js";
import { Pool } from "mysql2/promise";
import {
  createTestDatabase,
  cleanupTestData,
  createTestTenant,
  createTestUser,
  createTestDepartment,
} from "../../mocks/database.js";
import type { ResultSetHeader } from "mysql2";

describe("KVP API v2", () => {
  let testDb: Pool;
  let tenantId: number;
  let adminToken: string;
  let employeeToken: string;
  let adminUserId: number;
  let employeeUserId: number;
  let departmentId: number;
  let categoryId: number;
  let testSuggestionId: number;

  beforeAll(async () => {
    testDb = await createTestDatabase();

    // Create test tenant
    tenantId = await createTestTenant(
      testDb,
      "kvp-test",
      "Test KVP Tenant",
    );

    // Create test department
    departmentId = await createTestDepartment(
      testDb,
      tenantId,
      "Test Department"
    );
  });

  afterAll(async () => {
    // Clean up test category
    await testDb.execute("DELETE FROM kvp_categories WHERE name LIKE '__AUTOTEST__%'");
    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Clean up existing test data
    await testDb.execute("DELETE FROM kvp_attachments WHERE suggestion_id IN (SELECT id FROM kvp_suggestions WHERE tenant_id = ?)", [tenantId]);
    await testDb.execute("DELETE FROM kvp_comments WHERE tenant_id = ?", [tenantId]);
    await testDb.execute("DELETE FROM kvp_points WHERE tenant_id = ?", [tenantId]);
    await testDb.execute("DELETE FROM kvp_ratings WHERE suggestion_id IN (SELECT id FROM kvp_suggestions WHERE tenant_id = ?)", [tenantId]);
    await testDb.execute("DELETE FROM kvp_status_history WHERE suggestion_id IN (SELECT id FROM kvp_suggestions WHERE tenant_id = ?)", [tenantId]);
    await testDb.execute("DELETE FROM kvp_suggestions WHERE tenant_id = ?", [tenantId]);
    
    // Check if test category exists, if not create it
    const [existingCategories] = await testDb.execute<any[]>(
      "SELECT id FROM kvp_categories WHERE name = ?",
      ["__AUTOTEST__Productivity"]
    );
    
    if (existingCategories.length === 0) {
      // Create test category (global - no tenant_id)
      const [categoryResult] = await testDb.execute<ResultSetHeader>(
        "INSERT INTO kvp_categories (name, description, color, icon) VALUES (?, ?, ?, ?)",
        ["__AUTOTEST__Productivity", "Test Productivity improvements", "#3498db", "💡"]
      );
      categoryId = categoryResult.insertId;
    } else {
      categoryId = existingCategories[0].id;
    }

    // Create test users
    const adminUser = await createTestUser(testDb, {
      username: "kvp_admin_v2",
      email: "kvp_admin_v2@test.com",
      password: "TestPass123!",
      role: "admin",
      tenant_id: tenantId,
    });
    adminUserId = adminUser.id;

    const adminLoginRes = await request(app).post("/api/v2/auth/login").send({
      email: adminUser.email,
      password: "TestPass123!",
    });
    adminToken = adminLoginRes.body.data.accessToken;

    const employeeUser = await createTestUser(testDb, {
      username: "kvp_employee_v2",
      email: "kvp_employee_v2@test.com",
      password: "TestPass123!",
      role: "employee",
      tenant_id: tenantId,
      department_id: departmentId,
    });
    employeeUserId = employeeUser.id;

    const employeeLoginRes = await request(app)
      .post("/api/v2/auth/login")
      .send({
        email: employeeUser.email,
        password: "TestPass123!",
      });
    employeeToken = employeeLoginRes.body.data.accessToken;
  });

  afterEach(async () => {
    // Clean up test data in correct order
    if (testSuggestionId) {
      await testDb.execute("DELETE FROM kvp_attachments WHERE suggestion_id = ?", [testSuggestionId]);
      await testDb.execute("DELETE FROM kvp_comments WHERE suggestion_id = ?", [testSuggestionId]);
      await testDb.execute("DELETE FROM kvp_ratings WHERE suggestion_id = ?", [testSuggestionId]);
      await testDb.execute("DELETE FROM kvp_status_history WHERE suggestion_id = ?", [testSuggestionId]);
      await testDb.execute("DELETE FROM kvp_points WHERE suggestion_id = ?", [testSuggestionId]);
      await testDb.execute("DELETE FROM kvp_suggestions WHERE id = ?", [testSuggestionId]);
    }
  });

  describe("Categories", () => {
    it("should get all categories", async () => {
      const response = await request(app)
        .get("/api/v2/kvp/categories")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toMatchObject({
        id: expect.any(Number),
        name: "__AUTOTEST__Productivity",
        color: "#3498db",
        icon: "💡",
      });
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/api/v2/kvp/categories");
      expect(response.status).toBe(401);
    });
  });

  describe("Suggestions CRUD", () => {
    describe("Create Suggestion", () => {
      it("should create a new suggestion", async () => {
        const suggestionData = {
          title: "Improve production workflow",
          description: "By implementing lean manufacturing principles, we can reduce waste and improve efficiency",
          categoryId,
          orgLevel: "department",
          orgId: departmentId,
          priority: "high",
          expectedBenefit: "20% reduction in production time",
          estimatedCost: 5000,
        };

        const response = await request(app)
          .post("/api/v2/kvp")
          .set("Authorization", `Bearer ${employeeToken}`)
          .set("Content-Type", "application/json")
          .send(suggestionData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          title: suggestionData.title,
          description: suggestionData.description,
          categoryId: suggestionData.categoryId,
          priority: suggestionData.priority,
          status: "new",
          submittedBy: employeeUserId,
        });

        testSuggestionId = response.body.data.id;
      });

      it("should validate required fields", async () => {
        const response = await request(app)
          .post("/api/v2/kvp")
          .set("Authorization", `Bearer ${employeeToken}`)
          .set("Content-Type", "application/json")
          .send({
            title: "Test",
            // Missing required fields
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("VALIDATION_ERROR");
      });
    });

    describe("List Suggestions", () => {
      beforeEach(async () => {
        // Create test suggestions
        const [result1] = await testDb.execute<ResultSetHeader>(
          `INSERT INTO kvp_suggestions (
            tenant_id, title, description, category_id, org_level, org_id, 
            submitted_by, priority, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            tenantId,
            "Employee Suggestion",
            "Test description",
            categoryId,
            "department",
            departmentId,
            employeeUserId,
            "normal",
            "new",
          ],
        );
        testSuggestionId = result1.insertId;

        // Create another suggestion by a different user
        await testDb.execute(
          `INSERT INTO kvp_suggestions (
            tenant_id, title, description, category_id, org_level, org_id, 
            submitted_by, priority, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            tenantId,
            "Admin Suggestion",
            "Admin test description",
            categoryId,
            "company",
            0,
            adminUserId,
            "high",
            "in_review",
          ],
        );

        // Create an implemented suggestion (visible to all)
        await testDb.execute(
          `INSERT INTO kvp_suggestions (
            tenant_id, title, description, category_id, org_level, org_id, 
            submitted_by, priority, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            tenantId,
            "Implemented Suggestion",
            "This was implemented",
            categoryId,
            "company",
            0,
            adminUserId,
            "high",
            "implemented",
          ],
        );
      });

      it("should list suggestions with pagination", async () => {
        const response = await request(app)
          .get("/api/v2/kvp")
          .set("Authorization", `Bearer ${adminToken}`)
          .query({ page: 1, limit: 10 });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThanOrEqual(3);
        expect(response.body.meta.pagination).toMatchObject({
          currentPage: 1,
          pageSize: 10,
          totalItems: expect.any(Number),
        });
      });

      it("should filter by status", async () => {
        const response = await request(app)
          .get("/api/v2/kvp")
          .set("Authorization", `Bearer ${adminToken}`)
          .query({ status: "new" });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.every((s: any) => s.status === "new")).toBe(true);
      });

      it("should respect employee visibility rules", async () => {
        const response = await request(app)
          .get("/api/v2/kvp")
          .set("Authorization", `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        // Employee should see their own suggestions and implemented ones
        // const statuses = response.body.data.map((s: any) => s.status);
        // const submitters = response.body.data.map((s: any) => s.submittedBy);
        
        response.body.data.forEach((suggestion: any) => {
          const isOwnSuggestion = suggestion.submittedBy === employeeUserId;
          const isImplemented = suggestion.status === "implemented";
          expect(isOwnSuggestion || isImplemented).toBe(true);
        });
      });
    });

    describe("Get Suggestion by ID", () => {
      beforeEach(async () => {
        const [result] = await testDb.execute<ResultSetHeader>(
          `INSERT INTO kvp_suggestions (
            tenant_id, title, description, category_id, org_level, org_id, 
            submitted_by, priority, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            tenantId,
            "Test Suggestion",
            "Test description",
            categoryId,
            "department",
            departmentId,
            employeeUserId,
            "normal",
            "new",
          ],
        );
        testSuggestionId = result.insertId;
      });

      it("should get suggestion details", async () => {
        const response = await request(app)
          .get(`/api/v2/kvp/${testSuggestionId}`)
          .set("Authorization", `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          id: testSuggestionId,
          title: "Test Suggestion",
          submittedBy: employeeUserId,
        });
      });

      it("should return 404 for non-existent suggestion", async () => {
        const response = await request(app)
          .get("/api/v2/kvp/99999")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("NOT_FOUND");
      });
    });

    describe("Update Suggestion", () => {
      beforeEach(async () => {
        const [result] = await testDb.execute<ResultSetHeader>(
          `INSERT INTO kvp_suggestions (
            tenant_id, title, description, category_id, org_level, org_id, 
            submitted_by, priority, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            tenantId,
            "Test Suggestion",
            "Test description",
            categoryId,
            "department",
            departmentId,
            employeeUserId,
            "normal",
            "new",
          ],
        );
        testSuggestionId = result.insertId;
      });

      it("should update own suggestion", async () => {
        const updateData = {
          title: "Updated Title",
          description: "Updated description with more details",
          priority: "high",
        };

        const response = await request(app)
          .put(`/api/v2/kvp/${testSuggestionId}`)
          .set("Authorization", `Bearer ${employeeToken}`)
          .set("Content-Type", "application/json")
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          id: testSuggestionId,
          title: updateData.title,
          description: updateData.description,
          priority: updateData.priority,
        });
      });

      it("should allow admin to update status", async () => {
        const response = await request(app)
          .put(`/api/v2/kvp/${testSuggestionId}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .set("Content-Type", "application/json")
          .send({ status: "in_review" });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe("in_review");
      });

      it("should prevent employee from updating others suggestions", async () => {
        // Create another user's suggestion
        const [result] = await testDb.execute<ResultSetHeader>(
          `INSERT INTO kvp_suggestions (
            tenant_id, title, description, category_id, org_level, org_id, 
            submitted_by, priority, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            tenantId,
            "Admin Suggestion",
            "Admin description",
            categoryId,
            "company",
            0,
            adminUserId,
            "normal",
            "new",
          ],
        );
        const adminSuggestionId = result.insertId;

        const response = await request(app)
          .put(`/api/v2/kvp/${adminSuggestionId}`)
          .set("Authorization", `Bearer ${employeeToken}`)
          .set("Content-Type", "application/json")
          .send({ title: "Trying to update" });

        // Employee can't see admin's suggestion, so gets 404 instead of 403
        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("NOT_FOUND");
      });
    });

    describe("Delete Suggestion", () => {
      it("should delete own suggestion", async () => {
        // Create a suggestion
        const [result] = await testDb.execute<ResultSetHeader>(
          `INSERT INTO kvp_suggestions (
            tenant_id, title, description, category_id, org_level, org_id, 
            submitted_by, priority, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            tenantId,
            "To Delete",
            "Will be deleted",
            categoryId,
            "department",
            departmentId,
            employeeUserId,
            "normal",
            "new",
          ],
        );
        const deleteId = result.insertId;

        const response = await request(app)
          .delete(`/api/v2/kvp/${deleteId}`)
          .set("Authorization", `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        // Verify deletion
        const [rows] = await testDb.execute<any[]>(
          "SELECT * FROM kvp_suggestions WHERE id = ?",
          [deleteId],
        );
        expect(rows.length).toBe(0);
      });
    });
  });

  describe("Comments", () => {
    beforeEach(async () => {
      const [result] = await testDb.execute<ResultSetHeader>(
        `INSERT INTO kvp_suggestions (
          tenant_id, title, description, category_id, org_level, org_id, 
          submitted_by, priority, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          tenantId,
          "Test Suggestion",
          "Test description",
          categoryId,
          "department",
          departmentId,
          employeeUserId,
          "normal",
          "new",
        ],
      );
      testSuggestionId = result.insertId;
    });

    it("should add comment to suggestion", async () => {
      const commentData = {
        comment: "This is a great idea! We should definitely implement this.",
        isInternal: false,
      };

      const response = await request(app)
        .post(`/api/v2/kvp/${testSuggestionId}/comments`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send(commentData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        comment: commentData.comment,
        isInternal: false,
      });
    });

    it("should get comments for suggestion", async () => {
      // Add some comments first
      await testDb.execute(
        `INSERT INTO kvp_comments (tenant_id, suggestion_id, user_id, comment, is_internal)
         VALUES (?, ?, ?, ?, ?)`,
        [tenantId, testSuggestionId, adminUserId, "Admin comment", false],
      );
      await testDb.execute(
        `INSERT INTO kvp_comments (tenant_id, suggestion_id, user_id, comment, is_internal)
         VALUES (?, ?, ?, ?, ?)`,
        [tenantId, testSuggestionId, adminUserId, "Internal note", true],
      );

      const response = await request(app)
        .get(`/api/v2/kvp/${testSuggestionId}/comments`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);
    });

    it("should hide internal comments from employees", async () => {
      // Add internal comment
      await testDb.execute(
        `INSERT INTO kvp_comments (tenant_id, suggestion_id, user_id, comment, is_internal)
         VALUES (?, ?, ?, ?, ?)`,
        [tenantId, testSuggestionId, adminUserId, "Internal admin note", true],
      );
      await testDb.execute(
        `INSERT INTO kvp_comments (tenant_id, suggestion_id, user_id, comment, is_internal)
         VALUES (?, ?, ?, ?, ?)`,
        [tenantId, testSuggestionId, adminUserId, "Public comment", false],
      );

      const response = await request(app)
        .get(`/api/v2/kvp/${testSuggestionId}/comments`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].comment).toBe("Public comment");
    });
  });

  describe("Dashboard Statistics", () => {
    beforeEach(async () => {
      // Create various suggestions
      await testDb.execute(
        `INSERT INTO kvp_suggestions (
          tenant_id, title, description, category_id, org_level, org_id, 
          submitted_by, priority, status, actual_savings, created_at, updated_at
        ) VALUES 
        (?, 'New 1', 'Desc', ?, 'company', 0, ?, 'normal', 'new', NULL, NOW(), NOW()),
        (?, 'New 2', 'Desc', ?, 'company', 0, ?, 'normal', 'new', NULL, NOW(), NOW()),
        (?, 'In Review', 'Desc', ?, 'company', 0, ?, 'high', 'in_review', NULL, NOW(), NOW()),
        (?, 'Implemented 1', 'Desc', ?, 'company', 0, ?, 'high', 'implemented', 10000, NOW(), NOW()),
        (?, 'Implemented 2', 'Desc', ?, 'company', 0, ?, 'normal', 'implemented', 5000, NOW(), NOW()),
        (?, 'Rejected', 'Desc', ?, 'company', 0, ?, 'low', 'rejected', NULL, NOW(), NOW())`,
        [
          tenantId, categoryId, adminUserId,
          tenantId, categoryId, adminUserId,
          tenantId, categoryId, adminUserId,
          tenantId, categoryId, adminUserId,
          tenantId, categoryId, adminUserId,
          tenantId, categoryId, adminUserId,
        ],
      );
    });

    it("should get dashboard statistics", async () => {
      const response = await request(app)
        .get("/api/v2/kvp/dashboard/stats")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        totalSuggestions: 6,
        newSuggestions: 2,
        inProgress: 1,
        implemented: 2,
        rejected: 1,
        avgSavings: 7500, // (10000 + 5000) / 2
      });
    });
  });

  describe("Points System", () => {
    beforeEach(async () => {
      const [result] = await testDb.execute<ResultSetHeader>(
        `INSERT INTO kvp_suggestions (
          tenant_id, title, description, category_id, org_level, org_id, 
          submitted_by, priority, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          tenantId,
          "Test Suggestion",
          "Test description",
          categoryId,
          "department",
          departmentId,
          employeeUserId,
          "normal",
          "implemented",
        ],
      );
      testSuggestionId = result.insertId;
    });

    it("should award points to user (admin only)", async () => {
      const pointsData = {
        userId: employeeUserId,
        suggestionId: testSuggestionId,
        points: 100,
        reason: "Excellent suggestion that saved company resources",
      };

      const response = await request(app)
        .post("/api/v2/kvp/points/award")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send(pointsData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        userId: employeeUserId,
        points: 100,
        reason: pointsData.reason,
      });
    });

    it("should prevent employees from awarding points", async () => {
      const pointsData = {
        userId: adminUserId,
        suggestionId: testSuggestionId,
        points: 50,
        reason: "Test",
      };

      const response = await request(app)
        .post("/api/v2/kvp/points/award")
        .set("Authorization", `Bearer ${employeeToken}`)
        .set("Content-Type", "application/json")
        .send(pointsData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("should get user points summary", async () => {
      // Award some points first
      await testDb.execute(
        `INSERT INTO kvp_points (tenant_id, user_id, suggestion_id, points, reason, awarded_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [tenantId, employeeUserId, testSuggestionId, 100, "submission", adminUserId],
      );

      const response = await request(app)
        .get(`/api/v2/kvp/points/user/${employeeUserId}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        totalPoints: 100,
        totalAwards: 1,
        suggestionsAwarded: 1,
      });
    });

    it("should allow users to see only their own points", async () => {
      const response = await request(app)
        .get(`/api/v2/kvp/points/user/${adminUserId}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe("Attachments", () => {
    beforeEach(async () => {
      const [result] = await testDb.execute<ResultSetHeader>(
        `INSERT INTO kvp_suggestions (
          tenant_id, title, description, category_id, org_level, org_id, 
          submitted_by, priority, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          tenantId,
          "Test Suggestion",
          "Test description",
          categoryId,
          "department",
          departmentId,
          employeeUserId,
          "normal",
          "new",
        ],
      );
      testSuggestionId = result.insertId;
    });

    it("should get attachments for suggestion", async () => {
      const response = await request(app)
        .get(`/api/v2/kvp/${testSuggestionId}/attachments`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    // Note: File upload tests would require mocking multer or using actual test files
  });
});