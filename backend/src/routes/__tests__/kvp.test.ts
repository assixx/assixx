/**
 * API Tests for KVP (Kontinuierlicher Verbesserungsprozess) Endpoints
 * Tests suggestion submission, review workflow, and multi-tenant isolation
 */

import request from "supertest";
import { Pool } from "mysql2/promise";
import app from "../../app";
import {
  createTestDatabase,
  cleanupTestData,
  createTestTenant,
  createTestUser,
  createTestDepartment,
  createTestTeam,
  getAuthToken,
} from "../mocks/database";
import { asTestRows } from "../../__tests__/mocks/db-types";

describe("KVP API Endpoints", () => {
  let testDb: Pool;
  let tenant1Id: number;
  let tenant2Id: number;
  let dept1Id: number;
  let dept2Id: number;
  let team1Id: number;
  let adminToken1: string;
  let adminToken2: string;
  let employeeToken1: string;
  let employeeToken2: string;
  let adminUser1: any;
  let employeeUser1: any;
  let employeeUser2: any;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = "test-secret-key-for-kvp-tests";

    // Create test tenants
    tenant1Id = await createTestTenant(
      testDb,
      "kvptest1",
      "KVP Test Company 1",
    );
    tenant2Id = await createTestTenant(
      testDb,
      "kvptest2",
      "KVP Test Company 2",
    );

    // Create departments and teams
    dept1Id = await createTestDepartment(testDb, tenant1Id, "Production");
    dept2Id = await createTestDepartment(testDb, tenant1Id, "Quality");
    team1Id = await createTestTeam(
      testDb,
      tenant1Id,
      dept1Id,
      "Production Team A",
    );

    // Create test users
    adminUser1 = await createTestUser(testDb, {
      username: "kvpadmin1",
      email: "admin1@kvptest1.de",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenant1Id,
      first_name: "Admin",
      last_name: "One",
    });

    await createTestUser(testDb, {
      username: "kvpadmin2",
      email: "admin2@kvptest2.de",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenant2Id,
      first_name: "Admin",
      last_name: "Two",
    });

    employeeUser1 = await createTestUser(testDb, {
      username: "kvpemployee1",
      email: "employee1@kvptest1.de",
      password: "EmpPass123!",
      role: "employee",
      tenant_id: tenant1Id,
      department_id: dept1Id,
      team_id: team1Id,
      first_name: "Employee",
      last_name: "One",
    });

    employeeUser2 = await createTestUser(testDb, {
      username: "kvpemployee2",
      email: "employee2@kvptest1.de",
      password: "EmpPass123!",
      role: "employee",
      tenant_id: tenant1Id,
      department_id: dept2Id,
      first_name: "Employee",
      last_name: "Two",
    });

    // Get auth tokens
    adminToken1 = await getAuthToken(app, "kvpadmin1", "AdminPass123!");
    adminToken2 = await getAuthToken(app, "kvpadmin2", "AdminPass123!");
    employeeToken1 = await getAuthToken(app, "kvpemployee1", "EmpPass123!");
    employeeToken2 = await getAuthToken(app, "kvpemployee2", "EmpPass123!");
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Clear KVP tables before each test
    await testDb.execute("DELETE FROM kvp_suggestions WHERE tenant_id > 1");
    await testDb.execute("DELETE FROM kvp_comments WHERE tenant_id > 1");
    await testDb.execute("DELETE FROM kvp_votes WHERE tenant_id > 1");
    await testDb.execute("DELETE FROM kvp_attachments WHERE tenant_id > 1");
  });

  describe("POST /api/kvp/suggestions", () => {
    const validSuggestionData = {
      title: "Produktionsprozess verbessern",
      description:
        "Wir könnten die Durchlaufzeit um 20% reduzieren, wenn wir...",
      category: "process_improvement",
      department_id: null,
      expected_benefit: "Zeit- und Kostenersparnis",
      implementation_effort: "medium",
      is_anonymous: false,
    };

    it("should create suggestion for employee", async () => {
      const response = await request(app)
        .post("/api/kvp/suggestions")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send(validSuggestionData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("erfolgreich eingereicht"),
      });
      expect(response.body.data.suggestionId).toBeDefined();

      // Verify suggestion was created
      const [rows] = await testDb.execute(
        "SELECT * FROM kvp_suggestions WHERE id = ?",
        [response.body.data.suggestionId],
      );
      const suggestions = asTestRows<unknown>(rows);
      expect(suggestions[0]).toMatchObject({
        title: validSuggestionData.title,
        description: validSuggestionData.description,
        category: validSuggestionData.category,
        status: "submitted",
        tenant_id: tenant1Id,
        submitted_by: employeeUser1.id,
      });
    });

    it("should create anonymous suggestion", async () => {
      const anonymousSuggestion = {
        ...validSuggestionData,
        is_anonymous: true,
      };

      const response = await request(app)
        .post("/api/kvp/suggestions")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send(anonymousSuggestion);

      expect(response.status).toBe(201);

      // Verify anonymity
      const [rows] = await testDb.execute(
        "SELECT * FROM kvp_suggestions WHERE id = ?",
        [response.body.data.suggestionId],
      );
      const suggestions = asTestRows<unknown>(rows);
      expect(suggestions[0].submitted_by).toBe(employeeUser1.id); // Still tracked internally
      expect(suggestions[0].is_anonymous).toBe(1);
    });

    it("should create department-specific suggestion", async () => {
      const deptSuggestion = {
        ...validSuggestionData,
        department_id: dept1Id,
        visibility: "department",
      };

      const response = await request(app)
        .post("/api/kvp/suggestions")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send(deptSuggestion);

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute(
        "SELECT department_id, visibility FROM kvp_suggestions WHERE id = ?",
        [response.body.data.suggestionId],
      );
      const suggestions = asTestRows<unknown>(rows);
      expect(suggestions[0].department_id).toBe(dept1Id);
      expect(suggestions[0].visibility).toBe("department");
    });

    it("should handle file attachments", async () => {
      const response = await request(app)
        .post("/api/kvp/suggestions")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .field("title", validSuggestionData.title)
        .field("description", validSuggestionData.description)
        .field("category", validSuggestionData.category)
        .field("expected_benefit", validSuggestionData.expected_benefit)
        .field(
          "implementation_effort",
          validSuggestionData.implementation_effort,
        )
        .attach(
          "attachments",
          Buffer.from("test-diagram"),
          "process-diagram.pdf",
        )
        .attach(
          "attachments",
          Buffer.from("test-calc"),
          "roi-calculation.xlsx",
        );

      expect(response.status).toBe(201);

      // Verify attachments were saved
      const [rows] = await testDb.execute(
        "SELECT * FROM kvp_attachments WHERE suggestion_id = ?",
        [response.body.data.suggestionId],
      );
      const attachments = asTestRows<unknown>(rows);
      expect(attachments.length).toBe(2);
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/kvp/suggestions")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          title: "",
          description: "",
          category: "invalid",
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "title" }),
          expect.objectContaining({ path: "description" }),
          expect.objectContaining({ path: "category" }),
        ]),
      );
    });

    it("should validate category values", async () => {
      const validCategories = [
        "process_improvement",
        "cost_reduction",
        "quality_improvement",
        "safety",
        "environment",
        "innovation",
        "other",
      ];

      for (const category of validCategories) {
        const response = await request(app)
          .post("/api/kvp/suggestions")
          .set("Authorization", `Bearer ${employeeToken1}`)
          .send({
            ...validSuggestionData,
            category,
            title: `Test ${category}`,
          });

        expect(response.status).toBe(201);
      }
    });

    it("should set initial status as submitted", async () => {
      const response = await request(app)
        .post("/api/kvp/suggestions")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send(validSuggestionData);

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute(
        "SELECT status FROM kvp_suggestions WHERE id = ?",
        [response.body.data.suggestionId],
      );
      const suggestions = asTestRows<unknown>(rows);
      expect(suggestions[0].status).toBe("submitted");
    });

    it("should award points for submission", async () => {
      const response = await request(app)
        .post("/api/kvp/suggestions")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send(validSuggestionData);

      expect(response.status).toBe(201);

      // Check if points were awarded
      const [rows] = await testDb.execute(
        "SELECT points FROM kvp_user_points WHERE user_id = ? AND tenant_id = ?",
        [employeeUser1.id, tenant1Id],
      );
      const points = asTestRows<unknown>(rows);
      expect(points[0]?.points).toBeGreaterThan(0);
    });

    it("should set tenant_id from token", async () => {
      const response = await request(app)
        .post("/api/kvp/suggestions")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          ...validSuggestionData,
          tenant_id: 999, // Should be ignored
        });

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute(
        "SELECT tenant_id FROM kvp_suggestions WHERE id = ?",
        [response.body.data.suggestionId],
      );
      const suggestions = asTestRows<unknown>(rows);
      expect(suggestions[0].tenant_id).toBe(tenant1Id);
    });
  });

  describe("GET /api/kvp/suggestions", () => {
    let publicSuggestionId: number;
    let dept1SuggestionId: number;
    let dept2SuggestionId: number;
    let anonymousSuggestionId: number;

    beforeEach(async () => {
      // Create test suggestions with different visibility
      const [rows] = await testDb.execute(
        `INSERT INTO kvp_suggestions 
        (title, description, category, status, visibility, submitted_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Public Process Improvement",
          "Description",
          "process_improvement",
          "submitted",
          "public",
          employeeUser1.id,
          tenant1Id,
        ],
      );
      const result1 = asTestRows<unknown>(rows);
      publicSuggestionId = (result1 as any).insertId;

      const [rows2] = await testDb.execute(
        `INSERT INTO kvp_suggestions 
        (title, description, category, status, visibility, department_id, submitted_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Production Improvement",
          "Description",
          "cost_reduction",
          "in_review",
          "department",
          dept1Id,
          employeeUser1.id,
          tenant1Id,
        ],
      );
      const result2 = asTestRows<unknown>(rows2);
      dept1SuggestionId = (result2 as any).insertId;

      const [rows3] = await testDb.execute(
        `INSERT INTO kvp_suggestions 
        (title, description, category, status, visibility, department_id, submitted_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Quality Improvement",
          "Description",
          "quality_improvement",
          "approved",
          "department",
          dept2Id,
          employeeUser2.id,
          tenant1Id,
        ],
      );
      const result3 = asTestRows<unknown>(rows3);
      dept2SuggestionId = (result3 as any).insertId;

      const [rows4] = await testDb.execute(
        `INSERT INTO kvp_suggestions 
        (title, description, category, status, visibility, submitted_by, is_anonymous, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Anonymous Suggestion",
          "Description",
          "safety",
          "submitted",
          "public",
          employeeUser1.id,
          1,
          tenant1Id,
        ],
      );
      const result4 = asTestRows<unknown>(rows4);
      anonymousSuggestionId = (result4 as any).insertId;
    });

    it("should list suggestions based on user visibility", async () => {
      // Admin should see all suggestions
      const adminResponse = await request(app)
        .get("/api/kvp/suggestions")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(adminResponse.status).toBe(200);
      expect(adminResponse.body.data.suggestions.length).toBe(4);

      // Employee1 (dept1) should see public + dept1
      const emp1Response = await request(app)
        .get("/api/kvp/suggestions")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(emp1Response.status).toBe(200);
      expect(emp1Response.body.data.suggestions.length).toBe(3);
      const emp1Ids = emp1Response.body.data.suggestions.map((s) => s.id);
      expect(emp1Ids).toContain(publicSuggestionId);
      expect(emp1Ids).toContain(dept1SuggestionId);
      expect(emp1Ids).toContain(anonymousSuggestionId);
      expect(emp1Ids).not.toContain(dept2SuggestionId);

      // Employee2 (dept2) should see public + dept2
      const emp2Response = await request(app)
        .get("/api/kvp/suggestions")
        .set("Authorization", `Bearer ${employeeToken2}`);

      expect(emp2Response.status).toBe(200);
      expect(emp2Response.body.data.suggestions.length).toBe(3);
    });

    it("should hide submitter info for anonymous suggestions", async () => {
      const response = await request(app)
        .get("/api/kvp/suggestions")
        .set("Authorization", `Bearer ${employeeToken2}`);

      expect(response.status).toBe(200);
      const anonymousSugg = response.body.data.suggestions.find(
        (s) => s.id === anonymousSuggestionId,
      );
      expect(anonymousSugg.submitter_name).toBe("Anonym");
      expect(anonymousSugg.submitted_by).toBeUndefined();
    });

    it("should filter by status", async () => {
      const response = await request(app)
        .get("/api/kvp/suggestions?status=submitted")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const suggestions = response.body.data.suggestions;
      expect(suggestions.every((s) => s.status === "submitted")).toBe(true);
    });

    it("should filter by category", async () => {
      const response = await request(app)
        .get("/api/kvp/suggestions?category=process_improvement")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const suggestions = response.body.data.suggestions;
      expect(
        suggestions.every((s) => s.category === "process_improvement"),
      ).toBe(true);
    });

    it("should filter by department", async () => {
      const response = await request(app)
        .get(`/api/kvp/suggestions?department_id=${dept1Id}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const suggestions = response.body.data.suggestions;
      expect(suggestions.some((s) => s.id === dept1SuggestionId)).toBe(true);
    });

    it("should sort suggestions", async () => {
      const response = await request(app)
        .get("/api/kvp/suggestions?sort=created_at&order=desc")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const suggestions = response.body.data.suggestions;
      // Verify descending order
      for (let i = 1; i < suggestions.length; i++) {
        expect(
          new Date(suggestions[i - 1].created_at).getTime(),
        ).toBeGreaterThanOrEqual(new Date(suggestions[i].created_at).getTime());
      }
    });

    it("should paginate results", async () => {
      const response = await request(app)
        .get("/api/kvp/suggestions?page=1&limit=2")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.suggestions.length).toBe(2);
      expect(response.body.data.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 4,
        totalPages: 2,
      });
    });

    it("should include vote count", async () => {
      // Add some votes
      await testDb.execute(
        "INSERT INTO kvp_votes (suggestion_id, user_id, vote_type, tenant_id) VALUES (?, ?, ?, ?)",
        [publicSuggestionId, employeeUser1.id, "up", tenant1Id],
      );
      await testDb.execute(
        "INSERT INTO kvp_votes (suggestion_id, user_id, vote_type, tenant_id) VALUES (?, ?, ?, ?)",
        [publicSuggestionId, employeeUser2.id, "up", tenant1Id],
      );

      const response = await request(app)
        .get("/api/kvp/suggestions")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const publicSugg = response.body.data.suggestions.find(
        (s) => s.id === publicSuggestionId,
      );
      expect(publicSugg.vote_count).toBe(2);
    });

    it("should enforce tenant isolation", async () => {
      // Create suggestion in tenant2
      await testDb.execute(
        `INSERT INTO kvp_suggestions 
        (title, description, category, status, submitted_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "Tenant2 Suggestion",
          "Should not be visible",
          "other",
          "submitted",
          1,
          tenant2Id,
        ],
      );

      const response = await request(app)
        .get("/api/kvp/suggestions")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const suggestions = response.body.data.suggestions;
      expect(suggestions.every((s) => s.tenant_id === tenant1Id)).toBe(true);
    });

    it("should show only own suggestions when filtered", async () => {
      const response = await request(app)
        .get("/api/kvp/suggestions?my_suggestions=true")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      const suggestions = response.body.data.suggestions;
      // Should include both regular and anonymous suggestions by user1
      expect(suggestions.length).toBe(2);
    });
  });

  describe("GET /api/kvp/suggestions/:id", () => {
    let suggestionId: number;

    beforeEach(async () => {
      const [rows] = await testDb.execute(
        `INSERT INTO kvp_suggestions 
        (title, description, category, status, submitted_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "Test Suggestion",
          "Detailed description",
          "innovation",
          "submitted",
          employeeUser1.id,
          tenant1Id,
        ],
      );
      const result = asTestRows<unknown>(rows);
      suggestionId = (result as any).insertId;
    });

    it("should get suggestion details", async () => {
      const response = await request(app)
        .get(`/api/kvp/suggestions/${suggestionId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: suggestionId,
        title: "Test Suggestion",
        description: "Detailed description",
        category: "innovation",
        status: "submitted",
        submitter: expect.objectContaining({
          id: employeeUser1.id,
          first_name: "Employee",
          last_name: "One",
        }),
      });
    });

    it("should include comments", async () => {
      // Add comments
      await testDb.execute(
        `INSERT INTO kvp_comments 
        (suggestion_id, user_id, comment, tenant_id) 
        VALUES (?, ?, ?, ?)`,
        [suggestionId, adminUser1.id, "Great idea!", tenant1Id],
      );

      const response = await request(app)
        .get(`/api/kvp/suggestions/${suggestionId}?include=comments`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.comments).toHaveLength(1);
      expect(response.body.data.comments[0]).toMatchObject({
        comment: "Great idea!",
        user: expect.objectContaining({
          first_name: "Admin",
        }),
      });
    });

    it("should include attachments", async () => {
      // Add attachment
      await testDb.execute(
        `INSERT INTO kvp_attachments 
        (suggestion_id, filename, file_path, file_size, mime_type, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          suggestionId,
          "diagram.pdf",
          "/uploads/kvp/diagram.pdf",
          1024,
          "application/pdf",
          tenant1Id,
        ],
      );

      const response = await request(app)
        .get(`/api/kvp/suggestions/${suggestionId}?include=attachments`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.attachments).toHaveLength(1);
      expect(response.body.data.attachments[0].filename).toBe("diagram.pdf");
    });

    it("should hide submitter for anonymous suggestion", async () => {
      // Create anonymous suggestion
      const [rows] = await testDb.execute(
        `INSERT INTO kvp_suggestions 
        (title, description, category, status, submitted_by, is_anonymous, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Anonymous",
          "Description",
          "other",
          "submitted",
          employeeUser1.id,
          1,
          tenant1Id,
        ],
      );
      const result = asTestRows<unknown>(rows);
      const anonId = (result as any).insertId;

      const response = await request(app)
        .get(`/api/kvp/suggestions/${anonId}`)
        .set("Authorization", `Bearer ${employeeToken2}`);

      expect(response.status).toBe(200);
      expect(response.body.data.submitter).toBeNull();
      expect(response.body.data.is_anonymous).toBe(true);
    });

    it("should return 404 for non-existent suggestion", async () => {
      const response = await request(app)
        .get("/api/kvp/suggestions/99999")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(404);
    });

    it("should enforce visibility rules", async () => {
      // Create department-specific suggestion
      const [rows] = await testDb.execute(
        `INSERT INTO kvp_suggestions 
        (title, description, category, status, visibility, department_id, submitted_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Dept2 Only",
          "Secret",
          "other",
          "submitted",
          "department",
          dept2Id,
          employeeUser2.id,
          tenant1Id,
        ],
      );
      const result = asTestRows<unknown>(rows);
      const deptSuggestionId = (result as any).insertId;

      // Employee1 (dept1) should not see dept2 suggestion
      const response = await request(app)
        .get(`/api/kvp/suggestions/${deptSuggestionId}`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(404);
    });

    it("should enforce tenant isolation", async () => {
      const response = await request(app)
        .get(`/api/kvp/suggestions/${suggestionId}`)
        .set("Authorization", `Bearer ${adminToken2}`);

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /api/kvp/suggestions/:id", () => {
    let suggestionId: number;

    beforeEach(async () => {
      const [rows] = await testDb.execute(
        `INSERT INTO kvp_suggestions 
        (title, description, category, status, submitted_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "Original Title",
          "Original description",
          "other",
          "submitted",
          employeeUser1.id,
          tenant1Id,
        ],
      );
      const result = asTestRows<unknown>(rows);
      suggestionId = (result as any).insertId;
    });

    it("should update suggestion for submitter", async () => {
      const updateData = {
        title: "Updated Title",
        description: "Updated description",
        expected_benefit: "New benefit description",
      };

      const response = await request(app)
        .put(`/api/kvp/suggestions/${suggestionId}`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("aktualisiert");

      // Verify update
      const [rows] = await testDb.execute(
        "SELECT title, description, expected_benefit FROM kvp_suggestions WHERE id = ?",
        [suggestionId],
      );
      const suggestions = asTestRows<unknown>(rows);
      expect(suggestions[0]).toMatchObject(updateData);
    });

    it("should prevent updates after review started", async () => {
      // Update status to in_review
      await testDb.execute(
        "UPDATE kvp_suggestions SET status = 'in_review' WHERE id = ?",
        [suggestionId],
      );

      const response = await request(app)
        .put(`/api/kvp/suggestions/${suggestionId}`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ title: "Too late" });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("bereits in Prüfung");
    });

    it("should allow admin to update any suggestion", async () => {
      const response = await request(app)
        .put(`/api/kvp/suggestions/${suggestionId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          implementation_effort: "high",
          admin_notes: "Needs further analysis",
        });

      expect(response.status).toBe(200);
    });

    it("should prevent non-submitter from updating", async () => {
      const response = await request(app)
        .put(`/api/kvp/suggestions/${suggestionId}`)
        .set("Authorization", `Bearer ${employeeToken2}`)
        .send({ title: "Unauthorized" });

      expect(response.status).toBe(403);
    });

    it("should validate update data", async () => {
      const response = await request(app)
        .put(`/api/kvp/suggestions/${suggestionId}`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          title: "", // Empty title
          category: "invalid_category",
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it("should enforce tenant isolation on update", async () => {
      const response = await request(app)
        .put(`/api/kvp/suggestions/${suggestionId}`)
        .set("Authorization", `Bearer ${adminToken2}`)
        .send({ title: "Cross-tenant update" });

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /api/kvp/suggestions/:id/status", () => {
    let suggestionId: number;

    beforeEach(async () => {
      const [rows] = await testDb.execute(
        `INSERT INTO kvp_suggestions 
        (title, description, category, status, submitted_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "Status Test",
          "Description",
          "process_improvement",
          "submitted",
          employeeUser1.id,
          tenant1Id,
        ],
      );
      const result = asTestRows<unknown>(rows);
      suggestionId = (result as any).insertId;
    });

    it("should update status for admin", async () => {
      const response = await request(app)
        .put(`/api/kvp/suggestions/${suggestionId}/status`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          status: "in_review",
          reason: "Starting evaluation process",
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("Status aktualisiert");

      // Verify status update
      const [rows] = await testDb.execute(
        "SELECT status FROM kvp_suggestions WHERE id = ?",
        [suggestionId],
      );
      const suggestions = asTestRows<unknown>(rows);
      expect(suggestions[0].status).toBe("in_review");

      // Verify status history
      const [historyRows] = await testDb.execute(
        "SELECT * FROM kvp_status_history WHERE suggestion_id = ?",
        [suggestionId],
      );
      const history = asTestRows<unknown>(historyRows);
      expect(history[0]).toMatchObject({
        old_status: "submitted",
        new_status: "in_review",
        reason: "Starting evaluation process",
        changed_by: adminUser1.id,
      });
    });

    it("should validate status transitions", async () => {
      // Invalid transition: submitted -> implemented
      const response = await request(app)
        .put(`/api/kvp/suggestions/${suggestionId}/status`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({ status: "implemented" });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Ungültiger Status-Übergang");
    });

    it("should award points on approval", async () => {
      // First move to in_review
      await request(app)
        .put(`/api/kvp/suggestions/${suggestionId}/status`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({ status: "in_review" });

      // Then approve
      const response = await request(app)
        .put(`/api/kvp/suggestions/${suggestionId}/status`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          status: "approved",
          reason: "Excellent idea!",
          points_awarded: 100,
        });

      expect(response.status).toBe(200);

      // Check points
      const [rows] = await testDb.execute(
        "SELECT SUM(points) as total FROM kvp_user_points WHERE user_id = ? AND tenant_id = ?",
        [employeeUser1.id, tenant1Id],
      );
      const points = asTestRows<unknown>(rows);
      expect(points[0].total).toBeGreaterThanOrEqual(100);
    });

    it("should notify submitter on status change", async () => {
      const response = await request(app)
        .put(`/api/kvp/suggestions/${suggestionId}/status`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          status: "rejected",
          reason: "Not feasible at this time",
        });

      expect(response.status).toBe(200);

      // Check notification was created
      const [rows] = await testDb.execute(
        "SELECT * FROM notifications WHERE user_id = ? AND type = 'kvp_status_change'",
        [employeeUser1.id],
      );
      const notifications = asTestRows<unknown>(rows);
      expect(notifications.length).toBeGreaterThan(0);
    });

    it("should deny status change for non-admin", async () => {
      const response = await request(app)
        .put(`/api/kvp/suggestions/${suggestionId}/status`)
        .set("Authorization", `Bearer ${employeeToken2}`)
        .send({ status: "approved" });

      expect(response.status).toBe(403);
    });
  });

  describe("POST /api/kvp/suggestions/:id/comments", () => {
    let suggestionId: number;

    beforeEach(async () => {
      const [rows] = await testDb.execute(
        `INSERT INTO kvp_suggestions 
        (title, description, category, status, submitted_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "Comment Test",
          "Description",
          "safety",
          "in_review",
          employeeUser1.id,
          tenant1Id,
        ],
      );
      const result = asTestRows<unknown>(rows);
      suggestionId = (result as any).insertId;
    });

    it("should add comment to suggestion", async () => {
      const response = await request(app)
        .post(`/api/kvp/suggestions/${suggestionId}/comments`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          comment:
            "This is a great idea! We should consider the implementation costs.",
          is_internal: false,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.commentId).toBeDefined();

      // Verify comment was created
      const [rows] = await testDb.execute(
        "SELECT * FROM kvp_comments WHERE id = ?",
        [response.body.data.commentId],
      );
      const comments = asTestRows<unknown>(rows);
      expect(comments[0]).toMatchObject({
        suggestion_id: suggestionId,
        user_id: adminUser1.id,
        comment:
          "This is a great idea! We should consider the implementation costs.",
        is_internal: 0,
      });
    });

    it("should add internal comment (admin only)", async () => {
      const response = await request(app)
        .post(`/api/kvp/suggestions/${suggestionId}/comments`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          comment: "Internal note: Budget approval needed",
          is_internal: true,
        });

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute(
        "SELECT is_internal FROM kvp_comments WHERE id = ?",
        [response.body.data.commentId],
      );
      const comments = asTestRows<unknown>(rows);
      expect(comments[0].is_internal).toBe(1);
    });

    it("should deny internal comments from non-admin", async () => {
      const response = await request(app)
        .post(`/api/kvp/suggestions/${suggestionId}/comments`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          comment: "Trying internal",
          is_internal: true,
        });

      expect(response.status).toBe(403);
    });

    it("should notify participants on new comment", async () => {
      // Add another comment first
      await testDb.execute(
        "INSERT INTO kvp_comments (suggestion_id, user_id, comment, tenant_id) VALUES (?, ?, ?, ?)",
        [suggestionId, employeeUser2.id, "Previous comment", tenant1Id],
      );

      const response = await request(app)
        .post(`/api/kvp/suggestions/${suggestionId}/comments`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({ comment: "New reply" });

      expect(response.status).toBe(201);

      // Check notifications
      const [rows] = await testDb.execute(
        "SELECT * FROM notifications WHERE type = 'kvp_new_comment' AND user_id IN (?, ?)",
        [employeeUser1.id, employeeUser2.id],
      );
      const notifications = asTestRows<unknown>(rows);
      expect(notifications.length).toBeGreaterThan(0);
    });

    it("should validate comment content", async () => {
      const response = await request(app)
        .post(`/api/kvp/suggestions/${suggestionId}/comments`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({ comment: "" });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "comment" })]),
      );
    });

    it("should enforce visibility rules", async () => {
      // Create department-specific suggestion
      const [rows] = await testDb.execute(
        `INSERT INTO kvp_suggestions 
        (title, description, category, status, visibility, department_id, submitted_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Dept Only",
          "Description",
          "other",
          "submitted",
          "department",
          dept2Id,
          employeeUser2.id,
          tenant1Id,
        ],
      );
      const result = asTestRows<unknown>(rows);
      const deptSuggestionId = (result as any).insertId;

      // Employee1 (dept1) should not be able to comment on dept2 suggestion
      const response = await request(app)
        .post(`/api/kvp/suggestions/${deptSuggestionId}/comments`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ comment: "Should fail" });

      expect(response.status).toBe(404);
    });
  });

  describe("POST /api/kvp/suggestions/:id/vote", () => {
    let suggestionId: number;

    beforeEach(async () => {
      const [rows] = await testDb.execute(
        `INSERT INTO kvp_suggestions 
        (title, description, category, status, submitted_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "Vote Test",
          "Description",
          "innovation",
          "in_review",
          employeeUser2.id,
          tenant1Id,
        ],
      );
      const result = asTestRows<unknown>(rows);
      suggestionId = (result as any).insertId;
    });

    it("should upvote suggestion", async () => {
      const response = await request(app)
        .post(`/api/kvp/suggestions/${suggestionId}/vote`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ vote_type: "up" });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("Stimme abgegeben");

      // Verify vote
      const [rows] = await testDb.execute(
        "SELECT * FROM kvp_votes WHERE suggestion_id = ? AND user_id = ?",
        [suggestionId, employeeUser1.id],
      );
      const votes = asTestRows<unknown>(rows);
      expect(votes[0].vote_type).toBe("up");
    });

    it("should downvote suggestion", async () => {
      const response = await request(app)
        .post(`/api/kvp/suggestions/${suggestionId}/vote`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ vote_type: "down" });

      expect(response.status).toBe(200);

      const [rows] = await testDb.execute(
        "SELECT vote_type FROM kvp_votes WHERE suggestion_id = ? AND user_id = ?",
        [suggestionId, employeeUser1.id],
      );
      const votes = asTestRows<unknown>(rows);
      expect(votes[0].vote_type).toBe("down");
    });

    it("should update existing vote", async () => {
      // First vote up
      await request(app)
        .post(`/api/kvp/suggestions/${suggestionId}/vote`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ vote_type: "up" });

      // Change to down
      const response = await request(app)
        .post(`/api/kvp/suggestions/${suggestionId}/vote`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ vote_type: "down" });

      expect(response.status).toBe(200);

      const [rows] = await testDb.execute(
        "SELECT COUNT(*) as count FROM kvp_votes WHERE suggestion_id = ? AND user_id = ?",
        [suggestionId, employeeUser1.id],
      );
      const votes = asTestRows<unknown>(rows);
      expect(votes[0].count).toBe(1); // Should update, not create new

      const [rows] = await testDb.execute(
        "SELECT vote_type FROM kvp_votes WHERE suggestion_id = ? AND user_id = ?",
        [suggestionId, employeeUser1.id],
      );
      const voteType = asTestRows<unknown>(rows);
      expect(voteType[0].vote_type).toBe("down");
    });

    it("should remove vote when voting neutral", async () => {
      // First vote
      await request(app)
        .post(`/api/kvp/suggestions/${suggestionId}/vote`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ vote_type: "up" });

      // Remove vote
      const response = await request(app)
        .post(`/api/kvp/suggestions/${suggestionId}/vote`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ vote_type: "neutral" });

      expect(response.status).toBe(200);

      const [rows] = await testDb.execute(
        "SELECT COUNT(*) as count FROM kvp_votes WHERE suggestion_id = ? AND user_id = ?",
        [suggestionId, employeeUser1.id],
      );
      const votes = asTestRows<unknown>(rows);
      expect(votes[0].count).toBe(0);
    });

    it("should prevent self-voting", async () => {
      const response = await request(app)
        .post(`/api/kvp/suggestions/${suggestionId}/vote`)
        .set("Authorization", `Bearer ${employeeToken2}`)
        .send({ vote_type: "up" });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("eigenen Vorschlag");
    });

    it("should update vote count cache", async () => {
      // Vote from multiple users
      await request(app)
        .post(`/api/kvp/suggestions/${suggestionId}/vote`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ vote_type: "up" });

      await request(app)
        .post(`/api/kvp/suggestions/${suggestionId}/vote`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({ vote_type: "up" });

      // Check vote count
      const [rows] = await testDb.execute(
        "SELECT vote_count FROM kvp_suggestions WHERE id = ?",
        [suggestionId],
      );
      const suggestions = asTestRows<unknown>(rows);
      expect(suggestions[0].vote_count).toBe(2);
    });
  });

  describe("DELETE /api/kvp/suggestions/:id", () => {
    let suggestionId: number;

    beforeEach(async () => {
      const [rows] = await testDb.execute(
        `INSERT INTO kvp_suggestions 
        (title, description, category, status, submitted_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "To Delete",
          "Will be deleted",
          "other",
          "submitted",
          employeeUser1.id,
          tenant1Id,
        ],
      );
      const result = asTestRows<unknown>(rows);
      suggestionId = (result as any).insertId;
    });

    it("should delete suggestion for submitter", async () => {
      const response = await request(app)
        .delete(`/api/kvp/suggestions/${suggestionId}`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("gelöscht");

      // Verify deletion
      const [rows] = await testDb.execute(
        "SELECT * FROM kvp_suggestions WHERE id = ?",
        [suggestionId],
      );
      const suggestions = asTestRows<unknown>(rows);
      expect(suggestions.length).toBe(0);
    });

    it("should delete associated data", async () => {
      // Add comment and vote
      await testDb.execute(
        "INSERT INTO kvp_comments (suggestion_id, user_id, comment, tenant_id) VALUES (?, ?, ?, ?)",
        [suggestionId, adminUser1.id, "Comment", tenant1Id],
      );
      await testDb.execute(
        "INSERT INTO kvp_votes (suggestion_id, user_id, vote_type, tenant_id) VALUES (?, ?, ?, ?)",
        [suggestionId, adminUser1.id, "up", tenant1Id],
      );

      await request(app)
        .delete(`/api/kvp/suggestions/${suggestionId}`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      // Verify cascade deletion
      const [rows] = await testDb.execute(
        "SELECT * FROM kvp_comments WHERE suggestion_id = ?",
        [suggestionId],
      );
      const comments = asTestRows<unknown>(rows);
      expect(comments.length).toBe(0);

      const [rows] = await testDb.execute(
        "SELECT * FROM kvp_votes WHERE suggestion_id = ?",
        [suggestionId],
      );
      const votes = asTestRows<unknown>(rows);
      expect(votes.length).toBe(0);
    });

    it("should prevent deletion after review started", async () => {
      // Update status
      await testDb.execute(
        "UPDATE kvp_suggestions SET status = 'in_review' WHERE id = ?",
        [suggestionId],
      );

      const response = await request(app)
        .delete(`/api/kvp/suggestions/${suggestionId}`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("bereits in Prüfung");
    });

    it("should allow admin to delete any suggestion", async () => {
      const response = await request(app)
        .delete(`/api/kvp/suggestions/${suggestionId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
    });

    it("should prevent non-submitter from deleting", async () => {
      const response = await request(app)
        .delete(`/api/kvp/suggestions/${suggestionId}`)
        .set("Authorization", `Bearer ${employeeToken2}`);

      expect(response.status).toBe(403);
    });

    it("should enforce tenant isolation on delete", async () => {
      const response = await request(app)
        .delete(`/api/kvp/suggestions/${suggestionId}`)
        .set("Authorization", `Bearer ${adminToken2}`);

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/kvp/statistics", () => {
    beforeEach(async () => {
      // Create various suggestions
      await testDb.execute(
        `INSERT INTO kvp_suggestions 
        (title, description, category, status, submitted_by, tenant_id) 
        VALUES 
        (?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?)`,
        [
          "Submitted 1",
          "Desc",
          "process_improvement",
          "submitted",
          employeeUser1.id,
          tenant1Id,
          "In Review",
          "Desc",
          "cost_reduction",
          "in_review",
          employeeUser1.id,
          tenant1Id,
          "Approved",
          "Desc",
          "quality_improvement",
          "approved",
          employeeUser2.id,
          tenant1Id,
          "Implemented",
          "Desc",
          "safety",
          "implemented",
          employeeUser2.id,
          tenant1Id,
        ],
      );

      // Add some points
      await testDb.execute(
        "INSERT INTO kvp_user_points (user_id, points, reason, tenant_id) VALUES (?, ?, ?, ?)",
        [employeeUser1.id, 50, "Suggestion approved", tenant1Id],
      );
    });

    it("should get overall statistics for admin", async () => {
      const response = await request(app)
        .get("/api/kvp/statistics")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        overview: {
          total_suggestions: 4,
          by_status: {
            submitted: 1,
            in_review: 1,
            approved: 1,
            implemented: 1,
          },
          by_category: expect.any(Object),
          participation_rate: expect.any(Number),
        },
        top_contributors: expect.any(Array),
        trends: expect.any(Object),
      });
    });

    it("should get personal statistics for employee", async () => {
      const response = await request(app)
        .get("/api/kvp/statistics/me")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        my_suggestions: 2,
        my_points: 50,
        my_rank: expect.any(Number),
        by_status: expect.any(Object),
      });
    });

    it("should get department statistics", async () => {
      const response = await request(app)
        .get(`/api/kvp/statistics/department/${dept1Id}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        department_name: "Production",
        total_suggestions: expect.any(Number),
        active_employees: expect.any(Number),
      });
    });

    it("should get leaderboard", async () => {
      const response = await request(app)
        .get("/api/kvp/leaderboard")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.leaderboard).toBeDefined();
      expect(Array.isArray(response.body.data.leaderboard)).toBe(true);
    });

    it("should enforce tenant isolation in statistics", async () => {
      const response = await request(app)
        .get("/api/kvp/statistics")
        .set("Authorization", `Bearer ${adminToken2}`);

      expect(response.status).toBe(200);
      expect(response.body.data.overview.total_suggestions).toBe(0); // No suggestions in tenant2
    });
  });

  describe("Export functionality", () => {
    it("should export suggestions as CSV", async () => {
      // Create some suggestions
      await testDb.execute(
        `INSERT INTO kvp_suggestions 
        (title, description, category, status, submitted_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "Export Test",
          "Description",
          "innovation",
          "approved",
          employeeUser1.id,
          tenant1Id,
        ],
      );

      const response = await request(app)
        .get("/api/kvp/export?format=csv")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/csv");
      expect(response.headers["content-disposition"]).toContain("attachment");
      expect(response.text).toContain("Export Test");
    });

    it("should export suggestions as PDF report", async () => {
      const response = await request(app)
        .get("/api/kvp/export?format=pdf&type=report")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("application/pdf");
    });

    it("should deny export for non-admin", async () => {
      const response = await request(app)
        .get("/api/kvp/export?format=csv")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(403);
    });
  });
});
