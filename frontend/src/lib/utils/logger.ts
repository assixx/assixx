/**
 * Frontend Logger Utility
 *
 * Environment-aware logger for SvelteKit with Loki integration
 *
 * CRITICAL: Uses import.meta.env.DEV for build-time detection
 * - Development: Full logging to console + Loki (if configured)
 * - Production: JSON to stdout + Loki
 *
 * Environment Variables (SSR only):
 * - LOKI_URL: Grafana Cloud Loki URL (with GRAFANA_CLOUD_USER/API_KEY)
 * - LOKI_LOCAL_URL: Local Docker Loki URL (default: loki on port 3100)
 *
 * Why Pino?
 * - Consistency with backend (NestJS uses Pino)
 * - Structured JSON logging
 * - pino-loki integration for Grafana
 * - Type-safe API
 *
 * @module logger
 * @see docs/adr/ADR-002-alerting-monitoring.md
 */

import pino from 'pino';

import { browser } from '$app/environment';

import type { TransportMultiOptions, TransportSingleOptions } from 'pino';

/** Loki configuration constants */
const LOKI_CONFIG = {
  defaultUrl: 'http://loki:3100',
  batching: { interval: 5 },
  labels: { app: 'assixx', service: 'frontend' },
} as const;

/** Loki target for dual logging */
interface LokiTarget {
  url: string;
  basicAuth?: { username: string; password: string };
  label: string;
}

/**
 * Get Grafana Cloud auth from environment
 */
function getGrafanaCloudAuth(): { username: string; password: string } | undefined {
  if (browser) return undefined;
  const userId = process.env.GRAFANA_CLOUD_USER;
  const apiKey = process.env.GRAFANA_CLOUD_API_KEY;
  if (userId !== undefined && userId !== '' && apiKey !== undefined && apiKey !== '') {
    return { username: userId, password: apiKey };
  }
  return undefined;
}

/**
 * Get all Loki targets (supports dual: local + cloud) - SSR only
 */
function getLokiTargets(): LokiTarget[] {
  if (browser) return [];
  const targets: LokiTarget[] = [];

  // Grafana Cloud (LOKI_URL with auth)
  const cloudUrl = process.env.LOKI_URL;
  const basicAuth = getGrafanaCloudAuth();
  if (cloudUrl !== undefined && cloudUrl !== '' && basicAuth !== undefined) {
    targets.push({ url: cloudUrl, basicAuth, label: 'cloud' });
  }

  // Local Docker Loki (LOKI_LOCAL_URL, no auth)
  const localUrl = process.env.LOKI_LOCAL_URL;
  if (localUrl !== undefined && localUrl !== '') {
    targets.push({ url: localUrl, label: 'local' });
  }

  return targets;
}

/**
 * Build Loki transport targets - SSR only
 */
function buildLokiTransports(level: string): TransportMultiOptions['targets'] {
  const lokiTargets = getLokiTargets();
  const env = import.meta.env.DEV ? 'development' : 'production';

  return lokiTargets.map((target: LokiTarget) => ({
    target: 'pino-loki',
    options: {
      host: target.url,
      basicAuth: target.basicAuth,
      batching: true,
      interval: LOKI_CONFIG.batching.interval,
      labels: { ...LOKI_CONFIG.labels, env, loki_target: target.label },
    },
    level,
  }));
}

/**
 * Build SSR transport configuration
 */
function buildSSRTransport(): TransportSingleOptions | TransportMultiOptions | undefined {
  const lokiTargets = getLokiTargets();
  const hasLoki = lokiTargets.length > 0;

  // Development: pino-pretty + Loki
  if (import.meta.env.DEV) {
    if (hasLoki) {
      return {
        targets: [
          {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
            level: 'debug',
          },
          ...buildLokiTransports('debug'),
        ],
      };
    }
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  }

  // Production: stdout + Loki
  if (hasLoki) {
    return {
      targets: [
        { target: 'pino/file', options: { destination: 1 }, level: 'info' },
        ...buildLokiTransports('info'),
      ],
    };
  }

  return undefined;
}

/** Valid log levels for opt-in override */
const VALID_LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

/** Type guard: check if a string is a valid Pino log level */
function isValidLogLevel(value: string | undefined): value is pino.Level {
  return value !== undefined && VALID_LOG_LEVELS.has(value);
}

