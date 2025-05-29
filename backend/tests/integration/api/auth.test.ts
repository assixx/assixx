/**
 * Auth API Integration Tests (TypeScript)
 */

import request from 'supertest';
import app from '../../../src/app';
import authService from '../../../src/services/auth.service';
import { AuthResult } from '../../../src/types/auth.types';

// Mock the database
jest.mock('../../../src/database');

// Mock middleware that might interfere with tests
jest.mock('../../../src/middleware/tenant', () => ({
  resolveTenant: (req: any, _res: any, next: any) => {
    req.tenantDb = {}; // Mock tenant DB
    next();
  },
}));

describe('Auth API Integration Tests', () => {
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      // Mock the auth service response
      const mockAuthResult: AuthResult = {
        success: true,
        token: 'test-token',
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'employee',
          tenantId: 1,
          departmentId: null,
          isActive: true,
          isArchived: false,
          profilePicture: null,
          phoneNumber: null,
          position: null,
          hireDate: null,
          birthDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      jest
        .spyOn(authService, 'authenticateUser')
        .mockResolvedValue(mockAuthResult);

      const response = await request(app).post('/api/auth/login').send({
        username: 'testuser',
        password: 'password123',
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token', 'test-token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe('testuser');
    });

    it('should fail with invalid credentials', async () => {
      const mockAuthResult: AuthResult = {
        success: false,
        user: null,
        message: 'Invalid username or password',
      };

      jest
        .spyOn(authService, 'authenticateUser')
        .mockResolvedValue(mockAuthResult);

      const response = await request(app).post('/api/auth/login').send({
        username: 'wronguser',
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message');
    });

    it('should require username and password', async () => {
      const response = await request(app).post('/api/auth/login').send({});

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/auth/check', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/auth/check');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/health', () => {
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
