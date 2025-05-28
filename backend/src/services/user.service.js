/**
 * User Service
 * Handles user-related business logic
 */

const User = require('../models/user');
const { logger } = require('../utils/logger');

class UserService {
  /**
   * Get user by ID
   * @param {number} userId - User ID
   * @returns {Object} User data without password
   */
  async getUserById(userId) {
    try {
      const user = await User.findById(userId);

      if (user) {
        // Remove sensitive data
        delete user.password;
      }

      return user;
    } catch (error) {
      logger.error('Error getting user by ID:', error);
      throw error;
    }
  }

  /**
   * Get user by username
   * @param {string} username - Username
   * @returns {Object} User data
   */
  async getUserByUsername(username) {
    try {
      return await User.findByUsername(username);
    } catch (error) {
      logger.error('Error getting user by username:', error);
      throw error;
    }
  }

  /**
   * Get all users with pagination
   * @param {Object} options - Query options
   * @returns {Object} Users list with pagination info
   */
  async getUsers(options = {}) {
    try {
      const { page = 1, limit = 10, role, tenantId } = options;
      const offset = (page - 1) * limit;

      const users = await User.findAll({
        limit,
        offset,
        role,
        tenantId,
      });

      // Remove passwords from results
      users.data = users.data.map((user) => {
        delete user.password;
        return user;
      });

      return users;
    } catch (error) {
      logger.error('Error getting users:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {number} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated user data
   */
  async updateUser(userId, updateData) {
    try {
      // Remove fields that shouldn't be updated directly
      delete updateData.id;
      delete updateData.password;
      delete updateData.role;

      await User.update(userId, updateData);
      return await this.getUserById(userId);
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Update user password
   * @param {number} userId - User ID
   * @param {string} newPassword - New password (plain text)
   * @returns {boolean} Success status
   */
  async updatePassword(userId, newPassword) {
    try {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await User.update(userId, { password: hashedPassword });
      return true;
    } catch (error) {
      logger.error('Error updating password:', error);
      throw error;
    }
  }

  /**
   * Delete user (soft delete)
   * @param {number} userId - User ID
   * @returns {boolean} Success status
   */
  async deleteUser(userId) {
    try {
      await User.delete(userId);
      return true;
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Archive/Unarchive user
   * @param {number} userId - User ID
   * @param {boolean} archived - Archive status
   * @returns {boolean} Success status
   */
  async archiveUser(userId, archived = true) {
    try {
      await User.update(userId, { archived });
      return true;
    } catch (error) {
      logger.error('Error archiving user:', error);
      throw error;
    }
  }
}

module.exports = new UserService();
