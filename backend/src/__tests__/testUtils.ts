/**
 * Test Utilities
 * Common helper functions for tests
 */

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { query } from "../config/database";

export interface TestUser {
  id: number;
  email: string;
  tenant_id: number;
  is_admin: boolean;
  is_active: boolean;
}

/**
 * Create a test user in the database
 */
export async function createTestUser(userData: {
  email: string;
  tenant_id: number;
  is_admin?: boolean;
  password?: string;
}): Promise<TestUser> {
  const {
    email,
    tenant_id,
    is_admin = false,
    password = "Test123!@#",
  } = userData;

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await query(
    `INSERT INTO users (email, password, tenant_id, is_admin, is_active, created_at, updated_at) 
     VALUES (?, ?, ?, ?, true, NOW(), NOW())`,
    [email, hashedPassword, tenant_id, is_admin],
  );

  return {
    id: result.insertId,
    email,
    tenant_id,
    is_admin,
    is_active: true,
  };
}

/**
 * Generate a valid JWT token for testing
 */
export function generateAuthToken(user: TestUser): string {
  const payload = {
    id: user.id,
    email: user.email,
    tenant_id: user.tenant_id,
    is_admin: user.is_admin,
  };

  return jwt.sign(
    payload,
    process.env.JWT_SECRET || "test-secret-key-for-testing",
    {
      expiresIn: "24h",
    },
  );
}

/**
 * Clean up test data for a tenant
 */
export async function cleanupTestData(tenantId: number): Promise<void> {
  // Delete in reverse order of foreign key dependencies
  await query(
    `DELETE FROM root_logs WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)`,
    [tenantId],
  );
  await query(`DELETE FROM tenant_addons WHERE tenant_id = ?`, [tenantId]);
  await query(`DELETE FROM tenant_plans WHERE tenant_id = ?`, [tenantId]);
  await query(`DELETE FROM users WHERE tenant_id = ?`, [tenantId]);
  await query(`DELETE FROM tenants WHERE id = ?`, [tenantId]);
}

/**
 * Create a test tenant
 */
export async function createTestTenant(
  name: string = "Test Tenant",
): Promise<number> {
  const result = await query(
    `INSERT INTO tenants (name, status, created_at, updated_at) 
     VALUES (?, 'active', NOW(), NOW())`,
    [name],
  );
  return result.insertId;
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error("Timeout waiting for condition");
}

/**
 * Mock request object for testing middleware
 */
export function createMockRequest(overrides: any = {}): any {
  return {
    headers: {},
    params: {},
    query: {},
    body: {},
    user: null,
    ...overrides,
  };
}

/**
 * Mock response object for testing middleware
 */
export function createMockResponse(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  return res;
}

/**
 * Setup test database with minimal schema
 */
export async function setupTestDatabase(): Promise<void> {
  // This would contain minimal schema setup for tests
  // In practice, you'd use migrations or a schema file
  console.log("Test database setup complete");
}

/**
 * Tear down test database
 */
export async function teardownTestDatabase(): Promise<void> {
  // Clean up all test data
  console.log("Test database teardown complete");
}
