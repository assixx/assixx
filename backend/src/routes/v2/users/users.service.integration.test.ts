/**
 * Integration Tests for Users v2 Service Layer
 * Tests business logic with real database
 */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { ResultSetHeader } from 'mysql2';

import { execute } from '../../../utils/db.js';
import { ServiceError, UsersService } from './users.service.js';

describe('UsersService Integration Tests', () => {
  let usersService: UsersService;
  let testTenantId: number;
  let testUserId: number;

  beforeAll(async () => {
    // Create service instance
    usersService = new UsersService();

    // Create test tenant
    const [tenantResult] = await execute<ResultSetHeader>(
      `INSERT INTO tenants (company_name, subdomain, email, status) VALUES (?, ?, ?, ?)`,
      [
        '__AUTOTEST__UsersServiceInt',
        '__autotest__usersserviceint',
        '__AUTOTEST__usersserviceint@test.com',
        'active',
      ],
    );
    testTenantId = tenantResult.insertId;
  });

  afterAll(async () => {
    // Clean up test data
    await execute('DELETE FROM users WHERE username LIKE ?', ['__AUTOTEST__%']);
    await execute('DELETE FROM tenants WHERE company_name LIKE ?', ['__AUTOTEST__%']);
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const userData = {
        username: '__AUTOTEST__newuser',
        email: '__AUTOTEST__newuser@test.com',
        password: 'Test123!',
        firstName: 'Test',
        lastName: 'User',
        role: 'employee' as const,
        employeeNumber: 'TEST001',
      };

      const result = await usersService.createUser(userData, testTenantId);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email', userData.email);
      expect(result).toHaveProperty('firstName', userData.firstName);
      expect(result).toHaveProperty('lastName', userData.lastName);
      expect(result).toHaveProperty('role', userData.role);
      // Note: username in DB is actually the email
      expect(result).toHaveProperty('username', userData.email);

      const typedResult = result as { id: number };
      expect(typedResult.id).toBeGreaterThan(0);

      // Password should not be in the response
      expect(result).not.toHaveProperty('password');

      // Store for later tests
      testUserId = typedResult.id;
    });

    it('should throw error for duplicate email', async () => {
      const userData = {
        username: '__AUTOTEST__duplicate',
        email: '__AUTOTEST__newuser@test.com', // Same email as above
        password: 'Test123!',
        firstName: 'Duplicate',
        lastName: 'User',
        role: 'employee' as const,
      };

      await expect(usersService.createUser(userData, testTenantId)).rejects.toThrow(ServiceError);

      await expect(usersService.createUser(userData, testTenantId)).rejects.toMatchObject({
        code: 'CONFLICT',
        statusCode: 409,
      });
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const result = await usersService.getUserById(testUserId, testTenantId);

      expect(result).toMatchObject({
        id: testUserId,
        email: '__AUTOTEST__newuser@test.com',
        firstName: 'Test',
        lastName: 'User',
      });
    });

    it('should throw error when user not found', async () => {
      await expect(usersService.getUserById(99999, testTenantId)).rejects.toThrow(ServiceError);

      await expect(usersService.getUserById(99999, testTenantId)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  describe('updateUser', () => {
    it('should update user fields', async () => {
      const updates = {
        firstName: 'Updated',
        lastName: 'Name',
        position: 'Senior Developer',
      };

      const result = await usersService.updateUser(testUserId, updates, testTenantId);

      expect(result).toMatchObject({
        id: testUserId,
        firstName: 'Updated',
        lastName: 'Name',
        position: 'Senior Developer',
      });
    });
  });

  describe('listUsers', () => {
    it('should return paginated users', async () => {
      const result = await usersService.listUsers(testTenantId, {
        page: '1',
        limit: '10',
      });

      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.pagination).toMatchObject({
        currentPage: 1,
        pageSize: 10,
      });
    });

    it('should filter by search term', async () => {
      const result = await usersService.listUsers(testTenantId, {
        search: '__AUTOTEST__',
      });

      expect(result.data).toBeInstanceOf(Array);

      // Type assertion for the array
      const users = result.data as Array<{ username: string; email: string }>;
      expect(
        users.every((u) => u.username.includes('__AUTOTEST__') || u.email.includes('__AUTOTEST__')),
      ).toBe(true);
    });
  });

  describe('deleteUser', () => {
    it('should prevent self-deletion', async () => {
      await expect(usersService.deleteUser(testUserId, testUserId, testTenantId)).rejects.toThrow(
        ServiceError,
      );

      await expect(
        usersService.deleteUser(testUserId, testUserId, testTenantId),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        statusCode: 400,
      });
    });

    it('should delete user successfully', async () => {
      // Create another user to delete
      const [userResult] = await execute<ResultSetHeader>(
        `INSERT INTO users (username, email, password, role, tenant_id, employee_number, first_name, last_name, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          '__AUTOTEST__todelete@test.com',
          '__AUTOTEST__todelete@test.com',
          '$2b$10$CMrE8slXvoEfMqfTNkgC5u2qZWOvTdP2YRjFo84I/9Ful6lFjCJ8e',
          'employee',
          testTenantId,
          'DEL001',
          'To',
          'Delete',
          'active',
        ],
      );

      const result = await usersService.deleteUser(
        userResult.insertId,
        testUserId, // Different user doing the deletion
        testTenantId,
      );

      expect(result).toBe(true);
    });
  });
});
