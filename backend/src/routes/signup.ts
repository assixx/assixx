/**
 * Signup/Registration Routes
 * API endpoints for tenant registration and subdomain validation
 */

import express, { Router } from "express";
import { body, param } from "express-validator";

import { security } from "../middleware/security";
import { authLimiter, apiLimiter } from "../middleware/security-enhanced";
import { createValidation } from "../middleware/validation";
import Tenant from "../models/tenant";
import { successResponse, errorResponse } from "../types/response.types";
import { logger } from "../utils/logger";
import { typed } from "../utils/routeHandlers";

// Import models (keeping require pattern for compatibility)

const router: Router = express.Router();

// Request body interfaces
interface SignupBody {
  company_name: string;
  subdomain: string;
  email: string;
  phone?: string;
  admin_email: string;
  admin_password: string;
  admin_first_name: string;
  admin_last_name: string;
  selectedPlan?: string;
}

// Response interfaces
interface SignupResult {
  success: boolean;
  subdomain: string;
  trialEndsAt?: Date;
  message: string;
}

interface SubdomainValidation {
  valid: boolean;
  error?: string;
}

interface SubdomainAvailabilityResponse {
  available: boolean;
  error?: string;
}

// Validation schemas
const signupValidation = createValidation([
  body("company_name")
    .notEmpty()
    .trim()
    .withMessage("Firmenname ist erforderlich"),
  body("subdomain")
    .notEmpty()
    .matches(/^[a-z0-9-]+$/)
    .withMessage(
      "Subdomain darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten",
    ),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Ungültige E-Mail-Adresse"),
  body("admin_email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Ungültige Admin E-Mail-Adresse"),
  body("admin_password")
    .isLength({ min: 8 })
    .withMessage("Passwort muss mindestens 8 Zeichen lang sein"),
  body("admin_first_name").optional().trim(),
  body("admin_last_name").optional().trim(),
  body("phone")
    .notEmpty()
    .trim()
    .matches(/^\+[0-9]{7,29}$/)
    .withMessage(
      "Telefonnummer muss mit + beginnen und 7-29 Ziffern enthalten (z.B. +491234567890)",
    ),
]);

const checkSubdomainValidation = createValidation([
  param("subdomain")
    .notEmpty()
    .matches(/^[a-z0-9-]+$/)
    .withMessage("Ungültige Subdomain"),
]);

// Öffentliche Signup-Route
router.post(
  "/signup",
  authLimiter,
  ...security.auth(signupValidation),
  typed.body<SignupBody>(async (req, res) => {
    console.log("[SIGNUP DEBUG] Request received!");
    try {
      logger.info(
        "[DEBUG] Signup request received at " + new Date().toISOString(),
        { body: req.body },
      );

      // Debug DB connection (removed in production)
      if (process.env.NODE_ENV === "development") {
        const pool = (await import("../database")).default;
        logger.info("[DEBUG] Pool type:", typeof pool);
      }

      const {
        company_name,
        subdomain,
        email,
        phone,
        admin_email,
        admin_password,
        admin_first_name,
        admin_last_name,
        // selectedPlan,
      } = req.body;

      // Validation is now handled by middleware

      // Subdomain validieren
      const subdomainValidation: SubdomainValidation =
        Tenant.validateSubdomain(subdomain);
      if (!subdomainValidation.valid) {
        res
          .status(400)
          .json(
            errorResponse(
              subdomainValidation.error ?? "Ungültige Subdomain",
              400,
            ),
          );
        return;
      }

      // Prüfe ob Subdomain verfügbar
      const isAvailable: boolean = await Tenant.isSubdomainAvailable(subdomain);
      if (!isAvailable) {
        res
          .status(400)
          .json(errorResponse("Diese Subdomain ist bereits vergeben", 400));
        return;
      }

      // Erstelle Tenant und Admin-User
      const result = await Tenant.create({
        company_name,
        subdomain,
        email,
        phone,
        admin_email,
        admin_password,
        admin_first_name,
        admin_last_name,
      });

      logger.info(`Neuer Tenant registriert: ${company_name} (${subdomain})`);

      // Später: Willkommens-E-Mail senden
      // await sendWelcomeEmail(admin_email, subdomain);

      const response: SignupResult = {
        success: true,
        subdomain,
        trialEndsAt: result.trialEndsAt,
        message: "Registrierung erfolgreich! Sie können sich jetzt anmelden.",
      };

      res.json(successResponse(response, "Registrierung erfolgreich"));
    } catch (error) {
      logger.error("Signup-Fehler:", error);
      res.status(500).json(errorResponse("Fehler bei der Registrierung", 500));
    }
  }),
);

// Subdomain-Verfügbarkeit prüfen
router.get(
  "/check-subdomain/:subdomain",
  apiLimiter,
  ...security.public(checkSubdomainValidation),
  typed.params<{ subdomain: string }>(async (req, res) => {
    try {
      const { subdomain } = req.params;

      const validation: SubdomainValidation =
        Tenant.validateSubdomain(subdomain);
      if (!validation.valid) {
        const response: SubdomainAvailabilityResponse = {
          available: false,
          error: validation.error,
        };
        res.json(response);
        return;
      }

      const available: boolean = await Tenant.isSubdomainAvailable(subdomain);
      const response: SubdomainAvailabilityResponse = { available };
      res.json(successResponse(response));
    } catch (error) {
      logger.error("Subdomain-Check-Fehler:", error);
      res.status(500).json(errorResponse("Fehler bei der Überprüfung", 500));
    }
  }),
);

export default router;

// CommonJS compatibility
