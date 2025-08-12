/**
 * Integration Tests for Blackboard Feature
 * Tests the complete flow from API to database
 */

import request from "supertest";
import app from "../app";
import {
  createTestDatabase,
  cleanupTestData,
  createTestTenant,
  createTestUser,
  getAuthToken,
} from "../routes/mocks/database";
import { Pool } from "mysql2/promise";
// Jest is available globally

let adminToken: string;
let employeeToken: string;
let testDb: Pool;
let tenantId: number;
let _adminUserId: number;
let _employeeUserId: number;

describe("Blackboard Integration Tests", () => {
  beforeAll(async () => {
    // Setup test database
    testDb = await createTestDatabase();

    // Create test tenant
    tenantId = await createTestTenant(
      testDb,
      "blackboardtest",
      "Test Blackboard Company",
    );

    // Create test users
    const adminResult = await createTestUser(testDb, {
      username: "admin",
      email: "admin@test.com",
      password: "TestPass123!",
      role: "admin",
      tenant_id: tenantId,
      first_name: "Admin",
      last_name: "User",
    });
    _adminUserId = adminResult.id;

    const employeeResult = await createTestUser(testDb, {
      username: "employee",
      email: "employee@test.com",
      password: "TestPass123!",
      role: "employee",
      tenant_id: tenantId,
      department_id: 1,
      team_id: 1,
      first_name: "Employee",
      last_name: "User",
    });
    _employeeUserId = employeeResult.id;

    // Get auth tokens
    adminToken = await getAuthToken(app, adminResult.username, "TestPass123!");
    employeeToken = await getAuthToken(
      app,
      employeeResult.username,
      "TestPass123!",
    );
  });

  afterAll(async () => {
    // Cleanup
    await cleanupTestData();
    // Note: pool.end() is handled by the test environment
  });

  describe("Complete Blackboard Entry Lifecycle", () => {
    let createdEntryId: number;

    it("should create a company-level entry as admin", async () => {
      const response = await request(app)
        .post("/api/blackboard")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Company-wide Announcement",
          content: "This is an important announcement for all employees",
          org_level: "company",
          org_id: null,
          priority: "high",
          color: "red",
          tags: ["important", "announcement"],
        })
        .expect(201);

      expect(response.body).toMatchObject({
        title: "Company-wide Announcement",
        content: "This is an important announcement for all employees",
        org_level: "company",
        org_id: null,
        priority: "high",
        color: "red",
      });

      createdEntryId = response.body.id;
    });

    it("should fetch the created entry in list", async () => {
      const response = await request(app)
        .get("/api/blackboard")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.entries).toContainEqual(
        expect.objectContaining({
          id: createdEntryId,
          title: "Company-wide Announcement",
        }),
      );
    });

    it("should allow employee to see company-level entry", async () => {
      const response = await request(app)
        .get(`/api/blackboard/${createdEntryId}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .expect(200);

      expect(response.body.id).toBe(createdEntryId);
      expect(response.body.is_confirmed).toBe(0);
    });

    it("should allow employee to confirm the entry", async () => {
      await request(app)
        .post(`/api/blackboard/${createdEntryId}/confirm`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .expect(200);

      // Verify confirmation
      const response = await request(app)
        .get(`/api/blackboard/${createdEntryId}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .expect(200);

      expect(response.body.is_confirmed).toBe(1);
    });

    it("should update the entry as admin", async () => {
      const response = await request(app)
        .put(`/api/blackboard/${createdEntryId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Updated Announcement",
          priority: "urgent",
        })
        .expect(200);

      expect(response.body.title).toBe("Updated Announcement");
      expect(response.body.priority).toBe("urgent");
    });

    it("should delete the entry as admin", async () => {
      await request(app)
        .delete(`/api/blackboard/${createdEntryId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      // Verify deletion
      await request(app)
        .get(`/api/blackboard/${createdEntryId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe("Department and Team Level Entries", () => {
    it("should create department-level entry", async () => {
      const response = await request(app)
        .post("/api/blackboard")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Department Meeting",
          content: "Monthly department sync",
          org_level: "department",
          org_id: 1,
          priority: "medium",
        })
        .expect(201);

      expect(response.body.org_level).toBe("department");
      expect(response.body.org_id).toBe(1);
    });

    it("should create team-level entry", async () => {
      const response = await request(app)
        .post("/api/blackboard")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Team Sprint Planning",
          content: "Sprint 23 planning session",
          org_level: "team",
          org_id: 1,
          priority: "low",
        })
        .expect(201);

      expect(response.body.org_level).toBe("team");
      expect(response.body.org_id).toBe(1);
    });

    it("should filter entries by org_level", async () => {
      const response = await request(app)
        .get("/api/blackboard?filter=department")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      response.body.entries.forEach((entry: any) => {
        expect(entry.org_level).toBe("department");
      });
    });
  });

  describe("Permission Tests", () => {
    it("should prevent employee from creating company-wide entry", async () => {
      const response = await request(app)
        .post("/api/blackboard")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          title: "Unauthorized Company Entry",
          content: "Should fail",
          org_level: "company",
        })
        .expect(403);

      expect(response.body.message).toContain(
        "Only admins can create company-wide entries",
      );
    });

    it("should prevent employee from updating others entries", async () => {
      // First create an entry as admin
      const createResponse = await request(app)
        .post("/api/blackboard")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Admin Entry",
          content: "Created by admin",
          org_level: "company",
        })
        .expect(201);

      const entryId = createResponse.body.id;

      // Try to update as employee
      await request(app)
        .put(`/api/blackboard/${String(entryId)}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          title: "Hacked!",
        })
        .expect(403);
    });
  });

  describe("Search and Pagination", () => {
    beforeAll(async () => {
      // Create multiple entries for testing
      const entries = [
        { title: "First Entry", content: "Content 1", priority: "low" },
        { title: "Second Entry", content: "Content 2", priority: "medium" },
        { title: "Third Entry", content: "Content 3", priority: "high" },
        { title: "Fourth Entry", content: "Content 4", priority: "urgent" },
        { title: "Fifth Entry", content: "Content 5", priority: "medium" },
      ];

      for (const entry of entries) {
        await request(app)
          .post("/api/blackboard")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ ...entry, org_level: "company" });
      }
    });

    it("should search entries by keyword", async () => {
      const response = await request(app)
        .get("/api/blackboard?search=Third")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.entries).toHaveLength(1);
      expect(response.body.entries[0].title).toContain("Third");
    });

    it("should paginate results correctly", async () => {
      const page1 = await request(app)
        .get("/api/blackboard?page=1&limit=2")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(page1.body.entries).toHaveLength(2);
      expect(page1.body.pagination.page).toBe(1);
      expect(page1.body.pagination.limit).toBe(2);

      const page2 = await request(app)
        .get("/api/blackboard?page=2&limit=2")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(page2.body.entries).toHaveLength(2);
      expect(page2.body.pagination.page).toBe(2);

      // Ensure different entries
      expect(page1.body.entries[0].id).not.toBe(page2.body.entries[0].id);
    });

    it("should sort by priority correctly", async () => {
      const response = await request(app)
        .get("/api/blackboard?sortBy=priority&sortDir=DESC")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      // Urgent and high priority should come first
      const priorities = response.body.entries.map((e: any) => e.priority);
      expect(priorities[0]).toBe("urgent");
    });
  });

  describe("Dashboard Widget", () => {
    it("should fetch limited entries for dashboard", async () => {
      const response = await request(app)
        .get("/api/blackboard/dashboard?limit=3")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveLength(3);
    });
  });

  describe("Error Scenarios", () => {
    it("should handle missing required fields", async () => {
      const response = await request(app)
        .post("/api/blackboard")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Missing Content",
          // Missing content and org_level
        })
        .expect(500);

      expect(response.body.error).toContain("Missing required fields");
    });

    it("should handle invalid org_id for non-company entries", async () => {
      const response = await request(app)
        .post("/api/blackboard")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Invalid Department Entry",
          content: "Should fail",
          org_level: "department",
          org_id: null, // Should not be null
        })
        .expect(500);

      expect(response.body.error).toContain(
        "org_id is required for department or team level entries",
      );
    });

    it("should handle non-existent entry gracefully", async () => {
      await request(app)
        .get("/api/blackboard/99999")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
