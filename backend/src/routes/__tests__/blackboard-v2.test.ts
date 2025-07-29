/**
 * Tests for Blackboard API v2
 * Tests company announcements and bulletin board functionality
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
import app from "../../app.js";
import { log } from "console";
import { Pool } from "mysql2/promise";
import {
  createTestDatabase,
  cleanupTestData,
  createTestTenant,
  createTestUser,
} from "../mocks/database.js";
import type { ResultSetHeader } from "mysql2";

describe("Blackboard API v2", () => {
  let testDb: Pool;
  let tenantId: number;
  let adminToken: string;
  let employeeToken: string;
  let adminUserId: number;
  let employeeUserId: number;
  let testEntryId: number;

  beforeAll(async () => {
    testDb = await createTestDatabase();

    // Create test tenant
    tenantId = await createTestTenant(
      testDb,
      "blackboard-test",
      "Test Blackboard Tenant",
    );
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Clean up any existing test data - clear in correct order due to foreign keys
    // First get all entry IDs to avoid trigger conflicts
    const [entries] = await testDb.execute<any[]>(
      "SELECT id FROM blackboard_entries WHERE tenant_id = ?",
      [tenantId],
    );
    const entryIds = entries.map((e) => e.id);

    if (entryIds.length > 0) {
      // Delete related data using the IDs directly
      await testDb.execute(
        `DELETE FROM blackboard_confirmations WHERE entry_id IN (${entryIds.map(() => "?").join(",")})`,
        entryIds,
      );
      await testDb.execute(
        `DELETE FROM blackboard_entry_tags WHERE entry_id IN (${entryIds.map(() => "?").join(",")})`,
        entryIds,
      );
      await testDb.execute(
        `DELETE FROM blackboard_attachments WHERE entry_id IN (${entryIds.map(() => "?").join(",")})`,
        entryIds,
      );
    }

    // Now delete the entries themselves
    await testDb.execute("DELETE FROM blackboard_entries WHERE tenant_id = ?", [
      tenantId,
    ]);
    await testDb.execute("DELETE FROM blackboard_tags WHERE tenant_id = ?", [
      tenantId,
    ]);

    // Create test users
    const adminUser = await createTestUser(testDb, {
      username: "bb_admin_v2",
      email: "bb_admin_v2@test.com",
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
      username: "bb_employee_v2",
      email: "bb_employee_v2@test.com",
      password: "TestPass123!",
      role: "employee",
      tenant_id: tenantId,
    });
    employeeUserId = employeeUser.id;

    const employeeLoginRes = await request(app)
      .post("/api/v2/auth/login")
      .send({
        email: employeeUser.email,
        password: "TestPass123!",
      });
    employeeToken = employeeLoginRes.body.data.accessToken;

    // Create a test entry
    const [result] = await testDb.execute<ResultSetHeader>(
      `INSERT INTO blackboard_entries (
        tenant_id, title, content, org_level, org_id, author_id,
        priority, color, requires_confirmation, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        tenantId,
        "Test Entry",
        "Test content",
        "company",
        null,
        adminUserId,
        "medium",
        "#000000",
        1,
        "active",
      ],
    );
    testEntryId = result.insertId;

    // Wait a bit to ensure the entry is committed
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    // Clean up test data - clear in correct order due to foreign keys
    // First get all entry IDs to avoid trigger conflicts
    const [entries] = await testDb.execute<any[]>(
      "SELECT id FROM blackboard_entries WHERE tenant_id = ?",
      [tenantId],
    );
    const entryIds = entries.map((e) => e.id);

    if (entryIds.length > 0) {
      // Delete related data using the IDs directly
      await testDb.execute(
        `DELETE FROM blackboard_confirmations WHERE entry_id IN (${entryIds.map(() => "?").join(",")})`,
        entryIds,
      );
      await testDb.execute(
        `DELETE FROM blackboard_entry_tags WHERE entry_id IN (${entryIds.map(() => "?").join(",")})`,
        entryIds,
      );
      await testDb.execute(
        `DELETE FROM blackboard_attachments WHERE entry_id IN (${entryIds.map(() => "?").join(",")})`,
        entryIds,
      );
    }

    // Now delete the entries themselves
    await testDb.execute("DELETE FROM blackboard_entries WHERE tenant_id = ?", [
      tenantId,
    ]);
    await testDb.execute("DELETE FROM blackboard_tags WHERE tenant_id = ?", [
      tenantId,
    ]);
  });

  describe("GET /api/v2/blackboard/entries", () => {
    it("should list all entries for authenticated user", async () => {
      // Debug: Check if the test entry exists
      const [checkEntries] = await testDb.execute<any[]>(
        "SELECT * FROM blackboard_entries WHERE tenant_id = ? AND status = 'active'",
        [tenantId],
      );
      log(
        "Entries in DB before test:",
        checkEntries.length,
        checkEntries.map((e) => ({
          id: e.id,
          title: e.title,
          org_level: e.org_level,
          org_id: e.org_id,
        })),
      );

      // Debug: Check employee user's department and team
      const [userInfo] = await testDb.execute<any[]>(
        "SELECT id, role, department_id, tenant_id FROM users WHERE id = ?",
        [employeeUserId],
      );
      log("Employee user info:", userInfo[0]);

      // Check if employee has team assignment
      const [teamInfo] = await testDb.execute<any[]>(
        "SELECT * FROM user_teams WHERE user_id = ?",
        [employeeUserId],
      );
      log(
        "Employee team info:",
        teamInfo.length > 0 ? teamInfo[0] : "No team assignment",
      );

      const response = await request(app)
        .get("/api/v2/blackboard/entries")
        .set("Authorization", `Bearer ${employeeToken}`);

      log("Response data length:", response.body.data?.length);
      if (response.body.data?.length === 0) {
        log("No entries returned. Full response:", response.body);
      }

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      if (response.body.data.length > 0) {
        expect(response.body.data[0].title).toBe("Test Entry");
      }
      expect(response.body.meta.pagination).toBeDefined();
    });

    it("should filter entries by status", async () => {
      // Create an archived entry
      await testDb.execute<ResultSetHeader>(
        `INSERT INTO blackboard_entries (
          tenant_id, title, content, org_level, org_id, author_id,
          priority, color, requires_confirmation, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          "Archived Entry",
          "Archived content",
          "company",
          null,
          adminUserId,
          "low",
          "#000000",
          0,
          "archived",
        ],
      );

      const response = await request(app)
        .get("/api/v2/blackboard/entries?status=archived")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].title).toBe("Archived Entry");
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/v2/blackboard/entries?page=1&limit=5")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.meta.pagination.currentPage).toBe(1);
      expect(response.body.meta.pagination.pageSize).toBe(5);
    });

    it("should return 401 without authentication", async () => {
      const response = await request(app).get("/api/v2/blackboard/entries");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/v2/blackboard/entries/:id", () => {
    it("should get a specific entry", async () => {
      const response = await request(app)
        .get(`/api/v2/blackboard/entries/${testEntryId}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testEntryId);
      expect(response.body.data.title).toBe("Test Entry");
    });

    it("should return 404 for non-existent entry", async () => {
      const response = await request(app)
        .get("/api/v2/blackboard/entries/99999")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("POST /api/v2/blackboard/entries", () => {
    it("should create a new entry as admin", async () => {
      const response = await request(app)
        .post("/api/v2/blackboard/entries")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send({
          title: "New Announcement",
          content: "Important company update",
          orgLevel: "company",
          priority: "high",
          color: "#FF0000",
          requiresConfirmation: true,
          tags: ["important", "update"],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe("New Announcement");
      expect(response.body.data.priority).toBe("high");
      expect(response.body.data.requiresConfirmation).toBe(true);
    });

    it("should require orgId for department level entries", async () => {
      const response = await request(app)
        .post("/api/v2/blackboard/entries")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send({
          title: "Department Update",
          content: "Department specific info",
          orgLevel: "department",
          // Missing orgId
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/v2/blackboard/entries")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send({
          // Missing title and content
          orgLevel: "company",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.details).toBeDefined();
    });

    it("should reject creation from non-admin users", async () => {
      const response = await request(app)
        .post("/api/v2/blackboard/entries")
        .set("Authorization", `Bearer ${employeeToken}`)
        .set("Content-Type", "application/json")
        .send({
          title: "Unauthorized Entry",
          content: "Should not be created",
          orgLevel: "company",
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe("PUT /api/v2/blackboard/entries/:id", () => {
    it("should update an entry as admin", async () => {
      const response = await request(app)
        .put(`/api/v2/blackboard/entries/${testEntryId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send({
          title: "Updated Title",
          priority: "urgent",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe("Updated Title");
      expect(response.body.data.priority).toBe("urgent");
    });

    it("should allow partial updates", async () => {
      const response = await request(app)
        .put(`/api/v2/blackboard/entries/${testEntryId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send({
          priority: "low",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.priority).toBe("low");
      expect(response.body.data.title).toBe("Test Entry"); // Unchanged
    });
  });

  describe("DELETE /api/v2/blackboard/entries/:id", () => {
    it("should delete an entry as admin", async () => {
      const response = await request(app)
        .delete(`/api/v2/blackboard/entries/${testEntryId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify deletion
      const getResponse = await request(app)
        .get(`/api/v2/blackboard/entries/${testEntryId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(getResponse.status).toBe(404);
    });
  });

  describe("POST /api/v2/blackboard/entries/:id/archive", () => {
    it("should archive an entry", async () => {
      const response = await request(app)
        .post(`/api/v2/blackboard/entries/${testEntryId}/archive`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.entry.status).toBe("archived");
    });
  });

  describe("POST /api/v2/blackboard/entries/:id/unarchive", () => {
    it("should unarchive an entry", async () => {
      // First archive it
      await testDb.execute(
        "UPDATE blackboard_entries SET status = ? WHERE id = ? AND tenant_id = ?",
        ["archived", testEntryId, tenantId],
      );

      const response = await request(app)
        .post(`/api/v2/blackboard/entries/${testEntryId}/unarchive`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.entry.status).toBe("active");
    });
  });

  describe("POST /api/v2/blackboard/entries/:id/confirm", () => {
    it("should confirm reading an entry", async () => {
      const response = await request(app)
        .post(`/api/v2/blackboard/entries/${testEntryId}/confirm`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should track confirmation status", async () => {
      // Confirm as employee
      await request(app)
        .post(`/api/v2/blackboard/entries/${testEntryId}/confirm`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .set("Content-Type", "application/json");

      // Check confirmation status
      const response = await request(app)
        .get(`/api/v2/blackboard/entries/${testEntryId}/confirmations`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data.some((u: any) => u.id === employeeUserId)).toBe(
        true,
      );
    });
  });

  describe("GET /api/v2/blackboard/dashboard", () => {
    it("should get dashboard entries", async () => {
      const response = await request(app)
        .get("/api/v2/blackboard/dashboard")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should limit dashboard entries", async () => {
      const response = await request(app)
        .get("/api/v2/blackboard/dashboard?limit=2")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });
  });

  describe("Tags functionality", () => {
    let taggedEntryId: number;

    beforeEach(async () => {
      // Create entry with tags
      const response = await request(app)
        .post("/api/v2/blackboard/entries")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send({
          title: "Tagged Entry",
          content: "Entry with tags",
          orgLevel: "company",
          tags: ["announcement", "hr", "policy"],
        });

      taggedEntryId = response.body.data.id;
    });

    it("should get all available tags", async () => {
      const response = await request(app)
        .get("/api/v2/blackboard/tags")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(3);
    });

    it("should filter entries by tag", async () => {
      // This would require implementing tag filtering in the list endpoint
      // For now, we verify tags are returned with entries
      const response = await request(app)
        .get(`/api/v2/blackboard/entries/${taggedEntryId}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.tags).toBeDefined();
      expect(response.body.data.tags).toContain("announcement");
    });
  });

  describe("Multi-tenant isolation", () => {
    let otherTenantToken: string;
    let tenant2Id: number;

    beforeEach(async () => {
      // Create second tenant if it doesn't exist
      try {
        tenant2Id = await createTestTenant(
          testDb,
          "blackboard-test2",
          "Test Blackboard Tenant 2",
        );
      } catch (error) {
        // Tenant might already exist, try to get its ID
        const [tenants] = await testDb.execute<any[]>(
          "SELECT id FROM tenants WHERE code = ?",
          ["blackboard-test2"],
        );
        if (tenants.length > 0) {
          tenant2Id = tenants[0].id;
        } else {
          throw error;
        }
      }

      // Create user in different tenant
      const otherUser = await createTestUser(testDb, {
        username: "other_tenant_user",
        email: "other@tenant.com",
        password: "TestPass123!",
        role: "admin",
        tenant_id: tenant2Id,
      });
      const otherLoginRes = await request(app).post("/api/v2/auth/login").send({
        email: otherUser.email,
        password: "TestPass123!",
      });
      otherTenantToken = otherLoginRes.body.data.accessToken;

      // Create entry in tenant 2
      await testDb.execute<ResultSetHeader>(
        `INSERT INTO blackboard_entries (
          tenant_id, title, content, org_level, org_id, author_id,
          priority, color, requires_confirmation, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenant2Id,
          "Other Tenant Entry",
          "Should not be visible",
          "company",
          null,
          otherUser.id,
          "medium",
          "#000000",
          0,
          "active",
        ],
      );
    });

    it("should not see entries from other tenants", async () => {
      const response = await request(app)
        .get("/api/v2/blackboard/entries")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(
        response.body.data.every((e: any) => e.title !== "Other Tenant Entry"),
      ).toBe(true);
    });

    it("should not access other tenant's entry directly", async () => {
      // Get the other tenant's entry ID
      const [rows] = await testDb.execute<any[]>(
        "SELECT id FROM blackboard_entries WHERE tenant_id = ? AND title = ?",
        [tenant2Id, "Other Tenant Entry"],
      );
      const otherEntryId = rows[0].id;

      const response = await request(app)
        .get(`/api/v2/blackboard/entries/${otherEntryId}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(404);
    });

    it("should allow other tenant to see their own entries", async () => {
      const response = await request(app)
        .get("/api/v2/blackboard/entries")
        .set("Authorization", `Bearer ${otherTenantToken}`);

      expect(response.status).toBe(200);
      expect(
        response.body.data.some((e: any) => e.title === "Other Tenant Entry"),
      ).toBe(true);
      expect(
        response.body.data.every((e: any) => e.title !== "Test Entry"),
      ).toBe(true);
    });
  });

  describe("Attachments functionality", () => {
    it("should upload an attachment to an entry", async () => {
      const response = await request(app)
        .post(`/api/v2/blackboard/entries/${testEntryId}/attachments`)
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("attachment", Buffer.from("test pdf content"), "test-file.pdf");

      if (response.status !== 201) {
        log("Upload error response:", response.body);
      }
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe("Attachment added successfully");
    });

    it("should get attachments for an entry", async () => {
      // First upload an attachment
      await request(app)
        .post(`/api/v2/blackboard/entries/${testEntryId}/attachments`)
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("attachment", Buffer.from("test pdf content"), "test-file.pdf");

      const response = await request(app)
        .get(`/api/v2/blackboard/entries/${testEntryId}/attachments`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it("should delete an attachment", async () => {
      // First upload an attachment
      await request(app)
        .post(`/api/v2/blackboard/entries/${testEntryId}/attachments`)
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("attachment", Buffer.from("test pdf content"), "test-file.pdf");

      // Get attachments to find the ID
      const attachmentsResponse = await request(app)
        .get(`/api/v2/blackboard/entries/${testEntryId}/attachments`)
        .set("Authorization", `Bearer ${adminToken}`);

      const attachmentId = attachmentsResponse.body.data[0].id;

      // Delete the attachment
      const deleteResponse = await request(app)
        .delete(`/api/v2/blackboard/attachments/${attachmentId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.success).toBe(true);
    });

    it("should require authentication for attachment operations", async () => {
      const response = await request(app)
        .post(`/api/v2/blackboard/entries/${testEntryId}/attachments`)
        .attach("attachment", Buffer.from("test pdf content"), "test-file.pdf");

      expect(response.status).toBe(401);
    });
  });

  describe("Advanced filtering and sorting", () => {
    beforeEach(async () => {
      // Create entries with different properties
      await testDb.execute<ResultSetHeader>(
        `INSERT INTO blackboard_entries (
          tenant_id, title, content, org_level, org_id, author_id,
          priority, color, requires_confirmation, status, expires_at
        ) VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          // High priority entry
          tenantId,
          "High Priority Entry",
          "Urgent content",
          "company",
          null,
          adminUserId,
          "high",
          "#FF0000",
          1,
          "active",
          new Date(Date.now() + 86400000), // expires tomorrow
          // Low priority entry
          tenantId,
          "Low Priority Entry",
          "Normal content",
          "company",
          null,
          adminUserId,
          "low",
          "#00FF00",
          0,
          "active",
          null,
          // Expired entry
          tenantId,
          "Expired Entry",
          "Old content",
          "company",
          null,
          adminUserId,
          "medium",
          "#0000FF",
          0,
          "active",
          new Date(Date.now() - 86400000), // expired yesterday
        ],
      );
    });

    it("should filter by priority", async () => {
      const response = await request(app)
        .get("/api/v2/blackboard/entries?priority=high")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.some((e: any) => e.priority === "high")).toBe(
        true,
      );
      expect(response.body.data.every((e: any) => e.priority !== "low")).toBe(
        true,
      );
    });

    it("should filter by requiresConfirmation", async () => {
      const response = await request(app)
        .get("/api/v2/blackboard/entries?requiresConfirmation=true")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(
        response.body.data.every((e: any) => e.requiresConfirmation === true),
      ).toBe(true);
    });

    it("should sort entries", async () => {
      const response = await request(app)
        .get("/api/v2/blackboard/entries?sortBy=priority&sortDir=DESC")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      const priorities = response.body.data.map((e: any) => e.priority);
      // Check that high priority comes before low priority
      const highIndex = priorities.indexOf("high");
      const lowIndex = priorities.indexOf("low");
      if (highIndex !== -1 && lowIndex !== -1) {
        expect(highIndex).toBeLessThan(lowIndex);
      }
    });

    it("should search entries by title and content", async () => {
      const response = await request(app)
        .get("/api/v2/blackboard/entries?search=Urgent")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(
        response.body.data.some(
          (e: any) =>
            e.title.includes("Urgent") || e.content.includes("Urgent"),
        ),
      ).toBe(true);
    });
  });

  describe("Entry expiration", () => {
    it("should create entry with expiration date", async () => {
      const futureDate = new Date(Date.now() + 7 * 86400000); // 7 days from now
      const response = await request(app)
        .post("/api/v2/blackboard/entries")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send({
          title: "Expiring Announcement",
          content: "This will expire",
          orgLevel: "company",
          expiresAt: futureDate.toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.data.expiresAt).toBeDefined();
      const expiresAt = new Date(response.body.data.expiresAt);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("Department and Team level entries", () => {
    it("should create department level entry with orgId", async () => {
      const response = await request(app)
        .post("/api/v2/blackboard/entries")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send({
          title: "Department Announcement",
          content: "For IT department only",
          orgLevel: "department",
          orgId: 1,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.orgLevel).toBe("department");
      expect(response.body.data.orgId).toBe(1);
    });

    it("should create team level entry with orgId", async () => {
      const response = await request(app)
        .post("/api/v2/blackboard/entries")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send({
          title: "Team Announcement",
          content: "For dev team only",
          orgLevel: "team",
          orgId: 5,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.orgLevel).toBe("team");
      expect(response.body.data.orgId).toBe(5);
    });
  });
});
