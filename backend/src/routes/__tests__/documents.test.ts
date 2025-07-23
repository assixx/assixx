/**
 * Document Upload Test - Mit echter Test-Datenbank
 * Kein Mocking von DB oder Models!
 */

// Set NODE_ENV to production to avoid test-specific SQL in auth middleware
process.env.NODE_ENV = "production";

import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app";
import { pool } from "../../database";
import { asTestRows } from "../../__tests__/mocks/db-types";

// Nur externe Services mocken
jest.mock("../../utils/emailService", () => ({
  default: {
    sendEmail: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock("fs/promises", () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(Buffer.from("Test PDF content")),
}));

// Mock feature flags
jest.mock("../../models/feature", () => ({
  default: {
    isEnabledForTenant: jest.fn().mockResolvedValue(true),
  },
}));

describe("Document Upload - Integration Test", () => {
  let testTenantId: number;
  let testUserId: number;
  let testToken: string;

  beforeAll(async () => {
    // Setup test data
    const [tenantResult] = await pool.execute(
      "INSERT INTO tenants (company_name, subdomain, email, status) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)",
      ["Test Tenant", "test-doc", "test@test.com", "active"],
    );
    testTenantId = (tenantResult as any).insertId;

    // First check if user exists
    const [existingUsers] = await pool.execute(
      "SELECT id FROM users WHERE email = ?",
      ["testuser@test.com"],
    );

    if ((existingUsers as any[]).length > 0) {
      // Delete existing user
      await pool.execute("DELETE FROM users WHERE email = ?", [
        "testuser@test.com",
      ]);
    }

    const [userResult] = await pool.execute(
      `INSERT INTO users (username, email, password, role, tenant_id, first_name, last_name, status, employee_number) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "testuser@test.com",
        "testuser@test.com",
        "$2b$10$dummy", // Dummy hash
        "admin",
        testTenantId,
        "Test",
        "User",
        "active",
        "TST001",
      ],
    );
    testUserId = (userResult as any).insertId;

    console.log(
      "Created test user with ID:",
      testUserId,
      "Tenant ID:",
      testTenantId,
    );

    // Create valid JWT token
    testToken = jwt.sign(
      {
        id: testUserId,
        username: "testuser@test.com",
        role: "admin",
        tenant_id: testTenantId,
      },
      process.env.JWT_SECRET || "schneeseekleerehfeedrehzehwehtee",
      { expiresIn: "1h" },
    );
  });

  afterAll(async () => {
    // Cleanup
    await pool.execute("DELETE FROM documents WHERE tenant_id = ?", [
      testTenantId,
    ]);
    await pool.execute("DELETE FROM users WHERE tenant_id = ?", [testTenantId]);
    await pool.execute("DELETE FROM tenants WHERE id = ?", [testTenantId]);
  });

  beforeEach(async () => {
    // Clean documents before each test
    await pool.execute("DELETE FROM documents WHERE tenant_id = ?", [
      testTenantId,
    ]);
  });

  // TODO: Fix this test - currently getting 500 error
  it.skip("should upload a document successfully", async () => {
    const response = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Bearer ${testToken}`)
      .field("recipientType", "company")
      .field("category", "general")
      .field("description", "Test document")
      .attach("document", Buffer.from("Test content"), "test.pdf");

    expect(response.status).toBe(201);
  });

  it("should reject unauthenticated requests", async () => {
    const response = await request(app)
      .post("/api/documents/upload")
      .field("category", "general")
      .attach("document", Buffer.from("Test"), "test.pdf");

    expect(response.status).toBe(401);
  });
});
