import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Pool } from 'mysql2/promise';
import request from 'supertest';

import app from '../../app.js';
import { createTestDatabase, createTestTenant, createTestUser } from '../mocks/database.js';

describe('DEBUG NO CLEANUP: User Creation and Login', () => {
  let testDb: Pool;
  let tenantId: number;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = 'test-secret-key-for-debug-no-cleanup';
  });

  afterAll(async () => {
    // NO CLEANUP - we want to check the database manually
    console.info('SKIPPING CLEANUP - Check database manually!');
    await testDb.end();
  });

  it('should create user and login with generated email', async () => {
    // Create tenant
    tenantId = await createTestTenant(testDb, 'debugnocleanup', 'Debug No Cleanup Company');
    console.info('Created tenant ID:', tenantId);

    // Create test user
    const userResult = await createTestUser(testDb, {
      username: 'nocleanup@test.com',
      email: 'nocleanup@test.com',
      password: 'NoCleanup123!',
      role: 'admin',
      tenant_id: tenantId,
      first_name: 'No',
      last_name: 'Cleanup',
    });
    console.info('\n=== USER CREATED ===');
    console.info('Returned data:', userResult);
    console.info('Use this email for login:', userResult.email);
    console.info('Original email was:', 'nocleanup@test.com');

    // Check in database
    const [users] = await testDb.execute(
      'SELECT id, username, email, tenant_id, status, role FROM users WHERE id = ?',
      [userResult.id],
    );
    console.info('\n=== DATABASE CHECK ===');
    console.info('User in DB:', users);

    // Try v2 login with generated email
    console.info('\n=== LOGIN ATTEMPT 1 - With generated email ===');
    const loginRes1 = await request(app).post('/api/v2/auth/login').send({
      email: userResult.email,
      password: 'NoCleanup123!',
    });
    console.info('Status:', loginRes1.status);
    console.info('Response:', loginRes1.body);

    // Try v2 login with original email
    console.info('\n=== LOGIN ATTEMPT 2 - With original email ===');
    const loginRes2 = await request(app).post('/api/v2/auth/login').send({
      email: 'nocleanup@test.com',
      password: 'NoCleanup123!',
    });
    console.info('Status:', loginRes2.status);
    console.info('Response:', loginRes2.body);

    // Test should pass if login with generated email works
    expect(loginRes1.status).toBe(200);
    expect(loginRes1.body.success).toBe(true);
  });
});
