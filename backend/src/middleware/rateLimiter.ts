/**
 * Type-safe Rate Limiter Implementation
 * Provides different rate limiting strategies for various endpoint types
 */
import rateLimit from 'express-rate-limit';

import {
  RateLimitMiddleware,
  RateLimiterMiddleware,
  RateLimiterType,
} from '../types/security.types';

// Check if we're in test environment
const isTestEnv = process.env.NODE_ENV === 'test';

// Rate limiter configurations
const rateLimiterConfigs = {
  // Public endpoints (login, signup, password reset)
  [RateLimiterType.PUBLIC]: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isTestEnv ? 100000 : 10000, // Very high limit for tests
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv, // Skip rate limiting in tests
  },

  // Authentication endpoints (login, signup)
  [RateLimiterType.AUTH]: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isTestEnv ? 100000 : 5000, // Erhöht von 500 auf 5000 für Entwicklung
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
    skip: () => isTestEnv, // Skip rate limiting in tests
  },

  // Authenticated user endpoints
  [RateLimiterType.AUTHENTICATED]: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isTestEnv ? 100000 : 20000, // Very high limit for tests
    message: 'Rate limit exceeded, please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv, // Skip rate limiting in tests
    // Remove custom keyGenerator to use default IP handling (IPv4/IPv6 compatible)
  },

  // Admin endpoints
  [RateLimiterType.ADMIN]: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isTestEnv ? 100000 : 2000, // Very high limit for tests
    message: 'Admin rate limit exceeded.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv, // Skip rate limiting in tests
    // Remove custom keyGenerator to use default IP handling (IPv4/IPv6 compatible)
  },

  // API endpoints (for external integrations)
  [RateLimiterType.API]: {
    windowMs: 60 * 1000, // 1 minute
    max: isTestEnv ? 100000 : 60, // Very high limit for tests
    message: 'API rate limit exceeded.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv, // Skip rate limiting in tests
    // Remove custom keyGenerator to use default IP handling (IPv4/IPv6 compatible)
  },

  // File upload endpoints
  [RateLimiterType.UPLOAD]: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: isTestEnv ? 100000 : 20, // Very high limit for tests
    message: 'Upload limit exceeded, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv, // Skip rate limiting in tests
    // Remove custom keyGenerator to use default IP handling (IPv4/IPv6 compatible)
  },

  // File download endpoints
  [RateLimiterType.DOWNLOAD]: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isTestEnv ? 100000 : 100, // Very high limit for tests
    message: 'Download limit exceeded, please try again later.',
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
