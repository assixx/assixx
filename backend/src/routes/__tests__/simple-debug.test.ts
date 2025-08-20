import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Pool } from 'mysql2/promise';

import {
  cleanupTestData,
  createTestDatabase,
  createTestTenant,
  createTestUser,
} from '../mocks/database.js';

describe('SIMPLE DEBUG: User Creation', () => {
  let testDb: Pool;
  let tenantId: number;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  it('should create and find test user', async () => {
    // Step 1: Create tenant
    tenantId = await createTestTenant(testDb, 'simpledebug', 'Simple Debug Company');
    console.info('Created tenant with ID:', tenantId);

    // Step 2: Create test user
    const userResult = await createTestUser(testDb, {
      username: 'simple.debug@test.com',
      email: 'simple.debug@test.com',
      password: 'DebugPass123!',
      role: 'admin',
      tenant_id: tenantId,
      first_name: 'Simple',
      last_name: 'Debug',
    });
    console.info('Created user:', userResult);

    // Step 3: Check user in database immediately
    const [users] = await testDb.execute(
      'SELECT id, username, email, tenant_id, status FROM users WHERE id = ?',
      [userResult.id],
    );
    console.info('Found users in DB:', users);

    // Step 4: Check all test users
    const [allTestUsers] = await testDb.execute(
      "SELECT id, username, email FROM users WHERE email LIKE '%__AUTOTEST__%'",
    );
    console.info('All test users count:', (allTestUsers as any[]).length);

    // Step 5: Check if tenant exists
    const [tenants] = await testDb.execute(
      'SELECT id, company_name, subdomain FROM tenants WHERE id = ?',
      [tenantId],
    );
    console.info('Tenant check:', tenants);

    expect((users as any[]).length).toBeGreaterThan(0);
  });
});
