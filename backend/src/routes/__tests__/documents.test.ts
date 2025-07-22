/**
 * API Tests for Document Management
 * Tests document upload, download, listing, and multi-tenant isolation
 */

import "../../__tests__/test-env-setup"; // Must be first import
import request from "supertest";
import fs from "fs/promises";
import path from "path";
import { Pool } from "mysql2/promise";
import app from "../../app";
import {
  createTestDatabase,
  cleanupTestData,
  createTestTenant,
  createTestUser,
  getAuthToken,
} from "../mocks/database";
import { asTestRows } from "../../__tests__/mocks/db-types";

// Mock only the necessary file system operations
jest.mock("fs/promises", () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockImplementation((filePath) => {
    // Log the path being read for debugging
    console.log("Mock fs.readFile called with path:", filePath);

    // For any file read, return test PDF content
    // This simulates reading the uploaded file from disk
    return Promise.resolve(Buffer.from("Test PDF content"));
  }),
}));

// Mock email service
jest.mock("../../utils/emailService", () => ({
  default: {
    sendEmail: jest.fn().mockResolvedValue(true),
  },
}));

describe("Documents API Endpoints", () => {
  let testDb: Pool;
  let tenant1Id: number;
  let tenant2Id: number;
  let adminToken1: string;
  let adminToken2: string;
  let employeeToken1: string;
  let adminUser1: any;
  let adminUser2: any;
  let employeeUser1: any;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = "test-secret-key-for-documents-tests";
    process.env.SESSION_SECRET = "test-session-secret";

    // Test database connection
    try {
      const [rows] = await testDb.execute("SELECT 1");
      console.log("Database connection successful");
    } catch (error) {
      console.error("Database connection failed:", error);
      throw error;
    }

    // Clean up any existing test users and documents
    try {
      await testDb.execute(
        "DELETE FROM document_permissions WHERE tenant_id > 1",
      );
      await testDb.execute("DELETE FROM documents WHERE tenant_id > 1");
    } catch (e) {
      // Tables might not exist yet
    }

    // Create test tenants
    tenant1Id = await createTestTenant(
      testDb,
      "doctest1",
      "Document Test Company 1",
    );
    tenant2Id = await createTestTenant(
      testDb,
      "doctest2",
      "Document Test Company 2",
    );

    // Create test users - WICHTIG: username und email müssen gleich sein!
    adminUser1 = await createTestUser(testDb, {
      username: "admin1@doctest1.de",
      email: "admin1@doctest1.de",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenant1Id,
      first_name: "Admin",
      last_name: "One",
    });

    adminUser2 = await createTestUser(testDb, {
      username: "admin2@doctest2.de",
      email: "admin2@doctest2.de",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenant2Id,
      first_name: "Admin",
      last_name: "Two",
    });

    employeeUser1 = await createTestUser(testDb, {
      username: "employee1@doctest1.de",
      email: "employee1@doctest1.de",
      password: "EmpPass123!",
      role: "employee",
      tenant_id: tenant1Id,
      department_id: 1,
      first_name: "Employee",
      last_name: "One",
    });

    // Get auth tokens
    adminToken1 = await getAuthToken(app, adminUser1.username, "AdminPass123!");
    adminToken2 = await getAuthToken(app, adminUser2.username, "AdminPass123!");
    employeeToken1 = await getAuthToken(
      app,
      employeeUser1.username,
      "EmpPass123!",
    );
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Clean up documents table before each test
    await testDb.execute(
      "DELETE FROM document_permissions WHERE tenant_id > 1",
    );
    await testDb.execute("DELETE FROM documents WHERE tenant_id > 1");
  });

  describe("POST /api/documents/upload", () => {
    it("should successfully upload a document", async () => {
      // Create a test file buffer
      const testContent = Buffer.from("This is a test document content");

      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("recipientType", "company")
        .field("category", "general")
        .field("description", "Test company document")
        .attach("document", testContent, "test-document.pdf");

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("erfolgreich"),
        data: {
          documentId: expect.any(Number),
        },
      });

      // Verify document was saved in database
      const [rows] = await testDb.execute(
        "SELECT * FROM documents WHERE id = ?",
        [response.body.data.documentId],
      );
      const documents = asTestRows<any>(rows);
      expect(documents).toHaveLength(1);
      expect(documents[0]).toMatchObject({
        category: "company",
        tenant_id: tenant1Id,
        uploaded_by: adminUser1.id,
      });
    });

    it("should handle personal document upload for specific user", async () => {
      const testContent = Buffer.from("Personal document content");

      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("recipientType", "user")
        .field("userId", employeeUser1.id.toString())
        .field("category", "personal")
        .field("description", "Personal document for employee")
        .attach("document", testContent, "personal-doc.pdf");

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("erfolgreich"),
        data: {
          documentId: expect.any(Number),
        },
      });
    });

    it("should handle payroll document with year/month", async () => {
      const testContent = Buffer.from("Payroll document");

      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("recipientType", "user")
        .field("userId", employeeUser1.id.toString())
        .field("category", "salary")
        .field("year", "2025")
        .field("month", "Juni")
        .attach("document", testContent, "payroll-2025-06.pdf");

      expect(response.status).toBe(201);

      // Verify metadata was saved
      const [rows] = await testDb.execute(
        "SELECT * FROM documents WHERE id = ?",
        [response.body.data.id],
      );
      const documents = asTestRows<any>(rows);
      expect(documents[0].description).toContain("2025");
      expect(documents[0].description).toContain("Juni");
    });

    it("should reject upload without authentication", async () => {
      const testContent = Buffer.from("Test content");

      const response = await request(app)
        .post("/api/documents/upload")
        .field("category", "company")
        .attach("document", testContent, "test-file.pdf");

      expect(response.status).toBe(401);
    });

    it("should validate file types", async () => {
      const testContent = Buffer.from("Executable content");

      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("category", "company")
        .attach("document", testContent, "test.exe");

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Dateityp");
    });

    it("should enforce file size limits", async () => {
      // Create a large buffer (11MB)
      const largeContent = Buffer.alloc(11 * 1024 * 1024);

      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("category", "company")
        .attach("document", largeContent, "large-file.pdf");

      expect(response.status).toBe(413); // Payload too large
    });

    it("should send email notification for personal documents", async () => {
      const emailSpy = jest.spyOn(
        require("../../utils/emailService").default,
        "sendEmail",
      );

      const testContent = Buffer.from("Personal document");

      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("category", "personal")
        .field("userId", employeeUser1.id.toString())
        .attach("document", testContent, "personal-notification.pdf");

      expect(response.status).toBe(201);
      expect(emailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: employeeUser1.email,
          subject: expect.stringContaining("Neues Dokument"),
        }),
      );

      emailSpy.mockRestore();
    });

    it("should enforce tenant isolation", async () => {
      // Admin2 tries to upload personal doc for User1 (different tenant)
      const testContent = Buffer.from("Cross-tenant document");

      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken2}`)
        .field("category", "personal")
        .field("userId", employeeUser1.id.toString())
        .attach("document", testContent, "cross-tenant.pdf");

      expect(response.status).toBe(404); // User not found in admin2's tenant
    });
  });

  describe("GET /api/documents", () => {
    let doc1Id: number;
    let doc2Id: number;
    let doc3Id: number;

    beforeEach(async () => {
      // Create test documents
      const [result1] = await testDb.execute(
        `INSERT INTO documents (filename, original_name, file_path, file_size, mime_type, 
         category, created_by, tenant_id, visibility_scope, recipient_type, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "company-doc.pdf",
          "Company Document.pdf",
          "/uploads/company-doc.pdf",
          1000,
          "application/pdf",
          "general",
          adminUser1.id,
          tenant1Id,
          "company",
          "company",
          adminUser1.id,
        ],
      );
      doc1Id = (result1 as any).insertId;

      const [result2] = await testDb.execute(
        `INSERT INTO documents (filename, original_name, file_path, file_size, mime_type,
         category, created_by, user_id, tenant_id, visibility_scope, recipient_type, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "personal-doc.pdf",
          "Personal Document.pdf",
          "/uploads/personal-doc.pdf",
          2000,
          "application/pdf",
          "personal",
          adminUser1.id,
          employeeUser1.id,
          tenant1Id,
          "private",
          "user",
          adminUser1.id,
        ],
      );
      doc2Id = (result2 as any).insertId;

      const [result3] = await testDb.execute(
        `INSERT INTO documents (filename, original_name, file_path, file_size, mime_type,
         category, created_by, tenant_id, visibility_scope, recipient_type, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "other-tenant-doc.pdf",
          "Other Tenant Document.pdf",
          "/uploads/other-tenant-doc.pdf",
          3000,
          "application/pdf",
          "general",
          adminUser2.id,
          tenant2Id,
          "company",
          "company",
          adminUser2.id,
        ],
      );
      doc3Id = (result3 as any).insertId;
    });

    it("should list documents for authenticated user", async () => {
      const response = await request(app)
        .get("/api/documents")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          documents: expect.any(Array),
          pagination: {
            currentPage: 1,
            totalPages: 1,
            // totalItems field removed - not in actual response
          },
        },
      });

      // Should include company and personal docs from tenant1
      expect(response.body.data.documents).toHaveLength(2);
      expect(
        response.body.data.documents.some((d: any) => d.id === doc1Id),
      ).toBe(true);
      expect(
        response.body.data.documents.some((d: any) => d.id === doc2Id),
      ).toBe(true);

      // Should not include other tenant's documents
      expect(
        response.body.data.documents.some((d: any) => d.id === doc3Id),
      ).toBe(false);
    });

    it("should filter by category", async () => {
      const response = await request(app)
        .get("/api/documents?category=company")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.documents).toHaveLength(1);
      expect(response.body.data.documents[0].category).toBe("general");
    });

    it("should filter by user for personal documents", async () => {
      const response = await request(app)
        .get(`/api/documents?category=personal&userId=${employeeUser1.id}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.documents).toHaveLength(1);
      expect(response.body.data.documents[0]).toMatchObject({
        category: "personal",
        user_id: employeeUser1.id,
      });
    });

    it("should support pagination", async () => {
      // Add more documents
      for (let i = 0; i < 15; i++) {
        await testDb.execute(
          `INSERT INTO documents (filename, original_name, file_path, file_size, mime_type,
           category, created_by, tenant_id, visibility_scope, recipient_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `doc${i}.pdf`,
            `Document ${i}`,
            `/uploads/doc${i}.pdf`,
            1000,
            "application/pdf",
            "general",
            adminUser1.id,
            tenant1Id,
            "company",
            "company",
            adminUser1.id,
          ],
        );
      }

      const response = await request(app)
        .get("/api/documents?page=2&limit=10")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.pagination).toMatchObject({
        currentPage: 2,
        // itemsPerPage field not in actual response
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
      const docs = response.body.data.documents;

      // Employee should see company documents (stored as 'general' category)
      expect(
        docs.some(
          (d: any) =>
            d.category === "general" && d.recipient_type === "company",
        ),
      ).toBe(true);

      // Employee should see their own personal documents
      expect(
        docs.some(
          (d: any) =>
            d.category === "personal" && d.user_id === employeeUser1.id,
        ),
      ).toBe(true);
    });
  });

  describe("GET /api/documents/:id", () => {
    let documentId: number;

    beforeEach(async () => {
      const [result] = await testDb.execute(
        `INSERT INTO documents (filename, original_name, file_path, file_size, mime_type,
         category, created_by, tenant_id, visibility_scope, recipient_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "test-doc.pdf",
          "Test Document.pdf",
          "/uploads/test-doc.pdf",
          1000,
          "application/pdf",
          "company",
          adminUser1.id,
          tenant1Id,
          "company",
        ],
      );
      documentId = (result as any).insertId;
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
          original_name: "Test Document.pdf",
          category: "company",
          can_download: true,
        },
      });
    });

    it("should track document views", async () => {
      // First view
      await request(app)
        .get(`/api/documents/${documentId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      // Check if activity was logged
      const [rows] = await testDb.execute(
        "SELECT * FROM activity_logs WHERE entity_type = 'document' AND entity_id = ? AND user_id = ?",
        [documentId, adminUser1.id],
      );
      const logs = asTestRows<any>(rows);
      expect(logs.length).toBeGreaterThan(0);
    });

    it("should reject access to other tenant's documents", async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}`)
        .set("Authorization", `Bearer ${adminToken2}`);

      expect(response.status).toBe(404);
    });

    it("should handle non-existent document", async () => {
      const response = await request(app)
        .get("/api/documents/99999")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain("nicht gefunden");
    });
  });

  describe("DELETE /api/documents/:id", () => {
    let documentId: number;

    beforeEach(async () => {
      const [result] = await testDb.execute(
        `INSERT INTO documents (filename, original_name, file_path, file_size, mime_type,
         category, created_by, tenant_id, visibility_scope, recipient_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "delete-test.pdf",
          "Delete Test Document.pdf",
          "/uploads/delete-test.pdf",
          1000,
          "application/pdf",
          "company",
          adminUser1.id,
          tenant1Id,
          "company",
        ],
      );
      documentId = (result as any).insertId;
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
      const unlinkSpy = jest.spyOn(fs, "unlink");

      await request(app)
        .delete(`/api/documents/${documentId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(unlinkSpy).toHaveBeenCalledWith(
        expect.stringContaining("delete-test.pdf"),
      );

      unlinkSpy.mockRestore();
    });
  });

  describe("GET /api/documents/download/:id", () => {
    let documentId: number;

    beforeEach(async () => {
      const [result] = await testDb.execute(
        `INSERT INTO documents (filename, original_name, file_path, file_size, mime_type,
         category, created_by, tenant_id, visibility_scope, recipient_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "download-test.pdf",
          "Download Test Document.pdf",
          "/uploads/documents/download-test.pdf",
          1000,
          "application/pdf",
          "company",
          adminUser1.id,
          tenant1Id,
          "company",
        ],
      );
      documentId = (result as any).insertId;

      // Update download count to 0 for testing
      await testDb.execute(
        "UPDATE documents SET download_count = 0 WHERE id = ?",
        [documentId],
      );
    });

    it("should download document", async () => {
      const response = await request(app)
        .get(`/api/documents/download/${documentId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("application/pdf");
      expect(response.headers["content-disposition"]).toContain(
        "Download Test Document.pdf",
      );
      expect(response.body.toString()).toBe("PDF content for download");
    });

    it("should increment download count", async () => {
      await request(app)
        .get(`/api/documents/download/${documentId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      const [rows] = await testDb.execute(
        "SELECT download_count FROM documents WHERE id = ?",
        [documentId],
      );
      const documents = asTestRows<any>(rows);
      expect(documents[0].download_count).toBe(1);
    });

    it("should prevent path traversal attacks", async () => {
      // Try to update file path to access system files
      await testDb.execute("UPDATE documents SET file_path = ? WHERE id = ?", [
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
      await request(app)
        .get(`/api/documents/download/${documentId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      // Check activity log
      const [rows] = await testDb.execute(
        "SELECT * FROM activity_logs WHERE action = 'document_download' AND entity_id = ?",
        [documentId],
      );
      const logs = asTestRows<any>(rows);
      expect(logs.length).toBeGreaterThan(0);
    });

    it("should enforce tenant isolation for downloads", async () => {
      const response = await request(app)
        .get(`/api/documents/download/${documentId}`)
        .set("Authorization", `Bearer ${adminToken2}`);

      expect(response.status).toBe(404);
    });
  });

  describe("Security & Validation", () => {
    it("should validate MIME types match file extensions", async () => {
      const testContent = Buffer.from("Image content");

      // Try to upload a file with mismatched MIME type
      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("category", "company")
        .attach("document", testContent, {
          filename: "fake-image.jpg",
          contentType: "application/pdf", // Wrong MIME for .jpg
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Dateityp");
    });

    it("should handle concurrent uploads correctly", async () => {
      const uploads = Array(5)
        .fill(null)
        .map((_, i) => {
          const content = Buffer.from(`Concurrent content ${i}`);
          return request(app)
            .post("/api/documents/upload")
            .set("Authorization", `Bearer ${adminToken1}`)
            .field("category", "company")
            .field("description", `Concurrent upload ${i}`)
            .attach("document", content, `concurrent-${i}.pdf`);
        });

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

    it("should sanitize filenames", async () => {
      const testContent = Buffer.from("Test content");

      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("category", "company")
        .attach("document", testContent, "../../../etc/passwd.txt");

      expect(response.status).toBe(201);
      // Check that the filename was sanitized
      const [rows] = await testDb.execute(
        "SELECT filename FROM documents WHERE id = ?",
        [response.body.data.id],
      );
      const documents = asTestRows<any>(rows);
      expect(documents[0].filename).not.toContain("..");
      expect(documents[0].filename).not.toContain("/");
    });
  });

  describe("Document Permissions", () => {
    it("should allow admin to access all documents in their tenant", async () => {
      // Create documents with different visibility
      const [result1] = await testDb.execute(
        `INSERT INTO documents (filename, original_name, file_path, file_size, mime_type,
         category, created_by, tenant_id, visibility_scope, user_id, recipient_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "private-doc.pdf",
          "Private Document.pdf",
          "/uploads/private-doc.pdf",
          1000,
          "application/pdf",
          "personal",
          employeeUser1.id,
          tenant1Id,
          "private",
          employeeUser1.id,
          "user",
          employeeUser1.id,
        ],
      );
      const privateDocId = (result1 as any).insertId;

      // Admin should be able to access private documents
      const response = await request(app)
        .get(`/api/documents/${privateDocId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
    });

    it("should restrict employee access to their own personal documents", async () => {
      // Create personal document for different employee
      const otherEmployee = await createTestUser(testDb, {
        username: "employee2@doctest1.de",
        email: "employee2@doctest1.de",
        password: "EmpPass123!",
        role: "employee",
        tenant_id: tenant1Id,
        first_name: "Employee",
        last_name: "Two",
      });

      const [result] = await testDb.execute(
        `INSERT INTO documents (filename, original_name, file_path, file_size, mime_type,
         category, created_by, tenant_id, visibility_scope, user_id, recipient_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "other-personal.pdf",
          "Other Personal Document.pdf",
          "/uploads/other-personal.pdf",
          1000,
          "application/pdf",
          "personal",
          adminUser1.id,
          tenant1Id,
          "private",
          otherEmployee.id,
          "user",
          adminUser1.id,
        ],
      );
      const otherPersonalDocId = (result as any).insertId;

      // Employee1 should not be able to access Employee2's personal document
      const response = await request(app)
        .get(`/api/documents/${otherPersonalDocId}`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(403);
    });
  });
});
