/**
 * API Tests for Tenant Signup/Registration
 * Tests tenant creation, subdomain validation, and admin user setup
 */

import request from "supertest";
import express from "express";
import { Pool } from "mysql2/promise";
import app from "../../app"; // We'll need to export the app
import { cleanupTestData, createTestDatabase } from "../mocks/database";
import { asTestRows } from "../../__tests__/mocks/db-types";

// Test data
const validSignupData = {
  company_name: "Test Company GmbH",
  subdomain: "testcompany",
  email: "info@testcompany.de",
  phone: "+491234567890",
  admin_email: "admin@testcompany.de",
  admin_password: "SecurePass123!",
  admin_first_name: "Max",
  admin_last_name: "Mustermann",
  selectedPlan: "basic",
};

describe("Signup API Endpoints", () => {
  let testDb: Pool;

  beforeAll(async () => {
    // Set up test database
    testDb = await createTestDatabase();
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "test-secret-key";
  });

  afterAll(async () => {
    // Clean up
    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Clear test data in correct order to respect foreign key constraints
    // First delete dependent data from existing tables
    await testDb.execute(
      "DELETE FROM oauth_tokens WHERE user_id IN (SELECT id FROM users WHERE tenant_id > 1)",
    );
    await testDb.execute(
      "DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE tenant_id > 1)",
    );
    await testDb.execute(
      "DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE tenant_id > 1)",
    );
    await testDb.execute(
      "DELETE FROM user_settings WHERE user_id IN (SELECT id FROM users WHERE tenant_id > 1)",
    );
    await testDb.execute(
      "DELETE FROM user_2fa_secrets WHERE user_id IN (SELECT id FROM users WHERE tenant_id > 1)",
    );
    await testDb.execute(
      "DELETE FROM user_2fa_backup_codes WHERE user_id IN (SELECT id FROM users WHERE tenant_id > 1)",
    );
    await testDb.execute(
      "DELETE FROM user_chat_status WHERE user_id IN (SELECT id FROM users WHERE tenant_id > 1)",
    );
    await testDb.execute(
      "DELETE FROM user_teams WHERE user_id IN (SELECT id FROM users WHERE tenant_id > 1)",
    );
    await testDb.execute(
      "DELETE FROM notification_preferences WHERE user_id IN (SELECT id FROM users WHERE tenant_id > 1)",
    );
    await testDb.execute(
      "DELETE FROM blackboard_confirmations WHERE user_id IN (SELECT id FROM users WHERE tenant_id > 1)",
    );
    await testDb.execute(
      "DELETE FROM kvp_comments WHERE user_id IN (SELECT id FROM users WHERE tenant_id > 1)",
    );

    // Then delete users and tenants
    await testDb.execute("DELETE FROM users WHERE tenant_id > 1");
    await testDb.execute("DELETE FROM tenants WHERE id > 1");
  });

  describe("POST /api/signup", () => {
    it("should successfully create a new tenant with admin user", async () => {
      const response = await request(app)
        .post("/api/signup")
        .send(validSignupData);

      console.info("Response status:", response.status);
      console.info("Response body:", JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          success: true,
          subdomain: "testcompany",
          message: expect.stringContaining("erfolgreich"),
        },
      });

      // Verify tenant was created in database
      const [rows] = await testDb.execute(
        "SELECT * FROM tenants WHERE subdomain = ?",
        [validSignupData.subdomain],
      );
      const tenants = asTestRows<any>(rows);
      expect(tenants).toHaveLength(1);
      expect(tenants[0]).toMatchObject({
        company_name: validSignupData.company_name,
        subdomain: validSignupData.subdomain,
        status: "trial", // New tenants start with trial status
      });

      // Verify admin user was created
      const tenantId = tenants[0].id;

      // Debug: Check all users for this tenant
      const [allUserRows] = await testDb.execute(
        "SELECT * FROM users WHERE tenant_id = ?",
        [tenantId],
      );
      const allUsers = asTestRows<any>(allUserRows);
      console.info("All users for tenant:", allUsers);

      const [userRows] = await testDb.execute(
        "SELECT * FROM users WHERE tenant_id = ? AND role = 'admin'",
        [tenantId],
      );
      const users = asTestRows<any>(userRows);
      expect(users).toHaveLength(1);
      expect(users[0]).toMatchObject({
        email: validSignupData.admin_email,
        first_name: validSignupData.admin_first_name,
        last_name: validSignupData.admin_last_name,
        role: "admin",
        tenant_id: tenantId,
      });
    });

    it("should set trial period for new tenants", async () => {
      const response = await request(app)
        .post("/api/signup")
        .send({
          ...validSignupData,
          subdomain: "trialcompany",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.trialEndsAt).toBeDefined();

      // Verify trial end date is set
      const [rows] = await testDb.execute(
        "SELECT trial_ends_at FROM tenants WHERE subdomain = ?",
        ["trialcompany"],
      );
      const tenants = asTestRows<any>(rows);
      expect(tenants[0].trial_ends_at).toBeTruthy();

      // Trial should be approximately 30 days from now
      const trialEndDate = new Date(tenants[0].trial_ends_at);
      const now = new Date();
      const daysDifference = Math.round(
        (trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      expect(daysDifference).toBeGreaterThanOrEqual(29);
      expect(daysDifference).toBeLessThanOrEqual(30);
    });

    it("should reject duplicate subdomain", async () => {
      // First signup
      await request(app).post("/api/signup").send(validSignupData);

      // Attempt duplicate
      const response = await request(app)
        .post("/api/signup")
        .send(validSignupData);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
      });
      // Check if error message exists (exact wording may vary)
      expect(response.body.message).toBeDefined();
      expect(response.body.message.toLowerCase()).toContain("subdomain");
    });

    it("should validate required fields", async () => {
      const invalidData = {
        company_name: "",
        subdomain: "test",
        email: "invalid-email",
        admin_password: "short",
      };

      const response = await request(app).post("/api/signup").send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "company_name" }),
          expect.objectContaining({ path: "email" }),
          expect.objectContaining({ path: "admin_password" }),
          expect.objectContaining({ path: "phone" }),
        ]),
      );
    });

    it("should validate subdomain format", async () => {
      const testCases = [
        { subdomain: "Test-Company", valid: false }, // uppercase
        { subdomain: "test company", valid: false }, // space
        { subdomain: "test_company", valid: false }, // underscore
        { subdomain: "test.company", valid: false }, // dot
        { subdomain: "test-company", valid: true }, // valid
        { subdomain: "testcompany123", valid: true }, // valid with numbers
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post("/api/signup")
          .send({
            ...validSignupData,
            subdomain: testCase.subdomain,
          });

        if (testCase.valid) {
          expect(response.status).toBe(200);
        } else {
          expect(response.status).toBe(400);
        }
      }
    });

    it("should validate phone number format", async () => {
      const invalidPhones = [
        "1234567890", // no country code
        "+49 123 456", // too short
        "049-123-456789", // wrong format
        "+1234567890123456789012345678901", // too long
      ];

      for (const phone of invalidPhones) {
        const response = await request(app)
          .post("/api/signup")
          .send({
            ...validSignupData,
            phone,
            subdomain: `test${Date.now()}`,
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ path: "phone" })]),
        );
      }
    });

    it.skip("should handle database errors gracefully", async () => {
      // Skip this test - it requires mocking which doesn't work with real DB
      // In production, DB errors are handled by the error middleware
    });

    it("should create tenant-specific database entries", async () => {
      const response = await request(app)
        .post("/api/signup")
        .send({
          ...validSignupData,
          subdomain: "dbtest",
        });

      expect(response.status).toBe(200);

      const [rows] = await testDb.execute(
        "SELECT id FROM tenants WHERE subdomain = ?",
        ["dbtest"],
      );
      const tenants = asTestRows<any>(rows);
      const tenantId = tenants[0].id;

      // Check default department was created
      const [deptRows] = await testDb.execute(
        "SELECT * FROM departments WHERE tenant_id = ?",
        [tenantId],
      );
      const departments = asTestRows<any>(deptRows);
      expect(departments.length).toBeGreaterThan(0);
      expect(departments[0].name).toBe("Allgemein");

      // Check feature flags were initialized
      const [featureRows] = await testDb.execute(
        "SELECT * FROM tenant_features WHERE tenant_id = ?",
        [tenantId],
      );
      const features = asTestRows<any>(featureRows);
      expect(features.length).toBeGreaterThan(0);
    });
  });

  describe("GET /api/check-subdomain/:subdomain", () => {
    beforeEach(async () => {
      // Create a test tenant
      await testDb.execute(
        "INSERT INTO tenants (company_name, subdomain, email, status) VALUES (?, ?, ?, ?)",
        ["Existing Company", "existing", "info@existing.de", "active"],
      );
    });

    it("should return available for unused subdomain", async () => {
      const response = await request(app).get(
        "/api/check-subdomain/newcompany",
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          available: true,
        },
      });
    });

    it("should return unavailable for existing subdomain", async () => {
      const response = await request(app).get("/api/check-subdomain/existing");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          available: false,
        },
      });
    });

    it("should validate subdomain format", async () => {
      const response = await request(app).get(
        "/api/check-subdomain/Invalid-Subdomain",
      );

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        available: false,
        error: expect.stringContaining("Subdomain"),
      });
    });

    it("should reject reserved subdomains", async () => {
      const reservedSubdomains = ["admin", "api", "www", "mail", "ftp"];

      for (const subdomain of reservedSubdomains) {
        const response = await request(app).get(
          `/api/check-subdomain/${subdomain}`,
        );

        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({
          available: false,
          error: expect.any(String),
        });
      }
    });

    it("should handle special characters in URL", async () => {
      const response = await request(app).get(
        "/api/check-subdomain/test%20company",
      );

      expect(response.status).toBe(400);
    });
  });

  describe("Multi-Tenant Isolation", () => {
    it("should ensure complete tenant isolation on signup", async () => {
      // Create first tenant
      const tenant1Response = await request(app)
        .post("/api/signup")
        .send({
          ...validSignupData,
          subdomain: "tenant1",
          admin_email: "admin@tenant1.de",
        });

      expect(tenant1Response.status).toBe(200);

      // Create second tenant
      const tenant2Response = await request(app)
        .post("/api/signup")
        .send({
          ...validSignupData,
          subdomain: "tenant2",
          admin_email: "admin@tenant2.de",
        });

      expect(tenant2Response.status).toBe(200);

      // Verify users are isolated
      const [tenant1Rows] = await testDb.execute(
        "SELECT id FROM tenants WHERE subdomain = ?",
        ["tenant1"],
      );
      const tenant1 = asTestRows<any>(tenant1Rows);
      const [tenant2Rows] = await testDb.execute(
        "SELECT id FROM tenants WHERE subdomain = ?",
        ["tenant2"],
      );
      const tenant2 = asTestRows<any>(tenant2Rows);

      const [users1Rows] = await testDb.execute(
        "SELECT * FROM users WHERE tenant_id = ?",
        [tenant1[0].id],
      );
      const users1 = asTestRows<any>(users1Rows);
      const [users2Rows] = await testDb.execute(
        "SELECT * FROM users WHERE tenant_id = ?",
        [tenant2[0].id],
      );
      const users2 = asTestRows<any>(users2Rows);

      // Each tenant should have exactly one admin user
      expect(users1).toHaveLength(1);
      expect(users2).toHaveLength(1);

      // Users should have different tenant IDs
      expect(users1[0].tenant_id).not.toBe(users2[0].tenant_id);
    });
  });

  describe("Rate Limiting", () => {
    it("should rate limit signup attempts", async () => {
      // Make multiple rapid requests
      const requests = Array(6)
        .fill(null)
        .map((_, i) =>
          request(app)
            .post("/api/signup")
            .send({
              ...validSignupData,
              subdomain: `ratelimit${i}`,
              admin_email: `admin${i}@test.de`,
            }),
        );

      const responses = await Promise.all(requests);

      // First 5 should succeed or fail normally
      const successCount = responses
        .slice(0, 5)
        .filter((r) => r.status !== 429).length;
      expect(successCount).toBe(5);

      // 6th should be rate limited
      expect(responses[5].status).toBe(429);
    });

    it("should rate limit subdomain checks", async () => {
      // Make multiple rapid requests
      const requests = Array(11)
        .fill(null)
        .map(() => request(app).get("/api/check-subdomain/testsubdomain"));

      const responses = await Promise.all(requests);

      // Last request should be rate limited
      const rateLimited = responses.filter((r) => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});
