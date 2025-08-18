/**
 * Signup Controller v2
 * HTTP request handlers for signup API
 */

import { validationResult } from "express-validator";
import { Request, Response } from "express";
import { signupService } from "./service.js";
import type { SignupRequest } from "./types.js";
import RootLog from "../../../models/rootLog";
import { logger } from "../../../utils/logger.js";
import { ServiceError } from "../../../utils/ServiceError.js";

interface SignupResult {
  tenantId: number;
  userId: number;
  [key: string]: unknown;
}

/**
 *
 */
export class SignupController {
  /**
   * Register a new tenant
   * @param req
   * @param res
   */
  async signup(req: Request, res: Response): Promise<void> {
    console.info("[SignupController] METHOD START");
    logger.info("[SignupController] Received signup request:", {
      body: req.body,
      headers: {
        contentType: req.get("Content-Type"),
        origin: req.get("Origin"),
      },
    });
    console.info("[SignupController] Logger called, checking if logger works");

    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: errors.array().map((error) => ({
            field: error.type === "field" ? error.path : "general",
            message: error.msg,
          })),
        },
      });
      return;
    }

    try {
      console.info("[SignupController] Entering try block");
      const signupData = req.body as SignupRequest;
      console.info("[SignupController] SignupData prepared:", signupData);
      logger.info("[SignupController] Calling signupService.registerTenant");
      console.info("[SignupController] About to call service");
      const result = await signupService.registerTenant(signupData);
      console.info("[SignupController] Service returned:", result);
      logger.info("[SignupController] Registration successful:", result);

      // Log tenant registration
      await RootLog.create({
        tenant_id: (result as SignupResult).tenantId,
        user_id: (result as SignupResult).userId,
        action: "register",
        entity_type: "tenant",
        entity_id: (result as SignupResult).tenantId,
        details: `Registriert: ${signupData.companyName}`,
        new_values: {
          company_name: signupData.companyName,
          subdomain: signupData.subdomain,
          admin_email: signupData.adminEmail,
          admin_first_name: signupData.adminFirstName,
          admin_last_name: signupData.adminLastName,
          phone: signupData.phone,
          address: signupData.address,
          plan: signupData.plan ?? "trial",
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get("user-agent"),
        was_role_switched: false,
      });

      res.status(201).json({
        success: true,
        data: {
          ...result,
          message: "Registration successful! You can now log in.",
        },
      });
    } catch (error: unknown) {
      console.info("[SignupController] CATCH BLOCK ENTERED");
      console.info("[SignupController] Error type:", error?.constructor?.name);
      console.info(
        "[SignupController] Error message:",
        error instanceof Error ? error.message : error,
      );
      logger.error("[SignupController] Error during signup:", {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        isServiceError: error instanceof ServiceError,
      });

      if (error instanceof ServiceError) {
        const statusCode =
          error.code === "SUBDOMAIN_TAKEN"
            ? 409
            : error.code === "INVALID_SUBDOMAIN"
              ? 400
              : 500;

        res.status(statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      } else {
        logger.error("Signup error:", error);
        res.status(500).json({
          success: false,
          error: {
            code: "SERVER_ERROR",
            message: "Registration failed",
          },
        });
      }
    }
  }

  /**
   * Check subdomain availability
   * @param req
   * @param res
   */
  async checkSubdomain(req: Request, res: Response): Promise<void> {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: errors.array().map((error) => ({
            field: error.type === "field" ? error.path : "general",
            message: error.msg,
          })),
        },
      });
      return;
    }

    try {
      const { subdomain } = req.params;
      const result = await signupService.checkSubdomainAvailability(subdomain);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        res.status(500).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      } else {
        logger.error("Subdomain check error:", error);
        res.status(500).json({
          success: false,
          error: {
            code: "SERVER_ERROR",
            message: "Failed to check subdomain availability",
          },
        });
      }
    }
  }
}

export const signupController = new SignupController();
