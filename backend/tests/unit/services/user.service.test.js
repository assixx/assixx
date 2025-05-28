const userService = require('../../../src/services/user.service');
const User = require('../../../src/models/user');

// Mock the User model
jest.mock('../../../src/models/user');

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserById', () => {
    it('should return user without password', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        role: 'employee',
      };

      User.findById.mockResolvedValue(mockUser);

      const result = await userService.getUserById(1);

      expect(result).toEqual({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'employee',
      });
      expect(result.password).toBeUndefined();
    });

    it('should return null if user not found', async () => {
      User.findById.mockResolvedValue(null);

      const result = await userService.getUserById(999);

      expect(result).toBeNull();
    });
  });

  describe('getUsers', () => {
    it('should return paginated users without passwords', async () => {
      const mockUsers = {
        data: [
          { id: 1, username: 'user1', password: 'hash1' },
          { id: 2, username: 'user2', password: 'hash2' },
        ],
        total: 2,
      };

      User.findAll.mockResolvedValue(mockUsers);

      const result = await userService.getUsers({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].password).toBeUndefined();
      expect(result.data[1].password).toBeUndefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.total).toBe(2);
    });
  });

  describe('updateUser', () => {
    it('should update user and return updated data', async () => {
      const updateData = {
        email: 'newemail@example.com',
        vorname: 'Updated',
      };

      User.update.mockResolvedValue(true);
      User.findById.mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: 'newemail@example.com',
        vorname: 'Updated',
      });

      const result = await userService.updateUser(1, updateData);

      expect(User.update).toHaveBeenCalledWith(1, updateData);
      expect(result.email).toBe('newemail@example.com');
    });

    it('should not update protected fields', async () => {
      const updateData = {
        id: 999,
        password: 'newpassword',
        role: 'admin',
        email: 'newemail@example.com',
      };

      User.update.mockResolvedValue(true);
      User.findById.mockResolvedValue({ id: 1 });

      await userService.updateUser(1, updateData);

      expect(User.update).toHaveBeenCalledWith(1, {
        email: 'newemail@example.com',
      });
    });
  });

  describe('updatePassword', () => {
    it('should hash and update password', async () => {
      const bcrypt = require('bcrypt');
      jest.mock('bcrypt');
      bcrypt.hash = jest.fn().mockResolvedValue('newhash');

      User.update.mockResolvedValue(true);

      const result = await userService.updatePassword(1, 'newpassword123');

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(User.update).toHaveBeenCalledWith(1, { password: 'newhash' });
      expect(result).toBe(true);
    });
  });
});
