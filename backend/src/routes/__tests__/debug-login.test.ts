import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Pool } from 'mysql2/promise';
import request from 'supertest';

import app from '../../app.js';
import {
  cleanupTestData,
  createTestDatabase,
  createTestTenant,
  createTestUser,
} from '../mocks/database.js';

describe('Debug Login Test', () => {
  let testDb: Pool;
  let tenantId: number;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = 'test-secret-key-for-debug';

    // Create test tenant
    tenantId = await createTestTenant(testDb, 'debugtenant', 'Debug Test Company');

    console.info('Created tenant with ID:', tenantId);
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  it('should create and login admin user', async () => {
    // Create admin user
    const adminUser = await createTestUser(testDb, {
      username: 'debug.admin@test.com',
      email: 'debug.admin@test.com',
      password: 'TestPass123',
      role: 'admin',
      tenant_id: tenantId,
      first_name: 'Debug',
      last_name: 'Admin',
    });

    console.info('Created admin user:', adminUser);

    // Try to login
    const loginRes = await request(app).post('/api/v2/auth/login').send({
      email: adminUser.email,
      password: 'TestPass123',
    });

    console.info('Login response status:', loginRes.status);
    console.info('Login response body:', JSON.stringify(loginRes.body, null, 2));

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data).toBeDefined();
    expect(loginRes.body.data.accessToken).toBeDefined();
  });

  it('should create and login employee user', async () => {
    // Create employee user
    const employeeUser = await createTestUser(testDb, {
      username: 'debug.employee@test.com',
      email: 'debug.employee@test.com',
      password: 'TestPass123',
      role: 'employee',
      tenant_id: tenantId,
      first_name: 'Debug',
      last_name: 'Employee',
    });

    console.info('Created employee user:', employeeUser);

    // Try to login
    const loginRes = await request(app).post('/api/v2/auth/login').send({
      email: employeeUser.email,
      password: 'TestPass123',
    });

    console.info('Login response status:', loginRes.status);
    console.info('Login response body:', JSON.stringify(loginRes.body, null, 2));

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data).toBeDefined();
    expect(loginRes.body.data.accessToken).toBeDefined();
  });
});
