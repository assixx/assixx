/**
 * Users API v2 Controller
 * Handles HTTP requests and delegates business logic to service layer
 */
import { Response } from 'express';

import type { AuthenticatedRequest } from '../../../types/request.types.js';
import {
  type PaginationMeta,
  errorResponse,
  paginatedResponse,
  successResponse,
} from '../../../utils/apiResponse.js';
import { uploadMiddleware } from '../../../utils/uploadMiddleware.js';
// Removed express-validator - using Zod validation in routes

import rootLog from '../logs/logs.service.js';
import { ServiceError, usersService } from './users.service.js';
import {
  ChangePasswordBody,
  CreateUserBody,
  ListUsersQuery,
  UpdateAvailabilityBody,
  UpdateProfileBody,
  UpdateUserBody,
} from './users.types.js';

// Constants
const TENANT_ID_MISSING = 'Tenant ID missing';
const USER_OR_TENANT_ID_MISSING = 'User ID or Tenant ID missing';
const USER_ID_REQUIRED = 'User ID is required';

interface User {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive?: boolean;
  [key: string]: unknown;
}

// Validation helper removed - using Zod validation in routes

export const usersController = {
  // List all users with pagination and filters
  listUsers: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Validation is now handled by Zod middleware in routes

      if (req.tenantId === undefined) {
        res.status(401).json(errorResponse('UNAUTHORIZED', TENANT_ID_MISSING));
        return;
      }
      const result = await usersService.listUsers(req.tenantId, req.query as ListUsersQuery);

      const typedResult = result as {
        data: unknown[];
        pagination: PaginationMeta;
      };
      res.json(paginatedResponse(typedResult.data, typedResult.pagination));
    } catch (error: unknown) {
      console.error('[Users v2] List error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message, error.details));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to fetch users'));
      }
    }
  },

  // Get current authenticated user
  getCurrentUser: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (req.userId === undefined || req.tenantId === undefined) {
        res.status(401).json(errorResponse('UNAUTHORIZED', USER_OR_TENANT_ID_MISSING));
        return;
      }
      const user = await usersService.getUserById(req.userId, req.tenantId);
      res.json(successResponse(user));
    } catch (error: unknown) {
      console.error('[Users v2] Get current user error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to fetch user'));
      }
    }
  },

  // Get user by ID
  getUserById: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Validation is now handled by Zod middleware in routes

      const idParam = req.params['id'];
      if (idParam === undefined) {
        res.status(400).json(errorResponse('BAD_REQUEST', USER_ID_REQUIRED));
        return;
      }
      const userId = Number.parseInt(idParam, 10);
      if (req.tenantId === undefined) {
        res.status(401).json(errorResponse('UNAUTHORIZED', TENANT_ID_MISSING));
        return;
      }
      const user = await usersService.getUserById(userId, req.tenantId);
      res.json(successResponse(user));
    } catch (error: unknown) {
      console.error('[Users v2] Get user by ID error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to fetch user'));
      }
    }
  },

  // Create new user
  createUser: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Validation is now handled by Zod middleware in routes

      const body = req.body as CreateUserBody;
      if (req.tenantId === undefined) {
        res.status(401).json(errorResponse('UNAUTHORIZED', TENANT_ID_MISSING));
        return;
      }
      const user = await usersService.createUser(body, req.tenantId);

      // Log user creation
      await rootLog.create({
        tenant_id: req.tenantId,
        user_id: req.userId ?? 0,
        action: 'create',
        entity_type: 'user',
        entity_id: (user as User).id,
        details: `Benutzer erstellt: ${(user as User).email}`,
        new_values: {
          email: (user as User).email,
          username: (user as User).username,
          first_name: (user as User).firstName,
          last_name: (user as User).lastName,
          role: (user as User).role,
          created_by: req.user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get('user-agent'),
        was_role_switched: false,
      });

      res.status(201).json(successResponse(user, 'User created successfully'));
    } catch (error: unknown) {
      console.error('[Users v2] Create error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to create user'));
      }
    }
  },

  // Update user
  updateUser: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Validation is now handled by Zod middleware in routes

      const idParam = req.params['id'];
      if (idParam === undefined) {
        res.status(400).json(errorResponse('BAD_REQUEST', USER_ID_REQUIRED));
        return;
      }
      const userId = Number.parseInt(idParam, 10);
      const body = req.body as UpdateUserBody;
      if (req.tenantId === undefined) {
        res.status(401).json(errorResponse('UNAUTHORIZED', TENANT_ID_MISSING));
        return;
      }

      // Get old user data for logging
      const oldUser = await usersService.getUserById(userId, req.tenantId);

      const user = await usersService.updateUser(userId, body, req.tenantId);

      // Log user update
      await rootLog.create({
        tenant_id: req.tenantId,
        user_id: req.userId ?? 0,
        action: 'update',
        entity_type: 'user',
        entity_id: userId,
        details: `Benutzer aktualisiert: ${(user as User).email}`,
        old_values: {
          email: (oldUser as User | null)?.email,
          username: (oldUser as User | null)?.username,
          first_name: (oldUser as User | null)?.firstName,
          last_name: (oldUser as User | null)?.lastName,
          role: (oldUser as User | null)?.role,
          is_active: (oldUser as User | null)?.isActive,
        },
        new_values: {
          email: (user as User).email,
          username: (user as User).username,
          first_name: (user as User).firstName,
          last_name: (user as User).lastName,
          role: (user as User).role,
          is_active: (user as User).isActive,
          updated_by: req.user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get('user-agent'),
        was_role_switched: false,
      });

      res.json(successResponse(user, 'User updated successfully'));
    } catch (error: unknown) {
      console.error('[Users v2] Update error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to update user'));
      }
    }
  },

  // Update current user profile
  updateCurrentUserProfile: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Validation is now handled by Zod middleware in routes

      const body = req.body as UpdateProfileBody;
      if (req.userId === undefined || req.tenantId === undefined) {
        res.status(401).json(errorResponse('UNAUTHORIZED', USER_OR_TENANT_ID_MISSING));
        return;
      }
      const user = await usersService.updateProfile(req.userId, body, req.tenantId);

      res.json(successResponse(user, 'Profile updated successfully'));
    } catch (error: unknown) {
      console.error('[Users v2] Update profile error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to update profile'));
      }
    }
  },

  // Change password
  changePassword: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Validation is now handled by Zod middleware in routes

      const { currentPassword, newPassword } = req.body as ChangePasswordBody;
      if (req.userId === undefined || req.tenantId === undefined) {
        res.status(401).json(errorResponse('UNAUTHORIZED', USER_OR_TENANT_ID_MISSING));
        return;
      }
      await usersService.changePassword(req.userId, req.tenantId, currentPassword, newPassword);

      res.json(successResponse(null, 'Password changed successfully'));
    } catch (error: unknown) {
      console.error('[Users v2] Change password error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to change password'));
      }
    }
  },

  // Delete user
  deleteUser: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Validation is now handled by Zod middleware in routes

      const idParam = req.params['id'];
      if (idParam === undefined) {
        res.status(400).json(errorResponse('BAD_REQUEST', USER_ID_REQUIRED));
        return;
      }
      const userId = Number.parseInt(idParam, 10);
      if (req.userId === undefined || req.tenantId === undefined) {
        res.status(401).json(errorResponse('UNAUTHORIZED', USER_OR_TENANT_ID_MISSING));
        return;
      }

      // Get user data before deletion for logging
      const deletedUser = await usersService.getUserById(userId, req.tenantId);

      await usersService.deleteUser(userId, req.userId, req.tenantId);

      // Log user deletion
      await rootLog.create({
        tenant_id: req.tenantId,
        user_id: req.userId,
        action: 'delete',
        entity_type: 'user',
        entity_id: userId,
        details: `Benutzer gelöscht: ${(deletedUser as User | null)?.email ?? 'unbekannt'}`,
        old_values: {
          email: (deletedUser as User | null)?.email,
          username: (deletedUser as User | null)?.username,
          first_name: (deletedUser as User | null)?.firstName,
          last_name: (deletedUser as User | null)?.lastName,
          role: (deletedUser as User | null)?.role,
          deleted_by: req.user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get('user-agent'),
        was_role_switched: false,
      });

      res.json(successResponse(null, 'User deleted successfully'));
    } catch (error: unknown) {
      console.error('[Users v2] Delete error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to delete user'));
      }
    }
  },

  // Archive user
  async archiveUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    console.info('[DEBUG] archiveUser called');
    console.info('[DEBUG] req.params:', req.params);
    console.info('[DEBUG] req.user:', req.user);
    console.info('[DEBUG] req.tenantId:', req.tenantId);

    try {
      // Skip validation for now to debug
      /*
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.info("[DEBUG] Validation errors found:", errors.array());
        res
          .status(400)
          .json(
            errorResponse(
              VALIDATION_ERROR_CODE,
              VALIDATION_ERROR_MESSAGE,
              mapValidationErrors(errors.array()),
            ),
          );
        return;
      }
      */

      const idParam = req.params['id'];
      if (idParam === undefined) {
        res.status(400).json(errorResponse('BAD_REQUEST', USER_ID_REQUIRED));
        return;
      }
      const userId = Number.parseInt(idParam, 10);
      if (req.tenantId === undefined) {
        res.status(401).json(errorResponse('UNAUTHORIZED', TENANT_ID_MISSING));
        return;
      }
      await usersService.archiveUser(userId, req.tenantId);

      res.json(successResponse(null, 'User archived successfully'));
    } catch (error: unknown) {
      console.error('[Users v2] Archive error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to archive user'));
      }
    }
  },

  // Unarchive user
  async unarchiveUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validation is now handled by Zod middleware in routes

      const idParam = req.params['id'];
      if (idParam === undefined) {
        res.status(400).json(errorResponse('BAD_REQUEST', USER_ID_REQUIRED));
        return;
      }
      const userId = Number.parseInt(idParam, 10);
      if (req.tenantId === undefined) {
        res.status(401).json(errorResponse('UNAUTHORIZED', TENANT_ID_MISSING));
        return;
      }
      await usersService.unarchiveUser(userId, req.tenantId);

      res.json(successResponse(null, 'User unarchived successfully'));
    } catch (error: unknown) {
      console.error('[Users v2] Unarchive error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to unarchive user'));
      }
    }
  },

  // Get profile picture
  getProfilePicture: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (req.userId === undefined || req.tenantId === undefined) {
        res.status(401).json(errorResponse('UNAUTHORIZED', USER_OR_TENANT_ID_MISSING));
        return;
      }
      const filePath = await usersService.getProfilePicturePath(req.userId, req.tenantId);
      if (filePath === null) {
        throw new ServiceError('NOT_FOUND', 'Profile picture not found', 404);
      }
      res.sendFile(filePath);
    } catch (error: unknown) {
      console.error('[Users v2] Get profile picture error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to fetch profile picture'));
      }
    }
  },

  // Upload profile picture
  uploadProfilePicture: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Promisify the multer upload
    await new Promise<void>((resolve: () => void, reject: (reason?: unknown) => void) => {
      uploadMiddleware.single('profilePicture')(req, res, (err: unknown) => {
        if (err !== null && err !== undefined && err !== '') {
          const errMessage =
            err instanceof Error ? err.message
            : typeof err === 'string' ? err
            : JSON.stringify(err);
          reject(err instanceof Error ? err : new Error(errMessage));
        } else {
          resolve();
        }
      });
    }).catch((error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message
        : typeof error === 'string' ? error
        : JSON.stringify(error);
      res.status(400).json(errorResponse('BAD_REQUEST', errorMessage));
    });

    // Continue with the upload logic if no error occurred
    if (res.headersSent) return;

    try {
      if (!req.file) {
        res.status(400).json(errorResponse('BAD_REQUEST', 'No file uploaded'));
        return;
      }

      if (req.userId === undefined || req.tenantId === undefined) {
        res.status(401).json(errorResponse('UNAUTHORIZED', USER_OR_TENANT_ID_MISSING));
        return;
      }
      const user = await usersService.updateProfilePicture(req.userId, req.file.path, req.tenantId);

      res.json(successResponse(user, 'Profile picture uploaded successfully'));
    } catch (error: unknown) {
      console.error('[Users v2] Upload profile picture error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to upload profile picture'));
      }
    }
  },

  // Delete profile picture
  deleteProfilePicture: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (req.userId === undefined || req.tenantId === undefined) {
        res.status(401).json(errorResponse('UNAUTHORIZED', USER_OR_TENANT_ID_MISSING));
        return;
      }
      await usersService.deleteProfilePicture(req.userId, req.tenantId);
      res.json(successResponse(null, 'Profile picture deleted successfully'));
    } catch (error: unknown) {
      console.error('[Users v2] Delete profile picture error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to delete profile picture'));
      }
    }
  },

  // Update availability
  updateAvailability: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Validation is now handled by Zod middleware in routes

      const idParam = req.params['id'];
      if (idParam === undefined) {
        res.status(400).json(errorResponse('BAD_REQUEST', USER_ID_REQUIRED));
        return;
      }
      const userId = Number.parseInt(idParam, 10);
      const body = req.body as UpdateAvailabilityBody;
      if (req.tenantId === undefined) {
        res.status(401).json(errorResponse('UNAUTHORIZED', TENANT_ID_MISSING));
        return;
      }
      const user = await usersService.updateAvailability(userId, body, req.tenantId);

      res.json(successResponse(user, 'Availability updated successfully'));
    } catch (error: unknown) {
      console.error('[Users v2] Update availability error:', error);
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to update availability'));
      }
    }
  },
};
