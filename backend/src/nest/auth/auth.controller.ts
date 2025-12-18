/**
 * Auth Controller
 *
 * HTTP endpoints for authentication:
 * - POST /auth/login    - User login (public)
 * - POST /auth/register - Register new user (admin/root only)
 * - POST /auth/logout   - User logout (authenticated)
 * - POST /auth/refresh  - Refresh access token (public)
 * - GET  /auth/verify   - Verify current token (authenticated)
 * - GET  /auth/me       - Get current user (authenticated)
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { AuthService } from './auth.service.js';
import { LoginDto, RefreshDto, RegisterDto } from './dto/index.js';
import type { LoginResponse, RefreshResponse } from './dto/index.js';

/**
 * Response type for register endpoint
 */
interface RegisterResponse {
  id: number;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  tenantId: number;
  createdAt: Date;
}

/**
 * Response type for logout endpoint
 */
interface LogoutResponse {
  message: string;
  tokensRevoked: number;
}

/**
 * Response type for verify endpoint
 */
interface VerifyResponse {
  valid: boolean;
  user: Partial<NestAuthUser>;
}

/**
 * Response type for getCurrentUser endpoint
 */
interface CurrentUserResponse {
  id: number;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  tenantId: number;
  isActive: number;
  lastLogin: Date | null;
  createdAt: Date;
}

/**
 * Extract client info from request
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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/login
   * Authenticate user with email and password
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: FastifyRequest): Promise<LoginResponse> {
    const { ipAddress, userAgent } = getClientInfo(req);
    return await this.authService.login(dto, ipAddress, userAgent);
  }

  /**
   * POST /auth/register
   * Register a new user (admin/root only)
   */
  @Post('register')
  @Roles('admin', 'root')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @CurrentUser() user: NestAuthUser,
  ): Promise<RegisterResponse> {
    const newUser = await this.authService.register(dto, user);

    // Return safe user data (exclude password)
    return {
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      firstName: newUser.first_name,
      lastName: newUser.last_name,
      role: newUser.role,
      tenantId: newUser.tenant_id,
      createdAt: newUser.created_at,
    };
  }

  /**
   * POST /auth/logout
   * Logout user and revoke all refresh tokens
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: NestAuthUser): Promise<LogoutResponse> {
    const result = await this.authService.logout(user);
    return {
      message: 'Logged out successfully',
      tokensRevoked: result.tokensRevoked,
    };
  }

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto, @Req() req: FastifyRequest): Promise<RefreshResponse> {
    const { ipAddress, userAgent } = getClientInfo(req);
    return await this.authService.refresh(dto, ipAddress, userAgent);
  }

  /**
   * GET /auth/verify
   * Verify current access token is valid
   */
  @Get('verify')
  @HttpCode(HttpStatus.OK)
  verify(@CurrentUser() user: NestAuthUser): VerifyResponse {
    return this.authService.verifyToken(user);
  }

  /**
   * GET /auth/me
   * Get current authenticated user information
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getCurrentUser(@CurrentUser() user: NestAuthUser): Promise<CurrentUserResponse> {
    const foundUser = await this.authService.getCurrentUser(user);

    // Return safe user data (exclude password, reset_token, etc.)
    return {
      id: foundUser.id,
      email: foundUser.email,
      username: foundUser.username,
      firstName: foundUser.first_name,
      lastName: foundUser.last_name,
      role: foundUser.role,
      tenantId: foundUser.tenant_id,
      isActive: foundUser.is_active,
      lastLogin: foundUser.last_login,
      createdAt: foundUser.created_at,
    };
  }
}
