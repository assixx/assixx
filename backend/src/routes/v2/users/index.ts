/**
 * Users API v2 Routes
 * Implements standardized user management endpoints with camelCase responses
 */
import express, { RequestHandler, Router } from 'express';

import { rateLimiter } from '../../../middleware/rateLimiter';
import { authenticateV2, requireRoleV2 } from '../../../middleware/v2/auth.middleware';
import { typed } from '../../../utils/routeHandlers';
import { usersController } from './users.controller';
import { usersValidation } from './users.validation';

const router: Router = express.Router();

// Apply general API rate limiting to all routes
router.use(rateLimiter.api);

/**

 * /api/v2/users:
 *   get:
 *     summary: List all users
 *     description: Get a paginated list of users with optional filters (admin only)
 *     tags: [Users v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - name: role
 *         in: query
 *         description: Filter by user role
 *         schema:
 *           type: string
 *           enum: [employee, admin, root]
 *       - name: isActive
 *         in: query
 *         description: Filter by active status
 *         schema:
 *           type: boolean
 *       - name: isArchived
 *         in: query
 *         description: Filter by archived status
 *         schema:
 *           type: boolean
 *       - name: sortBy
 *         in: query
 *         description: Sort field
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, last_name, email]
 *           default: created_at
 *       - name: sortOrder
 *         in: query
 *         description: Sort order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Successfully retrieved users list
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/UserV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
// List all users (admin only)
router.get(
  '/',
  authenticateV2 as RequestHandler,
  requireRoleV2(['admin', 'root']) as RequestHandler,
  usersValidation.list,
  typed.auth((req, res) => usersController.listUsers(req, res)),
);

/**

 * /api/v2/users/me:
 *   get:
 *     summary: Get current user
 *     description: Get the profile of the currently authenticated user
 *     tags: [Users v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved user profile
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Get current user
router.get('/me', authenticateV2 as RequestHandler, typed.auth(usersController.getCurrentUser));

/**

 * /api/v2/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Get a specific user by their ID (admin only)
 *     tags: [Users v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Successfully retrieved user
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// Get user by ID (admin only)
router.get(
  '/:id',
  authenticateV2 as RequestHandler,
  requireRoleV2(['admin', 'root']) as RequestHandler,
  usersValidation.getById,
  typed.auth(usersController.getUserById),
);

/**

 * /api/v2/users:
 *   post:
 *     summary: Create new user
 *     description: Create a new user account (admin only)
 *     tags: [Users v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: newuser@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePass123!
 *               firstName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: John
 *               lastName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: Doe
 *               role:
 *                 type: string
 *                 enum: [employee, admin]
 *                 example: employee
 *               employeeNumber:
 *                 type: string
 *                 maxLength: 50
 *                 example: EMP001
 *                 description: Optional employee number (auto-generated if not provided)
 *               phone:
 *                 type: string
 *                 maxLength: 20
 *                 example: +1234567890
 *               position:
 *                 type: string
 *                 maxLength: 100
 *                 example: Software Developer
 *               departmentId:
 *                 type: integer
 *                 example: 1
 *               teamId:
 *                 type: integer
 *                 example: 1
 *               address:
 *                 type: string
 *                 maxLength: 255
 *                 example: 123 Main St, City
 *               emergencyContact:
 *                 type: string
 *                 maxLength: 100
 *                 example: Jane Doe
 *               emergencyPhone:
 *                 type: string
 *                 maxLength: 20
 *                 example: +0987654321
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserV2'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: Email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
// Create new user (admin only)
router.post(
  '/',
  authenticateV2 as RequestHandler,
  requireRoleV2(['admin', 'root']) as RequestHandler,
  rateLimiter.auth, // Stricter rate limiting for user creation
  usersValidation.create,
  typed.auth(usersController.createUser),
);

/**

 * /api/v2/users/{id}:
 *   put:
 *     summary: Update user
 *     description: Update user information (admin only)
 *     tags: [Users v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [employee, admin]
 *               phone:
 *                 type: string
 *               position:
 *                 type: string
 *               departmentId:
 *                 type: integer
 *               teamId:
 *                 type: integer
 *               address:
 *                 type: string
 *               emergencyContact:
 *                 type: string
 *               emergencyPhone:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserV2'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// Update user (admin only)
router.put(
  '/:id',
  authenticateV2 as RequestHandler,
  requireRoleV2(['admin', 'root']) as RequestHandler,
  usersValidation.update,
  typed.auth(usersController.updateUser),
);

/**

 * /api/v2/users/me/profile:
 *   put:
 *     summary: Update profile
 *     description: Update current user's profile (limited fields)
 *     tags: [Users v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *               lastName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *               phone:
 *                 type: string
 *                 maxLength: 20
 *               address:
 *                 type: string
 *                 maxLength: 255
 *               emergencyContact:
 *                 type: string
 *                 maxLength: 100
 *               emergencyPhone:
 *                 type: string
 *                 maxLength: 20
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserV2'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Update current user profile
router.put(
  '/me/profile',
  authenticateV2 as RequestHandler,
  usersValidation.updateProfile,
  typed.auth(usersController.updateCurrentUserProfile),
);

/**

 * /api/v2/users/me:
 *   patch:
 *     summary: Update current user (partial)
 *     description: Partially update current user's data including employee number
 *     tags: [Users v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               employee_number:
 *                 type: string
 *                 maxLength: 10
 *                 description: Employee number (up to 10 characters)
 *               firstName:
 *                 type: string
 *                 maxLength: 100
 *               lastName:
 *                 type: string
 *                 maxLength: 100
 *     responses:
 *       200:
 *         description: Successfully updated user
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Update current user (partial) - including employee_number
router.patch(
  '/me',
  authenticateV2 as RequestHandler,
  typed.auth(usersController.updateCurrentUserProfile),
);

/**

 * /api/v2/users/me/password:
 *   put:
 *     summary: Change password
 *     description: Change current user's password
 *     tags: [Users v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 description: Current password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: New password (min 8 chars, must contain uppercase, lowercase, number and special char)
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: null
 *                     message:
 *                       type: string
 *                       example: Password changed successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid current password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
// Change password
router.put(
  '/me/password',
  authenticateV2 as RequestHandler,
  rateLimiter.auth, // Very strict for password changes
  usersValidation.changePassword,
  typed.auth(usersController.changePassword),
);

/**

 * /api/v2/users/{id}:
 *   delete:
 *     summary: Delete user
 *     description: Permanently delete a user (admin only)
 *     tags: [Users v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: null
 *                     message:
 *                       type: string
 *                       example: User deleted successfully
 *       400:
 *         description: Cannot delete your own account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// Delete user (admin only)
router.delete(
  '/:id',
  authenticateV2 as RequestHandler,
  requireRoleV2(['admin', 'root']) as RequestHandler,
  usersValidation.getById,
  typed.auth(usersController.deleteUser),
);

/**

 * /api/v2/users/{id}/archive:
 *   post:
 *     summary: Archive user
 *     description: Archive a user account (admin only)
 *     tags: [Users v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: null
 *                     message:
 *                       type: string
 *                       example: User archived successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// Archive user (admin only)
router.post(
  '/:id/archive',
  authenticateV2 as RequestHandler,
  requireRoleV2(['admin', 'root']) as RequestHandler,
  typed.auth((req, res) => usersController.archiveUser(req, res)),
);

/**

 * /api/v2/users/{id}/unarchive:
 *   post:
 *     summary: Unarchive user
 *     description: Unarchive a user account (admin only)
 *     tags: [Users v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User unarchived successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: null
 *                     message:
 *                       type: string
 *                       example: User unarchived successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// Unarchive user (admin only)
router.post(
  '/:id/unarchive',
  authenticateV2 as RequestHandler,
  requireRoleV2(['admin', 'root']) as RequestHandler,
  typed.auth((req, res) => usersController.unarchiveUser(req, res)),
);

/**

 * /api/v2/users/me/profile-picture:
 *   get:
 *     summary: Get profile picture
 *     description: Get the current user's profile picture
 *     tags: [Users v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile picture file
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Profile picture not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
// Profile picture endpoints
router.get(
  '/me/profile-picture',
  authenticateV2 as RequestHandler,
  typed.auth(usersController.getProfilePicture),
);

/**

 * /api/v2/users/me/profile-picture:
 *   post:
 *     summary: Upload profile picture
 *     description: Upload a new profile picture for the current user
 *     tags: [Users v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - profilePicture
 *             properties:
 *               profilePicture:
 *                 type: string
 *                 format: binary
 *                 description: Image file (JPEG, PNG, max 5MB)
 *     responses:
 *       200:
 *         description: Profile picture uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserV2'
 *       400:
 *         description: Invalid file or file too large
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  '/me/profile-picture',
  authenticateV2 as RequestHandler,
  rateLimiter.upload, // Limit uploads
  typed.auth((req, res) => {
    usersController.uploadProfilePicture(req, res);
  }),
);

/**

 * /api/v2/users/me/profile-picture:
 *   delete:
 *     summary: Delete profile picture
 *     description: Delete the current user's profile picture
 *     tags: [Users v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile picture deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: null
 *                     message:
 *                       type: string
 *                       example: Profile picture deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: No profile picture to delete
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.delete(
  '/me/profile-picture',
  authenticateV2 as RequestHandler,
  typed.auth(usersController.deleteProfilePicture),
);

/**

 * /api/v2/users/{id}/availability:
 *   put:
 *     summary: Update availability
 *     description: Update user's availability status (admin only)
 *     tags: [Users v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - availabilityStatus
 *             properties:
 *               availabilityStatus:
 *                 type: string
 *                 enum: [available, vacation, sick, training, business_trip]
 *                 description: Current availability status
 *                 example: vacation
 *               availabilityStart:
 *                 type: string
 *                 format: date
 *                 description: Start date of unavailability
 *                 example: 2025-08-01
 *               availabilityEnd:
 *                 type: string
 *                 format: date
 *                 description: End date of unavailability
 *                 example: 2025-08-15
 *               availabilityNotes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Additional notes about availability
 *                 example: Summer vacation
 *     responses:
 *       200:
 *         description: Availability updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserV2'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// Update availability (admin only)
router.put(
  '/:id/availability',
  authenticateV2 as RequestHandler,
  requireRoleV2(['admin', 'root']) as RequestHandler,
  usersValidation.updateAvailability,
  typed.auth(usersController.updateAvailability),
);

export default router;
