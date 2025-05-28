const request = require('supertest');
const app = require('../../../src/app');
const db = require('../../../src/database');

// Mock the database
jest.mock('../../../src/database');

describe('Auth API Integration Tests', () => {
  describe('POST /api/login', () => {
    it('should login with valid credentials', async () => {
      // Mock the auth service response
      const authService = require('../../../src/services/auth.service');
      jest.spyOn(authService, 'authenticateUser').mockResolvedValue({
        success: true,
        token: 'test-token',
        user: { id: 1, username: 'testuser', role: 'employee' }
      });

      const response = await request(app)
        .post('/api/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token', 'test-token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe('testuser');
    });

    it('should fail with invalid credentials', async () => {
      const authService = require('../../../src/services/auth.service');
      jest.spyOn(authService, 'authenticateUser').mockResolvedValue({
        success: false,
        message: 'Invalid username or password'
      });

      const response = await request(app)
        .post('/api/login')
        .send({
          username: 'wronguser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });

    it('should require username and password', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Username and password are required');
    });
  });

  describe('GET /api/auth/check', () => {
    it('should return authenticated true with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/check')
        .set('Authorization', 'Bearer valid-test-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('authenticated', true);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/check');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });
});