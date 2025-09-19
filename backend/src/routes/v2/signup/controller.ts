/**
 * Signup Controller v2
 * HTTP request handlers for signup API
 */
import { Request, Response } from 'express';
import { validationResult } from 'express-validator';

import rootLog from '../../../models/rootLog';
import { ServiceError } from '../../../utils/ServiceError.js';
import { logger } from '../../../utils/logger.js';
import { signupService } from './service.js';
import type { SignupRequest } from './types.js';

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
   * Helper: Log signup request details
   */
  private logSignupRequest(req: Request): void {
    console.info('[SignupController] METHOD START');
    logger.info('[SignupController] Received signup request:', {
      body: req.body as unknown,
      headers: {
        contentType: req.get('Content-Type'),
        origin: req.get('Origin'),
      },
    });
    console.info('[SignupController] Logger called, checking if logger works');
  }

  /**
   * Helper: Handle validation errors
   */
  private handleValidationErrors(
    errors: ReturnType<typeof validationResult>,
    res: Response,
  ): boolean {
    if (!errors.isEmpty()) {
      const validationErrors = errors.array();
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: validationErrors.map((error) => {
            // Access properties safely using in operator
            let field = 'general';
            let message = 'Validation error';

            if ('type' in error && error.type === 'field' && 'path' in error) {
              // error.path is already a string when type is 'field'
              field = error.path;
            }

            if ('msg' in error) {
              // error.msg is already a string
              message = error.msg;
            }

            return { field, message };
          }),
        },
      });
      return true;
    }
    return false;
  }

  /**
   * Helper: Create tenant registration log
   */
  private async createRegistrationLog(
    result: SignupResult,
    signupData: SignupRequest,
    req: Request,
  ): Promise<void> {
    await rootLog.create({
      tenant_id: result.tenantId,
      user_id: result.userId,
      action: 'register',
      entity_type: 'tenant',
      entity_id: result.tenantId,
      details: `Registriert: ${signupData.companyName}`,
      new_values: {
        company_name: signupData.companyName,
        subdomain: signupData.subdomain,
        admin_email: signupData.adminEmail,
        admin_first_name: signupData.adminFirstName,
        admin_last_name: signupData.adminLastName,
        phone: signupData.phone,
        address: signupData.address,
        plan: signupData.plan ?? 'trial',
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get('user-agent'),
      was_role_switched: false,
    });
  }

  /**
   * Helper: Send success response
   */
  private sendSuccessResponse(res: Response, result: unknown): void {
    const data = typeof result === 'object' && result !== null ? result : {};
    res.status(201).json({
      success: true,
      data: {
        ...data,
        message: 'Registration successful! You can now log in.',
      },
    });
  }

  /**
   * Helper: Log error details
   */
  private logError(error: unknown): void {
    console.info('[SignupController] CATCH BLOCK ENTERED');
    console.info('[SignupController] Error type:', error?.constructor?.name);
    console.info(
      '[SignupController] Error message:',
      error instanceof Error ? error.message : error,
    );
    logger.error('[SignupController] Error during signup:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      isServiceError: error instanceof ServiceError,
    });
  }

  /**
   * Helper: Get error status code
   */
  private getErrorStatusCode(error: ServiceError): number {
    switch (error.code) {
      case 'SUBDOMAIN_TAKEN':
        return 409;
      case 'INVALID_SUBDOMAIN':
        return 400;
      default:
        return 500;
    }
  }

  /**
   * Helper: Send error response
   */
  private sendErrorResponse(res: Response, error: unknown): void {
    if (error instanceof ServiceError) {
      const statusCode = this.getErrorStatusCode(error);
      res.status(statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    } else {
      logger.error('Signup error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Registration failed',
        },
      });
    }
  }

  /**
   * Register a new tenant
   * @param req - The request object
   * @param res - The response object
   */
  async signup(req: Request, res: Response): Promise<void> {
    this.logSignupRequest(req);

    const errors = validationResult(req);
    if (this.handleValidationErrors(errors, res)) {
      return;
    }

    try {
      console.info('[SignupController] Entering try block');
      const signupData = req.body as SignupRequest;
      console.info('[SignupController] SignupData prepared:', signupData);

      logger.info('[SignupController] Calling signupService.registerTenant');
      console.info('[SignupController] About to call service');
      const result = await signupService.registerTenant(signupData);
      console.info('[SignupController] Service returned:', result);
      logger.info('[SignupController] Registration successful:', result);

      await this.createRegistrationLog(result as SignupResult, signupData, req);
      this.sendSuccessResponse(res, result);
    } catch (error: unknown) {
      this.logError(error);
      this.sendErrorResponse(res, error);
    }
  }

  /**
   * Check subdomain availability
   * @param req - The request object
   * @param res - The response object
   */
  async checkSubdomain(req: Request, res: Response): Promise<void> {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: errors.array().map((error) => ({
            field: error.type === 'field' ? error.path : 'general',
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
        logger.error('Subdomain check error:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: 'Failed to check subdomain availability',
          },
        });
      }
    }
  }
}

export const signupController = new SignupController();
