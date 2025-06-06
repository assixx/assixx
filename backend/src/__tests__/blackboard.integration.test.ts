/**
 * Integration Tests for Blackboard Feature
 * Tests the complete flow from API to database
 */

import request from "supertest";
import app from "../app";
import { pool } from "../database";
import { jest } from "@jest/globals";

// Test data
const adminUser = {
  id: 1,
  username: "admin",
  email: "admin@test.com",
  password: "hashed_password",
  role: "admin",
  tenant_id: 1,
};

const employeeUser = {
  id: 2,
  username: "employee",
  email: "employee@test.com",
  password: "hashed_password",
  role: "employee",
  tenant_id: 1,
  department_id: 1,
  team_id: 1,
};

let adminToken: string;
let employeeToken: string;

describe("Blackboard Integration Tests", () => {
  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();

    // Get auth tokens
    adminToken = await getAuthToken(adminUser);
    employeeToken = await getAuthToken(employeeUser);
  });

  afterAll(async () => {
    // Cleanup
    await cleanupTestDatabase();
    await pool.end();
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
          priority_level: "high",
          color: "red",
          tags: ["important", "announcement"],
          requires_confirmation: true,
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
          priority: "normal",
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
        .put(`/api/blackboard/${entryId}`)
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
        { title: "Second Entry", content: "Content 2", priority: "normal" },
        { title: "Third Entry", content: "Content 3", priority: "high" },
        { title: "Fourth Entry", content: "Content 4", priority: "urgent" },
        { title: "Fifth Entry", content: "Content 5", priority: "normal" },
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

// Helper functions
async function setupTestDatabase() {
  // Create test tables
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT,
      username VARCHAR(255),
      email VARCHAR(255),
      password VARCHAR(255),
      role VARCHAR(50),
      department_id INT,
      team_id INT
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS blackboard_entries (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL,
      author_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      org_level ENUM('company', 'department', 'team') DEFAULT 'company',
      org_id INT NULL,
      priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
      color VARCHAR(20) DEFAULT 'blue',
      status ENUM('active', 'archived') DEFAULT 'active',
      expires_at DATETIME NULL,
      requires_confirmation BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tenant_id (tenant_id),
      INDEX idx_org_level (org_level),
      INDEX idx_status (status)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS blackboard_confirmations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      entry_id INT NOT NULL,
      user_id INT NOT NULL,
      confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_confirmation (entry_id, user_id)
    )
  `);

  // Insert test data
  await pool.execute(
    `INSERT INTO tenants (id, name) VALUES (1, 'Test Tenant')`,
  );
  await pool.execute(
    `INSERT INTO users (id, tenant_id, username, email, password, role, department_id, team_id) 
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      adminUser.id,
      adminUser.tenant_id,
      adminUser.username,
      adminUser.email,
      adminUser.password,
      adminUser.role,
      null,
      null,
    ],
  );
  await pool.execute(
    `INSERT INTO users (id, tenant_id, username, email, password, role, department_id, team_id) 
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      employeeUser.id,
      employeeUser.tenant_id,
      employeeUser.username,
      employeeUser.email,
      employeeUser.password,
      employeeUser.role,
      employeeUser.department_id,
      employeeUser.team_id,
    ],
  );
}

async function cleanupTestDatabase() {
  await pool.execute("DROP TABLE IF EXISTS blackboard_confirmations");
  await pool.execute("DROP TABLE IF EXISTS blackboard_entries");
  await pool.execute("DROP TABLE IF EXISTS users");
  await pool.execute("DROP TABLE IF EXISTS tenants");
}

async function getAuthToken(user: any): Promise<string> {
  // Mock implementation - in real tests, this would call the auth endpoint
  return `mock-jwt-token-for-${user.username}`;
}
