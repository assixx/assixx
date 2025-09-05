/**
 * Signup Routes v2
 * Handles user registration and subdomain validation
 */
import { Request, Response, Router } from 'express';

import { apiLimiter, authLimiter } from '../../../middleware/security-enhanced.js';
import { validate } from '../../../middleware/validation.js';
import { signupController } from './controller.js';
import { checkSubdomainValidation, signupValidation } from './validation.js';

const router = Router();

/**

 * /api/v2/signup:
 *   post:
 *     summary: Register a new tenant
 *     description: Register a new company with an admin user account
 *     tags: [Signup v2]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyName
 *               - subdomain
 *               - email
 *               - phone
 *               - adminEmail
 *               - adminPassword
 *               - adminFirstName
 *               - adminLastName
 *             properties:
 *               companyName:
 *                 type: string
 *                 description: Company name
 *                 example: Acme Corporation
 *               subdomain:
 *                 type: string
 *                 description: Unique subdomain for the tenant
 *                 pattern: ^[a-z0-9-]+$
 *                 example: acme-corp
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Company contact email
 *                 example: contact@acme.com
 *               phone:
 *                 type: string
 *                 description: Phone number with country code
 *                 pattern: ^\+[0-9]{7,29}$
 *                 example: +491234567890
 *               address:
 *                 type: string
 *                 description: Company address
 *                 maxLength: 500
 *               adminEmail:
 *                 type: string
 *                 format: email
 *                 description: Admin user email
 *                 example: admin@acme.com
 *               adminPassword:
 *                 type: string
 *                 format: password
 *                 description: Admin user password
 *                 minLength: 8
 *               adminFirstName:
 *                 type: string
 *                 description: Admin user first name
 *                 maxLength: 100
 *               adminLastName:
 *                 type: string
 *                 description: Admin user last name
 *                 maxLength: 100
 *               selectedPlan:
 *                 type: string
 *                 enum: [basic, professional, enterprise]
 *                 description: Selected subscription plan
 *                 default: basic
 *     responses:
 *       201:
 *         description: Registration successful
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
 *                     tenantId:
 *                       type: integer
 *                       example: 123
 *                     userId:
 *                       type: integer
 *                       example: 456
 *                     subdomain:
 *                       type: string
 *                       example: acme-corp
 *                     trialEndsAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-08-17T00:00:00.000Z
 *                     message:
 *                       type: string
 *                       example: Registration successful! You can now log in.
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponseV2'
 *       409:
 *         description: Conflict - subdomain already taken
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponseV2'
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
router.post(
  '/',
  authLimiter, // Rate limiting for registration
  validate(signupValidation),
  async (req: Request, res: Response) => {
    console.info('[SIGNUP ROUTE] Request received');
    console.info('[SIGNUP ROUTE] Body:', req.body);
    console.info('[SIGNUP ROUTE] About to call controller');
    try {
      console.info('[SIGNUP ROUTE] Inside try block');
      await signupController.signup(req, res);
      console.info('[SIGNUP ROUTE] Controller call completed');
    } catch (error: unknown) {
      console.error('[SIGNUP ROUTE] Error caught in route handler:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'ROUTE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
    }
  },
);

/**

 * /api/v2/signup/check-subdomain/{subdomain}:
 *   get:
 *     summary: Check subdomain availability
 *     description: Check if a subdomain is available for registration
 *     tags: [Signup v2]
 *     parameters:
 *       - in: path
 *         name: subdomain
 *         required: true
 *         schema:
 *           type: string
 *           pattern: ^[a-z0-9-]+$
 *         description: Subdomain to check
 *         example: acme-corp
 *     responses:
 *       200:
 *         description: Subdomain availability check result
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
 *                     available:
 *                       type: boolean
 *                       description: Whether the subdomain is available
 *                       example: true
 *                     subdomain:
 *                       type: string
 *                       description: The subdomain that was checked
 *                       example: acme-corp
 *                     error:
 *                       type: string
 *                       description: Error message if subdomain is invalid
 *       400:
 *         description: Bad request - invalid subdomain format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponseV2'
 *       500:
 *         $ref: '#/components/responses/InternalServerErrorV2'
 */
router.get(
  '/check-subdomain/:subdomain',
  apiLimiter, // Rate limiting for API calls
  validate(checkSubdomainValidation),
  async (req: Request, res: Response) => {
    await signupController.checkSubdomain(req, res);
  },
);

export default router;
