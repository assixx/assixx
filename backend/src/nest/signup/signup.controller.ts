/**
 * Signup Controller
 *
 * HTTP endpoints for tenant self-service registration:
 * - POST /signup          - Register new tenant (public)
 * - GET  /signup/check-subdomain/:subdomain - Check subdomain availability (public)
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { Public } from '../common/decorators/public.decorator.js';
import { AuthThrottle } from '../common/decorators/throttle.decorators.js';
import { CustomThrottlerGuard } from '../common/guards/throttler.guard.js';
import { CheckSubdomainParamDto, SignupDto } from './dto/index.js';
import type { SignupResponseData, SubdomainCheckResponseData } from './dto/index.js';
import { SignupService } from './signup.service.js';

/**
 * Extract client info from request for audit logging
 */
function getClientInfo(req: FastifyRequest): {
  ipAddress: string;
  userAgent: string | undefined;
} {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

@Controller('signup')
export class SignupController {
  constructor(private readonly signupService: SignupService) {}

  /**
   * POST /signup
   * Register a new tenant with admin user
   *
   * Creates:
   * - New tenant record
   * - Admin user account
   * - Trial subscription (14 days)
   * - Activates trial features
   */
  @Post()
  @Public()
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle()
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: SignupDto, @Req() req: FastifyRequest): Promise<SignupResponseData> {
    const { ipAddress, userAgent } = getClientInfo(req);
    return await this.signupService.registerTenant(dto, ipAddress, userAgent);
  }

  /**
   * GET /signup/check-subdomain/:subdomain
   * Check if a subdomain is available for registration
   *
   * Returns:
   * - available: boolean
   * - subdomain: string
   * - error?: string (if subdomain format is invalid)
   */
  @Get('check-subdomain/:subdomain')
  @Public()
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  async checkSubdomain(
    @Param() params: CheckSubdomainParamDto,
  ): Promise<SubdomainCheckResponseData> {
    return await this.signupService.checkSubdomainAvailability(params.subdomain);
  }
}
