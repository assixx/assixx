/**
 * Unit Tests for Blackboard Model
 * Tests database operations and business logic
 */

import { jest } from "@jest/globals";
import { Blackboard } from "../blackboard";
import User from "../user";
import { logger } from "../../utils/logger";

// Mock the centralized db utilities before importing
jest.mock("../../utils/db", () => ({
  query: jest.fn(),
  execute: jest.fn(),
  getConnection: jest.fn(),
  transaction: jest.fn(),
}));

import { query } from "../../utils/db";

// Cast query to jest.Mock for easier use
const mockQuery = query as jest.Mock;

// Mock dependencies
jest.mock("../user");
jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("Blackboard Model", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createEntry", () => {
    it("should create a company-level entry successfully", async () => {
      const entryData = {
        tenant_id: 1,
        title: "Company Announcement",
        content: "Important news",
        org_level: "company" as const,
        org_id: null,
        author_id: 1,
        priority: "high" as const,
        color: "red",
        tags: ["urgent", "important"],
        requires_confirmation: true,
      };

      // Mock database responses
      mockQuery
        .mockResolvedValueOnce([[{ insertId: 123 }], []]) // INSERT query
        .mockResolvedValueOnce([[], []]) // Tags query
        .mockResolvedValueOnce([
          [
            {
              id: 123,
              ...entryData,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
          [],
        ]); // SELECT query

      const result = await Blackboard.createEntry(entryData);

      expect(result).toMatchObject({
        id: 123,
        title: "Company Announcement",
        org_level: "company",
        org_id: null,
      });

      // Verify INSERT query was called correctly
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO blackboard_entries"),
        [
          1,
          "Company Announcement",
          "Important news",
          "company",
          null,
          1,
          null,
          "high",
          "red",
          1,
        ],
      );
    });

    it("should create a department-level entry", async () => {
      const entryData = {
        tenant_id: 1,
        title: "Department Update",
        content: "Department news",
        org_level: "department" as const,
        org_id: 5,
        author_id: 2,
        priority: "normal" as const,
        color: "blue",
      };

      mockQuery
        .mockResolvedValueOnce([[{ insertId: 124 }], []])
        .mockResolvedValueOnce([[{ id: 124, ...entryData }], []]);

      const result = await Blackboard.createEntry(entryData);

      expect(result).toMatchObject({
        id: 124,
        org_level: "department",
        org_id: 5,
      });
    });

    it("should create a team-level entry", async () => {
      const entryData = {
        tenant_id: 1,
        title: "Team Meeting",
        content: "Weekly sync",
        org_level: "team" as const,
        org_id: 10,
        author_id: 3,
        priority: "low" as const,
      };

      mockQuery
        .mockResolvedValueOnce([[{ insertId: 125 }], []])
        .mockResolvedValueOnce([[{ id: 125 }], []]);

      await Blackboard.createEntry(entryData);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1, "Team Meeting", "Weekly sync", "team", 10]),
      );
    });

    it("should reject when missing required fields", async () => {
      const invalidData = {
        tenant_id: 1,
        title: "Missing Content",
        // Missing content, org_level, author_id
      } as any;

      await expect(Blackboard.createEntry(invalidData)).rejects.toThrow(
        "Missing required fields",
      );
    });

    it("should reject when org_id missing for department level", async () => {
      const invalidData = {
        tenant_id: 1,
        title: "Department Entry",
        content: "Content",
        org_level: "department" as const,
        org_id: null, // Should not be null for department
        author_id: 1,
      };

      await expect(Blackboard.createEntry(invalidData)).rejects.toThrow(
        "org_id is required for department or team level entries",
      );
    });

    it("should handle tags correctly", async () => {
      const entryData = {
        tenant_id: 1,
        title: "Tagged Entry",
        content: "Content with tags",
        org_level: "company" as const,
        org_id: null,
        author_id: 1,
        tags: ["tag1", "tag2", "tag3"],
      };

      mockQuery
        .mockResolvedValueOnce([[{ insertId: 126 }], []])
        .mockResolvedValueOnce([[], []]) // addTagsToEntry
        .mockResolvedValueOnce([[{ id: 126 }], []]);

      await Blackboard.createEntry(entryData);

      // Should call addTagsToEntry
      expect(Blackboard.addTagsToEntry).toHaveBeenCalledWith(
        126,
        ["tag1", "tag2", "tag3"],
        1,
      );
    });

    it("should set default values correctly", async () => {
      const minimalEntry = {
        tenant_id: 1,
        title: "Minimal",
        content: "Content",
        org_level: "company" as const,
        org_id: null,
        author_id: 1,
      };

      mockQuery
        .mockResolvedValueOnce([[{ insertId: 127 }], []])
        .mockResolvedValueOnce([[{ id: 127 }], []]);

      await Blackboard.createEntry(minimalEntry);

      // Check defaults were applied
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          1,
          "Minimal",
          "Content",
          "company",
          null,
          1,
          null, // expires_at default
          "normal", // priority default
          "blue", // color default
          0, // requires_confirmation default (false)
        ]),
      );
    });
  });

  describe("getAllEntries", () => {
    it("should fetch entries for admin user", async () => {
      const mockUserId = 1;
      const mockTenantId = 1;

      // Mock user role check
      (User.getUserDepartmentAndTeam as jest.Mock).mockResolvedValue({
        role: "admin",
        departmentId: null,
        teamId: null,
      });

      // Mock database results
      mockQuery
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              title: "Entry 1",
              content: Buffer.from("Content 1"),
              org_level: "company",
              priority: "high",
            },
            {
              id: 2,
              title: "Entry 2",
              content: {
                type: "Buffer",
                data: [67, 111, 110, 116, 101, 110, 116],
              }, // "Content"
              org_level: "department",
              priority: "normal",
            },
          ],
          [],
        ])
        .mockResolvedValueOnce([[{ total: 2 }], []]);

      const result = await Blackboard.getAllEntries(mockTenantId, mockUserId);

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].content).toBe("Content 1"); // Buffer converted to string
      expect(result.entries[1].content).toBe("Content"); // Buffer object converted
      expect(result.pagination.total).toBe(2);
    });

    it("should apply access control for non-admin users", async () => {
      const mockUserId = 2;
      const mockTenantId = 1;

      // Mock user as department head
      (User.getUserDepartmentAndTeam as jest.Mock).mockResolvedValue({
        role: "department_head",
        departmentId: 5,
        teamId: 10,
      });

      mockQuery
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ total: 0 }], []]);

      await Blackboard.getAllEntries(mockTenantId, mockUserId);

      // Verify access control was applied in query
      const query = mockQuery.mock.calls[0][0];
      expect(query).toContain("e.org_level = 'company'");
      expect(query).toContain("e.org_level = 'department' AND e.org_id = ?");
      expect(query).toContain("e.org_level = 'team' AND e.org_id = ?");
    });

    it("should handle pagination correctly", async () => {
      (User.getUserDepartmentAndTeam as jest.Mock).mockResolvedValue({
        role: "admin",
        departmentId: null,
        teamId: null,
      });

      mockQuery
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ total: 100 }], []]);

      const result = await Blackboard.getAllEntries(1, 1, {
        page: 3,
        limit: 20,
      });

      // Check LIMIT and OFFSET in query
      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall[1]).toContain(20); // LIMIT
      expect(queryCall[1]).toContain(40); // OFFSET (page 3, limit 20)

      expect(result.pagination).toEqual({
        total: 100,
        page: 3,
        limit: 20,
        totalPages: 5,
      });
    });

    it("should handle search correctly", async () => {
      (User.getUserDepartmentAndTeam as jest.Mock).mockResolvedValue({
        role: "admin",
        departmentId: null,
        teamId: null,
      });

      mockQuery
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ total: 0 }], []]);

      await Blackboard.getAllEntries(1, 1, {
        search: "important meeting",
      });

      const query = mockQuery.mock.calls[0][0];
      expect(query).toContain("e.title LIKE ? OR e.content LIKE ?");

      const params = mockQuery.mock.calls[0][1];
      expect(params).toContain("%important meeting%");
    });

    it("should handle filter by org_level", async () => {
      (User.getUserDepartmentAndTeam as jest.Mock).mockResolvedValue({
        role: "admin",
        departmentId: null,
        teamId: null,
      });

      mockQuery
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ total: 0 }], []]);

      await Blackboard.getAllEntries(1, 1, {
        filter: "department",
      });

      const query = mockQuery.mock.calls[0][0];
      expect(query).toContain("AND e.org_level = ?");

      const params = mockQuery.mock.calls[0][1];
      expect(params).toContain("department");
    });
  });

  describe("updateEntry", () => {
    it("should update all fields correctly", async () => {
      const updateData = {
        title: "Updated Title",
        content: "Updated Content",
        org_level: "department" as const,
        org_id: 5,
        priority: "urgent" as const,
        color: "yellow",
        status: "archived" as const,
        requires_confirmation: true,
        tags: ["updated", "new"],
      };

      mockQuery
        .mockResolvedValueOnce([[], []]) // UPDATE query
        .mockResolvedValueOnce([[], []]) // DELETE tags
        .mockResolvedValueOnce([[], []]) // INSERT tags
        .mockResolvedValueOnce([[{ id: 1, ...updateData }], []]);

      const result = await Blackboard.updateEntry(1, updateData, 1);

      expect(result).toMatchObject(updateData);

      // Verify UPDATE query
      const updateQuery = mockQuery.mock.calls[0];
      expect(updateQuery[0]).toContain("UPDATE blackboard_entries SET");
      expect(updateQuery[1]).toContain("Updated Title");
      expect(updateQuery[1]).toContain("Updated Content");
      expect(updateQuery[1]).toContain("urgent");
    });

    it("should update only provided fields", async () => {
      const partialUpdate = {
        title: "Only Title Updated",
      };

      mockQuery
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1, title: "Only Title Updated" }], []]);

      await Blackboard.updateEntry(1, partialUpdate, 1);

      const updateQuery = mockQuery.mock.calls[0];
      expect(updateQuery[0]).toContain("title = ?");
      expect(updateQuery[0]).not.toContain("content = ?");
      expect(updateQuery[0]).not.toContain("priority = ?");
    });
  });

  describe("deleteEntry", () => {
    it("should delete entry successfully", async () => {
      mockQuery.mockResolvedValueOnce([[{ affectedRows: 1 }], []]);

      const result = await Blackboard.deleteEntry(1, 1);

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        "DELETE FROM blackboard_entries WHERE id = ? AND tenant_id = ?",
        [1, 1],
      );
    });

    it("should return false if entry not found", async () => {
      mockQuery.mockResolvedValueOnce([[{ affectedRows: 0 }], []]);

      const result = await Blackboard.deleteEntry(999, 1);

      expect(result).toBe(false);
    });
  });

  describe("confirmEntry", () => {
    it("should confirm entry successfully", async () => {
      // Mock checking if entry requires confirmation
      mockQuery
        .mockResolvedValueOnce([[{ requires_confirmation: 1 }], []]) // SELECT query
        .mockResolvedValueOnce([[{ insertId: 1 }], []]); // INSERT confirmation

      const result = await Blackboard.confirmEntry(1, 1);

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO blackboard_confirmations"),
        [1, 1],
      );
    });

    it("should return false if entry does not require confirmation", async () => {
      mockQuery.mockResolvedValueOnce([[{ requires_confirmation: 0 }], []]);

      const result = await Blackboard.confirmEntry(1, 1);

      expect(result).toBe(false);
    });

    it("should handle duplicate confirmation gracefully", async () => {
      mockQuery
        .mockResolvedValueOnce([[{ requires_confirmation: 1 }], []])
        .mockRejectedValueOnce({ code: "ER_DUP_ENTRY" });

      const result = await Blackboard.confirmEntry(1, 1);

      expect(result).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should log errors and rethrow", async () => {
      const dbError = new Error("Database connection lost");
      mockQuery.mockRejectedValue(dbError);

      await expect(Blackboard.getAllEntries(1, 1)).rejects.toThrow(
        "Database connection lost",
      );
      expect(logger.error).toHaveBeenCalledWith(
        "Error in getAllEntries:",
        dbError,
      );
    });
  });
});
