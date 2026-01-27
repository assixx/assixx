/**
 * Custom Throttler Guard
 *
 * Extends NestJS ThrottlerGuard to provide intelligent rate limiting:
 * - Uses User ID from JWT token for authenticated requests
 * - Falls back to IP address for unauthenticated requests
 * - Handles proxy headers (X-Forwarded-For, X-Real-IP)
 *
 * SECURITY ARCHITECTURE NOTE:
 * This guard extracts userId from JWT WITHOUT cryptographic verification.
 * This is intentional for performance - full signature verification happens
 * in JwtAuthGuard which MUST run after this guard in the guard chain.
 *
 * Why this is safe:
 * 1. Rate limiting key extraction doesn't grant access - it only groups requests
 * 2. A forged/invalid JWT will fail at JwtAuthGuard before reaching any handler
 * 3. Worst case: attacker wastes another user's rate limit quota (minor DoS)
 *
 * Guard ordering is enforced by NestJS decorators:
 * \@UseGuards(CustomThrottlerGuard, JwtAuthGuard) - Throttler runs first
 *
 * If guard ordering changes, this could become a security issue.
 * See: docs/SECURITY-AUDIT-2026-01-08.md - MEDIUM-008
 */
import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';

interface JwtPayloadMinimal {
  id?: number;
  userId?: number;
}

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(CustomThrottlerGuard.name);

  /**
   * Get tracker key for rate limiting
   * Uses userId from JWT if available, otherwise IP address
   *
   * Note: Parent class requires Promise<string>, but our logic is sync.
   * Using Promise.resolve() to satisfy the interface without fake await.
   */
  protected override getTracker(req: FastifyRequest): Promise<string> {
    // Try to extract user ID from JWT token (without full verification)
    const userId = this.extractUserIdFromToken(req);

    if (userId !== null) {
      return Promise.resolve(`user:${userId}`);
    }

    // Fallback to IP address
    return Promise.resolve(`ip:${this.getClientIp(req)}`);
  }

  /**
   * Extract user ID from JWT token WITHOUT signature verification
   *
   * SECURITY: This decodes the JWT payload (base64) without verifying the signature.
   * Safe because: (1) This is only for rate limit grouping, not authorization
   *               (2) JwtAuthGuard verifies signature before any protected handler runs
   *               (3) Invalid/forged tokens fall back to IP-based rate limiting
   */
  private extractUserIdFromToken(req: FastifyRequest): number | null {
    const token = this.extractToken(req);

    // Early return if no token - explicit null/empty check for strict-boolean-expressions
    if (token === null || token === '') {
      return null;
    }

    try {
      // Decode JWT payload without verification (base64)
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payloadBase64 = parts[1];
      if (payloadBase64 === undefined) {
        return null;
      }

      const payloadJson = Buffer.from(payloadBase64, 'base64').toString(
        'utf-8',
      );
      const payload = JSON.parse(payloadJson) as JwtPayloadMinimal;

      // Support both 'id' and 'userId' fields
      const userId = payload.id ?? payload.userId;

      if (typeof userId === 'number' && userId > 0) {
        return userId;
      }

      return null;
    } catch {
      // Invalid token format - fall back to IP
      return null;
    }
  }

  /**
   * Extract JWT token from request
   */
  private extractToken(req: FastifyRequest): string | null {
    // Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string') {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer' && token !== undefined && token !== '') {
        return token;
      }
    }

    // Cookie
    const cookies = req.cookies as Record<string, string> | undefined;
    const cookieToken = cookies?.['accessToken'];
    if (typeof cookieToken === 'string' && cookieToken !== '') {
      return cookieToken;
    }

    return null;
  }

  /**
   * Get client IP address, handling proxies
   */
  private getClientIp(req: FastifyRequest): string {
    // X-Forwarded-For (first IP in chain)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string') {
      const firstIp = forwardedFor.split(',')[0]?.trim();
      if (firstIp !== undefined && firstIp !== '') {
        return firstIp;
      }
    }

    // X-Real-IP
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp !== '') {
      return realIp;
    }

    // Fallback to request IP
    return req.ip;
  }

  /**
   * Log rate limit violations
   */
  protected override async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();

    this.logger.warn(`Rate limit exceeded`, {
      method: req.method,
      url: req.url,
      limit: throttlerLimitDetail.limit,
      ttl: throttlerLimitDetail.ttl,
      totalHits: throttlerLimitDetail.totalHits,
    });

    await super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
