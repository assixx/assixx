/**
 * API Tests for Document Management
 * Tests document upload, download, listing, and multi-tenant isolation
 */

import request from "supertest";
import fs from "fs/promises";
import path from "path";
import { Pool } from "mysql2/promise";
import app from "../../app";
import {
  createTestDatabase,
  cleanupTestData,
  createTestUser,
  createTestTenant,
  getAuthToken,
} from "../mocks/database";
import { asTestRows } from "../../__tests__/mocks/db-types";

// Mock multer for testing
jest.mock("multer");

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

    // Create test file
    testFilePath = path.join(__dirname, "test-document.pdf");
    await fs.writeFile(testFilePath, "PDF test content");
  });

  afterAll(async () => {
    // Clean up test file
    try {
      await fs.unlink(testFilePath);
    } catch (error) {
      // Ignore if already deleted
    }

    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Clear documents table before each test
    await testDb.execute("DELETE FROM documents");
    await testDb.execute("DELETE FROM document_reads");
  });

  describe("POST /api/documents/upload", () => {
    it("should successfully upload a document", async () => {
      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("category", "company")
        .field("description", "Test company document")
        .attach("file", testFilePath);

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

      // Verify document was saved to database
      const [rows] = await testDb.execute(
        "SELECT * FROM documents WHERE id = ?",
        [response.body.data.id],
      );
      const documents = asTestRows<any>(rows);
      expect(documents).toHaveLength(1);
    });

    it("should handle personal document upload for specific user", async () => {
      const [rows] = await testDb.execute(
        "SELECT id FROM users WHERE username = ? AND tenant_id = ?",
        ["employee1", tenant1Id],
      );
      const users = asTestRows<any>(rows);
      const targetUserId = users[0].id;

      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("category", "personal")
        .field("userId", targetUserId)
        .field("description", "Personal document for employee")
        .attach("file", testFilePath);

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
        .attach("file", testFilePath);

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
        .attach("file", testFilePath);

      expect(response.status).toBe(401);
    });

    it("should validate file types", async () => {
      const invalidFile = path.join(__dirname, "test.exe");
      await fs.writeFile(invalidFile, "EXE content");

      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("category", "company")
        .attach("file", invalidFile);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Dateityp");

      await fs.unlink(invalidFile);
    });

    it("should enforce file size limits", async () => {
      // Create a large file (>10MB)
      const largeFile = path.join(__dirname, "large-file.pdf");
      const largeContent = Buffer.alloc(11 * 1024 * 1024); // 11MB
      await fs.writeFile(largeFile, largeContent);

      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("category", "company")
        .attach("file", largeFile);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("groß");

      await fs.unlink(largeFile);
    });

    it("should sanitize file names", async () => {
      const unsafeFile = path.join(__dirname, "../../../etc/passwd.txt");
      await fs.writeFile(unsafeFile, "test content");

      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("category", "company")
        .attach("file", unsafeFile);

      expect(response.status).toBe(201);
      expect(response.body.data.file_name).not.toContain("..");
      expect(response.body.data.file_name).not.toContain("/");

      await fs.unlink(unsafeFile);
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
        .attach("file", testFilePath);

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
      expect(docs.some((d) => d.category === "company")).toBe(true);
    });
  });

  describe("GET /api/documents/:id", () => {
    let documentId: number;

    beforeEach(async () => {
      const result = await testDb.execute(
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
      documentId = result[0].insertId;
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
      const result = await testDb.execute(
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
      documentId = result[0].insertId;
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
      // Create actual test file
      const uploadPath = path.join(__dirname, "../../../uploads/documents");
      await fs.mkdir(uploadPath, { recursive: true });

      const filePath = path.join(uploadPath, "download-test.pdf");
      await fs.writeFile(filePath, "PDF content for download");

      const result = await testDb.execute(
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
      documentId = result[0].insertId;
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
            .attach("file", testFilePath),
        );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it("should validate MIME types match file extensions", async () => {
      // Create a file with mismatched extension
      const fakeImage = path.join(__dirname, "fake-image.jpg");
      await fs.writeFile(fakeImage, "PDF content");

      const response = await request(app)
        .post("/api/documents/upload")
        .set("Authorization", `Bearer ${adminToken1}`)
        .field("category", "company")
        .attach("file", fakeImage);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Dateityp");

      await fs.unlink(fakeImage);
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
            .attach("file", testFilePath),
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
