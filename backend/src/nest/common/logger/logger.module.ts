/**
 * Pino Logger Module
 *
 * NestJS module for Pino logging integration.
 * Replaces Winston with Fastify's built-in Pino logger.
 *
 * Features:
 * - Automatic request context binding via AsyncLocalStorage
 * - Sensitive data redaction (passwords, tokens, etc.)
 * - Environment-aware log levels
 * - Pretty printing in development, JSON in production
 * - pino-loki transport to Grafana Loki (when LOKI_URL is set)
 *
 * @see https://github.com/iamolegga/nestjs-pino
 * @see docs/adr/ADR-002-alerting-monitoring.md
 */
import { Module, RequestMethod } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import type { TransportMultiOptions, TransportSingleOptions } from 'pino';

import {
  EXCLUDED_ROUTES,
  EXCLUDED_URL_PATHS,
  LOG_LEVELS,
  LOKI_CONFIG,
  REDACTED_VALUE,
  REDACT_PATHS,
  getGrafanaCloudAuth,
} from './logger.constants.js';

/**
 * Get log level based on NODE_ENV
 */
function getLogLevel(): string {
  const env = process.env['NODE_ENV'] ?? 'development';
  if (env === 'production') return LOG_LEVELS.production;
  if (env === 'test') return LOG_LEVELS.test;
  return LOG_LEVELS.development;
}

/**
 * Check if we're in production
 */
const isProduction = process.env['NODE_ENV'] === 'production';

/**
 * Loki target configuration for dual logging support
 */
interface LokiTargetConfig {
  url: string;
  basicAuth?: { username: string; password: string };
  label: string;
}

/**
 * Get all Loki targets (supports dual: local + cloud)
 */
function getLokiTargets(): LokiTargetConfig[] {
  const targets: LokiTargetConfig[] = [];

  // 1. Grafana Cloud (LOKI_URL with auth)
  const cloudUrl = process.env['LOKI_URL'];
  const basicAuth = getGrafanaCloudAuth();
  if (cloudUrl !== undefined && cloudUrl !== '' && basicAuth !== undefined) {
    targets.push({ url: cloudUrl, basicAuth, label: 'cloud' });
  }

  // 2. Local Docker Loki (LOKI_LOCAL_URL, no auth)
  const localUrl = process.env['LOKI_LOCAL_URL'];
  if (localUrl !== undefined && localUrl !== '') {
    targets.push({ url: localUrl, label: 'local' });
  }

  // Fallback: production default
  if (targets.length === 0 && isProduction) {
    targets.push({ url: LOKI_CONFIG.defaultUrl, label: 'local' });
  }

  return targets;
}

/**
 * Build Loki transport targets from configuration
 */
function buildLokiTransportTargets(level: string): TransportMultiOptions['targets'] {
  const lokiTargets = getLokiTargets();
  const env = process.env['NODE_ENV'] ?? 'development';

  return lokiTargets.map((target: LokiTargetConfig) => ({
    target: 'pino-loki',
    options: {
      host: target.url,
      basicAuth: target.basicAuth,
      batching: true,
      interval: LOKI_CONFIG.batching.interval,
      labels: {
        ...LOKI_CONFIG.labels,
        env,
        loki_target: target.label,
      },
    },
    level,
  }));
}

/**
 * Build transport configuration
 *
 * Supports dual Loki: local Docker Loki + Grafana Cloud simultaneously
 */
function buildTransport(): TransportSingleOptions | TransportMultiOptions | undefined {
  const lokiTargets = getLokiTargets();
  const hasLokiTargets = lokiTargets.length > 0;

  // Development mode
  // Use LOG_LEVEL env var or default from LOG_LEVELS constant (info)
  const level = process.env['LOG_LEVEL'] ?? getLogLevel();

  if (!isProduction) {
    if (hasLokiTargets) {
      return {
        targets: [
          {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
              singleLine: false,
            },
            level, // Use computed level, not hardcoded 'debug'
          },
          ...buildLokiTransportTargets(level),
        ],
      };
    }

    // Development without Loki: just pino-pretty
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    };
  }

  // Production without Loki: no transport (JSON to stdout)
  if (!hasLokiTargets) {
    return undefined;
  }

  // Production with Loki: stdout + all Loki targets
  return {
    targets: [
      {
        target: 'pino/file',
        options: { destination: 1 },
        level: 'info',
      },
      ...buildLokiTransportTargets('info'),
    ],
  };
}

/**
 * Minimal request serializer - only method and URL
 *
 * Why no userAgent/contentType?
 * - userAgent: "Mozilla/5.0..." is noise 99% of the time
 * - contentType: Almost always "application/json"
 * - These can be added at debug level if needed for specific investigations
 */
function minimalReqSerializer(req: { method?: string; url?: string }): Record<string, unknown> {
  return {
    method: req.method,
    url: req.url,
  };
}

/**
 * Minimal response serializer - only status code
 */
function minimalResSerializer(res: { statusCode?: number }): Record<string, unknown> {
  return {
    statusCode: res.statusCode,
  };
}

/**
 * Build pinoHttp options with conditional transport
 *
 * Key optimizations:
 * 1. Errors (4xx/5xx) are NOT logged here - AllExceptionsFilter handles them
 * 2. Success requests use minimal serializers (no header dump)
 * 3. High-frequency endpoints (health, metrics) are ignored
 */
function buildPinoHttpOptions(): Record<string, unknown> {
  const transport = buildTransport();
  const baseOptions = {
    level: process.env['LOG_LEVEL'] ?? getLogLevel(),
    redact: {
      paths: [...REDACT_PATHS],
      censor: REDACTED_VALUE,
    },

    // Silence ALL pino-http auto-logging:
    // - Errors (4xx/5xx): Handled by AllExceptionsFilter with full context
    // - Success (2xx/3xx): Handled by services with business context
    // This prevents duplicate "request completed" logs
    customLogLevel: (): string => 'silent',

    // Minimal serializers - no verbose header dumps
    serializers: {
      req: minimalReqSerializer,
      res: minimalResSerializer,
    },

    // Auto-logging with ignore function for high-frequency endpoints
    // (health checks, metrics scraping, etc.)
    autoLogging: {
      ignore: (req: { url?: string }): boolean => {
        const url = req.url ?? '';
        return EXCLUDED_URL_PATHS.some(
          (path: string) => url === path || url.startsWith(`${path}?`),
        );
      },
    },
  };

  // Only include transport if defined
  if (transport !== undefined) {
    return { ...baseOptions, transport };
  }

  return baseOptions;
}

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: buildPinoHttpOptions(),

      // Exclude health check and metrics routes from logging
      exclude: EXCLUDED_ROUTES.map((route: (typeof EXCLUDED_ROUTES)[number]) => ({
        method: RequestMethod.GET,
        path: route.path,
      })),
    }),
  ],
  exports: [PinoLoggerModule],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module pattern requires class
export class LoggerModule {}
