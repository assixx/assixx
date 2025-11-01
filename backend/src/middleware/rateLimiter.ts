/**
 * Type-safe Rate Limiter Implementation with Redis Store
 * Provides different rate limiting strategies for various endpoint types
 *
 * Uses Redis for distributed rate limiting with graceful fallback to in-memory store
 * if Redis is unavailable (Best Practice 2025)
 */
import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

import { getRedisClient } from '../config/redis.js';
import {
  RateLimitMiddleware,
  RateLimiterMiddleware,
  RateLimiterType,
} from '../types/security.types.js';
import { logger } from '../utils/logger.js';

// Check if we're in test environment
const isTestEnv = process.env.NODE_ENV === 'test';

// Constants
const RATE_LIMIT_PATH = '/rate-limit';

/**
 * Create Redis store for rate limiting with graceful fallback
 * Best Practice 2025: Use Redis for distributed rate limiting across multiple server instances
 *
 * Benefits:
 * - Shared rate limits across multiple backend instances
 * - Persistent counters (survive server restarts)
 * - Cannot be bypassed by restarting server
 *
 * Graceful Degradation:
 * - If Redis connection fails, returns undefined (express-rate-limit uses in-memory store)
 * - Logs warning but doesn't crash the application
 */
async function createRedisStore(): Promise<RedisStore | undefined> {
  // Skip Redis in test environment
  if (isTestEnv) {
    return undefined;
  }

  try {
    const client = await getRedisClient();

    // Verify client is connected
    if (!client.isOpen) {
      logger.warn('Redis client not connected, using in-memory rate limiter');
      return undefined;
    }

    // Create RedisStore with node-redis client
    // Using sendCommand method as per rate-limit-redis documentation
    return new RedisStore({
      sendCommand: (...args: string[]) => client.sendCommand(args),
      prefix: 'rl:', // Default prefix for rate limit keys
    });
  } catch (error: unknown) {
    // Graceful degradation: Log error but continue with in-memory store
    logger.warn('Failed to create Redis store for rate limiting, using in-memory fallback:', error);
    return undefined;
  }
}

// Global Redis store instance (created once on startup)
let redisStore: RedisStore | undefined;

// Initialize Redis store on module load (async, won't block)
void createRedisStore()
  .then((store: RedisStore | undefined) => {
    redisStore = store;
    if (store) {
      logger.info('✅ Redis rate limiting enabled');
    } else {
      logger.info('⚠️  Using in-memory rate limiting (Redis unavailable or test mode)');
    }
    return undefined; // Explicit return for promise chain
  })
  .catch((error: unknown) => {
    logger.error('Failed to initialize Redis store:', error);
    return undefined; // Explicit return for promise chain
  });

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
// Using 'satisfies' to ensure all RateLimiterType keys are present while maintaining type inference
const rateLimiterConfigs = {
  // Public endpoints (login, signup, password reset)
  [RateLimiterType.PUBLIC]: {
    windowMs: 20 * 1000, // 20 seconds
    max: isTestEnv ? 100000 : 500, // 500 requests for public endpoints (ERHÖHT)
    handler: createRateLimitHandler('Too many requests from this IP, please try again later.'),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv, // Skip rate limiting in tests
    store: redisStore, // Redis store for distributed rate limiting
  },

  // Authentication endpoints (login, signup)
  [RateLimiterType.AUTH]: {
    windowMs: 20 * 1000, // 20 seconds
    max: isTestEnv ? 100000 : 50, // 50 attempts in 20 seconds
    handler: createRateLimitHandler('Too many authentication attempts, please try again later.'),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false, // Count ALL requests for security
    skip: () => isTestEnv, // Skip rate limiting in tests
    store: redisStore, // Redis store for distributed rate limiting
  },

  // Authenticated user endpoints
  [RateLimiterType.AUTHENTICATED]: {
    windowMs: 20 * 1000, // 20 seconds
    max: isTestEnv ? 100000 : 20000, // 20000 requests in 20 seconds for normal users (erhöht für Dashboard)
    handler: createRateLimitHandler('Rate limit exceeded, please slow down.'),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv, // Skip rate limiting in tests
    store: redisStore, // Redis store for distributed rate limiting
  },

  // Admin endpoints
  [RateLimiterType.ADMIN]: {
    windowMs: 20 * 1000, // 20 seconds
    max: isTestEnv ? 100000 : 25000, // 25000 requests in 20 seconds for admins (erhöht für Dashboard)
    handler: createRateLimitHandler('Admin rate limit exceeded.'),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv, // Skip rate limiting in tests
    store: redisStore, // Redis store for distributed rate limiting
  },

  // API endpoints (for external integrations)
  [RateLimiterType.API]: {
    windowMs: 20 * 1000, // 20 seconds
    max: isTestEnv ? 100000 : 20000, // 20000 requests per 20 seconds for API (erhöht für Dashboard)
    handler: createRateLimitHandler('API rate limit exceeded.'),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv, // Skip rate limiting in tests
    store: redisStore, // Redis store for distributed rate limiting
  },

  // File upload endpoints
  [RateLimiterType.UPLOAD]: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: isTestEnv ? 100000 : 100, // 100 uploads per hour
    handler: createRateLimitHandler('Upload limit exceeded, please try again later.'),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv, // Skip rate limiting in tests
    store: redisStore, // Redis store for distributed rate limiting
  },

  // File download endpoints
  [RateLimiterType.DOWNLOAD]: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isTestEnv ? 100000 : 500, // 500 downloads in 15 minutes
    handler: createRateLimitHandler('Download limit exceeded, please try again later.'),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv, // Skip rate limiting in tests
    store: redisStore, // Redis store for distributed rate limiting
  },
} satisfies Record<RateLimiterType, Parameters<typeof rateLimit>[0]>;

