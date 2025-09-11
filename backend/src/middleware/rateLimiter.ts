/**
 * Type-safe Rate Limiter Implementation
 * Provides different rate limiting strategies for various endpoint types
 */
import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

import {
  RateLimitMiddleware,
  RateLimiterMiddleware,
  RateLimiterType,
} from '../types/security.types';

// Check if we're in test environment
const isTestEnv = process.env.NODE_ENV === 'test';

// Constants
const RATE_LIMIT_PATH = '/rate-limit';

// Custom handler that returns JSON for API requests and redirects for HTML requests
const createRateLimitHandler = (message: string) => {
  return (req: Request, res: Response): void => {
    // Check if this is an API request
    if (req.path.startsWith('/api/') || req.headers['content-type']?.includes('application/json')) {
      // Return JSON for API requests
      res.status(429).json({
        error: 'Rate limit exceeded',
        message,
        retryAfter: res.getHeader('Retry-After'),
      });
    } else {
      // Redirect to rate limit page for browser requests
      res.redirect(RATE_LIMIT_PATH);
    }
  };
};

// Rate limiter configurations
const rateLimiterConfigs = {
  // Public endpoints (login, signup, password reset)
  [RateLimiterType.PUBLIC]: {
    windowMs: 60 * 1000, // 1 minute for testing
    max: isTestEnv ? 100000 : 100, // 100 requests for public endpoints (ERHÖHT)
    handler: createRateLimitHandler('Too many requests from this IP, please try again later.'),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv, // Skip rate limiting in tests
  },

  // Authentication endpoints (login, signup)
  [RateLimiterType.AUTH]: {
    windowMs: 60 * 1000, // 1 minute for testing
    max: isTestEnv ? 100000 : 5, // 5 attempts in 1 minute
    handler: createRateLimitHandler('Too many authentication attempts, please try again later.'),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false, // Count ALL requests for security
    skip: () => isTestEnv, // Skip rate limiting in tests
  },

  // Authenticated user endpoints
  [RateLimiterType.AUTHENTICATED]: {
    windowMs: 60 * 1000, // 1 minute for testing
    max: isTestEnv ? 100000 : 5000, // 5000 requests in 1 minute for normal users (erhöht für Dashboard)
    handler: createRateLimitHandler('Rate limit exceeded, please slow down.'),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv, // Skip rate limiting in tests
    // Remove custom keyGenerator to use default IP handling (IPv4/IPv6 compatible)
  },

  // Admin endpoints
  [RateLimiterType.ADMIN]: {
    windowMs: 60 * 1000, // 1 minute for testing
    max: isTestEnv ? 100000 : 5000, // 5000 requests in 1 minute for admins (erhöht für Dashboard)
    handler: createRateLimitHandler('Admin rate limit exceeded.'),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv, // Skip rate limiting in tests
    // Remove custom keyGenerator to use default IP handling (IPv4/IPv6 compatible)
  },

  // API endpoints (for external integrations)
  [RateLimiterType.API]: {
    windowMs: 60 * 1000, // 1 minute
    max: isTestEnv ? 100000 : 5000, // 5000 requests per minute for API (erhöht für Dashboard)
    handler: createRateLimitHandler('API rate limit exceeded.'),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv, // Skip rate limiting in tests
    // Remove custom keyGenerator to use default IP handling (IPv4/IPv6 compatible)
  },

  // File upload endpoints
  [RateLimiterType.UPLOAD]: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: isTestEnv ? 100000 : 10, // 10 uploads per hour
    handler: createRateLimitHandler('Upload limit exceeded, please try again later.'),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv, // Skip rate limiting in tests
    // Remove custom keyGenerator to use default IP handling (IPv4/IPv6 compatible)
  },

  // File download endpoints
  [RateLimiterType.DOWNLOAD]: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isTestEnv ? 100000 : 50, // 50 downloads in 15 minutes
    handler: createRateLimitHandler('Download limit exceeded, please try again later.'),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv, // Skip rate limiting in tests
    // Remove custom keyGenerator to use default IP handling (IPv4/IPv6 compatible)
  },
};

// Create rate limiter instances
const rateLimiters = Object.entries(rateLimiterConfigs).reduce(
  (acc, [type, config]) => ({
    ...acc,
    [type]: rateLimit(config),
  }),
  {} as Record<RateLimiterType, RateLimitMiddleware>,
);

// TODO: Implement advanced rate limiting with redis store
// For now, we'll use express-rate-limit only

// Type-safe rate limiter middleware factory
export const rateLimiter: RateLimiterMiddleware = Object.assign(
  (type: RateLimiterType) => {
    // Safe: type is an enum value, not user input
    // eslint-disable-next-line security/detect-object-injection
    return rateLimiters[type];
  },
  {
    public: rateLimiters[RateLimiterType.PUBLIC],
    auth: rateLimiters[RateLimiterType.AUTH],
    authenticated: rateLimiters[RateLimiterType.AUTHENTICATED],
    admin: rateLimiters[RateLimiterType.ADMIN],
    api: rateLimiters[RateLimiterType.API],
    upload: rateLimiters[RateLimiterType.UPLOAD],
    download: rateLimiters[RateLimiterType.DOWNLOAD],
  },
);

// TODO: Implement brute force protection with redis store

// Export type-safe middleware stacks
export const securityStacks = {
  publicEndpoint: [rateLimiter.public],
  authEndpoint: [rateLimiter.auth],
  userEndpoint: [rateLimiter.authenticated],
  adminEndpoint: [rateLimiter.admin],
  apiEndpoint: [rateLimiter.api],
  uploadEndpoint: [rateLimiter.upload],
  downloadEndpoint: [rateLimiter.download],
};

export default rateLimiter;
