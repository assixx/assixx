/**
 * Mock Database Setup for Testing
 * Provides mock implementations for database operations
 */

import { jest } from "@jest/globals";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { Pool, createPool } from "mysql2/promise";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Express } from "express";
import request from "supertest";

export interface MockUser extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  password: string;
  role: string;
  tenant_id: number;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

export interface MockTenant extends RowDataPacket {
  id: number;
  company_name: string;
  domain: string;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

// Test database configuration - matches GitHub Actions MySQL service
const TEST_DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "assixx_user",
  password: process.env.DB_PASSWORD || "AssixxP@ss2025!",
  database: process.env.DB_NAME || "main",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Test data interfaces
interface TestUserData {
  username: string;
  email: string;
  password: string;
  role: "root" | "admin" | "employee";
  tenant_id: number;
  first_name?: string;
  last_name?: string;
  department_id?: number;
  position?: string;
}

// Mock users data
export const mockUsers: MockUser[] = [
  {
    id: 1,
    username: "admin",
    email: "admin@test.com",
    password: "$2a$10$YourHashedPasswordHere", // password: "password123"
    role: "admin",
    tenant_id: 1,
    is_active: 1,
    created_at: new Date("2024-01-01"),
    updated_at: new Date("2024-01-01"),
  },
  {
    id: 2,
    username: "employee",
    email: "employee@test.com",
    password: "$2a$10$YourHashedPasswordHere", // password: "password123"
    role: "employee",
    tenant_id: 1,
    is_active: 1,
    created_at: new Date("2024-01-01"),
    updated_at: new Date("2024-01-01"),
  },
  {
    id: 3,
    username: "admin2",
    email: "admin2@test2.com",
    password: "$2a$10$YourHashedPasswordHere", // password: "password123"
    role: "admin",
    tenant_id: 2,
    is_active: 1,
    created_at: new Date("2024-01-01"),
    updated_at: new Date("2024-01-01"),
  },
];

// Mock tenants data
export const mockTenants: MockTenant[] = [
  {
    id: 1,
    company_name: "Test Company 1",
    domain: "test1.com",
    is_active: 1,
    created_at: new Date("2024-01-01"),
    updated_at: new Date("2024-01-01"),
  },
  {
    id: 2,
    company_name: "Test Company 2",
    domain: "test2.com",
    is_active: 1,
    created_at: new Date("2024-01-01"),
    updated_at: new Date("2024-01-01"),
  },
];

// Mock database query function
export const mockQuery = jest.fn();

// Mock database execute function
export const mockExecute = jest.fn();

// Mock transaction function
export const mockTransaction = jest.fn();

// Mock connection
export const mockConnection = {
  execute: jest.fn(),
  query: jest.fn(),
  release: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
};

// Mock pool
export const mockPool = {
  execute: mockExecute,
  query: mockQuery,
  getConnection: jest.fn().mockResolvedValue(mockConnection),
};

// Helper function to setup common query mocks
export function setupCommonMocks() {
  // Reset all mocks
  jest.clearAllMocks();

  // Mock user queries
  mockQuery.mockImplementation((sql: string, params?: any[]) => {
    if (sql.includes("SELECT * FROM users WHERE")) {
      if (sql.includes("email = ?")) {
        const email = params?.[0];
        const user = mockUsers.find((u) => u.email === email);
        return Promise.resolve([user ? [user] : []]);
      }
      if (sql.includes("id = ?")) {
        const id = params?.[0];
        const user = mockUsers.find((u) => u.id === id);
        return Promise.resolve([user ? [user] : []]);
      }
      if (sql.includes("username = ?")) {
        const username = params?.[0];
        const user = mockUsers.find((u) => u.username === username);
        return Promise.resolve([user ? [user] : []]);
      }
    }

    // Mock tenant queries
    if (sql.includes("SELECT * FROM tenants WHERE")) {
      if (sql.includes("id = ?")) {
        const id = params?.[0];
        const tenant = mockTenants.find((t) => t.id === id);
        return Promise.resolve([tenant ? [tenant] : []]);
      }
    }

    // Mock insert queries
    if (sql.includes("INSERT INTO")) {
      const result: ResultSetHeader = {
        fieldCount: 0,
        affectedRows: 1,
        insertId: Math.floor(Math.random() * 1000) + 100,
        info: "",
        serverStatus: 2,
        warningStatus: 0,
        changedRows: 0,
      };
      return Promise.resolve([result]);
    }

    // Mock update queries
    if (sql.includes("UPDATE")) {
      const result: ResultSetHeader = {
        fieldCount: 0,
        affectedRows: 1,
        insertId: 0,
        info: "",
        serverStatus: 2,
        warningStatus: 0,
        changedRows: 1,
      };
      return Promise.resolve([result]);
    }

    // Default empty result
    return Promise.resolve([[]]);
  });

  mockExecute.mockImplementation(mockQuery);
}

// Helper to create a mock user with specific properties
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 100,
    username: "testuser",
    email: "test@example.com",
    password: "$2a$10$YourHashedPasswordHere",
    role: "employee",
    tenant_id: 1,
    is_active: 1,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// Helper to create a mock tenant with specific properties
export function createMockTenant(
  overrides: Partial<MockTenant> = {},
): MockTenant {
  return {
    id: 100,
    company_name: "Test Company",
    domain: "test.com",
    is_active: 1,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// Export mock implementations for jest.mock()
export const mockDatabase = {
  query: mockQuery,
  execute: mockExecute,
  getConnection: jest.fn().mockResolvedValue(mockConnection),
  transaction: mockTransaction,
};

// Create test database connection
export async function createTestDatabase(): Promise<Pool> {
  const pool = createPool(TEST_DB_CONFIG);

  // Ensure test database exists
  try {
    await pool.execute("SELECT 1");
  } catch (error) {
    console.error("Test database connection failed:", error);
    throw error;
  }

  return pool;
}

// Create test tenant
export async function createTestTenant(
  db: Pool,
  subdomain: string,
  companyName: string,
): Promise<number> {
  const [result] = await db.execute(
    `INSERT INTO tenants (company_name, subdomain, company_email, company_phone, 
     country, status, plan_type, max_users, trial_ends_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      companyName,
      subdomain,
      `info@${subdomain}.de`,
      "+491234567890",
      "DE",
      "active",
      "basic",
      50,
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ],
  );

  const tenantId = (result as any).insertId;

  // Create default department
  await db.execute(
    `INSERT INTO departments (name, description, tenant_id, created_at, updated_at)
     VALUES (?, ?, ?, NOW(), NOW())`,
    ["Allgemein", "Standard Abteilung", tenantId],
  );

  return tenantId;
}

// Create test user
export async function createTestUser(
  db: Pool,
  userData: TestUserData,
): Promise<any> {
  const hashedPassword = await bcrypt.hash(userData.password, 10);

  const [result] = await db.execute(
    `INSERT INTO users (username, email, password_hash, role, tenant_id,
     first_name, last_name, department_id, position, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      userData.username,
      userData.email,
      hashedPassword,
      userData.role,
      userData.tenant_id,
      userData.first_name ?? "Test",
      userData.last_name ?? "User",
      userData.department_id || null,
      userData.position || null,
      "active",
    ],
  );

  return {
    id: (result as any).insertId,
    ...userData,
    password_hash: hashedPassword,
  };
}

// Get authentication token
export async function getAuthToken(
  app: Express,
  username: string,
  password: string,
): Promise<string> {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ username, password });

  if (response.status !== 200) {
    throw new Error(
      `Failed to get auth token for ${username}: ${response.body.message}`,
    );
  }

  return response.body.data.token;
}

// Create test department
export async function createTestDepartment(
  db: Pool,
  tenantId: number,
  name: string,
  description?: string,
): Promise<number> {
  const [result] = await db.execute(
    `INSERT INTO departments (name, description, tenant_id, created_at, updated_at)
     VALUES (?, ?, ?, NOW(), NOW())`,
    [name, description || `${name} Department`, tenantId],
  );

  return (result as ResultSetHeader).insertId;
}

// Create test team
export async function createTestTeam(
  db: Pool,
  tenantId: number,
  departmentId: number | null,
  name: string,
): Promise<number> {
  const [result] = await db.execute(
    `INSERT INTO teams (name, department_id, tenant_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [name, departmentId, tenantId, "active"],
  );

  return (result as ResultSetHeader).insertId;
}

// Clean up test data
export async function cleanupTestData(): Promise<void> {
  const db = await createTestDatabase();

  try {
    // Delete in correct order to respect foreign keys
    await db.execute("SET FOREIGN_KEY_CHECKS = 0");

    const tables = [
      "document_reads",
      "documents",
      "users",
      "departments",
      "tenant_features",
      "tenants",
      "user_sessions",
      "login_attempts",
    ];

    for (const table of tables) {
      await db.execute(`DELETE FROM ${table} WHERE id > 1`);
    }

    await db.execute("SET FOREIGN_KEY_CHECKS = 1");
  } finally {
    await db.end();
  }
}
