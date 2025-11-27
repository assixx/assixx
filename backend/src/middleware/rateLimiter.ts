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
const isTestEnv = process.env['NODE_ENV'] === 'test';

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
    const contentType = req.headers['content-type'];
    const isJsonRequest =
      typeof contentType === 'string' && contentType.includes('application/json');
    if (req.path.startsWith('/api/') || isJsonRequest) {
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

/**
 * Build rate limiter config with optional Redis store
 * Only includes store property when redisStore is defined (Best Practice: exactOptionalPropertyTypes)
 */
function buildRateLimiterConfig(
  windowMs: number,
  max: number,
  message: string,
  options?: { skipSuccessfulRequests?: boolean },
): Parameters<typeof rateLimit>[0] {
  const baseConfig = {
    windowMs,
    max: isTestEnv ? 100000 : max,
    handler: createRateLimitHandler(message),
    standardHeaders: true as const,
    legacyHeaders: false as const,
    skip: (): boolean => isTestEnv,
    ...options,
  };

  // Only add store if redisStore is defined (avoids exactOptionalPropertyTypes error)
  if (redisStore !== undefined) {
    return { ...baseConfig, store: redisStore };
  }
  return baseConfig;
}

// Rate limiter configurations - built dynamically to handle optional Redis store
const rateLimiterConfigs: Record<RateLimiterType, Parameters<typeof rateLimit>[0]> = {
  [RateLimiterType.PUBLIC]: buildRateLimiterConfig(
    20 * 1000,
    500,
    'Too many requests from this IP, please try again later.',
  ),
  [RateLimiterType.AUTH]: buildRateLimiterConfig(
    20 * 1000,
    50,
    'Too many authentication attempts, please try again later.',
    { skipSuccessfulRequests: false },
  ),
  [RateLimiterType.AUTHENTICATED]: buildRateLimiterConfig(
    20 * 1000,
    20000,
    'Rate limit exceeded, please slow down.',
  ),
  [RateLimiterType.ADMIN]: buildRateLimiterConfig(20 * 1000, 25000, 'Admin rate limit exceeded.'),
  [RateLimiterType.API]: buildRateLimiterConfig(20 * 1000, 20000, 'API rate limit exceeded.'),
  [RateLimiterType.UPLOAD]: buildRateLimiterConfig(
    60 * 60 * 1000,
    100,
    'Upload limit exceeded, please try again later.',
  ),
  [RateLimiterType.DOWNLOAD]: buildRateLimiterConfig(
    15 * 60 * 1000,
    500,
    'Download limit exceeded, please try again later.',
  ),
};

// Create rate limiter instances using explicit iteration (avoids Object.entries type erasure)
const rateLimiters: Record<RateLimiterType, RateLimitMiddleware> = {
  [RateLimiterType.PUBLIC]: rateLimit(rateLimiterConfigs[RateLimiterType.PUBLIC]),
  [RateLimiterType.AUTH]: rateLimit(rateLimiterConfigs[RateLimiterType.AUTH]),
  [RateLimiterType.AUTHENTICATED]: rateLimit(rateLimiterConfigs[RateLimiterType.AUTHENTICATED]),
  [RateLimiterType.ADMIN]: rateLimit(rateLimiterConfigs[RateLimiterType.ADMIN]),
  [RateLimiterType.API]: rateLimit(rateLimiterConfigs[RateLimiterType.API]),
  [RateLimiterType.UPLOAD]: rateLimit(rateLimiterConfigs[RateLimiterType.UPLOAD]),
  [RateLimiterType.DOWNLOAD]: rateLimit(rateLimiterConfigs[RateLimiterType.DOWNLOAD]),
};

// ✅ IMPLEMENTED: Advanced rate limiting with Redis store (Best Practice 2025)
// - Distributed rate limiting across multiple server instances
// - Persistent counters (survive restarts)
// - Graceful fallback to in-memory if Redis unavailable
// - See createRedisStore() function above for implementation

// Type-safe rate limiter middleware factory
// ESLint flags these as unsafe due to Object.entries type erasure, but they are safe:
// 1. rateLimiterConfigs uses 'satisfies' to ensure all enum keys exist
// 2. rateLimiters is explicitly typed as Record<RateLimiterType, RateLimitMiddleware>
// 3. All access uses RateLimiterType enum values (not arbitrary strings)
export const rateLimiter: RateLimiterMiddleware = Object.assign(
  (type: RateLimiterType) => {
    // eslint-disable-next-line security/detect-object-injection -- Type-safe: type is enum value, rateLimiters is properly typed Record
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
