/**
 * Custom Throttler Guard
 *
 * Extends NestJS ThrottlerGuard to provide intelligent rate limiting:
 * - Uses User ID from JWT token for authenticated requests
 * - Falls back to IP address for unauthenticated requests
 * - Handles proxy headers (X-Forwarded-For, X-Real-IP)
 *
 * Note: This guard extracts userId from JWT without full verification.
 * Full auth verification is done by JwtAuthGuard which runs after this guard.
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
   * Extract user ID from JWT token without full verification
   * This is safe because JwtAuthGuard will do full verification later
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

      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
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