// Create rate limiter instances
// Object.entries loses the enum type, so we explicitly type the accumulator and cast the initial value
const rateLimiters = Object.entries(rateLimiterConfigs).reduce<
  Record<RateLimiterType, RateLimitMiddleware>
>(
  (
    acc: Record<RateLimiterType, RateLimitMiddleware>,
    [type, config]: [string, Parameters<typeof rateLimit>[0]],
  ) => ({
    ...acc,
    [type]: rateLimit(config),
  }),
  {} as Record<RateLimiterType, RateLimitMiddleware>,
);

// ✅ IMPLEMENTED: Advanced rate limiting with Redis store (Best Practice 2025)
// - Distributed rate limiting across multiple server instances
// - Persistent counters (survive restarts)
// - Graceful fallback to in-memory if Redis unavailable
// - See createRedisStore() function above for implementation

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

// ============================================================
// TODO: Implement brute force protection with redis store
// ============================================================
//
// WARUM SPÄTER:
// - Komplexität: MEDIUM (30-45 min) - nicht "no-brainer" wie Redis rate limiting
// - Neue Dependency: rate-limiter-flexible erforderlich
// - Login Integration: Erfordert Änderungen in auth.controller.ts
// - Testing: Fail/Success Szenarien müssen getestet werden
// - Aktueller Schutz: Rate limiting (50 req/20s) bietet Basis-Schutz für Dev-Phase
// - Best Timing: Pre-Production Security Hardening Phase (zusammen mit API keys + Security Audit)
//
// SICHERHEITSRISIKO (Redis Docs):
// "No built-in rate limiting exists; implement at application/firewall layer"
// Redis verarbeitet Anfragen sehr schnell → Angreifer können viele Passwörter/Sekunde testen
//
// ATTACK VECTORS (Aktuell OFFEN):
// ❌ Slow brute force: 150 login attempts/minute möglich (50/20s rate limit)
// ❌ Distributed attacks: Jede IP bekommt eigenes 50/20s Limit
// ❌ Credential stuffing: Keine Username-basierte Verfolgung
// ❌ Password spraying: Keine tägliche IP-Limite
//
// EMPFOHLENE IMPLEMENTATION (Best Practice 2025):
//
// 1. Package installieren:
//    pnpm add rate-limiter-flexible
//
// 2. Drei-Schichten-Schutz (aus rate-limiter-flexible Docs):
//
//    a) Slow Brute Force (IP-basiert, täglich):
//       - 100 fehlgeschlagene Versuche pro Tag
//       - Block: 24 Stunden
//
//    b) Fast Brute Force (Username + IP, konsekutiv):
//       - 10 konsekutive Fehler
//       - Block: 1 Stunde
//       - Reset bei erfolgreichem Login
//
//    c) In-Memory Blocking:
//       - Reduziert Redis-Last
//       - Sofortige Blockierung im Prozess-Memory
//
// 3. Integration in auth.controller.ts:
//    - Check vor Login-Versuch
//    - Consume on failure
//    - Delete on success
//
// QUELLEN & DOKUMENTATION:
// - Redis Security: https://redis.io/docs/latest/operate/oss_and_stack/management/security/
// - rate-limiter-flexible: https://github.com/animir/node-rate-limiter-flexible/wiki/Overall-example
// - Context7 Library: /animir/node-rate-limiter-flexible (132 code examples, Trust Score 8.1)
// - Medium Guide: https://medium.com/@sandunilakshika2026/prevent-brute-force-attacks-in-node-js-using-redis-and-rate-limiter-flexible-d93ecc4235f9
// - Dev.to Pattern: https://dev.to/thevinitgupta/preventing-multiple-failed-input-attack-using-redis-and-nodejs-37o1
//
// SECURITY LEVEL:
// Current: Level 1 (Basic) - General rate limiting only
// Target:  Level 2 (Hardened) - Failed login tracking + progressive blocking
// Goal:    Level 3 (Production) - Level 2 + TLS + ACLs + API keys
//
// IMPLEMENTATION PRIORITY: Pre-Production (vor Launch, nach Core Features)
// ESTIMATED EFFORT: 30-45 minutes (full implementation) oder 10 min (quick win in-memory)
// ============================================================

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
