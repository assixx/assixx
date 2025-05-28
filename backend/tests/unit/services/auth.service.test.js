const authService = require('../../../src/services/auth.service');
const User = require('../../../src/models/user');

// Mock the User model
jest.mock('../../../src/models/user');

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

// Mock auth module
jest.mock('../../../src/auth', () => ({
  authenticateUser: jest.fn(),
  generateToken: jest.fn(),
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateUser', () => {
    it('should return success with token when credentials are valid', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        role: 'employee',
        password: 'hashedpassword',
      };

      const {
        authenticateUser: mockAuthUser,
        generateToken,
      } = require('../../../src/auth');
      mockAuthUser.mockResolvedValue(mockUser);
      generateToken.mockReturnValue('test-token');

      const result = await authService.authenticateUser(
        'testuser',
        'password123'
      );

      expect(result.success).toBe(true);
      expect(result.token).toBe('test-token');
      expect(result.user).toEqual({
        id: 1,
        username: 'testuser',
        role: 'employee',
      });
      expect(result.user.password).toBeUndefined();
    });

    it('should return failure when credentials are invalid', async () => {
      const { authenticateUser: mockAuthUser } = require('../../../src/auth');
      mockAuthUser.mockResolvedValue(null);

      const result = await authService.authenticateUser(
        'testuser',
        'wrongpassword'
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid username or password');
      expect(result.token).toBeUndefined();
    });
  });

  describe('registerUser', () => {
    it('should successfully register a new user', async () => {
      const userData = {
        username: 'newuser',
        password: 'password123',
        email: 'newuser@example.com',
        vorname: 'New',
        nachname: 'User',
      };

      User.findByUsername.mockResolvedValue(null);
      User.findByEmail.mockResolvedValue(null);
      User.create.mockResolvedValue(123);
      User.findById.mockResolvedValue({
        id: 123,
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'hashedpassword',
      });

      const bcrypt = require('bcrypt');
      bcrypt.hash.mockResolvedValue('hashedpassword');

      const result = await authService.registerUser(userData);

      expect(result.success).toBe(true);
      expect(result.user.id).toBe(123);
      expect(result.user.password).toBeUndefined();
      expect(User.create).toHaveBeenCalledWith({
        username: 'newuser',
        password: 'hashedpassword',
        email: 'newuser@example.com',
        vorname: 'New',
        nachname: 'User',
        role: 'employee',
      });
    });

    it('should fail if username already exists', async () => {
      User.findByUsername.mockResolvedValue({
        id: 1,
        username: 'existinguser',
      });

      const result = await authService.registerUser({
        username: 'existinguser',
        password: 'password123',
        email: 'new@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Username already exists');
    });
  });
});
