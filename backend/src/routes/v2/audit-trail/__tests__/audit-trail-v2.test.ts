/**
 * Tests for Audit Trail API v2
 * Tests comprehensive audit logging and compliance features
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
import { Pool, ResultSetHeader } from "mysql2/promise";
import {
  createTestDatabase,
  cleanupTestData,
  closeTestDatabase,
  createTestTenant,
  createTestUser,
} from "../../../mocks/database.js";
import { error as logError } from "console";

describe("Audit Trail API v2", () => {
  jest.setTimeout(30000);

  let testDb: Pool;
  let tenantId: number;
  let adminToken: string;
  let userToken: string;
  let rootToken: string;
  let adminUserId: number;
  let userId: number;
  let rootUserId: number;
  let testEntryId: number;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    await cleanupTestData();

    // Create test tenant
    tenantId = await createTestTenant(
      testDb,
      "audit-test",
      "Test Audit Tenant",
    );

    // Create admin user
    const adminUser = await createTestUser(testDb, {
      username: "audit_admin_v2",
      email: "admin@auditv2.test",
      password: "Admin123!",
      first_name: "Admin",
      last_name: "User",
      role: "admin",
      tenant_id: tenantId,
    });
    adminUserId = adminUser.id;

    // Create regular user
    const regularUser = await createTestUser(testDb, {
      username: "audit_user_v2",
      email: "user@auditv2.test",
      password: "User123!",
      first_name: "Regular",
      last_name: "User",
      role: "employee",
      tenant_id: tenantId,
    });
    userId = regularUser.id;

    // Create root user
    const rootUser = await createTestUser(testDb, {
      username: "audit_root_v2",
      email: "root@auditv2.test",
      password: "Root123!",
      first_name: "Root",
      last_name: "User",
      role: "root",
      tenant_id: tenantId,
    });
    rootUserId = rootUser.id;

    // Login to get tokens
    const adminLogin = await request(app)
      .post("/api/v2/auth/login")
      .send({ email: adminUser.email, password: "Admin123!" });
    adminToken = adminLogin.body.data.accessToken;

    const userLogin = await request(app)
      .post("/api/v2/auth/login")
      .send({ email: regularUser.email, password: "User123!" });
    userToken = userLogin.body.data.accessToken;

    const rootLogin = await request(app)
      .post("/api/v2/auth/login")
      .send({ email: rootUser.email, password: "Root123!" });
    rootToken = rootLogin.body.data.accessToken;

    // Create the audit_trail table
    await testDb.execute(`
      CREATE TABLE IF NOT EXISTS audit_trail (
        id int NOT NULL AUTO_INCREMENT,
        tenant_id int NOT NULL,
        user_id int NOT NULL,
        user_name varchar(100) DEFAULT NULL,
        user_role varchar(50) DEFAULT NULL,
        action varchar(50) NOT NULL,
        resource_type varchar(50) NOT NULL,
        resource_id int DEFAULT NULL,
        resource_name varchar(255) DEFAULT NULL,
        changes JSON DEFAULT NULL,
        ip_address varchar(45) DEFAULT NULL,
        user_agent text DEFAULT NULL,
        status enum('success','failure') NOT NULL DEFAULT 'success',
        error_message text DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_tenant_user (tenant_id, user_id),
        KEY idx_action (action),
        KEY idx_resource (resource_type, resource_id),
        KEY idx_created_at (created_at),
        KEY idx_status (status),
        CONSTRAINT audit_trail_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE,
        CONSTRAINT audit_trail_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Create some test audit entries
    try {
      const [result] = await testDb.execute<ResultSetHeader>(
        `INSERT INTO audit_trail (
          tenant_id, user_id, user_name, user_role,
          action, resource_type, resource_id, resource_name,
          changes, ip_address, user_agent, status
        ) VALUES 
        (?, ?, 'Admin User', 'admin', 'create', 'user', 100, 'New User', '{"email": "new@test.com"}', '192.168.1.1', 'Test Agent', 'success'),
        (?, ?, 'Regular User', 'employee', 'read', 'document', 200, 'Report.pdf', NULL, '192.168.1.2', 'Test Agent', 'success'),
        (?, ?, 'Admin User', 'admin', 'update', 'settings', NULL, 'System Settings', '{"theme": "dark"}', '192.168.1.1', 'Test Agent', 'success'),
        (?, ?, 'Regular User', 'employee', 'delete', 'chat_message', 300, 'Message #300', NULL, '192.168.1.2', 'Test Agent', 'failure')`,
        [
          tenantId,
          adminUserId,
          tenantId,
          userId,
          tenantId,
          adminUserId,
          tenantId,
          userId,
        ],
      );
      testEntryId = result.insertId;
      logError(`Created ${result.affectedRows} test audit entries`);
    } catch (error) {
      logError("Failed to create test audit entries:", error);
      throw error;
    }
  });

  afterAll(async () => {
    if (testDb && tenantId) {
      await testDb.execute("DELETE FROM audit_trail WHERE tenant_id = ?", [
        tenantId,
      ]);
    }
    // Don't call cleanupTestData() here - it deletes ALL test tenants!
    // This is handled by global cleanup in jest.globalTeardown.js
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Clean specific test data if needed
  });

  describe("GET /api/v2/audit-trail", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .get("/api/v2/audit-trail")
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: "UNAUTHORIZED",
        }),
      });
    });

    it("should return user's own audit entries", async () => {
      const response = await request(app)
        .get("/api/v2/audit-trail")
        .set("Authorization", `Bearer ${userToken}`);

      if (response.status !== 200) {
        logError("Error response:", response.body);
      }

      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          entries: expect.arrayContaining([
            expect.objectContaining({
              userId: userId,
              action: expect.any(String),
              resourceType: expect.any(String),
            }),
          ]),
          pagination: expect.objectContaining({
            currentPage: 1,
            pageSize: 50,
          }),
        },
      });

      // Should only see their own entries
      const otherUserEntries = response.body.data.entries.filter(
        (e: any) => e.userId !== userId,
      );
      expect(otherUserEntries).toHaveLength(0);
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/v2/audit-trail")
        .query({ page: 1, limit: 2 })
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.entries).toHaveLength(2);
      expect(response.body.data.pagination.pageSize).toBe(2);
    });

    it("should support filtering by action", async () => {
      const response = await request(app)
        .get("/api/v2/audit-trail")
        .query({ action: "create" })
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const entries = response.body.data.entries;
      expect(entries.every((e: any) => e.action === "create")).toBe(true);
    });

    it("should support filtering by resource type", async () => {
      const response = await request(app)
        .get("/api/v2/audit-trail")
        .query({ resourceType: "user" })
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const entries = response.body.data.entries;
      expect(entries.every((e: any) => e.resourceType === "user")).toBe(true);
    });

    it("should support filtering by status", async () => {
      const response = await request(app)
        .get("/api/v2/audit-trail")
        .query({ status: "failure" })
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      const entries = response.body.data.entries;
      expect(entries.every((e: any) => e.status === "failure")).toBe(true);
    });

    it("should support date range filtering", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app)
        .get("/api/v2/audit-trail")
        .query({
          dateFrom: yesterday.toISOString(),
          dateTo: tomorrow.toISOString(),
        })
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.entries.length).toBeGreaterThan(0);
    });

    it("should support search", async () => {
      const response = await request(app)
        .get("/api/v2/audit-trail")
        .query({ search: "Admin" })
        .set("Authorization", `Bearer ${rootToken}`)
        .expect(200);

      expect(response.body.data.entries.length).toBeGreaterThan(0);
    });

    it("should allow root to see all entries", async () => {
      const response = await request(app)
        .get("/api/v2/audit-trail")
        .set("Authorization", `Bearer ${rootToken}`)
        .expect(200);

      // Should see entries from multiple users
      const userIds = new Set(
        response.body.data.entries.map((e: any) => e.userId),
      );
      expect(userIds.size).toBeGreaterThan(1);
    });

    it("should validate query parameters", async () => {
      const response = await request(app)
        .get("/api/v2/audit-trail")
        .query({
          page: "invalid",
          limit: 200, // exceeds max
          status: "invalid_status",
        })
        .set("Authorization", `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/v2/audit-trail/:id", () => {
    it("should return specific audit entry", async () => {
      const response = await request(app)
        .get(`/api/v2/audit-trail/${testEntryId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: testEntryId,
          action: "create",
          resourceType: "user",
        }),
      });
    });

    it("should prevent users from viewing others' entries", async () => {
      const response = await request(app)
        .get(`/api/v2/audit-trail/${testEntryId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("should return 404 for non-existent entry", async () => {
      const response = await request(app)
        .get("/api/v2/audit-trail/99999")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("GET /api/v2/audit-trail/stats", () => {
    it("should require admin or root role", async () => {
      const response = await request(app)
        .get("/api/v2/audit-trail/stats")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("should return audit statistics", async () => {
      const response = await request(app)
        .get("/api/v2/audit-trail/stats")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          totalEntries: expect.any(Number),
          byAction: expect.any(Object),
          byResourceType: expect.any(Object),
          byUser: expect.any(Array),
          byStatus: expect.objectContaining({
            success: expect.any(Number),
            failure: expect.any(Number),
          }),
          timeRange: expect.any(Object),
        }),
      });
    });

    it("should support date filtering for stats", async () => {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      const response = await request(app)
        .get("/api/v2/audit-trail/stats")
        .query({
          dateFrom: lastWeek.toISOString(),
          dateTo: new Date().toISOString(),
        })
        .set("Authorization", `Bearer ${rootToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /api/v2/audit-trail/reports", () => {
    it("should require admin or root role", async () => {
      const response = await request(app)
        .post("/api/v2/audit-trail/reports")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          reportType: "gdpr",
          dateFrom: "2025-01-01",
          dateTo: "2025-12-31",
        })
        .expect(403);

      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("should generate GDPR compliance report", async () => {
      const response = await request(app)
        .post("/api/v2/audit-trail/reports")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          reportType: "gdpr",
          dateFrom: new Date(
            Date.now() - 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          dateTo: new Date().toISOString(),
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          reportType: "gdpr",
          entries: expect.any(Array),
          summary: expect.objectContaining({
            totalActions: expect.any(Number),
            uniqueUsers: expect.any(Number),
            dataAccessCount: expect.any(Number),
            dataModificationCount: expect.any(Number),
            dataDeletionCount: expect.any(Number),
          }),
          generatedAt: expect.any(String),
          generatedBy: adminUserId,
        }),
      });
    });

    it("should validate date range", async () => {
      const response = await request(app)
        .post("/api/v2/audit-trail/reports")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          reportType: "user_activity",
          dateFrom: "2025-12-31",
          dateTo: "2025-01-01", // Invalid: end before start
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should enforce maximum date range", async () => {
      const response = await request(app)
        .post("/api/v2/audit-trail/reports")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          reportType: "data_access",
          dateFrom: "2024-01-01",
          dateTo: "2025-12-31", // More than 1 year
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/v2/audit-trail/export", () => {
    it("should export entries as JSON", async () => {
      const response = await request(app)
        .get("/api/v2/audit-trail/export")
        .query({ format: "json" })
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
      });
    });

    it("should export entries as CSV", async () => {
      const response = await request(app)
        .get("/api/v2/audit-trail/export")
        .query({ format: "csv" })
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers["content-type"]).toContain("text/csv");
      expect(response.headers["content-disposition"]).toContain(
        "audit-trail-export.csv",
      );
      expect(response.text).toContain("ID,Date/Time,User,Role,Action");
    });

    it("should log the export action", async () => {
      await request(app)
        .get("/api/v2/audit-trail/export")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      // Check if export was logged
      const checkResponse = await request(app)
        .get("/api/v2/audit-trail")
        .query({ action: "export", resourceType: "audit_trail" })
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(checkResponse.body.data.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: "export",
            resourceType: "audit_trail",
            userId: adminUserId,
          }),
        ]),
      );
    });
  });

  describe("DELETE /api/v2/audit-trail/retention", () => {
    it("should require root role", async () => {
      const response = await request(app)
        .delete("/api/v2/audit-trail/retention")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          olderThanDays: 90,
          confirmPassword: "Admin123!",
        })
        .expect(403);

      expect(response.body.error.message).toBe("Insufficient permissions");
    });

    it("should require minimum 90 days", async () => {
      const response = await request(app)
        .delete("/api/v2/audit-trail/retention")
        .set("Authorization", `Bearer ${rootToken}`)
        .send({
          olderThanDays: 30, // Too recent
          confirmPassword: "Root123!",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should delete old entries with valid password", async () => {
      // Create an old entry
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      await testDb.execute(
        `INSERT INTO audit_trail (
          tenant_id, user_id, user_name, action, resource_type, 
          status, created_at
        ) VALUES (?, ?, 'Old User', 'test', 'test', 'success', ?)`,
        [tenantId, rootUserId, oldDate],
      );

      const response = await request(app)
        .delete("/api/v2/audit-trail/retention")
        .set("Authorization", `Bearer ${rootToken}`)
        .send({
          olderThanDays: 90,
          confirmPassword: "Root123!",
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          deletedCount: expect.any(Number),
          cutoffDate: expect.any(String),
        }),
      });
    });

    it("should log the deletion action", async () => {
      await request(app)
        .delete("/api/v2/audit-trail/retention")
        .set("Authorization", `Bearer ${rootToken}`)
        .send({
          olderThanDays: 365,
          confirmPassword: "Root123!",
        })
        .expect(200);

      // Check if deletion was logged
      const checkResponse = await request(app)
        .get("/api/v2/audit-trail")
        .query({ action: "delete", resourceType: "audit_trail" })
        .set("Authorization", `Bearer ${rootToken}`)
        .expect(200);

      expect(checkResponse.body.data.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: "delete",
            resourceType: "audit_trail",
            userId: rootUserId,
          }),
        ]),
      );
    });
  });

  describe("Multi-tenant isolation", () => {
    let otherTenantId: number;
    let otherTenantToken: string;

    beforeAll(async () => {
      // Create another tenant
      otherTenantId = await createTestTenant(
        testDb,
        "audit-other",
        "Other Audit Tenant",
      );

      const otherUser = await createTestUser(testDb, {
        username: "other_audit_admin",
        email: "admin@otheraudit.test",
        password: "Other123!",
        first_name: "Other",
        last_name: "Admin",
        role: "admin",
        tenant_id: otherTenantId,
      });

      const otherLogin = await request(app)
        .post("/api/v2/auth/login")
        .send({ email: otherUser.email, password: "Other123!" });
      otherTenantToken = otherLogin.body.data.accessToken;

      // Create audit entry for other tenant
      await testDb.execute(
        `INSERT INTO audit_trail (
          tenant_id, user_id, user_name, action, resource_type, status
        ) VALUES (?, ?, 'Other Admin', 'create', 'secret', 'success')`,
        [otherTenantId, otherUser.id],
      );
    });

    it("should not leak audit entries between tenants", async () => {
      const response = await request(app)
        .get("/api/v2/audit-trail")
        .set("Authorization", `Bearer ${otherTenantToken}`)
        .expect(200);

      // Should not see entries from the main test tenant
      const mainTenantEntries = response.body.data.entries.filter(
        (e: any) => e.tenantId === tenantId,
      );
      expect(mainTenantEntries).toHaveLength(0);
    });

    it("should not allow cross-tenant audit entry access", async () => {
      // Get an entry ID from the other tenant
      const [rows] = await testDb.execute<any[]>(
        "SELECT id FROM audit_trail WHERE tenant_id = ? LIMIT 1",
        [otherTenantId],
      );

      const response = await request(app)
        .get(`/api/v2/audit-trail/${rows[0].id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("Integration with other services", () => {
    it("should be called when creating resources", async () => {
      // This would normally be done by the service itself
      // Here we're simulating what would happen
      const { auditTrailService } = await import("../audit-trail.service.js");

      const entry = await auditTrailService.createEntry(
        tenantId,
        adminUserId,
        {
          action: "create",
          resourceType: "test_resource",
          resourceId: 123,
          resourceName: "Test Resource",
          changes: { field: "value" },
          status: "success",
        },
        "127.0.0.1",
        "Test User Agent",
      );

      expect(entry).toMatchObject({
        id: expect.any(Number),
        action: "create",
        resourceType: "test_resource",
        resourceId: 123,
      });
    });
  });
});
