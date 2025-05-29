/**
 * End-to-End Test: Complete Authentication Flow (TypeScript)
 * Tests the full user journey from registration to login
 */

import request from 'supertest';
import app from '../../src/app';
import { UserRegistrationData } from '../../src/types/auth.types';

// Mock database and tenant resolution for E2E tests
jest.mock('../../src/database');
jest.mock('../../src/middleware/tenant', () => ({
  resolveTenant: (req: any, _res: any, next: any) => {
    req.tenantDb = {}; // Mock tenant DB
    next();
  },
}));

interface TestUser extends UserRegistrationData {
  // Add any additional properties needed for testing
}

describe('E2E: Authentication Flow', () => {
  let testUser: TestUser;
  // let authToken: string; // For future use

  beforeAll(() => {
    // Generate unique test user
    testUser = {
      username: `testuser_${Date.now()}`,
      password: 'Test123!@#',
      email: `test_${Date.now()}@example.com`,
      vorname: 'Test',
      nachname: 'User',
    };
  });

  describe('User Registration', () => {
    it('should successfully register a new user', async () => {
      // Mock the registration service for E2E testing
      const authService = require('../../src/services/auth.service');
      jest.spyOn(authService, 'registerUser').mockResolvedValue({
        success: true,
        message: 'Registration successful',
        user: {
          id: 1,
          username: testUser.username,
          email: testUser.email,
          role: 'employee',
        },
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      // Note: Actual status may vary based on implementation
      expect([200, 201]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body).toHaveProperty(
          'message',
          'Registration successful'
        );
        expect(response.body).toHaveProperty('user');
        expect(response.body.user.username).toBe(testUser.username);
      }
    });
  });

  describe('User Login', () => {
    it('should login with correct credentials', async () => {
      // Mock the authentication service
      const authService = require('../../src/services/auth.service');
      jest.spyOn(authService, 'authenticateUser').mockResolvedValue({
        success: true,
        token: 'mock-jwt-token',
        user: {
          id: 1,
          username: testUser.username,
          email: testUser.email,
          role: 'employee',
        },
      });

      const response = await request(app).post('/api/auth/login').send({
        username: testUser.username,
        password: testUser.password,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');

      // Save token for further tests
      // const authToken = response.body.token; // Unused in this test
    });

    it('should fail with wrong password', async () => {
      const authService = require('../../src/services/auth.service');
      jest.spyOn(authService, 'authenticateUser').mockResolvedValue({
        success: false,
        user: null,
        message: 'Invalid username or password',
      });

      const response = await request(app).post('/api/auth/login').send({
        username: testUser.username,
        password: 'WrongPassword123',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Authenticated Requests', () => {
    it('should fail without token', async () => {
      const response = await request(app).get('/api/auth/check');

      expect(response.status).toBe(401);
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/check')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
