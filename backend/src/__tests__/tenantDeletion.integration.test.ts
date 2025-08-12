/**
 * Integration Tests for Tenant Deletion System
 * Tests the complete flow from API to database
 */

import request from "supertest";
import app from "../app";
import { query } from "../utils/db";
import { tenantDeletionService } from "../services/tenantDeletion.service";
import { getRedisClient } from "../config/redis";
import { emailService } from "../utils/emailService";
import * as fs from "fs/promises";
import { connectDatabase, closeDatabaseConnection } from "../database";
import jwt from "jsonwebtoken";

// Mock external services
jest.mock("../utils/emailService");
jest.mock("../config/redis");

// Mock Redis client
const mockRedisClient = {
  keys: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
};

// Helper to generate test JWT token
function generateTestToken(
  userId: number,
  tenantId: number,
  role = "root",
): string {
  return jwt.sign(
    { userId, tenantId, role },
    process.env.JWT_SECRET ?? "test-secret",
    { expiresIn: "1h" },
  );
}

// Helper to clean up test data
async function cleanupTestData(tenantId: number): Promise<void> {
  try {
    // Clean up in reverse order of foreign keys
    await query(
      "DELETE FROM tenant_deletion_log WHERE queue_id IN (SELECT id FROM tenant_deletion_queue WHERE tenant_id = ?)",
      [tenantId],
    );
    await query("DELETE FROM deletion_audit_trail WHERE tenant_id = ?", [
      tenantId,
    ]);
    await query("DELETE FROM tenant_deletion_queue WHERE tenant_id = ?", [
      tenantId,
    ]);
    await query("DELETE FROM tenant_data_exports WHERE tenant_id = ?", [
      tenantId,
    ]);
    await query(
      'UPDATE tenants SET deletion_status = "active", deletion_requested_at = NULL WHERE id = ?',
      [tenantId],
    );
  } catch (error: unknown) {
    console.error("Cleanup error:", error);
  }
}

