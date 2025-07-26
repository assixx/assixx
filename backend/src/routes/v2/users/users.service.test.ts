/**
 * Unit Tests for Users v2 Service Layer
 * Tests business logic independently from HTTP layer
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { UsersService, ServiceError } from "./users.service.js";
import { User } from "../../../models/user.js";
import type { DbUser } from "../../../models/user.js";

// Mock the dependencies
jest.mock("../../../models/user");
jest.mock("bcryptjs");

describe("UsersService", () => {
  let usersService: UsersService;
  let mockUser: jest.Mocked<typeof User>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Get mocked User module
    mockUser = User as jest.Mocked<typeof User>;

    // Create service instance
    usersService = new UsersService();
  });

  describe("listUsers", () => {
    it("should return paginated users with default parameters", async () => {
      const mockUsers: DbUser[] = [
        {
          id: 1,
          username: "user1",
          email: "user1@test.com",
          password: "hashed",
          role: "employee",
          first_name: "User",
          last_name: "One",
          status: "active",
          is_archived: false,
          tenant_id: 1,
        } as DbUser,
        {
          id: 2,
          username: "user2",
          email: "user2@test.com",
          password: "hashed",
          role: "employee",
          first_name: "User",
          last_name: "Two",
          status: "active",
          is_archived: false,
          tenant_id: 1,
        } as DbUser,
      ];

      mockUser.countWithFilters.mockResolvedValueOnce(2);
      mockUser.search.mockResolvedValueOnce(mockUsers);

      const result = await usersService.listUsers(1, {});

      expect(mockUser.countWithFilters).toHaveBeenCalledWith({ tenant_id: 1 });
      expect(mockUser.search).toHaveBeenCalled();
      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({
        currentPage: 1,
        totalPages: 1,
        pageSize: 20,
        totalItems: 2,
      });
    });

    it("should apply search filter when provided", async () => {
      const mockUsers: DbUser[] = [
        {
          id: 1,
          username: "test",
          email: "test@test.com",
          password: "hashed",
          role: "employee",
          first_name: "Test",
          last_name: "User",
          status: "active",
          is_archived: false,
          tenant_id: 1,
        } as DbUser,
      ];

      mockUser.countWithFilters.mockResolvedValueOnce(1);
      mockUser.search.mockResolvedValueOnce(mockUsers);

      const result = await usersService.listUsers(1, {
        search: "test",
        page: "1",
        limit: "10",
        sortBy: "id",
        sortOrder: "asc",
      });

      expect(mockUser.search).toHaveBeenCalledWith(
        expect.objectContaining({
          search: "test",
          limit: 10,
          page: 1,
          sort_by: "id",
          sort_dir: "asc",
        }),
      );
      expect(result.data).toHaveLength(1);
    });

    it("should handle role filter", async () => {
      mockUser.countWithFilters.mockResolvedValueOnce(0);
      mockUser.search.mockResolvedValueOnce([]);

      await usersService.listUsers(1, { role: "admin" });

      expect(mockUser.countWithFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 1,
          role: "admin",
        }),
      );
    });
  });

  describe("getUserById", () => {
    it("should return user when found", async () => {
      const mockUserData: DbUser = {
        id: 1,
        username: "testuser",
        email: "test@test.com",
        password: "hashed",
        role: "employee",
        first_name: "Test",
        last_name: "User",
        status: "active",
        is_archived: false,
        tenant_id: 1,
      } as DbUser;

      mockUser.findById.mockResolvedValueOnce(mockUserData);

      const result = await usersService.getUserById(1, 1);

      expect(result).toMatchObject({
        id: 1,
        username: "testuser",
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      });
      expect(mockUser.findById).toHaveBeenCalledWith(1, 1);
    });

    it("should throw ServiceError when user not found", async () => {
      mockUser.findById.mockResolvedValueOnce(undefined);

      await expect(usersService.getUserById(1, 1)).rejects.toThrow(
        ServiceError,
      );
      await expect(usersService.getUserById(1, 1)).rejects.toMatchObject({
        code: "NOT_FOUND",
        statusCode: 404,
      });
    });
  });

  describe("createUser", () => {
    it("should create user with hashed password", async () => {
      const userData = {
        username: "newuser",
        email: "new@test.com",
        password: "password123",
        firstName: "New",
        lastName: "User",
        role: "employee" as const,
      };

      const dbUserData: DbUser = {
        id: 10,
        username: "newuser",
        email: "new@test.com",
        password: "hashed",
        first_name: "New",
        last_name: "User",
        role: "employee",
        status: "active",
        is_archived: false,
        tenant_id: 1,
      } as DbUser;

      mockUser.findByEmail.mockResolvedValueOnce(undefined);
      mockUser.create.mockResolvedValueOnce(10);
      mockUser.findById.mockResolvedValueOnce(dbUserData);

      const result = await usersService.createUser(userData, 1);

      expect(mockUser.findByEmail).toHaveBeenCalledWith("new@test.com");
      expect(mockUser.create).toHaveBeenCalled();
      expect(result).toMatchObject({ id: 10 });
    });

    it("should throw ServiceError on duplicate email", async () => {
      const userData = {
        username: "user",
        email: "existing@test.com",
        password: "pass",
        firstName: "Existing",
        lastName: "User",
        role: "employee" as const,
      };

      mockUser.findByEmail.mockResolvedValueOnce({
        id: 1,
        email: "existing@test.com",
      } as DbUser);

      await expect(usersService.createUser(userData, 1)).rejects.toThrow(
        ServiceError,
      );
      await expect(usersService.createUser(userData, 1)).rejects.toMatchObject({
        code: "CONFLICT",
        statusCode: 409,
      });
    });
  });

  describe("updateUser", () => {
    it("should update user fields", async () => {
      const updates = {
        firstName: "Updated",
        lastName: "Name",
      };

      const updatedUser: DbUser = {
        id: 1,
        username: "test",
        email: "test@test.com",
        password: "hashed",
        first_name: "Updated",
        last_name: "Name",
        role: "employee",
        status: "active",
        is_archived: false,
        tenant_id: 1,
      } as DbUser;

      mockUser.update.mockResolvedValueOnce(true);
      mockUser.findById.mockResolvedValueOnce(updatedUser);

      const result = await usersService.updateUser(1, updates, 1);

      expect(result).toMatchObject({
        firstName: "Updated",
        lastName: "Name",
      });
    });

    it("should throw ServiceError when user not found after update", async () => {
      mockUser.update.mockResolvedValueOnce(true);
      mockUser.findById.mockResolvedValueOnce(undefined);

      await expect(usersService.updateUser(999, {}, 1)).rejects.toThrow(
        ServiceError,
      );
      await expect(usersService.updateUser(999, {}, 1)).rejects.toMatchObject({
        code: "SERVER_ERROR",
        statusCode: 500,
      });
    });
  });

  describe("deleteUser", () => {
    it("should delete user successfully", async () => {
      const mockUserData: DbUser = {
        id: 1,
        username: "testuser",
        email: "test@test.com",
        password: "hashed",
        role: "employee",
        first_name: "Test",
        last_name: "User",
        status: "active",
        is_archived: false,
        tenant_id: 1,
      } as DbUser;

      mockUser.findById.mockResolvedValueOnce(mockUserData);
      mockUser.delete.mockResolvedValueOnce(true);

      const result = await usersService.deleteUser(1, 2, 1); // currentUserId: 2

      expect(result).toBe(true);
      expect(mockUser.delete).toHaveBeenCalledWith(1);
    });

    it("should throw error when trying to delete yourself", async () => {
      const mockUserData: DbUser = {
        id: 1,
        username: "testuser",
        email: "test@test.com",
        password: "hashed",
        role: "employee",
        first_name: "Test",
        last_name: "User",
        status: "active",
        is_archived: false,
        tenant_id: 1,
      } as DbUser;

      mockUser.findById.mockResolvedValueOnce(mockUserData);

      await expect(usersService.deleteUser(1, 1, 1)).rejects.toThrow(
        ServiceError,
      );
      await expect(usersService.deleteUser(1, 1, 1)).rejects.toMatchObject({
        code: "BAD_REQUEST",
        statusCode: 400,
      });
    });

    it("should throw ServiceError when user not found", async () => {
      mockUser.findById.mockResolvedValueOnce(undefined);

      await expect(usersService.deleteUser(999, 1, 1)).rejects.toThrow(
        ServiceError,
      );
      await expect(usersService.deleteUser(999, 1, 1)).rejects.toMatchObject({
        code: "NOT_FOUND",
        statusCode: 404,
      });
    });
  });

  describe("archiveUser", () => {
    it("should archive user", async () => {
      const mockUserData: DbUser = {
        id: 1,
        username: "test",
        email: "test@test.com",
        password: "hashed",
        role: "employee",
        first_name: "Test",
        last_name: "User",
        status: "active",
        is_archived: false,
        tenant_id: 1,
      } as DbUser;

      mockUser.findById.mockResolvedValueOnce(mockUserData);
      mockUser.archiveUser.mockResolvedValueOnce(true);

      const result = await usersService.archiveUser(1, 1);

      expect(result).toBe(true);
    });
  });

  describe("unarchiveUser", () => {
    it("should unarchive user", async () => {
      const mockUserData: DbUser = {
        id: 1,
        username: "test",
        email: "test@test.com",
        password: "hashed",
        role: "employee",
        first_name: "Test",
        last_name: "User",
        status: "active",
        is_archived: true,
        tenant_id: 1,
      } as DbUser;

      mockUser.findById.mockResolvedValueOnce(mockUserData);
      mockUser.unarchiveUser.mockResolvedValueOnce(true);

      const result = await usersService.unarchiveUser(1, 1);

      expect(result).toBe(true);
    });
  });

  describe("changePassword", () => {
    it("should change password when current password is correct", async () => {
      const result = {
        success: true,
        message: "Password changed",
      };

      mockUser.changePassword.mockResolvedValueOnce(result);

      const response = await usersService.changePassword(
        1,
        1,
        "currentpass",
        "newpass",
      );

      expect(response).toBe(true);
      expect(mockUser.changePassword).toHaveBeenCalledWith(
        1,
        1,
        "currentpass",
        "newpass",
      );
    });

    it("should throw ServiceError when current password is incorrect", async () => {
      const result = {
        success: false,
        message: "Invalid password",
      };

      mockUser.changePassword.mockResolvedValueOnce(result);

      await expect(
        usersService.changePassword(1, 1, "wrongpass", "newpass"),
      ).rejects.toThrow(ServiceError);

      await expect(
        usersService.changePassword(1, 1, "wrongpass", "newpass"),
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        statusCode: 401,
      });
    });
  });

  describe("updateAvailability", () => {
    it("should update user availability status", async () => {
      const mockUserData: DbUser = {
        id: 1,
        username: "test",
        email: "test@test.com",
        password: "hashed",
        role: "employee",
        first_name: "Test",
        last_name: "User",
        status: "active",
        is_archived: false,
        tenant_id: 1,
      } as DbUser;

      const updatedUser: DbUser = {
        ...mockUserData,
        availability_status: "vacation",
      } as DbUser;

      // First check
      mockUser.findById.mockResolvedValueOnce(mockUserData);
      // After update
      mockUser.findById.mockResolvedValueOnce(updatedUser);
      mockUser.updateAvailability.mockResolvedValueOnce(true);

      const result = await usersService.updateAvailability(
        1,
        {
          availabilityStatus: "vacation",
        },
        1,
      );

      expect(result).toMatchObject({
        availabilityStatus: "vacation",
      });
      expect(mockUser.updateAvailability).toHaveBeenCalledWith(1, 1, {
        availability_status: "vacation",
        availability_start: undefined,
        availability_end: undefined,
        availability_notes: undefined,
      });
    });

    it("should throw ServiceError when user not found", async () => {
      mockUser.findById.mockResolvedValueOnce(undefined);

      await expect(
        usersService.updateAvailability(
          1,
          {
            availabilityStatus: "available",
          },
          1,
        ),
      ).rejects.toThrow(ServiceError);

      await expect(
        usersService.updateAvailability(
          1,
          {
            availabilityStatus: "available",
          },
          1,
        ),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        statusCode: 404,
      });
    });
  });
});
