/**
 * Integration Tests for Blackboard Model
 * Tests database operations and business logic
 * Using real database instead of mocks
 */

// Set NODE_ENV to production to avoid test-specific SQL
process.env.NODE_ENV = "production";

import { Blackboard } from "../blackboard";
import { pool } from "../../database";
import { logger } from "../../utils/logger";

// Mock only the logger
jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("Blackboard Model - Integration Test", () => {
  let testTenantId: number;
  let testUserId: number;
  let testDepartmentId: number;
  let testTeamId: number;

  beforeAll(async () => {
    // Create test tenant
    const [tenantResult] = await pool.execute(
      "INSERT INTO tenants (company_name, subdomain, email, status) VALUES (?, ?, ?, ?)",
      [
        "Blackboard Test Tenant",
        "blackboard-test",
        "blackboard@test.com",
        "active",
      ],
    );
    testTenantId = (tenantResult as any).insertId;

    // Create test department
    const [deptResult] = await pool.execute(
      "INSERT INTO departments (name, tenant_id) VALUES (?, ?)",
      ["Test Department", testTenantId],
    );
    testDepartmentId = (deptResult as any).insertId;

    // Create test team
    const [teamResult] = await pool.execute(
      "INSERT INTO teams (name, tenant_id, department_id) VALUES (?, ?, ?)",
      ["Test Team", testTenantId, testDepartmentId],
    );
    testTeamId = (teamResult as any).insertId;

    // Create test user
    const [userResult] = await pool.execute(
      `INSERT INTO users (username, email, password, role, tenant_id, first_name, last_name, status, employee_number, department_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "blackboard@test.com",
        "blackboard@test.com",
        "$2b$10$dummy",
        "admin",
        testTenantId,
        "Blackboard",
        "Test",
        "active",
        "BLK001",
        testDepartmentId,
      ],
    );
    testUserId = (userResult as any).insertId;
  });

  afterAll(async () => {
    // Cleanup in reverse order due to foreign keys
    await pool.execute("DELETE FROM blackboard_entries WHERE tenant_id = ?", [
      testTenantId,
    ]);
    await pool.execute("DELETE FROM users WHERE tenant_id = ?", [testTenantId]);
    await pool.execute("DELETE FROM teams WHERE tenant_id = ?", [testTenantId]);
    await pool.execute("DELETE FROM departments WHERE tenant_id = ?", [
      testTenantId,
    ]);
    await pool.execute("DELETE FROM tenants WHERE id = ?", [testTenantId]);
  });

  beforeEach(async () => {
    // Clean blackboard entries before each test
    await pool.execute("DELETE FROM blackboard_entries WHERE tenant_id = ?", [
      testTenantId,
    ]);
    await pool.execute("DELETE FROM blackboard_tags WHERE tenant_id = ?", [
      testTenantId,
    ]);
  });

  describe("createEntry", () => {
    it("should create a company-level entry successfully", async () => {
      const entryData = {
        tenant_id: testTenantId,
        title: "Company Announcement",
        content: "Important news",
        org_level: "company" as const,
        org_id: null,
        author_id: testUserId,
        priority: "high" as const,
        color: "red",
        tags: ["urgent", "important"],
        requires_confirmation: true,
      };

      const result = await Blackboard.createEntry(entryData);

      expect(result).toMatchObject({
        id: expect.any(Number),
        title: "Company Announcement",
        content: "Important news",
        org_level: "company",
        org_id: null,
        tenant_id: testTenantId,
        author_id: testUserId,
      });

      // Verify in database
      const [entries] = await pool.execute(
        "SELECT * FROM blackboard_entries WHERE id = ?",
        [result.id],
      );
      expect((entries as any[]).length).toBe(1);
      expect((entries as any[])[0].title).toBe("Company Announcement");
    });

    it("should create a department-level entry", async () => {
      const entryData = {
        tenant_id: testTenantId,
        title: "Department Update",
        content: "Department news",
        org_level: "department" as const,
        org_id: testDepartmentId,
        author_id: testUserId,
        priority: "medium" as const,
        color: "blue",
        tags: ["info"],
        requires_confirmation: false,
      };

      const result = await Blackboard.createEntry(entryData);

      expect(result).toMatchObject({
        id: expect.any(Number),
        title: "Department Update",
        org_level: "department",
        org_id: testDepartmentId,
      });
    });

    it("should create a team-level entry", async () => {
      const entryData = {
        tenant_id: testTenantId,
        title: "Team Meeting",
        content: "Team update",
        org_level: "team" as const,
        org_id: testTeamId,
        author_id: testUserId,
        priority: "low" as const,
        color: "green",
        tags: [],
        requires_confirmation: false,
      };

      const result = await Blackboard.createEntry(entryData);

      expect(result).toMatchObject({
        id: expect.any(Number),
        title: "Team Meeting",
        org_level: "team",
        org_id: testTeamId,
      });
    });

    it("should handle tags correctly", async () => {
      const entryData = {
        tenant_id: testTenantId,
        title: "Tagged Entry",
        content: "Entry with tags",
        org_level: "company" as const,
        org_id: null,
        author_id: testUserId,
        priority: "medium" as const,
        color: "blue",
        tags: ["tag1", "tag2", "tag3"],
        requires_confirmation: false,
      };

      const result = await Blackboard.createEntry(entryData);

      // Verify tags in database
      const [tags] = await pool.execute(
        "SELECT tag FROM blackboard_tags WHERE entry_id = ? ORDER BY tag",
        [result.id],
      );
      expect((tags as any[]).map((t) => t.tag)).toEqual([
        "tag1",
        "tag2",
        "tag3",
      ]);
    });
  });

  describe("getEntriesByOrg", () => {
    beforeEach(async () => {
      // Create test entries
      await Blackboard.createEntry({
        tenant_id: testTenantId,
        title: "Company Entry",
        content: "Company content",
        org_level: "company",
        org_id: null,
        author_id: testUserId,
        priority: "high",
        color: "red",
        tags: [],
        requires_confirmation: false,
      });

      await Blackboard.createEntry({
        tenant_id: testTenantId,
        title: "Department Entry",
        content: "Department content",
        org_level: "department",
        org_id: testDepartmentId,
        author_id: testUserId,
        priority: "medium",
        color: "blue",
        tags: [],
        requires_confirmation: false,
      });

      await Blackboard.createEntry({
        tenant_id: testTenantId,
        title: "Team Entry",
        content: "Team content",
        org_level: "team",
        org_id: testTeamId,
        author_id: testUserId,
        priority: "low",
        color: "green",
        tags: [],
        requires_confirmation: false,
      });
    });

    it("should get company-level entries", async () => {
      const entries = await Blackboard.getEntriesByOrg(testTenantId, "company");

      expect(entries.length).toBe(1);
      expect(entries[0].title).toBe("Company Entry");
      expect(entries[0].org_level).toBe("company");
    });

    it("should get department-level entries", async () => {
      const entries = await Blackboard.getEntriesByOrg(
        testTenantId,
        "department",
        testDepartmentId,
      );

      expect(entries.length).toBe(1);
      expect(entries[0].title).toBe("Department Entry");
      expect(entries[0].org_level).toBe("department");
    });

    it("should get team-level entries", async () => {
      const entries = await Blackboard.getEntriesByOrg(
        testTenantId,
        "team",
        testTeamId,
      );

      expect(entries.length).toBe(1);
      expect(entries[0].title).toBe("Team Entry");
      expect(entries[0].org_level).toBe("team");
    });
  });

  describe("updateEntry", () => {
    it("should update an entry successfully", async () => {
      // Create an entry first
      const entry = await Blackboard.createEntry({
        tenant_id: testTenantId,
        title: "Original Title",
        content: "Original content",
        org_level: "company",
        org_id: null,
        author_id: testUserId,
        priority: "low",
        color: "blue",
        tags: ["old"],
        requires_confirmation: false,
      });

      // Update the entry
      const updated = await Blackboard.updateEntry(entry.id, testTenantId, {
        title: "Updated Title",
        content: "Updated content",
        priority: "high",
        color: "red",
        tags: ["new", "updated"],
      });

      expect(updated).toMatchObject({
        id: entry.id,
        title: "Updated Title",
        content: "Updated content",
        priority: "high",
        color: "red",
      });

      // Verify tags were updated
      const [tags] = await pool.execute(
        "SELECT tag FROM blackboard_tags WHERE entry_id = ? ORDER BY tag",
        [entry.id],
      );
      expect((tags as any[]).map((t) => t.tag)).toEqual(["new", "updated"]);
    });
  });

  describe("deleteEntry", () => {
    it("should delete an entry", async () => {
      // Create an entry
      const entry = await Blackboard.createEntry({
        tenant_id: testTenantId,
        title: "To Delete",
        content: "Will be deleted",
        org_level: "company",
        org_id: null,
        author_id: testUserId,
        priority: "low",
        color: "blue",
        tags: ["delete-me"],
        requires_confirmation: false,
      });

      // Delete the entry
      const result = await Blackboard.deleteEntry(entry.id, testTenantId);
      expect(result).toBe(true);

      // Verify it's deleted
      const [entries] = await pool.execute(
        "SELECT * FROM blackboard_entries WHERE id = ?",
        [entry.id],
      );
      expect((entries as any[]).length).toBe(0);

      // Verify tags are also deleted
      const [tags] = await pool.execute(
        "SELECT * FROM blackboard_tags WHERE entry_id = ?",
        [entry.id],
      );
      expect((tags as any[]).length).toBe(0);
    });
  });
});
