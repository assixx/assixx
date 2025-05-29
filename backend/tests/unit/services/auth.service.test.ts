/**
 * Auth Service Tests (TypeScript)
 */

import authService from '../../../src/services/auth.service';
import * as User from '../../../src/models/user';
import { DatabaseUser } from '../../../src/types/models';
import {
  UserRegistrationData,
  AuthResult,
} from '../../../src/types/auth.types';

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

const mockedUser = User as jest.Mocked<typeof User>;
const mockBcrypt = require('bcrypt');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateUser', () => {
    it('should return success with token when credentials are valid', async () => {
      const mockUser: Partial<DatabaseUser> = {
        id: 1,
        username: 'testuser',
        role: 'employee',
        email: 'test@example.com',
        password_hash: 'hashedpassword',
      };

      const {
        authenticateUser: mockAuthUser,
        generateToken,
      } = require('../../../src/auth');
      mockAuthUser.mockResolvedValue(mockUser);
      generateToken.mockReturnValue('test-token');

      const result: AuthResult = await authService.authenticateUser(
        'testuser',
        'password123'
      );

      expect(result.success).toBe(true);
      expect(result.token).toBe('test-token');
      expect(result.user).toEqual({
        id: 1,
        username: 'testuser',
        role: 'employee',
        email: 'test@example.com',
      });
      expect((result.user as any)?.password_hash).toBeUndefined();
    });

    it('should return failure when credentials are invalid', async () => {
      const { authenticateUser: mockAuthUser } = require('../../../src/auth');
      mockAuthUser.mockResolvedValue(null);

      const result: AuthResult = await authService.authenticateUser(
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
      const userData: UserRegistrationData = {
        username: 'newuser',
        password: 'password123',
        email: 'newuser@example.com',
        vorname: 'New',
        nachname: 'User',
      };

      (mockedUser as any).findByUsername = jest.fn().mockResolvedValue(null);
      (mockedUser as any).findByEmail = jest.fn().mockResolvedValue(null);
      (mockedUser as any).create = jest.fn().mockResolvedValue(123);
      (mockedUser as any).findById = jest.fn().mockResolvedValue({
        id: 123,
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'hashedpassword',
        first_name: 'New',
        last_name: 'User',
        role: 'employee',
      });

      mockBcrypt.hash.mockResolvedValue('hashedpassword');

      const result: AuthResult = await authService.registerUser(userData);

      expect(result.success).toBe(true);
      expect(result.user!.id).toBe(123);
      expect((result.user as any)?.password).toBeUndefined();
      expect((mockedUser as any).create).toHaveBeenCalledWith({
        username: 'newuser',
        password: 'hashedpassword',
        email: 'newuser@example.com',
        vorname: 'New',
        nachname: 'User',
        role: 'employee',
      });
    });

    it('should fail if username already exists', async () => {
      (mockedUser as any).findByUsername = jest.fn().mockResolvedValue({
        id: 1,
        username: 'existinguser',
      });

      const userData: UserRegistrationData = {
        username: 'existinguser',
        password: 'password123',
        email: 'new@example.com',
        vorname: 'New',
        nachname: 'User',
      };

      const result: AuthResult = await authService.registerUser(userData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Username already exists');
    });
  });
});
