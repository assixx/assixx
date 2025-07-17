/**
 * Type-safe Rate Limiter Implementation
 * Provides different rate limiting strategies for various endpoint types
 */

import rateLimit from "express-rate-limit";
import { Request } from "express";
import {
  RateLimiterMiddleware,
  RateLimiterType,
  RateLimitMiddleware,
} from "../types/security.types";
import { isAuthenticated } from "../types/middleware.types";

// Rate limiter configurations
const rateLimiterConfigs = {
  // Public endpoints (login, signup, password reset)
  [RateLimiterType.PUBLIC]: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // Increased to 10000 for development testing
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Authentication endpoints (login, signup)
  [RateLimiterType.AUTH]: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Increased to 500 for development testing
    message: "Too many authentication attempts, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
  },

  // Authenticated user endpoints
  [RateLimiterType.AUTHENTICATED]: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20000, // 20000 requests per user for development testing
    message: "Rate limit exceeded, please slow down.",
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Use user ID if authenticated, otherwise IP
      if (isAuthenticated(req)) {
        return `user_${req.user.id}`;
      }
      return req.ip ?? "unknown";
    },
  },

  // Admin endpoints
  [RateLimiterType.ADMIN]: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000, // Higher limit for admins
    message: "Admin rate limit exceeded.",
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      if (isAuthenticated(req)) {
        return `admin_${req.user.id}`;
      }
      return req.ip ?? "unknown";
    },
  },

  // API endpoints (for external integrations)
  [RateLimiterType.API]: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: "API rate limit exceeded.",
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Use API key if present, otherwise user ID or IP
      const apiKey = req.headers["x-api-key"];
      if (apiKey) {
        return `api_${apiKey}`;
      }
      if (isAuthenticated(req)) {
        return `user_${req.user.id}`;
      }
      return req.ip ?? "unknown";
    },
  },

  // File upload endpoints
  [RateLimiterType.UPLOAD]: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 uploads per hour
    message: "Upload limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      if (isAuthenticated(req)) {
        return `upload_${req.user.id}`;
      }
      return req.ip ?? "unknown";
    },
  },

  // File download endpoints
  [RateLimiterType.DOWNLOAD]: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 downloads per 15 minutes
    message: "Download limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      if (isAuthenticated(req)) {
        return `download_${req.user.id}`;
      }
      return req.ip ?? "unknown";
    },
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
  (type: RateLimiterType) => rateLimiters[type],
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
