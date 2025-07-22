/**
 * API Tests for Document Management
 * Tests document upload, download, listing, and multi-tenant isolation
 */

// Prevent database connection attempts
process.env.DB_HOST = "mock";
process.env.NODE_ENV = "test";
process.env.DB_NAME = "test_db";
process.env.DB_USER = "test";
process.env.DB_PASS = "test";

// Mock multer BEFORE any imports
jest.mock("multer", () => {
  const multerMock = {
    single: jest.fn(() => (req: any, _res: any, next: any) => {
      // Simulate file upload - using any here is acceptable for mocks
      req.file = {
        fieldname: "file",
        originalname: req.body?.filename || "test-document.pdf",
        encoding: "7bit",
        mimetype: req.body?.mimetype || "application/pdf",
        destination: "/tmp/uploads",
        filename: `${Date.now()}-test-document.pdf`,
        path: `/tmp/uploads/${Date.now()}-test-document.pdf`,
        size: parseInt(req.body?.filesize) || 1000,
      };
      next();
    }),
    array: jest.fn(() => (req: any, _res: any, next: any) => {
      // Simulate multiple file upload
      req.files = [];
      next();
    }),
    none: jest.fn(() => (_req: any, _res: any, next: any) => {
      next();
    }),
    fields: jest.fn(() => (_req: any, _res: any, next: any) => {
      next();
    }),
    any: jest.fn(() => (_req: any, _res: any, next: any) => {
      next();
    }),
  };
  
  const multerFunc = jest.fn(() => multerMock);
  multerFunc.diskStorage = jest.fn(() => ({
    destination: jest.fn(),
    filename: jest.fn(),
  }));
  
  return {
    default: multerFunc,
    __esModule: true,
  };
});

// Mock database connection
jest.mock("../../database", () => ({
  pool: {
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn().mockResolvedValue({
      execute: jest.fn(),
      release: jest.fn(),
    }),
    end: jest.fn().mockResolvedValue(undefined),
  },
  executeQuery: jest.fn(),
}));

// Mock auth middleware
jest.mock("../../middleware/auth-refactored", () => ({
  authenticateToken: jest.fn((req: any, _res: any, next: any) => {
    // Extract token from header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer test-token-")) {
      const username = authHeader.replace("Bearer test-token-", "");
      // Set user based on token
      req.user = {
        id: username === "admin1" ? 1 : username === "admin2" ? 2 : 3,
        username,
        role: username.includes("admin") ? "admin" : "employee",
        tenant_id: username.includes("1") ? 1 : 2,
        tenantId: username.includes("1") ? 1 : 2,
      };
    }
    next();
  }),
  authorizeRole: jest.fn(() => (_req: any, _res: any, next: any) => {
    next();
  }),
  requireRole: jest.fn(() => (_req: any, _res: any, next: any) => {
    next();
  }),
}));

// Mock email service
jest.mock("../../utils/emailService", () => ({
  default: {
    sendEmail: jest.fn().mockResolvedValue(true),
  },
}));

// Mock fs/promises for file operations
jest.mock("fs/promises", () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
}));

// Mock the test database functions
jest.mock("../mocks/database", () => ({
  createTestDatabase: jest.fn().mockResolvedValue({
    execute: jest.fn().mockResolvedValue([[], []]),
    query: jest.fn().mockResolvedValue([[], []]),
    end: jest.fn().mockResolvedValue(undefined),
  }),
  cleanupTestData: jest.fn().mockResolvedValue(undefined),
  createTestUser: jest.fn().mockImplementation(async (_db, user) => ({
    id: Math.floor(Math.random() * 1000),
    ...user,
  })),
  createTestTenant: jest.fn().mockImplementation(async (_db, _subdomain, _companyName) => 
    Math.floor(Math.random() * 100) + 1
  ),
  getAuthToken: jest.fn().mockImplementation(async (_app, username) => 
    `test-token-${username}`
  ),
}));

import request from "supertest";
import fs from "fs/promises";
import path from "path";
import { Pool, ResultSetHeader } from "mysql2/promise";
import * as Express from "express";
import app from "../../app";
import {
  createTestDatabase,
  cleanupTestData,
  createTestUser,
  createTestTenant,
  getAuthToken,
} from "../mocks/database";
import { asTestRows } from "../../__tests__/mocks/db-types";

