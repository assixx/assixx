/**
 * Simplified Document Upload Test
 * Following auth-refactored pattern - all mocked, no real DB
 */

// Prevent any database connection attempts
process.env.DB_HOST = "mock";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-key";

// Mock database BEFORE any imports
jest.mock("../../database", () => {
  const mockExecuteQuery = jest.fn();
  return {
    executeQuery: mockExecuteQuery,
    pool: {
      end: jest.fn().mockResolvedValue(undefined),
      execute: jest.fn(),
      query: jest.fn(),
    },
  };
});

// Mock file system
jest.mock("fs/promises", () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(Buffer.from("Test PDF content")),
}));

// Mock models
jest.mock("../../models/document", () => ({
  Document: {
    create: jest.fn().mockResolvedValue(123), // Return document ID
  },
}));

jest.mock("../../models/feature", () => ({
  Feature: {
    isEnabledForTenant: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock("../../models/user", () => ({
  User: {
    findById: jest.fn().mockResolvedValue({
      id: 1,
      username: "admin@test.com",
      role: "admin",
      tenant_id: 1,
      status: "active",
    }),
  },
}));

// Mock email service
jest.mock("../../utils/emailService", () => ({
  default: {
    sendEmail: jest.fn().mockResolvedValue(true),
  },
}));

// Mock path security utilities
jest.mock("../../utils/pathSecurity", () => ({
  validatePath: jest.fn().mockReturnValue("/safe/path"),
  safeDeleteFile: jest.fn().mockResolvedValue(undefined),
  getUploadDirectory: jest.fn().mockReturnValue("/uploads/documents"),
}));

// NOW IMPORT EVERYTHING AFTER MOCKS
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app";
import { executeQuery } from "../../database";
import { Document } from "../../models/document";
import { User } from "../../models/user";

// Get mocked functions
const mockExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;
const mockDocumentCreate = Document.create as jest.MockedFunction<typeof Document.create>;
const mockUserFindById = User.findById as jest.MockedFunction<typeof User.findById>;

describe("Document Upload - Simple Test", () => {
  const validToken = jwt.sign(
    {
      id: 1,
      username: "admin@test.com",
      role: "admin",
      tenant_id: 1,
    },
    process.env.JWT_SECRET!,
    { expiresIn: "1h" }
  );

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup User.findById mock for auth middleware
    mockUserFindById.mockResolvedValue({
      id: 1,
      username: "admin@test.com",
      role: "admin",
      tenant_id: 1,
      status: "active",
    });
    
    // Mock executeQuery for auth middleware user lookup
    mockExecuteQuery.mockResolvedValue([
      [{
        id: 1,
        username: "admin@test.com",
        role: "admin",
        tenant_id: 1,
        status: "active",
        first_name: "Admin",
        last_name: "User",
      }],
      []
    ]);
  });

  it("should successfully upload a document", async () => {
    const testContent = Buffer.from("This is a test document content");

    const response = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Bearer ${validToken}`)
      .field("recipientType", "company")
      .field("category", "general")
      .field("description", "Test company document")
      .attach("document", testContent, "test-document.pdf");

    if (response.status !== 201) {
      throw new Error(`Status: ${response.status}, Body: ${JSON.stringify(response.body)}, Mocks: ${JSON.stringify({
        userFindById: mockUserFindById.mock.calls.length,
        documentCreate: mockDocumentCreate.mock.calls.length,
        executeQuery: mockExecuteQuery.mock.calls.length,
      })}`);
    }

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: expect.stringContaining("erfolgreich"),
    });
    
    // Verify Document.create was called
    expect(mockDocumentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "test-document.pdf",
        category: "general",
        description: "Test company document",
        tenant_id: 1,
      })
    );
  });
});