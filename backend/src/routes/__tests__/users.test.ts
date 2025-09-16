/**
 * API Tests for User Management Endpoints
 * Tests user CRUD operations, role-based access, and multi-tenant isolation
 */
import bcrypt from 'bcryptjs';
import { Pool } from 'mysql2/promise';
import request from 'supertest';

import { asTestRows } from '../../__tests__/mocks/db-types';
import app from '../../app';
import {
  cleanupTestData,
  createTestDatabase,
  createTestDepartment,
  createTestTenant,
  createTestUser,
  getAuthToken,
} from '../mocks/database';

describe('User Management API Endpoints', () => {
  let testDb: Pool;
  let tenant1Id: number;
  let tenant2Id: number;
  let dept1Id: number;
  let dept2Id: number;
  let adminToken1: string;
  let adminToken2: string;
  let employeeToken1: string;
  let rootToken: string;
  let adminUser1: any;
  let adminUser2: any;
  let employeeUser1: any;
  let rootUser: any;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = 'test-secret-key-for-user-tests';

    // Create test tenants
    tenant1Id = await createTestTenant(testDb, 'usertest1', 'User Test Company 1');
    tenant2Id = await createTestTenant(testDb, 'usertest2', 'User Test Company 2');

    // Create departments
    dept1Id = await createTestDepartment(testDb, tenant1Id, 'Engineering');
    dept2Id = await createTestDepartment(testDb, tenant1Id, 'Marketing');

    // Create test users
    adminUser1 = await createTestUser(testDb, {
      username: 'admin1',
      email: 'admin1@usertest1.de',
      password: 'AdminPass123!',
      role: 'admin',
      tenant_id: tenant1Id,
      first_name: 'Admin',
      last_name: 'One',
    });

    adminUser2 = await createTestUser(testDb, {
      username: 'admin2',
      email: 'admin2@usertest2.de',
      password: 'AdminPass123!',
      role: 'admin',
      tenant_id: tenant2Id,
      first_name: 'Admin',
      last_name: 'Two',
    });

    employeeUser1 = await createTestUser(testDb, {
      username: 'employee1',
      email: 'employee1@usertest1.de',
      password: 'EmpPass123!',
      role: 'employee',
      tenant_id: tenant1Id,
      department_id: dept1Id,
      first_name: 'Employee',
      last_name: 'One',
    });

    rootUser = await createTestUser(testDb, {
      username: 'root',
      email: 'root@system.de',
      password: 'RootPass123!',
      role: 'root',
      tenant_id: 1, // System tenant
      first_name: 'Root',
      last_name: 'Admin',
    });

    // Get auth tokens - use the actual usernames returned by createTestUser
    adminToken1 = await getAuthToken(app, adminUser1.username, 'AdminPass123!');
    adminToken2 = await getAuthToken(app, adminUser2.username, 'AdminPass123!');
    employeeToken1 = await getAuthToken(app, employeeUser1.username, 'EmpPass123!');
    rootToken = await getAuthToken(app, rootUser.username, 'RootPass123!');
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  describe('GET /api/users', () => {
    it('should list users for admin within same tenant', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toBeDefined();

      // Should only see users from tenant1
      const users = response.body.data.users;
      expect(users.length).toBeGreaterThanOrEqual(2); // admin1 and employee1
      expect(users.every((u) => u.tenant_id === tenant1Id)).toBe(true);

      // Should not include passwords
      expect(users.every((u) => !u.password)).toBe(true);
    });

    it('should deny access for employees', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${employeeToken1}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Keine Berechtigung');
    });

    it('should filter users by department', async () => {
      const response = await request(app)
        .get(`/api/users?department_id=${dept1Id}`)
        .set('Authorization', `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const users = response.body.data.users;
      expect(users.every((u) => u.department_id === dept1Id)).toBe(true);
    });

    it('should filter users by role', async () => {
      const response = await request(app)
        .get('/api/users?role=employee')
        .set('Authorization', `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const users = response.body.data.users;
      expect(users.every((u) => u.role === 'employee')).toBe(true);
    });

    it('should paginate results', async () => {
      // Create more users for pagination test
      for (let i = 0; i < 15; i++) {
        await createTestUser(testDb, {
          username: `testuser${i}`,
          email: `testuser${i}@usertest1.de`,
          password: 'TestPass123!',
          role: 'employee',
          tenant_id: tenant1Id,
          first_name: `Test${i}`,
          last_name: 'User',
        });
      }

      const response1 = await request(app)
        .get('/api/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken1}`);

      expect(response1.body.data.users.length).toBe(10);
      expect(response1.body.data.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });

      const response2 = await request(app)
        .get('/api/users?page=2&limit=10')
        .set('Authorization', `Bearer ${adminToken1}`);

      expect(response2.body.data.users.length).toBeGreaterThan(0);
      // Users should be different
      expect(response1.body.data.users[0].id).not.toBe(response2.body.data.users[0].id);
    });

    it('should enforce multi-tenant isolation', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken2}`);

      expect(response.status).toBe(200);
      const users = response.body.data.users;

      // Admin2 should only see users from tenant2
      expect(users.every((u) => u.tenant_id === tenant2Id)).toBe(true);
      expect(users.some((u) => u.tenant_id === tenant1Id)).toBe(false);
    });

    it('should allow root to see all users with tenant filter', async () => {
      const response = await request(app)
        .get(`/api/users?tenant_id=${tenant1Id}`)
        .set('Authorization', `Bearer ${rootToken}`);

      expect(response.status).toBe(200);
      const users = response.body.data.users;
      expect(users.every((u) => u.tenant_id === tenant1Id)).toBe(true);
    });
  });

  describe('POST /api/users', () => {
    const newUserData = {
      username: 'newuser',
      email: 'newuser@usertest1.de',
      password: 'NewPass123!',
      first_name: 'New',
      last_name: 'User',
      role: 'employee',
      department_id: null,
    };

    it('should create new user for admin', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          ...newUserData,
          department_id: dept1Id,
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('erfolgreich erstellt'),
      });
      expect(response.body.data.userId).toBeDefined();

      // Verify user was created
      const [rows] = await testDb.execute('SELECT * FROM users WHERE id = ?', [
        response.body.data.userId,
      ]);
      const users = asTestRows<unknown>(rows);
      expect(users[0]).toMatchObject({
        username: 'newuser',
        email: 'newuser@usertest1.de',
        role: 'employee',
        tenant_id: tenant1Id,
        department_id: dept1Id,
      });
    });

    it('should hash password before storing', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          ...newUserData,
          username: 'hashtest',
          email: 'hashtest@usertest1.de',
        });

      const [rows] = await testDb.execute('SELECT password FROM users WHERE username = ?', [
        'hashtest',
      ]);
      const users = asTestRows<unknown>(rows);

      // Password should be hashed
      expect(users[0].password).not.toBe('NewPass123!');
      const isValid = await bcrypt.compare('NewPass123!', users[0].password);
      expect(isValid).toBe(true);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          username: '',
          email: 'invalid-email',
          password: 'short',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'username' }),
          expect.objectContaining({ path: 'email' }),
          expect.objectContaining({ path: 'password' }),
        ]),
      );
    });

    it('should reject duplicate username within tenant', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          ...newUserData,
          username: 'admin1', // Already exists
          email: 'different@usertest1.de',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Benutzername bereits vergeben');
    });

    it('should reject duplicate email within tenant', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          ...newUserData,
          username: 'different',
          email: 'admin1@usertest1.de', // Already exists
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('E-Mail bereits vergeben');
    });

    it('should allow same username in different tenant', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken2}`)
        .send({
          ...newUserData,
          username: 'newuser', // Same as in tenant1
          email: 'newuser@usertest2.de',
        });

      expect(response.status).toBe(201);
    });

    it('should validate password strength', async () => {
      const weakPasswords = [
        'password', // No uppercase, numbers, or special chars
        'Password', // No numbers or special chars
        'Password1', // No special chars
        'Pass1!', // Too short
        'password123!', // No uppercase
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${adminToken1}`)
          .send({
            ...newUserData,
            username: `weak${String(Date.now())}`,
            email: `weak${String(Date.now())}@test.de`,
            password,
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ path: 'password' })]),
        );
      }
    });

    it('should deny employee from creating users', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${employeeToken1}`)
        .send(newUserData);

      expect(response.status).toBe(403);
    });

    it('should prevent creating admin users by non-root', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          ...newUserData,
          username: 'newadmin',
          email: 'newadmin@test.de',
          role: 'admin',
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Nur Root kann Admin-Benutzer erstellen');
    });

    it('should automatically assign tenant_id from token', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          ...newUserData,
          username: 'autotenantuser',
          email: 'autotenant@test.de',
          tenant_id: 999, // Should be ignored
        });

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute('SELECT tenant_id FROM users WHERE username = ?', [
        'autotenantuser',
      ]);
      const users = asTestRows<unknown>(rows);
      expect(users[0].tenant_id).toBe(tenant1Id);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should get user details for admin', async () => {
      const response = await request(app)
        .get(`/api/users/${employeeUser1.id}`)
        .set('Authorization', `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: employeeUser1.id,
        username: 'employee1',
        email: 'employee1@usertest1.de',
        role: 'employee',
        department_id: dept1Id,
        tenant_id: tenant1Id,
      });

      // Should not include password
      expect(response.body.data.password).toBeUndefined();
    });

    it('should include department info if requested', async () => {
      const response = await request(app)
        .get(`/api/users/${employeeUser1.id}?include=department`)
        .set('Authorization', `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.department).toMatchObject({
        id: dept1Id,
        name: 'Engineering',
      });
    });

    it('should allow employees to view own profile', async () => {
      const response = await request(app)
        .get(`/api/users/${employeeUser1.id}`)
        .set('Authorization', `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(employeeUser1.id);
    });

    it('should deny employees from viewing other users', async () => {
      const response = await request(app)
        .get(`/api/users/${adminUser1.id}`)
        .set('Authorization', `Bearer ${employeeToken1}`);

      expect(response.status).toBe(403);
    });

    it('should enforce tenant isolation', async () => {
      const response = await request(app)
        .get(`/api/users/${employeeUser1.id}`)
        .set('Authorization', `Bearer ${adminToken2}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Benutzer nicht gefunden');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/users/99999')
        .set('Authorization', `Bearer ${adminToken1}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user details for admin', async () => {
      const updateData = {
        first_name: 'Updated',
        last_name: 'Name',
        department_id: dept2Id,
      };

      const response = await request(app)
        .put(`/api/users/${employeeUser1.id}`)
        .set('Authorization', `Bearer ${adminToken1}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('erfolgreich aktualisiert');

      // Verify update
      const [rows] = await testDb.execute(
        'SELECT first_name, last_name, department_id FROM users WHERE id = ?',
        [employeeUser1.id],
      );
      const users = asTestRows<unknown>(rows);
      expect(users[0]).toMatchObject(updateData);
    });

    it('should allow employees to update own profile (limited fields)', async () => {
      const response = await request(app)
        .put(`/api/users/${employeeUser1.id}`)
        .set('Authorization', `Bearer ${employeeToken1}`)
        .send({
          first_name: 'Self',
          last_name: 'Updated',
          phone: '+491234567890',
        });

      expect(response.status).toBe(200);
    });

    it('should prevent employees from changing own role', async () => {
      const response = await request(app)
        .put(`/api/users/${employeeUser1.id}`)
        .set('Authorization', `Bearer ${employeeToken1}`)
        .send({
          role: 'admin',
        });

      expect(response.status).toBe(403);
    });

    it('should validate email format on update', async () => {
      const response = await request(app)
        .put(`/api/users/${employeeUser1.id}`)
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: 'email' })]),
      );
    });

    it('should prevent username change', async () => {
      const response = await request(app)
        .put(`/api/users/${employeeUser1.id}`)
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          username: 'newusername',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Benutzername kann nicht geändert werden');
    });

    it('should enforce tenant isolation on update', async () => {
      const response = await request(app)
        .put(`/api/users/${employeeUser1.id}`)
        .set('Authorization', `Bearer ${adminToken2}`)
        .send({
          first_name: 'Hacked',
        });

      expect(response.status).toBe(404);
    });

    it('should handle password updates separately', async () => {
      const response = await request(app)
        .put(`/api/users/${employeeUser1.id}/password`)
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          newPassword: 'UpdatedPass123!',
        });

      expect(response.status).toBe(200);

      // Verify can login with new password
      const loginResponse = await request(app).post('/api/auth/login').send({
        username: 'employee1',
        password: 'UpdatedPass123!',
      });
      expect(loginResponse.status).toBe(200);
    });

    it('should require current password for self password update', async () => {
      const response = await request(app)
        .put(`/api/users/${employeeUser1.id}/password`)
        .set('Authorization', `Bearer ${employeeToken1}`)
        .send({
          currentPassword: 'WrongPass',
          newPassword: 'NewPass123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Aktuelles Passwort ist falsch');
    });
  });

  describe('DELETE /api/users/:id', () => {
    let deleteUserId: number;

    beforeEach(async () => {
      const user = await createTestUser(testDb, {
        username: `delete${String(Date.now())}`,
        email: `delete${String(Date.now())}@test.de`,
        password: 'DeleteMe123!',
        role: 'employee',
        tenant_id: tenant1Id,
        first_name: 'Delete',
        last_name: 'Me',
      });
      deleteUserId = user.id;
    });

    it('should soft delete user for admin', async () => {
      const response = await request(app)
        .delete(`/api/users/${deleteUserId}`)
        .set('Authorization', `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('erfolgreich gelöscht');

      // Verify soft delete
      const [rows] = await testDb.execute('SELECT status, deleted_at FROM users WHERE id = ?', [
        deleteUserId,
      ]);
      const users = asTestRows<unknown>(rows);
      expect(users[0].status).toBe('inactive');
      expect(users[0].deleted_at).toBeTruthy();
    });

    it('should prevent self-deletion', async () => {
      const response = await request(app)
        .delete(`/api/users/${adminUser1.id}`)
        .set('Authorization', `Bearer ${adminToken1}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Sie können sich nicht selbst löschen');
    });

    it('should deny deletion by employees', async () => {
      const response = await request(app)
        .delete(`/api/users/${deleteUserId}`)
        .set('Authorization', `Bearer ${employeeToken1}`);

      expect(response.status).toBe(403);
    });

    it('should enforce tenant isolation on delete', async () => {
      const response = await request(app)
        .delete(`/api/users/${deleteUserId}`)
        .set('Authorization', `Bearer ${adminToken2}`);

      expect(response.status).toBe(404);
    });

    it('should anonymize user data on hard delete', async () => {
      // First soft delete
      await request(app)
        .delete(`/api/users/${deleteUserId}`)
        .set('Authorization', `Bearer ${adminToken1}`);

      // Then hard delete (admin feature)
      const response = await request(app)
        .delete(`/api/users/${deleteUserId}?hard=true`)
        .set('Authorization', `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);

      // Verify anonymization
      const [rows] = await testDb.execute('SELECT * FROM users WHERE id = ?', [deleteUserId]);
      const users = asTestRows<unknown>(rows);
      expect(users[0].email).toMatch(/deleted_\d+@deleted\.local/);
      expect(users[0].first_name).toBe('Deleted');
      expect(users[0].last_name).toBe('User');
    });
  });

  describe('User Bulk Operations', () => {
    it('should bulk activate users', async () => {
      // Create inactive users
      const userIds = [];
      for (let i = 0; i < 3; i++) {
        const user = await createTestUser(testDb, {
          username: `bulk${i}`,
          email: `bulk${i}@test.de`,
          password: 'BulkPass123!',
          role: 'employee',
          tenant_id: tenant1Id,
          status: 'inactive',
          first_name: 'Bulk',
          last_name: `User${i}`,
        });
        userIds.push(user.id);
      }

      const response = await request(app)
        .post('/api/users/bulk/activate')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({ userIds });

      expect(response.status).toBe(200);
      expect(response.body.data.updated).toBe(3);

      // Verify all activated
      const [rows] = await testDb.execute('SELECT status FROM users WHERE id IN (?)', [userIds]);
      const users = asTestRows<unknown>(rows);
      expect(users.every((u) => u.status === 'active')).toBe(true);
    });

    it('should bulk assign department', async () => {
      const userIds = [employeeUser1.id];

      const response = await request(app)
        .post('/api/users/bulk/assign-department')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          userIds,
          departmentId: dept2Id,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.updated).toBe(1);
    });

    it('should enforce tenant isolation on bulk operations', async () => {
      const response = await request(app)
        .post('/api/users/bulk/activate')
        .set('Authorization', `Bearer ${adminToken2}`)
        .send({
          userIds: [employeeUser1.id], // From tenant1
        });

      expect(response.status).toBe(200);
      expect(response.body.data.updated).toBe(0); // No users updated
    });
  });

  describe('User Search', () => {
    it('should search users by name', async () => {
      const response = await request(app)
        .get('/api/users/search?q=employee')
        .set('Authorization', `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.results).toBeDefined();
      expect(
        response.body.data.results.some(
          (u) =>
            u.first_name.toLowerCase().includes('employee') ||
            u.last_name.toLowerCase().includes('employee') ||
            u.username.toLowerCase().includes('employee'),
        ),
      ).toBe(true);
    });

    it('should search within tenant only', async () => {
      const response = await request(app)
        .get('/api/users/search?q=admin')
        .set('Authorization', `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const results = response.body.data.results;
      expect(results.every((u) => u.tenant_id === tenant1Id)).toBe(true);
    });
  });

  describe('User Statistics', () => {
    it('should get user statistics for admin', async () => {
      const response = await request(app)
        .get('/api/users/stats')
        .set('Authorization', `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        total: expect.any(Number),
        active: expect.any(Number),
        inactive: expect.any(Number),
        byRole: expect.objectContaining({
          admin: expect.any(Number),
          employee: expect.any(Number),
        }),
        byDepartment: expect.any(Array),
      });
    });

    it('should only show stats for own tenant', async () => {
      const response1 = await request(app)
        .get('/api/users/stats')
        .set('Authorization', `Bearer ${adminToken1}`);

      const response2 = await request(app)
        .get('/api/users/stats')
        .set('Authorization', `Bearer ${adminToken2}`);

      // Different tenants should have different stats
      expect(response1.body.data.total).not.toBe(response2.body.data.total);
    });
  });

  describe('Profile Picture Upload', () => {
    it('should upload profile picture', async () => {
      const response = await request(app)
        .post(`/api/users/${employeeUser1.id}/avatar`)
        .set('Authorization', `Bearer ${adminToken1}`)
        .attach('avatar', Buffer.from('fake-image-data'), 'avatar.jpg');

      expect(response.status).toBe(200);
      expect(response.body.data.avatarUrl).toBeDefined();
    });

    it('should validate file type', async () => {
      const response = await request(app)
        .post(`/api/users/${employeeUser1.id}/avatar`)
        .set('Authorization', `Bearer ${adminToken1}`)
        .attach('avatar', Buffer.from('fake-exe-data'), 'virus.exe');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Dateityp');
    });

    it('should allow users to upload own avatar', async () => {
      const response = await request(app)
        .post(`/api/users/${employeeUser1.id}/avatar`)
        .set('Authorization', `Bearer ${employeeToken1}`)
        .attach('avatar', Buffer.from('fake-image-data'), 'selfie.jpg');

      expect(response.status).toBe(200);
    });
  });
});