/**
 * Determine log level based on environment
 *
 * Default: INFO everywhere (clean output, only meaningful events)
 * Opt-in to DEBUG when actively troubleshooting.
 *
 * SSR (terminal):
 *   LOG_LEVEL=debug pnpm run dev:svelte
 *
 * Browser (console):
 *   localStorage.setItem('LOG_LEVEL', 'debug'); location.reload();
 *   localStorage.removeItem('LOG_LEVEL'); location.reload();
 */
function getLogLevel(): pino.Level | 'silent' {
  // SSR: check LOG_LEVEL env var, default to 'info'
  if (!browser) {
    if (import.meta.env.PROD) return 'info';
    const envLevel = process.env.LOG_LEVEL;
    return isValidLogLevel(envLevel) ? envLevel : 'info';
  }

  // Production browser: silent (esbuild.drop removes console.* anyway)
  if (import.meta.env.PROD) return 'silent';

  // Dev browser: respect localStorage override, default to 'info'
  const stored = localStorage.getItem('LOG_LEVEL') ?? undefined;
  return isValidLogLevel(stored) ? stored : 'info';
}

/**
 * Create browser-specific Pino configuration
 *
 * Development: Pretty console output with custom formatting
 * Production: Silent (no output, no overhead)
 */
function createBrowserConfig(): pino.LoggerOptions['browser'] | undefined {
  if (!browser) return undefined;

  // Production: completely disabled
  if (import.meta.env.PROD) {
    return { disabled: true };
  }

  // Development: custom console output
  return {
    asObject: true,
    write: {
      debug: (o: object) => {
        console.debug('[DEBUG]', o);
      },
      info: (o: object) => {
        console.info('[INFO]', o);
      },
      warn: (o: object) => {
        console.warn('[WARN]', o);
      },
      error: (o: object) => {
        console.error('[ERROR]', o);
      },
      fatal: (o: object) => {
        console.error('[FATAL]', o);
      },
    },
  };
}

/**
 * Build complete logger options
 */
function buildLoggerOptions(): pino.LoggerOptions {
  const baseOptions: pino.LoggerOptions = {
    level: getLogLevel(),
    base: {
      service: 'assixx-frontend',
      env: import.meta.env.DEV ? 'development' : 'production',
    },
  };

  // Browser: custom console output
  if (browser) {
    return { ...baseOptions, browser: createBrowserConfig() };
  }

  // SSR: add transport if available
  const transport = buildSSRTransport();
  if (transport) {
    return { ...baseOptions, transport };
  }

  return baseOptions;
}

/**
 * Main Pino logger instance
 *
 * Usage:
 *   import { logger } from '$lib/utils/logger';
 *   logger.info('Application started');
 *   logger.warn({ deprecated: 'v1' }, 'Using deprecated API');
 *   logger.error({ err: error }, 'Request failed');
 */
const pinoLogger = pino(buildLoggerOptions());

/**
 * Application Logger - Default export
 *
 * Pino convention: Object first, message second
 *
 * @example
 * // Simple message
 * logger.info('User logged in');
 *
 * // With context object
 * logger.info({ userId: 123, action: 'login' }, 'User logged in');
 *
 * // Error logging
 * logger.error({ err: error, userId: 123 }, 'Failed to fetch user');
 */
export const logger = pinoLogger;

/**
 * Create a child logger with component/service context.
 *
 * Each child logger includes the context in every log entry,
 * making it easy to filter logs by component.
 *
 * @example
 * const log = createLogger('TokenManager');
 * log.info('Token refreshed');
 * // Output: { context: 'TokenManager', msg: 'Token refreshed', ... }
 *
 * log.warn({ remaining: 300 }, 'Token expiring soon');
 * // Output: { context: 'TokenManager', remaining: 300, msg: 'Token expiring soon', ... }
 */
export function createLogger(context: string): pino.Logger {
  return pinoLogger.child({ context });
}

/**
 * SSR-safe check for development mode
 *
 * Use this instead of hostname checks!
 * - Build-time constant (tree-shaken in production)
 * - Works identically in SSR and browser
 *
 * @example
 * if (isDev) {
 *   // This entire block is removed in production build
 *   window.debugData = data;
 * }
 */
export const isDev = import.meta.env.DEV;

/**
 * SSR-safe check for production mode
 *
 * @example
 * if (isProd) {
 *   // Production-only code
 *   analytics.track('pageview');
 * }
 */
export const isProd = import.meta.env.PROD;

/**
 * Type exports for consumers
 */
export type { Logger } from 'pino';
