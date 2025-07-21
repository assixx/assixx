/**
 * Authentication Routes
 * Uses controller pattern for cleaner code
 */

import express, { Router } from "express";
import { body } from "express-validator";

import authController from "../controllers/auth.controller";
import { security } from "../middleware/security";
import {
  generateCSRFTokenMiddleware,
  attachCSRFToken,
  strictAuthLimiter,
} from "../middleware/security-enhanced";
import { createValidation } from "../middleware/validation";
import { validateSignup } from "../middleware/validators";
import { successResponse } from "../types/response.types";
import { typed } from "../utils/routeHandlers";

const router: Router = express.Router();

// Debug logging
console.log("[DEBUG] Auth routes loading...");

// Request body interfaces
interface LoginBody {
  username?: string;
  email?: string;
  password: string;
}

interface RegisterBody {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

interface ValidateFingerprintBody {
  fingerprint: string;
}

// Validation schemas
const loginValidation = createValidation([
  body("password").notEmpty().withMessage("Passwort ist erforderlich"),
  body("username").optional().trim(),
  body("email").optional().isEmail().normalizeEmail(),
]);

const validateFingerprintValidation = createValidation([
  body("fingerprint")
    .notEmpty()
    .trim()
    .withMessage("Fingerprint ist erforderlich"),
]);

// Public routes with enhanced rate limiting and validation
router.post(
  "/login",
  strictAuthLimiter,
  ...security.auth(loginValidation),
  typed.body<LoginBody>(async (req, res) => {
    console.log("[DEBUG] /api/auth/login endpoint hit");
    await authController.login(req, res);
  }),
);
router.post(
  "/register",
  strictAuthLimiter,
  ...validateSignup,
  typed.body<RegisterBody>(async (req, res) => {
    await authController.register(req, res);
  }),
);
router.get(
  "/logout",
  ...security.user(),
  typed.auth(async (req, res) => {
    await authController.logout(req, res);
  }),
);
router.post(
  "/logout",
  ...security.user(),
  typed.auth(async (req, res) => {
    await authController.logout(req, res);
  }),
); // Support both GET and POST

// CSRF Token endpoint
router.get(
  "/csrf-token",
  generateCSRFTokenMiddleware,
  attachCSRFToken,
  typed.public((_req, res) => {
    res.json(
      successResponse(
        {
          csrfToken: res.locals.csrfToken,
        },
        "CSRF token generated successfully",
      ),
    );
  }),
);

// Protected routes
router.get(
  "/check",
  ...security.user(),
  typed.auth(async (req, res) => {
    await authController.checkAuth(req, res);
  }),
);
router.get(
  "/user",
  ...security.user(),
  typed.auth(async (req, res) => {
    await authController.getUserProfile(req, res);
  }),
);

// Session validation endpoints
router.get(
  "/validate",
  ...security.user(),
  typed.auth(async (req, res) => {
    await authController.validateToken(req, res);
  }),
);
router.post(
  "/validate-fingerprint",
  ...security.user(validateFingerprintValidation),
  typed.body<ValidateFingerprintBody>(async (req, res) => {
    await authController.validateFingerprint(req, res);
  }),
);

export default router;

// CommonJS compatibility
