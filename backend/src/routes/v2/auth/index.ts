/**
 * Auth API v2 Routes
 * @swagger
 * tags:
 *   name: Auth v2
 *   description: Authentication API v2 with improved standards
 */
import express, { Router } from 'express';

import { rateLimiter } from '../../../middleware/rateLimiter';
import { authenticateV2 } from '../../../middleware/v2/auth.middleware';
import { typed } from '../../../utils/routeHandlers';
import { authController } from './auth.controller';
import { authValidation } from './auth.validation';

const router: Router = express.Router();

/**
 * @swagger
 * /api/v2/auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user with email and password
 *     tags: [Auth v2]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         email:
 *                           type: string
 *                         firstName:
 *                           type: string
 *                         lastName:
 *                           type: string
 *                         role:
 *                           type: string
 */
router.post('/login', rateLimiter.auth, authValidation.login, typed.body(authController.login));

/**
 * @swagger
 * /api/v2/auth/register:
 *   post:
 *     summary: Register new user
 *     description: Create a new user account (tenant admins only)
 *     tags: [Auth v2]
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
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [employee, admin]
 *                 default: employee
 */
router.post(
  '/register',
  authenticateV2,
  authValidation.register,
  typed.body(authController.register),
);

/**
 * @swagger
 * /api/v2/auth/logout:
 *   post:
 *     summary: User logout
 *     description: Invalidate user session and tokens
 *     tags: [Auth v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', authenticateV2, typed.auth(authController.logout));

/**
 * @swagger
 * /api/v2/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Get new access token using refresh token
 *     tags: [Auth v2]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 */
router.post(
  '/refresh',
  rateLimiter.auth,
  authValidation.refresh,
  typed.body(authController.refresh),
);

/**
 * @swagger
 * /api/v2/auth/verify:
 *   get:
 *     summary: Verify current token
 *     description: Check if current access token is valid
 *     tags: [Auth v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 */
router.get('/verify', authenticateV2, typed.auth(authController.verify));

/**
 * @swagger
 * /api/v2/auth/me:
 *   get:
 *     summary: Get current user
 *     description: Get current authenticated user information
 *     tags: [Auth v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved
 */
router.get('/me', authenticateV2, typed.auth(authController.getCurrentUser));

export default router;
