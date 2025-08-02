/**
 * Integration Tests for TenantDeletionService
 * Tests the complete tenant deletion workflow
 * Using real database instead of mocks
 */

// Set NODE_ENV to production to avoid test-specific SQL
process.env.NODE_ENV = "production";

import { tenantDeletionService } from "../tenantDeletion.service";
import { pool } from "../../database";
import { logger } from "../../utils/logger";
import { emailService } from "../../utils/emailService";
import { getRedisClient } from "../../config/redis";
import * as fs from "fs/promises";

// Mock only external services, not database
jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));
jest.mock("../../utils/emailService");
jest.mock("../../config/redis");
jest.mock("fs/promises");

// Mock Redis client
const mockRedisClient = {
  keys: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
};

describe("TenantDeletionService - Integration Test", () => {
  let testTenantId: number;
  let testUserId: number;
  let testDeleteTenantId: number;

  beforeAll(async () => {
    // Create test tenant that won't be deleted
    const [tenantResult] = await pool.execute(
      "INSERT INTO tenants (company_name, subdomain, email, status) VALUES (?, ?, ?, ?)",
      ["Deletion Test Tenant", "deletion-test", "deletion@test.com", "active"],
    );
    testTenantId = (tenantResult as any).insertId;

    // Create test user
    const [userResult] = await pool.execute(
      `INSERT INTO users (username, email, password, role, tenant_id, first_name, last_name, status, employee_number) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "deltest@test.com",
        "deltest@test.com",
        "$2b$10$dummy",
        "root",
        testTenantId,
        "Deletion",
        "Test",
        "active",
        "DEL001",
      ],
    );
    testUserId = (userResult as any).insertId;
  });

  afterAll(async () => {
    // Cleanup permanent test data
    await pool.execute("DELETE FROM users WHERE tenant_id = ?", [testTenantId]);
    await pool.execute("DELETE FROM tenants WHERE id = ?", [testTenantId]);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    (getRedisClient as jest.Mock).mockResolvedValue(mockRedisClient);

    // Create a tenant to be deleted in each test
    const [deleteTenantResult] = await pool.execute(
      "INSERT INTO tenants (company_name, subdomain, email, status, deletion_status) VALUES (?, ?, ?, ?, ?)",
      ["To Delete Company", "to-delete", "delete@test.com", "active", "active"],
    );
    testDeleteTenantId = (deleteTenantResult as any).insertId;
  });

  afterEach(async () => {
    // Cleanup test data
    await pool.execute("DELETE FROM tenant_deletion_logs WHERE tenant_id = ?", [
      testDeleteTenantId,
    ]);
    await pool.execute(
      "DELETE FROM tenant_deletion_queue WHERE tenant_id = ?",
      [testDeleteTenantId],
    );
    await pool.execute("DELETE FROM tenants WHERE id = ?", [
      testDeleteTenantId,
    ]);
  });

  describe("markTenantForDeletion", () => {
    it("should successfully mark tenant for deletion", async () => {
      const reason = "Test deletion";

      const result = await tenantDeletionService.markTenantForDeletion(
        testDeleteTenantId,
        testUserId,
        reason,
      );

      expect(result.success).toBe(true);
      expect(result.queueId).toBeDefined();
      expect(result.message).toContain("scheduled for deletion");

      // Verify tenant was marked in database
      const [tenants] = await pool.execute(
        "SELECT deletion_status FROM tenants WHERE id = ?",
        [testDeleteTenantId],
      );
      expect((tenants as any[])[0].deletion_status).toBe("marked_for_deletion");

      // Verify queue entry was created
      const [queueEntries] = await pool.execute(
        "SELECT * FROM tenant_deletion_queue WHERE tenant_id = ?",
        [testDeleteTenantId],
      );
      expect((queueEntries as any[]).length).toBe(1);
    });

    it("should fail if tenant is already marked for deletion", async () => {
      // First mark for deletion
      await pool.execute(
        "UPDATE tenants SET deletion_status = 'marked_for_deletion' WHERE id = ?",
        [testDeleteTenantId],
      );

      // Try to mark again
      await expect(
        tenantDeletionService.markTenantForDeletion(
          testDeleteTenantId,
          testUserId,
          "Duplicate attempt",
        ),
      ).rejects.toThrow("already scheduled for deletion");
    });

    it("should fail if tenant does not exist", async () => {
      await expect(
        tenantDeletionService.markTenantForDeletion(
          99999, // Non-existent tenant
          testUserId,
          "Test deletion",
        ),
      ).rejects.toThrow("Tenant not found");
    });
  });

  describe("processDeletionQueue", () => {
    beforeEach(async () => {
      // Mock fs operations
      (fs.readdir as jest.Mock).mockResolvedValue([]);
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);
      (fs.rm as jest.Mock).mockResolvedValue(undefined);

      // Mock Redis operations
      mockRedisClient.keys.mockResolvedValue([]);
      mockRedisClient.del.mockResolvedValue(1);
    });

    it("should process tenant deletion successfully", async () => {
      // Mark tenant for deletion
      await pool.execute(
        "UPDATE tenants SET deletion_status = 'marked_for_deletion' WHERE id = ?",
        [testDeleteTenantId],
      );

      // Add to queue
      const [queueResult] = await pool.execute(
        "INSERT INTO tenant_deletion_queue (tenant_id, requested_by, reason, status) VALUES (?, ?, ?, ?)",
        [testDeleteTenantId, testUserId, "Test deletion", "pending"],
      );
      const queueId = (queueResult as any).insertId;

      // Process the queue
      const result = await tenantDeletionService.processDeletionQueue();

      expect(result.processed).toBe(1);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);

      // Verify tenant is marked as suspended
      const [tenants] = await pool.execute(
        "SELECT deletion_status FROM tenants WHERE id = ?",
        [testDeleteTenantId],
      );
      expect((tenants as any[])[0].deletion_status).toBe("suspended");

      // Verify queue status is updated
      const [queueEntries] = await pool.execute(
        "SELECT status FROM tenant_deletion_queue WHERE id = ?",
        [queueId],
      );
      expect((queueEntries as any[])[0].status).toBe("completed");
    });

    it("should handle deletion errors gracefully", async () => {
      // Mark tenant for deletion but create a condition that will cause failure
      await pool.execute(
        "UPDATE tenants SET deletion_status = 'marked_for_deletion' WHERE id = ?",
        [testDeleteTenantId],
      );

      // Add to queue
      await pool.execute(
        "INSERT INTO tenant_deletion_queue (tenant_id, requested_by, reason, status) VALUES (?, ?, ?, ?)",
        [testDeleteTenantId, testUserId, "Test deletion", "pending"],
      );

      // Mock a failure in Redis operations
      mockRedisClient.keys.mockRejectedValue(
        new Error("Redis connection failed"),
      );

      // Process the queue
      const result = await tenantDeletionService.processDeletionQueue();

      expect(result.processed).toBe(1);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);
    });
  });

  describe("cancelDeletion", () => {
    it("should cancel scheduled deletion", async () => {
      // Mark tenant for deletion
      await pool.execute(
        "UPDATE tenants SET deletion_status = 'marked_for_deletion' WHERE id = ?",
        [testDeleteTenantId],
      );

      // Add to queue
      const [queueResult] = await pool.execute(
        "INSERT INTO tenant_deletion_queue (tenant_id, requested_by, reason, status) VALUES (?, ?, ?, ?)",
        [testDeleteTenantId, testUserId, "Test deletion", "pending"],
      );
      const queueId = (queueResult as any).insertId;

      // Cancel deletion
      const result = await tenantDeletionService.cancelDeletion(
        testDeleteTenantId,
        testUserId,
        "Changed our mind",
      );

      expect(result.success).toBe(true);

      // Verify tenant status is restored
      const [tenants] = await pool.execute(
        "SELECT deletion_status FROM tenants WHERE id = ?",
        [testDeleteTenantId],
      );
      expect((tenants as any[])[0].deletion_status).toBe("active");

      // Verify queue entry is cancelled
      const [queueEntries] = await pool.execute(
        "SELECT status FROM tenant_deletion_queue WHERE id = ?",
        [queueId],
      );
      expect((queueEntries as any[])[0].status).toBe("cancelled");
    });

    it("should fail if deletion not found", async () => {
      await expect(
        tenantDeletionService.cancelDeletion(
          testDeleteTenantId,
          testUserId,
          "Cancel non-existent",
        ),
      ).rejects.toThrow("No pending deletion found");
    });
  });
});
