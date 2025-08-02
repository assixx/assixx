/**
 * Signup Controller v2
 * HTTP request handlers for signup API
 */

import { Request, Response } from "express";
import { validationResult } from "express-validator";

import { logger } from "../../../utils/logger.js";

import { signupService } from "./service.js";
import { ServiceError } from "../../../utils/ServiceError.js";
import { SignupRequest } from "./types.js";

export class SignupController {
  /**
   * Register a new tenant
   */
  async signup(req: Request, res: Response): Promise<void> {
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
      const signupData = req.body as SignupRequest;
      const result = await signupService.registerTenant(signupData);

      res.status(201).json({
        success: true,
        data: {
          ...result,
          message: "Registration successful! You can now log in.",
        },
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        const statusCode = 
          error.code === "SUBDOMAIN_TAKEN" ? 409 :
          error.code === "INVALID_SUBDOMAIN" ? 400 : 
          500;
          
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
    } catch (error) {
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