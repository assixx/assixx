/**
 * Authentication API Routes

 * tags:
 *   name: Authentication
 *   description: User authentication and authorization endpoints
 */
import express, { Request, Response, Router } from 'express';

import authController from '../../controllers/auth.controller';
import { security } from '../../middleware/security';
import { validationSchemas } from '../../middleware/validation';
import User from '../../models/user';
import { errorResponse, successResponse } from '../../types/response.types';
import { logger } from '../../utils/logger';
import { typed } from '../../utils/routeHandlers';

// Import models (now ES modules)

const router: Router = express.Router();

/**

 * /auth/validate:
 *   get:
 *     summary: Validate current JWT token
 *     description: Validates the current JWT token and returns user information if valid
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 valid:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     role:
 *                       type: string
 *                       enum: [root, admin, employee]
 *                     tenant_id:
 *                       type: integer
 *       401:
 *         description: Token is invalid or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 */
router.get(
  '/validate',
  ...security.user(),
  typed.auth((req, res) => {
    try {
      // Token is valid if we reach this point (authenticateToken middleware passed)
      res.json(
        successResponse(
          {
            valid: true,
            user: {
              id: req.user.id,
              username: req.user.username,
              role: req.user.role,
              tenant_id: req.user.tenant_id,
            },
          },
          'Token is valid',
        ),
      );
    } catch (error: unknown) {
      logger.error('Token validation error:', error);
      res.status(500).json(errorResponse('Fehler bei der Token-Validierung', 500));
    }
  }),
);

/**
 * @route GET /api/auth/user
 * @desc Get current user profile
 * @access Private
 */
router.get(
  '/user',
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const user = await User.findById(req.user.id, req.user.tenant_id);

      if (!user) {
        res.status(404).json(errorResponse('User not found', 404));
        return;
      }

      // Remove sensitive data
      const { password: _password, ...userWithoutPassword } = user;

      res.json(successResponse(userWithoutPassword));
    } catch (error: unknown) {
      console.error('Error in get user profile:', error);
      res.status(500).json(errorResponse('Server error', 500));
    }
  }),
);

/**

 * /auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticate user with username, password and optional browser fingerprint
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Username for authentication
 *                 example: admin
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User password
 *                 example: SecurePass123!
 *               fingerprint:
 *                 type: string
 *                 description: Browser fingerprint for session isolation
 *                 example: abc123def456
 *     responses:
 *       200:
 *         description: Login successful
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               description: HTTP-only cookie containing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login erfolgreich
 *                 token:
 *                   type: string
 *                   description: JWT token (also set as httpOnly cookie)
 *                 role:
 *                   type: string
 *                   enum: [root, admin, employee]
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     tenant_id:
 *                       type: integer
 *       400:
 *         description: Bad request - missing credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 */
router.post(
  '/login',
  ...security.auth(validationSchemas.login),
  async (req: Request, res: Response) => {
    await authController.login(req, res);
  },
);

/**

 * /auth/register:
 *   post:
 *     summary: Register new user
 *     description: Create a new user account with optional tenant assignment
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Unique username
 *                 example: johndoe
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address
 *                 example: john.doe@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Strong password
 *                 example: SecurePass123!
 *               first_name:
 *                 type: string
 *                 description: First name
 *                 example: John
 *               last_name:
 *                 type: string
 *                 description: Last name
 *                 example: Doe
 *               role:
 *                 type: string
 *                 enum: [admin, employee]
 *                 description: User role (cannot register as root)
 *                 example: employee
 *               tenant_id:
 *                 type: integer
 *                 description: Tenant ID for multi-tenant assignment
 *                 example: 1
 *     responses:
 *       201:
 *         description: Registration successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Registration successful
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 */
router.post(
  '/register',
  ...security.auth(validationSchemas.signup),
  async (req: Request, res: Response) => {
    await authController.register(req, res);
  },
);

/**

 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Logout the current user and clear authentication token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               description: Clears the httpOnly token cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Logout successful
 */
router.post(
  '/logout',
  ...security.user(),
  typed.auth(async (req, res) => {
    await authController.logout(req, res);
  }),
);

/**
 * @route GET /api/auth/me
 * @desc Get current authenticated user information
 * @access Private
 */
router.get(
  '/me',
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      // Fetch user data from database
      const user = await User.findById(req.user.id, req.user.tenant_id);

      if (!user) {
        res.status(404).json(errorResponse('User not found', 404));
        return;
      }

      // Fetch tenant information
      let tenantName = null;
      if (req.user.tenant_id) {
        try {
          const { query } = await import('../../utils/db');
          const [tenantRows] = await query('SELECT company_name FROM tenants WHERE id = ?', [
            req.user.tenant_id,
          ]);

          if (Array.isArray(tenantRows) && tenantRows.length > 0) {
            tenantName = (tenantRows[0] as { company_name: string }).company_name;
            // Remove TEST_DATA_PREFIX if present for test compatibility
            if (tenantName.startsWith('__AUTOTEST__')) {
              tenantName = tenantName.substring('__AUTOTEST__'.length);
            }
          }
        } catch (tenantError: unknown) {
          logger.error('Error fetching tenant info:', tenantError);
          // Continue without tenant name
        }
      }

      res.json(
        successResponse({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          tenant_id: user.tenant_id,
          tenantName: tenantName,
          first_name: user.first_name,
          last_name: user.last_name,
          department_id: user.department_id,
        }),
      );
    } catch (error: unknown) {
      logger.error('Error in /api/auth/me:', error);
      res.status(500).json(errorResponse('Failed to fetch user info', 500));
    }
  }),
);

/**
 * @route GET /api/auth/logout
 * @desc Logout user (client-side only) - Legacy endpoint
 * @access Public
 */
router.get(
  '/logout',
  ...security.public(),
  typed.public((_req, res) => {
    res.json(successResponse(null, 'Logout successful'));
  }),
);

export default router;

// CommonJS compatibility
