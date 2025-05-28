/**
 * End-to-End Test: Complete Authentication Flow
 * Tests the full user journey from registration to login
 */

const request = require('supertest');
const app = require('../../src/app');

describe('E2E: Authentication Flow', () => {
  let testUser;
  let authToken;

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
      const response = await request(app).post('/api/register').send(testUser);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty(
        'message',
        'Registration successful'
      );
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe(testUser.username);
    });

    it('should not allow duplicate registration', async () => {
      const response = await request(app).post('/api/register').send(testUser);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('User Login', () => {
    it('should login with correct credentials', async () => {
      const response = await request(app).post('/api/login').send({
        username: testUser.username,
        password: testUser.password,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');

      // Save token for further tests
      authToken = response.body.token;
    });

    it('should fail with wrong password', async () => {
      const response = await request(app).post('/api/login').send({
        username: testUser.username,
        password: 'WrongPassword123',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Authenticated Requests', () => {
    it('should access protected route with token', async () => {
      const response = await request(app)
        .get('/api/auth/user')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('username', testUser.username);
    });

    it('should fail without token', async () => {
      const response = await request(app).get('/api/auth/user');

      expect(response.status).toBe(401);
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/user')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('Profile Update', () => {
    it('should update user profile', async () => {
      const updateData = {
        email: `updated_${Date.now()}@example.com`,
        vorname: 'Updated',
      };

      const response = await request(app)
        .patch('/api/auth/user')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('email', updateData.email);
      expect(response.body).toHaveProperty('vorname', updateData.vorname);
    });
  });

  describe('Logout', () => {
    it('should successfully logout', async () => {
      const response = await request(app)
        .get('/api/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Logout successful');
    });
  });
});