describe("Documents API Endpoints", () => {
  let testDb: Pool;
  let tenant1Id: number;
  let tenant2Id: number;
  let adminToken1: string;
  let adminToken2: string;
  let employeeToken1: string;
  let testFilePath: string;

  beforeAll(async () => {
    testDb = await createTestDatabase();

    // Create test tenants
    tenant1Id = await createTestTenant(testDb, "tenant1", "Tenant One GmbH");
    tenant2Id = await createTestTenant(testDb, "tenant2", "Tenant Two GmbH");

    // Create test users
    const admin1 = await createTestUser(testDb, {
      username: "admin1",
      email: "admin1@tenant1.de",
      password: "Admin123!",
      role: "admin",
      tenant_id: tenant1Id,
    });

    const admin2 = await createTestUser(testDb, {
      username: "admin2",
      email: "admin2@tenant2.de",
      password: "Admin123!",
      role: "admin",
      tenant_id: tenant2Id,
    });

    const employee1 = await createTestUser(testDb, {
      username: "employee1",
      email: "employee1@tenant1.de",
      password: "Employee123!",
      role: "employee",
      tenant_id: tenant1Id,
      department_id: 1,
    });

    // Get auth tokens
    adminToken1 = await getAuthToken(app, "admin1", "Admin123!");
    adminToken2 = await getAuthToken(app, "admin2", "Admin123!");
    employeeToken1 = await getAuthToken(app, "employee1", "Employee123!");

    // Mock test file path (no need to create real file since fs is mocked)
    testFilePath = path.join(__dirname, "test-document.pdf");
  });

  afterAll(async () => {
    // No need to clean up test file since fs is mocked
    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Mock database responses
    if (testDb && testDb.execute) {
      (testDb.execute as jest.Mock).mockResolvedValue([[], []]);
    }
  });

  describe("POST /api/documents/upload", () => {
    it("should successfully upload a document", async () => {
      // Instead of attaching a real file, we'll send form data
      // The multer mock will simulate file upload
      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("category", "company")
        .field("description", "Test company document")
        .field("filename", "test-document.pdf")
        .field("mimetype", "application/pdf")
        .field("filesize", "1000");

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(Number),
          title: "test-document.pdf",
          category: "company",
          tenant_id: tenant1Id,
          uploaded_by: expect.any(Number),
        },
      });
    });

    it("should handle personal document upload for specific user", async () => {
      // Mock the user ID since DB is mocked
      const targetUserId = 123;
      
      // Mock DB response for user query
      (testDb.execute as jest.Mock).mockResolvedValueOnce([
        [{ id: targetUserId, username: "employee1", tenant_id: tenant1Id }],
        []
      ]);

      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("category", "personal")
        .field("userId", targetUserId.toString())
        .field("description", "Personal document for employee")
        .field("filename", "personal-doc.pdf");

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        category: "personal",
        target_user_id: targetUserId,
      });
    });

    it("should handle payroll document with year/month", async () => {
      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("category", "payroll")
        .field("year", "2025")
        .field("month", "6")
        .field("userId", "1")
        .field("filename", "test-file.pdf");

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        category: "payroll",
        year: 2025,
        month: 6,
      });
    });

    it("should reject upload without authentication", async () => {
      const response = await request(app)
        .post("/api/documents/upload")
        .field("category", "company")
        .field("filename", "test-file.pdf");

      expect(response.status).toBe(401);
    });

    it("should validate file types", async () => {
      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("category", "company")
        .field("filename", "test.exe")
        .field("mimetype", "application/x-msdownload");

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Dateityp");
    });

    it("should enforce file size limits", async () => {
      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("category", "company")
        .field("filename", "large-file.pdf")
        .field("filesize", String(11 * 1024 * 1024));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("groß");
    });

    it("should sanitize file names", async () => {
      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("category", "company")
        .field("filename", "../../../etc/passwd.txt");

      expect(response.status).toBe(201);
      expect(response.body.data.file_name).not.toContain("..");
      expect(response.body.data.file_name).not.toContain("/");
    });

    it("should send email notification for personal documents", async () => {
      const emailSpy = jest.spyOn(
        require("../../utils/emailService").default,
        "sendEmail",
      );

      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("category", "personal")
        .field("userId", "2")
        .field("filename", "test-file.pdf");

      expect(response.status).toBe(201);
      expect(emailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("Neues Dokument"),
        }),
      );

      emailSpy.mockRestore();
    });
  });

  describe("GET /api/documents", () => {
    beforeEach(async () => {
      // Create test documents
      await testDb.execute(
        `INSERT INTO documents (title, file_name, file_path, file_size, file_type, 
         category, uploaded_by, target_user_id, tenant_id, created_at)
         VALUES 
         (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW()),
         (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW()),
         (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          "Company Doc",
          "company.pdf",
          "/uploads/company.pdf",
          1000,
          "application/pdf",
          "company",
          1,
          null,
          tenant1Id,
          "Personal Doc",
          "personal.pdf",
          "/uploads/personal.pdf",
          2000,
          "application/pdf",
          "personal",
          1,
          2,
          tenant1Id,
          "Other Tenant Doc",
          "other.pdf",
          "/uploads/other.pdf",
          3000,
          "application/pdf",
          "company",
          3,
          null,
          tenant2Id,
        ],
      );
    });

    it("should list documents for authenticated user", async () => {
      const response = await request(app)
        .get("/api/documents")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          documents: expect.arrayContaining([
            expect.objectContaining({ title: "Company Doc" }),
            expect.objectContaining({ title: "Personal Doc" }),
          ]),
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: 2,
          },
        },
      });

      // Should not include other tenant's documents
      expect(response.body.data.documents).not.toContainEqual(
        expect.objectContaining({ title: "Other Tenant Doc" }),
      );
    });

    it("should filter by category", async () => {
      const response = await request(app)
        .get("/api/documents?category=company")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.documents).toHaveLength(1);
      expect(response.body.data.documents[0].category).toBe("company");
    });

    it("should filter by user (for personal documents)", async () => {
      const response = await request(app)
        .get("/api/documents?category=personal&userId=2")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.documents).toHaveLength(1);
      expect(response.body.data.documents[0]).toMatchObject({
        category: "personal",
        target_user_id: 2,
      });
    });

    it("should support pagination", async () => {
      // Add more documents
      for (let i = 0; i < 15; i++) {
        await testDb.execute(
          `INSERT INTO documents (title, file_name, file_path, file_size, file_type,
           category, uploaded_by, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `Doc ${i}`,
            `doc${i}.pdf`,
            `/uploads/doc${i}.pdf`,
            1000,
            "application/pdf",
            "company",
            1,
            tenant1Id,
          ],
        );
      }

      const response = await request(app)
        .get("/api/documents?page=2&limit=10")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.pagination).toMatchObject({
        currentPage: 2,
        itemsPerPage: 10,
        totalPages: 2,
      });
    });

    it("should enforce multi-tenant isolation", async () => {
      const response = await request(app)
        .get("/api/documents")
        .set("Authorization", `Bearer ${adminToken2}`);

      expect(response.status).toBe(200);
      expect(response.body.data.documents).toHaveLength(1);
      expect(response.body.data.documents[0].tenant_id).toBe(tenant2Id);
    });

    it("should respect employee access restrictions", async () => {
      const response = await request(app)
        .get("/api/documents")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      // Employee should see company documents and their personal documents
      const docs = response.body.data.documents;
      expect(docs.some((d: { category: string }) => d.category === "company")).toBe(true);
    });
  });

  describe("GET /api/documents/:id", () => {
    let documentId: number;

    beforeEach(async () => {
      const [result] = await testDb.execute(
        `INSERT INTO documents (title, file_name, file_path, file_size, file_type,
         category, uploaded_by, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Test Doc",
          "test.pdf",
          "/uploads/test.pdf",
          1000,
          "application/pdf",
          "company",
          1,
          tenant1Id,
        ],
      );
      documentId = result.insertId;
    });

    it("should get document details", async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: documentId,
          title: "Test Doc",
          category: "company",
          can_download: true,
          is_read: false,
        },
      });
    });

    it("should mark document as read", async () => {
      await request(app)
        .get(`/api/documents/${documentId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      // Check read status was recorded
      const [rows] = await testDb.execute(
        "SELECT * FROM document_reads WHERE document_id = ? AND user_id = ?",
        [documentId, 1],
      );
      const reads = asTestRows<any>(rows);
      expect(reads).toHaveLength(1);

      // Second request should show as read
      const response2 = await request(app)
        .get(`/api/documents/${documentId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response2.body.data.is_read).toBe(true);
    });

    it("should reject access to other tenant's documents", async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}`)
        .set("Authorization", `Bearer ${adminToken2}`);

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/documents/:id", () => {
    let documentId: number;

    beforeEach(async () => {
      const [result] = await testDb.execute(
        `INSERT INTO documents (title, file_name, file_path, file_size, file_type,
         category, uploaded_by, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Delete Test",
          "delete.pdf",
          "/uploads/delete.pdf",
          1000,
          "application/pdf",
          "company",
          1,
          tenant1Id,
        ],
      );
      documentId = result.insertId;
    });

    it("should delete document (admin only)", async () => {
      const response = await request(app)
        .delete(`/api/documents/${documentId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("gelöscht"),
      });

      // Verify document was deleted
      const [rows] = await testDb.execute(
        "SELECT * FROM documents WHERE id = ?",
        [documentId],
      );
      const documents = asTestRows<any>(rows);
      expect(documents).toHaveLength(0);
    });

    it("should reject deletion by non-admin", async () => {
      const response = await request(app)
        .delete(`/api/documents/${documentId}`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(403);
    });

    it("should not delete other tenant's documents", async () => {
      const response = await request(app)
        .delete(`/api/documents/${documentId}`)
        .set("Authorization", `Bearer ${adminToken2}`);

      expect(response.status).toBe(404);
    });

    it("should clean up file from filesystem", async () => {
      const unlinkSpy = jest.spyOn(fs, "unlink").mockResolvedValue();

      await request(app)
        .delete(`/api/documents/${documentId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(unlinkSpy).toHaveBeenCalledWith(
        expect.stringContaining("delete.pdf"),
      );

      unlinkSpy.mockRestore();
    });
  });

  describe("GET /api/documents/download/:id", () => {
    let documentId: number;

    beforeEach(async () => {
      // Mock file path (no need to create real file)
      const filePath = path.join(__dirname, "../../../uploads/documents/download-test.pdf");

      const [result] = await testDb.execute(
        `INSERT INTO documents (title, file_name, file_path, file_size, file_type,
         category, uploaded_by, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Download Test",
          "download-test.pdf",
          filePath,
          1000,
          "application/pdf",
          "company",
          1,
          tenant1Id,
        ],
      );
      documentId = result.insertId;
    });

    it("should download document", async () => {
      const response = await request(app)
        .get(`/api/documents/download/${documentId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("application/pdf");
      expect(response.headers["content-disposition"]).toContain(
        "download-test.pdf",
      );
      expect(response.text).toBe("PDF content for download");
    });

    it("should prevent path traversal attacks", async () => {
      // Try to access file outside upload directory
      await testDb.execute(`UPDATE documents SET file_path = ? WHERE id = ?`, [
        "../../../etc/passwd",
        documentId,
      ]);

      const response = await request(app)
        .get(`/api/documents/download/${documentId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Ungültiger Dateipfad");
    });

    it("should track download activity", async () => {
      const logSpy = jest.spyOn(console, "log");

      await request(app)
        .get(`/api/documents/download/${documentId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Document downloaded"),
        expect.objectContaining({
          documentId,
          userId: expect.any(Number),
        }),
      );

      logSpy.mockRestore();
    });
  });

  describe("Security & Performance", () => {
    it("should rate limit document uploads", async () => {
      const requests = Array(6)
        .fill(null)
        .map(() =>
          request(app)
            .post("/api/documents/upload")
            .set("Authorization", `Bearer ${adminToken1}`)
            .field("category", "company")
            .field("filename", "test-file.pdf"),
        );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it("should validate MIME types match file extensions", async () => {
      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("category", "company")
        .field("filename", "fake-image.jpg")
        .field("mimetype", "application/pdf"); // Wrong MIME for .jpg

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Dateityp");
    });

    it("should handle concurrent uploads correctly", async () => {
      const uploads = Array(5)
        .fill(null)
        .map((_, i) =>
          request(app)
            .post("/api/documents/upload")
            .set("Authorization", `Bearer ${adminToken1}`)
            .field("category", "company")
            .field("description", `Concurrent upload ${i}`)
            .field("filename", "test-file.pdf"),
        );

      const responses = await Promise.all(uploads);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(201);
      });

      // All should have unique IDs
      const ids = responses.map((r) => r.body.data.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5);
    });
  });
});