describe("Tenant Deletion Integration Tests", () => {
  let testTenantId: number;
  let testUserId: number;
  let authToken: string;

  beforeAll(async () => {
    // Initialize database connection
    await connectDatabase();

    // Create test tenant and user
    const [tenantResult] = await query(
      "INSERT INTO tenants (company_name, subdomain, created_at) VALUES (?, ?, NOW())",
      ["Test Deletion Company", "test-deletion-co"],
    );
    testTenantId = (tenantResult as any).insertId;

    const [userResult] = await query(
      "INSERT INTO users (tenant_id, username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
      [
        testTenantId,
        "test-root",
        "root@test-deletion.com",
        "hashed_password",
        "root",
      ],
    );
    testUserId = (userResult as any).insertId;

    // Generate auth token
    authToken = generateTestToken(testUserId, testTenantId, "root");

    // Mock Redis
    (getRedisClient as jest.Mock).mockResolvedValue(mockRedisClient);
  });

  afterAll(async () => {
    // Clean up test data
    if (testTenantId !== 0 && !isNaN(testTenantId)) {
      await cleanupTestData(testTenantId);
      await query("DELETE FROM users WHERE tenant_id = ?", [testTenantId]);
      await query("DELETE FROM tenants WHERE id = ?", [testTenantId]);
    }

    // Close database connection
    await closeDatabaseConnection();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("DELETE /api/root/tenants/:id", () => {
    it("should successfully initiate tenant deletion", async () => {
      const response = await request(app)
        .delete(`/api/root/tenants/${testTenantId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ reason: "Integration test deletion" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("queueId");
      expect(response.body.data.message).toContain("scheduled for deletion");

      // Verify database state
      const [tenant] = await query(
        "SELECT deletion_status FROM tenants WHERE id = ?",
        [testTenantId],
      );
      expect(tenant.deletion_status).toBe("marked_for_deletion");

      const [queueEntry] = await query(
        "SELECT * FROM tenant_deletion_queue WHERE tenant_id = ?",
        [testTenantId],
      );
      expect(queueEntry).toBeDefined();
      expect(queueEntry.status).toBe("queued");
    });

    it("should send warning email to admins", async () => {
      // Create an admin user for the tenant
      await query(
        "INSERT INTO users (tenant_id, username, email, role) VALUES (?, ?, ?, ?)",
        [testTenantId, "test-admin", "admin@test-deletion.com", "admin"],
      );

      await request(app)
        .delete(`/api/root/tenants/${testTenantId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ reason: "Test with email" });

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: expect.stringContaining("admin@test-deletion.com"),
          subject: expect.stringContaining("Löschung geplant"),
          html: expect.stringContaining("30 Tage"),
        }),
      );
    });

    it("should fail if tenant is already marked for deletion", async () => {
      // First request marks it
      await request(app)
        .delete(`/api/root/tenants/${testTenantId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ reason: "First deletion" });

      // Second request should fail
      const response = await request(app)
        .delete(`/api/root/tenants/${testTenantId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ reason: "Second deletion" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("already marked for deletion");
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .delete(`/api/root/tenants/${testTenantId}`)
        .send({ reason: "No auth" });

      expect(response.status).toBe(401);
    });

    it("should require root role", async () => {
      const nonRootToken = generateTestToken(testUserId, testTenantId, "admin");

      const response = await request(app)
        .delete(`/api/root/tenants/${testTenantId}`)
        .set("Authorization", `Bearer ${nonRootToken}`)
        .send({ reason: "Non-root attempt" });

      expect(response.status).toBe(403);
    });
  });

  describe("GET /api/root/tenants/:id/deletion-status", () => {
    beforeEach(async () => {
      // Ensure tenant is marked for deletion
      await tenantDeletionService.markTenantForDeletion(
        testTenantId,
        testUserId,
        "Status test",
      );
    });

    it("should return current deletion status", async () => {
      const response = await request(app)
        .get(`/api/root/tenants/${testTenantId}/deletion-status`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        deletion_status: "marked_for_deletion",
        progress: 0,
        status: "queued",
        grace_period_days: 30,
        days_remaining: expect.any(Number),
      });
    });

    it("should track progress during deletion", async () => {
      // Update queue to processing
      await query(
        "UPDATE tenant_deletion_queue SET status = ?, progress = ?, current_step = ? WHERE tenant_id = ?",
        ["processing", 45, "deleteDocuments", testTenantId],
      );

      const response = await request(app)
        .get(`/api/root/tenants/${testTenantId}/deletion-status`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.body.data.progress).toBe(45);
      expect(response.body.data.status).toBe("processing");
      expect(response.body.data.current_step).toBe("deleteDocuments");
    });
  });

  describe("POST /api/root/tenants/:id/cancel-deletion", () => {
    beforeEach(async () => {
      // Mark tenant for deletion
      await tenantDeletionService.markTenantForDeletion(
        testTenantId,
        testUserId,
        "Cancel test",
      );
    });

    it("should successfully cancel deletion within grace period", async () => {
      const response = await request(app)
        .post(`/api/root/tenants/${testTenantId}/cancel-deletion`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("cancelled successfully");

      // Verify database state
      const [tenant] = await query(
        "SELECT deletion_status FROM tenants WHERE id = ?",
        [testTenantId],
      );
      expect(tenant.deletion_status).toBe("active");

      const [queueEntry] = await query(
        "SELECT status FROM tenant_deletion_queue WHERE tenant_id = ? ORDER BY id DESC LIMIT 1",
        [testTenantId],
      );
      expect(queueEntry.status).toBe("cancelled");
    });

    it("should fail if grace period expired", async () => {
      // Manually set deletion date to past
      await query(
        "UPDATE tenants SET deletion_requested_at = DATE_SUB(NOW(), INTERVAL 31 DAY) WHERE id = ?",
        [testTenantId],
      );

      const response = await request(app)
        .post(`/api/root/tenants/${testTenantId}/cancel-deletion`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("grace period has expired");
    });
  });

  describe("Tenant Status Middleware", () => {
    it("should block access to suspended tenant", async () => {
      // Mark tenant as suspended
      await query("UPDATE tenants SET deletion_status = ? WHERE id = ?", [
        "suspended",
        testTenantId,
      ]);

      const response = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("suspended");
      expect(response.body.code).toBe("TENANT_SUSPENDED");
    });

    it("should allow whitelisted routes during deletion", async () => {
      await query("UPDATE tenants SET deletion_status = ? WHERE id = ?", [
        "marked_for_deletion",
        testTenantId,
      ]);

      // Deletion status endpoint should work
      const response = await request(app)
        .get(`/api/root/tenants/${testTenantId}/deletion-status`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });

    it("should add warning headers for marked tenants", async () => {
      await query(
        "UPDATE tenants SET deletion_status = ?, deletion_requested_at = NOW() WHERE id = ?",
        ["marked_for_deletion", testTenantId],
      );

      const response = await request(app)
        .get("/api/auth/user")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.headers["x-tenant-status"]).toBe("marked-for-deletion");
      expect(response.headers["x-tenant-deletion-date"]).toBeDefined();
    });
  });

  describe("Complete Deletion Flow", () => {
    it("should process deletion after grace period", async () => {
      // Create test data
      await query(
        "INSERT INTO documents (tenant_id, filename, uploaded_by) VALUES (?, ?, ?)",
        [testTenantId, "test.pdf", testUserId],
      );

      // Mark for deletion with past date
      await query(
        "UPDATE tenants SET deletion_status = ?, deletion_requested_at = DATE_SUB(NOW(), INTERVAL 31 DAY) WHERE id = ?",
        ["marked_for_deletion", testTenantId],
      );

      await query(
        "INSERT INTO tenant_deletion_queue (tenant_id, created_by, reason, created_at) VALUES (?, ?, ?, DATE_SUB(NOW(), INTERVAL 31 DAY))",
        [testTenantId, testUserId, "Flow test"],
      );

      // Mock filesystem operations
      jest.spyOn(fs, "rm").mockResolvedValue(undefined);
      jest.spyOn(fs, "mkdir").mockResolvedValue(undefined);
      jest.spyOn(fs, "writeFile").mockResolvedValue(undefined);

      // Process queue
      await tenantDeletionService.processQueue();

      // Verify tenant is gone
      const [tenant] = await query("SELECT * FROM tenants WHERE id = ?", [
        testTenantId,
      ]);
      expect(tenant).toBeUndefined();

      // Verify queue is completed
      const [queueEntry] = await query(
        "SELECT status, progress FROM tenant_deletion_queue WHERE tenant_id = ? ORDER BY id DESC LIMIT 1",
        [testTenantId],
      );
      expect(queueEntry.status).toBe("completed");
      expect(queueEntry.progress).toBe(100);

      // Verify audit trail exists
      const auditEntries = await query(
        "SELECT COUNT(*) as count FROM deletion_audit_trail WHERE tenant_id = ?",
        [testTenantId],
      );
      expect(auditEntries[0].count).toBeGreaterThan(0);
    });
  });

  describe("Error Recovery", () => {
    it("should retry failed deletion", async () => {
      // Create a failed queue entry
      const [queueResult] = await query(
        "INSERT INTO tenant_deletion_queue (tenant_id, created_by, reason, status, error_message) VALUES (?, ?, ?, ?, ?)",
        [testTenantId, testUserId, "Retry test", "failed", "Test failure"],
      );
      const queueId = (queueResult as { insertId: number }).insertId;

      const response = await request(app)
        .post(`/api/root/deletion-queue/${queueId}/retry`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify queue status reset
      const [queueEntry] = await query(
        "SELECT status, retry_count FROM tenant_deletion_queue WHERE id = ?",
        [queueId],
      );
      expect(queueEntry.status).toBe("queued");
      expect(queueEntry.retry_count).toBe(1);
    });

    it("should handle partial deletion failures", async () => {
      // Simulate a critical step failing
      jest
        .spyOn(tenantDeletionService as any, "executeStep")
        .mockImplementationOnce((step) => {
          if (step.name === "deleteTenant") {
            throw new Error("Critical step failed");
          }
          return { success: true, recordsDeleted: 1 };
        });

      // Create queue entry
      await query(
        "INSERT INTO tenant_deletion_queue (tenant_id, created_by, reason) VALUES (?, ?, ?)",
        [testTenantId, testUserId, "Partial failure test"],
      );

      await tenantDeletionService.processQueue();

      // Should be marked as failed
      const [queueEntry] = await query(
        "SELECT status, error_message FROM tenant_deletion_queue WHERE tenant_id = ? ORDER BY id DESC LIMIT 1",
        [testTenantId],
      );
      expect(queueEntry.status).toBe("failed");
      expect(queueEntry.error_message).toContain("Critical step failed");
    });
  });
});
