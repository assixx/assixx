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
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { AuthService } from './auth.service.js';
import { LoginDto, RefreshDto, RegisterDto } from './dto/index.js';
import type { LoginResponse, RefreshResponse } from './dto/index.js';

/**
 * Cookie configuration for SSR support
 * httpOnly: Prevents XSS attacks (JavaScript cannot read the cookie)
 * secure: Only sent over HTTPS (disabled in dev for localhost)
 * sameSite: CSRF protection
 * path: Cookie available for all routes
 */
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'lax' as const,
  path: '/',
  /** Access token expires in 30 minutes */
  maxAge: 30 * 60 * 1000,
};

const REFRESH_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  /** Refresh token expires in 7 days */
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

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
   *
   * Sets httpOnly cookies for SSR support:
   * - accessToken: For API authentication
   * - refreshToken: For token refresh
   *
   * Also returns tokens in body for backwards compatibility with SPA clients.
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<LoginResponse> {
    const { ipAddress, userAgent } = getClientInfo(req);
    const result = await this.authService.login(dto, ipAddress, userAgent);

    // Set httpOnly cookies for SSR support
    reply.setCookie('accessToken', result.accessToken, COOKIE_OPTIONS);
    reply.setCookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    return result;
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
   *
   * Clears httpOnly cookies for SSR support.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: NestAuthUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<LogoutResponse> {
    const result = await this.authService.logout(user);

    // Clear httpOnly cookies
    reply.clearCookie('accessToken', { path: '/' });
    reply.clearCookie('refreshToken', { path: '/' });

    return {
      message: 'Logged out successfully',
      tokensRevoked: result.tokensRevoked,
    };
  }

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   *
   * Supports both:
   * - Cookie-based refresh (SSR): reads refreshToken from cookie if body is empty
   * - Body-based refresh (SPA): uses refreshToken from request body
   *
   * Updates httpOnly cookies with new tokens for SSR support.
   */
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<RefreshResponse> {
    const { ipAddress, userAgent } = getClientInfo(req);

    // Support cookie-based refresh for SSR: use cookie if body is empty
    // Explicit empty string check for strict-boolean-expressions compliance
    const refreshToken =
      dto.refreshToken !== '' ? dto.refreshToken : (req.cookies['refreshToken'] ?? '');
    const effectiveDto: RefreshDto = { refreshToken };

    const result = await this.authService.refresh(effectiveDto, ipAddress, userAgent);

    // Update httpOnly cookies with new tokens
    reply.setCookie('accessToken', result.accessToken, COOKIE_OPTIONS);
    reply.setCookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    return result;
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
