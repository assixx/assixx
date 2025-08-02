/**
 * Users API v2 Controller
 * Handles HTTP requests and delegates business logic to service layer
 */

import { Response } from "express";
import { validationResult, ValidationError } from "express-validator";

import { AuthenticatedRequest } from "../../../types/request.types";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from "../../../utils/apiResponse";
import { uploadMiddleware } from "../../../utils/uploadMiddleware";

import { usersService, ServiceError } from "./users.service";
import {
  CreateUserBody,
  UpdateUserBody,
  UpdateProfileBody,
  ChangePasswordBody,
  UpdateAvailabilityBody,
  ListUsersQuery,
} from "./users.types";

// Helper to map validation errors to our error response format
function mapValidationErrors(
  errors: ValidationError[],
): Array<{ field: string; message: string }> {
  return errors.map((error) => ({
    field: error.type === "field" ? error.path : "general",
    message: error.msg,
  }));
}

export const usersController = {
  // List all users with pagination and filters
  async listUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res
          .status(400)
          .json(
            errorResponse(
              "VALIDATION_ERROR",
              "Invalid input",
              mapValidationErrors(errors.array()),
            ),
          );
        return;
      }

      if (!req.tenantId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Tenant ID missing"));
        return;
      }
      const result = await usersService.listUsers(
        req.tenantId,
        req.query as ListUsersQuery,
      );

      res.json(paginatedResponse(result.data, result.pagination));
    } catch (error) {
      console.error("[Users v2] List error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.code, error.message, error.details));
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to fetch users"));
      }
    }
  },

  // Get current authenticated user
  async getCurrentUser(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.userId || !req.tenantId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "User ID or Tenant ID missing"));
        return;
      }
      const user = await usersService.getUserById(req.userId, req.tenantId);
      res.json(successResponse(user));
    } catch (error) {
      console.error("[Users v2] Get current user error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.code, error.message));
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to fetch user"));
      }
    }
  },

  // Get user by ID
  async getUserById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res
          .status(400)
          .json(
            errorResponse(
              "VALIDATION_ERROR",
              "Invalid input",
              mapValidationErrors(errors.array()),
            ),
          );
        return;
      }

      const userId = parseInt(req.params.id);
      if (!req.tenantId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Tenant ID missing"));
        return;
      }
      const user = await usersService.getUserById(userId, req.tenantId);
      res.json(successResponse(user));
    } catch (error) {
      console.error("[Users v2] Get user by ID error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.code, error.message));
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to fetch user"));
      }
    }
  },

  // Create new user
  async createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res
          .status(400)
          .json(
            errorResponse(
              "VALIDATION_ERROR",
              "Invalid input",
              mapValidationErrors(errors.array()),
            ),
          );
        return;
      }

      const body = req.body as CreateUserBody;
      if (!req.tenantId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Tenant ID missing"));
        return;
      }
      const user = await usersService.createUser(body, req.tenantId);

      res.status(201).json(successResponse(user, "User created successfully"));
    } catch (error) {
      console.error("[Users v2] Create error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.code, error.message));
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to create user"));
      }
    }
  },

  // Update user
  async updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res
          .status(400)
          .json(
            errorResponse(
              "VALIDATION_ERROR",
              "Invalid input",
              mapValidationErrors(errors.array()),
            ),
          );
        return;
      }

      const userId = parseInt(req.params.id);
      const body = req.body as UpdateUserBody;
      if (!req.tenantId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Tenant ID missing"));
        return;
      }
      const user = await usersService.updateUser(userId, body, req.tenantId);

      res.json(successResponse(user, "User updated successfully"));
    } catch (error) {
      console.error("[Users v2] Update error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.code, error.message));
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to update user"));
      }
    }
  },

  // Update current user profile
  async updateCurrentUserProfile(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res
          .status(400)
          .json(
            errorResponse(
              "VALIDATION_ERROR",
              "Invalid input",
              mapValidationErrors(errors.array()),
            ),
          );
        return;
      }

      const body = req.body as UpdateProfileBody;
      if (!req.userId || !req.tenantId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "User ID or Tenant ID missing"));
        return;
      }
      const user = await usersService.updateProfile(
        req.userId,
        body,
        req.tenantId,
      );

      res.json(successResponse(user, "Profile updated successfully"));
    } catch (error) {
      console.error("[Users v2] Update profile error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.code, error.message));
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to update profile"));
      }
    }
  },

  // Change password
  async changePassword(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res
          .status(400)
          .json(
            errorResponse(
              "VALIDATION_ERROR",
              "Invalid input",
              mapValidationErrors(errors.array()),
            ),
          );
        return;
      }

      const { currentPassword, newPassword } = req.body as ChangePasswordBody;
      if (!req.userId || !req.tenantId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "User ID or Tenant ID missing"));
        return;
      }
      await usersService.changePassword(
        req.userId,
        req.tenantId,
        currentPassword,
        newPassword,
      );

      res.json(successResponse(null, "Password changed successfully"));
    } catch (error) {
      console.error("[Users v2] Change password error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.code, error.message));
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to change password"));
      }
    }
  },

  // Delete user
  async deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res
          .status(400)
          .json(
            errorResponse(
              "VALIDATION_ERROR",
              "Invalid input",
              mapValidationErrors(errors.array()),
            ),
          );
        return;
      }

      const userId = parseInt(req.params.id);
      if (!req.userId || !req.tenantId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "User ID or Tenant ID missing"));
        return;
      }
      await usersService.deleteUser(userId, req.userId, req.tenantId);

      res.json(successResponse(null, "User deleted successfully"));
    } catch (error) {
      console.error("[Users v2] Delete error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.code, error.message));
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to delete user"));
      }
    }
  },

  // Archive user
  async archiveUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    console.log("[DEBUG] archiveUser called");
    console.log("[DEBUG] req.params:", req.params);
    console.log("[DEBUG] req.user:", req.user);
    console.log("[DEBUG] req.tenantId:", req.tenantId);

    try {
      // Skip validation for now to debug
      /*
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log("[DEBUG] Validation errors found:", errors.array());
        res
          .status(400)
          .json(
            errorResponse(
              "VALIDATION_ERROR",
              "Invalid input",
              mapValidationErrors(errors.array()),
            ),
          );
        return;
      }
      */

      const userId = parseInt(req.params.id);
      if (!req.tenantId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Tenant ID missing"));
        return;
      }
      await usersService.archiveUser(userId, req.tenantId);

      res.json(successResponse(null, "User archived successfully"));
    } catch (error) {
      console.error("[Users v2] Archive error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.code, error.message));
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to archive user"));
      }
    }
  },

  // Unarchive user
  async unarchiveUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res
          .status(400)
          .json(
            errorResponse(
              "VALIDATION_ERROR",
              "Invalid input",
              mapValidationErrors(errors.array()),
            ),
          );
        return;
      }

      const userId = parseInt(req.params.id);
      if (!req.tenantId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Tenant ID missing"));
        return;
      }
      await usersService.unarchiveUser(userId, req.tenantId);

      res.json(successResponse(null, "User unarchived successfully"));
    } catch (error) {
      console.error("[Users v2] Unarchive error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.code, error.message));
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to unarchive user"));
      }
    }
  },

  // Get profile picture
  async getProfilePicture(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.userId || !req.tenantId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "User ID or Tenant ID missing"));
        return;
      }
      const filePath = await usersService.getProfilePicturePath(
        req.userId,
        req.tenantId,
      );
      res.sendFile(filePath);
    } catch (error) {
      console.error("[Users v2] Get profile picture error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.code, error.message));
      } else {
        res
          .status(500)
          .json(
            errorResponse("SERVER_ERROR", "Failed to fetch profile picture"),
          );
      }
    }
  },

  // Upload profile picture
  async uploadProfilePicture(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    uploadMiddleware.single("profilePicture")(req, res, (err) => {
      if (err) {
        res.status(400).json(errorResponse("BAD_REQUEST", err.message));
        return;
      }

      // Handle async operations in a separate function
      const handleUpload = async () => {
        try {
          if (!req.file) {
            res
              .status(400)
              .json(errorResponse("BAD_REQUEST", "No file uploaded"));
            return;
          }

          if (!req.userId || !req.tenantId) {
            res
              .status(401)
              .json(
                errorResponse("UNAUTHORIZED", "User ID or Tenant ID missing"),
              );
            return;
          }
          const user = await usersService.updateProfilePicture(
            req.userId,
            req.file.path,
            req.tenantId,
          );

          res.json(
            successResponse(user, "Profile picture uploaded successfully"),
          );
        } catch (error) {
          console.error("[Users v2] Upload profile picture error:", error);
          if (error instanceof ServiceError) {
            res
              .status(error.statusCode)
              .json(errorResponse(error.code, error.message));
          } else {
            res
              .status(500)
              .json(
                errorResponse(
                  "SERVER_ERROR",
                  "Failed to upload profile picture",
                ),
              );
          }
        }
      };

      // Execute the async handler
      void handleUpload();
    });
  },

  // Delete profile picture
  async deleteProfilePicture(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.userId || !req.tenantId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "User ID or Tenant ID missing"));
        return;
      }
      await usersService.deleteProfilePicture(req.userId, req.tenantId);
      res.json(successResponse(null, "Profile picture deleted successfully"));
    } catch (error) {
      console.error("[Users v2] Delete profile picture error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.code, error.message));
      } else {
        res
          .status(500)
          .json(
            errorResponse("SERVER_ERROR", "Failed to delete profile picture"),
          );
      }
    }
  },

  // Update availability
  async updateAvailability(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res
          .status(400)
          .json(
            errorResponse(
              "VALIDATION_ERROR",
              "Invalid input",
              mapValidationErrors(errors.array()),
            ),
          );
        return;
      }

      const userId = parseInt(req.params.id);
      const body = req.body as UpdateAvailabilityBody;
      if (!req.tenantId) {
        res
          .status(401)
          .json(errorResponse("UNAUTHORIZED", "Tenant ID missing"));
        return;
      }
      const user = await usersService.updateAvailability(
        userId,
        body,
        req.tenantId,
      );

      res.json(successResponse(user, "Availability updated successfully"));
    } catch (error) {
      console.error("[Users v2] Update availability error:", error);
      if (error instanceof ServiceError) {
        res
          .status(error.statusCode)
          .json(errorResponse(error.code, error.message));
      } else {
        res
          .status(500)
          .json(errorResponse("SERVER_ERROR", "Failed to update availability"));
      }
    }
  },
};
